import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { ForbiddenPage } from "@/pages/ErrorPages";
import { useAuthStore } from "@/stores/auth-store";

/** Signed-in only; otherwise to /login (remembering where the user was going). */
export function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();
  if (status !== "authed") return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

/** Route-level permission guard — renders 403 in place (no role-name checks anywhere). */
export function PermissionRoute({ permission, children }: { permission: string; children: ReactNode }) {
  const allowed = useAuthStore((s) => (s.me ? s.me.user.is_superadmin || s.permissions.has(permission) : false));
  if (!allowed) return <ForbiddenPage />;
  return <>{children}</>;
}
