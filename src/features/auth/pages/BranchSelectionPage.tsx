import { useNavigate } from "react-router-dom";

import { Icon, type IconName } from "@/components/ui/Icon";
import { queryClient } from "@/lib/query-client";
import { signOut } from "@/providers/AuthProvider";
import { useAuthStore } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";

/** Owner's branch picker shown after login (and from the header "Switch" button). */
export function BranchSelectionPage() {
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.me);
  const selectBranch = useBranchStore((s) => s.selectBranch);

  const choose = (branchId: string | null) => {
    selectBranch(branchId);
    queryClient.invalidateQueries();
    navigate("/", { replace: true });
  };

  const logout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-subtle">
      <div className="flex items-center justify-between border-b border-line bg-surface px-10 py-5 max-sm:px-5 max-sm:py-[15px]">
        <div className="flex items-center gap-2.5 text-xl font-extrabold text-primary-grey">
          <div className="h-8 w-8 rounded-lg bg-danger" />
          STAG <strong>GYM</strong>
        </div>
        <div className="flex items-center gap-5 text-sm text-muted">
          <span>Welcome, <strong>{me?.user.name ?? "Owner"}</strong></span>
          <button type="button" onClick={logout} className="p-0 text-sm font-bold text-danger hover:underline">Sign Out</button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1000px] flex-1 px-5 py-[60px] max-sm:py-10">
        <h1 className="mb-2 text-center text-[32px] font-extrabold text-primary-grey">Select a Branch to Manage</h1>
        <p className="mb-10 text-center text-base text-muted">Choose a specific location or view all branches combined.</p>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
          <BranchCard icon="home" title="🏢 All Branches" subtitle="Consolidated view of your entire gym network"
            highlight onClick={() => choose(null)} />
          {me?.branches.map((b) => (
            <BranchCard key={b.id} icon="pin" title={`📍 ${b.branch_name}`} subtitle={b.location ?? ""}
              onClick={() => choose(b.id)} />
          ))}
        </div>
      </div>

      <div className="p-10 text-center text-[13px] text-muted">
        &copy; {new Date().getFullYear()} Stag Gym Management Software. All rights reserved.
      </div>
    </div>
  );
}

interface BranchCardProps {
  icon: IconName;
  title: string;
  subtitle: string;
  highlight?: boolean;
  onClick: () => void;
}

function BranchCard({ icon, title, subtitle, highlight, onClick }: BranchCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "group relative flex items-center gap-5 overflow-hidden rounded-2xl border-2 p-6 text-left transition-all duration-200 " +
        "hover:-translate-y-1 hover:border-danger hover:shadow-[0_12px_20px_-8px_rgba(220,38,38,0.15)] " +
        (highlight ? "border-danger-line bg-gradient-to-br from-surface to-accent-light" : "border-line bg-surface")
      }
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-hover text-muted transition-all group-hover:bg-danger-soft group-hover:text-danger">
        <Icon name={icon} className="h-7 w-7" />
      </div>
      <div className="flex-1">
        <h3 className="mb-1 mt-0 text-lg font-extrabold text-primary-grey">{title}</h3>
        <p className="m-0 text-[13px] text-muted">{subtitle}</p>
      </div>
      <div className="text-faint transition-all group-hover:translate-x-1 group-hover:text-danger">
        <Icon name="chevronRight" className="h-5 w-5" strokeWidth={3} />
      </div>
    </button>
  );
}
