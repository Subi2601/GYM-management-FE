import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input } from "@/components/ui/Field";
import { Drawer } from "@/components/ui/Modal";
import { FormDivider, GRID_2 } from "@/components/ui/Section";
import { authApi } from "@/features/auth/api";
import { branchApi, branchKeys } from "@/features/branches/api";
import { notify } from "@/lib/notify";
import { useAuthStore } from "@/stores/auth-store";
import type { Branch } from "@/types/branch";

const FORM_ID = "branch-form";
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/;

// Mirrors backend BranchCreate / BranchUpdate. Phone / email are free text and NOT unique.
const base = z.object({
  branch_name: z.string().trim().min(1, "Branch name is required").max(120),
  location: z.string().trim().min(1, "Address is required").max(200),
  phone: z.string().trim().max(60, "Max 60 characters"),
  email: z.string().trim().refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter a valid email"),
  gstin: z.string().trim().toUpperCase().refine((v) => v === "" || GSTIN.test(v), "15 characters, like 33ABCDE1234F1Z5"),
  is_head_office: z.boolean(),
  login_email: z.string().trim(),
  login_password: z.string(),
});

/** Add / edit a branch: name, address, its own phone / email (the head office can share the gym's), GSTIN override.
 *  A new branch also gets its admin login. */
export function BranchFormDrawer({ branch, onClose }: { branch: Branch | null; onClose: () => void }) {
  const qc = useQueryClient();
  const isEdit = branch !== null;
  const schema = base.superRefine((v, ctx) => {
    if (isEdit) return;
    if (!z.string().email().safeParse(v.login_email).success) ctx.addIssue({ code: "custom", path: ["login_email"], message: "Enter a valid email" });
    if (v.login_password.length < 6) ctx.addIssue({ code: "custom", path: ["login_password"], message: "At least 6 characters" });
  });
  type Values = z.infer<typeof base>;

  const { register, control, handleSubmit, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      branch_name: branch?.branch_name ?? "", location: branch?.location ?? "", phone: branch?.phone ?? "",
      email: branch?.email ?? "", gstin: branch?.gstin ?? "", is_head_office: branch?.is_head_office ?? false,
      login_email: "", login_password: "",
    },
  });

  const save = useMutation({
    mutationFn: (v: Values) => {
      const contacts = { phone: v.phone || null, email: v.email || null, gstin: v.gstin || null, is_head_office: v.is_head_office };
      return isEdit
        ? branchApi.update(branch.id, { branch_name: v.branch_name, location: v.location, ...contacts })
        : branchApi.create({ branch_name: v.branch_name, location: v.location, login_email: v.login_email,
          login_password: v.login_password, ...contacts });
    },
    onSuccess: async (res) => {
      notify.success(res.message);
      onClose();
      await qc.invalidateQueries({ queryKey: branchKeys.all });
      try { useAuthStore.getState().setMe((await authApi.me()).data); } catch { /* refreshed on next load */ }
    },
    onError: notify.error,
  });

  return (
    <Drawer open title={isEdit ? "Edit branch" : "Add branch"} onClose={onClose}
      subtitle={isEdit ? branch.branch_name : "A new location of your gym, with its own admin login"}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" form={FORM_ID} loading={save.isPending}>{isEdit ? "Save branch" : "Add branch"}</Button>
      </>}>
      <form id={FORM_ID} noValidate onSubmit={handleSubmit((v) => save.mutate(v))}>
        <FormDivider>Branch</FormDivider>
        <div className={GRID_2}>
          <Field label="Branch name" htmlFor="bf-name" required error={errors.branch_name?.message}>
            <Input id="bf-name" maxLength={120} placeholder="Saravanampatti" {...register("branch_name")} />
          </Field>
          <Field label="Address" htmlFor="bf-loc" required error={errors.location?.message}>
            <Input id="bf-loc" maxLength={200} placeholder="12, Anna Salai, Coimbatore" {...register("location")} />
          </Field>
        </div>

        <FormDivider>Contact</FormDivider>
        <div className={GRID_2}>
          <Field label="Phone" htmlFor="bf-phone" error={errors.phone?.message} hint="Empty = the gym's number">
            <Input id="bf-phone" maxLength={60} placeholder="98400 11111" {...register("phone")} />
          </Field>
          <Field label="Email" htmlFor="bf-email" error={errors.email?.message} hint="Empty = the gym's email">
            <Input id="bf-email" type="email" maxLength={150} placeholder="north@yourgym.com" {...register("email")} />
          </Field>
          <Field label="GSTIN" htmlFor="bf-gst" error={errors.gstin?.message} hint="Only if this branch has its own (another state)">
            <Input id="bf-gst" maxLength={15} className="uppercase" placeholder="Same as the gym" {...register("gstin")} />
          </Field>
          <div className="flex items-end pb-2">
            <Controller name="is_head_office" control={control} render={({ field }) => (
              <Checkbox checked={field.value} onChange={field.onChange} label="Head office" />
            )} />
          </div>
        </div>
        <p className="m-0 mt-2 text-xs text-muted">Phone and email can be the same as another branch or the gym.</p>

        {isEdit && branch.login_email && <ResetLogin branch={branch} />}
        {!isEdit && (
          <>
            <FormDivider>Branch admin login</FormDivider>
            <div className={GRID_2}>
              <Field label="Login email" htmlFor="bf-login" required error={errors.login_email?.message}>
                <Input id="bf-login" type="email" autoComplete="off" placeholder="north.admin@yourgym.com" {...register("login_email")} />
              </Field>
              <Field label="Login password" htmlFor="bf-pwd" required error={errors.login_password?.message}>
                <Input id="bf-pwd" type="password" autoComplete="new-password" placeholder="At least 6 characters" {...register("login_password")} />
              </Field>
            </div>
          </>
        )}
      </form>
    </Drawer>
  );
}

/** The branch admin login and a new password for it (signs that login out everywhere). */
function ResetLogin({ branch }: { branch: Branch }) {
  const [pwd, setPwd] = useState("");
  const reset = useMutation({
    mutationFn: () => branchApi.resetLoginPassword(branch.id, pwd),
    onSuccess: (res) => { notify.success(res.message); setPwd(""); },
    onError: notify.error,
  });
  return (
    <>
      <FormDivider>Branch admin login</FormDivider>
      <div className="flex flex-wrap items-end gap-2">
        <Field label={`New password for ${branch.login_email}`} htmlFor="bf-reset" className="min-w-[220px] flex-1">
          <Input id="bf-reset" type="password" autoComplete="new-password" placeholder="At least 6 characters"
            value={pwd} onChange={(e) => setPwd(e.target.value)} />
        </Field>
        <Button variant="secondary" disabled={pwd.length < 6} loading={reset.isPending} onClick={() => reset.mutate()}>
          Reset password
        </Button>
      </div>
    </>
  );
}
