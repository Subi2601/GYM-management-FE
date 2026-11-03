import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { ActionGroup, ActionIcon, DataTable } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/Icon";
import { DateRangeFilter, FilterSelect, ListToolbar, type ActiveFilter } from "@/components/ui/ListToolbar";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { buildCollectionReportHtml, escapeHtml } from "@/features/payments/collection-report";
import { paymentApi, usePayments, usePaymentStats } from "@/features/payments/api";
import { PAYMENT_MODE_LABEL } from "@/features/subscriptions/lib/billing";
import { paginationProps, useListState } from "@/hooks/use-list-state";
import { formatDate, formatINR } from "@/lib/format";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { useCan } from "@/stores/auth-store";
import { PAYMENT_MODES, type PaymentMode } from "@/types/enums";
import type { Payment, PaymentListQuery, PaymentSortKey, PaymentStats } from "@/types/payment";

const REPORT_MAX_ROWS = 500;

type BalanceFilter = "" | "with" | "paid";
const BALANCE_OPTIONS = [
  { value: "with", label: "With balance" },
  { value: "paid", label: "Fully paid" },
];
const HAS_BALANCE: Record<BalanceFilter, boolean | undefined> = { "": undefined, with: true, paid: false };

const sortKey = (key: PaymentSortKey) => key;

type ListFilters = Omit<PaymentListQuery, "page" | "page_size">;

/** Accounts & finance: collection KPIs, filterable / sortable payment history, receipt print, collection report. */
export function PaymentsPage() {
  const canStats = useCan("payment:stats");
  const canInvoice = useCan("payment:invoice");
  const list = useListState();
  const [mode, setMode] = useState<PaymentMode | "">("");
  const [balance, setBalance] = useState<BalanceFilter>("");
  const [range, setRange] = useState({ from: "", to: "" });
  const [exporting, setExporting] = useState(false);

  const { setPage } = list;
  // Filter changes restart from page 1.
  useEffect(() => setPage(1), [mode, balance, range, setPage]);

  const filters: ListFilters = {
    search: list.query.search,
    payment_mode: mode || undefined,
    has_balance: HAS_BALANCE[balance],
    date_from: range.from || undefined,
    date_to: range.to || undefined,
    sort_by: list.query.sort_by,
    sort_dir: list.query.sort_dir,
  };
  const payments = usePayments({ ...filters, page: list.page, page_size: list.pageSize });
  const stats = usePaymentStats(canStats);
  const dateRangeInvalid = Boolean(range.from && range.to && range.from > range.to);

  const columns = useMemo<ColumnDef<Payment, unknown>[]>(() => {
    const cols: ColumnDef<Payment, unknown>[] = [
      { accessorKey: "receipt_no", header: "Receipt", meta: { width: "120px", sortKey: sortKey("receipt_no") },
        cell: ({ row }) => <span className="font-mono text-[13px] font-semibold text-secondary-grey">{row.original.receipt_no}</span> },
      { accessorKey: "member_name", header: "Member", meta: { sortKey: sortKey("member_name") },
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate font-semibold text-ink">{row.original.member_name}</div>
            <div className="text-xs text-muted">{row.original.registration_id} · {row.original.member_phone}</div>
          </div>
        ) },
      { id: "plans", header: "Plan(s)", meta: { width: "190px" },
        cell: ({ row }) => (row.original.plan_names.length
          ? row.original.plan_names.join(", ") : <span className="text-muted">—</span>) },
      { accessorKey: "payment_date", header: "Date", meta: { width: "120px", sortKey: sortKey("payment_date") },
        cell: ({ row }) => formatDate(row.original.payment_date) },
      { accessorKey: "payment_mode", header: "Mode", meta: { width: "130px" },
        cell: ({ row }) => <StatusBadge value={row.original.payment_mode} label={PAYMENT_MODE_LABEL[row.original.payment_mode]}
          tone={row.original.payment_mode === "CASH" ? "amber" : "blue"} /> },
      { accessorKey: "paid_amount", header: "Paid", meta: { width: "130px", align: "right", sortKey: sortKey("paid_amount") },
        cell: ({ row }) => <span className="font-semibold text-ink">{formatINR(row.original.paid_amount)}</span> },
      { accessorKey: "balance_amount", header: "Balance", meta: { width: "140px", align: "right", sortKey: sortKey("balance_amount") },
        cell: ({ row }) => {
          const p = row.original;
          if (p.balance_amount <= 0) return <span className="text-muted">{formatINR(0)}</span>;
          return (
            <div className="whitespace-nowrap">
              <div className="font-bold text-danger">{formatINR(p.balance_amount)}</div>
              {p.balance_due_date && <div className="text-xs text-muted">Due {formatDate(p.balance_due_date)}</div>}
            </div>
          );
        } },
    ];
    if (canInvoice) {
      cols.push({
        id: "actions", header: "", meta: { width: "70px" },
        cell: ({ row }) => (
          <ActionGroup>
            <ActionIcon kind="print" title="Print receipt"
              onClick={() => window.open(`/invoice/${row.original.id}`, "_blank")} />
          </ActionGroup>
        ),
      });
    }
    return cols;
  }, [canInvoice]);

  /** Collection report from every row matching the current filters (up to the API's 500-row cap). */
  const exportReport = async () => {
    // Open synchronously so the pop-up isn't blocked, then fill it once the rows arrive.
    const win = window.open("", "_blank");
    if (!win) {
      notify.errorText("Please allow pop-ups to download the report.");
      return;
    }
    win.document.write("<p style=\"font-family:sans-serif;padding:20px\">Preparing report…</p>");
    setExporting(true);
    try {
      const res = await paymentApi.list({ ...filters, page: 1, page_size: REPORT_MAX_ROWS });
      const html = buildCollectionReportHtml({
        rows: res.data.items,
        stats: stats.data,
        filterLabel: describeFilters(filters),
        truncated: res.data.total > res.data.items.length,
      });
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (error) {
      win.document.open();
      win.document.write(`<p style="font-family:sans-serif;padding:20px">${escapeHtml("Could not build the report.")}</p>`);
      win.document.close();
      notify.error(error);
    } finally {
      setExporting(false);
    }
  };

  const active: ActiveFilter[] = [];
  if (mode) active.push({ label: `Mode: ${PAYMENT_MODE_LABEL[mode]}`, onRemove: () => setMode("") });
  if (balance) {
    active.push({ label: `Balance: ${BALANCE_OPTIONS.find((o) => o.value === balance)?.label ?? ""}`, onRemove: () => setBalance("") });
  }
  if (range.from || range.to) {
    active.push({
      label: `Paid: ${range.from ? formatDate(range.from) : "…"} – ${range.to ? formatDate(range.to) : "…"}`,
      onRemove: () => setRange({ from: "", to: "" }),
    });
  }

  const data = payments.data;
  const filtered = !!list.debouncedSearch || active.length > 0;

  return (
    <div>
      <PageHeader title="Accounts & finance" subtitle="Collections, income and payment history" />

      {canStats && <CollectionStats stats={stats.data} loading={stats.isLoading} />}

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        loading={payments.isLoading}
        fetching={payments.isFetching}
        getRowId={(p) => p.id}
        emptyIcon="wallet"
        emptyMessage={payments.isError ? payments.error.message : filtered ? "No payments match these filters" : "No payments yet"}
        emptyHint={filtered ? "Try a different search or clear the filters." : "Payments appear here once members are billed."}
        sorting={list.sorting}
        pagination={paginationProps(list, data?.total)}
        toolbar={
          <ListToolbar
            search={{ value: list.search, onChange: list.setSearch, placeholder: "Search receipt, member, phone or reg ID" }}
            filters={
              <>
                <FilterSelect placeholder="Any mode" ariaLabel="Payment mode" value={mode} className="min-w-[140px]"
                  onChange={(v) => setMode(v as PaymentMode | "")}
                  options={PAYMENT_MODES.map((m) => ({ value: m, label: PAYMENT_MODE_LABEL[m] }))} />
                <FilterSelect placeholder="Any balance" ariaLabel="Balance due" value={balance} className="min-w-[140px]"
                  onChange={(v) => setBalance(v as BalanceFilter)} options={BALANCE_OPTIONS} />
                <DateRangeFilter label="Paid" from={range.from} to={range.to} onChange={(from, to) => setRange({ from, to })} />
                {dateRangeInvalid && (
                  <span className="text-xs font-semibold text-danger">&ldquo;From&rdquo; must be on or before &ldquo;To&rdquo;.</span>
                )}
              </>
            }
            actions={
              <Button variant="secondary" icon={<Icon name="download" className="h-4 w-4" />} loading={exporting} onClick={exportReport}>
                Download report
              </Button>
            }
            active={active}
          />
        }
      />
    </div>
  );
}

