import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { ActionGroup, ActionIcon, DataTable } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/Icon";
import { FilterTabs, ListToolbar } from "@/components/ui/ListToolbar";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { salaryApi, salaryKeys, type SalaryMonthQuery } from "@/features/salary/api";
import { SalaryDetailsDrawer } from "@/features/salary/components/SalaryDetailsDrawer";
import { SalaryPayModal } from "@/features/salary/components/SalaryPayModal";
import { recentYears } from "@/features/salary/lib/salary";
import { useStaffCounts } from "@/features/staff/api";
import { type SortDir, useDebouncedValue, useUrlEnum } from "@/hooks/use-list-state";
import { formatINR, MONTHS } from "@/lib/format";
import { notify } from "@/lib/notify";
import { humanize } from "@/lib/utils";
import { useCan } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import type { Salary, SalaryCalculateResult } from "@/types/salary";

const STATUS_TABS = ["all", "pending", "paid"] as const;
type StatusTab = (typeof STATUS_TABS)[number];
const TAB_LABEL: Record<StatusTab, string> = { all: "All", pending: "Pending", paid: "Paid" };

/** Client-side sort keys (the month view is not paginated server-side). */
type SortKey = "employee_name" | "base_salary" | "days_present" | "till_now_salary" | "net_salary";
const SORT_VALUE: Record<SortKey, (s: Salary) => string | number> = {
  employee_name: (s) => s.employee_name.toLowerCase(),
  base_salary: (s) => s.base_salary,
  days_present: (s) => s.days_present,
  till_now_salary: (s) => s.till_now_salary,
  net_salary: (s) => s.net_salary,
};
const isSortKey = (k: string): k is SortKey => k in SORT_VALUE;

