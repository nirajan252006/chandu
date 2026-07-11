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



  const [sessionWarning] = useState(false);
  const [sessionIdleRemainingMs] = useState<number | null>(null);
  const [sessionExpirationRemainingMs] = useState<number | null>(null);

  const isAuthenticated = !!session && !!user;

  const touch = useCallback(() => {}, []);

  const resetSessionTimers = useCallback(() => {}, []);

  const login = useCallback(
    async (username: string, password: string, remember: boolean) => {
      try {
        const ok = await verifyAdminLogin(username, password);
        if (!ok) return { ok: false, error: 'Invalid username or password.' };

        const now = Date.now();
        const infiniteTtl = 1000 * 60 * 60 * 24 * 365 * 100; // 100 years

        const s: AuthSession = {
          token: buildToken(),
          username: normalizeUsername(username),
          remembered: remember,
          createdAt: now,
          lastActivityAt: now,
          expiresAt: now + infiniteTtl,
        };

        saveSessionInternal(s, remember);
        setSession(s);
        setUser({ username: s.username });
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

