import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, Circle } from 'lucide-react';
import { apiGet, apiPatch } from '@/services/api';
import { Button } from '@/components/common/Button';
import { EmptyState, Skeleton } from '@/components/common/index';
import { formatDateTime, cn } from '@/utils';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  metadata: Record<string, string> | null;
}

interface PaginatedNotifications {
  items: Notification[];
  total: number;
}

const typeIcon: Record<string, string> = {
  APPOINTMENT_ASSIGNED:    '👨‍⚕️',
  SESSION_STARTING:        '📹',
  SESSION_ENDED:           '✅',
  PAYMENT_CONFIRMED:       '💳',
  PAYMENT_FAILED:          '❌',
  INVESTIGATION_ASSIGNED:  '🔬',
  INVESTIGATION_REVIEWED:  '📋',
  PRESCRIPTION_READY:      '💊',
  DOCTOR_APPROVED:         '✅',
  DOCTOR_REJECTED:         '⚠️',
  EMERGENCY_TRIAGE:        '🚨',
  APPOINTMENT_REMINDER:    '⏰',
};

export const NotificationsPage: React.FC = () => {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiGet<PaginatedNotifications>('/notifications'),
    staleTime: 10_000,
  });

  const markAllMutation = useMutation({
    mutationFn: () => apiPatch('/notifications/mark-all-read'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markOneMutation = useMutation({
    mutationFn: (id: string) => apiPatch(`/notifications/${id}/read`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const unreadCount = data?.items.filter((n) => !n.isRead).length ?? 0;

  return (
    <div className="page-container py-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
            Notifications
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<CheckCheck size={14} />}
            loading={markAllMutation.isPending}
            onClick={() => markAllMutation.mutate()}
          >
            Mark all read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card p-4 flex gap-3">
              <Skeleton className="w-9 h-9 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-64" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : !data?.items.length ? (
        <EmptyState
          icon={<Bell size={24} />}
          title="No notifications yet"
          description="You'll be notified here about appointments, assignments, and updates."
        />
      ) : (
        <div className="space-y-2">
          {data.items.map((notification) => (
            <button
              key={notification.id}
              onClick={() => !notification.isRead && markOneMutation.mutate(notification.id)}
              className={cn(
                'w-full text-left card p-4 flex items-start gap-3 transition-all',
                !notification.isRead && 'border-brand-200 dark:border-brand-800 bg-brand-50/50 dark:bg-brand-900/10',
                markOneMutation.isPending && 'opacity-70',
              )}
            >
              {/* Icon */}
              <div className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base',
                !notification.isRead
                  ? 'bg-brand-100 dark:bg-brand-900/30'
                  : 'bg-[var(--surface-2)]',
              )}>
                {typeIcon[notification.type] ?? '🔔'}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={cn(
                    'text-sm leading-snug',
                    !notification.isRead
                      ? 'font-medium text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)]',
                  )}>
                    {notification.title}
                  </p>
                  {!notification.isRead && (
                    <Circle size={8} className="text-brand-500 fill-brand-500 flex-shrink-0 mt-1" />
                  )}
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">
                  {notification.message}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1.5">
                  {formatDateTime(notification.createdAt)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
