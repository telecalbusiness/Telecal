import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { User, Lock, Heart, CheckCircle2, Camera, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiGet, apiPatch } from '@/services/api';
import { useAuth, useAppDispatch } from '@/hooks/useAppDispatch';
import { fetchCurrentUser } from '@/store/slices/authSlice';
import { Button } from '@/components/common/Button';
import { Input, Textarea, CustomSelect } from '@/components/common/Input';
import { Card } from '@/components/common/index';
import { UserRole } from '@mediconnect/shared';
import { cn } from '@/utils';

const TABS = ['Personal info', 'Password', 'Health profile'] as const;
type Tab = typeof TABS[number];

// ─── Schemas ──────────────────────────────────────────────────

const personalInfoSchema = z.object({
  email: z.string().email('Enter a valid email'),
  phoneNumber: z.string().max(20).optional(),
});

type PersonalInfoData = z.infer<typeof personalInfoSchema>;

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string()
    .min(8).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match', path: ['confirmPassword'],
});

const healthSchema = z.object({
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  phoneNumber: z.string().max(20).optional(),
  bloodGroup: z.enum(['A+','A-','B+','B-','AB+','AB-','O+','O-']).optional(),
  genotype: z.enum(['AA','AS','SS','AC','SC']).optional(),
  allergies: z.string().max(500).optional(),
  emergencyContactName: z.string().max(100).optional(),
  emergencyContactPhone: z.string().max(20).optional(),
});

type PasswordData = z.infer<typeof passwordSchema>;
type HealthData = z.infer<typeof healthSchema>;

// ─── Main page ────────────────────────────────────────────────

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('Personal info');
  const isPatient = user?.role === UserRole.PATIENT;

  const tabs = isPatient ? TABS : TABS.slice(0, 2);

  return (
    <div className="page-container py-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
          Profile settings
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          Manage your account and personal information
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-[var(--surface-2)] p-1 rounded-xl mb-6">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all',
              activeTab === tab
                ? 'bg-[var(--surface-0)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
            )}
          >
            {tab === 'Personal info' && <User size={14} />}
            {tab === 'Password' && <Lock size={14} />}
            {tab === 'Health profile' && <Heart size={14} />}
            <span className="hidden sm:inline">{tab}</span>
          </button>
        ))}
      </div>

      {activeTab === 'Personal info' && (
        <>
          <AvatarUpload />
          <PersonalInfoForm />
        </>
      )}
      {activeTab === 'Password' && <PasswordForm />}
      {activeTab === 'Health profile' && isPatient && <HealthProfileForm />}
    </div>
  );
};

// ─── Avatar upload ────────────────────────────────────────────
const AvatarUpload: React.FC = () => {
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch('/api/v1/users/me/avatar', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const err = await response.json() as { error?: { message?: string } };
        throw new Error(err.error?.message ?? 'Upload failed');
      }

      toast.success('Profile picture updated');
      // Refresh auth user so new avatar shows everywhere
      await dispatch(fetchCurrentUser());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  return (
    <div className="flex items-center gap-5 p-5 card mb-5">
      {/* Avatar preview */}
      <div className="relative flex-shrink-0">
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt="Profile"
            className="w-20 h-20 rounded-full object-cover border-2 border-[var(--border)]"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center border-2 border-[var(--border)]">
            <span className="font-display text-2xl font-semibold text-brand-600 dark:text-brand-400">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </span>
          </div>
        )}

        {/* Upload overlay */}
        <label className={`absolute inset-0 rounded-full flex items-center justify-center cursor-pointer
          bg-black/40 opacity-0 hover:opacity-100 transition-opacity
          ${uploading ? 'opacity-100' : ''}`}
        >
          <input
            type="file"
            className="sr-only"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => void handleFile(e)}
            disabled={uploading}
          />
          {uploading ? (
            <Loader2 size={20} className="text-white animate-spin" />
          ) : (
            <Camera size={20} className="text-white" />
          )}
        </label>
      </div>

      <div>
        <p className="font-medium text-sm text-[var(--text-primary)]">
          Profile picture
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          JPEG, PNG or WebP · Max 5MB
        </p>
        <label className="mt-2 btn btn-secondary text-xs px-3 py-1.5 rounded-lg cursor-pointer inline-flex items-center gap-1.5">
          <Camera size={13} />
          {uploading ? 'Uploading...' : 'Change photo'}
          <input
            type="file"
            className="sr-only"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => void handleFile(e)}
            disabled={uploading}
          />
        </label>
      </div>
    </div>
  );
};

// ─── Personal info form ───────────────────────────────────────

