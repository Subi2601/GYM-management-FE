import { useMutation } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { confirm } from "@/components/ui/ConfirmDialog";
import { ActionGroup, ActionIcon, DataTable, ROW_MARKER } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/Icon";
import { DateRangeFilter, FilterSelect, FilterTabs, ListToolbar, type ActiveFilter } from "@/components/ui/ListToolbar";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { goalLabel } from "@/features/lookups/fitness-goals";
import { leadApi, useInvalidateLeads, useLeadCounts, useLeads } from "@/features/leads/api";
import { FollowUpModal } from "@/features/leads/components/FollowUpModal";
import { LeadFormDrawer } from "@/features/leads/components/LeadFormDrawer";
import { LeadHistoryDrawer } from "@/features/leads/components/LeadHistoryDrawer";
import { useInvalidateMembers } from "@/features/members/api";
import { paginationProps, useAddAction, useListState, useUrlEnum } from "@/hooks/use-list-state";
import { formatDate, todayISO } from "@/lib/format";
import { notify } from "@/lib/notify";
import { cn, humanize } from "@/lib/utils";
import { useCan } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import { LEAD_STATUSES, type LeadStatus } from "@/types/enums";
import { LEAD_FILTERS, type Lead, type LeadFilter, type LeadListQuery, type LeadSortKey } from "@/types/lead";

const TAB_LABEL: Record<LeadFilter, string> = {
  all: "All leads",
  followup: "Follow-ups",
  rejected: "Rejected",
};

const sortKey = (key: LeadSortKey) => key;

/** Small coloured row buttons with the `<Button loading>` spinner / disabled state. */
const ROW_BUTTON = "h-8 px-3 py-0 text-xs font-bold hover:enabled:shadow-none";
const ROW_TONE = {
  yellow: "border-warning-line bg-warning-soft text-warning hover:enabled:border-warning hover:enabled:bg-warning hover:enabled:text-white",
  green: "border-success-line bg-success-soft text-success hover:enabled:border-success hover:enabled:bg-success hover:enabled:text-white",
} as const;

function rowMarker(lead: Lead): string | undefined {
  switch (lead.status) {
    case "NEW": return ROW_MARKER.new;
    case "FOLLOW_UP": return ROW_MARKER.followup;
    case "JOINED": return ROW_MARKER.joined;
    case "NOT_INTERESTED":
    case "JOINED_ELSEWHERE": return ROW_MARKER.rejected;
    default: return undefined;
  }
}

/** Overdue / due-today follow-ups stand out while the lead is still open. */
function followUpTone(lead: Lead, today: string): string {
  const date = lead.next_follow_up_date;
  const open = lead.status === "NEW" || lead.status === "FOLLOW_UP";
  if (!date || !open) return "text-ink";
  if (date < today) return "font-semibold text-danger";
  if (date === today) return "font-semibold text-warning";
  return "text-ink";
}

