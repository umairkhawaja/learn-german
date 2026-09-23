// ── Level switcher: data-driven A1 / A2 / … / All ─────────────
// Renders only levels that have data, in registry order, plus "All".
import { useMemo } from "react";
import { LEVELS, lvlOf, levelsPresent } from "../config/levels";
import { CATEGORIES } from "../config/categories";
import { MUTE, FAINT } from "../config/theme";

export function LevelSwitcher({ db, levelFilter, setLevelFilter }) {
  const { present, counts, total } = useMemo(() => {
    const all = CATEGORIES.flatMap((c) => db[c.key]);
    const codes = levelsPresent(all);
    const counts = Object.fromEntries(
      codes.map((code) => [code, all.filter((x) => lvlOf(x) === code).length])
    );
    return { present: codes, counts, total: all.length };
  }, [db]);

  const chips = [
    ...present.map((code) => {
      const m = LEVELS.find((l) => l.code === code);
      return { key: code, label: m.label, color: m.color, count: counts[code] };
    }),
    { key: "All", label: "All levels", color: "#6b7280", count: total },
  ];

  // Inactive chips used #333 and #272727 text on #111, which is close to
  // invisible; they now use the app's muted greys. On a phone the chips
  // drop the level name and put the count beside the code (AppStyles), so
  // the row is one line high instead of three.
  return (
    <div className="dm-levels" role="group" aria-label="Level" style={{ display: "flex", gap: 6, marginTop: 10 }}>
      {chips.map(({ key, label, color, count }) => {
        const active = levelFilter === key;
        return (
          <button key={key} className="dm-level-chip" onClick={() => setLevelFilter(key)} aria-pressed={active}
            title={`${label} · ${(count ?? 0).toLocaleString()} words`}
            style={{
              flex: "1 1 0", minWidth: 0, borderRadius: 11,
              border: `1.5px solid ${active ? color : "#262626"}`,
              background: active ? color + "18" : "#111",
              cursor: "pointer", transition: "border-color .15s, background .15s",
            }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: active ? color : MUTE, letterSpacing: "0.3px" }}>{key}</span>
            <span className="dm-level-label" style={{ fontSize: 9.5, color: active ? color + "cc" : FAINT, fontWeight: 500 }}>{label}</span>
            <span className="dm-level-count" style={{ fontSize: 9.5, color: active ? color + "aa" : FAINT, fontVariantNumeric: "tabular-nums" }}>
              {(count ?? 0).toLocaleString()}<span className="dm-level-words"> words</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
