import React, { useState, useRef, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User, Lock, Heart, CheckCircle2, Camera, Loader2,
  Building2, CheckCircle, AlertCircle, CreditCard,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiGet, apiPatch, apiPost } from '@/services/api';
import { useAuth, useAppDispatch } from '@/hooks/useAppDispatch';
import { fetchCurrentUser } from '@/store/slices/authSlice';
import { Button } from '@/components/common/Button';
import { Input, Textarea, CustomSelect } from '@/components/common/Input';
import { Card, Skeleton } from '@/components/common/index';
import { UserRole } from '@mediconnect/shared';
import { cn } from '@/utils';

const PATIENT_TABS = ['Personal info', 'Password', 'Health profile'] as const;
const DOCTOR_TABS  = ['Personal info', 'Password', 'Bank account'] as const;
type AnyTab = 'Personal info' | 'Password' | 'Health profile' | 'Bank account';

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
type HealthData   = z.infer<typeof healthSchema>;

// ─── Main page ────────────────────────────────────────────────

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AnyTab>('Personal info');
  const isPatient = user?.role === UserRole.PATIENT;
  const isDoctor  = user?.role === UserRole.DOCTOR;

  const tabs: AnyTab[] = isPatient
    ? [...PATIENT_TABS]
    : isDoctor
    ? [...DOCTOR_TABS]
    : ['Personal info', 'Password'];

  const tabIcon = (tab: AnyTab) => {
    if (tab === 'Personal info') return <User size={14} />;
    if (tab === 'Password')      return <Lock size={14} />;
    if (tab === 'Health profile') return <Heart size={14} />;
    if (tab === 'Bank account')  return <Building2 size={14} />;
    return null;
  };

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
            {tabIcon(tab)}
            <span className="hidden sm:inline">{tab}</span>
          </button>
        ))}
      </div>

      {activeTab === 'Personal info'  && (<><AvatarUpload /><PersonalInfoForm /></>)}
      {activeTab === 'Password'       && <PasswordForm />}
      {activeTab === 'Health profile' && isPatient && <HealthProfileForm />}
      {activeTab === 'Bank account'   && isDoctor  && <BankAccountForm />}
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
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const response = await fetch('/api/v1/users/me/avatar', {
        method: 'POST', body: formData, credentials: 'include',
      });
      if (!response.ok) {
        const err = await response.json() as { error?: { message?: string } };
        throw new Error(err.error?.message ?? 'Upload failed');
      }
      toast.success('Profile picture updated');
      await dispatch(fetchCurrentUser());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="flex items-center gap-5 p-5 card mb-5">
      <div className="relative flex-shrink-0">
        {user?.avatarUrl ? (
          <img src={user.avatarUrl} alt="Profile"
            className="w-20 h-20 rounded-full object-cover border-2 border-[var(--border)]" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center border-2 border-[var(--border)]">
            <span className="font-display text-2xl font-semibold text-brand-600 dark:text-brand-400">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </span>
          </div>
        )}
        <label className={cn(
          'absolute inset-0 rounded-full flex items-center justify-center cursor-pointer bg-black/40 opacity-0 hover:opacity-100 transition-opacity',
          uploading && 'opacity-100',
        )}>
          <input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp"
            onChange={(e) => void handleFile(e)} disabled={uploading} />
          {uploading
            ? <Loader2 size={20} className="text-white animate-spin" />
            : <Camera size={20} className="text-white" />}
        </label>
      </div>
      <div>
        <p className="font-medium text-sm text-[var(--text-primary)]">Profile picture</p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">JPEG, PNG or WebP · Max 5MB</p>
        <label className="mt-2 btn btn-secondary text-xs px-3 py-1.5 rounded-lg cursor-pointer inline-flex items-center gap-1.5">
          <Camera size={13} />
          {uploading ? 'Uploading...' : 'Change photo'}
          <input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp"
            onChange={(e) => void handleFile(e)} disabled={uploading} />
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
      defaultValues: { email: user?.email ?? '', phoneNumber: '' },
    });

  const onSubmit = async (data: PersonalInfoData) => {
    const payload: Record<string, string> = {};
    if (data.email !== user?.email) payload['email'] = data.email;
    if (data.phoneNumber) payload['phoneNumber'] = data.phoneNumber;
    if (Object.keys(payload).length === 0) { toast('No changes to save'); return; }
    await apiPatch('/users/me', payload);
    toast.success('Profile updated');
    await dispatch(fetchCurrentUser());
  };

  return (
    <Card padding="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text-secondary)]">First name</label>
            <div className="input-base bg-[var(--surface-2)] text-[var(--text-muted)] cursor-not-allowed select-none">
              {user?.firstName}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text-secondary)]">Last name</label>
            <div className="input-base bg-[var(--surface-2)] text-[var(--text-muted)] cursor-not-allowed select-none">
              {user?.lastName}
            </div>
          </div>
        </div>
        <p className="text-xs text-[var(--text-muted)] -mt-2">
          Your name is permanent after registration and cannot be changed.
        </p>
        <Input label="Email address" type="email" error={errors.email?.message}
          hint="Changing your email will require re-verification" {...register('email')} />
        {isPatient && (
          <Input label="Phone number" type="tel" placeholder="+234.."
            hint="Used for appointment notifications" error={errors.phoneNumber?.message}
            {...register('phoneNumber')} />
        )}
        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 p-3 flex items-start gap-2.5">
          <span className="text-amber-600 text-sm flex-shrink-0 mt-0.5">⚠</span>
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
            For security, your name cannot be changed after registration.
            This prevents false identity claims on the platform.
          </p>
        </div>
        <div className="flex justify-end pt-1">
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>Save changes</Button>
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
        <Button size="sm" variant="secondary" onClick={() => setSuccess(false)}>Change again</Button>
      </Card>
    );
  }

  return (
    <Card padding="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Current password" type="password"
          error={errors.currentPassword?.message} required {...register('currentPassword')} />
        <Input label="New password" type="password"
          hint="Min 8 chars with uppercase, lowercase, number, and symbol"
          error={errors.newPassword?.message} required {...register('newPassword')} />
        <Input label="Confirm new password" type="password"
          error={errors.confirmPassword?.message} required {...register('confirmPassword')} />
        <div className="flex justify-end pt-1">
          <Button type="submit" loading={isSubmitting}>Update password</Button>
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
    { value: 'male',   label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other',  label: 'Other / Prefer not to say' },
  ];
  const bloodGroups = ['A+','A-','B+','B-','AB+','AB-','O+','O-'].map((v) => ({ value: v, label: v }));
  const genotypes   = ['AA','AS','SS','AC','SC'].map((v) => ({ value: v, label: v }));

  return (
    <Card padding="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Controller name="gender" control={control}
            render={({ field, fieldState }) => (
              <CustomSelect label="Gender" options={genderOptions} placeholder="Select..."
                value={field.value} onChange={field.onChange} error={fieldState.error?.message} />
            )} />
          <Input label="Phone number" type="tel" placeholder="+234..."
            {...register('phoneNumber')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Controller name="bloodGroup" control={control}
            render={({ field, fieldState }) => (
              <CustomSelect label="Blood group" options={bloodGroups} placeholder="Select..."
                value={field.value} onChange={field.onChange} error={fieldState.error?.message} />
            )} />
          <Controller name="genotype" control={control}
            render={({ field, fieldState }) => (
              <CustomSelect label="Genotype" options={genotypes} placeholder="Select..."
                value={field.value} onChange={field.onChange} error={fieldState.error?.message} />
            )} />
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

// ─── Bank account form (doctor only) ─────────────────────────

interface Bank { name: string; code: string; }
interface BankAccount {
  id: string; bankName: string; bankCode: string;
  accountNumber: string; accountName: string;
  isVerified: boolean; updatedAt: string;
}

const BankAccountForm: React.FC = () => {
  const queryClient = useQueryClient();
  const [accountNumber, setAccountNumber]     = useState('');
  const [selectedBankCode, setSelectedBankCode] = useState('');
  const [selectedBankName, setSelectedBankName] = useState('');
  const [bankSearch, setBankSearch]           = useState('');
  const [showBankList, setShowBankList]       = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowBankList(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const { data: bankAccount, isLoading: accountLoading } = useQuery({
    queryKey: ['doctor-bank-account'],
    queryFn: () => apiGet<BankAccount | null>('/payouts/bank-account'),
  });

  const { data: banks, isLoading: banksLoading } = useQuery({
    queryKey: ['paystack-banks'],
    queryFn: () => apiGet<Bank[]>('/payouts/banks'),
    staleTime: 60 * 60 * 1000,
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
    onError: () => toast.error('Could not verify account. Please check your details.'),
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

  return (
    <div className="space-y-4">
      {/* Current saved account */}
      {accountLoading ? (
        <Skeleton className="h-20 rounded-2xl" />
      ) : bankAccount ? (
        <Card padding="md">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
              <CheckCircle size={18} className="text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm text-[var(--text-primary)]">
                  {bankAccount.accountName}
                </p>
                <span className="badge bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 text-xs">
                  Verified
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {bankAccount.bankName} · {bankAccount.accountNumber}
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <Card padding="md" className="bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800">
          <div className="flex items-start gap-3">
            <AlertCircle size={17} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              No bank account added yet. Add one below to receive your earnings payouts.
            </p>
          </div>
        </Card>
      )}

      {/* Form */}
      <Card padding="lg">
        <h3 className="font-display font-semibold text-sm text-[var(--text-primary)] mb-4">
          {bankAccount ? 'Update bank account' : 'Add bank account'}
        </h3>

        <div className="space-y-4">
          {/* Bank search dropdown */}
          <div className="relative" ref={dropdownRef}>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--text-secondary)]">Bank name</label>
              <input
                type="text"
                className="input-base"
                placeholder={banksLoading ? 'Loading banks...' : 'Search for your bank...'}
                value={bankSearch}
                onChange={(e) => {
                  setBankSearch(e.target.value);
                  setShowBankList(true);
                  if (!e.target.value) setSelectedBankCode('');
                }}
                onFocus={() => setShowBankList(true)}
              />
            </div>
            {showBankList && filteredBanks.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-[var(--surface-0)] border border-[var(--border)] rounded-xl shadow-xl max-h-52 overflow-y-auto">
                {filteredBanks.slice(0, 30).map((bank) => (
                  <button
                    key={bank.code}
                    type="button"
                    className="w-full px-4 py-2.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors"
                    onMouseDown={(e) => {
                      // preventDefault stops the input from losing focus before onClick fires
                      e.preventDefault();
                      handleSelectBank(bank);
                    }}
                  >
                    {bank.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Account number */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text-secondary)]">Account number</label>
            <input
              type="text"
              inputMode="numeric"
              className="input-base"
              placeholder="10-digit account number"
              value={accountNumber}
              maxLength={10}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
            />
            <p className="text-xs text-[var(--text-muted)]">
              Paystack will verify your account name automatically
            </p>
          </div>

          <Button
            onClick={() => saveMutation.mutate()}
            loading={saveMutation.isPending}
            disabled={accountNumber.length !== 10 || !selectedBankCode}
            leftIcon={<CreditCard size={15} />}
            className="w-full"
          >
            {saveMutation.isPending ? 'Verifying account...' : 'Save & verify account'}
          </Button>
        </div>
      </Card>

      <p className="text-xs text-[var(--text-muted)] text-center">
        Your account details are verified with Paystack in real time.
        Only Nigerian bank accounts are supported.
      </p>
    </div>
  );
};
