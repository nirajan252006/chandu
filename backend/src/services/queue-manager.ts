// ============================================
// Queue Manager - In-Memory Concurrent Queue with Recheck Pass
// ============================================

import { Sema } from 'async-sema';
import { SearchResult, JobProgress, QueueConfig, LogEntry } from '../types';
import { browserManager } from '../automation/browser-manager';
import { processVehicle } from '../automation/looker-scraper';
import { now, estimateTimeRemaining, normalizeVehicleNumber } from '../utils/helpers';
import logger from '../utils/logger';
import config from '../config';

export type ProgressCallback = (progress: JobProgress) => void;
export type VehicleCompleteCallback = (result: SearchResult) => void;
export type LogCallback = (entry: LogEntry) => void;
export type ErrorCallback = (vehicleNumber: string, error: string, retryCount: number) => void;

class QueueManager {
  private semaphore: Sema | null = null;
  private isPaused = false;
  private isCancelled = false;
  private isProcessing = false;
  private jobStatus: 'idle' | 'running' | 'paused' | 'cancelling' | 'cancelled' | 'completed' | 'error' = 'idle';
  private currentJobId: string = '';
  private processed = 0;
  private total = 0;
  private successCount = 0;
  private failedCount = 0;
  private noRecordCount = 0;
  private currentVehicle = '';
  private searchTimes: number[] = [];
  private startTime = 0;
  private currentConcurrency: number;
  private maxConcurrency: number;
  private lastEmitTime = 0;

  // Retry / Recheck State
  private failedRetryQueue: { vehicle: string; attempts: number; lastError: string }[] = [];
  private pendingRetry = 0;
  private recoveredAfterRetry = 0;
  private permanentFailed = 0;
  private retryPhase = false;
  private retryCurrentVehicle = '';
  private retryAttempt = 0;
  private retryRemaining = 0;

  // Callbacks
  private onProgressCb: ProgressCallback | null = null;
  private onVehicleCompleteCb: VehicleCompleteCallback | null = null;
  private onLogCb: LogCallback | null = null;
  private onErrorCb: ErrorCallback | null = null;

  constructor() {
    this.currentConcurrency = config.queue.maxParallelTabs;
    this.maxConcurrency = config.queue.maxParallelTabs;
  }

  /**
   * Set dynamic concurrency limit
   */
  setConcurrency(concurrency: number): void {
    this.maxConcurrency = concurrency;
    this.currentConcurrency = concurrency;
  }

  /**
   * Register callback handlers
   */
  onProgress(cb: ProgressCallback): void { this.onProgressCb = cb; }
  onVehicleComplete(cb: VehicleCompleteCallback): void { this.onVehicleCompleteCb = cb; }
  onLog(cb: LogCallback): void { this.onLogCb = cb; }
  onError(cb: ErrorCallback): void { this.onErrorCb = cb; }

