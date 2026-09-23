// ── Shared pieces of the three drills (see DrillsView) ────────
import { COLORS, MUTE } from "../config/theme";

export const DRILL_ACCENT = "#f43f5e";

// ── Multi-select chip row ─────────────────────────────────────
// At least one chip always stays on: an empty selection would leave the
// drill with nothing to build.
export function ChipRow({ label, options, value, onChange, accent = DRILL_ACCENT, single }) {
  const toggle = (v) => {
    if (single) return onChange([v]);
    const has = value.includes(v);
    if (has && value.length === 1) return;
    onChange(has ? value.filter((x) => x !== v) : [...value, v]);
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
      {label && <span style={{ fontSize: 11, color: COLORS.faint, width: 64, flex: "0 0 auto", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</span>}
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button key={o.value} onClick={() => toggle(o.value)} aria-pressed={on}
            style={{
              padding: "5px 10px", borderRadius: 999, cursor: "pointer", fontSize: 12, fontWeight: on ? 700 : 500,
              border: `1px solid ${on ? accent : COLORS.borderSoft}`,
              background: on ? accent + "22" : COLORS.surfaceAlt, color: on ? COLORS.txtStrong : MUTE,
            }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Weighted pick for a practice round: unseen and weak items first, each
// tier shuffled, so a round never walks the data file top-down.
export function weakFirst(items, progOf) {
  const scored = items.map((it) => {
    const p = progOf(it);
    const m = p ? p.mastery : 0;
    return { it, w: (6 - m + (!p || !p.total ? 3 : 0)) * (0.5 + Math.random()) };
  });
  return scored.sort((a, b) => b.w - a.w).map((x) => x.it);
}

export const ROUND = 10;
