// ── Chunks view: flashcard trainer for everyday German chunks ──
// The "chunking" method: instead of drilling single words, you learn
// whole ready-made phrases (Redemittel, Nomen-Verb-Verbindungen,
// Verb+Präposition patterns, idioms) with their English meaning and a
// natural example sentence, and repeat them until they come out whole.
//
// Data: public/data/chunks.json — [{ w, e, ex, c, lvl }] where `ex` is
// "German sentence — English translation". A2 upwards only; the truly
// basic A1 material lives in the word categories.
//
// Progress reuses the shared engine (engine/progress) under the synthetic
// category id "chunks", so chunk mastery is stored in the same map as the
// word categories and rides along with the cloud/Drive sync for free.
// It is deliberately NOT in config/categories.jsx: chunks get their own
// tab and their own card UI, not the word quiz's multiple choice.
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { COLORS, TXT, MUTE, FAINT } from "../config/theme";
import { LEVELS } from "../config/levels";
import { keyOf, applyAnswer, saveProgress, isMastered, MASTERY_THRESHOLD } from "../engine/progress";
import { shuffle, CHUNK_SIZE } from "../engine/quiz";
import { SpeakBtn, ProgressBar, MasterBtn, ExampleLine } from "./ui";

export const CHUNK_CAT_ID = "chunks";
const ACCENT = "#14b8a6";
// Only levels that make sense for chunks — A1 phrases are covered by
// the word categories and were deliberately left out of the data.
const CHUNK_LEVELS = ["A2", "B1", "B2", "C1"];

const lvlColor = (code) => (LEVELS.find((l) => l.code === code) || {}).color || "#6b7280";

