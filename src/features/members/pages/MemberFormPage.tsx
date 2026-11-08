import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useMatch, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input, READONLY_INPUT, Select, Textarea } from "@/components/ui/Field";
import { FormPage } from "@/components/ui/FormPage";
import { Icon } from "@/components/ui/Icon";
import { PageLoader } from "@/components/ui/Loaders";
import { GRID_2, GRID_3, Section } from "@/components/ui/Section";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { usePlanLookup, useTrainerLookup } from "@/features/lookups/api";
import { FitnessGoalSelect } from "@/features/lookups/fitness-goals";
import { memberApi, memberKeys, useInvalidateMembers } from "@/features/members/api";
import { EnrolDone } from "@/features/members/components/EnrolDone";
import { emptyEntry, groupEntryError, GroupMembersField, toGroupMembers,
  type GroupEntry } from "@/features/members/components/GroupMembersField";
import { usePlanCategories } from "@/features/plans/api";
import { PlanBadges } from "@/features/plans/components/PlanBadges";
import { planDuration } from "@/features/plans/labels";
import { PaymentSummaryCard, PlanCard, WizardSteps } from "@/features/members/components/wizard-parts";
import { memberProfileSchema, toMemberBody, toProfileValues,
  type MemberProfileValues } from "@/features/members/lib/member-form";
import { OfferSelect } from "@/features/offers/components/OfferSelect";
import { MemberPicker } from "@/features/lookups/MemberPicker";
import { AssessmentSection } from "@/features/members/components/AssessmentSection";
import { MembershipHistory } from "@/features/members/components/MembershipHistory";
import { MembershipActionsDrawer } from "@/features/memberships/components/MembershipActionsDrawer";
import { RenewDrawer } from "@/features/subscriptions/components/RenewDrawer";
import { subscriptionApi, useInvalidateBilling } from "@/features/subscriptions/api";
import { useWriteAccess } from "@/hooks/use-write-access";
import { BILLING_DEFAULTS, balanceOf, billingShape, netPayable, PAYMENT_MODE_LABEL, refineBilling, round2, toEnrollPayment,
  toNumber } from "@/features/subscriptions/lib/billing";
import { formatDate, formatINR, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/notify";
import { useCan } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import { PAYMENT_MODES } from "@/types/enums";
import type { Member, MemberInput } from "@/types/member";

const PROFILE_FORM = "member-profile-form";
const PAYMENT_FORM = "member-payment-form";

const paymentSchema = z.object({
  ...billingShape,
  trainer_id: z.string(),
  needs_trainer: z.boolean(),
}).superRefine((v, ctx) => {
  refineBilling(v, ctx);
  if (v.needs_trainer && !v.trainer_id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["trainer_id"], message: "Select a trainer for personal training" });
  }
});
type PaymentValues = z.infer<typeof paymentSchema>;

type Step = 1 | 2 | 3;

/**
 * /members/new: the 3-step registration — profile (POST /members) → plans + start date → payment
 * (POST /subscriptions/enroll) → invoice.
 * /members/:id (view) and /members/:id/edit: the profile only (PUT /members) plus the Membership card — plan history
 * and the Renew / Upgrade drawer, so fixing a phone number never walks through billing.
 */
export function MemberFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!useMatch("/members/:id/edit");
  const branch = useBranchStore((s) => s.selectedBranchId);
  const canUpdate = useCan("member:update");

  const member = useQuery({
    queryKey: memberKeys.detail(branch, id ?? ""),
    queryFn: () => memberApi.get(id!),
    enabled: !!id,
  });

  if (id && member.isLoading) return <PageLoader />;
  if (id && !member.data) {
    return (
      <FormPage title="Member not found" backTo="/members" backLabel="Members">
        <p className="text-sm text-muted">{member.error?.message ?? "This member does not exist in the selected branch."}</p>
      </FormPage>
    );
  }
  // key: a different member (or new → saved) starts the wizard clean.
  const m = member.data?.data ?? null;
  return <MemberWizard key={m?.id ?? "new"} member={m} readOnly={!!m && (!isEdit || !canUpdate)} />;
}

interface MemberWizardProps {
  /** null = new registration. */
  member: Member | null;
  /** View: profile shown read-only, no plan / payment steps. */
  readOnly: boolean;
}

