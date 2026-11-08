import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Drawer } from "@/components/ui/Modal";
import { RichSelect } from "@/components/ui/RichSelect";
import { FormDivider, GRID_2 } from "@/components/ui/Section";
import { leadApi, useInvalidateLeads } from "@/features/leads/api";
import { DateWithDays } from "@/features/leads/components/DateWithDays";
import { SOURCE_GROUPS } from "@/features/leads/lead-meta";
import { FitnessGoalSelect, requiredGoalField } from "@/features/lookups/fitness-goals";
import { MemberPicker } from "@/features/lookups/MemberPicker";
import { formatDateTime } from "@/lib/format";
import { notify } from "@/lib/notify";
import { humanize } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { LEAD_SOURCES, LEAD_STATUSES, type LeadSource } from "@/types/enums";
import type { Lead, LeadInput } from "@/types/lead";

const FORM_ID = "lead-form";

// Mirrors LeadCreate: everything required except notes; phone 10 digits; the source is one of LEAD_SOURCES.
const schema = z.object({
  name: z.string().trim().min(1, "Full name is required").max(120, "Max 120 characters"),
  phone: z.string().trim().regex(/^\d{10}$/, "Enter a valid 10-digit mobile number"),
  location: z.string().trim().min(1, "Location is required").max(150, "Max 150 characters"),
  source: z.union([z.enum(LEAD_SOURCES), z.literal("")])
    .refine((v): boolean => v !== "", "Select how the enquiry came in"),
  goal: requiredGoalField("Select the client's goal"),
  status: z.enum(LEAD_STATUSES),
  plan_to_join_date: z.string().min(1, "Plan to join date is required"),
  next_follow_up_date: z.string().min(1, "Next follow-up date is required"),
  notes: z.string().max(5000, "Max 5000 characters"),
  /** Source REFERRAL: the member who sent them ("" = not picked). */
  referred_by_id: z.string(),
});
type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  name: "", phone: "", location: "", source: "", goal: "", status: "NEW",
  plan_to_join_date: "", next_follow_up_date: "", notes: "", referred_by_id: "",
};

function toForm(lead: Lead): FormValues {
  return {
    name: lead.name,
    phone: lead.phone,
    location: lead.location ?? "",
    source: lead.source ?? "",
    goal: lead.goal ?? "",
    status: lead.status,
    plan_to_join_date: lead.plan_to_join_date ?? "",
    next_follow_up_date: lead.next_follow_up_date ?? "",
    notes: lead.notes ?? "",
    referred_by_id: lead.referred_by_id ?? "",
  };
}

interface Props {
  open: boolean;
  /** null → add, a lead → edit. */
  lead: Lead | null;
  onClose: () => void;
}

