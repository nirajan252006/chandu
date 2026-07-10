// ============================================
// Process Monitor - Live Stats & Progress
// ============================================
// PERFORMANCE: This file is split into memoized sub-components:
//   - BannerSection: re-renders only on jobStatus change
//   - ProgressSection: re-renders only on processed/total/percent change
//   - StatCards: re-renders only when stat values change
//   - ResultsTable: re-renders only when results/search/sort change
// ============================================

import { useState, useMemo, useCallback, useRef, useEffect, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, CheckCircle2, XCircle, AlertTriangle, Clock, Zap, Loader2,
  Timer, Hash, ArrowUpDown, ArrowUp, ArrowDown, Search
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import type { SearchResult, JobProgress } from '../../types';

// ─── Utility ──────────────────────────────────────────────────────────────────

function formatTime(ms: number): string {
  if (!ms || ms <= 0) return '--';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// Helper to extract fields safely from SearchResult
const getRecordField = (result: SearchResult, keys: string[]): string => {
  if (!result || !result.data) return 'NA';
  const sourceObj = (result.data as any).selectedRow || result.data;
  for (const key of keys) {
    if (sourceObj[key] !== undefined && sourceObj[key] !== null && String(sourceObj[key]).trim() !== '') {
      return String(sourceObj[key]);
    }
  }
  const rawKeys = Object.keys(sourceObj);
  for (const k of rawKeys) {
    const cleanKey = k.split('\n')[0].trim().toLowerCase();
    if (keys.some(key => cleanKey === key.toLowerCase() || cleanKey.includes(key.toLowerCase()))) {
      return String(sourceObj[k]);
    }
  }
  return 'NA';
};

// ─── Stat card definitions (stable reference — defined outside component) ─────

const STAT_CARD_DEFS = [
  { key: 'processed', label: 'Processed',     color: '#38bdf8', Icon: Hash,        getValue: (p: JobProgress) => `${p.processed}/${p.total}` },
  { key: 'success',   label: 'Success',       color: '#34d399', Icon: CheckCircle2, getValue: (p: JobProgress) => p.success },
  { key: 'noRecord',  label: 'No Record',     color: '#fbbf24', Icon: AlertTriangle, getValue: (p: JobProgress) => p.noRecord },
  { key: 'pendingRetry', label: 'Pending Retry', color: '#f59e0b', Icon: Clock,    getValue: (p: JobProgress) => p.pendingRetry },
  { key: 'recovered', label: 'Recovered',     color: '#10b981', Icon: Zap,         getValue: (p: JobProgress) => p.recoveredAfterRetry },
  { key: 'permanentFailed', label: 'Perm. Failed', color: '#ef4444', Icon: XCircle, getValue: (p: JobProgress) => p.permanentFailed },
  { key: 'avgTime',   label: 'Avg Search',    color: '#fb923c', Icon: Timer,       getValue: (p: JobProgress) => formatTime(p.averageSearchTimeMs) },
  { key: 'eta',       label: 'ETA',           color: '#38bdf8', Icon: Clock,       getValue: (p: JobProgress) => formatTime(p.remainingTimeMs) },
];

// ─── BannerSection ─────────────────────────────────────────────────────────────
// Only re-renders when jobStatus or jobError or currentVehicle changes.

interface BannerSectionProps {
  jobStatus: string;
  jobError: string | null;
  progress: JobProgress | null;
}

const BannerSection = memo(function BannerSection({ jobStatus, jobError, progress }: BannerSectionProps) {
  return (
    <AnimatePresence mode="wait">
      {jobStatus === 'error' && (
        <motion.div
          key="error-banner"
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
          className="glass py-3.5 px-6 border-l-4 border-l-rose-500 bg-rose-500/5 glow-pink relative overflow-hidden flex items-center gap-4 rounded-2xl"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-rose-500/5 to-transparent pointer-events-none" />
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 flex-shrink-0">
            <XCircle className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500/80">AUTOMATION INITIALIZATION FAILED</p>
            <p className="text-sm font-bold tracking-wide font-sans text-slate-200 mt-0.5">
              Error: <span className="text-rose-400">{jobError || 'Browser connection failed or initialization timed out.'}</span>
            </p>
          </div>
        </motion.div>
      )}

      {jobStatus === 'paused' && (
        <motion.div
          key="paused-banner"
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
          className="glass py-3.5 px-6 border-l-4 border-l-amber-500 bg-amber-500/5 glow-yellow relative overflow-hidden flex items-center justify-between gap-4 rounded-2xl"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-transparent pointer-events-none" />
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 flex-shrink-0">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500/80">PROCESSING PAUSED</p>
              <p className="text-sm font-bold text-slate-200 mt-0.5">
                Workers holding. Active operations will reach a safe checkpoint.
              </p>
            </div>
          </div>
          <span className="badge bg-amber-500/10 text-amber-400 border border-amber-500/20 py-1 px-3 text-[10px] font-bold uppercase tracking-wider">
            Paused
          </span>
        </motion.div>
      )}

      {jobStatus === 'cancelling' && (
        <motion.div
          key="cancelling-banner"
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
          className="glass py-3.5 px-6 border-l-4 border-l-rose-500 bg-rose-500/5 glow-pink relative overflow-hidden flex items-center gap-4 rounded-2xl"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-rose-500/5 to-transparent pointer-events-none" />
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 relative flex-shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-xl bg-rose-500/20 animate-ping" />
            <Loader2 className="w-5 h-5 animate-spin text-rose-400" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500/80">CANCELLING RUN...</p>
            <p className="text-sm font-bold text-slate-200 mt-0.5">
              Stopping active workers and generating partial report. Please hold...
            </p>
          </div>
        </motion.div>
      )}

      {jobStatus === 'running' && progress?.currentVehicle && !progress?.retryPhase && (
        <motion.div
          key="running-banner"
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
          className="glass py-3.5 px-6 border-l-4 border-l-cyan-500 bg-cyan-500/5 glow-blue relative overflow-hidden flex items-center justify-between gap-4 rounded-2xl"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-transparent pointer-events-none" />
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center relative flex-shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-xl bg-cyan-400/20 animate-ping" />
              <Activity className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">LOOKER DISPATCHER ACTIVE</p>
              <p className="text-sm font-black tracking-widest font-mono text-cyan-400 text-glow-blue mt-0.5">
                {progress.currentVehicle.toUpperCase()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400">Workers Active</span>
            <span className="badge badge-info py-1 px-3 text-[10px] font-bold bg-cyan-500/10 border-cyan-500/20">W{progress.activeWorkers || 1}</span>
          </div>
        </motion.div>
      )}

      {jobStatus === 'running' && progress?.retryPhase && (
        <motion.div
          key="recheck-banner"
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
          className="glass py-3.5 px-6 border-l-4 border-l-amber-500 bg-amber-500/5 glow-yellow relative overflow-hidden flex items-center justify-between gap-4 rounded-2xl"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-transparent pointer-events-none" />
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center relative flex-shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-xl bg-amber-400/25 animate-ping" />
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400/80">RECHECKING FAILED VEHICLES</p>
              <p className="text-sm font-bold text-slate-200 mt-0.5">
                Current Vehicle: <span className="text-amber-400">{progress.retryCurrentVehicle?.toUpperCase()}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold font-mono">
            <div className="bg-slate-900/60 border border-slate-800 px-3 py-1.5 rounded-lg flex items-center gap-2">
              <span className="text-slate-500 uppercase text-[9px] font-bold">Attempt</span>
              <span className="text-amber-400 font-extrabold">{progress.retryAttempt}/3</span>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 px-3 py-1.5 rounded-lg flex items-center gap-2">
              <span className="text-slate-500 uppercase text-[9px] font-bold">Remaining</span>
              <span className="text-slate-300 font-extrabold">{progress.retryRemaining}</span>
            </div>
          </div>
        </motion.div>
      )}

      {jobStatus === 'completed' && (
        <motion.div
          key="completed-banner"
          initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
          className="glass py-3.5 px-6 border-l-4 border-l-success glow-green relative overflow-hidden flex items-center gap-4 rounded-2xl"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-success/5 to-transparent pointer-events-none" />
          <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center text-success flex-shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold tracking-widest text-emerald-400 uppercase font-display">
              PROCESSING COMPLETE — SUCCESS
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">All vehicle lookups and computations completed successfully. Report generated.</p>
          </div>
        </motion.div>
      )}

      {jobStatus === 'cancelled' && (
        <motion.div
          key="cancelled-banner"
          initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
          className="glass py-3.5 px-6 border-l-4 border-l-amber-500 glow-yellow relative overflow-hidden flex items-center gap-4 rounded-2xl"
          style={{ borderLeftColor: '#f59e0b' }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-transparent pointer-events-none" />
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold tracking-widest text-amber-400 uppercase font-display" style={{ color: '#f59e0b' }}>
              JOB CANCELLED — PARTIAL REPORT
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Job was stopped by the user. Processed results have been preserved and written to file.</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

// ─── ProgressSection ───────────────────────────────────────────────────────────
// Only re-renders when percent/processed/total/remaining changes.

interface ProgressSectionProps {
  progressPercent: number;
  processed: number;
  total: number;
  remaining: number;
}

const ProgressSection = memo(function ProgressSection({ progressPercent, processed, total, remaining }: ProgressSectionProps) {
  return (
    <div className="glass p-6 space-y-5 border-indigo-500/10 shadow-xl relative overflow-hidden rounded-2xl">
      <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-indigo-500/5 to-transparent blur-3xl pointer-events-none" />
      <div className="flex justify-between items-center">
        <div>
          <span className="text-[13px] font-bold uppercase tracking-wider text-slate-500 font-caption">AUTOMATION RUN PROGRESS</span>
          <h3 className="text-[17px] font-black text-slate-100 uppercase tracking-wide mt-0.5 font-card-title">Execution Status</h3>
        </div>
        <span className="text-4xl font-black text-glow-blue font-mono" style={{ color: '#38bdf8' }}>
          {progressPercent}%
        </span>
      </div>
      <div className="progress-bar">
        <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
      </div>
      <div className="flex justify-between text-[13px] font-semibold text-slate-400 font-caption">
        <span>{processed} of {total} vehicle items parsed</span>
        <span>Remaining queue: {remaining}</span>
      </div>
    </div>
  );
});


// ─── StatCards ────────────────────────────────────────────────────────────────
// Only re-renders when the actual stat VALUES change, not on every progress tick.

interface StatCardsProps {
  progress: JobProgress;
}

const StatCards = memo(function StatCards({ progress }: StatCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {STAT_CARD_DEFS.map((card, i) => {
        const value = String(card.getValue(progress));
        return (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.4 }}
            whileHover={{ y: -3, boxShadow: `0 8px 20px -5px ${card.color}15` }}
            className="stat-card glass p-6 relative border flex flex-col items-center justify-center text-center min-h-[130px] rounded-2xl"
            style={{ borderColor: `${card.color}15` }}
          >
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="flex items-center gap-2 text-slate-400">
                <div style={{ color: card.color }} className="opacity-95">
                  <card.Icon className="w-4 h-4" />
                </div>
                <span className="text-[13px] font-bold uppercase tracking-wider text-slate-500 font-caption">{card.label}</span>
              </div>
              <p className="text-2xl sm:text-3xl font-black font-mono tracking-tight" style={{ color: card.color }}>
                {value}
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}, (prev, next) => {
  // Custom comparator: only re-render when stat values actually change
  const p = prev.progress;
  const n = next.progress;
  return (
    p.processed === n.processed &&
    p.total === n.total &&
    p.success === n.success &&
    p.noRecord === n.noRecord &&
    p.pendingRetry === n.pendingRetry &&
    p.recoveredAfterRetry === n.recoveredAfterRetry &&
    p.permanentFailed === n.permanentFailed &&
    p.averageSearchTimeMs === n.averageSearchTimeMs &&
    p.remainingTimeMs === n.remainingTimeMs
  );
});

// ─── ResultsTable ──────────────────────────────────────────────────────────────
// Virtualized: only renders ~20 visible rows regardless of total count.
// Re-renders only when results / search / sort change — NOT on progress ticks.

const ROW_HEIGHT = 48; // px per row — must match CSS
const OVERSCAN = 5;    // extra rows rendered above/below viewport

interface ResultsTableProps {
  results: SearchResult[];
  progress: JobProgress | null;
}

const ResultsTable = memo(function ResultsTable({ results, progress }: ResultsTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sortField, setSortField] = useState<string>('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const [colWidths, setColWidths] = useState({
    vehicle: 140, status: 120, owner: 160, email: 180, worker: 90, retries: 90, duration: 100
  });

  // Debounce search query — typing does not trigger re-render of table rows
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(val), 150);
  }, []);

  // Column resize
  const handleMouseDown = useCallback((e: React.MouseEvent, colKey: keyof typeof colWidths) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = colWidths[colKey];
    const handleMouseMove = (ev: MouseEvent) => {
      setColWidths(prev => ({ ...prev, [colKey]: Math.max(70, startWidth + ev.clientX - startX) }));
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [colWidths]);

  const handleSort = useCallback((field: string) => {
    setSortField(prev => {
      if (prev === field) { setSortDirection(d => d === 'asc' ? 'desc' : 'asc'); return field; }
      setSortDirection('asc');
      return field;
    });
  }, []);

  // Filter — memoized, only recomputes when results or debouncedQuery changes
  const filteredResults = useMemo(() => {
    const q = debouncedQuery.toLowerCase().trim();
    if (!q) return results;
    return results.filter(res => {
      const vehicle = res.vehicleNumber.toLowerCase();
      const status = res.status.toLowerCase();
      const owner = getRecordField(res, ['ownerName', 'owner_name', 'owner']).toLowerCase();
      const email = getRecordField(res, ['email']).toLowerCase();
      return vehicle.includes(q) || status.includes(q) || owner.includes(q) || email.includes(q);
    });
  }, [results, debouncedQuery]);

  // Sort — memoized
  const sortedResults = useMemo(() => {
    return [...filteredResults].sort((a, b) => {
      let valA: any = (a as any)[sortField] || '';
      let valB: any = (b as any)[sortField] || '';
      if (sortField === 'owner') {
        valA = getRecordField(a, ['ownerName', 'owner_name', 'owner']);
        valB = getRecordField(b, ['ownerName', 'owner_name', 'owner']);
      } else if (sortField === 'email') {
        valA = getRecordField(a, ['email']);
        valB = getRecordField(b, ['email']);
      }
      if (typeof valA === 'string') {
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortDirection === 'asc' ? (valA > valB ? 1 : -1) : (valB > valA ? 1 : -1);
    });
  }, [filteredResults, sortField, sortDirection]);

  // Virtualization with @tanstack/react-virtual
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: sortedResults.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();
  const offsetY = virtualRows[0]?.start ?? 0;

  const renderSortIcon = (field: string) => {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 opacity-30" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3.5 h-3.5 text-cyan-400" />
      : <ArrowDown className="w-3.5 h-3.5 text-cyan-400" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass p-6 border-indigo-500/10 shadow-xl space-y-5 rounded-2xl"
    >
      {/* Header toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[13px] font-bold uppercase tracking-wider text-slate-500 font-caption">LOOKUP DATABASE</span>
          <h3 className="text-[17px] font-extrabold text-slate-200 tracking-wide mt-0.5 font-card-title">
            Live Results Stream
            <span className="ml-2 text-[13px] font-normal text-slate-500 font-caption">({sortedResults.length} records)</span>
          </h3>
        </div>
        <div className="relative w-full sm:w-64 flex-grow sm:flex-grow-0">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search processed records..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2 text-[13px] font-semibold rounded-xl bg-slate-950/60 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/40 font-caption"
          />
        </div>
      </div>

      {/* Virtualized Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-900 shadow-inner bg-slate-950/30">
        <div className="min-w-full inline-block align-middle">
          {/* Sticky header */}
          <table className="min-w-full divide-y divide-slate-900 border-collapse table-fixed">
            <thead className="bg-slate-950/70 backdrop-blur">
              <tr className="divide-x divide-slate-900">
                {[
                  { key: 'vehicleNumber', label: 'Vehicle Number', colKey: 'vehicle' as const },
                  { key: 'status',        label: 'Status',         colKey: 'status' as const },
                  { key: 'owner',         label: 'Owner Name',     colKey: 'owner' as const },
                  { key: 'email',         label: 'Email Address',  colKey: 'email' as const },
                  { key: 'workerId',      label: 'Worker',         colKey: 'worker' as const },
                  { key: 'retries',       label: 'Retries',        colKey: 'retries' as const },
                  { key: 'duration',      label: 'Duration',       colKey: 'duration' as const },
                ].map(col => (
                  <th
                    key={col.key}
                    scope="col"
                    className="resizable-header px-4 py-3.5 text-left text-[13px] font-bold uppercase tracking-widest text-slate-400 select-none cursor-pointer font-caption"
                    style={{ width: `${colWidths[col.colKey]}px` }}
                  >
                    <div className="flex items-center gap-1.5" onClick={() => handleSort(col.key)}>
                      {col.label} {renderSortIcon(col.key)}
                    </div>
                    <div className="resizer" onMouseDown={(e) => handleMouseDown(e, col.colKey)} />
                  </th>
                ))}
              </tr>
            </thead>
          </table>

          {/* Scrollable virtualized body */}
          <div
            ref={scrollContainerRef}
            style={{ height: '500px', overflowY: 'auto', position: 'relative' }}
            className="scrollbar"
          >
            {sortedResults.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-xs font-semibold text-slate-500 font-sans">
                  {debouncedQuery ? 'No matching records found in this run' : 'Waiting for first results...'}
                </p>
              </div>
            ) : (
              // Total height spacer — makes scrollbar correct size
              <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
                {/* Only visible rows are painted */}
                <table
                  className="min-w-full border-collapse table-fixed"
                  style={{ position: 'absolute', top: `${offsetY}px`, width: '100%' }}
                >
                  <tbody className="divide-y divide-slate-900 bg-slate-950/10 font-mono text-[11px] text-slate-300">
                    {virtualRows.map((virtualRow) => {
                      const result = sortedResults[virtualRow.index];
                      if (!result) return null;
                      const status = result.status;
                      const email = getRecordField(result, ['email']);
                      const owner = getRecordField(result, ['ownerName', 'owner_name', 'owner']);
                      const isPendingRetry = status === 'failed' && result.retries < 2 && progress && (progress.processed < progress.total || progress.retryPhase);
                      return (
                        <tr
                          key={result.vehicleNumber}
                          style={{ height: `${virtualRow.size}px` }}
                          className="hover:bg-slate-900/60 divide-x divide-slate-900 transition-colors duration-150"
                        >
                          <td style={{ width: `${colWidths.vehicle}px` }} className="px-4 py-2 font-bold tracking-wider text-slate-200 uppercase truncate">{result.vehicleNumber}</td>
                          <td style={{ width: `${colWidths.status}px` }} className="px-4 py-2 truncate">
                            {isPendingRetry ? (
                              <span className="badge badge-warning text-[9px] py-0.5 px-2.5 animate-pulse bg-amber-500/10 text-amber-400 border border-amber-500/20">Pending Retry</span>
                            ) : (
                              <>
                                {status === 'success' && <span className="badge badge-success text-[9px] py-0.5 px-2.5">Success</span>}
                                {status === 'no_eligible_record' && <span className="badge badge-warning text-[9px] py-0.5 px-2.5">No Record</span>}
                                {(status === 'failed' || status === 'timeout') && <span className="badge badge-error text-[9px] py-0.5 px-2.5">Failed</span>}
                                {status !== 'success' && status !== 'no_eligible_record' && status !== 'failed' && status !== 'timeout' && (
                                  <span className="badge badge-info text-[9px] py-0.5 px-2.5">{status}</span>
                                )}
                              </>
                            )}
                          </td>
                          <td style={{ width: `${colWidths.owner}px` }} className="px-4 py-2 font-sans truncate text-slate-300 font-medium">{owner}</td>
                          <td style={{ width: `${colWidths.email}px` }} className="px-4 py-2 truncate font-sans text-slate-300">{email}</td>
                          <td style={{ width: `${colWidths.worker}px` }} className="px-4 py-2 truncate font-bold text-slate-500">W{result.workerId}</td>
                          <td style={{ width: `${colWidths.retries}px` }} className="px-4 py-2 truncate text-slate-400">{result.retries}x</td>
                          <td style={{ width: `${colWidths.duration}px` }} className="px-4 py-2 truncate text-slate-400">{(result.duration / 1000).toFixed(1)}s</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
});

// ─── Mobile Sticky Control Bar ─────────────────────────────────────────────────

interface StickyBarProps {
  jobId: string;
  jobStatus: string;
}

const MobileStickyBar = memo(function MobileStickyBar({ jobId, jobStatus }: StickyBarProps) {
  if (jobStatus !== 'running' && jobStatus !== 'paused') return null;
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-slate-950/80 backdrop-blur-lg border-t border-indigo-500/10 md:hidden flex justify-center gap-3">
      {jobStatus === 'running' ? (
        <button
          onClick={() => fetch(`/api/jobs/${jobId}/pause`, { method: 'POST' }).catch(console.error)}
          className="cyber-button w-1/2 py-3 text-xs font-bold font-display"
          style={{ background: 'linear-gradient(135deg, #fbbf24, #fb923c)', minHeight: '44px' }}
        >
          PAUSE
        </button>
      ) : (
        <button
          onClick={() => fetch(`/api/jobs/${jobId}/resume`, { method: 'POST' }).catch(console.error)}
          className="cyber-button w-1/2 py-3 text-xs font-bold font-display"
          style={{ background: 'linear-gradient(135deg, #34d399, #38bdf8)', minHeight: '44px' }}
        >
          RESUME
        </button>
      )}
      <button
        onClick={() => useAppStore.getState().setShowCancelModal(true)}
        className="cyber-button w-1/2 py-3 text-xs font-bold font-display"
        style={{ background: 'linear-gradient(135deg, #f87171, #fb923c)', minHeight: '44px' }}
      >
        STOP
      </button>
    </div>
  );
});

// ─── Root ProcessMonitor ───────────────────────────────────────────────────────
// Uses useAppStore selectors to subscribe to ONLY the slice each sub-component needs.
// The ResultsTable does NOT re-render when ETA/progress changes.

export default function ProcessMonitor() {
  // Granular selectors — each component only re-renders when its own data changes
  const jobStatus = useAppStore(s => s.jobStatus);
  const jobError  = useAppStore(s => s.jobError);
  const progress  = useAppStore(s => s.progress);
  const results   = useAppStore(s => s.results);
  const currentJobId = useAppStore(s => s.currentJobId);

  return (
    <div className="space-y-8 max-w-7xl mx-auto w-full px-4">

      {/* Banners — only jobStatus/jobError/currentVehicle matter here */}
      <BannerSection
        jobStatus={jobStatus}
        jobError={jobError}
        progress={progress}
      />

      {/* Progress bar — only re-renders on numeric progress changes */}
      {progress && (
        <ProgressSection
          progressPercent={progress.progressPercent || 0}
          processed={progress.processed || 0}
          total={progress.total || 0}
          remaining={progress.remaining || 0}
        />
      )}

      {/* Stat cards — only re-renders when stat values change (custom memo comparator) */}
      {progress && <StatCards progress={progress} />}

      {/* Results table — isolated from progress ticks entirely */}
      {results.length > 0 && (
        <ResultsTable results={results} progress={progress} />
      )}

      {/* Mobile sticky bar */}
      {currentJobId && (
        <MobileStickyBar jobId={currentJobId} jobStatus={jobStatus} />
      )}
    </div>
  );
}
