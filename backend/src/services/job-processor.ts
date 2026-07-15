// ============================================
// Job Processor - Orchestrates the Full Pipeline
// ============================================

import { browserManager } from '../automation/browser-manager';
import { queueManager } from './queue-manager';
import { SearchResult, VehicleRecord, LogEntry } from '../types';
import * as db from '../database/queries';
import { now } from '../utils/helpers';
import config from '../config';
import logger from '../utils/logger';

type WSEmitter = (event: string, data: any) => void;

class JobProcessor {
  private activeJobId: string | null = null;
  private wsEmit: WSEmitter | null = null;

  /**
   * Set the WebSocket emitter for live updates
   */
  setWSEmitter(emit: WSEmitter): void {
    this.wsEmit = emit;
  }

  /**
   * Start processing a job
   */
  async startJob(jobId: string, requestedConcurrency?: number): Promise<void> {
    if (this.activeJobId) {
      throw new Error(`Another job is already running: ${this.activeJobId}`);
    }

    const job = db.getJob(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);
    if (job.status === 'processing') throw new Error('Job is already processing');

    this.activeJobId = jobId;

    try {
      // Update job status
      db.updateJobStatus(jobId, 'processing');

      // Determine concurrency to use
      const concurrency = requestedConcurrency || config.queue.maxParallelTabs;

      // Get vehicles to process
      const allVehicles = db.getJobVehicles(jobId);
      const processedRowIndexes = db.getProcessedRowIndexes(jobId);
      const stats = db.getJobSummary(jobId);
      const successCount = stats ? stats.successCount : 0;
      const failedCount = stats ? stats.failedCount : 0;
      const noRecordCount = stats ? stats.noRecordCount : 0;

      // Emit initial zero progress so the UI disables the start button and transitions immediately
      this.emit('job:progress', {
        jobId,
        total: allVehicles.length,
        processed: processedRowIndexes.size,
        success: successCount,
        failed: failedCount,
        noRecord: noRecordCount,
        remaining: allVehicles.length - processedRowIndexes.size,
        progressPercent: allVehicles.length > 0 ? Math.round((processedRowIndexes.size / allVehicles.length) * 100) : 0,
        currentVehicle: 'Initializing...',
        estimatedTimeMs: 0,
        remainingTimeMs: 0,
        averageSearchTimeMs: 0,
        currentSpeed: 0,
        activeWorkers: concurrency,
      });

      // Emit initializing status
      this.emit('job:status', { jobId, status: 'initializing' });

      // Initialize or dynamically resize the browser tab pool with 90s timeout
      logger.info(`Ensuring browser is initialized with ${concurrency} parallel tabs...`);
      const initPromise = browserManager.initialize(config.browser, concurrency);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Browser connection failed or initialization timed out')), 90000)
      );

      await Promise.race([initPromise, timeoutPromise]);

      // Emit running status
      this.emit('job:status', { jobId, status: 'running' });

      // Configure queue concurrency
      queueManager.setConcurrency(concurrency);

      logger.info(`Job ${jobId}: ${allVehicles.length} total, ${processedRowIndexes.size} already processed`);

      // Register queue callbacks
      queueManager.onProgress((progress) => {
        // Only emit job:progress — job:stats is a duplicate and doubles WebSocket traffic
        this.emit('job:progress', progress);

        // Batch save progress to DB every 10 vehicles (reduce write pressure)
        if (progress.processed % 10 === 0) {
          db.updateJobProgress(
            jobId,
            progress.progressPercent,
            progress.success,
            progress.failed,
            progress.noRecord
          );
        }
      });

      queueManager.onVehicleComplete((result: SearchResult) => {
        // Save to database
        this.saveSearchResult(jobId, result);

        // Emit to frontend
        this.emit('job:vehicle-complete', result);
      });

      queueManager.onLog((entry: LogEntry) => {
        // Save log to database
        db.saveLog(entry);

        // Emit to frontend
        this.emit('job:log', entry);
      });

      queueManager.onError((vehicleNumber, error, retryCount) => {
        this.emit('job:error', { vehicleNumber, error, retryCount });
      });

      // Process vehicles
      const results = await queueManager.processVehicles(jobId, allVehicles, processedRowIndexes);

      // Update final job status
      const finalProgress = queueManager.getProgress();

      if (queueManager.cancelled) {
        db.updateJobStatus(jobId, 'cancelled');
        this.emit('job:status', { jobId, status: 'cancelled' });
      } else {
        db.updateJobStatus(jobId, 'completed');
        this.emit('job:status', { jobId, status: 'completed' });
      }

      db.updateJobProgress(
        jobId,
        finalProgress.progressPercent,
        finalProgress.success,
        finalProgress.failed,
        finalProgress.noRecord
      );

      // Emit completion
      const summary = db.getJobSummary(jobId);
      this.emit('job:complete', { jobId, summary });

      // Emit auto-export event
      this.emit('job:auto-export', {
        jobId,
        status: queueManager.cancelled ? 'cancelled' : 'completed',
        totalProcessed: finalProgress.processed,
        totalVehicles: finalProgress.total,
      });

      logger.info(`Job ${jobId} completed: ${finalProgress.success}/${finalProgress.total} success`);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      let diagnosticMsg = errMsg;
      
      const lower = errMsg.toLowerCase();
      if (lower.includes('timeout') || lower.includes('navigation timed out')) {
        diagnosticMsg = 'Looker Studio report unavailable or loading too slow.';
      } else if (lower.includes('session') || lower.includes('login') || lower.includes('auth')) {
        diagnosticMsg = 'Google session expired. Please re-authenticate.';
      } else if (lower.includes('net::err')) {
        diagnosticMsg = 'Browser connection failed. Check network connectivity.';
      } else if (lower.includes('target closed') || lower.includes('browser has been closed')) {
        diagnosticMsg = 'Browser connection failed or Google Chrome crashed.';
      } else if (lower.includes('filter') || lower.includes('license plate')) {
        diagnosticMsg = 'License Plate filter input not found on Looker Studio report.';
      } else if (lower.includes('table') || lower.includes('result table')) {
        diagnosticMsg = 'Result table not found on Looker Studio report.';
      }

      logger.error(`Job ${jobId} failed: ${diagnosticMsg} (Original: ${errMsg})`);
      db.updateJobStatus(jobId, 'failed');
      queueManager.setError();

      this.emit('job:status', { jobId, status: 'error', error: diagnosticMsg });
      this.emit('job:error', {
        vehicleNumber: '',
        error: diagnosticMsg,
        retryCount: 0,
      });
    } finally {
      this.activeJobId = null;
      logger.info('Job processing finished. Closing browser pool...');
      try {
        await browserManager.shutdown();
      } catch (err) {
        logger.error(`Failed to shutdown browser pool: ${err}`);
      }
    }
  }

  /**
   * Pause the current job
   */
  pauseJob(jobId: string): void {
    if (this.activeJobId !== jobId) throw new Error('Job is not active');
    queueManager.pause();
    db.updateJobStatus(jobId, 'paused');
    this.emit('job:status', { jobId, status: 'paused' });
    this.emit('job:log', {
      jobId, timestamp: now(), level: 'warn', message: 'Job paused by user',
    });
  }

  /**
   * Resume the current job
   */
  resumeJob(jobId: string): void {
    queueManager.resume();
    db.updateJobStatus(jobId, 'processing');
    this.emit('job:status', { jobId, status: 'running' });
    this.emit('job:log', {
      jobId, timestamp: now(), level: 'info', message: 'Job resumed by user',
    });
  }

  /**
   * Cancel the current job
   */
  cancelJob(jobId: string): void {
    if (this.activeJobId !== jobId) throw new Error('Job is not active');
    queueManager.cancel();
    db.updateJobStatus(jobId, 'cancelled');
    this.emit('job:status', { jobId, status: 'cancelling' });
    this.emit('job:log', {
      jobId, timestamp: now(), level: 'error', message: 'Job cancellation requested by user',
    });
  }

  /**
   * Get the active job ID
   */
  getActiveJobId(): string | null {
    return this.activeJobId;
  }

  /**
   * Save a search result to the database
   */
  private saveSearchResult(jobId: string, result: SearchResult): void {
    if (result.vehicleNumber === "") {
      const record: Partial<VehicleRecord> = {
        vehicleNumber: "",
        email: "",
        vehicleCreationTimestamp: "",
        lastTripDate: "",
        daysFromLastTrip: "",
        tagCreationTimestamp: "",
        tagAdditionCheck: "",
        ownerName: "",
        phoneNumber: "",
        status: "",
        remarks: "",
        searchStatus: result.status,
        searchTime: result.timestamp,
        searchDurationMs: 0,
        retryCount: 0,
        errorMessage: "",
        workerId: 0,
        rawData: {},
        rowIndex: result.rowIndex,
      };
      db.saveResult(jobId, record);
      return;
    }

    const selectedRow = result.data?.selectedRow || {};

    // Minimal per-vehicle log (no JSON.stringify of rawData in hot path)
    if (process.env.NODE_ENV !== 'production') {
      logger.debug(`[SaveResult] ${result.vehicleNumber}: status=${result.status}`);
    }
    const getVal = (keywords: string[], fallbackKeys: string[] = [], excludeKeywords: string[] = []): string => {
      const keys = Object.keys(selectedRow);

      const matchesKeywords = (keyStr: string): boolean => {
        const lower = keyStr.toLowerCase();
        return keywords.every(kw => lower.includes(kw)) && 
               !excludeKeywords.some(ex => lower.includes(ex));
      };

      // ── Pass 1: Match clean keys (no newlines, short) ──
      const cleanMatches: { key: string; len: number }[] = [];
      for (const key of keys) {
        if (key.includes('\n') || key.includes('\r')) continue;
        if (key.length > 80) continue; // skip garbage compound keys
        if (matchesKeywords(key)) {
          cleanMatches.push({ key, len: key.length });
        }
      }
      if (cleanMatches.length > 0) {
        cleanMatches.sort((a, b) => a.len - b.len);
        return cleanValue(String(selectedRow[cleanMatches[0].key] || '').trim());
      }

      // ── Pass 2: Match dirty keys by stripping newline suffix ──
      const dirtyMatches: { key: string; len: number }[] = [];
      for (const key of keys) {
        if (key.length > 80) continue; // still skip compound keys
        if (!key.includes('\n') && !key.includes('\r')) continue;
        
        const baseName = key.split('\n')[0].split('\r')[0].trim();
        if (!baseName) continue;
        
        if (matchesKeywords(baseName)) {
          dirtyMatches.push({ key, len: baseName.length });
        }
      }
      if (dirtyMatches.length > 0) {
        dirtyMatches.sort((a, b) => a.len - b.len);
        return cleanValue(String(selectedRow[dirtyMatches[0].key] || '').trim());
      }

      // ── Pass 3: Try explicit fallback keys (exact match) ──
      for (const fallback of fallbackKeys) {
        if (selectedRow[fallback] !== undefined) {
          return cleanValue(String(selectedRow[fallback] || '').trim());
        }
        for (const key of keys) {
          if (key.startsWith(fallback + '\n') || key.startsWith(fallback + '\r')) {
            return cleanValue(String(selectedRow[key] || '').trim());
          }
        }
      }

      return '';
    };

    // Helper: replace "No data", "null", etc. with "NA"
    const cleanValue = (val: string): string => {
      if (!val) return 'NA';
      const lower = val.toLowerCase().trim();
      if (lower === 'no data' || lower === 'null' || lower === 'undefined' || 
          lower === 'n/a' || lower === '-' || lower === '--' || lower === 'none') {
        return 'NA';
      }
      return val;
    };

    // Map each Looker Studio column to our Excel column using split keywords and exclusions
    const email = getVal(['email']);
    const vehicleCreation = getVal(['vehicle', 'creation'], ['vehicle_creation_timestamp', 'vehicle_creation_timestamp (Date)'], ['tag']);
    const lastTrip = getVal(['last', 'trip'], ['Last Trip Date', 'last_trip_date'], ['days']);
    const days = getVal(['days'], ['Days from last trip', 'days_from_last_trip'], ['email', 'creation', 'trip']);
    const tagCreation = getVal(['tag', 'creation'], ['tag_creation_timestamp'], ['vehicle']);
    const tagAddition = getVal(['tag', 'addition'], ['tag_addition_check']);

    const finalDays = days;

    // Warn if any field is NA while row exists
    if (result.status === 'success') {
      if (!vehicleCreation || vehicleCreation === 'NA') logger.warn(`[SaveResult] WARNING: Vehicle Creation is NA for ${result.vehicleNumber} — possible mapping issue`);
      if (!lastTrip || lastTrip === 'NA') logger.warn(`[SaveResult] WARNING: Last Trip Date is NA for ${result.vehicleNumber} — possible mapping issue`);
    }

    const record: Partial<VehicleRecord> = {
      vehicleNumber: result.vehicleNumber,
      email: email || 'NA',
      vehicleCreationTimestamp: vehicleCreation || 'NA',
      lastTripDate: lastTrip || 'NA',
      daysFromLastTrip: finalDays || 'NA',
      tagCreationTimestamp: tagCreation || 'NA',
      tagAdditionCheck: tagAddition || 'NA',
      ownerName: getVal(['owner'], ['owner_name']) || 'NA',
      phoneNumber: getVal(['phone'], ['phone_number']) || 'NA',
      status: result.status === 'success' ? 'Success' : result.status === 'no_eligible_record' ? 'No Eligible Record' : 'Failed',
      remarks: result.status === 'no_eligible_record' ? 'No Eligible Record - All rows have "No data"' :
               result.status === 'failed' ? `Failed: ${result.error}` : 'Data extracted successfully',
      searchStatus: result.status,
      searchTime: result.timestamp,
      searchDurationMs: result.duration,
      retryCount: result.retries,
      errorMessage: result.error || '',
      workerId: result.workerId,
      rawData: selectedRow,
      rowIndex: result.rowIndex,
    };

    db.saveResult(jobId, record);
  }

  /**
   * Emit WebSocket event
   */
  private emit(event: string, data: any): void {
    this.wsEmit?.(event, data);
  }
}

export const jobProcessor = new JobProcessor();
export default jobProcessor;
