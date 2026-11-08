import { useCan } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";

/** Shown on Add / Edit controls while "All Branches" is selected. */
export const ALL_BRANCHES_REASON = "Select a branch from the sidebar to add or edit";

/**
 * Write access for a screen action. `show` = the account has the permission (hide the control when false);
 * `disabled` = it does, but "All Branches" is selected — writes need one branch, so the control stays visible,
 * greyed out, with `reason` as its tooltip.
 */
export function useWriteAccess(permission: string) {
  const can = useCan(permission);
  const branchSelected = useBranchStore((s) => Boolean(s.selectedBranchId));
  return { show: can, disabled: can && !branchSelected, allowed: can && branchSelected,
    reason: branchSelected ? undefined : ALL_BRANCHES_REASON };
}
