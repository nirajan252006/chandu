// ============================================
// SQLite Database Connection
// ============================================

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import config from '../config';
import logger from '../utils/logger';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    // Ensure directory exists
    const dbDir = path.dirname(config.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    db = new Database(config.dbPath);

    // Enable WAL mode for better concurrent access
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
    db.pragma('synchronous = NORMAL');
    db.pragma('foreign_keys = ON');

    logger.info(`Database connected: ${config.dbPath}`);
  }

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
    logger.info('Database connection closed');
  }
}

export default getDb;
