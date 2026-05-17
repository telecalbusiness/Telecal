import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiGet } from '@/services/api';
import { useAuth } from '@/hooks/useAppDispatch';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Card, Avatar, EmptyState } from '@/components/common/index';
import { formatDateTime } from '@/utils';
import { Link } from 'react-router-dom';
import { UserRole } from '@mediconnect/shared';

interface Patient {
  id: string;
  fileNumber: string;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    createdAt: string;
    isActive: boolean;
  };
}

interface DoctorPatientAppointment {
  id: string;
  patient: {
    fileNumber: string;
    user: { firstName: string; lastName: string };
  };
}

export const AdminPatientsPage: React.FC = () => {
  const { user } = useAuth();
  const isDoctor = user?.role === UserRole.DOCTOR;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const { data: adminData, isLoading: adminLoading } = useQuery({
    queryKey: ['admin-patients', page, search],
    queryFn: () =>
      apiGet<{ items: Patient[]; total: number; totalPages: number }>(
        `/admin/patients?page=${page}&pageSize=20${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      ),
    enabled: !isDoctor,
    staleTime: 20_000,
  });

  const { data: doctorData, isLoading: doctorLoading } = useQuery({
    queryKey: ['doctor-patients'],
    queryFn: () => apiGet<DoctorPatientAppointment[]>('/doctors/me/patients'),
    enabled: isDoctor,
    staleTime: 20_000,
  });

  const isLoading = isDoctor ? doctorLoading : adminLoading;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  // ── Doctor view ───────────────────────────────────────────────
  if (isDoctor) {
    return (
      <div className="page-container py-6 animate-fade-in">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
            My patients
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Patients currently assigned to you
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card p-4 flex items-center gap-4">
                <div className="skeleton w-9 h-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-40" />
                  <div className="skeleton h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : !doctorData?.length ? (
          <EmptyState
            icon={<Users size={24} />}
            title="No patients assigned"
            description="Patients will appear here when they are assigned to you."
          />
        ) : (
          <div className="space-y-2">
            {doctorData.map((appt) => (
              <div key={appt.id} className="card p-4 flex items-center gap-3">
                <Avatar
                  firstName={appt.patient.user.firstName}
                  lastName={appt.patient.user.lastName}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {appt.patient.user.firstName} {appt.patient.user.lastName}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    File{' '}
                    <span className="font-mono text-brand-600 dark:text-brand-400">
                      #{appt.patient.fileNumber}
                    </span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Admin view ────────────────────────────────────────────────
  return (
    <div className="page-container py-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
            Patients
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {adminData ? `${adminData.total} registered` : '—'}
          </p>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            placeholder="Search by name, email, or file number..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            leftIcon={<Search size={15} />}
            className="w-64"
          />
          <Button type="submit" variant="secondary">Search</Button>
        </form>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card p-4 flex items-center gap-4">
              <div className="skeleton w-9 h-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-48" />
                <div className="skeleton h-3 w-64" />
              </div>
              <div className="skeleton h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      ) : !adminData?.items.length ? (
        <EmptyState
          icon={<Users size={24} />}
          title="No patients found"
          description={search ? 'Try a different search term.' : 'No patients registered yet.'}
        />
      ) : (
        <div className="space-y-2">
          {adminData.items.map((patient) => (
            <Link key={patient.id} to={`/dashboard/patients/${patient.id}`} className="block">
              <Card padding="md">
                <div className="flex items-center gap-4">
                  <Avatar
                    firstName={patient.user.firstName}
                    lastName={patient.user.lastName}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm text-[var(--text-primary)]">
                        {patient.user.firstName} {patient.user.lastName}
                      </p>
                      {!patient.user.isActive && (
                        <span className="badge bg-red-100 text-red-700 text-xs">Inactive</span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">
                      {patient.user.email} · File:{' '}
                      <span className="font-mono text-brand-600 dark:text-brand-400">
                        {patient.fileNumber}
                      </span>
                      {' · '}Registered {formatDateTime(patient.user.createdAt)}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {adminData && adminData.totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--border)]">
          <p className="text-sm text-[var(--text-muted)]">
            Page {page} of {adminData.totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" leftIcon={<ChevronLeft size={14} />}
              disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="secondary" size="sm" rightIcon={<ChevronRight size={14} />}
              disabled={page >= adminData.totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
