// ── Design tokens ─────────────────────────────────────────────
// Single source of truth for colours and fonts. Components import
// from here instead of repeating raw hex literals inline.

export const COLORS = {
  // surfaces
  bg: "#0a0a0a",
  surface: "#141414",
  surfaceAlt: "#161616",
  surfaceDeep: "#0f0f0f",
  border: "#242424",
  borderSoft: "#2a2a2a",

  // text
  txt: "#e2e8f0",
  txtStrong: "#f1f5f9",
  mute: "#8b94a3",
  faint: "#5b626f",
  ghost: "#3f4651",

  // status
  success: "#22c55e",
  successText: "#4ade80",
  danger: "#ef4444",
  dangerText: "#fca5a5",
  warn: "#fbbf24",
  streak: "#f97316",

  // noun genders (der / die / das)
  der: "#3b82f6",
  die: "#ec4899",
  das: "#22c55e",
};

// Legacy short aliases kept so moved view code reads unchanged.
export const TXT = COLORS.txt;
export const MUTE = COLORS.mute;
export const FAINT = COLORS.faint;

export const FONT =
  "ui-sans-serif, -apple-system, 'Segoe UI', Roboto, system-ui, sans-serif";
