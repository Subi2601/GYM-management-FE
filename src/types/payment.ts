import type { SortDir } from "@/hooks/use-list-state";
import type { PageQuery } from "@/types/api";
import type { PaymentMode, PlanServiceType, PlanType } from "@/types/enums";

/** GET /payments — see backend app/schemas/payment.py (PaymentResponse) */
export interface Payment {
  id: string;
  branch_id: string;
  receipt_no: string;
  member_id: string;
  member_name: string;
  registration_id: string;
  member_phone: string;
  plan_names: string[];
  pt_subscription_id: string | null;
  amount: number;
  discount_amount: number;
  discount_reason: string | null;
  paid_amount: number;
  balance_amount: number;
  balance_due_date: string | null;
  payment_date: string;
  payment_mode: PaymentMode;
  created_at: string;
  updated_at: string;
}

/** `sort_by` values accepted by GET /payments. */
export type PaymentSortKey = "receipt_no" | "payment_date" | "member_name" | "paid_amount" | "balance_amount" | "created_at";

export interface PaymentListQuery extends PageQuery {
  payment_mode?: PaymentMode;
  /** YYYY-MM-DD */
  date_from?: string;
  date_to?: string;
  /** true = only payments with a balance due, false = fully paid. */
  has_balance?: boolean;
  sort_by?: string;
  sort_dir?: SortDir;
}

/** GET /payments/stats */
export interface PaymentStats {
  today: number;
  today_cash: number;
  /** Every non-cash mode (UPI, card, bank transfer). */
  today_account: number;
  this_month: number;
  last_month: number;
  last_6_months: number;
  last_12_months: number;
  total: number;
  /** Paid back on cancelled memberships (collections above are before refunds). */
  refunds_today: number;
  refunds_this_month: number;
  refunds_last_month: number;
  refunds_total: number;
}

export interface InvoiceMember {
  id: string;
  registration_id: string;
  name: string;
  phone: string;
}

export interface InvoiceLine {
  plan_name: string;
  plan_type: PlanType | null;
  service_type: PlanServiceType | null;
  duration_days: number | null;
  total_sessions: number;
  start_date: string;
  end_date: string;
  price: number;
}

/** GET /payments/{id}/invoice */
export interface Invoice {
  payment_id: string;
  receipt_no: string;
  payment_date: string;
  payment_mode: PaymentMode;
  organization_name: string;
  branch_name: string;
  branch_location: string | null;
  member: InvoiceMember;
  lines: InvoiceLine[];
  /** Upgrade bill: what the previous plan cost, taken off (lines total − credit = gross). */
  credit_amount: number;
  credit_label: string | null;
  /** "Diwali: +1 month, Free Protein shaker" */
  offer_bonus: string | null;
  /** Gym ID */
  gym_code: string | null;
  /** Letterhead from Gym Settings (branch contacts / GSTIN override the gym's). */
  tagline: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  invoice_footer: string | null;
  logo_url: string | null;
  /** Public terms & conditions PDF (sent with the welcome message). */
  terms_url: string | null;
  gross: number;
  discount_amount: number;
  discount_reason: string | null;
  net_amount: number;
  paid_amount: number;
  balance_amount: number;
  balance_due_date: string | null;
  /** Signed id for the no-login link sent to the member (/i/<token>). */
  share_token: string;
}
