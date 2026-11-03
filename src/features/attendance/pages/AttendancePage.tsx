import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { ActionGroup, ActionIcon, DataTable, ROW_MARKER } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/Icon";
import { FilterTabs, ListToolbar } from "@/components/ui/ListToolbar";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { attendanceApi, attendanceKeys } from "@/features/attendance/api";
import { AttendanceHistoryDrawer, type HistoryTarget } from "@/features/attendance/components/AttendanceHistoryDrawer";
import { AttendanceMarkModal } from "@/features/attendance/components/AttendanceMarkModal";
import { type SortDir, useDebouncedValue, useUrlEnum } from "@/hooks/use-list-state";
import { formatDate, formatTime, todayISO } from "@/lib/format";
import { notify } from "@/lib/notify";
import { humanize } from "@/lib/utils";
import { useCan } from "@/stores/auth-store";
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

/** Daily attendance — records for a date (status tabs, search, sort), "Pending mark" list, mark / checkout, history. */
export function AttendancePage() {
  const qc = useQueryClient();
  const branch = useBranchStore((s) => s.selectedBranchId);
  const canMark = useCan("attendance:mark");
  const writable = branch !== null && canMark;
  const today = todayISO();
  const [date, setDate] = useState(today);
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
  const isToday = date === today;

  const tabCount = (t: StatusTab): number | undefined =>
    daily.data ? (t === "all" ? records.length : records.filter((r) => r.status === t).length) : undefined;

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

  const columns: ColumnDef<AttendanceRecord, unknown>[] = [
    { accessorKey: "employee_name", header: "Employee", meta: { sortKey: "employee_name" },
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="truncate font-semibold text-ink">{row.original.employee_name}</div>
          <div className="font-mono text-xs text-muted">{row.original.employee_code}</div>
        </div>
      ) },
    { accessorKey: "employee_role", header: "Role", meta: { width: "130px" },
      cell: ({ row }) => humanize(row.original.employee_role) },
    { accessorKey: "status", header: "Status", meta: { width: "120px" },
      cell: ({ row }) => <StatusBadge value={row.original.status} /> },
    { accessorKey: "check_in_time", header: "In", meta: { width: "90px", sortKey: "check_in_time" },
      cell: ({ row }) => formatTime(row.original.check_in_time) },
    { accessorKey: "check_out_time", header: "Out", meta: { width: "90px", sortKey: "check_out_time" },
      cell: ({ row }) => formatTime(row.original.check_out_time) },
    {
      id: "actions", header: "", meta: { width: "160px" },
      cell: ({ row }) => {
        const r = row.original;
        const canCheckout = writable && isToday && !!r.check_in_time && !r.check_out_time;
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
    <div>
      <PageHeader
        title="Attendance"
        subtitle={isToday ? "Who's in today, and who still needs marking" : `Attendance for ${formatDate(date)}`}
        actions={
          <Button variant="secondary" icon={<Icon name="refresh" className="h-4 w-4" />}
            loading={daily.isFetching && !daily.isLoading} onClick={() => void daily.refetch()}>
            Refresh
          </Button>
        }
      />

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
            : writable && notMarked.length > 0 ? "Mark staff from the Pending mark list." : undefined}
          sorting={{
            sortBy,
            sortDir,
            onSortChange: (by, dir) => {
              if (!isSortKey(by)) return;
              setSortBy(by);
              setSortDir(dir);
            },
          }}
          maxHeightClass="max-h-[calc(100vh-330px)]"
          toolbar={
            <>
              <FilterTabs value={tab} onChange={setTab}
                tabs={STATUS_TABS.map((t) => ({ value: t, label: t === "all" ? "All" : humanize(t), count: tabCount(t) }))} />
              <ListToolbar
                search={{ value: search, onChange: setSearch, placeholder: "Search name or employee ID" }}
                filters={
                  <>
                    <input type="date" value={date} max={today} aria-label="Date"
                      onChange={(e) => setDate(e.target.value || today)} className="toolbar-control w-[150px]" />
                    {!isToday && (
                      <button type="button" className="btn-status-action btn-grey" onClick={() => setDate(today)}>Today</button>
                    )}
                  </>
                }
              />
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
          <div className="max-h-[calc(100vh-330px)] overflow-y-auto p-2">
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
    </div>
  );
}
