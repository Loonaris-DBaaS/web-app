import api from './api';

export async function login(email, password) {
  const { data } = await api.post('/api/auth/login', { email, password });
  if (data.data?.accessToken) {
    localStorage.setItem('accessToken', data.data.accessToken);
  }
  return data.data;
}

export async function signup({ username, email, password, country }) {
  const { data } = await api.post('/api/auth/signup', { username, email, password, country });
  if (data.data?.accessToken) {
    localStorage.setItem('accessToken', data.data.accessToken);
  }
  return data.data;
}

export async function logout() {
  await api.post('/api/auth/logout');
  localStorage.removeItem('accessToken');
}

export async function refreshAccessToken() {
  const { data } = await api.post('/api/auth/refresh-token');
  if (data.data?.accessToken) {
    localStorage.setItem('accessToken', data.data.accessToken);
  }
  return data.data;
}

export async function getProfile() {
  const { data } = await api.get('/api/auth/profile');
  return data.data;
}
