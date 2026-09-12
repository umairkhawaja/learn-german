// ── Browse view: searchable, filterable word list ─────────────
import { useState, useMemo, useEffect } from "react";
import { COLORS, TXT, MUTE, FAINT } from "../config/theme";
import { lvlOf, levelMeta } from "../config/levels";
import { subcatsOf } from "../config/categories";
import { keyOf, saveProgress, isMastered, MASTERY_THRESHOLD } from "../engine/progress";
import { MasterBtn, SpeakBtn, ExampleLine, Tag } from "./ui";

// The list used to render every match at once. With 2,236 nouns that is 2,236
// cards of DOM on a phone before you have typed anything — the tab took a
// visible second to appear and scrolled badly. Matches are counted in full
// (the "N entries" line is still exact) but mounted a page at a time.
const PAGE = 60;

// Learning status is the axis the list was missing. "Which of these have I not
// started?" and "what am I still getting wrong?" were unanswerable without
// scrolling the whole list and reading the stars.
const STATUS = [
  { id: "all", label: "All" },
  { id: "new", label: "Not started", match: (p) => !p || !p.total },
  { id: "learning", label: "Learning", match: (p) => p && p.total > 0 && !isMastered(p) },
  { id: "weak", label: "Weak", match: (p) => p && p.total >= 2 && p.correct / p.total < 0.7 && !isMastered(p) },
  { id: "mastered", label: "Mastered", match: (p) => isMastered(p) },
];

