// ── Mixed view: the default practice mode ─────────────────────
// A flashcard deck of MIXED_DECK_SIZE (40) words drawn across nouns,
// verbs, adjectives and grammar at once — the whole chosen level, or
// every level when the switcher is on "All".
//
// Why this is the default: the per-category Quiz tab walks each data
// file in order, so with 2 200+ nouns against ~150 grammar entries the
// practice you actually get is the first page of nouns, over and over.
// The deck here is built by engine/quiz.pickMixedDeck, which round-
// robins the categories and samples each one at random (due words
// first), so every deck spans the full scope of the level.
//
// Cards are graded like the Chunks tab (reveal → "Nochmal üben" /
// "Gewusst ✓") and write into the shared progress map under each word's
// own category id, so mastery is the same data the Quiz, Browse and
// Stats tabs read — practising here counts everywhere.
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { COLORS, TXT, MUTE, FAINT } from "../config/theme";
import { lvlOf, levelMeta } from "../config/levels";
import { CATEGORIES } from "../config/categories";
import { keyOf, applyAnswer, saveProgress, isMastered, MASTERY_THRESHOLD } from "../engine/progress";
import { pickMixedDeck, mixedPool, MIXED_DECK_SIZE, MIXED_CATEGORY_IDS } from "../engine/quiz";
import { storage } from "../storage";
import { SpeakBtn, ProgressBar, MasterBtn, ExampleLine } from "./ui";

const ACCENT = "#a855f7";
const DECK_SIZES = [20, 40, 60];
const PREFS_KEY = "dm-mixed-prefs-v1";

