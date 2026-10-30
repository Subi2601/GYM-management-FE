import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { Icon, type IconName } from "@/components/ui/Icon";
import { GrowthChart } from "@/features/dashboard/components/GrowthChart";
import { useDashboardSummary } from "@/features/dashboard/api";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuthStore, useCan } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";

/** Dashboard: welcome hero, 4 KPI cards, quick navigation, 6-month growth chart (now real data). */
export function DashboardPage() {
  const me = useAuthStore((s) => s.me);
  const branchId = useBranchStore((s) => s.selectedBranchId);
  const summary = useDashboardSummary();
  const s = summary.data;

  const branchName = branchId ? me?.branches.find((b) => b.id === branchId)?.branch_name : undefined;
  const busy = summary.isFetching;

  return (
    <div className="animate-fadeIn">
      {/* Welcome hero */}
      <div className="relative flex items-center justify-between overflow-hidden rounded-3xl bg-[radial-gradient(120%_140%_at_85%_0%,#3a1414_0%,#1a1012_45%,#111113_75%)] px-12 py-14 text-white shadow-[0_18px_36px_-20px_rgba(0,0,0,0.45)] max-md:flex-col max-md:items-start max-md:px-6 max-md:py-10">
        <div className="relative z-[2]">
          <h1 className="m-0 mb-3 font-display text-[54px] font-normal leading-none tracking-[1.5px] text-white max-md:text-[40px]">
            Welcome to STAG{" "}
            <span className="text-gradient">FITNESS</span>
          </h1>
          <p className="m-0 mb-7 max-w-[500px] text-[17px] font-medium text-white/70">
            Hello, {me?.user.name || "Admin"}. Here&apos;s what&apos;s happening at your gym today.
          </p>
          <div className="flex flex-wrap gap-3">
            <HeroBadge pulse>System Online</HeroBadge>
            <HeroBadge>{branchName ?? "All Branches Active"}</HeroBadge>
          </div>
        </div>
        <div className="pointer-events-none absolute right-10 select-none font-display text-[150px] leading-[.8] tracking-[4px] text-white/[0.05] max-md:hidden" aria-hidden="true">
          STAG
        </div>
      </div>

      {/* Overview header */}
      <div className="mt-10 flex items-center justify-between gap-4">
        <h1 className="section-title">Overview</h1>
        <button type="button" onClick={() => summary.refetch()} disabled={busy}
          className="flex items-center gap-2 rounded-lg border-none bg-transparent px-3 py-2 text-sm font-bold text-muted transition-all hover:enabled:bg-hover hover:enabled:text-ink disabled:cursor-not-allowed disabled:opacity-50">
          <Icon name="refresh" strokeWidth={2.5} className={cn(busy && "animate-spin")} />
          Refresh Data
        </button>
      </div>

      {summary.isError && (
        <div className="mt-5 rounded-xl border border-accent/30 bg-accent-light px-5 py-4 text-sm font-semibold text-accent">
          Could not load dashboard data. {summary.error.message}
        </div>
      )}

      {/* KPI cards */}
      <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-6 max-md:grid-cols-1">
        <StatCard icon="users" label="Total Members" value={s?.total_members} trend="Lifetime Records" />
        <StatCard icon="trending" label="Active Members" value={s?.active_members} trend="Current Subscriptions"
          positive highlight="red" />
        <StatCard icon="money" label="Total Revenue" value={s ? formatINR(s.total_revenue, true) : undefined}
          trend="Cumulative Earnings" />
        <StatCard icon="clock" label="Today's Collection" value={s ? formatINR(s.today_revenue, true) : undefined}
          trend="Recorded Today" positive highlight="grey" />
      </div>

      <QuickNav expiring={s?.expiring_this_week} openLeads={s?.open_leads} />

      {/* Growth chart */}
      <div className="standard-card mt-10 rounded-3xl p-8">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-6 max-md:flex-col max-md:gap-4">
          <div className="flex flex-col items-start">
            <h2 className="m-0 mb-2 text-[22px] font-extrabold leading-[1.2] tracking-[-0.02em] text-ink">Growth Analysis</h2>
            <p className="m-0 mb-4 text-sm font-medium text-muted">
              Member registrations and revenue (Last 6 Months)
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2 text-[13px] font-bold text-secondary-grey">
              <span className="h-1 w-6 rounded-[10px] bg-grad" /> Registrations
            </span>
            <span className="flex items-center gap-2 text-[13px] font-bold text-secondary-grey">
              <span className="h-3 w-3 rounded-[3px] bg-line" /> Revenue
            </span>
          </div>
        </div>
        {s ? (
          <GrowthChart data={s.growth} />
        ) : (
          <div className="h-[280px] animate-shimmer rounded-xl bg-[linear-gradient(90deg,rgb(var(--hover))_0px,rgb(var(--line))_40px,rgb(var(--hover))_80px)] bg-[length:800px_100%]" />
        )}
      </div>
    </div>
  );
}

