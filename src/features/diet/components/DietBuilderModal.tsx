import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { dietApi, dietKeys } from "@/features/diet/api";
import { calculateTargets, num, sameMonth, STANDARD_MONTHLY_LIMIT, TIER_RANK } from "@/features/diet/calc";
import { MealBlock } from "@/features/diet/components/MealBlock";
import { todayISO } from "@/lib/format";
import { notify } from "@/lib/notify";
import { cn, humanize } from "@/lib/utils";
import { useCan } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import { ACTIVITY_LEVELS, type DietPlan, type EligibleMember } from "@/types/diet";
import { DIET_CATEGORIES, DIET_TIERS, type DietTier } from "@/types/enums";

/** Backend message for item edits on BASIC plans (diet_service._editable_plan). */
const BASIC_LOCKED_MESSAGE = "Basic plans cannot be modified. Upgrade to Standard or Premium.";

const baseSchema = z.object({
  weight: z.number({ invalid_type_error: "Required" }).min(20, "Min 20 kg").max(400, "Max 400 kg"),
  height: z.number({ invalid_type_error: "Required" }).min(50, "Min 50 cm").max(300, "Max 300 cm"),
  age: z.number({ invalid_type_error: "Required" }).int("Whole years only").min(10, "Min 10").max(120, "Max 120"),
  activity_level: z.union([z.literal(1.2), z.literal(1.375), z.literal(1.55), z.literal(1.725), z.literal(1.9)], {
    errorMap: () => ({ message: "Select an activity level" }),
  }),
  tier: z.enum(DIET_TIERS),
  category: z.enum(DIET_CATEGORIES),
  notes: z.string().trim().max(2000, "Max 2000 characters"),
});
type FormValues = z.infer<typeof baseSchema>;

function toActivity(value: number): FormValues["activity_level"] {
  return ACTIVITY_LEVELS.find((a) => a.value === value)?.value ?? 1.2;
}

function formFromPlan(plan: DietPlan | null, member: EligibleMember): Partial<FormValues> {
  if (!plan) {
    return { activity_level: 1.2, tier: member.eligible_tier, category: "VEG", notes: "" };
  }
  return {
    weight: plan.weight ?? undefined,
    height: plan.height ?? undefined,
    age: plan.age ?? undefined,
    activity_level: toActivity(plan.activity_level),
    tier: TIER_RANK[plan.tier] <= TIER_RANK[member.eligible_tier] ? plan.tier : member.eligible_tier,
    category: plan.category,
    notes: plan.notes ?? "",
  };
}

const label = "text-xs font-bold text-muted";
const BAR_COLORS = { calories: "bg-accent", protein: "bg-info", carbs: "bg-success", fats: "bg-warning" } as const;

