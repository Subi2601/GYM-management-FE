import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { attendanceKeys } from "@/features/attendance/api";
import { MemberAttendance } from "@/features/attendance/components/MemberAttendance";
import { MemberCheckInModal } from "@/features/attendance/components/MemberCheckInModal";
import { StaffAttendance } from "@/features/attendance/components/StaffAttendance";
import { useUrlEnum } from "@/hooks/use-list-state";
import { formatDate, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCan } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";

const VIEWS = ["staff", "members"] as const;
type View = (typeof VIEWS)[number];
const VIEW_META: Record<View, { label: string; icon: IconName }> = {
  staff: { label: "Staff", icon: "userCheck" },
  members: { label: "Members", icon: "users" },
};

/** Daily attendance — Staff and Members tabs (`?view=`), QR scans and front-desk entries side by side. */
export function AttendancePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const branch = useBranchStore((s) => s.selectedBranchId);
  const canMark = useCan("attendance:mark");
  const writable = branch !== null && canMark;
  const canQr = useCan("attendance:qr");
  const today = todayISO();
  const [view, setView] = useUrlEnum<View>("view", VIEWS, "staff");
  const [date, setDate] = useState(today);
  const [checkingIn, setCheckingIn] = useState(false);
  const isToday = date === today;

  return (
    <div>
      <PageHeader
        title="Attendance"
        subtitle={isToday ? "Who's in today: QR scans and front-desk entries" : `Attendance for ${formatDate(date)}`}
        actions={
          <>
            <Button variant="secondary" icon={<Icon name="refresh" className="h-4 w-4" />}
              onClick={() => void qc.invalidateQueries({ queryKey: attendanceKeys.all })}>
              Refresh
            </Button>
            {canQr && branch !== null && (
              <Button variant="secondary" icon={<Icon name="qr" className="h-4 w-4" />} onClick={() => navigate("/attendance/qr")}>
                QR codes
              </Button>
            )}
            {writable && view === "members" && isToday && (
              <Button icon={<Icon name="plus" className="h-4 w-4" />} onClick={() => setCheckingIn(true)}>
                Manual check-in
              </Button>
            )}
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-line bg-surface p-1 shadow-subtle" role="tablist" aria-label="Attendance of">
          {VIEWS.map((v) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
              className={cn("inline-flex cursor-pointer items-center gap-2 rounded-lg border-0 px-4 py-2 text-sm font-bold transition-colors",
                view === v ? "bg-grad text-white shadow-btn-primary" : "bg-transparent text-muted hover:bg-hover hover:text-ink")}>
              <Icon name={VIEW_META[v].icon} className="h-4 w-4" />
              {VIEW_META[v].label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {!isToday && (
            <button type="button" className="btn-status-action btn-grey" onClick={() => setDate(today)}>Today</button>
          )}
          <input type="date" value={date} max={today} aria-label="Date"
            onChange={(e) => setDate(e.target.value || today)} className="toolbar-control w-[160px]" />
        </div>
      </div>

      {view === "staff"
        ? <StaffAttendance date={date} isToday={isToday} writable={writable} />
        : <MemberAttendance date={date} isToday={isToday} writable={writable} />}

      {checkingIn && <MemberCheckInModal onClose={() => setCheckingIn(false)} />}
    </div>
  );
}