function MemberWizard({ member, readOnly }: MemberWizardProps) {
  const navigate = useNavigate();
  const branch = useBranchStore((s) => s.selectedBranchId);
  const canUpdate = useCan("member:update");
  // Plan + payment steps belong to a new registration; existing members renew / upgrade from the drawer.
  const canEnroll = useCan("subscription:create") && !member;
  const billing = useWriteAccess("subscription:create");
  const [renewing, setRenewing] = useState<"renew" | "upgrade" | null>(null);
  const manage = useWriteAccess("membership:manage");
  const [managing, setManaging] = useState(false);
  const invalidateMembers = useInvalidateMembers();
  const invalidateBilling = useInvalidateBilling();
  const toList = () => navigate("/members");

  const [step, setStep] = useState<Step>(1);
  const [memberId, setMemberId] = useState<string | null>(member?.id ?? null);
  const [registrationId, setRegistrationId] = useState<string | null>(member?.registration_id ?? null);
  const [planIds, setPlanIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(todayISO());
  /** Set once the payment is saved: the success screen with "Send on WhatsApp". */
  const [donePaymentId, setDonePaymentId] = useState<string | null>(null);

  // ── data ────────────────────────────────────────────────────────────
  const nextId = useQuery({
    queryKey: memberKeys.nextRegistrationId(branch),
    queryFn: memberApi.nextRegistrationId,
    enabled: !member,
    staleTime: 0,
  });
  const plansQuery = usePlanLookup(undefined, canEnroll, true);
  const plans = useMemo(() => plansQuery.data ?? [], [plansQuery.data]);
  const selectedPlans = useMemo(() => plans.filter((p) => planIds.includes(p.id)), [plans, planIds]);
  const gross = round2(selectedPlans.reduce((sum, p) => sum + p.price, 0));
  const needsTrainer = selectedPlans.some((p) => p.service_type === "PERSONAL_TRAINING");
  const trainers = useTrainerLookup(canEnroll && needsTrainer);

  // Category chips: the owner's categories that have plans on sale, in their order.
  const categories = usePlanCategories();
  const planCats = useMemo(() => (categories.data ?? []).filter((c) => plans.some((p) => p.category_id === c.id)),
    [categories.data, plans]);
  const [catId, setCatId] = useState<string | null>(null);
  const activeCat = catId ?? planCats[0]?.id ?? null;

  // Group package (couple, family …): the other members; ID check (student plans).
  const groupPlan = selectedPlans.find((p) => p.group_size > 1) ?? null;
  const [groupEntries, setGroupEntries] = useState<GroupEntry[]>([]);
  useEffect(() => {
    const needed = groupPlan ? groupPlan.group_size - 1 : 0;
    setGroupEntries((cur) => (cur.length === needed ? cur
      : [...cur.slice(0, needed), ...Array.from({ length: Math.max(0, needed - cur.length) }, emptyEntry)]));
  }, [groupPlan]);
  const idChecks = [...new Set(selectedPlans.flatMap((p) => (p.id_check ? [p.id_check] : [])))];
  const [idVerified, setIdVerified] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  // ── step 1: profile ─────────────────────────────────────────────────
  const profile = useForm<MemberProfileValues>({
    resolver: zodResolver(memberProfileSchema),
    defaultValues: toProfileValues(member),
  });
  const pErr = profile.formState.errors;

  const saveMember = useMutation({
    mutationFn: (body: MemberInput) => (memberId ? memberApi.update(memberId, body) : memberApi.create(body)),
    onSuccess: async (res) => {
      notify.success(res.message);
      setMemberId(res.data.id);
      setRegistrationId(res.data.registration_id);
      profile.reset(toProfileValues(res.data));
      await invalidateMembers();
      if (canEnroll) setStep(2);
      else toList();
    },
    onError: notify.error,
  });

  const onSubmitProfile = (v: MemberProfileValues) =>
    saveMember.mutate(toMemberBody(v));

  // ── step 3: payment ─────────────────────────────────────────────────
  const payment = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { ...BILLING_DEFAULTS, trainer_id: "", needs_trainer: false },
  });
  const yErr = payment.formState.errors;
  const discount = payment.watch("discount_amount");
  const paid = payment.watch("paid_amount");
  const reason = payment.watch("discount_reason");
  const offerId = payment.watch("offer_id");

  useEffect(() => {
    payment.setValue("amount", gross);
    payment.setValue("needs_trainer", needsTrainer);
  }, [gross, needsTrainer, payment]);

  // Amount received defaults to the full net payable whenever the total or discount changes.
  useEffect(() => {
    const net = netPayable(gross, discount);
    if (Number.isFinite(net)) payment.setValue("paid_amount", String(net));
  }, [gross, discount, payment]);

  const balance = balanceOf(gross, discount, paid);

  const enroll = useMutation({
    mutationFn: subscriptionApi.enroll,
    onSuccess: async (res) => {
      notify.success(res.message);
      setDonePaymentId(res.data.payment_id);
      await invalidateBilling();
    },
    onError: notify.error,
  });

  const onSubmitPayment = (v: PaymentValues) => {
    if (!memberId) return;
    enroll.mutate({
      member_id: memberId,
      plan_ids: planIds,
      start_date: startDate || null,
      trainer_id: needsTrainer && v.trainer_id ? v.trainer_id : null,
      group_members: groupPlan ? toGroupMembers(groupEntries) : [],
      id_verified: idChecks.length > 0 && idVerified,
      payment: toEnrollPayment(v),
    });
  };

  // ── navigation ──────────────────────────────────────────────────────
  const canReach = (s: Step) =>
    s === 1 || (canEnroll && !!memberId && (s === 2 || planIds.length > 0));

  const goToPayment = () => {
    const problem = planIds.length === 0 ? "Select a plan"
      : !startDate ? "Choose the start date"
        : groupPlan ? groupEntryError(groupEntries)
          : null;
    const idProblem = idChecks.length > 0 && !idVerified ? `Tick "${idChecks.join(", ")} verified" to continue` : null;
    setPlanError(problem ?? idProblem);
    if (!problem && !idProblem) setStep(3);
  };

  const togglePlan = (id: string) => {
    setPlanError(null);
    const plan = plans.find((p) => p.id === id);
    setPlanIds((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      // One group package per bill: picking another replaces it.
      const next = plan && plan.group_size > 1 ? cur.filter((x) => (plans.find((p) => p.id === x)?.group_size ?? 1) <= 1) : cur;
      return [...next, id];
    });
  };

  const regIdDisplay = registrationId ?? (nextId.isLoading ? "Fetching…" : nextId.data?.data.code ?? "");
  const title = readOnly ? member?.name ?? "Member" : member ? "Edit member" : "New member";
  const subtitle = member
    ? <span className="inline-flex flex-wrap items-center gap-2">{member.registration_id} · {member.phone}
        <StatusBadge value={member.membership_state} /></span>
    : "Register a member, pick a plan and collect the payment";

  const actions = readOnly ? (
    <>
      <Button variant="secondary" onClick={toList}>Close</Button>
      {canUpdate && member && (
        <Button icon={<Icon name="edit" className="h-4 w-4" />} onClick={() => navigate(`/members/${member.id}/edit`)}>
          Edit member
        </Button>
      )}
    </>
  ) : step === 1 ? (
    <>
      <Button variant="secondary" onClick={toList}>Cancel</Button>
      <Button type="submit" form={PROFILE_FORM} loading={saveMember.isPending}>
        {canEnroll ? "Save & choose plan" : member ? "Save changes" : "Save member"}
      </Button>
    </>
  ) : step === 2 ? (
    <>
      <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
      {member && <Button variant="secondary" onClick={toList}>Skip, no new plan</Button>}
      <Button onClick={goToPayment}>Continue to payment</Button>
    </>
  ) : (
    <>
      <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
      <Button type="submit" form={PAYMENT_FORM} loading={enroll.isPending}>Complete &amp; collect payment</Button>
    </>
  );

  if (donePaymentId) {
    return (
      <FormPage title={member ? "Membership renewed" : "Member registered"} backTo="/members" backLabel="Members">
        <EnrolDone paymentId={donePaymentId} welcome={!member} onAddAnother={() => navigate(0)} onClose={toList} />
      </FormPage>
    );
  }

  return (
    <FormPage
      title={title}
      subtitle={subtitle}
      backTo="/members"
      backLabel="Members"
      header={!member && <WizardSteps current={step} canReach={canReach} onSelect={(s) => canReach(s) && setStep(s)} />}
      actions={actions}
    >
      {/* Step 1 — profile (kept mounted so values survive Back) */}
      <form id={PROFILE_FORM} onSubmit={profile.handleSubmit(onSubmitProfile)} noValidate
        className={step === 1 ? "flex flex-col gap-5" : "hidden"}>
        <fieldset disabled={readOnly} className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0">
          <Section title="Personal details" description="Basic and contact information">
            <div className={GRID_3}>
              <Field label="Registration ID" htmlFor="m-reg">
                <Input id="m-reg" value={regIdDisplay} readOnly className={READONLY_INPUT} />
              </Field>
              <Field label="Full name" htmlFor="m-name" required error={pErr.name?.message}>
                <Input id="m-name" placeholder="Enter name" invalid={!!pErr.name} {...profile.register("name")} />
              </Field>
              <Field label="Phone number" htmlFor="m-phone" required error={pErr.phone?.message}>
                <Input id="m-phone" inputMode="numeric" maxLength={10} placeholder="10-digit mobile" invalid={!!pErr.phone}
                  {...profile.register("phone")} />
              </Field>
              <Field label="Gender" htmlFor="m-gender" required>
                <Select id="m-gender" {...profile.register("gender")}>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </Select>
              </Field>
              <Field label="Date of birth" htmlFor="m-dob">
                <Input id="m-dob" type="date" max={todayISO()} {...profile.register("dob")} />
              </Field>
              <Field label="Joining date" htmlFor="m-joining" required error={pErr.joining_date?.message}>
                <Input id="m-joining" type="date" invalid={!!pErr.joining_date} {...profile.register("joining_date")} />
              </Field>
              <Field label="Address" htmlFor="m-address" className="md:col-span-2 lg:col-span-3" error={pErr.address?.message}>
                <Textarea id="m-address" rows={2} placeholder="Full residential address" {...profile.register("address")} />
              </Field>
              <Field label="Referred by" htmlFor="m-referred" className="md:col-span-2"
                hint="The member who brought them in (counts for referral rewards)">
                <Controller name="referred_by_id" control={profile.control} render={({ field }) => (
                  <MemberPicker id="m-referred" value={field.value} onChange={field.onChange} excludeId={member?.id}
                    currentName={member?.referred_by_name} placeholder="Not referred" />
                )} />
              </Field>
            </div>
          </Section>

          <Section title="Health & goals" description="Used for diet plans and progress tracking">
            <div className={GRID_3}>
              <Field label="Weight (kg)" htmlFor="m-weight" error={pErr.weight?.message}>
                <Input id="m-weight" type="number" step="0.1" placeholder="e.g. 75" invalid={!!pErr.weight} {...profile.register("weight")} />
              </Field>
              <Field label="Height (cm)" htmlFor="m-height" error={pErr.height?.message}>
                <Input id="m-height" type="number" step="0.1" placeholder="e.g. 175" invalid={!!pErr.height} {...profile.register("height")} />
              </Field>
              <Field label="Blood group" htmlFor="m-blood" error={pErr.blood_group?.message}>
                <Input id="m-blood" placeholder="e.g. O+ve" invalid={!!pErr.blood_group} {...profile.register("blood_group")} />
              </Field>
              <Field label="Fitness goal" htmlFor="m-goal" className="md:col-span-2 lg:col-span-3" error={pErr.fitness_goal?.message}>
                <Controller name="fitness_goal" control={profile.control} render={({ field }) => (
                  <FitnessGoalSelect id="m-goal" optional value={field.value} onChange={field.onChange}
                    onBlur={field.onBlur} disabled={readOnly} invalid={!!pErr.fitness_goal} />
                )} />
              </Field>
            </div>
          </Section>

          <Section title="Emergency contact" description="Who to call in an emergency (optional)">
            <div className={GRID_3}>
              <Field label="Contact name" htmlFor="m-ec-name" error={pErr.emergency_contact_name?.message}>
                <Input id="m-ec-name" placeholder="Name of relative / friend" {...profile.register("emergency_contact_name")} />
              </Field>
              <Field label="Contact phone" htmlFor="m-ec-phone" error={pErr.emergency_contact_phone?.message}>
                <Input id="m-ec-phone" inputMode="numeric" maxLength={10} placeholder="10-digit mobile"
                  invalid={!!pErr.emergency_contact_phone} {...profile.register("emergency_contact_phone")} />
              </Field>
            </div>
          </Section>
        </fieldset>
      </form>

      {member && step === 1 && (
        <Section className="mt-5" title="Membership"
          description={member.current_plan_name
            ? <>Current: <b className="text-ink">{member.current_plan_name}</b>{member.expiry_date && ` · till ${formatDate(member.expiry_date)}`}</>
            : "No plan yet"}
          aside={(billing.show || manage.show) && (
            <span className="inline-flex flex-wrap justify-end gap-2">
              {manage.show && member.expiry_date && member.expiry_date >= todayISO() && (
                <span title={manage.reason} className="inline-flex">
                  <Button variant="secondary" icon={<Icon name="clock" className="h-4 w-4" />} disabled={manage.disabled}
                    onClick={() => setManaging(true)}>
                    Freeze / Transfer / Cancel
                  </Button>
                </span>
              )}
              {billing.show && (
                <span title={billing.reason} className="inline-flex">
                  <Button icon={<Icon name="refresh" className="h-4 w-4" />} disabled={billing.disabled}
                    onClick={() => setRenewing("renew")}>
                    {member.current_plan_name ? "Renew / Upgrade" : "Add plan"}
                  </Button>
                </span>
              )}
            </span>
          )}>
          <MembershipHistory memberId={member.id} />
        </Section>
      )}
      {member && step === 1 && <AssessmentSection memberId={member.id} height={member.height} weight={member.weight} />}
      {member && managing && (
        <MembershipActionsDrawer member={{ id: member.id, name: member.name }} onClose={() => setManaging(false)} />
      )}
      {member && renewing && (
        <RenewDrawer initialMode={renewing} onClose={() => setRenewing(null)}
          row={{ member_id: member.id, member_name: member.name, registration_id: member.registration_id,
            plan_name: member.current_plan_name ?? "No plan" }} />
      )}

      {/* Step 2 — plans */}
      {step === 2 && (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1fr_320px]">
          <div className="flex min-w-0 flex-col gap-5">
            {plansQuery.isLoading && <Section title="Plans"><p className="m-0 text-sm text-muted">Loading plans…</p></Section>}
            {!plansQuery.isLoading && plans.length === 0 && (
              <Section title="Plans">
                <p className="m-0 rounded-xl border-2 border-dashed border-line bg-subtle p-6 text-center text-sm text-muted">
                  No plans configured for this branch. Add them under Plans &amp; Pricing.
                </p>
              </Section>
            )}
            {plans.length > 0 && (
              <Section title="Choose a plan" description="Pick a membership, and add-ons if any">
                <div className="mb-4 flex flex-wrap gap-2">
                  {planCats.map((c) => {
                    const picked = selectedPlans.filter((p) => p.category_id === c.id).length;
                    return (
                      <button key={c.id} type="button" onClick={() => setCatId(c.id)}
                        className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
                          c.id === activeCat ? "border-accent bg-accent-light text-accent" : "border-line bg-surface text-secondary-grey hover:border-line-accent")}>
                        {c.name}
                        {picked > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-grad px-1 text-[11px] text-white">{picked}</span>}
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {plans.filter((p) => p.category_id === activeCat).map((p) => (
                    <PlanCard key={p.id} plan={p} selected={planIds.includes(p.id)} onToggle={() => togglePlan(p.id)} />
                  ))}
                </div>
              </Section>
            )}
          </div>

          <aside className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-subtle lg:sticky lg:top-[calc(var(--header-height)+24px)]">
            <div>
              <h3 className="m-0 text-[15px] font-bold text-ink">Selected</h3>
              {selectedPlans.length === 0 ? (
                <p className="m-0 mt-2 text-[13px] text-muted">Pick a membership, and add-ons if any.</p>
              ) : (
                <ul className="m-0 mt-3 flex list-none flex-col gap-2.5 p-0 text-[13px]">
                  {selectedPlans.map((p) => (
                    <li key={p.id}>
                      <div className="flex items-start justify-between gap-3">
                        <span className="min-w-0 text-ink">{p.category_name} · {p.name}</span>
                        <span className="whitespace-nowrap font-semibold text-ink">{formatINR(p.price)}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                        {planDuration(p)}<PlanBadges plan={p} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                <span className="text-sm font-semibold text-muted">Total</span>
                <span className="font-display text-2xl text-accent">{formatINR(gross)}</span>
              </div>
            </div>

            {groupPlan && (
              <div>
                <div className="mb-2 text-[13px] font-bold text-ink">Members ({groupPlan.group_size})</div>
                <GroupMembersField payerName={profile.getValues("name") || member?.name || "This member"} payerId={memberId}
                  entries={groupEntries} onChange={(e) => { setGroupEntries(e); setPlanError(null); }} />
              </div>
            )}

            {idChecks.length > 0 && (
              <Checkbox checked={idVerified} onChange={(v) => { setIdVerified(v); setPlanError(null); }}
                label={`${idChecks.join(", ")} verified`} />
            )}

            <Field label="Start date" htmlFor="m-start" required>
              <Input id="m-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            {planError && <p className="m-0 rounded-lg bg-danger-soft px-3 py-2 text-[13px] font-semibold text-danger">{planError}</p>}
          </aside>
        </div>
      )}

      {/* Step 3 — payment */}
      {step === 3 && (
        <form id={PAYMENT_FORM} onSubmit={payment.handleSubmit(onSubmitPayment)} noValidate
          className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1fr_340px]">
          <Section title="Payment" description="Discount, amount received and mode">
            {needsTrainer && (
              <Field label="Trainer" htmlFor="m-trainer" required className="mb-4" error={yErr.trainer_id?.message}
                hint="Required for the personal training plan">
                <Select id="m-trainer" invalid={!!yErr.trainer_id} {...payment.register("trainer_id")}>
                  <option value="">{trainers.isLoading ? "Loading trainers…" : "Select a trainer"}</option>
                  {(trainers.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.name} ({t.employee_code})</option>)}
                </Select>
              </Field>
            )}
            <div className={GRID_2}>
              <OfferSelect id="m-offer" lines={selectedPlans.map((p) => ({ categoryId: p.category_id, amount: p.price }))} value={offerId} className="md:col-span-2"
                setField={(n, val) => payment.setValue(n, val, { shouldValidate: n === "discount_amount" })} />
              <Field label="Amount paid now (₹)" htmlFor="m-paid" required error={yErr.paid_amount?.message}>
                <Input id="m-paid" type="number" min={0} step="0.01" placeholder="Amount received" invalid={!!yErr.paid_amount}
                  {...payment.register("paid_amount")} />
              </Field>
              <Field label="Payment mode" htmlFor="m-mode" required>
                <Select id="m-mode" {...payment.register("payment_mode")}>
                  {PAYMENT_MODES.map((m) => <option key={m} value={m}>{PAYMENT_MODE_LABEL[m]}</option>)}
                </Select>
              </Field>
              {balance > 0 && (
                <>
                  <Field label="Remaining balance" htmlFor="m-balance">
                    <Input id="m-balance" value={formatINR(balance)} readOnly className={`${READONLY_INPUT} !font-bold !text-danger`} />
                  </Field>
                  <Field label="Balance due date" htmlFor="m-due">
                    <Input id="m-due" type="date" min={todayISO()} {...payment.register("balance_due_date")} />
                  </Field>
                </>
              )}
            </div>
          </Section>
          <div className="lg:sticky lg:top-[calc(var(--header-height)+24px)]">
            <PaymentSummaryCard gross={gross} discount={toNumber(discount)} reason={reason} />
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13px]">
              {selectedPlans.map((p) => (
                <li key={p.id} className="flex justify-between gap-3 text-secondary-grey">
                  <span className="truncate">{p.name}</span>
                  <span className="font-semibold text-ink">{formatINR(p.price)}</span>
                </li>
              ))}
            </ul>
          </div>
        </form>
      )}
    </FormPage>
  );
}
