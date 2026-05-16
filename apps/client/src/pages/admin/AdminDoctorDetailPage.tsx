import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, CheckCircle, XCircle, AlertOctagon,
  Mail, Hash, Briefcase, Calendar, Star,
  FileText, Shield, Activity,
  AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiGet, apiPatch } from '@/services/api';
import { Button } from '@/components/common/Button';
import { Textarea } from '@/components/common/Input';
import { Card, StatusBadge, Avatar, Modal } from '@/components/common/index';
import { formatDateTime, formatDiscipline } from '@/utils';

interface DoctorDetail {
  id: string;
  licenseNumber: string;
  discipline: string;
  specialization: string | null;
  yearsOfExperience: number;
  bio: string | null;
  status: string;
  presence: string;
  currentPatientCount: number;
  averageRating: number | null;
  totalRatings: number;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    isEmailVerified: boolean;
    isActive: boolean;
    lastLoginAt: string | null;
    createdAt: string;
    avatarUrl: string | null;
  };
  credentials: Array<{
    id: string;
    fileName: string;
    fileType: string;
    fileSizeBytes: number;
    uploadedAt: string;
  }>;
  adminReviews: Array<{
    action: string;
    notes: string | null;
    reviewedAt: string;
    adminId: string;
  }>;
  stats: {
    totalAppointments: number;
    monthAppointments: number;
    weekAppointments: number;
    completedAppointments: number;
    totalInvestigations: number;
    totalPrescriptions: number;
    uniquePatientsSeen: number;
    revenueGeneratedNGN: string;
    completionRate: number;
  };
  recentAppointments: Array<{
    id: string;
    status: string;
    consultationType: string;
    createdAt: string;
    patient: {
      fileNumber: string;
      user: { firstName: string; lastName: string };
    };
  }>;
}

