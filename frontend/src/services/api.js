import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // required for httpOnly refresh-token cookie
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, try to refresh once, then retry or logout
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;

    if (err.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const base = import.meta.env.VITE_API_URL || '';
        const { data } = await axios.post(
          `${base}/api/auth/refresh-token`,
          {},
          { withCredentials: true },
        );
        localStorage.setItem('accessToken', data.data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(originalRequest);
      } catch (_refreshErr) {
        localStorage.removeItem('accessToken');
        window.location.href = '/signin';
        return Promise.reject(_refreshErr);
      }
    }

    return Promise.reject(err);
  },
);
export const clusterService = {
  getClusters: () => api.get('/api/clusters').then((res) => res.data.data),
  getCluster: (id) => api.get(`/api/clusters/${id}`).then((res) => res.data),
  createCluster: (body) => api.post('/api/clusters', body).then((res) => res.data),
  updateCluster: (id, body) => api.patch(`/api/clusters/${id}`, body).then((res) => res.data),
  deleteCluster: (id) => api.delete(`/api/clusters/${id}`),
  regenerateKey: (id) => api.post(`/api/clusters/${id}/regenerate-key`).then((res) => res.data),
  getMetrics: (id) => api.get(`/api/clusters/${id}/metrics`).then((res) => res.data.data),
};

// The gateway's public endpoint (NLB). There is no db.loonaris.tech DNS yet, so
// clients connect to the NLB host directly. The sk_live_ key IS the username
// (no password); the database name is always `app`; the gateway rejects TLS.
export const GATEWAY_HOST =
  import.meta.env.VITE_GATEWAY_HOST ||
  'ab571a35c49414eaab905fc43405b7fb-9f85c871b90b857f.elb.eu-west-3.amazonaws.com';

export function buildConnectionString(apiKey, host = GATEWAY_HOST) {
  return `postgresql://${apiKey}@${host}:5432/app?sslmode=disable`;
}

// Admin uses its own token (platform admin — separate from any tenant session).
// The route slug is a secret derived from VITE_ADMIN_SLUG env var; it's not
// /admin anymore.  This avoids exposing a predictable admin endpoint path.
const ADMIN_SLUG = import.meta.env.VITE_ADMIN_SLUG || 'console-dev';

const adminApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: { 'Content-Type': 'application/json' },
});
adminApi.interceptors.request.use((config) => {
  const t = localStorage.getItem('adminToken');
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

export const adminService = {
  login: (email, password) =>
    adminApi.post(`/api/${ADMIN_SLUG}/login`, { email, password }).then((res) => res.data.data),
  getClusters: () => adminApi.get(`/api/${ADMIN_SLUG}/clusters`).then((res) => res.data.data),
  createCluster: (body) =>
    adminApi.post(`/api/${ADMIN_SLUG}/clusters`, body).then((res) => res.data.data),
  deleteCluster: (id) => adminApi.delete(`/api/${ADMIN_SLUG}/clusters/${id}`),
};

// Public load-test endpoints (powering /test). No auth — a bare axios instance
// so the access-token/refresh interceptors above never touch these calls.
const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: { 'Content-Type': 'application/json' },
});

export const loadTestService = {
  getMetrics: (connectionString) =>
    publicApi.post('/api/load-test/metrics', { connectionString }).then((res) => res.data.data),
  start: (connectionString, opts = {}) =>
    publicApi
      .post('/api/load-test/start', { connectionString, ...opts })
      .then((res) => res.data.data),
  status: (runId) => publicApi.get(`/api/load-test/${runId}`).then((res) => res.data.data),
  stop: (runId) => publicApi.post(`/api/load-test/${runId}/stop`).then((res) => res.data.data),
};

export default api;
