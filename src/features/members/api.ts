import { useQueryClient } from "@tanstack/react-query";

import { dashboardKeys } from "@/features/dashboard/api";
import type { SortDir } from "@/hooks/use-list-state";
import { apiDelete, apiGet, apiPost, apiPut, cleanParams } from "@/lib/api-client";
import type { Paginated, TabCounts } from "@/types/api";
import type { Gender } from "@/types/enums";
import type { Member, MemberInput } from "@/types/member";

export const MEMBER_FILTERS = ["all", "active", "expiring", "inactive"] as const;
export type MemberFilter = (typeof MEMBER_FILTERS)[number];

/** Server sort keys of GET /members. */
export type MemberSortKey = "registration_id" | "name" | "phone" | "joining_date" | "expiry_date" | "created_at";

export interface MemberListQuery {
  page: number;
  page_size: number;
  search?: string;
  sort_by?: string;
  sort_dir?: SortDir;
  filter: MemberFilter;
  plan_id?: string;
  gender?: Gender | "";
  joined_from?: string;
  joined_to?: string;
}

export const memberKeys = {
  all: ["members"] as const,
  list: (branch: string | null | undefined, q: MemberListQuery) => ["members", "list", branch, q] as const,
  detail: (branch: string | null | undefined, id: string) => ["members", "detail", branch, id] as const,
  counts: (branch: string | null | undefined) => ["members", "counts", branch] as const,
  nextRegistrationId: (branch: string | null | undefined) => ["members", "next-registration-id", branch] as const,
};

export const memberApi = {
  list: (q: MemberListQuery) => apiGet<Paginated<Member>>("/members", cleanParams(q)),
  get: (id: string) => apiGet<Member>(`/members/${id}`),
  /** Row count per tab (all / active / expiring / inactive) in one call. */
  counts: () => apiGet<TabCounts<MemberFilter>>("/members/counts"),
  nextRegistrationId: () => apiGet<{ code: string }>("/members/next-registration-id"),
  create: (body: MemberInput) => apiPost<Member>("/members", body),
  update: (id: string, body: MemberInput) => apiPut<Member>(`/members/${id}`, body),
  remove: (id: string) => apiDelete<null>(`/members/${id}`),
};

/** Members feed the member list, counts and every member dropdown. */
export function useInvalidateMembers() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: memberKeys.all }),
      qc.invalidateQueries({ queryKey: ["lookup", "members"] }),
      qc.invalidateQueries({ queryKey: dashboardKeys.all }),
    ]);
}
