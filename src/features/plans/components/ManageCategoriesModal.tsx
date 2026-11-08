import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { confirm } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { categoryApi, useInvalidatePlans, usePlanCategories } from "@/features/plans/api";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import type { PlanCategory } from "@/types/plan";

/**
 * The owner's category list (shared by all branches): add, rename, reorder, activate / deactivate, delete an empty one.
 * Categories only group plans on screen — nothing in the app depends on their names.
 */
export function ManageCategoriesModal({ onClose }: { onClose: () => void }) {
  const categories = usePlanCategories();
  const invalidate = useInvalidatePlans();
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const rows = categories.data ?? [];

  const done = async (message: string | null) => {
    notify.success(message);
    await invalidate();
  };
  const add = useMutation({
    mutationFn: () => categoryApi.create(newName.trim()),
    onSuccess: async (res) => { setNewName(""); await done(res.message); },
    onError: notify.error,
  });
  const update = useMutation({
    mutationFn: (v: { id: string; body: { name?: string; is_active?: boolean } }) => categoryApi.update(v.id, v.body),
    onSuccess: async (res) => { setEditing(null); await done(res.message); },
    onError: notify.error,
  });
  const reorder = useMutation({
    mutationFn: (ids: string[]) => categoryApi.reorder(ids),
    onSuccess: async () => { await invalidate(); },
    onError: notify.error,
  });
  const remove = useMutation({
    mutationFn: (id: string) => categoryApi.remove(id),
    onSuccess: async (res) => { await done(res.message); },
    onError: notify.error,
  });

  const move = (index: number, delta: number) => {
    const ids = rows.map((c) => c.id);
    const [moved] = ids.splice(index, 1);
    if (!moved) return;
    ids.splice(index + delta, 0, moved);
    reorder.mutate(ids);
  };

  const submitNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return setError("Enter a category name");
    add.mutate();
  };

  const row = (c: PlanCategory, i: number) => (
    <li key={c.id} className="flex items-center gap-2 border-b border-line-light px-3 py-2.5 last:border-b-0">
      <div className="flex flex-col">
        <button type="button" aria-label={`Move ${c.name} up`} disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)}
          className="flex h-5 w-6 cursor-pointer items-center justify-center rounded border-0 bg-transparent text-muted hover:text-ink disabled:opacity-30">
          <Icon name="chevronDown" className="h-3.5 w-3.5 rotate-180" />
        </button>
        <button type="button" aria-label={`Move ${c.name} down`} disabled={i === rows.length - 1 || reorder.isPending}
          onClick={() => move(i, 1)}
          className="flex h-5 w-6 cursor-pointer items-center justify-center rounded border-0 bg-transparent text-muted hover:text-ink disabled:opacity-30">
          <Icon name="chevronDown" className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="min-w-0 flex-1">
        {editing?.id === c.id ? (
          <form className="flex gap-2" onSubmit={(e) => {
            e.preventDefault();
            if (editing.name.trim()) update.mutate({ id: c.id, body: { name: editing.name.trim() } });
          }}>
            <Input autoFocus value={editing.name} maxLength={60} onChange={(e) => setEditing({ id: c.id, name: e.target.value })}
              className="h-9" />
            <Button type="submit" className="h-9 px-3 py-0 text-xs" loading={update.isPending}>Save</Button>
            <Button variant="secondary" className="h-9 px-3 py-0 text-xs" onClick={() => setEditing(null)}>Cancel</Button>
          </form>
        ) : (
          <>
            <div className={cn("truncate text-sm font-semibold", c.is_active ? "text-ink" : "text-muted")}>{c.name}</div>
            <div className="text-xs text-muted">{c.plan_count} plan{c.plan_count === 1 ? "" : "s"} in this branch</div>
          </>
        )}
      </div>
      {editing?.id !== c.id && (
        <div className="flex shrink-0 items-center gap-1.5">
          {!c.is_active && <StatusBadge value="INACTIVE" />}
          <button type="button" className="btn-status-action btn-grey" onClick={() => setEditing({ id: c.id, name: c.name })}>
            Rename
          </button>
          <button type="button" className="btn-status-action btn-grey"
            onClick={() => update.mutate({ id: c.id, body: { is_active: !c.is_active } })}>
            {c.is_active ? "Deactivate" : "Activate"}
          </button>
          {c.plan_count === 0 && (
            <button type="button" aria-label={`Delete ${c.name}`} title="Delete (no plans in it)"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-muted hover:bg-danger-soft hover:text-danger"
              onClick={async () => { if (await confirm(`Delete category "${c.name}"?`)) remove.mutate(c.id); }}>
              <Icon name="trash" className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </li>
  );

  return (
    <Modal open title="Plan categories"
      subtitle="Your own list, shared by all branches. Inactive categories drop out of billing; their plans stay."
      onClose={onClose} footer={<Button onClick={onClose}>Done</Button>}>
      <form onSubmit={submitNew} className="mb-4 flex items-start gap-2">
        <div className="flex-1">
          <Input value={newName} maxLength={60} placeholder="New category, e.g. Ladies only" invalid={!!error}
            onChange={(e) => { setNewName(e.target.value); setError(undefined); }} />
          {error && <p className="m-0 mt-1 text-xs font-semibold text-accent">{error}</p>}
        </div>
        <Button type="submit" icon={<Icon name="plus" className="h-4 w-4" />} loading={add.isPending}>Add</Button>
      </form>
      {categories.isLoading ? <p className="m-0 text-sm text-muted">Loading…</p> : (
        <ul className="m-0 list-none overflow-hidden rounded-xl border border-line p-0">{rows.map(row)}</ul>
      )}
    </Modal>
  );
}
