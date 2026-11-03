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
