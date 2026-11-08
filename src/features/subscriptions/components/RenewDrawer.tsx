import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { confirm } from "@/components/ui/ConfirmDialog";
import { Checkbox, Field, Input, Select } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Drawer } from "@/components/ui/Modal";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { FormDivider, GRID_2 } from "@/components/ui/Section";
import { usePlanLookup, useTrainerLookup } from "@/features/lookups/api";
import { emptyEntry, groupEntryError, GroupMembersField, toGroupMembers,
  type GroupEntry } from "@/features/members/components/GroupMembersField";
import { OfferSelect } from "@/features/offers/components/OfferSelect";
import { planDuration } from "@/features/plans/labels";
import { openInvoice, subscriptionApi, subscriptionKeys, useInvalidateBilling } from "@/features/subscriptions/api";
import { BILLING_DEFAULTS, billingShape, netPayable, PAYMENT_MODE_LABEL, refineBilling, round2, toEnrollPayment,
  toNumber } from "@/features/subscriptions/lib/billing";
import { formatDate, formatINR, todayISO } from "@/lib/format";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { useBranchStore } from "@/stores/branch-store";
import { PAYMENT_MODES } from "@/types/enums";
import type { Envelope } from "@/types/api";
import type { EnrollResponse } from "@/types/payment-enroll";
import type { SubscriptionRow, UpgradeOption } from "@/types/subscription";

const FORM_ID = "renew-subscription-form";

const schema = z.object({
  ...billingShape,
  start_date: z.string().min(1, "Start date is required"),
  trainer_id: z.string(),
  needs_trainer: z.boolean(),
}).superRefine((v, ctx) => {
  refineBilling(v, ctx);
  if (v.needs_trainer && !v.trainer_id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["trainer_id"], message: "Select a trainer for personal training" });
  }
});
type FormValues = z.infer<typeof schema>;

/** What the drawer needs about the member (Subscriptions, Renewals, Members rows and the member page all have it). */
export type RenewTarget = Pick<SubscriptionRow, "member_id" | "member_name" | "registration_id" | "plan_name">;

type Mode = "renew" | "upgrade";

const months = (o: Pick<UpgradeOption, "duration_months" | "duration_days">) =>
  o.duration_months ? `${o.duration_months} month${o.duration_months > 1 ? "s" : ""}` : `${o.duration_days} days`;

interface Props {
  row: RenewTarget;
  onClose: () => void;
  onDone?: () => void;
  /** Open straight on the Upgrade tab (when allowed). */
  initialMode?: Mode;
}

/**
 * Renew / Upgrade a member's membership.
 * Renew: any plans (group packages take the other members) from a start date → POST /subscriptions/enroll.
 * Upgrade: a bigger plan inside the current plan's window; it starts on the old start date and the old plan's cost
 * is credited, so only the balance is billed → POST /subscriptions/upgrade. Lower / shorter plans show greyed.
 */
