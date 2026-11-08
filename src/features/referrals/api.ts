import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost, apiPut, cleanParams } from "@/lib/api-client";
import { useBranchStore } from "@/stores/branch-store";
import type { Paginated } from "@/types/api";
import type { EligibleList, ProgramInput, ReferralCounts, ReferralProgram, ReferralStatus, ReferralTree,
  RewardRow, RewardStatus } from "@/types/referral";

export const referralKeys = {
  all: ["referrals"] as const,
  status: ["referrals", "status"] as const,
  eligible: (branch: string | null | undefined) => ["referrals", "eligible", branch] as const,
  counts: (branch: string | null | undefined) => ["referrals", "counts", branch] as const,
  rewards: (branch: string | null | undefined, q: object) => ["referrals", "rewards", branch, q] as const,
  tree: (branch: string | null | undefined, memberId: string) => ["referrals", "tree", branch, memberId] as const,
};

export const referralApi = {
  status: () => apiGet<ReferralStatus>("/referrals/status"),
  setProgram: (body: ProgramInput) => apiPut<ReferralProgram>("/referrals/program", body),
  eligible: () => apiGet<EligibleList>("/referrals/eligible"),
  counts: () => apiGet<ReferralCounts>("/referrals/counts"),
  rewards: (q: { page: number; page_size: number; status: RewardStatus; search?: string }) =>
    apiGet<Paginated<RewardRow>>("/referrals/rewards", cleanParams(q)),
  give: (memberId: string, monthKey?: string | null, note?: string | null) =>
    apiPost<{ member_id: string; name: string; reward: string; month_label: string }>("/referrals/give",
      { member_id: memberId, month_key: monthKey ?? null, note: note ?? null }),
  tree: (memberId: string) => apiGet<ReferralTree>(`/referrals/tree/${memberId}`),
};

export function useReferralStatus() {
  return useQuery({ queryKey: referralKeys.status, queryFn: async () => (await referralApi.status()).data });
}

export function useReferralCounts() {
  const branch = useBranchStore((s) => s.selectedBranchId);
  return useQuery({ queryKey: referralKeys.counts(branch), queryFn: async () => (await referralApi.counts()).data });
}

export function useEligible(enabled = true) {
  const branch = useBranchStore((s) => s.selectedBranchId);
  return useQuery({ queryKey: referralKeys.eligible(branch), queryFn: async () => (await referralApi.eligible()).data,
    enabled });
}

export function useRewards(q: { page: number; page_size: number; status: RewardStatus; search?: string }, enabled = true) {
  const branch = useBranchStore((s) => s.selectedBranchId);
  return useQuery({ queryKey: referralKeys.rewards(branch, q), queryFn: async () => (await referralApi.rewards(q)).data,
    placeholderData: keepPreviousData, enabled });
}

export function useReferralTree(memberId: string | null) {
  const branch = useBranchStore((s) => s.selectedBranchId);
  return useQuery({ queryKey: referralKeys.tree(branch, memberId ?? ""), enabled: !!memberId,
    queryFn: async () => (await referralApi.tree(memberId!)).data });
}

export function useInvalidateReferrals() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: referralKeys.all });
}
