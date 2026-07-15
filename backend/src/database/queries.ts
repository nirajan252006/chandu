// ============================================
// Database Query Helpers
// ============================================

import { getDb } from './connection';
import { Job, VehicleRecord, LogEntry, SearchStatus, JobStatus, JobSummary } from '../types';
import { now } from '../utils/helpers';

// ---- JOBS ----

export function createJob(
  id: string,
  filename: string,
  totalVehicles: number,
  uniqueVehicles: number,
  vehiclesJson: string
): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO jobs (id, filename, total_vehicles, unique_vehicles, status, created_at, vehicles_json)
    VALUES (?, ?, ?, ?, 'pending', ?, ?)
  `).run(id, filename, totalVehicles, uniqueVehicles, now(), vehiclesJson);
}

export function getJob(id: string): Job | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as any;
  if (!row) return undefined;
  return mapJob(row);
}

export function getAllJobs(): Job[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM jobs ORDER BY created_at DESC').all() as any[];
  return rows.map(mapJob);
}

export function updateJobStatus(id: string, status: JobStatus): void {
  const db = getDb();
  const updates: Record<string, string | null> = { status };

  if (status === 'processing') updates.started_at = now();
  if (status === 'completed' || status === 'cancelled' || status === 'failed') {
    updates.completed_at = now();
  }

  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const values = Object.values(updates);

  db.prepare(`UPDATE jobs SET ${setClauses} WHERE id = ?`).run(...values, id);
}

export function updateJobProgress(
  id: string,
  progress: number,
  successCount: number,
  failedCount: number,
  noRecordCount: number
): void {
  const db = getDb();
  db.prepare(`
    UPDATE jobs SET progress = ?, success_count = ?, failed_count = ?, no_record_count = ?
    WHERE id = ?
  `).run(progress, successCount, failedCount, noRecordCount, id);
}

export function getJobVehicles(id: string): any[] {
  const db = getDb();
  const row = db.prepare('SELECT vehicles_json FROM jobs WHERE id = ?').get(id) as any;
  if (!row || !row.vehicles_json) return [];
  try {
    return JSON.parse(row.vehicles_json);
  } catch {
    return [];
  }
}

// ---- RESULTS ----

export function saveResult(jobId: string, result: Partial<VehicleRecord>): void {
  const db = getDb();
  
  let existing = null;
  if (result.rowIndex !== undefined) {
    existing = db.prepare('SELECT id FROM results WHERE job_id = ? AND row_index = ?').get(jobId, result.rowIndex);
  } else {
    existing = db.prepare('SELECT id FROM results WHERE job_id = ? AND vehicle_number = ?').get(jobId, result.vehicleNumber || '');
  }
  
  if (existing) {
    db.prepare(`
      UPDATE results SET
        vehicle_number = ?, email = ?, vehicle_creation_timestamp = ?, last_trip_date = ?,
        days_from_last_trip = ?, tag_creation_timestamp = ?, tag_addition_check = ?,
        owner_name = ?, phone_number = ?, status = ?, remarks = ?,
        search_status = ?, search_time = ?, search_duration_ms = ?,
        retry_count = ?, error_message = ?, worker_id = ?, raw_data = ?
      WHERE id = ?
    `).run(
      result.vehicleNumber || '',
      result.email || '',
      result.vehicleCreationTimestamp || '',
      result.lastTripDate || '',
      result.daysFromLastTrip || '',
      result.tagCreationTimestamp || '',
      result.tagAdditionCheck || '',
      result.ownerName || '',
      result.phoneNumber || '',
      result.status || '',
      result.remarks || '',
      result.searchStatus || 'pending',
      result.searchTime || now(),
      result.searchDurationMs || 0,
      result.retryCount || 0,
      result.errorMessage || '',
      result.workerId || 0,
      JSON.stringify(result.rawData || {}),
      (existing as any).id
    );
  } else {
    db.prepare(`
      INSERT INTO results (
        job_id, row_index, vehicle_number, email, vehicle_creation_timestamp,
        last_trip_date, days_from_last_trip, tag_creation_timestamp,
        tag_addition_check, owner_name, phone_number, status,
        remarks, search_status, search_time, search_duration_ms,
        retry_count, error_message, worker_id, raw_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      jobId,
      result.rowIndex !== undefined ? result.rowIndex : null,
      result.vehicleNumber || '',
      result.email || '',
      result.vehicleCreationTimestamp || '',
      result.lastTripDate || '',
      result.daysFromLastTrip || '',
      result.tagCreationTimestamp || '',
      result.tagAdditionCheck || '',
      result.ownerName || '',
      result.phoneNumber || '',
      result.status || '',
      result.remarks || '',
      result.searchStatus || 'pending',
      result.searchTime || now(),
      result.searchDurationMs || 0,
      result.retryCount || 0,
      result.errorMessage || '',
      result.workerId || 0,
      JSON.stringify(result.rawData || {})
    );
  }
}