export function BrowseView({ cat, progress, setProgress, levelFilter, db }) {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [status, setStatus] = useState("all");
  const [expanded, setExpanded] = useState(null);
  const [limit, setLimit] = useState(PAGE);

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
    const statusDef = STATUS.find((s) => s.id === status);
    return pool.filter((it) => {
      if (catFilter !== "All" && cat.catOf(it) !== catFilter) return false;
      if (statusDef?.match && !statusDef.match(progress[keyOf(cat.id, it)])) return false;
      if (!q) return true;
      // Every field is coerced: an entry missing `e` or with an array `ex`
      // used to throw here and blank the whole tab.
      const hay = [it.w, it.e, it.n, it.c].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [pool, search, catFilter, status, cat, progress]);

  // Any change to what is being listed starts the window over, or you would
  // land halfway down a list you have not scrolled.
  useEffect(() => { setLimit(PAGE); }, [search, catFilter, status, cat, levelFilter]);

  // Memoised, or the identity changes on every render and the effect below
  // re-runs each time.
  const cats = useMemo(() => ["All", ...subcatsOf(cat, pool)], [cat, pool]);
  useEffect(() => {
    if (catFilter !== "All" && !cats.includes(catFilter)) setCatFilter("All");
  }, [cats, catFilter]);

  const shown = filtered.slice(0, limit);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          type="search" aria-label="Search words, meanings and notes"
          placeholder="Search words, meanings, notes…"
          style={{ flex: 1, minWidth: 180, background: COLORS.surfaceAlt, border: `1px solid ${COLORS.borderSoft}`, borderRadius: 10, padding: "9px 13px", color: TXT, fontSize: 14 }}
        />
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} aria-label="Topic"
          style={{ background: COLORS.surfaceAlt, border: `1px solid ${COLORS.borderSoft}`, borderRadius: 10, padding: "9px 12px", color: TXT, fontSize: 13 }}>
          {cats.map((c) => (
            <option key={c} value={c}>
              {c === "All"
                ? `All topics (${pool.length.toLocaleString()})`
                : `${c} (${pool.filter((i) => cat.catOf(i) === c).length.toLocaleString()})`}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
        {STATUS.map((s) => {
          const on = status === s.id;
          return (
            <button key={s.id} onClick={() => setStatus(s.id)} aria-pressed={on}
              style={{
                padding: "5px 11px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: on ? 700 : 500,
                border: `1px solid ${on ? cat.color : COLORS.borderSoft}`,
                background: on ? cat.color + "22" : COLORS.surfaceAlt, color: on ? cat.color : MUTE,
              }}>
              {s.label}
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 12, color: FAINT, marginBottom: 10 }}>
        {filtered.length.toLocaleString()} {filtered.length === 1 ? "entry" : "entries"}
        {filtered.length > shown.length && <> · showing {shown.length.toLocaleString()}</>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {shown.map((it) => {
          const k = keyOf(cat.id, it);
          const p = progress[k] || { mastery: 0, correct: 0, total: 0 };
          const mastered = isMastered(p);
          const isOpen = expanded === k;
          const lm = levelMeta(lvlOf(it));
          return (
            <div key={k} onClick={() => setExpanded(isOpen ? null : k)}
              style={{ background: mastered ? "#0d1a0d" : "#141414", border: `1px solid ${isOpen ? cat.color + "55" : mastered ? "#22c55e33" : "#242424"}`, borderRadius: 12, padding: "11px 14px", cursor: "pointer", transition: "border-color .15s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                  <span lang="de" style={{ fontWeight: 700, fontSize: 15.5, color: mastered ? "#6b7280" : COLORS.txtStrong }}>{it.w}</span>
                  <span style={{ marginLeft: 8, fontSize: 13, color: MUTE }}>{it.e}</span>
                  {/* The level was only visible via the switcher, so on "All
                      levels" there was no way to tell an A1 word from a B1 one. */}
                  {levelFilter === "All" && (
                    <span style={{ marginLeft: 8, fontSize: 10, color: lm.color, fontWeight: 700 }}>{lm.code}</span>
                  )}
                  {mastered && <span style={{ marginLeft: 8, fontSize: 10, color: COLORS.success, background: "#0a2a16", border: "1px solid #22c55e33", borderRadius: 4, padding: "1px 5px", fontWeight: 600 }}>mastered</span>}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flex: "0 0 auto" }}>
                  {p.total > 0 && !mastered && (
                    <span title={`${p.correct} of ${p.total} correct`}
                      style={{ fontSize: 11, color: p.mastery >= MASTERY_THRESHOLD ? COLORS.success : p.correct / p.total >= 0.7 ? "#eab308" : COLORS.streak, background: "#1f1f1f", borderRadius: 5, padding: "2px 7px", fontWeight: 600 }}>
                      {"★".repeat(p.mastery)}{"☆".repeat(5 - p.mastery)}
                    </span>
                  )}
                  <MasterBtn isSkipped={!!p.skip} onToggle={() => toggleMastered(k)} />
                  <SpeakBtn text={cat.german(it)} color={cat.color} />
                </div>
              </div>
              {isOpen && (
                <div className="dm-reveal" style={{ marginTop: 9, borderTop: "1px solid #242424", paddingTop: 9 }}>
                  {/* Verbs carry an array of examples, which ExampleLine cannot
                      render — their detail view lists them itself. */}
                  {typeof it.ex === "string" && <ExampleLine text={it.ex} />}
                  {cat.detail(it)}
                  {p.total > 0 && (
                    <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <Tag color={FAINT}>{p.correct}/{p.total} correct</Tag>
                      {p.due != null && (
                        <Tag color={p.due <= Date.now() ? "#7dd3fc" : FAINT}>
                          {p.due <= Date.now() ? "due now" : `next review ${new Date(p.due).toLocaleDateString()}`}
                        </Tag>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length > shown.length && (
          <button onClick={() => setLimit((n) => n + PAGE * 4)}
            style={{ marginTop: 4, background: COLORS.surfaceAlt, border: `1px solid ${COLORS.borderSoft}`, borderRadius: 10, padding: "12px", color: MUTE, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Show more ({(filtered.length - shown.length).toLocaleString()} left)
          </button>
        )}

        {filtered.length === 0 && (
          <div style={{ color: FAINT, textAlign: "center", padding: 30, fontSize: 13 }}>
            {search.trim()
              ? <>No matches for “{search.trim()}”.</>
              : status !== "all"
                ? <>No {STATUS.find((s) => s.id === status)?.label.toLowerCase()} words here yet.</>
                : "Nothing here."}
          </div>
        )}
      </div>
    </div>
  );
}
