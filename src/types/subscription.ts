import type { PaymentMode, PaymentStatus, PlanServiceType, PlanType, RenewalState } from "@/types/enums";

export type SubscriptionStatus = "ACTIVE" | "EXPIRED";

/** GET /subscriptions (renewal board, latest per member), /subscriptions/member/{id} — backend SubscriptionResponse. */
export interface SubscriptionRow {
  id: string;
  branch_id: string;
  member_id: string;
  member_name: string;
  registration_id: string;
  member_phone: string;
  plan_id: string;
  plan_name: string;
  plan_type: PlanType;
  service_type: PlanServiceType;
  price: number;
  start_date: string;
  end_date: string;
  discount_amount: number;
  discount_reason: string | null;
  status: SubscriptionStatus;
  payment_id: string | null;
  payment_status: PaymentStatus;
  renewal_state: RenewalState;
  /** Negative = days since expiry. */
  days_left: number;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionPlanLine {
  subscription_id: string;
  plan_id: string;
  plan_name: string;
  plan_type: PlanType;
  service_type: PlanServiceType;
  duration_days: number;
  total_sessions: number;
  start_date: string;
  end_date: string;
  price: number;
}

export interface SubscriptionMember {
  id: string;
  registration_id: string;
  name: string;
  phone: string;
}

export interface SubscriptionPaymentSummary {
  id: string;
  receipt_no: string;
  payment_date: string;
  payment_mode: PaymentMode;
  amount: number;
  discount_amount: number;
  paid_amount: number;
  balance_amount: number;
  balance_due_date: string | null;
}

/** GET /subscriptions/{id} */
export interface SubscriptionDetail extends SubscriptionRow {
  member: SubscriptionMember;
  /** Every plan billed together (same payment), or just this one when unpaid. */
  plans: SubscriptionPlanLine[];
  payment: SubscriptionPaymentSummary | null;
  pt_subscription_id: string | null;
}

export interface SubscriptionListQuery {
  page: number;
  page_size: number;
  search?: string;
  renewal_state?: RenewalState;
}
