// Cloud sync — durable, login-free progress store backed by a Cloudflare
// Worker + KV (see worker/progress-sync.js).
//
// Unlike driveSync.js (OAuth token that expires hourly and needs re-login),
// this uses a *baked-in* secret sync key from the build-time env, so it keeps
// working after IndexedDB is evicted and never asks the user to sign in.
//
// Configure via .env.local:
//   VITE_SYNC_URL=https://deutschmeister-progress-sync.<subdomain>.workers.dev
//   VITE_SYNC_KEY=<one of the keys in the Worker's SYNC_KEYS secret>
//
// Reuses the same backup JSON envelope + per-word merge as Drive sync, so the
// two are interchangeable and a Drive snapshot can seed the cloud store.
import { buildBackup, parseBackup } from "./backup";
import { mergeProgress } from "./driveSync";

const SYNC_URL = (import.meta.env.VITE_SYNC_URL ?? "").replace(/\/$/, "") || null;
const SYNC_KEY = import.meta.env.VITE_SYNC_KEY ?? null;

export { mergeProgress };

// True once both the endpoint and key are provided at build time.
export function isConfigured() {
  return !!(SYNC_URL && SYNC_KEY);
}

// Pull progress from the cloud store. Returns null when unconfigured, when the
// store is empty (404 / blank), or when the stored blob has no words.
export async function pullProgress() {
  if (!isConfigured()) return null;
  const res = await fetch(`${SYNC_URL}/progress`, {
    headers: { "X-Sync-Key": SYNC_KEY },
  });
  if (res.status === 404) return null;
  if (res.status === 401) throw new Error("Cloud sync key rejected — check VITE_SYNC_KEY.");
  if (!res.ok) throw new Error(`Cloud pull failed (${res.status})`);
  const raw = await res.text();
  if (!raw.trim()) return null;
  try {
    return parseBackup(raw); // throws "empty" if the blob has no progress
  } catch (e) {
    if (e && e.message === "empty") return null;
    throw e;
  }
}

// Push progress to the cloud store. `keepalive` lets the request survive a
// tab-hide/unload (the auto-push path).
export async function pushProgress(progress) {
  if (!isConfigured()) return false;
  const json = buildBackup(progress);
  const res = await fetch(`${SYNC_URL}/progress`, {
    method: "PUT",
    headers: { "X-Sync-Key": SYNC_KEY, "Content-Type": "application/json" },
    body: json,
    keepalive: true,
  });
  if (res.status === 401) throw new Error("Cloud sync key rejected — check VITE_SYNC_KEY.");
  if (!res.ok) throw new Error(`Cloud push failed (${res.status})`);
  return true;
}
