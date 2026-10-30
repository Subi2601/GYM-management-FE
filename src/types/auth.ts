export type AccountRole = "OWNER" | "ADMIN" | "TRAINER";

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface BranchBrief {
  id: string;
  branch_name: string;
  location: string | null;
}

export interface MeUser {
  id: string;
  name: string;
  email: string;
  role: AccountRole;
  is_superadmin: boolean;
  organization_id: string | null;
  organization_name: string | null;
  branch_id: string | null;
}

export interface PermissionItem {
  id: string;
  name: string;
  code: string;
}

export interface ScreenAccess {
  screen_id: string;
  screen_name: string;
  screen_code: string;
  screen_route: string | null;
  permissions: PermissionItem[];
}

export interface ModuleAccess {
  module_id: string;
  module_name: string;
  module_code: string;
  module_icon: string | null;
  sort_order: number;
  screens: ScreenAccess[];
}

export interface Me {
  user: MeUser;
  roles: string[];
  permissions: string[];
  access: ModuleAccess[];
  branches: BranchBrief[];
  can_switch_branch: boolean;
}
