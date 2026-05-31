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
  getCluster:   (id)    => api.get(`/api/clusters/${id}`).then(res => res.data),
  createCluster: (body)  => api.post('/api/clusters', body).then(res => res.data),
  updateCluster: (id, body) => api.patch(`/api/clusters/${id}`, body).then(res => res.data),
  deleteCluster: (id)       => api.delete(`/api/clusters/${id}`),
  regenerateKey: (id)       => api.post(`/api/clusters/${id}/regenerate-key`).then(res => res.data),

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
  login:         (email, password) => adminApi.post('/api/admin/login', { email, password }).then((res) => res.data.data),
  getClusters:   ()     => adminApi.get('/api/admin/clusters').then((res) => res.data.data),
  createCluster: (body) => adminApi.post('/api/admin/clusters', body).then((res) => res.data.data),
  deleteCluster: (id)   => adminApi.delete(`/api/admin/clusters/${id}`),
};

export default api;