export function getResults(jobId: string): VehicleRecord[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM results WHERE job_id = ? ORDER BY row_index ASC').all(jobId) as any[];
  return rows.map(mapResult);
}

export function getFailedResults(jobId: string): VehicleRecord[] {
  const db = getDb();
  const rows = db.prepare(
    "SELECT * FROM results WHERE job_id = ? AND search_status IN ('failed', 'timeout') ORDER BY row_index ASC"
  ).all(jobId) as any[];
  return rows.map(mapResult);
}

export function getProcessedRowIndexes(jobId: string): Set<number> {
  const db = getDb();
  const rows = db.prepare(
    "SELECT row_index FROM results WHERE job_id = ? AND search_status != 'pending'"
  ).all(jobId) as any[];
  return new Set(rows.map((r: any) => Number(r.row_index)));
}

// ---- LOGS ----

export function saveLog(entry: LogEntry): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO logs (job_id, timestamp, level, message, vehicle_number, duration_ms, worker_id, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entry.jobId,
    entry.timestamp || now(),
    entry.level,
    entry.message,
    entry.vehicleNumber || '',
    entry.durationMs || 0,
    entry.workerId || 0,
    JSON.stringify(entry.metadata || {})
  );
}

export function getLogs(jobId: string, limit: number = 500): LogEntry[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM logs WHERE job_id = ? ORDER BY id DESC LIMIT ?'
  ).all(jobId, limit) as any[];
  return rows.map(mapLog).reverse();
}

// ---- SUMMARY ----

export function getJobSummary(jobId: string): JobSummary | null {
  const db = getDb();
  const job = getJob(jobId);
  if (!job) return null;

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN search_status = 'success' THEN 1 ELSE 0 END) as success,
      SUM(CASE WHEN search_status IN ('failed', 'timeout') THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN search_status = 'no_eligible_record' THEN 1 ELSE 0 END) as no_record,
      AVG(CASE WHEN search_status = 'success' AND days_from_last_trip != '' AND days_from_last_trip != 'No data'
          THEN CAST(days_from_last_trip AS REAL) END) as avg_days,
      AVG(search_duration_ms) as avg_time,
      SUM(search_duration_ms) as total_time
    FROM results WHERE job_id = ?
  `).get(jobId) as any;

  return {
    jobId,
    totalVehicles: job.uniqueVehicles,
    successCount: stats.success || 0,
    failedCount: stats.failed || 0,
    noRecordCount: stats.no_record || 0,
    averageDaysFromLastTrip: Math.round(stats.avg_days || 0),
    averageSearchTimeMs: Math.round(stats.avg_time || 0),
    totalProcessingTimeMs: stats.total_time || 0,
    startTime: job.startedAt || job.createdAt,
    endTime: job.completedAt || now(),
    successRate: stats.total > 0 ? Math.round(((stats.success || 0) / stats.total) * 100) : 0,
  };
}

// ---- MAPPERS ----

function mapJob(row: any): Job {
  return {
    id: row.id,
    filename: row.filename,
    totalVehicles: row.total_vehicles,
    uniqueVehicles: row.unique_vehicles,
    status: row.status as JobStatus,
    createdAt: row.created_at,
    startedAt: row.started_at || null,
    completedAt: row.completed_at || null,
    progress: row.progress,
    successCount: row.success_count,
    failedCount: row.failed_count,
    noRecordCount: row.no_record_count,
  };
}

function mapResult(row: any): VehicleRecord {
  return {
    vehicleNumber: row.vehicle_number,
    email: row.email,
    vehicleCreationTimestamp: row.vehicle_creation_timestamp,
    lastTripDate: row.last_trip_date,
    daysFromLastTrip: row.days_from_last_trip,
    tagCreationTimestamp: row.tag_creation_timestamp,
    tagAdditionCheck: row.tag_addition_check,
    ownerName: row.owner_name,
    phoneNumber: row.phone_number,
    status: row.status,
    remarks: row.remarks,
    searchStatus: row.search_status as SearchStatus,
    searchTime: row.search_time,
    searchDurationMs: row.search_duration_ms,
    retryCount: row.retry_count,
    errorMessage: row.error_message,
    workerId: row.worker_id,
    rawData: (() => { try { return JSON.parse(row.raw_data || '{}'); } catch { return {}; } })(),
    rowIndex: row.row_index !== null ? Number(row.row_index) : undefined,
  };
}

function mapLog(row: any): LogEntry {
  return {
    id: row.id,
    jobId: row.job_id,
    timestamp: row.timestamp,
    level: row.level,
    message: row.message,
    vehicleNumber: row.vehicle_number || undefined,
    durationMs: row.duration_ms || undefined,
    workerId: row.worker_id || undefined,
    metadata: (() => { try { return JSON.parse(row.metadata || '{}'); } catch { return {}; } })(),
  };
}
