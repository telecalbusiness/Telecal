import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, Calendar, ClipboardList, Power, PowerOff,
  ArrowRight, Clock, Activity,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiGet, apiPost } from '@/services/api';
import { useAuth } from '@/hooks/useAppDispatch';
import {
  Card, StatCard, StatusBadge, EmptyState, Badge,
} from '@/components/common/index';
import { Button } from '@/components/common/Button';
import { formatDateTime, formatDiscipline, cn } from '@/utils';

interface DoctorDashboardData {
  // When verified — full data
  doctor?: {
    id: string;
    name: string;
    discipline: string;
    presence: 'ONLINE' | 'OFFLINE' | 'BUSY';
    onlineSince: string | null;
    currentPatientCount: number;
  };
  stats?: {
    activePatients: number;
    completedToday: number;
    completedThisWeek: number;
    completedThisMonth: number;
    pendingInvestigations: number;
    unreadNotifications: number;
  };
  // When pending — only these fields
  status?: string;
  message?: string;
}

interface ActivePatient {
  id: string;
  status: string;
  consultationType: string;
  assignedAt: string | null;
  priority: string;
  patient: {
    fileNumber: string;
    user: { firstName: string; lastName: string };
  };
}

export const DoctorDashboard: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['doctor-dashboard'],
    queryFn: () => apiGet<DoctorDashboardData>('/doctors/me/dashboard'),
    refetchInterval: 15_000,
  });

  const { data: patients } = useQuery({
    queryKey: ['doctor-active-patients'],
    queryFn: () => apiGet<ActivePatient[]>('/doctors/me/patients'),
    refetchInterval: 10_000,
    // Only fetch if doctor is verified
    enabled: !!data?.doctor,
  });

  const goOnlineMutation = useMutation({
    mutationFn: () => apiPost('/doctors/me/go-online'),
    onSuccess: () => {
      toast.success('You are now online and accepting patients');
      void queryClient.invalidateQueries({ queryKey: ['doctor-dashboard'] });
    },
  });

  const goOfflineMutation = useMutation({
    mutationFn: () => apiPost('/doctors/me/go-offline'),
    onSuccess: () => {
      toast.success('You are now offline');
      void queryClient.invalidateQueries({ queryKey: ['doctor-dashboard'] });
    },
  });

  // ── Loading skeleton ──────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="page-container py-6 space-y-4">
        <div className="skeleton h-8 w-64 rounded-xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // ── Pending verification state ─────────────────────────────────
  // Server returns { status, message } without a `doctor` key
  // when the account is not yet verified. Check this FIRST
  // before accessing any doctor properties.
  if (!data?.doctor) {
    return (
      <div className="page-container py-6 h-screen flex items-center justify-center">
        <Card padding="lg" className="max-w-md mx-auto text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center mx-auto">
            <Clock size={24} className="text-yellow-600" />
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold text-[var(--text-primary)]">
              Verification pending
            </h2>
            <p className="text-sm text-[var(--text-muted)] mt-1 leading-relaxed">
              Our admin team is reviewing your credentials. You'll receive an email
              notification within 24–48 hours once approved.
            </p>
          </div>
          <Badge variant="warning">Pending verification</Badge>
          <Link
            to="/dashboard/credentials"
            className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 transition-colors block"
          >
            Upload supporting documents →
          </Link>
        </Card>
      </div>
    );
  }

  // ── Verified doctor dashboard ─────────────────────────────────
  // data.doctor is guaranteed to exist from here onwards
  const presence = data.doctor.presence;
  const isOnline = presence === 'ONLINE' || presence === 'BUSY';

  return (
    <div className="page-container py-6 space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
            {data.doctor.name ?? `Dr. ${user?.firstName} ${user?.lastName}`}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {formatDiscipline(data.doctor.discipline)}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className={cn(
              'status-dot',
              presence === 'ONLINE' && 'online',
              presence === 'BUSY' && 'busy',
              presence === 'OFFLINE' && 'offline',
            )} />
            <span className="text-[var(--text-secondary)] font-medium capitalize">
              {presence.toLowerCase()}
            </span>
          </div>

          {isOnline ? (
            <Button
              variant="secondary"
              leftIcon={<PowerOff size={15} />}
              loading={goOfflineMutation.isPending}
              onClick={() => goOfflineMutation.mutate()}
              className="border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10"
            >
              Go offline
            </Button>
          ) : (
            <Button
              leftIcon={<Power size={15} />}
              loading={goOnlineMutation.isPending}
              onClick={() => goOnlineMutation.mutate()}
            >
              Go online
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="Active patients"
          value={data.stats?.activePatients ?? 0}
          icon={<Users size={16} />}
        />
        <StatCard
          label="Completed today"
          value={data.stats?.completedToday ?? 0}
          icon={<Activity size={16} />}
        />
        <StatCard
          label="Pending investigations"
          value={data.stats?.pendingInvestigations ?? 0}
          icon={<ClipboardList size={16} />}
        />
      </div>

      {/* Weekly and monthly performance */}
      <div>
        <h2 className="section-title mb-3">Performance</h2>
        <div className="grid grid-cols-2 gap-4">
          <Card padding="md" className="bg-brand-50 dark:bg-brand-900/10 border-brand-200 dark:border-brand-800">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium text-brand-700 dark:text-brand-400 uppercase tracking-wide">
                This week
              </p>
              <Activity size={14} className="text-brand-500" />
            </div>
            <p className="font-display text-3xl font-semibold text-brand-700 dark:text-brand-300">
              {data.stats?.completedThisWeek ?? 0}
            </p>
            <p className="text-xs text-brand-600/70 dark:text-brand-400/70 mt-0.5">
              patients attended to
            </p>
          </Card>
          <Card padding="md" className="bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium text-blue-700 dark:text-blue-400 uppercase tracking-wide">
                This month
              </p>
              <Calendar size={14} className="text-blue-500" />
            </div>
            <p className="font-display text-3xl font-semibold text-blue-700 dark:text-blue-300">
              {data.stats?.completedThisMonth ?? 0}
            </p>
            <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-0.5">
              patients attended to
            </p>
          </Card>
        </div>
      </div>

      {/* Online banner */}
      {isOnline && (
        <Card className={cn(
          'border-0',
          presence === 'BUSY'
            ? 'bg-yellow-50 dark:bg-yellow-900/10'
            : 'bg-green-50 dark:bg-green-900/10',
        )} padding="md">
          <div className="flex items-center gap-3">
            <span className={cn('status-dot flex-shrink-0', presence === 'BUSY' ? 'busy' : 'online')} />
            <div>
              <p className={cn(
                'text-sm font-medium',
                presence === 'BUSY'
                  ? 'text-yellow-700 dark:text-yellow-400'
                  : 'text-green-700 dark:text-green-400',
              )}>
                {presence === 'BUSY'
                  ? 'You are busy — at patient capacity'
                  : 'You are online and accepting patients'}
              </p>
              {data.doctor.onlineSince && (
                <p className="text-xs text-[var(--text-muted)]">
                  Since {formatDateTime(data.doctor.onlineSince)}
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Active patients */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-title">Active patients</h2>
          <Link
            to="/dashboard/appointments"
            className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 flex items-center gap-1 transition-colors"
          >
            All appointments <ArrowRight size={14} />
          </Link>
        </div>

        {!patients?.length ? (
          <EmptyState
            icon={<Users size={24} />}
            title={isOnline ? 'No patients assigned yet' : 'Go online to receive patients'}
            description={
              isOnline
                ? 'The system will assign patients to you automatically when they request a consultation.'
                : 'Click "Go online" to start accepting patient consultations.'
            }
          />
        ) : (
          <div className="space-y-3">
            {patients.map((p) => (
              <PatientRow key={p.id} patient={p} />
            ))}
          </div>
        )}
      </div>

      {/* Investigations */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-title">Investigations</h2>
          <Link
            to="/dashboard/investigations"
            className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 flex items-center gap-1 transition-colors"
          >
            View all <ArrowRight size={14} />
          </Link>
        </div>
        <Card padding="md" className="bg-[var(--surface-2)] border-dashed">
          <div className="flex items-center gap-3">
            <ClipboardList size={18} className="text-[var(--text-muted)]" />
            <p className="text-sm text-[var(--text-secondary)]">
              {data.stats?.pendingInvestigations
                ? `You have ${data.stats.pendingInvestigations} investigation report(s) awaiting review`
                : 'No pending investigation reports'}
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

const PatientRow: React.FC<{ patient: ActivePatient }> = ({ patient }) => (
  <Link
    to={`/dashboard/appointments/${patient.id}`}
    className="card p-4 flex items-center gap-4 hover:shadow-card-md transition-all group"
  >
    <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center flex-shrink-0">
      <Users size={16} className="text-brand-600 dark:text-brand-400" />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-[var(--text-primary)]">
          {patient.patient.user.firstName} {patient.patient.user.lastName}
        </p>
        {patient.priority === 'URGENT' && (
          <Badge variant="danger">Urgent</Badge>
        )}
      </div>
      <p className="text-xs text-[var(--text-muted)]">
        File: {patient.patient.fileNumber} ·{' '}
        {patient.assignedAt ? formatDateTime(patient.assignedAt) : 'Just assigned'}
      </p>
    </div>
    <div className="flex items-center gap-2 flex-shrink-0">
      <StatusBadge status={patient.status} />
      <ArrowRight size={14} className="text-[var(--text-muted)] group-hover:translate-x-0.5 transition-transform" />
    </div>
  </Link>
);