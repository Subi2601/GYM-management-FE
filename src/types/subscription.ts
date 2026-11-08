import type { SortDir } from "@/hooks/use-list-state";
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
  /** This plan was upgraded to that subscription. */
  upgraded_to_id: string | null;
  /** This plan is an upgrade of that subscription. */
  upgraded_from_id: string | null;
  /** Credit taken off this plan's bill for the old plan. */
  upgrade_credit: number | null;
  /** Freeze days already added to end_date. */
  frozen_days: number;
  /** Ended early. */
  closed_reason: "CANCELLED" | "TRANSFERRED" | null;
  closed_on: string | null;
  /** Who it went to / the refund, and why. */
  close_note: string | null;
  transferred_to_id: string | null;
  /** Received from another member (paid by them). */
  transferred_from_id: string | null;
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

/** `sort_by` values accepted by GET /subscriptions. */
export type SubscriptionSortKey = "member_name" | "plan_name" | "start_date" | "end_date" | "created_at";

export interface SubscriptionListQuery {
  page: number;
  page_size: number;
  search?: string;
  renewal_state?: RenewalState;
  plan_id?: string;
  sort_by?: string;
  sort_dir?: SortDir;
}

/** GET /subscriptions/member/{id}/upgrade — one membership plan in the upgrade list. */
export interface UpgradeOption {
  plan_id: string;
  name: string;
  category_id: string;
  category_name: string;
  duration_months: number | null;
  duration_days: number;
  price: number;
  id_check: string | null;
  /** Bigger plan that can be picked; the rest are shown greyed with `reason`. */
  eligible: boolean;
  reason: string | null;
  /** price − credit: what the member pays before any offer. */
  balance: number;
}

export interface UpgradeCurrent {
  subscription_id: string;
  plan_id: string;
  plan_name: string;
  category_name: string;
  start_date: string;
  end_date: string;
  /** What the current plan cost (after its discount) — taken off the new plan. */
  credit: number;
  receipt_no: string | null;
  window_days: number;
  /** Last day to upgrade; null = upgrades off for this plan. */
  window_ends: string | null;
}

export interface UpgradeInfo {
  current: UpgradeCurrent | null;
  can_upgrade: boolean;
  /** Why not: window closed, balance pending, no plan … */
  reason: string | null;
  options: UpgradeOption[];
}