/** Leads — tabs (All / Follow-ups / Rejected), search + status / follow-up filters, add/edit, follow-up, convert, delete. */
export function LeadsPage() {
  const [tab, setTab] = useUrlEnum("tab", LEAD_FILTERS, "all");
  const list = useListState();
  const [status, setStatus] = useState<LeadStatus | "">("");
  const [followUp, setFollowUp] = useState({ from: "", to: "" });

  // "All Branches" is a read-only aggregate — writes need a concrete branch.
  const branchSelected = useBranchStore((s) => Boolean(s.selectedBranchId));
  const canCreate = useCan("lead:create") && branchSelected;
  const canUpdate = useCan("lead:update") && branchSelected;
  const canDelete = useCan("lead:delete") && branchSelected;
  const canConvert = useCan("lead:convert") && branchSelected;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [followUpFor, setFollowUpFor] = useState<Lead | null>(null);
  const [historyFor, setHistoryFor] = useState<Lead | null>(null);

  const { setPage } = list;
  // Tab / filter changes restart from page 1.
  useEffect(() => setPage(1), [tab, status, followUp, setPage]);

  const openAdd = useCallback(() => {
    setEditing(null);
    setFormOpen(true);
  }, []);
  // Dashboard quick link /leads?action=add opens the drawer.
  useAddAction(openAdd, canCreate);

  const query: LeadListQuery = {
    ...list.query, filter: tab, status,
    follow_up_from: followUp.from || undefined, follow_up_to: followUp.to || undefined,
  };
  const leads = useLeads(query);

  const counts = useLeadCounts();

  const invalidate = useInvalidateLeads();
  const invalidateMembers = useInvalidateMembers();

  const remove = useMutation({
    mutationFn: (id: string) => leadApi.remove(id),
    onSuccess: async (res) => {
      notify.success(res.message);
      await invalidate();
    },
    onError: notify.error,
  });

  const convert = useMutation({
    mutationFn: (id: string) => leadApi.convert(id),
    onSuccess: async (res) => {
      notify.success(res.message);
      await Promise.all([invalidate(), invalidateMembers()]);
    },
    onError: notify.error,
  });

  const columns = useMemo<ColumnDef<Lead, unknown>[]>(() => {
    const today = todayISO();
    const onDelete = async (lead: Lead) => {
      if (await confirm(`Are you sure you want to delete lead: ${lead.name}?`)) remove.mutate(lead.id);
    };
    const onConvert = async (lead: Lead) => {
      if (await confirm(`Convert ${lead.name} to a member?`)) convert.mutate(lead.id);
    };
    const converting = convert.isPending ? convert.variables : undefined;

    return [
      { accessorKey: "name", header: "Lead", meta: { sortKey: sortKey("name") },
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate font-semibold text-ink">{row.original.name}</div>
            <div className="text-xs text-muted">{row.original.phone}</div>
          </div>
        ) },
      { accessorKey: "status", header: "Status", meta: { width: "150px", sortKey: sortKey("status") },
        cell: ({ row }) => <StatusBadge value={row.original.status} /> },
      { accessorKey: "goal", header: "Goal", meta: { width: "170px" },
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate">{goalLabel(row.original.goal) ?? "—"}</div>
            {row.original.location && <div className="truncate text-xs text-muted">{row.original.location}</div>}
          </div>
        ) },
      { accessorKey: "plan_to_join_date", header: "Plan to join", meta: { width: "130px", sortKey: sortKey("plan_to_join_date") },
        cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.plan_to_join_date)}</span> },
      { accessorKey: "next_follow_up_date", header: "Next follow-up",
        meta: { width: "150px", sortKey: sortKey("next_follow_up_date") },
        cell: ({ row }) => (
          <span className={cn("whitespace-nowrap", followUpTone(row.original, today))}>
            {formatDate(row.original.next_follow_up_date)}
          </span>
        ) },
      {
        id: "actions", header: "", meta: { width: "260px" },
        cell: ({ row }) => {
          const lead = row.original;
          return (
            <ActionGroup>
              {canUpdate && !lead.converted_member_id && (
                <Button variant="secondary" className={cn(ROW_BUTTON, ROW_TONE.yellow)} onClick={() => setFollowUpFor(lead)}>
                  Follow-up
                </Button>
              )}
              {canConvert && lead.status !== "JOINED" && (
                <Button variant="secondary" className={cn(ROW_BUTTON, ROW_TONE.green)}
                  loading={converting === lead.id} onClick={() => void onConvert(lead)}>
                  Convert
                </Button>
              )}
              <ActionIcon kind="view" title="Notes & history" onClick={() => setHistoryFor(lead)} />
              {canUpdate && (
                <ActionIcon kind="edit" onClick={() => { setEditing(lead); setFormOpen(true); }} />
              )}
              {canDelete && <ActionIcon kind="delete" onClick={() => void onDelete(lead)} />}
            </ActionGroup>
          );
        },
      },
    ];
  }, [canUpdate, canConvert, canDelete, remove, convert]);

  const active: ActiveFilter[] = [];
  if (status) active.push({ label: `Status: ${humanize(status)}`, onRemove: () => setStatus("") });
  if (followUp.from || followUp.to) {
    active.push({
      label: `Follow-up: ${followUp.from ? formatDate(followUp.from) : "…"} – ${followUp.to ? formatDate(followUp.to) : "…"}`,
      onRemove: () => setFollowUp({ from: "", to: "" }),
    });
  }

  const data = leads.data;
  const filtered = !!list.debouncedSearch || active.length > 0;

  return (
    <div>
      <PageHeader
        title="Leads"
        subtitle="Enquiries, follow-ups and conversions to members"
        actions={canCreate && (
          <Button icon={<Icon name="plus" className="h-4 w-4" />} onClick={openAdd}>
            Add lead
          </Button>
        )}
      />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        loading={leads.isLoading}
        fetching={leads.isFetching}
        getRowId={(l) => l.id}
        onRowClick={setHistoryFor}
        rowClassName={rowMarker}
        emptyIcon="clipboard"
        emptyMessage={leads.isError ? leads.error.message
          : filtered ? "No leads match these filters"
            : tab === "followup" ? "No follow-ups pending"
              : tab === "rejected" ? "No rejected leads" : "No leads yet"}
        emptyHint={leads.isError ? undefined
          : filtered ? "Try a different search or clear the filters."
            : tab === "all" && canCreate ? "Add your first enquiry to start tracking follow-ups." : undefined}
        sorting={list.sorting}
        pagination={paginationProps(list, data?.total)}
        toolbar={
          <>
            <FilterTabs value={tab} onChange={setTab}
              tabs={LEAD_FILTERS.map((f) => ({ value: f, label: TAB_LABEL[f], count: counts.data?.[f] }))} />
            <ListToolbar
              search={{ value: list.search, onChange: list.setSearch, placeholder: "Search name or phone" }}
              filters={
                <>
                  <FilterSelect placeholder="Any status" ariaLabel="Status" value={status}
                    onChange={(v) => setStatus(v as LeadStatus | "")}
                    options={LEAD_STATUSES.map((s) => ({ value: s, label: humanize(s) }))} />
                  <DateRangeFilter label="Follow-up" from={followUp.from} to={followUp.to}
                    onChange={(from, to) => setFollowUp({ from, to })} />
                </>
              }
              actions={
                <Button variant="secondary" className="h-9 px-3.5 py-0 text-[13px]"
                  icon={<Icon name="refresh" className="h-4 w-4" />}
                  loading={leads.isFetching && !leads.isLoading} onClick={() => void leads.refetch()}>
                  Refresh
                </Button>
              }
              active={active}
            />
          </>
        }
      />

      <LeadFormDrawer open={formOpen} lead={editing} onClose={() => { setFormOpen(false); setEditing(null); }} />
      <FollowUpModal lead={followUpFor} onClose={() => setFollowUpFor(null)} />
      <LeadHistoryDrawer lead={historyFor} onClose={() => setHistoryFor(null)} />
    </div>
  );
}
