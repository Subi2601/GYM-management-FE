import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { apiDelete, apiGet, apiPost, apiPut, cleanParams } from "@/lib/api-client";
import { useBranchStore } from "@/stores/branch-store";
import type { Paginated } from "@/types/api";
import type { Lead, LeadConvertResult, LeadFollowUpInput, LeadInput, LeadListQuery } from "@/types/lead";

export const leadApi = {
  list: (query: LeadListQuery) => apiGet<Paginated<Lead>>("/leads", cleanParams(query)),
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
};

export function useLeads(query: LeadListQuery) {
  const branch = useBranchStore((s) => s.selectedBranchId);
  return useQuery({
    queryKey: leadKeys.list(branch, query),
    queryFn: async () => (await leadApi.list(query)).data,
    placeholderData: keepPreviousData,
  });
}
