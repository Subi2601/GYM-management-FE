import type { AttendanceStatus, EmployeeRole } from "@/types/enums";

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
