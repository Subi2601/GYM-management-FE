import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { confirm } from "@/components/ui/ConfirmDialog";
import { ActionIcon } from "@/components/ui/DataTable";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { PageLoader } from "@/components/ui/Loaders";
import { PageHeader } from "@/components/ui/PageHeader";
import { GRID_3, Section } from "@/components/ui/Section";
import { authApi } from "@/features/auth/api";
import { branchApi, branchKeys } from "@/features/branches/api";
import { BranchFormDrawer } from "@/features/gym/components/BranchFormDrawer";
import { gymApi, publicUrl, readGymFile, useGymProfile, useInvalidateGym, type GymProfile } from "@/features/gym/api";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { useAuthStore, useCan } from "@/stores/auth-store";
import type { Branch } from "@/types/branch";

const FORM_ID = "gym-profile-form";
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/;

// Mirrors backend GymProfileUpdate.
const schema = z.object({
  name: z.string().trim().min(1, "Gym name is required").max(150),
  tagline: z.string().trim().max(120, "Max 120 characters"),
  email: z.string().trim().refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter a valid email"),
  phone: z.string().trim().max(60, "Max 60 characters"),
  address: z.string().trim().max(300, "Max 300 characters"),
  gstin: z.string().trim().toUpperCase().refine((v) => v === "" || GSTIN.test(v), "15 characters, like 33ABCDE1234F1Z5"),
  invoice_footer: z.string().trim().max(500, "Max 500 characters"),
});
type Values = z.infer<typeof schema>;

const toForm = (p: GymProfile): Values => ({
  name: p.name, tagline: p.tagline ?? "", email: p.email ?? "", phone: p.phone ?? "", address: p.address ?? "",
  gstin: p.gstin ?? "", invoice_footer: p.invoice_footer ?? "",
});

/** Logo / terms upload button (hidden file input). */
function UploadButton({ label, accept, onFile, loading }: { label: string; accept: string; onFile: (f: File) => void; loading: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={input} type="file" accept={accept} className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile(f); }} />
      <Button variant="secondary" className="h-8 px-3 py-0 text-xs" loading={loading}
        icon={<Icon name="download" className="h-3.5 w-3.5 rotate-180" />} onClick={() => input.current?.click()}>
        {label}
      </Button>
    </>
  );
}

/**
 * Gym Settings — the gym's identity: logo, name, tagline, contacts, GSTIN, address, invoice footer and the terms &
 * conditions PDF (sent with the welcome WhatsApp message), then every branch with its own contacts. Printed on
 * invoices and shown on the enquiry form and sidebar.
 */
