import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api-client";
import { ALL_ROWS, type Paginated } from "@/types/api";
import type { Branch, BranchCreate, BranchUpdate } from "@/types/branch";

export const branchApi = {
  list: () => apiGet<Paginated<Branch>>("/branches", ALL_ROWS),
  create: (body: BranchCreate) => apiPost<Branch>("/branches", body),
  update: (id: string, body: BranchUpdate) => apiPut<Branch>(`/branches/${id}`, body),
  remove: (id: string) => apiDelete<null>(`/branches/${id}`),
  resetLoginPassword: (id: string, new_password: string) =>
    apiPost<null>(`/branches/${id}/reset-login-password`, { new_password }),
};

export const branchKeys = {
  all: ["branches"] as const,
};
