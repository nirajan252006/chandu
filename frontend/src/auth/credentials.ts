/*
  Frontend-only credential storage.
  - Stores username + password verifier (PBKDF2) + salt + version.
  - Never stores plaintext password.

  Security note: this is local-machine UI access gating.
*/

export type AdminCredentials = {
  version: 1;
  username: string;
  saltB64: string;
  verifierB64: string; // derived key bytes
  iterations: number;
  hashBytes: number;
};

const KEY_NAME = 'vdrpro:admin:creds';

function isBrowser() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function b64FromBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function bytesFromB64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveVerifier(password: string, salt: Uint8Array, iterations: number, hashBytes: number) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      // TS lib types can be picky across toolchains; runtime supports Uint8Array.
      salt: salt as unknown as ArrayBuffer,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    hashBytes * 8
  );

  return new Uint8Array(bits);
}


export const DEFAULT_ADMIN_USERNAME = 'admin';
export const DEFAULT_ADMIN_PASSWORD = 'Admin@123';

export async function ensureDefaultAdminCredentials() {
  if (!isBrowser()) return;
  const existing = loadAdminCredentials();
  if (existing) return;

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 150_000;
  const hashBytes = 32;
  const verifier = await deriveVerifier(DEFAULT_ADMIN_PASSWORD, salt, iterations, hashBytes);

  const creds: AdminCredentials = {
    version: 1,
    username: DEFAULT_ADMIN_USERNAME,
    saltB64: b64FromBytes(salt),
    verifierB64: b64FromBytes(verifier),
    iterations,
    hashBytes,
  };

  window.localStorage.setItem(KEY_NAME, JSON.stringify(creds));
}

export function loadAdminCredentials(): AdminCredentials | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(KEY_NAME);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminCredentials;
  } catch {
    return null;
  }
}

export function clearAdminCredentials() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(KEY_NAME);
}

export async function verifyAdminLogin(username: string, password: string): Promise<boolean> {
  await ensureDefaultAdminCredentials();
  const creds = loadAdminCredentials();
  if (!creds) return false;
  if (creds.username.toLowerCase() !== username.trim().toLowerCase()) return false;

  const salt = bytesFromB64(creds.saltB64);
  const verifier = await deriveVerifier(password, salt, creds.iterations, creds.hashBytes);
  const verifierB64 = b64FromBytes(verifier);
  return verifierB64 === creds.verifierB64;
}

export async function changeAdminCredentials(newUsername: string, newPassword: string) {
  await ensureDefaultAdminCredentials();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 150_000;
  const hashBytes = 32;
  const verifier = await deriveVerifier(newPassword, salt, iterations, hashBytes);

  const next: AdminCredentials = {
    version: 1,
    username: newUsername.trim(),
    saltB64: b64FromBytes(salt),
    verifierB64: b64FromBytes(verifier),
    iterations,
    hashBytes,
  };

  if (!isBrowser()) return;
  window.localStorage.setItem(KEY_NAME, JSON.stringify(next));
  return next;
}

