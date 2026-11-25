import { JobStatus } from '../../types';
import { cn } from '../../utils/cn';

const STATUS_STYLE: Record<JobStatus, { pill: string; dot: string; label: string }> = {
  SCHEDULED: {
    pill: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    dot: 'bg-indigo-500',
    label: 'Scheduled',
  },
  PENDING: {
    pill: 'bg-amber-50 text-amber-700 border-amber-200/80',
    dot: 'bg-amber-500',
    label: 'Pending',
  },
  PROCESSING: {
    pill: 'bg-sky-50 text-sky-700 border-sky-200/80',
    dot: 'bg-sky-500 animate-pulse',
    label: 'Processing',
  },
  COMPLETED: {
    pill: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    dot: 'bg-emerald-500',
    label: 'Sent',
  },
  FAILED: {
    pill: 'bg-rose-50 text-rose-700 border-rose-200/80',
    dot: 'bg-rose-500',
    label: 'Failed',
  },
  CANCELLED: {
    pill: 'bg-slate-100 text-slate-600 border-slate-200',
    dot: 'bg-slate-400',
    label: 'Cancelled',
  },
};

export function StatusBadge({ status }: { status: JobStatus }) {
  const style = STATUS_STYLE[status] || STATUS_STYLE.SCHEDULED;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-medium',
        style.pill
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} />
      {style.label}
    </span>
  );
}
