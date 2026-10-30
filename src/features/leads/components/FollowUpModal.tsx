import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { leadApi, leadKeys } from "@/features/leads/api";
import { addDaysISO, todayISO } from "@/lib/format";
import { notify } from "@/lib/notify";
import { humanize } from "@/lib/utils";
import { LEAD_STATUSES } from "@/types/enums";
import type { Lead } from "@/types/lead";

// LeadFollowUp: notes 1..1000; the original form also required the next follow-up date.
const schema = z.object({
  status: z.enum(LEAD_STATUSES),
  next_follow_up_date: z.string().min(1, "Next follow-up date is required"),
  notes: z.string().trim().min(1, "Follow-up notes are required").max(1000, "Max 1000 characters"),
});
type FormValues = z.infer<typeof schema>;

function defaults(lead: Lead | null): FormValues {
  return {
    // NEW leads move to FOLLOW_UP; otherwise keep the current status (as the original).
    status: !lead || lead.status === "NEW" ? "FOLLOW_UP" : lead.status,
    next_follow_up_date: addDaysISO(todayISO(), 2),
    notes: "",
  };
}

/** "Add Follow-up for {name}" → POST /leads/{id}/follow-up (appends a dated note). */
export function FollowUpModal({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors, isValid } } =
    useForm<FormValues>({ resolver: zodResolver(schema), mode: "onChange", defaultValues: defaults(lead) });

  useEffect(() => {
    if (lead) reset(defaults(lead));
  }, [lead, reset]);

  const save = useMutation({
    mutationFn: (v: FormValues) => leadApi.followUp(lead?.id ?? "", v),
    onSuccess: async (res) => {
      notify.success(res.message);
      onClose();
      await qc.invalidateQueries({ queryKey: leadKeys.all });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: notify.error,
  });

  return (
    <Modal open={lead !== null} title={`Add Follow-up for ${lead?.name ?? ""}`} onClose={onClose} width="560px">
      <form onSubmit={handleSubmit((v) => save.mutate(v))} className="py-2.5" noValidate>
        <div className="grid grid-cols-1 gap-5">
          <Field label="Status" htmlFor="fu-status" error={errors.status?.message} required>
            <Select id="fu-status" invalid={!!errors.status} {...register("status")}>
              {LEAD_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
            </Select>
          </Field>
          <Field label="Next Follow-up Date" htmlFor="fu-date" error={errors.next_follow_up_date?.message} required>
            <Input id="fu-date" type="date" invalid={!!errors.next_follow_up_date} {...register("next_follow_up_date")} />
          </Field>
          <Field label="Follow-up Notes" htmlFor="fu-notes" error={errors.notes?.message} required>
            <Textarea id="fu-notes" rows={4} placeholder="Enter follow-up comments..."
              invalid={!!errors.notes} {...register("notes")} />
          </Field>
        </div>

        <div className="form-actions-modern mt-6">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!isValid} loading={save.isPending}>Save Follow-up</Button>
        </div>
      </form>
    </Modal>
  );
}
