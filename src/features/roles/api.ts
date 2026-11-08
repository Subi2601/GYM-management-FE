import { useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api-client";
import type { CatalogModule, Role, RoleDetail, RoleInput } from "@/types/role";

/** Roles are per gym (not per branch), so keys don't carry the branch. */
export const roleKeys = {
  all: ["roles"] as const,
  list: ["roles", "list"] as const,
  catalog: ["roles", "catalog"] as const,
  assignable: ["roles", "assignable"] as const,
  detail: (id: string) => ["roles", "detail", id] as const,
};

export const roleApi = {
  list: () => apiGet<Role[]>("/roles"),
  catalog: () => apiGet<CatalogModule[]>("/roles/catalog"),
  /** Roles the signed-in user may give a staff login (below their own level). */
  assignable: () => apiGet<Role[]>("/roles/assignable"),
  get: (id: string) => apiGet<RoleDetail>(`/roles/${id}`),
  create: (body: RoleInput) => apiPost<RoleDetail>("/roles", body),
  update: (id: string, body: Partial<RoleInput>) => apiPut<RoleDetail>(`/roles/${id}`, body),
  /** Replace the role's access with exactly these permission codes. */
  setPermissions: (id: string, codes: string[]) => apiPut<RoleDetail>(`/roles/${id}/permissions`, { codes }),
  remove: (id: string) => apiDelete<null>(`/roles/${id}`),
};

export function useRoles() {
  return useQuery({ queryKey: roleKeys.list, queryFn: async () => (await roleApi.list()).data });
}

export function useRoleCatalog() {
  return useQuery({ queryKey: roleKeys.catalog, queryFn: async () => (await roleApi.catalog()).data, staleTime: 5 * 60_000 });
}

export function useAssignableRoles(enabled = true) {
  return useQuery({ queryKey: roleKeys.assignable, queryFn: async () => (await roleApi.assignable()).data, enabled });
}

export function useInvalidateRoles() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: roleKeys.all });
}

/** Role a new login gets unless one is picked (same rule as the backend): Manager for admin / manager staff. */
export function defaultRoleCode(employeeRole: string): "MANAGER" | "STAFF" {
  return employeeRole === "ADMIN" || employeeRole === "MANAGER" || employeeRole === "OWNER" ? "MANAGER" : "STAFF";
}
