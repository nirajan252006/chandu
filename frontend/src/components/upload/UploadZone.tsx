// ============================================
// Upload Zone - Drag & Drop File Upload
// ============================================

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X, Loader2, FileUp } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

export default function UploadZone() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { setUploadResult, parseResult, currentJobId } = useAppStore();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setSelectedFile(file);
    setUploadError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setUploadResult(data.jobId, data.parseResult);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }, [setUploadResult]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024, // 50MB
  });

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Upload Area */}
      {!parseResult && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div
            {...getRootProps()}
            className={`drop-zone p-8 md:p-10 text-center cursor-pointer transition-all duration-300 relative overflow-hidden group rounded-2xl ${
              isDragActive ? 'active border-cyan-400 glow-blue ring-2 ring-cyan-500/10' : 'hover:border-indigo-500/35'
            }`}
          >
            <input {...getInputProps()} />

            {/* Glowing background decor */}
            <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

            <AnimatePresence mode="wait">
              {isUploading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex flex-col items-center py-6"
                >
                  <div className="relative flex items-center justify-center mb-6">
                    <Loader2 className="w-12 h-12 animate-spin text-cyan-400" />
                    <FileSpreadsheet className="w-5 h-5 text-indigo-400 absolute" />
                  </div>
                  <p className="text-base font-bold text-cyan-400 tracking-wide" style={{ fontFamily: 'Orbitron' }}>
                    Parsing Document...
                  </p>
                  <p className="text-xs text-slate-500 font-medium mt-1">Analyzing workbook sheets & validation headers</p>
                </motion.div>
              ) : isDragActive ? (
                <motion.div
                  key="drop"
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center py-6"
                >
                  <div className="w-14 h-14 rounded-2xl bg-cyan-500/15 flex items-center justify-center mb-5 text-cyan-400 border border-cyan-400/30">
                    <FileUp className="w-7 h-7" />
                  </div>
                  <p className="text-base font-extrabold text-cyan-400 tracking-wide" style={{ fontFamily: 'Orbitron' }}>
                    Release to Import
                  </p>
                  <p className="text-xs text-cyan-500/70 font-semibold mt-1">Accepts spreadsheet documents</p>
                </motion.div>
              ) : (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center"
                >
                  <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-5 text-slate-400 transition-all duration-300 group-hover:scale-105 group-hover:border-cyan-500/30 group-hover:text-cyan-400 shadow-md">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-base font-extrabold text-slate-200 tracking-wide mb-1.5" style={{ fontFamily: 'Orbitron' }}>
                    UPLOAD VEHICLE LIST
                  </p>
                  <p className="text-xs font-medium text-slate-400 max-w-sm leading-relaxed mb-6">
                    Drag and drop your spreadsheet records here, or <span className="text-cyan-400 font-semibold underline decoration-cyan-400/30 group-hover:text-cyan-300">browse folders</span> to load.
                  </p>
                  <div className="flex gap-2.5 justify-center">
                    {['.xlsx', '.xls', '.csv'].map(ext => (
                      <span key={ext} className="badge badge-info bg-indigo-500/5 text-indigo-400 border-indigo-500/15 text-[10px] font-bold py-1 px-3">
                        {ext}
                      </span>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Error Message */}
          <AnimatePresence>
            {uploadError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-4 p-4 rounded-2xl flex items-start gap-3 border border-rose-500/20 bg-rose-500/5 text-rose-400"
              >
                <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-500 mt-0.5" />
                <div className="flex-grow">
                  <p className="text-sm font-bold">Import Failure</p>
                  <p className="text-xs text-rose-400/80 mt-0.5">{uploadError}</p>
                </div>
                <button onClick={() => setUploadError(null)} className="p-1 rounded-lg hover:bg-rose-500/10" aria-label="Close error message">
                  <X className="w-4 h-4 text-rose-400" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Parse Result details */}
      <AnimatePresence>
        {parseResult && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="glass p-6 space-y-6 shadow-2xl relative border-indigo-500/10 rounded-2xl"
          >
            {/* Success indicator */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-[18px] font-bold text-emerald-400 tracking-wide font-card-title" style={{ fontFamily: 'Orbitron' }}>
                  FILE PARSED SUCCESSFULLY
                </h3>
                <p className="text-[13px] text-slate-500 font-medium mt-0.5 font-caption">Records mapped and ready for Looker automation</p>
              </div>
            </div>

            {/* File info preview */}
            {selectedFile && (
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-950/40 border border-slate-900">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div className="flex-grow min-w-0">
                  <p className="text-[13px] font-bold text-slate-300 truncate font-caption">{selectedFile.name}</p>
                  <p className="text-[13px] font-semibold text-slate-500 uppercase mt-0.5 font-caption">
                    {(selectedFile.size / 1024).toFixed(1)} KB — Excel Workbook
                  </p>
                </div>
              </div>
            )}

            {/* Staggered Stats Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Rows', value: parseResult.total, color: '#38bdf8' },
                { label: 'Unique Target', value: parseResult.unique, color: '#34d399' },
                { label: 'Duplicates Removed', value: parseResult.duplicatesRemoved, color: '#fbbf24' },
                { label: 'Blank Rows', value: parseResult.blankRows, color: '#94a3b8' },
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.4 }}
                  className="text-center glass p-6 rounded-2xl border-indigo-500/10 flex flex-col items-center justify-center min-h-[100px] hover:border-indigo-500/30"
                  style={{ 
                    borderColor: `${stat.color}15` 
                  }}
                >
                  <div
                    className="text-xl sm:text-2xl font-black tracking-tight"
                    style={{ fontFamily: 'Orbitron, sans-serif', color: stat.color }}
                  >
                    {stat.value.toLocaleString()}
                  </div>
                  <div className="text-[13px] font-bold uppercase tracking-wider text-slate-500 mt-1 font-caption">{stat.label}</div>
                </motion.div>
              ))}
            </div>

            {/* Formatting warnings list */}
            {parseResult.errors.length > 0 && (
              <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/15">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <p className="text-xs font-extrabold text-amber-500 uppercase tracking-wide">
                    Format Verification Notes ({parseResult.errors.length})
                  </p>
                </div>
                <div className="max-h-24 overflow-y-auto pr-1 space-y-1 scrollbar">
                  {parseResult.errors.map((err, i) => (
                    <p key={i} className="text-[11px] leading-relaxed text-slate-400 font-semibold font-mono border-b border-slate-900 pb-1 last:border-0 last:pb-0">
                      {err}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
