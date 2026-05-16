import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const formatCurrency = (kobo: number): string => {
  const naira = kobo / 100;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(naira);
};

export const formatDate = (date: string | Date): string => {
  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
};

export const formatDateTime = (date: string | Date): string => {
  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
};

export const formatDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export const getInitials = (firstName: string, lastName: string): string =>
  `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();

export const capitalizeFirst = (str: string): string =>
  str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

export const formatDiscipline = (discipline: string): string =>
  discipline
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase());

export const getStatusColor = (status: string): string => {
  const map: Record<string, string> = {
    PENDING_PAYMENT:   'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    PAYMENT_CONFIRMED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    ASSIGNED:          'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    IN_SESSION:        'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    COMPLETED:         'bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-400',
    CANCELLED:         'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    TIMED_OUT:         'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    PENDING:           'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    SUCCESSFUL:        'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    FAILED:            'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    ONLINE:            'bg-green-100 text-green-800',
    OFFLINE:           'bg-gray-100 text-gray-700',
    BUSY:              'bg-yellow-100 text-yellow-800',
    VERIFIED:          'bg-brand-100 text-brand-700',
    PENDING_VERIFICATION: 'bg-yellow-100 text-yellow-800',
    REJECTED:          'bg-red-100 text-red-800',
    SUSPENDED:         'bg-orange-100 text-orange-800',
  };
  return map[status] ?? 'bg-gray-100 text-gray-700';
};
