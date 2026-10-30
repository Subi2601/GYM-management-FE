import type { EmployeeRole, EmployeeStatus, PTStatus } from "@/types/enums";

/** GET /employees, /employees/{id} — see backend app/schemas/employee.py (EmployeeResponse). */
export interface Employee {
  id: string;
  branch_id: string;
  employee_code: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  role: EmployeeRole;
  education: string | null;
  experience: string | null;
  /** PII — plain for pii:view, masked (XXXX-XXXX-1234) otherwise. */
  aadhar_number: string | null;
  pan_number: string | null;
  id_proof_type: string | null;
  id_proof_number: string | null;
  bank_account_number: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
  base_salary: number;
  bank_name: string | null;
  ifsc_code: string | null;
  status: EmployeeStatus;
  average_rating: number | null;
  date_of_joining: string;
  date_of_termination: string | null;
  created_at: string;
  updated_at: string;
}

/** POST /employees (EmployeeCreate). PUT /employees/{id} takes any subset (EmployeeUpdate). */
export interface EmployeeInput {
  name: string;
  phone: string;
  email: string;
  address: string;
  role: EmployeeRole;
  education?: string | null;
  experience?: string | null;
  aadhar_number: string;
  pan_number: string;
  id_proof_type: string;
  id_proof_number: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relation: string;
  base_salary: number;
  bank_name: string;
  bank_account_number: string;
  ifsc_code: string;
  date_of_joining: string;
  status?: EmployeeStatus;
}

export type EmployeeUpdate = Partial<EmployeeInput>;

/** `status` query of GET /employees. */
export type EmployeeListFilter = "active" | "archive" | "all";

export interface Feedback {
  id: string;
  employee_id: string;
  client_name: string;
  rating: number;
  comment: string | null;
  feedback_date: string;
  created_at: string;
  updated_at: string;
}

/** POST /employees/{id}/feedback */
export interface FeedbackInput {
  client_name: string;
  rating: number;
  comment?: string | null;
  feedback_date?: string | null;
}

export interface FeedbackCreated {
  feedback: Feedback;
  average_rating: number | null;
}

export interface PTClient {
  id: string;
  member_id: string;
  member_name: string;
  plan_id: string | null;
  plan_name: string | null;
  goal: string | null;
  total_sessions: number;
  sessions_remaining: number;
  start_date: string;
  expiry_date: string;
  status: PTStatus;
  is_paid: boolean;
}

/** GET /employees/{id}/profile */
export interface EmployeeProfile {
  employee: Employee;
  feedbacks: Feedback[];
  pt_clients: PTClient[];
  average_rating: number | null;
}

/** POST /personal-training/subscribe (PTSubscribeRequest). */
export interface PTAssignInput {
  member_id: string;
  trainer_id: string;
  plan_id: string;
  start_date?: string | null;
  goal?: string | null;
}
