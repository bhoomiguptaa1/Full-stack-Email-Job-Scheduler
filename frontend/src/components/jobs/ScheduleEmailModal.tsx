import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Clock, Send } from 'lucide-react';
import { RecurrenceType } from '../../types';
import { useJobMutations, useSenders } from '../../hooks/useJobs';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface ScheduleEmailModalProps {
  open: boolean;
  onClose: () => void;
}

interface FormValues {
  recipientsText: string;
  subject: string;
  body: string;
  senderId: string;
  delayPreset: 'now' | '1m' | '15m' | '1h' | 'custom';
  scheduledForLocal: string;
  staggerSeconds: string;
  recurrence: RecurrenceType;
  customRepeatSeconds: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DELAY_PRESETS: Array<{ value: FormValues['delayPreset']; label: string; seconds?: number }> = [
  { value: 'now', label: 'Send now', seconds: 0 },
  { value: '1m', label: '+1 min', seconds: 60 },
  { value: '15m', label: '+15 min', seconds: 900 },
  { value: '1h', label: '+1 hour', seconds: 3600 },
  { value: 'custom', label: 'Custom date' },
];

export function ScheduleEmailModal({ open, onClose }: ScheduleEmailModalProps) {
  const { data: senders = [] } = useSenders();
  const { scheduleMutation } = useJobMutations();
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const defaultSenderId = useMemo(
    () => senders.find((s) => s.isDefault)?.id || senders[0]?.id || '',
    [senders]
  );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      recipientsText: '',
      subject: '',
      body: '',
      senderId: '',
      delayPreset: 'now',
      scheduledForLocal: '',
      staggerSeconds: '0',
      recurrence: 'NONE',
      customRepeatSeconds: '60',
    },
  });

  useEffect(() => {
    if (open) {
      setIdempotencyKey(crypto.randomUUID());
    }
  }, [open]);

  useEffect(() => {
    if (defaultSenderId && !watch('senderId')) {
      setValue('senderId', defaultSenderId);
    }
  }, [defaultSenderId, setValue, watch]);

  const delayPreset = watch('delayPreset');
  const recurrence = watch('recurrence');
  const recipientsText = watch('recipientsText');

  const parsedRecipients = useMemo(
    () =>
      recipientsText
        .split(/[\s,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    [recipientsText]
  );

  const onSubmit = async (values: FormValues) => {
    const uniqueRecipients = Array.from(new Set(parsedRecipients));
    if (uniqueRecipients.length === 0) {
      setError('recipientsText', { message: 'Enter at least one recipient email address' });
      return;
    }

    const invalid = uniqueRecipients.find((email) => !EMAIL_REGEX.test(email));
    if (invalid) {
      setError('recipientsText', { message: `Invalid email address: ${invalid}` });
      return;
    }

    let scheduledFor: string | undefined;
    let delaySeconds: number | undefined;

    if (values.delayPreset === 'custom') {
      if (!values.scheduledForLocal) {
        setError('scheduledForLocal', { message: 'Select a date and time' });
        return;
      }
      scheduledFor = new Date(values.scheduledForLocal).toISOString();
    } else {
      const preset = DELAY_PRESETS.find((p) => p.value === values.delayPreset);
      delaySeconds = preset?.seconds ?? 0;
    }

    let repeatIntervalMs: number | undefined;
    if (values.recurrence === 'CUSTOM_REPEAT') {
      const sec = Number(values.customRepeatSeconds);
      if (!Number.isFinite(sec) || sec < 1) {
        setError('customRepeatSeconds', { message: 'Must be at least 1 second' });
        return;
      }
      repeatIntervalMs = Math.round(sec * 1000);
    }

    const staggerSec = Math.max(0, Number(values.staggerSeconds) || 0);

    await scheduleMutation.mutateAsync({
      ...(uniqueRecipients.length === 1
        ? { recipientEmail: uniqueRecipients[0] }
        : { recipients: uniqueRecipients }),
      subject: values.subject,
      body: values.body,
      senderId: values.senderId || undefined,
      scheduledFor,
      delaySeconds,
      staggerDelayMs: uniqueRecipients.length > 1 ? Math.round(staggerSec * 1000) : undefined,
      recurrence: values.recurrence,
      repeatIntervalMs,
      idempotencyKey,
    });

    reset();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Schedule Email Job"
      description="Dispatch one-time, staggered batch, or recurring emails via BullMQ."
      maxWidthClass="max-w-2xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Sender Account
          </label>
          <select
            {...register('senderId')}
            className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          >
            {senders.map((sender) => (
              <option key={sender.id} value={sender.id}>
                {sender.name ? `${sender.name} <${sender.email}>` : sender.email} —{' '}
                {sender.usage.remaining}/{sender.hourlyLimit} remaining this hour
                {!sender.isActive ? ' (Paused)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-700">
              Recipient(s)
            </label>
            {parsedRecipients.length > 0 && (
              <span className="text-[11px] text-slate-500 tabular-nums">
                {parsedRecipients.length} recipient{parsedRecipients.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <textarea
            rows={2}
            placeholder="alice@example.com (separate multiple recipients with commas or new lines)"
            {...register('recipientsText')}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
          {errors.recipientsText && (
            <p className="text-xs text-rose-600 mt-1">{errors.recipientsText.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Subject</label>
          <input
            type="text"
            placeholder="Your weekly product update"
            {...register('subject', { required: 'Subject is required' })}
            className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
          {errors.subject && (
            <p className="text-xs text-rose-600 mt-1">{errors.subject.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Message Body (HTML or plain text)
          </label>
          <textarea
            rows={5}
            placeholder="<p>Hi there,</p><p>Here is your scheduled update.</p>"
            {...register('body', { required: 'Message body is required' })}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
          {errors.body && (
            <p className="text-xs text-rose-600 mt-1">{errors.body.message}</p>
          )}
        </div>

        <div className="pt-1 border-t border-slate-100 space-y-3">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 mb-1.5">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              Delivery Timing
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DELAY_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setValue('delayPreset', preset.value)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                    delayPreset === preset.value
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {delayPreset === 'custom' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Scheduled Date &amp; Time
                </label>
                <input
                  type="datetime-local"
                  {...register('scheduledForLocal')}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                {errors.scheduledForLocal && (
                  <p className="text-xs text-rose-600 mt-1">
                    {errors.scheduledForLocal.message}
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Recurrence</label>
              <select
                {...register('recurrence')}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                <option value="NONE">One-time delivery</option>
                <option value="EVERY_HOUR">Every hour</option>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="CUSTOM_REPEAT">Custom interval</option>
              </select>
            </div>

            {recurrence === 'CUSTOM_REPEAT' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Repeat Every (seconds)
                </label>
                <input
                  type="number"
                  min={1}
                  {...register('customRepeatSeconds')}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 tabular-nums"
                />
                {errors.customRepeatSeconds && (
                  <p className="text-xs text-rose-600 mt-1">
                    {errors.customRepeatSeconds.message}
                  </p>
                )}
              </div>
            )}

            {parsedRecipients.length > 1 && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Stagger Between Recipients (seconds)
                </label>
                <input
                  type="number"
                  min={0}
                  {...register('staggerSeconds')}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 tabular-nums"
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={scheduleMutation.isPending}>
            <Send className="h-3.5 w-3.5" />
            {parsedRecipients.length > 1
              ? `Schedule ${parsedRecipients.length} Emails`
              : 'Schedule Email'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
