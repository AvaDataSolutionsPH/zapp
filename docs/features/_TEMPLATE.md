# Feature: <name>

**Status:** live / partial / planned
**Owner roles:** which user roles use this

## Entry points
- Route(s): `/…`
- Page/component: `src/pages/…`
- Trigger: button / form / auto

## Files
| File | Role |
|---|---|
| `src/pages/…` | … |
| `src/store/useStore.ts` → `actionName` | … |
| `src/services/dbWrite.ts` → `insertX` | … |
| `src/lib/…` | pure computation |

## Data flow
trigger → store action (optimistic) → DB write (`dbWrite.ts`) → recompute/rollback

## RLS / scope
Who can SELECT / write (mirror `src/store/useStore.ts` `getXForCurrentUser` +
`supabase/migrations/003_role_scoped_rls.sql`).

## Gotchas
- known edge cases, deferred items, non-obvious behavior

## Related
[[other-feature]] · CLAUDE.md "<section>" · memory `<name>`
