import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { confirm } from "@/components/ui/ConfirmDialog";
import { ActionGroup, ActionIcon, DataTable, ROW_MARKER } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { FollowUpModal } from "@/features/leads/components/FollowUpModal";
import { LeadFormModal } from "@/features/leads/components/LeadFormModal";
import { LeadHistoryModal } from "@/features/leads/components/LeadHistoryModal";
import { leadApi, leadKeys, useLeads } from "@/features/leads/api";
import { useListState } from "@/hooks/use-list-state";
import { formatDate } from "@/lib/format";
import { notify } from "@/lib/notify";
import { useCan } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import { LEAD_FILTERS, type Lead, type LeadFilter } from "@/types/lead";

const FILTER_LABEL: Record<LeadFilter, string> = {
  all: "All Leads",
  followup: "Follow-ups",
  rejected: "Rejected Leads",
};

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

function isLeadFilter(v: string | null): v is LeadFilter {
  return v !== null && (LEAD_FILTERS as readonly string[]).includes(v);
}

/** Leads Management: list by filter (?filter=), add/edit, follow-up, convert to member, delete. */
export function LeadsPage() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const rawFilter = params.get("filter");
  const filter: LeadFilter = isLeadFilter(rawFilter) ? rawFilter : "all";

  // "All Branches" is a read-only aggregate — writes need a concrete branch.
  const branchSelected = useBranchStore((s) => Boolean(s.selectedBranchId));
  const canCreate = useCan("lead:create") && branchSelected;
  const canUpdate = useCan("lead:update") && branchSelected;
  const canDelete = useCan("lead:delete") && branchSelected;
  const canConvert = useCan("lead:convert") && branchSelected;

  const list = useListState();
  const { setPage } = list;
  const leads = useLeads({ page: list.page, page_size: list.pageSize, search: list.debouncedSearch || undefined, filter });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [followUpFor, setFollowUpFor] = useState<Lead | null>(null);
  const [historyFor, setHistoryFor] = useState<Lead | null>(null);

  // A new filter starts again from page 1.
  useEffect(() => setPage(1), [filter, setPage]);

  // Sidebar "Add Lead" → ?action=add opens the modal, then the param is cleared.
  useEffect(() => {
    if (params.get("action") !== "add") return;
    if (canCreate) {
      setEditing(null);
      setFormOpen(true);
    }
    const next = new URLSearchParams(params);
    next.delete("action");
    setParams(next, { replace: true });
  }, [params, setParams, canCreate]);

  const afterChange = async () => {
    await qc.invalidateQueries({ queryKey: leadKeys.all });
    await qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const remove = useMutation({
    mutationFn: (id: string) => leadApi.remove(id),
    onSuccess: async (res) => {
      notify.success(res.message);
      await afterChange();
    },
    onError: notify.error,
  });

  const convert = useMutation({
    mutationFn: (id: string) => leadApi.convert(id),
    onSuccess: async (res) => {
      notify.success(res.message);
      await Promise.all([
        afterChange(),
        qc.invalidateQueries({ queryKey: ["lookup", "members"] }),
        qc.invalidateQueries({ queryKey: ["members"] }),
      ]);
    },
    onError: notify.error,
  });

  const columns = useMemo<ColumnDef<Lead, unknown>[]>(() => {
    const onDelete = async (lead: Lead) => {
      if (await confirm(`Are you sure you want to delete lead: ${lead.name}?`)) remove.mutate(lead.id);
    };
    const onConvert = async (lead: Lead) => {
      if (await confirm(`Convert ${lead.name} to a member?`)) convert.mutate(lead.id);
    };
    const busyId = (m: { isPending: boolean; variables: string | undefined }) => (m.isPending ? m.variables : undefined);
    const converting = busyId(convert);

    return [
      { accessorKey: "name", header: "Name", meta: { width: "180px" },
        cell: ({ row }) => <span className="font-semibold text-ink">{row.original.name}</span> },
      { accessorKey: "phone", header: "Phone", meta: { width: "130px" } },
      { accessorKey: "status", header: "Status", meta: { width: "150px" },
        cell: ({ row }) => <StatusBadge value={row.original.status} /> },
      { accessorKey: "goal", header: "Goal", meta: { width: "150px" },
        cell: ({ row }) => row.original.goal ?? "—" },
      { accessorKey: "plan_to_join_date", header: "Plan to Join", meta: { width: "130px" },
        cell: ({ row }) => formatDate(row.original.plan_to_join_date) },
      { accessorKey: "next_follow_up_date", header: "Next Follow-up", meta: { width: "140px" },
        cell: ({ row }) => formatDate(row.original.next_follow_up_date) },
      {
        id: "actions", header: "Actions",
        cell: ({ row }) => {
          const lead = row.original;
          return (
            <ActionGroup>
              {canUpdate && !lead.converted_member_id && (
                <button type="button" className="btn-status-action btn-yellow" onClick={() => setFollowUpFor(lead)}>
                  Follow-up
                </button>
              )}
              {canConvert && lead.status !== "JOINED" && (
                <button type="button" className="btn-status-action btn-green disabled:opacity-50"
                  disabled={converting === lead.id} onClick={() => onConvert(lead)}>
                  {converting === lead.id ? "Converting…" : "Convert"}
                </button>
              )}
              <ActionIcon kind="view" title="Notes & History" onClick={() => setHistoryFor(lead)} />
              {canUpdate && (
                <ActionIcon kind="edit" onClick={() => { setEditing(lead); setFormOpen(true); }} />
              )}
              {canDelete && <ActionIcon kind="delete" onClick={() => onDelete(lead)} />}
            </ActionGroup>
          );
        },
      },
    ];
  }, [canUpdate, canConvert, canDelete, remove, convert]);

  const data = leads.data;

  return (
    <div>
      <PageHeader
        title="Leads Management"
        subtitle={FILTER_LABEL[filter]}
        search={{ value: list.search, onChange: list.setSearch, placeholder: "Search leads..." }}
        actions={
          <>
            <Button variant="secondary" icon={<Icon name="refresh" />} loading={leads.isFetching && !leads.isLoading}
              onClick={() => leads.refetch()}>
              Refresh
            </Button>
            {canCreate && (
              <Button icon={<Icon name="plus" />} onClick={() => { setEditing(null); setFormOpen(true); }}>
                Add Lead
              </Button>
            )}
          </>
        }
      />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        loading={leads.isLoading}
        emptyMessage={leads.isError ? leads.error.message : "No leads found."}
        rowClassName={rowMarker}
        getRowId={(l) => l.id}
        maxHeightClass="max-h-[calc(100vh-260px)]"
        pagination={data ? {
          page: list.page, pageSize: list.pageSize, total: data.total,
          onPageChange: list.setPage, onPageSizeChange: list.setPageSize,
        } : undefined}
      />

      <LeadFormModal open={formOpen} lead={editing} onClose={() => { setFormOpen(false); setEditing(null); }} />
      <FollowUpModal lead={followUpFor} onClose={() => setFollowUpFor(null)} />
      <LeadHistoryModal lead={historyFor} onClose={() => setHistoryFor(null)} />
    </div>
  );
}
