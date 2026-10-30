import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { ActionGroup, ActionIcon, DataTable } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { buildCollectionReportHtml, escapeHtml } from "@/features/payments/collection-report";
import { paymentApi, usePayments, usePaymentStats } from "@/features/payments/api";
import { useListState } from "@/hooks/use-list-state";
import { formatDate, formatINR } from "@/lib/format";
import { notify } from "@/lib/notify";
import { cn, humanize } from "@/lib/utils";
import { useCan } from "@/stores/auth-store";
import { PAYMENT_MODES, type PaymentMode } from "@/types/enums";
import type { Payment, PaymentListQuery, PaymentStats } from "@/types/payment";

const REPORT_MAX_ROWS = 500;

/** Accounts & Finance: collection stats, payment history, receipt print, collection report. */
export function PaymentsPage() {
  const canStats = useCan("payment:stats");
  const canInvoice = useCan("payment:invoice");
  const list = useListState();
  const [mode, setMode] = useState<PaymentMode | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exporting, setExporting] = useState(false);

  const filters: Omit<PaymentListQuery, "page" | "page_size"> = {
    search: list.debouncedSearch || undefined,
    payment_mode: mode || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  };
  const payments = usePayments({ ...filters, page: list.page, page_size: list.pageSize });
  const stats = usePaymentStats(canStats);

  const setFilter = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value);
    list.setPage(1);
  };
  const hasFilters = Boolean(mode || dateFrom || dateTo);
  const dateRangeInvalid = Boolean(dateFrom && dateTo && dateFrom > dateTo);

  const columns = useMemo<ColumnDef<Payment, unknown>[]>(() => {
    const cols: ColumnDef<Payment, unknown>[] = [
      { accessorKey: "receipt_no", header: "Receipt", meta: { width: "110px" },
        cell: ({ row }) => <span className="font-bold text-ink">{row.original.receipt_no}</span> },
      { accessorKey: "registration_id", header: "Reg ID", meta: { width: "100px" } },
      { accessorKey: "member_name", header: "Member Name", meta: { width: "200px" },
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-semibold text-ink">{row.original.member_name}</span>
            <span className="text-xs text-muted">{row.original.member_phone}</span>
          </div>
        ) },
      { id: "plans", header: "Plan(s)", meta: { width: "180px" },
        cell: ({ row }) => (row.original.plan_names.length ? row.original.plan_names.join(", ") : "—") },
      { accessorKey: "paid_amount", header: "Paid (₹)", meta: { width: "120px", align: "right" },
        cell: ({ row }) => <span className="font-semibold">{formatINR(row.original.paid_amount)}</span> },
      { accessorKey: "balance_amount", header: "Balance (₹)", meta: { width: "120px", align: "right" },
        cell: ({ row }) => (
          <span className={cn(row.original.balance_amount > 0 ? "font-bold text-accent" : "text-muted")}>
            {formatINR(row.original.balance_amount)}
          </span>
        ) },
      { accessorKey: "payment_mode", header: "Mode", meta: { width: "120px" },
        cell: ({ row }) => <StatusBadge value={row.original.payment_mode}
          tone={row.original.payment_mode === "CASH" ? "amber" : "blue"} /> },
      { accessorKey: "payment_date", header: "Date", meta: { width: "120px" },
        cell: ({ row }) => formatDate(row.original.payment_date) },
    ];
    if (canInvoice) {
      cols.push({
        id: "actions", header: "Actions", meta: { width: "90px" },
        cell: ({ row }) => (
          <ActionGroup>
            <ActionIcon kind="print" title="Print Receipt"
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

  const data = payments.data;

  return (
    <div>
      <PageHeader
        title="Accounts & Finance"
        subtitle="Track collections, income, and payment history"
        search={{ value: list.search, onChange: list.setSearch, placeholder: "Search receipt, reg id, member..." }}
        actions={
          <Button variant="secondary" icon={<Icon name="download" />} loading={exporting} onClick={exportReport}>
            Download Report
          </Button>
        }
      />

      {canStats && <CollectionStats stats={stats.data} loading={stats.isLoading} />}

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-end gap-3">
        <FilterField label="Mode">
          <select value={mode} onChange={(e) => setFilter(setMode)(e.target.value as PaymentMode | "")}
            className="form-control h-[42px] w-[170px] py-0">
            <option value="">All Modes</option>
            {PAYMENT_MODES.map((m) => <option key={m} value={m}>{humanize(m)}</option>)}
          </select>
        </FilterField>
        <FilterField label="From">
          <input type="date" value={dateFrom} max={dateTo || undefined}
            onChange={(e) => setFilter(setDateFrom)(e.target.value)}
            className={cn("form-control h-[42px] w-[170px] py-0", dateRangeInvalid && "invalid")} />
        </FilterField>
        <FilterField label="To">
          <input type="date" value={dateTo} min={dateFrom || undefined}
            onChange={(e) => setFilter(setDateTo)(e.target.value)}
            className={cn("form-control h-[42px] w-[170px] py-0", dateRangeInvalid && "invalid")} />
        </FilterField>
        {hasFilters && (
          <button type="button" className="btn-status-action btn-grey h-[42px]"
            onClick={() => { setMode(""); setDateFrom(""); setDateTo(""); list.setPage(1); }}>
            Clear Filters
          </button>
        )}
        {dateRangeInvalid && <span className="pb-3 text-xs font-semibold text-accent">"From" must be on or before "To".</span>}
      </div>

      <div className="mt-4">
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          loading={payments.isLoading}
          emptyMessage={payments.isError ? payments.error.message : "No payment records found."}
          getRowId={(p) => p.id}
          maxHeightClass="max-h-[calc(100vh-420px)] min-h-[260px]"
          pagination={data ? {
            page: list.page, pageSize: list.pageSize, total: data.total,
            onPageChange: list.setPage, onPageSizeChange: list.setPageSize,
          } : undefined}
        />
      </div>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="form-label">{label}</span>
      {children}
    </label>
  );
}

function describeFilters(f: Omit<PaymentListQuery, "page" | "page_size">): string {
  const parts: string[] = [];
  if (f.search) parts.push(`Search: "${f.search}"`);
  if (f.payment_mode) parts.push(`Mode: ${humanize(f.payment_mode)}`);
  if (f.date_from || f.date_to) parts.push(`Period: ${f.date_from ? formatDate(f.date_from) : "…"} to ${f.date_to ? formatDate(f.date_to) : "…"}`);
  return parts.join(" · ");
}

/** ".collection-stats-grid": dark "today" card with cash/account split + period mini cards. */
function CollectionStats({ stats, loading }: { stats: PaymentStats | undefined; loading: boolean }) {
  const v = (n: number | undefined) => (loading || n === undefined ? "…" : formatINR(n, true));
  return (
    <div className="mt-6 grid grid-cols-[1fr_2fr] gap-6 max-lg:grid-cols-1">
      <div className="flex flex-col rounded-2xl bg-gradient-to-br from-primary-grey to-[#334155] p-8 text-white shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1)]">
        <div className="mb-2 text-sm font-semibold uppercase tracking-[0.05em] opacity-80">Today&apos;s Total Collection</div>
        <div className="mb-6 text-4xl font-extrabold text-success">{v(stats?.today)}</div>
        <div className="flex flex-wrap gap-6 border-t border-white/10 pt-6">
          <div className="flex items-center gap-2.5 text-sm">
            <span className="h-2 w-2 rounded-full bg-[#fbbf24]" />
            Cash: <strong className="text-base">{v(stats?.today_cash)}</strong>
          </div>
          <div className="flex items-center gap-2.5 text-sm">
            <span className="h-2 w-2 rounded-full bg-info" />
            Account: <strong className="text-base">{v(stats?.today_account)}</strong>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <MiniStat label="This Month" value={v(stats?.this_month)} />
        <MiniStat label="Last Month" value={v(stats?.last_month)} />
        <MiniStat label="Last 6 Months" value={v(stats?.last_6_months)} />
        <MiniStat label="Last 1 Year" value={v(stats?.last_12_months)} />
        <MiniStat label="Total Overall" value={v(stats?.total)} highlight className="col-span-2 max-md:col-span-1" />
      </div>
    </div>
  );
}

function MiniStat({ label, value, highlight = false, className }:
  { label: string; value: string; highlight?: boolean; className?: string }) {
  return (
    <div className={cn(
      "flex flex-col justify-center rounded-xl border-[1.5px] px-5 py-4 transition-all duration-200 hover:border-secondary-grey",
      highlight ? "border-primary-grey bg-subtle" : "border-line bg-surface",
      className,
    )}>
      <span className="mb-1 text-xs font-bold uppercase text-muted">{label}</span>
      <span className={cn("text-xl font-extrabold", highlight ? "text-accent" : "text-ink")}>{value}</span>
    </div>
  );
}
