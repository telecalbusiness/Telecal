import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Wallet, Plus, ArrowUpRight, ArrowDownLeft,
  CreditCard, TrendingUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiGet, apiPost } from '@/services/api';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Card, EmptyState, Skeleton } from '@/components/common/index';
import { formatCurrency, formatDateTime, cn } from '@/utils';
import { Modal } from '@/components/common/index';

interface WalletData {
  id: string;
  balanceKobo: number;
  updatedAt: string;
  transactions: Array<{
    id: string;
    type: 'TOPUP' | 'DEBIT' | 'REFUND';
    amountKobo: number;
    balanceAfter: number;
    description: string;
    createdAt: string;
  }>;
}

const TOPUP_PRESETS = [1000, 2000, 5000, 10000, 20000, 50000];

export const WalletPage: React.FC = () => {
  const [showTopup, setShowTopup] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');

  const { data: wallet, isLoading } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => apiGet<WalletData>('/wallet'),
    staleTime: 10_000,
  });

  const topupMutation = useMutation({
    mutationFn: (amountNGN: number) =>
      apiPost<{ authorizationUrl: string }>('/wallet/topup/initialize', { amountNGN }),
    onSuccess: (result) => {
      toast.success('Redirecting to payment...');
      window.location.href = result.data.authorizationUrl;
    },
  });

  const handleTopup = () => {
    const amount = parseInt(topupAmount.replace(/,/g, ''), 10);
    if (isNaN(amount) || amount < 500) {
      toast.error('Minimum top-up is ₦500');
      return;
    }
    topupMutation.mutate(amount);
  };

  return (
    <div className="page-container py-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
          My wallet
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          Top up your wallet and pay for consultations instantly
        </p>
      </div>

      {/* Balance card */}
      {isLoading ? (
        <Skeleton className="h-36 rounded-2xl mb-5" />
      ) : (
        <Card
          padding="lg"
          className="mb-5 bg-gradient-to-br from-brand-600 to-brand-700 border-0 text-white"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Wallet size={18} className="text-brand-200" />
                <p className="text-sm text-brand-100">Available balance</p>
              </div>
              <p className="font-display text-4xl font-semibold tracking-tight">
                {formatCurrency(wallet?.balanceKobo ?? 0)}
              </p>
              <p className="text-xs text-brand-200 mt-1">
                Last updated {wallet?.updatedAt ? formatDateTime(wallet.updatedAt) : '—'}
              </p>
            </div>
            <Button
              onClick={() => setShowTopup(true)}
              className="bg-white text-brand-700 hover:bg-brand-50 border-0 shadow-lg"
              leftIcon={<Plus size={15} />}
              size="sm"
            >
              Top up
            </Button>
          </div>
        </Card>
      )}

      {/* Quick top-up presets */}
      <div className="mb-5">
        <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-2">
          Quick top-up
        </p>
        <div className="grid grid-cols-3 gap-2">
          {TOPUP_PRESETS.map((amount) => (
            <button
              key={amount}
              onClick={() => {
                setTopupAmount(String(amount));
                setShowTopup(true);
              }}
              className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-0)] hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 text-sm font-medium text-[var(--text-primary)] transition-all"
            >
              {formatCurrency(amount * 100)}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction history */}
      <div>
        <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">
          Transaction history
        </p>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : !wallet?.transactions.length ? (
          <EmptyState
            icon={<TrendingUp size={24} />}
            title="No transactions yet"
            description="Your wallet transactions will appear here after your first top-up."
          />
        ) : (
          <div className="space-y-2">
            {wallet.transactions.map((tx) => (
              <div
                key={tx.id}
                className="card p-4 flex items-center gap-3"
              >
                <div className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                  tx.type === 'TOPUP' || tx.type === 'REFUND'
                    ? 'bg-green-100 dark:bg-green-900/20'
                    : 'bg-red-100 dark:bg-red-900/20',
                )}>
                  {tx.type === 'TOPUP' || tx.type === 'REFUND' ? (
                    <ArrowDownLeft size={16} className="text-green-600 dark:text-green-400" />
                  ) : (
                    <ArrowUpRight size={16} className="text-red-600 dark:text-red-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {tx.description}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {formatDateTime(tx.createdAt)} ·{' '}
                    Balance after: {formatCurrency(tx.balanceAfter)}
                  </p>
                </div>
                <p className={cn(
                  'font-display font-semibold flex-shrink-0',
                  tx.type === 'TOPUP' || tx.type === 'REFUND'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400',
                )}>
                  {tx.type === 'DEBIT' ? '-' : '+'}{formatCurrency(tx.amountKobo)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top-up modal */}
      <Modal
        isOpen={showTopup}
        onClose={() => setShowTopup(false)}
        title="Top up wallet"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowTopup(false)}>Cancel</Button>
            <Button
              loading={topupMutation.isPending}
              leftIcon={<CreditCard size={14} />}
              onClick={handleTopup}
            >
              Pay with Paystack
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Amount (₦)"
            type="number"
            min={500}
            placeholder="e.g. 5000"
            value={topupAmount}
            onChange={(e) => setTopupAmount(e.target.value)}
            hint="Minimum ₦500 · Secure payment via Paystack"
          />
          <div className="grid grid-cols-3 gap-2">
            {TOPUP_PRESETS.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => setTopupAmount(String(amount))}
                className={cn(
                  'p-2 rounded-lg border text-xs font-medium transition-all',
                  topupAmount === String(amount)
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                    : 'border-[var(--border)] text-[var(--text-muted)] hover:border-brand-300',
                )}
              >
                ₦{amount.toLocaleString()}
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
};