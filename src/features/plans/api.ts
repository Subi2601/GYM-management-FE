import { useQueryClient } from "@tanstack/react-query";

import type { SortDir } from "@/hooks/use-list-state";
import { apiDelete, apiGet, apiPost, apiPut, cleanParams } from "@/lib/api-client";
import type { Paginated, TabCounts } from "@/types/api";
import type { PlanServiceType, PlanType } from "@/types/enums";
import type { Plan, PlanInput } from "@/types/plan";

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
}

export const planKeys = {
  all: ["plans"] as const,
  list: (branch: string | null | undefined, q: PlanListQuery) => ["plans", "list", branch, q] as const,
  counts: (branch: string | null | undefined) => ["plans", "counts", branch] as const,
};

/** Tabs of the plans screen; each maps to the list's `type` filter. */
export type PlanTab = "all" | "membership" | "addon" | "custom";

export const planApi = {
  list: (q: PlanListQuery) => apiGet<Paginated<Plan>>("/plans", cleanParams(q)),
  /** Row count per tab (all / membership / addon / custom) in one call. */
  counts: () => apiGet<TabCounts<PlanTab>>("/plans/counts"),
  create: (body: PlanInput) => apiPost<Plan>("/plans", body),
  update: (id: string, body: PlanInput) => apiPut<Plan>(`/plans/${id}`, body),
  remove: (id: string) => apiDelete<null>(`/plans/${id}`),
};

/** Plans feed the plan list, every plan dropdown and the members' plan filter. */
export function useInvalidatePlans() {
  const qc = useQueryClient();
  return () =>
    Promise.all([qc.invalidateQueries({ queryKey: planKeys.all }), qc.invalidateQueries({ queryKey: ["lookup", "plans"] })]);
}
