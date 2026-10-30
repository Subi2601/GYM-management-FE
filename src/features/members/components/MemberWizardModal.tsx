import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { usePlanLookup, useTrainerLookup } from "@/features/lookups/api";
import { memberApi, memberKeys, useInvalidateMembers } from "@/features/members/api";
import { FormDivider, GRID_2, GRID_3, PaymentSummaryCard, PlanCard, READONLY_INPUT,
  WizardSteps } from "@/features/members/components/wizard-parts";
import { ID_PROOF_TYPES, memberProfileSchema, toMemberBody, toProfileValues,
  type MemberProfileValues } from "@/features/members/lib/member-form";
import { openInvoice, subscriptionApi, useInvalidateBilling } from "@/features/subscriptions/api";
import { balanceOf, billingShape, netPayable, PAYMENT_MODE_LABEL, refineBilling, round2, toEnrollPayment,
  toNumber } from "@/features/subscriptions/lib/billing";
import { formatINR, todayISO } from "@/lib/format";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { useCan } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import { PAYMENT_MODES } from "@/types/enums";
import type { Member, MemberInput } from "@/types/member";

const DISCOUNT_REASONS = ["Referral Offer", "New Year Special", "Student Discount", "Existing Client Reward",
  "Corporate Tie-up", "Other"] as const;

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

interface MemberWizardModalProps {
  /** null = new registration. */
  member: Member | null;
  /** View without member:update — profile shown read-only, no plan / payment steps. */
  readOnly?: boolean;
  onClose: () => void;
}

/**
 * The original 3-step member wizard: profile (POST/PUT /members) → plans + start date →
 * payment (one atomic POST /subscriptions/enroll) → invoice in a new tab.
 * Mounted only while open, so every open starts clean.
 */
