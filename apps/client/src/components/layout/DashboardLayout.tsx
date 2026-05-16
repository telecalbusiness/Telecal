import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, Search, FileText, Bell,
  LogOut, Sun, Moon, Menu, X, Settings, Shield,
  Stethoscope, ClipboardList, Users, UserCircle,
  Wallet,
} from 'lucide-react';import { cn } from '@/utils';
import { useAuth, useAppDispatch } from '@/hooks/useAppDispatch';
import { useDarkMode } from '@/hooks/useDarkMode';
import { logoutUser } from '@/store/slices/authSlice';
import { Avatar } from '@/components/common';
import { UserRole } from '@mediconnect/shared';

// ─── Nav config per role ──────────────────────────────────────

const patientNav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/dashboard/appointments', icon: Calendar, label: 'Appointments' },
  { to: '/dashboard/investigations', icon: Search, label: 'Investigations' },
  { to: '/dashboard/prescriptions', icon: FileText, label: 'Prescriptions' },
  { to: '/dashboard/notifications', icon: Bell, label: 'Notifications' },
  { to: '/dashboard/profile', icon: UserCircle, label: 'Profile' },
  { to: '/dashboard/wallet', icon: Wallet, label: 'Wallet' },
];

const doctorNav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/dashboard/patients', icon: Users, label: 'Patients' },
  { to: '/dashboard/appointments', icon: Calendar, label: 'Appointments' },
  { to: '/dashboard/investigations', icon: ClipboardList, label: 'Investigations' },
  { to: '/dashboard/prescriptions', icon: FileText, label: 'Prescriptions' },
  { to: '/dashboard/credentials', icon: Shield, label: 'Credentials' },
  { to: '/dashboard/notifications', icon: Bell, label: 'Notifications' },
  { to: '/dashboard/profile', icon: UserCircle, label: 'Profile' },
];

const adminNav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/dashboard/doctors', icon: Stethoscope, label: 'Doctors' },
  { to: '/dashboard/patients', icon: Users, label: 'Patients' },
  { to: '/dashboard/appointments', icon: Calendar, label: 'Appointments' },
  { to: '/dashboard/audit', icon: Shield, label: 'Audit Logs' },
  { to: '/dashboard/settings', icon: Settings, label: 'Settings' },
];

const navByRole = {
  [UserRole.PATIENT]: patientNav,
  [UserRole.DOCTOR]:  doctorNav,
  [UserRole.ADMIN]:   adminNav,
};

// ─── Sidebar component ────────────────────────────────────────

const Sidebar: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { user } = useAuth();
  const { isDark, toggle } = useDarkMode();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const navItems = user ? navByRole[user.role] : [];

  const handleLogout = async () => {
    await dispatch(logoutUser());
    navigate('/auth/login');
  };

  return (
    <aside className="flex flex-col h-full bg-[var(--surface-0)] border-r border-[var(--border)] w-64 flex-shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shadow-brand">
            <Stethoscope size={16} className="text-white" />
          </div>
          <span className="font-display font-semibold text-[var(--text-primary)] tracking-tight">
            Telecal
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} className="btn btn-ghost p-1 rounded-lg lg:hidden">
            <X size={18} />
          </button>
        )}
      </div>

      {/* User info */}
      {user && (
        <div className="px-4 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <Avatar firstName={user.firstName} lastName={user.lastName} avatarUrl={user.avatarUrl} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                {user.role === UserRole.DOCTOR ? 'Dr. ' : ''}{user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-[var(--text-muted)] truncate capitalize">
                {user.role.toLowerCase()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => cn('nav-item', isActive && 'active')}
            onClick={onClose}
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="px-3 py-3 border-t border-[var(--border)] space-y-0.5">
        <button onClick={toggle} className="nav-item w-full">
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
          {isDark ? 'Light mode' : 'Dark mode'}
        </button>
        <button onClick={() => void handleLogout()} className="nav-item w-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10">
          <LogOut size={18} />
          Sign out
        </button>
      </div>
    </aside>
  );
};

// ─── Dashboard layout ─────────────────────────────────────────

export const DashboardLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--surface-1)]">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative z-50 animate-slide-down">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-0)]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="btn btn-ghost p-2 rounded-lg"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-brand-600 flex items-center justify-center">
              <Stethoscope size={12} className="text-white" />
            </div>
            <span className="font-display font-semibold text-sm">Telecal</span>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
