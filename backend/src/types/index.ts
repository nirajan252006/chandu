// ============================================
// Vehicle Data Retriever Pro - Shared Types
// ============================================

export interface VehicleRecord {
  vehicleNumber: string;
  email: string;
  vehicleCreationTimestamp: string;
  lastTripDate: string;
  daysFromLastTrip: string;
  tagCreationTimestamp: string;
  tagAdditionCheck: string;
  ownerName: string;
  phoneNumber: string;
  status: string;
  remarks: string;
  searchStatus: SearchStatus;
  searchTime: string;
  searchDurationMs: number;
  retryCount: number;
  errorMessage: string;
  workerId: number;
  rawData: Record<string, string>;
  rowIndex?: number;
}

export type SearchStatus = 'success' | 'no_eligible_record' | 'failed' | 'timeout' | 'pending' | 'processing';

export type JobStatus = 'idle' | 'running' | 'pending' | 'processing' | 'paused' | 'completed' | 'cancelled' | 'failed' | 'error' | 'cancelling';

export interface Job {
  id: string;
  filename: string;
  totalVehicles: number;
  uniqueVehicles: number;
  status: JobStatus;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  progress: number;
  successCount: number;
  failedCount: number;
  noRecordCount: number;
}

export interface JobProgress {
  jobId: string;
  status: JobStatus;
  total: number;
  processed: number;
  success: number;
  failed: number;
  noRecord: number;
  remaining: number;
  progressPercent: number;
  currentVehicle: string;
  estimatedTimeMs: number;
  remainingTimeMs: number;
  averageSearchTimeMs: number;
  currentSpeed: number; // vehicles per minute
  activeWorkers: number;
  pendingRetry: number;
  recoveredAfterRetry: number;
  permanentFailed: number;
  retryPhase: boolean;
  retryCurrentVehicle: string;
  retryAttempt: number;
  retryRemaining: number;
}

export interface VehicleInfo {
  rowIndex: number;
  vehicleNumber: string;
}

export interface ParseResult {
  total: number;
  unique: number;
  duplicatesRemoved: number;
  invalidFormat: number;
  blankRows: number;
  vehicles: VehicleInfo[];
  errors: string[];
}

export interface LookerRow {
  [key: string]: string;
}

export interface FilterResult {
  status: 'success' | 'no_eligible_record';
  selectedRow: LookerRow | null;
  totalRows: number;
  validRows: number;
  minDaysFromLastTrip: number | null;
}

export interface SearchResult {
  vehicleNumber: string;
  status: SearchStatus;
  data: FilterResult | null;
  error: string | null;
  duration: number;
  retries: number;
  workerId: number;
  timestamp: string;
  rowIndex?: number;
}

export interface QueueConfig {
  maxParallelTabs: number;
  pageLoadTimeout: number;
  searchTimeout: number;
  maxRetries: number;
  retryDelayBase: number;
  throttleThresholdMs: number;
  autoThrottle: boolean;
}

export interface BrowserConfig {
  userDataDir: string;
  profile: string;
  headless: boolean;
  slowMo: number;
  reportUrl: string;
}

export interface LogEntry {
  id?: number;
  jobId: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug' | 'success';
  message: string;
  vehicleNumber?: string;
  durationMs?: number;
  workerId?: number;
  metadata?: Record<string, unknown>;
}

export interface ExportOptions {
  format: 'excel' | 'csv' | 'json';
  includeRawData: boolean;
  includeSummary: boolean;
  includeCharts: boolean;
}

export interface AppConfig {
  port: number;
  frontendUrl: string;
  lookerReportUrl: string;
  browser: BrowserConfig;
  queue: QueueConfig;
  dbPath: string;
  uploadDir: string;
  exportDir: string;
  logDir: string;
  maxUploadSize: number;
}

// WebSocket event types
export interface WSEvents {
  'job:progress': JobProgress;
  'job:vehicle-complete': SearchResult;
  'job:stats': JobProgress;
  'job:log': LogEntry;
  'job:complete': { jobId: string; summary: JobSummary };
  'job:error': { vehicleNumber: string; error: string; retryCount: number };
  'browser:status': { status: string; activeWorkers: number };
}

export interface JobSummary {
  jobId: string;
  totalVehicles: number;
  successCount: number;
  failedCount: number;
  noRecordCount: number;
  averageDaysFromLastTrip: number;
  averageSearchTimeMs: number;
  totalProcessingTimeMs: number;
  startTime: string;
  endTime: string;
  successRate: number;
}
