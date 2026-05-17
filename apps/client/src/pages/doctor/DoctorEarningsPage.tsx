import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, Wallet, Calendar, ArrowDownLeft,
  ArrowUpRight, BadgeCheck, Clock,
} from 'lucide-react';
import { apiGet } from '@/services/api';
import { Card, StatCard, EmptyState, Skeleton } from '@/components/common/index';
import { formatCurrency, formatDateTime, cn } from '@/utils';

interface EarningItem {
  id: string;
  grossAmountKobo: number;
  doctorShareKobo: number;
  platformShareKobo: number;
  commissionPercent: number;
  status: 'PENDING' | 'CREDITED' | 'REVERSED';
  creditedAt: string | null;
  createdAt: string;
  appointment: {
    consultationType: string;
    sessionEndedAt: string | null;
    patient: { fileNumber: string };
  };
}

interface EarningsSummary {
  walletBalanceKobo: number;
  walletBalanceNGN: string;
  totalEarnedKobo: number;
  totalEarnedNGN: string;
  thisMonthKobo: number;
  thisMonthNGN: string;
  recentEarnings: EarningItem[];
}

const statusConfig = {
  CREDITED: { label: 'Credited', className: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' },
  PENDING:  { label: 'Pending',  className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' },
  REVERSED: { label: 'Reversed', className: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' },
};

export const DoctorEarningsPage: React.FC = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['doctor-earnings'],
    queryFn: () => apiGet<EarningsSummary>('/earnings/me'),
    staleTime: 15_000,
  });

  return (
    <div className="page-container py-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
          My earnings
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          Your consultation earnings and wallet balance
        </p>
      </div>

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card
            padding="lg"
            className="bg-gradient-to-br from-brand-600 to-brand-700 border-0 text-white"
          >
            <div className="flex items-center gap-2 mb-2">
              <Wallet size={16} className="text-brand-200" />
              <p className="text-sm text-brand-100">Wallet balance</p>
            </div>
            <p className="font-display text-3xl font-semibold tracking-tight">
              {formatCurrency(data?.walletBalanceKobo ?? 0)}
            </p>
            <p className="text-xs text-brand-200 mt-1">Available for payout</p>
          </Card>

          <StatCard
            label="This month"
            value={formatCurrency(data?.thisMonthKobo ?? 0)}
            icon={<Calendar size={16} />}
          />

          <StatCard
            label="All-time earned"
            value={formatCurrency(data?.totalEarnedKobo ?? 0)}
            icon={<TrendingUp size={16} />}
          />
        </div>
      )}

      {/* Commission info */}
      <Card padding="md" className="mb-6 bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <BadgeCheck size={17} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700 dark:text-blue-400 leading-relaxed">
            You receive <strong>75%</strong> of each consultation fee. Earnings are credited to your
            wallet automatically when a session ends. Contact admin to initiate a payout to your bank account.
          </p>
        </div>
      </Card>

      {/* Recent earnings */}
      <div>
        <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">
          Recent earnings
        </p>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : !data?.recentEarnings.length ? (
          <EmptyState
            icon={<TrendingUp size={24} />}
            title="No earnings yet"
            description="Your earnings will appear here after your first completed consultation."
          />
        ) : (
          <div className="space-y-2">
            {data.recentEarnings.map((earning) => {
              const status = statusConfig[earning.status];
              const isCredit = earning.status === 'CREDITED';
              const isReversed = earning.status === 'REVERSED';

              return (
                <div key={earning.id} className="card p-4 flex items-center gap-3">
                  <div className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                    isCredit ? 'bg-green-100 dark:bg-green-900/20' :
                    isReversed ? 'bg-red-100 dark:bg-red-900/20' :
                    'bg-yellow-100 dark:bg-yellow-900/20',
                  )}>
                    {isCredit ? (
                      <ArrowDownLeft size={16} className="text-green-600 dark:text-green-400" />
                    ) : isReversed ? (
                      <ArrowUpRight size={16} className="text-red-600 dark:text-red-400" />
                    ) : (
                      <Clock size={16} className="text-yellow-600 dark:text-yellow-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {earning.appointment.consultationType.replace(/_/g, ' ')} — Patient {earning.appointment.patient.fileNumber}
                      </p>
                      <span className={cn('badge flex-shrink-0 text-xs', status.className)}>
                        {status.label}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">
                      {earning.creditedAt
                        ? `Credited ${formatDateTime(earning.creditedAt)}`
                        : formatDateTime(earning.createdAt)}
                      {' · '}{earning.commissionPercent}% of {formatCurrency(earning.grossAmountKobo)}
                    </p>
                  </div>

                  <p className={cn(
                    'font-display font-semibold flex-shrink-0 text-sm',
                    isCredit ? 'text-green-600 dark:text-green-400' :
                    isReversed ? 'text-red-600 dark:text-red-400' :
                    'text-[var(--text-muted)]',
                  )}>
                    {isReversed ? '-' : '+'}{formatCurrency(earning.doctorShareKobo)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
