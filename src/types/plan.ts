import type { PlanServiceType, PlanType } from "@/types/enums";

/** GET /plans — see backend app/schemas/plan.py */
export interface Plan {
  id: string;
  /** null = common plan. */
  branch_id: string | null;
  /** Common plan: sold in every branch (only all-branch roles change it). */
  common: boolean;
  name: string;
  /** Owner-managed category (General, Student, Couple …). */
  category_id: string;
  category_name: string;
  type: PlanType;
  service_type: PlanServiceType;
  /** Set → sold in calendar months; null → `duration_days` (PT validity, custom plans). */
  duration_months: number | null;
  duration_days: number;
  price: number;
  total_sessions: number;
  /** Members one purchase covers (couple 2, family 3 …); each gets their own membership. */
  group_size: number;
  /** Of `group_size`, how many join free ("pay for 4, 5th free") — display only, price covers all. */
  free_members: number;
  /** Proof the desk must confirm before billing, e.g. "College ID card". */
  id_check: string | null;
  /** Members on this plan may check in at every branch (not the same as `common`). */
  all_branches: boolean;
  /** Days after the start a member on this plan may upgrade to a bigger plan (0 = never). */
  upgrade_window_days: number;
  /** false = inactive: not offered in billing (kept for history). */
  is_active: boolean;
  description: string | null;
  /** Money back on cancel, within refund_window_days of use (null = the gym's refund days). */
  refundable: boolean;
  refund_window_days: number | null;
  created_at: string;
  updated_at: string;
}

export interface PlanInput {
  name: string;
  category_id: string;
  type: PlanType;
  service_type: PlanServiceType;
  duration_months: number | null;
  duration_days: number | null;
  price: number;
  total_sessions: number;
  group_size: number;
  free_members: number;
  id_check: string | null;
  all_branches: boolean;
  /** null = default by duration (1 month → 15 days, 3 → 30, 6 → 45, longer → 60, days → half). */
  upgrade_window_days: number | null;
  is_active: boolean;
  description?: string | null;
  refundable: boolean;
  refund_window_days: number | null;
  /** true = every branch (all-branch roles only); false = the selected branch. */
  common?: boolean;
}

/** GET /plan-categories — the organization's list, in tab order, with plan counts for the selected branch. */
export interface PlanCategory {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  plan_count: number;
  active_plan_count: number;
}

/** GET /employees/trainers */
export interface TrainerBrief {
  id: string;
  employee_code: string;
  name: string;
  phone: string;
}
