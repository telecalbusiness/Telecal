import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Banknote, CheckCircle, XCircle, Clock, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiGet, apiPost } from '@/services/api';
import { Badge, EmptyState, Skeleton, Modal } from '@/components/common/index';
import { Button } from '@/components/common/Button';
import { formatCurrency, formatDateTime, cn } from '@/utils';

interface PayoutItem {
  id: string;
  amountKobo: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  paystackReference: string | null;
  failureReason: string | null;
  periodStart: string;
  periodEnd: string;
  completedAt: string | null;
  createdAt: string;
  doctor: {
    discipline: string;
    bankAccount: {
      bankName: string;
      accountNumber: string;
      accountName: string;
    } | null;
    user: { firstName: string; lastName: string; email: string };
  };
}

interface PayoutsListResponse {
  items: PayoutItem[];
  total: number;
  page: number;
  totalPages: number;
}

interface DoctorWithBalance {
  id: string;
  discipline: string;
  user: { firstName: string; lastName: string; email: string };
  bankAccount: {
    bankName: string;
    accountNumber: string;
    accountName: string;
    isVerified: boolean;
  } | null;
  walletBalanceKobo?: number;
}

const statusConfig = {
  COMPLETED:  { variant: 'success' as const, icon: CheckCircle, color: 'text-green-500' },
  PROCESSING: { variant: 'info' as const,    icon: Clock,        color: 'text-blue-500' },
  PENDING:    { variant: 'warning' as const, icon: Clock,        color: 'text-yellow-500' },
  FAILED:     { variant: 'danger' as const,  icon: XCircle,      color: 'text-red-500' },
};

export const AdminPayoutsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorWithBalance | null>(null);

  const { data: payouts, isLoading } = useQuery({
    queryKey: ['admin-payouts', page],
    queryFn: () =>
      apiGet<PayoutsListResponse>('/admin/payouts', { page, pageSize: 20 }),
  });

  // Load doctors with earnings balance for the pay modal
  const { data: doctorsData } = useQuery({
    queryKey: ['admin-doctors-for-payout'],
    queryFn: () =>
      apiGet<{ items: DoctorWithBalance[] }>('/admin/doctors', { pageSize: 100, status: 'VERIFIED' }),
    enabled: showPayModal,
  });

  const payoutMutation = useMutation({
    mutationFn: (doctorProfileId: string) => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return apiPost(`/admin/payouts/doctors/${doctorProfileId}/pay`, {
        periodStart: monthStart.toISOString(),
        periodEnd: now.toISOString(),
      });
    },
    onSuccess: () => {
      toast.success('Payout initiated successfully');
      setShowPayModal(false);
      setSelectedDoctor(null);
      queryClient.invalidateQueries({ queryKey: ['admin-payouts'] });
    },
    onError: (err: any) => {
      toast.error(err?.message ?? 'Payout failed. Please try again.');
    },
  });

  return (
    <div className="page-container py-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
            Payouts
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Send earnings to doctors' bank accounts
          </p>
        </div>
        <Button
          leftIcon={<Send size={15} />}
          onClick={() => setShowPayModal(true)}
        >
          New payout
        </Button>
      </div>

      {/* Payouts list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : !payouts?.items.length ? (
        <EmptyState
          icon={<Banknote size={24} />}
          title="No payouts yet"
          description="Payouts to doctors will appear here once you initiate them."
          action={
            <Button size="sm" leftIcon={<Send size={14} />} onClick={() => setShowPayModal(true)}>
              Initiate first payout
            </Button>
          }
        />
      ) : (
        <>
          <div className="space-y-2 mb-4">
            {payouts.items.map((payout) => {
              const config = statusConfig[payout.status];
              const StatusIcon = config.icon;

              return (
                <div key={payout.id} className="card p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn('mt-0.5 flex-shrink-0', config.color)}>
                      <StatusIcon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          Dr. {payout.doctor.user.firstName} {payout.doctor.user.lastName}
                        </p>
                        <Badge variant={config.variant}>
                          {payout.status.toLowerCase()}
                        </Badge>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        {payout.doctor.bankAccount
                          ? `${payout.doctor.bankAccount.bankName} · ${payout.doctor.bankAccount.accountNumber}`
                          : 'No bank account'}
                        {' · '}
                        {formatDateTime(payout.createdAt)}
                      </p>
                      {payout.failureReason && (
                        <p className="text-xs text-red-500 mt-0.5">
                          Failed: {payout.failureReason}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-display font-semibold text-[var(--text-primary)]">
                        {formatCurrency(payout.amountKobo)}
                      </p>
                      {payout.completedAt && (
                        <p className="text-xs text-[var(--text-muted)]">
                          Completed {formatDateTime(payout.completedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {payouts.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-sm text-[var(--text-muted)]">
                Page {page} of {payouts.totalPages}
              </span>
              <Button size="sm" variant="secondary" disabled={page === payouts.totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* Pay modal */}
      <Modal
        isOpen={showPayModal}
        onClose={() => { setShowPayModal(false); setSelectedDoctor(null); }}
        title="Initiate payout"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setShowPayModal(false); setSelectedDoctor(null); }}>
              Cancel
            </Button>
            <Button
              leftIcon={<Send size={14} />}
              loading={payoutMutation.isPending}
              disabled={!selectedDoctor}
              onClick={() => selectedDoctor && payoutMutation.mutate(selectedDoctor.id)}
            >
              Send payout
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-muted)]">
            Select a doctor to pay out their full wallet balance to their registered bank account.
          </p>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {!doctorsData?.items?.length ? (
              <p className="text-sm text-[var(--text-muted)] text-center py-4">
                Loading doctors...
              </p>
            ) : (
              doctorsData.items.map((doctor) => {
                const hasBankAccount = doctor.bankAccount?.isVerified;
                const isSelected = selectedDoctor?.id === doctor.id;

                return (
                  <button
                    key={doctor.id}
                    type="button"
                    disabled={!hasBankAccount}
                    onClick={() => setSelectedDoctor(doctor)}
                    className={cn(
                      'w-full p-3 rounded-xl border text-left transition-all',
                      isSelected
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                        : 'border-[var(--border)] hover:border-brand-300',
                      !hasBankAccount && 'opacity-50 cursor-not-allowed',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          Dr. {doctor.user.firstName} {doctor.user.lastName}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {hasBankAccount
                            ? `${doctor.bankAccount!.bankName} · ${doctor.bankAccount!.accountNumber}`
                            : 'No bank account set up'}
                        </p>
                      </div>
                      {isSelected && (
                        <CheckCircle size={16} className="text-brand-600 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {selectedDoctor && !selectedDoctor.bankAccount?.isVerified && (
            <p className="text-xs text-red-500">
              This doctor has not added a verified bank account yet.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
};
