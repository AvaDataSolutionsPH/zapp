// ============================================================
// ZAPP Donuts ERP - Supabase Client
// ============================================================
//
// Shared browser client used by the auth flow (Phase 1). Later phases
// will use the same instance for database queries, storage uploads, and
// real-time subscriptions.
//
// Env vars are injected by Vite at build time from .env.local — see
// .env.example for the expected shape.

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local',
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
