import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Drawer } from "@/components/ui/Modal";
import { FormDivider, InfoRow } from "@/components/ui/Section";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { trainingApi, trainingKeys } from "@/features/training/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useBranchStore } from "@/stores/branch-store";
import type { PTSubscription } from "@/types/training";

function VerifyChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span title={`${label}: ${ok ? "verified" : "not verified"}`}
      className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold",
        ok ? "bg-success-soft text-success" : "bg-hover text-muted")}>
      <Icon name={ok ? "check" : "x"} className="h-3 w-3" strokeWidth={3} />
      {label}
    </span>
  );
}

/** "Session history" — subscription summary and the logged sessions, newest first as the API returns them. */
export function SessionHistoryDrawer({ pt, onClose }: { pt: PTSubscription; onClose: () => void }) {
  const branch = useBranchStore((s) => s.selectedBranchId);
  const history = useQuery({
    queryKey: trainingKeys.sessions(branch, pt.id),
    queryFn: async () => (await trainingApi.sessions(pt.id)).data,
  });
  const logs = history.data ?? [];

  const summary = [
    { label: "Total", value: pt.total_sessions, className: "text-ink" },
    { label: "Completed", value: pt.sessions_used, className: "text-ink" },
    { label: "Remaining", value: pt.sessions_remaining, className: pt.sessions_remaining === 0 ? "text-danger" : "text-info" },
  ];

  return (
    <Drawer
      open
      title="Session history"
      subtitle={`${pt.member_name} · ${pt.registration_id}`}
      onClose={onClose}
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      <div className="grid grid-cols-3 gap-3">
        {summary.map((s) => (
          <div key={s.label} className="rounded-xl border border-line bg-subtle px-3 py-3 text-center">
            <div className="text-xs font-semibold text-muted">{s.label}</div>
            <div className={cn("mt-0.5 text-xl font-extrabold", s.className)}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <InfoRow label="Plan" value={pt.plan_name} />
        <InfoRow label="Trainer" value={pt.trainer_name} />
        <InfoRow label="Start" value={formatDate(pt.start_date)} />
        <InfoRow label="Expiry" value={formatDate(pt.expiry_date)} />
        <InfoRow label="Status" value={<StatusBadge value={pt.status} />} />
        <InfoRow label="Payment" value={<StatusBadge value={pt.is_paid ? "PAID" : "PENDING"} label={pt.is_paid ? "Paid" : "Unpaid"} />} />
      </div>

      <FormDivider className="mt-7">Logged sessions</FormDivider>
      {history.isLoading && <p className="m-0 py-8 text-center text-sm text-muted">Loading sessions…</p>}
      {!history.isLoading && logs.length === 0 && (
        <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-line bg-subtle px-6 py-10 text-center">
          <Icon name="clock" className="mb-2 h-6 w-6 text-muted" />
          <p className="m-0 text-sm font-bold text-ink">
            {history.isError ? "Failed to load session history" : "No sessions logged yet"}
          </p>
        </div>
      )}
      <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
        {logs.map((log) => (
          <li key={log.id} className="rounded-xl border border-line bg-surface px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-ink">{formatDate(log.session_date)}</div>
                <div className="text-xs text-muted">{log.trainer_name}</div>
              </div>
              <span className="whitespace-nowrap text-xs font-semibold text-muted">
                {log.sessions_remaining_after} left
              </span>
            </div>
            <div className="mt-2 flex gap-1.5">
              <VerifyChip ok={log.trainer_verified} label="Trainer" />
              <VerifyChip ok={log.client_verified} label="Client" />
            </div>
            {log.notes && <p className="m-0 mt-2 whitespace-pre-line text-[13px] text-secondary-grey">{log.notes}</p>}
          </li>
        ))}
      </ol>
    </Drawer>
  );
}
