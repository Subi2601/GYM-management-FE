import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input, READONLY_INPUT, Select, Textarea } from "@/components/ui/Field";
import { Drawer } from "@/components/ui/Modal";
import { FormDivider, GRID_2 } from "@/components/ui/Section";
import { planApi, useInvalidatePlans, usePlanCategories } from "@/features/plans/api";
import { dayRate, defaultUpgradeWindow, planUnitPrice, SERVICE_LABEL } from "@/features/plans/labels";
import { formatINR } from "@/lib/format";
import { notify } from "@/lib/notify";
import { PLAN_SERVICE_TYPES, PLAN_TYPES } from "@/types/enums";
import type { Plan, PlanInput } from "@/types/plan";

const FORM_ID = "plan-form";

const intIn = (min: number, max: number) =>
  z.string().trim().min(1, "Required")
    .refine((v) => Number.isInteger(Number(v)), "Enter a whole number")
    .refine((v) => Number(v) >= min && Number(v) <= max, `Must be between ${min} and ${max}`);
const optionalInt = (min: number, max: number) => z.string().trim()
  .refine((v) => v === "" || (Number.isInteger(Number(v)) && Number(v) >= min && Number(v) <= max),
    `Must be between ${min} and ${max}`);

/** Mirrors backend PlanCreate + plan_service._check_rules. */
const schema = z.object({
  name: z.string().trim().min(1, "Plan name is required").max(120),
  category_id: z.string().min(1, "Choose a category"),
  type: z.enum(PLAN_TYPES),
  service_type: z.enum(PLAN_SERVICE_TYPES),
  /** Memberships can be sold in calendar months or in days; add-ons and custom plans in days. */
  bill_by: z.enum(["months", "days"]),
  duration: z.string(),
  price: z.string().trim().min(1, "Required")
    .refine((v) => Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 10_000_000, "Enter a valid price"),
  total_sessions: optionalInt(0, 1000),
  group_size: intIn(1, 50),
  free_members: optionalInt(0, 49),
  id_check: z.string().trim().max(60, "Max 60 characters"),
  all_branches: z.boolean(),
  /** Empty = default by duration. */
  upgrade_window: optionalInt(0, 3650),
  refundable: z.boolean(),
  /** Empty = the gym's refund days (Configuration). */
  refund_window: optionalInt(0, 3650),
  is_active: z.boolean(),
  description: z.string().max(2000),
}).superRefine((v, ctx) => {
  const issue = (path: string, message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
  const months = v.bill_by === "months" && v.type === "MEMBERSHIP";
  const d = Number(v.duration);
  if (v.duration.trim() === "" || !Number.isInteger(d)) issue("duration", "Enter a whole number");
  else if (months ? d < 1 || d > 60 : d < 1 || d > 3650) issue("duration", months ? "1 to 60 months" : "1 to 3650 days");
  if (v.service_type === "PERSONAL_TRAINING" && !(Number(v.total_sessions) >= 1)) {
    issue("total_sessions", "Personal training needs at least 1 session");
  }
  if (Number(v.free_members || 0) >= Number(v.group_size) && Number(v.free_members || 0) > 0) {
    issue("free_members", "Must be fewer than the members");
  }
});
type FormValues = z.infer<typeof schema>;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Total cost of a custom plan (days × per-day price); null while either input is incomplete. */
function customTotal(days: string, perDay: string): number | null {
  const d = Number(days);
  const p = Number(perDay);
  if (days.trim() === "" || perDay.trim() === "" || !Number.isInteger(d) || d < 1 || !Number.isFinite(p) || p < 0) return null;
  return round2(d * p);
}

function toValues(plan: Plan | null, categoryId: string): FormValues {
  return {
    name: plan?.name ?? "",
    category_id: plan?.category_id ?? categoryId,
    type: plan?.type ?? "MEMBERSHIP",
    service_type: plan?.service_type ?? "GENERAL",
    bill_by: plan && !plan.duration_months ? "days" : "months",
    duration: plan ? String(plan.duration_months ?? plan.duration_days) : "",
    // A custom plan is edited as a per-day price; every other plan as its total price.
    price: plan ? String(dayRate(plan) ?? plan.price) : "",
    total_sessions: plan && plan.total_sessions > 0 ? String(plan.total_sessions) : "",
    group_size: String(plan?.group_size ?? 1),
    free_members: plan && plan.free_members > 0 ? String(plan.free_members) : "",
    id_check: plan?.id_check ?? "",
    all_branches: plan?.all_branches ?? false,
    upgrade_window: plan ? String(plan.upgrade_window_days) : "",
    refundable: plan?.refundable ?? false,
    refund_window: plan?.refund_window_days != null ? String(plan.refund_window_days) : "",
    is_active: plan?.is_active ?? true,
    description: plan?.description ?? "",
  };
}

interface PlanFormDrawerProps {
  /** null = add. */
  plan: Plan | null;
  /** Category preselected when adding (the tab the owner is on). */
  defaultCategoryId?: string;
  onClose: () => void;
}

/** Add / edit plan slide-over. Mounted only while open, so state resets on close. */
export function PlanFormDrawer({ plan, defaultCategoryId = "", onClose }: PlanFormDrawerProps) {
  const invalidate = useInvalidatePlans();
  const categories = usePlanCategories();
  const { register, control, handleSubmit, watch, setValue, getValues, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toValues(plan, defaultCategoryId),
  });
  const type = watch("type");
  const serviceType = watch("service_type");
  const isCustom = type === "CUSTOM";
  const isMembership = type === "MEMBERSHIP";
  const byMonths = isMembership && watch("bill_by") === "months";
  const total = isCustom ? customTotal(watch("duration"), watch("price")) : null;
  const groupSize = Number(watch("group_size")) || 1;
  const durationNum = Number(watch("duration")) || 0;
  const defaultWindow = defaultUpgradeWindow(byMonths ? durationNum || null : null, byMonths ? 0 : durationNum);
  const windowValue = watch("upgrade_window");

  // Membership and custom plans are always GENERAL (backend rule); only memberships cover several members.
  useEffect(() => {
    if (type !== "ADD_ON" && serviceType !== "GENERAL") setValue("service_type", "GENERAL");
    if (type !== "MEMBERSHIP") {
      setValue("group_size", "1");
      setValue("free_members", "");
    }
  }, [type, serviceType, setValue]);

  // Switching to / from Customization converts the price between total and per day, so it keeps its meaning.
  const prevType = useRef(type);
  useEffect(() => {
    const was = prevType.current;
    prevType.current = type;
    if ((was === "CUSTOM") === (type === "CUSTOM")) return;
    const days = Number(getValues("duration"));
    const price = Number(getValues("price"));
    if (getValues("price").trim() === "" || !Number.isFinite(price) || !(days >= 1)) return;
    setValue("price", String(round2(type === "CUSTOM" ? price / days : price * days)));
  }, [type, getValues, setValue]);

  const save = useMutation({
    mutationFn: (body: PlanInput) => (plan ? planApi.update(plan.id, body) : planApi.create(body)),
    onSuccess: async (res) => {
      notify.success(res.message);
      await invalidate();
      onClose();
    },
    onError: notify.error,
  });

  const onSubmit = (v: FormValues) => {
    const months = v.bill_by === "months" && v.type === "MEMBERSHIP";
    const d = Number(v.duration);
    save.mutate({
      name: v.name.trim(),
      category_id: v.category_id,
      type: v.type,
      service_type: v.type === "ADD_ON" ? v.service_type : "GENERAL",
      duration_months: months ? d : null,
      duration_days: months ? null : d,
      // Custom plans are stored with their total, so enrolment, payments and invoices work unchanged.
      price: v.type === "CUSTOM" ? round2(d * Number(v.price)) : Number(v.price),
      total_sessions: v.type === "ADD_ON" && v.total_sessions !== "" ? Number(v.total_sessions) : 0,
      group_size: v.type === "MEMBERSHIP" ? Number(v.group_size) : 1,
      free_members: v.type === "MEMBERSHIP" && v.free_members !== "" ? Number(v.free_members) : 0,
      id_check: v.id_check.trim() || null,
      all_branches: v.all_branches,
      upgrade_window_days: v.type === "MEMBERSHIP" && v.upgrade_window !== "" ? Number(v.upgrade_window) : null,
      refundable: v.type !== "ADD_ON" && v.refundable,
      refund_window_days: v.type !== "ADD_ON" && v.refundable && v.refund_window !== "" ? Number(v.refund_window) : null,
      is_active: v.is_active,
      description: v.description.trim() || null,
    });
  };

  const unit = planUnitPrice({
    duration_months: byMonths ? Number(watch("duration")) || null : null, duration_days: Number(watch("duration")) || 0,
    total_sessions: Number(watch("total_sessions")) || 0, price: Number(watch("price")) || 0, group_size: groupSize,
    free_members: Number(watch("free_members")) || 0, type,
  });

  return (
    <Drawer
      open
      title={plan ? "Edit plan" : "Add plan"}
      subtitle={plan ? `${plan.category_name} · ${plan.name}` : "A plan the desk can sell: price, duration and package rules"}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form={FORM_ID} loading={save.isPending}>{plan ? "Update plan" : "Save plan"}</Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormDivider>Plan</FormDivider>
        <div className={GRID_2}>
          <Field label="Category" htmlFor="plan-category" required error={errors.category_id?.message}
            hint="Your own list; manage it with Categories on the Plans screen">
            <Select id="plan-category" invalid={!!errors.category_id} {...register("category_id")}>
              <option value="">{categories.isLoading ? "Loading…" : "Choose a category"}</option>
              {(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.is_active ? "" : " (inactive)"}</option>
              ))}
            </Select>
          </Field>
          <Field label="Plan name" htmlFor="plan-name" required error={errors.name?.message}>
            <Input id="plan-name" placeholder="e.g. 3 Months" invalid={!!errors.name} {...register("name")} />
          </Field>

          <Field label="Plan type" htmlFor="plan-type" required
            hint={isCustom ? "For members who need a duration outside the regular packs" : undefined}>
            <Select id="plan-type" {...register("type")}>
              <option value="MEMBERSHIP">Membership</option>
              <option value="ADD_ON">Add-on service</option>
              <option value="CUSTOM">Customization</option>
            </Select>
          </Field>

          {type === "ADD_ON" ? (
            <Field label="Service type" htmlFor="plan-service" required error={errors.service_type?.message}>
              <Select id="plan-service" {...register("service_type")}>
                {PLAN_SERVICE_TYPES.map((s) => <option key={s} value={s}>{SERVICE_LABEL[s]}</option>)}
              </Select>
            </Field>
          ) : isMembership ? (
            <Field label="Bill by" htmlFor="plan-bill-by" required hint="Months follow the calendar: 5 Nov + 3 → 5 Feb">
              <Select id="plan-bill-by" {...register("bill_by")}>
                <option value="months">Months</option>
                <option value="days">Days</option>
              </Select>
            </Field>
          ) : <div />}
        </div>

        <FormDivider>Pricing &amp; duration</FormDivider>
        <div className={GRID_2}>
          <Field label={byMonths ? "Duration (months)" : type === "ADD_ON" && serviceType === "PERSONAL_TRAINING"
            ? "Valid for (days)" : "Duration (days)"} htmlFor="plan-duration" required error={errors.duration?.message}>
            <Input id="plan-duration" type="number" min={1} placeholder={byMonths ? "e.g. 3" : isCustom ? "e.g. 20" : "e.g. 60"}
              invalid={!!errors.duration} {...register("duration")} />
          </Field>

          <Field label={isCustom ? "Price (per day)" : "Price (₹)"} htmlFor="plan-price" required error={errors.price?.message}
            hint={isCustom ? "Amount in ₹ for one day" : unit ?? undefined}>
            <Input id="plan-price" type="number" min={0} step="0.01" placeholder={isCustom ? "e.g. 300" : "e.g. 5099"}
              invalid={!!errors.price} {...register("price")} />
          </Field>

          {isCustom && (
            <Field label="Total cost" htmlFor="plan-total" className="md:col-span-2"
              hint={total !== null ? `${watch("duration")} days × ${formatINR(Number(watch("price")))} per day` : "Enter the duration and the price per day"}>
              <Input id="plan-total" readOnly tabIndex={-1} value={total !== null ? formatINR(total) : "—"}
                className={`${READONLY_INPUT} !font-bold !text-ink`} />
            </Field>
          )}

          {type === "ADD_ON" && (
            <Field label="Total sessions" htmlFor="plan-sessions" required={serviceType === "PERSONAL_TRAINING"}
              error={errors.total_sessions?.message}
              hint={serviceType === "PERSONAL_TRAINING" ? "Trainer sessions included in the plan" : "Leave blank if not session-based"}>
              <Input id="plan-sessions" type="number" min={0} placeholder="e.g. 24" invalid={!!errors.total_sessions}
                {...register("total_sessions")} />
            </Field>
          )}
        </div>

        <FormDivider>Package rules</FormDivider>
        <div className={GRID_2}>
          {isMembership && (
            <>
              <Field label="Members covered" htmlFor="plan-group" required error={errors.group_size?.message}
                hint={groupSize > 1 ? "Each member gets their own membership; one bill" : "1 = single membership"}>
                <Input id="plan-group" type="number" min={1} max={50} invalid={!!errors.group_size} {...register("group_size")} />
              </Field>
              <Field label="Free members" htmlFor="plan-free" error={errors.free_members?.message}
                hint="Shown on the card, e.g. pay for 4 and 1 joins free">
                <Input id="plan-free" type="number" min={0} placeholder="0" readOnly={groupSize <= 1}
                  className={groupSize <= 1 ? READONLY_INPUT : undefined}
                  invalid={!!errors.free_members} {...register("free_members")} />
              </Field>
              <Field label="Upgrade allowed within (days)" htmlFor="plan-upgrade" error={errors.upgrade_window?.message}
                className="md:col-span-2"
                hint={windowValue === "0" ? "Members on this plan can only renew, not upgrade"
                  : `Days from the start date a member may move to a bigger plan, paying only the difference. Empty = ${defaultWindow} days`}>
                <Input id="plan-upgrade" type="number" min={0} max={3650} placeholder={`${defaultWindow} (default)`}
                  invalid={!!errors.upgrade_window} {...register("upgrade_window")} />
              </Field>
            </>
          )}
          <Field label="ID check" htmlFor="plan-id-check" error={errors.id_check?.message} className="md:col-span-2"
            hint="The desk must tick this before billing, e.g. College ID card. Leave empty if none">
            <Input id="plan-id-check" maxLength={60} placeholder="e.g. College ID card" {...register("id_check")} />
          </Field>
          {type !== "ADD_ON" && (
            <div className="flex flex-col gap-3 rounded-xl border border-line p-3 md:col-span-2">
              <Controller name="refundable" control={control} render={({ field }) => (
                <Checkbox checked={field.value} onChange={field.onChange} label="Refundable: money back if the member cancels early" />
              )} />
              {watch("refundable") && (
                <Field label="Refund within (days used)" htmlFor="plan-refund" error={errors.refund_window?.message}
                  hint="Empty = the gym's refund days (Configuration). The gym's deduction % applies">
                  <Input id="plan-refund" type="number" min={0} max={3650} placeholder="Gym default"
                    invalid={!!errors.refund_window} {...register("refund_window")} />
                </Field>
              )}
            </div>
          )}
          <div className="flex flex-col gap-3 md:col-span-2">
            <Controller name="all_branches" control={control} render={({ field }) => (
              <Checkbox checked={field.value} onChange={field.onChange} label="Valid at all branches (check in anywhere)" />
            )} />
            <Controller name="is_active" control={control} render={({ field }) => (
              <Checkbox checked={field.value} onChange={field.onChange} label="Active: the desk can sell this plan" />
            )} />
          </div>
        </div>

        <FormDivider>Description</FormDivider>
        <Field label="Description" htmlFor="plan-description" error={errors.description?.message}>
          <Textarea id="plan-description" placeholder="What's included, timings, terms…" rows={3} {...register("description")} />
        </Field>
      </form>
    </Drawer>
  );
}
