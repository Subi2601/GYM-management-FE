import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { ActionGroup, DataTable } from "@/components/ui/DataTable";
import { Field, Select, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { attendanceApi, attendanceKeys } from "@/features/attendance/api";
import { formatDate, formatTime, MONTHS, todayISO } from "@/lib/format";
import { notify } from "@/lib/notify";
import { cn, humanize } from "@/lib/utils";
import { useCan } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import type { AttendanceRecord, UnmarkedEmployee } from "@/types/attendance";
import { ATTENDANCE_STATUSES, type AttendanceStatus } from "@/types/enums";

/** Left-edge markers from the original attendance.css. */
const STATUS_MARKER: Partial<Record<AttendanceStatus, string>> = {
  PRESENT: "[&>td:first-child]:border-l-4 [&>td:first-child]:border-l-success",
  LATE: "[&>td:first-child]:border-l-4 [&>td:first-child]:border-l-warning",
  ABSENT: "[&>td:first-child]:border-l-4 [&>td:first-child]:border-l-accent",
  HALF_DAY: "[&>td:first-child]:border-l-4 [&>td:first-child]:border-l-info",
};

/** Strips DataTable's own card chrome when it sits inside a titled card. */
const EMBEDDED_TABLE = "[&>div]:rounded-none [&>div]:border-0 [&>div]:shadow-none";

interface HistoryTarget {
  id: string;
  name: string;
}

/** Daily Attendance — records for a date, "Pending Mark" list, mark / checkout, monthly history. */
export function AttendancePage() {
  const qc = useQueryClient();
  const branch = useBranchStore((s) => s.selectedBranchId);
  const canMark = useCan("attendance:mark");
  const writable = branch !== null && canMark;
  const today = todayISO();
  const [date, setDate] = useState(today);
  const [marking, setMarking] = useState<UnmarkedEmployee | null>(null);
  const [history, setHistory] = useState<HistoryTarget | null>(null);

  const daily = useQuery({
    queryKey: attendanceKeys.daily(branch, date),
    queryFn: () => attendanceApi.daily(date),
  });

  const checkout = useMutation({
    mutationFn: (employeeId: string) => attendanceApi.checkout(employeeId),
    onSuccess: async (res) => {
      notify.success(res.message);
      await qc.invalidateQueries({ queryKey: attendanceKeys.all });
    },
    onError: notify.error,
  });

  const records = daily.data?.data.records ?? [];
  const notMarked = daily.data?.data.not_marked ?? [];
  const isToday = date === today;

  const columns: ColumnDef<AttendanceRecord, unknown>[] = [
    {
      header: "Employee", accessorKey: "employee_name",
      cell: ({ row }) => <span className="font-semibold">{row.original.employee_name}</span>,
    },
    { header: "Code", accessorKey: "employee_code", meta: { width: "120px" } },
    { header: "Role", accessorKey: "employee_role", meta: { width: "130px" }, cell: ({ row }) => humanize(row.original.employee_role) },
    {
      header: "Status", accessorKey: "status", meta: { width: "120px" },
      cell: ({ row }) => <StatusBadge value={row.original.status} />,
    },
    { header: "In", accessorKey: "check_in_time", meta: { width: "90px" }, cell: ({ row }) => formatTime(row.original.check_in_time) },
    { header: "Out", accessorKey: "check_out_time", meta: { width: "90px" }, cell: ({ row }) => formatTime(row.original.check_out_time) },
    {
      id: "actions", header: "Actions", meta: { width: "170px" },
      cell: ({ row }) => {
        const r = row.original;
        const canCheckout = writable && isToday && !!r.check_in_time && !r.check_out_time;
        return (
          <ActionGroup>
            {canCheckout && (
              <button type="button" className="btn-status-action btn-green disabled:opacity-50"
                disabled={checkout.isPending && checkout.variables === r.employee_id}
                onClick={() => checkout.mutate(r.employee_id)}>
                {checkout.isPending && checkout.variables === r.employee_id ? "Checking out…" : "Checkout"}
              </button>
            )}
            <button type="button" className="action-icon" title="View History"
              onClick={() => setHistory({ id: r.employee_id, name: r.employee_name })}>
              <Icon name="clock" className="h-4 w-4" />
            </button>
          </ActionGroup>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Daily Attendance"
        actions={
          <>
            <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)}
              className="h-[42px] rounded-lg border border-line bg-surface px-3 text-[13px] font-semibold text-ink outline-none focus:border-secondary-grey" />
            <Button variant="secondary" icon={<Icon name="refresh" className="h-4 w-4" />}
              loading={daily.isFetching && !daily.isLoading} onClick={() => void daily.refetch()}>
              Refresh
            </Button>
          </>
        }
      />

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
        <div className="table-container-card overflow-hidden">
          <CardHeader>{isToday ? "Who's In Today" : `Attendance — ${formatDate(date)}`}</CardHeader>
          <div className={EMBEDDED_TABLE}>
            <DataTable
              columns={columns}
              data={records}
              loading={daily.isLoading}
              emptyMessage="No attendance marked for this date."
              rowClassName={(r) => STATUS_MARKER[r.status]}
              getRowId={(r) => r.id}
              maxHeightClass="max-h-[calc(100vh-300px)]"
            />
          </div>
        </div>

        <div className="flex flex-col gap-5 max-lg:order-first">
          <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
            <CardHeader>
              Pending Mark
              {notMarked.length > 0 && (
                <span className="ml-2 rounded-full bg-accent-light px-2 py-0.5 text-[11px] text-accent">{notMarked.length}</span>
              )}
            </CardHeader>
            <div className="max-h-[calc(100vh-350px)] overflow-y-auto p-2">
              {daily.isLoading && <div className="p-5 text-center text-[13px] text-muted">Loading…</div>}
              {!daily.isLoading && notMarked.length === 0 && (
                <div className="p-5 text-center text-[13px] italic text-muted">All staff accounted for!</div>
              )}
              {notMarked.map((emp) => (
                <div key={emp.id} className="flex items-center justify-between rounded-lg p-3 transition-all hover:bg-hover">
                  <div className="flex flex-col">
                    <span className="text-[13px] font-bold text-ink">{emp.name}</span>
                    <span className="text-[11px] text-muted">{emp.employee_code} · {humanize(emp.role)}</span>
                  </div>
                  {writable && (
                    <button type="button" onClick={() => setMarking(emp)}
                      className="rounded-md border-none bg-accent-light px-3 py-1.5 text-[11px] font-extrabold uppercase text-accent transition-colors hover:bg-accent hover:text-white">
                      Mark
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <MarkModal employee={marking} date={date} onClose={() => setMarking(null)} />
      <HistoryModal target={history} onClose={() => setHistory(null)} />
    </div>
  );
}

function CardHeader({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center border-b border-line-light px-5 py-4 text-sm font-extrabold uppercase tracking-[0.05em] text-ink">
      {children}
    </div>
  );
}

const markSchema = z.object({
  status: z.enum(ATTENDANCE_STATUSES),
  notes: z.string().trim().max(300, "Max 300 characters"),
});
type MarkValues = z.infer<typeof markSchema>;

function MarkModal({ employee, date, onClose }: { employee: UnmarkedEmployee | null; date: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<MarkValues>({
    resolver: zodResolver(markSchema),
    defaultValues: { status: "PRESENT", notes: "" },
  });

  useEffect(() => {
    if (employee) reset({ status: "PRESENT", notes: "" });
  }, [employee, reset]);

  const mark = useMutation({
    mutationFn: (v: MarkValues) => attendanceApi.mark({
      employee_id: employee?.id ?? "", status: v.status, notes: v.notes.trim() || null, date,
    }),
    onSuccess: async (res) => {
      notify.success(res.message);
      await qc.invalidateQueries({ queryKey: attendanceKeys.all });
      onClose();
    },
    onError: notify.error,
  });

  return (
    <Modal open={!!employee} title={`Mark Attendance: ${employee?.name ?? ""}`} onClose={onClose} width="560px">
      <form onSubmit={handleSubmit((v) => mark.mutate(v))} noValidate className="flex flex-col gap-5 p-2">
        <p className="m-0 text-[13px] font-medium text-muted">Date: <strong className="text-ink">{formatDate(date)}</strong></p>
        <Field label="Status" htmlFor="att-status" error={errors.status?.message}>
          <Select id="att-status" {...register("status")}>
            {ATTENDANCE_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
          </Select>
        </Field>
        <Field label="Notes" htmlFor="att-notes" error={errors.notes?.message}>
          <Textarea id="att-notes" rows={3} placeholder="Any comments..." className="min-h-[100px]"
            invalid={!!errors.notes} {...register("notes")} />
        </Field>
        <div className="form-actions-modern mt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mark.isPending}>Submit</Button>
        </div>
      </form>
    </Modal>
  );
}

const SUMMARY_TILES = [
  { key: "present", label: "Present", cls: "bg-success-soft border-success-line text-success" },
  { key: "absent", label: "Absent", cls: "bg-danger-soft border-danger-line text-danger" },
  { key: "late", label: "Late", cls: "bg-warning-soft border-warning-line text-warning" },
  { key: "half_day", label: "Half Day", cls: "bg-info-soft border-info-line text-info" },
  { key: "on_leave", label: "On Leave", cls: "bg-plum-soft border-plum-line text-plum" },
] as const;

const historyColumns: ColumnDef<AttendanceRecord, unknown>[] = [
  { header: "Date", accessorKey: "attendance_date", meta: { width: "130px" }, cell: ({ row }) => formatDate(row.original.attendance_date) },
  { header: "Status", accessorKey: "status", meta: { width: "120px" }, cell: ({ row }) => <StatusBadge value={row.original.status} /> },
  { header: "In", accessorKey: "check_in_time", meta: { width: "90px" }, cell: ({ row }) => formatTime(row.original.check_in_time) },
  { header: "Out", accessorKey: "check_out_time", meta: { width: "90px" }, cell: ({ row }) => formatTime(row.original.check_out_time) },
  { header: "Notes", accessorKey: "notes", cell: ({ row }) => row.original.notes || "—" },
];

const selectCls = "rounded-lg border-[1.5px] border-line bg-surface px-3.5 py-2.5 text-sm font-semibold text-ink outline-none cursor-pointer focus:border-secondary-grey";

function HistoryModal({ target, onClose }: { target: HistoryTarget | null; onClose: () => void }) {
  const branch = useBranchStore((s) => s.selectedBranchId);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const years = [now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear()];

  // Reset to the current month whenever a different employee is opened.
  const targetId = target?.id;
  useEffect(() => {
    if (!targetId) return;
    const d = new Date();
    setMonth(d.getMonth() + 1);
    setYear(d.getFullYear());
  }, [targetId]);

  const q = { employee_id: target?.id ?? "", month, year };
  const monthly = useQuery({
    queryKey: attendanceKeys.monthly(branch, q),
    queryFn: () => attendanceApi.monthly(q),
    enabled: !!target,
  });
  const data = monthly.data?.data;

  return (
    <Modal open={!!target} title={`Monthly History: ${target?.name ?? ""}`} onClose={onClose}>
      <div className="p-2.5">
        <div className="mb-5 flex flex-wrap items-center gap-2.5">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={selectCls}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={selectCls}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          {data && <span className="ml-auto text-[13px] font-semibold text-muted">{data.summary.total_days_in_month} days in month</span>}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {SUMMARY_TILES.map((t) => (
            <div key={t.key} className={cn("flex flex-col items-center rounded-xl border p-4", t.cls)}>
              <span className="mb-1 text-xl font-extrabold">{data?.summary[t.key] ?? 0}</span>
              <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-muted">{t.label}</span>
            </div>
          ))}
        </div>

        <div className="mt-5">
          <DataTable
            columns={historyColumns}
            data={data?.records ?? []}
            loading={monthly.isLoading}
            emptyMessage="No history found for this month."
            getRowId={(r) => r.id}
            maxHeightClass="max-h-[350px]"
          />
        </div>
      </div>
    </Modal>
  );
}
