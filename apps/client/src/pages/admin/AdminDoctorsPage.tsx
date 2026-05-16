import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle, XCircle, AlertOctagon,
  ChevronLeft, ChevronRight, Filter,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiGet, apiPatch } from '@/services/api';
import { Button } from '@/components/common/Button';
import {
  Card, StatusBadge, Avatar, EmptyState, Modal,
} from '@/components/common/index';
import { Textarea } from '@/components/common/Input';
import { formatDateTime, formatDiscipline, cn } from '@/utils';
import { Link } from 'react-router-dom';

const STATUS_OPTIONS = [
  { value: '', label: 'All doctors' },
  { value: 'PENDING_VERIFICATION', label: 'Pending verification' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

interface Doctor {
  id: string;
  licenseNumber: string;
  discipline: string;
  yearsOfExperience: number;
  status: string;
  presence: string;
  currentPatientCount: number;
  averageRating: number | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; email: string; createdAt: string };
  credentials: { id: string; fileName: string; fileType: string; uploadedAt: string }[];
  adminReviews: { action: string; notes: string | null; reviewedAt: string }[];
}

export const AdminDoctorsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('PENDING_VERIFICATION');
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [modalAction, setModalAction] = useState<'approve' | 'reject' | 'suspend' | null>(null);
  const [reason, setReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-doctors', page, statusFilter],
    queryFn: () =>
      apiGet<{ items: Doctor[]; total: number; totalPages: number }>(
        `/admin/doctors?page=${page}&pageSize=15${statusFilter ? `&status=${statusFilter}` : ''}`,
      ),
    staleTime: 15_000,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiPatch(`/admin/doctors/${id}/approve`, { notes: reason }),
    onSuccess: () => {
      toast.success('Doctor approved');
      closeModal();
      void queryClient.invalidateQueries({ queryKey: ['admin-doctors'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => apiPatch(`/admin/doctors/${id}/reject`, { reason }),
    onSuccess: () => {
      toast.success('Doctor rejected');
      closeModal();
      void queryClient.invalidateQueries({ queryKey: ['admin-doctors'] });
    },
  });

  const suspendMutation = useMutation({
    mutationFn: (id: string) => apiPatch(`/admin/doctors/${id}/suspend`, { reason }),
    onSuccess: () => {
      toast.success('Doctor suspended');
      closeModal();
      void queryClient.invalidateQueries({ queryKey: ['admin-doctors'] });
    },
  });

  const openModal = (doctor: Doctor, action: typeof modalAction) => {
    setSelectedDoctor(doctor);
    setModalAction(action);
    setReason('');
  };

  const closeModal = () => {
    setSelectedDoctor(null);
    setModalAction(null);
    setReason('');
  };

  const handleConfirm = () => {
    if (!selectedDoctor) return;
    if (modalAction === 'approve') approveMutation.mutate(selectedDoctor.id);
    if (modalAction === 'reject') rejectMutation.mutate(selectedDoctor.id);
    if (modalAction === 'suspend') suspendMutation.mutate(selectedDoctor.id);
  };

  const isMutating =
    approveMutation.isPending || rejectMutation.isPending || suspendMutation.isPending;

  return (
    <div className="page-container py-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
            Doctor management
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {data ? `${data.total} total` : '—'}
          </p>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-1 overflow-x-auto pb-2 mb-5">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => { setStatusFilter(opt.value); setPage(1); }}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex-shrink-0',
              statusFilter === opt.value
                ? 'bg-brand-600 text-white'
                : 'bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--surface-3)]',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card p-4 flex items-center gap-4">
              <div className="skeleton w-9 h-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-48" />
                <div className="skeleton h-3 w-64" />
              </div>
              <div className="skeleton h-7 w-24 rounded-full" />
            </div>
          ))}
        </div>
      ) : !data?.items.length ? (
        <EmptyState
          icon={<Filter size={24} />}
          title="No doctors found"
          description="No doctors match the selected filter."
        />
      ) : (
        <div className="space-y-2">
          {data.items.map((doctor) => (
            <Link key={doctor.id} to={`/dashboard/doctors/${doctor.id}`} className="block">
              <Card key={doctor.id} padding="md">
                <div className="flex items-start gap-4">
                  <Avatar
                    firstName={doctor.user.firstName}
                    lastName={doctor.user.lastName}
                    size="lg"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <p className="font-medium text-[var(--text-primary)]">
                        Dr. {doctor.user.firstName} {doctor.user.lastName}
                      </p>
                      <StatusBadge status={doctor.status} />
                      {doctor.status === 'VERIFIED' && (
                        <StatusBadge status={doctor.presence} />
                      )}
                    </div>
                    <p className="text-sm text-[var(--text-muted)]">
                      {doctor.user.email} · {formatDiscipline(doctor.discipline)} ·{' '}
                      {doctor.yearsOfExperience}yr exp · License: {doctor.licenseNumber}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      Registered {formatDateTime(doctor.createdAt)} ·{' '}
                      {doctor.credentials.length} credential file(s)
                      {doctor.averageRating && ` · Rating: ${doctor.averageRating.toFixed(1)}/5`}
                    </p>
                    {/* Last review note */}
                    {doctor.adminReviews[0] && (
                      <p className="text-xs text-[var(--text-muted)] mt-1 italic">
                        Last action: {doctor.adminReviews[0].action} on{' '}
                        {formatDateTime(doctor.adminReviews[0].reviewedAt)}
                        {doctor.adminReviews[0].notes && ` — "${doctor.adminReviews[0].notes}"`}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {doctor.status === 'PENDING_VERIFICATION' && (
                      <>
                        <Button
                          size="sm"
                          leftIcon={<CheckCircle size={13} />}
                          onClick={() => openModal(doctor, 'approve')}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          leftIcon={<XCircle size={13} />}
                          className="border-red-300 text-red-600"
                          onClick={() => openModal(doctor, 'reject')}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    {doctor.status === 'VERIFIED' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        leftIcon={<AlertOctagon size={13} />}
                        className="border-orange-300 text-orange-600"
                        onClick={() => openModal(doctor, 'suspend')}
                      >
                        Suspend
                      </Button>
                    )}
                    {doctor.status === 'REJECTED' && (
                      <Button
                        size="sm"
                        leftIcon={<CheckCircle size={13} />}
                        onClick={() => openModal(doctor, 'approve')}
                      >
                        Re-approve
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--border)]">
          <p className="text-sm text-[var(--text-muted)]">Page {page} of {data.totalPages}</p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" leftIcon={<ChevronLeft size={14} />}
              disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="secondary" size="sm" rightIcon={<ChevronRight size={14} />}
              disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Action modal */}
      <Modal
        isOpen={!!modalAction}
        onClose={closeModal}
        title={
          modalAction === 'approve' ? 'Approve doctor' :
          modalAction === 'reject'  ? 'Reject doctor' :
          'Suspend doctor'
        }
        footer={
          <>
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
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
        {selectedDoctor && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">
              {modalAction === 'approve'
                ? `Approving Dr. ${selectedDoctor.user.firstName} ${selectedDoctor.user.lastName} will grant them full platform access.`
                : modalAction === 'reject'
                ? `This will notify Dr. ${selectedDoctor.user.firstName} that their credentials were not accepted.`
                : `Suspending Dr. ${selectedDoctor.user.firstName} will immediately take them offline and revoke access.`
              }
            </p>
            {modalAction !== 'approve' && (
              <Textarea
                label={`Reason (required${modalAction === 'reject' ? ' — shared with doctor' : ''})`}
                placeholder="Enter a reason..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
