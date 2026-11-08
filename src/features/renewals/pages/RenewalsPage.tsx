import { useMutation } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { ActionGroup, DataTable, ROW_MARKER } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/Icon";
import { FilterSelect, FilterTabs, ListToolbar } from "@/components/ui/ListToolbar";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { relativeDays } from "@/features/leads/lead-meta";
import { RENEWAL_TABS, type RenewalRow, type RenewalTab, renewalApi, sendRenewalReminder, useInvalidateRenewals,
  useRenewalCounts, useRenewals } from "@/features/renewals/api";
import { useDeskSettings } from "@/features/settings/api";
import { RenewDrawer } from "@/features/subscriptions/components/RenewDrawer";
import { paginationProps, useListState, useUrlEnum } from "@/hooks/use-list-state";
import { useWriteAccess } from "@/hooks/use-write-access";
import { formatDate, formatDateTime } from "@/lib/format";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

const TAB_LABEL: Record<RenewalTab, string> = { due: "Due soon", overdue: "Lapsed", reminded: "Reminded", all: "All" };
// The gym's renewal days (Configuration) are the default (the select's empty option); the others are listed.
const WITHIN_CHOICES = [7, 15, 30];

/**
 * Renewals — memberships ending soon or lapsed recently (both windows from Configuration). "Remind" opens WhatsApp
 * with a ready message and records when / how often the member was reminded; "Renew" opens the renewal drawer.
 */
