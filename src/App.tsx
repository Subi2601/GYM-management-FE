import { QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, type ComponentType, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";

import { ConfirmHost } from "@/components/ui/ConfirmDialog";
import { PageLoader } from "@/components/ui/Loaders";
import { PwaUpdatePrompt } from "@/components/ui/PwaUpdatePrompt";
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
const MemberFormPage = page(() => import("@/features/members/pages/MemberFormPage"), "MemberFormPage");
const LeadsPage = page(() => import("@/features/leads/pages/LeadsPage"), "LeadsPage");
const PlansPage = page(() => import("@/features/plans/pages/PlansPage"), "PlansPage");
const OffersPage = page(() => import("@/features/offers/pages/OffersPage"), "OffersPage");
const RolesPage = page(() => import("@/features/roles/pages/RolesPage"), "RolesPage");
const SettingsPage = page(() => import("@/features/settings/pages/SettingsPage"), "SettingsPage");
const GymSettingsPage = page(() => import("@/features/gym/pages/GymSettingsPage"), "GymSettingsPage");
const ReferralsPage = page(() => import("@/features/referrals/pages/ReferralsPage"), "ReferralsPage");
const RenewalsPage = page(() => import("@/features/renewals/pages/RenewalsPage"), "RenewalsPage");
const PublicInvoicePage = page(() => import("@/features/payments/pages/InvoicePage"), "PublicInvoicePage");
const SubscriptionsPage = page(() => import("@/features/subscriptions/pages/SubscriptionsPage"), "SubscriptionsPage");
const PaymentsPage = page(() => import("@/features/payments/pages/PaymentsPage"), "PaymentsPage");
const InvoicePage = page(() => import("@/features/payments/pages/InvoicePage"), "InvoicePage");
const PersonalTrainingPage = page(() => import("@/features/training/pages/PersonalTrainingPage"), "PersonalTrainingPage");
const StaffPage = page(() => import("@/features/staff/pages/StaffPage"), "StaffPage");
const EmployeeFormPage = page(() => import("@/features/staff/pages/EmployeeFormPage"), "EmployeeFormPage");
const EmployeeDetailsPage = page(() => import("@/features/staff/pages/EmployeeDetailsPage"), "EmployeeDetailsPage");
const AttendancePage = page(() => import("@/features/attendance/pages/AttendancePage"), "AttendancePage");
const AttendanceQrPage = page(() => import("@/features/attendance/pages/AttendanceQrPage"), "AttendanceQrPage");
const EnquiryFormPage = page(() => import("@/features/leads/pages/EnquiryFormPage"), "EnquiryFormPage");
const CheckinPage = page(() => import("@/features/attendance/pages/CheckinPage"), "CheckinPage");
const SalaryPage = page(() => import("@/features/salary/pages/SalaryPage"), "SalaryPage");
const DietPlansPage = page(() => import("@/features/diet/pages/DietPlansPage"), "DietPlansPage");
const DietBuilderPage = page(() => import("@/features/diet/pages/DietBuilderPage"), "DietBuilderPage");

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
          <PwaUpdatePrompt />
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/session-expired" element={<SessionExpiredPage />} />
              {/* Opened from the branch QR posters on members' / staff phones — no login. */}
              <Route path="/checkin/:token" element={<Suspense fallback={<PageLoader />}><CheckinPage /></Suspense>} />
              {/* Invoice link sent to the member on WhatsApp — no login, the signed token is the permission. */}
              {/* Public enquiry form (branch link / QR poster) — no login; a submit becomes a lead. */}
              <Route path="/enquiry/:token" element={<Suspense fallback={<PageLoader />}><EnquiryFormPage /></Suspense>} />
              <Route path="/i/:token" element={<Suspense fallback={<PageLoader />}><PublicInvoicePage /></Suspense>} />
              <Route path="/branch-selection" element={<RequireAuth><BranchSelectionPage /></RequireAuth>} />
              {/* Invoice prints full-width without the app chrome, as before. */}
              <Route path="/invoice/:paymentId" element={
                <RequireAuth><Guarded permission="payment:invoice"><InvoicePage /></Guarded></RequireAuth>
              } />
              <Route element={<RequireAuth><AppShell /></RequireAuth>}>
                <Route index element={<HomeRedirect />} />
                <Route path="dashboard" element={<Guarded permission="dashboard:view"><DashboardPage /></Guarded>} />
                <Route path="members" element={<Guarded permission="member:list"><MembersPage /></Guarded>} />
                <Route path="members/new" element={<Guarded permission="member:create"><MemberFormPage /></Guarded>} />
                <Route path="members/:id" element={<Guarded permission="member:list"><MemberFormPage /></Guarded>} />
                <Route path="members/:id/edit" element={<Guarded permission="member:update"><MemberFormPage /></Guarded>} />
                <Route path="leads" element={<Guarded permission="lead:list"><LeadsPage /></Guarded>} />
                <Route path="referrals" element={<Guarded permission="referral:list"><ReferralsPage /></Guarded>} />
                <Route path="plans" element={<Guarded permission="plan:list"><PlansPage /></Guarded>} />
                <Route path="offers" element={<Guarded permission="offer:list"><OffersPage /></Guarded>} />
                <Route path="roles" element={<Guarded permission="role:list"><RolesPage /></Guarded>} />
                <Route path="configuration" element={<Guarded permission="setting:manage"><SettingsPage /></Guarded>} />
                <Route path="settings" element={<Navigate to="/configuration" replace />} />
                <Route path="gym-settings" element={<Guarded permission="gym:manage"><GymSettingsPage /></Guarded>} />
                <Route path="renewals" element={<Guarded permission="subscription:list"><RenewalsPage /></Guarded>} />
                <Route path="subscriptions" element={<Guarded permission="subscription:list"><SubscriptionsPage /></Guarded>} />
                <Route path="payments" element={<Guarded permission="payment:list"><PaymentsPage /></Guarded>} />
                <Route path="personal-training" element={<Guarded permission="pt:list"><PersonalTrainingPage /></Guarded>} />
                <Route path="staff" element={<Guarded permission="employee:list"><StaffPage /></Guarded>} />
                <Route path="staff/new" element={<Guarded permission="employee:create"><EmployeeFormPage /></Guarded>} />
                <Route path="staff/:id" element={<Guarded permission="employee:list"><EmployeeDetailsPage /></Guarded>} />
                <Route path="staff/:id/edit" element={<Guarded permission="employee:update"><EmployeeFormPage /></Guarded>} />
                <Route path="attendance" element={<Guarded permission="attendance:list"><AttendancePage /></Guarded>} />
                <Route path="attendance/qr" element={<Guarded permission="attendance:qr"><AttendanceQrPage /></Guarded>} />
                <Route path="salary" element={<Guarded permission="salary:list"><SalaryPage /></Guarded>} />
                <Route path="diet-plans" element={<Guarded permission="diet:list"><DietPlansPage /></Guarded>} />
                <Route path="diet-plans/:memberId" element={<Guarded permission="diet:manage"><DietBuilderPage /></Guarded>} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
