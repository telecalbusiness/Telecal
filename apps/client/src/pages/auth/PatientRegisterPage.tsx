import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Card } from '@/components/common/index';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { fetchCurrentUser } from '@/store/slices/authSlice';
import { apiPost } from '@/services/api';

const schema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  email: z.string().email('Enter a valid email'),
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[a-z]/, 'Must contain a lowercase letter')
    .regex(/[0-9]/, 'Must contain a number')
    .regex(/[^A-Za-z0-9]/, 'Must contain a special character'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});
type FormData = z.infer<typeof schema>;

// Password strength indicator
const getStrength = (pw: string): { level: number; label: string; color: string } => {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (pw.length >= 12) score++;
  const levels = [
    { level: 0, label: '', color: '' },
    { level: 1, label: 'Weak', color: 'bg-red-500' },
    { level: 2, label: 'Fair', color: 'bg-orange-400' },
    { level: 3, label: 'Good', color: 'bg-yellow-400' },
    { level: 4, label: 'Strong', color: 'bg-brand-500' },
    { level: 5, label: 'Very strong', color: 'bg-brand-600' },
  ];
  return levels[score] ?? levels[0];
};

export const PatientRegisterPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [passwordValue, setPasswordValue] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const strength = getStrength(passwordValue);

  const onSubmit = async (data: FormData) => {
    try {
      await apiPost('/auth/register/patient', {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
      });
      await dispatch(fetchCurrentUser()).unwrap();
      toast.success('Account created! Welcome to Telecal.');
      navigate('/dashboard');
    } catch {
      // Handled by interceptor
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
          Create patient account
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          Get a unique file number and access verified doctors
        </p>
      </div>

      <Card padding="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="First name"
              placeholder="Ada"
              leftIcon={<User size={15} />}
              error={errors.firstName?.message}
              required
              {...register('firstName')}
            />
            <Input
              label="Last name"
              placeholder="Okonkwo"
              error={errors.lastName?.message}
              required
              {...register('lastName')}
            />
          </div>

          <Input
            label="Email address"
            type="email"
            placeholder="you@example.com"
            leftIcon={<Mail size={16} />}
            error={errors.email?.message}
            required
            {...register('email')}
          />

          <div className="space-y-1">
            <Input
              label="Password"
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
              error={errors.password?.message}
              required
              {...register('password', {
                onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                  setPasswordValue(e.target.value),
              })}
            />
            {/* Strength bar */}
            {passwordValue && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                        i <= strength.level ? strength.color : 'bg-[var(--surface-3)]'
                      }`}
                    />
                  ))}
                </div>
                {strength.label && (
                  <p className="text-xs text-[var(--text-muted)]">
                    Strength: <span className="font-medium">{strength.label}</span>
                  </p>
                )}
              </div>
            )}
          </div>

          <Input
            label="Confirm password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Repeat your password"
            leftIcon={<Lock size={16} />}
            error={errors.confirmPassword?.message}
            required
            {...register('confirmPassword')}
          />

          <Button type="submit" loading={isSubmitting} className="w-full" size="lg">
            Create account
          </Button>
        </form>
      </Card>

      <p className="text-center text-sm text-[var(--text-muted)]">
        Already have an account?{' '}
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
