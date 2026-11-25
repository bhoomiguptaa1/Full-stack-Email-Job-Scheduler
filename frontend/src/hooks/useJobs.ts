import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dashboardApi, getApiErrorMessage, jobsApi, sendersApi } from '../services/api';
import { useToast } from '../context/ToastContext';

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: dashboardApi.getStats,
    refetchInterval: 4000,
  });
}

export function useJobsList(params: {
  status?: string;
  senderId?: string;
  page: number;
  limit: number;
  searchQuery?: string;
}) {
  const trimmed = params.searchQuery?.trim() || '';
  return useQuery({
    queryKey: ['jobs', params.status, params.senderId, params.page, params.limit, trimmed],
    queryFn: async () => {
      if (trimmed) {
        return jobsApi.search({
          q: trimmed,
          status: params.status,
          page: params.page,
          limit: params.limit,
        });
      }
      const res = await jobsApi.list({
        status: params.status,
        senderId: params.senderId,
        page: params.page,
        limit: params.limit,
      });
      return { ...res, searchEngine: undefined };
    },
    refetchInterval: trimmed ? false : 4000,
  });
}

export function useJobDetail(jobId: string | null) {
  return useQuery({
    queryKey: ['job-detail', jobId],
    queryFn: () => jobsApi.getById(jobId!),
    enabled: Boolean(jobId),
    refetchInterval: 4000,
  });
}

export function useSenders() {
  return useQuery({
    queryKey: ['senders'],
    queryFn: sendersApi.list,
    refetchInterval: 5000,
  });
}

export function useJobMutations() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['jobs'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    void queryClient.invalidateQueries({ queryKey: ['job-detail'] });
    void queryClient.invalidateQueries({ queryKey: ['senders'] });
  };

  const scheduleMutation = useMutation({
    mutationFn: jobsApi.schedule,
    onSuccess: (data) => {
      invalidateAll();
      showToast({
        variant: 'success',
        title: data.deduplicated ? 'Existing job returned' : 'Email scheduled',
        description: data.message,
      });
    },
    onError: (err) => {
      showToast({
        variant: 'error',
        title: 'Scheduling failed',
        description: getApiErrorMessage(err),
      });
    },
  });

  const rescheduleMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: { scheduledFor?: string; delaySeconds?: number };
    }) => jobsApi.reschedule(id, payload),
    onSuccess: () => {
      invalidateAll();
      showToast({ variant: 'success', title: 'Job rescheduled' });
    },
    onError: (err) => {
      showToast({
        variant: 'error',
        title: 'Reschedule failed',
        description: getApiErrorMessage(err),
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => jobsApi.cancel(id),
    onSuccess: () => {
      invalidateAll();
      showToast({ variant: 'info', title: 'Job cancelled' });
    },
    onError: (err) => {
      showToast({
        variant: 'error',
        title: 'Cancellation failed',
        description: getApiErrorMessage(err),
      });
    },
  });

  return {
    scheduleMutation,
    rescheduleMutation,
    cancelMutation,
  };
}
