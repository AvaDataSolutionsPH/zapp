// ============================================================
// ZAPP Donuts ERP - AwaitingVerificationPage
// ============================================================
//
// Shown when a self-service onboarding applicant logs in but has no ERP
// profile yet (auth login exists, application pending, not yet activated by
// Admin). Driven by `pendingApplication` in the store — see the auth flow in
// useStore (login / restoreSession).

import { Clock, LogOut, CheckCircle2 } from 'lucide-react';
import { useStore } from '@/store/useStore';

export default function AwaitingVerificationPage() {
  const pending = useStore((s) => s.pendingApplication);
  const logout = useStore((s) => s.logout);

  const needsInfo = pending?.status === 'needs_more_info';
  const statusLabel =
    pending?.status === 'declined'
      ? 'Not approved'
      : pending?.status === 'approved'
        ? 'Approved — activation in progress'
        : needsInfo
          ? 'More information needed'
          : 'Awaiting verification';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
          <Clock size={30} className="text-amber-600" />
        </div>
        <h1 className="mt-5 text-xl font-bold text-gray-900">Application Submitted</h1>
        <p className="mt-2 text-sm text-gray-500">
          Salamat! Natanggap na namin ang iyong onboarding application. Sinusuri na ito
          ng aming admin team.
        </p>

        {pending && (
          <div className="mt-6 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-4 text-left text-sm">
            {pending.applicationNumber && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Application No.</span>
                <span className="font-mono font-semibold text-gray-900">
                  {pending.applicationNumber}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Store</span>
              <span className="font-medium text-gray-900">{pending.storeName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Status</span>
              <span className="inline-flex items-center gap-1 font-medium text-amber-600">
                <Clock size={13} /> {statusLabel}
              </span>
            </div>
          </div>
        )}

        {needsInfo && pending?.notes ? (
          <div className="mt-6 space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-left text-xs text-amber-800">
            <p className="font-semibold">May kailangan pang impormasyon:</p>
            <p>{pending.notes}</p>
            <p className="text-amber-600">
              Maki-usap sa iyong distributor / admin para maisumite ang hinihinging detalye.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-2 rounded-xl border border-blue-100 bg-blue-50 p-4 text-left text-xs text-blue-700">
            <p className="flex items-start gap-2">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
              Aabisuhan ka sa susunod na hakbang kapag na-verify na ang iyong dokumento at
              impormasyon.
            </p>
          </div>
        )}

        <button
          onClick={() => void logout()}
          className="mt-6 inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </div>
  );
}
