import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { confirm } from "@/components/ui/ConfirmDialog";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { RichSelect, type RichOptionGroup } from "@/components/ui/RichSelect";
import { useMemberLookup } from "@/features/lookups/api";
import { membershipApi, useInvalidateMembership } from "@/features/memberships/api";
import { Blocked, DocumentField, Stat } from "@/features/memberships/components/ActionFields";
import { addDaysISO, formatDate, todayISO } from "@/lib/format";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import type { DocumentUpload, MembershipActions } from "@/types/membership";

export const TRANSFER_FORM = "transfer-form";

const schema = z.object({
  kind: z.enum(["existing", "new"]),
  to_member_id: z.string(),
  name: z.string().trim().max(120, "Max 120 characters"),
  phone: z.string().trim(),
  reason: z.string().trim().min(3, "Write why (e.g. moving city, giving to brother)").max(1000, "Max 1000 characters"),
  document: z.custom<DocumentUpload | null>(),
}).superRefine((v, ctx) => {
  if (v.kind === "existing" && !v.to_member_id) ctx.addIssue({ code: "custom", path: ["to_member_id"], message: "Pick who gets it" });
  if (v.kind === "new" && !v.name) ctx.addIssue({ code: "custom", path: ["name"], message: "Enter the name" });
  if (v.kind === "new" && !/^\d{10}$/.test(v.phone)) ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter the 10-digit mobile" });
});
type Values = z.infer<typeof schema>;

/** Transfer: hand the remaining days to a friend / family member, once, within the gym's transfer days. */
export function TransferTab({ info, memberId, onDone, onSubmitting }: {
  info: MembershipActions; memberId: string; onDone: () => void; onSubmitting: (busy: boolean) => void;
}) {
  const t = info.transfer!;
  const current = info.current!;
  const invalidate = useInvalidateMembership();
  const members = useMemberLookup(t.allowed);
  const groups = useMemo<RichOptionGroup<string>[]>(() => [{
    label: "Registered members",
    options: (members.data ?? []).filter((m) => m.id !== memberId)
      .map((m) => ({ value: m.id, label: m.name, hint: `${m.registration_id} · ${m.phone}`, icon: "user" as const })),
  }], [members.data, memberId]);

  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { kind: "existing", to_member_id: "", name: "", phone: "", reason: "", document: null },
  });
  const kind = watch("kind");
  const today = todayISO();
  const from = today < current.start_date ? current.start_date : today;

  const transfer = useMutation({
    mutationFn: (v: Values) => membershipApi.transfer(current.subscription_id, {
      reason: v.reason.trim(), document: v.document,
      ...(v.kind === "existing" ? { to_member_id: v.to_member_id } : { name: v.name.trim(), phone: v.phone.trim() }),
    }),
    onSuccess: async (res) => { notify.success(res.message); await invalidate(); onDone(); },
    onError: notify.error,
    onSettled: () => onSubmitting(false),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3 rounded-xl border border-line bg-subtle p-4">
        <Stat label="Used" value={`${t.used_days} days`} />
        <Stat label="Allowed within" value={`${t.within_days} days`} />
        <Stat label="They get" value={`${t.remaining_days} days`} tone="text-success" />
      </div>
      {!t.allowed ? <Blocked>{t.reason}</Blocked> : (
        <form id={TRANSFER_FORM} noValidate className="flex flex-col gap-4" onSubmit={handleSubmit(async (v) => {
          if (await confirm(`Move ${current.plan_name} (${t.remaining_days} days) to another person? This member's plan ends, `
            + "and a membership can move only once.")) {
            onSubmitting(true);
            transfer.mutate(v);
          }
        })}>
          <div className="inline-flex w-fit rounded-lg border border-line bg-surface p-0.5 text-xs font-semibold">
            {(["existing", "new"] as const).map((k) => (
              <button key={k} type="button" onClick={() => setValue("kind", k)}
                className={cn("cursor-pointer rounded-md border-0 px-3 py-1.5", kind === k ? "bg-accent-light text-accent" : "bg-transparent text-muted")}>
                {k === "existing" ? "Registered member" : "New person"}
              </button>
            ))}
          </div>
          {kind === "existing" ? (
            <Field label="Transfer to" required error={errors.to_member_id?.message} hint="Someone without a running membership">
              <Controller name="to_member_id" control={control} render={({ field }) => (
                <RichSelect value={field.value} groups={groups} searchable onChange={field.onChange}
                  placeholder={members.isLoading ? "Loading members…" : "Search name, ID or phone"} />
              )} />
            </Field>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Name" htmlFor="tr-name" required error={errors.name?.message}>
                <Input id="tr-name" maxLength={120} placeholder="Full name" {...register("name")} />
              </Field>
              <Field label="Mobile" htmlFor="tr-phone" required error={errors.phone?.message}>
                <Input id="tr-phone" inputMode="numeric" maxLength={10} placeholder="10-digit mobile" {...register("phone")} />
              </Field>
            </div>
          )}
          <Field label="Reason" htmlFor="tr-reason" required error={errors.reason?.message}>
            <Textarea id="tr-reason" rows={2} placeholder="Moving city, giving to brother…" {...register("reason")} />
          </Field>
          <Controller name="document" control={control} render={({ field }) => (
            <DocumentField id="tr-doc" value={field.value} onChange={field.onChange} />
          )} />
          <p className="m-0 text-xs text-muted">
            They get {current.plan_name} from <b className="text-ink">{formatDate(from)}</b> to{" "}
            <b className="text-ink">{formatDate(addDaysISO(from, t.remaining_days - 1))}</b>, already paid.
          </p>
        </form>
      )}
    </div>
  );
}
