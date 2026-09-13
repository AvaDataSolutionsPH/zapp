# Feature: Database connection gate (mock-fallback guard)

**Status:** live
**Owner roles:** every signed-in role — this is a safety gate, not a module

## Why it exists

`hydrateFromDB()` falls back to the seeded mock slices when the fetch fails, so
the UI still renders. That is fine for a developer and a **trap for a real
operator**:

1. Every store / delivery / billing row on screen is fake seed data.
2. `dataSource` stays `'mock'`, and every mutation is gated on
   `dataSource === 'db'` — so writes land in memory only and are never sent to
   Supabase. **The success toast still fires.**

An operator can therefore encode a full day of work, see "Saved" on every
screen, and lose all of it on refresh. Before this gate the only signal was a
`console.warn` nobody reads.

This is not hypothetical: the Supabase free tier auto-pauses a project after
~7 quiet days, which is exactly the state the project was found in after a
two-month gap.

## Entry points
- Route(s): none — it replaces the whole router
- Component: `src/components/ui/DatabaseUnavailableScreen.tsx`
- Trigger: automatic, whenever hydration has failed for a signed-in user

## Files
| File | Role |
|---|---|
| `src/store/useStore.ts` → `hydrationStatus` | `'idle' \| 'loading' \| 'ok' \| 'failed'`, set by `hydrateFromDB` |
| `src/App.tsx` | short-circuits the router on `isAuthenticated && hydrationStatus !== 'ok'` |
| `src/components/ui/DatabaseUnavailableScreen.tsx` | the blocking screen: warning + Retry + Logout |

## Data flow
`login` / `restoreSession` → `isAuthenticated: true` → `hydrateFromDB()`
(fire-and-forget) → `hydrationStatus` `'loading'` → `'ok'` (router renders) or
`'failed'` (gate renders). Retry calls `hydrateFromDB()` again; success flips the
status and the gate disappears on its own.

## Gotchas
- **`hydrationStatus` is separate from `dataSource` on purpose.** `dataSource`
  answers "should mutations write to the DB"; the new flag answers "did the last
  hydration attempt succeed". Overloading `dataSource` would have changed the
  meaning of ~40 existing write gates.
- **The gate is keyed on `isAuthenticated`, not on `currentUser`.** A
  self-service `/onboarding` applicant has a session but no profile
  (`isAuthenticated: false`) and never hydrates, so the gate correctly leaves the
  awaiting-verification screen alone.
- **It is checked before the account-activation gate**, so a locked franchisee
  with a dead DB sees the honest error instead of an upload form whose writes
  would silently fail.
- `hydrateFromDB` is fire-and-forget in both `login` and `restoreSession`
  (`authLoading` goes false first). Without the `'loading'` state the gate would
  flash on every sign-in — that is why a boolean was not enough.
- The screen also removes the pre-existing flash of mock data between sign-in
  and hydration landing.
- Public pages are unaffected — they need no hydration.

## Related
CLAUDE.md "Gotchas" → `useStore.dataSource` · [[franchisee-activation]] (the
same whole-router short-circuit pattern in `App.tsx`)
