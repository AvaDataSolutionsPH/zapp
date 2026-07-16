// ============================================================
// ZAPP Donuts ERP — Account Verification (first-login gate)
// ============================================================
//
// Replaces the ENTIRE app for a franchisee whose account is not yet `active`.
// Rendered by the short-circuit in App.tsx — never routed to — so there is no
// URL that reaches the ERP around it.
//
// Two states:
//   not_activated        — must submit Gov ID + Proof of Billing + Selfie +
//                          accept Data Privacy. (Upload form lands in Phase C;
//                          this screen currently explains the requirement.)
//   pending_verification — submitted, waiting on staff review. Read-only.
//
// Sign out must always be reachable: without it a locked account is trapped in
// the browser with no way back to the login screen.

import { ShieldCheck, Clock, LogOut, FileText, IdCard, Camera, Lock } from 'lucide-react';
import { useStore } from '@/store/useStore';

const REQUIREMENTS = [
  { icon: IdCard, label: 'Government-issued ID' },
  { icon: FileText, label: 'Proof of Billing' },
  { icon: Camera, label: 'Selfie Verification' },
  { icon: ShieldCheck, label: 'Data Privacy Policy' },
];

export default function AccountVerificationPage() {
  const currentUser = useStore((s) => s.currentUser);
  const logout = useStore((s) => s.logout);

  const isPending = currentUser?.accountStatus === 'pending_verification';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl text-center">
        <div
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
            isPending ? 'bg-amber-100' : 'bg-orange-100'
          }`}
        >
          {isPending ? (
            <Clock size={30} className="text-amber-600" />
          ) : (
            <Lock size={30} className="text-zapp-orange" />
          )}
        </div>

        <h1 className="mt-5 text-xl font-bold text-gray-900">
          {isPending ? 'Sinusuri ang iyong dokumento' : 'I-verify muna ang iyong account'}
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          {isPending
            ? 'Naisumite na ang iyong mga dokumento. Sinusuri na ito ng aming team — aabisuhan ka kapag aktibo na ang account mo.'
            : 'Bago ka makapasok sa ERP, kailangan munang kumpletuhin ang account verification.'}
        </p>

        {currentUser && (
          <div className="mt-6 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-4 text-left text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Account</span>
              <span className="font-medium text-gray-900">{currentUser.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Status</span>
              <span
                className={`inline-flex items-center gap-1 font-medium ${
                  isPending ? 'text-amber-600' : 'text-gray-600'
                }`}
              >
                {isPending ? <Clock size={13} /> : <Lock size={13} />}
                {isPending ? 'Pending Verification' : 'Not Activated'}
              </span>
            </div>
          </div>
        )}

        {!isPending && (
          <div className="mt-6 rounded-xl border border-gray-200 p-4 text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Kailangan mong isumite
            </p>
            <ul className="mt-3 space-y-2">
              {REQUIREMENTS.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2 text-sm text-gray-700">
                  <Icon size={15} className="shrink-0 text-gray-400" /> {label}
                </li>
              ))}
            </ul>
            {/* Phase C replaces this with the real upload form. */}
            <p className="mt-4 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
              Malapit nang mabuksan ang upload form dito. Sa ngayon, maki-usap sa iyong
              distributor o area supervisor para maisumite ang mga dokumento.
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
