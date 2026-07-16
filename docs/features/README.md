# Feature Docs

Per-feature context maps. The point: any dev (or AI session) can get the full
picture of a feature — entry points, files, data flow, scope, gotchas —
**without re-reading the whole codebase**.

## The one rule that keeps these useful

**Update the doc in the SAME commit as the feature change.** A stale feature
doc is worse than none — it gets trusted and leads to wrong edits. If you touch
a feature, touch its doc.

## Conventions

- **No line numbers.** They drift within a session. Reference **file paths +
  function / symbol names + data flow** instead — those survive edits.
- **Structural, not exhaustive.** Describe entry points, the flow, and the
  gotchas. Don't paste code; point to where it lives.
- **One file per feature**, kebab-case: `docs/features/<feature>.md`.
- **Committed to git** (versioned with the code, shared with the team).
- **Cross-link** related features with `[[feature-name]]` and note relevant
  memories / CLAUDE.md sections.

## How this relates to the other docs

| Doc | Scope |
|---|---|
| `CLAUDE.md` (untracked) | Whole-repo overview, phases, backlog, gotchas |
| `docs/features/*.md` (committed) | Per-feature deep context ← these |
| Auto-memory | Cross-session learnings + user preferences |
| `SUPABASE-MIGRATION-GUIDE.md` | One-off backend rebuild runbook |
| `ZAPP-DEMO-TESTING-GUIDE.md` | Manual QA walkthrough |

## Template

Copy `_TEMPLATE.md` when adding a feature doc.

## Index

- [public-application-flow](public-application-flow.md) — `/apply` wizard incl. the required Grab-style store map pin
- [franchisee-onboarding](franchisee-onboarding.md) — internal "New Franchisee" onboarding form (`/franchisees/new`): channel code (PD/SPD/direct), shop code, delivery schedule, opening date, ID + proof, T&C
- [partner-onboarding](partner-onboarding.md) — self-service applicant flow (`/onboarding`): account creation + docs + selfie + 4 confirmations; awaiting-verification screen (Phase 1)
- [account-creation](account-creation.md) — "New Account" (`/accounts/new`): create a login + entity for a PD/SPD/Area Supervisor with a temp password (owner/ops any; PD scoped)
- [application-monitoring](application-monitoring.md) — ZAPP New Application Monitoring: per-department evaluation fields with field-level RBAC + batch Save; Status stays an action (Approve/Decline)
- [inventory-capture](inventory-capture.md) — Beginning/Ending Inventory data entry (manual-only counting, local DR OCR, no Gemini)
- [ending-inventory-review](ending-inventory-review.md) — reviewer state machine (approve / needs-review / correction)
- [billing-and-delivery-recompute](billing-and-delivery-recompute.md) — computed billings + auto delivery-status cascade
- [payment-flow](payment-flow.md) — franchisee → PD/SPD (collect) → billing (verify) payment state machine