  /**
   * Process a list of vehicles
   */
  async processVehicles(
    jobId: string,
    vehicles: string[],
    alreadyProcessed: Set<string> = new Set()
  ): Promise<SearchResult[]> {
    this.currentJobId = jobId;
    this.isPaused = false;
    this.isCancelled = false;
    this.isProcessing = true;
    this.jobStatus = 'running';
    this.processed = 0;
    this.successCount = 0;
    this.failedCount = 0;
    this.noRecordCount = 0;
    this.searchTimes = [];
    this.startTime = Date.now();

    // Reset Retry State
    this.failedRetryQueue = [];
    this.pendingRetry = 0;
    this.recoveredAfterRetry = 0;
    this.permanentFailed = 0;
    this.retryPhase = false;
    this.retryCurrentVehicle = '';
    this.retryAttempt = 0;
    this.retryRemaining = 0;

    // Pre-normalize all input vehicles and already processed
    const normalizedVehicles = vehicles.map(v => normalizeVehicleNumber(v));
    const normalizedAlreadyProcessed = new Set([...alreadyProcessed].map(v => normalizeVehicleNumber(v)));

    // Filter out already-processed vehicles (for resume)
    const remaining = normalizedVehicles.filter(v => !normalizedAlreadyProcessed.has(v));
    this.total = remaining.length;
    this.processed = vehicles.length - remaining.length;

    // Initialize concurrency semaphore
    this.currentConcurrency = Math.min(this.maxConcurrency, remaining.length);
    this.semaphore = new Sema(this.currentConcurrency);

    this.emitLog('info', `Starting processing: ${remaining.length} vehicles, ${this.currentConcurrency} parallel workers`);

    const results: SearchResult[] = [];

    // Process all vehicles concurrently (limited by semaphore)
    const promises = remaining.map(async (vehicle) => {
      if (this.isCancelled) return;

      // Wait for pause to be lifted
      while (this.isPaused && !this.isCancelled) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (this.isCancelled) return;

      await this.semaphore!.acquire();

      if (this.isCancelled) {
        this.semaphore!.release();
        return;
      }

      try {
        this.currentVehicle = vehicle;
        this.emitProgress();

        // Get a tab from the pool
        const { page, workerId } = await browserManager.getAvailableTab();

        let result: SearchResult;

        try {
          // Process once (no inline backoff retries - handle all retries in recheck pass)
          result = await processVehicle(page, vehicle, workerId);
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          result = {
            vehicleNumber: vehicle,
            status: 'failed',
            data: null,
            error: errMsg,
            duration: 0,
            retries: 0,
            workerId,
            timestamp: now(),
          };

          // Check if tab is still valid
          const isValid = await browserManager.isPageValid(page);
          if (!isValid) {
            logger.warn(`Tab ${workerId} is invalid, replacing...`);
            const newPage = await browserManager.replaceTab(page);
            browserManager.releaseTab(newPage);
          }
        } finally {
          // Release the tab back to pool
          browserManager.releaseTab(page);
        }

        // Update counters and results
        this.processed++;
        
        if (result.status === 'success') {
          this.successCount++;
        } else if (result.status === 'no_eligible_record') {
          this.noRecordCount++;
        } else {
          // It failed. Increment failedCount (showing in UI stats) and mark as pending retry.
          this.failedCount++;
          this.pendingRetry++;
          this.failedRetryQueue.push({
            vehicle: vehicle,
            attempts: 1, // 1st attempt finished
            lastError: result.error || 'Failed'
          });
        }

        // Track search time for ETA calculation — capped at 20 entries (O(20) forever)
        if (result.duration > 0) {
          this.searchTimes.push(result.duration);
          if (this.searchTimes.length > 20) this.searchTimes.shift();
        }

        // Auto-throttle: if recent searches are slow, reduce concurrency
        if (config.queue.autoThrottle) {
          this.autoThrottle();
        }

        // Emit events — progress is throttled, no need to call twice per vehicle
        this.onVehicleCompleteCb?.(result);
        this.emitLog(
          result.status === 'failed' ? 'error' : 'success',
          `${vehicle}: ${result.status} (${result.duration}ms)`,
          vehicle,
          result.workerId
        );
        this.emitProgress(); // throttled internally — safe to call here

        results.push(result);
      } finally {
        this.semaphore!.release();
      }
    });

    await Promise.allSettled(promises);

    // ============================================
    // AUTOMATIC FAILED VEHICLES RECHECK PASS
    // ============================================
    if (this.failedRetryQueue.length > 0 && !this.isCancelled) {
      this.retryPhase = true;
      this.retryRemaining = this.failedRetryQueue.length;
      this.emitLog('info', `Starting Recheck Pass for ${this.failedRetryQueue.length} failed vehicles...`);

      // Sequentially process failed retry queue
      while (this.failedRetryQueue.length > 0 && !this.isCancelled) {
        // Wait for pause to be lifted
        while (this.isPaused && !this.isCancelled) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        if (this.isCancelled) break;

        const currentRetry = this.failedRetryQueue.shift()!;
        this.retryCurrentVehicle = currentRetry.vehicle;
        this.retryAttempt = currentRetry.attempts + 1; // 2nd or 3rd attempt
        this.retryRemaining = this.failedRetryQueue.length + 1; // remaining including current
        this.emitProgress();

        this.emitLog('info', `Rechecking failed vehicle ${this.retryCurrentVehicle} - Attempt ${this.retryAttempt}/3`);

        // Get a tab from the pool (runs sequentially on first available worker/tab)
        const { page, workerId } = await browserManager.getAvailableTab();

        try {
          // Verify browser is still alive
          let isValid = await browserManager.isPageValid(page);
          if (!isValid) {
            logger.warn(`Tab ${workerId} is invalid during retry, replacing...`);
            const newPage = await browserManager.replaceTab(page);
            browserManager.releaseTab(newPage);
            // Wait brief moment and recheck
            continue;
          }

          let result = await processVehicle(page, this.retryCurrentVehicle, workerId);

          // Evaluate recheck result
          if (result.status === 'success') {
            // Recovered to Success!
            this.recoveredAfterRetry++;
            this.successCount++;
            this.failedCount = Math.max(0, this.failedCount - 1);
            this.pendingRetry = Math.max(0, this.pendingRetry - 1);

            result.retries = this.retryAttempt - 1; // Number of retries made
            this.onVehicleCompleteCb?.(result);
            this.emitLog('success', `Recovered vehicle ${this.retryCurrentVehicle} to SUCCESS on attempt ${this.retryAttempt}/3 (${result.duration}ms)`);
            
            // Replace result in final array
            const idx = results.findIndex(r => r.vehicleNumber === this.retryCurrentVehicle);
            if (idx !== -1) results[idx] = result;
          } else if (result.status === 'no_eligible_record') {
            // Recovered to No Record!
            this.recoveredAfterRetry++;
            this.noRecordCount++;
            this.failedCount = Math.max(0, this.failedCount - 1);
            this.pendingRetry = Math.max(0, this.pendingRetry - 1);

            result.retries = this.retryAttempt - 1;
            this.onVehicleCompleteCb?.(result);
            this.emitLog('success', `Recovered vehicle ${this.retryCurrentVehicle} to NO RECORD on attempt ${this.retryAttempt}/3 (${result.duration}ms)`);

            const idx = results.findIndex(r => r.vehicleNumber === this.retryCurrentVehicle);
            if (idx !== -1) results[idx] = result;
          } else {
            // Failed again
            if (this.retryAttempt < 3) {
              // Re-queue for attempt 3
              this.failedRetryQueue.push({
                vehicle: this.retryCurrentVehicle,
                attempts: this.retryAttempt,
                lastError: result.error || 'Failed'
              });
              this.emitLog('warn', `Vehicle ${this.retryCurrentVehicle} failed on attempt ${this.retryAttempt}/3. Re-queued for next recheck.`);
            } else {
              // Permanently failed after 3 attempts
              this.permanentFailed++;
              this.pendingRetry = Math.max(0, this.pendingRetry - 1);

              result.retries = 2; // failed all 3 attempts (attempt 1, 2, 3)
              this.onVehicleCompleteCb?.(result);
              this.emitLog('error', `Vehicle ${this.retryCurrentVehicle} permanently failed after 3 attempts: ${result.error}`);

              const idx = results.findIndex(r => r.vehicleNumber === this.retryCurrentVehicle);
              if (idx !== -1) results[idx] = result;
            }
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          logger.error(`Error during recheck of ${this.retryCurrentVehicle}: ${errMsg}`);
          if (this.retryAttempt < 3) {
            this.failedRetryQueue.push({
              vehicle: this.retryCurrentVehicle,
              attempts: this.retryAttempt,
              lastError: errMsg
            });
          } else {
            this.permanentFailed++;
            this.pendingRetry = Math.max(0, this.pendingRetry - 1);
            const failResult: SearchResult = {
              vehicleNumber: this.retryCurrentVehicle,
              status: 'failed',
              data: null,
              error: errMsg,
              duration: 0,
              retries: 2,
              workerId,
              timestamp: now()
            };
            this.onVehicleCompleteCb?.(failResult);
            const idx = results.findIndex(r => r.vehicleNumber === this.retryCurrentVehicle);
            if (idx !== -1) results[idx] = failResult;
          }
        } finally {
          browserManager.releaseTab(page);
        }

        this.retryRemaining = this.failedRetryQueue.length;
        this.emitProgress();
      }

      this.retryPhase = false;
      this.retryCurrentVehicle = '';
      this.retryAttempt = 0;
      this.retryRemaining = 0;
      this.emitProgress(true);
    }

    this.isProcessing = false;
    this.jobStatus = this.isCancelled ? 'cancelled' : 'completed';
    this.emitProgress(true);
    this.emitLog('info', `Processing complete: ${this.successCount} success, ${this.failedCount} failed (${this.permanentFailed} permanent), ${this.noRecordCount} no record`);

    return results;
  }

  /**
   * Auto-throttle: adjust concurrency based on response times
   */
  private autoThrottle(): void {
    if (this.searchTimes.length < 5) return;

    // Calculate average of last 5 searches
    const recent = this.searchTimes.slice(-5);
    const avgTime = recent.reduce((a, b) => a + b, 0) / recent.length;

    if (avgTime > config.queue.throttleThresholdMs && this.currentConcurrency > 1) {
      this.currentConcurrency--;
      logger.info(`Auto-throttle: reducing concurrency to ${this.currentConcurrency} (avg: ${Math.round(avgTime)}ms)`);
    } else if (avgTime < config.queue.throttleThresholdMs * 0.5 && this.currentConcurrency < this.maxConcurrency) {
      this.currentConcurrency++;
      logger.info(`Auto-throttle: increasing concurrency to ${this.currentConcurrency} (avg: ${Math.round(avgTime)}ms)`);
    }
  }

  /**
   * Pause processing
   */
  pause(): void {
    this.isPaused = true;
    this.jobStatus = 'paused';
    this.emitLog('info', 'Processing paused');
    this.emitProgress(true);
  }

  /**
   * Resume processing
   */
  resume(): void {
    this.isPaused = false;
    this.jobStatus = 'running';
    this.emitLog('info', 'Processing resumed');
    this.emitProgress(true);
  }

  /**
   * Cancel processing
   */
  cancel(): void {
    this.isCancelled = true;
    this.jobStatus = 'cancelling';
    this.emitLog('info', 'Processing cancelling...');
    this.emitProgress(true);
  }

  /**
   * Set job status to error
   */
  setError(): void {
    this.jobStatus = 'error';
    this.isProcessing = false;
    this.emitProgress(true);
  }

  /**
   * Get current job status
   */
  getStatus(): string {
    return this.jobStatus;
  }

  /**
   * Get current progress
   */
  getProgress(): JobProgress {
    const avgTime = this.searchTimes.length > 0
      ? this.searchTimes.reduce((a, b) => a + b, 0) / this.searchTimes.length
      : 0;

    const elapsedMs = Date.now() - this.startTime;
    const speed = this.processed > 0 ? (this.processed / (elapsedMs / 60000)) : 0;

    return {
      jobId: this.currentJobId,
      status: this.jobStatus,
      total: this.total,
      processed: this.processed,
      success: this.successCount,
      failed: this.failedCount,
      noRecord: this.noRecordCount,
      remaining: this.total - this.processed,
      progressPercent: this.total > 0 ? Math.round((this.processed / this.total) * 100) : 0,
      currentVehicle: this.currentVehicle,
      estimatedTimeMs: this.total * avgTime,
      remainingTimeMs: estimateTimeRemaining(this.processed, this.total, avgTime),
      averageSearchTimeMs: Math.round(avgTime),
      currentSpeed: Math.round(speed * 10) / 10,
      activeWorkers: this.currentConcurrency,

      // Retry fields
      pendingRetry: this.pendingRetry,
      recoveredAfterRetry: this.recoveredAfterRetry,
      permanentFailed: this.permanentFailed,
      retryPhase: this.retryPhase,
      retryCurrentVehicle: this.retryCurrentVehicle,
      retryAttempt: this.retryAttempt,
      retryRemaining: this.retryRemaining
    };
  }

  /**
   * Check status flags
   */
  get paused(): boolean { return this.isPaused; }
  get cancelled(): boolean { return this.isCancelled; }
  get processing(): boolean { return this.isProcessing; }

  /**
   * Emit progress update
   */
  private emitProgress(force = false): void {
    const nowTime = Date.now();
    // 300ms throttle: fast enough for real-time feel, slow enough not to flood React
    if (force || nowTime - this.lastEmitTime >= 300) {
      this.lastEmitTime = nowTime;
      this.onProgressCb?.(this.getProgress());
    }
  }

  /**
   * Emit log entry
   */
  private emitLog(
    level: LogEntry['level'],
    message: string,
    vehicleNumber?: string,
    workerId?: number
  ): void {
    const entry: LogEntry = {
      jobId: this.currentJobId,
      timestamp: now(),
      level,
      message,
      vehicleNumber,
      workerId,
    };
    this.onLogCb?.(entry);
  }
}

export const queueManager = new QueueManager();
export default queueManager;
