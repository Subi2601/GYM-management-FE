import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { confirm } from "@/components/ui/ConfirmDialog";
import { Field, Input } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { FormDivider } from "@/components/ui/Section";
import { authApi } from "@/features/auth/api";
import { branchApi, branchKeys } from "@/features/branches/api";
import { notify } from "@/lib/notify";
import { useAuthStore, useCan } from "@/stores/auth-store";

const FORM_ID = "add-branch-form";

const schema = z.object({
  branch_name: z.string().trim().min(1, "Required").max(120),
  location: z.string().trim().min(1, "Required").max(200),
  login_email: z.string().trim().email("Valid email required"),
  login_password: z.string().min(6, "Min 6 characters").max(128),
});
type FormValues = z.infer<typeof schema>;

/** "Manage branches" — add a branch with its staff login, list, delete, reset the login password. */
export function ManageBranchesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const canCreate = useCan("branch:create");
  const canDelete = useCan("branch:delete");
  const canUpdate = useCan("branch:update");
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const branches = useQuery({ queryKey: branchKeys.all, queryFn: branchApi.list, enabled: open });
  const { register, handleSubmit, reset, formState: { errors, isValid } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
  });

  const refreshMe = async () => {
    const { data } = await authApi.me();
    useAuthStore.getState().setMe(data);
  };

  const create = useMutation({
    mutationFn: branchApi.create,
    onSuccess: async (res) => {
      notify.success(res.message);
      reset();
      await qc.invalidateQueries({ queryKey: branchKeys.all });
      await refreshMe();
    },
    onError: notify.error,
  });

  const remove = useMutation({
    mutationFn: branchApi.remove,
    onSuccess: async (res) => {
      notify.success(res.message);
      await qc.invalidateQueries({ queryKey: branchKeys.all });
      await refreshMe();
    },
    onError: notify.error,
  });

  const resetPassword = useMutation({
    mutationFn: ({ id, pwd }: { id: string; pwd: string }) => branchApi.resetLoginPassword(id, pwd),
    onSuccess: (res) => {
      notify.success(res.message);
      setResetFor(null);
      setNewPassword("");
    },
    onError: notify.error,
  });

  const onDelete = async (id: string, name: string) => {
    if (await confirm(`Delete the branch "${name}"?`)) remove.mutate(id);
  };

  const close = () => {
    reset();
    setResetFor(null);
    setNewPassword("");
    onClose();
  };

  const list = branches.data?.data.items ?? [];

  return (
    <Modal
      open={open}
      title="Manage branches"
      subtitle="Each branch gets its own staff login"
      onClose={close}
      width="620px"
      footer={
        <>
          <Button variant="secondary" onClick={close}>Close</Button>
          {canCreate && (
            <Button type="submit" form={FORM_ID} icon={<Icon name="plus" className="h-4 w-4" />}
              loading={create.isPending} disabled={!isValid}>
              Add branch
            </Button>
          )}
        </>
      }
    >
      {canCreate && (
        <form id={FORM_ID} onSubmit={handleSubmit((v) => create.mutate(v))} noValidate className="mb-2">
          <FormDivider>New branch</FormDivider>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Branch name" htmlFor="br-name" required error={errors.branch_name?.message}>
              <Input id="br-name" placeholder="e.g. Saravanampatti" invalid={!!errors.branch_name} {...register("branch_name")} />
            </Field>
            <Field label="Location" htmlFor="br-location" required error={errors.location?.message}>
              <Input id="br-location" placeholder="e.g. Coimbatore North" invalid={!!errors.location} {...register("location")} />
            </Field>
            <Field label="Login email" htmlFor="br-email" required error={errors.login_email?.message}>
              <Input id="br-email" type="email" autoComplete="off" placeholder="e.g. saravanampatti@stag.com"
                invalid={!!errors.login_email} {...register("login_email")} />
            </Field>
            <Field label="Login password" htmlFor="br-password" required error={errors.login_password?.message}>
              <Input id="br-password" type="password" autoComplete="new-password" placeholder="Min 6 characters"
                invalid={!!errors.login_password} {...register("login_password")} />
            </Field>
          </div>
          <p className="m-0 mt-3 text-xs text-muted">A staff login is created for the branch with these credentials.</p>
        </form>
      )}

      <FormDivider>Branches{list.length > 0 ? ` (${list.length})` : ""}</FormDivider>
      <div className="flex flex-col gap-2.5">
        {branches.isLoading && <p className="m-0 p-6 text-center text-sm text-muted">Loading branches…</p>}
        {list.map((b) => (
          <div key={b.id} className="rounded-xl border border-line bg-surface">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-light text-accent">
                  <Icon name="building" className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-ink">{b.branch_name}</div>
                  <div className="truncate text-xs text-muted">{b.location}</div>
                </div>
              </div>
              {canDelete && (
                <button type="button" className="action-icon delete" title="Delete branch" aria-label="Delete branch"
                  disabled={remove.isPending} onClick={() => void onDelete(b.id, b.branch_name)}>
                  <Icon name="trash" className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-light bg-subtle px-4 py-2.5">
              <div className="flex min-w-0 items-center gap-1.5 text-xs">
                <span className="font-semibold text-muted">Login</span>
                <span className="truncate font-mono font-semibold text-secondary-grey">{b.login_email ?? "Not set"}</span>
              </div>
              {canUpdate && b.login_email && (
                resetFor === b.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password" aria-label="New password" placeholder="New password (min 6)"
                      className="!h-8 !w-[190px] !py-1 text-xs" />
                    <Button className="h-8 px-3 py-0 text-xs" disabled={newPassword.length < 6}
                      loading={resetPassword.isPending} onClick={() => resetPassword.mutate({ id: b.id, pwd: newPassword })}>
                      Save
                    </Button>
                    <Button variant="secondary" className="h-8 px-3 py-0 text-xs" onClick={() => setResetFor(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <button type="button" onClick={() => { setResetFor(b.id); setNewPassword(""); }}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border-0 bg-transparent px-1.5 py-1 text-xs font-semibold text-muted hover:bg-hover hover:text-accent">
                    <Icon name="key" className="h-3.5 w-3.5" /> Reset password
                  </button>
                )
              )}
            </div>
          </div>
        ))}
        {!branches.isLoading && list.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-line bg-subtle p-8 text-center text-sm text-muted">
            No branches added yet.
          </div>
        )}
      </div>
    </Modal>
  );
}
