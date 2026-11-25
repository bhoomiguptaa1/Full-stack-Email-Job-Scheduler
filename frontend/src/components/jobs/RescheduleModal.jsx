import { useState } from 'react';
import { useJobMutations } from '../../hooks/useJobs';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

export function RescheduleModal({ job, onClose }) {
  const [mode, setMode] = useState('delay');
  const [delaySeconds, setDelaySeconds] = useState('60');
  const [scheduledForLocal, setScheduledForLocal] = useState('');
  const { rescheduleMutation } = useJobMutations();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!job) return;

    await rescheduleMutation.mutateAsync({
      id: job.id,
      payload:
        mode === 'datetime' && scheduledForLocal
          ? { scheduledFor: new Date(scheduledForLocal).toISOString() }
          : { delaySeconds: Math.max(0, Number(delaySeconds) || 0) },
    });
    onClose();
  };

  return (
    <Modal
      open={Boolean(job)}
      onClose={onClose}
      title="Reschedule Email Job"
      description={job ? `Recipient: ${job.recipientEmail}` : undefined}
      maxWidthClass="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('delay')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium border ${
              mode === 'delay'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Relative Delay
          </button>
          <button
            type="button"
            onClick={() => setMode('datetime')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium border ${
              mode === 'datetime'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Specific Date &amp; Time
          </button>
        </div>

        {mode === 'delay' ? (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Delay From Now (seconds)
            </label>
            <input
              type="number"
              min={0}
              required
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm tabular-nums"
            />
            <div className="flex gap-1.5 mt-2">
              {[
                { label: 'Now', val: '0' },
                { label: '30s', val: '30' },
                { label: '5m', val: '300' },
                { label: '1h', val: '3600' },
              ].map((p) => (
                <button
                  key={p.val}
                  type="button"
                  onClick={() => setDelaySeconds(p.val)}
                  className="px-2 py-1 rounded text-xs bg-slate-100 hover:bg-slate-200 text-slate-700"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              New Scheduled Time
            </label>
            <input
              type="datetime-local"
              required
              value={scheduledForLocal}
              onChange={(e) => setScheduledForLocal(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm"
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={rescheduleMutation.isPending}>
            Save Schedule
          </Button>
        </div>
      </form>
    </Modal>
  );
}
