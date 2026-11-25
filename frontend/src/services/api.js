import axios from 'axios';

export const TOKEN_STORAGE_KEY = 'reachinbox_token';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const apiClient = axios.create({ baseURL: BASE_URL, withCredentials: true });

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      window.dispatchEvent(new Event('reachinbox:unauthorized'));
    }
    return Promise.reject(err);
  }
);

export function getApiErrorMessage(err) {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error || err.response?.data?.message || err.message;
  }
  return err instanceof Error ? err.message : 'Unknown error';
}

export const authApi = {
  async register(payload) {
    const { data } = await apiClient.post('/auth/register', payload);
    return data;
  },
  async login(payload) {
    const { data } = await apiClient.post('/auth/login', payload);
    return data;
  },
  async demoLogin() {
    const { data } = await apiClient.post('/auth/demo-login', {});
    return data;
  },
  async getMe() {
    const { data } = await apiClient.get('/auth/me');
    return data.user;
  },
};

export const jobsApi = {
  async list({ status, senderId, page, limit } = {}) {
    const params = new URLSearchParams();
    if (status)   params.set('status', status);
    if (senderId) params.set('senderId', senderId);
    if (page)     params.set('page', String(page));
    if (limit)    params.set('limit', String(limit));
    const { data } = await apiClient.get(`/jobs?${params}`);
    return data;
  },
  async search({ q, status, page, limit } = {}) {
    const params = new URLSearchParams({ q });
    if (status) params.set('status', status);
    if (page)   params.set('page', String(page));
    if (limit)  params.set('limit', String(limit));
    const { data } = await apiClient.get(`/jobs/search?${params}`);
    return data;
  },
  async getById(id) {
    const { data } = await apiClient.get(`/jobs/${id}`);
    return data.data;
  },
  async schedule(payload) {
    const { data } = await apiClient.post('/jobs/schedule', payload);
    return data;
  },
  async reschedule(id, payload) {
    const { data } = await apiClient.patch(`/jobs/${id}/reschedule`, payload);
    return data;
  },
  async cancel(id) {
    const { data } = await apiClient.delete(`/jobs/${id}`);
    return data;
  },
};

export const sendersApi = {
  async list() {
    const { data } = await apiClient.get('/senders');
    return data.data;
  },
  async create(payload) {
    const { data } = await apiClient.post('/senders', payload);
    return data.data;
  },
  async update(id, payload) {
    const { data } = await apiClient.patch(`/senders/${id}`, payload);
    return data.data;
  },
  async remove(id) {
    await apiClient.delete(`/senders/${id}`);
  },
};

export const dashboardApi = {
  async getStats() {
    const { data } = await apiClient.get('/dashboard/stats');
    return data.data;
  },
};

export const healthApi = {
  async check() {
    const { data } = await apiClient.get('/health');
    return data;
  },
};
