import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Drawer } from "@/components/ui/Modal";
import { FormDivider, GRID_2 } from "@/components/ui/Section";
import { openInvoice, subscriptionApi, useInvalidateBilling } from "@/features/subscriptions/api";
import { balanceOf, billingShape, netPayable, PAYMENT_MODE_LABEL, refineBilling, round2,
  toEnrollPayment } from "@/features/subscriptions/lib/billing";
import { formatDate, formatINR, todayISO } from "@/lib/format";
import { notify } from "@/lib/notify";
import { PAYMENT_MODES } from "@/types/enums";
import type { SubscriptionDetail } from "@/types/subscription";

const DISCOUNT_REASONS = ["Referral Offer", "Special Waiver", "Early Bird", "Other"];
const FORM_ID = "complete-payment-form";

const schema = z.object(billingShape).superRefine(refineBilling);
type FormValues = z.infer<typeof schema>;

/** Pays the unpaid subscription(s) via POST /payments, then opens the invoice. */
export function CompletePaymentDrawer({ detail, onClose }: { detail: SubscriptionDetail; onClose: () => void }) {
  const invalidateBilling = useInvalidateBilling();
  const gross = round2(detail.plans.reduce((s, p) => s + p.price, 0));
  const storedDiscount = detail.discount_amount;
  const reasons = detail.discount_reason && !DISCOUNT_REASONS.includes(detail.discount_reason)
    ? [detail.discount_reason, ...DISCOUNT_REASONS] : DISCOUNT_REASONS;

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: gross,
      discount_amount: storedDiscount > 0 ? String(storedDiscount) : "",
      discount_reason: detail.discount_reason ?? "",
      paid_amount: String(netPayable(gross, String(storedDiscount))),
      payment_mode: "CASH",
      balance_due_date: "",
    },
  });
  const discount = watch("discount_amount");
  const paid = watch("paid_amount");
  const balance = balanceOf(gross, discount, paid);

  // Final payable follows the discount (still editable for a part payment).
  useEffect(() => {
    const net = netPayable(gross, discount);
    if (Number.isFinite(net)) setValue("paid_amount", String(net));
  }, [gross, discount, setValue]);

  const pay = useMutation({
    mutationFn: subscriptionApi.completePayment,
    onSuccess: async (res) => {
      notify.success(res.message);
      openInvoice(res.data.id);
      await invalidateBilling();
      onClose();
    },
    onError: notify.error,
  });

  const onSubmit = (v: FormValues) => {
    const p = toEnrollPayment(v);
    pay.mutate({
      subscription_ids: detail.plans.map((l) => l.subscription_id),
      discount_amount: p.discount_amount,
      discount_reason: p.discount_reason,
      paid_amount: p.paid_amount,
      payment_mode: p.payment_mode,
      balance_due_date: p.balance_due_date,
    });
  };

  return (
    <Drawer
      open
      title="Complete payment"
      subtitle={`${detail.member.name} · ${detail.member.registration_id}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form={FORM_ID} loading={pay.isPending}>Save &amp; generate invoice</Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormDivider>Plans</FormDivider>
        <div className="overflow-hidden rounded-xl border border-line">
          {detail.plans.map((p) => (
            <div key={p.subscription_id} className="flex items-center justify-between gap-4 border-b border-line-light px-4 py-3 text-sm last:border-b-0">
              <div className="min-w-0">
                <div className="truncate font-semibold text-ink">{p.plan_name}</div>
                <div className="text-xs text-muted">{formatDate(p.start_date)} – {formatDate(p.end_date)}</div>
              </div>
              <span className="font-semibold text-ink">{formatINR(p.price)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-line bg-subtle px-4 py-3 text-sm">
            <span className="font-semibold text-muted">Total</span>
            <span className="font-extrabold text-ink">{formatINR(gross)}</span>
          </div>
        </div>

        <FormDivider>Payment</FormDivider>
        <div className={GRID_2}>
          <Field label="Discount (₹)" htmlFor="cp-discount" error={errors.discount_amount?.message}>
            <Input id="cp-discount" type="number" min={0} step="0.01" placeholder="e.g. 500" invalid={!!errors.discount_amount}
              {...register("discount_amount")} />
          </Field>
          <Field label="Offer / reason" htmlFor="cp-reason">
            <Select id="cp-reason" {...register("discount_reason")}>
              <option value="">No discount</option>
              {reasons.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </Field>
          <Field label="Amount paid now (₹)" htmlFor="cp-paid" required error={errors.paid_amount?.message}
            hint="Lower it to record a part payment">
            <Input id="cp-paid" type="number" min={0} step="0.01" placeholder="0.00" invalid={!!errors.paid_amount}
              {...register("paid_amount")} />
          </Field>
          <Field label="Payment mode" htmlFor="cp-mode" required>
            <Select id="cp-mode" {...register("payment_mode")}>
              {PAYMENT_MODES.map((m) => <option key={m} value={m}>{PAYMENT_MODE_LABEL[m]}</option>)}
            </Select>
          </Field>

          {balance > 0 && (
            <>
              <Field label="Remaining balance" htmlFor="cp-balance">
                <Input id="cp-balance" value={formatINR(balance)} readOnly
                  className="!border-dashed !bg-subtle !font-bold !text-danger" />
              </Field>
              <Field label="Balance due date" htmlFor="cp-due" error={errors.balance_due_date?.message}>
                <Input id="cp-due" type="date" min={todayISO()} invalid={!!errors.balance_due_date}
                  {...register("balance_due_date")} />
              </Field>
            </>
          )}
        </div>
      </form>
    </Drawer>
  );
}
