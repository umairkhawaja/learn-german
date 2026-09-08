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
