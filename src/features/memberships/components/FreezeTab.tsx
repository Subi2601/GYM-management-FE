import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { confirm } from "@/components/ui/ConfirmDialog";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { GRID_2 } from "@/components/ui/Section";
import { membershipApi, useInvalidateMembership } from "@/features/memberships/api";
import { Blocked, DocumentField, DocumentLink, Stat } from "@/features/memberships/components/ActionFields";
import { addDaysISO, formatDate, todayISO } from "@/lib/format";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import type { DocumentUpload, MembershipActions } from "@/types/membership";

export const FREEZE_FORM = "freeze-form";
const BACKDATE_DAYS = 30;            // same as the backend

const schema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the first frozen day"),
  days: z.coerce.number({ invalid_type_error: "Enter the days" }).int("Whole days").min(1, "At least 1 day"),
  reason: z.string().trim().min(3, "Write why (e.g. accident, pregnancy, travel)").max(1000, "Max 1000 characters"),
  document: z.custom<DocumentUpload | null>(),
});
type Values = z.infer<typeof schema>;

/** Freeze: pause the membership for some days (they're added to the end), resume early, and the member's own
 *  allowance when the gym gives them more (or only them) freeze days. */
export function FreezeTab({ info, onSubmitting }: { info: MembershipActions; onSubmitting: (busy: boolean) => void }) {
  const invalidate = useInvalidateMembership();
  const current = info.current!;
  const f = info.freeze!;
  const today = todayISO();
  const earliest = [current.start_date, addDaysISO(today, -BACKDATE_DAYS)].sort().at(-1)!;
  const [allowance, setAllowance] = useState<string>(f.custom_allowance ? String(f.allowance_days) : "");

  const { register, control, handleSubmit, watch, reset, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { start_date: today < current.start_date ? current.start_date : today, days: Math.min(7, f.remaining_days) || 1,
      reason: "", document: null },
  });
  const start = watch("start_date");
  const days = Number(watch("days")) || 0;

  const done = { onSuccess: async (res: { message: string | null }) => { notify.success(res.message); await invalidate(); },
    onError: notify.error };
  const freeze = useMutation({
    mutationFn: (v: Values) => membershipApi.freeze(current.subscription_id, { ...v, reason: v.reason.trim() }),
    ...done,
    onSuccess: async (res) => { notify.success(res.message); reset(); await invalidate(); },
    onSettled: () => onSubmitting(false),
  });
  const resume = useMutation({ mutationFn: (id: string) => membershipApi.resume(id), ...done });
  const saveAllowance = useMutation({
    mutationFn: (value: number | null) => membershipApi.setAllowance(current.subscription_id, value), ...done,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-subtle p-4 sm:grid-cols-4">
        <Stat label="Allowed" value={`${f.allowance_days} days`} />
        <Stat label="Used" value={`${f.used_days} days`} />
        <Stat label="Left" value={`${f.remaining_days} days`} tone={f.remaining_days ? "text-success" : "text-danger"} />
        <Stat label="Times" value={`${f.times_used} of ${f.max_times}`} />
      </div>

      {f.active && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-info/30 bg-info-soft/40 px-4 py-3">
          <div className="min-w-0 text-sm">
            <div className="font-bold text-ink">{f.active.state === "ACTIVE" ? "Frozen now" : "Freeze booked"}</div>
            <div className="text-xs text-muted">{formatDate(f.active.start_date)} → {formatDate(f.active.end_date)} · {f.active.reason}</div>
          </div>
          <Button variant="secondary" loading={resume.isPending}
            onClick={async () => {
              if (await confirm(f.active!.state === "ACTIVE"
                ? "Resume the membership today? The unused freeze days come off the end date."
                : "Cancel this booked freeze?")) resume.mutate(f.active!.id);
            }}>
            {f.active.state === "ACTIVE" ? "Resume today" : "Cancel freeze"}
          </Button>
        </div>
      )}

      {!f.allowed ? <Blocked>{f.reason}</Blocked> : (
        <form id={FREEZE_FORM} noValidate onSubmit={handleSubmit(async (v) => {
          if (v.days > f.remaining_days) return notify.errorText(`Only ${f.remaining_days} freeze day(s) left`);
          if (await confirm(`Freeze ${current.plan_name} for ${v.days} day(s)? The end date moves by ${v.days} day(s).`)) {
            onSubmitting(true);
            freeze.mutate(v);
          }
        })} className="flex flex-col gap-4">
          <div className={GRID_2}>
            <Field label="From" htmlFor="fz-start" required error={errors.start_date?.message} hint="Can be a past day">
              <Input id="fz-start" type="date" min={earliest} max={current.end_date} {...register("start_date")} />
            </Field>
            <Field label="Days" htmlFor="fz-days" required error={errors.days?.message}
              hint={start && days > 0 ? `Till ${formatDate(addDaysISO(start, days - 1))} · ${f.remaining_days} left` : `${f.remaining_days} left`}>
              <Input id="fz-days" type="number" inputMode="numeric" min={1} max={f.remaining_days} {...register("days")} />
            </Field>
          </div>
          <Field label="Reason" htmlFor="fz-reason" required error={errors.reason?.message}>
            <Textarea id="fz-reason" rows={2} placeholder="Accident, pregnancy, surgery, travel…" {...register("reason")} />
          </Field>
          <Controller name="document" control={control} render={({ field }) => (
            <DocumentField id="fz-doc" value={field.value} onChange={field.onChange} />
          )} />
          {start && days > 0 && (
            <p className="m-0 text-xs text-muted">New end date: <b className="text-ink">{formatDate(addDaysISO(current.end_date, days))}</b>.
              Check-in is blocked while frozen.</p>
          )}
        </form>
      )}

      <div className="rounded-xl border border-line px-4 py-3">
        <div className="text-sm font-bold text-ink">This member's own freeze days</div>
        <p className="m-0 mt-0.5 text-xs text-muted">
          Gym default is {f.gym_days} day(s){f.gym_days === 0 ? " (only members given their own days can freeze)" : ""}.
          Give this member a different number, e.g. for pregnancy or surgery.
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <Input type="number" inputMode="numeric" min={f.used_days} className="w-28" placeholder={String(f.gym_days)}
            value={allowance} onChange={(e) => setAllowance(e.target.value)} aria-label="Member's freeze days" />
          <Button variant="secondary" loading={saveAllowance.isPending} disabled={allowance === ""}
            onClick={() => saveAllowance.mutate(Number(allowance))}>Save</Button>
          {f.custom_allowance && (
            <Button variant="secondary" disabled={saveAllowance.isPending}
              onClick={() => { setAllowance(""); saveAllowance.mutate(null); }}>Use gym days</Button>
          )}
        </div>
      </div>

      {info.freezes.length > 0 && (
        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Freezes</div>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {info.freezes.map((z) => (
              <li key={z.id} className="rounded-lg border border-line px-3 py-2 text-xs">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-semibold text-ink">{formatDate(z.start_date)} → {formatDate(z.end_date)} · {z.days} day(s)</span>
                  <span className={cn("font-semibold", z.state === "ACTIVE" ? "text-info" : "text-muted")}>
                    {z.state === "ACTIVE" ? "Frozen now" : z.state === "UPCOMING" ? "Booked" : z.resumed_on ? `Resumed ${formatDate(z.resumed_on)}` : "Done"}
                  </span>
                </div>
                <div className="text-muted">{z.reason}</div>
                {z.document_id && <DocumentLink id={z.document_id} name={z.document_name ?? "Proof"} />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
