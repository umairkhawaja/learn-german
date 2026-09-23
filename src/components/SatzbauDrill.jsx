// ── Satzbau: rebuild the sentence from its scrambled words ────
// Sentences come from public/data/satzbau.json (scripts/build-exercises.mjs):
// the app's own German — English examples and short real sentences from the
// UD German PUD treebank. The original sentence is the only answer key.
//
// German allows some reordering (a time phrase can move to the front), so
// a different order is marked wrong but can be counted as right with one
// tap after comparing it to the original — the grade is written only when
// you move on, so that choice is yours.
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { COLORS, MUTE, FAINT } from "../config/theme";
import { keyOf, applyAnswer, saveProgress, isMastered } from "../engine/progress";
import { shuffle } from "../engine/quiz";
import { SpeakBtn, isTypingTarget } from "./ui";
import { ChipRow, weakFirst, ROUND, DRILL_ACCENT } from "./drillKit";

const CAT_ID = "satzbau";

const TYPES = [
  { value: "hauptsatz", label: "Hauptsatz", tags: ["hauptsatz"] },
  { value: "frage", label: "Frage", tags: ["w-frage", "ja-nein-frage"] },
  { value: "nebensatz", label: "Nebensatz", tags: ["nebensatz"] },
  { value: "relativsatz", label: "Relativsatz", tags: ["relativsatz"] },
  { value: "satzklammer", label: "Satzklammer", tags: ["satzklammer"] },
];

// The rule a sentence type follows — shown after each answer.
const RULES = {
  hauptsatz: "Aussagesatz: das konjugierte Verb steht auf Position 2. Davor steht genau ein Satzglied — steht dort nicht das Subjekt (z. B. eine Zeitangabe), folgt das Subjekt direkt nach dem Verb.",
  "w-frage": "W-Frage: W-Wort auf Position 1, konjugiertes Verb auf Position 2, dann das Subjekt.",
  "ja-nein-frage": "Ja/Nein-Frage: das konjugierte Verb steht ganz vorn, das Subjekt direkt danach.",
  nebensatz: "Nebensatz (weil, dass, wenn, ob …): das konjugierte Verb steht am Ende. Steht der Nebensatz vorn, beginnt der Hauptsatz danach mit seinem Verb.",
  relativsatz: "Relativsatz: nach dem Komma das Relativpronomen (der, die, das …), das konjugierte Verb am Ende.",
  satzklammer: "Satzklammer: Hilfs- oder Modalverb auf Position 2, Partizip, Infinitiv oder abgetrennte Vorsilbe ganz am Ende.",
};

let saved = null;

