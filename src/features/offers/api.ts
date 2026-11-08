import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPatch, apiPost, apiPut, cleanParams } from "@/lib/api-client";
import { useBranchStore } from "@/stores/branch-store";
import type { Paginated, TabCounts } from "@/types/api";
import type { Offer, OfferInput, OfferListQuery, OfferTab } from "@/types/offer";

export const offerApi = {
  list: (query: OfferListQuery) => apiGet<Paginated<Offer>>("/offers", cleanParams(query)),
  counts: () => apiGet<TabCounts<OfferTab>>("/offers/counts"),
  /** Active offers valid today — the billing screens' dropdown. */
  available: () => apiGet<Offer[]>("/offers/available"),
  create: (body: OfferInput) => apiPost<Offer>("/offers", body),
  update: (id: string, body: Partial<OfferInput>) => apiPut<Offer>(`/offers/${id}`, body),
  setStatus: (id: string, isActive: boolean) => apiPatch<Offer>(`/offers/${id}/status`, { is_active: isActive }),
};

export const offerKeys = {
  all: ["offers"] as const,
  list: (branch: string | null | undefined, query: OfferListQuery) => ["offers", "list", branch, query] as const,
  counts: (branch: string | null | undefined) => ["offers", "counts", branch] as const,
  available: (branch: string | null | undefined) => ["offers", "available", branch] as const,
};

export function useOffers(query: OfferListQuery) {
  const branch = useBranchStore((s) => s.selectedBranchId);
  return useQuery({
    queryKey: offerKeys.list(branch, query),
    queryFn: async () => (await offerApi.list(query)).data,
    placeholderData: keepPreviousData,
  });
}

export function useOfferCounts() {
  const branch = useBranchStore((s) => s.selectedBranchId);
  return useQuery({ queryKey: offerKeys.counts(branch), queryFn: async () => (await offerApi.counts()).data });
}

export function useAvailableOffers(enabled = true) {
  const branch = useBranchStore((s) => s.selectedBranchId);
  return useQuery({
    queryKey: offerKeys.available(branch),
    queryFn: async () => (await offerApi.available()).data,
    enabled,
  });
}

export function useInvalidateOffers() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: offerKeys.all });
}

/** "15%" / "12.5%" */
export const formatPercent = (value: number) => `${Number.isInteger(value) ? value : value.toFixed(2).replace(/0$/, "")}%`;
