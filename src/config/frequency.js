// ── Everyday-usage ranking (the "common words first" core) ────
// Every data entry carries `f`: its rank across the whole dataset, where 1 is
// the word you are most likely to meet in everyday German. The ranks are
// derived from a spoken-German corpus by scripts/add-frequency.mjs — re-run
// `npm run data:freq` after adding words, or the new ones sort last.
//
// Why this sits next to the CEFR level instead of replacing it: the level
// says how *hard* a word is, the rank says how *often* it turns up, and they
// disagree constantly. "die Mahlzeit" and "das Angebot" are both A2 but one
// of them you hear every day; "Das wird schon." is B1 and more useful than
// most of the A1 noun list. The level filter still scopes what you practise —
// frequency decides the order inside it, so you meet the words that earn
// their keep first whichever level you are on.

// Entries added by hand before the ranker is re-run have no `f`. They sort
// last rather than first — an unranked word is unknown, not urgent.
export const UNRANKED = Number.MAX_SAFE_INTEGER;

export const rankOf = (item) =>
  item && Number.isInteger(item.f) && item.f > 0 ? item.f : UNRANKED;

export const isRanked = (item) => rankOf(item) !== UNRANKED;

// Comparator: most-used first.
export const byUsage = (a, b) => rankOf(a) - rankOf(b);

// Bands for the badge. Deliberately coarse — the exact rank of the 900th word
// is noise, "this is one of the first few hundred words worth knowing" is not.
export const USAGE_BANDS = [
  { max: 200, label: "top 200", color: "#f97316" },
  { max: 600, label: "top 600", color: "#eab308" },
  { max: 1500, label: "top 1500", color: "#64748b" },
];

export const usageBand = (item) => {
  const r = rankOf(item);
  return USAGE_BANDS.find((b) => r <= b.max) || null;
};

export const usageTitle = (item) => {
  const r = rankOf(item);
  return r === UNRANKED
    ? "Not ranked yet — run npm run data:freq"
    : `#${r.toLocaleString()} most used of everything in the app`;
};
