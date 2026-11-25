import axios, { AxiosError } from 'axios';
import {
  DashboardStats,
  EmailJob,
  HealthResponse,
  OAuthUrlsResponse,
  PaginationMeta,
  RecurrenceType,
  SenderAccount,
  SlackChannel,
  User,
} from '../types';

export const TOKEN_STORAGE_KEY = 'reachinbox_auth_token';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string }>) => {
    if (error.response?.status === 401 && localStorage.getItem(TOKEN_STORAGE_KEY)) {
      const requestUrl = error.config?.url || '';
      if (!requestUrl.includes('/auth/login') && !requestUrl.includes('/auth/register')) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        window.dispatchEvent(new Event('reachinbox:unauthorized'));
      }
    }
    return Promise.reject(error);
  }
);

export function getApiErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string; details?: Array<{ message?: string }> } | undefined;
    if (data?.details?.length && data.details[0]?.message) {
      return data.details[0].message;
    }
    if (data?.error) return data.error;
    if (err.message) return err.message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

export const authApi = {
  async login(payload: { email: string; password: string }) {
    const { data } = await apiClient.post<{ token: string; user: User }>('/auth/login', payload);
    return data;
  },
  async register(payload: { email: string; password: string; name?: string }) {
    const { data } = await apiClient.post<{ token: string; user: User }>('/auth/register', payload);
    return data;
  },
  async demoLogin(payload?: { email?: string; name?: string }) {
    const { data } = await apiClient.post<{ token: string; user: User }>(
      '/auth/demo-login',
      payload || {}
    );
    return data;
  },
  async getMe() {
    const { data } = await apiClient.get<{ user: User }>('/auth/me');
    return data.user;
  },
  async getOAuthUrls() {
    const { data } = await apiClient.get<OAuthUrlsResponse>('/auth/urls');
    return data;
  },
  async getSlackChannels() {
    const { data } = await apiClient.get<{ data: SlackChannel[] }>('/auth/slack/channels');
    return data.data;
  },
  async updateSlackSettings(payload: {
    slackChannelId?: string | null;
    slackNotificationsEnabled?: boolean;
  }) {
    const { data } = await apiClient.patch<{ user: User }>('/auth/slack/settings', payload);
    return data.user;
  },
};

export const dashboardApi = {
  async getStats() {
    const { data } = await apiClient.get<{ data: DashboardStats }>('/dashboard/stats');
    return data.data;
  },
};

export const jobsApi = {
  async list(params: { status?: string; senderId?: string; page?: number; limit?: number }) {
    const { data } = await apiClient.get<{
      data: EmailJob[];
      pagination: PaginationMeta;
    }>('/jobs', { params });
    return data;
  },
  async search(params: { q: string; status?: string; page?: number; limit?: number }) {
    const { data } = await apiClient.get<{
      searchEngine: 'elasticsearch' | 'postgres-fallback';
      data: EmailJob[];
      pagination: PaginationMeta;
    }>('/jobs/search', { params });
    return data;
  },
  async getById(id: string) {
    const { data } = await apiClient.get<{ data: EmailJob }>(`/jobs/${id}`);
    return data.data;
  },
  async schedule(payload: {
    recipientEmail?: string;
    recipients?: string[];
    subject: string;
    body: string;
    scheduledFor?: string;
    delaySeconds?: number;
    staggerDelayMs?: number;
    recurrence?: RecurrenceType;
    repeatIntervalMs?: number;
    senderId?: string;
    idempotencyKey?: string;
  }) {
    const { data } = await apiClient.post<{
      deduplicated: boolean;
      message: string;
      job: EmailJob;
      jobs: EmailJob[];
    }>('/jobs/schedule', payload);
    return data;
  },
  async reschedule(id: string, payload: { scheduledFor?: string; delaySeconds?: number }) {
    const { data } = await apiClient.patch<{ data: EmailJob; message: string }>(
      `/jobs/${id}/reschedule`,
      payload
    );
    return data;
  },
  async cancel(id: string) {
    const { data } = await apiClient.delete<{ data: EmailJob; message: string }>(`/jobs/${id}`);
    return data;
  },
};

export const sendersApi = {
  async list() {
    const { data } = await apiClient.get<{ data: SenderAccount[] }>('/senders');
    return data.data;
  },
  async create(payload: {
    email: string;
    name?: string;
    hourlyLimit?: number;
    minDelayMs?: number;
    isDefault?: boolean;
  }) {
    const { data } = await apiClient.post<{ data: SenderAccount }>('/senders', payload);
    return data.data;
  },
  async update(
    id: string,
    payload: {
      name?: string;
      hourlyLimit?: number;
      minDelayMs?: number;
      isActive?: boolean;
      isDefault?: boolean;
    }
  ) {
    const { data } = await apiClient.patch<{ data: SenderAccount }>(`/senders/${id}`, payload);
    return data.data;
  },
  async remove(id: string) {
    await apiClient.delete(`/senders/${id}`);
  },
};

export const healthApi = {
  async check() {
    const { data } = await apiClient.get<HealthResponse>('/health');
    return data;
  },
};
