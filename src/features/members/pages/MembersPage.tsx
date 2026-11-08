import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { confirm } from "@/components/ui/ConfirmDialog";
import { ActionGroup, ActionIcon, DataTable, ROW_MARKER } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/Icon";
import { DateRangeFilter, FilterSelect, FilterTabs, ListToolbar, type ActiveFilter } from "@/components/ui/ListToolbar";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { usePlanLookup } from "@/features/lookups/api";
import { MEMBER_FILTERS, memberApi, memberKeys, useInvalidateMembers, type MemberFilter,
  type MemberListQuery, type MemberSortKey } from "@/features/members/api";
import { AddonServiceDrawer } from "@/features/members/components/AddonServiceDrawer";
import { RenewDrawer } from "@/features/subscriptions/components/RenewDrawer";
import { paginationProps, useAddAction, useListState, useUrlEnum } from "@/hooks/use-list-state";
import { formatDate } from "@/lib/format";
import { notify } from "@/lib/notify";
import { cn, humanize, openWhatsApp } from "@/lib/utils";
import { useDeskSettings } from "@/features/settings/api";
import { useAuthStore, useCan } from "@/stores/auth-store";
import { MemberReferralsDrawer } from "@/features/referrals/components/MemberReferralsDrawer";
import { useWriteAccess } from "@/hooks/use-write-access";
import { useBranchStore } from "@/stores/branch-store";
import { GENDERS, type Gender } from "@/types/enums";
import type { Member } from "@/types/member";

const TAB_LABEL: Record<MemberFilter, string> = {
  all: "All members",
  active: "Active",
  expiring: "Expiring soon",
  absent: "Not coming",
  inactive: "Expired / inactive",
};

/** "Never came" / "12 days ago". */
const awayFor = (m: Member) => (m.last_visit_date == null ? "Never came" : m.days_since_visit === 0 ? "Today"
  : `${m.days_since_visit} day${m.days_since_visit === 1 ? "" : "s"} ago`);

const sortKey = (key: MemberSortKey) => key;

