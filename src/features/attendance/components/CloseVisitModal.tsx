import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { attendanceApi, attendanceKeys, formatClock } from "@/features/attendance/api";
import { formatDate } from "@/lib/format";
import { notify } from "@/lib/notify";
import type { MemberVisit } from "@/types/attendance";

const FORM_ID = "close-visit-form";

/** Check out a visit someone forgot to close (a past day): the front desk enters the time they left. */
export function CloseVisitModal({ visit, onClose }: { visit: MemberVisit; onClose: () => void }) {
  const qc = useQueryClient();
  const [time, setTime] = useState("");
  const [error, setError] = useState<string>();
  const checkIn = visit.check_in_time.slice(0, 5);

  const close = useMutation({
    mutationFn: () => attendanceApi.closeVisit(visit.id, time),
    onSuccess: async (res) => {
      notify.success(res.message);
      await qc.invalidateQueries({ queryKey: attendanceKeys.all });
      onClose();
    },
    onError: notify.error,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!time) return setError("Enter the check-out time");
    if (time <= checkIn) return setError(`Must be after the check-in at ${formatClock(checkIn)}`);
    close.mutate();
  };

  return (
    <Modal
      open
      title="Check out visit"
      subtitle={`${visit.member_name} · ${formatDate(visit.session_date)} · in at ${formatClock(visit.check_in_time)}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form={FORM_ID} loading={close.isPending}>Check out</Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit} noValidate>
        <Field label="Check-out time" htmlFor="close-visit-time" required error={error}>
          <Input id="close-visit-time" type="time" value={time} min={checkIn} invalid={!!error}
            onChange={(e) => {
              setTime(e.target.value);
              setError(undefined);
            }} />
        </Field>
      </form>
    </Modal>
  );
}
