import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { confirm } from "@/components/ui/ConfirmDialog";
import { Checkbox } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { PageLoader } from "@/components/ui/Loaders";
import { PageHeader } from "@/components/ui/PageHeader";
import { roleApi, roleKeys, useInvalidateRoles, useRoleCatalog, useRoles } from "@/features/roles/api";
import { RoleFormModal } from "@/features/roles/components/RoleFormModal";
import { useCan } from "@/stores/auth-store";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import type { CatalogPermission, Role } from "@/types/role";

const LEVEL_TONE: Record<number, string> = {
  100: "bg-accent-light text-accent", 80: "bg-info-soft text-info", 50: "bg-success-soft text-success",
  10: "bg-subtle text-secondary-grey",
};
const toneOf = (level: number) => LEVEL_TONE[level] ?? "bg-subtle text-secondary-grey";

/**
 * Roles & Access — the gym's role ladder (Owner › Sub-admin › Manager › Staff and the owner's own roles) on the left,
 * the selected role's access as ticks grouped by module → screen on the right. Owner-only ticks are locked;
 * "Switch branches" only for all-branch roles. Saving replaces the role's access.
 */
export function RolesPage() {
  const canManage = useCan("role:manage");
  const roles = useRoles();
  const catalog = useRoleCatalog();
  const invalidate = useInvalidateRoles();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<{ role: Role | null } | null>(null);

  const list = useMemo(() => roles.data ?? [], [roles.data]);
  const selected = list.find((r) => r.id === selectedId) ?? list.find((r) => !r.is_owner) ?? list[0] ?? null;

  const detail = useQuery({
    queryKey: roleKeys.detail(selected?.id ?? ""),
    queryFn: async () => (await roleApi.get(selected!.id)).data,
    enabled: !!selected,
  });
  const [ticks, setTicks] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (detail.data) setTicks(new Set(detail.data.permissions));
  }, [detail.data]);

  const saved = useMemo(() => new Set(detail.data?.permissions ?? []), [detail.data]);
  const changes = useMemo(() => {
    let n = 0;
    ticks.forEach((c) => { if (!saved.has(c)) n += 1; });
    saved.forEach((c) => { if (!ticks.has(c)) n += 1; });
    return n;
  }, [ticks, saved]);

  const editable = !!selected?.editable && canManage;
  const locked = (p: CatalogPermission) => !editable || p.owner_only || p.code === "auth:me"
    || (p.all_branches_only && !selected?.all_branches);
  const lockReason = (p: CatalogPermission) => p.owner_only ? "Only the owner can have this"
    : p.all_branches_only && !selected?.all_branches ? "Only for All branches roles"
      : p.code === "auth:me" ? "Every login has this" : undefined;

  const toggle = (codes: string[], on: boolean) => setTicks((cur) => {
    const next = new Set(cur);
    codes.forEach((c) => (on ? next.add(c) : next.delete(c)));
    return next;
  });

  const saveAccess = useMutation({
    mutationFn: () => roleApi.setPermissions(selected!.id, [...ticks]),
    onSuccess: async (res) => {
      notify.success(res.message);
      await invalidate();
    },
    onError: notify.error,
  });
  const remove = useMutation({
    mutationFn: (id: string) => roleApi.remove(id),
    onSuccess: async (res) => {
      notify.success(res.message);
      setSelectedId(null);
      await invalidate();
    },
    onError: notify.error,
  });

  const pick = async (id: string) => {
    if (changes > 0 && !(await confirm(`Discard ${changes} unsaved change${changes > 1 ? "s" : ""}?`))) return;
    setSelectedId(id);
  };

  if (roles.isLoading || catalog.isLoading) return <PageLoader />;

  return (
    <div>
      <PageHeader
        title="Roles & Access"
        subtitle="Who can do what. Owner › Sub-admin › Manager › Staff. A role can only be given by someone above it"
        actions={canManage && (
          <Button icon={<Icon name="plus" className="h-4 w-4" />} onClick={() => setForm({ role: null })}>Add role</Button>
        )}
      />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[300px_1fr]">
        {/* Ladder */}
        <aside className="rounded-2xl border border-line bg-surface p-3 shadow-subtle lg:sticky lg:top-[calc(var(--header-height)+24px)]">
          <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
            {list.map((r, i) => {
              const first = i === 0 || list[i - 1]!.level !== r.level;
              return (
                <li key={r.id}>
                  {first && (
                    <div className="mb-1 mt-2 flex items-center gap-2 px-2 text-[11px] font-bold uppercase tracking-wide text-muted first:mt-0">
                      <span className={cn("rounded px-1.5 py-0.5", toneOf(r.level))}>{r.level_label}</span>
                      <span className="h-px flex-1 bg-line" />
                    </div>
                  )}
                  <button type="button" onClick={() => void pick(r.id)}
                    className={cn("flex w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                      r.id === selected?.id ? "border-accent bg-accent-light" : "border-transparent bg-transparent hover:bg-hover")}>
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", toneOf(r.level))}>
                      <Icon name={r.is_owner ? "star" : r.all_branches ? "building" : "user"} className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate font-semibold text-ink">{r.name}</span>
                        {!r.is_system && <span className="rounded bg-subtle px-1 text-[10px] font-bold uppercase text-muted">Own</span>}
                      </span>
                      <span className="block text-xs text-muted">
                        {r.user_count} login{r.user_count === 1 ? "" : "s"} · {r.is_owner ? "full access" : `${r.permission_count} ticks`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        {/* Access */}
        {selected && (
          <section className="min-w-0 rounded-2xl border border-line bg-surface shadow-subtle">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line-light px-6 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="m-0 text-lg font-bold text-ink">{selected.name}</h2>
                  <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", toneOf(selected.level))}>
                    {selected.level_label}{selected.all_branches || selected.is_owner ? "" : " · one branch"}
                  </span>
                </div>
                <p className="m-0 mt-1 text-[13px] text-muted">{selected.description ?? "—"}</p>
              </div>
              {editable && (
                <div className="flex gap-2">
                  <Button variant="secondary" icon={<Icon name="edit" className="h-4 w-4" />} onClick={() => setForm({ role: selected })}>
                    Edit
                  </Button>
                  {!selected.is_system && (
                    <span title={selected.user_count ? "Give its logins another role first" : undefined}>
                      <Button variant="secondary" icon={<Icon name="trash" className="h-4 w-4" />} disabled={selected.user_count > 0}
                        loading={remove.isPending} onClick={async () => {
                          if (await confirm(`Delete the role ${selected.name}?`)) remove.mutate(selected.id);
                        }}>
                        Delete
                      </Button>
                    </span>
                  )}
                </div>
              )}
            </header>

            {selected.is_owner ? (
              <p className="m-0 flex items-center gap-2 px-6 py-4 text-sm text-muted">
                <Icon name="shield" className="h-4 w-4 text-accent" /> The owner always has full access to every branch and screen.
              </p>
            ) : !editable && (
              <p className="m-0 px-6 py-3 text-xs text-muted">Read only: only someone above this role can change it.</p>
            )}

            <div className="flex flex-col gap-4 p-5">
              {(catalog.data ?? []).map((m) => (
                <div key={m.code} className="overflow-hidden rounded-xl border border-line">
                  <div className="bg-subtle px-4 py-2.5 text-[13px] font-bold uppercase tracking-wide text-secondary-grey">{m.name}</div>
                  {m.screens.map((s) => {
                    const free = s.permissions.filter((p) => !locked(p)).map((p) => p.code);
                    const allOn = s.permissions.every((p) => selected.is_owner || ticks.has(p.code));
                    return (
                      <div key={s.code} className="flex flex-col gap-3 border-t border-line-light px-4 py-3 md:flex-row md:items-start">
                        <div className="flex w-full shrink-0 items-center justify-between gap-2 md:w-48 md:flex-col md:items-start">
                          <span className="font-semibold text-ink">{s.name}</span>
                          {editable && free.length > 1 && (
                            <button type="button" onClick={() => toggle(free, !free.every((c) => ticks.has(c)))}
                              className="cursor-pointer border-0 bg-transparent p-0 text-xs font-semibold text-accent">
                              {free.every((c) => ticks.has(c)) ? "Clear all" : "Select all"}
                            </button>
                          )}
                        </div>
                        <div className="grid flex-1 grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                          {s.permissions.map((p) => {
                            const reason = lockReason(p);
                            return (
                              <span key={p.code} title={reason} className="flex items-center gap-1.5">
                                <Checkbox checked={selected.is_owner || ticks.has(p.code)} disabled={locked(p)}
                                  onChange={(on) => toggle([p.code], on)} label={p.name} />
                                {p.owner_only && <Icon name="shield" className="h-3.5 w-3.5 text-accent" />}
                              </span>
                            );
                          })}
                        </div>
                        {allOn && !selected.is_owner && <span className="sr-only">All on</span>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {editable && changes > 0 && (
              <div className="sticky bottom-0 flex items-center justify-end gap-3 rounded-b-2xl border-t border-line bg-surface/95 px-6 py-3 backdrop-blur">
                <span className="mr-auto text-sm text-muted">{changes} unsaved change{changes > 1 ? "s" : ""}</span>
                <Button variant="secondary" onClick={() => setTicks(new Set(saved))}>Discard</Button>
                <Button loading={saveAccess.isPending} onClick={() => saveAccess.mutate()}>Save access</Button>
              </div>
            )}
          </section>
        )}
      </div>

      {form && (
        <RoleFormModal role={form.role} roles={list} onClose={() => setForm(null)}
          onSaved={(r) => setSelectedId(r.id)} />
      )}
    </div>
  );
}
