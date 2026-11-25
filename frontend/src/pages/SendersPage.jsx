import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pause, Play, Trash2, Star, Send } from 'lucide-react';
import { useSenders } from '../hooks/useJobs';
import { getApiErrorMessage, sendersApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatShortTime } from '../utils/format';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';

export default function SendersPage() {
  const { data: senders = [], isLoading } = useSenders();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [hourlyLimit, setHourlyLimit] = useState('50');
  const [minDelayMs, setMinDelayMs] = useState('0');

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['senders'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
  };

  const createMutation = useMutation({
    mutationFn: sendersApi.create,
    onSuccess: () => {
      invalidate();
      showToast({ variant: 'success', title: 'Sender account added' });
      setCreateOpen(false);
      setEmail('');
      setName('');
      setHourlyLimit('50');
      setMinDelayMs('0');
    },
    onError: (err) => {
      showToast({
        variant: 'error',
        title: 'Could not add sender',
        description: getApiErrorMessage(err),
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => sendersApi.update(id, payload),
    onSuccess: () => {
      invalidate();
      showToast({ variant: 'success', title: 'Sender updated' });
    },
    onError: (err) => {
      showToast({
        variant: 'error',
        title: 'Update failed',
        description: getApiErrorMessage(err),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: sendersApi.remove,
    onSuccess: () => {
      invalidate();
      showToast({ variant: 'info', title: 'Sender removed' });
    },
    onError: (err) => {
      showToast({
        variant: 'error',
        title: 'Cannot delete sender',
        description: getApiErrorMessage(err),
      });
    },
  });

  const handleCreate = (e) => {
    e.preventDefault();
    createMutation.mutate({
      email,
      name: name || undefined,
      hourlyLimit: Math.max(1, Number(hourlyLimit) || 50),
      minDelayMs: Math.max(0, Number(minDelayMs) || 0),
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Sender Accounts &amp; Rate Limits</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Enforced atomically in Redis across all concurrent workers and restarts.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Sender
        </Button>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      ) : senders.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/90">
          <EmptyState
            icon={Send}
            title="No sender accounts"
            description="Create a sender account to configure per-sender hourly rate limits."
            action={<Button onClick={() => setCreateOpen(true)}>Add Sender</Button>}
          />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {senders.map((sender) => {
            const pct = Math.min(
              100,
              Math.round((sender.usage.sentThisHour / Math.max(1, sender.hourlyLimit)) * 100)
            );
            return (
              <div
                key={sender.id}
                className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-sm space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-900 truncate">
                        {sender.name || sender.email}
                      </h3>
                      {sender.isDefault && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                          Default
                        </span>
                      )}
                      {!sender.isActive && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          Paused
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{sender.email}</p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {!sender.isDefault && (
                      <button
                        type="button"
                        title="Set as default sender"
                        onClick={() =>
                          updateMutation.mutate({ id: sender.id, payload: { isDefault: true } })
                        }
                        className="p-1.5 rounded-md text-slate-400 hover:text-amber-600 hover:bg-slate-100"
                      >
                        <Star className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      title={sender.isActive ? 'Pause sender' : 'Resume sender'}
                      onClick={() =>
                        updateMutation.mutate({
                          id: sender.id,
                          payload: { isActive: !sender.isActive },
                        })
                      }
                      className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                    >
                      {sender.isActive ? (
                        <Pause className="h-3.5 w-3.5" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                    </button>
                    {senders.length > 1 && (
                      <button
                        type="button"
                        title="Delete sender"
                        onClick={() => deleteMutation.mutate(sender.id)}
                        className="p-1.5 rounded-md text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">Current hour quota</span>
                    <span className="font-medium text-slate-900 tabular-nums">
                      {sender.usage.sentThisHour} / {sender.hourlyLimit} sent ({sender.usage.remaining} left)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-slate-900'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 tabular-nums">
                    Window resets at {formatShortTime(sender.usage.resetAt)}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs">
                  <label className="flex items-center gap-2 text-slate-600">
                    <span>Hourly limit:</span>
                    <input
                      type="number"
                      min={1}
                      defaultValue={sender.hourlyLimit}
                      onBlur={(e) => {
                        const val = Number(e.target.value);
                        if (val >= 1 && val !== sender.hourlyLimit) {
                          updateMutation.mutate({ id: sender.id, payload: { hourlyLimit: val } });
                        }
                      }}
                      className="w-20 h-7 px-2 rounded border border-slate-200 text-xs text-slate-900 tabular-nums"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-slate-600">
                    <span>Min delay (ms):</span>
                    <input
                      type="number"
                      min={0}
                      defaultValue={sender.minDelayMs}
                      onBlur={(e) => {
                        const val = Number(e.target.value);
                        if (val >= 0 && val !== sender.minDelayMs) {
                          updateMutation.mutate({ id: sender.id, payload: { minDelayMs: val } });
                        }
                      }}
                      className="w-20 h-7 px-2 rounded border border-slate-200 text-xs text-slate-900 tabular-nums"
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add Sender Account"
        description="Configure an identity and persistent hourly dispatch limit."
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Sender Email</label>
            <input
              type="email"
              required
              placeholder="outreach@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Display Name</label>
            <input
              type="text"
              placeholder="ReachInbox Outreach"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Hourly Limit
              </label>
              <input
                type="number"
                min={1}
                required
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Min Delay (ms)
              </label>
              <input
                type="number"
                min={0}
                value={minDelayMs}
                onChange={(e) => setMinDelayMs(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm tabular-nums"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Create Sender
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
