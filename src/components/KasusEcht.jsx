// ── Echte Sätze: which case is the highlighted phrase? ────────
// Real sentences from the Universal Dependencies German PUD treebank.
// The answer key is the treebank's own case annotation, kept only where it
// agrees with the article's form in the declension tables — see
// scripts/build-exercises.mjs, which writes public/data/kasus-echt.json.
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { COLORS, MUTE, FAINT } from "../config/theme";
import { keyOf, applyAnswer, saveProgress } from "../engine/progress";
import { CASES, CASE_LABEL } from "../engine/kasus";
import { SpeakBtn, isTypingTarget } from "./ui";
import { ChipRow, weakFirst, ROUND, DRILL_ACCENT } from "./drillKit";

const CAT_ID = "kasusecht";

let savedCases = null;

export function KasusEcht({ progress, setProgress, recordAnswer }) {
  const [data, setData] = useState(null);
  const [cases, setCasesState] = useState(savedCases || [...CASES]);
  const setCases = (v) => { savedCases = v; setCasesState(v); };
  const progressRef = useRef(progress);
  progressRef.current = progress;

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/kasus-echt.json`)
      .then((r) => r.json()).then(setData)
      .catch(() => setData({ items: [] }));
  }, []);

  const pool = useMemo(() => (data?.items || []).filter((q) => cases.includes(q.case)), [data, cases]);

  const [queue, setQueue] = useState([]);
  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState(null);
  const [results, setResults] = useState([]);
  const [done, setDone] = useState(false);

  const restart = useCallback(() => {
    setQueue(weakFirst(pool, (q) => progressRef.current[keyOf(CAT_ID, { w: q.id })]).slice(0, ROUND));
    setIdx(0); setChosen(null); setResults([]); setDone(false);
  }, [pool]);

  useEffect(() => { restart(); /* eslint-disable-next-line */ }, [pool]);

  const q = queue[idx];

  const grade = useCallback((c) => {
    if (!q || chosen !== null) return;
    const ok = c === q.case;
    setChosen(c);
    setResults((r) => [...r, { q, ok }]);
    const k = keyOf(CAT_ID, { w: q.id });
    const np = { ...progressRef.current, [k]: applyAnswer(progressRef.current[k], ok) };
    setProgress(np);
    saveProgress(np);
    recordAnswer?.(1);
  }, [q, chosen, setProgress, recordAnswer]);

  const next = useCallback(() => {
    if (chosen === null) return;
    if (idx + 1 >= queue.length) { setDone(true); return; }
    setIdx(idx + 1); setChosen(null);
  }, [chosen, idx, queue.length]);

  useEffect(() => {
    const onKey = (e) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (done) { if (e.key === "Enter") { restart(); e.preventDefault(); } return; }
      if (chosen !== null) { if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") { next(); e.preventDefault(); } return; }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 4) { grade(CASES[n - 1]); e.preventDefault(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, chosen, grade, next, restart]);

  if (!data) return <div style={{ color: FAINT, textAlign: "center", padding: 40 }}>Loading…</div>;

  const credit = (
    <div style={{ fontSize: 10.5, color: "#3f4651", marginTop: 14, lineHeight: 1.5, textAlign: "center" }}>
      Sätze & Kasus-Annotation: Universal Dependencies German PUD treebank (CC BY-SA 3.0). Echte Nachrichten- und Wikipedia-Sätze — Niveau B1–C1.
    </div>
  );
  const filters = (
    <div style={{ marginBottom: 10 }}>
      <ChipRow label="Fall" value={cases} onChange={setCases} options={CASES.map((c) => ({ value: c, label: CASE_LABEL[c] }))} />
      <div style={{ fontSize: 11, color: FAINT }}>{pool.length} Phrasen aus {new Set(pool.map((x) => x.id.split(":")[0])).size} Sätzen</div>
    </div>
  );

  if (done) {
    const score = results.filter((r) => r.ok).length;
    return (
      <div>
        {filters}
        <div className="dm-reveal" style={{ textAlign: "center", padding: "10px 0" }}>
          <div style={{ fontSize: 13, color: MUTE, letterSpacing: 1, textTransform: "uppercase" }}>Runde fertig</div>
          <div style={{ fontSize: 52, fontWeight: 800, color: DRILL_ACCENT, margin: "4px 0 14px" }}>{score}/{results.length}</div>
          <button onClick={restart}
            style={{ width: "100%", background: DRILL_ACCENT, border: "none", borderRadius: 12, padding: "14px", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            Neue Runde →
          </button>
        </div>
        {credit}
      </div>
    );
  }

  if (!q) return <div>{filters}<div style={{ color: FAINT, textAlign: "center", padding: 30 }}>Keine Sätze für diese Auswahl.</div>{credit}</div>;

  const [a, b] = q.span;
  const sentence = q.tok.join(" ");
  // Punctuation glued to the phrase's last word stays outside the mark.
  const [, marked, trail] = q.tok.slice(a, b).join(" ").match(/^(.*?)([,.;:?!]*)$/);
  const before = q.tok.slice(0, a).join(" ");
  const after = q.tok.slice(b).join(" ");

  return (
    <div>
      {filters}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1, height: 5, background: "#1f1f1f", borderRadius: 999 }}>
          <div style={{ width: `${((idx + (chosen !== null ? 1 : 0)) / queue.length) * 100}%`, height: 5, background: DRILL_ACCENT, borderRadius: 999, transition: "width .3s" }} />
        </div>
        <span style={{ fontSize: 12, color: FAINT, fontVariantNumeric: "tabular-nums" }}>{idx + 1}/{queue.length}</span>
      </div>

      <div style={{ background: "#131313", border: `1px solid ${DRILL_ACCENT}33`, borderRadius: 16, padding: "18px 18px 20px", marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div style={{ fontSize: 12, color: FAINT, textTransform: "uppercase", letterSpacing: 0.5 }}>In welchem Fall steht die markierte Phrase?</div>
          <SpeakBtn text={sentence} color={DRILL_ACCENT} />
        </div>
        <p lang="de" style={{ fontSize: 18.5, lineHeight: 1.6, color: "#cbd5e1", margin: "10px 0 0" }}>
          {before}{before && " "}
          <mark style={{ background: DRILL_ACCENT + "33", color: COLORS.txtStrong, borderRadius: 4, padding: "1px 3px", fontWeight: 700, borderBottom: `2px solid ${DRILL_ACCENT}` }}>{marked}</mark>
          {trail}{after && " "}{after}
        </p>
        {chosen !== null && (
          <div className="dm-reveal" role="status" aria-live="polite" style={{ marginTop: 12, borderTop: "1px solid #222", paddingTop: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: chosen === q.case ? COLORS.successText : COLORS.dangerText }}>
              {chosen === q.case ? "Richtig ✓" : "Nicht ganz"} — <span lang="de">„{q.phrase}“</span> steht im {CASE_LABEL[q.case]}
            </div>
            <div style={{ fontSize: 12.5, color: "#9aa6b6", marginTop: 6, lineHeight: 1.5 }}>💡 {q.why}</div>
            <div style={{ fontSize: 12.5, color: FAINT, marginTop: 8, fontStyle: "italic" }}>{q.en}</div>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {CASES.map((c, i) => {
          let bg = "#171717", border = COLORS.borderSoft, color = COLORS.txt;
          if (chosen !== null) {
            if (c === q.case) { bg = "#0a2a16"; border = COLORS.success; color = "#5eead4"; }
            else if (c === chosen) { bg = "#2a0d0d"; border = COLORS.danger; color = COLORS.dangerText; }
            else color = "#6b7280";
          }
          return (
            <button key={c} onClick={() => grade(c)} disabled={chosen !== null}
              style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: 12, padding: "13px 12px", color, fontSize: 15, fontWeight: 700, cursor: chosen ? "default" : "pointer", textAlign: "left" }}>
              <span style={{ color: FAINT, fontWeight: 400, marginRight: 8, fontSize: 12 }}>{i + 1}</span>{CASE_LABEL[c]}
            </button>
          );
        })}
      </div>

      {chosen !== null && (
        <button onClick={next}
          style={{ marginTop: 12, width: "100%", background: DRILL_ACCENT, border: "none", borderRadius: 12, padding: "14px", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
          {idx + 1 >= queue.length ? "Runde beenden" : "Weiter →"}
        </button>
      )}
      {credit}
    </div>
  );
}
