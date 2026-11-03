import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Drawer } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { attendanceApi, attendanceKeys } from "@/features/attendance/api";
import { formatDate, formatTime, MONTHS } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useBranchStore } from "@/stores/branch-store";
import type { AttendanceRecord } from "@/types/attendance";

export interface HistoryTarget {
  id: string;
  name: string;
  code: string;
}

const SUMMARY_TILES = [
  { key: "present", label: "Present", cls: "bg-success-soft border-success-line text-success" },
  { key: "absent", label: "Absent", cls: "bg-danger-soft border-danger-line text-danger" },
  { key: "late", label: "Late", cls: "bg-warning-soft border-warning-line text-warning" },
  { key: "half_day", label: "Half day", cls: "bg-info-soft border-info-line text-info" },
  { key: "on_leave", label: "On leave", cls: "bg-plum-soft border-plum-line text-plum" },
] as const;

const columns: ColumnDef<AttendanceRecord, unknown>[] = [
  { accessorKey: "attendance_date", header: "Date", meta: { width: "120px" },
    cell: ({ row }) => <span className="font-semibold">{formatDate(row.original.attendance_date)}</span> },
  { accessorKey: "status", header: "Status", meta: { width: "110px" },
    cell: ({ row }) => <StatusBadge value={row.original.status} /> },
  { accessorKey: "check_in_time", header: "In", meta: { width: "80px" }, cell: ({ row }) => formatTime(row.original.check_in_time) },
  { accessorKey: "check_out_time", header: "Out", meta: { width: "80px" }, cell: ({ row }) => formatTime(row.original.check_out_time) },
  { accessorKey: "notes", header: "Notes",
    cell: ({ row }) => row.original.notes || <span className="text-muted">—</span> },
];

/** One employee's attendance for a month: summary tiles + day records. */
export function AttendanceHistoryDrawer({ target, onClose }: { target: HistoryTarget; onClose: () => void }) {
  const branch = useBranchStore((s) => s.selectedBranchId);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const years = [now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear()];

  const q = { employee_id: target.id, month, year };
  const monthly = useQuery({
    queryKey: attendanceKeys.monthly(branch, q),
    queryFn: () => attendanceApi.monthly(q),
    placeholderData: keepPreviousData,
  });
  const data = monthly.data?.data;

  return (
    <Drawer
      open
      width="640px"
      title="Attendance history"
      subtitle={`${target.name} · ${target.code}`}
      onClose={onClose}
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} aria-label="Month"
          className="toolbar-control min-w-[130px] cursor-pointer">
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Year"
          className="toolbar-control cursor-pointer">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        {data && <span className="ml-auto text-[13px] font-semibold text-muted">{data.summary.total_days_in_month} days in month</span>}
      </div>

      <div className="mb-5 grid grid-cols-3 gap-2.5 sm:grid-cols-5">
        {SUMMARY_TILES.map((t) => (
          <div key={t.key} className={cn("flex flex-col items-center rounded-xl border px-2 py-3", t.cls)}>
            <span className="text-xl font-extrabold">{data?.summary[t.key] ?? 0}</span>
            <span className="text-[11px] font-semibold text-muted">{t.label}</span>
          </div>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={data?.records ?? []}
        loading={monthly.isLoading}
        fetching={monthly.isFetching}
        emptyIcon="calendar"
        emptyMessage="No attendance this month"
        getRowId={(r) => r.id}
        maxHeightClass="max-h-[calc(100vh-360px)]"
      />
    </Drawer>
  );
}