const PersonalInfoForm: React.FC = () => {
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const isPatient = user?.role === UserRole.PATIENT;

  const { register, handleSubmit, formState: { errors, isSubmitting, isDirty } } =
    useForm<PersonalInfoData>({
      resolver: zodResolver(personalInfoSchema),
      defaultValues: {
        email: user?.email ?? '',
        phoneNumber: '',
      },
    });

  const onSubmit = async (data: PersonalInfoData) => {
    // Only send fields that differ from current values
    const payload: Record<string, string> = {};
    if (data.email !== user?.email) payload['email'] = data.email;
    if (data.phoneNumber) payload['phoneNumber'] = data.phoneNumber;

    if (Object.keys(payload).length === 0) {
      toast('No changes to save');
      return;
    }

    await apiPatch('/users/me', payload);
    toast.success('Profile updated');
    await dispatch(fetchCurrentUser());
  };

  return (
    <Card padding="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

        {/* Name fields — permanently locked */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text-secondary)]">
              First name
            </label>
            <div className="input-base bg-[var(--surface-2)] text-[var(--text-muted)] cursor-not-allowed select-none">
              {user?.firstName}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text-secondary)]">
              Last name
            </label>
            <div className="input-base bg-[var(--surface-2)] text-[var(--text-muted)] cursor-not-allowed select-none">
              {user?.lastName}
            </div>
          </div>
        </div>
        <p className="text-xs text-[var(--text-muted)] -mt-2">
          Your name is permanent after registration and cannot be changed.
        </p>

        {/* Email — editable */}
        <Input
          label="Email address"
          type="email"
          error={errors.email?.message}
          hint="Changing your email will require re-verification"
          {...register('email')}
        />

        {/* Phone — editable, patients only */}
        {isPatient && (
          <Input
            label="Phone number"
            type="tel"
            placeholder="+234.."
            hint="Used for appointment notifications"
            error={errors.phoneNumber?.message}
            {...register('phoneNumber')}
          />
        )}

        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 p-3 flex items-start gap-2.5">
          <span className="text-amber-600 text-sm flex-shrink-0 mt-0.5">⚠</span>
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
            For security, your name cannot be changed after registration.
            This prevents false identity claims on the platform.
          </p>
        </div>

        <div className="flex justify-end pt-1">
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            Save changes
          </Button>
        </div>
      </form>
    </Card>
  );
};

// ─── Password form ────────────────────────────────────────────

const PasswordForm: React.FC = () => {
  const [success, setSuccess] = useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<PasswordData>({ resolver: zodResolver(passwordSchema) });

  const onSubmit = async (data: PasswordData) => {
    await apiPatch('/users/me/password', data);
    toast.success('Password changed. Please sign in again on other devices.');
    reset();
    setSuccess(true);
  };

  if (success) {
    return (
      <Card padding="lg" className="text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
          <CheckCircle2 size={24} className="text-green-600" />
        </div>
        <p className="font-medium text-[var(--text-primary)]">Password updated successfully</p>
        <p className="text-sm text-[var(--text-muted)]">
          All other sessions have been signed out for security.
        </p>
        <Button size="sm" variant="secondary" onClick={() => setSuccess(false)}>
          Change again
        </Button>
      </Card>
    );
  }

  return (
    <Card padding="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Current password" type="password"
          error={errors.currentPassword?.message} required
          {...register('currentPassword')} />
        <Input label="New password" type="password"
          hint="Min 8 chars with uppercase, lowercase, number, and symbol"
          error={errors.newPassword?.message} required
          {...register('newPassword')} />
        <Input label="Confirm new password" type="password"
          error={errors.confirmPassword?.message} required
          {...register('confirmPassword')} />
        <div className="flex justify-end pt-1">
          <Button type="submit" loading={isSubmitting}>
            Update password
          </Button>
        </div>
      </form>
    </Card>
  );
};

// ─── Health profile form (patient only) ──────────────────────

const HealthProfileForm: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ['patient-profile'],
    queryFn: () => apiGet<Record<string, string | null>>('/patients/me/profile'),
  });

  const { register, handleSubmit, control, formState: { isSubmitting } } =
    useForm<HealthData>({
      resolver: zodResolver(healthSchema),
      values: {
        gender: (profile?.gender as HealthData['gender']) ?? undefined,
        bloodGroup: (profile?.bloodGroup as HealthData['bloodGroup']) ?? undefined,
        genotype: (profile?.genotype as HealthData['genotype']) ?? undefined,
        phoneNumber: profile?.phoneNumber ?? '',
        allergies: profile?.allergies ?? '',
        emergencyContactName: profile?.emergencyContactName ?? '',
        emergencyContactPhone: profile?.emergencyContactPhone ?? '',
      },
    });

  const onSubmit = async (data: HealthData) => {
    await apiPatch('/patients/me/profile', data);
    toast.success('Health profile updated');
    void queryClient.invalidateQueries({ queryKey: ['patient-profile'] });
  };

  const genderOptions = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other / Prefer not to say' },
  ];
  const bloodGroups = ['A+','A-','B+','B-','AB+','AB-','O+','O-'].map((v) => ({ value: v, label: v }));
  const genotypes = ['AA','AS','SS','AC','SC'].map((v) => ({ value: v, label: v }));

  return (
    <Card padding="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Controller
            name="gender"
            control={control}
            render={({ field, fieldState }) => (
              <CustomSelect
                label="Gender"
                options={genderOptions}
                placeholder="Select..."
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <Input label="Phone number" type="tel" placeholder="+234..."
            {...register('phoneNumber')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Controller
            name="bloodGroup"
            control={control}
            render={({ field, fieldState }) => (
              <CustomSelect
                label="Blood group"
                options={bloodGroups}
                placeholder="Select..."
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            name="genotype"
            control={control}
            render={({ field, fieldState }) => (
              <CustomSelect
                label="Genotype"
                options={genotypes}
                placeholder="Select..."
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
        </div>
        <Textarea label="Known allergies" placeholder="List any known allergies..."
          rows={2} {...register('allergies')} />
        <div className="pt-2 border-t border-[var(--border)]">
          <p className="text-sm font-medium text-[var(--text-secondary)] mb-3">Emergency contact</p>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Contact name" placeholder="Full name"
              {...register('emergencyContactName')} />
            <Input label="Contact phone" type="tel" placeholder="+234..."
              {...register('emergencyContactPhone')} />
          </div>
        </div>
        <div className="flex justify-end pt-1">
          <Button type="submit" loading={isSubmitting}>Save health profile</Button>
        </div>
      </form>
    </Card>
  );
};
