import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TrendingUp, Percent, RotateCcw, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiGet, apiPatch, apiPost } from '@/services/api';
import { Card, Badge, EmptyState, Skeleton, Modal } from '@/components/common/index';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { formatCurrency, formatDateTime } from '@/utils';

interface EarningItem {
  id: string;
  grossAmountKobo: number;
  doctorShareKobo: number;
  platformShareKobo: number;
  commissionPercent: number;
  status: 'PENDING' | 'CREDITED' | 'REVERSED';
  creditedAt: string | null;
  createdAt: string;
  doctor: {
    discipline: string;
    user: { firstName: string; lastName: string; email: string };
  };
  appointment: {
    consultationType: string;
    sessionEndedAt: string | null;
  };
}

interface EarningsListResponse {
  items: EarningItem[];
  total: number;
  page: number;
  totalPages: number;
}

interface CommissionSettings {
  doctorPercent: number;
  platformPercent: number;
}

const statusConfig = {
  CREDITED: 'success' as const,
  PENDING:  'warning' as const,
  REVERSED: 'danger' as const,
};

export const AdminEarningsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [reverseTarget, setReverseTarget] = useState<EarningItem | null>(null);
  const [reverseReason, setReverseReason] = useState('');
  const [doctorPercent, setDoctorPercent] = useState('');

  const { data: earnings, isLoading } = useQuery({
    queryKey: ['admin-earnings', page],
    queryFn: () =>
      apiGet<EarningsListResponse>('/admin/earnings', { page, pageSize: 20 }),
  });

  const { data: commission, isLoading: commissionLoading } = useQuery({
    queryKey: ['admin-commission'],
    queryFn: () => apiGet<CommissionSettings>('/admin/earnings/commission'),
  });

  // Sync doctorPercent input when commission data loads
  React.useEffect(() => {
    if (commission) {
      setDoctorPercent(String(commission.doctorPercent));
    }
  }, [commission]);

  const commissionMutation = useMutation({
    mutationFn: (percent: number) =>
      apiPatch('/admin/earnings/commission', { doctorPercent: percent }),
    onSuccess: () => {
      toast.success('Commission updated');
      queryClient.invalidateQueries({ queryKey: ['admin-commission'] });
    },
  });

  const reverseMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiPost(`/admin/earnings/${id}/reverse`, { reason }),
    onSuccess: () => {
      toast.success('Earning reversed');
      setReverseTarget(null);
      setReverseReason('');
      queryClient.invalidateQueries({ queryKey: ['admin-earnings'] });
    },
  });

  const handleSaveCommission = () => {
    const val = parseInt(doctorPercent, 10);
    if (isNaN(val) || val < 1 || val > 99) {
      toast.error('Enter a value between 1 and 99');
      return;
    }
    commissionMutation.mutate(val);
  };

  return (
    <div className="page-container py-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
          Earnings
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          Doctor earnings from consultations and commission settings
        </p>
      </div>

      {/* Commission settings */}
      <Card padding="lg" className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
            <Percent size={16} className="text-brand-600 dark:text-brand-400" />
          </div>
          <h2 className="font-display font-semibold text-[var(--text-primary)]">
            Commission split
          </h2>
        </div>

        {commissionLoading ? (
          <Skeleton className="h-16" />
        ) : (
          <div className="flex items-end gap-4">
            <div className="flex-1 max-w-xs">
              <Input
                label="Doctor's share (%)"
                type="number"
                min={1}
                max={99}
                value={doctorPercent}
                onChange={(e) => setDoctorPercent(e.target.value)}
                hint={`Platform receives ${100 - (parseInt(doctorPercent, 10) || 0)}%`}
              />
            </div>
            <Button
              size="sm"
              leftIcon={<Save size={14} />}
              loading={commissionMutation.isPending}
              onClick={handleSaveCommission}
              className="mb-5"
            >
              Save
            </Button>
          </div>
        )}

        {commission != null && (
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Current: Doctor <strong>{(commission as CommissionSettings).doctorPercent}%</strong> — Platform <strong>{(commission as CommissionSettings).platformPercent}%</strong>.
            Changes apply to all future appointments immediately.
          </p>
        )}
      </Card>

      {/* Earnings list */}
      <div>
        <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">
          All earnings {earnings ? `(${earnings.total})` : ''}
        </p>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : !earnings?.items.length ? (
          <EmptyState
            icon={<TrendingUp size={24} />}
            title="No earnings yet"
            description="Earnings will appear here after doctors complete consultations."
          />
        ) : (
          <>
            <div className="space-y-2 mb-4">
              {earnings.items.map((earning) => (
                <div key={earning.id} className="card p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          Dr. {earning.doctor.user.firstName} {earning.doctor.user.lastName}
                        </p>
                        <Badge variant={statusConfig[earning.status]}>
                          {earning.status.toLowerCase()}
                        </Badge>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        {earning.appointment.consultationType.replace(/_/g, ' ')} · {earning.commissionPercent}% of {formatCurrency(earning.grossAmountKobo)} · {formatDateTime(earning.createdAt)}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                          +{formatCurrency(earning.doctorShareKobo)}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          Platform: {formatCurrency(earning.platformShareKobo)}
                        </p>
                      </div>

                      {earning.status === 'CREDITED' && (
                        <button
                          onClick={() => setReverseTarget(earning)}
                          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                          title="Reverse earning"
                        >
                          <RotateCcw size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {earnings.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-[var(--text-muted)]">
                  Page {page} of {earnings.totalPages}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page === earnings.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Reverse modal */}
      <Modal
        isOpen={!!reverseTarget}
        onClose={() => { setReverseTarget(null); setReverseReason(''); }}
        title="Reverse earning"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setReverseTarget(null); setReverseReason(''); }}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={reverseMutation.isPending}
              disabled={reverseReason.length < 10}
              onClick={() => reverseTarget && reverseMutation.mutate({ id: reverseTarget.id, reason: reverseReason })}
            >
              Confirm reversal
            </Button>
          </>
        }
      >
        {reverseTarget && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-[var(--surface-2)] text-sm">
              <p className="text-[var(--text-primary)]">
                Dr. {reverseTarget.doctor.user.firstName} {reverseTarget.doctor.user.lastName}
              </p>
              <p className="text-[var(--text-muted)]">
                Earning: {formatCurrency(reverseTarget.doctorShareKobo)}
              </p>
            </div>
            <Input
              label="Reason for reversal"
              placeholder="Describe why this earning is being reversed..."
              value={reverseReason}
              onChange={(e) => setReverseReason(e.target.value)}
              hint="Minimum 10 characters required"
            />
          </div>
        )}
      </Modal>
    </div>
  );
};
