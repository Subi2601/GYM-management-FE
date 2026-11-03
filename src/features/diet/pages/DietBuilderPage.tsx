import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { FormPage } from "@/components/ui/FormPage";
import { Icon } from "@/components/ui/Icon";
import { PageLoader } from "@/components/ui/Loaders";
import { GRID_3, Section } from "@/components/ui/Section";
import { dietApi, dietKeys } from "@/features/diet/api";
import { calculateTargets, num, sameMonth, STANDARD_MONTHLY_LIMIT, TIER_RANK } from "@/features/diet/calc";
import { MealBlock } from "@/features/diet/components/MealBlock";
import { TierBadge } from "@/features/diet/components/TierBadge";
import { memberApi, memberKeys } from "@/features/members/api";
import { todayISO } from "@/lib/format";
import { notify } from "@/lib/notify";
import { cn, humanize } from "@/lib/utils";
import { useCan } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import { ACTIVITY_LEVELS, type DietPlan, type EligibleListQuery, type EligibleMember } from "@/types/diet";
import { DIET_CATEGORIES, DIET_TIERS, type DietTier } from "@/types/enums";

/** Backend message for item edits on BASIC plans (diet_service._editable_plan). */
const BASIC_LOCKED_MESSAGE = "Basic plans cannot be modified. Upgrade to Standard or Premium.";
const FORM_ID = "diet-calc-form";

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

/** The list row passed as router state by DietPlansPage (`navigate(path, { state: { member } })`). */
function memberFromState(state: unknown, memberId: string): EligibleMember | null {
  if (!state || typeof state !== "object" || !("member" in state)) return null;
  const m: unknown = state.member;
  if (!m || typeof m !== "object" || !("member_id" in m) || m.member_id !== memberId) return null;
  return m as EligibleMember;
}

/**
 * /diet-plans/:memberId — loads the plan and the member's eligibility (router state, or looked up by
 * registration ID after a reload), then renders the builder.
 */
export function DietBuilderPage() {
  const { memberId = "" } = useParams<{ memberId: string }>();
  const location = useLocation();
  const branch = useBranchStore((s) => s.selectedBranchId);
  const canListMembers = useCan("member:list");
  const fromState = memberFromState(location.state, memberId);

  const planQuery = useQuery({
    queryKey: dietKeys.plan(branch, memberId),
    queryFn: () => dietApi.plan(memberId),
    enabled: !!memberId,
  });
  const plan = planQuery.data ?? null;

  // Reload / deep link: find the eligibility row by registration ID (from the plan, else the member record).
  const needLookup = !fromState && planQuery.isSuccess;
  const memberQuery = useQuery({
    queryKey: memberKeys.detail(branch, memberId),
    queryFn: () => memberApi.get(memberId),
    enabled: needLookup && !plan && canListMembers,
  });
  const regId = plan?.registration_id ?? memberQuery.data?.data.registration_id;
  const lookupQuery: EligibleListQuery = { page: 1, page_size: 20, search: regId };
  const eligibleQuery = useQuery({
    queryKey: dietKeys.eligible(branch, lookupQuery),
    queryFn: async () => (await dietApi.eligible(lookupQuery)).data,
    enabled: needLookup && !!regId,
  });
  const member = fromState ?? eligibleQuery.data?.items.find((m) => m.member_id === memberId) ?? null;

  const loading = planQuery.isLoading || memberQuery.isLoading || eligibleQuery.isLoading;
  if (loading) return <PageLoader />;

  if (planQuery.isError || !member) {
    return (
      <FormPage title="Diet plan unavailable" backTo="/diet-plans" backLabel="Diet plans">
        <p className="m-0 text-sm text-muted">
          {planQuery.isError
            ? "Failed to load the diet plan."
            : "This member is not eligible for a diet plan in the selected branch. Open the plan from the Diet plans list."}
        </p>
      </FormPage>
    );
  }
  return <DietBuilder key={member.member_id} member={member} plan={plan} />;
}

const BAR_COLORS = { calories: "bg-accent", protein: "bg-info", carbs: "bg-success", fats: "bg-warning" } as const;

