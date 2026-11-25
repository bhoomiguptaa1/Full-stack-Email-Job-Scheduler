import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  ExternalLink,
  RefreshCw,
  Ban,
  Mail,
  ChevronLeft,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { useJobMutations, useJobsList } from '../hooks/useJobs';
import { formatDateTime, formatRecurrenceLabel } from '../utils/format';
import { StatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';

const STATUS_TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'SCHEDULED', label: 'Scheduled' },
  { key: 'PROCESSING', label: 'Processing' },
  { key: 'COMPLETED', label: 'Sent' },
  { key: 'FAILED', label: 'Failed' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

export default function JobsPage({ onOpenCompose, onSelectJob, onRequestReschedule }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatus = searchParams.get('status') || 'ALL';
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading } = useJobsList({
    status: statusFilter,
    page,
    limit: 12,
    searchQuery: debouncedSearch,
  });

  const { cancelMutation } = useJobMutations();

  const handleStatusChange = (nextStatus) => {
    setStatusFilter(nextStatus);
    setPage(1);
    if (nextStatus === 'ALL') {
      searchParams.delete('status');
    } else {
      searchParams.set('status', nextStatus);
    }
    setSearchParams(searchParams, { replace: true });
  };

  const jobs = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-white border border-slate-200/90 rounded-lg p-1 overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleStatusChange(tab.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                statusFilter === tab.key
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-72">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search subject, recipient, body..."
              className="w-full h-9 pl-8 pr-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Jobs Table Card */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <Skeleton key={idx} className="h-12 w-full" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={Mail}
            title={debouncedSearch ? 'No matching email jobs' : 'No email jobs found'}
            description={
              debouncedSearch
                ? 'Try adjusting your search keywords or clearing status filters.'
                : 'Schedule your first email job to start dispatching through BullMQ.'
            }
            action={
              !debouncedSearch && (
                <Button size="sm" onClick={onOpenCompose}>
                  Schedule Email
                </Button>
              )
            }
          />
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Subject &amp; Recipient</th>
                    <th className="py-3 px-4">Sender</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Schedule</th>
                    <th className="py-3 px-4">Recurrence</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {jobs.map((job) => {
                    const id = job.id || job.jobId || '';
                    const canReschedule =
                      job.status !== 'COMPLETED' && job.status !== 'PROCESSING';
                    const canCancel =
                      job.status !== 'COMPLETED' && job.status !== 'CANCELLED';

                    return (
                      <tr key={id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 max-w-xs">
                          <button
                            type="button"
                            onClick={() => onSelectJob(id)}
                            className="text-left group"
                          >
                            <p className="font-medium text-slate-900 group-hover:text-indigo-600 truncate">
                              {job.subject}
                            </p>
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                              {job.recipientEmail}
                            </p>
                          </button>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 max-w-[180px] truncate">
                          {job.senderEmail || job.sender?.email || 'Default'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <StatusBadge status={job.status} />
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap tabular-nums">
                          {formatDateTime(job.sentAt || job.scheduledFor)}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                          {formatRecurrenceLabel(job.recurrence, job.repeatIntervalMs)}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onSelectJob(id)}
                              title="View details & logs"
                              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            {job.previewUrl && (
                              <a
                                href={job.previewUrl}
                                target="_blank"
                                rel="noreferrer"
                                title="Open Ethereal preview"
                                className="p-1.5 rounded-md text-indigo-600 hover:bg-indigo-50"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                            {canReschedule && (
                              <button
                                type="button"
                                onClick={() => onRequestReschedule({ ...job, id })}
                                title="Reschedule job"
                                className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {canCancel && (
                              <button
                                type="button"
                                onClick={() => cancelMutation.mutate(id)}
                                title="Cancel job"
                                className="p-1.5 rounded-md text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden divide-y divide-slate-100">
              {jobs.map((job) => {
                const id = job.id || job.jobId || '';
                const canReschedule =
                  job.status !== 'COMPLETED' && job.status !== 'PROCESSING';
                const canCancel =
                  job.status !== 'COMPLETED' && job.status !== 'CANCELLED';

                return (
                  <div key={id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectJob(id)}
                        className="text-left min-w-0"
                      >
                        <p className="text-sm font-medium text-slate-900 truncate">{job.subject}</p>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          To: {job.recipientEmail}
                        </p>
                      </button>
                      <StatusBadge status={job.status} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="tabular-nums">
                        {formatDateTime(job.sentAt || job.scheduledFor)}
                      </span>
                      <span>{formatRecurrenceLabel(job.recurrence, job.repeatIntervalMs)}</span>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <Button size="sm" variant="secondary" onClick={() => onSelectJob(id)}>
                        Logs
                      </Button>
                      {canReschedule && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onRequestReschedule({ ...job, id })}
                        >
                          Reschedule
                        </Button>
                      )}
                      {canCancel && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => cancelMutation.mutate(id)}
                          className="text-rose-600 hover:text-rose-700"
                        >
                          Cancel
                        </Button>
                      )}
                      {job.previewUrl && (
                        <a
                          href={job.previewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-auto text-xs font-medium text-indigo-600 inline-flex items-center gap-1"
                        >
                          Preview
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span className="tabular-nums">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} jobs)
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