export function GymSettingsPage() {
  const profile = useGymProfile();
  const invalidate = useInvalidateGym();
  const qc = useQueryClient();
  const canBranchAdd = useCan("branch:create");
  const canBranchEdit = useCan("branch:update");
  const canBranchDelete = useCan("branch:delete");
  const [branchForm, setBranchForm] = useState<{ branch: Branch | null } | null>(null);
  const branches = useQuery({ queryKey: branchKeys.all, queryFn: async () => (await branchApi.list()).data.items });

  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<Values>({ resolver: zodResolver(schema) });
  useEffect(() => { if (profile.data) reset(toForm(profile.data)); }, [profile.data, reset]);

  const save = useMutation({
    mutationFn: (v: Values) => gymApi.save({ ...v, tagline: v.tagline || null, email: v.email || null, phone: v.phone || null,
      address: v.address || null, gstin: v.gstin || null, invoice_footer: v.invoice_footer || null }),
    onSuccess: async (res) => { notify.success(res.message); reset(toForm(res.data)); await invalidate(); },
    onError: notify.error,
  });
  const upload = useMutation({
    mutationFn: async ({ kind, file }: { kind: "logo" | "terms"; file: File }) => gymApi.upload(kind, kind === "logo"
      ? await readGymFile(file, ["image/png", "image/jpeg", "image/webp"], 1024 * 1024, "a PNG, JPG or WEBP image up to 1 MB")
      : await readGymFile(file, ["application/pdf"], 5 * 1024 * 1024, "a PDF up to 5 MB")),
    onSuccess: async (res) => { notify.success(res.message); await invalidate(); },
    onError: notify.error,
  });
  const removeFile = useMutation({
    mutationFn: (kind: "logo" | "terms") => gymApi.remove(kind),
    onSuccess: async (res) => { notify.success(res.message); await invalidate(); },
    onError: notify.error,
  });
  const removeBranch = useMutation({
    mutationFn: (id: string) => branchApi.remove(id),
    onSuccess: async (res) => {
      notify.success(res.message);
      await qc.invalidateQueries({ queryKey: branchKeys.all });
      try { useAuthStore.getState().setMe((await authApi.me()).data); } catch { /* next load */ }
    },
    onError: notify.error,
  });

  if (profile.isLoading) return <PageLoader />;
  if (profile.isError || !profile.data) return <p className="text-sm text-danger">{profile.error?.message}</p>;
  const p = profile.data;
  const uploading = upload.isPending ? upload.variables?.kind : undefined;

  return (
    <div>
      <PageHeader title="Gym settings" subtitle="Your gym's identity and branches · printed on invoices and shared with members"
        actions={<>
          {isDirty && <Button variant="secondary" onClick={() => reset(toForm(p))}>Undo</Button>}
          <Button type="submit" form={FORM_ID} disabled={!isDirty} loading={save.isPending}>Save profile</Button>
        </>} />

      <div className="flex flex-col gap-5">
        <Section title="Gym profile" description="Name, logo and contacts of the whole gym">
          <div className="flex flex-col gap-5 md:flex-row">
            <div className="flex shrink-0 flex-col items-center gap-2">
              <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line-strong bg-subtle">
                {p.logo_url ? <img src={p.logo_url} alt="Gym logo" className="h-full w-full object-contain" />
                  : <span className="font-display text-4xl text-muted">{p.name.charAt(0)}</span>}
              </div>
              <UploadButton label={p.logo_url ? "Change logo" : "Upload logo"} accept="image/png,image/jpeg,image/webp"
                loading={uploading === "logo"} onFile={(file) => upload.mutate({ kind: "logo", file })} />
              {p.logo_url && (
                <button type="button" className="cursor-pointer border-0 bg-transparent text-xs font-semibold text-muted hover:text-danger"
                  onClick={async () => { if (await confirm("Remove the gym logo?")) removeFile.mutate("logo"); }}>Remove</button>
              )}
              <span className="text-center text-[11px] text-muted">PNG / JPG, up to 1 MB<br />Square works best</span>
            </div>
            <form id={FORM_ID} noValidate onSubmit={handleSubmit((v) => save.mutate(v))} className="min-w-0 flex-1">
              <div className={GRID_3}>
                <Field label="Gym name" htmlFor="gp-name" required error={errors.name?.message}>
                  <Input id="gp-name" maxLength={150} {...register("name")} />
                </Field>
                <Field label="Gym ID" htmlFor="gp-code" hint="Set when the gym was created">
                  <Input id="gp-code" value={p.code} readOnly className="font-mono" />
                </Field>
                <Field label="Tagline" htmlFor="gp-tag" error={errors.tagline?.message} hint="Under the name on invoices">
                  <Input id="gp-tag" maxLength={120} placeholder="Lifestyle & fitness studio" {...register("tagline")} />
                </Field>
                <Field label="Email" htmlFor="gp-email" error={errors.email?.message}>
                  <Input id="gp-email" type="email" maxLength={150} placeholder="hello@yourgym.com" {...register("email")} />
                </Field>
                <Field label="Phone" htmlFor="gp-phone" error={errors.phone?.message} hint="Main number(s), comma separated">
                  <Input id="gp-phone" maxLength={60} placeholder="98400 11111, 98400 22222" {...register("phone")} />
                </Field>
                <Field label="GSTIN" htmlFor="gp-gst" error={errors.gstin?.message} hint="A branch can have its own">
                  <Input id="gp-gst" maxLength={15} className="uppercase" placeholder="33ABCDE1234F1Z5" {...register("gstin")} />
                </Field>
                <Field label="Registered address" htmlFor="gp-addr" error={errors.address?.message} className="md:col-span-2 lg:col-span-3">
                  <Input id="gp-addr" maxLength={300} {...register("address")} />
                </Field>
                <Field label="Invoice footer note" htmlFor="gp-foot" error={errors.invoice_footer?.message} className="md:col-span-2 lg:col-span-3"
                  hint="Printed at the bottom of every invoice">
                  <Textarea id="gp-foot" rows={2} maxLength={500} placeholder="Fees once paid are non-transferable." {...register("invoice_footer")} />
                </Field>
              </div>
            </form>
          </div>
        </Section>

        <Section title="Terms & conditions" description="Sent as a link with the welcome message on WhatsApp when a member joins">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {p.terms_url ? (
              <a href={p.terms_url} target="_blank" rel="noreferrer"
                className="flex min-w-0 items-center gap-3 rounded-xl border border-line bg-subtle px-3 py-2 no-underline">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-danger-soft text-danger"><Icon name="file" className="h-4 w-4" /></span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">{p.terms_file_name}</span>
                  <span className="block truncate text-xs text-muted">{publicUrl(p.terms_url)?.split("?")[0]}</span>
                </span>
              </a>
            ) : <p className="m-0 text-sm text-muted">No terms uploaded yet. The welcome message goes without a terms link.</p>}
            <span className="flex items-center gap-2">
              <UploadButton label={p.terms_url ? "Replace PDF" : "Upload PDF"} accept="application/pdf"
                loading={uploading === "terms"} onFile={(file) => upload.mutate({ kind: "terms", file })} />
              {p.terms_url && (
                <Button variant="secondary" className="h-8 px-3 py-0 text-xs"
                  onClick={async () => { if (await confirm("Remove the terms & conditions PDF?")) removeFile.mutate("terms"); }}>
                  Remove
                </Button>
              )}
            </span>
          </div>
        </Section>

        <Section title="Branches" description="Every branch of this gym · its own phone / email, or the gym's"
          aside={canBranchAdd && (
            <Button icon={<Icon name="plus" className="h-4 w-4" />} onClick={() => setBranchForm({ branch: null })}>Add branch</Button>
          )}>
          {branches.isLoading ? <p className="m-0 text-sm text-muted">Loading…</p> : (
            <ul className="m-0 flex list-none flex-col divide-y divide-line-light overflow-hidden rounded-xl border border-line p-0">
              {(branches.data ?? []).map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-3 bg-surface px-4 py-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-light text-accent">
                    <Icon name="building" className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-ink">{b.branch_name}</span>
                      {b.is_head_office && <span className="rounded-full bg-accent-light px-2 py-0.5 text-[11px] font-bold text-accent">Head office</span>}
                    </div>
                    <div className="truncate text-xs text-muted">{b.location ?? "No address"}</div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-secondary-grey">
                      <span><Icon name="phone" className="mr-1 inline h-3 w-3" />{b.phone ?? <i className="text-muted">gym's number</i>}</span>
                      <span><Icon name="mail" className="mr-1 inline h-3 w-3" />{b.email ?? <i className="text-muted">gym's email</i>}</span>
                      {b.gstin && <span>GSTIN {b.gstin}</span>}
                      {b.login_email && <span className="text-muted">Admin login {b.login_email}</span>}
                    </div>
                  </div>
                  <div className={cn("shrink-0 text-right text-xs text-muted")}>
                    <b className="text-ink">{b.members_count}</b> members<br /><b className="text-ink">{b.staff_count}</b> staff
                  </div>
                  <span className="flex gap-1">
                    {canBranchEdit && <ActionIcon kind="edit" onClick={() => setBranchForm({ branch: b })} />}
                    {canBranchDelete && (
                      <ActionIcon kind="delete" disabled={b.is_head_office} disabledReason="Make another branch the head office first"
                        onClick={async () => { if (await confirm(`Delete the branch "${b.branch_name}"? Its logins stop working.`)) removeBranch.mutate(b.id); }} />
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {branchForm && <BranchFormDrawer branch={branchForm.branch} onClose={() => setBranchForm(null)} />}
    </div>
  );
}