/** Payroll — month / year payroll with Calculate all, status tabs, search, pay and details. */
export function SalaryPage() {
  const qc = useQueryClient();
  const branch = useBranchStore((s) => s.selectedBranchId);
  const canCalculate = useCan("salary:calculate");
  const canPay = useCan("salary:pay");
  const canListStaff = useCan("employee:list");
  const writable = branch !== null;

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const years = recentYears();
  const [tab, setTab] = useUrlEnum("tab", STATUS_TABS, "all");
  const [search, setSearch] = useState("");
  const term = useDebouncedValue(search.trim().toLowerCase(), 150);
  const [sortBy, setSortBy] = useState<SortKey | undefined>(undefined);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [calcResult, setCalcResult] = useState<SalaryCalculateResult | null>(null);
  const [paying, setPaying] = useState<Salary | null>(null);
  const [details, setDetails] = useState<Salary | null>(null);

  const q: SalaryMonthQuery = { month, year };
  useEffect(() => setCalcResult(null), [month, year, branch]);

  const salaries = useQuery({
    queryKey: salaryKeys.month(branch, q),
    queryFn: () => salaryApi.month(q),
    placeholderData: keepPreviousData,
  });

  // "Total employees" tile — active headcount.
  const staffCounts = useStaffCounts(canListStaff);

  const calculate = useMutation({
    mutationFn: () => salaryApi.calculate({ month, year }),
    onSuccess: async (res) => {
      notify.success(res.message);
      setCalcResult(res.data);
      await qc.invalidateQueries({ queryKey: salaryKeys.all });
    },
    onError: notify.error,
  });

  const data = salaries.data?.data;
  const items = useMemo(() => data?.items ?? [], [data]);
  const pendingCount = items.filter((s) => s.status === "PENDING").length;
  const tabCount: Record<StatusTab, number | undefined> = data
    ? { all: items.length, pending: pendingCount, paid: items.length - pendingCount }
    : { all: undefined, pending: undefined, paid: undefined };

  const rows = useMemo(() => {
    const filtered = items.filter((s) =>
      (tab === "all" || s.status === (tab === "paid" ? "PAID" : "PENDING"))
      && (!term || s.employee_name.toLowerCase().includes(term) || s.employee_code.toLowerCase().includes(term)));
    if (!sortBy) return filtered;
    const value = SORT_VALUE[sortBy];
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      return (va < vb ? -1 : va > vb ? 1 : 0) * dir;
    });
  }, [items, tab, term, sortBy, sortDir]);

  const columns = useMemo<ColumnDef<Salary, unknown>[]>(() => [
    { accessorKey: "employee_name", header: "Employee", meta: { sortKey: "employee_name" },
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="truncate font-semibold text-ink">{row.original.employee_name}</div>
          <div className="font-mono text-xs text-muted">{row.original.employee_code}</div>
        </div>
      ) },
    { accessorKey: "employee_role", header: "Role", meta: { width: "130px" },
      cell: ({ row }) => humanize(row.original.employee_role) },
    { accessorKey: "base_salary", header: "Base", meta: { width: "120px", align: "right", sortKey: "base_salary" },
      cell: ({ row }) => formatINR(row.original.base_salary) },
    { accessorKey: "days_present", header: "Present", meta: { width: "100px", align: "center", sortKey: "days_present" },
      cell: ({ row }) => (
        <span className="font-semibold">
          {row.original.days_present}
          {row.original.days_absent > 0 && <span className="ml-1 text-xs font-medium text-danger">/ {row.original.days_absent} abs</span>}
        </span>
      ) },
    { accessorKey: "till_now_salary", header: "Till now", meta: { width: "130px", align: "right", sortKey: "till_now_salary" },
      cell: ({ row }) => formatINR(row.original.till_now_salary) },
    { accessorKey: "net_salary", header: "Net payable", meta: { width: "140px", align: "right", sortKey: "net_salary" },
      cell: ({ row }) => <span className="font-bold">{formatINR(row.original.net_salary)}</span> },
    { accessorKey: "status", header: "Status", meta: { width: "110px" },
      cell: ({ row }) => <StatusBadge value={row.original.status} /> },
    {
      id: "actions", header: "Actions", meta: { width: "130px" },
      cell: ({ row }) => {
        const s = row.original;
        return (
          <ActionGroup>
            {s.status === "PENDING" && canPay && writable && (
              <button type="button" className="btn-status-action btn-green" onClick={() => setPaying(s)}>Pay</button>
            )}
            <ActionIcon kind="view" title="View details" onClick={() => setDetails(s)} />
          </ActionGroup>
        );
      },
    },
  ], [canPay, writable]);

  const filtered = !!term || tab !== "all";

  return (
    <div>
      <PageHeader
        title="Payroll"
        subtitle={`Salaries for ${MONTHS[month - 1] ?? ""} ${year}`}
        actions={canCalculate && writable && (
          <Button loading={calculate.isPending} icon={<Icon name="refresh" className="h-4 w-4" />}
            onClick={() => calculate.mutate()}>
            Calculate all
          </Button>
        )}
      />

      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Total employees" icon="users" tone="neutral"
          value={canListStaff ? staffCounts.data?.active ?? "—" : "—"} hint="Active staff in this branch" />
        <StatCard label="Calculated this month" icon="clipboard" tone="info" value={items.length}
          hint={data ? `${pendingCount} pending · ${items.length - pendingCount} paid` : undefined} />
        <StatCard label="Total net payout" icon="wallet" tone="success" value={formatINR(data?.total_payout ?? 0)} />
      </div>

      {calcResult && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-info-line bg-info-soft px-5 py-3 text-sm font-semibold text-info">
          <span>Payroll {calcResult.month_year}:</span>
          <StatusBadge value="PAID" tone="green" label={`${calcResult.calculated} calculated`} />
          <StatusBadge value="SKIPPED" tone="grey" label={`${calcResult.skipped_paid} skipped (already paid)`} />
          <button type="button" onClick={() => setCalcResult(null)} aria-label="Dismiss"
            className="ml-auto flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-muted hover:bg-hover hover:text-ink">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={rows}
        loading={salaries.isLoading}
        fetching={salaries.isFetching}
        getRowId={(s) => s.id}
        onRowClick={setDetails}
        emptyIcon="wallet"
        emptyMessage={filtered && items.length > 0 ? "No salaries match these filters" : "No salary records for this period"}
        emptyHint={filtered && items.length > 0 ? "Try a different search or tab."
          : canCalculate && writable ? "Click Calculate all to generate this month's payroll." : undefined}
        sorting={{
          sortBy,
          sortDir,
          onSortChange: (by, dir) => {
            if (!isSortKey(by)) return;
            setSortBy(by);
            setSortDir(dir);
          },
        }}
        toolbar={
          <>
            <FilterTabs value={tab} onChange={setTab}
              tabs={STATUS_TABS.map((t) => ({ value: t, label: TAB_LABEL[t], count: tabCount[t] }))} />
            <ListToolbar
              search={{ value: search, onChange: setSearch, placeholder: "Search name or employee ID" }}
              filters={
                <>
                  <select value={month} onChange={(e) => setMonth(Number(e.target.value))} aria-label="Month"
                    className="toolbar-control min-w-[130px] cursor-pointer">
                    {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                  <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Year"
                    className="toolbar-control cursor-pointer">
                    {years.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </>
              }
            />
          </>
        }
      />

      {paying && <SalaryPayModal salary={paying} onClose={() => setPaying(null)} />}
      {details && <SalaryDetailsDrawer salary={details} onClose={() => setDetails(null)} />}
    </div>
  );
}
