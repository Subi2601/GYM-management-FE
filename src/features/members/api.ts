import { useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiGet, apiPost, apiPut, cleanParams } from "@/lib/api-client";
import type { Paginated } from "@/types/api";
import type { Member, MemberCounts, MemberInput } from "@/types/member";

export const MEMBER_FILTERS = ["all", "active", "inactive", "expiring"] as const;
export type MemberFilter = (typeof MEMBER_FILTERS)[number];

export interface MemberListQuery {
  page: number;
  page_size: number;
  search?: string;
  filter: MemberFilter;
  plan_id?: string;
}

export const memberKeys = {
  all: ["members"] as const,
  list: (branch: string | null | undefined, q: MemberListQuery) => ["members", "list", branch, q] as const,
  counts: (branch: string | null | undefined) => ["members", "counts", branch] as const,
  filterTotal: (branch: string | null | undefined, filter: MemberFilter) => ["members", "filter-total", branch, filter] as const,
  nextRegistrationId: (branch: string | null | undefined) => ["members", "next-registration-id", branch] as const,
};

export const memberApi = {
  list: (q: MemberListQuery) => apiGet<Paginated<Member>>("/members", cleanParams(q)),
  counts: () => apiGet<MemberCounts>("/members/counts"),
  /** Total for one filter without loading the rows (page_size=1). */
  filterTotal: async (filter: MemberFilter) =>
    (await apiGet<Paginated<Member>>("/members", { filter, page: 1, page_size: 1 })).data.total,
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
      qc.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
}
