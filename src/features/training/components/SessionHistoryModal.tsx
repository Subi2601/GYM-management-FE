import { useQuery } from "@tanstack/react-query";

import { Modal } from "@/components/ui/Modal";
import { trainingApi, trainingKeys } from "@/features/training/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useBranchStore } from "@/stores/branch-store";
import type { PTSubscription } from "@/types/training";

function VerifyBadge({ ok, letter, title }: { ok: boolean; letter: string; title: string }) {
  return (
    <span title={`${title}: ${ok ? "Verified" : "Not verified"}`}
      className={cn("flex h-[22px] w-[22px] items-center justify-center rounded text-[11px] font-bold",
        ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
      {letter}
    </span>
  );
}

/** "Session History" — summary strip + logged sessions table. */
export function SessionHistoryModal({ pt, onClose }: { pt: PTSubscription | null; onClose: () => void }) {
  const branch = useBranchStore((s) => s.selectedBranchId);
  const history = useQuery({
    queryKey: trainingKeys.sessions(branch, pt?.id ?? ""),
    queryFn: async () => (await trainingApi.sessions(pt!.id)).data,
    enabled: pt !== null,
  });
  const logs = history.data ?? [];

  const summary = [
    { label: "Total Sessions", value: pt?.total_sessions ?? 0, highlight: false },
    { label: "Completed", value: pt?.sessions_used ?? 0, highlight: false },
    { label: "Remaining", value: pt?.sessions_remaining ?? 0, highlight: true },
  ];

  return (
    <Modal open={pt !== null} title={`Session History: ${pt?.member_name ?? ""}`} onClose={onClose}>
      <div className="mb-8 grid grid-cols-3 gap-4 rounded-[10px] bg-subtle p-4">
        {summary.map((s) => (
          <div key={s.label} className="flex flex-col items-center text-center">
            <span className="text-[13px] uppercase tracking-[0.025em] text-muted">{s.label}</span>
            <span className={cn("text-xl font-bold", s.highlight ? "text-info" : "text-ink")}>{s.value}</span>
          </div>
        ))}
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              {["Date", "Trainer", "Verification", "Remaining"].map((h) => (
                <th key={h} className="sticky top-0 border-b-2 border-line-light bg-surface p-3 text-[13px] font-semibold text-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.isLoading && (
              <tr><td colSpan={4} className="p-12 text-center italic text-muted">Loading sessions…</td></tr>
            )}
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="border-b border-line-light p-3 align-top text-sm">{formatDate(log.session_date)}</td>
                <td className="border-b border-line-light p-3 align-top text-sm">
                  {log.trainer_name}
                  {log.notes && <div className="mt-1 text-xs italic text-muted">{log.notes}</div>}
                </td>
                <td className="border-b border-line-light p-3 align-top">
                  <div className="flex gap-1.5">
                    <VerifyBadge ok={log.trainer_verified} letter="T" title="Trainer" />
                    <VerifyBadge ok={log.client_verified} letter="C" title="Client" />
                  </div>
                </td>
                <td className="border-b border-line-light p-3 align-top text-sm">{log.sessions_remaining_after}</td>
              </tr>
            ))}
            {!history.isLoading && logs.length === 0 && (
              <tr><td colSpan={4} className="p-12 text-center italic text-muted">
                {history.isError ? "Failed to load session history." : "No sessions logged yet."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
