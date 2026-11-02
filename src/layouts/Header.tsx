import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { Icon } from "@/components/ui/Icon";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { screenLabel } from "@/layouts/nav-config";
import { cn } from "@/lib/utils";
import { signOut } from "@/providers/AuthProvider";
import { useAuthStore } from "@/stores/auth-store";

const ROLE_LABEL: Record<string, string> = { OWNER: "Owner", ADMIN: "Admin", TRAINER: "Trainer" };

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")).toUpperCase() || "?";
}

/** Sticky glass app bar: hamburger (mobile), current screen, theme toggle, profile menu with sign out. */
export function Header({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.me);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  if (!me) return null;
  const isOwnerish = me.user.role === "OWNER" || me.user.role === "ADMIN";

  const logout = async () => {
    setMenuOpen(false);
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <header className="app-header sticky top-0 z-[100] flex h-header items-center justify-between gap-4 border-b border-line bg-[var(--header-bg)] px-10 backdrop-blur-[12px] [grid-area:header] max-md:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" onClick={(e) => { e.stopPropagation(); onToggleSidebar(); }}
          className="hidden h-10 w-10 cursor-pointer items-center justify-center rounded-[10px] border border-line bg-surface text-ink max-md:flex"
          aria-label="Menu">
          <Icon name="menu" className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-muted">
          <span className="truncate max-md:hidden">{me.user.organization_name ?? "Stag Fitness"}</span>
          <Icon name="chevronRight" className="h-3.5 w-3.5 shrink-0 max-md:hidden" />
          <span className="truncate font-bold text-ink">{screenLabel(pathname)}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        <ThemeToggle />

        <div className="relative" ref={menuRef}>
          <button type="button" onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu" aria-expanded={menuOpen} aria-label="Profile menu"
            className={cn(
              "flex h-10 cursor-pointer items-center gap-2 rounded-[10px] border bg-surface py-0 pl-1 pr-2 transition-all hover:border-line-accent",
              menuOpen ? "border-line-accent" : "border-line",
            )}>
            <span className="side-avatar h-8 w-8 text-[11px]">{initials(me.user.name)}</span>
            <span className="max-w-[140px] truncate text-[13px] font-bold text-ink max-md:hidden">{me.user.name}</span>
            <Icon name="chevronDown" className={cn("h-4 w-4 text-muted transition-transform", menuOpen && "rotate-180")} />
          </button>

          {menuOpen && (
            <div role="menu"
              className="absolute right-0 top-[calc(100%+8px)] z-[1001] w-64 animate-dropdownIn overflow-hidden rounded-xl border border-line bg-surface shadow-dropdown">
              <div className="flex items-center gap-3 p-4">
                <span className="side-avatar h-10 w-10 text-[13px]">{initials(me.user.name)}</span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-ink">{me.user.name}</div>
                  <div className="truncate text-xs text-muted" title={me.user.email}>{me.user.email}</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
                <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-bold",
                  isOwnerish ? "bg-accent-light text-accent" : "bg-hover text-secondary-grey")}>
                  {ROLE_LABEL[me.user.role] ?? me.user.role}
                </span>
                {me.user.organization_name && (
                  <span className="truncate text-xs font-semibold text-secondary-grey">{me.user.organization_name}</span>
                )}
              </div>
              <div className="h-px bg-line" />
              <div className="p-1.5">
                <button type="button" role="menuitem" onClick={logout}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-lg border-none bg-transparent px-3 py-2.5 text-left text-sm font-semibold text-secondary-grey transition-colors hover:bg-accent-light hover:text-accent">
                  <Icon name="logout" className="h-[18px] w-[18px]" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
