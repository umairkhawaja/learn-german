// ── Mixed view: the default practice mode, and the daily plan ──
//
// Three ways to practise, in the order you should reach for them:
//
//   🎯 Daily   the plan your goal asks for — the new words still owed today
//              (goal − learned so far) plus the reviews the schedule says are
//              due. It is a finite deck with a finish line, which is the whole
//              point: "ten new words a day" is a promise the app can keep, and
//              a forty-card deck of whatever-came-up is not. Built by
//              engine/quiz.dailyPlan.
//   ↻ Review   only the words whose spacing interval has elapsed.
//   🎲 Free    the old fixed-size deck (20/40/60) for when you just want to
//              keep going past the plan.
//
// Whichever mode, the cards are drawn across nouns, verbs, adjectives and
// grammar at once — the whole chosen level, or every level when the switcher
// is on "All" — because the per-category Quiz tab walks each data file in
// order, and with 2 200+ nouns against ~150 grammar entries the practice you
// actually get there is the first page of nouns, over and over. The draw is
// weighted (MIXED_CATEGORY_WEIGHTS): nouns and verbs are what you need to
// speak, so they carry the deck, while grammar, phrases and "other" are
// smaller details and only get a sprinkle.
//
// The deck in play is saved (see SESSION_KEY below), so leaving for another
// tab and coming back resumes on the card you were on instead of dealing a
// fresh deck.
//
// Cards are graded like the Chunks tab (reveal → "Nochmal üben" /
// "Gewusst ✓") and write into the shared progress map under each word's
// own category id, so mastery is the same data the Quiz, Browse and
// Stats tabs read — practising here counts everywhere. The first answer on a
// word also stamps it with today's date, which is what the daily goal counts.
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { COLORS, TXT, MUTE, FAINT } from "../config/theme";
import { lvlOf, levelMeta } from "../config/levels";
import { CATEGORIES } from "../config/categories";
import { keyOf, applyAnswer, saveProgress, isMastered, MASTERY_THRESHOLD } from "../engine/progress";
import { pickMixedDeck, dailyPlan, mixedPool, MIXED_DECK_SIZE, MIXED_CATEGORY_IDS } from "../engine/quiz";
import { dayKey } from "../engine/activity";
import { storage } from "../storage";
import { SpeakBtn, ProgressBar, MasterBtn, ExampleLine, isTypingTarget } from "./ui";

const ACCENT = "#a855f7";
const DUE = "#38bdf8";
const GOAL = "#34d399";
const DECK_SIZES = [20, 40, 60];
// Review mode deals every due word, not a slice of them — but a return after
// a fortnight away can leave hundreds due, and a 400-card deck is not a
// session anyone finishes. The rest keep their place at the front of the
// queue for the next one.
const REVIEW_DECK_MAX = 60;
const PREFS_KEY = "dm-mixed-prefs-v1";
const SESSION_KEY = "dm-mixed-session-v1";

const MODES = [
  { id: "daily", label: "Daily", icon: "🎯", color: GOAL, title: "Today's plan: the new words your goal still owes, plus the reviews that are due" },
  { id: "review", label: "Review", icon: "↻", color: DUE, title: "Only the words whose review is due" },
  { id: "free", label: "Free", icon: "🎲", color: ACCENT, title: "A fixed-size deck, drawn across the level" },
];

// ── Deck session persistence ──────────────────────────────────
// Switching tabs unmounts this view, so without this the deck would be
// rebuilt from card 1 every time you looked at Stats or the Spickzettel
// and came back. The live session is mirrored into a module-level cache
// (instant restore on a tab switch) and into storage (restore after a
// reload or an app restart), keyed by the scope it was drawn for — a
// different level, mode or category set is a different deck, so changing any
// of those still deals a fresh one.
//
// The daily scope carries the calendar day and the goal: today's plan is
// today's, and it is re-dealt at midnight or when the goal changes, but never
// under you mid-session.
let sessionCache = null;

