// ── Stats view: per-level + per-category progress, backup, reset
import { useState, useEffect } from "react";
import { COLORS, TXT, MUTE, FAINT } from "../config/theme";
import { LEVELS, lvlOf, levelsPresent } from "../config/levels";
import { CATEGORIES } from "../config/categories";
import { keyOf, clearProgress, isMastered } from "../engine/progress";
import { StatTile, Tag } from "./ui";
import { CHUNK_CAT_ID } from "./ChunksView";
import { BackupPanel } from "./BackupPanel";
import { answeredToday, streakOf, recentDays, GOAL_CHOICES } from "../engine/activity";

// ── Activity ──────────────────────────────────────────────────
// Mastery counts said how far through the dataset you are. They said nothing
// about whether you are actually turning up, which is the part that decides
// whether any of it sticks.
function ActivityPanel({ activity, goal, setGoal, dueCount }) {
  const done = answeredToday(activity);
  const streak = streakOf(activity);
  const days = recentDays(activity, 14);
  const best = Math.max(goal, ...days.map((d) => d.count), 1);
  const total = days.reduce((a, d) => a + d.count, 0);

  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 15, marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700, color: COLORS.txtStrong, fontSize: 14 }}>🔥 Daily practice</span>
        <span style={{ fontSize: 12.5, color: MUTE }}>
          {streak > 0 ? `${streak}-day streak` : "No streak yet"} · {total} cards in 14 days
        </span>
      </div>

      {/* Two weeks of daily counts. A bar at or above the goal is green, so
          the run of kept days is readable at a glance. */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 54, marginTop: 12 }}>
        {days.map(({ key, count }) => {
          const h = Math.max(count > 0 ? 4 : 2, Math.round((count / best) * 50));
          const met = count >= goal;
          return (
            <div key={key} title={`${key}: ${count} card${count === 1 ? "" : "s"}`}
              style={{
                flex: 1, height: h, borderRadius: 3,
                background: count === 0 ? "#1c1c1c" : met ? COLORS.success : "#a855f7",
                opacity: count === 0 ? 1 : 0.9,
              }} />
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: COLORS.ghost, marginTop: 5 }}>
        <span>14 days ago</span><span>today</span>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 14 }}>
        <span style={{ fontSize: 12.5, color: MUTE }}>Daily goal:</span>
        <div style={{ display: "flex", gap: 3, background: COLORS.surfaceAlt, borderRadius: 9, padding: 3 }}>
          {GOAL_CHOICES.map((g) => (
            <button key={g} onClick={() => setGoal(g)} aria-pressed={goal === g}
              style={{
                padding: "5px 11px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12,
                background: goal === g ? "#a855f7" : "transparent", color: goal === g ? "#fff" : MUTE, fontWeight: goal === g ? 700 : 400,
              }}>{g}</button>
          ))}
        </div>
        <span style={{ fontSize: 12.5, color: done >= goal ? COLORS.successText : MUTE }}>
          {done >= goal ? `✓ ${done} done today` : `${done} done today`}
        </span>
        {dueCount > 0 && <Tag color="#7dd3fc" bg="#0d2430">↻ {dueCount} due for review</Tag>}
      </div>

      <div style={{ fontSize: 11, color: "#3f4651", marginTop: 10, lineHeight: 1.5 }}>
        Counted on this device only — your word mastery syncs, the streak does not.
      </div>
    </div>
  );
}

