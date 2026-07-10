// ============================================
// Export Panel - Enterprise Download Layout
// ============================================

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Download, FileSpreadsheet, FileText, FileJson, AlertCircle, AlertTriangle,
  ScrollText, Loader2, CheckCircle2, RotateCcw, FolderOpen, Users, XCircle
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import toast, { Toaster } from 'react-hot-toast';

interface DownloadButton {
  id: string;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  endpoint: string;
  color: string;
  description: string;
  badge?: string;
}

function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return '00s';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const hStr = hours > 0 ? `${hours}h ` : '';
  const mStr = minutes % 60 > 0 ? `${minutes % 60}m ` : '';
  const sStr = `${seconds % 60}s`;
  return `${hStr}${mStr}${sStr}`;
}

const STAT_COLORS = {
  success:   '#34d399',
  noRecord:  '#fbbf24',
  failed:    '#f87171',
  processed: '#38bdf8',
  total:     '#818cf8',
  time:      '#a78bfa',
};

export default function ExportPanel() {
  const { currentJobId, summary, results, reset, jobStatus } = useAppStore();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [openingFolder, setOpeningFolder] = useState(false);

  const uniqueEmailsCount = results
    ? new Set(
        results
          .filter((r: any) => r.email && r.email !== 'No data' && r.email.trim() !== '')
          .map((r: any) => r.email.trim().toLowerCase())
      ).size
    : 0;

  const isCompleted  = jobStatus === 'completed';
  const isCancelled  = jobStatus === 'cancelled';
  const accentColor  = isCancelled ? '#f59e0b' : '#34d399';
  const accentGlow   = isCancelled ? 'glow-yellow' : 'glow-green';
  const borderAccent = isCancelled ? 'border-l-amber-500' : 'border-l-emerald-500';

  const buttons: DownloadButton[] = [
    {
      id: 'excel',
      label: 'Full Excel Report',
      sublabel: 'All results with conditional formatting',
      icon: <FileSpreadsheet className="w-5 h-5" />,
      endpoint: `/api/export/${currentJobId}/excel`,
      color: '#34d399',
      description: 'Professional styled report with conditional formatting',
      badge: 'XLSX',
    },
    {
      id: 'unique-emails',
      label: `Unique Emails (${uniqueEmailsCount})`,
      sublabel: 'Deduplicated email records for CRM',
      icon: <Users className="w-5 h-5" />,
      endpoint: `/api/export/${currentJobId}/unique-emails`,
      color: '#38bdf8',
      description: 'Deduplicated email records list for CRM upload',
      badge: 'XLSX',
    },
    {
      id: 'failed-excel',
      label: 'Failed Vehicles List',
      sublabel: 'Vehicles requiring re-run or attention',
      icon: <AlertCircle className="w-5 h-5" />,
      endpoint: `/api/export/${currentJobId}/failed-excel`,
      color: '#f87171',
      description: 'Clean list of vehicles requiring attention/re-run',
      badge: 'XLSX',
    },
    {
      id: 'logs-excel',
      label: 'Processing Logs',
      sublabel: 'Full worker execution history',
      icon: <ScrollText className="w-5 h-5" />,
      endpoint: `/api/export/${currentJobId}/logs-excel`,
      color: '#fbbf24',
      description: 'Complete run log sheet with worker execution history',
      badge: 'XLSX',
    },
    {
      id: 'csv',
      label: 'CSV Export',
      sublabel: 'Standard comma-separated format',
      icon: <FileText className="w-5 h-5" />,
      endpoint: `/api/export/${currentJobId}/csv`,
      color: '#a855f7',
      description: 'Standard comma-separated format for general tools',
      badge: 'CSV',
    },
    {
      id: 'json',
      label: 'JSON Data',
      sublabel: 'Structured results for developers',
      icon: <FileJson className="w-5 h-5" />,
      endpoint: `/api/export/${currentJobId}/json`,
      color: '#ec4899',
      description: 'Structured JSON data of all results and jobs',
      badge: 'JSON',
    },
  ];

  const handleDownload = async (btn: DownloadButton) => {
    setDownloading(btn.id);
    try {
      const response = await fetch(btn.endpoint);
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const cd = response.headers.get('Content-Disposition');
      const filenameMatch = cd?.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch ? filenameMatch[1] : `export_${btn.id}_${currentJobId}`;

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success(`Downloaded: ${btn.label}`, {
        style: {
          background: '#0d0d20',
          color: '#e0e0ff',
          border: '1px solid rgba(52, 211, 153, 0.3)',
        },
      });
    } catch (error) {
      console.error('Download failed:', error);
      toast.error(`Download failed: ${error instanceof Error ? error.message : 'Unknown Error'}`);
    } finally {
      setDownloading(null);
    }
  };

  const handleOpenFolder = async () => {
    setOpeningFolder(true);
    try {
      const response = await fetch('/api/export/open-folder', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to open folder');
      toast.success('Export folder opened in File Explorer!', {
        style: {
          background: '#0d0d20',
          color: '#e0e0ff',
          border: '1px solid rgba(0, 212, 255, 0.3)',
        },
      });
    } catch {
      toast.error('Failed to open export folder');
    } finally {
      setOpeningFolder(false);
    }
  };

  if (!currentJobId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-center">
          <Download className="w-8 h-8 text-slate-600" />
        </div>
        <div>
          <p className="text-[17px] font-bold text-slate-500 font-card-title">No data to export yet</p>
          <p className="text-[13px] text-slate-600 mt-1 font-caption">Upload a file and process vehicles first</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto w-full">
      <Toaster position="top-right" reverseOrder={false} />

      {/* ── Compact Status Banner ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`glass py-3.5 px-6 border-l-4 ${borderAccent} ${accentGlow} relative overflow-hidden flex items-center justify-between gap-4 rounded-2xl`}
      >
        <div className="absolute inset-0 bg-gradient-to-r pointer-events-none"
          style={{ background: `linear-gradient(to right, ${accentColor}08, transparent)` }} />
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${accentColor}15` }}>
            {isCancelled
              ? <AlertTriangle className="w-5 h-5" style={{ color: accentColor }} />
              : <CheckCircle2 className="w-5 h-5" style={{ color: accentColor }} />}
          </div>
          <div>
            <h2 className="text-[13px] font-extrabold uppercase tracking-widest font-display"
              style={{ color: accentColor }}>
              {isCancelled ? 'JOB CANCELLED — PARTIAL REPORT' : 'PROCESSING COMPLETE — SUCCESS'}
            </h2>
            <p className="text-[13px] text-slate-500 mt-0.5 font-caption">
              {isCancelled
                ? 'Partial results have been preserved. Download available below.'
                : 'All lookups completed. Your export files are ready for download.'}
            </p>
          </div>
        </div>
        <span className="badge py-1 px-3 text-[10px] font-bold uppercase tracking-wider flex-shrink-0"
          style={{
            backgroundColor: `${accentColor}10`,
            color: accentColor,
            borderColor: `${accentColor}30`,
            border: '1px solid',
          }}>
          {isCancelled ? 'PARTIAL' : 'COMPLETE'}
        </span>
      </motion.div>

      {/* ── Two-column layout: Job Summary + Statistics ── */}
      {summary && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          {/* Job Metadata Card */}
          <div className="glass p-6 rounded-2xl border-indigo-500/10 lg:col-span-1 flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-slate-900/80 pb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Job Summary</p>
                <p className="text-[13px] font-mono text-slate-400 mt-0.5 truncate">{currentJobId}</p>
              </div>
              <span className={`badge text-[10px] py-1 px-2.5 font-bold ${isCancelled ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'badge-success'}`}>
                {isCancelled ? 'CANCELLED' : 'COMPLETED'}
              </span>
            </div>
            <div className="space-y-3 font-mono text-[13px]">
              {[
                { label: 'Total Uploaded',  val: summary.totalVehicles,                                                           color: STAT_COLORS.total    },
                { label: 'Total Processed', val: summary.successCount + summary.failedCount + summary.noRecordCount,              color: STAT_COLORS.processed },
                { label: 'Execution Time',  val: formatDuration(summary.totalProcessingTimeMs),                                   color: STAT_COLORS.time     },
              ].map(({ label, val, color }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-slate-900/60 last:border-0">
                  <span className="text-slate-500 font-caption font-medium">{label}</span>
                  <span className="font-bold" style={{ color }}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Result Statistics Grid */}
          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { label: 'Success',        value: summary.successCount,  color: STAT_COLORS.success,  Icon: CheckCircle2 },
              { label: 'No Record',      value: summary.noRecordCount, color: STAT_COLORS.noRecord, Icon: XCircle      },
              { label: 'Failed',         value: summary.failedCount,   color: STAT_COLORS.failed,   Icon: AlertCircle  },
              { label: 'Unique Emails',  value: uniqueEmailsCount,     color: STAT_COLORS.processed, Icon: Users       },
            ].map(({ label, value, color, Icon }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="glass p-6 rounded-2xl flex flex-col items-center justify-center text-center min-h-[120px]"
                style={{ borderColor: `${color}15` }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                  style={{ backgroundColor: `${color}12` }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <p className="text-2xl sm:text-3xl font-black font-mono tracking-tight" style={{ color }}>
                  {value.toLocaleString()}
                </p>
                <p className="text-[12px] font-bold uppercase tracking-wider text-slate-500 mt-1 font-caption">{label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Download Options Grid ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Download className="w-4 h-4 text-indigo-400" />
          </div>
          <h3 className="text-[15px] font-bold uppercase tracking-wider text-slate-300 font-card-title" style={{ fontFamily: 'Orbitron' }}>
            Download Options
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {buttons.map((btn, i) => (
            <motion.button
              key={btn.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 + i * 0.05 }}
              whileHover={{ y: -2, boxShadow: `0 8px 24px -6px ${btn.color}20` }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleDownload(btn)}
              disabled={downloading === btn.id}
              className="glass p-5 text-left transition-all cursor-pointer flex items-center gap-4 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed group"
              style={{ borderColor: `${btn.color}20` }}
            >
              {/* Icon box */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
                style={{ background: `${btn.color}12`, color: btn.color }}
              >
                {downloading === btn.id
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : btn.icon}
              </div>

              {/* Text */}
              <div className="flex-grow min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[14px] font-bold text-slate-200 truncate">{btn.label}</p>
                  {btn.badge && (
                    <span className="text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{ background: `${btn.color}15`, color: btn.color }}>
                      {btn.badge}
                    </span>
                  )}
                </div>
                <p className="text-[13px] text-slate-500 mt-0.5 font-caption truncate">{btn.sublabel}</p>
              </div>

              {/* Arrow indicator */}
              <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <Download className="w-4 h-4" style={{ color: btn.color }} />
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* ── Action Buttons ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex flex-wrap items-center justify-center gap-4 pt-2 pb-4"
      >
        <button
          onClick={handleOpenFolder}
          disabled={openingFolder}
          id="open-exports-folder-btn"
          className="cyber-button flex items-center gap-2.5 px-8 min-h-[48px] disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ background: 'linear-gradient(135deg, #00d4ff, #a855f7)' }}
        >
          {openingFolder
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <FolderOpen className="w-4 h-4" />}
          OPEN EXPORTS FOLDER
        </button>

        <button
          onClick={reset}
          id="new-run-btn"
          className="cyber-button flex items-center gap-2.5 px-8 min-h-[48px]"
          style={{ background: 'linear-gradient(135deg, #f43f5e, #f97316)' }}
        >
          <RotateCcw className="w-4 h-4" />
          NEW RUN
        </button>
      </motion.div>
    </div>
  );
}
