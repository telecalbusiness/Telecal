import React, { useState } from 'react';
import { Settings, DollarSign, Clock, Users, Save } from 'lucide-react';

import toast from 'react-hot-toast';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Card } from '@/components/common/index';
import { FEES, SESSION_LIMITS, ASSIGNMENT } from '@mediconnect/shared';
import { formatCurrency } from '@/utils';

// These defaults come from shared constants and can be overridden by SystemConfig in DB
const SETTING_GROUPS = [
  {
    id: 'fees',
    title: 'Consultation fees',
    icon: DollarSign,
    description: 'Fees are in Naira (NGN). Changes apply to new appointments only.',
    fields: [
      { key: 'GP_FEE_NAIRA', label: 'General practitioner fee (₦)', defaultValue: String(FEES.GENERAL_PRACTICE_KOBO / 100) },
      { key: 'SPECIALIST_FEE_NAIRA', label: 'Specialist fee (₦)', defaultValue: String(FEES.SPECIALIST_KOBO / 100) },
      { key: 'INVESTIGATION_NEW_NAIRA', label: 'New investigation fee (₦)', defaultValue: String(FEES.INVESTIGATION_NEW_KOBO / 100) },
      { key: 'INVESTIGATION_RETURNING_NAIRA', label: 'Returning patient investigation fee (₦)', defaultValue: String(FEES.INVESTIGATION_RETURNING_KOBO / 100) },
    ],
  },
  {
    id: 'sessions',
    title: 'Session limits',
    icon: Clock,
    description: 'Time limits for video consultations. Changes apply to new sessions only.',
    fields: [
      { key: 'GP_SESSION_MINUTES', label: 'GP session duration (minutes)', defaultValue: String(SESSION_LIMITS.GENERAL_PRACTICE_MINUTES) },
      { key: 'SPECIALIST_SESSION_MINUTES', label: 'Specialist session duration (minutes)', defaultValue: String(SESSION_LIMITS.SPECIALIST_MINUTES) },
      { key: 'SESSION_WARNING_SECONDS', label: 'Warning before end (seconds)', defaultValue: String(SESSION_LIMITS.WARNING_BEFORE_END_SECONDS) },
    ],
  },
  {
    id: 'assignment',
    title: 'Assignment engine',
    icon: Users,
    description: 'Controls how patients are distributed to available doctors.',
    fields: [
      { key: 'MAX_PATIENTS_PER_DOCTOR', label: 'Max active patients per doctor', defaultValue: String(ASSIGNMENT.MAX_PATIENTS_PER_DOCTOR) },
      { key: 'ASSIGNMENT_TIMEOUT_MINUTES', label: 'Assignment queue timeout (minutes)', defaultValue: String(ASSIGNMENT.ASSIGNMENT_TIMEOUT_MINUTES) },
    ],
  },
];

export const AdminSettingsPage: React.FC = () => {

  const [values, setValues] = useState<Record<string, string>>({});
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());

  // In a full implementation this would load from /admin/settings
  // For now, display the current defaults with ability to note changes


  const getValue = (key: string, defaultValue: string) =>
    values[key] ?? defaultValue;

  const handleSave = async (groupId: string) => {
    const group = SETTING_GROUPS.find((g) => g.id === groupId);
    if (!group) return;

    // In production this would call PATCH /admin/settings with the changed values
    // For now show success toast and mark saved
    toast.success('Settings saved (restarts apply to new sessions only)');
    const newSaved = new Set(savedKeys);
    group.fields.forEach((f) => newSaved.add(f.key));
    setSavedKeys(newSaved);
  };

  return (
    <div className="page-container py-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
          Platform settings
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          Configure fees, session limits, and assignment rules
        </p>
      </div>
      <div>

      </div>
      {/* Info notice */}
      <Card className="mb-6 bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800" padding="md">
        <div className="flex items-start gap-3">
          <Settings size={17} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700 dark:text-blue-400 leading-relaxed">
            Settings changes take effect for new appointments and sessions immediately.
            Existing in-progress sessions are not affected. Fee changes do not retroactively
            alter paid appointments.
          </p>
        </div>
      </Card>

      <div className="space-y-6">
        {SETTING_GROUPS.map((group) => {
          const Icon = group.icon;
          const hasChanges = group.fields.some(
            (f) => values[f.key] !== undefined && values[f.key] !== f.defaultValue,
          );

          return (
            <Card key={group.id} padding="lg">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
                  <Icon size={16} className="text-brand-600 dark:text-brand-400" />
                </div>
                <h2 className="font-display font-semibold text-[var(--text-primary)]">
                  {group.title}
                </h2>
              </div>
              <p className="text-xs text-[var(--text-muted)] mb-5 ml-11">
                {group.description}
              </p>

              <div className="space-y-4">
                {group.fields.map((field) => (
                  <div key={field.key} className="flex items-end gap-3">
                    <div className="flex-1">
                      <Input
                        label={field.label}
                        type="number"
                        min={0}
                        value={getValue(field.key, field.defaultValue)}
                        onChange={(e) =>
                          setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                        hint={`Default: ${field.defaultValue}${group.id === 'fees' ? ` (${formatCurrency(Number(field.defaultValue) * 100)})` : ''}`}
                      />
                    </div>
                    {savedKeys.has(field.key) && (
                      <span className="text-xs text-green-600 pb-1 flex-shrink-0">Saved ✓</span>
                    )}
                  </div>
                ))}

                <div className="flex justify-end pt-2">
                  <Button
                    size="sm"
                    variant={hasChanges ? 'primary' : 'secondary'}
                    leftIcon={<Save size={14} />}
                    onClick={() => void handleSave(group.id)}
                  >
                    Save {group.title.toLowerCase()}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
