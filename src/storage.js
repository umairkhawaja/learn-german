// Storage adapter — replaces the claude.ai-only `window.storage`.
// Backed by IndexedDB (more durable than localStorage on iOS).
// Preserves the exact async surface the app already awaits.
import { get, set, del, keys } from "idb-keyval";

export const storage = {
  async get(key) {
    const v = await get(key);
    return v === undefined ? null : { value: v };
  },
  async set(key, value) { await set(key, value); },
  async delete(key) { await del(key); },
  async list(prefix) {
    const ks = await keys();
    return ks.filter((k) => !prefix || String(k).startsWith(prefix));
  },
};