export function MemberWizardModal({ member, readOnly = false, onClose }: MemberWizardModalProps) {
  const branch = useBranchStore((s) => s.selectedBranchId);
  const canEnroll = useCan("subscription:create") && !readOnly;
  const invalidateMembers = useInvalidateMembers();
  const invalidateBilling = useInvalidateBilling();

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
      else onClose();
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
      onClose();
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

  const regIdDisplay = registrationId ?? (nextId.isLoading ? "Fetching..." : nextId.data?.data.code ?? "");
  const title = readOnly ? "Member Profile" : member ? "Update Member Profile" : "New Member Registration";

  return (
    <Modal open title={title} onClose={onClose} width="900px">
      {!readOnly && <WizardSteps current={step} onSelect={(s) => canReach(s) && setStep(s)} />}

      {/* Step 1 — Personal Info (kept mounted so values survive Back) */}
      <form onSubmit={profile.handleSubmit(onSubmitProfile)} noValidate className={cn("px-[5px] py-2.5", step !== 1 && "hidden")}>
        <fieldset disabled={readOnly} className="m-0 min-w-0 border-0 p-0">
          <div className={GRID_3}>
            <Field label="Registration ID" htmlFor="m-reg">
              <Input id="m-reg" value={regIdDisplay} readOnly className={READONLY_INPUT} />
            </Field>
            <Field label="Full Name" htmlFor="m-name" required error={pErr.name?.message}>
              <Input id="m-name" placeholder="Enter name" invalid={!!pErr.name} {...profile.register("name")} />
            </Field>
            <Field label="Phone Number" htmlFor="m-phone" required error={pErr.phone?.message}>
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
            <Field label="Date of Birth" htmlFor="m-dob">
              <Input id="m-dob" type="date" max={todayISO()} {...profile.register("dob")} />
            </Field>
            <Field label="Blood Group" htmlFor="m-blood" error={pErr.blood_group?.message}>
              <Input id="m-blood" placeholder="e.g. O+ve" invalid={!!pErr.blood_group} {...profile.register("blood_group")} />
            </Field>
            <Field label="Joining Date" htmlFor="m-joining" required error={pErr.joining_date?.message}>
              <Input id="m-joining" type="date" invalid={!!pErr.joining_date} {...profile.register("joining_date")} />
            </Field>
          </div>

          <Field label="Address" htmlFor="m-address" className="mt-4" error={pErr.address?.message}>
            <Textarea id="m-address" rows={2} placeholder="Full residential address" {...profile.register("address")} />
          </Field>

          <FormDivider>Physical Metrics</FormDivider>
          <div className={GRID_3}>
            <Field label="Weight (kg)" htmlFor="m-weight" error={pErr.weight?.message}>
              <Input id="m-weight" type="number" step="0.1" placeholder="e.g. 75" invalid={!!pErr.weight} {...profile.register("weight")} />
            </Field>
            <Field label="Height (cm)" htmlFor="m-height" error={pErr.height?.message}>
              <Input id="m-height" type="number" step="0.1" placeholder="e.g. 175" invalid={!!pErr.height} {...profile.register("height")} />
            </Field>
            <Field label="Fitness Goal" htmlFor="m-goal" error={pErr.fitness_goal?.message}>
              <Input id="m-goal" placeholder="Weight Loss, Bulk, etc." {...profile.register("fitness_goal")} />
            </Field>
          </div>

          <FormDivider>Emergency Contact</FormDivider>
          <div className={GRID_2}>
            <Field label="Contact Name" htmlFor="m-ec-name" error={pErr.emergency_contact_name?.message}>
              <Input id="m-ec-name" placeholder="Name of relative/friend" {...profile.register("emergency_contact_name")} />
            </Field>
            <Field label="Contact Phone" htmlFor="m-ec-phone" error={pErr.emergency_contact_phone?.message}>
              <Input id="m-ec-phone" inputMode="numeric" maxLength={10} placeholder="Emergency mobile number"
                invalid={!!pErr.emergency_contact_phone} {...profile.register("emergency_contact_phone")} />
            </Field>
          </div>

          <FormDivider>ID Proof</FormDivider>
          <div className={GRID_2}>
            <Field label="ID Proof Type" htmlFor="m-id-type" error={pErr.id_proof_type?.message}>
              <Select id="m-id-type" {...profile.register("id_proof_type")}>
                <option value="">-- Select --</option>
                {ID_PROOF_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="ID Proof Number" htmlFor="m-id-number" error={pErr.id_proof_number?.message}>
              <Input id="m-id-number" placeholder="e.g. 1234-5678-9012" autoComplete="off" {...profile.register("id_proof_number")} />
            </Field>
          </div>
        </fieldset>

        <div className="form-actions-modern mt-6">
          <Button variant="secondary" onClick={onClose}>{readOnly ? "Close" : "Cancel"}</Button>
          {!readOnly && (
            <Button type="submit" loading={saveMember.isPending}>
              {canEnroll ? "Next: Select Plan" : member ? "Update Member" : "Save Member"}
            </Button>
          )}
        </div>
      </form>

      {/* Step 2 — Plan & Package */}
      {step === 2 && (
        <div className="px-[5px] py-2.5">
          <h3 className="mb-5 mt-0 text-base font-extrabold text-ink">Choose Membership Plan</h3>
          {plansQuery.isLoading && <p className="text-sm text-muted">Loading plans…</p>}
          {!plansQuery.isLoading && plans.length === 0 && (
            <p className="rounded-xl border-2 border-dashed border-line bg-subtle p-6 text-center text-sm italic text-muted">
              No plans configured for this branch.
            </p>
          )}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
            {plans.map((p) => (
              <PlanCard key={p.id} plan={p} selected={planIds.includes(p.id)} onToggle={() => togglePlan(p.id)} />
            ))}
          </div>

          <Field label="Subscription Start Date" htmlFor="m-start" required className="mt-6">
            <Input id="m-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>

          <div className="form-actions-modern mt-6">
            <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={goToPayment}>Next: Payment</Button>
          </div>
        </div>
      )}

      {/* Step 3 — Payment */}
      {step === 3 && (
        <form onSubmit={payment.handleSubmit(onSubmitPayment)} noValidate className="px-[5px] py-2.5">
          <PaymentSummaryCard gross={gross} discount={toNumber(discount)} reason={reason} />

          {needsTrainer && (
            <Field label="Assign Trainer" htmlFor="m-trainer" required className="mb-5" error={yErr.trainer_id?.message}
              hint="Required for the personal training plan">
              <Select id="m-trainer" invalid={!!yErr.trainer_id} {...payment.register("trainer_id")}>
                <option value="">{trainers.isLoading ? "Loading trainers…" : "-- Select Trainer --"}</option>
                {(trainers.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.name} ({t.employee_code})</option>)}
              </Select>
            </Field>
          )}

          <div className={cn(GRID_2, "mt-5")}>
            <Field label="Discount Amount (₹)" htmlFor="m-discount" error={yErr.discount_amount?.message}>
              <Input id="m-discount" type="number" min={0} step="0.01" placeholder="e.g. 500" invalid={!!yErr.discount_amount}
                {...payment.register("discount_amount")} />
            </Field>
            <Field label="Offer Type / Reason" htmlFor="m-reason">
              <Select id="m-reason" {...payment.register("discount_reason")}>
                <option value="">No Discount</option>
                {DISCOUNT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </Select>
            </Field>
            <Field label="Amount Paid Now" htmlFor="m-paid" required error={yErr.paid_amount?.message}>
              <Input id="m-paid" type="number" min={0} step="0.01" placeholder="Enter amount received" invalid={!!yErr.paid_amount}
                {...payment.register("paid_amount")} />
            </Field>
            <Field label="Payment Mode" htmlFor="m-mode" required>
              <Select id="m-mode" {...payment.register("payment_mode")}>
                {PAYMENT_MODES.map((m) => <option key={m} value={m}>{PAYMENT_MODE_LABEL[m]}</option>)}
              </Select>
            </Field>
          </div>

          {balance > 0 && (
            <div className={cn(GRID_2, "mt-4")}>
              <Field label="Remaining Balance" htmlFor="m-balance">
                <Input id="m-balance" value={formatINR(balance)} readOnly className={cn(READONLY_INPUT, "!font-bold !text-danger")} />
              </Field>
              <Field label="Balance Due Date" htmlFor="m-due">
                <Input id="m-due" type="date" min={todayISO()} {...payment.register("balance_due_date")} />
              </Field>
            </div>
          )}

          <div className="form-actions-modern mt-6">
            <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
            <Button type="submit" loading={enroll.isPending}>Complete Registration</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
