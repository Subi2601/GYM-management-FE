import { QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, type ComponentType, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";

import { ConfirmHost } from "@/components/ui/ConfirmDialog";
import { PageLoader } from "@/components/ui/Loaders";
import { Toaster } from "@/components/ui/Toaster";
import { BranchSelectionPage } from "@/features/auth/pages/BranchSelectionPage";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { AppShell } from "@/layouts/AppShell";
import { homePath } from "@/layouts/nav-config";
import { setSessionExpiredHandler } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";
import { ErrorBoundary, NotFoundPage, SessionExpiredPage } from "@/pages/ErrorPages";
import { AuthProvider } from "@/providers/AuthProvider";
import { PermissionRoute, RequireAuth } from "@/router/guards";
import { useAuthStore } from "@/stores/auth-store";

/** Lazy-load a named page export. */
function page<K extends string>(loader: () => Promise<Record<K, ComponentType>>, name: K) {
  return lazy(async () => ({ default: (await loader())[name] }));
}

const DashboardPage = page(() => import("@/features/dashboard/pages/DashboardPage"), "DashboardPage");
const MembersPage = page(() => import("@/features/members/pages/MembersPage"), "MembersPage");
const LeadsPage = page(() => import("@/features/leads/pages/LeadsPage"), "LeadsPage");
const PlansPage = page(() => import("@/features/plans/pages/PlansPage"), "PlansPage");
const SubscriptionsPage = page(() => import("@/features/subscriptions/pages/SubscriptionsPage"), "SubscriptionsPage");
const PaymentsPage = page(() => import("@/features/payments/pages/PaymentsPage"), "PaymentsPage");
const InvoicePage = page(() => import("@/features/payments/pages/InvoicePage"), "InvoicePage");
const PersonalTrainingPage = page(() => import("@/features/training/pages/PersonalTrainingPage"), "PersonalTrainingPage");
const StaffPage = page(() => import("@/features/staff/pages/StaffPage"), "StaffPage");
const AttendancePage = page(() => import("@/features/attendance/pages/AttendancePage"), "AttendancePage");
const SalaryPage = page(() => import("@/features/salary/pages/SalaryPage"), "SalaryPage");
const DietPlansPage = page(() => import("@/features/diet/pages/DietPlansPage"), "DietPlansPage");

function Guarded({ permission, children }: { permission: string; children: ReactNode }) {
  return (
    <PermissionRoute permission={permission}>
      <Suspense fallback={<PageLoader />}>{children}</Suspense>
    </PermissionRoute>
  );
}

function HomeRedirect() {
  const can = useAuthStore((s) => s.can);
  useAuthStore((s) => s.permissions);
  return <Navigate to={homePath(can)} replace />;
}

/** Wires the api-client's 401 handler to the router once. */
function SessionExpiryBridge() {
  const navigate = useNavigate();
  useEffect(() => setSessionExpiredHandler(() => navigate("/session-expired", { replace: true })), [navigate]);
  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <SessionExpiryBridge />
          <Toaster />
          <ConfirmHost />
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/session-expired" element={<SessionExpiredPage />} />
              <Route path="/branch-selection" element={<RequireAuth><BranchSelectionPage /></RequireAuth>} />
              {/* Invoice prints full-width without the app chrome, as before. */}
              <Route path="/invoice/:paymentId" element={
                <RequireAuth><Guarded permission="payment:invoice"><InvoicePage /></Guarded></RequireAuth>
              } />
              <Route element={<RequireAuth><AppShell /></RequireAuth>}>
                <Route index element={<HomeRedirect />} />
                <Route path="dashboard" element={<Guarded permission="dashboard:view"><DashboardPage /></Guarded>} />
                <Route path="members" element={<Guarded permission="member:list"><MembersPage /></Guarded>} />
                <Route path="leads" element={<Guarded permission="lead:list"><LeadsPage /></Guarded>} />
                <Route path="plans" element={<Guarded permission="plan:list"><PlansPage /></Guarded>} />
                <Route path="subscriptions" element={<Guarded permission="subscription:list"><SubscriptionsPage /></Guarded>} />
                <Route path="payments" element={<Guarded permission="payment:list"><PaymentsPage /></Guarded>} />
                <Route path="personal-training" element={<Guarded permission="pt:list"><PersonalTrainingPage /></Guarded>} />
                <Route path="staff" element={<Guarded permission="employee:list"><StaffPage /></Guarded>} />
                <Route path="attendance" element={<Guarded permission="attendance:list"><AttendancePage /></Guarded>} />
                <Route path="salary" element={<Guarded permission="salary:list"><SalaryPage /></Guarded>} />
                <Route path="diet-plans" element={<Guarded permission="diet:list"><DietPlansPage /></Guarded>} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
