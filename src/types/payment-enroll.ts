import type { PaymentMode } from "@/types/enums";

/** Payment part of POST /subscriptions/enroll — backend EnrollPayment. */
export interface EnrollPayment {
  discount_amount: number;
  discount_reason: string | null;
  paid_amount: number;
  payment_mode: PaymentMode;
  balance_due_date: string | null;
  payment_date?: string | null;
}

/** POST /subscriptions/enroll — atomic subscriptions + payment (+ PT records). */
export interface EnrollRequest {
  member_id: string;
  plan_ids: string[];
  start_date: string | null;
  trainer_id: string | null;
  payment: EnrollPayment;
}

export interface EnrollResponse {
  payment_id: string;
  receipt_no: string;
  subscription_ids: string[];
  pt_subscription_ids: string[];
  amount: number;
  discount_amount: number;
  paid_amount: number;
  balance_amount: number;
}

/** POST /payments — pay existing unpaid subscriptions of one member. */
export interface CompletePaymentRequest {
  subscription_ids: string[];
  /** null → use the discounts stored on the subscriptions. */
  discount_amount: number | null;
  discount_reason: string | null;
  paid_amount: number;
  payment_mode: PaymentMode;
  balance_due_date: string | null;
}

/** The fields of PaymentResponse this module reads back. */
export interface CompletePaymentResponse {
  id: string;
  receipt_no: string;
  amount: number;
  discount_amount: number;
  paid_amount: number;
  balance_amount: number;
}
