import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Field, Input, READONLY_INPUT, Select, Textarea } from "@/components/ui/Field";
import { Drawer } from "@/components/ui/Modal";
import { FormDivider, GRID_2 } from "@/components/ui/Section";
import { planApi, useInvalidatePlans } from "@/features/plans/api";
import { dayRate, SERVICE_LABEL } from "@/features/plans/labels";
import { formatINR } from "@/lib/format";
import { notify } from "@/lib/notify";
import { PLAN_SERVICE_TYPES, PLAN_TYPES } from "@/types/enums";
import type { Plan, PlanInput } from "@/types/plan";

const FORM_ID = "plan-form";

const intIn = (min: number, max: number) =>
  z.string().trim().min(1, "Required")
    .refine((v) => Number.isInteger(Number(v)), "Enter a whole number")
    .refine((v) => Number(v) >= min && Number(v) <= max, `Must be between ${min} and ${max}`);

/** Mirrors backend PlanCreate + plan_service._check_rules. */
const schema = z.object({
  name: z.string().trim().min(1, "Plan name is required").max(120),
  type: z.enum(PLAN_TYPES),
  service_type: z.enum(PLAN_SERVICE_TYPES),
  duration_days: intIn(1, 3650),
  price: z.string().trim().min(1, "Required")
    .refine((v) => Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 10_000_000, "Enter a valid price"),
  total_sessions: z.string().trim()
    .refine((v) => v === "" || (Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 1000), "Must be between 0 and 1000"),
  description: z.string().max(2000),
}).superRefine((v, ctx) => {
  if (v.service_type === "PERSONAL_TRAINING" && !(Number(v.total_sessions) >= 1)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["total_sessions"], message: "Personal training needs at least 1 session" });
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

function toValues(plan: Plan | null): FormValues {
  return {
    name: plan?.name ?? "",
    type: plan?.type ?? "MEMBERSHIP",
    service_type: plan?.service_type ?? "GENERAL",
    duration_days: plan ? String(plan.duration_days) : "",
    // A custom plan is edited as a per-day price; every other plan as its total price.
    price: plan ? String(dayRate(plan) ?? plan.price) : "",
    total_sessions: plan && plan.total_sessions > 0 ? String(plan.total_sessions) : "",
    description: plan?.description ?? "",
  };
}

interface PlanFormDrawerProps {
  /** null = add. */
  plan: Plan | null;
  onClose: () => void;
}

/** Add / edit plan slide-over. Mounted only while open, so state resets on close. */
export function PlanFormDrawer({ plan, onClose }: PlanFormDrawerProps) {
  const invalidate = useInvalidatePlans();
  const { register, handleSubmit, watch, setValue, getValues, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toValues(plan),
  });
  const type = watch("type");
  const serviceType = watch("service_type");
  const isCustom = type === "CUSTOM";
  const total = isCustom ? customTotal(watch("duration_days"), watch("price")) : null;

  // Membership and custom plans are always GENERAL (backend rule).
  useEffect(() => {
    if (type !== "ADD_ON" && serviceType !== "GENERAL") setValue("service_type", "GENERAL");
  }, [type, serviceType, setValue]);

  // Switching to / from Customization converts the price between total and per day, so it keeps its meaning.
  const prevType = useRef(type);
  useEffect(() => {
    const was = prevType.current;
    prevType.current = type;
    if ((was === "CUSTOM") === (type === "CUSTOM")) return;
    const days = Number(getValues("duration_days"));
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

  const onSubmit = (v: FormValues) =>
    save.mutate({
      name: v.name.trim(),
      type: v.type,
      service_type: v.type === "ADD_ON" ? v.service_type : "GENERAL",
      duration_days: Number(v.duration_days),
      // Custom plans are stored with their total, so enrolment, payments and invoices work unchanged.
      price: v.type === "CUSTOM" ? round2(Number(v.duration_days) * Number(v.price)) : Number(v.price),
      total_sessions: v.type === "ADD_ON" && v.total_sessions !== "" ? Number(v.total_sessions) : 0,
      description: v.description.trim() || null,
    });

  return (
    <Drawer
      open
      title={plan ? "Edit plan" : "Add plan"}
      subtitle={plan ? plan.name : "Membership plans, add-on services and customized plans members can buy"}
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
          <Field label="Plan name" htmlFor="plan-name" required error={errors.name?.message} className="md:col-span-2">
            <Input id="plan-name" placeholder="e.g. Monthly Gold" invalid={!!errors.name} {...register("name")} />
          </Field>

          <Field label="Plan type" htmlFor="plan-type" required className={isCustom ? "md:col-span-2" : undefined}
            hint={isCustom ? "For members who need a duration outside the regular packs" : undefined}>
            <Select id="plan-type" {...register("type")}>
              <option value="MEMBERSHIP">Membership</option>
              <option value="ADD_ON">Add-on service</option>
              <option value="CUSTOM">Customization</option>
            </Select>
          </Field>

          {!isCustom && (
            <Field label="Service type" htmlFor="plan-service" required error={errors.service_type?.message}
              hint={type === "MEMBERSHIP" ? "Membership plans are always General" : undefined}>
              {/* Locked (not `disabled`, which would drop the value from the submitted form). */}
              <Select id="plan-service" aria-disabled={type === "MEMBERSHIP"} tabIndex={type === "MEMBERSHIP" ? -1 : undefined}
                className={type === "MEMBERSHIP" ? "pointer-events-none opacity-60" : undefined} {...register("service_type")}>
                {PLAN_SERVICE_TYPES.map((s) => <option key={s} value={s}>{SERVICE_LABEL[s]}</option>)}
              </Select>
            </Field>
          )}
        </div>

        <FormDivider>Pricing &amp; duration</FormDivider>
        <div className={GRID_2}>
          <Field label="Duration (days)" htmlFor="plan-duration" required error={errors.duration_days?.message}>
            <Input id="plan-duration" type="number" min={1} placeholder={isCustom ? "e.g. 20" : "e.g. 30"}
              invalid={!!errors.duration_days} {...register("duration_days")} />
          </Field>

          <Field label={isCustom ? "Price (per day)" : "Price (₹)"} htmlFor="plan-price" required error={errors.price?.message}
            hint={isCustom ? "Amount in ₹ for one day" : undefined}>
            <Input id="plan-price" type="number" min={0} step="0.01" placeholder={isCustom ? "e.g. 300" : "e.g. 1500"}
              invalid={!!errors.price} {...register("price")} />
          </Field>

          {isCustom && (
            <Field label="Total cost" htmlFor="plan-total" className="md:col-span-2"
              hint={total !== null ? `${watch("duration_days")} days × ${formatINR(Number(watch("price")))} per day` : "Enter the duration and the price per day"}>
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

        <FormDivider>Description</FormDivider>
        <Field label="Description" htmlFor="plan-description" error={errors.description?.message}>
          <Textarea id="plan-description" placeholder="What's included, timings, terms…" rows={4} {...register("description")} />
        </Field>
      </form>
    </Drawer>
  );
}
