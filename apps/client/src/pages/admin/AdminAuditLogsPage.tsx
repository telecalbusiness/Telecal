import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiGet } from '@/services/api';
import { Button } from '@/components/common/Button';
import { Card, EmptyState } from '@/components/common/index';
import { formatDateTime, cn } from '@/utils';

interface AuditLog {
  id: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  ipAddress: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
  user: { firstName: string; lastName: string; email: string } | null;
}

const ACTION_COLORS: Record<string, string> = {
  LOGIN: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  LOGOUT: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  LOGIN_FAILED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  DOCTOR_APPROVED: 'bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-400',
  DOCTOR_REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  DOCTOR_SUSPENDED: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  RECORD_VIEWED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  RECORD_MODIFIED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  PASSWORD_CHANGED: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  PATIENT_ASSIGNED: 'bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-400',
};

export const AdminAuditLogsPage: React.FC = () => {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page],
    queryFn: () =>
      apiGet<{ items: AuditLog[]; total: number; totalPages: number }>(
        `/admin/audit-logs?page=${page}&pageSize=25`,
      ),
    staleTime: 10_000,
  });

  return (
    <div className="page-container py-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
          Audit logs
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          Immutable record of all sensitive actions · 7-year retention
          {data ? ` · ${data.total} entries` : ''}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="card p-3 flex items-center gap-3">
              <div className="skeleton h-5 w-24 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <div className="skeleton h-3.5 w-48" />
                <div className="skeleton h-3 w-32" />
              </div>
              <div className="skeleton h-3 w-28" />
            </div>
          ))}
        </div>
      ) : !data?.items.length ? (
        <EmptyState icon={<Shield size={24} />} title="No audit logs found" />
      ) : (
        <div className="space-y-1.5">
          {data.items.map((log) => (
            <Card key={log.id} padding="none">
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Action badge */}
                <span className={cn(
                  'badge text-xs flex-shrink-0',
                  ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-700',
                )}>
                  {log.action.replace(/_/g, ' ')}
                </span>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text-primary)] truncate">
                    {log.user
                      ? `${log.user.firstName} ${log.user.lastName}`
                      : 'System'
                    }
                    {log.resourceType && (
                      <span className="text-[var(--text-muted)]">
                        {' '}on {log.resourceType}
                        {log.resourceId && (
                          <span className="font-mono text-xs ml-1">
                            {log.resourceId.slice(0, 8)}…
                          </span>
                        )}
                      </span>
                    )}
                  </p>
                  {log.user && (
                    <p className="text-xs text-[var(--text-muted)] truncate">{log.user.email}</p>
                  )}
                </div>

                {/* Meta */}
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-[var(--text-muted)]">
                    {formatDateTime(log.createdAt)}
                  </p>
                  {log.ipAddress && (
                    <p className="text-xs font-mono text-[var(--text-muted)]">{log.ipAddress}</p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--border)]">
          <p className="text-sm text-[var(--text-muted)]">
            Page {page} of {data.totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" leftIcon={<ChevronLeft size={14} />}
              disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="secondary" size="sm" rightIcon={<ChevronRight size={14} />}
              disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
