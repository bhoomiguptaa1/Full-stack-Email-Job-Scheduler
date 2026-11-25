import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';

function toDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  const date = typeof value === 'string' ? parseISO(value) : value;
  return isValid(date) ? date : null;
}

export function formatDateTime(value?: string | Date | null): string {
  const date = toDate(value);
  if (!date) return '—';
  return format(date, 'MMM d, yyyy · HH:mm');
}

export function formatShortTime(value?: string | Date | null): string {
  const date = toDate(value);
  if (!date) return '—';
  return format(date, 'MMM d, HH:mm:ss');
}

export function formatRelativeTime(value?: string | Date | null): string {
  const date = toDate(value);
  if (!date) return '—';
  return formatDistanceToNow(date, { addSuffix: true });
}

export function formatRecurrenceLabel(recurrence?: string, intervalMs?: number | null): string {
  switch (recurrence) {
    case 'EVERY_HOUR':
      return 'Hourly';
    case 'DAILY':
      return 'Daily';
    case 'WEEKLY':
      return 'Weekly';
    case 'MONTHLY':
      return 'Monthly';
    case 'CUSTOM_REPEAT': {
      if (!intervalMs) return 'Custom';
      const sec = Math.round(intervalMs / 1000);
      if (sec < 60) return `Every ${sec}s`;
      const min = Math.round(sec / 60);
      return `Every ${min}m`;
    }
    default:
      return 'One-time';
  }
}
