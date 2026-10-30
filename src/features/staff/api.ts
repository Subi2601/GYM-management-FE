import { apiGet, apiPatch, apiPost, apiPut, cleanParams } from "@/lib/api-client";
import type { PageQuery, Paginated } from "@/types/api";
import type {
  Employee, EmployeeInput, EmployeeListFilter, EmployeeProfile, EmployeeUpdate, FeedbackCreated, FeedbackInput,
  PTAssignInput,
} from "@/types/employee";

export interface EmployeeListQuery extends PageQuery {
  status: EmployeeListFilter;
}

export const staffApi = {
  list: (q: EmployeeListQuery) => apiGet<Paginated<Employee>>("/employees", cleanParams(q)),
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
  profile: (branch: string | null | undefined, id: string) => ["employees", "profile", branch, id] as const,
};
