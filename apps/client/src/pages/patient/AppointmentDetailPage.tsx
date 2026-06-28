import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Video, FileText, Clock, Calendar,
  ArrowLeft, AlertTriangle,
  Stethoscope, CreditCard, ChevronRight, Star,
  CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiGet, apiPost, apiPatch } from '@/services/api';
import { useAuth } from '@/hooks/useAppDispatch';
import { Button } from '@/components/common/Button';
import {
  Card, StatusBadge, Badge, Avatar,
  EmptyState, Modal,
} from '@/components/common/index';
import { formatDateTime, formatCurrency, formatDiscipline } from '@/utils';
import { UserRole } from '@mediconnect/shared';
import { PrescriptionForm } from '@/components/doctor/PrescriptionForm';

interface AppointmentDetail {
  id: string;
  consultationType: string;
  discipline: string | null;
  status: string;
  priority: string;
  notes: string | null;
  sessionDurationMinutes: number;
  sessionStartedAt: string | null;
  sessionEndedAt: string | null;
  assignedAt: string | null;
  createdAt: string;
  patient: {
    fileNumber: string;
    userId: string;
    user: { firstName: string; lastName: string; email: string };
  };
  doctor: {
    userId: string;
    discipline: string;
    user: { firstName: string; lastName: string };
  } | null;
  payment: {
    status: string;
    amountKobo: number;
    paidAt: string | null;
  } | null;
  prescription: {
    id: string;
    status: string;
    issuedAt: string | null;
    medications: Array<{
      name: string;
      dosage: string;
      frequency: string;
      duration: string;
      instructions: string | null;
    }>;
    notes: string | null;
  } | null;
}

const JOINABLE_STATUSES = ['ASSIGNED', 'IN_SESSION'];
const ACTIVE_STATUSES   = ['PAYMENT_CONFIRMED', 'ASSIGNED', 'IN_SESSION'];

