import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, loadSession, saveSession, setUnauthorizedHandler, tokenClaims } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => loadSession());
  const [notice, setNotice] = useState('');
  const lastActivity = useRef(Date.now());

  const apply = useCallback((s) => { saveSession(s); setSession(s); }, []);

  const logoutLocal = useCallback((message = '') => {
    apply(null);
    setNotice(message);
  }, [apply]);

  useEffect(() => {
    setUnauthorizedHandler((msg) => logoutLocal(msg || 'Your session has ended. Please sign in again.'));
  }, [logoutLocal]);

  // Track activity so only active users get their token refreshed.
  useEffect(() => {
    const mark = () => { lastActivity.current = Date.now(); };
    ['mousedown', 'keydown', 'touchstart', 'scroll'].forEach((e) => window.addEventListener(e, mark, { passive: true }));
    return () => ['mousedown', 'keydown', 'touchstart', 'scroll'].forEach((e) => window.removeEventListener(e, mark));
  }, []);

  // Token lifecycle: refresh ~5 minutes before expiry if the user has been active,
  // otherwise let the 30-minute token expire and sign the user out.
  useEffect(() => {
    if (!session?.token) return undefined;
    const timer = setInterval(async () => {
      const claims = tokenClaims(session.token);
      if (!claims) return logoutLocal('Invalid session.');
      const msLeft = claims.exp * 1000 - Date.now();
      if (msLeft <= 0) return logoutLocal('Your session expired after 30 minutes. Please sign in again.');
      const active = Date.now() - lastActivity.current < 10 * 60 * 1000;
      if (msLeft < 5 * 60 * 1000 && active) {
        try {
          const r = await api.post('/api/v1/auth/refresh');
          apply({ ...session, token: r.token });
        } catch { /* 401 handler signs out */ }
      }
    }, 30 * 1000);
    return () => clearInterval(timer);
  }, [session, apply, logoutLocal]);

  const login = useCallback(async (username, password, role) => {
    const r = await api.post('/api/v1/auth/login', { username, password, role });
    if (r.chooseRole) return r;
    setNotice('');
    apply({ token: r.token, user: r.user, permissions: r.permissions });
    return r;
  }, [apply]);

  const logout = useCallback(async () => {
    try { await api.post('/api/v1/auth/logout'); } catch { /* already invalid */ }
    logoutLocal('You have been signed out.');
  }, [logoutLocal]);

  const can = useCallback((resource, action) => !!session?.permissions?.includes(`${resource}:${action}`), [session]);

  const value = useMemo(() => ({
    session, user: session?.user, token: session?.token, notice, setNotice, login, logout, endSession: logoutLocal, can,
  }), [session, notice, login, logout, logoutLocal, can]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
