import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Card } from '@/components/common/index';
import { apiPost } from '@/services/api';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
});
type FormData = z.infer<typeof schema>;

export const ForgotPasswordPage: React.FC = () => {
  const [sent, setSent] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    await apiPost('/auth/forgot-password', data);
    setSubmittedEmail(data.email);
    setSent(true);
  };

  if (sent) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center mx-auto">
            <CheckCircle2 size={28} className="text-brand-600" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
              Check your email
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-2 leading-relaxed">
              If <span className="text-[var(--text-primary)] font-medium">{submittedEmail}</span> is
              registered, you'll receive a password reset link shortly.
            </p>
          </div>
        </div>
        <Card padding="lg" className="text-center space-y-3">
          <p className="text-sm text-[var(--text-muted)]">
            Didn't receive it? Check your spam folder or try again.
          </p>
          <Button variant="secondary" className="w-full" onClick={() => setSent(false)}>
            Try again
          </Button>
        </Card>
        <p className="text-center text-sm text-[var(--text-muted)]">
          <Link to="/auth/login" className="text-brand-600 hover:text-brand-700 dark:text-brand-400 flex items-center justify-center gap-1.5 transition-colors">
            <ArrowLeft size={14} /> Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
          Reset your password
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          Enter your email and we'll send a reset link
        </p>
      </div>

      <Card padding="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Input
            label="Email address"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            leftIcon={<Mail size={16} />}
            error={errors.email?.message}
            required
            {...register('email')}
          />
          <Button type="submit" loading={isSubmitting} className="w-full" size="lg">
            Send reset link
          </Button>
        </form>
      </Card>

      <p className="text-center text-sm text-[var(--text-muted)]">
        <Link
          to="/auth/login"
          className="text-brand-600 hover:text-brand-700 dark:text-brand-400 flex items-center justify-center gap-1.5 transition-colors"
        >
          <ArrowLeft size={14} /> Back to sign in
        </Link>
      </p>
    </div>
  );
};
