import React, { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Eye, EyeOff, Mail, Lock, User, Hash,
  Briefcase, CheckCircle2, Upload, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/common/Button';
import { Input, Textarea } from '@/components/common/Input';
import { Card } from '@/components/common/index';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { fetchCurrentUser } from '@/store/slices/authSlice';
import { apiPost } from '@/services/api';
import { DisciplineCategory } from '@mediconnect/shared';
import { formatDiscipline, cn } from '@/utils';

// ─── Document types required ──────────────────────────────────

const REQUIRED_DOCS = [
  { id: 'mdcn_license', label: 'MDCN License (current year)', required: true },
  { id: 'mdcn_cert', label: 'MDCN Registration Certificate', required: true },
  { id: 'mbbs', label: 'MBBS Certificate', required: true },
  { id: 'cv', label: 'Curriculum Vitae (CV)', required: true },
  { id: 'id', label: 'Valid Government-Issued ID', required: true },
  { id: 'specialist_cert', label: 'Specialist Certifications', required: false },
] as const;

type DocId = typeof REQUIRED_DOCS[number]['id'];

interface UploadedDoc {
  docId: DocId;
  file: File;
}

// ─── Discipline picker ────────────────────────────────────────

const disciplineOptions = Object.values(DisciplineCategory).map((v) => ({
  value: v,
  label: formatDiscipline(v),
}));

const DisciplinePicker: React.FC<{
  value: string;
  onChange: (value: string) => void;
  error?: string;
}> = ({ value, onChange, error }) => {
  const [open, setOpen] = useState(false);
  const selected = disciplineOptions.find((o) => o.value === value);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-[var(--text-secondary)]">
        Discipline / Specialty <span className="text-red-500">*</span>
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'input-base w-full text-left flex items-center justify-between',
            error && 'error',
            !selected && 'text-[var(--text-muted)]',
          )}
        >
          <span>{selected ? selected.label : 'Select your discipline'}</span>
          <svg
            className={cn(
              'w-4 h-4 text-[var(--text-muted)] transition-transform flex-shrink-0',
              open && 'rotate-180',
            )}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute z-50 w-full mt-1.5 bg-[var(--surface-0)] border border-[var(--border-strong)] rounded-xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="max-h-60 overflow-y-auto py-1">
              {disciplineOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={cn(
                    'w-full text-left px-4 py-2.5 text-sm transition-colors',
                    opt.value === value
                      ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-medium'
                      : 'text-[var(--text-primary)] hover:bg-[var(--surface-2)]',
                  )}
                >
                  {opt.value === value && <span className="mr-2 text-brand-600">✓</span>}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-500">⚠ {error}</p>}
    </div>
  );
};

// ─── Schema ───────────────────────────────────────────────────

