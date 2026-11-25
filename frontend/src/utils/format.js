import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';

function toDate(value) {
  if (!value) return null;
  const date = typeof value === 'string' ? parseISO(value) : value;
  return isValid(date) ? date : null;
}

export function formatDateTime(value) {
  const date = toDate(value);
  if (!date) return '—';
  return format(date, 'MMM d, yyyy · HH:mm');
}

export function formatShortTime(value) {
  const date = toDate(value);
  if (!date) return '—';
  return format(date, 'MMM d, HH:mm:ss');
}

export function formatRelativeTime(value) {
  const date = toDate(value);
  if (!date) return '—';
  return formatDistanceToNow(date, { addSuffix: true });
}

export function formatRecurrenceLabel(recurrence, intervalMs) {
  switch (recurrence) {
    case 'EVERY_HOUR': return 'Hourly';
    case 'DAILY':      return 'Daily';
    case 'WEEKLY':     return 'Weekly';
    case 'MONTHLY':    return 'Monthly';
    case 'CUSTOM_REPEAT': {
      if (!intervalMs) return 'Custom';
      const sec = Math.round(intervalMs / 1000);
      if (sec < 60) return `Every ${sec}s`;
      return `Every ${Math.round(sec / 60)}m`;
    }
    default: return 'One-time';
  }
}
