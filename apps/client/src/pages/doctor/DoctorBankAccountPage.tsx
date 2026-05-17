import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, CheckCircle, AlertCircle, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiGet, apiPost } from '@/services/api';
import { Card, Skeleton } from '@/components/common/index';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';

interface Bank {
  name: string;
  code: string;
}

interface BankAccount {
  id: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  isVerified: boolean;
  updatedAt: string;
}

export const DoctorBankAccountPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [accountNumber, setAccountNumber] = useState('');
  const [selectedBankCode, setSelectedBankCode] = useState('');
  const [selectedBankName, setSelectedBankName] = useState('');
  const [bankSearch, setBankSearch] = useState('');
  const [showBankList, setShowBankList] = useState(false);

  const { data: bankAccount, isLoading: accountLoading } = useQuery({
    queryKey: ['doctor-bank-account'],
    queryFn: () => apiGet<BankAccount | null>('/payouts/bank-account'),
  });

  const { data: banks, isLoading: banksLoading } = useQuery({
    queryKey: ['paystack-banks'],
    queryFn: () => apiGet<Bank[]>('/payouts/banks'),
    staleTime: 60 * 60 * 1000, // 1 hour — bank list rarely changes
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      apiPost<BankAccount>('/payouts/bank-account', {
        accountNumber,
        bankCode: selectedBankCode,
        bankName: selectedBankName,
      }),
    onSuccess: (result) => {
      toast.success(`Account verified: ${result.data.accountName}`);
      queryClient.invalidateQueries({ queryKey: ['doctor-bank-account'] });
      setAccountNumber('');
      setSelectedBankCode('');
      setSelectedBankName('');
      setBankSearch('');
    },
    onError: () => {
      toast.error('Could not verify account. Please check your details.');
    },
  });

  const filteredBanks = (banks ?? []).filter((b) =>
    b.name.toLowerCase().includes(bankSearch.toLowerCase()),
  );

  const handleSelectBank = (bank: Bank) => {
    setSelectedBankCode(bank.code);
    setSelectedBankName(bank.name);
    setBankSearch(bank.name);
    setShowBankList(false);
  };

  const canSave = accountNumber.length === 10 && selectedBankCode;

  return (
    <div className="page-container py-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
          Bank account
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          Add your bank account to receive earnings payouts
        </p>
      </div>

      {/* Current bank account */}
      {accountLoading ? (
        <Skeleton className="h-24 rounded-2xl mb-6" />
      ) : bankAccount ? (
        <Card padding="lg" className="mb-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
              <CheckCircle size={20} className="text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-medium text-[var(--text-primary)]">
                  {bankAccount.accountName}
                </p>
                {bankAccount.isVerified && (
                  <span className="badge bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 text-xs">
                    Verified
                  </span>
                )}
              </div>
              <p className="text-sm text-[var(--text-muted)]">
                {bankAccount.bankName} · {bankAccount.accountNumber}
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <Card padding="md" className="mb-6 bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800">
          <div className="flex items-start gap-3">
            <AlertCircle size={17} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              No bank account added yet. Add one below so admin can send your earnings to your bank.
            </p>
          </div>
        </Card>
      )}

      {/* Add / update form */}
      <Card padding="lg">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
            <Building2 size={16} className="text-brand-600 dark:text-brand-400" />
          </div>
          <h2 className="font-display font-semibold text-[var(--text-primary)]">
            {bankAccount ? 'Update bank account' : 'Add bank account'}
          </h2>
        </div>

        <div className="space-y-4">
          {/* Bank selector */}
          <div className="relative">
            <Input
              label="Bank name"
              placeholder="Search for your bank..."
              value={bankSearch}
              onChange={(e) => {
                setBankSearch(e.target.value);
                setShowBankList(true);
                if (!e.target.value) setSelectedBankCode('');
              }}
              onFocus={() => setShowBankList(true)}
              hint={banksLoading ? 'Loading banks...' : 'Start typing to search'}
            />
            {showBankList && filteredBanks.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-[var(--surface-0)] border border-[var(--border)] rounded-xl shadow-xl max-h-52 overflow-y-auto">
                {filteredBanks.slice(0, 20).map((bank) => (
                  <button
                    key={bank.code}
                    type="button"
                    className="w-full px-4 py-2.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors"
                    onClick={() => handleSelectBank(bank)}
                  >
                    {bank.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Account number */}
          <Input
            label="Account number"
            placeholder="10-digit account number"
            value={accountNumber}
            maxLength={10}
            onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
            hint="Paystack will verify your account name automatically"
          />

          <div className="pt-2">
            <Button
              onClick={() => saveMutation.mutate()}
              loading={saveMutation.isPending}
              disabled={!canSave}
              leftIcon={<CreditCard size={15} />}
              className="w-full"
            >
              {saveMutation.isPending ? 'Verifying account...' : 'Save & verify account'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Info */}
      <p className="text-xs text-[var(--text-muted)] text-center mt-4">
        Your account details are verified with Paystack in real time.
        Only Nigerian bank accounts are supported.
      </p>
    </div>
  );
};
