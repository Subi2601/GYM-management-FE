import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { confirm } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { Section } from "@/components/ui/Section";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { staffApi, staffKeys } from "@/features/staff/api";
import { StaffLoginModal } from "@/features/staff/components/StaffLoginModal";
import { formatDateTime } from "@/lib/format";
import { notify } from "@/lib/notify";
import { useBranchStore } from "@/stores/branch-store";
import type { Employee } from "@/types/employee";

/** Staff details side card: the employee's app login — give one, reset the password, change access, disable. */
export function StaffLoginCard({ employee, writable }: { employee: Employee; writable: boolean }) {
  const qc = useQueryClient();
  const branch = useBranchStore((s) => s.selectedBranchId);
  const [open, setOpen] = useState(false);
  const login = useQuery({
    queryKey: staffKeys.login(branch, employee.id),
    queryFn: async () => (await staffApi.login(employee.id)).data,
  });

  const disable = useMutation({
    mutationFn: () => staffApi.disableLogin(employee.id),
    onSuccess: async (res) => {
      notify.success(res.message);
      await qc.invalidateQueries({ queryKey: staffKeys.all });
    },
    onError: notify.error,
  });

  const l = login.data;
  const status = !l ? null : !l.has_login ? <StatusBadge value="NONE" tone="grey" label="No login" />
    : l.enabled ? <StatusBadge value="ACTIVE" label="Active" /> : <StatusBadge value="INACTIVE" label="Disabled" />;
  const roleLabel = l?.role_name ?? "—";

  return (
    <Section title="App login" aside={status}>
      {login.isLoading && <p className="m-0 text-sm text-muted">Loading…</p>}
      {l && (
        <>
          {l.has_login ? (
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
              <dt className="font-semibold text-muted">Login ID</dt><dd className="m-0 truncate font-semibold text-ink">{l.email}</dd>
              <dt className="font-semibold text-muted">Access</dt><dd className="m-0 text-ink">{roleLabel} · {l.branch_name}</dd>
              <dt className="font-semibold text-muted">Last sign-in</dt>
              <dd className="m-0 text-ink">{l.last_login_at ? formatDateTime(l.last_login_at) : "Never"}</dd>
            </dl>
          ) : (
            <p className="m-0 text-[13px] text-muted">
              {employee.name} can't sign in yet. Give a login to let them use the app for {l.branch_name}.
            </p>
          )}
          {writable && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" className="h-9 px-3.5 py-0 text-[13px]" icon={<Icon name="key" className="h-4 w-4" />}
                onClick={() => setOpen(true)}>
                {!l.has_login ? "Give login" : l.enabled ? "Reset password" : "Enable login"}
              </Button>
              {l.has_login && l.enabled && (
                <Button variant="danger" className="h-9 px-3.5 py-0 text-[13px]" loading={disable.isPending}
                  onClick={async () => {
                    if (await confirm(`Disable ${employee.name}'s login? They'll be signed out right away.`)) disable.mutate();
                  }}>
                  Disable
                </Button>
              )}
            </div>
          )}
        </>
      )}
      {open && l && <StaffLoginModal employee={employee} login={l} onClose={() => setOpen(false)} />}
    </Section>
  );
}