export function StatsView({ progress, setProgress, levelFilter, driveStatus, setDriveStatus, cloudStatus, setCloudStatus, db, activity, goal, setGoal, dueCount }) {
  const [confirm, setConfirm] = useState(false);

  // Chunks live outside the category registry (their own tab and card UI),
  // so their mastery is rolled up here from public/data/chunks.json.
  const [chunks, setChunks] = useState([]);
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/chunks.json`)
      .then((r) => r.json()).then(setChunks).catch(() => setChunks([]));
  }, []);
  const chunkScope = chunks.filter((x) => levelFilter === "All" || x.lvl === levelFilter);
  const chunkStats = chunkScope.reduce((a, x) => {
    const p = progress[keyOf(CHUNK_CAT_ID, x)];
    if (p && p.total > 0) { a.seen++; a.correct += p.correct; a.answered += p.total; }
    if (isMastered(p)) a.mastered++;
    return a;
  }, { seen: 0, mastered: 0, correct: 0, answered: 0 });

  let mastered = 0, seen = 0, totalWords = 0, totCorrect = 0, totAns = 0;
  const perCat = CATEGORIES.map((cat) => {
    const pool = db[cat.key].filter((x) => levelFilter === "All" || lvlOf(x) === levelFilter);
    let cSeen = 0, cMast = 0, cCorrect = 0, cTot = 0;
    pool.forEach((it) => {
      const p = progress[keyOf(cat.id, it)];
      if (p && p.total > 0) { cSeen++; seen++; cCorrect += p.correct; cTot += p.total; totCorrect += p.correct; totAns += p.total; }
      if (isMastered(p)) { cMast++; mastered++; }
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
      if (isMastered(p)) lMast++;
    });
    return { code, total, mastered: lMast, seen: lSeen, meta: LEVELS.find((l) => l.code === code) };
  });

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <StatTile label="Mastered" value={mastered.toLocaleString()} color={COLORS.success} />
        <StatTile label="Seen" value={seen.toLocaleString()} color={COLORS.der} />
        <StatTile label="Accuracy" value={totAns ? Math.round((totCorrect / totAns) * 100) + "%" : "—"} color="#a855f7" />
      </div>

      <ActivityPanel activity={activity} goal={goal} setGoal={setGoal} dueCount={dueCount} />

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
                  {/* "0/2,121 mastered" does not fit 96px and wrapped onto two
                      lines against a 7px bar; the word is dropped and the row
                      is kept on one line. */}
                  <div title={`${mastered} of ${total} mastered`}
                    style={{ minWidth: 74, textAlign: "right", fontSize: 12, color: MUTE, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                    {mastered.toLocaleString()}/{total.toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ fontSize: 12, color: FAINT, marginBottom: 8 }}>{mastered.toLocaleString()} of {totalWords.toLocaleString()} words mastered (★★★★+){levelFilter !== "All" ? ` · ${levelFilter}` : ""}</div>
      <div style={{ display: "grid", gap: 11 }}>
        {perCat.map(({ cat, total, seen, mastered, correct, answered }) => {
          const pct = total ? Math.round((seen / total) * 100) : 0;
          const mpct = total ? Math.round((mastered / total) * 100) : 0;
          return (
            <div key={cat.id} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 15 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: cat.color, fontWeight: 700 }}>{cat.label}</span>
                <span style={{ color: MUTE, fontSize: 13 }}>{seen.toLocaleString()}/{total.toLocaleString()} seen · {mastered.toLocaleString()} mastered</span>
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

      {chunkScope.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 11, color: FAINT, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Chunks</div>
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 15 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: "#14b8a6", fontWeight: 700 }}>Everyday chunks</span>
              <span style={{ color: MUTE, fontSize: 13 }}>{chunkStats.seen}/{chunkScope.length} seen · {chunkStats.mastered} mastered</span>
            </div>
            <div style={{ position: "relative", background: "#1f1f1f", borderRadius: 999, height: 7, marginBottom: 8, overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, width: `${chunkScope.length ? (chunkStats.seen / chunkScope.length) * 100 : 0}%`, background: "#14b8a655", borderRadius: 999, transition: "width .5s" }} />
              <div style={{ position: "absolute", inset: 0, width: `${chunkScope.length ? (chunkStats.mastered / chunkScope.length) * 100 : 0}%`, background: "#14b8a6", borderRadius: 999, transition: "width .5s" }} />
            </div>
            <div style={{ fontSize: 12, color: FAINT }}>{chunkStats.answered > 0 ? `${chunkStats.correct}/${chunkStats.answered} recalled (${Math.round((chunkStats.correct / chunkStats.answered) * 100)}%)` : "No chunk practice yet"}</div>
          </div>
        </div>
      )}

      <BackupPanel progress={progress} setProgress={setProgress} driveStatus={driveStatus} setDriveStatus={setDriveStatus} cloudStatus={cloudStatus} setCloudStatus={setCloudStatus} />

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
