import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { confirm } from "@/components/ui/ConfirmDialog";
import { Field, Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { usePlanLookup, useTrainerLookup } from "@/features/lookups/api";
import { openInvoice, subscriptionApi, useInvalidateBilling } from "@/features/subscriptions/api";
import { billingShape, netPayable, PAYMENT_MODE_LABEL, refineBilling, round2,
  toEnrollPayment } from "@/features/subscriptions/lib/billing";
import { formatINR, todayISO } from "@/lib/format";
import { notify } from "@/lib/notify";
import { PAYMENT_MODES } from "@/types/enums";
import type { SubscriptionRow } from "@/types/subscription";

const DISCOUNT_REASONS = [
  { value: "Renewal Offer", label: "Renewal Offer" },
  { value: "Festival Deal", label: "Festival Special" },
  { value: "Loyalty Bonus", label: "Loyalty Bonus" },
  { value: "Other", label: "Other" },
];

const schema = z.object({
  ...billingShape,
  start_date: z.string().min(1, "Start date is required"),
  trainer_id: z.string(),
  needs_trainer: z.boolean(),
}).superRefine((v, ctx) => {
  refineBilling(v, ctx);
  if (v.needs_trainer && !v.trainer_id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["trainer_id"], message: "Select a trainer for personal training" });
  }
});
type FormValues = z.infer<typeof schema>;

/** "Renew: <member>" — plan multi-select, discount, start date, mode → confirm → POST /subscriptions/enroll. */
export function RenewModal({ row, onClose }: { row: SubscriptionRow; onClose: () => void }) {
  const invalidateBilling = useInvalidateBilling();
  const plansQuery = usePlanLookup();
  const plans = useMemo(() => plansQuery.data ?? [], [plansQuery.data]);
  const [planIds, setPlanIds] = useState<string[]>([]);

  const selected = plans.filter((p) => planIds.includes(p.id));
  const gross = round2(selected.reduce((s, p) => s + p.price, 0));
  const needsTrainer = selected.some((p) => p.service_type === "PERSONAL_TRAINING");
  const trainers = useTrainerLookup(needsTrainer);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: 0, discount_amount: "", discount_reason: "", paid_amount: "0", payment_mode: "CASH",
      balance_due_date: "", start_date: todayISO(), trainer_id: "", needs_trainer: false,
    },
  });
  const discount = watch("discount_amount");
  const net = netPayable(gross, discount);

  // The original renewal records full payment of the net amount.
  useEffect(() => {
    setValue("amount", gross);
    setValue("needs_trainer", needsTrainer);
    if (Number.isFinite(net)) setValue("paid_amount", String(net));
  }, [gross, needsTrainer, net, setValue]);

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

  const onSubmit = async (v: FormValues) => {
    if (planIds.length === 0) return notify.errorText("Please select at least one plan.");
    if (!(await confirm("Are you sure you want to renew this membership and record payment?"))) return;
    enroll.mutate({
      member_id: row.member_id,
      plan_ids: planIds,
      start_date: v.start_date,
      trainer_id: needsTrainer && v.trainer_id ? v.trainer_id : null,
      payment: toEnrollPayment(v),
    });
  };

  return (
    <Modal open title={`Renew: ${row.member_name}`} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label="Membership Plans" required className="mb-5">
          <MultiSelect
            items={plans.map((p) => ({ id: p.id, label: p.name, subLabel: `${formatINR(p.price)} · ${p.duration_days} days` }))}
            selected={planIds}
            onChange={setPlanIds}
            placeholder={plansQuery.isLoading ? "Loading plans..." : "Select plans..."}
          />
        </Field>

        {needsTrainer && (
          <Field label="Assign Trainer" htmlFor="r-trainer" required className="mb-5" error={errors.trainer_id?.message}>
            <Select id="r-trainer" invalid={!!errors.trainer_id} {...register("trainer_id")}>
              <option value="">{trainers.isLoading ? "Loading trainers…" : "-- Select Trainer --"}</option>
              {(trainers.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.name} ({t.employee_code})</option>)}
            </Select>
          </Field>
        )}

        <div className="form-grid-modern">
          <Field label="Discount Amount (₹)" htmlFor="r-discount" error={errors.discount_amount?.message}>
            <Input id="r-discount" type="number" min={0} step="0.01" placeholder="e.g. 500" invalid={!!errors.discount_amount}
              {...register("discount_amount")} />
          </Field>
          <Field label="Offer Type / Reason" htmlFor="r-reason">
            <Select id="r-reason" {...register("discount_reason")}>
              <option value="">No Discount</option>
              {DISCOUNT_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </Select>
          </Field>
        </div>

        <div className="form-grid-modern mt-5">
          <Field label="Start Date" htmlFor="r-start" required error={errors.start_date?.message}>
            <Input id="r-start" type="date" invalid={!!errors.start_date} {...register("start_date")} />
          </Field>
          <Field label="Payment Mode" htmlFor="r-mode" required>
            <Select id="r-mode" {...register("payment_mode")}>
              {PAYMENT_MODES.map((m) => <option key={m} value={m}>{PAYMENT_MODE_LABEL[m]}</option>)}
            </Select>
          </Field>
        </div>

        <div className="mt-5 rounded-xl border border-line bg-subtle px-5 py-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.05em] text-secondary-grey">Net Payable</span>
            <span className="rounded-full bg-accent-light px-4 py-1.5 text-lg font-extrabold text-accent">
              {formatINR(Number.isFinite(net) ? net : 0)}
            </span>
          </div>
          {(errors.paid_amount || errors.discount_amount) && (
            <p className="mb-0 mt-2 text-xs font-semibold text-accent">
              {errors.discount_amount?.message ?? errors.paid_amount?.message}
            </p>
          )}
        </div>

        <div className="form-actions-modern">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={enroll.isPending} disabled={planIds.length === 0}>Confirm Renewal</Button>
        </div>
      </form>
    </Modal>
  );
}
