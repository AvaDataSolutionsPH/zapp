// ============================================================
// ZAPP Donuts ERP - Submission metadata (Partner Onboarding Phase 2)
// ============================================================
//
// Best-effort submission provenance for the self-service /onboarding flow:
// public IP, device fingerprint, and the applicant's device GPS at submit
// time. This is anti-fraud evidence for the reviewer (Phase 4) — a partner who
// later disputes their application can be matched against where/what it was
// filed from.
//
// EVERYTHING here is best-effort and NON-BLOCKING: each signal swallows its own
// errors and resolves to `undefined` on failure/denial/timeout. A missing
// signal must NEVER stop an application from submitting.

export interface SubmissionMetadata {
  submittedIp?: string;
  userAgent?: string;
  deviceInfo?: string;
  gpsLat?: number;
  gpsLng?: number;
}

// Public IP via ipify (no key, CORS-enabled). Aborted after a short timeout so
// a slow/blocked network never stalls the submit.
async function fetchIp(timeoutMs = 4000): Promise<string | undefined> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch('https://api.ipify.org?format=json', { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return undefined;
    const data = (await res.json()) as { ip?: string };
    return data.ip || undefined;
  } catch {
    return undefined;
  }
}

// Compact device fingerprint — platform · screen · language. Deliberately not a
// heavy fingerprinting library; this is a readable hint for the reviewer, not a
// tracking identifier.
function describeDevice(): string | undefined {
  try {
    const parts = [
      navigator.platform,
      typeof screen !== 'undefined' ? `${screen.width}×${screen.height}` : '',
      navigator.language,
    ].filter(Boolean);
    return parts.join(' · ') || undefined;
  } catch {
    return undefined;
  }
}

// Device GPS. Prompts the browser permission dialog; resolves to {} on
// denial/timeout/unsupported. A hard backstop guards the (rare) case where the
// browser never calls either callback.
async function fetchGps(timeoutMs = 8000): Promise<{ lat?: number; lng?: number }> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return {};
  return new Promise((resolve) => {
    let settled = false;
    const done = (v: { lat?: number; lng?: number }) => {
      if (!settled) { settled = true; resolve(v); }
    };
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => done({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => done({}),
        { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60000 },
      );
    } catch {
      done({});
    }
    setTimeout(() => done({}), timeoutMs + 1000);
  });
}

/**
 * Collect all best-effort submission metadata in parallel. Never throws.
 * Callers can fire this off before the document uploads so the (slow) GPS
 * prompt overlaps with the storage round-trips.
 */
export async function collectSubmissionMetadata(): Promise<SubmissionMetadata> {
  const [ip, gps] = await Promise.all([fetchIp(), fetchGps()]);
  return {
    submittedIp: ip,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    deviceInfo: describeDevice(),
    gpsLat: gps.lat,
    gpsLng: gps.lng,
  };
}
