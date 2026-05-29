const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
    body: options.body,
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message ?? 'Request failed');
  return data.data;
}

function bearer(token) {
  return { Authorization: `Bearer ${token}` };
}

export const authService = {
  signup: (body) => request('/auth/signup', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  refresh: () => request('/auth/refresh-token', { method: 'POST' }),
  getProfile: (token) => request('/auth/profile', { headers: bearer(token) }),
  updateProfile: (token, body) =>
    request('/auth/profile', { method: 'PATCH', body: JSON.stringify(body), headers: bearer(token) }),
  getClusters: (token) => request('/clusters', { headers: bearer(token) }),
};
