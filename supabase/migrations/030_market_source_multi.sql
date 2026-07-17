-- ============================================================
-- 030_market_source_multi.sql
-- ============================================================
-- Boss: Market Source should be a CHECKLIST (multi-select) of location
-- characteristics, not a single dropdown — a site can sit beside a Public
-- Market AND a Terminal AND have High Foot Traffic. Plus an "Other" option that
-- reveals a free-text box.
--
-- So the column stops holding ONE value and starts holding a LIST.
--
--   market_source : TEXT  →  JSONB  (an array of option keys, e.g.
--                                    ["public_market","terminal","high_foot_traffic"])
--   market_source_other : new TEXT  (the custom value typed when "Other" is
--                                    ticked)
--
-- JSONB (not TEXT[]) so it round-trips through the existing read/write layer
-- exactly like audit_log / items — db.ts keeps JSONB values verbatim, so the
-- client gets a real array with no special-casing.
--
-- The two existing rows carry the OLD single-select vocabulary
-- ('facebook','walk_in') — semantically obsolete under the new option set. They
-- are WRAPPED into 1-element arrays rather than dropped (non-destructive); they
-- simply show as unrecognised and are cleared next time the row is saved.
--
-- No CHECK — same as 021, the client owns the vocabulary.
--
-- Idempotent-ish: the ALTER re-runs harmlessly only if the column is still TEXT;
-- guard so a second run does not fail on an already-jsonb column.
-- Run in Supabase BEFORE deploying the client change.
-- ============================================================

DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_name = 'applications' AND column_name = 'market_source') = 'text' THEN
    ALTER TABLE applications
      ALTER COLUMN market_source TYPE jsonb
      USING (
        CASE
          WHEN market_source IS NULL OR btrim(market_source) = '' THEN NULL
          ELSE to_jsonb(ARRAY[market_source])
        END
      );
  END IF;
END $$;

ALTER TABLE applications ADD COLUMN IF NOT EXISTS market_source_other TEXT;

NOTIFY pgrst, 'reload schema';

-- ── REVERT (manual) ───────────────────────────────────────────────────────
-- ALTER TABLE applications ALTER COLUMN market_source TYPE text
--   USING (CASE WHEN market_source IS NULL THEN NULL
--               ELSE (market_source ->> 0) END);
-- ALTER TABLE applications DROP COLUMN IF EXISTS market_source_other;
