// Browser-compatible Notion page fetcher.
// Uses a CORS proxy (Cloudflare Worker) because Notion's /api/v3 endpoints
// block cross-origin requests from browsers.
//
// The returned recordMap is the same structure that react-notion-x's
// NotionRenderer expects (identical to what notion-client.getPage() returns).

function toDashedId(id) {
  if (id.includes("-")) return id;
  return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
}

export async function fetchNotionPage(pageId, proxyUrl) {
  const id = toDashedId(pageId);

  const res = await fetch(`${proxyUrl}/api/v3/loadPageChunk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pageId: id,
      limit: 200,
      cursor: { stack: [] },
      chunkNumber: 0,
      verticalColumns: false,
    }),
  });

  if (!res.ok) {
    throw new Error(`Notion proxy responded with ${res.status}`);
  }

  const json = await res.json();
  return json.recordMap;
}
