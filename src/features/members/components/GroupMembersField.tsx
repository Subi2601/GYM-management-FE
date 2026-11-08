import { useMemo } from "react";

import { Input } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { RichSelect, type RichOptionGroup } from "@/components/ui/RichSelect";
import { useMemberLookup } from "@/features/lookups/api";
import { cn } from "@/lib/utils";

/** One other member of a group package: someone already registered, or a new person (created on payment). */
export type GroupEntry =
  | { kind: "existing"; memberId: string }
  | { kind: "new"; name: string; phone: string };

export const emptyEntry = (): GroupEntry => ({ kind: "existing", memberId: "" });

/** Inline problem with the entries (null = ready to bill). */
export function groupEntryError(entries: GroupEntry[]): string | null {
  for (const [i, e] of entries.entries()) {
    if (e.kind === "existing" && !e.memberId) return `Pick member ${i + 2}, or add them as new`;
    if (e.kind === "new" && !e.name.trim()) return `Enter member ${i + 2}'s name`;
    if (e.kind === "new" && !/^\d{10}$/.test(e.phone.trim())) return `Enter member ${i + 2}'s 10-digit mobile number`;
  }
  const ids = entries.flatMap((e) => (e.kind === "existing" && e.memberId ? [e.memberId] : []));
  if (new Set(ids).size !== ids.length) return "The same member is picked twice";
  return null;
}

/** Request shape (EnrollRequest.group_members). */
export const toGroupMembers = (entries: GroupEntry[]) => entries.map((e) => (e.kind === "existing"
  ? { member_id: e.memberId } : { name: e.name.trim(), phone: e.phone.trim() }));

interface Props {
  payerName: string;
  payerId: string | null;
  entries: GroupEntry[];
  onChange: (entries: GroupEntry[]) => void;
}

/** The other members of a couple / family / friends / corporate package — each gets their own membership. */
export function GroupMembersField({ payerName, payerId, entries, onChange }: Props) {
  const members = useMemberLookup();
  const groups = useMemo<RichOptionGroup<string>[]>(() => [{
    label: "Registered members",
    options: (members.data ?? []).filter((m) => m.id !== payerId)
      .map((m) => ({ value: m.id, label: m.name, hint: `${m.registration_id} · ${m.phone}`, icon: "user" as const })),
  }], [members.data, payerId]);

  const set = (i: number, entry: GroupEntry) => onChange(entries.map((e, j) => (j === i ? entry : e)));

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2 text-[13px]">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-light text-xs font-bold text-accent">1</span>
        <span className="font-semibold text-ink">{payerName}</span>
        <span className="text-xs text-muted">pays</span>
      </div>
      {entries.map((e, i) => (
        <div key={i} className="rounded-xl border border-line bg-subtle p-2.5">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-hover text-xs font-bold text-secondary-grey">{i + 2}</span>
            <div className="ml-auto inline-flex rounded-lg border border-line bg-surface p-0.5 text-xs font-semibold">
              {(["existing", "new"] as const).map((k) => (
                <button key={k} type="button" onClick={() => set(i, k === "existing" ? emptyEntry() : { kind: "new", name: "", phone: "" })}
                  className={cn("cursor-pointer rounded-md border-0 px-2.5 py-1", e.kind === k ? "bg-accent-light text-accent" : "bg-transparent text-muted")}>
                  {k === "existing" ? "Registered" : "New"}
                </button>
              ))}
            </div>
          </div>
          {e.kind === "existing" ? (
            <RichSelect value={e.memberId} groups={groups} searchable
              placeholder={members.isLoading ? "Loading members…" : "Search name, ID or phone"}
              onChange={(v) => set(i, { kind: "existing", memberId: v })} />
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Input placeholder="Full name" maxLength={120} value={e.name} onChange={(ev) => set(i, { ...e, name: ev.target.value })} />
              <Input placeholder="10-digit mobile" inputMode="numeric" maxLength={10} value={e.phone}
                onChange={(ev) => set(i, { ...e, phone: ev.target.value.replace(/\D/g, "") })} />
            </div>
          )}
        </div>
      ))}
      <p className="m-0 flex items-center gap-1.5 text-xs text-muted">
        <Icon name="users" className="h-3.5 w-3.5" /> Each gets their own membership, QR check-in and renewal reminder.
      </p>
    </div>
  );
}