export const AdminDoctorDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [modalAction, setModalAction] = useState<'approve' | 'reject' | 'suspend' | null>(null);
  const [reason, setReason] = useState('');

  const { data: doctor, isLoading } = useQuery({
    queryKey: ['admin-doctor', id],
    queryFn: () => apiGet<DoctorDetail>(`/admin/doctors/${id!}`),
    enabled: !!id,
  });

  const { data: reviews } = useQuery({
    queryKey: ['admin-doctor-reviews', id],
    queryFn: () => apiGet<Array<{
      id: string;
      rating: number;
      comment: string | null;
      createdAt: string;
      patient: { fileNumber: string; user: { firstName: string; lastName: string } };
      appointment: { consultationType: string };
    }>>(`/admin/doctors/${id!}/reviews`),
    enabled: !!id,
  });

  const approveMutation = useMutation({
    mutationFn: () => apiPatch(`/admin/doctors/${id}/approve`, { notes: reason }),
    onSuccess: () => {
      toast.success('Doctor approved');
      setModalAction(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-doctor', id] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => apiPatch(`/admin/doctors/${id}/reject`, { reason }),
    onSuccess: () => {
      toast.success('Doctor rejected');
      setModalAction(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-doctor', id] });
    },
  });

  const suspendMutation = useMutation({
    mutationFn: () => apiPatch(`/admin/doctors/${id}/suspend`, { reason }),
    onSuccess: () => {
      toast.success('Doctor suspended');
      setModalAction(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-doctor', id] });
    },
  });

  const handleConfirm = () => {
    if (modalAction === 'approve') approveMutation.mutate();
    if (modalAction === 'reject') rejectMutation.mutate();
    if (modalAction === 'suspend') suspendMutation.mutate();
  };

  const isMutating = approveMutation.isPending || rejectMutation.isPending || suspendMutation.isPending;

  if (isLoading) {
    return (
      <div className="page-container py-6 space-y-4">
        <div className="skeleton h-4 w-24 rounded" />
        <div className="skeleton h-32 rounded-2xl" />
        <div className="skeleton h-48 rounded-2xl" />
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="page-container py-12 text-center">
        <p className="text-[var(--text-muted)]">Doctor not found</p>
      </div>
    );
  }

  return (
    <div className="page-container py-6 animate-fade-in">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mb-5"
      >
        <ArrowLeft size={15} /> Back to doctors
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Avatar firstName={doctor.user.firstName} lastName={doctor.user.lastName} size="xl" />
          <div>
            <h1 className="font-display text-xl font-semibold text-[var(--text-primary)]">
              Dr. {doctor.user.firstName} {doctor.user.lastName}
            </h1>
            <p className="text-sm text-[var(--text-muted)]">
              {formatDiscipline(doctor.discipline)}
              {doctor.specialization && ` · ${doctor.specialization}`}
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              <StatusBadge status={doctor.status} />
              {doctor.status === 'VERIFIED' && <StatusBadge status={doctor.presence} />}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2 flex-shrink-0">
          {doctor.status === 'PENDING_VERIFICATION' && (
            <>
              <Button size="sm" leftIcon={<CheckCircle size={13} />}
                onClick={() => { setReason(''); setModalAction('approve'); }}>
                Approve
              </Button>
              <Button size="sm" variant="secondary"
                leftIcon={<XCircle size={13} />}
                className="border-red-300 text-red-600"
                onClick={() => { setReason(''); setModalAction('reject'); }}>
                Reject
              </Button>
            </>
          )}
          {doctor.status === 'VERIFIED' && (
            <Button size="sm" variant="secondary"
              leftIcon={<AlertOctagon size={13} />}
              className="border-orange-300 text-orange-600"
              onClick={() => { setReason(''); setModalAction('suspend'); }}>
              Suspend
            </Button>
          )}
          {doctor.status === 'REJECTED' && (
            <Button size="sm" leftIcon={<CheckCircle size={13} />}
              onClick={() => { setReason(''); setModalAction('approve'); }}>
              Re-approve
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* Personal info */}
        <Card padding="md">
          <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">
            Account details
          </p>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Mail size={14} className="text-[var(--text-muted)]" />
              <div>
                <dt className="text-xs text-[var(--text-muted)]">Email</dt>
                <dd className="text-[var(--text-primary)]">{doctor.user.email}</dd>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Hash size={14} className="text-[var(--text-muted)]" />
              <div>
                <dt className="text-xs text-[var(--text-muted)]">MDCN Number</dt>
                <dd className="text-[var(--text-primary)] font-mono">{doctor.licenseNumber}</dd>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Briefcase size={14} className="text-[var(--text-muted)]" />
              <div>
                <dt className="text-xs text-[var(--text-muted)]">Experience</dt>
                <dd className="text-[var(--text-primary)]">{doctor.yearsOfExperience} years</dd>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-[var(--text-muted)]" />
              <div>
                <dt className="text-xs text-[var(--text-muted)]">Registered</dt>
                <dd className="text-[var(--text-primary)]">{formatDateTime(doctor.createdAt)}</dd>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-[var(--text-muted)]" />
              <div>
                <dt className="text-xs text-[var(--text-muted)]">Last login</dt>
                <dd className="text-[var(--text-primary)]">
                  {doctor.user.lastLoginAt ? formatDateTime(doctor.user.lastLoginAt) : 'Never'}
                </dd>
              </div>
            </div>
            {doctor.averageRating !== null && (
              <div className="flex items-center gap-2">
                <Star size={14} className="text-[var(--text-muted)]" />
                <div>
                  <dt className="text-xs text-[var(--text-muted)]">Rating (admin only)</dt>
                  <dd className="text-[var(--text-primary)]">
                    {doctor.averageRating.toFixed(1)} / 5 ({doctor.totalRatings} reviews)
                  </dd>
                </div>
              </div>
            )}
          </dl>
          {doctor.bio && (
            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <p className="text-xs text-[var(--text-muted)] mb-1">Bio</p>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{doctor.bio}</p>
            </div>
          )}
        </Card>

        {/* Stats overview */}
        {doctor.stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBox label="Total appointments" value={doctor.stats.totalAppointments} />
            <StatBox label="This month" value={doctor.stats.monthAppointments} />
            <StatBox label="This week" value={doctor.stats.weekAppointments} />
            <StatBox label="Completion rate" value={`${doctor.stats.completionRate}%`} />
            <StatBox label="Unique patients" value={doctor.stats.uniquePatientsSeen} />
            <StatBox label="Investigations" value={doctor.stats.totalInvestigations} />
            <StatBox label="Prescriptions issued" value={doctor.stats.totalPrescriptions} />
            <StatBox label="Revenue generated" value={`₦${doctor.stats.revenueGeneratedNGN}`} />
          </div>
        )}

        {/* Uploaded credentials */}
        <Card padding="md">
          <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">
            Uploaded documents ({doctor.credentials.length})
          </p>
          {doctor.credentials.length === 0 ? (
            <div className="flex items-center gap-3 py-4 text-[var(--text-muted)]">
              <AlertCircle size={18} />
              <p className="text-sm">No documents uploaded yet. The doctor has not submitted credentials.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {doctor.credentials.map((cred) => (
                <div
                  key={cred.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface-2)]"
                >
                  {/* File icon */}
                  <div className="w-9 h-9 rounded-lg bg-[var(--surface-0)] border border-[var(--border)] flex items-center justify-center flex-shrink-0">
                    {cred.fileType === 'application/pdf' ? (
                      <span className="text-xs font-bold text-red-600">PDF</span>
                    ) : (
                      <FileText size={16} className="text-[var(--text-muted)]" />
                    )}
                  </div>

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {cred.fileName}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {cred.fileType} · {(cred.fileSizeBytes / 1024).toFixed(0)} KB ·{' '}
                      {formatDateTime(cred.uploadedAt)}
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* View — opens in new tab (inline) */}
                    <a
                      href={`/api/v1/admin/doctors/${doctor.id}/credentials/${cred.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary text-xs px-3 py-1.5 rounded-lg"
                      title="View document"
                    >
                      View
                    </a>
                    {/* Download — forces download */}
                    <a
                      href={`/api/v1/admin/doctors/${doctor.id}/credentials/${cred.id}?download=1`}
                      download={cred.fileName}
                      className="btn btn-ghost text-xs px-3 py-1.5 rounded-lg"
                      title="Download document"
                    >
                      Download
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Review history */}
        {doctor.adminReviews.length > 0 && (
          <Card padding="md">
            <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">
              Review history
            </p>
            <div className="space-y-3">
              {doctor.adminReviews.map((review, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-[var(--surface-3)] flex items-center justify-center flex-shrink-0">
                    <Shield size={13} className="text-[var(--text-muted)]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={review.action} />
                      <span className="text-xs text-[var(--text-muted)]">
                        {formatDateTime(review.reviewedAt)}
                      </span>
                    </div>
                    {review.notes && (
                      <p className="text-xs text-[var(--text-secondary)] mt-1 italic">
                        "{review.notes}"
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Patient reviews */}
        {reviews && reviews.length > 0 && (
          <Card padding="md">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
                Patient reviews ({reviews.length})
              </p>
              {doctor.averageRating !== null && (
                <div className="flex items-center gap-1.5">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={13}
                        className={star <= Math.round(doctor.averageRating!)
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-[var(--text-muted)]'}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {doctor.averageRating.toFixed(1)}
                  </span>
                </div>
              )}
            </div>
            <div className="space-y-3">
              {reviews.map((review) => (
                <div key={review.id} className="p-3 rounded-xl bg-[var(--surface-2)]">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {review.patient.user.firstName} {review.patient.user.lastName}
                      </p>
                      <span className="text-xs text-[var(--text-muted)]">
                        {review.patient.fileNumber}
                      </span>
                    </div>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={12}
                          className={star <= review.rating
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-[var(--text-muted)]'}
                        />
                      ))}
                    </div>
                  </div>
                  {review.comment && (
                    <p className="text-xs text-[var(--text-secondary)] italic">"{review.comment}"</p>
                  )}
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    {review.appointment.consultationType.replace(/_/g, ' ')} ·{' '}
                    {formatDateTime(review.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Recent appointments */}
      {doctor.recentAppointments?.length > 0 && (
        <Card padding="md">
          <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">
            Recent appointments
          </p>
          <div className="space-y-2">
            {doctor.recentAppointments.map((apt) => (
              <div key={apt.id} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface-2)]">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {apt.patient.user.firstName} {apt.patient.user.lastName}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {apt.patient.fileNumber} · {apt.consultationType.replace(/_/g, ' ')} ·{' '}
                    {formatDateTime(apt.createdAt)}
                  </p>
                </div>
                <StatusBadge status={apt.status} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Action modal */}
      <Modal
        isOpen={!!modalAction}
        onClose={() => setModalAction(null)}
        title={
          modalAction === 'approve' ? 'Approve doctor' :
          modalAction === 'reject' ? 'Reject doctor' : 'Suspend doctor'
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalAction(null)}>Cancel</Button>
            <Button
              variant={modalAction === 'approve' ? 'primary' : 'danger'}
              loading={isMutating}
              disabled={modalAction !== 'approve' && reason.trim().length < 10}
              onClick={handleConfirm}
            >
              Confirm {modalAction}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-[var(--text-secondary)]">
            {modalAction === 'approve'
              ? `Approving Dr. ${doctor.user.firstName} will grant full platform access.`
              : modalAction === 'reject'
              ? `This will notify Dr. ${doctor.user.firstName} their credentials were not accepted.`
              : `Suspending Dr. ${doctor.user.firstName} will immediately take them offline.`}
          </p>
          {modalAction !== 'approve' && (
            <Textarea
              label={`Reason (required${modalAction === 'reject' ? ' — sent to doctor' : ''})`}
              placeholder="Enter a reason..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          )}
        </div>
      </Modal>
    </div>
  );
};

const StatBox: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="stat-card text-center">
    <p className="font-display text-xl font-semibold text-[var(--text-primary)]">{value}</p>
    <p className="text-xs text-[var(--text-muted)] mt-0.5">{label}</p>
  </div>
);