import { useState } from "react";
import { Navigate, Outlet } from "react-router-dom";

import { ManageBranchesModal } from "@/features/branches/components/ManageBranchesModal";
import { Header } from "@/layouts/Header";
import { Sidebar } from "@/layouts/Sidebar";
import { useAuthStore } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";

/** Grid layout from the original: fixed sidebar | sticky header over scrolling main. */
export function AppShell() {
  const me = useAuthStore((s) => s.me);
  const selectedBranchId = useBranchStore((s) => s.selectedBranchId);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [branchesOpen, setBranchesOpen] = useState(false);

  // Owners choose a branch (or All Branches) before entering the app, as before.
  if (me?.can_switch_branch && selectedBranchId === undefined) return <Navigate to="/branch-selection" replace />;

  return (
    <div className="grid min-h-screen grid-cols-[var(--sidebar-width)_1fr] grid-rows-[var(--header-height)_1fr] overflow-x-hidden [grid-template-areas:'sidebar_header''sidebar_main'] max-md:grid-cols-1 max-md:[grid-template-areas:'header''main']">
      {sidebarOpen && (
        <div className="fixed inset-0 z-[999] hidden bg-black/40 backdrop-blur-[4px] max-md:block" onClick={() => setSidebarOpen(false)} />
      )}
      <div className="[grid-area:sidebar] max-md:hidden" />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onManageBranches={() => setBranchesOpen(true)} />
      <Header onToggleSidebar={() => setSidebarOpen((o) => !o)} />
      <main className="app-main min-w-0 overflow-y-auto p-10 [grid-area:main] max-md:p-5">
        <Outlet />
      </main>
      <ManageBranchesModal open={branchesOpen} onClose={() => setBranchesOpen(false)} />
    </div>
  );
}
