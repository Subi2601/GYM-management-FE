import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { GRID_2 } from "@/components/ui/Section";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { offerApi, useInvalidateOffers } from "@/features/offers/api";
import { usePlanCategories } from "@/features/plans/api";
import { notify } from "@/lib/notify";
import type { Offer, OfferInput } from "@/types/offer";

const FORM_ID = "offer-form";

const count = (max: number) => z.coerce.number({ invalid_type_error: "Enter a number" }).int("Whole numbers").min(0).max(max, `At most ${max}`);

// Mirrors OfferCreate: name 1..80, 0 ≤ % ≤ 100, at least one of % / extra time / free item, valid_to ≥ valid_from.
const schema = z.object({
  name: z.string().trim().min(1, "Offer name is required").max(80, "Max 80 characters"),
  discount_percent: z.coerce.number({ invalid_type_error: "Enter the discount % (0 = none)" })
    .min(0, "At least 0%").max(100, "At most 100%"),
  extra_months: count(24),
  extra_days: count(365),
  free_item: z.string().trim().max(120, "Max 120 characters"),
  valid_from: z.string(),
  valid_to: z.string(),
  description: z.string().trim().max(200, "Max 200 characters"),
  is_active: z.boolean(),
  category_ids: z.array(z.string()),
}).refine((v) => !v.valid_from || !v.valid_to || v.valid_to >= v.valid_from,
  { path: ["valid_to"], message: "Must be on or after the start date" })
  .refine((v) => v.discount_percent > 0 || v.extra_months > 0 || v.extra_days > 0 || v.free_item !== "",
    { path: ["discount_percent"], message: "Give a % off, extra time or a free item" });
type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = { name: "", discount_percent: 0, extra_months: 0, extra_days: 0, free_item: "", valid_from: "",
  valid_to: "", description: "", is_active: true, category_ids: [] };

const toForm = (o: Offer): FormValues => ({
  name: o.name, discount_percent: o.discount_percent, extra_months: o.extra_months, extra_days: o.extra_days,
  free_item: o.free_item ?? "", valid_from: o.valid_from ?? "", valid_to: o.valid_to ?? "",
  description: o.description ?? "", is_active: o.is_active, category_ids: o.category_ids,
});

/** Add / edit an offer (short form → modal). */
export function OfferFormModal({ open, offer, onClose }: { open: boolean; offer: Offer | null; onClose: () => void }) {
  const invalidate = useInvalidateOffers();
  const categories = usePlanCategories();
  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (open) reset(offer ? toForm(offer) : EMPTY);
  }, [open, offer, reset]);

  const save = useMutation({
    mutationFn: (body: OfferInput) => (offer ? offerApi.update(offer.id, body) : offerApi.create(body)),
    onSuccess: async (res) => {
      notify.success(res.message);
      onClose();
      await invalidate();
    },
    onError: notify.error,
  });

  const onSubmit = (v: FormValues) => save.mutate({
    name: v.name.trim(), discount_percent: v.discount_percent, extra_months: v.extra_months, extra_days: v.extra_days,
    free_item: v.free_item || null, valid_from: v.valid_from || null,
    valid_to: v.valid_to || null, description: v.description.trim() || null, is_active: v.is_active,
    category_ids: v.category_ids,
  });

  return (
    <Modal
      open={open}
      title={offer ? "Edit offer" : "Add offer"}
      subtitle="Festival and special offers the desk can apply while billing"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form={FORM_ID} loading={save.isPending}>{offer ? "Save changes" : "Add offer"}</Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className={GRID_2}>
          <Field label="Offer name" htmlFor="of-name" required error={errors.name?.message}>
            <Input id="of-name" maxLength={80} placeholder="e.g. Diwali Offer" invalid={!!errors.name} {...register("name")} />
          </Field>
          <Field label="Discount (%)" htmlFor="of-pct" error={errors.discount_percent?.message} hint="0 = no money off">
            <Input id="of-pct" type="number" min={0} max={100} step="0.5" placeholder="e.g. 15" invalid={!!errors.discount_percent}
              {...register("discount_percent")} />
          </Field>
          <Field label="Extra time free" error={errors.extra_months?.message ?? errors.extra_days?.message}
            hint="Added to the membership end date">
            <div className="flex items-center gap-2">
              <Input aria-label="Extra months" type="number" min={0} max={24} {...register("extra_months")} />
              <span className="text-xs text-muted">months</span>
              <Input aria-label="Extra days" type="number" min={0} max={365} {...register("extra_days")} />
              <span className="text-xs text-muted">days</span>
            </div>
          </Field>
          <Field label="Free item" htmlFor="of-item" error={errors.free_item?.message} hint="Supplement, T-shirt… printed on the invoice">
            <Input id="of-item" maxLength={120} placeholder="e.g. Protein shaker" {...register("free_item")} />
          </Field>
          <Field label="Valid from" htmlFor="of-from" hint="Leave empty to start now">
            <Input id="of-from" type="date" {...register("valid_from")} />
          </Field>
          <Field label="Valid till" htmlFor="of-to" error={errors.valid_to?.message} hint="Leave empty for no end date">
            <Input id="of-to" type="date" invalid={!!errors.valid_to} {...register("valid_to")} />
          </Field>
          <Field label="Applies to" className="md:col-span-2"
            hint="Pick plan categories, e.g. Diwali on General and Student. Leave empty for every plan">
            <Controller name="category_ids" control={control} render={({ field }) => (
              <MultiSelect selected={field.value} onChange={field.onChange} placeholder="All plans"
                items={(categories.data ?? []).map((c) => ({ id: c.id, label: c.name,
                  subLabel: `${c.active_plan_count} plan${c.active_plan_count === 1 ? "" : "s"}` }))} />
            )} />
          </Field>
          <Field label="Description" htmlFor="of-desc" error={errors.description?.message} className="md:col-span-2">
            <Textarea id="of-desc" rows={2} maxLength={200} placeholder="Shown to staff while billing (optional)"
              {...register("description")} />
          </Field>
          <div className="md:col-span-2">
            <Controller name="is_active" control={control} render={({ field }) => (
              <Checkbox checked={field.value} onChange={field.onChange} label="Active: staff can apply this offer while billing" />
            )} />
          </div>
        </div>
      </form>
    </Modal>
  );
}
