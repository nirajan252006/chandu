import React, { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye, EyeOff, Lock, User, ShieldCheck, KeyRound, LogIn, AlertTriangle, HelpCircle
} from 'lucide-react';
import ParticleBackground from '../components/ParticleBackground';
import { useAuth } from './AuthContext';
import { AuthSession, SESSION_WARNING_BEFORE_MS } from './session';

function PasswordStrengthMeter({ password }: { password: string }) {
  const score = useMemo(() => {
    const min8 = password.length >= 8;
    const upper = /[A-Z]/.test(password);
    const lower = /[a-z]/.test(password);
    const num = /[0-9]/.test(password);
    const special = /[^A-Za-z0-9]/.test(password);
    const points = [min8, upper, lower, num, special].filter(Boolean).length;
    return points; // 0..5
  }, [password]);

  const label = useMemo(() => {
    if (!password) return 'Enter a password';
    if (score <= 2) return 'Weak';
    if (score === 3) return 'Good';
    if (score === 4) return 'Strong';
    return 'Excellent';
  }, [password, score]);

  const color = score <= 2 ? '#f87171' : score === 3 ? '#fbbf24' : score === 4 ? '#38bdf8' : '#34d399';

  const width = (score / 5) * 100;

  return (
    <div className="space-y-2" aria-label="Password strength">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Strength</p>
        <span className="text-[11px] font-bold" style={{ color }}>{label}</span>
      </div>
      <div className="progress-bar" aria-hidden="true">
        <div className="progress-bar-fill" style={{ width: `${width}%`, background: `linear-gradient(90deg, ${color}, rgba(192,132,252,0.8))` }} />
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const usernameRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPw, setShowPw] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      window.location.hash = '/';
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      if (!isCtrl) return;
      if (e.key.toLowerCase() === 'l') {
        e.preventDefault();
        usernameRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const version = 'v1.0.0';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await login(username, password, remember);
      if (!res.ok) {
        setError(res.error || 'Login failed');
        return;
      }
      window.location.hash = '/';
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen relative bg-gradient-cyber flex items-center justify-center px-4 py-10 overflow-hidden">
      <ParticleBackground />
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true" style={{ opacity: 0.25 }} />
      <div className="w-full max-w-md relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key="login-card"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] as const }}
            className="glass-strong p-6 sm:p-8 border border-indigo-500/10 shadow-[0_20px_70px_rgba(99,102,241,0.12)]"
            role="region"
            aria-label="Login"
          >
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center glow-blue"
                style={{ background: 'linear-gradient(135deg, rgba(56,189,248,0.25), rgba(192,132,252,0.18))', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <ShieldCheck className="w-6 h-6 text-cyan-200" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Company</p>
                <h1 className="text-xl font-black tracking-widest" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  VDR <span style={{ color: '#38bdf8' }}>PRO</span>
                </h1>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Enterprise Retriever • Secure Local Execution</p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5" aria-describedby={error ? 'login-error' : undefined}>
              {/* Username */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400" htmlFor="username">
                  Username
                </label>
                <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-950/40 border border-slate-800">
                  <User className="w-4 h-4 text-cyan-300" />
                  <input
                    id="username"
                    ref={usernameRef}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-transparent outline-none text-sm font-semibold text-slate-100"
                    autoComplete="username"
                    inputMode="text"
                    aria-label="Username"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400" htmlFor="password">
                  Password
                </label>
                <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-950/40 border border-slate-800">
                  <Lock className="w-4 h-4 text-purple-300" />
                  <input
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-transparent outline-none text-sm font-semibold text-slate-100"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    aria-label="Password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    className="p-1 rounded-xl hover:bg-white/5 focus-ring"
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOff className="w-4 h-4 text-slate-300" /> : <Eye className="w-4 h-4 text-slate-300" />}
                  </button>
                </div>
                <PasswordStrengthMeter password={password} />
              </div>

              {/* Options row */}
              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-300 select-none" aria-label="Remember me">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="accent-cyan-400"
                    aria-label="Remember me"
                  />
                  Remember Me
                </label>
                <button
                  type="button"
                  className="text-[11px] font-bold text-cyan-300 hover:text-cyan-200 underline decoration-cyan-400/30"
                  onClick={() => {
                    // UI-only forgot password: admin changes via Change Password page.
                    setError('Use Ctrl+Shift+P to change password after logging in.');
                  }}
                >
                  Forgot Password
                </button>
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    id="login-error"
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

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="cyber-button w-full py-3 rounded-2xl text-sm font-bold"
                style={{ background: 'linear-gradient(135deg, #38bdf8, #c084fc)' }}
                aria-label="Login"
              >
                {submitting ? <span className="inline-flex items-center gap-2"><span className="animate-spin">⚙️</span> Signing in...</span> : (
                  <span className="inline-flex items-center gap-3">
                    <LogIn className="w-4 h-4" />
                    LOGIN
                    <span className="sr-only">Enter to submit</span>
                  </span>
                )}
              </button>

              <p className="text-[10px] text-slate-500 text-center font-semibold tracking-wider">
                Shortcut: Ctrl+L
              </p>
            </form>

            {/* Footer */}
            <div className="mt-6 pt-5 border-t border-indigo-950/20 flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-slate-600">
                <KeyRound className="w-3.5 h-3.5 text-cyan-300" />
                Version {version}
              </div>
              <div className="text-[10px] text-slate-500 font-semibold">Press Tab to navigate • Enter to submit • Esc supported</div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

