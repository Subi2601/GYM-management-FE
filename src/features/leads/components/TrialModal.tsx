import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { confirm } from "@/components/ui/ConfirmDialog";
import { Field, Input, Select } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { leadApi, useInvalidateLeads } from "@/features/leads/api";
import { useDeskSettings } from "@/features/settings/api";
import { PAYMENT_MODE_LABEL } from "@/features/subscriptions/lib/billing";
import { useWriteAccess } from "@/hooks/use-write-access";
import { addDaysISO, formatDate, formatINR, todayISO } from "@/lib/format";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { PAYMENT_MODES, type PaymentMode } from "@/types/enums";
import type { Lead } from "@/types/lead";
import type { Envelope } from "@/types/api";

// Same window as the backend (TRIAL_BACKDATE_DAYS / TRIAL_AHEAD_DAYS).
const BACKDATE_DAYS = 7;
const AHEAD_DAYS = 30;

const dayDiff = (from: string, to: string) =>
  Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86_400_000);

/** Short trial status for list cells: "Day 2/5", "From 08-11-2026", "Ended · 2 visits". */
export function trialLabel(lead: Lead, today = todayISO()): string | null {
  if (!lead.trial_start || !lead.trial_end) return null;
  if (lead.trial_state === "UPCOMING") return `From ${formatDate(lead.trial_start)}`;
  if (lead.trial_state === "ENDED") return `Ended · ${lead.trial_visits} visit${lead.trial_visits === 1 ? "" : "s"}`;
  return `Day ${dayDiff(lead.trial_start, today) + 1}/${dayDiff(lead.trial_start, lead.trial_end) + 1}`;
}

export const trialFeeDue = (lead: Lead) => !!lead.trial_start && !!lead.trial_fee && !lead.trial_paid_on;

/**
 * A lead's trial class: book it (dates from the gym's trial days), then mark visits and the fee; cancel only while
 * nothing is recorded. Each action adds a dated note to the lead's history.
 */
