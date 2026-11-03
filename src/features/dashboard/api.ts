import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api-client";
import { useBranchStore } from "@/stores/branch-store";
import type { DashboardSummary } from "@/types/dashboard";

export const dashboardApi = {
  summary: () => apiGet<DashboardSummary>("/dashboard/summary"),
};

export const dashboardKeys = {
  /** Prefix for invalidating every dashboard query after member / lead / billing changes. */
  all: ["dashboard"] as const,
  summary: (branch: string | null | undefined) => ["dashboard", "summary", branch] as const,
};

/** KPIs + 6-month growth for the selected branch (refetches when the branch changes). */
export function useDashboardSummary() {
  const branch = useBranchStore((s) => s.selectedBranchId);
  return useQuery({
    queryKey: dashboardKeys.summary(branch),
    queryFn: async () => (await dashboardApi.summary()).data,
  });
}
