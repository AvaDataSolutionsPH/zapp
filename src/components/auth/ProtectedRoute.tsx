import { Navigate, useLocation } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { LoadingScreen, DatabaseUnavailableScreen } from '@/components/ui';
import type { UserRole } from '@/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, currentUser, authLoading, hydrationStatus } = useStore();
  const location = useLocation();

  // Still restoring the Supabase session on first paint — don't bounce to /login.
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zapp-cream/30">
        <div className="text-sm text-gray-500">Loading...</div>
      </div>
    );
  }

  // Not authenticated -> redirect to login
  if (!isAuthenticated || !currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // ── Data availability ────────────────────────────────────────────────────
  // Nothing on a protected screen is real until hydration lands: the store
  // boots on the seeded mock slices, and while it is on them every mutation is
  // skipped (each is gated on `dataSource === 'db'`) even though the success
  // toast still fires.
  //
  // ⚠️ This lives HERE, not in App.tsx, because it must not touch PUBLIC pages.
  // Sitting above <Routes> it replaced /apply as well, so a signed-in staff
  // member testing the public form had the page swapped for the splash screen
  // mid-typing and lost what they had entered.
  // See docs/features/db-connection-gate.md.
  if (hydrationStatus === 'failed') return <DatabaseUnavailableScreen />;
  if (hydrationStatus !== 'ok') return <LoadingScreen />;

  // Role check (if allowedRoles is specified)
  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(currentUser.role)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
}
