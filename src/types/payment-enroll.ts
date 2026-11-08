import type { PaymentMode } from "@/types/enums";

/** Payment part of POST /subscriptions/enroll — backend EnrollPayment. */
export interface EnrollPayment {
  /** Offer from the master: the backend applies its % and name (discount_amount is then ignored). */
  offer_id?: string | null;
  discount_amount: number;
  discount_reason: string | null;
  paid_amount: number;
  payment_mode: PaymentMode;
  balance_due_date: string | null;
  payment_date?: string | null;
}

/** POST /subscriptions/enroll — atomic subscriptions + payment (+ PT records). */
/** Another member on a group package: registered (member_id) or new (name + phone, created on payment). */
export type GroupMemberInput = { member_id: string } | { name: string; phone: string };

export interface EnrollRequest {
  /** The payer. */
  member_id: string;
  plan_ids: string[];
  start_date: string | null;
  trainer_id: string | null;
  /** Couple / family … packages: the other members (each gets their own membership). */
  group_members?: GroupMemberInput[];
  /** The desk confirmed the plan's ID check (student ID …). */
  id_verified?: boolean;
  payment: EnrollPayment;
}

/** POST /subscriptions/upgrade — bigger plan from the old start date, old plan's cost credited. */
export interface UpgradeRequest {
  member_id: string;
  plan_id: string;
  id_verified?: boolean;
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
  offer_id?: string | null;
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
