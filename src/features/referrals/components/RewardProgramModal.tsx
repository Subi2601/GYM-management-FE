import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { referralApi, useInvalidateReferrals } from "@/features/referrals/api";
import { notify } from "@/lib/notify";
import type { ReferralProgram } from "@/types/referral";

const FORM_ID = "referral-program-form";

// Mirrors backend ProgramIn: 1–10 tiers, distinct referral counts.
const schema = z.object({
  month_key: z.string().regex(/^\d{4}-\d{2}$/),
  title: z.string().trim().max(120, "Max 120 characters"),
  notes: z.string().trim().max(1000, "Max 1000 characters"),
  tiers: z.array(z.object({
    min_referrals: z.coerce.number({ invalid_type_error: "Enter a number" }).int("Whole number").min(1, "At least 1").max(100),
    reward: z.string().trim().min(1, "Write the reward").max(150, "Max 150 characters"),
  })).min(1, "Add at least one reward").max(10, "Up to 10 rewards"),
}).superRefine((v, ctx) => {
  const seen = new Set<number>();
  v.tiers.forEach((t, i) => {
    if (seen.has(t.min_referrals)) ctx.addIssue({ code: "custom", path: ["tiers", i, "min_referrals"], message: "Used twice" });
    seen.add(t.min_referrals);
  });
});
type Values = z.infer<typeof schema>;

const toForm = (p: ReferralProgram): Values => ({
  month_key: p.month_key, title: p.title ?? "", notes: p.notes ?? "",
  tiers: p.tiers.length ? p.tiers.map((t) => ({ ...t })) : [{ min_referrals: 1, reward: "" }],
});

/** Set a month's referral reward: tiers "refer at least N people this month → reward" (the highest reached wins). */
export function RewardProgramModal({ current, next, initialMonth, onClose }: {
  current: ReferralProgram; next: ReferralProgram; initialMonth?: string; onClose: () => void;
}) {
  const invalidate = useInvalidateReferrals();
  const start = initialMonth === next.month_key ? next : current;
  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema), defaultValues: toForm(start),
  });
  const tiers = useFieldArray({ control, name: "tiers" });

  const save = useMutation({
    mutationFn: (v: Values) => referralApi.setProgram({ month_key: v.month_key, title: v.title || null,
      notes: v.notes || null, tiers: v.tiers }),
    onSuccess: async (res) => { notify.success(res.message); onClose(); await invalidate(); },
    onError: notify.error,
  });

  return (
    <Modal open width="620px" title="Referral reward" subtitle="What members get for referring people this month"
      onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" form={FORM_ID} loading={save.isPending}>Save reward</Button>
      </>}>
      <form id={FORM_ID} noValidate onSubmit={handleSubmit((v) => save.mutate(v))} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Month" htmlFor="rp-month" required hint="It stops automatically when the month ends">
            <Select id="rp-month" {...register("month_key", {
              onChange: (e) => reset(toForm(e.target.value === next.month_key ? next : current)),
            })}>
              <option value={current.month_key}>{current.month_label} (this month){current.is_set ? "" : " · not set"}</option>
              <option value={next.month_key}>{next.month_label} (next month){next.is_set ? "" : " · not set"}</option>
            </Select>
          </Field>
          <Field label="Title" htmlFor="rp-title" error={errors.title?.message} hint="Optional, e.g. Diwali referral offer">
            <Input id="rp-title" maxLength={120} {...register("title")} />
          </Field>
        </div>

        <div>
          <div className="mb-2 text-sm font-bold text-ink">Rewards</div>
          <div className="flex flex-col gap-2">
            {tiers.fields.map((f, i) => (
              <div key={f.id} className="flex items-start gap-2 rounded-xl border border-line bg-subtle p-2.5">
                <div className="w-36 shrink-0">
                  <Field label="Refers at least" error={errors.tiers?.[i]?.min_referrals?.message}>
                    <div className="flex items-center gap-1.5">
                      <Input type="number" inputMode="numeric" min={1} max={100} aria-label="Referrals"
                        {...register(`tiers.${i}.min_referrals`)} />
                      <span className="text-xs text-muted">people</span>
                    </div>
                  </Field>
                </div>
                <div className="min-w-0 flex-1">
                  <Field label="Gets" error={errors.tiers?.[i]?.reward?.message}>
                    <Input maxLength={150} placeholder="Gym T-shirt, 1 month free, 10% off renewal…" aria-label="Reward"
                      {...register(`tiers.${i}.reward`)} />
                  </Field>
                </div>
                {tiers.fields.length > 1 && (
                  <button type="button" title="Remove" onClick={() => tiers.remove(i)}
                    className="mt-7 cursor-pointer border-0 bg-transparent p-1 text-muted hover:text-danger">
                    <Icon name="trash" className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {errors.tiers?.message && <p className="m-0 mt-1 text-xs text-danger">{errors.tiers.message}</p>}
          {tiers.fields.length < 10 && (
            <Button variant="secondary" className="mt-2" icon={<Icon name="plus" className="h-4 w-4" />}
              onClick={() => tiers.append({ min_referrals: (tiers.fields.length + 1) * 2 - 1, reward: "" })}>
              Add reward level
            </Button>
          )}
          <p className="m-0 mt-2 text-xs text-muted">
            A referral counts in the month the person joins and pays. A member gets the highest level they reach that month.
          </p>
        </div>

        <Field label="Notes" htmlFor="rp-notes" error={errors.notes?.message} hint="Optional, for the team">
          <Textarea id="rp-notes" rows={2} {...register("notes")} />
        </Field>
      </form>
    </Modal>
  );
}