const schema = z.object({
  firstName: z.string().min(1, 'Required').max(50),
  lastName: z.string().min(1, 'Required').max(50),
  email: z.string().email('Enter a valid email'),
  password: z.string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Z]/, 'Must include uppercase')
    .regex(/[a-z]/, 'Must include lowercase')
    .regex(/[0-9]/, 'Must include a number')
    .regex(/[^A-Za-z0-9]/, 'Must include a symbol'),
  confirmPassword: z.string(),
  mdcnNumber: z
    .string()
    .min(1, 'MDCN registration number is required')
    .regex(/^MDCN\/R\/\d{6}$/, 'Format must be MDCN/R/XXXXXX (e.g. MDCN/R/123456)'),
  discipline: z.nativeEnum(DisciplineCategory, { message: 'Select a discipline' }),
  specialization: z.string().max(100).optional(),
  yearsOfExperience: z.coerce.number().int().min(0).max(60),
  bio: z.string().max(1000).optional(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type FormData = z.infer<typeof schema>;

const STEPS = ['Account', 'Credentials', 'Documents', 'Profile'] as const;

// ─── Page ─────────────────────────────────────────────────────

export const DoctorRegisterPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [dragOver, setDragOver] = useState<DocId | null>(null);

  const {
    register,
    trigger,
    getValues,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: {
      firstName: '', lastName: '', email: '',
      password: '', confirmPassword: '',
      mdcnNumber: '', yearsOfExperience: 0,
      specialization: '', bio: '',
    },
  });

  const disciplineValue = watch('discipline');

  const stepFields: (keyof FormData)[][] = [
    ['firstName', 'lastName', 'email', 'password', 'confirmPassword'],
    ['mdcnNumber', 'discipline', 'yearsOfExperience'],
    [], // Documents step — no schema fields, handled separately
    ['specialization', 'bio'],
  ];

  const handleNext = async () => {
    // For the documents step, check that at least required docs are uploaded
    if (step === 2) {
      const requiredIds: DocId[] = REQUIRED_DOCS.filter((d) => d.required).map((d) => d.id);
      const uploadedIds = uploadedDocs.map((d) => d.docId);
      const missing = requiredIds.filter((id) => !uploadedIds.includes(id));
      if (missing.length > 0) {
        const missingLabels = REQUIRED_DOCS
          .filter((d) => missing.includes(d.id))
          .map((d) => d.label)
          .join(', ');
        toast.error(`Please upload: ${missingLabels}`);
        return;
      }
      setStep((s) => s + 1);
      return;
    }
    const valid = await trigger(stepFields[step]);
    if (valid) setStep((s) => s + 1);
  };

  const handleFileForDoc = useCallback((docId: DocId, file: File) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(file.type)) {
      toast.error(`${file.name}: only PDF, JPEG, PNG allowed`);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(`${file.name}: max 10MB`);
      return;
    }
    setUploadedDocs((prev) => {
      const filtered = prev.filter((d) => d.docId !== docId);
      return [...filtered, { docId, file }];
    });
  }, []);

  const removeDoc = (docId: DocId) => {
    setUploadedDocs((prev) => prev.filter((d) => d.docId !== docId));
  };

  const handleSubmit = async () => {
    const valid = await trigger();
    if (!valid) return;

    const data = getValues();
    setIsSubmitting(true);
    try {
      // 1. Register the doctor account
      await apiPost('/auth/register/doctor', {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        licenseNumber: data.mdcnNumber,
        discipline: data.discipline,
        specialization: data.specialization || undefined,
        yearsOfExperience: data.yearsOfExperience,
        bio: data.bio || undefined,
      });

      // 2. Fetch current user to get auth session
      await dispatch(fetchCurrentUser()).unwrap();

      // 3. Upload documents if any
      if (uploadedDocs.length > 0) {
        const formData = new FormData();
        uploadedDocs.forEach((d) => formData.append('credentials', d.file));
        await fetch('/api/v1/doctors/me/credentials', {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });
      }

      setDone(true);
    } catch {
      // Handled by API interceptor toast
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Success screen ────────────────────────────────────────────
  if (done) {
    return (
      <div className="space-y-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center mx-auto">
          <CheckCircle2 size={32} className="text-brand-600" />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
            Registration submitted
          </h1>
          <p className="text-[var(--text-muted)] text-sm leading-relaxed max-w-sm mx-auto">
            Your credentials and documents are under review by our admin team.
            You'll be notified by email once verified — typically within 24–48 hours.
          </p>
        </div>
        <Button onClick={() => navigate('/dashboard')} className="w-full" size="lg">
          Go to dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
          Register as a doctor
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          Step {step + 1} of {STEPS.length} — {STEPS[step]}
        </p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <React.Fragment key={label}>
            <div className="flex items-center gap-1.5">
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all',
                i < step
                  ? 'bg-brand-600 text-white'
                  : i === step
                  ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300 ring-2 ring-brand-500'
                  : 'bg-[var(--surface-3)] text-[var(--text-muted)]',
              )}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className={cn(
                'text-xs hidden sm:block',
                i === step ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-muted)]',
              )}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn(
                'flex-1 h-px transition-colors',
                i < step ? 'bg-brand-500' : 'bg-[var(--border)]',
              )} />
            )}
          </React.Fragment>
        ))}
      </div>

      <Card padding="lg">
        <div className="space-y-4">

          {/* Step 0 — Account */}
          {step === 0 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Input label="First name" placeholder="Emeka" leftIcon={<User size={15} />}
                  error={errors.firstName?.message} required {...register('firstName')} />
                <Input label="Last name" placeholder="Eze"
                  error={errors.lastName?.message} required {...register('lastName')} />
              </div>
              <Input label="Email address" type="email" placeholder="doctor@hospital.com"
                leftIcon={<Mail size={16} />} error={errors.email?.message} required
                {...register('email')} />
              <Input
                label="Password" type={showPassword ? 'text' : 'password'}
                placeholder="Create a strong password" leftIcon={<Lock size={16} />}
                rightElement={
                  <button type="button" onClick={() => setShowPassword((s) => !s)} tabIndex={-1}
                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
                error={errors.password?.message} required {...register('password')}
              />
              <Input label="Confirm password" type={showPassword ? 'text' : 'password'}
                placeholder="Repeat your password" leftIcon={<Lock size={16} />}
                error={errors.confirmPassword?.message} required {...register('confirmPassword')} />
            </>
          )}

          {/* Step 1 — Credentials */}
          {step === 1 && (
            <>
              <Input
                label="MDCN Registration Number"
                placeholder="MDCN/R/123456"
                leftIcon={<Hash size={16} />}
                error={errors.mdcnNumber?.message}
                hint="Format: MDCN/R/XXXXXX — as shown on your MDCN certificate"
                required
                {...register('mdcnNumber')}
              />
              <DisciplinePicker
                value={disciplineValue ?? ''}
                onChange={(val) => setValue('discipline', val as DisciplineCategory, {
                  shouldValidate: true, shouldDirty: true,
                })}
                error={errors.discipline?.message}
              />
              <Input label="Years of experience" type="number" min={0} max={60}
                placeholder="5" leftIcon={<Briefcase size={16} />}
                error={errors.yearsOfExperience?.message} required
                {...register('yearsOfExperience')} />
            </>
          )}

          {/* Step 2 — Supporting Documents */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 p-3 text-sm text-blue-700 dark:text-blue-400">
                <p className="font-medium mb-0.5">Document requirements</p>
                <p className="text-xs opacity-80">
                  Items marked <span className="text-red-500 font-medium">*</span> are required.
                  Accepted formats: PDF, JPEG, PNG. Max 10MB per file.
                </p>
              </div>

              {REQUIRED_DOCS.map((doc) => {
                const uploaded = uploadedDocs.find((d) => d.docId === doc.id);
                return (
                  <div key={doc.id}>
                    <p className="text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                      {doc.label}
                      {doc.required && <span className="text-red-500 ml-1">*</span>}
                    </p>

                    {uploaded ? (
                      // Uploaded state
                      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800">
                        <div className="w-7 h-7 rounded-lg bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 size={14} className="text-brand-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-brand-700 dark:text-brand-300 truncate">
                            {uploaded.file.name}
                          </p>
                          <p className="text-xs text-brand-600/70">
                            {(uploaded.file.size / 1024).toFixed(0)} KB
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeDoc(doc.id)}
                          className="text-brand-500 hover:text-red-500 transition-colors flex-shrink-0"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      // Upload zone
                      <label
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 border-dashed cursor-pointer transition-all',
                          dragOver === doc.id
                            ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/20'
                            : 'border-[var(--border)] hover:border-brand-300 hover:bg-[var(--surface-2)]',
                        )}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(doc.id); }}
                        onDragLeave={() => setDragOver(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragOver(null);
                          const file = e.dataTransfer.files[0];
                          if (file) handleFileForDoc(doc.id, file);
                        }}
                      >
                        <input
                          type="file"
                          className="sr-only"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileForDoc(doc.id, file);
                          }}
                        />
                        <div className="w-7 h-7 rounded-lg bg-[var(--surface-3)] flex items-center justify-center flex-shrink-0">
                          <Upload size={13} className="text-[var(--text-muted)]" />
                        </div>
                        <span className="text-xs text-[var(--text-muted)]">
                          Click or drag to upload
                        </span>
                      </label>
                    )}
                  </div>
                );
              })}

              {/* Summary */}
              <div className="pt-2 border-t border-[var(--border)]">
                <p className="text-xs text-[var(--text-muted)]">
                  {uploadedDocs.length} of {REQUIRED_DOCS.length} documents uploaded ·{' '}
                  {REQUIRED_DOCS.filter((d) => d.required && !uploadedDocs.find((u) => u.docId === d.id)).length} required remaining
                </p>
              </div>
            </div>
          )}

          {/* Step 3 — Profile */}
          {step === 3 && (
            <>
              <Input
                label="Specialization (optional)"
                placeholder="e.g. Paediatric cardiology, Sports medicine"
                hint="A more specific focus within your discipline"
                error={errors.specialization?.message}
                {...register('specialization')}
              />
              <Textarea
                label="Professional bio (optional)"
                placeholder="Brief description of your experience, approach, and areas of interest..."
                error={errors.bio?.message}
                rows={5}
                {...register('bio')}
              />
              <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--border)] p-4 text-sm text-[var(--text-secondary)] space-y-1">
                <p className="font-medium text-[var(--text-primary)]">After registration:</p>
                <p>• Our admin team will verify your credentials within 24–48 hours</p>
                <p>• You'll receive an email when approved</p>
                <p>• You can then go online and start accepting patients</p>
              </div>
            </>
          )}

          {/* Navigation */}
          <div className="flex gap-3 pt-1">
            {step > 0 && (
              <Button type="button" variant="secondary" className="flex-1"
                onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button type="button" className="flex-1" onClick={() => void handleNext()}>
                Continue
              </Button>
            ) : (
              <Button type="button" loading={isSubmitting} className="flex-1" size="lg"
                onClick={() => void handleSubmit()}>
                Submit registration
              </Button>
            )}
          </div>
        </div>
      </Card>

      <p className="text-center text-sm text-[var(--text-muted)]">
        Already registered?{' '}
        <Link to="/auth/login"
          className="text-brand-600 hover:text-brand-700 dark:text-brand-400 font-medium transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  );
};