import { Drawer } from "@/components/ui/Modal";
import { FormDivider, GRID_2, InfoRow } from "@/components/ui/Section";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { goalLabel } from "@/features/lookups/fitness-goals";
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

/** Read-only lead details + notes / follow-up timeline (newest entry last, as stored). */
export function LeadHistoryDrawer({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  const entries = parseNotes(lead?.notes ?? null);

  return (
    <Drawer
      open={lead !== null}
      title={lead?.name ?? ""}
      subtitle={lead ? `${lead.phone} · Added ${formatDateTime(lead.created_at)}` : undefined}
      onClose={onClose}
    >
      {lead && (
        <>
          <FormDivider>Details</FormDivider>
          <div className={GRID_2}>
            <InfoRow label="Status" value={<StatusBadge value={lead.status} />} />
            <InfoRow label="Goal" value={goalLabel(lead.goal)} />
            <InfoRow label="Location" value={lead.location} />
            <InfoRow label="Plan to join" value={lead.plan_to_join_date ? formatDate(lead.plan_to_join_date) : null} />
            <InfoRow label="Next follow-up" value={lead.next_follow_up_date ? formatDate(lead.next_follow_up_date) : null} />
            <InfoRow label="Last follow-up" value={lead.last_follow_up_date ? formatDate(lead.last_follow_up_date) : null} />
          </div>

          <FormDivider>Notes &amp; history</FormDivider>
          {entries.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-line bg-subtle p-6 text-center text-sm text-muted">
              No notes recorded yet.
            </div>
          ) : (
            <ol className="relative m-0 ml-1.5 list-none border-l-2 border-line p-0 pl-5">
              {entries.map((e, i) => (
                <li key={i} className="relative mb-5 last:mb-0">
                  <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-surface bg-accent ring-2 ring-accent/25" />
                  <div className="text-xs font-semibold text-muted">
                    {e.date ? formatDate(e.date) : "Initial note"}
                  </div>
                  <div className="mt-0.5 whitespace-pre-wrap text-sm font-medium text-ink">{e.text}</div>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </Drawer>
  );
}
