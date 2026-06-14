// ── Review view: cross-category "due today" SRS deck ──────────
import { useState, useCallback, useRef, useEffect } from "react";
import { COLORS, MUTE, FAINT } from "../config/theme";
import { CATEGORIES } from "../config/categories";
import { pickDueReview, dueCount } from "../engine/quiz";
import { QuizRunner } from "./QuizRunner";

const ACCENT = "#a855f7";

export function ReviewView({ progress, setProgress, levelFilter, db }) {
  const [queue, setQueue] = useState(null); // null = not started
  const progressRef = useRef(progress);
  progressRef.current = progress;

  const due = dueCount(db, CATEGORIES, progress, levelFilter);

  const start = useCallback(() => {
    setQueue(pickDueReview(db, CATEGORIES, progressRef.current, levelFilter));
  }, [db, levelFilter]);

  // Reset to the intro screen if the level filter changes mid-way.
  useEffect(() => { setQueue(null); }, [levelFilter]);

  if (queue === null) {
    return (
      <div style={{ textAlign: "center", paddingTop: 24 }}>
        <div style={{ fontSize: 48, marginBottom: 6 }}>🔁</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.txtStrong }}>Daily review</div>
        <div style={{ fontSize: 13.5, color: MUTE, margin: "8px 0 4px", maxWidth: 360, marginLeft: "auto", marginRight: "auto", lineHeight: 1.6 }}>
          Words you've practised resurface here on a spaced schedule — right when you're about to forget them. Mixes every category{levelFilter !== "All" ? ` in ${levelFilter}` : ""}.
        </div>
        <div style={{ fontSize: 14, color: due > 0 ? ACCENT : COLORS.success, fontWeight: 700, margin: "14px 0 18px" }}>
          {due > 0 ? `${due} word${due === 1 ? "" : "s"} due now` : "All caught up — nothing due. 🎉"}
        </div>
        {due > 0 && (
          <button onClick={start}
            style={{ background: ACCENT, border: "none", borderRadius: 12, padding: "13px 28px", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            Start review →
          </button>
        )}
        {due === 0 && (
          <div style={{ fontSize: 12.5, color: FAINT, maxWidth: 340, margin: "0 auto", lineHeight: 1.6 }}>
            Practise some words in the Quiz tab and they'll show up here over the coming days.
          </div>
        )}
      </div>
    );
  }

  return (
    <QuizRunner
      queue={queue}
      progress={progress}
      setProgress={setProgress}
      accent={ACCENT}
      controls={null}
      onRestart={() => setQueue(null)}
    />
  );
}
