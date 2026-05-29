const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      credentials: 'include',
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body,
    });
  } catch {
    throw new Error('Cannot reach the server. Make sure the backend is running on ' + API);
  }

  const text = await res.text();

  if (!text) {
    throw new Error(`Server returned an empty response (HTTP ${res.status})`);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Unexpected server response: ${text.slice(0, 120)}`);
  }

  if (!data.success) throw new Error(data.message ?? 'Request failed');
  return data.data;
}

function bearer(token) {
  return { Authorization: `Bearer ${token}` };
}

export const authService = {
  signup:        (body)        => request('/api/auth/signup',        { method: 'POST',  body: JSON.stringify(body) }),
  login:         (body)        => request('/api/auth/login',         { method: 'POST',  body: JSON.stringify(body) }),
  logout:        ()            => request('/api/auth/logout',        { method: 'POST' }),
  refresh:       ()            => request('/api/auth/refresh-token', { method: 'POST' }),
  getProfile:    (token)       => request('/api/auth/profile',       { headers: bearer(token) }),
  updateProfile: (token, body) => request('/api/auth/profile',       { method: 'PATCH', body: JSON.stringify(body), headers: bearer(token) }),
  getClusters:   (token)       => request('/api/clusters',           { headers: bearer(token) }),
};
