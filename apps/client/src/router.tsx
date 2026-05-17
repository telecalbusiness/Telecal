import React, { useEffect } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';
import { UserRole } from '@mediconnect/shared';
import { useAuth, useAppDispatch } from '@/hooks/useAppDispatch';
import { fetchCurrentUser, setInitialized } from '@/store/slices/authSlice';

// Layouts
import { AuthLayout } from '@/components/layout/AuthLayout';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

import { LandingPage } from '@/pages/LandingPage';

// Auth pages
import { LoginPage } from '@/pages/auth/LoginPage';
import { PatientRegisterPage } from '@/pages/auth/PatientRegisterPage';
import { DoctorRegisterPage } from '@/pages/auth/DoctorRegisterPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';

// Patient pages
import { PatientDashboard } from '@/pages/patient/PatientDashboard';
import { NewAppointmentPage } from '@/pages/patient/NewAppointmentPage';
import { AppointmentsListPage } from '@/pages/patient/AppointmentsListPage';
import { AppointmentDetailPage } from '@/pages/patient/AppointmentDetailPage';
import { InvestigationsListPage, NewInvestigationPage } from '@/pages/patient/InvestigationsPage';
import { InvestigationDetailPage } from '@/pages/patient/InvestigationDetailPage';
import { PrescriptionsPage } from '@/pages/patient/PrescriptionsPage';
import { NotificationsPage } from '@/pages/patient/NotificationsPage';

// Doctor pages
import { DoctorDashboard } from '@/pages/doctor/DoctorDashboard';
import { DoctorCredentialsPage } from '@/pages/doctor/DoctorCredentialsPage';
import { DoctorEarningsPage } from '@/pages/doctor/DoctorEarningsPage';

// Admin pages
import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { AdminDoctorsPage } from '@/pages/admin/AdminDoctorsPage';
import { AdminDoctorDetailPage } from '@/pages/admin/AdminDoctorDetailPage';
import { AdminPatientsPage } from '@/pages/admin/AdminPatientsPage';
import { AdminAuditLogsPage } from '@/pages/admin/AdminAuditLogsPage';
import { AdminAppointmentsPage } from '@/pages/admin/AdminAppointmentsPage';
import { AdminSettingsPage } from '@/pages/admin/AdminSettingsPage';
import { AdminPatientDetailPage } from '@/pages/admin/AdminPatientDetailPage';
import { AdminEarningsPage } from '@/pages/admin/AdminEarningsPage';
import { AdminPayoutsPage } from '@/pages/admin/AdminPayoutsPage';

// Shared pages
import { ProfilePage } from '@/pages/ProfilePage';
import { PaymentSuccessPage, PaymentFailedPage } from '@/pages/PaymentCallbackPages';
import { WalletPage } from '@/pages/patient/WalletPage';

// Video
import { VideoCallPage } from '@/components/video/VideoCallPage';

// ─── Appointments route — renders admin or user view by role ──

const AppointmentsRouteHandler: React.FC = () => {
  const { user } = useAuth();
  if (user?.role === UserRole.ADMIN) return <AdminAppointmentsPage />;
  return <AppointmentsListPage />;
};

// ─── Earnings route — renders admin or doctor view by role ────

const EarningsRouteHandler: React.FC = () => {
  const { user } = useAuth();
  if (user?.role === UserRole.ADMIN) return <AdminEarningsPage />;
  return <DoctorEarningsPage />;
};

// ─── Page loader ──────────────────────────────────────────────

const PageLoader: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-[var(--surface-1)]">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-[var(--text-muted)]">Loading...</p>
    </div>
  </div>
);

// ─── Auth initializer ─────────────────────────────────────────

const AuthInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useAppDispatch();
  const { isInitialized } = useAuth();

  useEffect(() => {
    // Attempt to restore session. The rejected case in authSlice
    // sets isInitialized: true so the app always unblocks.
    dispatch(fetchCurrentUser()).catch(() => {});

    // Hard safety timeout — if 4 seconds pass and we are still
    // not initialized, force the app to unblock. This handles
    // any edge case where the rejected action does not fire.
    const timeout = setTimeout(() => {
      dispatch(setInitialized());
    }, 4000);

    return () => clearTimeout(timeout);
  }, [dispatch]);

  if (!isInitialized) return <PageLoader />;
  return <>{children}</>;
};

// ─── Protected route ──────────────────────────────────────────

const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}> = ({ children, allowedRoles }) => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// ─── Public route (redirect if already authed) ────────────────

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

// ─── Dashboard index — routes to role-appropriate dashboard ──

const DashboardIndex: React.FC = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/auth/login" replace />;
  if (user.role === UserRole.ADMIN) return <AdminDashboard />;
  if (user.role === UserRole.DOCTOR) return <DoctorDashboard />;
  return <PatientDashboard />;
};

// ─── App Router ───────────────────────────────────────────────

