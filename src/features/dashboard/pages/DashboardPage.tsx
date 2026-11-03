import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { Icon, type IconName } from "@/components/ui/Icon";
import { StatCard } from "@/components/ui/StatCard";
import { GrowthChart } from "@/features/dashboard/components/GrowthChart";
import { useDashboardSummary } from "@/features/dashboard/api";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuthStore, useCan } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";

/** Dashboard: welcome hero, 4 KPI tiles (shared StatCard), quick navigation, 6-month growth chart (now real data). */
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
      <div className="hero-card relative flex items-center justify-between overflow-hidden rounded-3xl px-12 py-12 shadow-premium max-md:flex-col max-md:items-start max-md:px-6 max-md:py-9">
        <div className="relative z-[2]">
          <h1 className="m-0 mb-3 font-display text-[50px] font-bold uppercase leading-none tracking-[0.5px] max-md:text-[38px]">
            Welcome to Stag{" "}
            <span className="text-gradient">Fitness</span>
          </h1>
          <p className="hero-muted m-0 mb-7 max-w-[500px] text-base font-medium">
            Hello, {me?.user.name || "Admin"}. Here&apos;s what&apos;s happening at your gym today.
          </p>
          <div className="flex flex-wrap gap-3">
            <HeroBadge pulse>System online</HeroBadge>
            <HeroBadge>{branchName ?? "All branches active"}</HeroBadge>
          </div>
        </div>
        <div className="hero-watermark pointer-events-none absolute right-10 select-none font-display text-[150px] font-bold leading-[.8] tracking-[2px] max-md:hidden" aria-hidden="true">
          STAG
        </div>
      </div>

      {/* Overview header */}
      <div className="mt-10 flex items-center justify-between gap-4">
        <h1 className="section-title">Overview</h1>
        <button type="button" onClick={() => summary.refetch()} disabled={busy}
          className="flex items-center gap-2 rounded-lg border-none bg-transparent px-3 py-2 text-sm font-bold text-muted transition-all hover:enabled:bg-hover hover:enabled:text-ink disabled:cursor-not-allowed disabled:opacity-50">
          <Icon name="refresh" strokeWidth={2.5} className={cn(busy && "animate-spin")} />
          Refresh data
        </button>
      </div>

      {summary.isError && (
        <div className="mt-5 rounded-xl border border-accent/30 bg-accent-light px-5 py-4 text-sm font-semibold text-accent">
          Could not load dashboard data. {summary.error.message}
        </div>
      )}

      {/* KPI cards */}
      <div className={cn("mt-5 grid grid-cols-1 gap-5 transition-opacity sm:grid-cols-2 xl:grid-cols-4",
        summary.isLoading && "animate-pulse")}>
        <StatCard icon="users" tone="neutral" label="Total members" value={s?.total_members} hint="Lifetime records" />
        <StatCard icon="trending" tone="accent" label="Active members" value={s?.active_members}
          hint="Current subscriptions" className="border-b-[3px] border-b-accent" />
        <StatCard icon="money" tone="info" label="Total revenue" value={s ? formatINR(s.total_revenue, true) : undefined}
          hint="Cumulative earnings" />
        <StatCard icon="wallet" tone="success" label="Today's collection"
          value={s ? formatINR(s.today_revenue, true) : undefined} hint="Recorded today" />
      </div>

      <QuickNav expiring={s?.expiring_this_week} openLeads={s?.open_leads} />

      {/* Growth chart */}
      <div className="standard-card mt-10 rounded-3xl p-8">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-6 max-md:flex-col max-md:gap-4">
          <div className="flex flex-col items-start">
            <h2 className="m-0 mb-2 text-[22px] font-extrabold leading-[1.2] tracking-[-0.02em] text-ink">Growth analysis</h2>
            <p className="m-0 mb-4 text-sm font-medium text-muted">
              Member registrations and revenue (last 6 months)
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
    <div className="hero-chip flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-bold">
      <span className="relative flex h-2 w-2">
        {pulse && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />}
        <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
      </span>
      {children}
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
    { key: "expiring", icon: "alert", title: "Expiring this week", hint: "Memberships ending in 7 days",
      to: "/members?tab=expiring", count: expiring, tone: "amber", allowed: can.members },
    { key: "leads", icon: "userCheck", title: "Open leads", hint: "New & follow-up enquiries",
      to: "/leads?tab=followup", count: openLeads, tone: "red", allowed: can.leads },
    { key: "add", icon: "plus", title: "Add member", hint: "Register a new member",
      to: "/members/new", tone: "grey", allowed: can.addMember },
    { key: "accounts", icon: "money", title: "Accounts & finance", hint: "Collections & receipts",
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
