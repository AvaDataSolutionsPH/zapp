// ============================================================
// ZAPP Donuts ERP - Supabase Storage Service (Phase 2C)
// ============================================================
//
// Upload + signed-URL helpers for the two Storage buckets created
// in Phase 2C:
//
//   zapp-public  — store photos, low-sensitivity images. Direct
//                  public URL is returned (works in <img src=...>).
//   zapp-private — Gov IDs, billing proofs, DR slips, EI crate
//                  photos, payment proofs. Signed URLs only —
//                  they expire after a configurable TTL.
//
// Phase 3 will replace the permissive Storage RLS policies with
// role-scoped rules (franchisee can only upload to their own
// store's prefix, PD can read scoped uploads, etc.). The helper
// signatures here will not change — the policies sit on the DB
// side.

import { supabase } from '@/lib/supabase';

// ── Buckets ──────────────────────────────────────────────────

export type Bucket = 'zapp-public' | 'zapp-private';

// ── Naming ────────────────────────────────────────────────────
// Files are stored under a per-purpose prefix so we can browse
// the bucket sensibly in the Supabase Dashboard and so future
// role-scoped RLS policies can match on the prefix. The base
// filename is randomised so two uploads of `proof.jpg` from
// different users never collide.

function uniqueFilename(file: File): string {
  const ext = file.name.includes('.')
    ? file.name.slice(file.name.lastIndexOf('.'))
    : '';
  const random = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${random}${ext.toLowerCase()}`;
}

/**
 * Build a storage object path for a given upload purpose. The
 * `scopeId` lets us shard by store / application / payment etc.
 * so future RLS policies can match on the prefix.
 *
 * Example: buildObjectPath('payment-proof', 'pay-123', file)
 *          → 'payment-proof/pay-123/k4qg7y-aa12bb33.jpg'
 */
export function buildObjectPath(
  purpose: string,
  scopeId: string,
  file: File,
): string {
  return `${purpose}/${scopeId}/${uniqueFilename(file)}`;
}

// ── Storage refs ──────────────────────────────────────────────
// A storage ref is the canonical string we persist into a DB
// column to point at a bucketed object. Format: `<bucket>/<path>`.
// Helpers below let callers round-trip between the stored string
// and a renderable URL without leaking Supabase-specific shapes
// across the codebase.

export interface StorageRef {
  bucket: Bucket;
  path: string;
}

export function buildStorageRef(bucket: Bucket, path: string): string {
  return `${bucket}/${path}`;
}

/**
 * Parse a stored string back into a typed ref. Returns null if
 * the string is not a recognisable storage ref — that lets the
 * caller treat legacy placeholder URLs (https://placehold.co/...,
 * '/uploads/payments/manual-proof.jpg', etc.) as opaque strings
 * and skip the resolve step.
 */
export function parseStorageRef(stored: string): StorageRef | null {
  for (const bucket of ['zapp-public', 'zapp-private'] as const) {
    const prefix = `${bucket}/`;
    if (stored.startsWith(prefix)) {
      return { bucket, path: stored.slice(prefix.length) };
    }
  }
  return null;
}

/**
 * Resolve a stored value into something an <img src="..."> can
 * render. Three cases:
 *   1. `zapp-public/...` → permanent public URL (sync, no network).
 *   2. `zapp-private/...` → freshly signed URL (async, 1h TTL).
 *   3. Anything else (legacy mock URL, http(s) URL, blob URL) →
 *      returned as-is. Keeps backward compat with seeded data.
 */
export async function resolveStorageUrl(stored: string): Promise<string> {
  const ref = parseStorageRef(stored);
  if (!ref) return stored;
  if (ref.bucket === 'zapp-public') return getPublicUrl(ref.bucket, ref.path);
  return getSignedUrl(ref.bucket, ref.path);
}

// ── Upload ────────────────────────────────────────────────────

export interface UploadResult {
  /** Bucket + object path inside the bucket. Persist this if you
   *  want to fetch a signed URL later for a private upload. */
  bucket: Bucket;
  path: string;
  /** A URL the UI can render today.
   *  - For zapp-public: the permanent public URL.
   *  - For zapp-private: a signed URL with the default TTL. */
  url: string;
  /** Canonical string we persist into a DB column. Format is
   *  `<bucket>/<path>`. Use `resolveStorageUrl(ref)` to turn this
   *  back into a renderable URL — public buckets resolve to the
   *  permanent public URL, private buckets re-sign on every read
   *  so signed URLs never expire mid-render. */
  storageRef: string;
}

/**
 * Upload a single file to a bucket. Throws on error so the caller
 * can fall back to a placeholder URL / surface a toast.
 *
 * For private bucket uploads the returned `url` is a signed URL
 * with a default 1-hour TTL — long enough for the immediate
 * preview after submit. Callers that need a longer-lived link
 * (e.g. reviewer queue showing weeks-old uploads) should re-call
 * `getSignedUrl(bucket, path)` when they render.
 */
export async function uploadFile(
  bucket: Bucket,
  path: string,
  file: File,
): Promise<UploadResult> {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
  if (error) throw error;

  const storageRef = buildStorageRef(bucket, path);

  if (bucket === 'zapp-public') {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return { bucket, path, url: data.publicUrl, storageRef };
  }

  // Private bucket — signed URL valid for 1 hour by default.
  const url = await getSignedUrl(bucket, path);
  return { bucket, path, url, storageRef };
}

/**
 * Upload multiple files to the same purpose+scope. Returns the
 * URLs in the same order as the input array. Stops + throws on
 * the first failure (the caller can then roll back).
 */
export async function uploadFiles(
  bucket: Bucket,
  purpose: string,
  scopeId: string,
  files: File[],
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];
  for (const file of files) {
    const path = buildObjectPath(purpose, scopeId, file);
    const result = await uploadFile(bucket, path, file);
    results.push(result);
  }
  return results;
}

// ── Signed URL retrieval (private bucket) ────────────────────

const DEFAULT_SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

/**
 * Generate a fresh signed URL for an existing object in the
 * private bucket. Use this when rendering a previously-uploaded
 * file — the signed URL captured at upload time may already
 * have expired.
 */
export async function getSignedUrl(
  bucket: Bucket,
  path: string,
  ttlSeconds: number = DEFAULT_SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, ttlSeconds);
  if (error) throw error;
  return data.signedUrl;
}

// ── Public URL (public bucket) ────────────────────────────────

export function getPublicUrl(bucket: Bucket, path: string): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

// ── Delete ────────────────────────────────────────────────────

export async function deleteFile(bucket: Bucket, path: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}
