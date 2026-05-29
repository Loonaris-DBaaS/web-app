import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { authService } from '../services/auth.service';

const AuthContext = createContext(null);

// Access token lives 15 min; refresh silently at 14 min
const REFRESH_INTERVAL_MS = 14 * 60 * 1000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const timer = useRef(null);

  function scheduleRefresh(token) {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const data = await authService.refresh();
        setAccessToken(data.accessToken);
        scheduleRefresh(data.accessToken);
      } catch {
        setUser(null);
        setAccessToken(null);
      }
    }, REFRESH_INTERVAL_MS);
  }

  // Recover session from httpOnly refresh-token cookie on mount
  useEffect(() => {
    authService
      .refresh()
      .then(async (data) => {
        setAccessToken(data.accessToken);
        const profile = await authService.getProfile(data.accessToken);
        setUser(profile);
        scheduleRefresh(data.accessToken);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    return () => clearTimeout(timer.current);
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await authService.login({ email, password });
    setAccessToken(data.accessToken);
    setUser({ id: data.id, username: data.username, email: data.email, country: data.country, jobTitle: data.jobTitle, company: data.company, photoUrl: data.photoUrl });
    scheduleRefresh(data.accessToken);
    return data;
  }, []);

  const signup = useCallback(async (fields) => {
    return authService.signup(fields);
  }, []);

  const logout = useCallback(async () => {
    clearTimeout(timer.current);
    await authService.logout().catch(() => {});
    setUser(null);
    setAccessToken(null);
  }, []);

  const updateProfile = useCallback(async (fields) => {
    const updated = await authService.updateProfile(accessToken, fields);
    setUser((prev) => ({ ...prev, ...updated }));
    return updated;
  }, [accessToken]);

  return (
    <AuthContext.Provider value={{ user, accessToken, loading, login, signup, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
