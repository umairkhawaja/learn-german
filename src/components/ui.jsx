// ── Shared UI primitives (built on the theme tokens) ──────────
import { COLORS, TXT, MUTE, FAINT } from "../config/theme";
import { speak } from "../speak";

export function Card({ children, accent, style, ...rest }) {
  return (
    <div
      style={{
        background: COLORS.surface,
        border: `1px solid ${accent || COLORS.border}`,
        borderRadius: 12,
        padding: 15,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

// Pill row used for quiz modes, view tabs, etc.
export function SegmentedControl({ options, value, onChange, accent = "#2a2a2a", compact }) {
  return (
    <div style={{ display: "flex", gap: 3, background: COLORS.surfaceAlt, borderRadius: 9, padding: 3, flexWrap: "wrap" }}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button key={o.value} onClick={() => onChange(o.value)}
            style={{
              padding: compact ? "5px 10px" : "6px 11px", borderRadius: 6, border: "none", cursor: "pointer",
              fontSize: 12, background: active ? accent : "transparent",
              color: active ? "#fff" : MUTE, fontWeight: active ? 700 : 400,
            }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function ProgressBar({ value, color, track = "#1f1f1f", height = 5, overlay }) {
  return (
    <div style={{ position: "relative", flex: 1, height, background: track, borderRadius: 999, overflow: "hidden" }}>
      {overlay != null && (
        <div style={{ position: "absolute", inset: 0, width: `${overlay}%`, background: color + "55", borderRadius: 999, transition: "width .5s" }} />
      )}
      <div style={{ position: "absolute", inset: 0, width: `${value}%`, height, background: color, borderRadius: 999, transition: "width .3s" }} />
    </div>
  );
}

export function StatTile({ label, value, color }) {
  return (
    <div style={{ flex: 1, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "14px 12px", textAlign: "center" }}>
      <div style={{ fontSize: 26, fontWeight: 800, color, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      <div style={{ fontSize: 11.5, color: MUTE, marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ── Force-mastered toggle button ──────────────────────────────
export function MasterBtn({ isSkipped, onToggle }) {
  return (
    <button
      title={isSkipped ? "Unmark — will appear in quiz again" : "Mark as mastered — skip in quiz"}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      style={{
        width: 28, height: 28, flex: "0 0 auto", borderRadius: 8,
        border: `1px solid ${isSkipped ? COLORS.success : COLORS.borderSoft}`,
        background: isSkipped ? "#0a2a16" : "#1a1a1a",
        color: isSkipped ? COLORS.success : "#4a4f59",
        cursor: "pointer", fontSize: 13, lineHeight: 1,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}
    >✓</button>
  );
}

// ── Audio button ──────────────────────────────────────────────
export function SpeakBtn({ text, color = COLORS.der, size = 30 }) {
  return (
    <button
      title="Listen (Deutsch)"
      onClick={(e) => { e.stopPropagation(); speak(text); }}
      style={{ width: size, height: size, flex: "0 0 auto", borderRadius: 8, border: `1px solid ${COLORS.borderSoft}`, background: "#1a1a1a", color, cursor: "pointer", fontSize: 14, lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
    >🔊</button>
  );
}
