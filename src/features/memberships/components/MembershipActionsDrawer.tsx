import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { FilterTabs } from "@/components/ui/ListToolbar";
import { Drawer } from "@/components/ui/Modal";
import { useMembershipActions } from "@/features/memberships/api";
import { CANCEL_FORM, CancelTab } from "@/features/memberships/components/CancelTab";
import { FREEZE_FORM, FreezeTab } from "@/features/memberships/components/FreezeTab";
import { TRANSFER_FORM, TransferTab } from "@/features/memberships/components/TransferTab";
import { formatDate } from "@/lib/format";

export type MembershipAction = "freeze" | "transfer" | "cancel";
const TABS: { value: MembershipAction; label: string }[] = [
  { value: "freeze", label: "Freeze" }, { value: "transfer", label: "Transfer" }, { value: "cancel", label: "Cancel / Refund" },
];

/**
 * Manager-level membership actions on the plan running today: freeze, transfer to someone else, cancel (with a
 * refund when the plan allows). Each needs a reason; a proof file is optional. A frozen member can still be
 * transferred or cancelled.
 */
export function MembershipActionsDrawer({ member, initial = "freeze", onClose }: {
  member: { id: string; name: string }; initial?: MembershipAction; onClose: () => void;
}) {
  const [tab, setTab] = useState<MembershipAction>(initial);
  const [busy, setBusy] = useState(false);
  const info = useMembershipActions(member.id);
  const data = info.data;
  const ready = !!data?.current;
  const canSubmit = ready && (tab === "freeze" ? data!.freeze!.allowed : tab === "transfer" ? data!.transfer!.allowed : true);
  const formId = tab === "freeze" ? FREEZE_FORM : tab === "transfer" ? TRANSFER_FORM : CANCEL_FORM;
  const label = tab === "freeze" ? "Freeze" : tab === "transfer" ? "Transfer" : "Cancel membership";

  return (
    <Drawer open title="Manage membership" width="600px" onClose={onClose}
      subtitle={data?.current ? `${member.name} · ${data.current.plan_name} · ${formatDate(data.current.start_date)} → ${formatDate(data.current.end_date)}`
        : member.name}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {canSubmit && (
            <Button type="submit" form={formId} loading={busy} className={tab === "cancel" ? "!bg-danger !bg-none" : undefined}>
              {label}
            </Button>
          )}
        </>
      }>
      {info.isLoading ? <p className="m-0 text-sm text-muted">Loading…</p>
        : info.isError ? <p className="m-0 text-sm text-danger">{info.error.message}</p>
          : !ready ? <p className="m-0 text-sm text-muted">{data?.reason}</p>
            : (
              <div className="flex flex-col gap-4">
                {data!.current!.received_by_transfer && (
                  <p className="m-0 text-xs text-muted">This membership was received by transfer.</p>
                )}
                <FilterTabs tabs={TABS} value={tab} onChange={setTab} />
                {tab === "freeze" && <FreezeTab info={data!} onSubmitting={setBusy} />}
                {tab === "transfer" && <TransferTab info={data!} memberId={member.id} onDone={onClose} onSubmitting={setBusy} />}
                {tab === "cancel" && <CancelTab info={data!} onDone={onClose} onSubmitting={setBusy} />}
              </div>
            )}
    </Drawer>
  );
}
