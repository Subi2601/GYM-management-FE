import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { ActionGroup, DataTable, ROW_MARKER } from "@/components/ui/DataTable";
import { FilterTabs, ListToolbar } from "@/components/ui/ListToolbar";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { attendanceApi, attendanceKeys, formatClock, formatDuration } from "@/features/attendance/api";
import { CloseVisitModal } from "@/features/attendance/components/CloseVisitModal";
import { InsideBadge, SourceBadge } from "@/features/attendance/components/SourceBadge";
import { useDebouncedValue, useUrlEnum } from "@/hooks/use-list-state";
import { notify } from "@/lib/notify";
import { useBranchStore } from "@/stores/branch-store";
import type { MemberVisit } from "@/types/attendance";

const VISIT_TABS = ["all", "inside", "left", "denied"] as const;
type VisitTab = (typeof VISIT_TABS)[number];
const TAB_LABEL: Record<VisitTab, string> = { all: "All visits", inside: "Inside", left: "Checked out", denied: "Denied" };

const isDenied = (v: MemberVisit) => v.denied_reason !== null;
const isOpen = (v: MemberVisit) => !isDenied(v) && v.check_out_time === null;
const inTab = (v: MemberVisit, t: VisitTab) =>
  t === "all" || (t === "inside" ? isOpen(v) : t === "left" ? !isDenied(v) && !isOpen(v) : isDenied(v));

interface Props {
  date: string;
  isToday: boolean;
  writable: boolean;
}

/** Members tab: every visit of the day (QR scans + front desk), refused QR check-ins included. */
export function MemberAttendance({ date, isToday, writable }: Props) {
  const qc = useQueryClient();
  const branch = useBranchStore((s) => s.selectedBranchId);
  const [tab, setTab] = useUrlEnum<VisitTab>("visits", VISIT_TABS, "all");
  const [search, setSearch] = useState("");
  const term = useDebouncedValue(search.trim().toLowerCase(), 150);
  const [closing, setClosing] = useState<MemberVisit | null>(null);

  const daily = useQuery({
    queryKey: attendanceKeys.membersDaily(branch, date),
    queryFn: () => attendanceApi.membersDaily(date),
    placeholderData: keepPreviousData,
    refetchInterval: isToday ? 30_000 : false,
  });

  const checkOut = useMutation({
    mutationFn: (visitId: string) => attendanceApi.closeVisit(visitId),
    onSuccess: async (res) => {
      notify.success(res.message);
      await qc.invalidateQueries({ queryKey: attendanceKeys.all });
    },
    onError: notify.error,
  });

  const records = useMemo(() => daily.data?.data.records ?? [], [daily.data]);
  const summary = daily.data?.data.summary;
  const rows = useMemo(() => records.filter((v) => inTab(v, tab) && (!term
    || v.member_name.toLowerCase().includes(term) || v.registration_id.toLowerCase().includes(term)
    || v.phone.includes(term))), [records, tab, term]);

  const columns: ColumnDef<MemberVisit, unknown>[] = [
    { accessorKey: "member_name", header: "Member",
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="truncate font-semibold text-ink">{row.original.member_name}</div>
          <div className="font-mono text-xs text-muted">{row.original.registration_id} · {row.original.phone}</div>
        </div>
      ) },
    { accessorKey: "check_in_time", header: "In", meta: { width: "95px" },
      cell: ({ row }) => formatClock(row.original.check_in_time) },
    { accessorKey: "check_out_time", header: "Out", meta: { width: "120px" },
      cell: ({ row }) => {
        const v = row.original;
        if (isDenied(v)) return <span className="text-muted">—</span>;
        if (v.check_out_time) return formatClock(v.check_out_time);
        return isToday ? <InsideBadge /> : <StatusBadge value="NO_CHECKOUT" tone="amber" label="No checkout" />;
      } },
    { id: "duration", header: "Duration", meta: { width: "95px" },
      cell: ({ row }) => formatDuration(row.original.duration_minutes) },
    { id: "source", header: "Source", meta: { width: "190px" },
      cell: ({ row }) => {
        const v = row.original;
        if (isDenied(v)) {
          return (
            <div className="flex flex-col items-start gap-1">
              <StatusBadge value="DENIED" tone="red" label="Denied" />
              <span className="text-xs text-muted">{v.denied_reason}</span>
            </div>
          );
        }
        return <SourceBadge source={v.in_source} />;
      } },
    {
      id: "actions", header: "Actions", meta: { width: "130px" },
      cell: ({ row }) => {
        const v = row.original;
        if (!writable || !isOpen(v)) return null;
        return (
          <ActionGroup>
            <Button variant="secondary" className="h-8 px-3 py-0 text-xs"
              loading={checkOut.isPending && checkOut.variables === v.id} disabled={checkOut.isPending}
              onClick={() => (isToday ? checkOut.mutate(v.id) : setClosing(v))}>
              Check out
            </Button>
          </ActionGroup>
        );
      },
    },
  ];

  const filtered = !!term || tab !== "all";

  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Inside now" value={summary?.inside} icon="logIn" tone="success"
          hint={isToday ? "Checked in, not out yet" : "Never checked out"} />
        <StatCard label="Members today" value={summary?.checked_in} icon="users" tone="info" hint="Different members" />
        <StatCard label="Visits" value={summary?.visits} icon="activity" tone="neutral" hint="Morning + evening count twice" />
        <StatCard label="Denied" value={summary?.denied} icon="ban" tone="accent" hint="Expired / no membership" />
      </div>

      <DataTable
        columns={columns}
        data={rows}
        loading={daily.isLoading}
        fetching={daily.isFetching}
        getRowId={(v) => v.id}
        rowClassName={(v) => (isDenied(v) ? ROW_MARKER.rejected : isOpen(v) ? ROW_MARKER.joined : undefined)}
        emptyIcon="users"
        emptyMessage={filtered && records.length > 0 ? "No visits match these filters" : "No member visits on this date"}
        emptyHint={filtered && records.length > 0 ? "Try a different search or tab."
          : "Members appear here when they scan the CHECK IN QR or you check them in."}
        maxHeightClass="max-h-[calc(100vh-420px)]"
        toolbar={
          <>
            <FilterTabs value={tab} onChange={setTab}
              tabs={VISIT_TABS.map((t) => ({ value: t, label: TAB_LABEL[t],
                count: daily.data ? records.filter((v) => inTab(v, t)).length : undefined }))} />
            <ListToolbar search={{ value: search, onChange: setSearch, placeholder: "Search name, member ID or phone" }} />
          </>
        }
      />

      {closing && <CloseVisitModal visit={closing} onClose={() => setClosing(null)} />}
    </>
  );
}
