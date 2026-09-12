// ── Sticky header: title, daily bar, view tabs, levels, categories
import { COLORS } from "../config/theme";
import { lvlOf } from "../config/levels";
import { CATEGORIES } from "../config/categories";
import { LevelSwitcher } from "./LevelSwitcher";
import { answeredToday, streakOf } from "../engine/activity";

// The single source of truth for the app's views. Bottom nav reuses it,
// falling back to `short` where the full label no longer fits seven tabs
// across a phone screen.
export const VIEWS = [
  { id: "mixed", label: "Mixed", icon: "🎲" },
  { id: "quiz", label: "Quiz", icon: "📚" },
  { id: "chunks", label: "Chunks", icon: "🧩" },
  { id: "browse", label: "Browse", icon: "🔍" },
  { id: "cheatsheet", label: "Spickzettel", short: "Spick", icon: "📖" },
  { id: "notes", label: "Notes", icon: "📝" },
  { id: "stats", label: "Stats", icon: "📊" },
];

// Chunks brings its own level chips (A2+ only), so the shared switcher is hidden there.
const NO_LEVELS = new Set(["cheatsheet", "notes", "chunks"]);
// Mixed draws from several categories at once and picks them with its own
// chips, so the single-category tab row would be meaningless there.
const NO_CATEGORIES = new Set(["mixed", "stats", "cheatsheet", "notes", "chunks"]);

// ── Today's bar ───────────────────────────────────────────────
// Two facts a language app has to keep in front of you and this one did not:
// how much you have done today against your goal, and how many days in a row
// you have kept it up. Both come from engine/activity.
function TodayBar({ activity, goal, dueCount }) {
  const done = answeredToday(activity);
  const streak = streakOf(activity);
  const pct = goal ? Math.min(100, Math.round((done / goal) * 100)) : 0;
  const met = done >= goal;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
      <div
        style={{ flex: 1, height: 6, background: "#1b1b1b", borderRadius: 999, overflow: "hidden" }}
        role="progressbar" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(done, goal)}
        aria-label={`Today: ${done} of ${goal} cards`}
      >
        <div style={{
          width: `${pct}%`, height: "100%", borderRadius: 999,
          background: met ? COLORS.success : "#a855f7", transition: "width .4s",
        }} />
      </div>
      <span style={{ fontSize: 11, color: met ? COLORS.successText : COLORS.faint, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
        {met ? `✓ ${done}` : `${done}/${goal}`} today
      </span>
      {streak > 0 && (
        <span title={`${streak} day${streak === 1 ? "" : "s"} in a row`}
          style={{ fontSize: 11, color: COLORS.streak, fontWeight: 700, whiteSpace: "nowrap" }}>
          🔥 {streak}
        </span>
      )}
      {dueCount > 0 && (
        <span title={`${dueCount} word${dueCount === 1 ? "" : "s"} are due for review`}
          style={{ fontSize: 11, color: "#7dd3fc", fontWeight: 700, whiteSpace: "nowrap" }}>
          ↻ {dueCount} due
        </span>
      )}
    </div>
  );
}

export function Header({
  db, view, setView, levelFilter, setLevelFilter, activeCat, setActiveCat,
  backlogCount, dueCount, activity, goal,
}) {
  const totalWords = CATEGORIES.reduce((s, c) => s + db[c.key].length, 0);

  return (
    <header style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(15,15,15,0.92)", backdropFilter: "blur(8px)", borderBottom: "1px solid #1e1e1e", paddingTop: "env(safe-area-inset-top)" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.txtStrong, letterSpacing: "-0.3px" }}>🇩🇪 Deutsch Meister</div>
            <div style={{ fontSize: 11, color: "#4a4f59", marginTop: 1 }}>{totalWords.toLocaleString()} words · {levelFilter === "All" ? "all levels" : levelFilter}</div>
          </div>
          {/* Desktop view tabs (hidden on narrow screens — bottom nav takes over) */}
          <nav className="dm-top-tabs" aria-label="Sections" style={{ display: "flex", gap: 4, background: COLORS.surfaceAlt, borderRadius: 9, padding: 4 }}>
            {VIEWS.map(({ id, label, icon }) => (
              <button key={id} onClick={() => setView(id)} aria-current={view === id ? "page" : undefined}
                style={{
                  padding: "6px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, position: "relative",
                  background: view === id ? "#2a2a2a" : "transparent", color: view === id ? COLORS.txtStrong : "#5b626f", fontWeight: view === id ? 600 : 400,
                }}>
                <span aria-hidden="true">{icon}</span> {label}
                {id === "quiz" && backlogCount > 0 && (
                  <span style={{ marginLeft: 4, fontSize: 10, color: "#fff", background: "#a855f7", borderRadius: 999, padding: "1px 5px", fontWeight: 700 }}>{backlogCount}</span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <TodayBar activity={activity} goal={goal} dueCount={dueCount} />

        {!NO_LEVELS.has(view) && (
          <LevelSwitcher db={db} levelFilter={levelFilter} setLevelFilter={setLevelFilter} />
        )}

        {!NO_CATEGORIES.has(view) && (
          /* Grid, not a flex row: six labels as wide as "Adjectives" don't
             fit across a 360px phone, and as flex items they refused to
             shrink — which is what pushed the whole page sideways. Here
             they wrap onto a second row instead. */
          <div role="tablist" aria-label="Word type" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))", gap: 6, marginTop: 8 }}>
            {CATEGORIES.map((t, i) => {
              const count = db[t.key].filter((x) => levelFilter === "All" || lvlOf(x) === levelFilter).length;
              return (
                <button key={t.id} onClick={() => setActiveCat(i)} role="tab" aria-selected={activeCat === i}
                  style={{
                    minWidth: 0, padding: "8px 4px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600,
                    background: activeCat === i ? t.color : COLORS.surfaceAlt, color: activeCat === i ? "#fff" : "#6b7280",
                  }}>
                  {t.label}
                  <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.75 }}>{count.toLocaleString()}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
}
