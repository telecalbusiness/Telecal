import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Pill, Send } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Button } from '@/components/common/Button';
import { Input, Textarea } from '@/components/common/Input';
import { Card } from '@/components/common/index';
import { apiPost } from '@/services/api';
import { cn } from '@/utils';

const medicationSchema = z.object({
  name: z.string().min(1, 'Drug name required'),
  dosage: z.string().min(1, 'Dosage required'),
  frequency: z.string().min(1, 'Frequency required'),
  duration: z.string().min(1, 'Duration required'),
  instructions: z.string().optional(),
});

const schema = z.object({
  medications: z.array(medicationSchema).min(1, 'Add at least one medication'),
  notes: z.string().max(1000).optional(),
  isSensitive: z.boolean().default(false),
});

type FormData = z.infer<typeof schema>;

interface Props {
  appointmentId: string;
  onSuccess?: () => void;
}

export const PrescriptionForm: React.FC<Props> = ({ appointmentId, onSuccess }) => {
  const queryClient = useQueryClient();
  const [issuing, setIssuing] = useState(false);

  const { register, handleSubmit, control, watch, formState: { errors, isSubmitting } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: {
        medications: [{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }],
        isSensitive: false,
      },
    });

  const { fields, append, remove } = useFieldArray({ control, name: 'medications' });

  const createMutation = useMutation({
    mutationFn: async (data: FormData & { issue: boolean }) => {
      const result = await apiPost<{ id: string }>('/prescriptions', {
        appointmentId,
        medications: data.medications,
        notes: data.notes,
        isSensitive: data.isSensitive,
      });
      if (data.issue) {
        await apiPost(`/prescriptions/${result.data.id}/issue`);
      }
      return result;
    },
    onSuccess: () => {
      toast.success(issuing ? 'Prescription issued to patient' : 'Prescription saved as draft');
      void queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] });
      onSuccess?.();
    },
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate({ ...data, issue: issuing });
  };

  return (
    <Card padding="md">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
          <Pill size={16} className="text-green-600 dark:text-green-400" />
        </div>
        <h3 className="font-display font-semibold text-[var(--text-primary)]">
          Create prescription
        </h3>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Medications */}
        <div className="space-y-3">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="relative border border-[var(--border)] rounded-xl p-4 space-y-3 bg-[var(--surface-1)]"
            >
              {/* Medication number */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                  Medication {index + 1}
                </span>
                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="text-red-500 hover:text-red-600 transition-colors p-1"
                    aria-label="Remove medication"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Drug name"
                  placeholder="e.g. Amoxicillin"
                  error={(errors.medications?.[index]?.name)?.message}
                  required
                  {...register(`medications.${index}.name`)}
                />
                <Input
                  label="Dosage"
                  placeholder="e.g. 500mg"
                  error={(errors.medications?.[index]?.dosage)?.message}
                  required
                  {...register(`medications.${index}.dosage`)}
                />
                <Input
                  label="Frequency"
                  placeholder="e.g. Twice daily"
                  error={(errors.medications?.[index]?.frequency)?.message}
                  required
                  {...register(`medications.${index}.frequency`)}
                />
                <Input
                  label="Duration"
                  placeholder="e.g. 7 days"
                  error={(errors.medications?.[index]?.duration)?.message}
                  required
                  {...register(`medications.${index}.duration`)}
                />
              </div>
              <Input
                label="Special instructions (optional)"
                placeholder="e.g. Take after meals, avoid alcohol"
                {...register(`medications.${index}.instructions`)}
              />
            </div>
          ))}

          {/* Add medication */}
          <button
            type="button"
            onClick={() => append({ name: '', dosage: '', frequency: '', duration: '', instructions: '' })}
            className="w-full py-2.5 border-2 border-dashed border-[var(--border)] rounded-xl text-sm text-[var(--text-muted)] hover:border-brand-400 hover:text-brand-600 transition-all flex items-center justify-center gap-2"
          >
            <Plus size={14} /> Add another medication
          </button>

          {errors.medications?.root && (
            <p className="text-xs text-red-500">⚠ {errors.medications.root.message}</p>
          )}
        </div>

        {/* Sensitive flag */}
        <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
          <div className="flex-1">
            <p className="text-sm font-medium text-[var(--text-primary)]">
              Sensitive prescription
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">
              Sensitive prescriptions are <strong>never visible to the patient</strong> — admin only.
              Non-sensitive prescriptions are visible to the patient for <strong>24 hours</strong> after issuance,
              then automatically hidden to prevent misuse.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const current = watch('isSensitive');
              setValue('isSensitive', !current);
            }}
            className={cn(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 mt-0.5',
              watch('isSensitive')
                ? 'bg-red-500'
                : 'bg-[var(--surface-3)]',
            )}
            role="switch"
            aria-checked={watch('isSensitive')}
          >
            <span className={cn(
              'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
              watch('isSensitive') ? 'translate-x-6' : 'translate-x-1',
            )} />
          </button>
        </div>

        {watch('isSensitive') && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 animate-fade-in">
            <span className="text-red-500 text-sm">⚠</span>
            <p className="text-xs text-red-700 dark:text-red-400">
              This prescription is marked sensitive. The patient will <strong>never</strong> see this in their prescriptions tab.
            </p>
          </div>
        )}

        {/* Doctor notes */}
        <Textarea
          label="Notes for patient (optional)"
          placeholder="General advice, warnings, or follow-up instructions..."
          rows={3}
          {...register('notes')}
        />

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <Button
            type="submit"
            variant="secondary"
            loading={isSubmitting && !issuing}
            disabled={isSubmitting}
            onClick={() => setIssuing(false)}
            className="flex-1"
          >
            Save as draft
          </Button>
          <Button
            type="submit"
            loading={isSubmitting && issuing}
            disabled={isSubmitting}
            leftIcon={<Send size={14} />}
            onClick={() => setIssuing(true)}
            className="flex-1"
          >
            Issue to patient
          </Button>
        </div>
      </form>
    </Card>
  );
};
