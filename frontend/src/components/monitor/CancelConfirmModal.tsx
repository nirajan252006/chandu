// ============================================
// Cancel Confirm Modal - Premium Stop Confirmation
// ============================================

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertOctagon, X } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

interface CancelConfirmModalProps {
  onConfirm: () => void;
  onClose: () => void;
}

export default function CancelConfirmModal({ onConfirm, onClose }: CancelConfirmModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const continueBtnRef = useRef<HTMLButtonElement>(null);
  const stopBtnRef = useRef<HTMLButtonElement>(null);

  // Focus trap and accessibility
  useEffect(() => {
    // Focus the "Continue" button first as it is the safe option
    continueBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Tab') {
        const focusableElements = modalRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusableElements) return;

        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          // Shift + Tab: cycle backwards
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab: cycle forwards
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    // Disable body scroll when modal is open
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
      />

      {/* Modal Dialog */}
      <motion.div
        ref={modalRef}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="relative w-full max-w-md glass-strong border border-rose-500/20 p-6 md:p-8 shadow-[0_20px_50px_rgba(244,63,94,0.15)] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-desc"
      >
        {/* Decorative corner glows */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/5 blur-2xl pointer-events-none" />

        {/* Close button in top-right */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl border border-slate-900 bg-slate-950/40 text-slate-400 hover:text-slate-200 transition-colors focus:ring focus-ring"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center text-center">
          {/* Pulsing hazard icon */}
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 mb-5 relative">
            <span className="absolute inline-flex h-full w-full rounded-2xl bg-rose-500/20 animate-ping opacity-30"></span>
            <AlertOctagon className="w-7 h-7" />
          </div>

          <h3
            id="modal-title"
            className="text-lg font-black tracking-widest text-slate-100 uppercase"
            style={{ fontFamily: 'Orbitron, sans-serif' }}
          >
            STOP CURRENT PROCESSING JOB?
          </h3>
          
          <p id="modal-desc" className="text-xs text-slate-400 font-medium leading-relaxed mt-3 max-w-xs">
            Processed records will be preserved and exported. Remaining unprocessed vehicles will not be searched.
          </p>

          {/* Action button bar */}
          <div className="flex flex-col sm:flex-row gap-3 w-full mt-8">
            <button
              ref={continueBtnRef}
              onClick={onClose}
              className="cyber-button w-full sm:w-1/2 py-3 border border-slate-700 font-bold text-xs"
              style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}
            >
              CONTINUE PROCESSING
            </button>
            <button
              ref={stopBtnRef}
              onClick={onConfirm}
              className="cyber-button w-full sm:w-1/2 py-3 font-bold text-xs"
              style={{ background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)', boxShadow: '0 0 15px rgba(244, 63, 116, 0.25)' }}
            >
              STOP & EXPORT
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
