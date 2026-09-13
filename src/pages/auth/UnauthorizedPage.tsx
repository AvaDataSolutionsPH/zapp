// ============================================================
// ZAPP Donuts ERP — "no access" page
// ============================================================
//
// `ProtectedRoute` sends a signed-in user here when their role is not on a
// route's allowedRoles. There was no such route, so the catch-all redirected to
// `/` — the PUBLIC marketing page. A Partner Distributor who clicked anything
// role-restricted was dumped on "BE PART OF THE SWEETEST BUSINESS!", which
// reads exactly like being logged out, and gave no hint that the real cause was
// a permission.

import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui';
import { useStore } from '@/store/useStore';

export default function UnauthorizedPage() {
  const navigate = useNavigate();
  const currentUser = useStore((s) => s.currentUser);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
          <ShieldAlert className="h-6 w-6 text-amber-600" />
        </div>

        <h1 className="mt-4 text-xl font-bold text-gray-900">Walang access</h1>
        <p className="mt-2 text-sm text-gray-600">
          Hindi kasama sa role mo ang page na ito.
          {currentUser && (
            <>
              {' '}Naka-login ka bilang{' '}
              <strong className="text-gray-900">{currentUser.name}</strong>{' '}
              ({currentUser.role.replace(/_/g, ' ')}).
            </>
          )}
        </p>
        <p className="mt-2 text-xs text-gray-500">
          Kung kailangan mo ito, hilingin sa Admin (Owner) na bigyan ka ng access.
          Hindi ito error — hindi ka na-logout.
        </p>

        <div className="mt-6 flex justify-center">
          <Button variant="primary" iconLeft={<ArrowLeft size={15} />} onClick={() => navigate('/dashboard')}>
            Bumalik sa Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
