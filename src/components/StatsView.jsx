// ── Stats view: per-level + per-category progress, backup, reset
import { useState } from "react";
import { COLORS, TXT, MUTE, FAINT } from "../config/theme";
import { LEVELS, lvlOf, levelsPresent } from "../config/levels";
import { CATEGORIES } from "../config/categories";
import { keyOf, clearProgress } from "../engine/progress";
import { StatTile } from "./ui";
import { BackupPanel } from "./BackupPanel";

export function StatsView({ progress, setProgress, levelFilter, driveStatus, setDriveStatus, db }) {
  const [confirm, setConfirm] = useState(false);

  let mastered = 0, seen = 0, totalWords = 0, totCorrect = 0, totAns = 0;
  const perCat = CATEGORIES.map((cat) => {
    const pool = db[cat.key].filter((x) => levelFilter === "All" || lvlOf(x) === levelFilter);
    let cSeen = 0, cMast = 0, cCorrect = 0, cTot = 0;
    pool.forEach((it) => {
      const p = progress[keyOf(cat.id, it)];
      if (p && p.total > 0) { cSeen++; seen++; cCorrect += p.correct; cTot += p.total; totCorrect += p.correct; totAns += p.total; }
      if (p && (p.skip || p.mastery >= 4)) { cMast++; mastered++; }
    });
    totalWords += pool.length;
    return { cat, total: pool.length, seen: cSeen, mastered: cMast, correct: cCorrect, answered: cTot };
  });

  // ── Per-level rollup (across all categories) ──
  const allItems = CATEGORIES.flatMap((cat) => db[cat.key].map((it) => ({ it, cat })));
  const presentLevels = levelsPresent(allItems.map((x) => x.it));
  const perLevel = presentLevels.map((code) => {
    let total = 0, lMast = 0, lSeen = 0;
    allItems.forEach(({ it, cat }) => {
      if (lvlOf(it) !== code) return;
      total++;
      const p = progress[keyOf(cat.id, it)];
      if (p && p.total > 0) lSeen++;
      if (p && (p.skip || p.mastery >= 4)) lMast++;
    });
    return { code, total, mastered: lMast, seen: lSeen, meta: LEVELS.find((l) => l.code === code) };
  });

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <StatTile label="Mastered" value={mastered} color={COLORS.success} />
        <StatTile label="Seen" value={seen} color={COLORS.der} />
        <StatTile label="Accuracy" value={totAns ? Math.round((totCorrect / totAns) * 100) + "%" : "—"} color="#a855f7" />
      </div>

      {/* Per-level progress (always whole-dataset, independent of filter) */}
      {perLevel.length > 1 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: FAINT, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>By level</div>
          <div style={{ display: "grid", gap: 9 }}>
            {perLevel.map(({ code, total, mastered, meta }) => {
              const mpct = total ? Math.round((mastered / total) * 100) : 0;
              const color = meta?.color || "#6b7280";
              return (
                <div key={code} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 30, fontSize: 13, fontWeight: 800, color }}>{code}</div>
                  <div style={{ flex: 1, position: "relative", background: "#1f1f1f", borderRadius: 999, height: 7, overflow: "hidden" }}>
                    <div style={{ position: "absolute", inset: 0, width: `${mpct}%`, background: color, borderRadius: 999, transition: "width .5s" }} />
                  </div>
                  <div style={{ width: 96, textAlign: "right", fontSize: 12, color: MUTE, fontVariantNumeric: "tabular-nums" }}>{mastered}/{total} mastered</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ fontSize: 12, color: FAINT, marginBottom: 8 }}>{mastered} of {totalWords} words mastered (★★★★+){levelFilter !== "All" ? ` · ${levelFilter}` : ""}</div>
      <div style={{ display: "grid", gap: 11 }}>
        {perCat.map(({ cat, total, seen, mastered, correct, answered }) => {
          const pct = total ? Math.round((seen / total) * 100) : 0;
          const mpct = total ? Math.round((mastered / total) * 100) : 0;
          return (
            <div key={cat.id} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 15 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: cat.color, fontWeight: 700 }}>{cat.label}</span>
                <span style={{ color: MUTE, fontSize: 13 }}>{seen}/{total} seen · {mastered} mastered</span>
              </div>
              <div style={{ position: "relative", background: "#1f1f1f", borderRadius: 999, height: 7, marginBottom: 8, overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, width: `${pct}%`, background: cat.color + "55", borderRadius: 999, transition: "width .5s" }} />
                <div style={{ position: "absolute", inset: 0, width: `${mpct}%`, background: cat.color, borderRadius: 999, transition: "width .5s" }} />
              </div>
              <div style={{ fontSize: 12, color: FAINT }}>{answered > 0 ? `${correct}/${answered} correct (${Math.round((correct / answered) * 100)}%)` : "No quizzes yet"}</div>
            </div>
          );
        })}
      </div>

      <BackupPanel progress={progress} setProgress={setProgress} driveStatus={driveStatus} setDriveStatus={setDriveStatus} />

      <div style={{ marginTop: 22, textAlign: "center" }}>
        {!confirm ? (
          <button onClick={() => setConfirm(true)} style={{ background: "transparent", border: `1px solid ${COLORS.borderSoft}`, color: FAINT, borderRadius: 9, padding: "8px 16px", fontSize: 12.5, cursor: "pointer" }}>
            Reset all progress
          </button>
        ) : (
          <div style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
            <span style={{ fontSize: 12.5, color: MUTE }}>Erase everything? Export a backup first if unsure.</span>
            <button onClick={async () => { await clearProgress(); setProgress({}); setConfirm(false); }}
              style={{ background: "#2a0d0d", border: `1px solid ${COLORS.danger}`, color: COLORS.dangerText, borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Yes, reset</button>
            <button onClick={() => setConfirm(false)} style={{ background: "transparent", border: `1px solid ${COLORS.borderSoft}`, color: MUTE, borderRadius: 8, padding: "7px 14px", fontSize: 12.5, cursor: "pointer" }}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}
