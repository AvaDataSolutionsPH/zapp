-- ============================================================
-- ZAPP Donuts ERP — Phase 2A Schema Migration
-- ============================================================
--
-- Creates all entity tables matching the TypeScript types in
-- src/types/index.ts. Naming: snake_case in DB, mapped to camelCase
-- in src/services/db.ts.
--
-- Nested arrays/objects (items, auditLog, aiResults, revisions, etc.)
-- are stored as JSONB to mirror the TypeScript shapes. Phase 3 may
-- normalize these into child tables if needed.
--
-- Computed billings (per src/lib/billingComputations.ts) stay
-- client-side for now; no billing_records table here.
--
-- HOW TO RUN:
--   Supabase dashboard → SQL Editor → paste this file → Run.
--   Then run 002_permissive_rls.sql next.

-- ── Foundational tables (no FKs) ──────────────────────────────

CREATE TABLE IF NOT EXISTS plants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  region TEXT NOT NULL,
  code TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS skus (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  dr_price NUMERIC(12, 2) NOT NULL,
  srp_price NUMERIC(12, 2) NOT NULL,
  unit TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS packaging_catalog (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price NUMERIC(12, 2) NOT NULL,
  image_url TEXT,
  category TEXT NOT NULL
);

-- ── Distribution hierarchy ────────────────────────────────────

CREATE TABLE IF NOT EXISTS distributors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact_person TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  plant_id TEXT NOT NULL REFERENCES plants(id),
  referral_code TEXT NOT NULL,
  assigned_area_ids TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'suspended'))
);

CREATE TABLE IF NOT EXISTS sub_partner_distributors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact_person TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  parent_distributor_id TEXT NOT NULL REFERENCES distributors(id),
  plant_id TEXT NOT NULL REFERENCES plants(id),
  assigned_store_ids TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'suspended'))
);

CREATE TABLE IF NOT EXISTS area_supervisors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  assigned_areas TEXT[] NOT NULL DEFAULT '{}',
  plant_id TEXT NOT NULL REFERENCES plants(id),
  assigned_store_ids TEXT[] NOT NULL DEFAULT '{}'
);

-- ── User profiles (separate from auth.users) ──────────────────
-- The link to auth.users is by email match (Phase 2 keeps it loose).
-- Phase 3 may add a foreign key to auth.users.id.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN (
    'owner', 'operations_manager', 'forecaster', 'plant_manager',
    'billing_user', 'partner_distributor', 'sub_partner_distributor',
    'franchisee_distributor', 'franchisee_direct', 'area_manager'
  )),
  avatar TEXT NOT NULL,
  plant_id TEXT REFERENCES plants(id),
  distributor_id TEXT REFERENCES distributors(id),
  sub_partner_distributor_id TEXT REFERENCES sub_partner_distributors(id),
  area_ids TEXT[],
  assigned_store_ids TEXT[]
);

-- ── Stores ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  business_name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  address TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  plant_id TEXT NOT NULL REFERENCES plants(id),
  distributor_id TEXT REFERENCES distributors(id),
  sub_partner_distributor_id TEXT REFERENCES sub_partner_distributors(id),
  area_supervisor_id TEXT NOT NULL REFERENCES area_supervisors(id),
  franchise_type TEXT NOT NULL CHECK (franchise_type IN ('distributor', 'direct')),
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'pending', 'blocked')),
  province TEXT NOT NULL,
  area TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  delivery_status TEXT NOT NULL CHECK (delivery_status IN ('active', 'warning', 'hold'))
);

CREATE INDEX IF NOT EXISTS idx_stores_plant ON stores(plant_id);
CREATE INDEX IF NOT EXISTS idx_stores_distributor ON stores(distributor_id);
CREATE INDEX IF NOT EXISTS idx_stores_area_supervisor ON stores(area_supervisor_id);

-- ── Applications ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  email TEXT NOT NULL,
  store_name TEXT NOT NULL,
  address TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  store_photo_url TEXT NOT NULL,
  gov_id_url TEXT NOT NULL,
  proof_of_billing_url TEXT NOT NULL,
  referral_code TEXT NOT NULL,
  referral_type TEXT NOT NULL CHECK (referral_type IN ('distributor', 'zapp_internal')),
  assigned_distributor_id TEXT REFERENCES distributors(id),
  assigned_area_supervisor_id TEXT REFERENCES area_supervisors(id),
  assigned_plant_id TEXT NOT NULL REFERENCES plants(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'declined')),
  submitted_at TIMESTAMPTZ NOT NULL,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  audit_log JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);

