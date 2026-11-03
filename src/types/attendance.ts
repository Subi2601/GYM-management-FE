import type { AttendancePersonType, AttendanceSource, AttendanceStatus, EmployeeRole } from "@/types/enums";

/** see backend app/schemas/attendance.py (AttendanceResponse). Times arrive as `HH:MM:SS`. */
export interface AttendanceRecord {
  id: string;
  branch_id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  employee_role: EmployeeRole;
  attendance_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: AttendanceStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  /** From the day's visits (daily view): still inside, number of visits, closed-visit minutes, first check-in source. */
  inside: boolean;
  visits: number;
  worked_minutes: number;
  source: AttendanceSource | null;
}

export interface UnmarkedEmployee {
  id: string;
  employee_code: string;
  name: string;
  role: EmployeeRole;
}

/** GET /attendance/daily?date= */
export interface DailyAttendance {
  date: string;
  records: AttendanceRecord[];
  not_marked: UnmarkedEmployee[];
}

export interface AttendanceSummary {
  present: number;
  absent: number;
  late: number;
  half_day: number;
  on_leave: number;
  total_days_in_month: number;
}

/** GET /attendance/monthly?employee_id=&month=&year= */
export interface MonthlyAttendance {
  employee_id: string | null;
  month_year: string;
  records: AttendanceRecord[];
  summary: AttendanceSummary;
}

/** POST /attendance/mark */
export interface AttendanceMarkInput {
  employee_id: string;
  status: AttendanceStatus;
  notes?: string | null;
  date?: string | null;
}

// ── members ────────────────────────────────────────────────────────────

/** One member visit (GET /attendance/members/daily). A refused QR check-in has `denied_reason` and no check-out. */
export interface MemberVisit {
  id: string;
  member_id: string;
  member_name: string;
  registration_id: string;
  phone: string;
  session_date: string;
  check_in_time: string;
  check_out_time: string | null;
  in_source: AttendanceSource;
  out_source: AttendanceSource | null;
  denied_reason: string | null;
  duration_minutes: number | null;
}

export interface MemberDaily {
  date: string;
  records: MemberVisit[];
  summary: { inside: number; checked_in: number; visits: number; denied: number };
}

/** Outcome of a check-in / check-out (front desk or QR scan). */
export interface CheckResult {
  direction: "IN" | "OUT";
  person_type: AttendancePersonType;
  name: string;
  time: string;
  late: boolean;
  duration_minutes: number | null;
}

// ── QR posters + linked phones ─────────────────────────────────────────

export interface AttendanceQr {
  branch_id: string;
  branch_name: string;
  checkin_token: string;
  latitude: number | null;
  longitude: number | null;
  geofence_m: number;
}

export interface AttendanceLocationInput {
  latitude: number | null;
  longitude: number | null;
  geofence_m: number;
}

export interface LinkedDevice {
  id: string;
  person_type: AttendancePersonType;
  person_name: string;
  person_code: string;
  user_agent: string | null;
  last_used_at: string | null;
  created_at: string;
}

// ── public scan page ───────────────────────────────────────────────────

export interface CheckinInfo {
  branch_name: string;
  organization_name: string;
  location_required: boolean;
  person: { name: string; person_type: AttendancePersonType } | null;
}
