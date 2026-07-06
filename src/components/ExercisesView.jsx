// ── Exercises view: daily grammar & sentence-structure drills ──
// A date-seeded set of exercises per level (word order + fill-in-
// the-blank). Vocab lives in the quiz/flashcards; this trains
// structure. Data: public/data/exercises.json, tagged with lvl.
import { useState, useEffect, useMemo, useCallback } from "react";
import { COLORS, TXT, MUTE, FAINT } from "../config/theme";
import { lvlOf, levelMeta } from "../config/levels";
import { SpeakBtn, ProgressBar } from "./ui";

const DAILY_SIZE = 10;
const HISTORY_KEY = "dm-exercise-history"; // { "2026-07-05|A1": { score, total } }

// Mulberry32 — tiny seeded PRNG so everyone gets the same daily set.
function rng(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);
const todayStr = () => new Date().toISOString().slice(0, 10);

function seededPick(pool, n, seed) {
  const r = rng(seed);
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

// Split a sentence into chips (keep trailing punctuation on last word).
function toChips(sentence, seed) {
  const words = sentence.replace(/([.!?])$/, " $1").split(/\s+/).filter(Boolean);
  const r = rng(seed);
  const shuffled = words.map((w, i) => ({ w, i }));
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return { words, shuffled };
}
const normalize = (s) => s.replace(/\s+([.!?])/g, "$1").replace(/\s+/g, " ").trim();

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || {}; } catch { return {}; }
}
function saveResult(date, lvl, score, total) {
  const h = loadHistory();
  h[`${date}|${lvl}`] = { score, total };
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch { /* ignore */ }
}
function streakFor(lvl) {
  const h = loadHistory();
  let streak = 0;
  const d = new Date();
  // today counts if done; otherwise start from yesterday
  if (!h[`${todayStr()}|${lvl}`]) d.setDate(d.getDate() - 1);
  for (;;) {
    const key = `${d.toISOString().slice(0, 10)}|${lvl}`;
    if (!h[key]) break;
    streak++; d.setDate(d.getDate() - 1);
  }
  return streak;
}

