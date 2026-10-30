import { apiGet, apiPost } from "@/lib/api-client";
import type {
  AttendanceMarkInput, AttendanceRecord, DailyAttendance, MonthlyAttendance,
} from "@/types/attendance";

export interface MonthlyQuery {
  employee_id: string;
  month: number;
  year: number;
}

export const attendanceApi = {
  daily: (date: string) => apiGet<DailyAttendance>("/attendance/daily", { date }),
  monthly: (q: MonthlyQuery) => apiGet<MonthlyAttendance>("/attendance/monthly", q),
  mark: (body: AttendanceMarkInput) => apiPost<AttendanceRecord>("/attendance/mark", body),
  checkout: (employeeId: string) => apiPost<AttendanceRecord>(`/attendance/${employeeId}/checkout`),
};

export const attendanceKeys = {
  all: ["attendance"] as const,
  daily: (branch: string | null | undefined, date: string) => ["attendance", "daily", branch, date] as const,
  monthly: (branch: string | null | undefined, q: MonthlyQuery) => ["attendance", "monthly", branch, q] as const,
};