const scopeOf = (mode, levelFilter, size, catIds, goal) => {
  const tail = mode === "free" ? `size:${size}` : mode === "daily" ? `${dayKey()}:g${goal}` : "due";
  return `${mode}|${levelFilter}|${tail}|${[...catIds].sort().join(",")}`;
};

// Sessions store { catId, w } refs, not the item objects themselves —
// the objects come back from the freshly fetched db on the next load.
const packEntry = ({ item, cat }) => ({ c: cat.id, w: item.w });

function snapshot(scope, deck, idx, revealed, results, done, meta) {
  return {
    scope,
    idx, revealed, done, meta,
    deck: deck.map(packEntry),
    results: results.map((r) => ({ ...packEntry(r), ok: r.ok })),
  };
}

// Turn a stored session back into live { item, cat } entries. Returns
// null if anything no longer resolves (the data file changed under it),
// in which case the caller just deals a new deck.
function rehydrate(saved, db) {
  if (!saved || !Array.isArray(saved.deck) || saved.deck.length === 0) return null;
  const index = new Map();
  for (const cat of CATEGORIES) {
    const byWord = new Map((db[cat.key] || []).map((it) => [it.w, it]));
    index.set(cat.id, { cat, byWord });
  }
  const unpack = (ref) => {
    const bucket = index.get(ref.c);
    const item = bucket && bucket.byWord.get(ref.w);
    return item ? { item, cat: bucket.cat } : null;
  };
  const deck = saved.deck.map(unpack);
  if (deck.some((e) => !e)) return null;
  const results = (saved.results || [])
    .map((r) => { const e = unpack(r); return e && { ...e, ok: !!r.ok }; })
    .filter(Boolean);
  return {
    deck,
    results,
    meta: saved.meta || null,
    idx: Math.min(Math.max(saved.idx | 0, 0), deck.length - 1),
    revealed: !!saved.revealed,
    done: !!saved.done,
  };
}

