import { Navigate, useLocation } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import type { UserRole } from '@/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, currentUser, authLoading } = useStore();
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

  // Role check (if allowedRoles is specified)
  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(currentUser.role)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
}
