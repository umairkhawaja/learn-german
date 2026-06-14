// ── Cheatsheet view: searchable grammar reference ─────────────
import { useState, useEffect } from "react";
import { COLORS, TXT, MUTE, FAINT } from "../config/theme";

function Block({ b }) {
  if (b.p) return <p style={{ margin: "0 0 10px", fontSize: 13.5, color: "#c3cad6", lineHeight: 1.6 }}>{b.p}</p>;
  if (b.tip) return <div style={{ fontSize: 12.5, color: "#9aa6b6", background: "#13161c", border: "1px solid #1f2630", borderRadius: 8, padding: "8px 11px", margin: "0 0 10px", lineHeight: 1.5 }}>💡 {b.tip}</div>;
  if (b.ex) return (
    <div style={{ margin: "0 0 10px", display: "flex", flexDirection: "column", gap: 4 }}>
      {b.ex.map(([de, en], i) => (
        <div key={i} style={{ fontSize: 13, lineHeight: 1.5 }}>
          <span style={{ color: COLORS.txtStrong, fontWeight: 600 }}>{de}</span>
          <span style={{ color: FAINT }}>  ·  {en}</span>
        </div>
      ))}
    </div>
  );
  if (b.table) return (
    <div style={{ overflowX: "auto", margin: "0 0 12px" }}>
      <table style={{ borderCollapse: "collapse", fontSize: 12.5, minWidth: "100%" }}>
        <thead><tr>{b.table.head.map((h, i) => <th key={i} style={{ textAlign: "left", padding: "4px 12px 4px 0", color: MUTE, fontWeight: 600, borderBottom: `1px solid ${COLORS.borderSoft}`, whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
        <tbody>{b.table.rows.map((r, ri) => (
          <tr key={ri}>{r.map((c, ci) => <td key={ci} style={{ padding: "4px 12px 4px 0", color: ci === 0 ? MUTE : "#e2e8f0", fontStyle: ci === 0 ? "italic" : "normal", whiteSpace: "nowrap" }}>{c}</td>)}</tr>
        ))}</tbody>
      </table>
    </div>
  );
  return null;
}

export function CheatsheetView() {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState("cases");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    fetch(`${base}data/cheatsheet.json`).then((r) => r.json()).then(setData);
  }, []);

  if (!data) return <div style={{ color: FAINT, textAlign: "center", padding: 40 }}>Loading…</div>;

  const q = search.trim().toLowerCase();
  const match = (t) => !q || t.title.toLowerCase().includes(q) || t.summary.toLowerCase().includes(q) || t.sec.toLowerCase().includes(q);

  return (
    <div>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search grammar topics…"
        style={{ width: "100%", background: COLORS.surfaceAlt, border: `1px solid ${COLORS.borderSoft}`, borderRadius: 10, padding: "9px 13px", color: TXT, fontSize: 14, marginBottom: 16 }} />
      {data.sections.map((sec) => {
        const topics = data.topics.filter((t) => t.sec === sec && match(t));
        if (!topics.length) return null;
        return (
          <div key={sec} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, color: COLORS.success, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, marginBottom: 8 }}>{sec}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {topics.map((t) => {
                const isOpen = open === t.id;
                return (
                  <div key={t.id} onClick={() => setOpen(isOpen ? null : t.id)}
                    style={{ background: COLORS.surface, border: `1px solid ${isOpen ? "#22c55e55" : COLORS.border}`, borderRadius: 12, padding: "12px 15px", cursor: "pointer", transition: "border-color .15s" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: COLORS.txtStrong }}>{t.title}</span>
                      <span style={{ color: FAINT, fontSize: 14, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }}>›</span>
                    </div>
                    {!isOpen && <div style={{ fontSize: 12.5, color: MUTE, marginTop: 3 }}>{t.summary}</div>}
                    {isOpen && (
                      <div className="dm-reveal" style={{ marginTop: 12, borderTop: `1px solid ${COLORS.border}`, paddingTop: 12 }} onClick={(e) => e.stopPropagation()}>
                        {t.blocks.map((b, i) => <Block key={i} b={b} />)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