/** Members directory — status tabs with counts, search + plan / gender / joined filters, sortable server-paginated table. */
export function MembersPage() {
  const branch = useBranchStore((s) => s.selectedBranchId);
  const navigate = useNavigate();
  const [tab, setTab] = useUrlEnum("tab", MEMBER_FILTERS, "all");
  const list = useListState();
  const [planId, setPlanId] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [joined, setJoined] = useState({ from: "", to: "" });
  const [addonFor, setAddonFor] = useState<Member | null>(null);
  const [renewFor, setRenewFor] = useState<Member | null>(null);
  const [treeFor, setTreeFor] = useState<string | null>(null);
  const canTree = useCan("referral:list");

  // "All Branches" is read-only: the controls stay visible but greyed out (a branch must be picked to write).
  const create = useWriteAccess("member:create");
  const update = useWriteAccess("member:update");
  const del = useWriteAccess("member:delete");
  const enroll = useWriteAccess("subscription:create");
  const canCreate = create.allowed;
  const invalidate = useInvalidateMembers();
  const gymName = useAuthStore((s) => s.me?.user.organization_name) ?? "the gym";
  const desk = useDeskSettings();

  const { setPage } = list;
  // Tab / filter changes restart from page 1.
  useEffect(() => setPage(1), [tab, planId, gender, joined, setPage]);

  // Dashboard quick link /members?action=add opens the registration page.
  useAddAction(useCallback(() => navigate("/members/new"), [navigate]), canCreate);

  const query: MemberListQuery = {
    ...list.query, filter: tab, plan_id: planId || undefined, gender,
    joined_from: joined.from || undefined, joined_to: joined.to || undefined,
  };
  const members = useQuery({
    queryKey: memberKeys.list(branch, query),
    queryFn: () => memberApi.list(query),
    placeholderData: keepPreviousData,
  });

  const counts = useQuery({ queryKey: memberKeys.counts(branch), queryFn: async () => (await memberApi.counts()).data });

  // The filter is on the member's latest membership: regular and customized membership plans, not add-ons.
  const plansLookup = usePlanLookup();
  const planOptions = (plansLookup.data ?? []).filter((p) => p.type !== "ADD_ON").map((p) => ({ value: p.id, label: p.name }));

  const remove = useMutation({
    mutationFn: memberApi.remove,
    onSuccess: async (res) => {
      notify.success(res.message);
      await invalidate();
    },
    onError: notify.error,
  });

  const columns = useMemo<ColumnDef<Member, unknown>[]>(() => [
    { accessorKey: "registration_id", header: "Reg ID", meta: { width: "110px", sortKey: sortKey("registration_id") },
      cell: ({ row }) => <span className="font-mono text-[13px] font-semibold text-secondary-grey">{row.original.registration_id}</span> },
    { accessorKey: "name", header: "Member", meta: { sortKey: sortKey("name") },
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="truncate font-semibold text-ink">{row.original.name}</div>
          <div className="text-xs text-muted">{row.original.phone}</div>
        </div>
      ) },
    { id: "plan", header: "Plan", meta: { width: "170px" },
      cell: ({ row }) => row.original.current_plan_name ?? <span className="text-muted">No plan</span> },
    tab === "absent"
      ? { accessorKey: "last_visit_date", header: "Last visit", meta: { width: "140px", sortKey: sortKey("last_visit") },
        cell: ({ row }) => (
          <div className="whitespace-nowrap">
            <div className="text-ink">{row.original.last_visit_date ? formatDate(row.original.last_visit_date) : "—"}</div>
            <div className="text-xs font-semibold text-danger">{awayFor(row.original)}</div>
          </div>
        ) }
      : { accessorKey: "joining_date", header: "Joined", meta: { width: "120px", sortKey: sortKey("joining_date") },
        cell: ({ row }) => formatDate(row.original.joining_date) },
    { accessorKey: "expiry_date", header: "Expiry", meta: { width: "120px", sortKey: sortKey("expiry_date") },
      cell: ({ row }) => {
        const m = row.original;
        return (
          <span className={cn("whitespace-nowrap font-semibold",
            m.membership_state === "EXPIRED" ? "text-danger" : m.membership_state === "EXPIRING" ? "text-warning" : "text-ink")}>
            {m.expiry_date ? formatDate(m.expiry_date) : "—"}
          </span>
        );
      } },
    { accessorKey: "membership_state", header: "Status", meta: { width: "120px" },
      cell: ({ row }) => <StatusBadge value={row.original.membership_state} /> },
    {
      id: "actions", header: "Actions", meta: { width: "250px" },
      cell: ({ row }) => {
        const m = row.original;
        return (
          <ActionGroup>
            {tab === "absent" && (
              <button type="button" className="btn-status-action btn-grey inline-flex items-center gap-1"
                title="Check on them over WhatsApp"
                onClick={() => openWhatsApp(m.phone, `Hi ${m.name}, we've missed you at ${gymName}! `
                  + "Hope all is well. Your membership is still running, come back soon. Anything we can help with?")}>
                <Icon name="whatsapp" className="h-3.5 w-3.5" />Check in
              </button>
            )}
            {enroll.show && tab !== "absent" && (
              <span title={enroll.reason} className="inline-flex">
                <button type="button" className="btn-status-action btn-grey disabled:pointer-events-none disabled:opacity-40"
                  disabled={enroll.disabled} onClick={() => setAddonFor(m)}>
                  Add service
                </button>
              </span>
            )}
            {enroll.show && (
              <ActionIcon kind="renew" title={m.current_plan_name ? "Renew / Upgrade plan" : "Add a plan"}
                disabled={enroll.disabled} disabledReason={enroll.reason} onClick={() => setRenewFor(m)} />
            )}
            {canTree && (
              <ActionIcon kind="tree" title={`Referrals (${m.referral_count})`}
                disabled={m.referral_count === 0} disabledReason="Hasn't referred anyone yet"
                onClick={() => setTreeFor(m.id)} />
            )}
            <ActionIcon kind="view" onClick={() => navigate(`/members/${m.id}`)} />
            {update.show && (
              <ActionIcon kind="edit" disabled={update.disabled} disabledReason={update.reason}
                onClick={() => navigate(`/members/${m.id}/edit`)} />
            )}
            {del.show && (
              <ActionIcon kind="delete" disabled={del.disabled} disabledReason={del.reason} onClick={async () => {
                if (await confirm(`Delete ${m.name}?`)) remove.mutate(m.id);
              }} />
            )}
          </ActionGroup>
        );
      },
    },
  ], [enroll, update, del, remove, navigate, tab, gymName, canTree]);

  const active: ActiveFilter[] = [];
  if (planId) active.push({ label: `Plan: ${planOptions.find((p) => p.value === planId)?.label ?? "…"}`, onRemove: () => setPlanId("") });
  if (gender) active.push({ label: `Gender: ${humanize(gender)}`, onRemove: () => setGender("") });
  if (joined.from || joined.to) {
    active.push({
      label: `Joined: ${joined.from ? formatDate(joined.from) : "…"} – ${joined.to ? formatDate(joined.to) : "…"}`,
      onRemove: () => setJoined({ from: "", to: "" }),
    });
  }

  const data = members.data?.data;
  const filtered = !!list.debouncedSearch || active.length > 0;

  return (
    <div>
      <PageHeader
        title="Members"
        subtitle="Member profiles, memberships and add-on services"
        actions={create.show && (
          <span title={create.reason}>
            <Button icon={<Icon name="plus" className="h-4 w-4" />} disabled={create.disabled}
              onClick={() => navigate("/members/new")}>
              Add member
            </Button>
          </span>
        )}
      />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        loading={members.isLoading}
        fetching={members.isFetching}
        getRowId={(m) => m.id}
        onRowClick={(m) => navigate(`/members/${m.id}`)}
        rowClassName={(m) =>
          m.membership_state === "EXPIRED" ? ROW_MARKER.expired
            : m.membership_state === "EXPIRING" ? ROW_MARKER.nearExpiry : undefined}
        emptyIcon="users"
        emptyMessage={filtered ? "No members match these filters"
          : tab === "absent" ? "Everyone with a running membership came recently" : "No members yet"}
        emptyHint={filtered ? "Try a different search or clear the filters."
          : tab === "absent" ? `Members show here after ${desk.data?.absent_alert_days ?? 7} days without a visit (Configuration).`
            : canCreate ? "Add your first member to get started." : undefined}
        sorting={list.sorting}
        pagination={paginationProps(list, data?.total)}
        toolbar={
          <>
            <FilterTabs value={tab} onChange={setTab}
              tabs={MEMBER_FILTERS.map((f) => ({ value: f, label: TAB_LABEL[f], count: counts.data?.[f] }))} />
            <ListToolbar
              search={{ value: list.search, onChange: list.setSearch, placeholder: "Search name, phone or reg ID" }}
              filters={
                <>
                  <FilterSelect placeholder="All plans" ariaLabel="Plan" value={planId} onChange={setPlanId} options={planOptions} />
                  <FilterSelect placeholder="Any gender" ariaLabel="Gender" value={gender} className="min-w-[130px]"
                    onChange={(v) => setGender(v as Gender | "")}
                    options={GENDERS.map((g) => ({ value: g, label: humanize(g) }))} />
                  <DateRangeFilter label="Joined" from={joined.from} to={joined.to} onChange={(from, to) => setJoined({ from, to })} />
                </>
              }
              active={active}
            />
          </>
        }
      />

      {addonFor && <AddonServiceDrawer member={addonFor} onClose={() => setAddonFor(null)} />}
      {treeFor && <MemberReferralsDrawer memberId={treeFor} onClose={() => setTreeFor(null)} />}
      {renewFor && (
        <RenewDrawer onClose={() => setRenewFor(null)}
          row={{ member_id: renewFor.id, member_name: renewFor.name, registration_id: renewFor.registration_id,
            plan_name: renewFor.current_plan_name ?? "No plan" }} />
      )}
    </div>
  );
}
