// ── Quiz engine: question building + session selection ────────
import { keyOf, isMastered } from "./progress";
import { lvlOf } from "../config/levels";

export const SESSION_LEN = 10;

// True when a data field is usable as a quiz answer. Entries use "" or "–"
// for forms that don't exist (countries have no article/plural, some
// adjectives have no comparative/opposite) — a mode must skip those items
// or it builds questions whose correct answer isn't among the options.
export function hasField(v) {
  return v != null && String(v).trim() !== "" && v !== "–";
}

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

// ── Chunked mastery: work a fixed-size batch of words until every
// one is mastered before the next batch is introduced ─────────
// `pool` is expected to already exclude mastered items (callers filter
// via isMastered — see QuizView). "Backlog" = words already introduced
// (attempted at least once) but not yet mastered; while any backlog
// remains, no new words are pulled in. Only once the whole backlog is
// cleared (mastered automatically or via "Mark as mastered") does the
// next chunk of brand-new words unlock, in data order.
export const CHUNK_SIZE = 10;

export function pickChunk(pool, progress, catId, chunkSize = CHUNK_SIZE) {
  const backlog = pool.filter((it) => {
    const p = progress[keyOf(catId, it)];
    return p && p.total > 0;
  });
  if (backlog.length > 0) return backlog;
  return pool.slice(0, chunkSize);
}

// ── Single-category session, scoped to the active chunk ────────
export function pickSession(pool, progress, catId, focusWeak) {
  const chunk = pickChunk(pool, progress, catId);
  let candidates = chunk;
  if (focusWeak) {
    const weak = chunk.filter((it) => {
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

// Count of already-introduced-but-not-yet-mastered words, across every
// category (subject to the level filter). Drives the "words to master"
// badge on the Quiz tab — this is the backlog that blocks new words from
// unlocking in any category that has one.
export function backlogCount(db, categories, progress, levelFilter) {
  let n = 0;
  for (const cat of categories) {
    for (const it of db[cat.key] || []) {
      if (levelFilter !== "All" && lvlOf(it) !== levelFilter) continue;
      const p = progress[keyOf(cat.id, it)];
      if (p && p.total > 0 && !isMastered(p)) n++;
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

// ── Mixed deck: one level-wide, category-balanced flashcard deck ──
// The chunked pickers above walk the data file in order, so a session
// scoped to a single category always starts at the top of that file —
// with 2 200+ nouns against ~150 grammar entries, practice collapses
// onto the first page of nouns and never reaches the rest of the level.
//
// pickMixedDeck fixes both halves of that bias:
//   • it draws from every selected category at once, round-robin, so
//     each word type is represented however lopsided the data is;
//   • within a category it samples the *whole* level pool at random
//     (ordered by SRS priority, shuffled inside each tier) instead of
//     slicing the first N entries.
// The result is a fixed-size deck — default 40 — covering the full
// scope of the chosen level (or of every level, when "All" is active).
export const MIXED_DECK_SIZE = 40;

// The four word types the mixed deck ships with. Phrases and Other can
// be switched on in the view; these are the defaults.
export const MIXED_CATEGORY_IDS = ["nouns", "verbs", "adj", "gram"];

// 0 = due for review, 1 = started but not due yet, 2 = never seen.
function srsTier(p, now) {
  if (!p || !p.total) return 2;
  return p.due == null || p.due <= now ? 0 : 1;
}

// Everything practisable right now: unmastered, in the chosen level and
// in one of the chosen categories. Returned as { item, cat } entries.
export function mixedPool(db, categories, progress, levelFilter, catIds = MIXED_CATEGORY_IDS) {
  const out = [];
  for (const cat of categories) {
    if (!catIds.includes(cat.id)) continue;
    for (const it of db[cat.key] || []) {
      if (levelFilter !== "All" && lvlOf(it) !== levelFilter) continue;
      if (isMastered(progress[keyOf(cat.id, it)])) continue;
      out.push({ item: it, cat });
    }
  }
  return out;
}

export function pickMixedDeck(
  db, categories, progress, levelFilter,
  { size = MIXED_DECK_SIZE, catIds = MIXED_CATEGORY_IDS } = {}
) {
  const now = Date.now();

  // One priority queue per category: due words first, then words already
  // started, then unseen ones — each tier shuffled so the draw spans the
  // whole level rather than the head of the file.
  const queues = [];
  for (const cat of categories) {
    if (!catIds.includes(cat.id)) continue;
    const tiers = [[], [], []];
    for (const it of db[cat.key] || []) {
      if (levelFilter !== "All" && lvlOf(it) !== levelFilter) continue;
      const p = progress[keyOf(cat.id, it)];
      if (isMastered(p)) continue;
      tiers[srsTier(p, now)].push({ item: it, cat });
    }
    const q = [...shuffle(tiers[0]), ...shuffle(tiers[1]), ...shuffle(tiers[2])];
    if (q.length) queues.push(q);
  }
  if (queues.length === 0) return [];

  // Round-robin: take the i-th word of every category before any
  // category's (i+1)-th. Categories that run dry simply drop out, so a
  // small category never caps the deck — it just stops contributing.
  const deck = [];
  for (let i = 0; deck.length < size; i++) {
    let took = false;
    for (const q of queues) {
      if (i >= q.length) continue;
      deck.push(q[i]);
      took = true;
      if (deck.length >= size) break;
    }
    if (!took) break;
  }
  return shuffle(deck);
}
