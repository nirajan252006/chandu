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
export const SESSION_IDLE_TIMEOUT_MS = 1000 * 60 * 60 * 24 * 365 * 100; // 100 years inactivity
export const SESSION_ABSOLUTE_TTL_MS = 1000 * 60 * 60 * 24 * 365 * 100; // 100 years
export const SESSION_WARNING_BEFORE_MS = 0; // No warning threshold

function isBrowser() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

export function loadSession(): AuthSession | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(LS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.token) return null;
    // Bypassed/disabled expiration check so the session is loadable indefinitely
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
  return SESSION_IDLE_TIMEOUT_MS;
}

export function getExpirationRemainingMs(session: AuthSession) {
  return SESSION_ABSOLUTE_TTL_MS;
}

export function shouldWarn(session: AuthSession) {
  return false;
}

