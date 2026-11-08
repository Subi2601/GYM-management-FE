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
import { leadApi, useInvalidateLeads, useLeadAttendants, useLeadCounts, useLeads } from "@/features/leads/api";
import { EnquiryLinkModal } from "@/features/leads/components/EnquiryLinkModal";
import { FollowUpModal } from "@/features/leads/components/FollowUpModal";
import { LeadFormDrawer } from "@/features/leads/components/LeadFormDrawer";
import { LeadHistoryDrawer } from "@/features/leads/components/LeadHistoryDrawer";
import { TrialModal, trialFeeDue, trialLabel } from "@/features/leads/components/TrialModal";
import { useDeskSettings } from "@/features/settings/api";
import { addDays, daysUntil, relativeDays, SOURCE_META, SourceLabel } from "@/features/leads/lead-meta";
import { useInvalidateMembers } from "@/features/members/api";
import { paginationProps, useAddAction, useListState, useUrlEnum } from "@/hooks/use-list-state";
import { formatDate, todayISO } from "@/lib/format";
import { notify } from "@/lib/notify";
import { cn, humanize } from "@/lib/utils";
import { useWriteAccess } from "@/hooks/use-write-access";
import { LEAD_SOURCES, LEAD_STATUSES, type LeadSource, type LeadStatus } from "@/types/enums";
import { LEAD_FILTERS, type Lead, type LeadFilter, type LeadListQuery, type LeadSortKey } from "@/types/lead";

const TAB_LABEL: Record<LeadFilter, string> = {
  all: "All leads",
  followup: "Follow-ups",
  trial: "Trials",
  rejected: "Rejected",
};

/** Trial chip under the status: running (green), booked (neutral), over (muted); "fee due" in red. */
function TrialChip({ lead, onOpen }: { lead: Lead; onOpen: () => void }) {
  const label = trialLabel(lead);
  if (!label) return null;
  const tone = lead.trial_state === "ON" ? "border-success-line bg-success-soft text-success"
    : lead.trial_state === "UPCOMING" ? "border-line-accent bg-accent-light text-accent" : "border-line bg-subtle text-muted";
  return (
    <button type="button" title="Trial class" onClick={(e) => { e.stopPropagation(); onOpen(); }}
      className={cn("mt-1 inline-flex max-w-full cursor-pointer items-center gap-1 truncate rounded-full border px-2 py-0.5 text-[11px] font-bold", tone)}>
      <Icon name="dumbbell" className="h-3 w-3 shrink-0" />
      <span className="truncate">{label}</span>
      {trialFeeDue(lead) && <span className="text-danger">· ₹ due</span>}
    </button>
  );
}

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

const isOpen = (lead: Lead) => lead.status === "NEW" || lead.status === "FOLLOW_UP";

/** Overdue / due-today follow-ups stand out while the lead is still open. */
function followUpTone(lead: Lead, today: string): string {
  const date = lead.next_follow_up_date;
  if (!date || !isOpen(lead)) return "text-muted";
  if (date < today) return "font-semibold text-danger";
  if (date === today) return "font-semibold text-warning";
  return "text-muted";
}

/** Date with "In 3 days" / "2 days overdue" under it. */
function DateCell({ date, today, past, tone }: { date: string | null; today: string; past: "overdue" | "ago"; tone?: string }) {
  if (!date) return <span className="text-muted">—</span>;
  return (
    <div className="whitespace-nowrap">
      <div className="text-ink">{formatDate(date)}</div>
      <div className={cn("text-xs", tone ?? "text-muted")}>{relativeDays(daysUntil(date, today), past)}</div>
    </div>
  );
}

/** Follow-ups tab quick filter on the next follow-up date. */
const DUE_OPTIONS = [
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due today" },
  { value: "3", label: "Next 3 days" },
  { value: "7", label: "Next 7 days" },
  { value: "15", label: "Next 15 days" },
  { value: "30", label: "Next 30 days" },
] as const;
type Due = (typeof DUE_OPTIONS)[number]["value"];

function dueRange(due: Due, today: string): { from: string; to: string } {
  if (due === "overdue") return { from: "", to: addDays(today, -1) };
  if (due === "today") return { from: today, to: today };
  return { from: today, to: addDays(today, Number(due)) };
}