export function RenewalsPage() {
  const [tab, setTab] = useUrlEnum("tab", RENEWAL_TABS, "due");
  const desk = useDeskSettings();
  const gymWithin = desk.data?.renewal_due_days ?? 7;
  const [picked, setPicked] = useState<number | null>(null);
  const within = picked ?? gymWithin;
  const list = useListState({ sortDir: "asc" });
  const renew = useWriteAccess("subscription:create");
  const remind = useWriteAccess("subscription:list");
  const gymName = useAuthStore((s) => s.me?.user.organization_name) ?? "our gym";
  const [renewing, setRenewing] = useState<RenewalRow | null>(null);

  const { setPage } = list;
  useEffect(() => setPage(1), [tab, within, setPage]);

  const rows = useRenewals({ ...list.query, tab, within });
  const counts = useRenewalCounts(within);
  const invalidate = useInvalidateRenewals();

  const mark = useMutation({
    mutationFn: (row: RenewalRow) => renewalApi.markReminded(row.subscription_id),
    onSuccess: async (res) => {
      notify.success(res.message);
      await invalidate();
    },
    onError: notify.error,
  });

  const sendReminder = (row: RenewalRow) => {
    sendRenewalReminder(row, gymName);   // WhatsApp first, so a slow network never blocks the message
    mark.mutate(row);
  };

  const columns = useMemo<ColumnDef<RenewalRow, unknown>[]>(() => [
    { accessorKey: "member_name", header: "Member", meta: { sortKey: "member_name" },
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="truncate font-semibold text-ink">{row.original.member_name}</div>
          <div className="font-mono text-xs text-muted">{row.original.registration_id} · {row.original.phone}</div>
        </div>
      ) },
    { accessorKey: "plan_name", header: "Membership", meta: { width: "190px" },
      cell: ({ row }) => <span className="truncate">{row.original.plan_name}</span> },
    { accessorKey: "end_date", header: "Ends", meta: { width: "150px", sortKey: "end_date" },
      cell: ({ row }) => {
        const d = row.original.days_left;
        return (
          <div className="whitespace-nowrap">
            <div className="text-ink">{formatDate(row.original.end_date)}</div>
            <div className={cn("text-xs font-semibold", d < 0 ? "text-danger" : d <= 3 ? "text-warning" : "text-muted")}>
              {d < 0 ? `Lapsed ${relativeDays(d, "ago").toLowerCase()}` : relativeDays(d, "ago")}
            </div>
          </div>
        );
      } },
    { accessorKey: "reminded_at", header: "Last reminded", meta: { width: "170px", sortKey: "reminded_at" },
      cell: ({ row }) => row.original.reminded_at ? (
        <div className="whitespace-nowrap">
          <div className="text-ink">{formatDateTime(row.original.reminded_at)}</div>
          <div className="text-xs text-muted">{row.original.reminder_count} reminder{row.original.reminder_count > 1 ? "s" : ""}</div>
        </div>
      ) : <span className="text-muted">Not yet</span> },
    {
      id: "actions", header: "Actions", meta: { width: "220px" },
      cell: ({ row }) => {
        const r = row.original;
        return (
          <ActionGroup>
            {remind.show && (
              <span title={remind.reason}>
                <button type="button" disabled={remind.disabled} onClick={() => sendReminder(r)}
                  className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-success px-3 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                  <Icon name="whatsapp" className="h-3.5 w-3.5" />
                  {r.reminder_count > 0 ? "Remind again" : "Remind"}
                </button>
              </span>
            )}
            {renew.show && (
              <span title={renew.reason}>
                <Button variant="secondary" className="h-8 px-3 py-0 text-xs" disabled={renew.disabled}
                  onClick={() => setRenewing(r)}>
                  Renew
                </Button>
              </span>
            )}
          </ActionGroup>
        );
      },
    },
  ], [remind, renew, gymName]);   // sendReminder reads only these + the mutation

  const data = rows.data;
  const c = counts.data;
  return (
    <div>
      <PageHeader title="Renewals" subtitle="Memberships ending soon or recently lapsed. Remind on WhatsApp in one click" />

      <div className="mb-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label={`Ending in ${within} days`} value={c?.due} icon="clock" tone="warning" />
        <StatCard label={`Lapsed (${desk.data?.renewal_overdue_days ?? 30} days)`} value={c?.overdue} icon="alert" tone="danger" />
        <StatCard label="Reminded" value={c?.reminded} icon="whatsapp" tone="success" />
        <StatCard label="Not reminded yet" value={c ? Math.max(0, c.all - c.reminded) : undefined} icon="users" tone="info" />
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        loading={rows.isLoading}
        fetching={rows.isFetching}
        getRowId={(r) => r.subscription_id}
        rowClassName={(r) => (r.days_left < 0 ? ROW_MARKER.rejected : r.days_left <= 3 ? ROW_MARKER.nearExpiry : undefined)}
        emptyIcon="clock"
        emptyMessage={rows.isError ? rows.error.message
          : list.debouncedSearch ? "No members match this search"
            : tab === "overdue" ? "No lapsed memberships" : tab === "reminded" ? "No reminders sent yet"
              : "No renewals due"}
        emptyHint={!rows.isError && !list.debouncedSearch && tab === "due" ? "Try a longer window, e.g. 15 or 30 days." : undefined}
        sorting={list.sorting}
        pagination={paginationProps(list, data?.total)}
        toolbar={
          <>
            <FilterTabs value={tab} onChange={setTab}
              tabs={RENEWAL_TABS.map((t) => ({ value: t, label: TAB_LABEL[t], count: c?.[t] }))} />
            <ListToolbar
              search={{ value: list.search, onChange: list.setSearch, placeholder: "Search name, member ID or phone" }}
              filters={
                <FilterSelect placeholder={`Ending in ${gymWithin} days`} ariaLabel="Due window"
                  value={within === gymWithin ? "" : String(within)}
                  onChange={(v) => setPicked(Number(v) || null)}
                  options={WITHIN_CHOICES.filter((d) => d !== gymWithin).map((d) => ({ value: String(d), label: `Ending in ${d} days` }))} />
              }
            />
          </>
        }
      />

      {renewing && <RenewDrawer row={renewing} onClose={() => setRenewing(null)} onDone={() => void invalidate()} />}
    </div>
  );
}