export const AppointmentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCancelModal, setShowCancelModal] = useState(false);

  const { data: appointment, isLoading } = useQuery({
    queryKey: ['appointment', id],
    queryFn: () => apiGet<AppointmentDetail>(`/appointments/${id!}`),
    enabled: !!id,
    refetchInterval: (query) =>
      ACTIVE_STATUSES.includes(query.state.data?.status ?? '') ? 8000 : false,
  });

  const cancelMutation = useMutation({
    mutationFn: () => apiPatch(`/appointments/${id}/cancel`),
    onSuccess: () => {
      toast.success('Appointment cancelled');
      setShowCancelModal(false);
      void queryClient.invalidateQueries({ queryKey: ['appointment', id] });
    },
  });

  if (isLoading) return <AppointmentDetailSkeleton />;
  if (!appointment) return (
    <div className="page-container py-12">
      <EmptyState icon={<Calendar size={24} />} title="Appointment not found" />
    </div>
  );

  const isPatient = user?.role === UserRole.PATIENT;
  const isDoctor  = user?.role === UserRole.DOCTOR;
  const canJoin   = JOINABLE_STATUSES.includes(appointment.status);
  const canCancel = isPatient && ['PENDING_PAYMENT', 'PAYMENT_CONFIRMED', 'ASSIGNED'].includes(appointment.status);
  const isUrgent  = appointment.priority === 'URGENT';

  return (
    <div className="page-container py-6 max-w-3xl animate-fade-in">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mb-5"
      >
        <ArrowLeft size={15} /> Back to appointments
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display text-xl font-semibold text-[var(--text-primary)] tracking-tight">
              {appointment.consultationType === 'GENERAL_PRACTICE'
                ? 'General practitioner consultation'
                : `${appointment.discipline ? formatDiscipline(appointment.discipline) : 'Specialist'} consultation`}
            </h1>
            {isUrgent && <Badge variant="danger">Urgent</Badge>}
          </div>
          <p className="text-sm text-[var(--text-muted)]">
            Booked {formatDateTime(appointment.createdAt)}
          </p>
        </div>
        <StatusBadge status={appointment.status} />
      </div>

      <div className="space-y-4">
        {/* Join session CTA */}
        {canJoin && (
          <Card className="border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/20" padding="md">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center">
                  <Video size={18} className="text-brand-600 dark:text-brand-400" />
                </div>
                <div>
                  <p className="font-medium text-brand-800 dark:text-brand-300 text-sm">
                    {appointment.status === 'IN_SESSION' ? 'Session in progress' : 'Ready to start'}
                  </p>
                  <p className="text-xs text-brand-600/80 dark:text-brand-400/80">
                    {appointment.sessionDurationMinutes}-minute session · Video call
                  </p>
                </div>
              </div>
              <Button
                onClick={() => navigate(`/session/${appointment.id}`)}
                leftIcon={<Video size={15} />}
                rightIcon={<ChevronRight size={14} />}
              >
                {appointment.status === 'IN_SESSION' ? 'Rejoin session' : 'Join session'}
              </Button>
            </div>
          </Card>
        )}

        {/* Awaiting assignment */}
        {appointment.status === 'PAYMENT_CONFIRMED' && (
          <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10" padding="md">
            <div className="flex items-center gap-3">
              <Clock size={18} className="text-blue-600 animate-pulse-brand" />
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
                  Waiting for a doctor
                </p>
                <p className="text-xs text-blue-600/80 dark:text-blue-400/80">
                  The system is finding an available doctor. This usually takes a few minutes.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Pending payment */}
        {appointment.status === 'PENDING_PAYMENT' && isPatient && (
          <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/10" padding="md">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-3 flex-1">
                <CreditCard size={18} className="text-yellow-600" />
                <div>
                  <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                    Payment required
                  </p>
                  <p className="text-xs text-yellow-600/80">
                    {appointment.payment ? formatCurrency(appointment.payment.amountKobo) : ''} — Complete payment to proceed
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                leftIcon={<CreditCard size={14} />}
                onClick={async () => {
                  try {
                    const result = await apiPost<{ authorizationUrl: string }>(
                      `/payments/appointments/${appointment.id}/initialize`,
                    );
                    window.location.href = result.data.authorizationUrl;
                  } catch { /* handled */ }
                }}
              >
                Pay now
              </Button>
            </div>
          </Card>
        )}

        {/* Two-column detail */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Doctor info */}
          <Card padding="md">
            <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">
              Doctor
            </p>
            {appointment.doctor ? (
              <div className="flex items-center gap-3">
                <Avatar
                  firstName={appointment.doctor.user.firstName}
                  lastName={appointment.doctor.user.lastName}
                  size="lg"
                />
                <div>
                  <p className="font-medium text-[var(--text-primary)]">
                    Dr. {appointment.doctor.user.firstName} {appointment.doctor.user.lastName}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {formatDiscipline(appointment.doctor.discipline)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-[var(--text-muted)]">
                <div className="w-11 h-11 rounded-full border-2 border-dashed border-[var(--border)] flex items-center justify-center">
                  <Stethoscope size={18} />
                </div>
                <p className="text-sm">Not yet assigned</p>
              </div>
            )}
          </Card>

          {/* Patient info */}
          <Card padding="md">
            <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">
              Patient
            </p>
            <div className="flex items-center gap-3">
              <Avatar
                firstName={appointment.patient.user.firstName}
                lastName={appointment.patient.user.lastName}
                size="lg"
              />
              <div>
                <p className="font-medium text-[var(--text-primary)]">
                  {appointment.patient.user.firstName} {appointment.patient.user.lastName}
                </p>
                <p className="text-xs font-mono text-brand-600 dark:text-brand-400">
                  {appointment.patient.fileNumber}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Session details */}
        <Card padding="md">
          <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">
            Session details
          </p>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <DetailRow label="Type" value={appointment.consultationType.replace(/_/g, ' ')} />
            <DetailRow label="Duration limit" value={`${appointment.sessionDurationMinutes} minutes`} />
            <DetailRow label="Assigned at" value={appointment.assignedAt ? formatDateTime(appointment.assignedAt) : '—'} />
            <DetailRow label="Session started" value={appointment.sessionStartedAt ? formatDateTime(appointment.sessionStartedAt) : '—'} />
            <DetailRow label="Session ended" value={appointment.sessionEndedAt ? formatDateTime(appointment.sessionEndedAt) : '—'} />
            {appointment.payment && (
              <DetailRow
                label="Amount paid"
                value={appointment.payment.status === 'SUCCESSFUL'
                  ? `${formatCurrency(appointment.payment.amountKobo)} ✓`
                  : 'Pending'}
              />
            )}
          </dl>
          {appointment.notes && (
            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <p className="text-xs font-medium text-[var(--text-muted)] mb-1">Patient notes</p>
              <p className="text-sm text-[var(--text-secondary)]">{appointment.notes}</p>
            </div>
          )}
        </Card>

        {/* Prescription */}
        {appointment.prescription && (
          <Card padding="md">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
                Prescription
              </p>
              <StatusBadge status={appointment.prescription.status} />
            </div>
            <div className="space-y-3">
              {appointment.prescription.medications.map((med, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-xl bg-[var(--surface-2)]">
                  <div className="w-7 h-7 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-brand-700 dark:text-brand-300">{i + 1}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-[var(--text-primary)]">{med.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {med.dosage} · {med.frequency} · {med.duration}
                    </p>
                    {med.instructions && (
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5 italic">{med.instructions}</p>
                    )}
                  </div>
                </div>
              ))}
              {appointment.prescription.notes && (
                <div className="pt-2 border-t border-[var(--border)]">
                  <p className="text-xs text-[var(--text-muted)] mb-1">Doctor's notes</p>
                  <p className="text-sm text-[var(--text-secondary)]">{appointment.prescription.notes}</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Review section — shown to patient after completed appointment */}
        {isPatient && appointment.status === 'COMPLETED' && appointment.doctor && (
          <ReviewSection appointmentId={appointment.id} />
        )}


        {/* Doctor: prescription creation form (shown when session complete and no prescription yet) */}
        {isDoctor &&
          appointment.status === 'COMPLETED' &&
          !appointment.prescription &&
          appointment.doctor?.userId === user?.id && (
            <PrescriptionForm
              appointmentId={appointment.id}
              onSuccess={() => void queryClient.invalidateQueries({ queryKey: ['appointment', appointment.id] })}
            />
          )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          {canCancel && (
            <Button
              variant="secondary"
              className="border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10"
              leftIcon={<AlertTriangle size={14} />}
              onClick={() => setShowCancelModal(true)}
            >
              Cancel appointment
            </Button>
          )}
          {appointment.status === 'COMPLETED' && isPatient && (
            <Button
              variant="secondary"
              leftIcon={<FileText size={14} />}
              onClick={() => navigate(`/dashboard/investigations/new?appointmentId=${appointment.id}`)}
            >
              Submit investigation report
            </Button>
          )}
        </div>
      </div>

      {/* Cancel confirmation modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel appointment"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCancelModal(false)}>
              Keep appointment
            </Button>
            <Button
              variant="danger"
              loading={cancelMutation.isPending}
              onClick={() => cancelMutation.mutate()}
            >
              Yes, cancel
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--text-secondary)]">
          Are you sure you want to cancel this appointment? This action cannot be undone.
          {appointment.payment?.status === 'SUCCESSFUL' && (
            <span className="block mt-2 text-yellow-600 dark:text-yellow-400">
              Note: Payment refunds are processed manually. Please contact support.
            </span>
          )}
        </p>
      </Modal>
    </div>
  );
};

// ─── Detail row ───────────────────────────────────────────────

const DetailRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <>
    <dt className="text-[var(--text-muted)]">{label}</dt>
    <dd className="text-[var(--text-primary)] font-medium">{value}</dd>
  </>
);

// ─── Review component ─────────────────────────────────────────

const ReviewSection: React.FC<{ appointmentId: string }> = ({ appointmentId }) => {
  const queryClient = useQueryClient();
  const [selectedRating, setSelectedRating] = React.useState(0);
  const [hoveredRating, setHoveredRating] = React.useState(0);
  const [comment, setComment] = React.useState('');
  const [submitted, setSubmitted] = React.useState(false);

  const { data: reviewData } = useQuery({
    queryKey: ['appointment-review', appointmentId],
    queryFn: () => apiGet<{ hasReview: boolean; review: { rating: number; comment: string | null } | null }>(
      `/appointments/${appointmentId}/review`
    ),
  });

  const reviewMutation = useMutation({
    mutationFn: () => apiPost(`/appointments/${appointmentId}/review`, {
      rating: selectedRating,
      comment: comment.trim() || undefined,
    }),
    onSuccess: () => {
      setSubmitted(true);
      void queryClient.invalidateQueries({ queryKey: ['appointment-review', appointmentId] });
    },
  });

  if (reviewData?.hasReview || submitted) {
    const r = reviewData?.review;
    return (
      <Card padding="md" className="bg-brand-50 dark:bg-brand-900/10 border-brand-200 dark:border-brand-800">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 size={16} className="text-brand-600" />
          <p className="text-sm font-medium text-brand-700 dark:text-brand-400">
            Review submitted
          </p>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              size={16}
              className={star <= (r?.rating ?? selectedRating)
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-[var(--text-muted)]'}
            />
          ))}
        </div>
        {r?.comment && (
          <p className="text-xs text-[var(--text-muted)] mt-1 italic">"{r.comment}"</p>
        )}
      </Card>
    );
  }

  return (
    <Card padding="md">
      <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">
        Rate your consultation
      </p>
      <p className="text-sm text-[var(--text-secondary)] mb-4">
        How was your experience with the doctor?
        Your feedback is private and helps us maintain quality.
      </p>

      {/* Star selector */}
      <div className="flex gap-2 mb-4">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setSelectedRating(star)}
            onMouseEnter={() => setHoveredRating(star)}
            onMouseLeave={() => setHoveredRating(0)}
            className="transition-transform hover:scale-110"
          >
            <Star
              size={28}
              className={star <= (hoveredRating || selectedRating)
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-[var(--border-strong)]'}
            />
          </button>
        ))}
        {selectedRating > 0 && (
          <span className="text-sm text-[var(--text-muted)] self-center ml-1">
            {['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'][selectedRating]}
          </span>
        )}
      </div>

      {/* Optional comment */}
      {selectedRating > 0 && (
        <div className="mb-4 animate-slide-down">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Any additional comments? (optional)"
            maxLength={500}
            rows={3}
            className="input-base resize-none"
          />
          <p className="text-xs text-[var(--text-muted)] text-right mt-1">
            {comment.length}/500
          </p>
        </div>
      )}

      <Button
        disabled={selectedRating === 0}
        loading={reviewMutation.isPending}
        onClick={() => reviewMutation.mutate()}
        size="sm"
      >
        Submit review
      </Button>
    </Card>
  );
};

// ─── Skeleton ─────────────────────────────────────────────────

const AppointmentDetailSkeleton: React.FC = () => (
  <div className="page-container py-6 max-w-3xl space-y-4">
    <div className="skeleton h-4 w-32 rounded" />
    <div className="skeleton h-7 w-64 rounded-xl" />
    <div className="skeleton h-20 rounded-2xl" />
    <div className="grid grid-cols-2 gap-4">
      <div className="skeleton h-28 rounded-2xl" />
      <div className="skeleton h-28 rounded-2xl" />
    </div>
    <div className="skeleton h-40 rounded-2xl" />
  </div>
);
