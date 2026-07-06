// Cloudflare Worker — durable progress store backed by Workers KV.
//
// Why this exists: the app's progress lives in the browser's IndexedDB, which
// iOS evicts after ~7 days of PWA inactivity (mastered words then reappear).
// Google Drive sync papered over that, but its client-side OAuth token expires
// hourly and can't refresh without a fresh login. This Worker gives the app a
// server-side store keyed by a *baked-in* secret sync key — so it survives
// eviction and needs no login, ever.
//
// Deploy (uses ./wrangler.toml, which points `main` here):
//   1. npx wrangler kv namespace create PROGRESS_KV
//        → paste the printed id into wrangler.toml
//   2. npx wrangler secret put SYNC_KEYS
//        → enter a comma-separated allowlist of secret keys (one per person/build)
//   3. npx wrangler deploy
//
// Endpoints (all under /progress):
//   GET  /progress   header X-Sync-Key: <secret>  → stored JSON, or 404 if none
//   PUT  /progress   header X-Sync-Key: <secret>  → store the JSON body
//
// Free tier: 100k reads + 1k writes/day — vastly more than one person needs.

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Sync-Key",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    const url = new URL(request.url);
    if (url.pathname !== "/progress") {
      return new Response("Not found", { status: 404, headers: cors });
    }

    // ── Auth: the sync key IS the identity. It must match one of the secret
    // keys in the SYNC_KEYS allowlist (set via `wrangler secret put`). ────────
    const key = request.headers.get("X-Sync-Key");
    if (!key || !env.SYNC_KEYS) {
      return new Response("Unauthorized", { status: 401, headers: cors });
    }
    const allowed = env.SYNC_KEYS.split(",").map((s) => s.trim()).filter(Boolean);
    if (!allowed.includes(key)) {
      return new Response("Unauthorized", { status: 401, headers: cors });
    }

    // Namespace the KV entry by a hash of the key: keeps multiple keys' stores
    // separate and avoids writing the raw secret into a KV key name.
    const kvKey = "progress:" + (await sha256(key));

    if (request.method === "GET") {
      const val = await env.PROGRESS_KV.get(kvKey);
      if (val == null) return new Response("", { status: 404, headers: cors });
      return new Response(val, {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (request.method === "PUT") {
      const body = await request.text();
      // Guard against clobbering the store with an empty or oversized payload.
      // A full 2,900-word progress blob is well under 1 MB.
      if (!body || body.length > 5_000_000) {
        return new Response("Bad payload", { status: 400, headers: cors });
      }
      try {
        JSON.parse(body); // reject non-JSON writes outright
      } catch {
        return new Response("Bad payload", { status: 400, headers: cors });
      }
      await env.PROGRESS_KV.put(kvKey, body);
      return new Response("OK", { status: 200, headers: cors });
    }

    return new Response("Method not allowed", { status: 405, headers: cors });
  },
};

async function sha256(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
