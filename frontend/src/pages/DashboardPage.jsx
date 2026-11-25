import { Link } from 'react-router-dom';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Send,
  Activity,
  ArrowRight,
  ExternalLink,
  Mail,
} from 'lucide-react';
import { useDashboardStats } from '../hooks/useJobs';
import { formatDateTime, formatRecurrenceLabel, formatRelativeTime } from '../utils/format';
import { StatusBadge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';

export default function DashboardPage({ onOpenCompose, onSelectJob }) {
  const { data: stats, isLoading } = useDashboardStats();

  if (isLoading || !stats) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, idx) => (
            <Skeleton key={idx} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 lg:col-span-2 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  const { summary, queue, senders, upcomingJobs, recentJobs } = stats;

  const kpis = [
    {
      label: 'Total Scheduled',
      value: summary.scheduled,
      sub: `${summary.total} all-time jobs`,
      icon: Clock,
    },
    {
      label: 'Pending / Active',
      value: summary.pending,
      sub: `${queue.active} processing now`,
      icon: Activity,
    },
    {
      label: 'Sent Emails',
      value: summary.completed,
      sub:
        summary.total > 0
          ? `${Math.round((summary.completed / summary.total) * 100)}% delivery rate`
          : 'No deliveries yet',
      icon: CheckCircle2,
    },
    {
      label: 'Failed Emails',
      value: summary.failed,
      sub: `${summary.cancelled} cancelled`,
      icon: AlertTriangle,
    },
    {
      label: 'Active Senders',
      value: summary.activeSenders,
      sub: `${summary.totalSenders} configured`,
      icon: Send,
    },
  ];

  const totalBar = Math.max(1, summary.total);
  const segments = [
    { label: 'Sent', count: summary.completed, color: 'bg-emerald-500' },
    { label: 'Scheduled', count: summary.scheduled, color: 'bg-indigo-500' },
    { label: 'Pending', count: summary.pending, color: 'bg-amber-500' },
    { label: 'Failed', count: summary.failed, color: 'bg-rose-500' },
    { label: 'Cancelled', count: summary.cancelled, color: 'bg-slate-300' },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {kpis.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-sm"
            >
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-medium">{item.label}</span>
                <Icon className="h-3.5 w-3.5 text-slate-400" />
              </div>
              <p className="text-2xl font-semibold text-slate-900 mt-2 tabular-nums tracking-tight">
                {item.value}
              </p>
              <p className="text-[11px] text-slate-500 mt-1 truncate tabular-nums">{item.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Queue Health & Delivery Breakdown */}
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/90 p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">BullMQ Queue Activity</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Live Redis queue counters across all workers
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-medium ${
                  queue.connected
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    queue.connected ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                />
                {queue.connected ? (queue.isPaused ? 'Paused' : 'Connected') : 'Disconnected'}
              </span>
              <a
                href="/admin/queues"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Bull-Board
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Waiting', val: queue.waiting },
              { label: 'Active', val: queue.active },
              { label: 'Delayed', val: queue.delayed },
              { label: 'Completed', val: queue.completed },
              { label: 'Failed', val: queue.failed },
            ].map((q) => (
              <div
                key={q.label}
                className="rounded-lg bg-slate-50 border border-slate-200/70 px-3 py-2.5"
              >
                <span className="text-[11px] font-medium text-slate-500">{q.label}</span>
                <p className="text-lg font-semibold text-slate-900 mt-0.5 tabular-nums">{q.val}</p>
              </div>
            ))}
          </div>

          <div className="pt-2 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700">Job Status Distribution</span>
              <span className="text-slate-500 tabular-nums">{summary.total} total</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden flex">
              {segments.map((seg) =>
                seg.count > 0 ? (
                  <div
                    key={seg.label}
                    style={{ width: `${(seg.count / totalBar) * 100}%` }}
                    className={seg.color}
                    title={`${seg.label}: ${seg.count}`}
                  />
                ) : null
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
              {segments.map((seg) => (
                <span key={seg.label} className="inline-flex items-center gap-1.5 tabular-nums">
                  <span className={`h-2 w-2 rounded-full ${seg.color}`} />
                  {seg.label}: {seg.count}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Sender Hourly Limits */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-sm flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Sender Hourly Quotas</h2>
              <Link
                to="/senders"
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
              >
                Manage
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Persistent Redis hourly rate limits per sender
            </p>
          </div>

          <div className="space-y-3 flex-1">
            {senders.slice(0, 4).map((sender) => {
              const pct = Math.min(
                100,
                Math.round((sender.usage.sentThisHour / Math.max(1, sender.hourlyLimit)) * 100)
              );
              return (
                <div key={sender.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs gap-2">
                    <span className="font-medium text-slate-800 truncate">{sender.email}</span>
                    <span className="text-slate-500 tabular-nums shrink-0">
                      {sender.usage.sentThisHour}/{sender.hourlyLimit}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-slate-800'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Upcoming & Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Upcoming Scheduled Jobs */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Upcoming Scheduled</h2>
              <p className="text-xs text-slate-500 mt-0.5">Next jobs queued for dispatch</p>
            </div>
            <Link
              to="/jobs?status=SCHEDULED"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
            >
              View all
            </Link>
          </div>

          {upcomingJobs.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No upcoming scheduled jobs"
              description="Schedule a delayed or recurring email to see it queued here."
              action={
                <Button size="sm" onClick={onOpenCompose}>
                  Schedule Email
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {upcomingJobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => onSelectJob(job.id)}
                  className="w-full text-left px-5 py-3 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{job.subject}</p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      To {job.recipientEmail} &middot; {formatRecurrenceLabel(job.recurrence)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <StatusBadge status={job.status} />
                    <p className="text-[11px] text-slate-400 mt-1 tabular-nums">
                      {formatRelativeTime(job.scheduledFor)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Recent Email Activity */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Recent Email Activity</h2>
              <p className="text-xs text-slate-500 mt-0.5">Latest updates from workers</p>
            </div>
            <Link
              to="/jobs"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
            >
              All jobs
            </Link>
          </div>

          {recentJobs.length === 0 ? (
            <EmptyState
              icon={Mail}
              title="No email activity yet"
              description="Once you schedule an email, delivery activity will appear here."
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {recentJobs.map((job) => (
                <div
                  key={job.id}
                  className="px-5 py-3 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-3"
                >
                  <button
                    type="button"
                    onClick={() => onSelectJob(job.id)}
                    className="min-w-0 text-left flex-1"
                  >
                    <p className="text-sm font-medium text-slate-900 truncate">{job.subject}</p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {job.recipientEmail} &middot; {formatDateTime(job.sentAt || job.updatedAt)}
                    </p>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    {job.previewUrl && (
                      <a
                        href={job.previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="Open Ethereal email preview"
                        className="p-1.5 rounded-md border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <StatusBadge status={job.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
