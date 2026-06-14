// ── Sticky header: title, view tabs (desktop), levels, categories
import { COLORS } from "../config/theme";
import { lvlOf } from "../config/levels";
import { CATEGORIES } from "../config/categories";
import { LevelSwitcher } from "./LevelSwitcher";

// The single source of truth for the app's views. Bottom nav reuses it.
export const VIEWS = [
  { id: "quiz", label: "Quiz", icon: "📚" },
  { id: "review", label: "Review", icon: "🔁" },
  { id: "browse", label: "Browse", icon: "🔍" },
  { id: "cheatsheet", label: "Cheatsheet", icon: "📖" },
  { id: "notes", label: "Notes", icon: "📝" },
  { id: "stats", label: "Stats", icon: "📊" },
];

const NO_LEVELS = new Set(["cheatsheet", "notes"]);
const NO_CATEGORIES = new Set(["review", "stats", "cheatsheet", "notes"]);

export function Header({ db, view, setView, levelFilter, setLevelFilter, activeCat, setActiveCat, dueCount }) {
  const totalWords = CATEGORIES.reduce((s, c) => s + db[c.key].length, 0);

  return (
    <div style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(15,15,15,0.92)", backdropFilter: "blur(8px)", borderBottom: "1px solid #1e1e1e", paddingTop: "env(safe-area-inset-top)" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.txtStrong, letterSpacing: "-0.3px" }}>🇩🇪 Deutsch Meister</div>
            <div style={{ fontSize: 11, color: "#4a4f59", marginTop: 1 }}>{totalWords.toLocaleString()} words · {levelFilter === "All" ? "all levels" : levelFilter}</div>
          </div>
          {/* Desktop view tabs (hidden on narrow screens — bottom nav takes over) */}
          <div className="dm-top-tabs" style={{ display: "flex", gap: 4, background: COLORS.surfaceAlt, borderRadius: 9, padding: 4 }}>
            {VIEWS.map(({ id, label, icon }) => (
              <button key={id} onClick={() => setView(id)}
                style={{
                  padding: "6px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, position: "relative",
                  background: view === id ? "#2a2a2a" : "transparent", color: view === id ? COLORS.txtStrong : "#5b626f", fontWeight: view === id ? 600 : 400,
                }}>
                {icon} {label}
                {id === "review" && dueCount > 0 && (
                  <span style={{ marginLeft: 4, fontSize: 10, color: "#fff", background: "#a855f7", borderRadius: 999, padding: "1px 5px", fontWeight: 700 }}>{dueCount}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {!NO_LEVELS.has(view) && (
          <LevelSwitcher db={db} levelFilter={levelFilter} setLevelFilter={setLevelFilter} />
        )}

        {!NO_CATEGORIES.has(view) && (
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            {CATEGORIES.map((t, i) => {
              const count = db[t.key].filter((x) => levelFilter === "All" || lvlOf(x) === levelFilter).length;
              return (
                <button key={t.id} onClick={() => setActiveCat(i)}
                  style={{
                    flex: 1, padding: "8px 4px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600,
                    background: activeCat === i ? t.color : COLORS.surfaceAlt, color: activeCat === i ? "#fff" : "#6b7280",
                  }}>
                  {t.label}
                  <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.75 }}>{count}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
