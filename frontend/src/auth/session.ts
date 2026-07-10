export type AuthSession = {
  token: string;
  username: string;
  remembered: boolean;
  createdAt: number;
  lastActivityAt: number;
  expiresAt: number;
};

const LS_KEY = 'vdrpro:session';

// Defaults: enforced frontend-only gating/timers.
// Values can be tuned without touching backend/business logic.
export const SESSION_IDLE_TIMEOUT_MS = 1000 * 60 * 10; // 10 minutes inactivity
export const SESSION_ABSOLUTE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours
export const SESSION_WARNING_BEFORE_MS = 1000 * 60; // 1 minute warning

function isBrowser() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

export function loadSession(): AuthSession | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(LS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.token || !parsed?.expiresAt) return null;
    if (Date.now() >= parsed.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: Omit<AuthSession, 'createdAt' | 'lastActivityAt' | 'expiresAt'>) {
  if (!isBrowser()) return;
  const now = Date.now();
  const expiresAt = now + SESSION_ABSOLUTE_TTL_MS;
  const next: AuthSession = {
    ...session,
    createdAt: now,
    lastActivityAt: now,
    expiresAt,
  };
  window.localStorage.setItem(LS_KEY, JSON.stringify(next));
  return next;
}

export function touchSessionActivity(session: AuthSession): AuthSession {
  const now = Date.now();
  return { ...session, lastActivityAt: now };
}

export function persistSession(session: AuthSession) {
  if (!isBrowser()) return;
  window.localStorage.setItem(LS_KEY, JSON.stringify(session));
}

export function clearSession() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(LS_KEY);
}

export function getIdleRemainingMs(session: AuthSession) {
  const idleElapsed = Date.now() - session.lastActivityAt;
  return SESSION_IDLE_TIMEOUT_MS - idleElapsed;
}

export function getExpirationRemainingMs(session: AuthSession) {
  return session.expiresAt - Date.now();
}

export function shouldWarn(session: AuthSession) {
  const remaining = Math.min(getIdleRemainingMs(session), getExpirationRemainingMs(session));
  return remaining <= SESSION_WARNING_BEFORE_MS && remaining > 0;
}

