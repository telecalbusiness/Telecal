import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar, Search, FileText, AlertTriangle,
  ArrowRight, Stethoscope, Activity, Bell,
} from 'lucide-react';
import { apiGet } from '@/services/api';
import { useAuth } from '@/hooks/useAppDispatch';
import {
  Card, StatCard, StatusBadge, EmptyState, SkeletonCard,
} from '@/components/common/index';
import { Button } from '@/components/common/Button';
import { formatDateTime, formatCurrency } from '@/utils';

interface DashboardData {
  fileNumber: string;
  activeAppointments: number;
  pendingInvestigations: number;
  unreadNotifications: number;
  recentAppointments: Array<{
    id: string;
    consultationType: string;
    status: string;
    createdAt: string;
    doctor: { user: { firstName: string; lastName: string } } | null;
    payment: { status: string; amountKobo: number; paidAt: string | null } | null;
  }>;
}

export const PatientDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['patient-dashboard'],
    queryFn: () => apiGet<DashboardData>('/patients/me/dashboard'),
    staleTime: 30_000,
  });

  return (
    <div className="page-container py-6 space-y-6 animate-fade-in">

      {/* Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
            Good morning, {user?.firstName} 👋
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            File number:{' '}
            <span className="font-mono text-brand-600 dark:text-brand-400 font-medium">
              {data?.fileNumber ?? '—'}
            </span>
          </p>
        </div>
        <Button
          onClick={() => navigate('/dashboard/appointments/new')}
          leftIcon={<Stethoscope size={16} />}
          size="md"
        >
          New consultation
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active consultations"
          value={data?.activeAppointments ?? 0}
          icon={<Activity size={16} />}
        />
        <StatCard
          label="Pending investigations"
          value={data?.pendingInvestigations ?? 0}
          icon={<Search size={16} />}
        />
        <StatCard
          label="Unread notifications"
          value={data?.unreadNotifications ?? 0}
          icon={<Bell size={16} />}
        />
        <StatCard
          label="File number"
          value={data?.fileNumber ?? '—'}
          icon={<FileText size={16} />}
        />
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="section-title mb-3">Quick actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <QuickAction
            icon={<Stethoscope size={20} />}
            title="General practitioner"
            description="Consult a GP online — available now"
            to="/dashboard/appointments/new?type=GENERAL_PRACTICE"
            color="brand"
          />
          <QuickAction
            icon={<Search size={20} />}
            title="Specialist"
            description="Find a specialist for your condition"
            to="/dashboard/appointments/new?type=SPECIALIST"
            color="blue"
          />
          <QuickAction
            icon={<FileText size={20} />}
            title="Upload investigation"
            description="Submit a lab report or scan for review"
            to="/dashboard/investigations/new"
            color="purple"
          />
        </div>
      </div>

      {/* Recent appointments */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-title">Recent consultations</h2>
          <Link
            to="/dashboard/appointments"
            className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 flex items-center gap-1 transition-colors"
          >
            View all <ArrowRight size={14} />
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : !data?.recentAppointments.length ? (
          <EmptyState
            icon={<Calendar size={24} />}
            title="No consultations yet"
            description="Book your first consultation with a verified doctor."
            action={
              <Button
                size="sm"
                onClick={() => navigate('/dashboard/appointments/new')}
              >
                Book now
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {data.recentAppointments.map((apt) => (
              <AppointmentRow key={apt.id} appointment={apt} />
            ))}
          </div>
        )}
      </div>

      {/* Emergency triage banner */}
      <Card className="border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10" padding="md">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-700 dark:text-red-400">
              Medical emergency?
            </p>
            <p className="text-xs text-red-600/80 dark:text-red-500/80 mt-0.5">
              Mark your consultation as <strong>Urgent</strong> when booking to alert
              all available GPs immediately.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

// ─── Quick action card ────────────────────────────────────────

const colorMap = {
  brand:  'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 group-hover:bg-brand-100 dark:group-hover:bg-brand-900/30',
  blue:   'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 group-hover:bg-blue-100',
  purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 group-hover:bg-purple-100',
};

const QuickAction: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  to: string;
  color: keyof typeof colorMap;
}> = ({ icon, title, description, to, color }) => (
  <Link to={to} className="group card p-4 flex items-start gap-3 hover:shadow-card-md transition-all">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${colorMap[color]}`}>
      {icon}
    </div>
    <div className="min-w-0">
      <p className="font-medium text-sm text-[var(--text-primary)]">{title}</p>
      <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">{description}</p>
    </div>
    <ArrowRight size={14} className="text-[var(--text-muted)] flex-shrink-0 mt-1 group-hover:translate-x-0.5 transition-transform" />
  </Link>
);

// ─── Appointment row ──────────────────────────────────────────

const AppointmentRow: React.FC<{ appointment: DashboardData['recentAppointments'][0] }> = ({ appointment }) => (
  <Link to={`/dashboard/appointments/${appointment.id}`} className="card p-4 flex items-center gap-4 hover:shadow-card-md transition-all group">
    <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center flex-shrink-0">
      <Stethoscope size={16} className="text-brand-600 dark:text-brand-400" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-[var(--text-primary)] truncate">
        {appointment.doctor
          ? `Dr. ${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName}`
          : 'Awaiting assignment'}
      </p>
      <p className="text-xs text-[var(--text-muted)]">
        {appointment.consultationType.replace(/_/g, ' ')} · {formatDateTime(appointment.createdAt)}
      </p>
    </div>
    <div className="flex items-center gap-2 flex-shrink-0">
      <StatusBadge status={appointment.status} />
      {appointment.payment && (
        <span className="text-xs text-[var(--text-muted)] hidden sm:block">
          {formatCurrency(appointment.payment.amountKobo)}
        </span>
      )}
      <ArrowRight size={14} className="text-[var(--text-muted)] group-hover:translate-x-0.5 transition-transform" />
    </div>
  </Link>
);
