import { Icon } from "@/components/ui/Icon";
import { Section } from "@/components/ui/Section";
import { formatTime12 } from "@/features/staff/lib/shifts";
import { MONTHS } from "@/lib/format";
import { cn, humanize } from "@/lib/utils";
import type { AttendanceDay, AttendanceMonth } from "@/types/employee";
import type { AttendanceStatus } from "@/types/enums";

const TONE: Record<AttendanceStatus, string> = {
  PRESENT: "bg-success-soft text-success border-success-line",
  LATE: "bg-warning-soft text-warning border-warning-line",
  ABSENT: "bg-danger-soft text-danger border-danger-line",
  HALF_DAY: "bg-info-soft text-info border-info-line",
  ON_LEAVE: "bg-plum-soft text-plum border-plum-line",
};
const LEGEND: [AttendanceStatus, string][] = [
  ["PRESENT", "Present"], ["LATE", "Late"], ["ABSENT", "Absent"], ["HALF_DAY", "Half day"], ["ON_LEAVE", "On leave"],
];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface AttendanceMonthCardProps {
  attendance: AttendanceMonth;
  onPrev: () => void;
  onNext: () => void;
  /** false on the current month — no future months. */
  canNext: boolean;
  loading?: boolean;
}

function dayTitle(day: number, record: AttendanceDay | undefined, elapsed: boolean): string {
  if (!record) return elapsed ? `${day}: not marked` : `${day}`;
  const times = [record.check_in && `in ${formatTime12(record.check_in)}`, record.check_out && `out ${formatTime12(record.check_out)}`]
    .filter(Boolean).join(", ");
  return `${day}: ${humanize(record.status)}${times ? ` (${times})` : ""}`;
}

/** Month calendar of one employee's attendance: a coloured cell per day, counts above, month switcher. */
export function AttendanceMonthCard({ attendance: a, onPrev, onNext, canNext, loading }: AttendanceMonthCardProps) {
  const [mm, yyyy] = a.month_year.split("-").map(Number) as [number, number];
  const byDay = new Map(a.days.map((d) => [Number(d.date.slice(8, 10)), d]));
  // Monday-first offset of the 1st of the month.
  const offset = (new Date(yyyy, mm - 1, 1).getDay() + 6) % 7;
  const navBtn = "flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-line bg-surface text-secondary-grey transition-colors hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <Section
      title="Attendance"
      description={`${a.present + a.late} present of ${a.days_elapsed} day${a.days_elapsed === 1 ? "" : "s"} so far`}
      aside={
        <div className="flex items-center gap-1.5">
          <button type="button" className={navBtn} onClick={onPrev} aria-label="Previous month"><Icon name="chevronLeft" className="h-4 w-4" /></button>
          <span className="min-w-[120px] text-center text-sm font-bold text-ink">{MONTHS[mm - 1]} {yyyy}</span>
          <button type="button" className={navBtn} onClick={onNext} disabled={!canNext} aria-label="Next month"><Icon name="chevronRight" className="h-4 w-4" /></button>
        </div>
      }
    >
      <div className={cn("transition-opacity", loading && "opacity-50")}>
        <div className="mb-4 flex flex-wrap gap-2">
          {LEGEND.map(([status, label]) => {
            const count = { PRESENT: a.present, LATE: a.late, ABSENT: a.absent, HALF_DAY: a.half_day, ON_LEAVE: a.on_leave }[status];
            return (
              <span key={status} className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold", TONE[status])}>
                {label} <span className="tabular-nums">{count}</span>
              </span>
            );
          })}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((w) => <div key={w} className="pb-1 text-center text-[11px] font-bold uppercase tracking-wide text-muted">{w}</div>)}
          {Array.from({ length: offset }, (_, i) => <div key={`pad-${i}`} />)}
          {Array.from({ length: a.days_in_month }, (_, i) => {
            const day = i + 1;
            const record = byDay.get(day);
            const elapsed = day <= a.days_elapsed;
            return (
              <div key={day} title={dayTitle(day, record, elapsed)}
                className={cn("flex h-9 items-center justify-center rounded-lg border text-[13px] font-semibold tabular-nums",
                  record ? TONE[record.status]
                    : elapsed ? "border-dashed border-line-strong bg-subtle text-muted"
                      : "border-transparent text-faint")}>
                {day}
              </div>
            );
          })}
        </div>
        <p className="m-0 mt-3 text-xs text-muted">Dashed days were not marked. Hover a day for check-in and check-out times.</p>
      </div>
    </Section>
  );
}