export function TrialModal({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  const [current, setCurrent] = useState<Lead | null>(lead);
  const today = todayISO();
  const [start, setStart] = useState(today);
  const [mode, setMode] = useState<PaymentMode>("CASH");
  const offer = useDeskSettings(lead !== null);
  const update = useWriteAccess("lead:update");
  const invalidate = useInvalidateLeads();

  useEffect(() => {
    setCurrent(lead);
    setStart(today);
    setMode("CASH");
  }, [lead, today]);

  const done = {
    onSuccess: async (res: Envelope<Lead>) => {
      notify.success(res.message);
      setCurrent(res.data);
      await invalidate();
    },
    onError: notify.error,
  };
  const book = useMutation({ mutationFn: () => leadApi.startTrial(current?.id ?? "", start), ...done });
  const visit = useMutation({ mutationFn: () => leadApi.trialVisit(current?.id ?? ""), ...done });
  const paid = useMutation({ mutationFn: () => leadApi.trialPaid(current?.id ?? "", mode), ...done });
  const cancel = useMutation({ mutationFn: () => leadApi.cancelTrial(current?.id ?? ""), ...done });

  const t = current;
  const days = offer.data?.trial_days ?? 0;
  const fee = offer.data?.trial_fee ?? 0;
  const booked = !!t?.trial_start && !!t.trial_end;
  const minStart = addDaysISO(today, -BACKDATE_DAYS);
  const maxStart = addDaysISO(today, AHEAD_DAYS);
  const startOk = start >= minStart && start <= maxStart;
  const feeDue = t ? trialFeeDue(t) : false;
  const visitedToday = t?.trial_last_visit === today;

  return (
    <Modal
      open={lead !== null}
      title={booked ? "Trial class" : "Book a trial"}
      subtitle={t ? `${t.name} · ${t.phone}` : undefined}
      onClose={onClose}
      footer={
        booked || !offer.data?.trial_enabled ? (
          <Button variant="secondary" onClick={onClose}>Close</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <span title={update.reason}>
              <Button disabled={update.disabled || !startOk} loading={book.isPending} onClick={() => book.mutate()}>
                Book trial
              </Button>
            </span>
          </>
        )
      }
    >
      {!t ? null : booked ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-subtle p-4 text-sm sm:grid-cols-4">
            <Info label="Dates" value={`${formatDate(t.trial_start)} – ${formatDate(t.trial_end)}`} wide />
            <Info label="Status" value={trialLabel(t, today) ?? "—"}
              tone={t.trial_state === "ON" ? "text-success" : t.trial_state === "ENDED" ? "text-muted" : "text-ink"} />
            <Info label="Visits" value={String(t.trial_visits)} />
            <Info label="Fee" wide
              value={!t.trial_fee ? "Free" : t.trial_paid_on
                ? `${formatINR(t.trial_fee, true)} paid ${formatDate(t.trial_paid_on)}${t.trial_payment_mode ? ` (${PAYMENT_MODE_LABEL[t.trial_payment_mode]})` : ""}`
                : `${formatINR(t.trial_fee, true)} due`}
              tone={feeDue ? "text-danger" : undefined} />
          </div>

          {update.show && feeDue && (
            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-warning-line bg-warning-soft p-3">
              <Field label="Collect trial fee" htmlFor="trial-mode" className="min-w-[160px] flex-1">
                <Select id="trial-mode" value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)}>
                  {PAYMENT_MODES.map((m) => <option key={m} value={m}>{PAYMENT_MODE_LABEL[m]}</option>)}
                </Select>
              </Field>
              <span title={update.reason}>
                <Button disabled={update.disabled} loading={paid.isPending} onClick={() => paid.mutate()}>
                  Record {formatINR(t.trial_fee, true)}
                </Button>
              </span>
            </div>
          )}

          {update.show && t.trial_state === "ON" && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-secondary-grey">
                {visitedToday ? "Today's visit is marked." : feeDue ? "Collect the fee to mark visits." : "Came in today?"}
              </span>
              <span title={update.reason}>
                <Button icon={<Icon name="check" className="h-4 w-4" />} loading={visit.isPending}
                  disabled={update.disabled || visitedToday || feeDue} onClick={() => visit.mutate()}>
                  Mark today's visit
                </Button>
              </span>
            </div>
          )}
          {t.trial_state === "ENDED" && (
            <p className="m-0 text-sm text-secondary-grey">The trial is over: call to follow up, then <b className="text-ink">Convert</b> when they join.</p>
          )}

          {update.show && !t.trial_visits && !t.trial_paid_on && (
            <div className="flex items-center justify-between gap-3 border-t border-line pt-3 text-xs text-muted">
              <span>Booked by mistake or wrong dates?</span>
              <Button variant="secondary" className="h-8 px-3 py-0 text-xs" disabled={update.disabled} loading={cancel.isPending}
                onClick={async () => { if (await confirm(`Cancel ${t.name}'s trial?`)) cancel.mutate(); }}>
                Cancel trial
              </Button>
            </div>
          )}
        </div>
      ) : offer.isLoading ? (
        <p className="m-0 text-sm text-muted">Loading…</p>
      ) : !offer.data?.trial_enabled ? (
        <p className="m-0 text-sm text-secondary-grey">Trial classes are switched off. The owner can turn them on in <b className="text-ink">Configuration</b>.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="m-0 text-sm text-secondary-grey">
            {days}-day trial, {fee > 0 ? <>fee <b className="text-ink">{formatINR(fee, true)}</b> (collect at the desk)</> : <b className="text-ink">free</b>}.
            The lead comes back to follow-ups on the last trial day.
          </p>
          <Field label="Starts on" htmlFor="trial-start" required
            error={startOk ? undefined : `Pick a day from ${formatDate(minStart)} to ${formatDate(maxStart)}`}
            hint={startOk ? `Ends ${formatDate(addDaysISO(start, days - 1))}` : undefined}>
            <Input id="trial-start" type="date" value={start} min={minStart} max={maxStart} invalid={!startOk}
              onChange={(e) => setStart(e.target.value)} />
          </Field>
        </div>
      )}
    </Modal>
  );
}

function Info({ label, value, tone, wide }: { label: string; value: string; tone?: string; wide?: boolean }) {
  return (
    <div className={cn("min-w-0", wide && "col-span-2")}>
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</div>
      <div className={cn("mt-0.5 font-semibold", tone ?? "text-ink")}>{value}</div>
    </div>
  );
}
