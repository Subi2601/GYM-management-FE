import { useQuery } from "@tanstack/react-query";

import type { SortDir } from "@/hooks/use-list-state";
import { apiGet, apiPatch, apiPost, apiPut, cleanParams } from "@/lib/api-client";
import { useBranchStore } from "@/stores/branch-store";
import type { PageQuery, Paginated, TabCounts } from "@/types/api";
import type {
  Employee, EmployeeInput, EmployeeListFilter, EmployeeProfile, EmployeeUpdate, FeedbackCreated, FeedbackInput,
  PTAssignInput,
} from "@/types/employee";
import type { EmployeeRole } from "@/types/enums";

export interface EmployeeListQuery extends PageQuery {
  status: EmployeeListFilter;
  role?: EmployeeRole | "";
  /** One of `EmployeeSortKey`. */
  sort_by?: string;
  sort_dir?: SortDir;
}

export const staffApi = {
  list: (q: EmployeeListQuery) => apiGet<Paginated<Employee>>("/employees", cleanParams(q)),
  /** Row count per status tab (active / archive / all) in one call. */
  counts: () => apiGet<TabCounts<EmployeeListFilter>>("/employees/counts"),
  get: (id: string) => apiGet<Employee>(`/employees/${id}`),
  profile: (id: string) => apiGet<EmployeeProfile>(`/employees/${id}/profile`),
  create: (body: EmployeeInput) => apiPost<Employee>("/employees", body),
  update: (id: string, body: EmployeeUpdate) => apiPut<Employee>(`/employees/${id}`, body),
  terminate: (id: string) => apiPatch<Employee>(`/employees/${id}/terminate`),
  addFeedback: (id: string, body: FeedbackInput) => apiPost<FeedbackCreated>(`/employees/${id}/feedback`, body),
  assignPT: (body: PTAssignInput) => apiPost<unknown>("/personal-training/subscribe", body),
};

export const staffKeys = {
  all: ["employees"] as const,
  list: (branch: string | null | undefined, q: EmployeeListQuery) => ["employees", "list", branch, q] as const,
  counts: (branch: string | null | undefined) => ["employees", "counts", branch] as const,
  detail: (branch: string | null | undefined, id: string) => ["employees", "detail", branch, id] as const,
  profile: (branch: string | null | undefined, id: string) => ["employees", "profile", branch, id] as const,
};

/** Employee counts per status tab (Staff tabs, Payroll headcount tile). */
export function useStaffCounts(enabled = true) {
  const branch = useBranchStore((s) => s.selectedBranchId);
  return useQuery({
    queryKey: staffKeys.counts(branch),
    queryFn: async () => (await staffApi.counts()).data,
    enabled,
  });
}
