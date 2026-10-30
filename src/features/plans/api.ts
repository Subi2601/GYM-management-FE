import { useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiGet, apiPost, apiPut, cleanParams } from "@/lib/api-client";
import type { Paginated } from "@/types/api";
import type { PlanServiceType, PlanType } from "@/types/enums";
import type { Plan, PlanInput } from "@/types/plan";

export interface PlanListQuery {
  page: number;
  page_size: number;
  search?: string;
  type?: PlanType;
  service_type?: PlanServiceType;
}

export const planKeys = {
  all: ["plans"] as const,
  list: (branch: string | null | undefined, q: PlanListQuery) => ["plans", "list", branch, q] as const,
};

export const planApi = {
  list: (q: PlanListQuery) => apiGet<Paginated<Plan>>("/plans", cleanParams(q)),
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
