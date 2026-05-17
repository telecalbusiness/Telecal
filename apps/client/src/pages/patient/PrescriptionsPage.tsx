import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Pill } from 'lucide-react';
import { apiGet } from '@/services/api';
import { useAuth } from '@/hooks/useAppDispatch';
import { Card, StatusBadge, EmptyState, Skeleton } from '@/components/common/index';
import { formatDateTime } from '@/utils';
import { UserRole } from '@mediconnect/shared';

interface Prescription {
  id: string;
  status: string;
  issuedAt: string | null;
  createdAt: string;
  medications: Array<{ name: string; dosage: string; frequency: string; duration: string }>;
  notes: string | null;
  appointment: { consultationType: string };
  doctor: { user: { firstName: string; lastName: string } };
}

export const PrescriptionsPage: React.FC = () => {
  const { user } = useAuth();
  const isDoctor = user?.role === UserRole.DOCTOR;

  const { data, isLoading } = useQuery({
    queryKey: ['prescriptions', isDoctor],
    queryFn: () =>
      apiGet<Prescription[]>(isDoctor ? '/prescriptions/issued' : '/prescriptions/mine'),
    staleTime: 30_000,
  });

  return (
    <div className="page-container py-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
          Prescriptions
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          {isDoctor ? 'Prescriptions you have issued' : 'Prescriptions from your consultations'}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-4 flex gap-4 items-center">
              <Skeleton className="w-9 h-9 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      ) : !data?.length ? (
        <EmptyState
          icon={<FileText size={24} />}
          title="No prescriptions yet"
          description={
            isDoctor
              ? 'Prescriptions you create after consultations will appear here.'
              : 'Prescriptions from your doctor will appear here after consultations.'
          }
        />
      ) : (
        <div className="space-y-3">
          {data.map((rx) => (
            <PrescriptionCard key={rx.id} prescription={rx} />
          ))}
        </div>
      )}
    </div>
  );
};

const PrescriptionCard: React.FC<{ prescription: Prescription }> = ({ prescription }) => (
  <Card padding="md" className="hover:shadow-card-md transition-all">
    <div className="flex items-start gap-4">
      <div className="w-9 h-9 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
        <Pill size={16} className="text-green-600 dark:text-green-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="font-medium text-sm text-[var(--text-primary)]">
            Dr. {prescription.doctor.user.firstName} {prescription.doctor.user.lastName}
          </p>
          <StatusBadge status={prescription.status} />
        </div>
        <p className="text-xs text-[var(--text-muted)] mb-2">
          {prescription.issuedAt
            ? `Issued ${formatDateTime(prescription.issuedAt)}`
            : `Created ${formatDateTime(prescription.createdAt)}`}
          {' · '}
          {prescription.medications.length} medication{prescription.medications.length !== 1 ? 's' : ''}
        </p>
        {/* Medications preview */}
        <div className="flex flex-wrap gap-1.5">
          {prescription.medications.slice(0, 3).map((med, i) => (
            <span
              key={i}
              className="text-xs px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--text-secondary)]"
            >
              {med.name} {med.dosage}
            </span>
          ))}
          {prescription.medications.length > 3 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--text-muted)]">
              +{prescription.medications.length - 3} more
            </span>
          )}
        </div>
      </div>
    </div>
  </Card>
);
