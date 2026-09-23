import { CATEGORY_KEYS } from "../config/categories";

// Data keys come from the category registry — adding a category there
// (with its public/data/<key>.json) is enough; no edit needed here.
export async function loadDB() {
  const base = import.meta.env.BASE_URL;
  const results = await Promise.all(
    // A failed fetch (offline before the service worker has cached the file,
    // or a 404 page) must reject with the file name, not with a JSON parse
    // error about "<!DOCTYPE".
    CATEGORY_KEYS.map((k) => fetch(`${base}data/${k}.json`).then((r) => {
      if (!r.ok) throw new Error(`Could not load ${k}.json (HTTP ${r.status})`);
      return r.json();
    }))
  );
  return Object.fromEntries(CATEGORY_KEYS.map((k, i) => [k, results[i]]));
}
