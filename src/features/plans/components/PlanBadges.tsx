import type { ReactNode } from "react";

import { StatusBadge } from "@/components/ui/StatusBadge";
import { groupLabel } from "@/features/plans/labels";
import type { Plan } from "@/types/plan";

/** Package rules at a glance: members covered, ID check, check in at any branch. */
export function PlanBadges({ plan, empty = null }: {
  plan: Pick<Plan, "group_size" | "free_members" | "id_check" | "all_branches">; empty?: ReactNode;
}) {
  const group = groupLabel(plan);
  if (!group && !plan.id_check && !plan.all_branches) return <>{empty}</>;
  return (
    <span className="flex flex-wrap gap-1">
      {group && <StatusBadge value="GROUP" tone="purple" label={group} className="normal-case" />}
      {plan.id_check && <StatusBadge value="ID" tone="amber" label="ID check" className="normal-case" />}
      {plan.all_branches && <StatusBadge value="ALL" tone="green" label="Any-branch check-in" className="normal-case" />}
    </span>
  );
}
