// ── Stats view: per-level + per-category progress, backup, reset
import { useState, useEffect } from "react";
import { COLORS, MUTE, FAINT } from "../config/theme";
import { LEVELS, lvlOf, levelsPresent } from "../config/levels";
import { CATEGORIES } from "../config/categories";
import { keyOf, clearProgress, isMastered } from "../engine/progress";
import { StatTile } from "./ui";
import { CHUNK_CAT_ID } from "./ChunksView";
import { BackupPanel } from "./BackupPanel";
import { answeredToday, streakOf } from "../engine/activity";
import {
  recentLearned, learnedToday as learnedTodayOf, goalStreak, monthStats,
  clampGoal, WORD_GOAL_CHOICES, MIN_WORD_GOAL, MAX_WORD_GOAL,
} from "../engine/goal";

// ── The goal ──────────────────────────────────────────────────
// Mastery counts said how far through the dataset you are. They said nothing
// about whether you are actually turning up, which is the part that decides
// whether any of it sticks — and the daily number they did show counted cards
// answered, which is effort rather than vocabulary.
//
// So this panel is built around the goal you set: N *new words* a day, what
// that adds up to across the month, and whether the month is on pace. The
// counts come from engine/goal (derived from each word's first-seen stamp);
// cards answered and the practice streak still come from engine/activity, one
// line down, where they belong — they are how the words were learned, not how
// many.
function GoalPanel({ activity, goal, setGoal, byDay, dueCount }) {
  const [custom, setCustom] = useState("");
  const learned = learnedTodayOf(byDay);
  const cards = answeredToday(activity);
  const practiceStreak = streakOf(activity);
  const gStreak = goalStreak(byDay, goal);
  const days = recentLearned(byDay, 14);
  const best = Math.max(goal, ...days.map((d) => d.count), 1);
  const month = monthStats(byDay, goal);
  const met = learned >= goal;
  const left = Math.max(0, goal - learned);

  // Where the month *should* be by today if every day had hit the goal — drawn
  // as a notch on the month bar, so "behind" is a place on the bar and not
  // just a word.
  const monthPct = month.target ? Math.min(100, (month.learned / month.target) * 100) : 0;
  const pacePct = month.target ? Math.min(100, (month.expected / month.target) * 100) : 0;

  const commitCustom = () => {
    const n = parseInt(custom, 10);
    if (Number.isFinite(n)) setGoal(clampGoal(n));
    setCustom("");
  };

  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 15, marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700, color: COLORS.txtStrong, fontSize: 14 }}>🎯 Learning goal</span>
        <span style={{ fontSize: 12.5, color: MUTE }}>
          {goal} new words a day = <b style={{ color: COLORS.txtStrong }}>{month.target}</b> in {new Date().toLocaleDateString(undefined, { month: "long" })}
        </span>
      </div>

      {/* Setting the goal. The chips cover the usual answers; the box is there
          because someone whose goal is 12 should be able to say 12. */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
        <div role="group" aria-label="New words per day" style={{ display: "flex", gap: 3, background: COLORS.surfaceAlt, borderRadius: 9, padding: 3 }}>
          {WORD_GOAL_CHOICES.map((g) => (
            <button key={g} onClick={() => setGoal(g)} aria-pressed={goal === g}
              style={{
                padding: "5px 11px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12,
                background: goal === g ? "#a855f7" : "transparent", color: goal === g ? "#fff" : MUTE, fontWeight: goal === g ? 700 : 400,
              }}>{g}</button>
          ))}
        </div>
        <input
          type="number" inputMode="numeric" min={MIN_WORD_GOAL} max={MAX_WORD_GOAL}
          value={custom} onChange={(e) => setCustom(e.target.value)}
          onBlur={commitCustom}
          onKeyDown={(e) => { if (e.key === "Enter") { commitCustom(); e.currentTarget.blur(); } }}
          placeholder={WORD_GOAL_CHOICES.includes(goal) ? "custom" : String(goal)}
          aria-label="Custom daily goal, in new words per day"
          style={{
            width: 76, background: COLORS.surfaceAlt, border: `1px solid ${WORD_GOAL_CHOICES.includes(goal) ? COLORS.borderSoft : "#a855f7"}`,
            borderRadius: 9, padding: "6px 9px", color: COLORS.txt, fontSize: 12,
          }} />
        <span style={{ fontSize: 12, color: FAINT }}>words / day</span>
      </div>

      {/* Today */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: FAINT, textTransform: "uppercase", letterSpacing: 0.5 }}>Today</span>
          <span style={{ fontSize: 12.5, color: met ? COLORS.successText : MUTE, fontVariantNumeric: "tabular-nums" }}>
            {met ? `✓ ${learned} new words` : `${learned}/${goal} new words · ${left} to go`}
          </span>
        </div>
        <div style={{ height: 8, background: "#1b1b1b", borderRadius: 999, overflow: "hidden", marginTop: 7 }}>
          <div style={{ width: `${goal ? Math.min(100, (learned / goal) * 100) : 0}%`, height: "100%", borderRadius: 999, background: met ? COLORS.success : "#a855f7", transition: "width .4s" }} />
        </div>
        <div style={{ fontSize: 11.5, color: FAINT, marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span>{cards} card{cards === 1 ? "" : "s"} answered</span>
          {gStreak > 0 && <span style={{ color: COLORS.successText }}>· 🎯 {gStreak}-day goal streak</span>}
          {practiceStreak > 0 && <span style={{ color: COLORS.streak }}>· 🔥 {practiceStreak}-day practice streak</span>}
          {dueCount > 0 && <span style={{ color: "#7dd3fc" }}>· ↻ {dueCount} due for review</span>}
        </div>
      </div>

      {/* Two weeks of new words a day. A bar at or above the goal is green, so
          the run of kept days is readable at a glance. */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 54, marginTop: 16 }}>
        {days.map(({ key, count }) => {
          const h = Math.max(count > 0 ? 4 : 2, Math.round((count / best) * 50));
          const dayMet = count >= goal;
          return (
            <div key={key} title={`${key}: ${count} new word${count === 1 ? "" : "s"}${dayMet ? " · goal met" : ""}`}
              style={{
                flex: 1, height: h, borderRadius: 3,
                background: count === 0 ? "#1c1c1c" : dayMet ? COLORS.success : "#a855f7",
                opacity: count === 0 ? 1 : 0.9,
              }} />
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: COLORS.ghost, marginTop: 5 }}>
        <span>14 days ago</span><span>new words / day</span><span>today</span>
      </div>

      {/* This month */}
      <div style={{ marginTop: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: FAINT, textTransform: "uppercase", letterSpacing: 0.5 }}>This month</span>
          <span style={{ fontSize: 12.5, color: MUTE, fontVariantNumeric: "tabular-nums" }}>
            <b style={{ color: COLORS.txtStrong }}>{month.learned}</b>/{month.target} words
          </span>
        </div>
        <div style={{ position: "relative", height: 8, background: "#1b1b1b", borderRadius: 999, marginTop: 7 }}>
          <div style={{ position: "absolute", inset: 0, width: `${monthPct}%`, background: month.pace >= 0 ? COLORS.success : "#a855f7", borderRadius: 999, transition: "width .4s" }} />
          {/* The pace notch: where the month would be, on goal, by today. */}
          <div title={`On pace by today: ${month.expected}`}
            style={{ position: "absolute", top: -3, left: `${pacePct}%`, width: 2, height: 14, background: COLORS.txtStrong, opacity: 0.55, borderRadius: 2 }} />
        </div>
        {/* A month with nothing in it is not "148 behind" — it hasn't started.
            Telling someone on their first day that they are a fortnight behind
            a target they set an hour ago is how a goal gets abandoned. */}
        <div style={{ fontSize: 11.5, color: FAINT, marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {month.learned === 0 ? (
            <span>Nothing logged this month yet — today's {goal} starts it.</span>
          ) : (
            <>
              <span style={{ color: month.pace >= 0 ? COLORS.successText : COLORS.warn }}>
                {month.pace >= 0 ? `${month.pace} ahead of pace` : `${-month.pace} behind pace`}
              </span>
              <span>· {month.daysMet}/{month.daysCounted} day{month.daysCounted === 1 ? "" : "s"} met</span>
              <span>· {month.perDay.toFixed(1)} a day</span>
              {month.daysLeft > 0 && month.remaining > 0 && (
                <span>· {month.remaining} left over {month.daysLeft} day{month.daysLeft === 1 ? "" : "s"} ({Math.ceil(month.remaining / month.daysLeft)}/day)</span>
              )}
              {month.remaining === 0 && <span style={{ color: COLORS.successText }}>· month's target met 🎉</span>}
            </>
          )}
        </div>
      </div>

      <div style={{ fontSize: 11, color: "#3f4651", marginTop: 12, lineHeight: 1.5 }}>
        A word counts on the day you first meet it, so the goal travels with your
        progress across devices. Cards answered and the practice streak are counted
        on this device only.
      </div>
    </div>
  );
}

export function StatsView({ progress, setProgress, levelFilter, driveStatus, setDriveStatus, cloudStatus, setCloudStatus, db, activity, goal, setGoal, byDay, dueCount, preloadGis }) {
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

      <GoalPanel activity={activity} goal={goal} setGoal={setGoal} byDay={byDay} dueCount={dueCount} />

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

      <BackupPanel progress={progress} setProgress={setProgress} driveStatus={driveStatus} setDriveStatus={setDriveStatus} cloudStatus={cloudStatus} setCloudStatus={setCloudStatus} preloadGis={preloadGis} />

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
