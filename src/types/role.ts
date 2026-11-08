/** GET /roles — a gym role (backend app/schemas/role.py). */
export interface Role {
  id: string;
  code: string;
  name: string;
  description: string | null;
  /** Owner 100 > All branches 80 > Branch manager 50 > Branch staff 10. */
  level: number;
  level_label: string;
  /** Sees every branch (can switch branches). */
  all_branches: boolean;
  /** Built-in: can't be deleted. */
  is_system: boolean;
  /** Always full access; not editable. */
  is_owner: boolean;
  user_count: number;
  permission_count: number;
  /** Below the caller's level (and not Owner). */
  editable: boolean;
}

export interface RoleDetail extends Role {
  permissions: string[];
}

export interface RoleInput {
  name: string;
  description: string | null;
  level: number;
  copy_from_id?: string | null;
}

export interface CatalogPermission {
  code: string;
  name: string;
  /** Can't be given to any role but the owner. */
  owner_only: boolean;
  /** Only for All branches roles. */
  all_branches_only: boolean;
}

export interface CatalogScreen {
  code: string;
  name: string;
  permissions: CatalogPermission[];
}

export interface CatalogModule {
  code: string;
  name: string;
  icon: string | null;
  screens: CatalogScreen[];
}

/** Levels a gym's own role can sit at. */
export const ROLE_LEVELS = [
  { value: 80, label: "All branches", hint: "Like Sub-admin: sees and works in every branch" },
  { value: 50, label: "Branch manager", hint: "Runs one branch; can give logins to staff-level roles" },
  { value: 10, label: "Branch staff", hint: "Works in one branch" },
] as const;
