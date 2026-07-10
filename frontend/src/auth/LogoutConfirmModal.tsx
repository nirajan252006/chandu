import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export function LogoutConfirmModal({
  open,
  title = 'Log out?',
  description = 'Your session will be closed.',
  confirmText = 'Log out',
  cancelText = 'Cancel',
  onConfirm,
  onClose,
}: {
  open: boolean;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    confirmRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusables = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');
        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;

        if (e.shiftKey) {
          if (!active || active === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (!active || active === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <motion.div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-modal-title"
            aria-describedby="logout-modal-desc"
            tabIndex={-1}
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-md glass-strong border border-rose-500/20 p-6 md:p-8 shadow-[0_20px_50px_rgba(244,63,94,0.18)]"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-xl border border-slate-900 bg-slate-950/40 text-slate-400 hover:text-slate-200 focus-ring"
              aria-label="Close"
              type="button"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4">
                <span className="text-rose-300 font-black">!</span>
              </div>
              <h3
                id="logout-modal-title"
                className="text-lg font-black tracking-widest text-slate-100 uppercase"
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                {title}
              </h3>
              <p id="logout-modal-desc" className="text-xs text-slate-400 font-medium leading-relaxed mt-3 max-w-xs">
                {description}
              </p>


              <div className="flex flex-col sm:flex-row gap-3 w-full mt-8">
                <button
                  ref={confirmRef}
                  onClick={onConfirm}
                  className="cyber-button w-full sm:w-1/2 py-3 font-bold text-xs"
                  style={{ background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)', boxShadow: '0 0 15px rgba(244,63,94,0.25)' }}
                  type="button"
                >
                  {confirmText}
                </button>
                <button
                  onClick={onClose}
                  className="cyber-button w-full sm:w-1/2 py-3 border border-slate-700 bg-slate-950/20 font-bold text-xs"
                  style={{ background: 'linear-gradient(135deg, rgba(30,41,59,0.9) 0%, rgba(15,23,42,0.9) 100%)' }}
                  type="button"
                >
                  {cancelText}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

