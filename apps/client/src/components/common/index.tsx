import React from 'react';
import { cn, getInitials, getStatusColor, capitalizeFirst } from '@/utils';
import { X } from 'lucide-react';

// ─── Card ─────────────────────────────────────────────────────

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glass?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingMap = { none: '', sm: 'p-4', md: 'p-5', lg: 'p-6' };

export const Card: React.FC<CardProps> = ({ glass, padding = 'md', children, className, ...props }) => (
  <div className={cn(glass ? 'card-glass' : 'card', paddingMap[padding], className)} {...props}>
    {children}
  </div>
);

// ─── Badge ────────────────────────────────────────────────────

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'brand';
  className?: string;
}

const badgeVariants = {
  default: 'bg-[var(--surface-3)] text-[var(--text-secondary)]',
  success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  danger:  'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  info:    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  brand:   'bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-400',
};

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', className }) => (
  <span className={cn('badge', badgeVariants[variant], className)}>
    {children}
  </span>
);

// ─── Status badge (reads from status string) ──────────────────

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span className={cn('badge', getStatusColor(status))}>
    {capitalizeFirst(status.replace(/_/g, ' '))}
  </span>
);

// ─── Avatar ───────────────────────────────────────────────────

interface AvatarProps {
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const avatarSizes = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-11 h-11 text-base',
  xl: 'w-14 h-14 text-lg',
};

export const Avatar: React.FC<AvatarProps> = ({
  firstName, lastName, avatarUrl, size = 'md', className,
}) => {
  const initials = getInitials(firstName, lastName);
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={`${firstName} ${lastName}`}
        className={cn('rounded-full object-cover flex-shrink-0', avatarSizes[size], className)}
      />
    );
  }
  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center flex-shrink-0 font-display font-semibold',
        'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300',
        avatarSizes[size],
        className,
      )}
    >
      {initials}
    </div>
  );
};

// ─── Skeleton ─────────────────────────────────────────────────

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('skeleton', className)} />
);

export const SkeletonCard: React.FC = () => (
  <div className="card p-5 space-y-3">
    <div className="flex items-center gap-3">
      <Skeleton className="w-9 h-9 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
    <Skeleton className="h-3 w-full" />
    <Skeleton className="h-3 w-3/4" />
  </div>
);

// ─── Modal ────────────────────────────────────────────────────

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  footer?: React.ReactNode;
}

const modalSizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen, onClose, title, children, size = 'md', footer,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" />

      {/* Dialog */}
      <div
        className={cn(
          'relative w-full card shadow-2xl animate-scale-in z-10',
          modalSizes[size],
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="btn btn-ghost p-1.5 rounded-lg"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-[var(--border)] flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Empty state ──────────────────────────────────────────────

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
    {icon && (
      <div className="w-14 h-14 rounded-2xl bg-[var(--surface-3)] flex items-center justify-center mb-4 text-[var(--text-muted)]">
        {icon}
      </div>
    )}
    <h3 className="font-display font-semibold text-[var(--text-primary)] mb-1">{title}</h3>
    {description && <p className="text-sm text-[var(--text-muted)] max-w-sm">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

// ─── Stat card ────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: { value: string; positive: boolean };
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, icon, trend, className }) => (
  <div className={cn('stat-card', className)}>
    <div className="flex items-center justify-between mb-3">
      <span className="text-sm text-[var(--text-muted)]">{label}</span>
      {icon && (
        <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center text-brand-600 dark:text-brand-400">
          {icon}
        </div>
      )}
    </div>
    <div className="font-display text-2xl font-semibold text-[var(--text-primary)]">{value}</div>
    {trend && (
      <div className={cn('text-xs mt-1', trend.positive ? 'text-green-600' : 'text-red-500')}>
        {trend.positive ? '↑' : '↓'} {trend.value}
      </div>
    )}
  </div>
);
