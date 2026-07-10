// ============================================
// Control Bar - Start/Pause/Resume/Cancel/Retry
// ============================================

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Square, RotateCcw, Loader2, Cpu, Download } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

export default function ControlBar() {
  const { currentJobId, jobStatus, jobError, progress, reset, setShowCancelModal } = useAppStore();
  const [loading, setLoading] = useState<string | null>(null);
  const [concurrency, setConcurrency] = useState<number>(6); // Default to 6 workers

  const handleAction = async (action: string) => {
    if (!currentJobId) return;
    setLoading(action);

    try {
      const options: RequestInit = { method: 'POST' };
      if (action === 'start') {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify({ concurrency });
      }
      await fetch(`/api/jobs/${currentJobId}/${action}`, options);
    } catch (error) {
      console.error(`Action ${action} failed:`, error);
    } finally {
      setLoading(null);
    }
  };

  const handleDownload = async () => {
    if (!currentJobId) return;
    setLoading('download');
    try {
      const response = await fetch(`/api/export/${currentJobId}/excel`);
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const cd = response.headers.get('Content-Disposition');
      const filenameMatch = cd?.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch ? filenameMatch[1] : `Vehicle_Report_${currentJobId}.xlsx`;
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setLoading(null);
    }
  };

  if (!currentJobId) return null;

  const showSlider = jobStatus === 'idle' || jobStatus === 'error';
  const showStart = jobStatus === 'idle';
  const showPause = jobStatus === 'running';
  const showResume = jobStatus === 'paused';
  const showCancel = jobStatus === 'running' || jobStatus === 'paused';
  const showStopping = jobStatus === 'cancelling';
  const showCompleted = jobStatus === 'completed' || jobStatus === 'cancelled';
  const showRetry = jobStatus === 'error';
  const showInitializing = jobStatus === 'initializing';

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-950/30 p-6 border border-indigo-500/10 rounded-2xl max-w-7xl mx-auto w-full backdrop-blur-md relative overflow-hidden"
    >
      {/* Subtle border top glow overlay */}
      <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent" />

      {/* Worker Count Configurator */}
      {showSlider && (
        <div className="flex flex-grow items-center justify-between gap-3 w-full md:w-auto bg-indigo-950/10 px-4 py-2.5 border border-indigo-500/10 rounded-xl">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span className="text-[13px] font-bold text-slate-300 tracking-wide uppercase font-caption" style={{ fontFamily: 'Orbitron' }}>
              Workers
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="1"
              max="10"
              value={concurrency}
              onChange={(e) => setConcurrency(parseInt(e.target.value, 10))}
              className="w-24 sm:w-28 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              aria-label="Set parallel worker thread count"
            />
            <span className="text-xs font-black text-cyan-400 font-mono w-4 text-center bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/20">
              {concurrency}
            </span>
          </div>
        </div>
      )}

      {/* Initializing State Banner */}
      {showInitializing && (
        <div className="flex flex-grow items-center justify-center gap-3 py-2 text-cyan-400 font-bold text-xs uppercase font-display" style={{ fontFamily: 'Orbitron' }}>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>INITIALIZING BROWSER AUTOMATION ENGINE...</span>
        </div>
      )}

      {/* Stopping State Banner */}
      {showStopping && (
        <div className="flex flex-grow items-center justify-center gap-3 py-2 text-rose-500 font-bold text-xs uppercase font-display" style={{ fontFamily: 'Orbitron' }}>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>STOPPING ENGINE & WRITING EXCEL...</span>
        </div>
      )}

      {/* Action Buttons Wrapper */}
      <div className="flex flex-wrap items-center justify-center gap-3 w-full md:w-auto">
        {/* Start */}
        {showStart && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleAction('start')}
            disabled={loading !== null}
            className="cyber-button flex items-center gap-2 px-6 min-h-[48px] w-full sm:w-auto font-bold tracking-wider"
          >
            {loading === 'start' ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Play className="w-4 h-4 text-white" />
            )}
            <span className="flex items-center gap-1.5">
              START
              <kbd className="hidden sm:inline-block text-[9px] px-1 py-0.5 rounded bg-white/20 font-bold border border-white/10">↵</kbd>
            </span>
          </motion.button>
        )}

        {/* Retry Initialization (Error state) */}
        {showRetry && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleAction('start')}
            disabled={loading !== null}
            className="cyber-button flex items-center gap-2 px-6 min-h-[48px] w-full sm:w-auto font-bold tracking-wider"
            style={{ background: 'linear-gradient(135deg, #a855f7, #6366f1)', boxShadow: '0 0 15px rgba(168, 85, 247, 0.25)' }}
          >
            {loading === 'start' ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Play className="w-4 h-4 text-white" />
            )}
            <span>RETRY INITIALIZATION</span>
          </motion.button>
        )}

        {/* Pause */}
        {showPause && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleAction('pause')}
            disabled={loading !== null}
            className="cyber-button flex items-center gap-2 px-6 min-h-[48px] w-full sm:w-auto font-bold tracking-wider"
            style={{ background: 'linear-gradient(135deg, #fbbf24, #fb923c)', boxShadow: '0 0 15px rgba(251, 191, 36, 0.25)' }}
          >
            {loading === 'pause' ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Pause className="w-4 h-4 text-white" />
            )}
            <span className="flex items-center gap-1.5">
              PAUSE
              <kbd className="hidden sm:inline-block text-[9px] px-1 py-0.5 rounded bg-white/20 font-bold border border-white/10">space</kbd>
            </span>
          </motion.button>
        )}

        {/* Resume */}
        {showResume && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleAction('resume')}
            disabled={loading !== null}
            className="cyber-button flex items-center gap-2 px-6 min-h-[48px] w-full sm:w-auto font-bold tracking-wider"
            style={{ background: 'linear-gradient(135deg, #34d399, #38bdf8)', boxShadow: '0 0 15px rgba(52, 211, 153, 0.25)' }}
          >
            {loading === 'resume' ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Play className="w-4 h-4 text-white" />
            )}
            <span className="flex items-center gap-1.5">
              RESUME
              <kbd className="hidden sm:inline-block text-[9px] px-1 py-0.5 rounded bg-white/20 font-bold border border-white/10">space</kbd>
            </span>
          </motion.button>
        )}

        {/* Cancel */}
        {showCancel && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCancelModal(true)}
            disabled={loading !== null}
            className="cyber-button flex items-center gap-2 px-6 min-h-[48px] w-full sm:w-auto font-bold tracking-wider"
            style={{ background: 'linear-gradient(135deg, #f87171, #fb923c)', boxShadow: '0 0 15px rgba(248, 113, 113, 0.25)' }}
          >
            <Square className="w-4 h-4 text-white" />
            <span className="flex items-center gap-1.5">
              CANCEL
              <kbd className="hidden sm:inline-block text-[9px] px-1.5 py-0.5 rounded bg-white/20 font-bold border border-white/10">esc</kbd>
            </span>
          </motion.button>
        )}

        {/* Completed States buttons */}
        {showCompleted && (
          <>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleDownload}
              disabled={loading !== null}
              className="cyber-button flex items-center gap-2 px-6 py-2.5 w-full sm:w-auto font-bold tracking-wider"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 0 15px rgba(16, 185, 129, 0.25)' }}
            >
              {loading === 'download' ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Download className="w-4 h-4 text-white" />
              )}
              <span>DOWNLOAD EXCEL</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={reset}
              disabled={loading !== null}
              className="cyber-button flex items-center gap-2 px-6 py-2.5 w-full sm:w-auto font-bold tracking-wider"
            >
              <RotateCcw className="w-4 h-4 text-white" />
              <span>NEW JOB</span>
            </motion.button>
          </>
        )}

        {/* New Job (only for error/completed) */}
        {showRetry && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={reset}
            disabled={loading !== null}
            className="cyber-button flex items-center gap-2 px-6 py-2.5 w-full sm:w-auto font-bold tracking-wider"
          >
            <RotateCcw className="w-4 h-4 text-white" />
            <span>NEW RUN</span>
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