export function RenewDrawer({ row, onClose, onDone, initialMode = "renew" }: Props) {
  const branch = useBranchStore((s) => s.selectedBranchId);
  const invalidateBilling = useInvalidateBilling();
  const plansQuery = usePlanLookup(undefined, true, true);
  const plans = useMemo(() => plansQuery.data ?? [], [plansQuery.data]);
  const info = useQuery({
    queryKey: subscriptionKeys.upgrade(branch, row.member_id),
    queryFn: async () => (await subscriptionApi.upgradeInfo(row.member_id)).data,
  });
  const current = info.data?.current ?? null;
  const canUpgrade = !!info.data?.can_upgrade;

  const [mode, setMode] = useState<Mode>(initialMode);
  useEffect(() => {
    if (info.data && !info.data.can_upgrade) setMode("renew");
  }, [info.data]);
  const upgrading = mode === "upgrade";

  // ── renew ──
  const [planIds, setPlanIds] = useState<string[]>([]);
  const selected = plans.filter((p) => planIds.includes(p.id));
  const groupPlan = selected.find((p) => p.group_size > 1) ?? null;
  const [groupEntries, setGroupEntries] = useState<GroupEntry[]>([]);
  useEffect(() => {
    const needed = groupPlan ? groupPlan.group_size - 1 : 0;
    setGroupEntries((cur) => (cur.length === needed ? cur
      : [...cur.slice(0, needed), ...Array.from({ length: Math.max(0, needed - cur.length) }, emptyEntry)]));
  }, [groupPlan]);
  const choosePlans = (ids: string[]) => {
    // One group package per bill: picking another replaces the earlier one.
    const added = ids.find((id) => !planIds.includes(id));
    const addedPlan = plans.find((p) => p.id === added);
    setPlanIds(addedPlan && addedPlan.group_size > 1
      ? ids.filter((id) => id === added || (plans.find((p) => p.id === id)?.group_size ?? 1) <= 1) : ids);
  };

  // ── upgrade ──
  const options = useMemo(() => info.data?.options ?? [], [info.data]);
  const [targetId, setTargetId] = useState<string | null>(null);
  const target = options.find((o) => o.plan_id === targetId && o.eligible) ?? null;
  const upgradeCats = useMemo(() => [...new Map(options.map((o) => [o.category_id, o.category_name])).entries()], [options]);
  const [catId, setCatId] = useState<string | null>(null);
  const activeCat = catId ?? options.find((o) => o.plan_id === current?.plan_id)?.category_id ?? upgradeCats[0]?.[0] ?? null;

  const idChecks = upgrading
    ? (target?.id_check ? [target.id_check] : [])
    : [...new Set(selected.flatMap((p) => (p.id_check ? [p.id_check] : [])))];
  const [idVerified, setIdVerified] = useState(false);

  const gross = upgrading ? target?.balance ?? 0 : round2(selected.reduce((s, p) => s + p.price, 0));
  const needsTrainer = !upgrading && selected.some((p) => p.service_type === "PERSONAL_TRAINING");
  const trainers = useTrainerLookup(needsTrainer);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { ...BILLING_DEFAULTS, start_date: todayISO(), trainer_id: "", needs_trainer: false },
  });
  const discount = watch("discount_amount");
  const net = netPayable(gross, discount);

  // A renewal continues after the plan that's still running, so no paid day is lost (staff can still change it).
  const runningEnd = current && current.end_date >= todayISO() ? current.end_date : null;
  useEffect(() => {
    if (runningEnd) setValue("start_date", runningEnd);
  }, [runningEnd, setValue]);

  // Renewals and upgrades record full payment of the net amount.
  useEffect(() => {
    setValue("amount", gross);
    setValue("needs_trainer", needsTrainer);
    if (Number.isFinite(net)) setValue("paid_amount", String(net));
  }, [gross, needsTrainer, net, setValue]);

  const done = async (res: Envelope<EnrollResponse>) => {
    notify.success(res.message);
    openInvoice(res.data.payment_id);
    await invalidateBilling();
    onDone?.();
    onClose();
  };
  const enroll = useMutation({ mutationFn: subscriptionApi.enroll, onSuccess: done, onError: notify.error });
  const upgrade = useMutation({ mutationFn: subscriptionApi.upgrade, onSuccess: done, onError: notify.error });
  const pending = enroll.isPending || upgrade.isPending;

  const onSubmit = async (v: FormValues) => {
    if (idChecks.length > 0 && !idVerified) return notify.errorText(`Tick "${idChecks.join(", ")} verified" to continue.`);
    if (upgrading) {
      if (!target || !current) return notify.errorText("Pick the plan to upgrade to.");
      if (!(await confirm(`Upgrade ${row.member_name} from ${current.plan_name} to ${target.name} and collect ${formatINR(net)}?`))) return;
      upgrade.mutate({ member_id: row.member_id, plan_id: target.plan_id, id_verified: idVerified,
        payment: toEnrollPayment(v) });
      return;
    }
    if (planIds.length === 0) return notify.errorText("Please select at least one plan.");
    const groupProblem = groupPlan ? groupEntryError(groupEntries) : null;
    if (groupProblem) return notify.errorText(groupProblem);
    if (!(await confirm("Are you sure you want to renew this membership and record payment?"))) return;
    enroll.mutate({
      member_id: row.member_id,
      plan_ids: planIds,
      start_date: v.start_date,
      trainer_id: needsTrainer && v.trainer_id ? v.trainer_id : null,
      group_members: groupPlan ? toGroupMembers(groupEntries) : [],
      id_verified: idChecks.length > 0 && idVerified,
      payment: toEnrollPayment(v),
    });
  };

  const ready = upgrading ? !!target : planIds.length > 0;

  return (
    <Drawer
      open
      width="600px"
      title="Renew / Upgrade"
      subtitle={`${row.member_name} · ${row.registration_id}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form={FORM_ID} loading={pending} disabled={!ready}>
            {upgrading ? "Upgrade & collect" : "Confirm renewal"}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate>
        {/* Current plan */}
        <div className="flex items-start gap-3 rounded-2xl border border-line bg-subtle px-4 py-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-light text-accent">
            <Icon name="award" className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Current plan</div>
            {info.isLoading ? <div className="text-sm text-muted">Loading…</div> : current ? (
              <>
                <div className="font-bold text-ink">{current.category_name ? `${current.category_name} · ` : ""}{current.plan_name}</div>
                <div className="text-xs text-muted">{formatDate(current.start_date)} – {formatDate(current.end_date)}
                  {current.receipt_no && ` · ${current.receipt_no}`}</div>
              </>
            ) : <div className="font-semibold text-muted">No membership yet</div>}
          </div>
          {current && (
            <div className="text-right">
              <div className="text-lg font-extrabold text-ink">{formatINR(current.credit)}</div>
              <div className="text-xs text-muted">paid</div>
            </div>
          )}
        </div>

        {/* Mode */}
        <div className="mt-4 inline-flex w-full rounded-xl border border-line bg-subtle p-1">
          {(["renew", "upgrade"] as const).map((m) => {
            const disabled = m === "upgrade" && !canUpgrade;
            return (
              <button key={m} type="button" disabled={disabled} onClick={() => setMode(m)}
                title={disabled ? info.data?.reason ?? undefined : undefined}
                className={cn("flex-1 cursor-pointer rounded-lg border-0 px-3 py-2 text-sm font-semibold transition-colors",
                  mode === m ? "bg-surface text-accent shadow-subtle" : "bg-transparent text-muted",
                  disabled && "cursor-not-allowed opacity-50")}>
                {m === "renew" ? "Renew" : "Upgrade"}
              </button>
            );
          })}
        </div>
        <p className={cn("m-0 mt-2 text-xs", canUpgrade ? "text-success" : "text-muted")}>
          {canUpgrade && current?.window_ends
            ? `Upgrade open till ${formatDate(current.window_ends)}: the new plan starts ${formatDate(current.start_date)} and the ${formatINR(current.credit)} paid is credited.`
            : info.data?.reason ?? ""}
        </p>

        {upgrading ? (
          <>
            <FormDivider>Upgrade to</FormDivider>
            <div className="mb-3 flex flex-wrap gap-2">
              {upgradeCats.map(([id, name]) => (
                <button key={id} type="button" onClick={() => setCatId(id)}
                  className={cn("cursor-pointer rounded-full border px-3 py-1 text-[13px] font-semibold",
                    id === activeCat ? "border-accent bg-accent-light text-accent" : "border-line bg-surface text-secondary-grey")}>
                  {name}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              {options.filter((o) => o.category_id === activeCat).map((o) => {
                const picked = o.plan_id === targetId;
                return (
                  <button key={o.plan_id} type="button" disabled={!o.eligible}
                    onClick={() => { setTargetId(o.plan_id); setIdVerified(false); }}
                    className={cn("flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                      picked ? "border-accent bg-accent-light" : "border-line bg-surface",
                      o.eligible ? "cursor-pointer hover:border-line-accent" : "cursor-not-allowed opacity-50")}>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink">{o.name}</span>
                      <span className="block text-xs text-muted">{months(o)} · {formatINR(o.price)}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      {o.eligible ? (
                        <>
                          <span className="block font-bold text-accent">Pay {formatINR(o.balance)}</span>
                          <span className="block text-xs text-muted">after {formatINR(current?.credit ?? 0)} credit</span>
                        </>
                      ) : <span className="text-xs font-semibold text-muted">{o.reason}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <FormDivider>Plans</FormDivider>
            <div className="flex flex-col gap-4">
              <Field label="Plans" required hint={`Current: ${row.plan_name}. Pick the same plan to renew it, or another to change`}>
                <MultiSelect
                  items={plans.map((p) => ({ id: p.id, label: `${p.category_name} · ${p.name}`,
                    subLabel: `${formatINR(p.price)} · ${planDuration(p)}${p.group_size > 1 ? ` · ${p.group_size} members` : ""}` }))}
                  selected={planIds}
                  onChange={choosePlans}
                  placeholder={plansQuery.isLoading ? "Loading plans…" : "Select plans"}
                />
              </Field>
              {groupPlan && (
                <div>
                  <div className="mb-2 text-[13px] font-bold text-ink">Members ({groupPlan.group_size})</div>
                  <GroupMembersField payerName={row.member_name} payerId={row.member_id}
                    entries={groupEntries} onChange={setGroupEntries} />
                </div>
              )}
              {needsTrainer && (
                <Field label="Trainer" htmlFor="r-trainer" required error={errors.trainer_id?.message}>
                  <Select id="r-trainer" invalid={!!errors.trainer_id} {...register("trainer_id")}>
                    <option value="">{trainers.isLoading ? "Loading trainers…" : "Select a trainer"}</option>
                    {(trainers.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.name} ({t.employee_code})</option>)}
                  </Select>
                </Field>
              )}
              <Field label="Start date" htmlFor="r-start" required error={errors.start_date?.message}
                hint={runningEnd ? `Continues after the current plan ends (${formatDate(runningEnd)})` : undefined}>
                <Input id="r-start" type="date" invalid={!!errors.start_date} {...register("start_date")} />
              </Field>
            </div>
          </>
        )}
        {idChecks.length > 0 && (
          <div className="mt-4">
            <Checkbox checked={idVerified} onChange={setIdVerified} label={`${idChecks.join(", ")} verified`} />
          </div>
        )}

        <FormDivider>Payment</FormDivider>
        <div className={GRID_2}>
          <OfferSelect id="r-offer" value={watch("offer_id")} setField={(n, val) => setValue(n, val)}
            lines={upgrading ? (target ? [{ categoryId: target.category_id, amount: target.balance }] : [])
              : selected.map((p) => ({ categoryId: p.category_id, amount: p.price }))} />
          <Field label="Payment mode" htmlFor="r-mode" required>
            <Select id="r-mode" {...register("payment_mode")}>
              {PAYMENT_MODES.map((m) => <option key={m} value={m}>{PAYMENT_MODE_LABEL[m]}</option>)}
            </Select>
          </Field>
        </div>

        <div className="mt-5 rounded-xl border border-line bg-subtle px-5 py-4 text-[13px]">
          {upgrading && target && current && (
            <div className="mb-2 flex flex-col gap-1 border-b border-line pb-2">
              <div className="flex justify-between gap-3"><span className="text-secondary-grey">{target.name}</span>
                <span className="font-semibold text-ink">{formatINR(target.price)}</span></div>
              <div className="flex justify-between gap-3 text-success"><span>Credit from {current.plan_name}</span>
                <span>- {formatINR(current.credit)}</span></div>
              {toNumber(discount) > 0 && (
                <div className="flex justify-between gap-3 text-success"><span>{watch("discount_reason") || "Discount"}</span>
                  <span>- {formatINR(toNumber(discount))}</span></div>
              )}
            </div>
          )}
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="font-semibold text-muted">Net payable</div>
              {!upgrading && gross > 0 && <div className="text-xs text-muted">Plans total {formatINR(gross)}</div>}
            </div>
            <span className="text-xl font-extrabold text-accent">{formatINR(Number.isFinite(net) ? net : 0)}</span>
          </div>
          {errors.paid_amount && !errors.discount_amount && (
            <p className="mb-0 mt-2 text-xs font-semibold text-danger">{errors.paid_amount.message}</p>
          )}
        </div>
      </form>
    </Drawer>
  );
}
