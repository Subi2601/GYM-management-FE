import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { staffApi, staffKeys } from "@/features/staff/api";
import { AddFeedbackModal } from "@/features/staff/components/AddFeedbackModal";
import { AssignPTModal } from "@/features/staff/components/AssignPTModal";
import { AverageRating, StarRating } from "@/features/staff/components/StarRating";
import { formatDate, formatINR } from "@/lib/format";
import { cn, humanize } from "@/lib/utils";
import { useCan } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import type { Employee, Feedback, PTClient } from "@/types/employee";

type Tab = "info" | "pt" | "feedback";

interface Props {
  /** Row the profile was opened from (title shows instantly); details come from /profile. */
  employee: Employee | null;
  onClose: () => void;
  onTerminate: (employee: Employee) => void;
}

/** "Employee Profile: …" — tabs Details / Personal Training / Feedback. */
export function EmployeeProfileModal({ employee, onClose, onTerminate }: Props) {
  const branch = useBranchStore((s) => s.selectedBranchId);
  const canTerminate = useCan("employee:terminate");
  const canAssignPT = useCan("pt:create");
  const canFeedback = useCan("feedback:create");
  const [tab, setTab] = useState<Tab>("info");
  const [assignOpen, setAssignOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const id = employee?.id ?? "";
  useEffect(() => setTab("info"), [id]);

  const profile = useQuery({
    queryKey: staffKeys.profile(branch, id),
    queryFn: () => staffApi.profile(id),
    enabled: !!employee,
  });

  const data = profile.data?.data;
  const emp = data?.employee ?? employee;
  const active = emp !== null && emp.status !== "TERMINATED";
  const writable = branch !== null && active;

  return (
    <>
      <Modal open={!!employee} title={`Employee Profile: ${employee?.name ?? ""}`} onClose={onClose} width="900px">
        {emp && (
          <div className="py-2.5">
            <div className="mb-6 flex gap-5 border-b-2 border-hover">
              {([["info", "Details"], ["pt", "Personal Training"], ["feedback", "Feedback"]] as const).map(([key, label]) => (
                <button key={key} type="button" onClick={() => setTab(key)}
                  className={cn(
                    "relative -mb-0.5 border-b-2 border-transparent bg-transparent px-1 py-3 text-sm font-bold text-muted transition-all",
                    tab === key && "border-accent text-accent",
                  )}>
                  {label}
                </button>
              ))}
            </div>

            {profile.isLoading && <div className="p-6 text-center text-sm text-muted">Loading profile…</div>}

            {tab === "info" && (
              <div className="animate-fadeIn">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <InfoGroup title="Basic Info">
                    <InfoRow label="ID"><strong>{emp.employee_code}</strong></InfoRow>
                    <InfoRow label="Email">{emp.email ?? "—"}</InfoRow>
                    <InfoRow label="Phone">{emp.phone}</InfoRow>
                    <InfoRow label="Address">{emp.address ?? "—"}</InfoRow>
                    <InfoRow label="Status"><StatusBadge value={emp.status} /></InfoRow>
                  </InfoGroup>
                  <InfoGroup title="Professional">
                    <InfoRow label="Role">{humanize(emp.role)}</InfoRow>
                    <InfoRow label="Salary">{formatINR(emp.base_salary)}</InfoRow>
                    <InfoRow label="Joined">{formatDate(emp.date_of_joining)}</InfoRow>
                    {emp.date_of_termination && <InfoRow label="Terminated">{formatDate(emp.date_of_termination)}</InfoRow>}
                    <InfoRow label="Education">{emp.education || "—"}</InfoRow>
                    <InfoRow label="Exp">{emp.experience || "—"}</InfoRow>
                  </InfoGroup>
                  <InfoGroup title="Emergency & ID" className="md:col-span-2">
                    <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
                      <InfoRow label="Contact">
                        {emp.emergency_contact_name ?? "—"}
                        {emp.emergency_contact_relation ? ` (${emp.emergency_contact_relation})` : ""}
                      </InfoRow>
                      <InfoRow label="Contact Phone">{emp.emergency_contact_phone ?? "—"}</InfoRow>
                      <InfoRow label="Aadhar">{emp.aadhar_number ?? "—"}</InfoRow>
                      <InfoRow label="PAN">{emp.pan_number ?? "—"}</InfoRow>
                      <InfoRow label="ID Proof">{emp.id_proof_type ?? "—"} - {emp.id_proof_number ?? "—"}</InfoRow>
                      <InfoRow label="Bank">{emp.bank_name ?? "—"} - {emp.bank_account_number ?? "—"}</InfoRow>
                      <InfoRow label="IFSC">{emp.ifsc_code ?? "—"}</InfoRow>
                    </div>
                  </InfoGroup>
                </div>
                {canTerminate && writable && (
                  <div className="mt-6 flex justify-end">
                    <Button variant="danger" onClick={() => onTerminate(emp)}>Terminate Employee</Button>
                  </div>
                )}
              </div>
            )}

            {tab === "pt" && data && (
              <div className="animate-fadeIn">
                <ActionBar>
                  <span className="text-sm font-bold text-secondary-grey">{data.pt_clients.length} PT client(s)</span>
                  {/* Backend only accepts an ACTIVE employee with role TRAINER as PT trainer. */}
                  {canAssignPT && writable && emp.role === "TRAINER" && emp.status === "ACTIVE" && (
                    <Button onClick={() => setAssignOpen(true)}>Assign Member</Button>
                  )}
                </ActionBar>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4">
                  {data.pt_clients.map((pt) => <PTClientCard key={pt.id} pt={pt} />)}
                  {data.pt_clients.length === 0 && <Empty>No PT members assigned.</Empty>}
                </div>
              </div>
            )}

            {tab === "feedback" && data && (
              <div className="animate-fadeIn">
                <ActionBar>
                  <AverageRating value={data.average_rating} />
                  {canFeedback && branch !== null && <Button onClick={() => setFeedbackOpen(true)}>Add Feedback</Button>}
                </ActionBar>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {data.feedbacks.map((fb) => <FeedbackCard key={fb.id} fb={fb} />)}
                  {data.feedbacks.length === 0 && <Empty>No feedback available yet.</Empty>}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {employee && (
        <>
          <AssignPTModal open={assignOpen} trainerId={employee.id} onClose={() => setAssignOpen(false)} />
          <AddFeedbackModal open={feedbackOpen} employeeId={employee.id} onClose={() => setFeedbackOpen(false)} />
        </>
      )}
    </>
  );
}

function InfoGroup({ title, className, children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-xl border border-line-light bg-subtle p-5", className)}>
      <h4 className="mb-4 mt-0 text-xs font-bold uppercase tracking-[1px] text-accent">{title}</h4>
      {children}
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-3 flex justify-between gap-3 text-sm text-ink">
      <span className="shrink-0 text-muted">{label}:</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="mb-5 flex items-center justify-between rounded-[10px] border border-line-light bg-subtle px-4 py-3">
      {children}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="col-span-full p-6 text-center text-sm italic text-muted">{children}</div>;
}

/** Original `.pt-member-card`. */
export function PTClientCard({ pt }: { pt: PTClient }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-[15px] font-extrabold">{pt.member_name}</span>
        <span className={cn("rounded-md px-2 py-1 text-[10px] font-extrabold uppercase",
          pt.is_paid ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
          {pt.is_paid ? "Paid" : "Pending"}
        </span>
      </div>
      <div className="flex flex-col gap-1.5 text-[13px] text-muted">
        <div><span className="font-bold text-ink">Goal:</span> {pt.goal || "—"}</div>
        <div><span className="font-bold text-ink">Plan:</span> {pt.plan_name ?? "—"}</div>
        <div><span className="font-bold text-ink">Sessions:</span> {pt.sessions_remaining} / {pt.total_sessions} left</div>
        <div><span className="font-bold text-ink">Started:</span> {formatDate(pt.start_date)}</div>
        <div className="flex items-center justify-between">
          <span><span className="font-bold text-ink">Expires:</span> {formatDate(pt.expiry_date)}</span>
          <StatusBadge value={pt.status} />
        </div>
      </div>
    </div>
  );
}

/** Original `.feedback-card`. */
export function FeedbackCard({ fb }: { fb: Feedback }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="mb-2 flex justify-between">
        <strong className="text-sm">{fb.client_name}</strong>
        <span className="text-xs text-muted">{formatDate(fb.feedback_date)}</span>
      </div>
      <StarRating value={fb.rating} />
      {fb.comment && <p className="mb-0 mt-2 text-sm italic text-secondary-grey">&ldquo;{fb.comment}&rdquo;</p>}
    </div>
  );
}