export function SatzbauDrill({ progress, setProgress, recordAnswer, levelFilter }) {
  const [data, setData] = useState(null);
  const [f, setF] = useState(saved || { src: ["app"], types: TYPES.map((t) => t.value) });
  const set = (patch) => setF((prev) => { const n = { ...prev, ...patch }; saved = n; return n; });
  const progressRef = useRef(progress);
  progressRef.current = progress;

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/satzbau.json`)
      .then((r) => r.json()).then(setData)
      .catch(() => setData({ items: [] }));
  }, []);

  const pool = useMemo(() => {
    const tags = new Set(TYPES.filter((t) => f.types.includes(t.value)).flatMap((t) => t.tags));
    return (data?.items || []).filter((s) =>
      f.src.includes(s.src)
      && (s.src === "pud" || levelFilter === "All" || s.lvl === levelFilter)
      && s.tags.some((t) => tags.has(t))
      && !isMastered(progress[keyOf(CAT_ID, { w: s.de })])
    );
    // Mastery only changes the pool between rounds, not mid-round.
    /* eslint-disable-next-line */
  }, [data, f, levelFilter]);

  const [queue, setQueue] = useState([]);
  const [idx, setIdx] = useState(0);
  const [tiles, setTiles] = useState([]);   // [{ id, text }] in shuffled order
  const [placed, setPlaced] = useState([]); // tile ids in answer order
  const [checked, setChecked] = useState(null); // null | { ok }
  const [override, setOverride] = useState(false);
  const [results, setResults] = useState([]);
  const [done, setDone] = useState(false);

  const deal = useCallback((s) => {
    if (!s) return;
    const base = s.tok.map((text, id) => ({ id, text }));
    let order = shuffle(base);
    // Never hand out the answer already in order.
    for (let k = 0; k < 5 && order.every((t, i) => t.text === s.tok[i]); k++) order = shuffle(base);
    setTiles(order); setPlaced([]); setChecked(null); setOverride(false);
  }, []);

  const restart = useCallback(() => {
    const q = weakFirst(pool, (s) => progressRef.current[keyOf(CAT_ID, { w: s.de })]).slice(0, ROUND);
    setQueue(q); setIdx(0); setResults([]); setDone(false);
    deal(q[0]);
  }, [pool, deal]);

  useEffect(() => { restart(); /* eslint-disable-next-line */ }, [pool]);

  const s = queue[idx];
  const answer = placed.map((id) => s?.tok[id]);

  const check = useCallback(() => {
    if (!s || checked || placed.length !== s.tok.length) return;
    setChecked({ ok: answer.join(" ") === s.tok.join(" ") });
  }, [s, checked, placed.length, answer]);

  const next = useCallback(() => {
    if (!checked) return;
    const ok = checked.ok || override;
    const k = keyOf(CAT_ID, { w: s.de });
    const np = { ...progressRef.current, [k]: applyAnswer(progressRef.current[k], ok) };
    setProgress(np);
    saveProgress(np);
    recordAnswer?.(1);
    setResults((r) => [...r, { s, ok }]);
    if (idx + 1 >= queue.length) { setDone(true); return; }
    setIdx(idx + 1);
    deal(queue[idx + 1]);
  }, [checked, override, s, idx, queue, deal, setProgress, recordAnswer]);

  useEffect(() => {
    const onKey = (e) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (done) { if (e.key === "Enter") { restart(); e.preventDefault(); } return; }
      if (e.key === "Enter") { checked ? next() : check(); e.preventDefault(); }
      else if (e.key === "Backspace" && !checked) { setPlaced((p) => p.slice(0, -1)); e.preventDefault(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, checked, check, next, restart]);

  if (!data) return <div style={{ color: FAINT, textAlign: "center", padding: 40 }}>Loading…</div>;

  const filters = (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "10px 12px 6px", marginBottom: 12 }}>
      <ChipRow label="Quelle" value={f.src} onChange={(v) => set({ src: v })}
        options={[{ value: "app", label: `App-Sätze${levelFilter === "All" ? "" : ` (${levelFilter})`}` }, { value: "pud", label: "Echte Sätze (B1+)" }]} />
      <ChipRow label="Satzart" value={f.types} onChange={(v) => set({ types: v })} options={TYPES} />
      <div style={{ fontSize: 11, color: FAINT, marginBottom: 4 }}>{pool.length} Sätze offen · gemeisterte fallen raus</div>
    </div>
  );

  const credit = f.src.includes("pud") && (
    <div style={{ fontSize: 10.5, color: "#3f4651", marginTop: 14, textAlign: "center", lineHeight: 1.5 }}>
      „Echte Sätze“: Universal Dependencies German PUD treebank (CC BY-SA 3.0), mit menschlicher Übersetzung.
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

  if (!s) return <div>{filters}<div style={{ color: FAINT, textAlign: "center", padding: 30 }}>Keine offenen Sätze für diese Auswahl.</div></div>;

  const placedSet = new Set(placed);
  const full = placed.length === s.tok.length;
  const ruleTags = s.tags.filter((t) => RULES[t]);

  return (
    <div>
      {filters}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1, height: 5, background: "#1f1f1f", borderRadius: 999 }}>
          <div style={{ width: `${((idx + (checked ? 1 : 0)) / queue.length) * 100}%`, height: 5, background: DRILL_ACCENT, borderRadius: 999, transition: "width .3s" }} />
        </div>
        <span style={{ fontSize: 12, color: FAINT, fontVariantNumeric: "tabular-nums" }}>{idx + 1}/{queue.length}</span>
      </div>

      <div style={{ background: "#131313", border: `1px solid ${DRILL_ACCENT}33`, borderRadius: 16, padding: "16px 16px 18px", marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: FAINT, textTransform: "uppercase", letterSpacing: 0.5 }}>Bau den Satz</div>
        <div style={{ fontSize: 16, color: COLORS.txt, marginTop: 6, lineHeight: 1.45 }}>{s.en}</div>

        {/* Answer line */}
        <div aria-label="Deine Reihenfolge" style={{ marginTop: 14, minHeight: 52, padding: "8px", borderRadius: 12, background: "#0f0f0f", border: `1.5px dashed ${checked ? (checked.ok || override ? COLORS.success : COLORS.danger) : COLORS.borderSoft}`, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          {placed.length === 0 && <span style={{ fontSize: 12.5, color: "#3f4651", padding: "0 4px" }}>Tippe die Wörter unten in der richtigen Reihenfolge an</span>}
          {placed.map((id, i) => {
            const wrongHere = checked && !checked.ok && s.tok[id] !== s.tok[i];
            return (
              <Tile key={id} lang="de" onClick={() => !checked && setPlaced((p) => p.filter((x) => x !== id))}
                tone={checked ? (wrongHere ? "bad" : "good") : "placed"} disabled={!!checked}>
                {s.tok[id]}
              </Tile>
            );
          })}
          {full && <span style={{ color: MUTE, fontSize: 18, fontWeight: 700 }}>{s.end}</span>}
        </div>

        {/* Word bank */}
        {!checked && (
          <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {tiles.filter((t) => !placedSet.has(t.id)).map((t) => (
              <Tile key={t.id} lang="de" onClick={() => setPlaced((p) => [...p, t.id])}>{t.text}</Tile>
            ))}
          </div>
        )}

        {checked && (
          <div className="dm-reveal" role="status" aria-live="polite" style={{ marginTop: 14, borderTop: "1px solid #222", paddingTop: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: checked.ok || override ? COLORS.successText : COLORS.dangerText }}>
              {checked.ok ? "Richtig ✓" : override ? "Als richtig gezählt ✓" : "Andere Reihenfolge"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <span lang="de" style={{ fontSize: 16.5, color: COLORS.txtStrong, fontWeight: 600, lineHeight: 1.45 }}>{s.de}</span>
              <SpeakBtn text={s.de} color={DRILL_ACCENT} size={28} />
            </div>
            {ruleTags.map((t) => (
              <div key={t} style={{ fontSize: 12.5, color: "#9aa6b6", marginTop: 8, lineHeight: 1.5 }}>💡 {RULES[t]}</div>
            ))}
            {!checked.ok && (
              <button onClick={() => setOverride(!override)}
                style={{ marginTop: 10, background: "transparent", border: `1px solid ${COLORS.borderSoft}`, borderRadius: 8, color: override ? COLORS.successText : FAINT, fontSize: 12, cursor: "pointer", padding: "6px 10px" }}>
                {override ? "↺ Doch als falsch zählen" : "Meine Reihenfolge ist auch korrekt"}
              </button>
            )}
          </div>
        )}
      </div>

      {!checked ? (
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setPlaced([])} disabled={!placed.length}
            style={{ flex: "0 0 auto", background: COLORS.surfaceAlt, border: `1px solid ${COLORS.borderSoft}`, borderRadius: 12, padding: "14px 16px", color: MUTE, fontSize: 14, cursor: placed.length ? "pointer" : "default" }}>
            Zurücksetzen
          </button>
          <button onClick={check} disabled={!full}
            style={{ flex: 1, background: full ? DRILL_ACCENT : "#2a1a1d", border: "none", borderRadius: 12, padding: "14px", color: full ? "#fff" : "#6b4a50", fontSize: 15, fontWeight: 700, cursor: full ? "pointer" : "default" }}>
            Prüfen
          </button>
        </div>
      ) : (
        <button onClick={next}
          style={{ width: "100%", background: DRILL_ACCENT, border: "none", borderRadius: 12, padding: "14px", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
          {idx + 1 >= queue.length ? "Runde beenden" : "Weiter →"}
        </button>
      )}
      <div style={{ textAlign: "center", marginTop: 10, fontSize: 11, color: "#3a3f49" }}>Enter prüft · Rücktaste nimmt das letzte Wort zurück</div>
      {credit}
    </div>
  );
}

function Tile({ children, onClick, tone, disabled, lang }) {
  const look = {
    placed: { bg: "#1f1a2e", border: "#6d5bd0", color: COLORS.txtStrong },
    good: { bg: "#0a2a16", border: COLORS.success, color: "#bbf7d0" },
    bad: { bg: "#2a0d0d", border: COLORS.danger, color: COLORS.dangerText },
  }[tone] || { bg: "#1a1a1a", border: COLORS.borderSoft, color: COLORS.txt };
  return (
    <button onClick={onClick} disabled={disabled} lang={lang}
      style={{ background: look.bg, border: `1.5px solid ${look.border}`, borderRadius: 9, padding: "8px 11px", minHeight: 38, color: look.color, fontSize: 15, fontWeight: 600, cursor: disabled ? "default" : "pointer" }}>
      {children}
    </button>
  );
}
