import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { planApi, useInvalidatePlans } from "@/features/plans/api";
import { notify } from "@/lib/notify";
import { PLAN_SERVICE_TYPES, PLAN_TYPES } from "@/types/enums";
import type { Plan, PlanInput } from "@/types/plan";

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

const SERVICE_LABEL = { GENERAL: "General", PERSONAL_TRAINING: "Personal Training", DIET: "Diet" } as const;

function toValues(plan: Plan | null): FormValues {
  return {
    name: plan?.name ?? "",
    type: plan?.type ?? "MEMBERSHIP",
    service_type: plan?.service_type ?? "GENERAL",
    duration_days: plan ? String(plan.duration_days) : "",
    price: plan ? String(plan.price) : "",
    total_sessions: plan && plan.total_sessions > 0 ? String(plan.total_sessions) : "",
    description: plan?.description ?? "",
  };
}

interface PlanFormModalProps {
  /** null = add. */
  plan: Plan | null;
  onClose: () => void;
}

/** "Define New Gym Plan" / "Edit Gym Plan". Mounted only while open, so state resets on close. */
export function PlanFormModal({ plan, onClose }: PlanFormModalProps) {
  const invalidate = useInvalidatePlans();
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toValues(plan),
  });
  const type = watch("type");
  const serviceType = watch("service_type");

  // A MEMBERSHIP plan is always GENERAL (backend rule).
  useEffect(() => {
    if (type === "MEMBERSHIP" && serviceType !== "GENERAL") setValue("service_type", "GENERAL");
  }, [type, serviceType, setValue]);

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
      service_type: v.type === "MEMBERSHIP" ? "GENERAL" : v.service_type,
      duration_days: Number(v.duration_days),
      price: Number(v.price),
      total_sessions: v.type === "ADD_ON" && v.total_sessions !== "" ? Number(v.total_sessions) : 0,
      description: v.description.trim() || null,
    });

  return (
    <Modal open title={plan ? "Edit Gym Plan" : "Define New Gym Plan"} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="form-grid-modern">
          <Field label="Plan Name" htmlFor="plan-name" required error={errors.name?.message}>
            <Input id="plan-name" placeholder="e.g. Monthly Gold" invalid={!!errors.name} {...register("name")} />
          </Field>

          <Field label="Plan Type" htmlFor="plan-type" required>
            <Select id="plan-type" {...register("type")}>
              <option value="MEMBERSHIP">Membership</option>
              <option value="ADD_ON">Add-on Service</option>
            </Select>
          </Field>

          <Field label="Service Type" htmlFor="plan-service" required error={errors.service_type?.message}
            hint={type === "MEMBERSHIP" ? "Membership plans are always General" : undefined}>
            {/* Locked (not `disabled`, which would drop the value from the submitted form). */}
            <Select id="plan-service" aria-disabled={type === "MEMBERSHIP"} tabIndex={type === "MEMBERSHIP" ? -1 : undefined}
              className={type === "MEMBERSHIP" ? "pointer-events-none opacity-60" : undefined} {...register("service_type")}>
              {PLAN_SERVICE_TYPES.map((s) => <option key={s} value={s}>{SERVICE_LABEL[s]}</option>)}
            </Select>
          </Field>

          {type === "ADD_ON" && (
            <Field label="Total Sessions" htmlFor="plan-sessions" required={serviceType === "PERSONAL_TRAINING"}
              error={errors.total_sessions?.message}>
              <Input id="plan-sessions" type="number" min={0} placeholder="e.g. 24" invalid={!!errors.total_sessions}
                {...register("total_sessions")} />
            </Field>
          )}

          <Field label="Duration (Days)" htmlFor="plan-duration" required error={errors.duration_days?.message}>
            <Input id="plan-duration" type="number" min={1} placeholder="e.g. 30" invalid={!!errors.duration_days}
              {...register("duration_days")} />
          </Field>

          <Field label="Price (₹)" htmlFor="plan-price" required error={errors.price?.message}>
            <Input id="plan-price" type="number" min={0} step="0.01" placeholder="e.g. 1500" invalid={!!errors.price}
              {...register("price")} />
          </Field>

          <Field label="Description" htmlFor="plan-description" error={errors.description?.message}>
            <Textarea id="plan-description" placeholder="Plan details..." rows={3} {...register("description")} />
          </Field>
        </div>

        <div className="form-actions-modern">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={save.isPending}>{plan ? "Update Plan" : "Save Plan"}</Button>
        </div>
      </form>
    </Modal>
  );
}
