import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api-client";
import type {
  AttendanceLocationInput, AttendanceMarkInput, AttendanceQr, AttendanceRecord, CheckinInfo, CheckResult,
  DailyAttendance, LinkedDevice, MemberDaily, MonthlyAttendance,
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
  // members
  membersDaily: (date: string) => apiGet<MemberDaily>("/attendance/members/daily", { date }),
  memberCheckIn: (memberId: string) => apiPost<CheckResult>("/attendance/members/check-in", { member_id: memberId }),
  memberCheckOut: (memberId: string) => apiPost<CheckResult>(`/attendance/members/${memberId}/check-out`),
  /** Close a visit: now (today) or at `time` (`HH:MM`, required for a past day). */
  closeVisit: (sessionId: string, time?: string) =>
    apiPost<null>(`/attendance/sessions/${sessionId}/check-out`, { check_out_time: time || null }),
  // QR posters + linked phones
  qr: () => apiGet<AttendanceQr>("/attendance/qr"),
  regenerateQr: () => apiPost<AttendanceQr>("/attendance/qr/regenerate"),
  updateLocation: (body: AttendanceLocationInput) => apiPut<AttendanceQr>("/attendance/qr/location", body),
  devices: () => apiGet<LinkedDevice[]>("/attendance/qr/devices"),
  unlinkDevice: (id: string) => apiDelete<null>(`/attendance/qr/devices/${id}`),
};

/** Public scan page (no login) — the branch comes from the poster token, the person from the phone's cookie. */
export const checkinApi = {
  info: (token: string) => apiGet<CheckinInfo>(`/public/checkin/${token}`),
  verify: (token: string, body: { phone: string; id_number: string }) =>
    apiPost<{ name: string }>(`/public/checkin/${token}/verify`, body),
  scan: (token: string, body: { direction: "in" | "out"; latitude?: number; longitude?: number; accuracy?: number }) =>
    apiPost<CheckResult>(`/public/checkin/${token}/scan`, body),
};

export const attendanceKeys = {
  all: ["attendance"] as const,
  daily: (branch: string | null | undefined, date: string) => ["attendance", "daily", branch, date] as const,
  membersDaily: (branch: string | null | undefined, date: string) => ["attendance", "members", branch, date] as const,
  monthly: (branch: string | null | undefined, q: MonthlyQuery) => ["attendance", "monthly", branch, q] as const,
  qr: (branch: string | null | undefined) => ["attendance", "qr", branch] as const,
  devices: (branch: string | null | undefined) => ["attendance", "devices", branch] as const,
};

/** Minutes → "1h 25m" / "40m". */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** `HH:MM[:SS]` → "6:42 AM". */
export function formatClock(value: string | null | undefined): string {
  if (!value) return "—";
  const [hStr, mStr] = value.split(":");
  const h = Number(hStr);
  if (Number.isNaN(h) || mStr === undefined) return value;
  return `${h % 12 || 12}:${mStr} ${h >= 12 ? "PM" : "AM"}`;
}
