import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { confirm } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { authApi } from "@/features/auth/api";
import { branchApi, branchKeys } from "@/features/branches/api";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { useAuthStore, useCan } from "@/stores/auth-store";

const schema = z.object({
  branch_name: z.string().trim().min(1, "Required").max(120),
  location: z.string().trim().min(1, "Required").max(200),
  login_email: z.string().trim().email("Valid email required"),
  login_password: z.string().min(6, "Min 6 characters").max(128),
});
type FormValues = z.infer<typeof schema>;

const colLabel = "text-[11px] font-extrabold uppercase tracking-[0.5px] text-muted";
const colInput =
  "rounded-lg border-[1.5px] border-line-strong bg-surface px-3 py-[9px] text-sm outline-none transition-all focus:border-accent focus:shadow-[0_0_0_3px_rgba(220,38,38,0.1)]";

/** "Manage Gym Branches" — add branch + its login, list, delete, reset login password. */
export function ManageBranchesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const canCreate = useCan("branch:create");
  const canDelete = useCan("branch:delete");
  const canUpdate = useCan("branch:update");
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const branches = useQuery({ queryKey: branchKeys.all, queryFn: branchApi.list, enabled: open });
  const { register, handleSubmit, reset, formState } = useForm<FormValues>({ resolver: zodResolver(schema), mode: "onChange" });

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
    if (await confirm(`Are you sure you want to delete the branch "${name}"?`)) remove.mutate(id);
  };

  const close = () => {
    reset();
    setResetFor(null);
    onClose();
  };

  const list = branches.data?.data.items ?? [];

  return (
    <Modal open={open} title="Manage Gym Branches" onClose={close} width="600px" bodyClassName="p-[30px]">
      {canCreate && (
        <form onSubmit={handleSubmit((v) => create.mutate(v))}
          className="mb-5 rounded-xl border border-line bg-subtle p-[15px] shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
          <div className="flex gap-[15px] max-sm:flex-col">
            <div className="flex flex-1 flex-col gap-1.5">
              <label className={colLabel}>Branch Name</label>
              <input className={colInput} placeholder="e.g. Saravanampatti" {...register("branch_name")} />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <label className={colLabel}>Location</label>
              <input className={colInput} placeholder="e.g. Coimbatore North" {...register("location")} />
            </div>
          </div>
          <div className="mt-3 flex items-end gap-[15px] max-sm:flex-col max-sm:items-stretch">
            <div className="flex flex-1 flex-col gap-1.5">
              <label className={colLabel}>Branch Login Email</label>
              <input type="email" className={colInput} placeholder="e.g. saravanampatti@stag.com" {...register("login_email")} />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <label className={colLabel}>Branch Password</label>
              <input type="password" className={colInput} placeholder="Min 6 characters" {...register("login_password")} />
            </div>
            <button type="submit" disabled={!formState.isValid || create.isPending}
              className="flex h-[38px] items-center justify-center gap-2 rounded-lg border-none bg-accent px-5 font-bold text-white transition-all hover:enabled:-translate-y-px hover:enabled:bg-accent-dark disabled:cursor-not-allowed disabled:bg-line-strong">
              <Icon name="plus" />
              {create.isPending ? "Adding…" : "Add"}
            </button>
          </div>
          <p className="mt-3 text-[11px] italic text-muted">
            * Creating a branch will automatically generate a staff login with these credentials.
          </p>
        </form>
      )}

      <div className="flex max-h-[350px] flex-col gap-3 overflow-y-auto pr-[5px]">
        {branches.isLoading && <div className="p-6 text-center text-sm text-muted">Loading branches…</div>}
        {list.map((b) => (
          <div key={b.id} className="overflow-hidden rounded-xl border-[1.5px] border-line bg-surface transition-all hover:border-line-strong hover:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)]">
            <div className="flex items-center justify-between bg-surface px-[15px] py-3">
              <div className="flex flex-col">
                <span className="text-[15px] font-extrabold text-ink">{b.branch_name}</span>
                <span className="text-xs font-medium text-muted">{b.location}</span>
              </div>
              {canDelete && (
                <button type="button" title="Delete Branch" onClick={() => onDelete(b.id, b.branch_name)}
                  className="flex items-center justify-center rounded-lg border-none bg-danger-soft p-2 text-danger transition-all hover:bg-danger hover:text-white">
                  <Icon name="trash" className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-5 border-t border-line bg-hover px-[15px] py-2">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="font-bold text-muted">Login:</span>
                <span className="font-mono font-semibold text-secondary-grey">{b.login_email ?? "Not set"}</span>
              </div>
              {canUpdate && b.login_email && (
                resetFor === b.id ? (
                  <div className="flex items-center gap-1.5 text-xs">
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password (min 6)" className={cn(colInput, "py-1 text-xs")} />
                    <button type="button" disabled={newPassword.length < 6 || resetPassword.isPending}
                      onClick={() => resetPassword.mutate({ id: b.id, pwd: newPassword })}
                      className="btn-status-action btn-red h-7 disabled:opacity-50">Save</button>
                    <button type="button" onClick={() => setResetFor(null)} className="btn-status-action btn-grey h-7">Cancel</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => { setResetFor(b.id); setNewPassword(""); }}
                    className="flex items-center gap-1 rounded p-1 text-xs font-bold text-muted hover:bg-line hover:text-accent">
                    <Icon name="key" className="h-3.5 w-3.5" /> Reset password
                  </button>
                )
              )}
            </div>
          </div>
        ))}
        {!branches.isLoading && list.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-line bg-subtle p-[30px] text-center italic text-muted">
            No branches added yet.
          </div>
        )}
      </div>
    </Modal>
  );
}
