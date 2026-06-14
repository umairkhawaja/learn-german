const KEYS = ["adj", "verbs", "nouns", "gram", "phrases", "other"];

export async function loadDB() {
  const base = import.meta.env.BASE_URL;
  const results = await Promise.all(
    KEYS.map((k) => fetch(`${base}data/${k}.json`).then((r) => r.json()))
  );
  return Object.fromEntries(KEYS.map((k, i) => [k, results[i]]));
}
