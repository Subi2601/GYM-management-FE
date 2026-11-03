import { NavLink, useNavigate } from "react-router-dom";

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

/** Fixed sidebar: logo, branch switcher, one link per screen in labelled groups. Profile + sign out live in the header. */
export function Sidebar({ open, onClose, onManageBranches }: SidebarProps) {
  const can = useAuthStore((s) => s.can);
  const me = useAuthStore((s) => s.me);
  useAuthStore((s) => s.permissions); // re-render when permissions change
  const selectedBranchId = useBranchStore((s) => s.selectedBranchId);
  const navigate = useNavigate();

  const renderItem = (item: NavItem) => {
    const content = (
      <>
        <Icon name={item.icon} className="nav-icon" />
        <span className="truncate">{item.label}</span>
      </>
    );
    if (item.action === "manage-branches") {
      return (
        <button key={item.key} type="button" className="nav-item w-full"
          onClick={() => { onManageBranches(); onClose(); }}>
          {content}
        </button>
      );
    }
    return (
      <NavLink key={item.key} to={item.to!} onClick={onClose}
        className={({ isActive }) => cn("nav-item", isActive && "active")}>
        {content}
      </NavLink>
    );
  };

  const branchName = (id: string | null | undefined) => me?.branches.find((b) => b.id === id)?.branch_name;
  const currentBranchId = me?.can_switch_branch ? selectedBranchId : me?.user.branch_id;
  const branchTitle = me?.can_switch_branch
    ? (selectedBranchId ? branchName(selectedBranchId) ?? "Branch" : "All Branches")
    : branchName(me?.user.branch_id) ?? "Assigned Branch";
  const branchLocation = me?.branches.find((b) => b.id === currentBranchId)?.location;

  const branchBody = (
    <>
      <span className="side-chip"><Icon name="pin" className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="side-muted block text-[10.5px] font-bold uppercase tracking-[0.08em]">Branch</span>
        <span className="side-strong block truncate text-[13px] font-bold leading-tight">{branchTitle}</span>
        {branchLocation && <span className="side-muted block truncate text-[11.5px]">{branchLocation}</span>}
      </span>
    </>
  );

  return (
    <aside
      className={cn(
        "app-sidebar fixed z-[1000] flex h-screen w-sidebar flex-col",
        "max-md:-translate-x-full max-md:transition-transform max-md:duration-300 max-md:ease-[cubic-bezier(0.4,0,0.2,1)]",
        open && "max-md:translate-x-0",
      )}
    >
      {/* Logo — same height as the header so the two bars line up */}
      <div className="side-divider flex h-header shrink-0 items-center gap-3 px-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-grad font-display text-xl font-bold text-white shadow-glow">
          S
        </div>
        <div className="min-w-0">
          <div className="side-strong font-display text-[20px] font-bold uppercase leading-none tracking-[0.4px]">
            Stag <span className="text-gradient">Fitness</span>
          </div>
          <div className="side-muted mt-1 truncate text-[11px] font-semibold">
            {me?.user.organization_name ?? "Gym management"}
          </div>
        </div>
      </div>

      {/* Branch */}
      <div className="px-4 pt-4">
        {me?.can_switch_branch ? (
          <button type="button" className="side-card w-full" title="Switch branch"
            onClick={() => { onClose(); navigate("/branch-selection"); }}>
            {branchBody}
            <Icon name="switch" className="side-muted h-4 w-4" />
          </button>
        ) : (
          <div className="side-card">{branchBody}</div>
        )}
      </div>

      {/* Navigation */}
      <nav className="side-scroll flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-6 pt-5" aria-label="Main">
        {NAV_GROUPS.map((group) => {
          const items = NAV.filter((n) => n.group === group && can(n.permission));
          if (items.length === 0) return null;
          return (
            <div key={group} className="flex flex-col gap-0.5">
              {group !== "Overview" && <div className="side-group">{group}</div>}
              {items.map(renderItem)}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
