import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/index';

// ─── Payment success ──────────────────────────────────────────

export const PaymentSuccessPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const reference = searchParams.get('reference') ?? searchParams.get('trxref');
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          navigate('/dashboard/appointments');
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 auth-bg">
      <Card padding="lg" className="max-w-md w-full text-center space-y-5 animate-scale-in">
        <div className="w-16 h-16 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
          <CheckCircle2 size={32} className="text-green-600" />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
            Payment successful
          </h1>
          <p className="text-sm text-[var(--text-muted)] leading-relaxed">
            Your payment has been confirmed. The system is now finding an available
            doctor and will notify you once assigned.
          </p>
          {reference && (
            <p className="text-xs font-mono text-[var(--text-muted)] bg-[var(--surface-2)] px-3 py-1.5 rounded-lg inline-block">
              Ref: {reference}
            </p>
          )}
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2 text-sm text-[var(--text-muted)]">
            <Loader2 size={14} className="animate-spin" />
            Redirecting in {countdown}s...
          </div>
          <Button className="w-full" onClick={() => navigate('/dashboard/appointments')}>
            Go to appointments
          </Button>
        </div>
      </Card>
    </div>
  );
};

// ─── Payment failure ──────────────────────────────────────────

export const PaymentFailedPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 auth-bg">
      <Card padding="lg" className="max-w-md w-full text-center space-y-5 animate-scale-in">
        <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
          <XCircle size={32} className="text-red-500" />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
            Payment unsuccessful
          </h1>
          <p className="text-sm text-[var(--text-muted)] leading-relaxed">
            Your payment could not be processed. You have not been charged.
            Please try again or use a different payment method.
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => navigate('/dashboard')}
          >
            Go home
          </Button>
          <Button
            className="flex-1"
            onClick={() => navigate(-1)}
          >
            Try again
          </Button>
        </div>
      </Card>
    </div>
  );
};
