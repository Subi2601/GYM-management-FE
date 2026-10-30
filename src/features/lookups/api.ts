import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api-client";
import { useBranchStore } from "@/stores/branch-store";
import { ALL_ROWS, type Paginated } from "@/types/api";
import type { PlanType } from "@/types/enums";
import type { Member } from "@/types/member";
import type { Plan, TrainerBrief } from "@/types/plan";

/**
 * Shared dropdown lookups (members, plans, trainers) for every feature.
 * Query keys include the selected branch so switching branch refetches.
 */
export const lookupKeys = {
  members: (branch: string | null | undefined) => ["lookup", "members", branch] as const,
  plans: (branch: string | null | undefined, type?: PlanType) => ["lookup", "plans", branch, type] as const,
  trainers: (branch: string | null | undefined) => ["lookup", "trainers", branch] as const,
};

export function useMemberLookup(enabled = true) {
  const branch = useBranchStore((s) => s.selectedBranchId);
  return useQuery({
    queryKey: lookupKeys.members(branch),
    queryFn: async () => (await apiGet<Paginated<Member>>("/members", ALL_ROWS)).data.items,
    enabled,
  });
}

export function usePlanLookup(type?: PlanType, enabled = true) {
  const branch = useBranchStore((s) => s.selectedBranchId);
  return useQuery({
    queryKey: lookupKeys.plans(branch, type),
    queryFn: async () => (await apiGet<Paginated<Plan>>("/plans", { ...ALL_ROWS, type })).data.items,
    enabled,
  });
}

export function useTrainerLookup(enabled = true) {
  const branch = useBranchStore((s) => s.selectedBranchId);
  return useQuery({
    queryKey: lookupKeys.trainers(branch),
    queryFn: async () => (await apiGet<TrainerBrief[]>("/employees/trainers")).data,
    enabled,
  });
}
