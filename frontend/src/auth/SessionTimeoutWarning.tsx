import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

export function SessionTimeoutWarning({
  open,
  idleRemainingMs,
  expirationRemainingMs,
  onExtend,
  onLogout,
  onClose,
}: {
  open: boolean;
  idleRemainingMs: number | null;
  expirationRemainingMs: number | null;
  onExtend: () => void;
  onLogout: () => void;
  onClose: () => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    btnRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
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
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);


  const format = (ms: number | null) => {
    if (!ms || ms <= 0) return '--';
    const s = Math.ceil(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}m ${r}s`;
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[125] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="session-timeout-title" aria-describedby="session-timeout-desc">

          <motion.div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"

            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={dialogRef}
            tabIndex={-1}
            aria-labelledby="session-timeout-title"
            aria-describedby="session-timeout-desc"
            initial={{ opacity: 0, scale: 0.98, y: 18 }}

            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-md glass-strong border border-amber-500/25 p-6 md:p-8 shadow-[0_20px_50px_rgba(245,158,11,0.18)] overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-2xl pointer-events-none" />
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-xl border border-slate-900 bg-slate-950/40 text-slate-400 hover:text-slate-200 transition-colors focus:ring focus-ring"
              aria-label="Close warning"
              type="button"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
                <AlertTriangle className="w-7 h-7" />
              </div>

              <h3 className="text-lg font-black tracking-widest text-slate-100 uppercase" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                Session Expiring Soon
              </h3>
              <p className="text-xs text-slate-400 font-medium leading-relaxed mt-3 max-w-xs">
                You are about to be logged out due to inactivity.
              </p>

              <div className="mt-4 w-full space-y-2">
                <div className="flex justify-between text-xs font-semibold text-slate-300">
                  <span className="text-slate-500">Idle remaining</span>
                  <span className="text-amber-300">{format(idleRemainingMs)}</span>
                </div>
                <div className="flex justify-between text-xs font-semibold text-slate-300">
                  <span className="text-slate-500">Session remaining</span>
                  <span className="text-cyan-300">{format(expirationRemainingMs)}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full mt-8">
                <button
                  ref={btnRef}
                  onClick={onExtend}
                  type="button"
                  className="cyber-button w-full sm:w-1/2 py-3 font-bold text-xs"
                  style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #c084fc 100%)' }}
                >
                  Stay Logged In
                </button>
                <button
                  onClick={onLogout}
                  type="button"
                  className="cyber-button w-full sm:w-1/2 py-3 font-bold text-xs"
                  style={{ background: 'linear-gradient(135deg, #fbbf24 0%, #fb923c 100%)', boxShadow: '0 0 15px rgba(245,158,11,0.25)' }}
                >
                  Log Out
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

