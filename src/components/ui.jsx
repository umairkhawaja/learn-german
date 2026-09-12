// ── Shared UI primitives (built on the theme tokens) ──────────
import { COLORS, MUTE, FAINT } from "../config/theme";
import { speak } from "../speak";

// Minimum comfortable touch target. The icon buttons were 28px, below the
// 44px both Apple and Material ask for — on a phone the speaker and the
// mastered tick sit side by side and were easy to hit the wrong one of.
export const TAP = 34;

// The practice views bind bare number and letter keys as answer shortcuts on
// `window`. Without this guard, typing "1" into the Browse search box answers
// the question behind it, and pressing space with a <select> focused grades
// the current card.
export function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable === true;
}

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

// ── Force-mastered toggle button ──────────────────────────
export function MasterBtn({ isSkipped, onToggle }) {
  const label = isSkipped ? "Mastered — unmark to practise again" : "Mark as mastered, skip in practice";
  return (
    <button
      title={label} aria-label={label} aria-pressed={isSkipped}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      style={{
        width: TAP, height: TAP, flex: "0 0 auto", borderRadius: 8,
        border: `1px solid ${isSkipped ? COLORS.success : COLORS.borderSoft}`,
        background: isSkipped ? "#0a2a16" : "#1a1a1a",
        color: isSkipped ? COLORS.success : "#4a4f59",
        cursor: "pointer", fontSize: 13, lineHeight: 1,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}
    >✓</button>
  );
}

// ── Audio button ─────────────────────────────────────
export function SpeakBtn({ text, color = COLORS.der, size = TAP }) {
  const label = `Listen: ${text}`;
  return (
    <button
      title="Listen (Deutsch)" aria-label={label}
      onClick={(e) => { e.stopPropagation(); speak(text); }}
      style={{ width: size, height: size, flex: "0 0 auto", borderRadius: 8, border: `1px solid ${COLORS.borderSoft}`, background: "#1a1a1a", color, cursor: "pointer", fontSize: 14, lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
    >🔊</button>
  );
}

// ── Bilingual example ─────────────────────────────────
// Examples are stored as "German sentence — English translation". " — "
// (space em-dash space) is reserved as that separator, so splitting on the
// FIRST occurrence keeps any em dash inside the translation intact.
export function splitExample(text) {
  const idx = String(text).indexOf(" — ");
  return idx >= 0
    ? { de: text.slice(0, idx), en: text.slice(idx + 3) }
    : { de: text, en: null };
}

// German uses low-then-high quotation marks — „so“, not „so". The straight
// closing quote was a small but constant piece of wrong typography on every
// example in the app.
export function ExampleLine({ text, style }) {
  if (!text) return null;
  const { de, en } = splitExample(text);
  return (
    <div style={{ fontSize: 13, fontStyle: "italic", ...style }}>
      <span lang="de" style={{ color: "#9aa6b6" }}>„{de}“</span>
      {en && <span style={{ color: FAINT }}> — {en}</span>}
    </div>
  );
}

// ── Usage note ───────────────────────────────────────
// An English note *about* the word — when to use it, what it collocates with,
// the trap it sets. Deliberately not styled like ExampleLine: a note is not
// German the learner should be reading back.
export function UsageNote({ text, style }) {
  if (!text) return null;
  return (
    <div style={{
      marginTop: 8, fontSize: 12.5, color: "#9aa6b6", background: "#13161c",
      border: "1px solid #1f2630", borderRadius: 8, padding: "7px 10px", lineHeight: 1.5,
      ...style,
    }}>
      💡 {text}
    </div>
  );
}

// ── Word-class / grammar tag ─────────────────────────────
export function Tag({ children, color = MUTE, bg = "#1f1f1f", title }) {
  return (
    <span title={title} style={{
      background: bg, borderRadius: 6, padding: "2px 8px", fontSize: 11,
      color, fontWeight: 700, letterSpacing: 0.2, whiteSpace: "nowrap",
    }}>{children}</span>
  );
}
