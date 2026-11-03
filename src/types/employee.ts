import type { AttendanceStatus, EmployeeRole, EmployeeStatus, FitnessGoal, PTStatus, SalaryStatus } from "@/types/enums";

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
  bank_account_number: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
  /** 0 until payroll is set (PUT /employees/{id}/payroll). */
  base_salary: number;
  bank_name: string | null;
  ifsc_code: string | null;
  /** e.g. name@okaxis */
  upi_id: string | null;
  status: EmployeeStatus;
  average_rating: number | null;
  date_of_joining: string;
  date_of_termination: string | null;
  /** Shift timings as "HH:MM:SS"; a shift is either a full pair or null. */
  morning_start: string | null;
  morning_end: string | null;
  evening_start: string | null;
  evening_end: string | null;
  created_at: string;
  updated_at: string;
}

/** POST /employees (EmployeeCreate) — profile only. PUT /employees/{id} takes any subset (EmployeeUpdate). */
export interface EmployeeInput {
  name: string;
  phone: string;
  email: string;
  address: string;
  role: EmployeeRole;
  education?: string | null;
  experience?: string | null;
  /** Identity and emergency contact are optional (null = not given / cleared). */
  aadhar_number: string | null;
  pan_number: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
  date_of_joining: string;
  status?: EmployeeStatus;
  /** "HH:MM" — both shifts are required. */
  morning_start: string;
  morning_end: string;
  evening_start: string;
  evening_end: string;
}

export type EmployeeUpdate = Partial<EmployeeInput>;

/** PUT /employees/{id}/payroll. Leave `bank_account_number` out to keep the stored (maybe masked) one. */
export interface EmployeePayrollInput {
  base_salary: number;
  bank_name: string | null;
  bank_account_number?: string | null;
  ifsc_code: string | null;
  upi_id: string | null;
}

/** `status` query of GET /employees (archive = terminated). */
export const EMPLOYEE_LIST_FILTERS = ["active", "archive", "all"] as const;
export type EmployeeListFilter = (typeof EMPLOYEE_LIST_FILTERS)[number];

/** `sort_by` values accepted by GET /employees. */
export type EmployeeSortKey =
  | "employee_code" | "name" | "role" | "base_salary" | "date_of_joining" | "average_rating" | "created_at";

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
  goal: FitnessGoal | null;
  total_sessions: number;
  sessions_remaining: number;
  start_date: string;
  expiry_date: string;
  status: PTStatus;
  is_paid: boolean;
}

export interface AttendanceDay {
  date: string;
  status: AttendanceStatus;
  check_in: string | null;
  check_out: string | null;
}

/** One month of attendance on the staff details page. */
export interface AttendanceMonth {
  /** MM-YYYY */
  month_year: string;
  days_in_month: number;
  /** Days of the month up to today (all days for past months, 0 for future months). */
  days_elapsed: number;
  present: number;
  late: number;
  absent: number;
  half_day: number;
  on_leave: number;
  days: AttendanceDay[];
}

export interface PayrollSummary {
  base_salary: number;
  last_payout: { month_year: string; net_salary: number; status: SalaryStatus; paid_date: string | null } | null;
}

/** Trainers only. */
export interface TrainingSummary {
  active_clients: number;
  pt_clients: PTClient[];
  feedbacks: Feedback[];
  average_rating: number | null;
}

/**
 * GET /employees/{id}/profile?month=&year= — the staff details page. Sections follow the data:
 * `payroll` is null without salary:list, `training` is null unless the employee is a trainer.
 */
export interface EmployeeProfile {
  employee: Employee;
  attendance: AttendanceMonth;
  payroll: PayrollSummary | null;
  training: TrainingSummary | null;
}

/** POST /personal-training/subscribe (PTSubscribeRequest). */
export interface PTAssignInput {
  member_id: string;
  trainer_id: string;
  plan_id: string;
  start_date?: string | null;
  goal?: FitnessGoal | null;
}
