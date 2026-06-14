// ── Browse view: searchable, filterable word list ─────────────
import { useState, useMemo } from "react";
import { COLORS, TXT, MUTE, FAINT } from "../config/theme";
import { lvlOf } from "../config/levels";
import { subcatsOf } from "../config/categories";
import { keyOf, saveProgress } from "../engine/progress";
import { MasterBtn, SpeakBtn } from "./ui";

export function BrowseView({ cat, progress, setProgress, levelFilter, db }) {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [expanded, setExpanded] = useState(null);

  const toggleMastered = (k) => {
    const prev = progress[k] || { mastery: 0, correct: 0, total: 0 };
    const np = { ...progress, [k]: { ...prev, skip: !prev.skip } };
    setProgress(np);
    saveProgress(np);
  };

  const pool = useMemo(
    () => db[cat.key].filter((x) => levelFilter === "All" || lvlOf(x) === levelFilter),
    [cat, levelFilter, db]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pool.filter((it) => {
      const matchCat = catFilter === "All" || cat.catOf(it) === catFilter;
      const matchSearch = !q || it.w.toLowerCase().includes(q) || it.e.toLowerCase().includes(q) || (it.n && it.n.toLowerCase().includes(q));
      return matchCat && matchSearch;
    });
  }, [pool, search, catFilter, cat]);

  const cats = ["All", ...subcatsOf(cat, pool)];

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input
          value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search words, meanings, notes…"
          style={{ flex: 1, minWidth: 180, background: COLORS.surfaceAlt, border: `1px solid ${COLORS.borderSoft}`, borderRadius: 10, padding: "9px 13px", color: TXT, fontSize: 14 }}
        />
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
          style={{ background: COLORS.surfaceAlt, border: `1px solid ${COLORS.borderSoft}`, borderRadius: 10, padding: "9px 12px", color: TXT, fontSize: 13 }}>
          {cats.map((c) => (
            <option key={c} value={c}>{c === "All" ? `All (${pool.length})` : `${c} (${pool.filter((i) => cat.catOf(i) === c).length})`}</option>
          ))}
        </select>
      </div>
      <div style={{ fontSize: 12, color: FAINT, marginBottom: 10 }}>{filtered.length} entries</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {filtered.map((it) => {
          const k = keyOf(cat.id, it);
          const p = progress[k] || { mastery: 0, correct: 0, total: 0 };
          const isOpen = expanded === k;
          return (
            <div key={k} onClick={() => setExpanded(isOpen ? null : k)}
              style={{ background: p.skip ? "#0d1a0d" : "#141414", border: `1px solid ${isOpen ? cat.color + "55" : p.skip ? "#22c55e33" : "#242424"}`, borderRadius: 12, padding: "11px 14px", cursor: "pointer", transition: "border-color .15s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: 15.5, color: p.skip ? "#6b7280" : COLORS.txtStrong }}>{it.w}</span>
                  <span style={{ marginLeft: 8, fontSize: 13, color: MUTE }}>{it.e}</span>
                  {p.skip && <span style={{ marginLeft: 8, fontSize: 10, color: COLORS.success, background: "#0a2a16", border: "1px solid #22c55e33", borderRadius: 4, padding: "1px 5px", fontWeight: 600 }}>mastered</span>}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flex: "0 0 auto" }}>
                  {p.total > 0 && !p.skip && (
                    <span style={{ fontSize: 11, color: p.mastery >= 4 ? COLORS.success : p.correct / p.total >= 0.7 ? "#eab308" : COLORS.streak, background: "#1f1f1f", borderRadius: 5, padding: "2px 7px", fontWeight: 600 }}>
                      {"★".repeat(p.mastery)}{"☆".repeat(5 - p.mastery)}
                    </span>
                  )}
                  <MasterBtn isSkipped={!!p.skip} onToggle={() => toggleMastered(k)} />
                  <SpeakBtn text={cat.german(it)} color={cat.color} size={28} />
                </div>
              </div>
              {isOpen && (
                <div className="dm-reveal" style={{ marginTop: 9, borderTop: "1px solid #242424", paddingTop: 9 }}>
                  {it.ex && <div style={{ fontSize: 13, color: "#9aa6b6", fontStyle: "italic" }}>„{it.ex}"</div>}
                  {cat.detail(it)}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <div style={{ color: FAINT, textAlign: "center", padding: 30 }}>No matches.</div>}
      </div>
    </div>
  );
}
