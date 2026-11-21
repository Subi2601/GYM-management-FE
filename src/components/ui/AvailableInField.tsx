import { Field, Select } from "@/components/ui/Field";
import { useAuthStore } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";

export type AvailableIn = "branch" | "all";

/** Default for a new plan / offer: common for all-branch roles (always while "All Branches" is selected). */
export function defaultAvailableIn(canCommon: boolean, branchSelected: boolean): AvailableIn {
  return canCommon || !branchSelected ? "all" : "branch";
}

/**
 * "Available in" for masters a gym can share (plans, offers): the selected branch only, or every branch (common).
 * Render only for all-branch roles; "This branch" needs a branch selected in the sidebar.
 */
export function AvailableInField({ id, value, onChange, what, hint }: {
  id: string; value: AvailableIn; onChange: (v: AvailableIn) => void; what: string; hint?: string;
}) {
  const branchId = useBranchStore((s) => s.selectedBranchId);
  const branchName = useAuthStore((s) => s.me?.branches.find((b) => b.id === branchId)?.branch_name);
  return (
    <Field label="Available in" htmlFor={id} required
      hint={value === "all"
        ? `Common ${what}: every branch sees and uses it, now and future branches. Only all-branch roles can change it`
        : hint ?? `Only ${branchName ?? "the selected branch"} sees this ${what}`}>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value as AvailableIn)}>
        <option value="all">All branches (common)</option>
        <option value="branch" disabled={!branchId}>
          {branchId ? `Only ${branchName ?? "this branch"}` : "One branch (select it in the sidebar first)"}
        </option>
      </Select>
    </Field>
  );
}
