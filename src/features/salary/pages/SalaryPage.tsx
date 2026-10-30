import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { ActionGroup, ActionIcon, DataTable } from "@/components/ui/DataTable";
import { Field, Input, Select } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { salaryApi, salaryKeys, type SalaryMonthQuery } from "@/features/salary/api";
import { staffApi, staffKeys } from "@/features/staff/api";
import { FeedbackCard, PTClientCard } from "@/features/staff/components/EmployeeProfileModal";
import { AverageRating } from "@/features/staff/components/StarRating";
import { formatDate, formatINR, MONTHS, todayISO } from "@/lib/format";
import { notify } from "@/lib/notify";
import { cn, humanize } from "@/lib/utils";
import { useCan } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import { PAYMENT_MODES } from "@/types/enums";
import type { Salary, SalaryCalculateResult } from "@/types/salary";

const PAYMENT_LABELS: Record<(typeof PAYMENT_MODES)[number], string> = {
  CASH: "Cash", UPI: "UPI / GPay", CARD: "Card", BANK_TRANSFER: "Bank Transfer",
};

const filterCls = "h-[42px] rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium text-ink outline-none focus:border-secondary-grey";

/** "dd MMM" chip label for an ISO date. */
function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

/** Salary Management — month/year payroll, Calculate All, pay, details. */
export function SalaryPage() {
  const qc = useQueryClient();
  const branch = useBranchStore((s) => s.selectedBranchId);
  const canCalculate = useCan("salary:calculate");
  const canPay = useCan("salary:pay");
  const canListStaff = useCan("employee:list");
  const writable = branch !== null;

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const years = [now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear()];
  const [calcResult, setCalcResult] = useState<SalaryCalculateResult | null>(null);
  const [paying, setPaying] = useState<Salary | null>(null);
  const [details, setDetails] = useState<Salary | null>(null);

  const q: SalaryMonthQuery = { month, year };
  useEffect(() => setCalcResult(null), [month, year, branch]);

  const salaries = useQuery({
    queryKey: salaryKeys.month(branch, q),
    queryFn: () => salaryApi.month(q),
  });

  // "Total Employees" card — active headcount (total of a 1-row page).
  const activeQuery = { status: "active" as const, page: 1, page_size: 1 };
  const activeStaff = useQuery({
    queryKey: staffKeys.list(branch, activeQuery),
    queryFn: () => staffApi.list(activeQuery),
    enabled: canListStaff,
  });

  const calculate = useMutation({
    mutationFn: () => salaryApi.calculate({ month, year }),
    onSuccess: async (res) => {
      notify.success(res.message);
      setCalcResult(res.data);
      await qc.invalidateQueries({ queryKey: salaryKeys.all });
    },
    onError: notify.error,
  });

  const data = salaries.data?.data;
  const items = data?.items ?? [];

  const columns: ColumnDef<Salary, unknown>[] = [
    {
      header: "Employee", accessorKey: "employee_name",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-semibold">{row.original.employee_name}</span>
          <span className="text-xs text-muted">{row.original.employee_code}</span>
        </div>
      ),
    },
    { header: "Role", accessorKey: "employee_role", meta: { width: "130px" }, cell: ({ row }) => humanize(row.original.employee_role) },
    { header: "Base", accessorKey: "base_salary", meta: { width: "120px", align: "right" }, cell: ({ row }) => formatINR(row.original.base_salary) },
    { header: "Present", accessorKey: "days_present", meta: { width: "100px", align: "center" } },
    { header: "Till Now", accessorKey: "till_now_salary", meta: { width: "130px", align: "right" }, cell: ({ row }) => formatINR(row.original.till_now_salary) },
    {
      header: "Net Payable", accessorKey: "net_salary", meta: { width: "140px", align: "right" },
      cell: ({ row }) => <span className="font-bold">{formatINR(row.original.net_salary)}</span>,
    },
    { header: "Status", accessorKey: "status", meta: { width: "110px" }, cell: ({ row }) => <StatusBadge value={row.original.status} /> },
    {
      id: "actions", header: "Actions", meta: { width: "150px" },
      cell: ({ row }) => {
        const s = row.original;
        return (
          <ActionGroup>
            <ActionIcon kind="view" title="View Details" onClick={() => setDetails(s)} />
            {s.status === "PENDING" && canPay && writable && (
              <button type="button" onClick={() => setPaying(s)}
                className="h-9 rounded-md border-none bg-info px-3 text-xs font-semibold text-white transition-colors hover:bg-info">
                Pay
              </button>
            )}
          </ActionGroup>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Salary Management"
        actions={
          <>
            <div className="mr-1 flex gap-3">
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={filterCls} aria-label="Month">
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={filterCls} aria-label="Year">
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            {canCalculate && writable && (
              <Button loading={calculate.isPending} icon={<Icon name="refresh" className="h-4 w-4" />}
                onClick={() => calculate.mutate()}>
                Calculate All
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <SummaryCard label="Total Employees" value={canListStaff ? String(activeStaff.data?.data.total ?? "—") : "—"} />
        <SummaryCard label="Calculated This Month" value={String(items.length)} />
        <SummaryCard label="Total Net Payout" value={formatINR(data?.total_payout ?? 0)} highlight />
      </div>

      {calcResult && (
        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-info-line bg-info-soft px-5 py-3 text-sm font-semibold text-info">
          <span>Payroll {calcResult.month_year}:</span>
          <span className="rounded-md bg-success-soft px-2 py-0.5 text-success">{calcResult.calculated} calculated</span>
          <span className="rounded-md bg-hover px-2 py-0.5 text-secondary-grey">{calcResult.skipped_paid} skipped (already paid)</span>
          <button type="button" onClick={() => setCalcResult(null)} className="ml-auto text-muted hover:text-ink" aria-label="Dismiss">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="mt-6">
        <DataTable
          columns={columns}
          data={items}
          loading={salaries.isLoading}
          emptyMessage="No salary records for this period. Click Calculate All to generate."
          getRowId={(s) => s.id}
          maxHeightClass="max-h-[calc(100vh-400px)]"
        />
      </div>

      <PayModal salary={paying} onClose={() => setPaying(null)} />
      <DetailsModal salary={details} onClose={() => setDetails(null)} />
    </div>
  );
}

function SummaryCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn("flex flex-col rounded-xl border p-5 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)]",
      highlight ? "border-info-line bg-info-soft" : "border-line bg-surface")}>
      <span className="mb-2 text-sm text-muted">{label}</span>
      <span className={cn("text-2xl font-bold", highlight ? "text-info" : "text-ink")}>{value}</span>
    </div>
  );
}

const paySchema = z.object({
  payment_method: z.enum(PAYMENT_MODES),
  paid_date: z.string().min(1, "Required"),
});
type PayValues = z.infer<typeof paySchema>;

function PayModal({ salary, onClose }: { salary: Salary | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<PayValues>({
    resolver: zodResolver(paySchema),
    defaultValues: { payment_method: "CASH", paid_date: todayISO() },
  });

  useEffect(() => {
    if (salary) reset({ payment_method: "CASH", paid_date: todayISO() });
  }, [salary, reset]);

  const pay = useMutation({
    mutationFn: (v: PayValues) => salaryApi.pay(salary?.id ?? "", v),
    onSuccess: async (res) => {
      notify.success(res.message);
      await qc.invalidateQueries({ queryKey: salaryKeys.all });
      onClose();
    },
    onError: notify.error,
  });

  return (
    <Modal open={!!salary} title={`Record Payment: ${salary?.employee_name ?? ""}`} onClose={onClose} width="560px">
      {salary && (
        <form onSubmit={handleSubmit((v) => pay.mutate(v))} noValidate className="p-2">
          <div className="mb-3 flex justify-between text-base">
            <span>Net Salary:</span>
            <span className="font-bold text-success">{formatINR(salary.net_salary)}</span>
          </div>
          <div className="mb-3 flex justify-between text-base">
            <span>Month:</span>
            <span>{salary.month_year}</span>
          </div>
          <div className="mt-4 flex flex-col gap-4">
            <Field label="Payment Method" htmlFor="pay-method" required error={errors.payment_method?.message}>
              <Select id="pay-method" {...register("payment_method")}>
                {PAYMENT_MODES.map((m) => <option key={m} value={m}>{PAYMENT_LABELS[m]}</option>)}
              </Select>
            </Field>
            <Field label="Paid Date" htmlFor="pay-date" required error={errors.paid_date?.message}>
              <Input id="pay-date" type="date" invalid={!!errors.paid_date} {...register("paid_date")} />
            </Field>
          </div>
          <div className="form-actions-modern mt-6">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={pay.isPending}>Confirm Payment</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function DetailsModal({ salary, onClose }: { salary: Salary | null; onClose: () => void }) {
  const branch = useBranchStore((s) => s.selectedBranchId);
  const canListStaff = useCan("employee:list");
  const employeeId = salary?.employee_id ?? "";
  const profile = useQuery({
    queryKey: staffKeys.profile(branch, employeeId),
    queryFn: () => staffApi.profile(employeeId),
    enabled: !!salary && canListStaff,
  });
  const p = profile.data?.data;

  return (
    <Modal open={!!salary} title={`Employee Detail: ${salary?.employee_name ?? ""}`} onClose={onClose}>
      {salary && (
        <div className="p-2">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Section title="Attendance Summary">
              <div className="flex flex-col">
                <Row label="Total Base Salary"><span className="font-semibold text-ink">{formatINR(salary.base_salary)}</span></Row>
                <Row label="Days Present"><Pill tone="success">{salary.days_present} Days</Pill></Row>
                <Row label="Days Absent"><Pill tone="danger">{salary.days_absent} Days</Pill></Row>
                <Row label="Days Late"><span className="font-semibold text-ink">{salary.days_late}</span></Row>
                <Row label="Deductions"><span className="font-semibold text-danger">− {formatINR(salary.deductions)}</span></Row>
                {salary.bonus > 0 && <Row label="Bonus"><span className="font-semibold text-success">+ {formatINR(salary.bonus)}</span></Row>}
                <Row label="Net Payable"><span className="font-bold text-ink">{formatINR(salary.net_salary)}</span></Row>
              </div>
              <div className="mt-4 flex flex-col items-center gap-1 rounded-[10px] border border-info-line bg-info-soft p-4">
                <span className="text-xs font-bold uppercase text-info">Earned Till Now</span>
                <span className="text-2xl font-extrabold text-info">{formatINR(salary.till_now_salary)}</span>
              </div>
              {salary.absent_dates.length > 0 && (
                <div className="mt-4">
                  <span className="mb-2 block text-xs font-bold uppercase text-muted">Absent on:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {salary.absent_dates.map((d) => (
                      <span key={d} className="rounded bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger">{shortDate(d)}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-4 flex items-center justify-between text-sm">
                <StatusBadge value={salary.status} />
                {salary.status === "PAID" && (
                  <span className="text-muted">
                    {formatDate(salary.paid_date)} · {salary.payment_method ? humanize(salary.payment_method) : "—"}
                  </span>
                )}
              </div>
            </Section>

            <Section title="Employee Info">
              {!canListStaff && <p className="my-4 text-center text-sm text-muted">Not available.</p>}
              {canListStaff && profile.isLoading && <p className="my-4 text-center text-sm text-muted">Loading…</p>}
              {p && (
                <div className="flex flex-col">
                  <Row label="Code">{p.employee.employee_code}</Row>
                  <Row label="Role">{humanize(p.employee.role)}</Row>
                  <Row label="Phone">{p.employee.phone}</Row>
                  <Row label="Joined">{formatDate(p.employee.date_of_joining)}</Row>
                  <Row label="Bank">{p.employee.bank_name ?? "—"}</Row>
                  <Row label="Account">{p.employee.bank_account_number ?? "—"}</Row>
                  <Row label="IFSC">{p.employee.ifsc_code ?? "—"}</Row>
                  <Row label="PAN">{p.employee.pan_number ?? "—"}</Row>
                </div>
              )}
            </Section>

            {p && (
              <Section title="Personal Training (PT)" className="md:col-span-2">
                {p.pt_clients.length > 0 ? (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-2.5">
                    {p.pt_clients.map((pt) => <PTClientCard key={pt.id} pt={pt} />)}
                  </div>
                ) : <p className="my-4 text-center text-sm text-muted">No PT members assigned.</p>}
              </Section>
            )}

            {p && (
              <Section title="Client Feedback & Rating" className="md:col-span-2">
                {p.average_rating != null && (
                  <div className="mb-4 flex items-center gap-2">
                    <AverageRating value={p.average_rating} />
                    <span className="text-sm text-muted">({p.feedbacks.length} reviews)</span>
                  </div>
                )}
                {p.feedbacks.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {p.feedbacks.map((fb) => <FeedbackCard key={fb.id} fb={fb} />)}
                  </div>
                ) : <p className="my-4 text-center text-sm text-muted">No feedback yet.</p>}
              </Section>
            )}
          </div>

          <div className="mt-6 flex justify-end">
            <Button variant="secondary" onClick={onClose}>Close</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Section({ title, className, children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-xl border border-line-light bg-subtle p-4", className)}>
      <h3 className="mb-4 mt-0 border-b border-line pb-2 text-base font-bold text-ink">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-dashed border-line py-2 text-sm last:border-b-0">
      <span className="text-muted">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

function Pill({ tone, children }: { tone: "success" | "danger"; children: ReactNode }) {
  return (
    <span className={cn("rounded-md px-2.5 py-1 text-[13px] font-bold",
      tone === "success" ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
      {children}
    </span>
  );
}
