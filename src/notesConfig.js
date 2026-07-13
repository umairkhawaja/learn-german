// Grammar notes are read live from a single Notion page: "German Notes".
// That page contains one subpage per level (A1/A2/B1/B2 Course Notes) plus
// general grammar-topic pages (Cases, Satz Struktur, …). The Notes view reads
// this page's subpages directly, so adding a subpage in Notion makes it appear
// in the app automatically — no code change needed.
//
//   https://umairkhawaja.notion.site/German-Notes-36af11d2d82181c38df8f4389657061d
//
// The proxy URL is read from the VITE_NOTION_PROXY_URL env variable.
// See worker/notion-proxy.js for the one-time Cloudflare Worker setup.

export const NOTION_PROXY_URL = import.meta.env.VITE_NOTION_PROXY_URL ?? null;

// The "German Notes" root page (the 32-char hex from its URL).
export const NOTION_ROOT_PAGE_ID = "36af11d2d82181c38df8f4389657061d";

// Level tabs, in display order. A subpage is assigned to a level when its title
// starts with one of these tokens (e.g. "A1 Course Notes" → A1). Subpages that
// match no level are grouped under GENERAL_LABEL.
export const NOTE_LEVELS = ["A1", "A2", "B1", "B2"];
export const GENERAL_LABEL = "Grammar";
