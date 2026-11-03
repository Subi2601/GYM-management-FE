import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { RichSelect, type RichOptionGroup } from "@/components/ui/RichSelect";
import { attendanceApi, attendanceKeys } from "@/features/attendance/api";
import { useMemberLookup } from "@/features/lookups/api";
import { formatDate } from "@/lib/format";
import { notify } from "@/lib/notify";

const FORM_ID = "member-check-in-form";

/** Front-desk check-in for a member without a phone / QR (POST /attendance/members/check-in). */
export function MemberCheckInModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const members = useMemberLookup();
  const [memberId, setMemberId] = useState("");
  const [error, setError] = useState<string>();

  const groups = useMemo<RichOptionGroup<string>[]>(() => {
    const all = members.data ?? [];
    const withPlan = all.filter((m) => m.membership_state === "ACTIVE" || m.membership_state === "EXPIRING");
    const without = all.filter((m) => !withPlan.includes(m));
    const option = (m: (typeof all)[number]) => ({
      value: m.id, label: m.name, icon: "user" as const,
      hint: `${m.registration_id} · ${m.phone}${m.expiry_date ? ` · till ${formatDate(m.expiry_date)}` : ""}`,
    });
    return [
      { label: "Active membership", options: withPlan.map(option) },
      { label: "Expired / no plan (check-in will be refused)", options: without.map(option) },
    ].filter((g) => g.options.length > 0);
  }, [members.data]);

  const checkIn = useMutation({
    mutationFn: (id: string) => attendanceApi.memberCheckIn(id),
    onSuccess: async (res) => {
      notify.success(res.message);
      await qc.invalidateQueries({ queryKey: attendanceKeys.all });
      onClose();
    },
    onError: notify.error,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId) {
      setError("Select a member");
      return;
    }
    checkIn.mutate(memberId);
  };

  return (
    <Modal
      open
      title="Manual check-in"
      subtitle="For a member checking in at the front desk instead of scanning the QR"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form={FORM_ID} loading={checkIn.isPending}>Check in</Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit} noValidate>
        <Field label="Member" htmlFor="check-in-member" required error={error}>
          <RichSelect id="check-in-member" value={memberId} groups={groups} searchable invalid={!!error}
            placeholder={members.isLoading ? "Loading members…" : "Search name, ID or phone"}
            onChange={(v) => {
              setMemberId(v);
              setError(undefined);
            }} />
        </Field>
      </form>
    </Modal>
  );
}
