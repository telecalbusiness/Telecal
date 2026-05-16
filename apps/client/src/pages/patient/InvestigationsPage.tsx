import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Search, Plus, Upload, ChevronRight, FileText,
  ArrowLeft, CheckCircle2, CreditCard,
} from 'lucide-react';
import { apiGet, apiPost } from '@/services/api';
import { useAuth } from '@/hooks/useAppDispatch';
import { Button } from '@/components/common/Button';
import { Card, StatusBadge, EmptyState, Skeleton } from '@/components/common/index';
import { formatDateTime, cn } from '@/utils';
import { FEES } from '@mediconnect/shared';
import { formatCurrency } from '@/utils';
import { UserRole } from '@mediconnect/shared';

// ─── Investigations list ──────────────────────────────────────

interface InvestigationItem {
  id: string;
  status: string;
  isReturningPatient: boolean;
  createdAt: string;
  reviewedAt: string | null;
  files: { id: string; fileName: string; fileType: string }[];
  patient?: { fileNumber: string; user: { firstName: string; lastName: string } };
  doctor?: { user: { firstName: string; lastName: string } } | null;
}

export const InvestigationsListPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isDoctor  = user?.role === UserRole.DOCTOR;

  const { data, isLoading } = useQuery({
    queryKey: ['investigations', isDoctor],
    queryFn: () => apiGet<{ items: InvestigationItem[]; total: number }>('/investigations'),
    staleTime: 20_000,
  });

  return (
    <div className="page-container py-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
            {isDoctor ? 'Investigation reports' : 'My investigations'}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {data ? `${data.total} total` : '—'}
          </p>
        </div>
        {!isDoctor && (
          <Button
            leftIcon={<Plus size={15} />}
            onClick={() => navigate('/dashboard/investigations/new')}
          >
            New investigation
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4 flex items-center gap-4">
              <Skeleton className="w-9 h-9 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
          ))}
        </div>
      ) : !data?.items.length ? (
        <EmptyState
          icon={<Search size={24} />}
          title={isDoctor ? 'No investigation reports assigned' : 'No investigations yet'}
          description={isDoctor
            ? 'Investigation reports assigned to you will appear here.'
            : 'Submit a lab result or scan after your consultation.'
          }
          action={!isDoctor ? (
            <Button size="sm" leftIcon={<Plus size={14} />}
              onClick={() => navigate('/dashboard/investigations/new')}>
              Submit report
            </Button>
          ) : undefined}
        />
      ) : (
        <div className="space-y-2">
          {data.items.map((inv) => (
            <InvestigationRow key={inv.id} investigation={inv} isDoctor={isDoctor} />
          ))}
        </div>
      )}
    </div>
  );
};

const InvestigationRow: React.FC<{
  investigation: InvestigationItem;
  isDoctor: boolean;
}> = ({ investigation, isDoctor }) => (
  <Link
    to={`/dashboard/investigations/${investigation.id}`}
    className="card p-4 flex items-center gap-3 hover:shadow-card-md transition-all group"
  >
    <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0">
      <FileText size={16} className="text-purple-600 dark:text-purple-400" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-[var(--text-primary)] truncate">
        {isDoctor && investigation.patient
          ? `${investigation.patient.user.firstName} ${investigation.patient.user.lastName} · ${investigation.patient.fileNumber}`
          : investigation.isReturningPatient ? 'Follow-up investigation' : 'New investigation'}
      </p>
      <p className="text-xs text-[var(--text-muted)]">
        {investigation.files.length} file{investigation.files.length !== 1 ? 's' : ''} ·{' '}
        {formatDateTime(investigation.createdAt)}
        {investigation.reviewedAt && ` · Reviewed ${formatDateTime(investigation.reviewedAt)}`}
      </p>
    </div>
    <div className="flex items-center gap-3 flex-shrink-0">
      <StatusBadge status={investigation.status} />
      <ChevronRight size={14} className="text-[var(--text-muted)] group-hover:translate-x-0.5 transition-transform" />
    </div>
  </Link>
);

// ─── New investigation page ───────────────────────────────────

