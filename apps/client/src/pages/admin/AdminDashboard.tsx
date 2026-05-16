import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, Stethoscope, Calendar, DollarSign,
  CheckCircle, XCircle, Clock, ArrowRight, Activity,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiGet, apiPost } from '@/services/api';
import { Card, StatCard, StatusBadge, EmptyState, SkeletonCard } from '@/components/common/index';
import { Button } from '@/components/common/Button';
import { formatDateTime } from '@/utils';

interface Analytics {
  users: { totalPatients: number; totalDoctors: number; pendingDoctors: number; onlineDoctors: number };
  appointments: { total: number; today: number };
  investigations: { total: number };
  revenue: { totalKobo: number; totalNGN: string };
}

interface PendingDoctor {
  id: string;
  licenseNumber: string;
  discipline: string;
  status: string;
  createdAt: string;
  user: { firstName: string; lastName: string; email: string };
  credentials: { id: string; fileName: string }[];
}

export const AdminDashboard: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: analytics } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: () => apiGet<Analytics>('/admin/analytics'),
    staleTime: 60_000,
  });

  const { data: pendingDoctors, isLoading } = useQuery({
    queryKey: ['admin-pending-doctors'],
    queryFn: () => apiGet<{ items: PendingDoctor[] }>('/admin/doctors?status=PENDING_VERIFICATION&pageSize=10'),
    staleTime: 30_000,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/admin/doctors/${id}/approve`),
    onSuccess: () => {
      toast.success('Doctor approved');
      void queryClient.invalidateQueries({ queryKey: ['admin-pending-doctors'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-analytics'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) =>
      apiPost(`/admin/doctors/${id}/reject`, { reason: 'Credentials could not be verified. Please resubmit.' }),
    onSuccess: () => {
      toast.success('Doctor rejected');
      void queryClient.invalidateQueries({ queryKey: ['admin-pending-doctors'] });
    },
  });

  return (
    <div className="page-container py-6 space-y-6 animate-fade-in">

      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
          Admin overview
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          Platform status and management
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total patients"
          value={analytics?.users.totalPatients ?? 0}
          icon={<Users size={16} />}
        />
        <StatCard
          label="Verified doctors"
          value={analytics?.users.totalDoctors ?? 0}
          icon={<Stethoscope size={16} />}
        />
        <StatCard
          label="Appointments today"
          value={analytics?.appointments.today ?? 0}
          icon={<Calendar size={16} />}
        />
        <StatCard
          label="Total revenue"
          value={analytics ? `₦${analytics.revenue.totalNGN}` : '—'}
          icon={<DollarSign size={16} />}
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card padding="md" className="bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800">
          <div className="flex items-center gap-3">
            <Clock size={18} className="text-yellow-600" />
            <div>
              <p className="text-lg font-display font-semibold text-yellow-700 dark:text-yellow-400">
                {analytics?.users.pendingDoctors ?? 0}
              </p>
              <p className="text-xs text-yellow-600/80">Pending verification</p>
            </div>
          </div>
        </Card>
        <Card padding="md" className="bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800">
          <div className="flex items-center gap-3">
            <Activity size={18} className="text-green-600" />
            <div>
              <p className="text-lg font-display font-semibold text-green-700 dark:text-green-400">
                {analytics?.users.onlineDoctors ?? 0}
              </p>
              <p className="text-xs text-green-600/80">Doctors online now</p>
            </div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-3">
            <Calendar size={18} className="text-[var(--text-muted)]" />
            <div>
              <p className="text-lg font-display font-semibold text-[var(--text-primary)]">
                {analytics?.appointments.total ?? 0}
              </p>
              <p className="text-xs text-[var(--text-muted)]">Total appointments</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Pending doctor verifications */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-title">Pending doctor verifications</h2>
          <Link
            to="/dashboard/doctors"
            className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 flex items-center gap-1 transition-colors"
          >
            View all doctors <ArrowRight size={14} />
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : !pendingDoctors?.items.length ? (
          <EmptyState
            icon={<CheckCircle size={24} />}
            title="All caught up"
            description="No pending doctor verifications at this time."
          />
        ) : (
          <div className="space-y-3">
            {pendingDoctors.items.map((doctor) => (
              <PendingDoctorCard
                key={doctor.id}
                doctor={doctor}
                onApprove={() => approveMutation.mutate(doctor.id)}
                onReject={() => rejectMutation.mutate(doctor.id)}
                isApproving={approveMutation.isPending && approveMutation.variables === doctor.id}
                isRejecting={rejectMutation.isPending && rejectMutation.variables === doctor.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Quick admin links */}
      <div>
        <h2 className="section-title mb-3">Management</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { to: '/dashboard/doctors', icon: Stethoscope, label: 'Doctors' },
            { to: '/dashboard/patients', icon: Users, label: 'Patients' },
            { to: '/dashboard/appointments', icon: Calendar, label: 'Appointments' },
            { to: '/dashboard/audit', icon: Activity, label: 'Audit logs' },
          ].map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className="card p-4 flex flex-col items-center gap-2 text-center hover:shadow-card-md transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center group-hover:bg-brand-100 transition-colors">
                <Icon size={18} className="text-brand-600 dark:text-brand-400" />
              </div>
              <span className="text-sm font-medium text-[var(--text-secondary)]">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Pending doctor card ──────────────────────────────────────

const PendingDoctorCard: React.FC<{
  doctor: PendingDoctor;
  onApprove: () => void;
  onReject: () => void;
  isApproving: boolean;
  isRejecting: boolean;
}> = ({ doctor, onApprove, onReject, isApproving, isRejecting }) => (
  <Card padding="md">
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center flex-shrink-0">
        <Stethoscope size={18} className="text-brand-600 dark:text-brand-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
          <p className="font-medium text-[var(--text-primary)]">
            Dr. {doctor.user.firstName} {doctor.user.lastName}
          </p>
          <StatusBadge status={doctor.status} />
        </div>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          {doctor.user.email} · License: {doctor.licenseNumber}
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          {doctor.discipline.replace(/_/g, ' ')} · Applied {formatDateTime(doctor.createdAt)} ·{' '}
          {doctor.credentials.length} credential file(s)
        </p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <Button
          size="sm"
          variant="secondary"
          onClick={onReject}
          loading={isRejecting}
          leftIcon={<XCircle size={14} />}
          className="border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10"
        >
          Reject
        </Button>
        <Button
          size="sm"
          onClick={onApprove}
          loading={isApproving}
          leftIcon={<CheckCircle size={14} />}
        >
          Approve
        </Button>
      </div>
    </div>
  </Card>
);
