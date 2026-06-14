import { CATEGORY_KEYS } from "../config/categories";

// Data keys come from the category registry — adding a category there
// (with its public/data/<key>.json) is enough; no edit needed here.
export async function loadDB() {
  const base = import.meta.env.BASE_URL;
  const results = await Promise.all(
    CATEGORY_KEYS.map((k) => fetch(`${base}data/${k}.json`).then((r) => r.json()))
  );
  return Object.fromEntries(CATEGORY_KEYS.map((k, i) => [k, results[i]]));
}
