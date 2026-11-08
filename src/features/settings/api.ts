import { useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPut } from "@/lib/api-client";
import type { DeskSettings, GymSettings, GymSettingsInput } from "@/types/settings";

/** Gym-wide (every branch), so keys don't carry the branch. */
export const settingsKeys = {
  all: ["settings"] as const,
  gym: ["settings", "gym"] as const,
  desk: ["settings", "desk"] as const,
};

export const settingsApi = {
  get: () => apiGet<GymSettings>("/settings"),
  save: (body: Partial<GymSettingsInput>) => apiPut<GymSettings>("/settings", body),
  desk: () => apiGet<DeskSettings>("/settings/desk"),
};

export function useGymSettings() {
  return useQuery({ queryKey: settingsKeys.gym, queryFn: async () => (await settingsApi.get()).data });
}

/** Trial offer (Leads) and renewal window (Renewals) — readable by every signed-in account. */
export function useDeskSettings(enabled = true) {
  return useQuery({ queryKey: settingsKeys.desk, queryFn: async () => (await settingsApi.desk()).data, enabled,
    staleTime: 60_000 });
}

/** Settings change renewal windows too, so member / renewal lists refetch. */
export function useInvalidateSettings() {
  const qc = useQueryClient();
  return () => Promise.all([
    qc.invalidateQueries({ queryKey: settingsKeys.all }),
    qc.invalidateQueries({ queryKey: ["members"] }),
    qc.invalidateQueries({ queryKey: ["renewals"] }),
  ]);
}
