import React from 'react';
import { useAuth } from './AuthContext';
import { Navigate } from './router';

export function ProtectedRoute({ children }: { children: React.ReactElement }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}


