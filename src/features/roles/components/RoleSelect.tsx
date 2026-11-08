import { Select } from "@/components/ui/Field";
import { useAssignableRoles } from "@/features/roles/api";

interface Props {
  id: string;
  value: string;
  onChange: (roleId: string) => void;
  disabled?: boolean;
  /** Name of the login's current role, shown even when it isn't one the user may give (e.g. their own level). */
  currentName?: string | null;
}

/** Access a staff login gets: the gym's roles below the signed-in user's own level (Roles & Access). */
export function RoleSelect({ id, value, onChange, disabled, currentName }: Props) {
  const roles = useAssignableRoles();
  const known = (roles.data ?? []).some((r) => r.id === value);
  return (
    <Select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      {!value && <option value="">{roles.isLoading ? "Loading roles…" : "Choose access"}</option>}
      {value && !known && !roles.isLoading && <option value={value}>{currentName ?? "Current role"}</option>}
      {(roles.data ?? []).map((r) => (
        <option key={r.id} value={r.id}>{r.name} · {r.all_branches ? "all branches" : "this branch"}</option>
      ))}
    </Select>
  );
}
