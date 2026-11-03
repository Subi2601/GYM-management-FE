import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useMatch, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Field, Input, READONLY_INPUT, Select, Textarea } from "@/components/ui/Field";
import { FormPage } from "@/components/ui/FormPage";
import { Icon } from "@/components/ui/Icon";
import { PageLoader } from "@/components/ui/Loaders";
import { GRID_2, GRID_3, Section } from "@/components/ui/Section";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { usePlanLookup, useTrainerLookup } from "@/features/lookups/api";
import { FitnessGoalSelect } from "@/features/lookups/fitness-goals";
import { memberApi, memberKeys, useInvalidateMembers } from "@/features/members/api";
import { PaymentSummaryCard, PlanCard, WizardSteps } from "@/features/members/components/wizard-parts";
import { ID_PROOF_TYPES, memberProfileSchema, toMemberBody, toProfileValues,
  type MemberProfileValues } from "@/features/members/lib/member-form";
import { openInvoice, subscriptionApi, useInvalidateBilling } from "@/features/subscriptions/api";
import { balanceOf, billingShape, netPayable, PAYMENT_MODE_LABEL, refineBilling, round2, toEnrollPayment,
  toNumber } from "@/features/subscriptions/lib/billing";
import { formatINR, todayISO } from "@/lib/format";
import { notify } from "@/lib/notify";
import { useCan } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import { PAYMENT_MODES } from "@/types/enums";
import type { Member, MemberInput } from "@/types/member";

const DISCOUNT_REASONS = ["Referral Offer", "New Year Special", "Student Discount", "Existing Client Reward",
  "Corporate Tie-up", "Other"] as const;

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
 * /members/new, /members/:id (view) and /members/:id/edit. Loads the member, then renders the 3-step
 * registration: profile (POST/PUT /members) → plans + start date → payment (POST /subscriptions/enroll) → invoice.
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
  const canEnroll = useCan("subscription:create") && !readOnly;
  const invalidateMembers = useInvalidateMembers();
  const invalidateBilling = useInvalidateBilling();
  const toList = () => navigate("/members");

  const [step, setStep] = useState<Step>(1);
  const [memberId, setMemberId] = useState<string | null>(member?.id ?? null);
  const [registrationId, setRegistrationId] = useState<string | null>(member?.registration_id ?? null);
  const [planIds, setPlanIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(todayISO());

  // ── data ────────────────────────────────────────────────────────────
  const nextId = useQuery({
    queryKey: memberKeys.nextRegistrationId(branch),
    queryFn: memberApi.nextRegistrationId,
    enabled: !member,
    staleTime: 0,
  });
  const plansQuery = usePlanLookup(undefined, canEnroll);
  const plans = useMemo(() => plansQuery.data ?? [], [plansQuery.data]);
  const selectedPlans = useMemo(() => plans.filter((p) => planIds.includes(p.id)), [plans, planIds]);
  const gross = round2(selectedPlans.reduce((sum, p) => sum + p.price, 0));
  const needsTrainer = selectedPlans.some((p) => p.service_type === "PERSONAL_TRAINING");
  const trainers = useTrainerLookup(canEnroll && needsTrainer);

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
    saveMember.mutate(toMemberBody(v, !memberId || !!profile.formState.dirtyFields.id_proof_number));

  // ── step 3: payment ─────────────────────────────────────────────────
  const payment = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: 0, discount_amount: "", discount_reason: "", paid_amount: "0", payment_mode: "CASH",
      balance_due_date: "", trainer_id: "", needs_trainer: false,
    },
  });
  const yErr = payment.formState.errors;
  const discount = payment.watch("discount_amount");
  const paid = payment.watch("paid_amount");
  const reason = payment.watch("discount_reason");

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
      openInvoice(res.data.payment_id);
      await invalidateBilling();
      toList();
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
      payment: toEnrollPayment(v),
    });
  };

  // ── navigation ──────────────────────────────────────────────────────
  const canReach = (s: Step) =>
    s === 1 || (canEnroll && !!memberId && (s === 2 || planIds.length > 0));

  const goToPayment = () => {
    if (planIds.length === 0) return notify.errorText("Please select a plan.");
    if (!startDate) return notify.errorText("Please choose the subscription start date.");
    setStep(3);
  };

  const togglePlan = (id: string) =>
    setPlanIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

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

  return (
    <FormPage
      title={title}
      subtitle={subtitle}
      backTo="/members"
      backLabel="Members"
      header={!readOnly && <WizardSteps current={step} onSelect={(s) => canReach(s) && setStep(s)} />}
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

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Section title="Emergency contact">
              <div className="flex flex-col gap-4">
                <Field label="Contact name" htmlFor="m-ec-name" error={pErr.emergency_contact_name?.message}>
                  <Input id="m-ec-name" placeholder="Name of relative / friend" {...profile.register("emergency_contact_name")} />
                </Field>
                <Field label="Contact phone" htmlFor="m-ec-phone" error={pErr.emergency_contact_phone?.message}>
                  <Input id="m-ec-phone" inputMode="numeric" maxLength={10} placeholder="10-digit mobile"
                    invalid={!!pErr.emergency_contact_phone} {...profile.register("emergency_contact_phone")} />
                </Field>
              </div>
            </Section>
            <Section title="ID proof">
              <div className="flex flex-col gap-4">
                <Field label="ID proof type" htmlFor="m-id-type" error={pErr.id_proof_type?.message}>
                  <Select id="m-id-type" {...profile.register("id_proof_type")}>
                    <option value="">Select type</option>
                    {ID_PROOF_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </Field>
                <Field label="ID proof number" htmlFor="m-id-number" error={pErr.id_proof_number?.message}>
                  <Input id="m-id-number" placeholder="e.g. 1234-5678-9012" autoComplete="off" {...profile.register("id_proof_number")} />
                </Field>
              </div>
            </Section>
          </div>
        </fieldset>
      </form>

      {/* Step 2 — plans */}
      {step === 2 && (
        <>
          <Section title="Choose plans" description="Pick a membership and any add-ons. You can select more than one.">
            {plansQuery.isLoading && <p className="m-0 text-sm text-muted">Loading plans…</p>}
            {!plansQuery.isLoading && plans.length === 0 && (
              <p className="m-0 rounded-xl border-2 border-dashed border-line bg-subtle p-6 text-center text-sm text-muted">
                No plans configured for this branch.
              </p>
            )}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
              {plans.map((p) => (
                <PlanCard key={p.id} plan={p} selected={planIds.includes(p.id)} onToggle={() => togglePlan(p.id)} />
              ))}
            </div>
          </Section>
          <Section title="Start date">
            <Field label="Subscription start date" htmlFor="m-start" required className="max-w-xs">
              <Input id="m-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
          </Section>
        </>
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
              <Field label="Discount (₹)" htmlFor="m-discount" error={yErr.discount_amount?.message}>
                <Input id="m-discount" type="number" min={0} step="0.01" placeholder="e.g. 500" invalid={!!yErr.discount_amount}
                  {...payment.register("discount_amount")} />
              </Field>
              <Field label="Offer / reason" htmlFor="m-reason">
                <Select id="m-reason" {...payment.register("discount_reason")}>
                  <option value="">No discount</option>
                  {DISCOUNT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </Select>
              </Field>
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
