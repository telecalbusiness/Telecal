import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/index';
import { apiGet } from '@/services/api';

// ─── Payment success ──────────────────────────────────────────

export const PaymentSuccessPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const reference = searchParams.get('reference') ?? searchParams.get('trxref');
  const type = searchParams.get('type');
  const redirectPath = type === 'wallet' ? '/dashboard/wallet' : '/dashboard/appointments';
  const [status, setStatus] = useState<'waiting' | 'confirmed' | 'timeout'>('waiting');
  const [dots, setDots] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dotRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const attemptRef = useRef(0);
  const MAX_ATTEMPTS = 15; // 15 × 2s = 30 seconds max wait

  useEffect(() => {
    // Animate dots while waiting
    dotRef.current = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'));
    }, 500);

    // Poll backend every 2 seconds to check if webhook was received
    pollRef.current = setInterval(async () => {
      attemptRef.current += 1;

      try {
        // Check payment status by reference
        const data = await apiGet<{ confirmed: boolean }>(
          `/payments/status?reference=${reference ?? ''}`,
        );
        if (data.confirmed) {
          setStatus('confirmed');
          clearInterval(pollRef.current!);
          clearInterval(dotRef.current!);
          // Navigate after 2s so user sees the confirmed state
          setTimeout(() => navigate(redirectPath), 2000);
          return;
        }
      } catch {
        // Keep polling — error might be transient
      }

      if (attemptRef.current >= MAX_ATTEMPTS) {
        setStatus('timeout');
        clearInterval(pollRef.current!);
        clearInterval(dotRef.current!);
        // Navigate anyway after timeout — appointment will update when webhook fires
        setTimeout(() => navigate(redirectPath), 3000);
      }
    }, 2000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (dotRef.current) clearInterval(dotRef.current);
    };
  }, [navigate, reference]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 auth-bg">
      <Card padding="lg" className="max-w-md w-full text-center space-y-5 animate-scale-in">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto transition-colors ${
          status === 'confirmed'
            ? 'bg-green-100 dark:bg-green-900/30'
            : 'bg-blue-100 dark:bg-blue-900/30'
        }`}>
          {status === 'confirmed'
            ? <CheckCircle2 size={32} className="text-green-600" />
            : <Loader2 size={32} className="text-blue-600 animate-spin" />
          }
        </div>

        <div className="space-y-2">
          <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
            {status === 'confirmed' ? 'Payment confirmed!' : 'Processing payment'}
          </h1>
          <p className="text-sm text-[var(--text-muted)] leading-relaxed">
            {status === 'confirmed'
              ? 'Your payment has been confirmed. The system is now finding an available doctor.'
              : status === 'timeout'
              ? 'Taking longer than expected. Your appointment will update shortly.'
              : `Waiting for payment confirmation${dots}`
            }
          </p>
          {reference && (
            <p className="text-xs font-mono text-[var(--text-muted)] bg-[var(--surface-2)] px-3 py-1.5 rounded-lg inline-block">
              Ref: {reference}
            </p>
          )}
        </div>

        <Button
          className="w-full"
          onClick={() => navigate(redirectPath)}
        >
          {type === 'wallet' ? 'Go to wallet' : 'Go to appointments'}
        </Button>
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
