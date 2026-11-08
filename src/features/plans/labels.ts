import { formatINR } from "@/lib/format";
import type { PlanServiceType, PlanType } from "@/types/enums";
import type { Plan } from "@/types/plan";

export const TYPE_LABEL: Record<PlanType, string> = { MEMBERSHIP: "Membership", ADD_ON: "Add-on", CUSTOM: "Customization" };

export const SERVICE_LABEL: Record<PlanServiceType, string> = {
  GENERAL: "General",
  PERSONAL_TRAINING: "Personal training",
  DIET: "Diet",
};

/** Per-day rate of a CUSTOM plan (its `price` is the total for `duration_days`); null for other types. */
export function dayRate(plan: Pick<Plan, "type" | "price" | "duration_days">): number | null {
  if (plan.type !== "CUSTOM" || plan.duration_days <= 0) return null;
  return Math.round((plan.price / plan.duration_days) * 100) / 100;
}

type PlanLike = Pick<Plan, "duration_months" | "duration_days" | "total_sessions" | "price" | "group_size" | "free_members"
  | "type">;

/** "3 Months" / "24 sessions · 60 days" / "20 days". */
export function planDuration(p: PlanLike): string {
  if (p.duration_months) return `${p.duration_months} month${p.duration_months > 1 ? "s" : ""}`;
  if (p.total_sessions) return `${p.total_sessions} sessions · ${p.duration_days} days`;
  return `${p.duration_days} days`;
}

/** Comparison price for the desk: per month (per paying member), per session, or per day. */
export function planUnitPrice(p: PlanLike): string | null {
  const payers = Math.max(1, p.group_size - p.free_members);
  if (p.duration_months) {
    return `${formatINR(Math.round(p.price / p.duration_months / payers), true)} / month${p.group_size > 1 ? " each" : ""}`;
  }
  if (p.total_sessions) return `${formatINR(Math.round(p.price / p.total_sessions), true)} / session`;
  const perDay = dayRate(p);
  return perDay !== null ? `${formatINR(perDay)} / day` : null;
}

/** Backend default upgrade window: 1 month → 15 days, ≤3 → 30, ≤6 → 45, longer → 60; plans in days → half. */
export function defaultUpgradeWindow(months: number | null, days: number): number {
  if (months) return months === 1 ? 15 : months <= 3 ? 30 : months <= 6 ? 45 : 60;
  return Math.floor(days / 2);
}

/** "2 members" / "5 members (1 free)". */
export function groupLabel(p: Pick<Plan, "group_size" | "free_members">): string | null {
  if (p.group_size <= 1) return null;
  return `${p.group_size} members${p.free_members ? ` (${p.free_members} free)` : ""}`;
}