export const AppRouter: React.FC = () => (
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <AuthInitializer>
      <Routes>

        {/* ── Public / landing ───────────────────────────── */}
        <Route path="/" element={<LandingPage />} />

        {/* ── Auth routes ────────────────────────────────── */}
        <Route element={<AuthLayout />}>
          <Route path="/auth/login" element={
            <PublicRoute><LoginPage /></PublicRoute>
          } />
          <Route path="/auth/register/patient" element={
            <PublicRoute><PatientRegisterPage /></PublicRoute>
          } />
          <Route path="/auth/register/doctor" element={
            <PublicRoute><DoctorRegisterPage /></PublicRoute>
          } />
          <Route path="/auth/forgot-password" element={
            <PublicRoute><ForgotPasswordPage /></PublicRoute>
          } />
          <Route path="/auth/reset-password" element={
            <PublicRoute><ResetPasswordPage /></PublicRoute>
          } />
        </Route>

        {/* ── Payment callbacks (no dashboard chrome) ─────── */}
        <Route path="/payment/success" element={<PaymentSuccessPage />} />
        <Route path="/payment/failed" element={<PaymentFailedPage />} />

        {/* ── Video call (full-screen, no dashboard chrome) */}
        <Route path="/session/:id" element={
          <ProtectedRoute><VideoCallPage /></ProtectedRoute>
        } />

        {/* ── Dashboard ──────────────────────────────────── */}
        <Route path="/dashboard" element={
          <ProtectedRoute><DashboardLayout /></ProtectedRoute>
        }>
          <Route index element={<DashboardIndex />} />

          {/* ── Shared ─────────────────────────────────── */}
          <Route path="profile" element={
            <ProtectedRoute><ProfilePage /></ProtectedRoute>
          } />
          <Route path="notifications" element={
            <ProtectedRoute><NotificationsPage /></ProtectedRoute>
          } />
          <Route path="wallet" element={
            <ProtectedRoute allowedRoles={[UserRole.PATIENT]}>
              <WalletPage />
            </ProtectedRoute>
          } />

          {/* ── Patient & Doctor routes ─────────────────── */}
          <Route path="appointments" element={
            <ProtectedRoute allowedRoles={[UserRole.PATIENT, UserRole.DOCTOR, UserRole.ADMIN]}>
              <AppointmentsRouteHandler />
            </ProtectedRoute>
          } />
          <Route path="appointments/new" element={
            <ProtectedRoute allowedRoles={[UserRole.PATIENT]}>
              <NewAppointmentPage />
            </ProtectedRoute>
          } />
          <Route path="appointments/:id" element={
            <ProtectedRoute><AppointmentDetailPage /></ProtectedRoute>
          } />

          {/* ── Patient routes ─────────────────────────── */}
          <Route path="investigations" element={
            <ProtectedRoute allowedRoles={[UserRole.PATIENT, UserRole.DOCTOR]}>
              <InvestigationsListPage />
            </ProtectedRoute>
          } />
          <Route path="investigations/new" element={
            <ProtectedRoute allowedRoles={[UserRole.PATIENT]}>
              <NewInvestigationPage />
            </ProtectedRoute>
          } />
          <Route path="investigations/:id" element={
            <ProtectedRoute><InvestigationDetailPage /></ProtectedRoute>
          } />
          <Route path="prescriptions" element={
            <ProtectedRoute allowedRoles={[UserRole.PATIENT, UserRole.DOCTOR]}>
              <PrescriptionsPage />
            </ProtectedRoute>
          } />

          {/* ── Doctor routes ──────────────────────────── */}
          <Route path="patients" element={
            <ProtectedRoute allowedRoles={[UserRole.DOCTOR, UserRole.ADMIN]}>
              <AdminPatientsPage />
            </ProtectedRoute>
          } />
          <Route path="credentials" element={
            <ProtectedRoute allowedRoles={[UserRole.DOCTOR]}>
              <DoctorCredentialsPage />
            </ProtectedRoute>
          } />
          <Route path="earnings" element={
            <ProtectedRoute allowedRoles={[UserRole.DOCTOR, UserRole.ADMIN]}>
              <EarningsRouteHandler />
            </ProtectedRoute>
          } />

          {/* ── Admin routes ───────────────────────────── */}
          <Route path="payouts" element={
            <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
              <AdminPayoutsPage />
            </ProtectedRoute>
          } />

          {/* ── Admin routes ───────────────────────────── */}
          <Route path="doctors" element={
            <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
              <AdminDoctorsPage />
            </ProtectedRoute>
          } />
          <Route path="doctors/:id" element={
            <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
              <AdminDoctorDetailPage />
            </ProtectedRoute>
          } />
          <Route path="patients/:id" element={
            <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
              <AdminPatientDetailPage />
            </ProtectedRoute>
          } />
          <Route path="audit" element={
            <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
              <AdminAuditLogsPage />
            </ProtectedRoute>
          } />
          <Route path="settings" element={
            <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
              <AdminSettingsPage />
            </ProtectedRoute>
          } />
        </Route>

        {/* ── Catch-all ──────────────────────────────────── */}
        <Route path="*" element={
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center space-y-3">
              <p className="font-display text-6xl font-bold text-[var(--text-muted)]">404</p>
              <p className="text-[var(--text-secondary)]">Page not found</p>
              <a href="/dashboard" className="btn btn-primary inline-flex">Go home</a>
            </div>
          </div>
        } />

      </Routes>
    </AuthInitializer>
  </BrowserRouter>
);
