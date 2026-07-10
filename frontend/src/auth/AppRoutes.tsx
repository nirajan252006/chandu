import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { useHashRoute, Navigate } from './router';
import LoginPage from './LoginPage';
import ChangePasswordPage from './ChangePasswordPage';
import ParticleBackground from '../components/ParticleBackground';
import ProcessMonitor from '../components/monitor/ProcessMonitor';
import LiveLogs from '../components/monitor/LiveLogs';
import UploadZone from '../components/upload/UploadZone';
import ControlBar from '../components/monitor/ControlBar';
import ExportPanel from '../components/export/ExportPanel';
import HeroSection from '../components/dashboard/HeroSection';

import { useAppStore } from '../stores/useAppStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Activity, Home, Car, Moon, Sun, Wifi, WifiOff } from 'lucide-react';
import { LogoutConfirmModal } from './LogoutConfirmModal';
import { SessionTimeoutWarning } from './SessionTimeoutWarning';
import CancelConfirmModal from '../components/monitor/CancelConfirmModal';



export default function AppRoutes() {
  const route = useHashRoute();
  const { isAuthenticated, logout, sessionWarning, sessionIdleRemainingMs, sessionExpirationRemainingMs } = useAuth();
  const { activeTab, setActiveTab, isConnected, darkMode, toggleDarkMode, currentJobId, jobStatus, showCancelModal, setShowCancelModal } = useAppStore();

  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);

  useEffect(() => {
    if (!route) return;
    if (!isAuthenticated && route !== '/login' && route !== '/change-password') {
      // guard
      window.location.hash = '/login';
    }
    if (isAuthenticated && (route === '/login' || route === '/change-password')) {
      window.location.hash = '/';
    }
  }, [route, isAuthenticated]);

  // Global shortcuts (protected)
  useEffect(() => {
    if (!isAuthenticated) return;

    const keyActiveRef = { current: {} as Record<string, boolean> };

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl) {
        const k = e.key.toLowerCase();
        if (k === 'u') {
          e.preventDefault();
          setActiveTab('process');
          // focus first file input if available is not changed; best-effort.
          return;
        }
        if (k === 's') {
          e.preventDefault();
          // Start processing is handled by ControlBar buttons; keep as-is.
          // Trigger click on Start button if present.
          const startBtn = document.querySelector<HTMLButtonElement>('button[data-shortcut-start="1"], button:has(svg)');
          startBtn?.click();
          return;
        }
        if (k === 'e') {
          e.preventDefault();
          setActiveTab('export');
          return;
        }
        if (e.shiftKey && k === 'p') {
          e.preventDefault();
          window.location.hash = '/change-password';
          return;
        }
      }

      // Space pause/resume / Esc cancel
      if (e.key === ' ' && !isInput) {
        e.preventDefault();
        if (currentJobId) {
          if (jobStatus === 'running') fetch(`/api/jobs/${currentJobId}/pause`, { method: 'POST' }).catch(console.error);
          else if (jobStatus === 'paused') fetch(`/api/jobs/${currentJobId}/resume`, { method: 'POST' }).catch(console.error);
        }
      }

      if (e.key === 'Escape' && !isInput) {
        if (currentJobId && (jobStatus === 'running' || jobStatus === 'paused') && !showCancelModal) {
          e.preventDefault();
          setShowCancelModal(true);
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keyActiveRef.current[e.key] = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [isAuthenticated, currentJobId, jobStatus, showCancelModal, setActiveTab, setShowCancelModal]);

  const tabs = useMemo(() => ([
    { id: 'home', label: 'Home', icon: <Home className="w-4 h-4" /> },
    { id: 'process', label: 'Process', icon: <Activity className="w-4 h-4" /> },
    { id: 'export', label: 'Export', icon: <Download className="w-4 h-4" /> },
  ]), []);

  const handleConfirmCancel = async () => {
    if (!currentJobId) return;
    setShowCancelModal(false);
    try {
      await fetch(`/api/jobs/${currentJobId}/cancel`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to cancel job:', err);
    }
  };

  if (!isAuthenticated || route === '/login') {
    return <LoginPage />;
  }

  if (route === '/change-password') {
    return <ChangePasswordPage />;
  }

  return (
    <div className="min-h-screen relative bg-gradient-cyber flex flex-col justify-between selection:bg-cyan-500/30 selection:text-white">
      <ParticleBackground />
      <div className="fixed inset-0 pointer-events-none z-[99] scan-line" />

      <header className="sticky top-0 left-0 right-0 z-50 pt-4 px-4 sm:px-5 md:px-6 lg:px-8">
        <div className="glass-strong mx-auto max-w-[1800px] px-4 sm:px-5 md:px-6 lg:px-8 py-3 flex items-center justify-between" style={{ borderRadius: '20px' }}>
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ rotate: 15, scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #38bdf8, #c084fc)', boxShadow: '0 0 20px rgba(56, 189, 248, 0.35)' }}
              onClick={() => setActiveTab('home')}
              role="button"
              tabIndex={0}
              aria-label="Go to Home"
            >
              <Car className="w-5 h-5 text-white" />
            </motion.div>
            <div>
              <h1 className="text-base font-black tracking-widest flex items-center gap-1.5" style={{ fontFamily: 'Orbitron, sans-serif', color: '#f1f1ff' }}>
                VDR <span style={{ color: '#38bdf8' }}>PRO</span>
              </h1>
              <p className="text-[9px] uppercase tracking-widest text-slate-500 font-bold hidden sm:block">Enterprise Retriever</p>
            </div>
          </div>

          <nav
            className="flex items-center gap-1 bg-slate-950/50 p-1 border border-indigo-500/10 rounded-2xl relative"
            role="tablist"
            aria-label="Navigation Tabs"
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  role="tab"
                  aria-selected={isActive}
                  className={`tab-button relative flex items-center gap-2 px-3 sm:px-5 py-2 z-10 transition-colors duration-300 ${isActive ? 'active text-white font-bold' : 'text-slate-400'}`}
                >
                  {tab.icon}
                  <span className="hidden sm:inline text-xs">{tab.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/40 border border-slate-800" aria-label={isConnected ? 'Server Connected' : 'Server Disconnected'}>
              <div className="relative flex h-2 w-2">
                {isConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? 'bg-emerald-400' : 'bg-rose-500'}`}></span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider hidden md:inline" style={{ color: isConnected ? '#34d399' : '#f87171' }}>{isConnected ? 'Live' : 'Offline'}</span>
            </div>

            <button
              onClick={() => {
                toggleDarkMode();
              }}
              className="p-2 rounded-xl transition-all duration-300 border border-slate-800 bg-slate-950/40 hover:bg-slate-900/60 hover:border-slate-700 flex items-center justify-center focus-ring"
              aria-label="Toggle theme mode"
              tabIndex={0}
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-purple-400" />}
            </button>

            <button
              onClick={() => setConfirmLogoutOpen(true)}
              className="p-2 rounded-xl transition-all duration-300 border border-slate-800 bg-slate-950/40 hover:bg-slate-900/60 hover:border-slate-700 flex items-center justify-center focus-ring"
              aria-label="Logout"
              tabIndex={0}
            >
              <Wifi className="w-4 h-4 text-slate-200 opacity-70" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow relative z-10 pt-6 pb-24 md:pb-12 px-4 sm:px-5 md:px-6 lg:px-8 max-w-[1800px] mx-auto w-full flex flex-col justify-start">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div key="home" initial={{ opacity: 0, y: 15, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -15, scale: 0.98 }} transition={{ duration: 0.35 }} className="w-full flex-grow flex flex-col justify-center">
              <HeroSection />
            </motion.div>
          )}

          {activeTab === 'process' && (
            <motion.div key="process" initial={{ opacity: 0, y: 15, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -15, scale: 0.98 }} transition={{ duration: 0.35 }} className="space-y-8 w-full">
              <div className="text-center max-w-xl mx-auto space-y-2 mt-4">
                <h2 className="text-4xl font-extrabold tracking-wider uppercase font-page-title" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  <span className="text-gradient">PROCESS VEHICLES</span>
                </h2>
                <p className="text-base font-medium font-body" style={{ color: '#94a3b8' }}>Upload your Excel file and initiate automated Looker Studio data extraction.</p>
              </div>
              <UploadZone />
              <ControlBar />
              <ProcessMonitor />
              <LiveLogs />
            </motion.div>
          )}

          {activeTab === 'export' && (
            <motion.div key="export" initial={{ opacity: 0, y: 15, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -15, scale: 0.98 }} transition={{ duration: 0.35 }} className="space-y-8 w-full max-w-[1400px] mx-auto">
              <div className="text-center max-w-xl mx-auto space-y-2 mt-4">
                <h2 className="text-4xl font-extrabold tracking-wider uppercase font-page-title" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  <span className="text-gradient">EXPORT DATA</span>
                </h2>
                <p className="text-base font-medium font-body" style={{ color: '#94a3b8' }}>Download retrieved vehicle records in professional formats.</p>
              </div>
              <ExportPanel />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {showCancelModal && (
          <CancelConfirmModal onConfirm={handleConfirmCancel} onClose={() => setShowCancelModal(false)} />
        )}
      </AnimatePresence>

      <footer className="relative z-10 text-center py-6 border-t border-indigo-950/20 bg-slate-950/10 backdrop-blur-sm mt-8">
        <p className="text-[10px] tracking-wider font-semibold uppercase text-slate-600">Vehicle Data Retriever Pro v1.0 — Secure Local Execution — Sandbox Mode</p>
      </footer>

      <LogoutConfirmModal
        open={confirmLogoutOpen}
        onClose={() => setConfirmLogoutOpen(false)}
        onConfirm={() => {
          setConfirmLogoutOpen(false);
          logout();
        }}
      />

      <SessionTimeoutWarning
        open={sessionWarning}
        idleRemainingMs={sessionIdleRemainingMs}
        expirationRemainingMs={sessionExpirationRemainingMs}
        onClose={() => {}}
        onExtend={() => {
          // just touching session updates expiry
          // touch is called by provider activity listeners, but ensure now
          // best-effort
          try {
            window.dispatchEvent(new Event('mousemove'));
          } catch {}
        }}
        onLogout={() => {
          setConfirmLogoutOpen(false);
          logout();
        }}
      />
    </div>
  );
}