/** Leads — tabs (All / Follow-ups / Trials / Rejected), search + status / follow-up filters, add/edit, follow-up, convert, delete. */
export function LeadsPage() {
  const [tab, setTab] = useUrlEnum("tab", LEAD_FILTERS, "all");
  const list = useListState();
  const [status, setStatus] = useState<LeadStatus | "">("");
  const [source, setSource] = useState<LeadSource | "">("");
  const [attendedBy, setAttendedBy] = useState("");
  const [followUp, setFollowUp] = useState({ from: "", to: "" });
  const [due, setDue] = useState<Due | "">("");
  const attendants = useLeadAttendants();

  // "All Branches" is a read-only aggregate — writes need a concrete branch.
  // Shown but greyed out while "All Branches" is selected.
  const create = useWriteAccess("lead:create");
  const update = useWriteAccess("lead:update");
  const del = useWriteAccess("lead:delete");
  const conv = useWriteAccess("lead:convert");
  const canCreate = create.allowed;
  const locked = create.reason ?? update.reason;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [followUpFor, setFollowUpFor] = useState<Lead | null>(null);
  const [historyFor, setHistoryFor] = useState<Lead | null>(null);
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [trialFor, setTrialFor] = useState<Lead | null>(null);
  const trialOffer = useDeskSettings();
  const trialsOn = !!trialOffer.data?.trial_enabled;

  const { setPage } = list;
  // Tab / filter changes restart from page 1.
  useEffect(() => setPage(1), [tab, status, source, attendedBy, followUp, setPage]);

  // The "Due" quick filter only exists on the Follow-ups tab.
  useEffect(() => {
    if (tab !== "followup" && due) {
      setDue("");
      setFollowUp({ from: "", to: "" });
    }
  }, [tab, due]);

  const openAdd = useCallback(() => {
    setEditing(null);
    setFormOpen(true);
  }, []);
  // Dashboard quick link /leads?action=add opens the drawer.
  useAddAction(openAdd, canCreate);

  const query: LeadListQuery = {
    ...list.query, filter: tab, status, source, attended_by: attendedBy || undefined,
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
      { accessorKey: "status", header: "Status", meta: { width: "170px", sortKey: sortKey("status") },
        cell: ({ row }) => (
          <div className="min-w-0">
            <StatusBadge value={row.original.status} />
            <div><TrialChip lead={row.original} onOpen={() => setTrialFor(row.original)} /></div>
          </div>
        ) },
      { accessorKey: "source", header: "Source", meta: { width: "160px", sortKey: sortKey("source") },
        cell: ({ row }) => (
          <div className="min-w-0">
            <SourceLabel source={row.original.source} />
            <div className="truncate text-xs text-muted">by {row.original.attended_by_name ?? (row.original.source === "ENQUIRY_FORM" ? "online form" : "—")}</div>
          </div>
        ) },
      { accessorKey: "goal", header: "Goal", meta: { width: "170px" },
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate">{goalLabel(row.original.goal) ?? "—"}</div>
            {row.original.location && <div className="truncate text-xs text-muted">{row.original.location}</div>}
          </div>
        ) },
      { accessorKey: "plan_to_join_date", header: "Plan to join", meta: { width: "130px", sortKey: sortKey("plan_to_join_date") },
        cell: ({ row }) => <DateCell date={row.original.plan_to_join_date} today={today} past="ago" /> },
      { accessorKey: "next_follow_up_date", header: "Next follow-up",
        meta: { width: "150px", sortKey: sortKey("next_follow_up_date") },
        cell: ({ row }) => (
          <DateCell date={row.original.next_follow_up_date} today={today}
            past={isOpen(row.original) ? "overdue" : "ago"} tone={followUpTone(row.original, today)} />
        ) },
      {
        id: "actions", header: "Actions", meta: { width: "300px" },
        cell: ({ row }) => {
          const lead = row.original;
          return (
            <ActionGroup>
              {update.show && !lead.converted_member_id && (
                <span title={update.reason} className="inline-flex">
                  <Button variant="secondary" className={cn(ROW_BUTTON, ROW_TONE.yellow)} disabled={update.disabled}
                    onClick={() => setFollowUpFor(lead)}>
                    Follow-up
                  </Button>
                </span>
              )}
              {conv.show && lead.status !== "JOINED" && (
                <span title={conv.reason} className="inline-flex">
                  <Button variant="secondary" className={cn(ROW_BUTTON, ROW_TONE.green)} disabled={conv.disabled}
                    loading={converting === lead.id} onClick={() => void onConvert(lead)}>
                    Convert
                  </Button>
                </span>
              )}
              {update.show && isOpen(lead) && (lead.trial_start || trialsOn) && (
                <ActionIcon kind="trial" title={lead.trial_start ? "Trial class" : "Book a trial"}
                  disabled={update.disabled} disabledReason={update.reason} onClick={() => setTrialFor(lead)} />
              )}
              <ActionIcon kind="view" title="Notes & history" onClick={() => setHistoryFor(lead)} />
              {update.show && (
                <ActionIcon kind="edit" disabled={update.disabled} disabledReason={update.reason}
                  onClick={() => { setEditing(lead); setFormOpen(true); }} />
              )}
              {del.show && (
                <ActionIcon kind="delete" disabled={del.disabled} disabledReason={del.reason} onClick={() => void onDelete(lead)} />
              )}
            </ActionGroup>
          );
        },
      },
    ];
  }, [update, conv, del, remove, convert, trialsOn]);

  const clearDates = () => {
    setDue("");
    setFollowUp({ from: "", to: "" });
  };
  const active: ActiveFilter[] = [];
  if (status) active.push({ label: `Status: ${humanize(status)}`, onRemove: () => setStatus("") });
  if (source) active.push({ label: `Source: ${SOURCE_META[source].label}`, onRemove: () => setSource("") });
  if (attendedBy) {
    const name = attendants.data?.find((a) => a.id === attendedBy)?.name ?? "…";
    active.push({ label: `Attended by: ${name}`, onRemove: () => setAttendedBy("") });
  }
  if (due) {
    active.push({ label: `Follow-up: ${DUE_OPTIONS.find((o) => o.value === due)?.label}`, onRemove: clearDates });
  } else if (followUp.from || followUp.to) {
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
        actions={
          <>
            <Button variant="secondary" icon={<Icon name="qr" className="h-4 w-4" />} onClick={() => setEnquiryOpen(true)}>
              Enquiry form
            </Button>
            {create.show && (
              <span title={locked}>
                <Button icon={<Icon name="plus" className="h-4 w-4" />} disabled={create.disabled} onClick={openAdd}>
                  Add lead
                </Button>
              </span>
            )}
          </>
        }
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
              : tab === "trial" ? "No one on a trial"
                : tab === "rejected" ? "No rejected leads" : "No leads yet"}
        emptyHint={leads.isError ? undefined
          : filtered ? "Try a different search or clear the filters."
            : tab === "all" && canCreate ? "Add your first enquiry to start tracking follow-ups."
              : tab === "trial" && trialsOn ? "Book a trial from a lead's dumbbell button, or let people book on the enquiry form." : undefined}
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
                  {tab === "followup" && (
                    <FilterSelect placeholder="Any due date" ariaLabel="Follow-up due" value={due}
                      onChange={(v) => {
                        const next = v as Due | "";
                        setDue(next);
                        setFollowUp(next ? dueRange(next, todayISO()) : { from: "", to: "" });
                      }}
                      options={DUE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
                  )}
                  <FilterSelect placeholder="Any status" ariaLabel="Status" value={status}
                    onChange={(v) => setStatus(v as LeadStatus | "")}
                    options={LEAD_STATUSES.map((s) => ({ value: s, label: humanize(s) }))} />
                  <FilterSelect placeholder="Any source" ariaLabel="Enquiry source" value={source}
                    onChange={(v) => setSource(v as LeadSource | "")}
                    options={LEAD_SOURCES.map((s) => ({ value: s, label: SOURCE_META[s].label }))} />
                  <FilterSelect placeholder="Anyone" ariaLabel="Attended by" value={attendedBy}
                    onChange={setAttendedBy}
                    options={(attendants.data ?? []).map((a) => ({ value: a.id, label: a.name }))} />
                  <DateRangeFilter label="Follow-up" from={followUp.from} to={followUp.to}
                    onChange={(from, to) => {
                      setDue("");
                      setFollowUp({ from, to });
                    }} />
                </>
              }
              active={active}
            />
          </>
        }
      />

      <LeadFormDrawer open={formOpen} lead={editing} onClose={() => { setFormOpen(false); setEditing(null); }} />
      <FollowUpModal lead={followUpFor} onClose={() => setFollowUpFor(null)} />
      <LeadHistoryDrawer lead={historyFor} onClose={() => setHistoryFor(null)} />
      {enquiryOpen && <EnquiryLinkModal onClose={() => setEnquiryOpen(false)} />}
      <TrialModal lead={trialFor} onClose={() => setTrialFor(null)} />
    </div>
  );
}
