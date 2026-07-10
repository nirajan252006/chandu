// ============================================
// Frontend Types
// ============================================

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

export type JobStatus = 'pending' | 'processing' | 'paused' | 'completed' | 'cancelled' | 'failed';
export type SearchStatus = 'success' | 'no_eligible_record' | 'failed' | 'timeout' | 'pending' | 'processing';
export type TabView = 'home' | 'process' | 'export';

export interface ParseResult {
  total: number;
  unique: number;
  duplicatesRemoved: number;
  invalidFormat: number;
  blankRows: number;
  vehicles: string[];
  errors: string[];
}

export interface JobProgress {
  jobId: string;
  status?: string;
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
  currentSpeed: number;
  activeWorkers: number;
  pendingRetry: number;
  recoveredAfterRetry: number;
  permanentFailed: number;
  retryPhase: boolean;
  retryCurrentVehicle: string;
  retryAttempt: number;
  retryRemaining: number;
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
}

export interface SearchResult {
  vehicleNumber: string;
  status: SearchStatus;
  data: any;
  error: string | null;
  duration: number;
  retries: number;
  workerId: number;
  timestamp: string;
}

export interface UploadResponse {
  success: boolean;
  jobId: string;
  filename: string;
  parseResult: ParseResult;
}

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

export interface JobStatusEvent {
  jobId: string;
  status: string;
  error?: string;
}

export interface AutoExportEvent {
  jobId: string;
  status: string;
  totalProcessed: number;
  totalVehicles: number;
}
