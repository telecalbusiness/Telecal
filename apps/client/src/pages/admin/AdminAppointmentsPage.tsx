import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Calendar, ChevronLeft, ChevronRight, ChevronRight as Arrow } from 'lucide-react';
import { apiGet } from '@/services/api';
import { Button } from '@/components/common/Button';
import { StatusBadge, EmptyState, Skeleton } from '@/components/common/index';
import { formatDateTime, formatDiscipline, formatCurrency, cn } from '@/utils';

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'PENDING_PAYMENT', label: 'Pending payment' },
  { value: 'PAYMENT_CONFIRMED', label: 'Awaiting assignment' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'IN_SESSION', label: 'In session' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'TIMED_OUT', label: 'Timed out' },
];

interface AdminAppointment {
  id: string;
  consultationType: string;
  discipline: string | null;
  status: string;
  priority: string;
  createdAt: string;
  sessionStartedAt: string | null;
  sessionEndedAt: string | null;
  patient: {
    fileNumber: string;
    user: { firstName: string; lastName: string };
  };
  doctor: {
    discipline: string;
    user: { firstName: string; lastName: string };
  } | null;
  payment: { status: string; amountKobo: number; paidAt: string | null } | null;
}

export const AdminAppointmentsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-appointments', page, statusFilter],
    queryFn: () =>
      apiGet<{ items: AdminAppointment[]; total: number; totalPages: number }>(
        `/admin/appointments?page=${page}&pageSize=20${statusFilter ? `&status=${statusFilter}` : ''}`,
      ),
    staleTime: 15_000,
    refetchInterval: 30_000, // Refresh every 30s for live monitoring
  });

  return (
    <div className="page-container py-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
            Appointments
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {data ? `${data.total} total` : '—'} · Refreshes every 30 seconds
          </p>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-1 overflow-x-auto pb-2 mb-5">
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

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card p-4 flex items-center gap-4">
              <Skeleton className="w-9 h-9 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
          ))}
        </div>
      ) : !data?.items.length ? (
        <EmptyState
          icon={<Calendar size={24} />}
          title="No appointments found"
          description="No appointments match the selected filter."
        />
      ) : (
        <div className="space-y-2">
          {data.items.map((apt) => (
            <Link
              key={apt.id}
              to={`/dashboard/appointments/${apt.id}`}
              className="card p-4 flex items-start gap-4 hover:shadow-card-md transition-all group"
            >
              {/* Priority indicator */}
              <div className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                apt.priority === 'URGENT'
                  ? 'bg-red-100 dark:bg-red-900/20'
                  : 'bg-brand-50 dark:bg-brand-900/20',
              )}>
                <Calendar size={16} className={cn(
                  apt.priority === 'URGENT'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-brand-600 dark:text-brand-400',
                )} />
              </div>

              <div className="flex-1 min-w-0">
                {/* Patient and doctor */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mb-0.5">
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {apt.patient.user.firstName} {apt.patient.user.lastName}
                  </p>
                  <span className="text-[var(--text-muted)] text-xs">→</span>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {apt.doctor
                      ? `Dr. ${apt.doctor.user.firstName} ${apt.doctor.user.lastName}`
                      : 'No doctor assigned'}
                  </p>
                  {apt.priority === 'URGENT' && (
                    <span className="badge bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs">
                      Urgent
                    </span>
                  )}
                </div>

                {/* Meta row */}
                <p className="text-xs text-[var(--text-muted)]">
                  <span className="font-mono">{apt.patient.fileNumber}</span>
                  {' · '}
                  {apt.consultationType === 'GENERAL_PRACTICE'
                    ? 'General practitioner'
                    : apt.discipline ? formatDiscipline(apt.discipline) : 'Specialist'}
                  {' · '}
                  {formatDateTime(apt.createdAt)}
                  {apt.payment?.status === 'SUCCESSFUL' && (
                    <span className="text-green-600 dark:text-green-400">
                      {' · '}{formatCurrency(apt.payment.amountKobo)} paid
                    </span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <StatusBadge status={apt.status} />
                <Arrow size={14} className="text-[var(--text-muted)] group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--border)]">
          <p className="text-sm text-[var(--text-muted)]">
            Page {page} of {data.totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" leftIcon={<ChevronLeft size={14} />}
              disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="secondary" size="sm" rightIcon={<ChevronRight size={14} />}
              disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
