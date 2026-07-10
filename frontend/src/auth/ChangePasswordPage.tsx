import React, { useMemo, useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from './AuthContext';
import ParticleBackground from '../components/ParticleBackground';
import { Eye, EyeOff, KeyRound, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';

function validatePassword(pw: string) {
  const rules = {
    min8: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    number: /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
  const ok = Object.values(rules).every(Boolean);
  return { ok, rules };
}

function StrengthMeter({ password }: { password: string }) {
  const { rules } = useMemo(() => validatePassword(password), [password]);
  const score = [rules.min8, rules.upper, rules.lower, rules.number, rules.special].filter(Boolean).length;
  const width = (score / 5) * 100;
  const color = score <= 2 ? '#f87171' : score === 3 ? '#fbbf24' : score === 4 ? '#38bdf8' : '#34d399';
  const label = score <= 2 ? 'Weak' : score === 3 ? 'Good' : score === 4 ? 'Strong' : 'Excellent';

  return (
    <div className="space-y-2" aria-label="New password strength">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Password Strength</p>
        <span className="text-[11px] font-bold" style={{ color }}>{label}</span>
      </div>
      <div className="progress-bar" aria-hidden="true">
        <div
          className="progress-bar-fill"
          style={{
            width: `${width}%`,
            background: `linear-gradient(90deg, ${color}, rgba(192,132,252,0.8))`,
          }}
        />
      </div>
    </div>
  );
}

export default function ChangePasswordPage() {
  const { changePassword, user, logout } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const currentRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    currentRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isEsc = e.key === 'Escape';
      if (!isEsc) return;
      // Esc -> go back to app
      window.location.hash = '/';
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const { rules, ok } = useMemo(() => validatePassword(next), [next]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOkMsg(null);

    if (!current) {
      setError('Enter your current password.');
      return;
    }

    if (next !== confirm) {
      setError('New password and confirmation do not match.');
      return;
    }

    if (!ok) {
      setError('Password must meet all complexity requirements.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await changePassword(current, next, confirm);
      if (!res.ok) {
        setError(res.error || 'Failed to change password');
        return;
      }
      setOkMsg('Password updated successfully.');
      setCurrent('');
      setNext('');
      setConfirm('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen relative bg-gradient-cyber flex items-center justify-center px-4 py-10 overflow-hidden">
      <ParticleBackground />
      <div className="w-full max-w-md relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] as const }}
          className="glass-strong p-6 sm:p-8 border border-indigo-500/10 shadow-[0_20px_70px_rgba(99,102,241,0.12)]"
          role="region"
          aria-label="Change Password"
        >
          <div className="flex items-center gap-4 mb-6">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center glow-purple"
              style={{ background: 'linear-gradient(135deg, rgba(192,132,252,0.22), rgba(56,189,248,0.12))', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <KeyRound className="w-6 h-6 text-purple-200" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Admin</p>
              <h1 className="text-xl font-black tracking-widest" style={{ fontFamily: 'Orbitron, sans-serif' }}>Change Password</h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">User: {user?.username || '—'}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" aria-describedby={error ? 'cp-error' : undefined}>
            {/* Current Password */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400" htmlFor="cp-current">Current Password</label>
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-950/40 border border-slate-800">
                <ShieldCheck className="w-4 h-4 text-cyan-300" />
                <input
                  id="cp-current"
                  ref={currentRef}
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  className="w-full bg-transparent outline-none text-sm font-semibold text-slate-100"
                  type={showCurrent ? 'text' : 'password'}
                  autoComplete="current-password"
                  aria-label="Current password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((s) => !s)}
                  className="p-1 rounded-xl hover:bg-white/5 focus-ring"
                  aria-label={showCurrent ? 'Hide current password' : 'Show current password'}
                >
                  {showCurrent ? <EyeOff className="w-4 h-4 text-slate-300" /> : <Eye className="w-4 h-4 text-slate-300" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400" htmlFor="cp-new">New Password</label>
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-950/40 border border-slate-800">
                <KeyRound className="w-4 h-4 text-purple-300" />
                <input
                  id="cp-new"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  className="w-full bg-transparent outline-none text-sm font-semibold text-slate-100"
                  type={showNext ? 'text' : 'password'}
                  autoComplete="new-password"
                  aria-label="New password"
                />
                <button
                  type="button"
                  onClick={() => setShowNext((s) => !s)}
                  className="p-1 rounded-xl hover:bg-white/5 focus-ring"
                  aria-label={showNext ? 'Hide new password' : 'Show new password'}
                >
                  {showNext ? <EyeOff className="w-4 h-4 text-slate-300" /> : <Eye className="w-4 h-4 text-slate-300" />}
                </button>
              </div>
              <StrengthMeter password={next} />
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400" htmlFor="cp-confirm">Confirm Password</label>
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-950/40 border border-slate-800">
                <KeyRound className="w-4 h-4 text-amber-300" />
                <input
                  id="cp-confirm"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full bg-transparent outline-none text-sm font-semibold text-slate-100"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  aria-label="Confirm password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((s) => !s)}
                  className="p-1 rounded-xl hover:bg-white/5 focus-ring"
                  aria-label={showConfirm ? 'Hide confirmation password' : 'Show confirmation password'}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4 text-slate-300" /> : <Eye className="w-4 h-4 text-slate-300" />}
                </button>
              </div>
            </div>

            {/* Requirements list */}
            <div className="p-4 rounded-2xl bg-slate-950/30 border border-slate-900">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-3">Complexity requirements</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] font-semibold">
                {[
                  { key: 'min8', label: '8+ chars' },
                  { key: 'upper', label: 'Uppercase' },
                  { key: 'lower', label: 'Lowercase' },
                  { key: 'number', label: 'Number' },
                  { key: 'special', label: 'Special char' },
                ].map((r) => (
                  <div key={r.key} className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: (rules as any)[r.key] ? '#34d399' : 'rgba(148,163,184,0.35)' }}
                    />
                    <span style={{ color: (rules as any)[r.key] ? '#d1fae5' : '#94a3b8' }}>{r.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  id="cp-error"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="p-3 rounded-2xl border border-rose-500/20 bg-rose-500/5 text-rose-200 flex items-start gap-2"
                  role="alert"
                >
                  <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5" />
                  <p className="text-[12px] font-semibold leading-relaxed">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Success */}
            <AnimatePresence>
              {okMsg && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="p-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-200 flex items-start gap-2"
                  role="status"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5" />
                  <p className="text-[12px] font-semibold leading-relaxed">{okMsg}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="cyber-button flex-1 py-3 rounded-2xl text-sm font-bold"
                style={{ background: 'linear-gradient(135deg, #c084fc, #38bdf8)' }}
                aria-label="Change password"
              >
                {submitting ? 'Updating...' : 'UPDATE PASSWORD'}
              </button>
              <button
                type="button"
                onClick={() => (window.location.hash = '/')}
                className="cyber-button flex-1 py-3 rounded-2xl text-sm font-bold"
                style={{ background: 'linear-gradient(135deg, rgba(30,41,59,0.9), rgba(15,23,42,0.9))' }}
              >
                Back
              </button>
            </div>
          </form>
        </motion.div>

        {/* subtle help */}
        <div className="mt-5 text-center text-[10px] text-slate-500 font-semibold tracking-wider">
          Shortcut: Ctrl+Shift+P
        </div>
      </div>
    </div>
  );
}

