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

};
export default api;
