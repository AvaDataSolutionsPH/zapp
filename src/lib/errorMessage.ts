// ============================================================
// ZAPP Donuts ERP — turn ANY thrown value into something a user can act on
// ============================================================
//
// WHY THIS EXISTS.
//
// Every save handler in the app used to do:
//
//     addToast('error', err instanceof Error ? err.message : 'Hindi na-save.')
//
// which looks defensive but throws away the only useful information, because
// **a Supabase/PostgREST error is a PLAIN OBJECT, not an `Error` instance**:
//
//     { message: 'new row violates row-level security policy for table "plants"',
//       details: null, hint: null, code: '42501' }
//
// `err instanceof Error` is therefore FALSE for essentially every database
// failure, and the operator always saw the generic fallback — an RLS denial, an
// expired session, a unique-constraint violation and a network drop all looked
// identical and none of them could be diagnosed from the screen. A boss
// reporting "hindi nag-save" could not be helped without a developer opening
// the browser console.
//
// This keeps the fallback for genuinely unknown shapes, but surfaces the real
// message (plus details/hint/code when present) whenever there is one.

interface PostgrestLikeError {
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
}

const str = (v: unknown): string => (typeof v === 'string' && v.trim() ? v.trim() : '');

/**
 * A human-readable message for any thrown value.
 *
 * @param err      whatever landed in `catch`
 * @param fallback shown only when nothing usable can be extracted
 */
export const errorMessage = (err: unknown, fallback: string): string => {
  if (err == null) return fallback;
  if (typeof err === 'string') return str(err) || fallback;

  // A real Error (including subclasses) — but note Supabase's AuthError also
  // extends Error, so this branch covers auth failures too.
  if (err instanceof Error) return str(err.message) || fallback;

  if (typeof err === 'object') {
    const e = err as PostgrestLikeError;
    const parts = [str(e.message), str(e.details), str(e.hint)].filter(Boolean);
    if (parts.length) {
      const code = str(e.code);
      return code ? `${parts.join(' — ')} (${code})` : parts.join(' — ');
    }
  }

  return fallback;
};
