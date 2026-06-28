import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Card } from '@/components/common/index';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { loginUser } from '@/store/slices/authSlice';
import { UserRole } from '@mediconnect/shared';


const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type FormData = z.infer<typeof schema>;

export const LoginPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      const result = await dispatch(loginUser(data)).unwrap();
      toast.success(`Welcome back, ${result.firstName}!`);
      if (result.role === UserRole.ADMIN) navigate('/dashboard');
      else if (result.role === UserRole.DOCTOR) navigate('/dashboard');
      else navigate('/dashboard');
    } catch (err: unknown) {
      const message = typeof err === 'string' ? err : 'Invalid email or password';
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
          Sign in to Telecal
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          Access your health consultations and records
        </p>
      </div>

      {/* Card */}
      <Card padding="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Input
            label="Email address"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            leftIcon={<Mail size={16} />}
            error={errors.email?.message}
            {...register('email')}
          />

          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your password"
            autoComplete="current-password"
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
            error={errors.password?.message}
            {...register('password')}
          />

          <div className="flex justify-end">
            <Link
              to="/auth/forgot-password"
              className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 transition-colors"
            >
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            loading={isSubmitting}
            className="w-full"
            size="lg"
          >
            Sign in
          </Button>
        </form>
      </Card>

      {/* Register links */}
      <div className="space-y-2">
        <p className="text-center text-sm text-[var(--text-muted)]">
          New patient?{' '}
          <Link
            to="/auth/register/patient"
            className="text-brand-600 hover:text-brand-700 dark:text-brand-400 font-medium transition-colors"
          >
            Create a patient account
          </Link>
        </p>
        <p className="text-center text-sm text-[var(--text-muted)]">
          Are you a doctor?{' '}
          <Link
            to="/auth/register/doctor"
            className="text-brand-600 hover:text-brand-700 dark:text-brand-400 font-medium transition-colors"
          >
            Register as a doctor
          </Link>
        </p>
      </div>
    </div>
  );
};