/** Add / edit lead slide-over: contact + enquiry channel, interest and follow-up, notes. */
export function LeadFormDrawer({ open, lead, onClose }: Props) {
  const invalidate = useInvalidateLeads();
  const myName = useAuthStore((s) => s.me?.user.name);
  const isEdit = lead !== null;
  const { register, control, handleSubmit, reset, watch, formState: { errors, isValid } } =
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
      await invalidate();
    },
    onError: notify.error,
  });

  const close = () => {
    reset(EMPTY);
    onClose();
  };

  const onSubmit = (v: FormValues) => {
    if (!v.goal || !v.source) return; // the schema already requires both; this narrows the types
    save.mutate({ ...v, goal: v.goal, source: v.source, notes: v.notes.trim() || null,
      referred_by_id: v.source === "REFERRAL" && v.referred_by_id ? v.referred_by_id : null });
  };

  // Who took the enquiry: the creator on edit, the signed-in account on add (saved automatically).
  const attendedBy = isEdit
    ? `${lead.attended_by_name ?? "Unknown"} · ${formatDateTime(lead.created_at)}`
    : myName ?? "You";

  return (
    <Drawer
      open={open}
      title={isEdit ? "Edit lead" : "Add lead"}
      subtitle={isEdit ? `${lead.name} · ${lead.phone}` : "Capture an enquiry and schedule the first follow-up"}
      onClose={close}
      footer={
        <>
          <Button variant="secondary" onClick={close}>Cancel</Button>
          <Button type="submit" form={FORM_ID} disabled={!isValid} loading={save.isPending}>
            {isEdit ? "Update lead" : "Save lead"}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-line bg-subtle px-4 py-2.5 text-[13px]">
          <Icon name="userCheck" className="h-4 w-4 text-accent" />
          <span className="text-muted">Attended by</span>
          <span className="font-bold text-ink">{attendedBy}</span>
        </div>

        <FormDivider>Contact</FormDivider>
        <div className={GRID_2}>
          <Field label="Full name" htmlFor="lead-name" error={errors.name?.message} required className="md:col-span-2">
            <Input id="lead-name" placeholder="Enter full name" invalid={!!errors.name} {...register("name")} />
          </Field>
          <Field label="Phone number" htmlFor="lead-phone" error={errors.phone?.message} required>
            <Input id="lead-phone" inputMode="numeric" maxLength={10} placeholder="10-digit mobile number"
              invalid={!!errors.phone} {...register("phone")} />
          </Field>
          <Field label="Location" htmlFor="lead-location" error={errors.location?.message} required>
            <Input id="lead-location" placeholder="Enter location" invalid={!!errors.location} {...register("location")} />
          </Field>
          <Field label="Enquiry source" htmlFor="lead-source" error={errors.source?.message} required className="md:col-span-2">
            <Controller name="source" control={control} render={({ field }) => (
              <RichSelect<LeadSource> id="lead-source" value={field.value} onChange={field.onChange} onBlur={field.onBlur}
                groups={SOURCE_GROUPS} placeholder="How did they enquire?" invalid={!!errors.source} />
            )} />
          </Field>
          {watch("source") === "REFERRAL" && (
            <Field label="Referred by" htmlFor="lead-referred" className="md:col-span-2"
              hint="The member who sent them. When they join, it counts for that member's referral reward">
              <Controller name="referred_by_id" control={control} render={({ field }) => (
                <MemberPicker id="lead-referred" value={field.value} onChange={field.onChange}
                  currentName={lead?.referred_by_name} placeholder="Pick the member" />
              )} />
            </Field>
          )}
        </div>

        <FormDivider>Interest &amp; follow-up</FormDivider>
        <div className={GRID_2}>
          <Field label="Goal" htmlFor="lead-goal" error={errors.goal?.message} required>
            <Controller name="goal" control={control} render={({ field }) => (
              <FitnessGoalSelect id="lead-goal" value={field.value} onChange={field.onChange} onBlur={field.onBlur}
                invalid={!!errors.goal} />
            )} />
          </Field>
          <Field label="Status" htmlFor="lead-status" error={errors.status?.message} required>
            <Select id="lead-status" invalid={!!errors.status} {...register("status")}>
              {LEAD_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
            </Select>
          </Field>
          <Field label="Plan to join" htmlFor="lead-ptj" error={errors.plan_to_join_date?.message} required
            hint="Pick a date or type the days from today" className="md:col-span-2">
            <Controller name="plan_to_join_date" control={control} render={({ field }) => (
              <DateWithDays id="lead-ptj" value={field.value} onChange={field.onChange} onBlur={field.onBlur}
                invalid={!!errors.plan_to_join_date} />
            )} />
          </Field>
          <Field label="Next follow-up" htmlFor="lead-nfu" error={errors.next_follow_up_date?.message} required
            hint="e.g. 3 days = call again 3 days from today" className="md:col-span-2">
            <Controller name="next_follow_up_date" control={control} render={({ field }) => (
              <DateWithDays id="lead-nfu" value={field.value} onChange={field.onChange} onBlur={field.onBlur}
                invalid={!!errors.next_follow_up_date} />
            )} />
          </Field>
        </div>

        <FormDivider>Notes</FormDivider>
        <Field label="Notes / history" htmlFor="lead-notes" error={errors.notes?.message}
          hint={isEdit ? "Follow-ups are appended here as dated entries" : undefined}>
          <Textarea id="lead-notes" rows={5} placeholder="Enter notes or follow-up history"
            invalid={!!errors.notes} {...register("notes")} />
        </Field>
      </form>
    </Drawer>
  );
}