function HeroBadge({ pulse = false, children }: { pulse?: boolean; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-5 py-2 text-[13px] font-bold text-white backdrop-blur-[4px]">
      <span className="relative flex h-2 w-2">
        {pulse && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />}
        <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
      </span>
      {children}
    </div>
  );
}

interface StatCardProps {
  icon: IconName;
  label: string;
  value: ReactNode | undefined;
  trend: string;
  positive?: boolean;
  highlight?: "red" | "grey";
}

/** ".stat-card-standard" */
function StatCard({ icon, label, value, trend, positive = false, highlight }: StatCardProps) {
  return (
    <div className={cn(
      "group relative overflow-hidden rounded-[20px] border border-line bg-surface p-7",
      "bg-[linear-gradient(160deg,var(--card-tint),transparent_55%)] card-hover",
      highlight === "red" && "border-b-[3px] border-b-accent",
      highlight === "grey" && "border-b-[3px] border-b-secondary-grey",
    )}>
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-accent-light text-accent transition-all duration-[250ms] group-hover:bg-grad group-hover:text-white">
        <Icon name={icon} className="h-5 w-5" />
      </div>
      <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.1em] text-muted">{label}</div>
      <div className="mb-1 font-display text-[48px] font-normal leading-none tracking-[1px] text-ink max-md:text-[38px]">
        {value ?? <span className="inline-block h-10 w-24 animate-pulse rounded-lg bg-hover align-middle" />}
      </div>
      <div className={cn("flex items-center gap-1.5 text-[13px] font-bold", positive ? "text-success" : "text-secondary-grey")}>
        {trend}
      </div>
    </div>
  );
}

interface NavCard {
  key: string;
  icon: IconName;
  title: string;
  hint: string;
  to: string;
  count?: number;
  tone: "amber" | "red" | "grey";
}

const TONE: Record<NavCard["tone"], string> = {
  amber: "bg-warning-soft text-warning",
  red: "bg-accent-light text-accent",
  grey: "bg-hover text-secondary-grey",
};

/** Quick-navigation cards (".quick-nav-section"), each shown only when the user may open the target. */
function QuickNav({ expiring, openLeads }: { expiring: number | undefined; openLeads: number | undefined }) {
  const navigate = useNavigate();
  const can = {
    members: useCan("member:list"),
    addMember: useCan("member:create"),
    leads: useCan("lead:list"),
    payments: useCan("payment:list"),
  };
  const cards: (NavCard & { allowed: boolean })[] = [
    { key: "expiring", icon: "alert", title: "Expiring This Week", hint: "Memberships ending in 7 days",
      to: "/members?filter=expiring", count: expiring, tone: "amber", allowed: can.members },
    { key: "leads", icon: "userCheck", title: "Open Leads", hint: "New & follow-up enquiries",
      to: "/leads?filter=followup", count: openLeads, tone: "red", allowed: can.leads },
    { key: "add", icon: "plus", title: "Add Member", hint: "Register a new member",
      to: "/members?action=add", tone: "grey", allowed: can.addMember },
    { key: "accounts", icon: "money", title: "Accounts & Finance", hint: "Collections & receipts",
      to: "/payments", tone: "grey", allowed: can.payments },
  ];
  const visible = cards.filter((c) => c.allowed);
  if (visible.length === 0) return null;

  return (
    <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6 max-md:grid-cols-1">
      {visible.map((c) => (
        <button key={c.key} type="button" onClick={() => navigate(c.to)}
          className="group flex items-center gap-4 rounded-[20px] border border-line bg-surface px-6 py-5 text-left transition-all duration-300 hover:-translate-y-[3px] hover:border-accent hover:shadow-glow">
          <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px]", TONE[c.tone])}>
            <Icon name={c.icon} className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[15px] font-extrabold text-ink">{c.title}</span>
            <span className="text-xs font-semibold text-muted">{c.hint}</span>
          </span>
          {c.count !== undefined && (
            <span className="text-[26px] font-extrabold tracking-[-0.03em] text-ink">{c.count}</span>
          )}
          <Icon name="chevronRight" className="h-4 w-4 text-muted transition-transform group-hover:translate-x-1" />
        </button>
      ))}
    </div>
  );
}
