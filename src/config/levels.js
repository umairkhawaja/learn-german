// ── Level registry (the level-extension core) ─────────────────
// To add a CEFR level: add ONE row here and tag data entries with
// `lvl:"B1"`. The level switcher, counts, filters and stats pick it
// up automatically — no engine or UI edits needed. Levels with no
// data are hidden from the switcher until entries arrive.

export const LEVELS = [
  { code: "A1", label: "Beginner",     color: "#22c55e" },
  { code: "A2", label: "Elementary",   color: "#f97316" },
  { code: "B1", label: "Intermediate", color: "#3b82f6" },
  { code: "B2", label: "Upper Int.",   color: "#a855f7" },
  { code: "C1", label: "Advanced",     color: "#ec4899" },
];

export const LEVEL_CODES = LEVELS.map((l) => l.code);

// lvl = current field; lv = legacy field; null/absent → A1.
export const lvlOf = (item) => item.lvl || item.lv || "A1";

export const levelMeta = (code) =>
  LEVELS.find((l) => l.code === code) || { code, label: code, color: "#6b7280" };

// Which levels actually have at least one entry in the given pool,
// returned in registry order.
export function levelsPresent(pool) {
  return LEVEL_CODES.filter((code) => pool.some((x) => lvlOf(x) === code));
}
