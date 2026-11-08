import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { SortDir } from "@/hooks/use-list-state";
import { apiDelete, apiGet, apiPost, apiPut, cleanParams } from "@/lib/api-client";
import { useBranchStore } from "@/stores/branch-store";
import type { Paginated, TabCounts } from "@/types/api";
import type { PlanServiceType, PlanType } from "@/types/enums";
import type { Plan, PlanCategory, PlanInput } from "@/types/plan";

/** Server sort keys of GET /plans (`sort_by`). */
export type PlanSortKey = "name" | "type" | "service_type" | "duration_days" | "price" | "created_at";

export interface PlanListQuery {
  page: number;
  page_size: number;
  search?: string;
  sort_by?: string;
  sort_dir?: SortDir;
  type?: PlanType;
  service_type?: PlanServiceType | "";
  category_id?: string;
  /** Only plans shown for billing (plan and its category switched on). */
  active_only?: boolean;
  /** Active / Inactive tab (the plan's own switch). */
  status?: "active" | "inactive";
}

/** Status tabs of the plans screen (GET /plans?status=). */
export const PLAN_STATUS_TABS = ["active", "inactive", "all"] as const;
export type PlanStatusTab = (typeof PLAN_STATUS_TABS)[number];

export const planKeys = {
  all: ["plans"] as const,
  list: (branch: string | null | undefined, q: PlanListQuery) => ["plans", "list", branch, q] as const,
  counts: (branch: string | null | undefined, q?: PlanCountsQuery) => ["plans", "counts", branch, q] as const,
  categories: (branch: string | null | undefined) => ["plans", "categories", branch] as const,
};

/** Keys of GET /plans/counts: status tabs + per type. */
export type PlanTab = "all" | "active" | "inactive" | "membership" | "addon" | "custom";

export interface PlanCountsQuery {
  search?: string;
  category_id?: string;
}

export const planApi = {
  list: (q: PlanListQuery) => apiGet<Paginated<Plan>>("/plans", cleanParams(q)),
  /** Row count per tab (all / active / inactive, and per type) in one call, within the search and category. */
  counts: (q: PlanCountsQuery = {}) => apiGet<TabCounts<PlanTab>>("/plans/counts", cleanParams(q)),
  create: (body: PlanInput) => apiPost<Plan>("/plans", body),
  update: (id: string, body: Partial<PlanInput>) => apiPut<Plan>(`/plans/${id}`, body),
  remove: (id: string) => apiDelete<null>(`/plans/${id}`),
};

export const categoryApi = {
  list: () => apiGet<PlanCategory[]>("/plan-categories"),
  create: (name: string) => apiPost<PlanCategory>("/plan-categories", { name }),
  update: (id: string, body: { name?: string; is_active?: boolean }) => apiPut<PlanCategory>(`/plan-categories/${id}`, body),
  reorder: (ids: string[]) => apiPut<null>("/plan-categories/order", { ids }),
  remove: (id: string) => apiDelete<null>(`/plan-categories/${id}`),
};

/** The owner's categories in tab order (with plan counts for the selected branch). */
export function usePlanCategories() {
  const branch = useBranchStore((s) => s.selectedBranchId);
  return useQuery({ queryKey: planKeys.categories(branch), queryFn: async () => (await categoryApi.list()).data });
}

/** Plans feed the plan list, the category counts, every plan dropdown and the members' plan filter. */
export function useInvalidatePlans() {
  const qc = useQueryClient();
  return () =>
    Promise.all([qc.invalidateQueries({ queryKey: planKeys.all }), qc.invalidateQueries({ queryKey: ["lookup", "plans"] })]);
}