-- ── Deliveries ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS deliveries (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id),
  plant_id TEXT NOT NULL REFERENCES plants(id),
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'in_transit', 'delivered', 'reconciled')),
  dr_number TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_dr_cost NUMERIC(14, 2) NOT NULL,
  total_srp NUMERIC(14, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_deliveries_store ON deliveries(store_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_date ON deliveries(date);

-- ── Inventories ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS beginning_inventories (
  id TEXT PRIMARY KEY,
  delivery_id TEXT NOT NULL REFERENCES deliveries(id),
  store_id TEXT NOT NULL REFERENCES stores(id),
  date DATE NOT NULL,
  dr_image_url TEXT NOT NULL,
  crate_image_urls TEXT[] NOT NULL DEFAULT '{}',
  ai_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  confirmed_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('pending_ai', 'ai_processed', 'confirmed')),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS ending_inventories (
  id TEXT PRIMARY KEY,
  delivery_id TEXT NOT NULL REFERENCES deliveries(id),
  store_id TEXT NOT NULL REFERENCES stores(id),
  date DATE NOT NULL,
  crate_image_urls TEXT[] NOT NULL DEFAULT '{}',
  unsold_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL CHECK (status IN (
    'pending_review', 'needs_review', 'correction_required',
    'approved', 'pending', 'confirmed'
  )),
  notes TEXT,
  submitted_at TIMESTAMPTZ,
  original_unsold_items JSONB,
  revisions JSONB,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ei_store ON ending_inventories(store_id);
CREATE INDEX IF NOT EXISTS idx_ei_status ON ending_inventories(status);

-- ── Payments ──────────────────────────────────────────────────
-- billing_id is a TEXT reference (no FK, since billings are computed
-- client-side and may not exist as DB rows yet).

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  billing_id TEXT NOT NULL,
  store_id TEXT NOT NULL REFERENCES stores(id),
  amount NUMERIC(14, 2) NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('gateway', 'manual')),
  reference_number TEXT NOT NULL,
  date_paid DATE NOT NULL,
  proof_url TEXT,
  status TEXT NOT NULL CHECK (status IN ('submitted', 'verified', 'rejected')),
  verified_by TEXT,
  rejected_reason TEXT,
  submitted_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_store ON payments(store_id);
CREATE INDEX IF NOT EXISTS idx_payments_billing ON payments(billing_id);

-- ── Packaging Orders ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS packaging_orders (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id),
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_amount NUMERIC(14, 2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'included_in_delivery', 'billed')),
  ordered_at TIMESTAMPTZ NOT NULL,
  delivery_id TEXT REFERENCES deliveries(id)
);

-- ── Forecasts ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS forecasts (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id),
  date DATE NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'submitted', 'approved'))
);

-- ── Referral Codes ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS referral_codes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('distributor', 'zapp_internal')),
  distributor_id TEXT REFERENCES distributors(id),
  area_supervisor_id TEXT REFERENCES area_supervisors(id),
  plant_id TEXT NOT NULL REFERENCES plants(id),
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL,
  usage_count INT NOT NULL DEFAULT 0
);

-- ── Sales Metrics (analytics) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS sales_metrics (
  store_id TEXT NOT NULL REFERENCES stores(id),
  store_name TEXT NOT NULL,
  area TEXT NOT NULL,
  province TEXT NOT NULL,
  plant_id TEXT NOT NULL REFERENCES plants(id),
  distributor_id TEXT REFERENCES distributors(id),
  dr_sales NUMERIC(14, 2) NOT NULL,
  srp_sales NUMERIC(14, 2) NOT NULL,
  period TEXT NOT NULL,
  date DATE NOT NULL,
  PRIMARY KEY (store_id, date, period)
);

-- ── Notifications ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL,
  target_role TEXT,
  target_store_id TEXT
);

-- ── Special Orders ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS special_orders (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id),
  date DATE NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_dr NUMERIC(14, 2) NOT NULL,
  total_srp NUMERIC(14, 2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sold')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_special_orders_store ON special_orders(store_id);

-- ── Grants — expose tables via PostgREST ──────────────────────
-- Project was created with "Automatically expose new tables" UNCHECKED,
-- so each table needs explicit grants. Permissive RLS policies (in
-- 002_permissive_rls.sql) gate access; without those policies, queries
-- return zero rows even with these grants.

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
