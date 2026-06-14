// ── QuizRunner: reusable question-card / options / summary engine
// Consumes a fixed queue of { item, cat, question } entries and owns
// answering, keyboard control, streak, the SRS write-back, and the
// session-summary screen. Shared by QuizView (single category) and
// ReviewView (mixed "due today" deck).
import { useState, useEffect, useCallback, useRef } from "react";
import { COLORS, TXT, MUTE, FAINT } from "../config/theme";
import { keyOf, applyAnswer, saveProgress } from "../engine/progress";
import { SpeakBtn } from "./ui";

export function QuizRunner({ queue, progress, setProgress, accent, controls, onRestart, onPracticeWeak }) {
  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState(null);
  const [streak, setStreak] = useState(0);
  const [results, setResults] = useState([]); // { item, cat, ok }
  const [done, setDone] = useState(false);

  const progressRef = useRef(progress);
  progressRef.current = progress;

  // Reset whenever a fresh queue arrives.
  useEffect(() => {
    setIdx(0); setChosen(null); setStreak(0); setResults([]); setDone(false);
  }, [queue]);

  const entry = queue[idx];
  const q = entry?.question;
  const item = entry?.item;
  const cat = entry?.cat;

  const answer = useCallback((opt) => {
    if (chosen !== null || !entry) return;
    const ok = opt === q.answer;
    setChosen(opt);
    setStreak((s) => (ok ? s + 1 : 0));
    setResults((r) => [...r, { item, cat, ok }]);
    const k = keyOf(cat.id, item);
    const np = { ...progressRef.current, [k]: applyAnswer(progressRef.current[k], ok) };
    setProgress(np);
    saveProgress(np);
  }, [chosen, entry, q, item, cat, setProgress]);

  const advance = useCallback(() => {
    if (chosen === null) return;
    if (idx + 1 >= queue.length) { setDone(true); return; }
    setIdx(idx + 1);
    setChosen(null);
  }, [chosen, idx, queue.length]);

  // keyboard: 1-N to answer, Enter/→/Space to advance or restart
  useEffect(() => {
    const onKey = (e) => {
      if (done) { if (e.key === "Enter") onRestart(); return; }
      if (chosen === null && q) {
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= q.options.length) { answer(q.options[n - 1]); e.preventDefault(); }
      } else if (chosen !== null) {
        if (e.key === "Enter" || e.key === "ArrowRight" || e.key === " ") { advance(); e.preventDefault(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chosen, q, done, answer, advance, onRestart]);

  // ── Session summary ──
  if (done) {
    const score = results.filter((r) => r.ok).length;
    const missed = results.filter((r) => !r.ok);
    const pct = results.length ? Math.round((score / results.length) * 100) : 0;
    return (
      <div className="dm-reveal" style={{ textAlign: "center", paddingTop: 8 }}>
        <div style={{ fontSize: 13, color: MUTE, letterSpacing: 1, textTransform: "uppercase" }}>Session complete</div>
        <div style={{ fontSize: 56, fontWeight: 800, color: accent, margin: "6px 0", letterSpacing: "-1px" }}>{score}/{results.length}</div>
        <div style={{ fontSize: 14, color: MUTE, marginBottom: 22 }}>{pct}% correct{score === results.length ? " · perfect! 🎉" : ""}</div>
        {missed.length > 0 && (
          <div style={{ textAlign: "left", background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14, marginBottom: 18 }}>
            <div style={{ fontSize: 12, color: FAINT, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Review ({missed.length})</div>
            {missed.map(({ item: m, cat: mc }, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "5px 0", borderTop: i ? "1px solid #1f1f1f" : "none" }}>
                <div><b style={{ color: COLORS.txtStrong }}>{m.w}</b> <span style={{ color: MUTE, fontSize: 13 }}>— {m.e}</span></div>
                <SpeakBtn text={mc.german(m)} color={mc.color} size={26} />
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          {missed.length > 0 && onPracticeWeak && (
            <button onClick={onPracticeWeak}
              style={{ flex: 1, background: "#1a1a1a", border: `1px solid ${accent}55`, borderRadius: 12, padding: "13px", color: accent, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              Practice weak words
            </button>
          )}
          <button onClick={onRestart}
            style={{ flex: 1, background: accent, border: "none", borderRadius: 12, padding: "13px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            New session →
          </button>
        </div>
      </div>
    );
  }

  if (!entry || !q) {
    return <div style={{ color: FAINT, textAlign: "center", padding: 40 }}>No words match these filters.</div>;
  }

  const oneCol = q.options.some((o) => String(o).length > 22) || q.options.length <= 2;
  const k = keyOf(cat.id, item);
  const isSkipped = !!progressRef.current[k]?.skip;

  return (
    <div>
      {controls}

      {/* progress + streak */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1, height: 5, background: "#1f1f1f", borderRadius: 999 }}>
          <div style={{ width: `${(idx / queue.length) * 100}%`, height: 5, background: accent, borderRadius: 999, transition: "width .3s" }} />
        </div>
        <span style={{ fontSize: 12, color: FAINT, fontVariantNumeric: "tabular-nums" }}>{idx + 1}/{queue.length}</span>
        {streak > 1 && <span style={{ fontSize: 13, color: COLORS.streak, fontWeight: 700 }}>🔥 {streak}</span>}
      </div>

      {/* Question card */}
      <div style={{ background: "#131313", border: `1px solid ${cat.color}33`, borderRadius: 16, padding: "22px 22px 24px", marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ fontSize: 12, color: FAINT, textTransform: "uppercase", letterSpacing: 0.5 }}>
            {q.sub}{controls == null && <span style={{ color: cat.color, marginLeft: 8 }}>· {cat.label}</span>}
          </div>
          <SpeakBtn text={cat.german(item)} color={cat.color} />
        </div>
        <div style={{ fontSize: 30, fontWeight: 800, color: COLORS.txtStrong, letterSpacing: "-0.5px", marginTop: 8, lineHeight: 1.15 }}>{q.prompt}</div>
        {chosen !== null && (
          <div className="dm-reveal" style={{ marginTop: 16, borderTop: "1px solid #222", paddingTop: 12 }}>
            <div style={{ fontSize: 13, color: MUTE }}>
              Answer: <span style={{ color: COLORS.successText, fontWeight: 700 }}>{q.answer}</span>
            </div>
            {item.ex && <div style={{ marginTop: 8, fontSize: 13, color: FAINT, fontStyle: "italic" }}>„{item.ex}"</div>}
            {cat.detail(item)}
          </div>
        )}
      </div>

      {/* Options */}
      <div style={{ display: "grid", gridTemplateColumns: oneCol ? "1fr" : "1fr 1fr", gap: 8 }}>
        {q.options.map((opt, i) => {
          const isChosen = chosen === opt;
          const isCorrect = opt === q.answer;
          let bg = "#171717", border = COLORS.borderSoft, color = TXT, mark = null;
          if (chosen !== null) {
            if (isCorrect) { bg = "#0a2a16"; border = COLORS.success; color = "#5eead4"; mark = "✓"; }
            else if (isChosen) { bg = "#2a0d0d"; border = COLORS.danger; color = COLORS.dangerText; mark = "✗"; }
            else { color = "#6b7280"; }
          }
          return (
            <button key={i} className="dm-opt" onClick={() => answer(opt)} disabled={chosen !== null}
              style={{
                background: bg, border: `1.5px solid ${border}`, borderRadius: 12, padding: "13px 14px", color, fontSize: 14.5, fontWeight: 600,
                cursor: chosen ? "default" : "pointer", textAlign: "left", transition: "all .15s", lineHeight: 1.3, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
              }}>
              <span><span style={{ color: FAINT, fontWeight: 400, marginRight: 8, fontSize: 12 }}>{i + 1}</span>{opt}</span>
              {mark && <span style={{ fontWeight: 800 }}>{mark}</span>}
            </button>
          );
        })}
      </div>

      {chosen !== null && (
        <>
          <button onClick={advance}
            style={{ marginTop: 14, width: "100%", background: accent, border: "none", borderRadius: 12, padding: "14px", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            {idx + 1 >= queue.length ? "Finish session" : "Next →"}
          </button>
          <div style={{ textAlign: "center", marginTop: 8 }}>
            <button
              onClick={() => {
                const prev = progressRef.current[k] || { mastery: 0, correct: 0, total: 0 };
                const np = { ...progressRef.current, [k]: { ...prev, skip: !prev.skip } };
                setProgress(np); saveProgress(np);
              }}
              style={{ background: "transparent", border: "none", color: isSkipped ? COLORS.success : FAINT, fontSize: 12, cursor: "pointer", padding: "4px 8px" }}
            >
              {isSkipped ? "✓ Marked as mastered — click to undo" : "✓ Mark as mastered"}
            </button>
          </div>
        </>
      )}
      <div style={{ textAlign: "center", marginTop: 10, fontSize: 11, color: "#3a3f49" }}>
        Tip: keys 1–{q.options.length} to answer · Enter to continue
      </div>
    </div>
  );
}
