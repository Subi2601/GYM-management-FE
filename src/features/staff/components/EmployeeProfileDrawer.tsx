import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { FilterTabs } from "@/components/ui/ListToolbar";
import { Drawer } from "@/components/ui/Modal";
import { GRID_2, InfoRow, Section } from "@/components/ui/Section";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { staffApi, staffKeys } from "@/features/staff/api";
import { AddFeedbackModal } from "@/features/staff/components/AddFeedbackModal";
import { AssignPTModal } from "@/features/staff/components/AssignPTModal";
import { FeedbackCard, PTClientCard } from "@/features/staff/components/ProfileCards";
import { AverageRating } from "@/features/staff/components/StarRating";
import { formatDate, formatINR } from "@/lib/format";
import { humanize } from "@/lib/utils";
import { useCan } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import type { Employee } from "@/types/employee";

type Tab = "info" | "pt" | "feedback";

interface Props {
  /** Row the profile was opened from (header shows instantly); details come from /profile. */
  employee: Employee;
  onClose: () => void;
  onTerminate: (employee: Employee) => void;
}

/** Employee profile slide-over — tabs Details / Personal training / Feedback, edit + terminate in the footer. */
export function EmployeeProfileDrawer({ employee, onClose, onTerminate }: Props) {
  const navigate = useNavigate();
  const branch = useBranchStore((s) => s.selectedBranchId);
  const canUpdate = useCan("employee:update");
  const canTerminate = useCan("employee:terminate");
  const canAssignPT = useCan("pt:create");
  const canFeedback = useCan("feedback:create");
  const [tab, setTab] = useState<Tab>("info");
  const [assignOpen, setAssignOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const profile = useQuery({
    queryKey: staffKeys.profile(branch, employee.id),
    queryFn: () => staffApi.profile(employee.id),
  });

  const data = profile.data?.data;
  const emp = data?.employee ?? employee;
  const active = emp.status !== "TERMINATED";
  const writable = branch !== null && active;

  return (
    <>
      <Drawer
        open
        width="640px"
        title={emp.name}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            {emp.employee_code} · {humanize(emp.role)} <StatusBadge value={emp.status} />
          </span>
        }
        onClose={onClose}
        footer={
          <>
            {canTerminate && writable && (
              <Button variant="danger" className="sm:mr-auto" onClick={() => onTerminate(emp)}>Terminate</Button>
            )}
            <Button variant="secondary" onClick={onClose}>Close</Button>
            {canUpdate && writable && (
              <Button icon={<Icon name="edit" className="h-4 w-4" />} onClick={() => navigate(`/staff/${emp.id}/edit`)}>
                Edit employee
              </Button>
            )}
          </>
        }
      >
        <div className="-mx-6 -mt-5 mb-5">
          <FilterTabs<Tab> value={tab} onChange={setTab}
            tabs={[
              { value: "info", label: "Details" },
              { value: "pt", label: "Personal training", count: data?.pt_clients.length },
              { value: "feedback", label: "Feedback", count: data?.feedbacks.length },
            ]} />
        </div>

        {tab === "info" && (
          <div className="flex flex-col gap-4">
            <Section title="Contact">
              <div className={GRID_2}>
                <InfoRow label="Phone" value={emp.phone} />
                <InfoRow label="Email" value={emp.email} />
                <InfoRow label="Address" value={emp.address} className="md:col-span-2" />
              </div>
            </Section>
            <Section title="Employment">
              <div className={GRID_2}>
                <InfoRow label="Role" value={humanize(emp.role)} />
                <InfoRow label="Base salary" value={formatINR(emp.base_salary)} />
                <InfoRow label="Joined" value={formatDate(emp.date_of_joining)} />
                {emp.date_of_termination && <InfoRow label="Terminated" value={formatDate(emp.date_of_termination)} />}
                <InfoRow label="Education" value={emp.education} />
                <InfoRow label="Experience" value={emp.experience} />
              </div>
            </Section>
            <Section title="Emergency contact">
              <div className={GRID_2}>
                <InfoRow label="Name"
                  value={emp.emergency_contact_name
                    ? `${emp.emergency_contact_name}${emp.emergency_contact_relation ? ` (${emp.emergency_contact_relation})` : ""}`
                    : null} />
                <InfoRow label="Phone" value={emp.emergency_contact_phone} />
              </div>
            </Section>
            <Section title="Identity & bank">
              <div className={GRID_2}>
                <InfoRow label="Aadhar" value={emp.aadhar_number} />
                <InfoRow label="PAN" value={emp.pan_number} />
                <InfoRow label="ID proof" value={emp.id_proof_type
                  ? `${emp.id_proof_type} · ${emp.id_proof_number ?? "—"}` : null} />
                <InfoRow label="Bank" value={emp.bank_name} />
                <InfoRow label="Account number" value={emp.bank_account_number} />
                <InfoRow label="IFSC" value={emp.ifsc_code} />
              </div>
            </Section>
          </div>
        )}

        {tab !== "info" && profile.isLoading && <Empty>Loading profile…</Empty>}

        {tab === "pt" && data && (
          <>
            <TabBar>
              <span className="text-sm font-bold text-secondary-grey">{data.pt_clients.length} PT client(s)</span>
              {/* Backend only accepts an ACTIVE employee with role TRAINER as PT trainer. */}
              {canAssignPT && writable && emp.role === "TRAINER" && emp.status === "ACTIVE" && (
                <Button icon={<Icon name="plus" className="h-4 w-4" />} onClick={() => setAssignOpen(true)}>
                  Assign member
                </Button>
              )}
            </TabBar>
            {data.pt_clients.length === 0 ? <Empty>No PT members assigned.</Empty> : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {data.pt_clients.map((pt) => <PTClientCard key={pt.id} pt={pt} />)}
              </div>
            )}
          </>
        )}

        {tab === "feedback" && data && (
          <>
            <TabBar>
              <AverageRating value={data.average_rating} />
              {canFeedback && branch !== null && (
                <Button icon={<Icon name="plus" className="h-4 w-4" />} onClick={() => setFeedbackOpen(true)}>
                  Add feedback
                </Button>
              )}
            </TabBar>
            {data.feedbacks.length === 0 ? <Empty>No feedback available yet.</Empty> : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {data.feedbacks.map((fb) => <FeedbackCard key={fb.id} fb={fb} />)}
              </div>
            )}
          </>
        )}
      </Drawer>

      <AssignPTModal open={assignOpen} trainerId={employee.id} trainerName={emp.name} onClose={() => setAssignOpen(false)} />
      <AddFeedbackModal open={feedbackOpen} employeeId={employee.id} employeeName={emp.name}
        onClose={() => setFeedbackOpen(false)} />
    </>
  );
}

function TabBar({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-line-light bg-subtle px-4 py-3">
      {children}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="m-0 rounded-xl border-2 border-dashed border-line bg-subtle p-6 text-center text-sm text-muted">{children}</p>;
}
