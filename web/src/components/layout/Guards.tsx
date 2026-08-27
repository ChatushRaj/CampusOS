import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { Role } from '@/types';

function Booting() {
  return (
    <div className="flex min-h-screen items-center justify-center" role="status" aria-live="polite">
      <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
      <span className="sr-only">Loading</span>
    </div>
  );
}

/** Signed-in only. Remembers where the visitor was headed so login can return them. */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <Booting />;
  if (status === 'anonymous') return <Navigate to="/login" state={{ from: location }} replace />;
  return <Outlet />;
}

/** Keeps signed-in people out of the login and register screens. */
export function RequireAnonymous() {
  const { status } = useAuth();
  if (status === 'loading') return <Booting />;
  if (status === 'authenticated') return <Navigate to="/app" replace />;
  return <Outlet />;
}

export function RequireRole({ roles }: { roles: Role[] }) {
  const { user, status } = useAuth();
  if (status === 'loading') return <Booting />;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/app" replace />;
  return <Outlet />;
}
