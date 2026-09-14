// ============================================================
// ZAPP Donuts ERP — bare referral short link  (zappdonuts.com/<code>)
// ============================================================
//
// Boss: "Yung referral code pala di nagana. Dapat pag click ng
// www.zappdonuts.com/zapp-01 automatic nalabas na yung referral code tapos di
// sya pwede matanggal."
//
// He was right, and the reason was not the referral system — it was ROUTING.
// The app only ever answered `/referral/<code>`. A bare `/<code>` fell through
// to the catch-all `<Navigate to="/">`, so every short link a distributor
// handed out landed silently on the marketing page with no code, no error and
// nothing to explain it. A referral link that quietly drops the referral is
// worse than one that 404s: the applicant still applies, just unattributed, and
// the distributor never gets credited.
//
// WHY VALIDATE BEFORE REDIRECTING, instead of forwarding blindly.
// This route sits one segment deep, so it also catches plain typos and every
// stale/renamed URL. Forwarding those to /apply would greet a lost visitor with
// an application form complaining about a referral code they never typed.
// Validating first keeps the old behaviour for non-codes — they still land on
// the home page — and costs one public RPC call (migration 044) on a path that
// is only ever hit deliberately.
//
// The redirect carries the code as STORED (`result.referral.code`), not as
// typed: the RPC matches case-insensitively, so `/zapp-ph` resolves and the
// form then shows the official `ZAPP-PH`.
//
// ⚠️ STATIC ROUTES ALWAYS WIN. React Router ranks a literal segment above a
// dynamic one, so `/login`, `/apply`, `/dashboard` and friends are unaffected
// by this route existing. The corollary is that a referral code named after an
// existing route (say a code literally called "settings") would never work as a
// short link — it would open that page instead. No code is close to that today;
// if it ever matters, reject reserved words when a code is created rather than
// re-ordering routes.

import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { LoadingScreen } from '@/components/ui';
import { validateReferralCodeLive } from '@/services/referralValidation';

export default function ReferralShortLink() {
  const { code = '' } = useParams<{ code: string }>();
  const [resolved, setResolved] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // No synchronous reset here: reaching a resolved/failed state immediately
    // redirects away, so this effect never re-runs against a stale code.
    let alive = true;

    validateReferralCodeLive(code)
      .then((result) => {
        if (!alive) return;
        if (result.valid && result.referral) setResolved(result.referral.code);
        else setFailed(true);
      })
      // A network failure is indistinguishable here from a bad code, and the
      // safe reading is "this is not a referral link" — send them home rather
      // than to a form that will block on a code we could not check.
      .catch(() => {
        if (alive) setFailed(true);
      });

    return () => {
      alive = false;
    };
  }, [code]);

  if (resolved) return <Navigate to={`/apply?ref=${encodeURIComponent(resolved)}`} replace />;
  if (failed) return <Navigate to="/" replace />;
  return <LoadingScreen />;
}
