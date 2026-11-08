import { useMemo } from "react";

import { RichSelect, type RichOptionGroup } from "@/components/ui/RichSelect";
import { useMemberLookup } from "@/features/lookups/api";

interface Props {
  id?: string;
  value: string;
  onChange: (memberId: string) => void;
  /** Left out of the list (e.g. the member being edited). */
  excludeId?: string | null;
  placeholder?: string;
  /** Shown while the list loads / when the picked member isn't in it (another branch). */
  currentName?: string | null;
}

/** Searchable member dropdown (name, reg ID, phone) — "Referred by" on members and leads. "" = none. */
export function MemberPicker({ id, value, onChange, excludeId, placeholder = "Search name, ID or phone", currentName }: Props) {
  const members = useMemberLookup();
  const groups = useMemo<RichOptionGroup<string>[]>(() => {
    const list = (members.data ?? []).filter((m) => m.id !== excludeId)
      .map((m) => ({ value: m.id, label: m.name, hint: `${m.registration_id} · ${m.phone}`, icon: "user" as const }));
    if (value && currentName && !list.some((o) => o.value === value)) {
      list.unshift({ value, label: currentName, hint: "Other branch", icon: "user" as const });
    }
    return [{ label: "Members", options: list }];
  }, [members.data, excludeId, value, currentName]);

  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <RichSelect id={id} value={value} groups={groups} searchable onChange={onChange}
          placeholder={members.isLoading ? "Loading members…" : placeholder} />
      </div>
      {value && (
        <button type="button" onClick={() => onChange("")}
          className="cursor-pointer border-0 bg-transparent text-xs font-semibold text-muted hover:text-danger">
          Clear
        </button>
      )}
    </div>
  );
}
