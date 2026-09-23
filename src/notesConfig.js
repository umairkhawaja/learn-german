// Grammar notes are read live from a single Notion page: "German Notes".
// That page contains numbered topic subpages ("01 · Das Alphabet …",
// "05 · Die Fälle …", …) covering A1–B2. The Notes view reads
// this page's subpages directly, so adding a subpage in Notion makes it appear
// in the app automatically — no code change needed.
//
//   https://app.notion.com/p/umairkhawaja/German-Notes-3e4f11d2d821814a8b60d4de3c7f200f
//
// The proxy URL is read from the VITE_NOTION_PROXY_URL env variable.
// See worker/notion-proxy.js for the one-time Cloudflare Worker setup.

export const NOTION_PROXY_URL = import.meta.env.VITE_NOTION_PROXY_URL ?? null;

// The "German Notes" root page (the 32-char hex from its URL).
export const NOTION_ROOT_PAGE_ID = "3e4f11d2d821814a8b60d4de3c7f200f";

// Level tabs, in display order. A subpage is assigned to a level only when its
// title STARTS with one of these tokens (e.g. "A1 Course Notes" → A1). Other
// subpages (e.g. the numbered topic pages, which carry a "[A1–A2]" range tag
// at the end) are kept in Notion order under GENERAL_LABEL.
export const NOTE_LEVELS = ["A1", "A2", "B1", "B2"];
export const GENERAL_LABEL = "Topics";