function ProgressRow({ title, unit, actual, target, color }: {
  title: string; unit: string; actual: number; target: number | null; color: keyof typeof BAR_COLORS;
}) {
  const pct = target ? Math.min((actual / target) * 100, 100) : 0;
  const over = target !== null && target > 0 && actual > target;
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-1.5 flex justify-between text-xs font-bold text-muted">
        <span>{title} (Target: {target !== null ? num(target) : "—"}{unit})</span>
        <span className={cn(over ? "text-accent" : "text-ink")}>{num(actual)}{unit}</span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-line">
        <div className={cn("h-full rounded transition-[width] duration-500", BAR_COLORS[color])} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** "Diet Builder" — calculator (live preview), save via PUT, meals with food picker. */
export function DietBuilderModal({ member, onClose }: { member: EligibleMember | null; onClose: () => void }) {
  const qc = useQueryClient();
  const branch = useBranchStore((s) => s.selectedBranchId);
  const canManage = useCan("diet:manage");
  const canListFoods = useCan("food:list");
  const open = member !== null;
  const memberId = member?.member_id ?? "";
  const today = todayISO();

  const planQuery = useQuery({
    queryKey: dietKeys.plan(branch, memberId),
    queryFn: () => dietApi.plan(memberId),
    enabled: open,
  });
  const plan = planQuery.data ?? null;

  const foodsQuery = useQuery({
    queryKey: dietKeys.foods(branch),
    queryFn: async () => (await dietApi.foods()).data.items,
    enabled: open && canListFoods,
    staleTime: 5 * 60_000,
  });

  const eligibleTier: DietTier = member?.eligible_tier ?? "BASIC";
  const schema = useMemo(() => baseSchema.superRefine((v, ctx) => {
    if (TIER_RANK[v.tier] > TIER_RANK[eligibleTier]) {
      ctx.addIssue({ code: "custom", path: ["tier"], message: `Member is only eligible for the ${eligibleTier} diet tier` });
    }
  }), [eligibleTier]);

  const { register, handleSubmit, reset, watch, formState: { errors, isDirty } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  // Re-seed the calculator only when the saved calculator inputs change (not on food add/remove).
  const seedKey = plan
    ? [plan.id, plan.weight, plan.height, plan.age, plan.activity_level, plan.tier, plan.category, plan.notes,
      plan.modification_count].join("|")
    : `new|${memberId}`;
  useEffect(() => {
    if (member && planQuery.isSuccess) reset(formFromPlan(plan, member));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey, planQuery.isSuccess, member?.member_id]);

  const values = watch();
  const preview = useMemo(() => {
    if (!member) return null;
    const { weight, height, age, activity_level } = values;
    const ok = Number.isFinite(weight) && weight >= 20 && weight <= 400
      && Number.isFinite(height) && height >= 50 && height <= 300
      && Number.isFinite(age) && age >= 10 && age <= 120 && Number.isFinite(activity_level);
    return ok ? calculateTargets(weight, height, age, activity_level, member.gender) : null;
  }, [member, values]);

  const showingPreview = (!plan || isDirty) && preview !== null;
  const shown = showingPreview
    ? preview
    : plan
      ? { bmi: plan.bmi, bmi_status: plan.bmi_status, bmr: plan.bmr, tdee: plan.tdee,
        target_calories: plan.target_calories, target_protein: plan.target_protein,
        target_carbs: plan.target_carbs, target_fats: plan.target_fats }
      : null;

  // STANDARD: 2 saves per calendar month (count resets when the month changes) — mirrors upsert_plan.
  const formTier = values.tier;
  const usedThisMonth = plan && sameMonth(plan.last_modified_date, today) ? plan.modification_count : 0;
  const limitReached = formTier === "STANDARD" && usedThisMonth >= STANDARD_MONTHLY_LIMIT;
  const showStandardBanner = formTier === "STANDARD" || plan?.tier === "STANDARD";

  const save = useMutation({
    mutationFn: (v: FormValues) => dietApi.upsert(memberId, { ...v, notes: v.notes || null }),
    onSuccess: async (res) => {
      notify.success(res.message);
      qc.setQueryData(dietKeys.plan(branch, memberId), res.data);
      reset(formFromPlan(res.data, member!));
      await qc.invalidateQueries({ queryKey: ["diet", branch, "eligible"] });
      await qc.invalidateQueries({ queryKey: dietKeys.share(branch, memberId) });
    },
    onError: notify.error,
  });

  const close = () => {
    reset({});
    onClose();
  };

  const itemsEditable = !!plan && plan.items_editable && canManage;
  const foods = useMemo(() => {
    if (!canListFoods) return null;
    const all = foodsQuery.data ?? [];
    // A VEG plan only offers VEG / VEGAN foods.
    return plan?.category === "VEG" ? all.filter((f) => f.category !== "NON_VEG") : all;
  }, [canListFoods, foodsQuery.data, plan?.category]);

  const totals = plan?.totals ?? { calories: 0, protein: 0, carbs: 0, fats: 0 };
  const allowedTiers = DIET_TIERS.filter((t) => TIER_RANK[t] <= TIER_RANK[eligibleTier]);

  return (
    <Modal open={open} title={`Diet Builder: ${member?.name ?? ""}`} onClose={close} width="900px" bodyClassName="p-5 md:p-8">
      {planQuery.isLoading ? (
        <div className="p-10 text-center text-sm text-muted">Loading diet plan…</div>
      ) : planQuery.isError ? (
        <div className="p-10 text-center text-sm font-semibold text-accent">Failed to load the diet plan.</div>
      ) : (
        <div className="flex flex-col gap-6">
          <form id="diet-calc-form" onSubmit={handleSubmit((v) => save.mutate(v))} noValidate>
            {showStandardBanner && (
              <div className={cn("mb-4 flex items-center gap-2.5 rounded-[10px] border px-4 py-3 text-[13px] font-bold",
                limitReached ? "border-accent/30 bg-accent-light text-accent" : "border-info-line bg-info-soft text-info")}>
                <Icon name="alert" className="h-4 w-4" />
                {limitReached
                  ? "Standard plan modification limit reached for this month"
                  : `Standard Plan: ${usedThisMonth} / ${plan?.monthly_update_limit ?? STANDARD_MONTHLY_LIMIT} Updates Used this month`}
              </div>
            )}

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <Field label={<span className={label}>Weight (kg)</span>} htmlFor="diet-weight" required error={errors.weight?.message}>
                <Input id="diet-weight" type="number" step="any" min={20} max={400} disabled={!canManage}
                  invalid={!!errors.weight} {...register("weight", { valueAsNumber: true })} />
              </Field>
              <Field label={<span className={label}>Height (cm)</span>} htmlFor="diet-height" required error={errors.height?.message}>
                <Input id="diet-height" type="number" step="any" min={50} max={300} disabled={!canManage}
                  invalid={!!errors.height} {...register("height", { valueAsNumber: true })} />
              </Field>
              <Field label={<span className={label}>Age</span>} htmlFor="diet-age" required error={errors.age?.message}>
                <Input id="diet-age" type="number" step={1} min={10} max={120} disabled={!canManage}
                  invalid={!!errors.age} {...register("age", { valueAsNumber: true })} />
              </Field>
              <Field label={<span className={label}>Tier</span>} htmlFor="diet-tier" required error={errors.tier?.message}>
                <Select id="diet-tier" disabled={!canManage} invalid={!!errors.tier} {...register("tier")}>
                  {allowedTiers.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
                </Select>
              </Field>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-[2fr_1fr]">
              <Field label={<span className={label}>Activity Level</span>} htmlFor="diet-activity" required error={errors.activity_level?.message}>
                <Select id="diet-activity" disabled={!canManage} invalid={!!errors.activity_level}
                  {...register("activity_level", { setValueAs: (v: string | number) => Number(v) })}>
                  {ACTIVITY_LEVELS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </Select>
              </Field>
              <Field label={<span className={label}>Category</span>} htmlFor="diet-category" required error={errors.category?.message}>
                <Select id="diet-category" disabled={!canManage} invalid={!!errors.category} {...register("category")}>
                  {DIET_CATEGORIES.map((c) => <option key={c} value={c}>{c === "NON_VEG" ? "Non-Veg" : "Veg"}</option>)}
                </Select>
              </Field>
            </div>
            <Field className="mt-4" label={<span className={label}>Notes (Optional)</span>} htmlFor="diet-notes" error={errors.notes?.message}>
              <Textarea id="diet-notes" rows={2} disabled={!canManage} placeholder="Allergies, preferences, instructions…"
                invalid={!!errors.notes} {...register("notes")} />
            </Field>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="flex flex-col items-center rounded-xl border-[1.5px] border-line bg-subtle p-4">
                <span className="mb-1 text-[11px] font-extrabold uppercase text-muted">BMR</span>
                <span className="text-lg font-extrabold text-ink">{shown?.bmr != null ? `${num(shown.bmr)} kcal` : "—"}</span>
              </div>
              <div className="flex flex-col items-center rounded-xl border-[1.5px] border-accent bg-accent-light p-4">
                <span className="mb-1 text-[11px] font-extrabold uppercase text-muted">TDEE (Daily Target)</span>
                <span className="text-lg font-extrabold text-ink">{shown?.tdee != null ? `${num(shown.tdee)} kcal` : "—"}</span>
              </div>
              <div className="flex flex-col items-center rounded-xl border-[1.5px] border-line bg-subtle p-4">
                <span className="mb-1 text-[11px] font-extrabold uppercase text-muted">BMI</span>
                <span className="text-lg font-extrabold text-ink">{shown?.bmi != null ? num(shown.bmi) : "—"}</span>
                {shown?.bmi_status && <span className="mt-0.5 text-[11px] font-bold text-accent">{shown.bmi_status}</span>}
              </div>
            </div>
            {showingPreview && (
              <p className="mt-2 text-center text-[11px] font-semibold italic text-muted">
                Live preview — save the plan to apply these targets.
              </p>
            )}

            <div className="mt-6 rounded-xl border border-line bg-subtle p-6">
              <ProgressRow title="Calories" unit=" kcal" actual={totals.calories} target={shown?.target_calories ?? null} color="calories" />
              <ProgressRow title="Protein" unit="g" actual={totals.protein} target={shown?.target_protein ?? null} color="protein" />
              <ProgressRow title="Carbs" unit="g" actual={totals.carbs} target={shown?.target_carbs ?? null} color="carbs" />
              <ProgressRow title="Fats" unit="g" actual={totals.fats} target={shown?.target_fats ?? null} color="fats" />
            </div>
          </form>

          <div>
            <h3 className="mb-3 text-sm font-extrabold uppercase tracking-[0.05em] text-ink">Daily Meal Plan</h3>
            {!plan ? (
              <div className="rounded-xl border-2 border-dashed border-line bg-subtle p-6 text-center text-sm italic text-muted">
                Configure the diet plan first — save the calculator to start assigning meals.
              </div>
            ) : (
              <>
                {!plan.items_editable && (
                  <div className="mb-4 flex items-center gap-2.5 rounded-[10px] border border-accent/30 bg-accent-light px-4 py-3 text-[13px] font-bold text-accent">
                    <Icon name="alert" className="h-4 w-4" />
                    {BASIC_LOCKED_MESSAGE}
                  </div>
                )}
                <div className="flex flex-col gap-4">
                  {plan.meals.map((meal) => (
                    <MealBlock key={meal.meal_time} memberId={memberId} meal={meal} editable={itemsEditable} foods={foods} />
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="form-actions-modern mt-2">
            <Button variant="secondary" onClick={close}>{canManage ? "Cancel" : "Close"}</Button>
            {canManage && (
              <Button type="submit" form="diet-calc-form" loading={save.isPending} disabled={limitReached}>
                {limitReached ? "Update Limit Reached" : "Generate & Save Plan"}
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
