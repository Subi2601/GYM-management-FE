import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { ActionGroup, ActionIcon, DataTable, ROW_MARKER } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/Icon";
import { FilterTabs, ListToolbar } from "@/components/ui/ListToolbar";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { attendanceApi, attendanceKeys, formatClock, formatDuration } from "@/features/attendance/api";
import { AttendanceHistoryDrawer, type HistoryTarget } from "@/features/attendance/components/AttendanceHistoryDrawer";
import { AttendanceMarkModal } from "@/features/attendance/components/AttendanceMarkModal";
import { InsideBadge, SourceBadge } from "@/features/attendance/components/SourceBadge";
import { type SortDir, useDebouncedValue, useUrlEnum } from "@/hooks/use-list-state";
import { formatDate } from "@/lib/format";
import { notify } from "@/lib/notify";
import { humanize } from "@/lib/utils";
import { useBranchStore } from "@/stores/branch-store";
import type { AttendanceRecord, UnmarkedEmployee } from "@/types/attendance";
import { ATTENDANCE_STATUSES, type AttendanceStatus } from "@/types/enums";

const STATUS_TABS = ["all", ...ATTENDANCE_STATUSES] as const;
type StatusTab = (typeof STATUS_TABS)[number];

/** Left-edge markers from the original attendance.css. */
const STATUS_MARKER: Partial<Record<AttendanceStatus, string>> = {
  PRESENT: ROW_MARKER.joined,
  LATE: ROW_MARKER.nearExpiry,
  ABSENT: ROW_MARKER.rejected,
  HALF_DAY: ROW_MARKER.new,
};

/** Client-side sort keys (the daily view is not paginated server-side). */
type SortKey = "employee_name" | "check_in_time" | "check_out_time";
const isSortKey = (k: string): k is SortKey =>
  k === "employee_name" || k === "check_in_time" || k === "check_out_time";

interface Props {
  date: string;
  isToday: boolean;
  writable: boolean;
}

