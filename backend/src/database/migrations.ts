// ============================================
// Database Migrations
// ============================================

import { getDb } from './connection';
import logger from '../utils/logger';

export function runMigrations(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      total_vehicles INTEGER NOT NULL DEFAULT 0,
      unique_vehicles INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT,
      progress INTEGER NOT NULL DEFAULT 0,
      success_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      no_record_count INTEGER NOT NULL DEFAULT 0,
      vehicles_json TEXT
    );

    CREATE TABLE IF NOT EXISTS results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      vehicle_number TEXT NOT NULL,
      email TEXT DEFAULT '',
      vehicle_creation_timestamp TEXT DEFAULT '',
      last_trip_date TEXT DEFAULT '',
      days_from_last_trip TEXT DEFAULT '',
      tag_creation_timestamp TEXT DEFAULT '',
      tag_addition_check TEXT DEFAULT '',
      owner_name TEXT DEFAULT '',
      phone_number TEXT DEFAULT '',
      status TEXT DEFAULT '',
      remarks TEXT DEFAULT '',
      search_status TEXT NOT NULL DEFAULT 'pending',
      search_time TEXT,
      search_duration_ms INTEGER DEFAULT 0,
      retry_count INTEGER DEFAULT 0,
      error_message TEXT DEFAULT '',
      worker_id INTEGER DEFAULT 0,
      raw_data TEXT DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      timestamp TEXT NOT NULL,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      vehicle_number TEXT DEFAULT '',
      duration_ms INTEGER DEFAULT 0,
      worker_id INTEGER DEFAULT 0,
      metadata TEXT DEFAULT '{}'
    );

    CREATE INDEX IF NOT EXISTS idx_results_job_id ON results(job_id);
    CREATE INDEX IF NOT EXISTS idx_results_vehicle ON results(vehicle_number);
    CREATE INDEX IF NOT EXISTS idx_results_status ON results(search_status);
    CREATE INDEX IF NOT EXISTS idx_logs_job_id ON logs(job_id);
    CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
  `);

  logger.info('Database migrations completed');
}

export default runMigrations;
