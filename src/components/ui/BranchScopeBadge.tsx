import { useCallback } from "react";

import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAuthStore } from "@/stores/auth-store";

/** id → branch name lookup from /auth/me (branches this login can see). */
export function useBranchNames() {
  const branches = useAuthStore((s) => s.me?.branches);
  return useCallback((id: string) => branches?.find((b) => b.id === id)?.branch_name, [branches]);
}

/**
 * Where a shared master (plan, offer) lives: "All branches" for common rows; the branch name for branch rows,
 * only when `showBranch` (the "All Branches" view lists every branch's rows together).
 */
export function BranchScopeBadge({ branchId, showBranch, branchName }: {
  branchId: string | null; showBranch: boolean; branchName: (id: string) => string | undefined;
}) {
  if (branchId === null) {
    return <StatusBadge value="COMMON" tone="blue" label="All branches" className="shrink-0 normal-case" />;
  }
  if (!showBranch) return null;
  return <StatusBadge value="BRANCH" tone="grey" label={branchName(branchId) ?? "Branch"} className="shrink-0 normal-case" />;
}