export function MixedView({ db, progress, setProgress, levelFilter, recordAnswer, goal, learnedToday }) {
  const [catIds, setCatIds] = useState(MIXED_CATEGORY_IDS);
  const [size, setSize] = useState(MIXED_DECK_SIZE);
  const [flipped, setFlipped] = useState(false); // true → English side first
  const [mode, setMode] = useState("daily");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  const [deck, setDeck] = useState([]);          // [{ item, cat }]
  const [meta, setMeta] = useState(null);        // daily plan numbers, for the strip
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState([]);    // [{ item, cat, ok }]
  const [done, setDone] = useState(false);

  const progressRef = useRef(progress);
  progressRef.current = progress;
  // The deck is dealt from a callback, and "how many words are still owed
  // today" has to be read at that moment, not captured when the callback was
  // built — otherwise a second deck in the same session re-deals the words
  // the first one already covered.
  const learnedRef = useRef(learnedToday);
  learnedRef.current = learnedToday;

  // The session waiting to be restored, read once during boot below and
  // consumed by the deck effect. Held in a ref so restoring never races
  // a re-render.
  const pendingSession = useRef(null);
  // Size of the deck last *applied* (restored or dealt). The persist
  // effect below runs in the same commit as the one that applies a deck,
  // when `deck` still holds the previous value — this ref tells the two
  // apart, so an empty deck only clears the stored session when the deck
  // really is empty (everything mastered) and not mid-restore.
  const appliedLen = useRef(-1);

  // Deck settings and the in-flight deck survive a reload — this is the
  // tab the app opens on.
  useEffect(() => {
    let alive = true;
    const readPrefs = storage.get(PREFS_KEY).then((r) => {
      if (!alive) return;
      try {
        const p = r && r.value ? JSON.parse(r.value) : null;
        if (p) {
          if (Array.isArray(p.catIds) && p.catIds.length) setCatIds(p.catIds);
          if (DECK_SIZES.includes(p.size)) setSize(p.size);
          if (typeof p.flipped === "boolean") setFlipped(p.flipped);
          // `dueOnly` is the pre-modes preference; someone who left Review on
          // still means Review.
          if (MODES.some((m) => m.id === p.mode)) setMode(p.mode);
          else if (p.dueOnly) setMode("review");
        }
      } catch { }
    }).catch(() => { });

    // A tab switch finds the session still in memory; a cold start has to
    // go to storage for it.
    const readSession = sessionCache
      ? Promise.resolve(sessionCache)
      : storage.get(SESSION_KEY)
        .then((r) => { try { return r && r.value ? JSON.parse(r.value) : null; } catch { return null; } })
        .catch(() => null);

    Promise.all([readPrefs, readSession]).then(([, saved]) => {
      if (!alive) return;
      pendingSession.current = saved;
      setPrefsLoaded(true);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!prefsLoaded) return;
    storage.set(PREFS_KEY, JSON.stringify({ catIds, size, flipped, mode })).catch(() => { });
  }, [prefsLoaded, catIds, size, flipped, mode]);

  // Everything still practisable under the current filters. Recomputed on
  // every answer (cheap) — but the deck itself is *not*, or it would
  // reshuffle under you mid-round.
  const pool = useMemo(
    () => mixedPool(db, CATEGORIES, progress, levelFilter, catIds),
    [db, progress, levelFilter, catIds]
  );

  // How many of *these* words are due, and how many have never been met. The
  // header's due count is app-wide, so using it here would offer "Review 5"
  // and then deal two cards, or claim nothing is due while the categories you
  // switched off are full of reviews.
  const { dueCount, freshCount } = useMemo(() => {
    const now = Date.now();
    let due = 0, fresh = 0;
    for (const { item, cat } of pool) {
      const p = progress[keyOf(cat.id, item)];
      if (!p || !p.total) { fresh++; continue; }
      if (p.due == null || p.due <= now) due++;
    }
    return { dueCount: due, freshCount: fresh };
  }, [pool, progress]);

  const goalLeft = Math.max(0, goal - learnedToday);
  const goalMet = learnedToday >= goal;
  const scope = scopeOf(mode, levelFilter, size, catIds, goal);

  const dealDeck = useCallback(({ bonus = false } = {}) => {
    let next = [], nextMeta = null;
    if (mode === "daily") {
      const plan = dailyPlan(db, CATEGORIES, progressRef.current, levelFilter, {
        goal, learnedToday: learnedRef.current, catIds, bonus,
      });
      next = plan.deck;
      nextMeta = { fresh: plan.fresh, reviews: plan.reviews, dueTotal: plan.dueTotal, shortfall: plan.shortfall, bonus };
    } else if (mode === "review") {
      next = pickMixedDeck(db, CATEGORIES, progressRef.current, levelFilter, { size: REVIEW_DECK_MAX, catIds, dueOnly: true });
    } else {
      next = pickMixedDeck(db, CATEGORIES, progressRef.current, levelFilter, { size, catIds });
    }
    appliedLen.current = next.length;
    setDeck(next); setMeta(nextMeta);
    setIdx(0); setRevealed(false); setResults([]); setDone(false);
  }, [db, levelFilter, mode, size, catIds, goal]);

  // Restore the deck you were on, or build one when there is nothing to
  // come back to. Runs on mount and whenever the scope changes — a new
  // level, mode, size, goal or day always means a fresh deck.
  useEffect(() => {
    if (!prefsLoaded) return;
    const saved = pendingSession.current;
    pendingSession.current = null;
    if (saved && saved.scope === scope) {
      const live = rehydrate(saved, db);
      if (live) {
        appliedLen.current = live.deck.length;
        setDeck(live.deck); setMeta(live.meta); setIdx(live.idx); setRevealed(live.revealed);
        setResults(live.results); setDone(live.done);
        return;
      }
    }
    dealDeck();
    // `scope` is what actually decides a rebuild; dealDeck changes with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefsLoaded, scope, db]);

  // Mirror the live session out, so leaving the tab (or the app) and
  // coming back resumes on the same card rather than dealing again.
  useEffect(() => {
    if (!prefsLoaded) return;
    if (deck.length === 0) {
      // Nothing left to practise — drop the stored session so the empty
      // state isn't replaced by a stale deck on the next visit.
      if (appliedLen.current === 0) {
        sessionCache = null;
        storage.delete(SESSION_KEY).catch(() => { });
      }
      return;
    }
    const snap = snapshot(scope, deck, idx, revealed, results, done, meta);
    sessionCache = snap;
    storage.set(SESSION_KEY, JSON.stringify(snap)).catch(() => { });
  }, [prefsLoaded, scope, deck, meta, idx, revealed, results, done]);

  const write = useCallback((cat, item, updater) => {
    const k = keyOf(cat.id, item);
    const np = { ...progressRef.current, [k]: updater(progressRef.current[k]) };
    setProgress(np);
    saveProgress(np);
  }, [setProgress]);

  const advance = useCallback(() => {
    if (idx + 1 >= deck.length) setDone(true);
    else { setIdx(idx + 1); setRevealed(false); }
  }, [idx, deck.length]);

  const grade = useCallback((ok) => {
    const entry = deck[idx];
    if (!entry) return;
    write(entry.cat, entry.item, (prev) => applyAnswer(prev, ok));
    recordAnswer?.(1);
    setResults((r) => [...r, { ...entry, ok }]);
    advance();
  }, [deck, idx, write, advance, recordAnswer]);

  const toggleMaster = useCallback((cat, item) => {
    write(cat, item, (prev) => ({ mastery: 0, correct: 0, total: 0, ...(prev || {}), skip: !(prev && prev.skip) }));
  }, [write]);

  // keyboard: space reveals, then 1 = again, 2 = knew it.
  //
  // Space used to *also* grade the card as known once revealed, which is not
  // what the hint says and meant a second tap of the reveal key silently
  // marked a word correct — the one input in the app that could log an answer
  // you never gave.
  useEffect(() => {
    const onKey = (e) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (done) { if (e.key === "Enter") { dealDeck(); e.preventDefault(); } return; }
      if (!revealed) {
        if (e.key === " " || e.key === "Enter") { setRevealed(true); e.preventDefault(); }
      } else if (e.key === "1") { grade(false); e.preventDefault(); }
      else if (e.key === "2") { grade(true); e.preventDefault(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, done, grade, dealDeck]);

  const toggleCat = (id) => {
    setCatIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      return next.length ? next : prev; // never leave the deck with no source
    });
  };

  // How the current deck splits across the word types — the proof that
  // the mix is genuinely mixed.
  const mix = useMemo(() => {
    const by = new Map();
    for (const { cat } of deck) by.set(cat.id, (by.get(cat.id) || 0) + 1);
    return CATEGORIES.filter((c) => by.has(c.id)).map((c) => ({ cat: c, n: by.get(c.id) }));
  }, [deck]);

  const modeColor = (MODES.find((m) => m.id === mode) || MODES[0]).color;

  // ── The goal strip ────────────────────────────────────────
  // What today asks for and how much of it is done, above the deck rather
  // than buried in Stats: the number the deck was *built* from should be
  // visible while you work through it.
  const goalStrip = (
    <div style={{ background: "#121212", border: `1px solid ${goalMet ? GOAL : ACCENT}33`, borderRadius: 12, padding: "11px 13px", marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.txtStrong }}>
          {goalMet ? "🎯 Goal met today" : "🎯 Today's goal"}
        </span>
        <span style={{ fontSize: 12.5, color: goalMet ? COLORS.successText : MUTE, fontVariantNumeric: "tabular-nums" }}>
          <b style={{ color: goalMet ? COLORS.successText : ACCENT }}>{learnedToday}</b>/{goal} new words
        </span>
      </div>
      <div style={{ height: 6, background: "#1b1b1b", borderRadius: 999, overflow: "hidden", marginTop: 8 }}
        role="progressbar" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(learnedToday, goal)}
        aria-label={`${learnedToday} of ${goal} new words learned today`}>
        <div style={{ width: `${goal ? Math.min(100, (learnedToday / goal) * 100) : 0}%`, height: "100%", borderRadius: 999, background: goalMet ? COLORS.success : ACCENT, transition: "width .4s" }} />
      </div>
      {meta && (
        <div style={{ fontSize: 11.5, color: FAINT, marginTop: 7, lineHeight: 1.5 }}>
          {meta.bonus ? "Extra round: " : "This deck: "}
          <b style={{ color: ACCENT }}>{meta.fresh}</b> new
          {meta.reviews > 0 && <> · <b style={{ color: DUE }}>{meta.reviews}</b> review{meta.reviews === 1 ? "" : "s"}</>}
          {meta.dueTotal > meta.reviews && <span> · {meta.dueTotal - meta.reviews} more due after this</span>}
          {meta.shortfall > 0 && (
            <span style={{ color: COLORS.warn }}>
              {" "}· {meta.shortfall} short — no unseen words left in this level and these word types
            </span>
          )}
        </div>
      )}
    </div>
  );

  // ── Controls ──────────────────────────────────────────────
  // The deck settings used to be permanently open, and on a phone the six
  // category chips, three deck sizes and three toggles pushed the card itself
  // below the fold: you had to scroll past the configuration to reach the
  // thing you came to do. They collapse behind one line now — what the deck
  // is made of stays visible, how to change it is one tap away.
  const controls = (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div role="group" aria-label="Practice mode" style={{ display: "flex", gap: 3, background: COLORS.surfaceAlt, borderRadius: 9, padding: 3 }}>
          {MODES.map((m) => {
            const on = mode === m.id;
            const badge = m.id === "review" && dueCount > 0 ? ` ${dueCount}` : m.id === "daily" && !goalMet ? ` ${goalLeft}` : "";
            return (
              <button key={m.id} onClick={() => setMode(m.id)} aria-pressed={on} title={m.title}
                style={{
                  padding: "6px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12,
                  background: on ? m.color : "transparent", color: on ? "#0b0b0b" : MUTE, fontWeight: on ? 800 : 500,
                }}>
                <span aria-hidden="true">{m.icon}</span> {m.label}{badge}
              </button>
            );
          })}
        </div>
        <button onClick={() => setSettingsOpen((v) => !v)} aria-expanded={settingsOpen}
          title="Deck settings: word types, size, direction"
          style={{ padding: "6px 10px", borderRadius: 9, border: `1px solid ${COLORS.borderSoft}`, background: COLORS.surfaceAlt, color: MUTE, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
          ⚙ {settingsOpen ? "▾" : "▸"}
        </button>
        <button onClick={() => dealDeck()} title={mode === "daily" ? "Re-deal what's left of today's plan" : "Draw a fresh deck"}
          style={{ padding: "6px 10px", borderRadius: 9, border: `1px solid ${COLORS.borderSoft}`, background: COLORS.surfaceAlt, color: MUTE, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
          ⟳ Re-deal
        </button>
      </div>

      {settingsOpen && (
        <div className="dm-reveal" style={{ marginTop: 10 }}>
          {/* Grid, not a wrapping flex row: with six categories the last chip
              would otherwise stretch across a whole row of its own. */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(105px, 1fr))", gap: 6, marginBottom: 8 }}>
            {CATEGORIES.map((c) => {
              const on = catIds.includes(c.id);
              const n = (db[c.key] || []).filter(
                (x) => (levelFilter === "All" || lvlOf(x) === levelFilter) && !isMastered(progress[keyOf(c.id, x)])
              ).length;
              return (
                <button key={c.id} onClick={() => toggleCat(c.id)} aria-pressed={on}
                  title={on ? `${c.label} in the deck — click to drop` : `Add ${c.label} to the deck`}
                  style={{
                    padding: "7px 4px", borderRadius: 10, minWidth: 0,
                    border: `1.5px solid ${on ? c.color : "#222"}`, background: on ? c.color + "18" : "#111",
                    cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
                  }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: on ? c.color : "#4a4f59" }}>{c.label}</span>
                  <span style={{ fontSize: 9.5, color: on ? c.color + "88" : "#2f2f2f" }}>{n.toLocaleString()} left</span>
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {/* Deck size belongs to Free alone: in Daily the size *is* the
                goal, and in Review it is however many words are due. */}
            {mode === "free" && (
              <div role="group" aria-label="Deck size" style={{ display: "flex", gap: 3, background: COLORS.surfaceAlt, borderRadius: 9, padding: 3 }}>
                {DECK_SIZES.map((sz) => (
                  <button key={sz} onClick={() => setSize(sz)} aria-pressed={size === sz}
                    style={{
                      padding: "5px 11px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12,
                      background: size === sz ? ACCENT : "transparent", color: size === sz ? "#fff" : MUTE, fontWeight: size === sz ? 700 : 400,
                    }}>
                    {sz}
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setFlipped(!flipped)} title="Swap which side of the card you see first" aria-pressed={flipped}
              style={{ padding: "6px 10px", borderRadius: 9, border: `1px solid ${flipped ? ACCENT : COLORS.borderSoft}`, background: flipped ? ACCENT + "22" : COLORS.surfaceAlt, color: flipped ? ACCENT : MUTE, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
              {flipped ? "EN → DE" : "DE → EN"}
            </button>
          </div>
        </div>
      )}

      <div style={{ fontSize: 12, color: MUTE, marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <span>
          {mode === "daily" ? "🎯 Today's deck of " : mode === "review" ? "↻ Review deck of " : "🎲 Deck of "}
          <b style={{ color: modeColor }}>{deck.length}</b>
        </span>
        {mix.map(({ cat, n }) => (
          <span key={cat.id} style={{ color: cat.color }}>· {n} {cat.label.toLowerCase()}</span>
        ))}
        <span style={{ color: FAINT }}>
          · from {mode === "review" ? `${dueCount.toLocaleString()} due` : `${pool.length.toLocaleString()} unmastered`}{" "}
          {levelFilter === "All" ? "words (all levels)" : `${levelFilter} words`}
        </span>
      </div>
    </div>
  );

  const head = (
    <>
      {controls}
      {mode === "daily" && goalStrip}
    </>
  );

  // ── Empty state ──
  if (deck.length === 0) {
    // In Daily an empty deck is usually the good kind of empty: the goal is
    // met and nothing is due. Say which it is rather than "nothing to
    // practise", and offer the one thing worth doing next.
    const dailyDone = mode === "daily" && goalMet;
    const outOfWords = mode === "daily" && !goalMet && freshCount === 0;
    return (
      <div>{head}
        <div style={{ background: "#131313", border: `1px solid ${(dailyDone ? GOAL : mode === "review" ? DUE : ACCENT)}33`, borderRadius: 16, padding: "26px 22px", textAlign: "center" }}>
          <div style={{ fontSize: 40 }}>{dailyDone ? "🎉" : mode === "review" ? "✅" : outOfWords ? "📭" : "🏆"}</div>
          <div style={{ fontSize: 19, fontWeight: 800, color: COLORS.txtStrong, margin: "8px 0 4px" }}>
            {dailyDone ? `${learnedToday} new words today — done` :
              outOfWords ? "No unseen words left here" :
                mode === "review" ? "No reviews due" : "Nothing left to practise"}
          </div>
          <div style={{ fontSize: 13, color: MUTE, marginBottom: 16 }}>
            {dailyDone ? "Goal met and no reviews are due. Come back tomorrow, or take an extra round now."
              : outOfWords ? "Every word in this level and these word types has been introduced. Switch level, add a word type, or keep the reviews going."
                : mode === "review" ? "Nothing in these word types is due yet. Switch to Daily to meet new words, or add a word type above."
                  : "Every word in this level and these categories is mastered — switch level, or add a category above."}
          </div>
          {dailyDone && (
            <button onClick={() => dealDeck({ bonus: true })}
              style={{ background: GOAL, border: "none", borderRadius: 10, padding: "11px 20px", color: "#0b0b0b", fontSize: 13.5, fontWeight: 800, cursor: "pointer" }}>
              Another {goal} words →
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Deck summary ──
  if (done) {
    const score = results.filter((r) => r.ok).length;
    const missed = results.filter((r) => !r.ok);
    const pct = results.length ? Math.round((score / results.length) * 100) : 0;
    const daily = mode === "daily";
    return (
      <div>{head}
        <div className="dm-reveal" style={{ textAlign: "center", paddingTop: 8 }}>
          <div style={{ fontSize: 13, color: MUTE, letterSpacing: 1, textTransform: "uppercase" }}>
            {daily ? (goalMet ? "Daily goal complete" : "Deck complete") : "Deck complete"}
          </div>
          <div style={{ fontSize: 56, fontWeight: 800, color: daily && goalMet ? GOAL : ACCENT, margin: "6px 0", letterSpacing: "-1px" }}>{score}/{results.length}</div>
          <div style={{ fontSize: 14, color: MUTE, marginBottom: 22 }}>
            {daily
              ? <>{learnedToday}/{goal} new words today{goalMet ? " 🎯" : ` · ${goalLeft} to go`} · {pct}% recalled</>
              : <>{pct}% recalled{score === results.length ? " · perfect! 🎉" : ""} · {MASTERY_THRESHOLD}★ retires a word</>}
          </div>
          {missed.length > 0 && (
            <div style={{ textAlign: "left", background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14, marginBottom: 18 }}>
              <div style={{ fontSize: 12, color: FAINT, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Review ({missed.length})</div>
              {missed.map(({ item: m, cat: mc }, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "5px 0", borderTop: i ? "1px solid #1f1f1f" : "none" }}>
                  <div style={{ minWidth: 0 }}>
                    <b style={{ color: COLORS.txtStrong }}>{m.w}</b>{" "}
                    <span style={{ color: MUTE, fontSize: 13 }}>— {m.e}</span>{" "}
                    <span style={{ color: mc.color, fontSize: 11 }}>{mc.label}</span>
                  </div>
                  <SpeakBtn text={mc.german(m)} color={mc.color} size={26} />
                </div>
              ))}
            </div>
          )}
          {/* In Daily the next step depends on what is left: finish the goal,
              take the reviews that didn't fit, or stop for the day. */}
          {daily && !goalMet && freshCount > 0 ? (
            <button onClick={() => dealDeck()}
              style={{ width: "100%", background: ACCENT, border: "none", borderRadius: 12, padding: "13px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              Continue — {goalLeft} word{goalLeft === 1 ? "" : "s"} to go →
            </button>
          ) : daily ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => dealDeck({ bonus: true })} disabled={freshCount === 0}
                style={{ flex: 1, minWidth: 150, background: freshCount === 0 ? COLORS.surfaceAlt : GOAL, border: "none", borderRadius: 12, padding: "13px", color: freshCount === 0 ? FAINT : "#0b0b0b", fontSize: 14, fontWeight: 800, cursor: freshCount === 0 ? "default" : "pointer" }}>
                Another {goal} words →
              </button>
              {dueCount > 0 && (
                <button onClick={() => setMode("review")}
                  style={{ flex: 1, minWidth: 150, background: "transparent", border: `1px solid ${DUE}66`, borderRadius: 12, padding: "13px", color: DUE, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                  ↻ Review {dueCount} due
                </button>
              )}
            </div>
          ) : (
            <button onClick={() => dealDeck()}
              style={{ width: "100%", background: ACCENT, border: "none", borderRadius: 12, padding: "13px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              New deck →
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Active card ──
  const { item: it, cat } = deck[idx];
  const p = progress[keyOf(cat.id, it)];
  const isNew = !p || !p.total;
  const lm = levelMeta(lvlOf(it));
  const front = flipped ? it.e : it.w;
  const back = flipped ? it.w : it.e;

  return (
    <div>
      {head}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <ProgressBar value={(idx / deck.length) * 100} color={modeColor} />
        <span style={{ fontSize: 12, color: FAINT, fontVariantNumeric: "tabular-nums" }}>{idx + 1}/{deck.length}</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, fontSize: 12.5 }}>
        <span style={{ color: cat.color, fontWeight: 700 }}>
          {cat.label}
          {/* Which kind of card this is, because in the daily deck it decides
              what the card is *for*: a new word counts toward the goal, a
              review is one you are keeping. */}
          <span style={{ marginLeft: 7, fontSize: 11, fontWeight: 700, color: isNew ? ACCENT : DUE }}>
            {isNew ? "NEW" : "REVIEW"}
          </span>
        </span>
        <span style={{ color: lm.color, fontWeight: 700 }}>{lm.code}</span>
      </div>

      <div onClick={() => !revealed && setRevealed(true)}
        style={{ background: "#131313", border: `1px solid ${cat.color}33`, borderRadius: 16, padding: "26px 20px", minHeight: 190, cursor: revealed ? "default" : "pointer", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: COLORS.txtStrong, textAlign: "center", lineHeight: 1.25, minWidth: 0, overflowWrap: "anywhere" }}>{front}</div>
          {!flipped && <SpeakBtn text={cat.german(it)} color={cat.color} />}
        </div>

        {!revealed ? (
          <div style={{ fontSize: 12.5, color: FAINT, textAlign: "center", marginTop: 18 }}>Tap to reveal · Space</div>
        ) : (
          <div className="dm-reveal" style={{ marginTop: 16, borderTop: "1px solid #222", paddingTop: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 17, color: TXT, fontWeight: 600, textAlign: "center", minWidth: 0, overflowWrap: "anywhere" }}>{back}</div>
              {flipped && <SpeakBtn text={cat.german(it)} color={cat.color} />}
            </div>
            {it.ex && !Array.isArray(it.ex) && <ExampleLine text={it.ex} style={{ marginTop: 10, textAlign: "center" }} />}
            {cat.detail(it)}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 14 }}>
              <span style={{ fontSize: 11.5, color: FAINT }}>{"★".repeat(p?.mastery || 0) || "not started"}</span>
              <MasterBtn isSkipped={!!p?.skip} onToggle={() => { toggleMaster(cat, it); advance(); }} />
            </div>
          </div>
        )}
      </div>

      {revealed ? (
        <div className="dm-reveal dm-grade-bar" style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={() => grade(false)}
            style={{ flex: 1, background: "#2a0f0f", color: COLORS.dangerText, border: `1px solid ${COLORS.danger}66`, borderRadius: 10, padding: "13px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            Nochmal üben
          </button>
          <button onClick={() => grade(true)}
            style={{ flex: 1, background: ACCENT, color: "#fff", border: "none", borderRadius: 10, padding: "13px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
            Gewusst ✓
          </button>
        </div>
      ) : (
        <button onClick={() => setRevealed(true)}
          style={{ width: "100%", marginTop: 12, background: COLORS.surfaceAlt, color: MUTE, border: `1px solid ${COLORS.borderSoft}`, borderRadius: 10, padding: "13px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          Show meaning
        </button>
      )}

      <div style={{ textAlign: "center", marginTop: 10, fontSize: 11, color: "#3a3f49" }}>
        Tip: Space to reveal · 1 = nochmal üben, 2 = gewusst
      </div>
    </div>
  );
}