export function MixedView({ db, progress, setProgress, levelFilter }) {
  const [catIds, setCatIds] = useState(MIXED_CATEGORY_IDS);
  const [size, setSize] = useState(MIXED_DECK_SIZE);
  const [flipped, setFlipped] = useState(false); // true → English side first
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  const [deck, setDeck] = useState([]);          // [{ item, cat }]
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState([]);    // [{ item, cat, ok }]
  const [done, setDone] = useState(false);

  const progressRef = useRef(progress);
  progressRef.current = progress;

  // Deck settings survive a reload — this is the tab the app opens on.
  useEffect(() => {
    let alive = true;
    storage.get(PREFS_KEY).then((r) => {
      if (!alive) return;
      try {
        const p = r && r.value ? JSON.parse(r.value) : null;
        if (p) {
          if (Array.isArray(p.catIds) && p.catIds.length) setCatIds(p.catIds);
          if (DECK_SIZES.includes(p.size)) setSize(p.size);
          if (typeof p.flipped === "boolean") setFlipped(p.flipped);
        }
      } catch { }
      setPrefsLoaded(true);
    }).catch(() => setPrefsLoaded(true));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!prefsLoaded) return;
    storage.set(PREFS_KEY, JSON.stringify({ catIds, size, flipped })).catch(() => { });
  }, [prefsLoaded, catIds, size, flipped]);

  // Everything still practisable under the current filters. Recomputed on
  // every answer (cheap) — but the deck itself is *not*, or it would
  // reshuffle under you mid-round.
  const pool = useMemo(
    () => mixedPool(db, CATEGORIES, progress, levelFilter, catIds),
    [db, progress, levelFilter, catIds]
  );

  const newDeck = useCallback(() => {
    setDeck(pickMixedDeck(db, CATEGORIES, progressRef.current, levelFilter, { size, catIds }));
    setIdx(0); setRevealed(false); setResults([]); setDone(false);
  }, [db, levelFilter, size, catIds]);

  // Build on mount and whenever the scope of the deck changes.
  useEffect(() => { if (prefsLoaded) newDeck(); }, [prefsLoaded, newDeck]);

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
    setResults((r) => [...r, { ...entry, ok }]);
    advance();
  }, [deck, idx, write, advance]);

  const toggleMaster = useCallback((cat, item) => {
    write(cat, item, (prev) => ({ mastery: 0, correct: 0, total: 0, ...(prev || {}), skip: !(prev && prev.skip) }));
  }, [write]);

  // keyboard: space/enter reveals, then 1 = again, 2 = knew it
  useEffect(() => {
    const onKey = (e) => {
      if (done) { if (e.key === "Enter") newDeck(); return; }
      if (!revealed) {
        if (e.key === " " || e.key === "Enter") { setRevealed(true); e.preventDefault(); }
      } else if (e.key === "1") { grade(false); e.preventDefault(); }
      else if (e.key === "2" || e.key === "Enter" || e.key === " ") { grade(true); e.preventDefault(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, done, grade, newDeck]);

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

  // ── Controls (always on screen) ──
  const controls = (
    <div style={{ marginBottom: 14 }}>
      {/* Grid, not a wrapping flex row: with six categories the last chip
          would otherwise stretch across a whole row of its own. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(105px, 1fr))", gap: 6, marginBottom: 8 }}>
        {CATEGORIES.map((c) => {
          const on = catIds.includes(c.id);
          const n = (db[c.key] || []).filter(
            (x) => (levelFilter === "All" || lvlOf(x) === levelFilter) && !isMastered(progress[keyOf(c.id, x)])
          ).length;
          return (
            <button key={c.id} onClick={() => toggleCat(c.id)}
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
        <div style={{ display: "flex", gap: 3, background: COLORS.surfaceAlt, borderRadius: 9, padding: 3 }}>
          {DECK_SIZES.map((s) => (
            <button key={s} onClick={() => setSize(s)}
              style={{
                padding: "5px 11px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12,
                background: size === s ? ACCENT : "transparent", color: size === s ? "#fff" : MUTE, fontWeight: size === s ? 700 : 400,
              }}>
              {s}
            </button>
          ))}
        </div>
        <button onClick={() => setFlipped(!flipped)} title="Swap which side of the card you see first"
          style={{ padding: "6px 10px", borderRadius: 9, border: `1px solid ${flipped ? ACCENT : COLORS.borderSoft}`, background: flipped ? ACCENT + "22" : COLORS.surfaceAlt, color: flipped ? ACCENT : MUTE, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
          {flipped ? "EN → DE" : "DE → EN"}
        </button>
        <button onClick={newDeck} title="Draw a fresh 40 from across the level"
          style={{ padding: "6px 10px", borderRadius: 9, border: `1px solid ${COLORS.borderSoft}`, background: COLORS.surfaceAlt, color: MUTE, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
          ↻ New deck
        </button>
      </div>

      <div style={{ fontSize: 12, color: MUTE, marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <span>🎲 Deck of <b style={{ color: ACCENT }}>{deck.length}</b></span>
        {mix.map(({ cat, n }) => (
          <span key={cat.id} style={{ color: cat.color }}>· {n} {cat.label.toLowerCase()}</span>
        ))}
        <span style={{ color: FAINT }}>· drawn from {pool.length.toLocaleString()} unmastered {levelFilter === "All" ? "words (all levels)" : `${levelFilter} words`}</span>
      </div>
    </div>
  );

  // ── Empty state ──
  if (deck.length === 0) {
    return (
      <div>{controls}
        <div style={{ background: "#131313", border: `1px solid ${ACCENT}33`, borderRadius: 16, padding: "26px 22px", textAlign: "center" }}>
          <div style={{ fontSize: 40 }}>🏆</div>
          <div style={{ fontSize: 19, fontWeight: 800, color: COLORS.txtStrong, margin: "8px 0 4px" }}>Nothing left to practise</div>
          <div style={{ fontSize: 13, color: MUTE }}>Every word in this level and these categories is mastered — switch level, or add a category above.</div>
        </div>
      </div>
    );
  }

  // ── Deck summary ──
  if (done) {
    const score = results.filter((r) => r.ok).length;
    const missed = results.filter((r) => !r.ok);
    const pct = results.length ? Math.round((score / results.length) * 100) : 0;
    return (
      <div>{controls}
        <div className="dm-reveal" style={{ textAlign: "center", paddingTop: 8 }}>
          <div style={{ fontSize: 13, color: MUTE, letterSpacing: 1, textTransform: "uppercase" }}>Deck complete</div>
          <div style={{ fontSize: 56, fontWeight: 800, color: ACCENT, margin: "6px 0", letterSpacing: "-1px" }}>{score}/{results.length}</div>
          <div style={{ fontSize: 14, color: MUTE, marginBottom: 22 }}>{pct}% recalled{score === results.length ? " · perfect! 🎉" : ""} · {MASTERY_THRESHOLD}★ retires a word</div>
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
          <button onClick={newDeck}
            style={{ width: "100%", background: ACCENT, border: "none", borderRadius: 12, padding: "13px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            New deck →
          </button>
        </div>
      </div>
    );
  }

  // ── Active card ──
  const { item: it, cat } = deck[idx];
  const p = progress[keyOf(cat.id, it)];
  const lm = levelMeta(lvlOf(it));
  const front = flipped ? it.e : it.w;
  const back = flipped ? it.w : it.e;

  return (
    <div>
      {controls}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <ProgressBar value={(idx / deck.length) * 100} color={ACCENT} />
        <span style={{ fontSize: 12, color: FAINT, fontVariantNumeric: "tabular-nums" }}>{idx + 1}/{deck.length}</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, fontSize: 12.5 }}>
        <span style={{ color: cat.color, fontWeight: 700 }}>{cat.label}</span>
        <span style={{ color: lm.color, fontWeight: 700 }}>{lm.code}</span>
      </div>

      <div onClick={() => !revealed && setRevealed(true)}
        style={{ background: "#131313", border: `1px solid ${cat.color}33`, borderRadius: 16, padding: "26px 20px", minHeight: 190, cursor: revealed ? "default" : "pointer", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: COLORS.txtStrong, textAlign: "center", lineHeight: 1.25 }}>{front}</div>
          {!flipped && <SpeakBtn text={cat.german(it)} color={cat.color} />}
        </div>

        {!revealed ? (
          <div style={{ fontSize: 12.5, color: FAINT, textAlign: "center", marginTop: 18 }}>Tap to reveal · Space</div>
        ) : (
          <div className="dm-reveal" style={{ marginTop: 16, borderTop: "1px solid #222", paddingTop: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 17, color: TXT, fontWeight: 600, textAlign: "center" }}>{back}</div>
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
        <div className="dm-reveal" style={{ display: "flex", gap: 8, marginTop: 12 }}>
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
        Tip: Space to reveal · 1 = nochmal, 2 = gewusst
      </div>
    </div>
  );
}
