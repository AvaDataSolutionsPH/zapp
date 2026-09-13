// ============================================================
// ZAPP Donuts — "cannot reach the database" full-screen gate
// ============================================================
//
// WHY THIS EXISTS (data-loss prevention, not cosmetics).
//
// `useStore.hydrateFromDB()` deliberately falls back to the seeded mock slices
// when the fetch fails (network down, RLS misconfigured, schema drift, or —
// the one that actually bit us — a free-tier Supabase project that auto-paused
// after 7 quiet days). The fallback keeps the UI renderable, but it is a TRAP
// for a real user:
//
//   1. Every store / delivery / billing row on screen is FAKE seed data.
//   2. `dataSource` stays 'mock', and every mutation in the store is gated on
//      `dataSource === 'db'` — so writes succeed in memory and are NEVER sent
//      to Supabase. The toast still says "Saved".
//
// So the operator encodes a real day of work, sees success on every screen, and
// loses all of it on refresh. The only previous signal was a
// `console.warn('[useStore] hydrateFromDB failed …')` that nobody sees.
//
// This screen replaces the WHOLE router (same pattern and reasoning as the
// account-activation gate in App.tsx): a per-route banner leaves every
// unguarded path — and anything added later — reachable by typing the URL,
// and a dismissible banner is exactly the kind of thing a busy user clicks
// past. Nothing in the app is real while hydration has failed, so nothing in
// the app should be reachable.

import { useState } from 'react';
import { DatabaseZap, RefreshCw, LogOut } from 'lucide-react';
import { useStore } from '@/store/useStore';

export default function DatabaseUnavailableScreen() {
  const hydrateFromDB = useStore((s) => s.hydrateFromDB);
  const logout = useStore((s) => s.logout);
  const [retrying, setRetrying] = useState(false);

  const retry = async () => {
    setRetrying(true);
    try {
      // On success the store flips hydrationStatus to 'ok' and App.tsx stops
      // rendering this screen, so there is nothing to do here on the happy
      // path. On failure the status stays 'failed' and we simply stay put.
      await hydrateFromDB();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-zapp-brown p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-[#3a211f] via-zapp-brown to-[#1d100f]" />

      <div className="relative w-full max-w-lg rounded-2xl bg-white/95 p-8 shadow-2xl">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100">
            <DatabaseZap className="h-6 w-6 text-red-600" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900">
              Hindi maka-connect sa database
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Could not load your data from Supabase.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-lg border-l-4 border-red-500 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-900">
            ⚠️ HUWAG munang mag-encode.
          </p>
          <p className="mt-1 text-sm text-red-800">
            Hindi totoo ang anumang makikita mo ngayon, at{' '}
            <strong>hindi masi-save</strong> ang kahit anong i-e-encode mo —
            mawawala ito pagka-refresh. Ito ang dahilan kung bakit hinaharangan
            ng screen na ito ang buong sistema.
          </p>
        </div>

        <div className="mt-5 text-sm text-gray-700">
          <p className="font-medium text-gray-900">Karaniwang dahilan:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Walang internet o pansamantalang putol ang koneksyon.</li>
            <li>
              <strong>Naka-pause ang Supabase project</strong> — nagpo-pause ang
              free tier pagkatapos ng mga 7 araw na walang gumagamit. I-resume
              ito sa Supabase dashboard, saka pindutin ang Subukan Ulit.
            </li>
          </ul>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void retry()}
            disabled={retrying}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-zapp-orange px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} />
            {retrying ? 'Sinusubukan…' : 'Subukan Ulit'}
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            <LogOut className="h-4 w-4" />
            Mag-logout
          </button>
        </div>
      </div>
    </div>
  );
}
