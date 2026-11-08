import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input } from "@/components/ui/Field";
import { PageLoader } from "@/components/ui/Loaders";
import { PageHeader } from "@/components/ui/PageHeader";
import { GRID_2, GRID_3, Section } from "@/components/ui/Section";
import { settingsApi, useGymSettings, useInvalidateSettings } from "@/features/settings/api";
import { formatINR } from "@/lib/format";
import { notify } from "@/lib/notify";
import type { GymSettings, GymSettingsInput } from "@/types/settings";

const FORM_ID = "gym-settings-form";

const whole = (min: number, max: number, what: string) =>
  z.coerce.number({ invalid_type_error: `Enter ${what}` }).int("Whole numbers only")
    .min(min, `At least ${min}`).max(max, `At most ${max}`);

// Mirrors backend GymSettingsUpdate.
const schema = z.object({
  trial_enabled: z.boolean(),
  trial_days: whole(1, 30, "the trial days"),
  trial_fee: z.coerce.number({ invalid_type_error: "Enter the fee (0 = free)" }).min(0, "Can't be negative").max(100000, "Too high"),
  renewal_due_days: whole(1, 60, "the days"),
  renewal_overdue_days: whole(1, 365, "the days"),
  late_grace_minutes: whole(0, 120, "the minutes"),
  half_day_after_minutes: whole(0, 480, "the minutes"),
  absent_alert_days: whole(2, 60, "the days"),
  freeze_enabled: z.boolean(),
  freeze_max_days: whole(0, 365, "the days"),
  freeze_max_times: whole(1, 12, "how many times"),
  transfer_enabled: z.boolean(),
  transfer_within_days: whole(1, 365, "the days"),
  refund_within_days: whole(0, 365, "the days"),
  refund_deduction_percent: z.coerce.number({ invalid_type_error: "Enter the %" }).min(0, "At least 0").max(100, "At most 100"),
}).refine((v) => v.half_day_after_minutes === 0 || v.half_day_after_minutes > v.late_grace_minutes,
  { path: ["half_day_after_minutes"], message: "Must be more than the late minutes (or 0 for no half day)" });
type Values = z.infer<typeof schema>;

