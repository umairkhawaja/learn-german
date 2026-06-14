// ── Level switcher: data-driven A1 / A2 / … / All ─────────────
// Renders only levels that have data, in registry order, plus "All".
import { useMemo } from "react";
import { LEVELS, lvlOf, levelsPresent } from "../config/levels";
import { CATEGORIES } from "../config/categories";

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

  return (
    <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
      {chips.map(({ key, label, color, count }) => {
        const active = levelFilter === key;
        return (
          <button key={key} onClick={() => setLevelFilter(key)}
            style={{
              flex: "1 1 0", minWidth: 72, padding: "9px 4px", borderRadius: 11,
              border: `1.5px solid ${active ? color : "#222"}`,
              background: active ? color + "18" : "#111",
              cursor: "pointer", transition: "border-color .15s, background .15s",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
            }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: active ? color : "#4a4f59", letterSpacing: "0.3px" }}>{key}</span>
            <span style={{ fontSize: 9.5, color: active ? color + "cc" : "#333", fontWeight: 500 }}>{label}</span>
            <span style={{ fontSize: 9.5, color: active ? color + "88" : "#272727", fontVariantNumeric: "tabular-nums" }}>
              {(count ?? 0).toLocaleString()} words
            </span>
          </button>
        );
      })}
    </div>
  );
}
