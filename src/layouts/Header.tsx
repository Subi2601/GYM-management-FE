import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";
import { signOut } from "@/providers/AuthProvider";
import { useAuthStore } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import { useThemeStore } from "@/stores/theme-store";

/** Sticky glass app bar: hamburger (mobile), branch display / switch, theme toggle, user dropdown. */
export function Header({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.me);
  const selectedBranchId = useBranchStore((s) => s.selectedBranchId);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuOpen]);

  if (!me) return null;
  const branchName = (id: string | null | undefined) => me.branches.find((b) => b.id === id)?.branch_name;
  const isOwnerish = me.user.role === "OWNER" || me.user.role === "ADMIN";

  const logout = async () => {
    setMenuOpen(false);
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <header className="app-header sticky top-0 z-[100] flex h-header items-center justify-between border-b border-line bg-[var(--header-bg)] px-10 backdrop-blur-[12px] [grid-area:header] max-md:px-5">
      <div className="flex items-center">
        <button type="button" onClick={(e) => { e.stopPropagation(); onToggleSidebar(); }}
          className="mr-[15px] hidden cursor-pointer border-none bg-transparent p-2 text-ink max-md:flex" aria-label="Menu">
          <Icon name="menu" className="h-6 w-6" />
        </button>

        {me.can_switch_branch ? (
          <div className="ml-5 rounded-[13px] bg-grad p-[1.5px] max-md:ml-0">
          <div className="flex items-center gap-[15px] rounded-[11.5px] bg-surface py-[5px] pl-[15px] pr-[5px]">
            <span className="text-sm font-extrabold text-ink">
              {selectedBranchId ? `📍 ${branchName(selectedBranchId) ?? "Branch"}` : "🏢 All Branches"}
            </span>
            <button type="button" onClick={() => navigate("/branch-selection")}
              className="flex items-center gap-1.5 rounded-lg bg-grad px-3 py-[6px] text-xs font-bold text-white transition-all hover:-translate-y-px hover:shadow-glow">
              <Icon name="switch" className="h-3.5 w-3.5" />
              Switch
            </button>
          </div>
          </div>
        ) : (
          <div className="ml-5 max-md:ml-0">
            <span className="flex items-center gap-1.5 rounded-md bg-accent-light px-3 py-1.5 text-[13px] font-bold text-accent">
              <Icon name="pin" className="h-3.5 w-3.5" />
              {branchName(me.user.branch_id) ?? "Assigned Branch"}
            </span>
          </div>
        )}
      </div>

      <div className="relative flex items-center gap-2">
        <button type="button" onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to white theme" : "Switch to dark theme"}
          title={theme === "dark" ? "White theme" : "Dark theme"}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-secondary-grey transition-all hover:border-accent hover:text-accent hover:shadow-glow">
          <Icon name={theme === "dark" ? "sun" : "moon"} className="h-5 w-5" />
        </button>
        <div className="group cursor-pointer rounded-full p-[5px] transition-all hover:bg-hover"
          onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}>
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-hover text-secondary-grey transition-all group-hover:border-accent group-hover:text-accent">
            <Icon name="user" className="h-6 w-6" />
          </div>
        </div>

        {menuOpen && (
          <div onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-[120%] z-[1001] w-60 animate-dropdownIn overflow-hidden rounded-xl border border-line bg-surface shadow-dropdown">
            <div className="flex flex-col gap-1 p-4">
              <span className="text-[15px] font-bold text-ink">{me.user.name}</span>
              <div className={cn("my-1 w-fit rounded px-1.5 py-0.5 text-[10px] font-extrabold",
                isOwnerish ? "bg-danger-soft text-danger" : "bg-line text-secondary-grey")}>
                {me.user.role}
              </div>
              <span className="text-[13px] text-muted">{me.user.email}</span>
              {me.user.organization_name && <span className="text-xs font-semibold text-secondary-grey">{me.user.organization_name}</span>}
            </div>
            <div className="h-px bg-line-light" />
            <div className="p-2">
              <button type="button" onClick={logout}
                className="flex w-full cursor-pointer items-center gap-3 rounded-lg border-none bg-transparent px-3 py-2.5 text-left text-sm font-semibold text-secondary-grey transition-all hover:bg-accent-light hover:text-accent">
                <Icon name="logout" />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
