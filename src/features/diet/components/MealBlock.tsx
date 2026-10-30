import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { confirm } from "@/components/ui/ConfirmDialog";
import { dietApi, dietKeys } from "@/features/diet/api";
import { num } from "@/features/diet/calc";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { useBranchStore } from "@/stores/branch-store";
import type { DietMeal, DietPlan, FoodItem } from "@/types/diet";

const schema = z.object({
  food_item_id: z.string().uuid("Select a food"),
  quantity: z.number({ invalid_type_error: "Required" }).gt(0, "Must be > 0").max(5000, "Max 5000"),
});
type FormValues = z.infer<typeof schema>;

interface MealBlockProps {
  memberId: string;
  meal: DietMeal;
  /** Food add/remove allowed (plan items_editable + diet:manage). */
  editable: boolean;
  /** Food catalogue for the picker; null hides the picker (no food:list). */
  foods: FoodItem[] | null;
}

export function MacroPills({ protein, carbs, fats }: { protein: number; carbs: number; fats: number }) {
  const pill = "rounded px-2 py-0.5 text-[11px] font-bold";
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className={cn(pill, "bg-info-soft text-info")}>P: {num(protein)}g</span>
      <span className={cn(pill, "bg-success-soft text-success")}>C: {num(carbs)}g</span>
      <span className={cn(pill, "bg-warning-soft text-warning")}>F: {num(fats)}g</span>
    </div>
  );
}

/** One ".meal-block": header with totals, food chips, food picker. */
export function MealBlock({ memberId, meal, editable, foods }: MealBlockProps) {
  const qc = useQueryClient();
  const branch = useBranchStore((s) => s.selectedBranchId);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { food_item_id: "", quantity: 100 },
  });

  const applyPlan = async (plan: DietPlan) => {
    qc.setQueryData(dietKeys.plan(branch, memberId), plan);
    await qc.invalidateQueries({ queryKey: dietKeys.share(branch, memberId) });
  };

  const add = useMutation({
    mutationFn: (v: FormValues) => dietApi.addItem(memberId, { ...v, meal_time: meal.meal_time }),
    onSuccess: async (res) => {
      notify.success(res.message);
      reset({ food_item_id: "", quantity: 100 });
      await applyPlan(res.data);
    },
    onError: notify.error,
  });

  const remove = useMutation({
    mutationFn: (itemId: string) => dietApi.removeItem(memberId, itemId),
    onSuccess: async (res) => {
      notify.success(res.message);
      await applyPlan(res.data);
    },
    onError: notify.error,
  });

  const onRemove = async (itemId: string, name: string) => {
    if (await confirm(`Remove "${name}" from ${meal.meal_time}?`)) remove.mutate(itemId);
  };

  const control = "rounded-lg border border-line bg-surface px-2 py-2 text-[13px] font-medium text-ink outline-none focus:border-secondary-grey";

  return (
    <div className="rounded-xl border-[1.5px] border-line bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-line pb-2">
        <span className="font-extrabold text-ink">{meal.meal_time}</span>
        <div className="flex flex-wrap items-center gap-3">
          <MacroPills protein={meal.totals.protein} carbs={meal.totals.carbs} fats={meal.totals.fats} />
          <span className="text-xs font-bold text-muted">{num(meal.totals.calories)} kcal</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {meal.items.length === 0 && <div className="text-[13px] italic text-muted">No foods assigned</div>}
        {meal.items.map((item) => (
          <div key={item.id}
            className="flex min-w-[180px] items-center justify-between gap-3 rounded-[10px] border-[1.5px] border-line bg-surface px-3.5 py-2.5 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
            <div className="flex flex-col">
              <span className="text-[13px] font-bold text-ink">{item.food_name}</span>
              <span className="text-[11px] font-semibold text-muted">
                {num(item.quantity)} {item.serving_unit} · {num(item.calories)}cal | P:{num(item.protein)}g
              </span>
            </div>
            {editable && (
              <button type="button" title="Remove food" disabled={remove.isPending}
                onClick={() => void onRemove(item.id, item.food_name)}
                className="flex h-6 w-6 items-center justify-center rounded-md border-none bg-danger-soft text-base font-extrabold text-danger transition-all hover:bg-danger hover:text-white disabled:opacity-50">
                &times;
              </button>
            )}
          </div>
        ))}
      </div>

      {editable && foods && (
        <form onSubmit={handleSubmit((v) => add.mutate(v))} noValidate className="mt-3">
          <div className="flex flex-wrap items-start gap-2">
            <select aria-label={`Food for ${meal.meal_time}`} className={cn(control, "min-w-[220px] flex-1", errors.food_item_id && "border-accent")}
              {...register("food_item_id")}>
              <option value="">+ Add food to {meal.meal_time}...</option>
              {foods.map((f) => (
                <option key={f.id} value={f.id}>{f.name} ({num(f.calories)}cal / 100 {f.serving_unit})</option>
              ))}
            </select>
            <input type="number" min={1} max={5000} step="any" aria-label="Quantity" title="Quantity (g / units, per 100 basis)"
              className={cn(control, "w-24", errors.quantity && "border-accent")}
              {...register("quantity", { valueAsNumber: true })} />
            <Button type="submit" variant="secondary" loading={add.isPending} className="h-[38px] px-4 py-0 text-[13px]">
              Add
            </Button>
          </div>
          {(errors.food_item_id || errors.quantity) && (
            <span className="mt-1 block text-xs font-semibold text-accent">
              {errors.food_item_id?.message ?? errors.quantity?.message}
            </span>
          )}
        </form>
      )}
    </div>
  );
}
