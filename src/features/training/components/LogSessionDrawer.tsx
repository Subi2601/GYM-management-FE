import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Drawer } from "@/components/ui/Modal";
import { FormDivider, GRID_2 } from "@/components/ui/Section";
import { useTrainerLookup } from "@/features/lookups/api";
import { trainingApi, trainingKeys } from "@/features/training/api";
import { formatDate, todayISO } from "@/lib/format";
import { notify } from "@/lib/notify";
import { useBranchStore } from "@/stores/branch-store";
import type { PTSubscription } from "@/types/training";

const FORM_ID = "pt-log-session-form";

const schema = z.object({
  trainer_id: z.string().uuid("Select a trainer"),
  session_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Select a date"),
  trainer_verified: z.boolean(),
  client_verified: z.boolean(),
  notes: z.string().trim().max(1000, "Max 1000 characters"),
});
type FormValues = z.infer<typeof schema>;

/** "Log session" — date, trainer, notes and the trainer / client verification ticks. */
export function LogSessionDrawer({ pt, onClose }: { pt: PTSubscription; onClose: () => void }) {
  const qc = useQueryClient();
  const branch = useBranchStore((s) => s.selectedBranchId);
  const trainers = useTrainerLookup();
  const today = todayISO();

  // Same date bounds as the backend: not in the future, not before the PT start date.
  const refined = useMemo(() => schema.superRefine((v, ctx) => {
    if (v.session_date > today) {
      ctx.addIssue({ code: "custom", path: ["session_date"], message: "Session date cannot be in the future" });
    }
    if (v.session_date < pt.start_date) {
      ctx.addIssue({ code: "custom", path: ["session_date"], message: `Cannot be before the PT start date (${formatDate(pt.start_date)})` });
    }
  }), [pt.start_date, today]);

  const { register, control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(refined),
    defaultValues: { trainer_id: pt.trainer_id ?? "", session_date: today, trainer_verified: true,
      client_verified: false, notes: "" },
  });

  const log = useMutation({
    mutationFn: (v: FormValues) => trainingApi.logSession(pt.id, {
      trainer_id: v.trainer_id,
      session_date: v.session_date,
      trainer_verified: v.trainer_verified,
      client_verified: v.client_verified,
      notes: v.notes || null,
    }),
    onSuccess: async (res) => {
      notify.success(res.message);
      onClose();
      await qc.invalidateQueries({ queryKey: trainingKeys.all(branch) });
    },
    onError: notify.error,
  });

  return (
    <Drawer
      open
      title="Log session"
      subtitle={`${pt.member_name} · ${pt.registration_id} · ${pt.sessions_remaining} of ${pt.total_sessions} sessions left`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form={FORM_ID} loading={log.isPending}>Log session</Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit((v) => log.mutate(v))} noValidate>
        <FormDivider>Session</FormDivider>
        <div className={GRID_2}>
          <Field label="Session date" htmlFor="pt-session-date" required error={errors.session_date?.message}>
            <Input id="pt-session-date" type="date" max={today} min={pt.start_date}
              invalid={!!errors.session_date} {...register("session_date")} />
          </Field>
          <Field label="Trainer" htmlFor="pt-trainer" required error={errors.trainer_id?.message}>
            {/* Controlled: the options arrive after the default (current trainer) is set. */}
            <Controller control={control} name="trainer_id" render={({ field }) => (
              <Select id="pt-trainer" invalid={!!errors.trainer_id} value={field.value}
                onChange={field.onChange} onBlur={field.onBlur} ref={field.ref}>
                <option value="">{trainers.isLoading ? "Loading trainers…" : "Select a trainer"}</option>
                {(trainers.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.employee_code})</option>
                ))}
              </Select>
            )} />
          </Field>
        </div>
        <Field className="mt-4" label="Notes" htmlFor="pt-notes" error={errors.notes?.message}>
          <Textarea id="pt-notes" rows={3} placeholder="Session details, exercises covered…"
            invalid={!!errors.notes} {...register("notes")} />
        </Field>

        <FormDivider>Verification</FormDivider>
        <div className="flex flex-col gap-3 rounded-xl border border-line bg-subtle p-4">
          <Controller control={control} name="trainer_verified" render={({ field }) => (
            <Checkbox checked={field.value} onChange={field.onChange} label="Trainer verified" />
          )} />
          <Controller control={control} name="client_verified" render={({ field }) => (
            <Checkbox checked={field.value} onChange={field.onChange} label="Client verified (OTP / signature)" />
          )} />
        </div>
      </form>
    </Drawer>
  );
}
