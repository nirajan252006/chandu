// ============================================
// WebSocket Hook — with 200ms batching
// ============================================

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAppStore } from '../stores/useAppStore';
import type { SearchResult, LogEntry } from '../types';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const BATCH_INTERVAL_MS = 200; // flush UI updates every 200ms

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);

  // Batching buffers (live outside React state — no re-renders)
  const pendingResults = useRef<SearchResult[]>([]);
  const pendingLogs = useRef<LogEntry[]>([]);
  const batchTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    setConnected,
    setProgress,
    batchAddLogs,
    batchAddResults,
    setSummary,
    setCurrentJob,
  } = useAppStore();

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    // ── Flush batched updates to store every 200ms ──────────────────────────
    batchTimer.current = setInterval(() => {
      const store = useAppStore.getState();

      if (pendingResults.current.length > 0) {
        const batch = pendingResults.current.splice(0); // drain buffer
        store.batchAddResults(batch);
      }

      if (pendingLogs.current.length > 0) {
        const batch = pendingLogs.current.splice(0); // drain buffer
        store.batchAddLogs(batch);
      }
    }, BATCH_INTERVAL_MS);

    // ── Connection ──────────────────────────────────────────────────────────
    socket.on('connect', () => {
      console.log('🔌 WebSocket connected');
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('🔌 WebSocket disconnected');
      setConnected(false);
    });

    // ── Job status ──────────────────────────────────────────────────────────
    socket.on('job:status', (data) => {
      const { setJobStatus, setJobError } = useAppStore.getState();
      setJobStatus(data.status);
      if (data.status === 'error' && data.error) {
        setJobError(data.error);
      }
    });

    // ── Progress — single handler (job:stats removed — it was a duplicate) ──
    socket.on('job:progress', (data) => {
      setProgress(data);
    });

    // ── Vehicle complete — buffered, flushed every 200ms ───────────────────
    socket.on('job:vehicle-complete', (data: SearchResult) => {
      pendingResults.current.push(data);
    });

    // ── Log entries — buffered, flushed every 200ms ────────────────────────
    socket.on('job:log', (data: LogEntry) => {
      pendingLogs.current.push(data);
    });

    // ── Auto export ─────────────────────────────────────────────────────────
    socket.on('job:auto-export', async (data) => {
      const state = useAppStore.getState();
      if (state.autoExportTriggeredForJobId === data.jobId) {
        return;
      }
      state.setAutoExportTriggered(data.jobId);

      try {
        console.log(`Auto-downloading report for job ${data.jobId}...`);
        const response = await fetch(`/api/export/${data.jobId}/excel`);
        if (!response.ok) throw new Error('Download failed');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        const cd = response.headers.get('Content-Disposition');
        const filenameMatch = cd?.match(/filename="?([^"]+)"?/);
        const filename = filenameMatch ? filenameMatch[1] : `Vehicle_Report_${data.jobId}.xlsx`;

        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Auto-export download failed:', err);
      }
    });

    // ── Job complete ────────────────────────────────────────────────────────
    socket.on('job:complete', (data) => {
      // Flush any remaining buffered results/logs before recording completion
      const store = useAppStore.getState();
      if (pendingResults.current.length > 0) {
        store.batchAddResults(pendingResults.current.splice(0));
      }
      if (pendingLogs.current.length > 0) {
        store.batchAddLogs(pendingLogs.current.splice(0));
      }

      if (data.summary) {
        setSummary(data.summary);
      }
      store.batchAddLogs([{
        jobId: data.jobId,
        timestamp: new Date().toISOString(),
        level: 'success',
        message: '🎉 Job completed!',
      }]);
    });

    // ── Job error ───────────────────────────────────────────────────────────
    socket.on('job:error', (data) => {
      pendingLogs.current.push({
        jobId: '',
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `Error: ${data.vehicleNumber} - ${data.error} (retry ${data.retryCount})`,
        vehicleNumber: data.vehicleNumber,
      });
    });

    return () => {
      if (batchTimer.current) clearInterval(batchTimer.current);
      pendingResults.current = [];
      pendingLogs.current = [];
      socket.disconnect();
    };
  }, []);

  return socketRef.current;
}

export default useSocket;
