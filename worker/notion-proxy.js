// Cloudflare Worker — CORS proxy for Notion's internal API.
//
// Deploy once with:
//   npx wrangler deploy worker/notion-proxy.js --name notion-proxy --compatibility-date 2024-01-01
//
// Then set VITE_NOTION_PROXY_URL=https://notion-proxy.<YOUR_SUBDOMAIN>.workers.dev
// in your .env.local file and redeploy / restart the dev server.
//
// Free tier: 100 000 requests / day — more than enough for personal use.

export default {
  async fetch(request) {
    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    const url = new URL(request.url);

    // Only proxy the single endpoint the app needs — without this the worker
    // is an open proxy anyone can use to relay arbitrary POSTs to notion.so
    // under this account's free-tier quota.
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }
    if (url.pathname !== "/api/v3/loadPageChunk") {
      return new Response("Not found", { status: 404 });
    }

    const notionUrl = "https://www.notion.so" + url.pathname + url.search;

    const notionResponse = await fetch(notionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: request.body,
    });

    const body = await notionResponse.text();

    return new Response(body, {
      status: notionResponse.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=60",
      },
    });
  },
};
