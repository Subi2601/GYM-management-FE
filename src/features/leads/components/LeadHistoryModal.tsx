import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate, formatDateTime } from "@/lib/format";
import { LEAD_NOTE_SEPARATOR, type Lead } from "@/types/lead";

interface NoteEntry {
  date: string | null;
  text: string;
}

/** Split the notes column into entries; follow-ups are stored as "YYYY-MM-DD: note". */
function parseNotes(notes: string | null): NoteEntry[] {
  if (!notes) return [];
  return notes
    .split(LEAD_NOTE_SEPARATOR)
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => {
      const m = /^(\d{4}-\d{2}-\d{2}):\s*([\s\S]*)$/.exec(raw);
      return m ? { date: m[1] ?? null, text: m[2] ?? "" } : { date: null, text: raw };
    });
}

/** Read-only lead details + notes / follow-up timeline. */
export function LeadHistoryModal({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  const entries = parseNotes(lead?.notes ?? null);
  const info: [string, string][] = lead ? [
    ["Phone", lead.phone],
    ["Location", lead.location ?? "—"],
    ["Goal", lead.goal ?? "—"],
    ["Plan to Join", formatDate(lead.plan_to_join_date)],
    ["Next Follow-up", formatDate(lead.next_follow_up_date)],
    ["Last Follow-up", formatDate(lead.last_follow_up_date)],
    ["Created", formatDateTime(lead.created_at)],
  ] : [];

  return (
    <Modal open={lead !== null} title={lead ? `${lead.name} — Notes & History` : ""} onClose={onClose} width="640px">
      {lead && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-line bg-subtle p-5 max-sm:grid-cols-1">
            <div className="col-span-2 flex items-center gap-3 max-sm:col-span-1">
              <span className="form-label">Status</span>
              <StatusBadge value={lead.status} />
            </div>
            {info.map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5">
                <span className="text-[11px] font-bold uppercase text-muted">{label}</span>
                <span className="text-sm font-semibold text-ink">{value}</span>
              </div>
            ))}
          </div>

          <h4 className="m-0 mb-3 text-xs font-bold uppercase text-secondary-grey">Notes / History</h4>
          {entries.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-line bg-subtle p-6 text-center text-sm italic text-muted">
              No notes recorded yet.
            </div>
          ) : (
            <ol className="relative m-0 list-none border-l-2 border-line p-0 pl-5">
              {entries.map((e, i) => (
                <li key={i} className="relative mb-4 last:mb-0">
                  <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-accent shadow-[0_0_0_2px_#fecdd3]" />
                  <div className="text-[11px] font-bold uppercase tracking-wide text-muted">
                    {e.date ? formatDate(e.date) : "Initial note"}
                  </div>
                  <div className="whitespace-pre-wrap text-sm font-medium text-ink">{e.text}</div>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </Modal>
  );
}
