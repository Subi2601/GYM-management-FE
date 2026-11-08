import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost, cleanParams } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { openWhatsApp } from "@/lib/utils";
import { useBranchStore } from "@/stores/branch-store";
import type { Paginated, PageQuery, TabCounts } from "@/types/api";

/** GET /renewals — each member's latest membership ending within `within` days or lapsed ≤ 30 days ago. */
export interface RenewalRow {
  subscription_id: string;
  member_id: string;
  member_name: string;
  registration_id: string;
  phone: string;
  plan_name: string;
  end_date: string;
  /** Negative = days since it lapsed. */
  days_left: number;
  reminded_at: string | null;
  reminder_count: number;
}

export const RENEWAL_TABS = ["due", "overdue", "reminded", "all"] as const;
export type RenewalTab = (typeof RENEWAL_TABS)[number];

export interface RenewalQuery extends PageQuery {
  tab: RenewalTab;
  within: number;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
}

export const renewalApi = {
  list: (q: RenewalQuery) => apiGet<Paginated<RenewalRow>>("/renewals", cleanParams(q)),
  counts: (within: number) => apiGet<TabCounts<RenewalTab>>("/renewals/counts", { within }),
  /** Records that the reminder was sent (WhatsApp opens on this device). */
  markReminded: (subscriptionId: string) => apiPost<RenewalRow>(`/renewals/${subscriptionId}/remind`),
};

export const renewalKeys = {
  all: ["renewals"] as const,
  list: (branch: string | null | undefined, q: RenewalQuery) => ["renewals", "list", branch, q] as const,
  counts: (branch: string | null | undefined, within: number) => ["renewals", "counts", branch, within] as const,
};

export function useRenewals(q: RenewalQuery) {
  const branch = useBranchStore((s) => s.selectedBranchId);
  return useQuery({
    queryKey: renewalKeys.list(branch, q),
    queryFn: async () => (await renewalApi.list(q)).data,
    placeholderData: keepPreviousData,
  });
}

export function useRenewalCounts(within: number) {
  const branch = useBranchStore((s) => s.selectedBranchId);
  return useQuery({ queryKey: renewalKeys.counts(branch, within), queryFn: async () => (await renewalApi.counts(within)).data });
}

export function useInvalidateRenewals() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: renewalKeys.all });
}

/** Friendly reminder in WhatsApp — ending soon vs already lapsed. */
export function sendRenewalReminder(row: RenewalRow, gymName: string): void {
  const gym = `*${gymName.toUpperCase()}*`;
  const when = row.days_left === 0 ? "today" : row.days_left === 1 ? "tomorrow" : `on ${formatDate(row.end_date)}`;
  const text = row.days_left >= 0
    ? `Hi ${row.member_name} 👋\n\nYour *${row.plan_name}* membership at ${gym} ends ${when}.\n\nRenew now to keep your fitness streak going! 💪 Reply here or visit the front desk.`
    : `Hi ${row.member_name} 👋\n\nYour *${row.plan_name}* membership at ${gym} ended on ${formatDate(row.end_date)}. We miss you at the gym!\n\nRenew today and get back on track. 💪 Reply here or visit the front desk.`;
  openWhatsApp(row.phone, text);
}
