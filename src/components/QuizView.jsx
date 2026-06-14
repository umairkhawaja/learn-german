// ── Quiz view: single-category session with mode/filter controls
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { COLORS, TXT, MUTE } from "../config/theme";
import { lvlOf } from "../config/levels";
import { subcatsOf } from "../config/categories";
import { keyOf } from "../engine/progress";
import { pickSession } from "../engine/quiz";
import { QuizRunner } from "./QuizRunner";

export function QuizView({ cat, progress, setProgress, levelFilter, db }) {
  const [mode, setMode] = useState(cat.modes[0].id);
  const [catFilter, setCatFilter] = useState("All");
  const [focusWeak, setFocusWeak] = useState(false);
  const [queue, setQueue] = useState([]);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  const modeDef = cat.modes.find((m) => m.id === mode);

  const pool = useMemo(() => {
    return db[cat.key].filter((x) => {
      if (levelFilter !== "All" && lvlOf(x) !== levelFilter) return false;
      if (catFilter !== "All" && cat.catOf(x) !== catFilter) return false;
      if (progress[keyOf(cat.id, x)]?.skip) return false;
      return true;
    });
  }, [cat, catFilter, levelFilter, db, progress]);

  const buildQueue = useCallback((weak) => {
    const items = pickSession(pool, progressRef.current, cat.id, weak);
    setQueue(items.map((it) => ({ item: it, cat, question: modeDef.build(it, pool) })));
  }, [pool, cat, modeDef]);

  const startSession = useCallback(() => { setFocusWeak(false); buildQueue(false); }, [buildQueue]);
  const practiceWeak = useCallback(() => { setFocusWeak(true); buildQueue(true); }, [buildQueue]);

  useEffect(() => { buildQueue(focusWeak); /* eslint-disable-next-line */ }, [mode, catFilter, cat, levelFilter]);

  const controls = (
    <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
      <div style={{ display: "flex", gap: 3, background: COLORS.surfaceAlt, borderRadius: 9, padding: 3, flexWrap: "wrap" }}>
        {cat.modes.map((m) => (
          <button key={m.id} onClick={() => setMode(m.id)}
            style={{
              padding: "5px 11px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12,
              background: mode === m.id ? cat.color : "transparent", color: mode === m.id ? "#fff" : MUTE, fontWeight: mode === m.id ? 700 : 400,
            }}>
            {m.label}
          </button>
        ))}
      </div>
      <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
        style={{ background: COLORS.surfaceAlt, border: `1px solid ${COLORS.borderSoft}`, borderRadius: 9, padding: "6px 10px", color: TXT, fontSize: 12 }}>
        <option value="All">All categories</option>
        {subcatsOf(cat, db[cat.key]).map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <button onClick={() => { const v = !focusWeak; setFocusWeak(v); buildQueue(v); }} title="Prioritise words you struggle with"
        style={{ padding: "6px 10px", borderRadius: 9, border: `1px solid ${focusWeak ? cat.color : COLORS.borderSoft}`, background: focusWeak ? cat.color + "22" : COLORS.surfaceAlt, color: focusWeak ? cat.color : MUTE, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
        ◎ Weak
      </button>
    </div>
  );

  return (
    <QuizRunner
      key={cat.id}
      queue={queue}
      progress={progress}
      setProgress={setProgress}
      accent={cat.color}
      controls={controls}
      onRestart={startSession}
      onPracticeWeak={practiceWeak}
    />
  );
}
