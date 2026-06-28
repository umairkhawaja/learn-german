// ── Quiz engine: question building + session selection ────────
import { keyOf, isMastered } from "./progress";
import { lvlOf } from "../config/levels";

export const SESSION_LEN = 10;

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function distractors(pool, correct, accessor, n = 3) {
  const get = typeof accessor === "function" ? accessor : (x) => x[accessor];
  const seen = new Set([correct]);
  const out = [];
  for (const it of shuffle(pool)) {
    const v = get(it);
    if (v && !seen.has(v) && String(v).trim() !== "" && v !== "–") {
      seen.add(v);
      out.push(v);
      if (out.length >= n) break;
    }
  }
  return out;
}

export function mcq(prompt, sub, answer, options) {
  return {
    prompt,
    sub,
    answer,
    options: shuffle([...new Set([answer, ...options])]).filter(Boolean),
  };
}

// ── Single-category session (spaced repetition) ───────────────
export function pickSession(pool, progress, catId, focusWeak) {
  let candidates = pool;
  if (focusWeak) {
    const weak = pool.filter((it) => {
      const p = progress[keyOf(catId, it)];
      return !p || p.mastery < 3;
    });
    if (weak.length >= 4) candidates = weak;
  }
  // weight: weaker / unseen words appear more often
  const weighted = candidates.map((it) => {
    const p = progress[keyOf(catId, it)];
    const m = p ? p.mastery : 0;
    let w = 5 - m + 1; // 1..6
    if (!p || !p.total) w += 3; // unseen boost
    return { it, w };
  });
  return weightedSample(weighted, SESSION_LEN);
}

// ── Cross-category "due today" review (SRS schedule) ──────────
// Gathers items from every category whose `due` timestamp has passed
// (or that have never been scheduled), weighted by how overdue they
// are. Each result carries its category + a translation question so
// QuizRunner can render a mixed deck.
export function pickDueReview(db, categories, progress, levelFilter) {
  const now = Date.now();
  const weighted = [];
  for (const cat of categories) {
    const pool = db[cat.key] || [];
    for (const it of pool) {
      if (levelFilter !== "All" && lvlOf(it) !== levelFilter) continue;
      const p = progress[keyOf(cat.id, it)];
      if (!p || isMastered(p)) continue; // only practised, not-yet-mastered words
      if (p.due && p.due > now) continue; // not due yet
      const overdueDays = p.due ? Math.max(0, (now - p.due) / 86400000) : 1;
      weighted.push({ it: { it, cat }, w: 1 + Math.min(overdueDays, 30) });
    }
  }
  const picked = weightedSample(weighted, SESSION_LEN);
  return picked.map(({ it, cat }) => {
    const mode = cat.modes[0]; // translation
    return { item: it, cat, question: mode.build(it, db[cat.key]) };
  });
}

export function dueCount(db, categories, progress, levelFilter) {
  const now = Date.now();
  let n = 0;
  for (const cat of categories) {
    for (const it of db[cat.key] || []) {
      if (levelFilter !== "All" && lvlOf(it) !== levelFilter) continue;
      const p = progress[keyOf(cat.id, it)];
      if (p && !isMastered(p) && (!p.due || p.due <= now)) n++;
    }
  }
  return n;
}

// Weighted sampling without replacement (shared by both pickers).
function weightedSample(weighted, count) {
  const out = [];
  const used = new Set();
  const n = Math.min(count, weighted.length);
  let guard = 0;
  while (out.length < n && guard < 4000) {
    guard++;
    const total = weighted.reduce((s, x, i) => (used.has(i) ? s : s + x.w), 0);
    if (total <= 0) break;
    let r = Math.random() * total;
    for (let i = 0; i < weighted.length; i++) {
      if (used.has(i)) continue;
      r -= weighted[i].w;
      if (r <= 0) {
        used.add(i);
        out.push(weighted[i].it);
        break;
      }
    }
  }
  return out;
}
