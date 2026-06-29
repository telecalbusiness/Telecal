import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Stethoscope, Microscope, AlertTriangle, ChevronRight, CreditCard, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/common/Button';
import { Select, Textarea } from '@/components/common/Input';
import { apiPost } from '@/services/api';
import { ConsultationType, DisciplineCategory, TriagePriority, FEES } from '@mediconnect/shared';
import { formatCurrency, formatDiscipline, cn } from '@/utils';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/services/api';

const specialistDisciplines = Object.values(DisciplineCategory).filter(
  (d) => d !== DisciplineCategory.GENERAL_PRACTICE,
).map((v) => ({ value: v, label: formatDiscipline(v) }));

const schema = z.object({
  consultationType: z.nativeEnum(ConsultationType),
  discipline: z.nativeEnum(DisciplineCategory).optional(),
  priority: z.nativeEnum(TriagePriority).default(TriagePriority.NORMAL),
  notes: z.string().max(500).optional(),
}).refine(
  (d) => d.consultationType !== ConsultationType.SPECIALIST || !!d.discipline,
  { message: 'Please select a specialty', path: ['discipline'] },
);
type FormData = z.infer<typeof schema>;

export const NewAppointmentPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get('type') as ConsultationType | null;

  const [selectedType, setSelectedType] = useState<ConsultationType | null>(initialType);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'paystack'>('paystack');

  const { data: walletData } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => apiGet<{ balanceKobo: number }>('/wallet'),
    staleTime: 30_000,
  });

  const { register, handleSubmit, setValue, watch, formState: { errors } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: {
        consultationType: initialType ?? undefined,
        priority: TriagePriority.NORMAL,
      },
    });

  const priority = watch('priority');
  const fee = selectedType === ConsultationType.GENERAL_PRACTICE
    ? FEES.GENERAL_PRACTICE_KOBO
    : FEES.SPECIALIST_KOBO;

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const result = await apiPost<{
        appointment: { id: string };
        payment: { paystackReference: string };
      }>('/appointments', { ...data, useWallet: paymentMethod === 'wallet' });

      if (paymentMethod === 'wallet') {
        // Invalidate cache so appointment detail shows fresh data
        await queryClient.invalidateQueries({ queryKey: ['appointments'] });
        await queryClient.invalidateQueries({ queryKey: ['wallet'] });
        toast.success('Consultation booked! A doctor will be assigned shortly.');
        navigate(`/dashboard/appointments/${result.data.appointment.id}`);
      } else {
        // Paystack redirect
        const paymentResult = await apiPost<{ authorizationUrl: string }>(
          `/payments/appointments/${result.data.appointment.id}/initialize`,
        );
        toast.success('Redirecting to payment...');
        window.location.href = paymentResult.data.authorizationUrl;
      }
    } catch {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-container py-6 max-w-2xl animate-fade-in">
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1 transition-colors mb-3"
        >
          ← Back
        </button>
        <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
          New consultation
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Select a consultation type to get connected with an available doctor
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        {/* Consultation type */}
        <div>
          <p className="text-sm font-medium text-[var(--text-secondary)] mb-3">
            Consultation type <span className="text-red-500">*</span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TypeCard
              selected={selectedType === ConsultationType.GENERAL_PRACTICE}
              icon={<Stethoscope size={22} />}
              title="General practitioner"
              description="Common health concerns, symptoms, follow-ups"
              fee={FEES.GENERAL_PRACTICE_KOBO}
              onClick={() => {
                setSelectedType(ConsultationType.GENERAL_PRACTICE);
                setValue('consultationType', ConsultationType.GENERAL_PRACTICE);
              }}
            />
            <TypeCard
              selected={selectedType === ConsultationType.SPECIALIST}
              icon={<Microscope size={22} />}
              title="Specialist"
              description="Targeted care from a discipline-specific doctor"
              fee={FEES.SPECIALIST_KOBO}
              onClick={() => {
                setSelectedType(ConsultationType.SPECIALIST);
                setValue('consultationType', ConsultationType.SPECIALIST);
              }}
            />
          </div>
        </div>

        {/* Specialist discipline */}
        {selectedType === ConsultationType.SPECIALIST && (
          <div className="animate-slide-down">
            <Select
              label="Choose specialty"
              options={specialistDisciplines}
              placeholder="Select a specialty..."
              error={errors.discipline?.message}
              required
              {...register('discipline')}
            />
          </div>
        )}

        {/* Priority */}
        {selectedType && (
          <div className="animate-slide-down">
            <p className="text-sm font-medium text-[var(--text-secondary)] mb-2">Priority</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setValue('priority', TriagePriority.NORMAL)}
                className={cn(
                  'flex-1 p-3 rounded-xl border-2 text-sm font-medium transition-all',
                  priority === TriagePriority.NORMAL
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                    : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)]',
                )}
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() => setValue('priority', TriagePriority.URGENT)}
                className={cn(
                  'flex-1 p-3 rounded-xl border-2 text-sm font-medium transition-all flex items-center justify-center gap-2',
                  priority === TriagePriority.URGENT
                    ? 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                    : 'border-[var(--border)] text-[var(--text-muted)] hover:border-red-300',
                )}
              >
                <AlertTriangle size={14} /> Urgent
              </button>
            </div>
            {priority === TriagePriority.URGENT && (
              <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                <AlertTriangle size={12} />
                Urgent requests alert all online GPs immediately and jump the queue.
              </p>
            )}
          </div>
        )}

        {/* Notes */}
        {selectedType && (
          <div className="animate-slide-down">
            <Textarea
              label="Brief description of your concern (optional)"
              placeholder="Describe your symptoms or what you'd like to discuss..."
              rows={3}
              {...register('notes')}
            />
          </div>
        )}

        {/* Payment summary */}
        {selectedType && (
          <div className="space-y-3 animate-slide-down">
            {/* Wallet option */}
            <button
              type="button"
              onClick={() => setPaymentMethod('wallet')}
              className={cn(
                'w-full p-4 rounded-xl border-2 text-left transition-all',
                paymentMethod === 'wallet'
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                  : 'border-[var(--border)] hover:border-brand-300',
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center',
                    paymentMethod === 'wallet'
                      ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-600'
                      : 'bg-[var(--surface-2)] text-[var(--text-muted)]',
                  )}>
                    <Wallet size={17} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">Pay with wallet</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      Instant · Balance: {formatCurrency(walletData?.balanceKobo ?? 0)}
                    </p>
                  </div>
                </div>
                {(walletData?.balanceKobo ?? 0) >= fee && (
                  <span className="text-xs text-green-600 font-medium">Sufficient balance</span>
                )}
                {(walletData?.balanceKobo ?? 0) < fee && (
                  <span className="text-xs text-red-500 font-medium">Insufficient</span>
                )}
              </div>
            </button>

            {/* Paystack option */}
            <button
              type="button"
              onClick={() => setPaymentMethod('paystack')}
              className={cn(
                'w-full p-4 rounded-xl border-2 text-left transition-all',
                paymentMethod === 'paystack'
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                  : 'border-[var(--border)] hover:border-brand-300',
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center',
                  paymentMethod === 'paystack'
                    ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-600'
                    : 'bg-[var(--surface-2)] text-[var(--text-muted)]',
                )}>
                  <CreditCard size={17} />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">Pay with card</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Via Paystack · {formatCurrency(fee)}
                  </p>
                </div>
              </div>
            </button>

            {paymentMethod === 'wallet' && (walletData?.balanceKobo ?? 0) < fee && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800">
                <p className="text-xs text-yellow-700 dark:text-yellow-400">
                  You need {formatCurrency(fee - (walletData?.balanceKobo ?? 0))} more in your wallet
                </p>
                <Link to="/dashboard/wallet" className="text-xs font-medium text-brand-600 hover:text-brand-700">
                  Top up →
                </Link>
              </div>
            )}
          </div>
        )}

        <Button
          type="submit"
          loading={isSubmitting}
          disabled={!selectedType}
          className="w-full"
          size="lg"
          rightIcon={<ChevronRight size={16} />}
        >
          Continue to payment
        </Button>
      </form>
    </div>
  );
};

// ─── Type selection card ──────────────────────────────────────

const TypeCard: React.FC<{
  selected: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  fee: number;
  onClick: () => void;
}> = ({ selected, icon, title, description, fee, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'w-full text-left p-4 rounded-xl border-2 transition-all space-y-2',
      selected
        ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-sm'
        : 'border-[var(--border)] hover:border-[var(--border-strong)] bg-[var(--surface-0)]',
    )}
  >
    <div className={cn(
      'w-10 h-10 rounded-xl flex items-center justify-center',
      selected
        ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400'
        : 'bg-[var(--surface-2)] text-[var(--text-muted)]',
    )}>
      {icon}
    </div>
    <div>
      <p className={cn('font-medium text-sm', selected ? 'text-brand-700 dark:text-brand-300' : 'text-[var(--text-primary)]')}>
        {title}
      </p>
      <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">{description}</p>
    </div>
    <p className={cn('text-sm font-semibold font-display', selected ? 'text-brand-600 dark:text-brand-400' : 'text-[var(--text-secondary)]')}>
      {formatCurrency(fee)}
    </p>
  </button>
);
