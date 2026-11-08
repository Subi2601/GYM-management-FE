import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { confirm } from "@/components/ui/ConfirmDialog";
import { ActionIcon } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/Icon";
import { Section } from "@/components/ui/Section";
import { type Assessment, assessmentApi, LIFESTYLE_LABEL, MOVEMENT_LABEL, type MovementTest, useAssessments,
  useInvalidateAssessments } from "@/features/members/assessment-api";
import { AssessmentDrawer } from "@/features/members/components/AssessmentDrawer";
import { useWriteAccess } from "@/hooks/use-write-access";
import { formatDate } from "@/lib/format";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";

const RATING_TONE = { GOOD: "bg-success-soft text-success", FAIR: "bg-warning-soft text-warning", POOR: "bg-danger-soft text-danger" };

/** Change since the previous assessment, e.g. "−2.5 kg". */
function Delta({ now, before, unit, lowerIsBetter = true }: { now: number | null; before: number | null; unit: string; lowerIsBetter?: boolean }) {
  if (now == null || before == null || now === before) return null;
  const diff = Math.round((now - before) * 10) / 10;
  const good = lowerIsBetter ? diff < 0 : diff > 0;
  return <span className={cn("ml-1 text-[11px] font-bold", good ? "text-success" : "text-danger")}>{diff > 0 ? "+" : ""}{diff}{unit}</span>;
}

function Figure({ label, value, children }: { label: string; value: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-0.5 text-sm font-bold text-ink">{value ?? "—"}{children}</div>
    </div>
  );
}

/** Client assessments on the member page: the latest in full (with change vs the previous one), older ones listed. */
export function AssessmentSection({ memberId, height, weight }: { memberId: string; height?: number | null; weight?: number | null }) {
  const list = useAssessments(memberId);
  const write = useWriteAccess("member:update");
  const invalidate = useInvalidateAssessments();
  const [editing, setEditing] = useState<Assessment | null | undefined>(undefined);
  const remove = useMutation({
    mutationFn: (id: string) => assessmentApi.remove(id),
    onSuccess: async (res) => { notify.success(res.message); await invalidate(); },
    onError: notify.error,
  });
  const rows = list.data ?? [];
  const [latest, previous] = rows;

  return (
    <Section className="mt-5" title="Client assessment" description="Vitals, lifestyle, injuries and movement — repeat it to track progress"
      aside={write.show && (
        <span title={write.reason} className="inline-flex">
          <Button icon={<Icon name="plus" className="h-4 w-4" />} disabled={write.disabled} onClick={() => setEditing(null)}>
            New assessment
          </Button>
        </span>
      )}>
      {list.isLoading ? <p className="m-0 text-sm text-muted">Loading…</p>
        : !latest ? <p className="m-0 text-sm text-muted">No assessment yet. Take one at joining to plan training safely.</p>
          : (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-line p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-bold text-ink">
                    Latest · {formatDate(latest.assessed_on)}
                    {latest.assessed_by_name && <span className="font-normal text-muted"> · by {latest.assessed_by_name}</span>}
                  </div>
                  {write.show && <ActionIcon kind="edit" disabled={write.disabled} disabledReason={write.reason} onClick={() => setEditing(latest)} />}
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Figure label="Weight" value={latest.weight_kg != null ? `${latest.weight_kg} kg` : null}>
                    {previous && <Delta now={latest.weight_kg} before={previous.weight_kg} unit=" kg" />}
                  </Figure>
                  <Figure label="BMI" value={latest.bmi}>{previous && <Delta now={latest.bmi} before={previous.bmi} unit="" />}</Figure>
                  <Figure label="Body fat" value={latest.body_fat_percent != null ? `${latest.body_fat_percent}%` : null}>
                    {previous && <Delta now={latest.body_fat_percent} before={previous.body_fat_percent} unit="%" />}
                  </Figure>
                  <Figure label="Waist" value={latest.waist_cm != null ? `${latest.waist_cm} cm` : null}>
                    {previous && <Delta now={latest.waist_cm} before={previous.waist_cm} unit=" cm" />}
                  </Figure>
                  <Figure label="Resting HR" value={latest.resting_heart_rate != null ? `${latest.resting_heart_rate} bpm` : null} />
                  <Figure label="Blood pressure" value={latest.bp_systolic != null ? `${latest.bp_systolic}/${latest.bp_diastolic}` : null} />
                  <Figure label="Height" value={latest.height_cm != null ? `${latest.height_cm} cm` : null} />
                  <Figure label="Activity" value={latest.lifestyle ? LIFESTYLE_LABEL[latest.lifestyle].split(" (")[0] : null} />
                </div>
                {(latest.medical_conditions || latest.past_injuries || latest.surgeries) && (
                  <div className="mt-3 rounded-lg bg-danger-soft/50 px-3 py-2 text-xs text-ink">
                    {latest.medical_conditions && <div><b>Conditions:</b> {latest.medical_conditions}</div>}
                    {latest.past_injuries && <div><b>Injuries:</b> {latest.past_injuries}</div>}
                    {latest.surgeries && <div><b>Surgeries:</b> {latest.surgeries}</div>}
                  </div>
                )}
                {Object.keys(latest.movements).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(Object.entries(latest.movements) as [MovementTest, keyof typeof RATING_TONE][]).map(([t, r]) => (
                      <span key={t} className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", RATING_TONE[r])}>
                        {MOVEMENT_LABEL[t]}: {r === "GOOD" ? "Good" : r === "FAIR" ? "Fair" : "Poor"}
                      </span>
                    ))}
                  </div>
                )}
                {(latest.static_notes || latest.dynamic_notes || latest.notes) && (
                  <div className="mt-3 flex flex-col gap-1 text-xs text-secondary-grey">
                    {latest.static_notes && <div><b className="text-ink">Posture:</b> {latest.static_notes}</div>}
                    {latest.dynamic_notes && <div><b className="text-ink">Movement:</b> {latest.dynamic_notes}</div>}
                    {latest.notes && <div><b className="text-ink">Notes:</b> {latest.notes}</div>}
                  </div>
                )}
              </div>
              {rows.length > 1 && (
                <div>
                  <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Earlier</div>
                  <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                    {rows.slice(1).map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-xs">
                        <span className="font-semibold text-ink">{formatDate(a.assessed_on)}</span>
                        <span className="text-muted">
                          {[a.weight_kg != null && `${a.weight_kg} kg`, a.bmi != null && `BMI ${a.bmi}`,
                            a.body_fat_percent != null && `${a.body_fat_percent}% fat`].filter(Boolean).join(" · ") || "—"}
                        </span>
                        {write.show && (
                          <span className="inline-flex gap-1">
                            <ActionIcon kind="edit" disabled={write.disabled} disabledReason={write.reason} onClick={() => setEditing(a)} />
                            <ActionIcon kind="delete" disabled={write.disabled} disabledReason={write.reason}
                              onClick={async () => { if (await confirm(`Delete the assessment of ${formatDate(a.assessed_on)}?`)) remove.mutate(a.id); }} />
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
      {editing !== undefined && (
        <AssessmentDrawer memberId={memberId} assessment={editing} height={height ?? null} weight={weight ?? null}
          onClose={() => setEditing(undefined)} />
      )}
    </Section>
  );
}