export function ChunksView({ progress, setProgress }) {
  const [all, setAll] = useState(null);
  const [level, setLevel] = useState("All");
  const [cat, setCat] = useState("All");
  const [queue, setQueue] = useState([]);   // items in the current round
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [flipped, setFlipped] = useState(false); // true → show English first
  const [showList, setShowList] = useState(false);
  const [roundDone, setRoundDone] = useState(false);

  const progressRef = useRef(progress);
  progressRef.current = progress;

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/chunks.json`)
      .then((r) => r.json()).then(setAll)
      .catch(() => setAll([]));
  }, []);

  const cats = useMemo(
    () => [...new Set((all || []).map((x) => x.c))].filter(Boolean).sort(),
    [all]
  );

  // Everything matching the filters, mastered or not.
  const scope = useMemo(() => (all || []).filter(
    (x) => (level === "All" || x.lvl === level) && (cat === "All" || x.c === cat)
  ), [all, level, cat]);

  // Practice pool = the same, minus what is already mastered.
  const pool = useMemo(
    () => scope.filter((x) => !isMastered(progress[keyOf(CHUNK_CAT_ID, x)])),
    [scope, progress]
  );

  // Chunked mastery: work one fixed batch at a time. The batch is the first
  // CHUNK_SIZE unmastered chunks in data order, and anything already started
  // stays in it however the batch shifts — so new chunks only appear as
  // mastered ones drop out of `pool`. (The word quiz's pickChunk can't be
  // reused here: it narrows the batch to *only* the started items, which on a
  // flashcard round would shrink the deck to one card after the first answer.)
  const active = useMemo(() => {
    const started = [], fresh = [];
    for (const x of pool) {
      const p = progress[keyOf(CHUNK_CAT_ID, x)];
      (p && p.total > 0 ? started : fresh).push(x);
    }
    return [...started, ...fresh].slice(0, Math.max(CHUNK_SIZE, started.length));
  }, [pool, progress]);
  const locked = Math.max(0, pool.length - active.length);
  const masteredCount = scope.length - pool.length;

  const startRound = useCallback(() => {
    setQueue(shuffle(active));
    setIdx(0); setRevealed(false); setRoundDone(false);
  }, [active]);

  // (Re)build the round whenever the filters change or the round is empty.
  useEffect(() => { setQueue(shuffle(active)); setIdx(0); setRevealed(false); setRoundDone(false);
    /* eslint-disable-next-line */ }, [level, cat, all]);

  const write = useCallback((item, updater) => {
    const k = keyOf(CHUNK_CAT_ID, item);
    const np = { ...progressRef.current, [k]: updater(progressRef.current[k]) };
    setProgress(np);
    saveProgress(np);
  }, [setProgress]);

  const grade = useCallback((ok) => {
    const item = queue[idx];
    if (!item) return;
    write(item, (prev) => applyAnswer(prev, ok));
    if (idx + 1 >= queue.length) setRoundDone(true);
    else { setIdx(idx + 1); setRevealed(false); }
  }, [queue, idx, write]);

  const toggleMaster = useCallback((item) => {
    write(item, (prev) => ({ mastery: 0, correct: 0, total: 0, ...(prev || {}), skip: !(prev && prev.skip) }));
  }, [write]);

  // keyboard: space/enter reveals, then 1 = again, 2 = knew it
  useEffect(() => {
    const onKey = (e) => {
      if (roundDone) { if (e.key === "Enter") startRound(); return; }
      if (!revealed) {
        if (e.key === " " || e.key === "Enter") { setRevealed(true); e.preventDefault(); }
      } else if (e.key === "1") { grade(false); e.preventDefault(); }
      else if (e.key === "2" || e.key === "Enter" || e.key === " ") { grade(true); e.preventDefault(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, roundDone, grade, startRound]);

  if (!all) return <div style={{ color: FAINT, textAlign: "center", padding: 40 }}>Loading…</div>;

  // ── Filter bar (always visible) ──
  const filters = (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {["All", ...CHUNK_LEVELS].map((code) => {
          const activeLvl = level === code;
          const color = code === "All" ? "#6b7280" : lvlColor(code);
          const n = (all || []).filter((x) => code === "All" || x.lvl === code).length;
          return (
            <button key={code} onClick={() => setLevel(code)}
              style={{
                flex: "1 1 0", minWidth: 64, padding: "8px 4px", borderRadius: 10,
                border: `1.5px solid ${activeLvl ? color : "#222"}`, background: activeLvl ? color + "18" : "#111",
                cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
              }}>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: activeLvl ? color : "#4a4f59" }}>{code}</span>
              <span style={{ fontSize: 9.5, color: activeLvl ? color + "88" : "#2f2f2f" }}>{n} chunks</span>
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <select value={cat} onChange={(e) => setCat(e.target.value)}
          style={{ background: COLORS.surfaceAlt, border: `1px solid ${COLORS.borderSoft}`, borderRadius: 9, padding: "6px 10px", color: TXT, fontSize: 12 }}>
          <option value="All">All topics</option>
          {cats.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={() => setFlipped(!flipped)} title="Swap which side of the card you see first"
          style={{ padding: "6px 10px", borderRadius: 9, border: `1px solid ${flipped ? ACCENT : COLORS.borderSoft}`, background: flipped ? ACCENT + "22" : COLORS.surfaceAlt, color: flipped ? ACCENT : MUTE, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
          {flipped ? "EN → DE" : "DE → EN"}
        </button>
        <button onClick={() => setShowList(!showList)}
          style={{ padding: "6px 10px", borderRadius: 9, border: `1px solid ${COLORS.borderSoft}`, background: COLORS.surfaceAlt, color: MUTE, fontSize: 12, cursor: "pointer" }}>
          {showList ? "Hide list" : "Show this chunk"}
        </button>
      </div>
      <div style={{ fontSize: 12, color: MUTE, marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <span>📦 Learning <b style={{ color: ACCENT }}>{active.length}</b> chunk{active.length === 1 ? "" : "s"}</span>
        <span style={{ color: FAINT }}>· {masteredCount} of {scope.length} mastered</span>
        {locked > 0 && <span style={{ color: FAINT }}>· {locked} locked until these are done</span>}
      </div>
      <div style={{ display: "flex", marginTop: 8 }}>
        <ProgressBar value={scope.length ? (masteredCount / scope.length) * 100 : 0} color={ACCENT} />
      </div>
      {showList && (
        <div style={{ marginTop: 10, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 10 }}>
          {active.length === 0 && <div style={{ fontSize: 12.5, color: FAINT }}>Nothing left in this filter.</div>}
          {active.map((it, i) => {
            const p = progress[keyOf(CHUNK_CAT_ID, it)];
            return (
              <div key={it.w} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderTop: i ? "1px solid #1e1e1e" : "none" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, color: COLORS.txtStrong, fontWeight: 600 }}>{it.w}</div>
                  <div style={{ fontSize: 12, color: MUTE }}>{it.e}</div>
                </div>
                <span style={{ fontSize: 11, color: FAINT, whiteSpace: "nowrap" }}>{"★".repeat(p?.mastery || 0)}</span>
                <MasterBtn isSkipped={!!p?.skip} onToggle={() => toggleMaster(it)} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── Empty / all-done states ──
  if (scope.length === 0) {
    return <div>{filters}<div style={{ color: FAINT, textAlign: "center", padding: 30 }}>No chunks for this filter yet.</div></div>;
  }
  if (pool.length === 0) {
    return (
      <div>{filters}
        <div style={{ background: "#131313", border: `1px solid ${ACCENT}33`, borderRadius: 16, padding: "26px 22px", textAlign: "center" }}>
          <div style={{ fontSize: 40 }}>🏆</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.txtStrong, margin: "8px 0 4px" }}>All chunks mastered</div>
          <div style={{ fontSize: 13, color: MUTE }}>Nothing left here — switch level or topic for more.</div>
        </div>
      </div>
    );
  }

  // ── Round summary ──
  if (roundDone || queue.length === 0) {
    return (
      <div>{filters}
        <div className="dm-reveal" style={{ background: "#131313", border: `1px solid ${ACCENT}33`, borderRadius: 16, padding: "26px 22px", textAlign: "center" }}>
          <div style={{ fontSize: 34 }}>✅</div>
          <div style={{ fontSize: 19, fontWeight: 800, color: COLORS.txtStrong, margin: "8px 0 4px" }}>Round complete</div>
          <div style={{ fontSize: 13, color: MUTE, marginBottom: 16 }}>
            {active.length} chunk{active.length === 1 ? "" : "s"} still in this batch · {MASTERY_THRESHOLD}★ retires a chunk.
          </div>
          <button onClick={startRound}
            style={{ background: ACCENT, color: "#04201c", border: "none", borderRadius: 10, padding: "12px 26px", fontSize: 14.5, fontWeight: 800, cursor: "pointer" }}>
            Go again
          </button>
        </div>
      </div>
    );
  }

  // ── Active card ──
  const it = queue[idx];
  const p = progress[keyOf(CHUNK_CAT_ID, it)];
  const front = flipped ? it.e : it.w;
  const back = flipped ? it.w : it.e;

  return (
    <div>
      {filters}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, fontSize: 12.5 }}>
        <span style={{ color: FAINT }}>{idx + 1} / {queue.length} · {it.c}</span>
        <span style={{ color: lvlColor(it.lvl), fontWeight: 700 }}>{it.lvl}</span>
      </div>

      <div onClick={() => !revealed && setRevealed(true)}
        style={{ background: "#131313", border: `1px solid ${ACCENT}33`, borderRadius: 16, padding: "26px 20px", minHeight: 190, cursor: revealed ? "default" : "pointer", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 23, fontWeight: 800, color: COLORS.txtStrong, textAlign: "center", lineHeight: 1.3, minWidth: 0, overflowWrap: "anywhere" }}>{front}</div>
          {!flipped && <SpeakBtn text={it.w} color={ACCENT} />}
        </div>

        {!revealed ? (
          <div style={{ fontSize: 12.5, color: FAINT, textAlign: "center", marginTop: 18 }}>Tap to reveal · Space</div>
        ) : (
          <div className="dm-reveal" style={{ marginTop: 16, borderTop: "1px solid #222", paddingTop: 14, textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 17, color: TXT, fontWeight: 600, minWidth: 0, overflowWrap: "anywhere" }}>{back}</div>
              {flipped && <SpeakBtn text={it.w} color={ACCENT} />}
            </div>
            <ExampleLine text={it.ex} style={{ marginTop: 12 }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 12 }}>
              <SpeakBtn text={it.ex.split(" — ")[0]} color={ACCENT} size={26} />
              <span style={{ fontSize: 11.5, color: FAINT }}>{"★".repeat(p?.mastery || 0) || "not started"}</span>
              <MasterBtn isSkipped={!!p?.skip} onToggle={() => { toggleMaster(it); if (idx + 1 >= queue.length) setRoundDone(true); else { setIdx(idx + 1); setRevealed(false); } }} />
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
            style={{ flex: 1, background: ACCENT, color: "#04201c", border: "none", borderRadius: 10, padding: "13px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
            Gewusst ✓
          </button>
        </div>
      ) : (
        <button onClick={() => setRevealed(true)}
          style={{ width: "100%", marginTop: 12, background: COLORS.surfaceAlt, color: MUTE, border: `1px solid ${COLORS.borderSoft}`, borderRadius: 10, padding: "13px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          Show meaning
        </button>
      )}
    </div>
  );
}
