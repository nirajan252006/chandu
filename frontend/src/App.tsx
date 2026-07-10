// ============================================
// App.tsx - Main Application (Auth-gated)
// ============================================

import React, { useEffect } from 'react';
import { AuthProvider } from './auth/AuthContext';
import AppRoutes from './auth/AppRoutes';
import { useSocket } from './hooks/useSocket';

export default function App() {
  // Preserve existing behavior: initialize WebSocket connection.
  useSocket();

  // Ensure a valid initial route.
  useEffect(() => {
    if (!window.location.hash) window.location.hash = '/';
    const allowed = ['/login', '/change-password', '/'];
    if (!allowed.includes(window.location.hash as any)) {
      window.location.hash = '/';
    }
  }, []);

  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

