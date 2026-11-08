import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { useParams } from "react-router-dom";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { publicEnquiryApi, type JoinWhen, type PreferredTime } from "@/features/leads/enquiry-api";
import { FitnessGoalSelect, goalField } from "@/features/lookups/fitness-goals";
import { toApiError } from "@/lib/api-error";
import { addDaysISO, formatDate, formatINR, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

const TIMES: { value: PreferredTime; label: string }[] = [
  { value: "MORNING", label: "Morning" }, { value: "AFTERNOON", label: "Afternoon" }, { value: "EVENING", label: "Evening" },
];
const WHEN: { value: JoinWhen; label: string }[] = [
  { value: "THIS_WEEK", label: "This week" }, { value: "THIS_MONTH", label: "This month" }, { value: "LATER", label: "Just exploring" },
];

// Mirrors backend EnquirySubmit (the trial date range is checked against the gym's offer below).
const schema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(120, "Max 120 characters"),
  phone: z.string().trim().regex(/^\d{10}$/, "Enter your 10-digit mobile number"),
  goal: goalField,
  preferred_time: z.union([z.enum(["MORNING", "AFTERNOON", "EVENING"]), z.literal("")]),
  join_when: z.union([z.enum(["THIS_WEEK", "THIS_MONTH", "LATER"]), z.literal("")]),
  location: z.string().trim().max(150, "Max 150 characters"),
  message: z.string().trim().max(500, "Max 500 characters"),
  trial: z.boolean(),
  trial_date: z.string(),
  website: z.string(),
}).refine((v) => !v.trial || /^\d{4}-\d{2}-\d{2}$/.test(v.trial_date), {
  path: ["trial_date"], message: "Pick the day you'd like to start",
});
type Values = z.infer<typeof schema>;

const trialTitle = (days: number, fee: number) =>
  `${fee > 0 ? "Book a" : "Book a free"} ${days}-day trial`;

/**
 * /enquiry/:token — public, phone-sized enquiry form (no login) opened from the branch's link or QR poster.
 * A submit lands in that branch's Leads as a NEW lead from "Enquiry form", to call today.
 */
