import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Mail, Hash, Calendar,
  Activity, Search, CreditCard,
} from 'lucide-react';
import { apiGet } from '@/services/api';
import { Card, StatusBadge, Avatar, EmptyState } from '@/components/common/index';
import { formatDateTime, formatCurrency } from '@/utils';

interface PatientDetail {
  id: string;
  fileNumber: string;
  dateOfBirth: string | null;
  gender: string | null;
  phoneNumber: string | null;
  bloodGroup: string | null;
  genotype: string | null;
  allergies: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    isEmailVerified: boolean;
    isActive: boolean;
    lastLoginAt: string | null;
    createdAt: string;
    avatarUrl: string | null;
  };
  stats: {
    totalAppointments: number;
    completedAppointments: number;
    monthAppointments: number;
    totalInvestigations: number;
    totalPrescriptions: number;
    totalSpentNGN: string;
    completionRate: number;
  };
  recentAppointments: Array<{
    id: string;
    status: string;
    consultationType: string;
    createdAt: string;
    doctor: {
      discipline: string;
      user: { firstName: string; lastName: string };
    } | null;
    payment: { status: string; amountKobo: number } | null;
  }>;
}

const StatBox: React.FC<{ label: string; value: string | number; icon?: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="stat-card">
    <div className="flex items-center justify-between mb-1">
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      {icon && <span className="text-[var(--text-muted)]">{icon}</span>}
    </div>
    <p className="font-display text-2xl font-semibold text-[var(--text-primary)]">{value}</p>
  </div>
);

export const AdminPatientDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: patient, isLoading } = useQuery({
    queryKey: ['admin-patient', id],
    queryFn: () => apiGet<PatientDetail>(`/admin/patients/${id!}`),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="page-container py-6 space-y-4">
        <div className="skeleton h-4 w-24 rounded" />
        <div className="skeleton h-32 rounded-2xl" />
        <div className="skeleton h-48 rounded-2xl" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="page-container py-12">
        <EmptyState icon={<Search size={24} />} title="Patient not found" />
      </div>
    );
  }

  return (
    <div className="page-container py-6 animate-fade-in">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mb-5"
      >
        <ArrowLeft size={15} /> Back to patients
      </button>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Avatar
          firstName={patient.user.firstName}
          lastName={patient.user.lastName}
          avatarUrl={patient.user.avatarUrl}
          size="xl"
        />
        <div>
          <h1 className="font-display text-xl font-semibold text-[var(--text-primary)]">
            {patient.user.firstName} {patient.user.lastName}
          </h1>
          <p className="text-sm font-mono text-brand-600 dark:text-brand-400">
            {patient.fileNumber}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {patient.user.isActive ? 'Active' : 'Inactive'} ·{' '}
            Joined {formatDateTime(patient.user.createdAt)}
          </p>
        </div>
      </div>

      <div className="space-y-4">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBox label="Total appointments" value={patient.stats.totalAppointments} icon={<Calendar size={14} />} />
          <StatBox label="Completed" value={patient.stats.completedAppointments} icon={<Activity size={14} />} />
          <StatBox label="Investigations" value={patient.stats.totalInvestigations} icon={<Search size={14} />} />
          <StatBox label="Total spent" value={`₦${patient.stats.totalSpentNGN}`} icon={<CreditCard size={14} />} />
        </div>

        {/* Personal info */}
        <Card padding="md">
          <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">
            Personal details
          </p>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Mail size={14} className="text-[var(--text-muted)]" />
              <div>
                <dt className="text-xs text-[var(--text-muted)]">Email</dt>
                <dd className="text-[var(--text-primary)]">{patient.user.email}</dd>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Hash size={14} className="text-[var(--text-muted)]" />
              <div>
                <dt className="text-xs text-[var(--text-muted)]">File number</dt>
                <dd className="text-[var(--text-primary)] font-mono">{patient.fileNumber}</dd>
              </div>
            </div>
            {patient.gender && (
              <div>
                <dt className="text-xs text-[var(--text-muted)]">Gender</dt>
                <dd className="text-[var(--text-primary)] capitalize">{patient.gender}</dd>
              </div>
            )}
            {patient.dateOfBirth && (
              <div>
                <dt className="text-xs text-[var(--text-muted)]">Date of birth</dt>
                <dd className="text-[var(--text-primary)]">{formatDateTime(patient.dateOfBirth)}</dd>
              </div>
            )}
            {patient.phoneNumber && (
              <div>
                <dt className="text-xs text-[var(--text-muted)]">Phone</dt>
                <dd className="text-[var(--text-primary)]">{patient.phoneNumber}</dd>
              </div>
            )}
            {patient.bloodGroup && (
              <div>
                <dt className="text-xs text-[var(--text-muted)]">Blood group</dt>
                <dd className="text-[var(--text-primary)]">{patient.bloodGroup}</dd>
              </div>
            )}
            {patient.genotype && (
              <div>
                <dt className="text-xs text-[var(--text-muted)]">Genotype</dt>
                <dd className="text-[var(--text-primary)]">{patient.genotype}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-[var(--text-muted)]">Last login</dt>
              <dd className="text-[var(--text-primary)]">
                {patient.user.lastLoginAt ? formatDateTime(patient.user.lastLoginAt) : 'Never'}
              </dd>
            </div>
          </dl>
          {patient.allergies && (
            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <p className="text-xs text-[var(--text-muted)] mb-1">Known allergies</p>
              <p className="text-sm text-[var(--text-secondary)]">{patient.allergies}</p>
            </div>
          )}
          {patient.emergencyContactName && (
            <div className="mt-3">
              <p className="text-xs text-[var(--text-muted)] mb-1">Emergency contact</p>
              <p className="text-sm text-[var(--text-secondary)]">
                {patient.emergencyContactName}
                {patient.emergencyContactPhone && ` · ${patient.emergencyContactPhone}`}
              </p>
            </div>
          )}
        </Card>

        {/* Recent appointments */}
        <Card padding="md">
          <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">
            Recent appointments
          </p>
          {patient.recentAppointments.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No appointments yet</p>
          ) : (
            <div className="space-y-2">
              {patient.recentAppointments.map((apt) => (
                <div key={apt.id} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface-2)]">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {apt.doctor
                        ? `Dr. ${apt.doctor.user.firstName} ${apt.doctor.user.lastName}`
                        : 'No doctor assigned'}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {apt.consultationType.replace(/_/g, ' ')} ·{' '}
                      {formatDateTime(apt.createdAt)}
                      {apt.payment?.status === 'SUCCESSFUL' && (
                        <span className="text-green-600">
                          {' · '}{formatCurrency(apt.payment.amountKobo)}
                        </span>
                      )}
                    </p>
                  </div>
                  <StatusBadge status={apt.status} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};