export const NewInvestigationPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const linkedAppointmentId = searchParams.get('appointmentId');
  const [submitted, setSubmitted] = useState(false);
  const [investigationId, setInvestigationId] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      apiPost<{ id: string }>('/investigations', {
        appointmentId: linkedAppointmentId ?? undefined,
      }),
    onSuccess: (result) => {
      setInvestigationId(result.data.id);
      setSubmitted(true);
    },
  });

  const initPaymentMutation = useMutation({
    mutationFn: (id: string) =>
      apiPost<{ authorizationUrl: string }>(`/payments/investigations/${id}/initialize`),
    onSuccess: (result) => {
      window.location.href = result.data.authorizationUrl;
    },
  });

  const isReturning = !!linkedAppointmentId;
  const fee = isReturning ? FEES.INVESTIGATION_RETURNING_KOBO : FEES.INVESTIGATION_NEW_KOBO;

  if (submitted && investigationId) {
    return (
      <div className="page-container py-6 max-w-xl animate-slide-up">
        <Card padding="lg" className="text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center mx-auto">
            <CheckCircle2 size={28} className="text-brand-600" />
          </div>
          <div className="space-y-1.5">
            <h2 className="font-display text-xl font-semibold text-[var(--text-primary)]">
              Investigation request created
            </h2>
            <p className="text-sm text-[var(--text-muted)]">
              Complete the payment to unlock file upload and doctor assignment.
            </p>
          </div>
          <div className="rounded-xl bg-[var(--surface-2)] p-4 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)]">
                {isReturning ? 'Returning patient (discounted)' : 'New investigation'}
              </span>
              <span className="font-display font-semibold text-brand-600 dark:text-brand-400">
                {formatCurrency(fee)}
              </span>
            </div>
          </div>
          <Button
            className="w-full"
            size="lg"
            leftIcon={<CreditCard size={15} />}
            loading={initPaymentMutation.isPending}
            onClick={() => initPaymentMutation.mutate(investigationId)}
          >
            Pay {formatCurrency(fee)} to continue
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/investigations')}>
            Pay later
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-container py-6 animate-fade-in">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mb-5"
      >
        <ArrowLeft size={15} /> Back
      </button>

      <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)] tracking-tight mb-1">
        Submit investigation report
      </h1>
      <p className="text-sm text-[var(--text-muted)] mb-6">
        Upload lab results, scans, or any medical report for a doctor to review.
      </p>

      <div className="space-y-4">
        {/* Type */}
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center',
              isReturning
                ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400'
                : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
            )}>
              <Upload size={18} />
            </div>
            <div>
              <p className="font-medium text-sm text-[var(--text-primary)]">
                {isReturning ? 'Follow-up investigation (discounted)' : 'New investigation'}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {isReturning
                  ? 'Linked to your previous consultation — reduced fee applies'
                  : 'A doctor will be assigned to review your report'}
              </p>
            </div>
          </div>
        </Card>

        {/* Fee */}
        <Card className="bg-[var(--surface-2)]" padding="md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CreditCard size={16} className="text-brand-600" />
              <p className="text-sm font-medium text-[var(--text-primary)]">Investigation fee</p>
            </div>
            <span className="font-display text-xl font-semibold text-brand-600 dark:text-brand-400">
              {formatCurrency(fee)}
            </span>
          </div>
        </Card>

        {/* Info */}
        <div className="rounded-xl border border-[var(--border)] p-4 text-sm text-[var(--text-secondary)] space-y-1.5 bg-[var(--surface-0)]">
          <p className="font-medium text-[var(--text-primary)]">How it works</p>
          <p>1. Create your investigation request and pay the fee</p>
          <p>2. Upload your report files (up to 5 files, PDF or images)</p>
          <p>3. The system assigns an available doctor to review your reports</p>
          <p>4. You'll receive a notification when the review is complete</p>
        </div>

        <Button
          className="w-full"
          size="lg"
          loading={createMutation.isPending}
          leftIcon={<Upload size={15} />}
          onClick={() => createMutation.mutate()}
        >
          Create investigation request
        </Button>
      </div>
    </div>
  );
};