export function EnquiryFormPage() {
  const { token = "" } = useParams<{ token: string }>();
  const info = useQuery({ queryKey: ["enquiry", token], queryFn: () => publicEnquiryApi.info(token), retry: false });
  const gym = info.data?.data;

  const today = todayISO();
  const { register, control, handleSubmit, watch, setError, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", phone: "", goal: "", preferred_time: "", join_when: "", location: "", message: "",
      trial: false, trial_date: today, website: "" },
  });
  const wantsTrial = watch("trial");
  const lastTrialDay = gym ? addDaysISO(today, gym.trial_book_ahead_days) : today;

  const submit = useMutation({
    mutationFn: (v: Values) => publicEnquiryApi.submit(token, {
      name: v.name, phone: v.phone, goal: v.goal || null, preferred_time: v.preferred_time || null,
      join_when: v.join_when || null, location: v.location || null, message: v.message || null,
      trial: v.trial, trial_date: v.trial ? v.trial_date : null,
      website: v.website || null,
    }),
  });
  const onSubmit = (v: Values) => {
    if (v.trial && (v.trial_date < today || v.trial_date > lastTrialDay)) {
      setError("trial_date", { message: `Pick a day from today to ${formatDate(lastTrialDay)}` });
      return;
    }
    submit.mutate(v);
  };
  const done = submit.data?.data;


  return (
    <div className="flex min-h-screen flex-col items-center bg-main px-4 py-8">
      <div className="w-full max-w-[460px]">
        <div className="mb-6 flex items-center justify-center gap-2">
          {gym?.logo_url
            ? <img src={gym.logo_url} alt="" className="h-10 w-10 rounded-[10px] bg-white object-contain p-0.5" />
            : <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-grad font-display text-xl text-white">S</div>}
          <span className="font-display text-2xl uppercase tracking-wide text-ink">{gym?.organization_name ?? "Stag Fitness"}</span>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-premium">
          {info.isLoading && (
            <div className="flex flex-col items-center gap-3 py-8 text-sm font-semibold text-muted">
              <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-line border-t-accent" />Opening…
            </div>
          )}

          {info.isError && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-danger-soft text-danger"><Icon name="alert" className="h-8 w-8" /></span>
              <div className="text-lg font-extrabold text-ink">This link isn't active</div>
              <p className="m-0 text-sm text-secondary-grey">Ask the gym for their latest enquiry link or QR code.</p>
            </div>
          )}

          {gym && done && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success"><Icon name="check" className="h-8 w-8" /></span>
              <div className="text-lg font-extrabold text-ink">Thank you, {done.name}!</div>
              {done.trial_start && done.trial_end ? (
                <div className="w-full rounded-xl border border-line-accent bg-accent-light px-4 py-3 text-sm text-ink">
                  <div className="font-bold">Your trial is booked</div>
                  <div className="mt-1">{formatDate(done.trial_start)} to {formatDate(done.trial_end)}</div>
                  {!!done.trial_fee && <div className="mt-1 text-secondary-grey">Trial fee {formatINR(done.trial_fee, true)}, pay at the gym</div>}
                </div>
              ) : done.trial_used ? (
                <p className="m-0 text-sm text-secondary-grey">You've already had a trial with us, so our team will call you about plans.</p>
              ) : null}
              <p className="m-0 text-sm text-secondary-grey">Our team at {gym.branch_name} will call you soon.</p>
              {gym.contact_phone && (
                <a href={`tel:${gym.contact_phone}`} className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-accent no-underline">
                  <Icon name="phone" className="h-4 w-4" />Can't wait? Call {gym.contact_phone}
                </a>
              )}
            </div>
          )}

          {gym && !done && (
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
              <div className="text-center">
                <div className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
                  {gym.branch_name}{gym.branch_location ? ` · ${gym.branch_location}` : ""}
                </div>
                <h1 className="m-0 mt-1 font-display text-3xl uppercase tracking-wide text-ink">Start your fitness journey</h1>
                <p className="m-0 mt-1 text-sm text-muted">Leave your details and we'll call you with plans and offers.</p>
              </div>

              <Field label="Your name" htmlFor="eq-name" required error={errors.name?.message}>
                <Input id="eq-name" autoComplete="name" maxLength={120} placeholder="Full name" invalid={!!errors.name} {...register("name")} />
              </Field>
              <Field label="Mobile number" htmlFor="eq-phone" required error={errors.phone?.message}>
                <Input id="eq-phone" inputMode="numeric" autoComplete="tel" maxLength={10} placeholder="10-digit mobile"
                  invalid={!!errors.phone} {...register("phone")} />
              </Field>
              <Field label="Your goal" htmlFor="eq-goal" error={errors.goal?.message}>
                <Controller name="goal" control={control} render={({ field }) => (
                  <FitnessGoalSelect id="eq-goal" optional value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
                )} />
              </Field>
              {gym.trial_enabled && (
                <div className={cn("rounded-xl border px-4 py-3 transition-colors",
                  wantsTrial ? "border-accent bg-accent-light" : "border-line bg-surface")}>
                  <Controller name="trial" control={control} render={({ field }) => (
                    <Checkbox checked={field.value} onChange={field.onChange}
                      label={<span className="font-bold">{trialTitle(gym.trial_days, gym.trial_fee)}</span>} />
                  )} />
                  <p className="m-0 mt-1 pl-8 text-xs text-secondary-grey">
                    {gym.trial_fee > 0 ? `Trial fee ${formatINR(gym.trial_fee, true)}, pay at the gym. ` : ""}
                    Try the gym before you join.
                  </p>
                  {wantsTrial && (
                    <Field label="Start on" htmlFor="eq-trial" required error={errors.trial_date?.message} className="mt-3">
                      <Input id="eq-trial" type="date" min={today} max={lastTrialDay} invalid={!!errors.trial_date}
                        {...register("trial_date")} />
                    </Field>
                  )}
                </div>
              )}
              <Field label="Best time for you">
                <Controller name="preferred_time" control={control} render={({ field }) => (
                  <Chips options={TIMES} value={field.value} onChange={field.onChange} />
                )} />
              </Field>
              <Field label="When would you like to start?">
                <Controller name="join_when" control={control} render={({ field }) => (
                  <Chips options={WHEN} value={field.value} onChange={field.onChange} />
                )} />
              </Field>
              <Field label="Your area" htmlFor="eq-area" error={errors.location?.message}>
                <Input id="eq-area" maxLength={150} placeholder="e.g. Anna Nagar" {...register("location")} />
              </Field>
              <Field label="Anything to ask?" htmlFor="eq-msg" error={errors.message?.message}>
                <Textarea id="eq-msg" rows={2} maxLength={500} placeholder="Ladies batch, PT, diet plan… (optional)" {...register("message")} />
              </Field>
              {/* Honeypot: off-screen, so people never fill it; simple bots do. */}
              <input aria-hidden tabIndex={-1} autoComplete="off" className="absolute left-[-9999px] h-0 w-0 opacity-0"
                {...register("website")} />

              {submit.isError && (
                <p className="m-0 rounded-lg bg-danger-soft px-3 py-2 text-[13px] font-semibold text-danger">{toApiError(submit.error).message}</p>
              )}
              <Button type="submit" loading={submit.isPending} className="w-full justify-center">
                {wantsTrial ? "Book trial" : "Send enquiry"}
              </Button>
              <p className="m-0 text-center text-xs text-muted">We'll only use your number to call you about the gym.</p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/** One-tap choice; tapping the picked chip clears it (optional question). */
function Chips<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[]; value: T | ""; onChange: (v: T | "") => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button key={o.value} type="button" onClick={() => onChange(on ? "" : o.value)}
            className={cn("cursor-pointer rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
              on ? "border-accent bg-accent-light text-accent" : "border-line bg-surface text-secondary-grey")}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
