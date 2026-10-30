import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { leadApi, leadKeys } from "@/features/leads/api";
import { notify } from "@/lib/notify";
import { humanize } from "@/lib/utils";
import { LEAD_STATUSES } from "@/types/enums";
import type { Lead, LeadInput } from "@/types/lead";

// Mirrors LeadCreate / the original form: everything required except notes; phone 10 digits.
const schema = z.object({
  name: z.string().trim().min(1, "Full name is required").max(120, "Max 120 characters"),
  phone: z.string().trim().regex(/^\d{10}$/, "Enter a valid 10-digit mobile number"),
  location: z.string().trim().min(1, "Location is required").max(150, "Max 150 characters"),
  goal: z.string().trim().min(1, "Goal is required").max(150, "Max 150 characters"),
  status: z.enum(LEAD_STATUSES),
  plan_to_join_date: z.string().min(1, "Plan to join date is required"),
  next_follow_up_date: z.string().min(1, "Next follow-up date is required"),
  notes: z.string().max(5000, "Max 5000 characters"),
});
type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  name: "", phone: "", location: "", goal: "", status: "NEW",
  plan_to_join_date: "", next_follow_up_date: "", notes: "",
};

function toForm(lead: Lead): FormValues {
  return {
    name: lead.name,
    phone: lead.phone,
    location: lead.location ?? "",
    goal: lead.goal ?? "",
    status: lead.status,
    plan_to_join_date: lead.plan_to_join_date ?? "",
    next_follow_up_date: lead.next_follow_up_date ?? "",
    notes: lead.notes ?? "",
  };
}

interface Props {
  open: boolean;
  /** null → add, a lead → edit. */
  lead: Lead | null;
  onClose: () => void;
}

/** "Add New Lead" / "Edit Lead" modal. */
export function LeadFormModal({ open, lead, onClose }: Props) {
  const qc = useQueryClient();
  const isEdit = lead !== null;
  const { register, handleSubmit, reset, formState: { errors, isValid } } =
    useForm<FormValues>({ resolver: zodResolver(schema), mode: "onChange", defaultValues: EMPTY });

  useEffect(() => {
    if (open) reset(lead ? toForm(lead) : EMPTY);
  }, [open, lead, reset]);

  const save = useMutation({
    mutationFn: (body: LeadInput) => (lead ? leadApi.update(lead.id, body) : leadApi.create(body)),
    onSuccess: async (res) => {
      notify.success(res.message);
      reset(EMPTY);
      onClose();
      await qc.invalidateQueries({ queryKey: leadKeys.all });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: notify.error,
  });

  const close = () => {
    reset(EMPTY);
    onClose();
  };

  const onSubmit = (v: FormValues) => save.mutate({ ...v, notes: v.notes.trim() || null });

  return (
    <Modal open={open} title={isEdit ? "Edit Lead" : "Add New Lead"} onClose={close}>
      <form onSubmit={handleSubmit(onSubmit)} className="py-2.5" noValidate>
        <div className="form-grid-modern">
          <Field label="Full Name" htmlFor="lead-name" error={errors.name?.message} required>
            <Input id="lead-name" placeholder="Enter full name" invalid={!!errors.name} {...register("name")} />
          </Field>
          <Field label="Phone Number" htmlFor="lead-phone" error={errors.phone?.message} required>
            <Input id="lead-phone" inputMode="numeric" maxLength={10} placeholder="10-digit mobile number"
              invalid={!!errors.phone} {...register("phone")} />
          </Field>
          <Field label="Location" htmlFor="lead-location" error={errors.location?.message} required>
            <Input id="lead-location" placeholder="Enter location" invalid={!!errors.location} {...register("location")} />
          </Field>
          <Field label="Goal" htmlFor="lead-goal" error={errors.goal?.message} required>
            <Input id="lead-goal" placeholder="e.g. Fat Loss, Muscle Building" invalid={!!errors.goal} {...register("goal")} />
          </Field>
          <Field label="Status" htmlFor="lead-status" error={errors.status?.message} required>
            <Select id="lead-status" invalid={!!errors.status} {...register("status")}>
              {LEAD_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
            </Select>
          </Field>
          <Field label="Plan to Join Date" htmlFor="lead-ptj" error={errors.plan_to_join_date?.message} required>
            <Input id="lead-ptj" type="date" invalid={!!errors.plan_to_join_date} {...register("plan_to_join_date")} />
          </Field>
          <Field label="Next Follow-up Date" htmlFor="lead-nfu" error={errors.next_follow_up_date?.message} required>
            <Input id="lead-nfu" type="date" invalid={!!errors.next_follow_up_date} {...register("next_follow_up_date")} />
          </Field>
        </div>

        <Field label="Notes / History" htmlFor="lead-notes" error={errors.notes?.message} className="mt-4">
          <Textarea id="lead-notes" rows={4} placeholder="Enter notes or follow-up history"
            invalid={!!errors.notes} {...register("notes")} />
        </Field>

        <div className="form-actions-modern mt-6">
          <Button variant="secondary" onClick={close}>Cancel</Button>
          <Button type="submit" disabled={!isValid} loading={save.isPending}>
            {isEdit ? "Update Lead" : "Save Lead"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
