import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input, READONLY_INPUT, Select } from "@/components/ui/Field";
import { Drawer } from "@/components/ui/Modal";
import { FormDivider, GRID_2 } from "@/components/ui/Section";
import { usePlanLookup, useTrainerLookup } from "@/features/lookups/api";
import { openInvoice, subscriptionApi, useInvalidateBilling } from "@/features/subscriptions/api";
import { OfferSelect } from "@/features/offers/components/OfferSelect";
import { BILLING_DEFAULTS, billingShape, netPayable, PAYMENT_MODE_LABEL, refineBilling,
  toEnrollPayment } from "@/features/subscriptions/lib/billing";
import { formatINR } from "@/lib/format";
import { notify } from "@/lib/notify";
import { PAYMENT_MODES } from "@/types/enums";
import type { Member } from "@/types/member";

const FORM_ID = "addon-service-form";

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
 * "Add-on service": one ADD_ON plan billed through POST /subscriptions/enroll.
 * PT add-ons need a trainer and land on Personal Training; Diet add-ons land on Diet Plans.
 */
export function AddonServiceDrawer({ member, onClose }: { member: Member; onClose: () => void }) {
  const navigate = useNavigate();
  const invalidateBilling = useInvalidateBilling();
  const addons = usePlanLookup("ADD_ON", true, true);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...BILLING_DEFAULTS, plan_id: "", trainer_id: "", needs_trainer: false,
    },
  });

  const planId = watch("plan_id");
  const discount = watch("discount_amount");
  const plan = (addons.data ?? []).find((p) => p.id === planId);
  const needsTrainer = plan?.service_type === "PERSONAL_TRAINING";
  const trainers = useTrainerLookup(needsTrainer);
  const [idVerified, setIdVerified] = useState(false);

  useEffect(() => {
    setValue("amount", plan?.price ?? 0);
    setValue("needs_trainer", needsTrainer);
    if (!needsTrainer) setValue("trainer_id", "");
  }, [plan, needsTrainer, setValue]);

  // "Final amount to pay" = price − discount (read-only, as in the original).
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

  const onSubmit = (v: FormValues) => {
    if (plan?.id_check && !idVerified) return notify.errorText(`Tick "${plan.id_check} verified" to continue.`);
    enroll.mutate({
      member_id: member.id,
      plan_ids: [v.plan_id],
      start_date: null,
      trainer_id: v.needs_trainer ? v.trainer_id : null,
      id_verified: !!plan?.id_check && idVerified,
      payment: toEnrollPayment(v),
    });
  };

  return (
    <Drawer
      open
      title="Add-on service"
      subtitle={`${member.name} · ${member.registration_id}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form={FORM_ID} loading={enroll.isPending} disabled={!planId}>Activate &amp; pay</Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormDivider>Service</FormDivider>
        <div className="flex flex-col gap-4">
          <Field label="Add-on" htmlFor="a-plan" required error={errors.plan_id?.message}
            hint="Premium diet, personal training and other add-on plans">
            <Select id="a-plan" invalid={!!errors.plan_id} {...register("plan_id")}>
              <option value="">{addons.isLoading ? "Loading add-ons…" : "Choose an add-on"}</option>
              {(addons.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name} ({formatINR(p.price)})</option>)}
            </Select>
          </Field>
          {plan?.id_check && (
            <Checkbox checked={idVerified} onChange={setIdVerified} label={`${plan.id_check} verified`} />
          )}

          {needsTrainer && (
            <Field label="Trainer" htmlFor="a-trainer" required error={errors.trainer_id?.message}>
              <Select id="a-trainer" invalid={!!errors.trainer_id} {...register("trainer_id")}>
                <option value="">{trainers.isLoading ? "Loading trainers…" : "Select a trainer"}</option>
                {(trainers.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.name} ({t.employee_code})</option>)}
              </Select>
            </Field>
          )}
        </div>

        <FormDivider>Payment</FormDivider>
        <div className={GRID_2}>
          <OfferSelect id="a-offer" lines={plan ? [{ categoryId: plan.category_id, amount: plan.price }] : []} value={watch("offer_id")} setField={(n, val) => setValue(n, val)}
            className="md:col-span-2" />
          <Field label="Final amount to pay (₹)" htmlFor="a-paid" error={errors.paid_amount?.message}>
            <Input id="a-paid" type="number" readOnly className={READONLY_INPUT} {...register("paid_amount")} />
          </Field>
          <Field label="Payment mode" htmlFor="a-mode" required>
            <Select id="a-mode" {...register("payment_mode")}>
              {PAYMENT_MODES.map((m) => <option key={m} value={m}>{PAYMENT_MODE_LABEL[m]}</option>)}
            </Select>
          </Field>
        </div>
      </form>
    </Drawer>
  );
}
