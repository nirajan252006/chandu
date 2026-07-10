import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import {
  clearSession,
  getExpirationRemainingMs,
  getIdleRemainingMs,
  loadSession,
  persistSession,
  shouldWarn,
  touchSessionActivity,
  SESSION_IDLE_TIMEOUT_MS,
  SESSION_ABSOLUTE_TTL_MS,
  type AuthSession,
} from './session';

import { changeAdminCredentials, verifyAdminLogin } from './credentials';

export type AuthUser = { username: string };

export type AuthContextValue = {
  isAuthenticated: boolean;
  user: AuthUser | null;
  login: (username: string, password: string, remember: boolean) => Promise<{ ok: boolean; error?: string }>;
  logout: (opts?: { silent?: boolean }) => void;
  touch: () => void;
  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) => Promise<{ ok: boolean; error?: string }>;
  session: AuthSession | null;
  sessionWarning: boolean;
  sessionIdleRemainingMs: number | null;
  sessionExpirationRemainingMs: number | null;
  resetSessionTimers: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

const LS_KEY_AUTHPING = 'vdrpro:auth:last-activity';

function buildToken() {
  // Non-cryptographic uniqueness is OK for a local-only UI gate.
  return `sess_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function normalizeUsername(u: string) {
  return u.trim();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => loadSession());
  const [user, setUser] = useState<AuthUser | null>(() => {
    const s = loadSession();
    return s ? { username: s.username } : null;
  });

  // Keep these in sync with session storage helpers
  // (reserved for cross-tab activity ping key)



  const [sessionWarning, setSessionWarning] = useState(false);
  const [sessionIdleRemainingMs, setSessionIdleRemainingMs] = useState<number | null>(null);
  const [sessionExpirationRemainingMs, setSessionExpirationRemainingMs] = useState<number | null>(null);

  const isAuthenticated = !!session && !!user;

  const recomputeTimers = useCallback((s: AuthSession | null) => {
    if (!s) {
      setSessionWarning(false);
      setSessionIdleRemainingMs(null);
      setSessionExpirationRemainingMs(null);
      return;
    }
    const idle = getIdleRemainingMs(s);
    const exp = getExpirationRemainingMs(s);
    setSessionIdleRemainingMs(idle);
    setSessionExpirationRemainingMs(exp);
    setSessionWarning(shouldWarn(s));
  }, []);

  useEffect(() => {
    recomputeTimers(session);
  }, [session, recomputeTimers]);

  // Periodic warning/expiry checks while authenticated
  useEffect(() => {
    if (!session) return;

    const interval = window.setInterval(() => {
      setSession((prev) => {
        if (!prev) return prev;
        // If either timeout or absolute TTL elapsed -> logout
        const idleRemaining = getIdleRemainingMs(prev);
        const expRemaining = getExpirationRemainingMs(prev);
        if (idleRemaining <= 0 || expRemaining <= 0) {
          clearSession();
          setUser(null);
          setSessionWarning(false);
          return null;
        }
        // Warn update
        const warn = shouldWarn(prev);
        setSessionWarning(warn);
        setSessionIdleRemainingMs(idleRemaining);
        setSessionExpirationRemainingMs(expRemaining);
        return prev;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [session]);

  const touch = useCallback(() => {
    setSession((prev) => {
      if (!prev) return prev;
      const next = touchSessionActivity(prev);
      persistSession(next);
      return next;
    });
    // also mark activity for cross-tab (optional)
    try {
      window.localStorage.setItem(LS_KEY_AUTHPING, String(Date.now()));
    } catch {
      // ignore
    }
  }, []);

  // Cross-tab activity sync (best-effort)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key !== LS_KEY_AUTHPING) return;
      touch();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [touch]);

  // Inactivity listeners
  useEffect(() => {
    if (!isAuthenticated) return;

    const handler = () => touch();
    const events: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, handler, { passive: true } as any));

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, handler as any));
    };
  }, [isAuthenticated, touch]);

  const resetSessionTimers = useCallback(() => {
    setSession((prev) => {
      if (!prev) return prev;
      const now = Date.now();
      const next: AuthSession = {
        ...prev,
        lastActivityAt: now,
        expiresAt: prev.expiresAt,
      };
      persistSession(next);
      return next;
    });
  }, []);

  const login = useCallback(
    async (username: string, password: string, remember: boolean) => {
      try {
        const ok = await verifyAdminLogin(username, password);
        if (!ok) return { ok: false, error: 'Invalid username or password.' };

        const now = Date.now();
        // remembered sessions can be longer; enforce via remember flag only for UX.
        const idleTimeout = remember ? SESSION_IDLE_TIMEOUT_MS : 1000 * 60 * 7;
        const absoluteTtl = remember ? SESSION_ABSOLUTE_TTL_MS : 1000 * 60 * 60 * 2;

        const s: AuthSession = {
          token: buildToken(),
          username: normalizeUsername(username),
          remembered: remember,
          createdAt: now,
          lastActivityAt: now,
          expiresAt: now + Math.min(idleTimeout, absoluteTtl),
        };

        saveSessionInternal(s, remember);
        setSession(s);
        setUser({ username: s.username });
        setSessionWarning(false);
        return { ok: true };
      } catch {
        return { ok: false, error: 'Login failed due to an unexpected error.' };
      }
    },
    []
  );

  const saveSessionInternal = (s: AuthSession, remember: boolean) => {
    // If not remember, we still store locally but with shorter TTL.
    // We already encode TTL in session.expiresAt above.
    persistSession(s);
    if (!remember) {
      // best-effort: keep it on localStorage anyway; expiresAt handles auto-expire.
    }
  };

  const logout = useCallback((opts?: { silent?: boolean }) => {
    clearSession();
    setSession(null);
    setUser(null);
    setSessionWarning(false);
    if (!opts?.silent) {
      try {
        window.location.reload();
      } catch {
        // ignore
      }
    }
  }, []);

  const changePasswordFn = useCallback(
    async (currentPassword: string, newPassword: string, confirmPassword: string) => {
      const currentOk = await verifyAdminLogin(user?.username || 'admin', currentPassword);
      if (!currentOk) return { ok: false, error: 'Current password is incorrect.' };
      if (newPassword !== confirmPassword) return { ok: false, error: 'New passwords do not match.' };

      const next = await changeAdminCredentials(user?.username || 'admin', newPassword);


      if (!next) return { ok: false, error: 'Failed to update password.' };
      return { ok: true };
    },
    [user]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      user,
      login,
      logout,
      touch,
      changePassword: changePasswordFn,
      session,
      sessionWarning,
      sessionIdleRemainingMs,
      sessionExpirationRemainingMs,
      resetSessionTimers,
    }),
    [
      isAuthenticated,
      user,
      login,
      logout,
      touch,
      changePasswordFn,
      session,
      sessionWarning,
      sessionIdleRemainingMs,
      sessionExpirationRemainingMs,
      resetSessionTimers,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

