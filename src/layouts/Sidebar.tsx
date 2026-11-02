import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import { Icon } from "@/components/ui/Icon";
import { NAV, NAV_GROUPS, type NavItem } from "@/layouts/nav-config";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  onManageBranches: () => void;
}

const ROLE_LABEL: Record<string, string> = { OWNER: "Owner", ADMIN: "Admin", TRAINER: "Trainer" };

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")).toUpperCase() || "?";
}

/** Fixed sidebar: logo, branch card, grouped nav with sub-menus, signed-in user (sign out is in the header profile menu). */
export function Sidebar({ open, onClose, onManageBranches }: SidebarProps) {
  const can = useAuthStore((s) => s.can);
  const me = useAuthStore((s) => s.me);
  useAuthStore((s) => s.permissions); // re-render when permissions change
  const selectedBranchId = useBranchStore((s) => s.selectedBranchId);
  const location = useLocation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Auto-open the group of the current route (as the original router listener did).
  useEffect(() => {
    const group = NAV.find((n) => n.match?.some((m) => location.pathname.startsWith(m)));
    if (group) setExpanded((e) => ({ ...e, [group.key]: true }));
  }, [location.pathname]);

  const isLeafActive = (to: string) => {
    const [path, query] = to.split("?");
    if (location.pathname !== path) return false;
    if (!query) return true;
    const want = new URLSearchParams(query);
    const have = new URLSearchParams(location.search);
    const filter = want.get("filter");
    if (filter) return !have.get("action") && (have.get("filter") ?? "all") === filter;
    const action = want.get("action");
    return action ? have.get("action") === action : false;
  };

  const renderItem = (item: NavItem) => {
    if (!can(item.permission)) return null;
    const icon = <Icon name={item.icon} className="h-[18px] w-[18px] shrink-0" />;

    if (item.action === "manage-branches") {
      return (
        <a key={item.key} role="button" tabIndex={0} className="nav-item"
          onClick={() => { onManageBranches(); onClose(); }}
          onKeyDown={(e) => e.key === "Enter" && (onManageBranches(), onClose())}>
          {icon} {item.label}
        </a>
      );
    }

    if (item.children) {
      const isOpen = !!expanded[item.key];
      const leaves = item.children.filter((c) => can(c.permission));
      return (
        <div key={item.key} className="flex flex-col">
          <a role="button" tabIndex={0} aria-expanded={isOpen} className="nav-item"
            onClick={() => setExpanded((e) => ({ ...e, [item.key]: !isOpen }))}
            onKeyDown={(e) => e.key === "Enter" && setExpanded((x) => ({ ...x, [item.key]: !isOpen }))}>
            {icon} {item.label}
            <Icon name="chevronDown" className={cn("ml-auto h-4 w-4 transition-transform duration-200", isOpen && "rotate-180")} />
          </a>
          <div className={cn("overflow-hidden transition-[max-height] duration-300 ease-out", isOpen ? "max-h-[260px]" : "max-h-0")}>
            <div className="nav-sub mb-1.5 mt-0.5">
              {leaves.map((leaf) => (
                <NavLink key={leaf.to} to={leaf.to} onClick={onClose}
                  className={() => cn("nav-sub-item", isLeafActive(leaf.to) && "active")}>
                  {leaf.label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <NavLink key={item.key} to={item.to!} onClick={onClose}
        className={({ isActive }) => cn("nav-item", isActive && "active")}>
        {icon} {item.label}
      </NavLink>
    );
  };

  const branchName = (id: string | null | undefined) => me?.branches.find((b) => b.id === id)?.branch_name;
  const branchTitle = me?.can_switch_branch
    ? (selectedBranchId ? branchName(selectedBranchId) ?? "Branch" : "All Branches")
    : branchName(me?.user.branch_id) ?? "Assigned Branch";
  const branchLocation = me?.branches.find((b) => b.id === (me?.can_switch_branch ? selectedBranchId : me?.user.branch_id))?.location;

  return (
    <aside
      className={cn(
        "app-sidebar fixed z-[1000] flex h-screen w-sidebar flex-col",
        "max-md:-translate-x-full max-md:transition-transform max-md:duration-300 max-md:ease-[cubic-bezier(0.4,0,0.2,1)]",
        open && "max-md:translate-x-0",
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-[11px] px-5 pb-4 pt-5">
        <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-grad font-display text-[19px] font-bold text-white shadow-glow">
          S
        </div>
        <div className="min-w-0">
          <div className="side-strong font-display text-[21px] font-bold uppercase leading-none tracking-[0.4px]">
            Stag <span className="text-gradient">Fitness</span>
          </div>
          <div className="side-muted mt-[3px] truncate text-[10.5px] font-semibold uppercase tracking-[0.08em]">
            {me?.user.organization_name ?? "Gym management"}
          </div>
        </div>
      </div>

      {/* Branch */}
      <div className="mx-3.5 mb-1">
        {me?.can_switch_branch ? (
          <button type="button" className="side-card w-full cursor-pointer" title="Switch branch"
            onClick={() => { onClose(); navigate("/branch-selection"); }}>
            <span className="side-chip"><Icon name="pin" className="h-[15px] w-[15px]" /></span>
            <span className="min-w-0 flex-1">
              <span className="side-strong block truncate text-[12.5px] font-bold">{branchTitle}</span>
              <span className="side-muted block truncate text-[11px]">{branchLocation ?? "Switch branch"}</span>
            </span>
            <Icon name="switch" className="side-muted h-4 w-4" />
          </button>
        ) : (
          <div className="side-card">
            <span className="side-chip"><Icon name="pin" className="h-[15px] w-[15px]" /></span>
            <span className="min-w-0 flex-1">
              <span className="side-strong block truncate text-[12.5px] font-bold">{branchTitle}</span>
              <span className="side-muted block truncate text-[11px]">{branchLocation ?? "Your branch"}</span>
            </span>
          </div>
        )}
      </div>

      {/* Navigation, grouped */}
      <nav className="flex flex-1 flex-col gap-px overflow-y-auto px-3 pb-3" aria-label="Main">
        {NAV_GROUPS.map((group) => {
          const items = NAV.filter((n) => n.group === group && can(n.permission));
          if (items.length === 0) return null;
          return (
            <div key={group} className="flex flex-col gap-px">
              <div className="side-group">{group}</div>
              {items.map(renderItem)}
            </div>
          );
        })}
      </nav>

      {/* Signed-in user */}
      {me && (
        <div className="side-card mx-3 mb-3.5 rounded-xl">
          <span className="side-avatar">{initials(me.user.name)}</span>
          <span className="min-w-0 flex-1">
            <span className="side-strong block truncate text-[13px] font-bold">{me.user.name}</span>
            <span className="side-muted block truncate text-[11.5px]" title={me.user.email}>
              {ROLE_LABEL[me.user.role] ?? me.user.role} · {me.user.email}
            </span>
          </span>
        </div>
      )}
    </aside>
  );
}
