// ============================================
// Live Logs - Real-time Log Feed
// ============================================

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Search, Copy, Download, Trash2, ArrowDown } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { toast } from 'react-hot-toast';

const levelColors: Record<string, string> = {
  info: '#38bdf8',
  success: '#34d399',
  warn: '#fbbf24',
  error: '#f87171',
  debug: '#94a3b8',
};

const levelBg: Record<string, string> = {
  info:    'rgba(56, 189, 248, 0.04)',
  success: 'rgba(52, 211, 153, 0.04)',
  warn:    'rgba(251, 191, 36, 0.04)',
  error:   'rgba(248, 113, 113, 0.05)',
  debug:   'rgba(148, 163, 184, 0.03)',
};

export default function LiveLogs() {
  const { logs, clearLogs } = useAppStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);

  // Smart auto-scroll: detect if the user has scrolled up; if so, pause auto-scroll.
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    setAutoScroll(atBottom);
  }, []);

  // Auto-scroll to bottom only when enabled
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length, autoScroll]);

  // Manual scroll-to-bottom click
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    setAutoScroll(true);
  };

  // Copy logs as formatted text
  const handleCopyLogs = () => {
    if (logs.length === 0) {
      toast.error('No logs available to copy');
      return;
    }
    const text = filteredLogs
      .map(log => `[${new Date(log.timestamp).toLocaleTimeString()}] [${log.level.toUpperCase()}] ${log.message}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    toast.success('Logs copied to clipboard!', {
      style: { background: '#0a0a1f', color: '#f1f1ff', border: '1px solid rgba(99, 102, 241, 0.25)' },
    });
  };

  // Download logs as .txt file
  const handleDownloadLogs = () => {
    if (logs.length === 0) {
      toast.error('No logs available to download');
      return;
    }
    const text = filteredLogs
      .map(log => `[${new Date(log.timestamp).toLocaleTimeString()}] [${log.level.toUpperCase()}] ${log.message}`)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `VDR_processing_logs_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Logs downloaded successfully!', {
      style: { background: '#0a0a1f', color: '#f1f1ff', border: '1px solid rgba(99, 102, 241, 0.25)' },
    });
  };

  // Filter logs by search query
  const filteredLogs = logs.filter(log => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      log.message.toLowerCase().includes(query) ||
      log.level.toLowerCase().includes(query) ||
      (log.vehicleNumber && log.vehicleNumber.toLowerCase().includes(query))
    );
  });

  return (
    <div
      className="glass p-6 flex flex-col max-w-7xl mx-auto w-full relative border-indigo-500/10 shadow-xl rounded-2xl"
      style={{ resize: 'vertical', overflow: 'hidden', minHeight: '340px', maxHeight: '800px', height: '520px' }}
    >
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-slate-900/80 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <Terminal className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <span className="text-[15px] font-bold text-slate-200 tracking-wider uppercase font-card-title" style={{ fontFamily: 'Orbitron' }}>
              Live Logs
            </span>
            <span className="badge badge-info bg-indigo-500/5 text-indigo-400 border-indigo-500/15 py-0.5 px-2.5 text-[10px] font-bold ml-2.5">
              {filteredLogs.length}
            </span>
          </div>
        </div>

        {/* Search bar + controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-52 flex-grow sm:flex-grow-0">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-[13px] font-semibold rounded-lg bg-slate-950/60 border border-slate-900 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/30 font-caption"
            />
          </div>

          <div className="flex items-center gap-1.5">
            {/* Auto-scroll toggle */}
            <button
              onClick={scrollToBottom}
              className={`p-1.5 rounded-lg border transition-all flex items-center justify-center ${
                autoScroll
                  ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
                  : 'bg-slate-950/40 border-slate-900 text-slate-500 hover:text-slate-300 hover:border-cyan-500/20'
              }`}
              title={autoScroll ? 'Auto-scroll active' : 'Click to scroll to bottom & resume auto-scroll'}
              aria-label="Scroll to bottom and enable auto-scroll"
            >
              <ArrowDown className={`w-3.5 h-3.5 ${autoScroll ? 'animate-bounce' : ''}`} />
            </button>

            {/* Copy logs */}
            <button
              onClick={handleCopyLogs}
              className="p-1.5 rounded-lg border border-slate-900 bg-slate-950/40 text-slate-400 hover:text-slate-100 hover:bg-slate-900 transition-all flex items-center justify-center"
              title="Copy filtered logs"
              aria-label="Copy logs to clipboard"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>

            {/* Download logs */}
            <button
              onClick={handleDownloadLogs}
              className="p-1.5 rounded-lg border border-slate-900 bg-slate-950/40 text-slate-400 hover:text-slate-100 hover:bg-slate-900 transition-all flex items-center justify-center"
              title="Download logs (.txt)"
              aria-label="Download logs as text file"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            {/* Clear logs */}
            <button
              onClick={clearLogs}
              className="p-1.5 rounded-lg border border-slate-900 bg-slate-950/40 text-slate-400 hover:text-rose-400 hover:bg-rose-950/15 hover:border-rose-500/10 transition-all flex items-center justify-center"
              title="Clear logs"
              aria-label="Clear all logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Terminal View area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-grow overflow-y-auto space-y-0.5 pr-1 scrollbar"
        style={{ fontFamily: 'JetBrains Mono, monospace' }}
      >
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <Terminal className="w-8 h-8 text-slate-700" />
            <p className="text-[13px] font-semibold text-slate-600 font-caption">
              {searchQuery ? 'No logs matching query criteria' : 'Console online. Waiting for job process...'}
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filteredLogs.map((log, i) => (
              <motion.div
                key={`${log.timestamp}-${i}`}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className="log-entry rounded-md px-2 py-0.5"
                style={{ backgroundColor: levelBg[log.level] || 'transparent' }}
              >
                {/* Time */}
                <span className="text-[11px] text-slate-600 select-none mr-2 tabular-nums">
                  {new Date(log.timestamp).toLocaleTimeString('en-US', {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>

                {/* Level Tag */}
                <span
                  className="font-bold tracking-wide mr-2.5 text-[11px] select-none"
                  style={{ color: levelColors[log.level] || '#94a3b8' }}
                >
                  [{log.level.toUpperCase().padEnd(7)}]
                </span>

                {/* Log message */}
                <span className="text-[13px] text-slate-300 leading-relaxed font-medium break-all sm:break-words whitespace-pre-wrap">
                  {log.message}
                </span>

                {/* Vehicle number decorator */}
                {log.vehicleNumber && (
                  <span className="px-1.5 py-0.5 ml-2 text-[10px] font-bold rounded bg-slate-900 text-slate-400 uppercase border border-slate-800">
                    {log.vehicleNumber.toUpperCase()}
                  </span>
                )}

                {/* Worker ID decorator */}
                {log.workerId && (
                  <span className="text-[10px] font-bold ml-2 text-slate-600 select-none bg-slate-950/60 px-1 py-0.5 rounded border border-slate-900">
                    W{log.workerId}
                  </span>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Scroll-paused indicator: shows a "jump to bottom" pill when auto-scroll is off */}
      <AnimatePresence>
        {!autoScroll && filteredLogs.length > 0 && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            onClick={scrollToBottom}
            className="absolute bottom-6 right-6 flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[11px] font-bold hover:bg-cyan-500/20 transition-all"
          >
            <ArrowDown className="w-3 h-3" />
            Jump to latest
          </motion.button>
        )}
      </AnimatePresence>

      {/* Resize handle indicator */}
      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none select-none">
        <div className="w-10 h-1 rounded-full bg-slate-800/80" />
      </div>
    </div>
  );
}