/** 6:00 AM + minutes → "6:30". */
const clockAfter = (minutes: number) => `${6 + Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;

const toForm = (s: GymSettings): Values => {
  const { gym_code: _code, member_id_prefix: _prefix, ...rest } = s;
  return rest;
};

/** Toggle in a section header. */
function OnOff({ name, control, label }: { name: keyof Values; control: ReturnType<typeof useForm<Values>>["control"]; label: string }) {
  return (
    <Controller name={name} control={control} render={({ field }) => (
      <Checkbox checked={!!field.value} onChange={field.onChange} label={label} />
    )} />
  );
}

/**
 * Configuration — owner-level values that apply to every branch: trial class, membership freeze / transfer /
 * refund rules, renewal windows, the "Not coming" alert and staff late grace.
 */
export function SettingsPage() {
  const settings = useGymSettings();
  const invalidate = useInvalidateSettings();
  const { register, control, handleSubmit, reset, watch, formState: { errors, isDirty } } = useForm<Values>({
    resolver: zodResolver(schema),
  });
  useEffect(() => {
    if (settings.data) reset(toForm(settings.data));
  }, [settings.data, reset]);

  const save = useMutation({
    mutationFn: (v: Values) => settingsApi.save(v satisfies GymSettingsInput),
    onSuccess: async (res) => {
      notify.success(res.message);
      reset(toForm(res.data));
      await invalidate();
    },
    onError: notify.error,
  });

  if (settings.isLoading) return <PageLoader />;
  if (settings.isError) return <p className="text-sm text-danger">{settings.error.message}</p>;

  const trialOn = watch("trial_enabled");
  const days = Number(watch("trial_days")) || 0;
  const fee = Number(watch("trial_fee")) || 0;
  const freezeOn = watch("freeze_enabled");
  const freezeDays = Number(watch("freeze_max_days"));
  const transferOn = watch("transfer_enabled");
  const pct = Number(watch("refund_deduction_percent")) || 0;
  const due = Number(watch("renewal_due_days")) || 0;
  const overdue = Number(watch("renewal_overdue_days")) || 0;
  const absent = Number(watch("absent_alert_days")) || 0;
  const grace = Math.min(120, Math.max(0, Number(watch("late_grace_minutes")) || 0));
  const halfDay = Math.min(480, Math.max(0, Number(watch("half_day_after_minutes")) || 0));

  return (
    <div>
      <PageHeader
        title="Configuration"
        subtitle={<>Apply to every branch · Gym ID <b className="text-ink">{settings.data?.gym_code}</b> · member IDs{" "}
          <b className="text-ink">{settings.data?.member_id_prefix}-001</b></>}
        actions={
          <>
            {isDirty && <Button variant="secondary" onClick={() => settings.data && reset(toForm(settings.data))}>Undo</Button>}
            <Button type="submit" form={FORM_ID} disabled={!isDirty} loading={save.isPending}>Save settings</Button>
          </>
        }
      />
      <form id={FORM_ID} onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="flex flex-col gap-5">
        <Section title="Trial class" description="Offered on the enquiry form and from Leads. One trial per person."
          aside={<OnOff name="trial_enabled" control={control} label="Offer trials" />}>
          <div className={GRID_3}>
            <Field label="Trial length (days)" htmlFor="st-trial-days" required error={errors.trial_days?.message} hint="e.g. 3 or 5">
              <Input id="st-trial-days" type="number" inputMode="numeric" min={1} max={30} disabled={!trialOn}
                invalid={!!errors.trial_days} {...register("trial_days")} />
            </Field>
            <Field label="Trial fee (₹)" htmlFor="st-trial-fee" required error={errors.trial_fee?.message} hint="0 = free trial">
              <Input id="st-trial-fee" type="number" inputMode="decimal" min={0} step="1" disabled={!trialOn}
                invalid={!!errors.trial_fee} {...register("trial_fee")} />
            </Field>
            <div className="flex items-end">
              <p className="m-0 rounded-xl bg-subtle px-3 py-2 text-[13px] text-secondary-grey">
                {trialOn
                  ? <>The form shows <b className="text-ink">"Book a {fee > 0 ? "" : "free "}{days}-day trial"</b>{fee > 0 ? <> · {formatINR(fee, true)} at the gym</> : null}</>
                  : "Trials are off: the form and Leads won't offer them."}
              </p>
            </div>
          </div>
        </Section>

        <Section title="Membership freeze" description="Pause a membership (injury, pregnancy, travel); the frozen days are added to the end. Manager level."
          aside={<OnOff name="freeze_enabled" control={control} label="Allow freeze" />}>
          <div className={GRID_3}>
            <Field label="Freeze days per membership" htmlFor="st-fz-days" required error={errors.freeze_max_days?.message}
              hint="0 = only members you give their own days">
              <Input id="st-fz-days" type="number" inputMode="numeric" min={0} disabled={!freezeOn} {...register("freeze_max_days")} />
            </Field>
            <Field label="Times per membership" htmlFor="st-fz-times" required error={errors.freeze_max_times?.message}>
              <Input id="st-fz-times" type="number" inputMode="numeric" min={1} max={12} disabled={!freezeOn} {...register("freeze_max_times")} />
            </Field>
            <div className="flex items-end">
              <p className="m-0 rounded-xl bg-subtle px-3 py-2 text-[13px] text-secondary-grey">
                {!freezeOn ? "Freeze is off." : freezeDays === 0
                  ? "Nobody can freeze by default. Give a member their own freeze days on their membership."
                  : "Any member can freeze up to these days. You can give one member more (or fewer) on their membership."}
              </p>
            </div>
          </div>
        </Section>

        <Section title="Membership transfer" description="Give the remaining days to a friend / family member. Once per membership."
          aside={<OnOff name="transfer_enabled" control={control} label="Allow transfer" />}>
          <div className={GRID_3}>
            <Field label="Allowed within (days used)" htmlFor="st-tr" required error={errors.transfer_within_days?.message}
              hint="Frozen days don't count">
              <Input id="st-tr" type="number" inputMode="numeric" min={1} disabled={!transferOn} {...register("transfer_within_days")} />
            </Field>
          </div>
        </Section>

        <Section title="Cancel & refund" description="Refunds only on plans marked refundable (Plans & Pricing). A plan can set its own refund days.">
          <div className={GRID_3}>
            <Field label="Refund within (days used)" htmlFor="st-rf-days" required error={errors.refund_within_days?.message}
              hint="Default for refundable plans">
              <Input id="st-rf-days" type="number" inputMode="numeric" min={0} {...register("refund_within_days")} />
            </Field>
            <Field label="Deduction (%)" htmlFor="st-rf-pct" required error={errors.refund_deduction_percent?.message}
              hint="Kept by the gym from what was paid">
              <Input id="st-rf-pct" type="number" inputMode="decimal" min={0} max={100} step="0.5" {...register("refund_deduction_percent")} />
            </Field>
            <div className="flex items-end">
              <p className="m-0 rounded-xl bg-subtle px-3 py-2 text-[13px] text-secondary-grey">
                Paid ₹2,000 → refund <b className="text-ink">{formatINR(2000 * (1 - pct / 100), true)}</b>. The manager can lower it.
              </p>
            </div>
          </div>
        </Section>

        <Section title="Renewal reminders" description="Who the desk should call to renew, and for how long.">
          <div className={GRID_2}>
            <Field label="Start reminding before the plan ends (days)" htmlFor="st-due" required
              error={errors.renewal_due_days?.message}
              hint={<>e.g. {due || 7} → a plan ending on 20 Nov shows as <b>Expiring</b> from {20 - (due || 7) > 0 ? `${20 - (due || 7)} Nov` : "earlier"}{" "}
                (Members → Expiring soon, Renewals → Due soon)</>}>
              <Input id="st-due" type="number" inputMode="numeric" min={1} max={60} {...register("renewal_due_days")} />
            </Field>
            <Field label="Keep reminding after it ended (days)" htmlFor="st-overdue" required
              error={errors.renewal_overdue_days?.message}
              hint={<>e.g. {overdue || 30} → a plan that ended stays in <b>Renewals → Lapsed</b> for {overdue || 30} days.
                After that they're treated as a lost member and drop off the list</>}>
              <Input id="st-overdue" type="number" inputMode="numeric" min={1} max={365} {...register("renewal_overdue_days")} />
            </Field>
          </div>
        </Section>

        <Section title="Attendance alerts" description="Members who stopped coming, and when staff count as late.">
          <div className={GRID_2}>
            <Field label="Member not coming after (days without a visit)" htmlFor="st-absent" required
              error={errors.absent_alert_days?.message}
              hint={<>e.g. {absent || 7} → someone with a running plan who hasn't checked in for {absent || 7} days shows in
                <b> Members → Not coming</b>, so the desk can call them</>}>
              <Input id="st-absent" type="number" inputMode="numeric" min={2} max={60} {...register("absent_alert_days")} />
            </Field>
            <Field label="Staff late after shift start (minutes)" htmlFor="st-grace" required
              error={errors.late_grace_minutes?.message}
              hint={<>e.g. {grace} → shift at 6:00 AM, checking in after {clockAfter(grace)} AM is marked <b>Late</b></>}>
              <Input id="st-grace" type="number" inputMode="numeric" min={0} max={120} {...register("late_grace_minutes")} />
            </Field>
            <Field label="Staff half day after shift start (minutes)" htmlFor="st-half" required
              error={errors.half_day_after_minutes?.message}
              hint={halfDay
                ? <>e.g. {halfDay} → shift at 6:00 AM, checking in at {clockAfter(halfDay)} AM or later is marked <b>Half day</b>
                  automatically (half a day's pay is cut in Payroll). 0 = no half day</>
                : "0 = coming late never becomes a half day"}>
              <Input id="st-half" type="number" inputMode="numeric" min={0} max={480} {...register("half_day_after_minutes")} />
            </Field>
          </div>
        </Section>
      </form>
    </div>
  );
}
