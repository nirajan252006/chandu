// ============================================
// Configuration Module
// ============================================

import path from 'path';
import dotenv from 'dotenv';
import { AppConfig } from '../types';

// Load .env from config directory
dotenv.config({ path: path.resolve(__dirname, '../../..', 'config', '.env') });

function envStr(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function envInt(key: string, fallback: number): number {
  const val = process.env[key];
  if (!val) return fallback;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? fallback : parsed;
}

function envBool(key: string, fallback: boolean): boolean {
  const val = process.env[key];
  if (!val) return fallback;
  return val.toLowerCase() === 'true' || val === '1';
}

const rootDir = path.resolve(__dirname, '../../..');

export const config: AppConfig = {
  port: envInt('PORT', 3001),
  frontendUrl: envStr('FRONTEND_URL', 'http://localhost:5173'),

  lookerReportUrl: envStr(
    'LOOKER_REPORT_URL',
    'https://lookerstudio.google.com/u/1/reporting/ecdae0e9-b1df-49d6-8103-31f5a82e16b7/page/xd7o'
  ),

  browser: {
    userDataDir: envStr(
      'CHROME_USER_DATA_DIR',
      path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data')
    ),
    profile: envStr('CHROME_PROFILE', 'Default'),
    headless: envBool('HEADLESS', false),
    slowMo: envInt('BROWSER_SLOWMO', 0),
    reportUrl: envStr(
      'LOOKER_REPORT_URL',
      'https://lookerstudio.google.com/u/1/reporting/ecdae0e9-b1df-49d6-8103-31f5a82e16b7/page/xd7o'
    ),
  },

  queue: {
    maxParallelTabs: envInt('MAX_PARALLEL_TABS', 6),
    pageLoadTimeout: envInt('PAGE_LOAD_TIMEOUT', 30000),
    searchTimeout: envInt('SEARCH_TIMEOUT', 15000),
    maxRetries: envInt('MAX_RETRIES', 2),
    retryDelayBase: envInt('RETRY_DELAY_BASE', 1000),
    throttleThresholdMs: envInt('THROTTLE_THRESHOLD_MS', 12000),
    autoThrottle: envBool('AUTO_THROTTLE', true),
  },

  dbPath: path.resolve(rootDir, envStr('DB_PATH', './data/database/vehicle-retriever.db')),
  uploadDir: path.resolve(rootDir, envStr('UPLOAD_DIR', './data/uploads')),
  exportDir: path.resolve(rootDir, envStr('EXPORT_DIR', './data/exports')),
  logDir: path.resolve(rootDir, envStr('LOG_DIR', './data/logs')),
  maxUploadSize: envInt('MAX_UPLOAD_SIZE', 52428800),
};

export default config;
