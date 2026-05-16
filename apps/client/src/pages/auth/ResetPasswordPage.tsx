import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock, Eye, EyeOff, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Card } from '@/components/common/index';
import { apiPost } from '@/services/api';

const schema = z.object({
  password: z.string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Z]/, 'Must include an uppercase letter')
    .regex(/[a-z]/, 'Must include a lowercase letter')
    .regex(/[0-9]/, 'Must include a number')
    .regex(/[^A-Za-z0-9]/, 'Must include a special character'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type FormData = z.infer<typeof schema>;

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  // No token — show error
  if (!token) {
    return (
      <div className="space-y-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
          <AlertTriangle size={28} className="text-red-500" />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
            Invalid reset link
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            This password reset link is missing or invalid.
            Please request a new one.
          </p>
        </div>
        <Link
          to="/auth/forgot-password"
          className="btn btn-primary w-full inline-flex"
        >
          Request new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center mx-auto">
          <CheckCircle2 size={28} className="text-brand-600" />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
            Password reset
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Your password has been changed. All other sessions have been signed out.
          </p>
        </div>
        <Button className="w-full" size="lg" onClick={() => navigate('/auth/login')}>
          Sign in with new password
        </Button>
      </div>
    );
  }

  const onSubmit = async (data: FormData) => {
    await apiPost('/auth/reset-password', { token, password: data.password });
    setDone(true);
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
          Set new password
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          Choose a strong password for your account
        </p>
      </div>

      <Card padding="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Input
            label="New password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Create a strong password"
            leftIcon={<Lock size={16} />}
            rightElement={
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
            hint="Min 8 chars with uppercase, lowercase, number, and symbol"
            error={errors.password?.message}
            required
            {...register('password')}
          />
          <Input
            label="Confirm new password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Repeat your password"
            leftIcon={<Lock size={16} />}
            error={errors.confirmPassword?.message}
            required
            {...register('confirmPassword')}
          />
          <Button type="submit" loading={isSubmitting} className="w-full" size="lg">
            Reset password
          </Button>
        </form>
      </Card>

      <p className="text-center text-sm text-[var(--text-muted)]">
        Remembered it?{' '}
        <Link
          to="/auth/login"
          className="text-brand-600 hover:text-brand-700 dark:text-brand-400 font-medium transition-colors"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
};
