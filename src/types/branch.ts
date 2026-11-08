export interface Branch {
  id: string;
  organization_id: string;
  branch_name: string;
  location: string | null;
  /** Email of the branch's OWNER login (created with the branch). */
  login_email: string | null;
  /** Branch contacts (not unique; empty = the gym's). */
  phone: string | null;
  email: string | null;
  /** null = the gym's GSTIN. */
  gstin: string | null;
  is_head_office: boolean;
  members_count: number;
  staff_count: number;
  created_at: string;
  updated_at: string;
}

interface BranchContacts {
  phone?: string | null;
  email?: string | null;
  gstin?: string | null;
  is_head_office?: boolean;
}

export interface BranchCreate extends BranchContacts {
  branch_name: string;
  location: string;
  login_email: string;
  login_password: string;
}

export interface BranchUpdate extends BranchContacts {
  branch_name?: string;
  location?: string;
}
