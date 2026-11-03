import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";

import { dashboardKeys } from "@/features/dashboard/api";
import { apiDelete, apiGet, apiPost, apiPut, cleanParams } from "@/lib/api-client";
import { useBranchStore } from "@/stores/branch-store";
import type { Paginated, TabCounts } from "@/types/api";
import type { Lead, LeadConvertResult, LeadFilter, LeadFollowUpInput, LeadInput, LeadListQuery } from "@/types/lead";

export const leadApi = {
  list: (query: LeadListQuery) => apiGet<Paginated<Lead>>("/leads", cleanParams(query)),
  /** Row count per tab (all / followup / rejected) in one call. */
  counts: () => apiGet<TabCounts<LeadFilter>>("/leads/counts"),
  get: (id: string) => apiGet<Lead>(`/leads/${id}`),
  create: (body: LeadInput) => apiPost<Lead>("/leads", body),
  update: (id: string, body: Partial<LeadInput>) => apiPut<Lead>(`/leads/${id}`, body),
  remove: (id: string) => apiDelete<null>(`/leads/${id}`),
  followUp: (id: string, body: LeadFollowUpInput) => apiPost<Lead>(`/leads/${id}/follow-up`, body),
  convert: (id: string) => apiPost<LeadConvertResult>(`/leads/${id}/convert`),
};

export const leadKeys = {
  all: ["leads"] as const,
  list: (branch: string | null | undefined, query: LeadListQuery) => ["leads", "list", branch, query] as const,
  counts: (branch: string | null | undefined) => ["leads", "counts", branch] as const,
};

export function useLeads(query: LeadListQuery) {
  const branch = useBranchStore((s) => s.selectedBranchId);
  return useQuery({
    queryKey: leadKeys.list(branch, query),
    queryFn: async () => (await leadApi.list(query)).data,
    placeholderData: keepPreviousData,
  });
}

/** Tab badge counts. */
export function useLeadCounts() {
  const branch = useBranchStore((s) => s.selectedBranchId);
  return useQuery({ queryKey: leadKeys.counts(branch), queryFn: async () => (await leadApi.counts()).data });
}

/** Leads feed the lead list, tab counts and the dashboard (follow-ups due, lead KPIs). */
export function useInvalidateLeads() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: leadKeys.all }),
      qc.invalidateQueries({ queryKey: dashboardKeys.all }),
    ]);
}
