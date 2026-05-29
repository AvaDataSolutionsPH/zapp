// ============================================================
// ZAPP Donuts ERP - useStorageUrl hook (Phase 2C)
// ============================================================
//
// Thin React hook around resolveStorageUrl(). Pass a stored
// storage ref or legacy URL string and the hook returns a
// renderable URL once it's ready. Private-bucket signed URLs
// are re-fetched each time the ref changes so they never
// outlive their TTL while the user is looking at them.

import { useState, useEffect } from 'react';
import { resolveStorageUrl } from '@/services/storage';

/**
 * Resolve a storage ref (or legacy URL) into a renderable URL.
 *
 *   - Returns `undefined` while loading, on a missing ref, or
 *     while the resolved URL belongs to a previous ref (so the
 *     consumer never renders stale content for one frame after
 *     switching applications).
 *   - Returns the resolved URL on success.
 *   - Falls back to the raw input string on failure, so a broken
 *     signed-URL fetch still shows the placeholder onError handler
 *     in the consumer's <img> element.
 */
export function useStorageUrl(ref: string | undefined | null): string | undefined {
  // Cache the resolved URL alongside the ref it was resolved for —
  // this lets us synchronously detect "we resolved an older ref" and
  // return undefined without an extra setState call inside the effect.
  const [state, setState] = useState<{ ref: string; url: string } | undefined>(undefined);

  useEffect(() => {
    if (!ref) return;
    let cancelled = false;
    resolveStorageUrl(ref)
      .then((resolved) => {
        if (!cancelled) setState({ ref, url: resolved });
      })
      .catch(() => {
        if (!cancelled) setState({ ref, url: ref });
      });
    return () => {
      cancelled = true;
    };
  }, [ref]);

  if (!ref) return undefined;
  if (state?.ref !== ref) return undefined;
  return state.url;
}
