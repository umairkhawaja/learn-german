// Google Drive sync — stores the progress backup JSON in the app's
// hidden "appDataFolder" (not visible in the user's normal Drive UI,
// not shared, scoped to this app only).
//
// Uses Google Identity Services (GIS) for OAuth (no client secret —
// safe for a public static site) + the Drive REST API directly via fetch
// (no need to load the heavy gapi client library).
//
// Requires a Google Cloud OAuth 2.0 "Web application" Client ID with
// https://umairkhawaja.github.io added as an authorized JavaScript origin.
// See README.md for full setup steps.

import { buildBackup, parseBackup, sanitizeProgress } from "./backup";
import { storage } from "./storage";

const CLIENT_ID = "408463852317-vvcriupl4lmtfv3q5tgun57k8n1rl8i4.apps.googleusercontent.com";
const SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const FILE_NAME = "deutschmeister-progress.json";
const TOKEN_KEY = "dm-drive-token";
const FILE_ID_KEY = "dm-drive-file-id";

let tokenClient = null;
let gisLoaded = null;

// ── Eagerly start loading GIS so it's ready when the user clicks Connect ──
export function preloadGis() {
  return loadGis();
}

// ── Load the GIS script lazily (only when Drive sync is actually used) ──
function loadGis() {
  if (gisLoaded) return gisLoaded;
  gisLoaded = new Promise((resolve, reject) => {
    if (window.google && window.google.accounts) return resolve();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(s);
  });
  return gisLoaded;
}

// ── Token storage (in-memory access token, persisted only for this session) ──
let cachedToken = null;

async function loadCachedToken() {
  if (cachedToken) return cachedToken;
  try {
    const r = await storage.get(TOKEN_KEY);
    if (r && r.value) {
      const t = JSON.parse(r.value);
      if (t.expiresAt > Date.now() + 60_000) {
        cachedToken = t;
        return t;
      }
    }
  } catch { }
  return null;
}

async function saveToken(token, expiresInSec) {
  cachedToken = { access_token: token, expiresAt: Date.now() + expiresInSec * 1000 };
  try { await storage.set(TOKEN_KEY, JSON.stringify(cachedToken)); } catch { }
}

export async function isConnected() {
  const t = await loadCachedToken();
  return !!t;
}

export async function disconnect() {
  cachedToken = null;
  try { await storage.delete(TOKEN_KEY); } catch { }
  try { await storage.delete(FILE_ID_KEY); } catch { }
}

// ── Auth: opens Google's account picker / consent popup ──
// Returns true on success, false if the user cancelled.
export async function connect({ interactive = true } = {}) {
  await loadGis();
  if (CLIENT_ID.startsWith("YOUR_GOOGLE_OAUTH_CLIENT_ID")) {
    throw new Error("Drive sync isn't configured yet — see README.md for setup steps.");
  }

  const existing = await loadCachedToken();
  if (existing && !interactive) return true;

  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        callback: () => { }, // overridden per-request below
      });
    }
    tokenClient.callback = (resp) => {
      if (resp.error) {
        if (resp.error === "popup_closed_by_user" || resp.error === "access_denied") {
          resolve(false);
        } else {
          reject(new Error(resp.error));
        }
        return;
      }
      saveToken(resp.access_token, resp.expires_in || 3600).then(() => resolve(true));
    };
    tokenClient.requestAccessToken({ prompt: interactive ? "consent" : "none" });
  });
}

// Ensures we have a usable token, silently refreshing if possible.
// Returns null (instead of throwing) if interactive auth would be required
// and `interactive` is false — callers use this to skip silent auto-sync
// when the user hasn't connected yet.
async function ensureToken({ interactive = false } = {}) {
  const existing = await loadCachedToken();
  if (existing) return existing.access_token;
  if (!interactive) return null;
  const ok = await connect({ interactive: true });
  if (!ok) return null;
  const t = await loadCachedToken();
  return t ? t.access_token : null;
}

async function driveFetch(url, token, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { ...(opts.headers || {}), Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    // token expired/revoked — clear it so the next attempt re-prompts
    cachedToken = null;
    try { await storage.delete(TOKEN_KEY); } catch { }
    throw new Error("Drive session expired — please reconnect.");
  }
  return res;
}

async function findFileId(token) {
  try {
    const cached = await storage.get(FILE_ID_KEY);
    if (cached && cached.value) return cached.value;
  } catch { }
  const params = new URLSearchParams({
    spaces: "appDataFolder",
    q: `name='${FILE_NAME}'`,
    fields: "files(id,name)",
  });
  const res = await driveFetch(`https://www.googleapis.com/drive/v3/files?${params}`, token);
  if (!res.ok) throw new Error(`Drive list failed (${res.status})`);
  const data = await res.json();
  const file = data.files && data.files[0];
  if (file) {
    try { await storage.set(FILE_ID_KEY, file.id); } catch { }
    return file.id;
  }
  return null;
}

// ── Pull progress from Drive. Returns null if no remote file exists yet,
// or if not connected and interactive=false. ──
export async function pullProgress({ interactive = false } = {}) {
  const token = await ensureToken({ interactive });
  if (!token) return null;

  const fileId = await findFileId(token);
  if (!fileId) return null;

  const res = await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, token);
  if (!res.ok) throw new Error(`Drive download failed (${res.status})`);
  const raw = await res.text();
  if (!raw.trim()) return null;
  return parseBackup(raw); // sanitized { [key]: {mastery, correct, total} }
}

// ── Push progress to Drive (creates the file on first sync). ──
export async function pushProgress(progress, { interactive = false } = {}) {
  const token = await ensureToken({ interactive });
  if (!token) return false;

  const json = buildBackup(progress);
  const fileId = await findFileId(token);
  const metadata = { name: FILE_NAME, mimeType: "application/json" };

  if (fileId) {
    const res = await driveFetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      token,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: json }
    );
    if (!res.ok) throw new Error(`Drive upload failed (${res.status})`);
  } else {
    metadata.parents = ["appDataFolder"];
    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    form.append("file", new Blob([json], { type: "application/json" }));
    const res = await driveFetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
      token,
      { method: "POST", body: form }
    );
    if (!res.ok) throw new Error(`Drive create failed (${res.status})`);
    const data = await res.json();
    try { await storage.set(FILE_ID_KEY, data.id); } catch { }
  }
  return true;
}

// ── Merge strategy for sync: for each word, keep whichever side has the
// higher `total` (more attempts = more recent/authoritative). Ties keep
// the higher mastery. Words only present on one side are kept as-is. ──
export function mergeProgress(local, remote) {
  const a = sanitizeProgress(local || {});
  const b = sanitizeProgress(remote || {});
  const out = { ...a };
  for (const [k, rv] of Object.entries(b)) {
    const lv = out[k];
    if (!lv) { out[k] = rv; continue; }
    if (rv.total > lv.total || (rv.total === lv.total && rv.mastery > lv.mastery)) {
      out[k] = rv;
    }
  }
  return out;
}