/** Staff tab: KPI tiles, the day's records (status tabs, search, sort) and the "Pending mark" list. */
export function StaffAttendance({ date, isToday, writable }: Props) {
  const qc = useQueryClient();
  const branch = useBranchStore((s) => s.selectedBranchId);
  const [tab, setTab] = useUrlEnum<StatusTab>("tab", STATUS_TABS, "all");
  const [search, setSearch] = useState("");
  const term = useDebouncedValue(search.trim().toLowerCase(), 150);
  const [sortBy, setSortBy] = useState<SortKey | undefined>(undefined);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [marking, setMarking] = useState<UnmarkedEmployee | null>(null);
  const [history, setHistory] = useState<HistoryTarget | null>(null);

  const daily = useQuery({
    queryKey: attendanceKeys.daily(branch, date),
    queryFn: () => attendanceApi.daily(date),
    placeholderData: keepPreviousData,
    refetchInterval: isToday ? 30_000 : false,   // QR scans land without anyone touching this screen
  });

  const checkout = useMutation({
    mutationFn: (employeeId: string) => attendanceApi.checkout(employeeId),
    onSuccess: async (res) => {
      notify.success(res.message);
      await qc.invalidateQueries({ queryKey: attendanceKeys.all });
    },
    onError: notify.error,
  });

  const records = useMemo(() => daily.data?.data.records ?? [], [daily.data]);
  const notMarked = daily.data?.data.not_marked ?? [];
  const loaded = !!daily.data;

  const tabCount = (t: StatusTab): number | undefined =>
    loaded ? (t === "all" ? records.length : records.filter((r) => r.status === t).length) : undefined;

  const rows = useMemo(() => {
    const filtered = records.filter((r) =>
      (tab === "all" || r.status === tab)
      && (!term || r.employee_name.toLowerCase().includes(term) || r.employee_code.toLowerCase().includes(term)));
    if (!sortBy) return filtered;
    const dir = sortDir === "asc" ? 1 : -1;
    const value = (r: AttendanceRecord) => (sortBy === "employee_name" ? r.employee_name.toLowerCase() : r[sortBy] ?? "");
    return [...filtered].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      return (va < vb ? -1 : va > vb ? 1 : 0) * dir;
    });
  }, [records, tab, term, sortBy, sortDir]);

  const stat = (n: number) => (loaded ? n : undefined);
  const present = records.filter((r) => r.status === "PRESENT" || r.status === "LATE" || r.status === "HALF_DAY").length;

  const columns: ColumnDef<AttendanceRecord, unknown>[] = [
    { accessorKey: "employee_name", header: "Employee", meta: { sortKey: "employee_name" },
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="truncate font-semibold text-ink">{row.original.employee_name}</div>
          <div className="font-mono text-xs text-muted">{row.original.employee_code} · {humanize(row.original.employee_role)}</div>
        </div>
      ) },
    { accessorKey: "status", header: "Status", meta: { width: "110px" },
      cell: ({ row }) => <StatusBadge value={row.original.status} /> },
    { accessorKey: "check_in_time", header: "In", meta: { width: "95px", sortKey: "check_in_time" },
      cell: ({ row }) => formatClock(row.original.check_in_time) },
    { accessorKey: "check_out_time", header: "Out", meta: { width: "95px", sortKey: "check_out_time" },
      cell: ({ row }) => (row.original.inside ? <InsideBadge /> : formatClock(row.original.check_out_time)) },
    { id: "worked", header: "Time in gym", meta: { width: "120px" },
      cell: ({ row }) => {
        const r = row.original;
        if (r.visits === 0) return <span className="text-muted">—</span>;
        return (
          <div>
            <div className="text-ink">{formatDuration(r.worked_minutes)}</div>
            {r.visits > 1 && <div className="text-xs text-muted">{r.visits} visits</div>}
          </div>
        );
      } },
    { id: "source", header: "Source", meta: { width: "90px" }, cell: ({ row }) => <SourceBadge source={row.original.source} /> },
    {
      id: "actions", header: "Actions", meta: { width: "150px" },
      cell: ({ row }) => {
        const r = row.original;
        const canCheckout = writable && isToday && !!r.check_in_time && (r.inside || (r.visits === 0 && !r.check_out_time));
        return (
          <ActionGroup>
            {canCheckout && (
              <Button variant="secondary" className="h-8 px-3 py-0 text-xs"
                loading={checkout.isPending && checkout.variables === r.employee_id}
                disabled={checkout.isPending}
                onClick={() => checkout.mutate(r.employee_id)}>
                Checkout
              </Button>
            )}
            <ActionIcon kind="view" title="View history"
              onClick={() => setHistory({ id: r.employee_id, name: r.employee_name, code: r.employee_code })} />
          </ActionGroup>
        );
      },
    },
  ];

  const filtered = !!term || tab !== "all";

  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Inside now" value={stat(records.filter((r) => r.inside).length)} icon="logIn" tone="success"
          hint={isToday ? "Checked in, not out yet" : "At the end of the day"} />
        <StatCard label="Present" value={stat(present)} icon="userCheck" tone="info" hint="Present, late or half day" />
        <StatCard label="Late" value={stat(records.filter((r) => r.status === "LATE").length)} icon="clock" tone="warning"
          hint="10+ min after shift start" />
        <StatCard label="Pending mark" value={stat(notMarked.length)} icon="alert" tone="accent" hint="No attendance yet" />
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1fr_300px]">
        <DataTable
          columns={columns}
          data={rows}
          loading={daily.isLoading}
          fetching={daily.isFetching}
          getRowId={(r) => r.id}
          rowClassName={(r) => STATUS_MARKER[r.status]}
          emptyIcon="calendar"
          emptyMessage={filtered && records.length > 0 ? "No records match these filters" : "No attendance marked for this date"}
          emptyHint={filtered && records.length > 0 ? "Try a different search or tab."
            : writable && notMarked.length > 0 ? "Staff appear here when they scan the QR or you mark them." : undefined}
          sorting={{
            sortBy,
            sortDir,
            onSortChange: (by, dir) => {
              if (!isSortKey(by)) return;
              setSortBy(by);
              setSortDir(dir);
            },
          }}
          maxHeightClass="max-h-[calc(100vh-420px)]"
          toolbar={
            <>
              <FilterTabs value={tab} onChange={setTab}
                tabs={STATUS_TABS.map((t) => ({ value: t, label: t === "all" ? "All" : humanize(t), count: tabCount(t) }))} />
              <ListToolbar search={{ value: search, onChange: setSearch, placeholder: "Search name or employee ID" }} />
            </>
          }
        />

        <aside className="overflow-hidden rounded-2xl border border-line bg-surface shadow-premium max-lg:order-first">
          <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <h3 className="m-0 text-[15px] font-bold text-ink">Pending mark</h3>
              <p className="m-0 mt-0.5 text-xs text-muted">{formatDate(date)}</p>
            </div>
            {notMarked.length > 0 && <span className="tab-count">{notMarked.length}</span>}
          </header>
          <div className="max-h-[calc(100vh-420px)] overflow-y-auto p-2">
            {daily.isLoading && <p className="m-0 p-5 text-center text-[13px] text-muted">Loading…</p>}
            {!daily.isLoading && notMarked.length === 0 && (
              <div className="flex flex-col items-center gap-2 p-6 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-soft text-success">
                  <Icon name="check" className="h-5 w-5" />
                </span>
                <span className="text-[13px] font-semibold text-muted">All staff accounted for</span>
              </div>
            )}
            {notMarked.map((emp) => (
              <div key={emp.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-hover">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold text-ink">{emp.name}</div>
                  <div className="text-xs text-muted">{emp.employee_code} · {humanize(emp.role)}</div>
                </div>
                {writable && (
                  <button type="button" className="btn-status-action btn-red" onClick={() => setMarking(emp)}>Mark</button>
                )}
              </div>
            ))}
          </div>
        </aside>
      </div>

      {marking && <AttendanceMarkModal employee={marking} date={date} onClose={() => setMarking(null)} />}
      {history && <AttendanceHistoryDrawer target={history} onClose={() => setHistory(null)} />}
    </>
  );
}
