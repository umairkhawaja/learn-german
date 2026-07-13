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

// Notion wraps each record as { value: <block> } but newer responses use a
// double-nested { value: { value: <block> } }. Handle both.
function blockValue(record) {
  const v = record?.value;
  return v?.value ?? v ?? null;
}

function titleOf(block) {
  const segs = block?.properties?.title;
  if (!segs) return "";
  return segs.map((seg) => seg[0]).join("").trim();
}

// Fetch a Notion page and return its immediate child subpages, in document
// order, as { pageId, title } objects (pageId is the un-dashed 32-char id).
export async function fetchNotionChildPages(rootPageId, proxyUrl) {
  const recordMap = await fetchNotionPage(rootPageId, proxyUrl);
  const blocks = recordMap?.block ?? {};
  const root = blockValue(blocks[toDashedId(rootPageId)]);
  const content = root?.content ?? [];

  const pages = [];
  for (const childId of content) {
    const block = blockValue(blocks[childId]);
    if (block?.type === "page") {
      pages.push({ pageId: childId.replace(/-/g, ""), title: titleOf(block) });
    }
  }
  return pages;
}
