import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useTrainerLookup } from "@/features/lookups/api";
import { trainingApi, trainingKeys } from "@/features/training/api";
import { formatDate, todayISO } from "@/lib/format";
import { notify } from "@/lib/notify";
import { useBranchStore } from "@/stores/branch-store";
import type { PTSubscription } from "@/types/training";

const schema = z.object({
  trainer_id: z.string().uuid("Select a trainer"),
  session_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Select a date"),
  trainer_verified: z.boolean(),
  client_verified: z.boolean(),
  notes: z.string().trim().max(1000, "Max 1000 characters"),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  pt: PTSubscription | null;
  onClose: () => void;
}

/** "Log PT Session" — trainer, date, verification checkboxes, notes. */
export function LogSessionModal({ pt, onClose }: Props) {
  const qc = useQueryClient();
  const branch = useBranchStore((s) => s.selectedBranchId);
  const trainers = useTrainerLookup(pt !== null);
  const today = todayISO();

  // Same-date bounds as the backend: not in the future, not before the PT start date.
  const refined = schema.superRefine((v, ctx) => {
    if (v.session_date > today) {
      ctx.addIssue({ code: "custom", path: ["session_date"], message: "Session date cannot be in the future" });
    }
    if (pt && v.session_date < pt.start_date) {
      ctx.addIssue({ code: "custom", path: ["session_date"], message: `Cannot be before the PT start date (${formatDate(pt.start_date)})` });
    }
  });

  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(refined),
  });

  useEffect(() => {
    if (pt) {
      reset({ trainer_id: pt.trainer_id ?? "", session_date: todayISO(), trainer_verified: true,
        client_verified: false, notes: "" });
    }
  }, [pt, reset]);

  const log = useMutation({
    mutationFn: (v: FormValues) => trainingApi.logSession(pt!.id, {
      trainer_id: v.trainer_id,
      session_date: v.session_date,
      trainer_verified: v.trainer_verified,
      client_verified: v.client_verified,
      notes: v.notes || null,
    }),
    onSuccess: async (res) => {
      notify.success(res.message);
      close();
      await qc.invalidateQueries({ queryKey: trainingKeys.all(branch) });
    },
    onError: notify.error,
  });

  const close = () => {
    reset();
    onClose();
  };

  return (
    <Modal open={pt !== null} title={`Log PT Session: ${pt?.member_name ?? ""}`} onClose={close} width="600px">
      <form onSubmit={handleSubmit((v) => log.mutate(v))} noValidate>
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Session Date" htmlFor="pt-session-date" required error={errors.session_date?.message}>
            <Input id="pt-session-date" type="date" max={today} min={pt?.start_date}
              invalid={!!errors.session_date} {...register("session_date")} />
          </Field>
          <Field label="Trainer" htmlFor="pt-trainer" required error={errors.trainer_id?.message}>
            {/* Controlled: the options arrive after the default (current trainer) is set. */}
            <Controller control={control} name="trainer_id" render={({ field }) => (
              <Select id="pt-trainer" invalid={!!errors.trainer_id} value={field.value ?? ""}
                onChange={field.onChange} onBlur={field.onBlur} ref={field.ref}>
                <option value="">{trainers.isLoading ? "Loading trainers…" : "Select trainer"}</option>
                {(trainers.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.employee_code})</option>
                ))}
              </Select>
            )} />
          </Field>
        </div>

        <Field label="Notes (Optional)" htmlFor="pt-notes" error={errors.notes?.message}>
          <Textarea id="pt-notes" rows={3} placeholder="Session details, exercises covered..."
            invalid={!!errors.notes} {...register("notes")} />
        </Field>

        <div className="mt-8 rounded-lg bg-subtle p-4">
          <h3 className="m-0 mb-4 text-[15px] font-semibold text-ink">Verification Status</h3>
          <div className="flex flex-col gap-3">
            <Controller control={control} name="trainer_verified" render={({ field }) => (
              <Checkbox checked={field.value} onChange={field.onChange} label="Trainer Verified" />
            )} />
            <Controller control={control} name="client_verified" render={({ field }) => (
              <Checkbox checked={field.value} onChange={field.onChange} label="Client Verified (OTP/Signature)" />
            )} />
          </div>
        </div>

        <div className="form-actions-modern">
          <Button variant="secondary" onClick={close}>Cancel</Button>
          <Button type="submit" loading={log.isPending}>Log Session</Button>
        </div>
      </form>
    </Modal>
  );
}
