import { z } from "zod";

import { formatINR } from "@/lib/format";
import { PAYMENT_MODES, type PaymentMode } from "@/types/enums";
import type { EnrollPayment } from "@/types/payment-enroll";

/** Labels as the original UI showed them ('Cash', 'UPI', 'Card', 'Bank Transfer'). */
export const PAYMENT_MODE_LABEL: Record<PaymentMode, string> = {
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  BANK_TRANSFER: "Bank Transfer",
};

/** Form inputs keep text; "" means 0 for optional amounts. */
export function toNumber(value: string | undefined): number {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? 0 : Number(trimmed);
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

const isAmount = (v: string) => Number.isFinite(Number(v)) && Number(v) >= 0;

export const optionalAmount = z.string().refine((v) => v.trim() === "" || isAmount(v.trim()), "Enter a valid amount");
export const requiredAmount = z.string().trim().min(1, "Required").refine(isAmount, "Enter a valid amount");

/** Fields shared by every billing form (enrol wizard, add-on, renew, complete payment). */
export const billingShape = {
  /** Gross = Σ plan prices; set by the screen, not typed. */
  amount: z.number().min(0),
  discount_amount: optionalAmount,
  discount_reason: z.string().max(200),
  paid_amount: requiredAmount,
  payment_mode: z.enum(PAYMENT_MODES),
  balance_due_date: z.string(),
};

interface BillingLike {
  amount: number;
  discount_amount: string;
  paid_amount: string;
}

/** Same rules as backend PaymentService.build_payment: discount ≤ gross, paid ≤ net. */
export function refineBilling(v: BillingLike, ctx: z.RefinementCtx): void {
  const discount = toNumber(v.discount_amount);
  if (discount > v.amount) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["discount_amount"],
      message: `Discount cannot exceed the total amount (${formatINR(v.amount)})` });
    return;
  }
  const net = round2(v.amount - discount);
  if (toNumber(v.paid_amount) > net) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["paid_amount"],
      message: `Paid amount cannot exceed the payable amount (${formatINR(net)})` });
  }
}

export function netPayable(amount: number, discount: string): number {
  return Math.max(0, round2(amount - toNumber(discount)));
}

export function balanceOf(amount: number, discount: string, paid: string): number {
  return Math.max(0, round2(netPayable(amount, discount) - toNumber(paid)));
}

interface BillingValues extends BillingLike {
  discount_reason: string;
  payment_mode: PaymentMode;
  balance_due_date: string;
}

export function toEnrollPayment(v: BillingValues): EnrollPayment {
  const discount = toNumber(v.discount_amount);
  const balance = balanceOf(v.amount, v.discount_amount, v.paid_amount);
  return {
    discount_amount: discount,
    discount_reason: discount > 0 && v.discount_reason.trim() ? v.discount_reason.trim() : null,
    paid_amount: toNumber(v.paid_amount),
    payment_mode: v.payment_mode,
    balance_due_date: balance > 0 && v.balance_due_date ? v.balance_due_date : null,
  };
}
