import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { usePlanLookup, useTrainerLookup } from "@/features/lookups/api";
import { GRID_2, READONLY_INPUT } from "@/features/members/components/wizard-parts";
import { openInvoice, subscriptionApi, useInvalidateBilling } from "@/features/subscriptions/api";
import { billingShape, netPayable, PAYMENT_MODE_LABEL, refineBilling, toEnrollPayment } from "@/features/subscriptions/lib/billing";
import { formatINR } from "@/lib/format";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { PAYMENT_MODES } from "@/types/enums";
import type { Member } from "@/types/member";

const DISCOUNT_REASONS = ["Referral Offer", "Existing Client Offer", "Festival Special", "Other"] as const;

const schema = z.object({
  ...billingShape,
  plan_id: z.string().min(1, "Choose an add-on"),
  trainer_id: z.string(),
  needs_trainer: z.boolean(),
}).superRefine((v, ctx) => {
  refineBilling(v, ctx);
  if (v.needs_trainer && !v.trainer_id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["trainer_id"], message: "Select a trainer for personal training" });
  }
});
type FormValues = z.infer<typeof schema>;

/**
 * "Add-on Service / Upgrade": one ADD_ON plan billed through POST /subscriptions/enroll.
 * PT add-ons need a trainer and land on Personal Training; Diet add-ons land on Diet Plans.
 */
export function AddonServiceModal({ member, onClose }: { member: Member; onClose: () => void }) {
  const navigate = useNavigate();
  const invalidateBilling = useInvalidateBilling();
  const addons = usePlanLookup("ADD_ON");

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      plan_id: "", trainer_id: "", needs_trainer: false, amount: 0, discount_amount: "", discount_reason: "",
      paid_amount: "0", payment_mode: "CASH", balance_due_date: "",
    },
  });

  const planId = watch("plan_id");
  const discount = watch("discount_amount");
  const plan = (addons.data ?? []).find((p) => p.id === planId);
  const needsTrainer = plan?.service_type === "PERSONAL_TRAINING";
  const trainers = useTrainerLookup(needsTrainer);

  useEffect(() => {
    setValue("amount", plan?.price ?? 0);
    setValue("needs_trainer", needsTrainer);
    if (!needsTrainer) setValue("trainer_id", "");
  }, [plan, needsTrainer, setValue]);

  // "Final Amount to Pay" = price − discount (read-only, as in the original).
  const net = netPayable(plan?.price ?? 0, discount);
  useEffect(() => {
    if (Number.isFinite(net)) setValue("paid_amount", String(net));
  }, [net, setValue]);

  const enroll = useMutation({
    mutationFn: subscriptionApi.enroll,
    onSuccess: async (res) => {
      notify.success(res.message);
      openInvoice(res.data.payment_id);
      await invalidateBilling();
      onClose();
      if (plan?.service_type === "DIET") navigate("/diet-plans");
      else if (plan?.service_type === "PERSONAL_TRAINING") navigate("/personal-training");
    },
    onError: notify.error,
  });

  const onSubmit = (v: FormValues) =>
    enroll.mutate({
      member_id: member.id,
      plan_ids: [v.plan_id],
      start_date: null,
      trainer_id: v.needs_trainer ? v.trainer_id : null,
      payment: toEnrollPayment(v),
    });

  return (
    <Modal open title="Add-on Service / Upgrade" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="px-[5px] py-2.5">
        <p className="mb-5 mt-0 text-sm leading-normal text-muted">
          Select an add-on service like Premium Diet, Personal Training, etc. for{" "}
          <strong className="text-ink">{member.name}</strong> ({member.registration_id}).
        </p>

        <Field label="Select Service" htmlFor="a-plan" required className="mt-4" error={errors.plan_id?.message}>
          <Select id="a-plan" invalid={!!errors.plan_id} {...register("plan_id")}>
            <option value="">{addons.isLoading ? "Loading add-ons…" : "-- Choose Add-on --"}</option>
            {(addons.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name} ({formatINR(p.price)})</option>)}
          </Select>
        </Field>

        {needsTrainer && (
          <Field label="Assign Trainer" htmlFor="a-trainer" required className="mt-4" error={errors.trainer_id?.message}>
            <Select id="a-trainer" invalid={!!errors.trainer_id} {...register("trainer_id")}>
              <option value="">{trainers.isLoading ? "Loading trainers…" : "-- Select Trainer --"}</option>
              {(trainers.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.name} ({t.employee_code})</option>)}
            </Select>
          </Field>
        )}

        <div className={cn(GRID_2, "mt-5")}>
          <Field label="Discount Amount (₹)" htmlFor="a-discount" error={errors.discount_amount?.message}>
            <Input id="a-discount" type="number" min={0} step="0.01" placeholder="e.g. 200" invalid={!!errors.discount_amount}
              {...register("discount_amount")} />
          </Field>
          <Field label="Offer Type / Reason" htmlFor="a-reason">
            <Select id="a-reason" {...register("discount_reason")}>
              <option value="">No Discount</option>
              {DISCOUNT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </Field>
        </div>

        <div className={cn(GRID_2, "mt-5")}>
          <Field label="Final Amount to Pay (₹)" htmlFor="a-paid" error={errors.paid_amount?.message}>
            <Input id="a-paid" type="number" readOnly className={READONLY_INPUT} {...register("paid_amount")} />
          </Field>
          <Field label="Payment Mode" htmlFor="a-mode" required>
            <Select id="a-mode" {...register("payment_mode")}>
              {PAYMENT_MODES.map((m) => <option key={m} value={m}>{PAYMENT_MODE_LABEL[m]}</option>)}
            </Select>
          </Field>
        </div>

        <div className="form-actions-modern">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={enroll.isPending} disabled={!planId}>Activate &amp; Pay</Button>
        </div>
      </form>
    </Modal>
  );
}
