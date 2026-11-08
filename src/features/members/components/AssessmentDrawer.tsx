import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Drawer } from "@/components/ui/Modal";
import { FormDivider, GRID_2, GRID_3 } from "@/components/ui/Section";
import { type Assessment, type AssessmentInput, assessmentApi, LIFESTYLE_LABEL, LIFESTYLES, MOVEMENT_LABEL,
  MOVEMENT_TESTS, type MovementTest, type Rating, RATINGS, useInvalidateAssessments } from "@/features/members/assessment-api";
import { todayISO } from "@/lib/format";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";

const FORM_ID = "assessment-form";

/** "" → null, else a number inside [min, max]. */
const num = (min: number, max: number, what: string) => z.union([z.literal(""), z.coerce.number({ invalid_type_error: `Enter ${what}` })
  .min(min, `At least ${min}`).max(max, `At most ${max}`)]);
const text = (max: number) => z.string().trim().max(max, `Max ${max} characters`);

// Mirrors backend AssessmentInput.
const schema = z.object({
  assessed_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the date"),
  height_cm: num(50, 250, "height"), weight_kg: num(10, 350, "weight"), body_fat_percent: num(2, 70, "body fat"),
  waist_cm: num(30, 250, "waist"), resting_heart_rate: num(30, 220, "heart rate"),
  bp_systolic: num(60, 260, "BP"), bp_diastolic: num(30, 160, "BP"),
  lifestyle: z.union([z.enum(LIFESTYLES), z.literal("")]),
  medical_conditions: text(1000), past_injuries: text(1000), surgeries: text(1000), static_notes: text(2000),
  movements: z.record(z.enum(RATINGS)), dynamic_notes: text(2000), notes: text(2000),
}).superRefine((v, ctx) => {
  if ((v.bp_systolic === "") !== (v.bp_diastolic === "")) ctx.addIssue({ code: "custom", path: ["bp_diastolic"], message: "Enter both numbers" });
  if (v.bp_systolic !== "" && v.bp_diastolic !== "" && v.bp_systolic <= v.bp_diastolic)
    ctx.addIssue({ code: "custom", path: ["bp_systolic"], message: "Systolic is the higher number" });
  if (v.assessed_on > todayISO()) ctx.addIssue({ code: "custom", path: ["assessed_on"], message: "Can't be in the future" });
});
type Values = z.infer<typeof schema>;

const toForm = (a: Assessment | null, height: number | null, weight: number | null): Values => ({
  assessed_on: a?.assessed_on ?? todayISO(),
  height_cm: a?.height_cm ?? height ?? "", weight_kg: a?.weight_kg ?? weight ?? "",
  body_fat_percent: a?.body_fat_percent ?? "", waist_cm: a?.waist_cm ?? "",
  resting_heart_rate: a?.resting_heart_rate ?? "", bp_systolic: a?.bp_systolic ?? "", bp_diastolic: a?.bp_diastolic ?? "",
  lifestyle: a?.lifestyle ?? "", medical_conditions: a?.medical_conditions ?? "", past_injuries: a?.past_injuries ?? "",
  surgeries: a?.surgeries ?? "", static_notes: a?.static_notes ?? "", movements: a?.movements ?? {},
  dynamic_notes: a?.dynamic_notes ?? "", notes: a?.notes ?? "",
});

const orNull = <T,>(v: T | "") => (v === "" ? null : v);