function describeFilters(f: ListFilters): string {
  const parts: string[] = [];
  if (f.search) parts.push(`Search: "${f.search}"`);
  if (f.payment_mode) parts.push(`Mode: ${PAYMENT_MODE_LABEL[f.payment_mode]}`);
  if (f.has_balance !== undefined) parts.push(f.has_balance ? "With balance" : "Fully paid");
  if (f.date_from || f.date_to) parts.push(`Period: ${f.date_from ? formatDate(f.date_from) : "…"} to ${f.date_to ? formatDate(f.date_to) : "…"}`);
  return parts.join(" · ");
}

/** KPI row: today's collection (cash / account split), this month, last 12 months, all-time total. */
function CollectionStats({ stats, loading }: { stats: PaymentStats | undefined; loading: boolean }) {
  const v = (n: number | undefined) => (loading || n === undefined ? "…" : formatINR(n, true));
  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Today's collection" value={v(stats?.today)} icon="wallet" tone="success"
        hint={
          <span className="flex items-center gap-3">
            <Split dot="bg-warning" label="Cash" value={v(stats?.today_cash)} />
            <Split dot="bg-info" label="Account" value={v(stats?.today_account)} />
          </span>
        } />
      <StatCard label="This month" value={v(stats?.this_month)} icon="calendar" tone="accent"
        hint={`Last month ${v(stats?.last_month)}`} />
      <StatCard label="Last 12 months" value={v(stats?.last_12_months)} icon="trending" tone="info"
        hint={`Last 6 months ${v(stats?.last_6_months)}`} />
      <StatCard label="Total overall" value={v(stats?.total)} icon="money" tone="neutral" hint="All-time collections" />
    </div>
  );
}

function Split({ dot, label, value }: { dot: string; label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2 w-2 shrink-0 rounded-full", dot)} />
      {label} <strong className="font-bold text-ink">{value}</strong>
    </span>
  );
}