function ProgressRow({ title, unit, actual, target, color }: {
  title: string; unit: string; actual: number; target: number | null; color: keyof typeof BAR_COLORS;
}) {
  const pct = target ? Math.min((actual / target) * 100, 100) : 0;
  const over = target !== null && target > 0 && actual > target;
  return (
    <div>
      <div className="mb-1.5 flex justify-between gap-2 text-xs">
        <span className="font-semibold text-muted">{title}</span>
        <span className={cn("font-bold", over ? "text-accent" : "text-ink")}>
          {num(actual)}{unit} <span className="font-medium text-muted">/ {target !== null ? num(target) : "—"}{unit}</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-hover">
        <div className={cn("h-full rounded-full transition-[width] duration-500", BAR_COLORS[color])} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Metric({ label, value, sub, highlight = false }: { label: string; value: string; sub?: string | null; highlight?: boolean }) {
  return (
    <div className={cn("flex flex-col rounded-xl border px-4 py-3",
      highlight ? "col-span-2 border-line-accent bg-accent-light" : "border-line bg-subtle")}>
      <span className="text-xs font-semibold text-muted">{label}</span>
      <span className="mt-0.5 text-lg font-extrabold text-ink">{value}</span>
      {sub && <span className="text-xs font-bold text-accent">{sub}</span>}
    </div>
  );
}

/** Diet builder: calculator with live preview (PUT on save), macro progress, meals with the food picker. */
function DietBuilder({ member, plan }: { member: EligibleMember; plan: DietPlan | null }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const branch = useBranchStore((s) => s.selectedBranchId);
  const canManage = useCan("diet:manage");
  const canListFoods = useCan("food:list");
  const memberId = member.member_id;
  const today = todayISO();
  const toList = () => navigate("/diet-plans");

  const foodsQuery = useQuery({
    queryKey: dietKeys.foods(branch),
    queryFn: async () => (await dietApi.foods()).data.items,
    enabled: canListFoods,
    staleTime: 5 * 60_000,
  });

  const eligibleTier: DietTier = member.eligible_tier;
  const schema = useMemo(() => baseSchema.superRefine((v, ctx) => {
    if (TIER_RANK[v.tier] > TIER_RANK[eligibleTier]) {
      ctx.addIssue({ code: "custom", path: ["tier"], message: `Member is only eligible for the ${eligibleTier} diet tier` });
    }
  }), [eligibleTier]);

  const { register, handleSubmit, reset, watch, formState: { errors, isDirty } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: formFromPlan(plan, member),
  });

  // Re-seed the calculator only when the saved calculator inputs change (not on food add/remove).
  const seedKey = plan
    ? [plan.id, plan.weight, plan.height, plan.age, plan.activity_level, plan.tier, plan.category, plan.notes,
      plan.modification_count].join("|")
    : `new|${memberId}`;
  useEffect(() => {
    reset(formFromPlan(plan, member));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey]);

  const values = watch();
  const preview = useMemo(() => {
    const { weight, height, age, activity_level } = values;
    const ok = Number.isFinite(weight) && weight >= 20 && weight <= 400
      && Number.isFinite(height) && height >= 50 && height <= 300
      && Number.isFinite(age) && age >= 10 && age <= 120 && Number.isFinite(activity_level);
    return ok ? calculateTargets(weight, height, age, activity_level, member.gender) : null;
  }, [member.gender, values]);

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
      reset(formFromPlan(res.data, member));
      await qc.invalidateQueries({ queryKey: dietKeys.eligibleAll(branch) });
      await qc.invalidateQueries({ queryKey: dietKeys.share(branch, memberId) });
    },
    onError: notify.error,
  });

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
    <FormPage
      title={plan ? "Edit diet plan" : "Build diet plan"}
      subtitle={
        <span className="inline-flex flex-wrap items-center gap-2">
          {member.name} · {member.registration_id} · eligible for <TierBadge tier={eligibleTier} />
        </span>
      }
      backTo="/diet-plans"
      backLabel="Diet plans"
      actions={
        <>
          <Button variant="secondary" onClick={toList}>{canManage ? "Cancel" : "Close"}</Button>
          {canManage && (
            <Button type="submit" form={FORM_ID} loading={save.isPending} disabled={limitReached}>
              {limitReached ? "Update limit reached" : plan ? "Recalculate & save" : "Generate & save plan"}
            </Button>
          )}
        </>
      }
    >
      {showStandardBanner && (
        <div className={cn("flex items-center gap-2.5 rounded-xl border px-4 py-3 text-[13px] font-semibold",
          limitReached ? "border-line-accent bg-accent-light text-accent" : "border-info-line bg-info-soft text-info")}>
          <Icon name="alert" className="h-4 w-4 shrink-0" />
          {limitReached
            ? "Standard plan modification limit reached for this month"
            : `Standard plan: ${usedThisMonth} of ${plan?.monthly_update_limit ?? STANDARD_MONTHLY_LIMIT} updates used this month`}
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1fr_340px]">
        <Section title="Body metrics" description="Used to calculate BMR, daily calories and macro targets">
          <form id={FORM_ID} onSubmit={handleSubmit((v) => save.mutate(v))} noValidate>
            <fieldset disabled={!canManage} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
              <div className={GRID_3}>
                <Field label="Weight (kg)" htmlFor="diet-weight" required error={errors.weight?.message}>
                  <Input id="diet-weight" type="number" step="any" min={20} max={400} placeholder="e.g. 75"
                    invalid={!!errors.weight} {...register("weight", { valueAsNumber: true })} />
                </Field>
                <Field label="Height (cm)" htmlFor="diet-height" required error={errors.height?.message}>
                  <Input id="diet-height" type="number" step="any" min={50} max={300} placeholder="e.g. 175"
                    invalid={!!errors.height} {...register("height", { valueAsNumber: true })} />
                </Field>
                <Field label="Age" htmlFor="diet-age" required error={errors.age?.message}>
                  <Input id="diet-age" type="number" step={1} min={10} max={120} placeholder="e.g. 28"
                    invalid={!!errors.age} {...register("age", { valueAsNumber: true })} />
                </Field>
                <Field label="Activity level" htmlFor="diet-activity" required className="md:col-span-2 lg:col-span-3"
                  error={errors.activity_level?.message}>
                  <Select id="diet-activity" invalid={!!errors.activity_level}
                    {...register("activity_level", { setValueAs: (v: string | number) => Number(v) })}>
                    {ACTIVITY_LEVELS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </Select>
                </Field>
                <Field label="Tier" htmlFor="diet-tier" required error={errors.tier?.message}>
                  <Select id="diet-tier" invalid={!!errors.tier} {...register("tier")}>
                    {allowedTiers.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
                  </Select>
                </Field>
                <Field label="Category" htmlFor="diet-category" required error={errors.category?.message}>
                  <Select id="diet-category" invalid={!!errors.category} {...register("category")}>
                    {DIET_CATEGORIES.map((c) => <option key={c} value={c}>{c === "NON_VEG" ? "Non-veg" : "Veg"}</option>)}
                  </Select>
                </Field>
              </div>
              <Field label="Notes" htmlFor="diet-notes" error={errors.notes?.message}>
                <Textarea id="diet-notes" rows={2} placeholder="Allergies, preferences, instructions…"
                  invalid={!!errors.notes} {...register("notes")} />
              </Field>
            </fieldset>
          </form>
        </Section>

        <div className="lg:sticky lg:top-[calc(var(--header-height)+24px)]">
          <Section title="Targets" description={showingPreview ? "Live preview — save to apply" : plan ? "Saved plan" : "Fill in the metrics"}>
            <div className="grid grid-cols-2 gap-3">
              <Metric label="TDEE (daily target)" value={shown?.tdee != null ? `${num(shown.tdee)} kcal` : "—"} highlight />
              <Metric label="BMR" value={shown?.bmr != null ? `${num(shown.bmr)} kcal` : "—"} />
              <Metric label="BMI" value={shown?.bmi != null ? num(shown.bmi) : "—"} sub={shown?.bmi_status} />
            </div>
            <div className="mt-5 flex flex-col gap-4">
              <ProgressRow title="Calories" unit=" kcal" actual={totals.calories} target={shown?.target_calories ?? null} color="calories" />
              <ProgressRow title="Protein" unit="g" actual={totals.protein} target={shown?.target_protein ?? null} color="protein" />
              <ProgressRow title="Carbs" unit="g" actual={totals.carbs} target={shown?.target_carbs ?? null} color="carbs" />
              <ProgressRow title="Fats" unit="g" actual={totals.fats} target={shown?.target_fats ?? null} color="fats" />
            </div>
          </Section>
        </div>
      </div>

      <Section title="Daily meal plan" description="Foods assigned to each meal; totals update the targets above">
        {!plan ? (
          <div className="rounded-xl border-2 border-dashed border-line bg-subtle p-6 text-center text-sm text-muted">
            Save the body metrics first to start assigning meals.
          </div>
        ) : (
          <>
            {!plan.items_editable && (
              <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-line-accent bg-accent-light px-4 py-3 text-[13px] font-semibold text-accent">
                <Icon name="alert" className="h-4 w-4 shrink-0" />
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
      </Section>
    </FormPage>
  );
}
