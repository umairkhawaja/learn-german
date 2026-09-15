// ── Quiz engine: question building + session selection ────────
import { keyOf, isMastered } from "./progress";
import { lvlOf } from "../config/levels";
import { byUsage, rankOf } from "../config/frequency";

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

// `promptLang` marks which language the prompt itself is in. The card sets
// lang= from it, so a screen reader and the browser's own text handling do not
// read an English prompt with German pronunciation in the EN → DE modes.
export function mcq(prompt, sub, answer, options, promptLang = "de") {
  return {
    prompt,
    sub,
    answer,
    promptLang,
    options: shuffle([...new Set([answer, ...options])]).filter(Boolean),
  };
}

// ── Common words first ────────────────────────────────────────
// Everything that introduces *new* words orders them by everyday usage
// (config/frequency), so the first thing you meet in any category is the
// word you are most likely to need — the data file's own order carries no
// meaning, and the CEFR level says how hard a word is, not how often it
// turns up.
//
// Strict rank order would deal the same cards every time, though. Sorting
// and then shuffling inside blocks keeps the common-first sweep while
// varying what lands in any one deck: block N is always met before block
// N+1, but never in the same order twice.
//
// The block is capped at a third of the pool as well as at USAGE_BLOCK. A
// fixed 24 is right for the thousands of unseen words, but a block that is
// bigger than the pool shuffles all of it and orders nothing — which is what
// was happening to the tier that matters most, the handful of reviews due
// today. Whatever the size, there are always at least three ranks of
// preference to draw from.
export const USAGE_BLOCK = 24;

export const usageBlockFor = (n) => Math.max(1, Math.min(USAGE_BLOCK, Math.ceil(n / 3)));

export function byUsageShuffled(items, itemOf = (x) => x, block = usageBlockFor(items.length)) {
  const sorted = [...items].sort((a, b) => rankOf(itemOf(a)) - rankOf(itemOf(b)));
  const out = [];
  for (let i = 0; i < sorted.length; i += block) out.push(...shuffle(sorted.slice(i, i + block)));
  return out;
}

// ── Chunked mastery: work a fixed-size batch of words until every
// one is mastered before the next batch is introduced ─────────
// `pool` is expected to already exclude mastered items (callers filter
// via isMastered — see QuizView). The batch is the `chunkSize` most-used
// unmastered words; anything already started stays in it however the batch
// shifts, so new words only appear as mastered ones drop out of `pool`.
//
// The previous version returned *only* the started words as soon as there
// were any, which collapsed the batch: answer one question and the next
// session is that single word, drilled alone until mastered, then two —
// while the view above it still said "New chunk: 10 words". ChunksView had
// already had to write its own copy of this to avoid exactly that, and now
// shares this one.
export const CHUNK_SIZE = 10;

