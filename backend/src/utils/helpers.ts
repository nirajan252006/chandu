// ============================================
// Utility Helpers
// ============================================

import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a unique job ID
 */
export function generateJobId(): string {
  return `job_${Date.now()}_${uuidv4().slice(0, 8)}`;
}

/**
 * Format milliseconds to human-readable duration
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Normalize vehicle number: trim, lowercase, remove extra spaces
 */
export function normalizeVehicleNumber(vn: string): string {
  return vn.toString().trim().toLowerCase().replace(/\s+/g, '');
}

/**
 * Validate vehicle number format (Indian format: XX00XX0000)
 */
export function isValidVehicleNumber(vn: string): boolean {
  // Flexible pattern: 2 letters, 1-2 digits, 1-3 letters, 1-4 digits
  const pattern = /^[a-z]{2}\d{1,2}[a-z]{1,3}\d{1,4}$/;
  return pattern.test(vn);
}

/**
 * Sleep for given milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  baseDelay: number,
  onRetry?: (attempt: number, error: Error) => void
): Promise<T> {
  let lastError: Error = new Error('Unknown error');

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 300;
        onRetry?.(attempt + 1, lastError);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Get current ISO timestamp
 */
export function now(): string {
  return new Date().toISOString();
}

/**
 * Calculate estimated time remaining
 */
export function estimateTimeRemaining(
  processed: number,
  total: number,
  averageTimeMs: number
): number {
  const remaining = total - processed;
  return remaining * averageTimeMs;
}

/**
 * Chunk an array into smaller arrays
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