// ── Word-order exercise card ──────────────────────────────────
function OrderCard({ ex, onDone, accent }) {
  const { shuffled } = useMemo(() => toChips(ex.answer, hash(ex.id + ex.answer)), [ex]);
  const [picked, setPicked] = useState([]); // indices into shuffled
  const [checked, setChecked] = useState(null); // null | true | false

  const attempt = picked.map((i) => shuffled[i].w).join(" ");
  const done = picked.length === shuffled.length;

  const check = () => {
    const ok = normalize(attempt) === normalize(ex.answer);
    setChecked(ok);
    onDone(ok);
  };

  return (
    <div>
      <div style={{ fontSize: 12, color: FAINT, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
        Build the sentence · <span style={{ color: accent }}>{ex.topic}</span>
      </div>
      <div style={{ fontSize: 14, color: MUTE, marginBottom: 14, fontStyle: "italic" }}>"{ex.en}"</div>

      {/* Answer line */}
      <div style={{ minHeight: 46, background: "#0f0f0f", border: `1px dashed ${checked === null ? "#2e2e2e" : checked ? COLORS.success : COLORS.danger}`, borderRadius: 10, padding: "8px 10px", display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {picked.length === 0 && <span style={{ color: "#3f4651", fontSize: 13, alignSelf: "center" }}>Tap the words below in order…</span>}
        {picked.map((si, pos) => (
          <button key={pos} onClick={() => checked === null && setPicked(picked.filter((_, k) => k !== pos))}
            style={{ background: "#1d2430", border: "1px solid #2c3a4f", color: "#cbd5e1", borderRadius: 8, padding: "6px 10px", fontSize: 14.5, cursor: checked === null ? "pointer" : "default", fontWeight: 600 }}>
            {shuffled[si].w}
          </button>
        ))}
      </div>

      {/* Chip pool */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {shuffled.map((c, si) => {
          const used = picked.includes(si);
          return (
            <button key={si} disabled={used || checked !== null} onClick={() => setPicked([...picked, si])}
              style={{ background: used ? "#101010" : "#191919", border: `1px solid ${used ? "#1c1c1c" : "#303030"}`, color: used ? "#333" : TXT, borderRadius: 8, padding: "7px 12px", fontSize: 14.5, cursor: used || checked !== null ? "default" : "pointer" }}>
              {c.w}
            </button>
          );
        })}
      </div>

      {checked === null ? (
        <div style={{ display: "flex", gap: 8 }}>
          <button disabled={!done} onClick={check}
            style={{ flex: 1, background: done ? accent : "#1a1a1a", color: done ? "#fff" : "#4a4f59", border: "none", borderRadius: 10, padding: "11px", fontSize: 14, fontWeight: 700, cursor: done ? "pointer" : "default" }}>
            Check
          </button>
          <button onClick={() => setPicked([])}
            style={{ background: "#1a1a1a", color: MUTE, border: "1px solid #2a2a2a", borderRadius: 10, padding: "11px 16px", fontSize: 13, cursor: "pointer" }}>
            Clear
          </button>
        </div>
      ) : (
        <div className="dm-reveal" style={{ borderTop: "1px solid #222", paddingTop: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: checked ? COLORS.successText : COLORS.dangerText }}>
            {checked ? "✓ Richtig!" : "✗ Not quite."}
          </div>
          <div style={{ marginTop: 6, fontSize: 14, color: TXT, display: "flex", alignItems: "center", gap: 8 }}>
            <span>„{ex.answer}"</span>
            <SpeakBtn text={ex.answer} color={accent} size={26} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Fill-in-the-blank exercise card ───────────────────────────
function BlankCard({ ex, onDone, accent }) {
  const [chosen, setChosen] = useState(null);
  const opts = useMemo(() => seededPick(ex.options, ex.options.length, hash(ex.id)), [ex]);
  const pick = (opt) => {
    if (chosen !== null) return;
    setChosen(opt);
    onDone(opt === ex.answer);
  };
  const filled = ex.q.replace("___", chosen === null ? "___" : ex.answer);
  return (
    <div>
      <div style={{ fontSize: 12, color: FAINT, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
        Fill the gap · <span style={{ color: accent }}>{ex.topic}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.txtStrong, lineHeight: 1.35, marginBottom: 4 }}>
        {chosen === null ? ex.q : filled}
      </div>
      <div style={{ fontSize: 13, color: MUTE, fontStyle: "italic", marginBottom: 14 }}>"{ex.en}"</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {opts.map((opt) => {
          const isCorrect = opt === ex.answer;
          let bg = "#171717", border = COLORS.borderSoft, color = TXT, mark = null;
          if (chosen !== null) {
            if (isCorrect) { bg = "#0a2a16"; border = COLORS.success; color = "#5eead4"; mark = "✓"; }
            else if (opt === chosen) { bg = "#2a0f0f"; border = COLORS.danger; color = COLORS.dangerText; mark = "✗"; }
            else { color = "#4a4f59"; }
          }
          return (
            <button key={opt} className="dm-opt" onClick={() => pick(opt)}
              style={{ background: bg, border: `1px solid ${border}`, color, borderRadius: 10, padding: "12px 10px", fontSize: 15, fontWeight: 600, cursor: chosen === null ? "pointer" : "default", textAlign: "center" }}>
              {opt} {mark && <span style={{ marginLeft: 4 }}>{mark}</span>}
            </button>
          );
        })}
      </div>
      {chosen !== null && (
        <div className="dm-reveal" style={{ marginTop: 12, borderTop: "1px solid #222", paddingTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: MUTE }}>
            „{ex.q.replace("___", ex.answer)}"{ex.hint && <span style={{ color: FAINT }}> · 💡 {ex.hint}</span>}
          </span>
          <SpeakBtn text={ex.q.replace("___", ex.answer)} color={accent} size={26} />
        </div>
      )}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────
export function ExercisesView({ levelFilter }) {
  const [all, setAll] = useState(null);
  const [mode, setMode] = useState("daily"); // daily | practice
  const [session, setSession] = useState(null); // { list, idx, results }
  const level = levelFilter === "All" ? "A1" : levelFilter;
  const accent = levelMeta(level).color;
  const date = todayStr();

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/exercises.json`)
      .then((r) => r.json()).then(setAll)
      .catch(() => setAll([]));
  }, []);

  const pool = useMemo(() => (all || []).filter((x) => lvlOf(x) === level), [all, level]);

  const start = useCallback((practiceMode) => {
    const seed = practiceMode ? (Date.now() & 0x7fffffff) : hash(`${date}|${level}`);
    const list = seededPick(pool, Math.min(DAILY_SIZE, pool.length), seed);
    setMode(practiceMode ? "practice" : "daily");
    setSession({ list, idx: 0, results: [] });
  }, [pool, date, level]);

  if (!all) return <div style={{ color: FAINT, textAlign: "center", padding: 40 }}>Loading…</div>;
  if (pool.length === 0) return <div style={{ color: FAINT, textAlign: "center", padding: 40 }}>No exercises for {level} yet.</div>;

  const doneToday = loadHistory()[`${date}|${level}`];
  const streak = streakFor(level);

  // ── Start screen ──
  if (!session) {
    return (
      <div>
        <div style={{ background: "#131313", border: `1px solid ${accent}33`, borderRadius: 16, padding: "24px 22px", textAlign: "center" }}>
          <div style={{ fontSize: 13, color: FAINT, textTransform: "uppercase", letterSpacing: 0.5 }}>{level} · Daily Exercises</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: COLORS.txtStrong, margin: "10px 0 4px" }}>
            Grammar & Sentence Structure
          </div>
          <div style={{ fontSize: 13.5, color: MUTE, lineHeight: 1.5, maxWidth: 420, margin: "0 auto 16px" }}>
            {DAILY_SIZE} exercises a day: build sentences from shuffled words and fill grammar gaps.
            Same set all day — come back tomorrow for a new one.
          </div>
          {streak > 0 && <div style={{ fontSize: 14, color: COLORS.streak, fontWeight: 700, marginBottom: 12 }}>🔥 {streak}-day streak</div>}
          {doneToday && (
            <div style={{ fontSize: 13, color: COLORS.successText, marginBottom: 12 }}>
              ✓ Done today: {doneToday.score}/{doneToday.total}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => start(false)}
              style={{ background: accent, color: "#fff", border: "none", borderRadius: 10, padding: "12px 26px", fontSize: 14.5, fontWeight: 700, cursor: "pointer" }}>
              {doneToday ? "Redo today's set" : "Start today's set"}
            </button>
            <button onClick={() => start(true)}
              style={{ background: "#1a1a1a", color: MUTE, border: "1px solid #2a2a2a", borderRadius: 10, padding: "12px 20px", fontSize: 13.5, cursor: "pointer" }}>
              Random practice
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { list, idx, results } = session;

  // ── Summary screen ──
  if (idx >= list.length) {
    const score = results.filter(Boolean).length;
    if (mode === "daily" && !session.saved) {
      saveResult(date, level, score, list.length);
      session.saved = true;
    }
    const wrong = list.filter((_, i) => !results[i]);
    return (
      <div>
        <div style={{ background: "#131313", border: `1px solid ${accent}33`, borderRadius: 16, padding: "26px 22px", textAlign: "center" }}>
          <div style={{ fontSize: 40 }}>{score === list.length ? "🏆" : score >= list.length * 0.7 ? "💪" : "📖"}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.txtStrong, margin: "8px 0 2px" }}>{score} / {list.length}</div>
          <div style={{ fontSize: 13, color: MUTE, marginBottom: 16 }}>
            {mode === "daily" ? "Today's set complete." : "Practice round complete."}
          </div>
          {wrong.length > 0 && (
            <div style={{ textAlign: "left", margin: "0 auto 16px", maxWidth: 460 }}>
              <div style={{ fontSize: 11, color: FAINT, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Review these</div>
              {wrong.map((ex) => (
                <div key={ex.id} style={{ fontSize: 13, color: MUTE, padding: "6px 0", borderTop: "1px solid #1e1e1e" }}>
                  <span style={{ color: TXT }}>„{ex.type === "order" ? ex.answer : ex.q.replace("___", ex.answer)}"</span>
                  <span style={{ color: FAINT }}> — {ex.en} · {ex.topic}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button onClick={() => start(true)}
              style={{ background: accent, color: "#fff", border: "none", borderRadius: 10, padding: "11px 22px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              Practice more
            </button>
            <button onClick={() => setSession(null)}
              style={{ background: "#1a1a1a", color: MUTE, border: "1px solid #2a2a2a", borderRadius: 10, padding: "11px 18px", fontSize: 13, cursor: "pointer" }}>
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Active exercise ──
  const ex = list[idx];
  const answered = results.length > idx;
  const record = (ok) => setSession({ ...session, results: [...results, ok] });
  const next = () => setSession({ ...session, idx: idx + 1 });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, color: FAINT }}>{idx + 1} / {list.length} · {mode === "daily" ? "Daily" : "Practice"} · {level}</span>
        <span style={{ fontSize: 12.5, color: COLORS.successText, fontWeight: 600 }}>{results.filter(Boolean).length} correct</span>
      </div>
      <ProgressBar value={(idx / list.length) * 100} color={accent} />
      <div style={{ background: "#131313", border: `1px solid ${accent}33`, borderRadius: 16, padding: "20px 20px 22px", marginTop: 12 }}>
        {ex.type === "order"
          ? <OrderCard key={ex.id} ex={ex} accent={accent} onDone={record} />
          : <BlankCard key={ex.id} ex={ex} accent={accent} onDone={record} />}
      </div>
      {answered && (
        <button onClick={next}
          style={{ width: "100%", marginTop: 12, background: accent, color: "#fff", border: "none", borderRadius: 10, padding: "13px", fontSize: 14.5, fontWeight: 700, cursor: "pointer" }}>
          {idx + 1 === list.length ? "See results" : "Next →"}
        </button>
      )}
    </div>
  );
}
