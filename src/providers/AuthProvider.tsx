import { useEffect, type ReactNode } from "react";

import { FullScreenLoader } from "@/components/ui/Loaders";
import { authApi } from "@/features/auth/api";
import { queryClient } from "@/lib/query-client";
import { useAuthStore } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import type { Me } from "@/types/auth";

const ME_POLL_MS = 3 * 60 * 1000;

/** Keep the remembered branch valid for this account (trainers are pinned to their branch). */
export function reconcileBranch(me: Me): void {
  const { selectedBranchId, selectBranch } = useBranchStore.getState();
  const ids = me.branches.map((b) => b.id);
  if (!me.can_switch_branch) {
    selectBranch(me.user.branch_id);
    return;
  }
  if (selectedBranchId && !ids.includes(selectedBranchId)) useBranchStore.getState().reset();
}

/** Bootstrap: token in memory? → /me : /auth/refresh (cookie) → /me. Renders nothing until resolved. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const store = useAuthStore.getState();
      try {
        if (!store.accessToken) {
          const { data } = await authApi.refresh();
          store.setToken(data.access_token);
        }
        const { data: me } = await authApi.me();
        if (cancelled) return;
        store.setMe(me);
        reconcileBranch(me);
        store.setStatus("authed");
      } catch {
        if (!cancelled) store.clear();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Mid-session sync of permissions / branches.
  useEffect(() => {
    if (status !== "authed") return;
    const id = window.setInterval(async () => {
      try {
        const { data } = await authApi.me();
        useAuthStore.getState().setMe(data);
      } catch {
        /* the api-client handles 401 → session expired */
      }
    }, ME_POLL_MS);
    return () => window.clearInterval(id);
  }, [status]);

  if (status === "booting") return <FullScreenLoader />;
  return <>{children}</>;
}

export async function signOut(): Promise<void> {
  try {
    await authApi.logout();
  } catch {
    /* already signed out server-side */
  }
  useAuthStore.getState().clear();
  useBranchStore.getState().reset();
  queryClient.clear();
}