/** Add / edit one client assessment: vitals, lifestyle & history, static posture and the dynamic movement screen. */
export function AssessmentDrawer({ memberId, assessment, height, weight, onClose }: {
  memberId: string; assessment: Assessment | null; height: number | null; weight: number | null; onClose: () => void;
}) {
  const invalidate = useInvalidateAssessments();
  const { register, control, handleSubmit, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema), defaultValues: toForm(assessment, height, weight),
  });
  const save = useMutation({
    mutationFn: (v: Values) => {
      const body: AssessmentInput = {
        assessed_on: v.assessed_on, height_cm: orNull(v.height_cm), weight_kg: orNull(v.weight_kg),
        body_fat_percent: orNull(v.body_fat_percent), waist_cm: orNull(v.waist_cm),
        resting_heart_rate: orNull(v.resting_heart_rate), bp_systolic: orNull(v.bp_systolic), bp_diastolic: orNull(v.bp_diastolic),
        lifestyle: orNull(v.lifestyle), medical_conditions: v.medical_conditions || null, past_injuries: v.past_injuries || null,
        surgeries: v.surgeries || null, static_notes: v.static_notes || null,
        movements: v.movements as Partial<Record<MovementTest, Rating>>, dynamic_notes: v.dynamic_notes || null, notes: v.notes || null,
      };
      return assessment ? assessmentApi.update(assessment.id, body) : assessmentApi.create(memberId, body);
    },
    onSuccess: async (res) => { notify.success(res.message); onClose(); await invalidate(); },
    onError: notify.error,
  });

  return (
    <Drawer open width="640px" title={assessment ? "Edit assessment" : "New assessment"} subtitle="Measure, ask, observe" onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" form={FORM_ID} loading={save.isPending}>Save assessment</Button>
      </>}>
      <form id={FORM_ID} noValidate onSubmit={handleSubmit((v) => save.mutate(v))}>
        <FormDivider>Body & vitals</FormDivider>
        <div className={GRID_3}>
          <Field label="Date" htmlFor="as-date" required error={errors.assessed_on?.message}>
            <Input id="as-date" type="date" max={todayISO()} {...register("assessed_on")} />
          </Field>
          <Field label="Height (cm)" htmlFor="as-h" error={errors.height_cm?.message}>
            <Input id="as-h" type="number" inputMode="decimal" step="0.1" {...register("height_cm")} />
          </Field>
          <Field label="Weight (kg)" htmlFor="as-w" error={errors.weight_kg?.message}>
            <Input id="as-w" type="number" inputMode="decimal" step="0.1" {...register("weight_kg")} />
          </Field>
          <Field label="Body fat (%)" htmlFor="as-bf" error={errors.body_fat_percent?.message}>
            <Input id="as-bf" type="number" inputMode="decimal" step="0.1" {...register("body_fat_percent")} />
          </Field>
          <Field label="Waist (cm)" htmlFor="as-waist" error={errors.waist_cm?.message}>
            <Input id="as-waist" type="number" inputMode="decimal" step="0.1" {...register("waist_cm")} />
          </Field>
          <Field label="Resting heart rate (bpm)" htmlFor="as-hr" error={errors.resting_heart_rate?.message}>
            <Input id="as-hr" type="number" inputMode="numeric" {...register("resting_heart_rate")} />
          </Field>
          <Field label="Blood pressure" htmlFor="as-sys" error={errors.bp_systolic?.message ?? errors.bp_diastolic?.message}
            hint="Systolic / diastolic, e.g. 120 / 80">
            <div className="flex items-center gap-2">
              <Input id="as-sys" type="number" inputMode="numeric" placeholder="120" {...register("bp_systolic")} />
              <span className="text-muted">/</span>
              <Input aria-label="Diastolic" type="number" inputMode="numeric" placeholder="80" {...register("bp_diastolic")} />
            </div>
          </Field>
        </div>

        <FormDivider>Lifestyle & history</FormDivider>
        <div className={GRID_2}>
          <Field label="Daily activity" htmlFor="as-life">
            <Select id="as-life" {...register("lifestyle")}>
              <option value="">Not asked</option>
              {LIFESTYLES.map((l) => <option key={l} value={l}>{LIFESTYLE_LABEL[l]}</option>)}
            </Select>
          </Field>
          <Field label="Medical conditions" htmlFor="as-med" error={errors.medical_conditions?.message}>
            <Input id="as-med" placeholder="Diabetes, BP, asthma, thyroid…" {...register("medical_conditions")} />
          </Field>
          <Field label="Past injuries" htmlFor="as-inj" error={errors.past_injuries?.message}>
            <Textarea id="as-inj" rows={2} placeholder="Knee ACL 2019, lower back pain…" {...register("past_injuries")} />
          </Field>
          <Field label="Surgeries" htmlFor="as-surg" error={errors.surgeries?.message}>
            <Textarea id="as-surg" rows={2} placeholder="C-section 2022…" {...register("surgeries")} />
          </Field>
        </div>

        <FormDivider>Static assessment (posture)</FormDivider>
        <Field label="What you see standing" htmlFor="as-static" error={errors.static_notes?.message}>
          <Textarea id="as-static" rows={2} placeholder="Rounded shoulders, forward head, flat feet, pelvic tilt…" {...register("static_notes")} />
        </Field>

        <FormDivider>Dynamic movement</FormDivider>
        <Controller name="movements" control={control} render={({ field }) => (
          <div className="flex flex-col gap-2">
            {MOVEMENT_TESTS.map((t) => (
              <div key={t} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
                <span className="text-sm font-semibold text-ink">{MOVEMENT_LABEL[t]}</span>
                <div className="inline-flex rounded-lg border border-line bg-surface p-0.5 text-xs font-semibold">
                  {RATINGS.map((r) => {
                    const on = field.value[t] === r;
                    return (
                      <button key={r} type="button"
                        onClick={() => { const next = { ...field.value }; if (on) delete next[t]; else next[t] = r; field.onChange(next); }}
                        className={cn("cursor-pointer rounded-md border-0 px-2.5 py-1",
                          on ? (r === "GOOD" ? "bg-success-soft text-success" : r === "FAIR" ? "bg-warning-soft text-warning" : "bg-danger-soft text-danger")
                            : "bg-transparent text-muted")}>
                        {r === "GOOD" ? "Good" : r === "FAIR" ? "Fair" : "Poor"}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )} />
        <Field label="Movement notes" htmlFor="as-dyn" error={errors.dynamic_notes?.message} className="mt-3">
          <Textarea id="as-dyn" rows={2} placeholder="Knees cave in on squat, poor hip hinge…" {...register("dynamic_notes")} />
        </Field>
        <Field label="Trainer's notes / plan" htmlFor="as-notes" error={errors.notes?.message} className="mt-3">
          <Textarea id="as-notes" rows={2} {...register("notes")} />
        </Field>
      </form>
    </Drawer>
  );
}
