import { useQuery } from "@tanstack/react-query";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { dietApi, dietKeys } from "@/features/diet/api";
import { num } from "@/features/diet/calc";
import { MacroPills } from "@/features/diet/components/MealBlock";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useBranchStore } from "@/stores/branch-store";
import type { DietPlan, EligibleMember } from "@/types/diet";

const PRINT_ROOT_ID = "diet-plan-print-root";
/** While the view modal is open, printing shows only the plan sheet (A4, colours kept). */
const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 1cm; }
  body > *:not(#${PRINT_ROOT_ID}) { display: none !important; }
  #${PRINT_ROOT_ID} { display: block !important; }
  body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`;

/** The printable plan (".plan-view-container") — used on screen and in the print portal. */
function PlanSheet({ plan }: { plan: DietPlan }) {
  const metaLabel = "mb-1 block text-[10px] font-extrabold text-muted";
  const metaValue = "text-[15px] font-bold text-ink";
  const macroCard = "flex flex-col items-center rounded-xl border-[1.5px] p-4";
  return (
    <div className="bg-surface p-6 print:p-0">
      <div className="mb-6 flex items-center justify-between border-b-[3px] border-black pb-4">
        <div>
          <h2 className="m-0 text-[28px] font-black tracking-[-0.02em] text-black">STAG FITNESS</h2>
          <p className="m-0 mt-0.5 text-xs font-bold uppercase text-muted">Lifestyle &amp; Fitness Studio</p>
        </div>
        <div className="rounded bg-black px-4 py-1.5 text-sm font-extrabold text-white">{plan.tier} PLAN</div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-5 rounded-lg bg-subtle p-4 md:grid-cols-[2fr_1fr_1.5fr_1.5fr] print:grid-cols-[2fr_1fr_1.5fr_1.5fr]">
        <div><span className={metaLabel}>MEMBER NAME</span><span className={metaValue}>{plan.member_name}</span></div>
        <div><span className={metaLabel}>REG ID</span><span className={metaValue}>{plan.registration_id}</span></div>
        <div>
          <span className={metaLabel}>WEIGHT / BMI</span>
          <span className={metaValue}>
            {plan.weight !== null ? num(plan.weight) : "—"}kg / {plan.bmi !== null ? num(plan.bmi) : "—"}
            {plan.bmi_status ? ` (${plan.bmi_status})` : ""}
          </span>
        </div>
        <div>
          <span className={metaLabel}>ASSIGNED CALORIES</span>
          <span className="text-lg font-bold text-accent">{num(plan.totals.calories)} / {num(plan.target_calories)} kcal</span>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3 print:grid-cols-3">
        <div className={cn(macroCard, "border-info-line bg-info-soft")}>
          <span className="text-2xl font-black">{num(plan.totals.protein)}g</span>
          <span className="mt-1 text-[11px] font-extrabold opacity-70">PROTEIN (Target: {num(plan.target_protein)}g)</span>
        </div>
        <div className={cn(macroCard, "border-success-line bg-success-soft")}>
          <span className="text-2xl font-black">{num(plan.totals.carbs)}g</span>
          <span className="mt-1 text-[11px] font-extrabold opacity-70">CARBS (Target: {num(plan.target_carbs)}g)</span>
        </div>
        <div className={cn(macroCard, "border-warning-line bg-warning-soft")}>
          <span className="text-2xl font-black">{num(plan.totals.fats)}g</span>
          <span className="mt-1 text-[11px] font-extrabold opacity-70">FATS (Target: {num(plan.target_fats)}g)</span>
        </div>
      </div>

      <div className="mb-5 mt-8 flex items-center gap-4 after:h-[1.5px] after:w-full after:bg-line after:content-['']">
        <span className="whitespace-nowrap text-[13px] font-extrabold tracking-[0.1em] text-muted">DAILY MEAL CHART</span>
      </div>

      <div className="mb-6 overflow-hidden rounded-xl border-[1.5px] border-line print:border-black">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr>
              {["Meal", "Food Items & Quantity", "Calories", "Macros (P/C/F)"].map((h) => (
                <th key={h} className="border-b-[1.5px] border-line bg-subtle px-4 py-3 text-[11px] font-extrabold uppercase tracking-[0.05em] text-secondary-grey print:border-black print:text-black">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plan.meals.map((meal) => (
              <tr key={meal.meal_time} className="break-inside-avoid">
                <td className="border-b border-line-light p-4 align-top font-extrabold text-ink">{meal.meal_time}</td>
                <td className="border-b border-line-light p-4 align-top">
                  {meal.items.map((f) => (
                    <div key={f.id} className="mb-1 flex items-center gap-2 font-semibold text-secondary-grey">
                      <span className="text-lg leading-none text-faint">•</span>
                      {f.food_name}
                      <span className="text-[11px] font-medium text-muted">({num(f.quantity)} {f.serving_unit})</span>
                    </div>
                  ))}
                  {meal.items.length === 0 && <div className="text-[13px] italic text-muted">No items assigned</div>}
                </td>
                <td className="border-b border-line-light p-4 align-top text-[15px] text-ink">
                  <strong>{num(meal.totals.calories)}</strong> <small className="font-semibold text-muted">kcal</small>
                </td>
                <td className="border-b border-line-light p-4 align-top">
                  <MacroPills protein={meal.totals.protein} carbs={meal.totals.carbs} fats={meal.totals.fats} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-subtle font-extrabold text-ink">
              <td colSpan={2} className="p-4">TOTAL DAILY INTAKE</td>
              <td className="p-4"><strong>{num(plan.totals.calories)} kcal</strong></td>
              <td className="p-4">
                <MacroPills protein={plan.totals.protein} carbs={plan.totals.carbs} fats={plan.totals.fats} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {plan.notes && (
        <div className="mb-4 rounded-lg border border-line bg-subtle p-4 text-sm text-ink">
          <span className="mb-1 block text-[10px] font-extrabold text-muted">NOTES</span>
          <span className="whitespace-pre-line">{plan.notes}</span>
        </div>
      )}

      <div className="text-[13px] italic text-muted">
        <p className="m-0">* Stick to the assigned macros for best results. Stay Hydrated!</p>
        <p className="m-0 mt-1">Plan Generated on {formatDate(plan.last_modified_date ?? plan.updated_at)}</p>
      </div>
    </div>
  );
}

/** "Member Diet Plan" — read-only sheet with Download PDF (print) and WhatsApp share. */
export function DietViewModal({ member, onClose }: { member: EligibleMember | null; onClose: () => void }) {
  const branch = useBranchStore((s) => s.selectedBranchId);
  const open = member !== null;
  const memberId = member?.member_id ?? "";

  const planQuery = useQuery({
    queryKey: dietKeys.plan(branch, memberId),
    queryFn: () => dietApi.plan(memberId),
    enabled: open,
  });
  const plan = planQuery.data ?? null;

  const share = useQuery({
    queryKey: dietKeys.share(branch, memberId),
    queryFn: async () => (await dietApi.shareText(memberId)).data,
    enabled: open && plan !== null,
  });

  const shareWhatsApp = () => {
    if (share.data) window.open(share.data.whatsapp_url, "_blank", "noopener");
  };

  return (
    <Modal open={open} title="Member Diet Plan" onClose={onClose} width="900px" bodyClassName="p-4 md:p-6">
      {planQuery.isLoading && <div className="p-10 text-center text-sm text-muted">Loading diet plan…</div>}
      {planQuery.isError && <div className="p-10 text-center text-sm font-semibold text-accent">Failed to load the diet plan.</div>}
      {planQuery.isSuccess && !plan && (
        <div className="rounded-xl border-2 border-dashed border-line bg-subtle p-8 text-center italic text-muted">
          No active plan found. Please configure one first.
        </div>
      )}
      {plan && (
        <>
          <PlanSheet plan={plan} />
          {createPortal(
            <div id={PRINT_ROOT_ID} className="hidden">
              <style>{PRINT_CSS}</style>
              <PlanSheet plan={plan} />
            </div>,
            document.body,
          )}
        </>
      )}

      <div className="form-actions-modern no-print items-center md:justify-between">
        <Button variant="secondary" onClick={onClose}>Close</Button>
        {plan && (
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <button type="button" onClick={shareWhatsApp} disabled={!share.data}
              title={share.isError ? "Could not prepare the WhatsApp message" : undefined}
              className="inline-flex items-center justify-center gap-2 rounded-lg border-none bg-[#25d366] px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:enabled:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
              <Icon name="whatsapp" className="h-4 w-4" />
              {share.isLoading ? "Preparing…" : "Share WhatsApp"}
            </button>
            <Button icon={<Icon name="print" className="h-4 w-4" />} onClick={() => window.print()}>Download PDF</Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
