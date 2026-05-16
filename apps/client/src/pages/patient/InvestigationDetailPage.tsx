import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, FileText, Clock,
  Stethoscope, CheckCircle2, ClipboardList,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiGet, apiPatch } from '@/services/api';
import { useAuth } from '@/hooks/useAppDispatch';
import { Button } from '@/components/common/Button';
import { Textarea } from '@/components/common/Input';
import { Card, StatusBadge, Avatar, EmptyState, Skeleton } from '@/components/common/index';
import { formatDateTime, formatDiscipline } from '@/utils';
import { UserRole } from '@mediconnect/shared';

interface InvestigationDetail {
  id: string;
  status: string;
  isReturningPatient: boolean;
  doctorNotes: string | null;
  reviewedAt: string | null;
  createdAt: string;
  files: Array<{
    id: string;
    fileName: string;
    fileType: string;
    fileSizeBytes: number;
    uploadedAt: string;
  }>;
  patient: {
    fileNumber: string;
    userId: string;
    user: { firstName: string; lastName: string };
  };
  doctor: {
    userId: string;
    discipline: string;
    user: { firstName: string; lastName: string };
  } | null;
}

export const InvestigationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [reviewNotes, setReviewNotes] = useState('');
  const isDoctor = user?.role === UserRole.DOCTOR;

  const { data: investigation, isLoading } = useQuery({
    queryKey: ['investigation', id],
    queryFn: () => apiGet<InvestigationDetail>(`/investigations/${id!}`),
    enabled: !!id,
  });

  const reviewMutation = useMutation({
    mutationFn: () =>
      apiPatch(`/investigations/${id}/review`, { notes: reviewNotes }),
    onSuccess: () => {
      toast.success('Review submitted');
      setReviewNotes('');
      void queryClient.invalidateQueries({ queryKey: ['investigation', id] });
    },
  });

  if (isLoading) {
    return (
      <div className="page-container py-6 max-w-2xl space-y-4">
        <Skeleton className="h-4 w-24 rounded" />
        <Skeleton className="h-7 w-56 rounded-xl" />
        <Skeleton className="h-36 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (!investigation) {
    return (
      <div className="page-container py-12">
        <EmptyState icon={<ClipboardList size={24} />} title="Investigation not found" />
      </div>
    );
  }

  const canReview =
    isDoctor &&
    investigation.doctor?.userId === user?.id &&
    ['ASSIGNED', 'UNDER_REVIEW', 'REPORT_UPLOADED'].includes(investigation.status);

  return (
    <div className="page-container py-6 max-w-2xl animate-fade-in">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mb-5"
      >
        <ArrowLeft size={15} /> Back
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-xl font-semibold text-[var(--text-primary)] tracking-tight">
            {investigation.isReturningPatient ? 'Follow-up investigation' : 'New investigation'}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Submitted {formatDateTime(investigation.createdAt)}
          </p>
        </div>
        <StatusBadge status={investigation.status} />
      </div>

      <div className="space-y-4">
        {/* Parties */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card padding="md">
            <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">Patient</p>
            <div className="flex items-center gap-3">
              <Avatar
                firstName={investigation.patient.user.firstName}
                lastName={investigation.patient.user.lastName}
                size="lg"
              />
              <div>
                <p className="font-medium text-sm text-[var(--text-primary)]">
                  {investigation.patient.user.firstName} {investigation.patient.user.lastName}
                </p>
                <p className="text-xs font-mono text-brand-600 dark:text-brand-400">
                  {investigation.patient.fileNumber}
                </p>
              </div>
            </div>
          </Card>

          <Card padding="md">
            <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">
              Reviewing doctor
            </p>
            {investigation.doctor ? (
              <div className="flex items-center gap-3">
                <Avatar
                  firstName={investigation.doctor.user.firstName}
                  lastName={investigation.doctor.user.lastName}
                  size="lg"
                />
                <div>
                  <p className="font-medium text-sm text-[var(--text-primary)]">
                    Dr. {investigation.doctor.user.firstName} {investigation.doctor.user.lastName}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {formatDiscipline(investigation.doctor.discipline)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-[var(--text-muted)]">
                <div className="w-11 h-11 rounded-full border-2 border-dashed border-[var(--border)] flex items-center justify-center">
                  <Stethoscope size={18} />
                </div>
                <p className="text-sm">Awaiting assignment</p>
              </div>
            )}
          </Card>
        </div>

        {/* Report files */}
        <Card padding="md">
          <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">
            Report files ({investigation.files.length})
          </p>
          {investigation.files.length === 0 ? (
            <div className="flex items-center gap-2 text-[var(--text-muted)] py-2">
              <Clock size={16} />
              <p className="text-sm">No files uploaded yet — payment may be pending.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {investigation.files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface-2)]"
                >
                  <div className="w-8 h-8 rounded-lg bg-[var(--surface-3)] flex items-center justify-center flex-shrink-0">
                    <FileText size={15} className="text-[var(--text-muted)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {file.fileName}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {file.fileType} · {(file.fileSizeBytes / 1024).toFixed(0)} KB ·{' '}
                      Uploaded {formatDateTime(file.uploadedAt)}
                    </p>
                  </div>
                  {/* Files served via signed URL in production */}
                  <span className="text-xs text-[var(--text-muted)] hidden sm:block">
                    Secure file
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Doctor's review notes (read-only if reviewed) */}
        {investigation.doctorNotes && (
          <Card padding="md">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 size={16} className="text-brand-600" />
              <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
                Doctor's review
              </p>
              {investigation.reviewedAt && (
                <span className="text-xs text-[var(--text-muted)] ml-auto">
                  {formatDateTime(investigation.reviewedAt)}
                </span>
              )}
            </div>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
              {investigation.doctorNotes}
            </p>
          </Card>
        )}

        {/* Doctor review form */}
        {canReview && !investigation.doctorNotes && (
          <Card padding="md">
            <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">
              Submit your review
            </p>
            <div className="space-y-3">
              <Textarea
                label="Review notes"
                placeholder="Provide your assessment, findings, and any recommendations for the patient..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={5}
              />
              <div className="flex justify-end">
                <Button
                  loading={reviewMutation.isPending}
                  disabled={reviewNotes.trim().length < 10}
                  leftIcon={<CheckCircle2 size={15} />}
                  onClick={() => reviewMutation.mutate()}
                >
                  Submit review
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