export function pickChunk(pool, progress, catId, chunkSize = CHUNK_SIZE) {
  const started = [], fresh = [];
  for (const it of pool) {
    const p = progress[keyOf(catId, it)];
    (p && p.total > 0 ? started : fresh).push(it);
  }
  // Never shrink below the words already in play: if more than `chunkSize`
  // have been started (a wider batch from an earlier setting, or words met
  // in the Mixed deck), they all stay until they are finished.
  //
  // The fresh ones are taken most-used first (in strict order, not blocked:
  // a batch you work until mastered should be a stable set, not one that
  // reshuffles under you between sessions).
  fresh.sort(byUsage);
  return [...started, ...fresh].slice(0, Math.max(chunkSize, started.length));
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

// The two numbers the header and the tab badges report, in one pass.
//
// `backlog` is the already-introduced-but-not-yet-mastered words across every
// category, subject to the level filter — the count that gates new words
// unlocking in any category that has one.
//
// `due` is the subset of that backlog whose SRS interval has elapsed. The
// schedule in engine/progress has always been written on every answer, but
// nothing in the app ever read it back: there was no way to see that eleven
// words were ready for review today, which is the whole point of spacing
// them. Both numbers come out of one pass.
export function reviewCounts(db, categories, progress, levelFilter, now = Date.now()) {
  let backlog = 0, due = 0;
  for (const cat of categories) {
    for (const it of db[cat.key] || []) {
      if (levelFilter !== "All" && lvlOf(it) !== levelFilter) continue;
      const p = progress[keyOf(cat.id, it)];
      if (!p || !p.total || isMastered(p)) continue;
      backlog++;
      if (p.due == null || p.due <= now) due++;
    }
  }
  return { backlog, due };
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
//   • it draws from every selected category at once, in a *weighted*
//     round-robin (MIXED_CATEGORY_WEIGHTS), so each word type is
//     represented however lopsided the data is — with nouns and verbs
//     carrying the deck and grammar-type details only sprinkled in;
//   • within a category it samples the *whole* level pool (ordered by SRS
//     priority, and inside the unseen tier by everyday usage) instead of
//     slicing the first N entries.
// The result is a fixed-size deck — default 40 — covering the full
// scope of the chosen level (or of every level, when "All" is active),
// and introducing its words in the order you are likely to need them.
export const MIXED_DECK_SIZE = 40;

// The four word types the mixed deck ships with. Phrases and Other can
// be switched on in the view; these are the defaults.
export const MIXED_CATEGORY_IDS = ["nouns", "verbs", "adj", "gram"];

// How many cards a category contributes per round-robin pass. Nouns and
// verbs carry the language — they are what you actually need to speak —
// so they get the largest share; adjectives sit in the middle; grammar,
// phrases and "other" are the smaller details and only need a sprinkle.
// A default deck of 40 across the four default categories lands at
// roughly 13 nouns / 13 verbs / 9 adjectives / 5 grammar.
export const MIXED_CATEGORY_WEIGHTS = {
  nouns: 3, verbs: 3, adj: 2, gram: 1, phrases: 1, other: 1,
};

export const mixedWeightOf = (catId) => MIXED_CATEGORY_WEIGHTS[catId] || 1;

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

// `dueOnly` restricts the deck to words whose review is actually due — the
// deck a spaced-repetition app should offer first thing in the morning. Without
// it, due words are only *preferred* (tier 0 below) and get diluted by new
// ones, so a review you owe can sit unseen behind forty fresh words.
//
// `commonFirst` (the default) orders every tier by everyday usage, so you meet
// "die Zeit" long before "die Mahlzeit" however the file is arranged. Off, each
// tier is drawn at random across the level — the old behaviour, kept for when
// you want to sweep a whole level rather than work down from the top.
//
// It applies to all three tiers and not just the unseen one, which is what it
// used to do. That looked right on a new account and did nothing on a real one:
// a few weeks in you have hundreds of started-but-not-due words, they fill the
// whole deck before an unseen word is ever reached, and they were shuffled — so
// for anyone whose progress predates the ranking (built from the old, arbitrary
// file order) the setting made no measurable difference at all. Tier priority
// is still absolute — a due review always outranks a new word, that is the
// spaced repetition — usage only decides the order *within* a tier.
export function pickMixedDeck(
  db, categories, progress, levelFilter,
  { size = MIXED_DECK_SIZE, catIds = MIXED_CATEGORY_IDS, dueOnly = false, commonFirst = true } = {}
) {
  const now = Date.now();

  // One priority queue per category: due words first, then words already
  // started, then unseen ones — each tier ordered most-used first, or shuffled
  // when common-first is off. Either way the draw spans the whole level rather
  // than the head of the file.
  const order = commonFirst ? (tier) => byUsageShuffled(tier, (e) => e.item) : shuffle;
  const queues = [];
  for (const cat of categories) {
    if (!catIds.includes(cat.id)) continue;
    const tiers = [[], [], []];
    for (const it of db[cat.key] || []) {
      if (levelFilter !== "All" && lvlOf(it) !== levelFilter) continue;
      const p = progress[keyOf(cat.id, it)];
      if (isMastered(p)) continue;
      const tier = srsTier(p, now);
      if (dueOnly && tier !== 0) continue;
      tiers[tier].push({ item: it, cat });
    }
    const items = [...order(tiers[0]), ...order(tiers[1]), ...order(tiers[2])];
    if (items.length) queues.push({ items, weight: mixedWeightOf(cat.id), cursor: 0 });
  }
  if (queues.length === 0) return [];

  // Weighted round-robin: each pass takes `weight` cards from every
  // category before any category gets its next turn, so the deck lands
  // on the MIXED_CATEGORY_WEIGHTS ratio. Categories that run dry simply
  // drop out — a small category never caps the deck, it just stops
  // contributing, and the rest take up its slack.
  const deck = [];
  let took = true;
  while (deck.length < size && took) {
    took = false;
    for (const q of queues) {
      for (let k = 0; k < q.weight && q.cursor < q.items.length && deck.length < size; k++) {
        deck.push(q.items[q.cursor++]);
        took = true;
      }
      if (deck.length >= size) break;
    }
  }
  return shuffle(deck);
}
