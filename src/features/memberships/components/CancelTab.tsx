import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { confirm } from "@/components/ui/ConfirmDialog";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Field";
import { GRID_2 } from "@/components/ui/Section";
import { membershipApi, useInvalidateMembership } from "@/features/memberships/api";
import { Blocked, DocumentField, Stat } from "@/features/memberships/components/ActionFields";
import { PAYMENT_MODE_LABEL } from "@/features/subscriptions/lib/billing";
import { formatINR } from "@/lib/format";
import { notify } from "@/lib/notify";
import { PAYMENT_MODES, type PaymentMode } from "@/types/enums";
import type { DocumentUpload, MembershipActions } from "@/types/membership";

export const CANCEL_FORM = "cancel-form";

/** Cancel: ends the membership today. Money back only on refundable plans inside the refund window, up to what was
 *  paid (suggested = paid − the gym's deduction %); a bank refund needs the customer's account details. */
export function CancelTab({ info, onDone, onSubmitting }: {
  info: MembershipActions; onDone: () => void; onSubmitting: (busy: boolean) => void;
}) {
  const c = info.cancel!;
  const current = info.current!;
  const invalidate = useInvalidateMembership();

  // Mirrors backend CancelRequest / RefundDetails.
  const schema = z.object({
    reason: z.string().trim().min(3, "Write why the member is leaving").max(1000, "Max 1000 characters"),
    document: z.custom<DocumentUpload | null>(),
    refund: z.boolean(),
    amount: z.coerce.number({ invalid_type_error: "Enter the amount" }),
    mode: z.enum(PAYMENT_MODES),
    reference: z.string().trim().max(80),
    account_holder: z.string().trim().max(120),
    account_number: z.string().trim(),
    ifsc: z.string().trim().toUpperCase(),
    bank_name: z.string().trim().max(120),
    upi_id: z.string().trim().max(80),
  }).superRefine((v, ctx) => {
    if (!v.refund) return;
    const add = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (!(v.amount > 0)) add("amount", "Enter the refund amount");
    if (v.amount > c.paid_amount) add("amount", `At most ${formatINR(c.paid_amount)} (what was paid)`);
    if (v.mode === "BANK_TRANSFER") {
      if (!v.account_holder) add("account_holder", "Account holder's name");
      if (!/^\d{9,18}$/.test(v.account_number)) add("account_number", "9 to 18 digits");
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(v.ifsc)) add("ifsc", "Like SBIN0001234");
    }
    if (v.mode === "UPI" && !/^[\w.-]{2,}@[A-Za-z]{2,}$/.test(v.upi_id)) add("upi_id", "Like name@okicici");
  });
  type Values = z.infer<typeof schema>;

  const { register, control, handleSubmit, watch, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { reason: "", document: null, refund: c.refund_eligible, amount: c.suggested_refund, mode: "BANK_TRANSFER",
      reference: "", account_holder: "", account_number: "", ifsc: "", bank_name: "", upi_id: "" },
  });
  const refund = watch("refund");
  const mode = watch("mode") as PaymentMode;

  const cancel = useMutation({
    mutationFn: (v: Values) => membershipApi.cancel(current.subscription_id, {
      reason: v.reason.trim(), document: v.document,
      refund: v.refund ? {
        amount: v.amount, mode: v.mode, reference: v.reference || null,
        ...(v.mode === "BANK_TRANSFER" ? { account_holder: v.account_holder, account_number: v.account_number,
          ifsc: v.ifsc, bank_name: v.bank_name || null } : {}),
        ...(v.mode === "UPI" ? { upi_id: v.upi_id } : {}),
      } : null,
    }),
    onSuccess: async (res) => { notify.success(res.message); await invalidate(); onDone(); },
    onError: notify.error,
    onSettled: () => onSubmitting(false),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-subtle p-4 sm:grid-cols-4">
        <Stat label="Paid" value={formatINR(c.paid_amount)} />
        <Stat label="Used" value={`${c.used_days} days`} />
        <Stat label="Refund window" value={`${c.refund_window_days} days`} />
        <Stat label="Suggested refund" value={c.refund_eligible ? formatINR(c.suggested_refund) : "—"}
          tone={c.refund_eligible ? "text-success" : "text-muted"} />
      </div>
      {!c.refund_eligible && <Blocked>No refund: {c.refund_reason}. You can still cancel without a refund.</Blocked>}

      <form id={CANCEL_FORM} noValidate className="flex flex-col gap-4" onSubmit={handleSubmit(async (v) => {
        const money = v.refund ? `refund ${formatINR(v.amount)} by ${PAYMENT_MODE_LABEL[v.mode]}` : "no refund";
        if (await confirm(`Cancel ${current.plan_name} today (${money})? This can't be undone.`)) {
          onSubmitting(true);
          cancel.mutate(v);
        }
      })}>
        <Field label="Reason" htmlFor="cn-reason" required error={errors.reason?.message}>
          <Textarea id="cn-reason" rows={2} placeholder="Moving city, medical, not happy with timings…" {...register("reason")} />
        </Field>
        <Controller name="document" control={control} render={({ field }) => (
          <DocumentField id="cn-doc" value={field.value} onChange={field.onChange} />
        )} />

        {c.refund_eligible && (
          <div className="flex flex-col gap-4 rounded-xl border border-line p-4">
            <Controller name="refund" control={control} render={({ field }) => (
              <Checkbox checked={field.value} onChange={field.onChange}
                label={<b>Refund {c.deduction_percent > 0 ? `(gym keeps ${c.deduction_percent}% = ${formatINR(c.deduction_amount)})` : ""}</b>} />
            )} />
            {refund && (
              <>
                <div className={GRID_2}>
                  <Field label="Refund amount (₹)" htmlFor="cn-amount" required error={errors.amount?.message}
                    hint={`Up to ${formatINR(c.paid_amount)}`}>
                    <Input id="cn-amount" type="number" inputMode="decimal" min={0} max={c.paid_amount} step="1" {...register("amount")} />
                  </Field>
                  <Field label="Paid back by" htmlFor="cn-mode" required>
                    <Select id="cn-mode" {...register("mode")}>
                      {PAYMENT_MODES.map((m) => <option key={m} value={m}>{PAYMENT_MODE_LABEL[m]}</option>)}
                    </Select>
                  </Field>
                </div>
                {mode === "BANK_TRANSFER" && (
                  <div className={GRID_2}>
                    <Field label="Account holder" htmlFor="cn-holder" required error={errors.account_holder?.message}>
                      <Input id="cn-holder" maxLength={120} {...register("account_holder")} />
                    </Field>
                    <Field label="Account number" htmlFor="cn-acc" required error={errors.account_number?.message}>
                      <Input id="cn-acc" inputMode="numeric" maxLength={18} autoComplete="off" {...register("account_number")} />
                    </Field>
                    <Field label="IFSC" htmlFor="cn-ifsc" required error={errors.ifsc?.message}>
                      <Input id="cn-ifsc" maxLength={11} className="uppercase" placeholder="SBIN0001234" {...register("ifsc")} />
                    </Field>
                    <Field label="Bank name" htmlFor="cn-bank">
                      <Input id="cn-bank" maxLength={120} {...register("bank_name")} />
                    </Field>
                  </div>
                )}
                {mode === "UPI" && (
                  <Field label="Customer's UPI id" htmlFor="cn-upi" required error={errors.upi_id?.message}>
                    <Input id="cn-upi" maxLength={80} placeholder="name@okicici" {...register("upi_id")} />
                  </Field>
                )}
                <Field label="Transaction ref / UTR" htmlFor="cn-ref" hint="Optional">
                  <Input id="cn-ref" maxLength={80} {...register("reference")} />
                </Field>
              </>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
