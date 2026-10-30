export interface Branch {
  id: string;
  organization_id: string;
  branch_name: string;
  location: string | null;
  /** Email of the branch's OWNER login (created with the branch). */
  login_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface BranchCreate {
  branch_name: string;
  location: string;
  login_email: string;
  login_password: string;
}

export interface BranchUpdate {
  branch_name?: string;
  location?: string;
}
