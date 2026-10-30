import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import { Icon } from "@/components/ui/Icon";
import { NAV, type NavItem } from "@/layouts/nav-config";
import { cn } from "@/lib/utils";
import { signOut } from "@/providers/AuthProvider";
import { useAuthStore } from "@/stores/auth-store";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  onManageBranches: () => void;
}

/** `.nav-item` (index.css): red gradient sweep on hover, soft wash + left bar when active. */
const navItemCls = "nav-item";

/** Fixed sidebar: gradient logo, grouped nav with sliding sub-menus, logout footer. */
export function Sidebar({ open, onClose, onManageBranches }: SidebarProps) {
  const can = useAuthStore((s) => s.can);
  useAuthStore((s) => s.permissions); // re-render when permissions change
  const location = useLocation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Auto-open the group of the current route (as the original router listener did).
  useEffect(() => {
    const group = NAV.find((n) => n.match?.some((m) => location.pathname.startsWith(m)));
    if (group) setExpanded((e) => ({ ...e, [group.key]: true }));
  }, [location.pathname]);

  const logout = async () => {
    onClose();
    await signOut();
    navigate("/login", { replace: true });
  };

  const isLeafActive = (to: string) => {
    const [path, query] = to.split("?");
    if (location.pathname !== path) return false;
    if (!query) return true;
    const want = new URLSearchParams(query);
    const have = new URLSearchParams(location.search);
    const filter = want.get("filter");
    return filter ? (have.get("filter") ?? "all") === filter : false;
  };

  const renderItem = (item: NavItem) => {
    if (!can(item.permission)) return null;
    const icon = (active: boolean) => (
      <span className={cn("flex h-5 w-5 items-center justify-center transition-all", active ? "text-accent" : "text-secondary-grey")}>
        <Icon name={item.icon} className="h-5 w-5" />
      </span>
    );

    if (item.action === "manage-branches") {
      return (
        <a key={item.key} className={navItemCls} onClick={() => { onManageBranches(); onClose(); }}>
          {icon(false)} {item.label}
        </a>
      );
    }

    if (item.children) {
      const isOpen = !!expanded[item.key];
      const leaves = item.children.filter((c) => can(c.permission));
      return (
        <div key={item.key} className="flex flex-col">
          <a className={cn(navItemCls, "justify-between")} onClick={() => setExpanded((e) => ({ ...e, [item.key]: !isOpen }))}>
            <span className="flex items-center gap-3">{icon(false)} {item.label}</span>
            <Icon name="chevronDown" className={cn("h-4 w-4 transition-transform duration-300", isOpen && "rotate-180")} />
          </a>
          <div className={cn("mx-2.5 overflow-hidden rounded-lg bg-subtle transition-[max-height] duration-300 ease-out",
            isOpen ? "mb-2.5 max-h-[300px]" : "max-h-0")}>
            {leaves.map((leaf) => (
              <NavLink
                key={leaf.to}
                to={leaf.to}
                onClick={onClose}
                className={() => cn(
                  "block rounded-md py-2.5 pl-[45px] pr-[15px] text-[13px] font-semibold text-muted no-underline transition-all hover:bg-accent/5 hover:text-accent",
                  isLeafActive(leaf.to) && "rounded-l-none bg-accent/10 text-accent shadow-[inset_3px_0_0_rgb(var(--accent))]",
                )}
              >
                {leaf.label}
              </NavLink>
            ))}
          </div>
        </div>
      );
    }

    return (
      <NavLink key={item.key} to={item.to!} onClick={onClose}
        className={({ isActive }) => cn(navItemCls, isActive && "active")}>
        {({ isActive }) => <>{icon(isActive)} {item.label}</>}
      </NavLink>
    );
  };

  return (
    <aside
      className={cn(
        "app-sidebar fixed z-[1000] flex h-screen w-sidebar flex-col overflow-y-auto border-r border-line bg-[image:var(--side-bg)] bg-surface text-ink",
        "max-md:-translate-x-full max-md:transition-transform max-md:duration-300 max-md:ease-[cubic-bezier(0.4,0,0.2,1)]",
        open && "max-md:translate-x-0",
      )}
    >
      <div className="flex items-center gap-2.5 border-b border-line-light px-[30px] py-[26px] font-display text-[32px] leading-none tracking-[2px] text-ink">
        <div className="h-7 w-2 rounded bg-grad" />
        <span>STAG <span className="text-gradient">GYM</span></span>
      </div>
      <nav className="flex flex-col gap-1 px-[15px] py-5">{NAV.map(renderItem)}</nav>
      <div className="mt-auto border-t border-line-light px-[15px] py-5">
        <a className={cn(navItemCls, "text-muted hover:text-accent")} onClick={logout}>
          <span className="flex h-5 w-5 items-center justify-center"><Icon name="logout" className="h-5 w-5" /></span>
          Logout
        </a>
      </div>
    </aside>
  );
}
