// ── Design tokens ─────────────────────────────────────────────
// Single source of truth for colours and fonts. Components import
// from here instead of repeating raw hex literals inline.
//
// The Spickzettel (scripts/cheatsheet/template.html → public/cheatsheet.html)
// is a static page in an iframe and cannot import this file, so its :root
// block copies these values. Change a colour here → change it there too.

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

  // app accent: progress, active tab marker, section headings
  accent: "#a855f7",
  accentText: "#c084fc",

  // noun genders (der / die / das / plural). The solid colour fills buttons
  // and bars; the *Text shade is the one for coloured words on the dark
  // background, where the solid colour is a touch too dark to read.
  der: "#3b82f6",
  die: "#ec4899",
  das: "#22c55e",
  plural: "#a3a3a3",
  derText: "#60a5fa",
  dieText: "#f472b6",
  dasText: "#4ade80",

  // grammatical cases — text colour and tinted background
  nom: "#a3a3a3", nomBg: "#a3a3a31a",
  akk: "#e0a458", akkBg: "#33260f",
  dat: "#6ecbd6", datBg: "#173238",
  gen: "#b4a2ee", genBg: "#241e3a",
};

// Legacy short aliases kept so moved view code reads unchanged.
export const TXT = COLORS.txt;
export const MUTE = COLORS.mute;
export const FAINT = COLORS.faint;

export const FONT =
  "ui-sans-serif, -apple-system, 'Segoe UI', Roboto, system-ui, sans-serif";
