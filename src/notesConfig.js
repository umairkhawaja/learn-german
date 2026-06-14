// Notion page IDs for each level's grammar notes.
// To add a new page: paste the ID from the URL (the 32-char hex at the end).
// To add a new level: add a key and an array of { label, pageId } objects.
//
// The proxy URL is read from the VITE_NOTION_PROXY_URL env variable.
// See worker/notion-proxy.js for the one-time Cloudflare Worker setup.

export const NOTION_PROXY_URL = import.meta.env.VITE_NOTION_PROXY_URL ?? null;

export const NOTION_PAGES = {
  A1: [
    {
      label: "A1-1 Grammar",
      pageId: "36af11d2d82181e7936cf17fd6a35fc7",
    },
    {
      label: "A1-2 Grammar",
      pageId: "36af11d2d8218136807edebb2c764850",
    },
  ],
  A2: [],
  B1: [],
};
