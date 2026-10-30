import { create } from "zustand";

import type { Me } from "@/types/auth";

type AuthStatus = "booting" | "authed" | "anon";

interface AuthState {
  status: AuthStatus;
  /** Access token lives in memory only — never localStorage/sessionStorage. */
  accessToken: string | null;
  me: Me | null;
  permissions: ReadonlySet<string>;
  setToken: (token: string) => void;
  setMe: (me: Me) => void;
  setStatus: (status: AuthStatus) => void;
  clear: () => void;
  can: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "booting",
  accessToken: null,
  me: null,
  permissions: new Set<string>(),

  setToken: (token) => set({ accessToken: token }),
  setMe: (me) => set({ me, permissions: new Set(me.permissions) }),
  setStatus: (status) => set({ status }),
  clear: () => set({ status: "anon", accessToken: null, me: null, permissions: new Set<string>() }),

  can: (permission) => {
    const { me, permissions } = get();
    if (!me) return false;
    return me.user.is_superadmin || permissions.has(permission);
  },
}));

/** Hook form of `can()` — re-renders when permissions change. */
export function useCan(permission: string): boolean {
  return useAuthStore((s) => (s.me ? s.me.user.is_superadmin || s.permissions.has(permission) : false));
}
