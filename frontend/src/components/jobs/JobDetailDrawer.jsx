import { ExternalLink, RefreshCw, Ban, Clock, AlertCircle } from 'lucide-react';
import { useJobDetail, useJobMutations } from '../../hooks/useJobs';
import { formatDateTime, formatRecurrenceLabel, formatShortTime } from '../../utils/format';
import { Drawer } from '../ui/Drawer';
import { StatusBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';

export function JobDetailDrawer({ jobId, onClose, onRequestReschedule }) {
  const { data: job, isLoading } = useJobDetail(jobId);
  const { cancelMutation } = useJobMutations();

  const canModify =
    job && job.status !== 'COMPLETED' && job.status !== 'PROCESSING';
  const canCancel =
    job && job.status !== 'COMPLETED' && job.status !== 'CANCELLED';

  return (
    <Drawer
      open={Boolean(jobId)}
      onClose={onClose}
      title={job?.subject || 'Job Details'}
      subtitle={job ? `Job ID: ${job.id}` : undefined}
    >
      {isLoading || !job ? (
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <StatusBadge status={job.status} />
            <div className="flex items-center gap-2">
              {job.previewUrl && (
                <a
                  href={job.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Ethereal Preview
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {canModify && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onRequestReschedule(job)}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reschedule
                </Button>
              )}
              {canCancel && (
                <Button
                  size="sm"
                  variant="danger"
                  loading={cancelMutation.isPending}
                  onClick={() => cancelMutation.mutate(job.id)}
                >
                  <Ban className="h-3.5 w-3.5" />
                  Cancel
                </Button>
              )}
            </div>
          </div>

          {job.failureReason && (
            <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-3 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-rose-600 mt-0.5 shrink-0" />
              <div className="text-xs text-rose-800">
                <p className="font-medium">Delivery Failure</p>
                <p className="mt-0.5 break-words">{job.failureReason}</p>
              </div>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4 text-xs">
            <div>
              <dt className="text-slate-500">Recipient</dt>
              <dd className="font-medium text-slate-900 mt-0.5 break-all">{job.recipientEmail}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Sender</dt>
              <dd className="font-medium text-slate-900 mt-0.5 break-all">
                {job.senderEmail || job.sender?.email || 'Default'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Scheduled For</dt>
              <dd className="font-medium text-slate-900 mt-0.5 tabular-nums">
                {formatDateTime(job.scheduledFor)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Sent At</dt>
              <dd className="font-medium text-slate-900 mt-0.5 tabular-nums">
                {formatDateTime(job.sentAt)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Recurrence</dt>
              <dd className="font-medium text-slate-900 mt-0.5">
                {formatRecurrenceLabel(job.recurrence, job.repeatIntervalMs)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Retries / Rate-Limited</dt>
              <dd className="font-medium text-slate-900 mt-0.5 tabular-nums">
                {job.retryCount ?? 0} / {job.rateLimitedCount ?? 0}
              </dd>
            </div>
          </dl>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Message Content
            </h3>
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-xs font-mono text-slate-700 whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
              {job.body}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Execution Timeline
            </h3>
            {!job.logs || job.logs.length === 0 ? (
              <p className="text-xs text-slate-500">No execution logs recorded yet.</p>
            ) : (
              <ol className="relative border-l border-slate-200 ml-2 space-y-4">
                {job.logs.map((log) => (
                  <li key={log.id} className="ml-4">
                    <span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full border-2 border-white bg-slate-400" />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-900">{log.event}</span>
                      <span className="text-[11px] text-slate-400 tabular-nums flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatShortTime(log.timestamp)}
                      </span>
                    </div>
                    {log.message && (
                      <p className="text-xs text-slate-600 mt-0.5 break-words">{log.message}</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
