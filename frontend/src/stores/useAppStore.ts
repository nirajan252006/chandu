// ============================================
// Zustand Store - Application State
// ============================================

import { create } from 'zustand';
import { Job, JobProgress, LogEntry, ParseResult, TabView, SearchResult, JobSummary } from '../types';

interface AppState {
  // UI
  activeTab: TabView;
  darkMode: boolean;
  setActiveTab: (tab: TabView) => void;
  toggleDarkMode: () => void;

  // Upload
  currentJobId: string | null;
  currentJob: Job | null;
  parseResult: ParseResult | null;
  setUploadResult: (jobId: string, parseResult: ParseResult) => void;
  setCurrentJob: (job: Job | null) => void;

  // Processing
  progress: JobProgress | null;
  jobStatus: string;
  jobError: string | null;
  autoExportTriggeredForJobId: string | null;
  showCancelModal: boolean;
  setProgress: (progress: JobProgress) => void;
  setJobStatus: (status: string) => void;
  setJobError: (error: string | null) => void;
  setAutoExportTriggered: (jobId: string) => void;
  setShowCancelModal: (show: boolean) => void;

  // Logs — capped at 150 for render performance
  logs: LogEntry[];
  addLog: (entry: LogEntry) => void;
  batchAddLogs: (entries: LogEntry[]) => void;
  clearLogs: () => void;

  // Results — O(1) updates via companion index map
  results: SearchResult[];
  resultIndex: Map<string, number>; // vehicleNumber -> index in results[]
  addResult: (result: SearchResult) => void;
  updateResult: (result: SearchResult) => void;
  batchAddResults: (results: SearchResult[]) => void;
  clearResults: () => void;

  // Summary
  summary: JobSummary | null;
  setSummary: (summary: JobSummary | null) => void;

  // Connection
  isConnected: boolean;
  setConnected: (connected: boolean) => void;

  // Reset
  reset: () => void;
}

const MAX_LOGS = 150;

export const useAppStore = create<AppState>((set, get) => ({
  // UI
  activeTab: 'home',
  darkMode: true,
  setActiveTab: (tab) => set({ activeTab: tab }),
  toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),

  // Upload
  currentJobId: null,
  currentJob: null,
  parseResult: null,
  setUploadResult: (jobId, parseResult) => set({ currentJobId: jobId, parseResult, activeTab: 'process' }),
  setCurrentJob: (job) => set({ currentJob: job }),

  // Processing
  progress: null,
  jobStatus: 'idle',
  jobError: null,
  autoExportTriggeredForJobId: null,
  showCancelModal: false,
  setProgress: (progress) => {
    const updates: Partial<AppState> = { progress };
    if (progress.status) {
      updates.jobStatus = progress.status;
    }
    set(updates);
  },
  setJobStatus: (jobStatus) => set({ jobStatus }),
  setJobError: (jobError) => set({ jobError }),
  setAutoExportTriggered: (jobId) => set({ autoExportTriggeredForJobId: jobId }),
  setShowCancelModal: (showCancelModal) => set({ showCancelModal }),

  // Logs — capped at MAX_LOGS for render performance
  logs: [],
  addLog: (entry) => set((s) => {
    const logs = s.logs.length >= MAX_LOGS
      ? [...s.logs.slice(-(MAX_LOGS - 1)), entry]
      : [...s.logs, entry];
    return { logs };
  }),
  batchAddLogs: (entries) => set((s) => {
    const combined = [...s.logs, ...entries];
    return { logs: combined.length > MAX_LOGS ? combined.slice(-MAX_LOGS) : combined };
  }),
  clearLogs: () => set({ logs: [] }),

  // Results — O(1) updates via resultIndex map
  results: [],
  resultIndex: new Map(),

  addResult: (result) => set((s) => {
    const key = result.rowIndex !== undefined ? `${result.vehicleNumber}_${result.rowIndex}` : result.vehicleNumber;
    const idx = s.resultIndex.get(key);
    if (idx !== undefined) {
      // Already exists — update in place (O(1))
      const newResults = [...s.results];
      newResults[idx] = result;
      return { results: newResults };
    }
    // New result — append
    const newIndex = new Map(s.resultIndex);
    newIndex.set(key, s.results.length);
    return {
      results: [...s.results, result],
      resultIndex: newIndex,
    };
  }),

  updateResult: (result) => set((s) => {
    const key = result.rowIndex !== undefined ? `${result.vehicleNumber}_${result.rowIndex}` : result.vehicleNumber;
    const idx = s.resultIndex.get(key);
    if (idx !== undefined) {
      // O(1) update — no array scan needed
      const newResults = [...s.results];
      newResults[idx] = result;
      return { results: newResults };
    }
    // Vehicle not seen yet — append
    const newIndex = new Map(s.resultIndex);
    newIndex.set(key, s.results.length);
    return {
      results: [...s.results, result],
      resultIndex: newIndex,
    };
  }),

  batchAddResults: (newResults) => set((s) => {
    if (newResults.length === 0) return {};

    const updatedResults = [...s.results];
    const updatedIndex = new Map(s.resultIndex);

    for (const result of newResults) {
      const key = result.rowIndex !== undefined ? `${result.vehicleNumber}_${result.rowIndex}` : result.vehicleNumber;
      const idx = updatedIndex.get(key);
      if (idx !== undefined) {
        updatedResults[idx] = result;
      } else {
        updatedIndex.set(key, updatedResults.length);
        updatedResults.push(result);
      }
    }

    return { results: updatedResults, resultIndex: updatedIndex };
  }),

  clearResults: () => set({ results: [], resultIndex: new Map() }),

  // Summary
  summary: null,
  setSummary: (summary) => set({ summary }),

  // Connection
  isConnected: false,
  setConnected: (connected) => set({ isConnected: connected }),

  // Reset
  reset: () => set({
    currentJobId: null,
    currentJob: null,
    parseResult: null,
    progress: null,
    jobStatus: 'idle',
    jobError: null,
    autoExportTriggeredForJobId: null,
    showCancelModal: false,
    logs: [],
    results: [],
    resultIndex: new Map(),
    summary: null,
    activeTab: 'home',
  }),
}));

export default useAppStore;
