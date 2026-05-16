import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Calendar, ChevronLeft, ChevronRight, Plus, Stethoscope } from 'lucide-react';
import { apiGet } from '@/services/api';
import { useAuth } from '@/hooks/useAppDispatch';
import { Button } from '@/components/common/Button';
import { StatusBadge, EmptyState, Skeleton } from '@/components/common/index';
import { formatDateTime, formatDiscipline, cn } from '@/utils';
import { UserRole } from '@mediconnect/shared';

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'PENDING_PAYMENT', label: 'Pending payment' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'IN_SESSION', label: 'In session' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

interface AppointmentItem {
  id: string;
  consultationType: string;
  discipline: string | null;
  status: string;
  priority: string;
  createdAt: string;
  assignedAt: string | null;
  sessionEndedAt: string | null;
  patient?: {
    fileNumber: string;
    user: { firstName: string; lastName: string };
  };
  doctor?: {
    discipline: string;
    user: { firstName: string; lastName: string };
  } | null;
  payment?: { status: string; amountKobo: number } | null;
}

interface PaginatedResponse {
  items: AppointmentItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const AppointmentsListPage: React.FC = () => {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['appointments', page, statusFilter],
    queryFn: () =>
      apiGet<PaginatedResponse>('/appointments', {
        page,
        pageSize: 15,
        ...(statusFilter && { status: statusFilter }),
      }),
    staleTime: 15_000,
  });

  const isPatient = user?.role === UserRole.PATIENT;
  const isDoctor  = user?.role === UserRole.DOCTOR;

  return (
    <div className="page-container py-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
            {isDoctor ? 'Patient consultations' : 'My appointments'}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {data ? `${data.total} total` : '—'}
          </p>
        </div>
        {isPatient && (
          <Link to="/dashboard/appointments/new">
            <Button leftIcon={<Plus size={15} />}>
              New consultation
            </Button>
          </Link>
        )}
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 overflow-x-auto pb-2 mb-5 scrollbar-thin">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => { setStatusFilter(f.value); setPage(1); }}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex-shrink-0',
              statusFilter === f.value
                ? 'bg-brand-600 text-white'
                : 'bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--surface-3)]',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-4 flex items-center gap-4">
              <Skeleton className="w-9 h-9 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      ) : !data?.items.length ? (
        <EmptyState
          icon={<Calendar size={24} />}
          title="No appointments found"
          description={statusFilter ? 'Try changing the filter above.' : 'Book your first consultation to get started.'}
          action={isPatient ? (
            <Link to="/dashboard/appointments/new">
              <Button size="sm" leftIcon={<Plus size={14} />}>Book now</Button>
            </Link>
          ) : undefined}
        />
      ) : (
        <div className="space-y-2">
          {data.items.map((apt) => (
            <AppointmentRow key={apt.id} appointment={apt} isDoctor={isDoctor} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--border)]">
          <p className="text-sm text-[var(--text-muted)]">
            Page {data.page} of {data.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<ChevronLeft size={14} />}
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              rightIcon={<ChevronRight size={14} />}
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Appointment row ──────────────────────────────────────────

const AppointmentRow: React.FC<{
  appointment: AppointmentItem;
  isDoctor: boolean;
}> = ({ appointment, isDoctor }) => (
  <Link
    to={`/dashboard/appointments/${appointment.id}`}
    className="card p-4 flex items-center gap-3 hover:shadow-card-md transition-all group"
  >
    <div className={cn(
      'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
      appointment.status === 'IN_SESSION'
        ? 'bg-green-100 dark:bg-green-900/20'
        : 'bg-brand-50 dark:bg-brand-900/20',
    )}>
      <Stethoscope size={16} className={cn(
        appointment.status === 'IN_SESSION'
          ? 'text-green-600 dark:text-green-400'
          : 'text-brand-600 dark:text-brand-400',
      )} />
    </div>

    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-[var(--text-primary)] truncate">
          {isDoctor && appointment.patient
            ? `${appointment.patient.user.firstName} ${appointment.patient.user.lastName} · ${appointment.patient.fileNumber}`
            : appointment.doctor
            ? `Dr. ${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName}`
            : 'Awaiting doctor assignment'}
        </p>
        {appointment.priority === 'URGENT' && (
          <span className="badge bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs flex-shrink-0">
            Urgent
          </span>
        )}
      </div>
      <p className="text-xs text-[var(--text-muted)] truncate">
        {appointment.consultationType === 'GENERAL_PRACTICE'
          ? 'General practitioner'
          : appointment.discipline
          ? formatDiscipline(appointment.discipline)
          : 'Specialist'
        }
        {' · '}
        {formatDateTime(appointment.createdAt)}
      </p>
    </div>

    <div className="flex items-center gap-3 flex-shrink-0">
      <StatusBadge status={appointment.status} />
      <ChevronRight size={14} className="text-[var(--text-muted)] group-hover:translate-x-0.5 transition-transform" />
    </div>
  </Link>
);
