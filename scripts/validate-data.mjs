#!/usr/bin/env node
// ── Dataset validator ─────────────────────────────────────────────────────
//
// Checks the invariants the app and the quiz engine rely on. Every rule here
// exists because the data broke it at some point and the learner saw the
// result — a fragment presented as a model sentence, an invented comparative
// offered as the correct answer, the same word dealt twice in one deck.
//
// Run it after any data edit:  npm run data:check
// Exit code is non-zero when an error-level rule fails, so it can gate a build.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "..", "public/data");
const FILES = ["nouns", "verbs", "adj", "gram", "other", "phrases", "chunks"];

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const db = Object.fromEntries(
  FILES.map((f) => [f, JSON.parse(readFileSync(join(DATA, `${f}.json`), "utf8"))])
);

const hasField = (v) => v != null && String(v).trim() !== "" && v !== "–";

// ── 1. Required fields ────────────────────────────────────────────────────
const REQUIRED = {
  nouns: ["w", "e", "c"],
  verbs: ["w", "e", "t", "p2", "hs", "pr", "pt", "pk"],
  adj: ["w", "e", "c"],
  gram: ["w", "e", "wt"],
  other: ["w", "e", "c"],
  phrases: ["w", "e", "c"],
  chunks: ["w", "e", "c", "lvl"],
};
for (const [f, keys] of Object.entries(REQUIRED)) {
  for (const x of db[f]) {
    for (const k of keys) if (!hasField(x[k])) err(`${f}: "${x.w}" is missing ${k}`);
  }
}

// ── 2. Example sentences ──────────────────────────────────────────────────
// `ex` is "German sentence — English translation". ExampleLine splits on the
// FIRST " — ", so a second one silently moves half the German into the
// translation slot. A German half that stops without terminal punctuation is
// the clipped-source-text bug (see scripts/fix-truncated-examples.mjs).
const TERMINAL = /[.!?…:,)\]»"”“„']$/;
for (const f of FILES) {
  for (const x of db[f]) {
    const list = x.ex == null ? [] : Array.isArray(x.ex) ? x.ex : [x.ex];
    for (const ex of list) {
      if (typeof ex !== "string") { err(`${f}: "${x.w}" has a non-string example`); continue; }
      const parts = ex.split(" — ");
      if (parts.length > 2) warn(`${f}: "${x.w}" example has ${parts.length - 1} em-dash separators`);
      const de = parts[0].trim();
      if (!TERMINAL.test(de)) warn(`${f}: "${x.w}" German example looks clipped — "${de}"`);
    }
  }
}

// ── 3. No headword appears in two categories ──────────────────────────────
// Progress is keyed "<categoryId>:<w>", so a duplicate is two words to the
// engine: dealt twice, mastered separately, counted twice in Stats.
const HOMOGRAPHS = new Set(["erfahren"]);
const where = new Map();
for (const f of FILES) {
  for (const x of db[f]) {
    const k = x.w.trim();
    (where.get(k) ?? where.set(k, []).get(k)).push(f);
  }
}
for (const [w, fs] of where) {
  if (fs.length > 1 && !HOMOGRAPHS.has(w)) err(`"${w}" appears in ${fs.join(" + ")}`);
  const dupeInOne = fs.length !== new Set(fs).size;
  if (dupeInOne) err(`"${w}" appears twice inside one file`);
}

// ── 4. Nouns ──────────────────────────────────────────────────────────────
for (const x of db.nouns) {
  if (hasField(x.a)) {
    if (!["der", "die", "das"].includes(x.a)) err(`nouns: "${x.w}" has article "${x.a}"`);
    const prefix = x.w.split(" ")[0].toLowerCase();
    if (["der", "die", "das"].includes(prefix) && prefix !== x.a)
      err(`nouns: "${x.w}" is prefixed "${prefix}" but tagged "${x.a}"`);
  }
}

// ── 5. Verbs ──────────────────────────────────────────────────────────────
const PERSONS = ["ich", "du", "er", "wir", "ihr"];
for (const x of db.verbs) {
  if (!["haben", "sein"].includes(x.hs)) err(`verbs: "${x.w}" Perfekt auxiliary is "${x.hs}"`);
  for (const tense of ["pr", "pt", "pk"]) {
    for (const p of PERSONS) if (!hasField(x[tense]?.[p])) err(`verbs: "${x.w}" missing ${tense}.${p}`);
  }
  // A reflexive verb without its pronoun is a different verb: "melde an"
  // (register someone) instead of "melde mich an" (register yourself).
  if (x.refl && !/\bmich\b/.test(x.pr?.ich ?? "")) err(`verbs: "${x.w}" is reflexive but pr.ich is "${x.pr?.ich}"`);

  // German inserts the -e- in the du/ihr endings only after a stem in -d/-t
  // or an obstruent + m/n. "du trennest" and "du kommest" are not German.
  //
  // A sibilant stem is exempt from the check, not from the rule: it takes a
  // bare -t, so lesen's "liest" is stem "lies" + t and only *looks* like an
  // -est ending.
  const stem = (x.pr?.ich ?? "").split(/\s+/)[0].replace(/e$/, "");
  const sibilant = /(s|ß|z|x|tz)$/.test(stem);
  const needsE = /[dt]$/.test(stem) || /[^aeiouäöülmnr][mn]$/.test(stem);
  if (!needsE && !sibilant && /est$/.test((x.pr?.du ?? "").split(/\s+/)[0]))
    err(`verbs: "${x.w}" pr.du is "${x.pr.du}" — no -e- after this stem`);

  // Imperatives are optional (modals have none) but must be complete when
  // present, or the card renders "undefined!".
  if (x.imp) {
    for (const p of ["du", "ihr", "sie"]) {
      if (!hasField(x.imp[p])) err(`verbs: "${x.w}" imp.${p} is missing`);
    }
  }
}

// ── 6. Adjectives ─────────────────────────────────────────────────────────
// A comparative must not be a bare "<headword>er" on a word that cannot
// grade — that was the signature of the blind generator ("tjaer", "pluser").
for (const x of db.adj) {
  if (x.wc && hasField(x.cmp) && x.wc !== "Adverb")
    err(`adj: "${x.w}" is tagged ${x.wc} but still carries a comparative`);
  if (hasField(x.cmp) && !hasField(x.sup))
    warn(`adj: "${x.w}" has a comparative but no superlative`);
}

// ── 7. Levels ─────────────────────────────────────────────────────────────
const LEVELS = new Set(["A1", "A2", "B1", "B2", "C1"]);
for (const f of FILES) {
  for (const x of db[f]) {
    const lvl = x.lvl ?? x.lv;
    if (lvl != null && !LEVELS.has(lvl)) err(`${f}: "${x.w}" has level "${lvl}"`);
  }
}

// ── Report ────────────────────────────────────────────────────────────────
const counts = FILES.map((f) => `${f} ${db[f].length}`).join(" · ");
console.log(`entries: ${counts}\n`);
for (const w of warnings) console.log(`warn  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
console.log(`\n${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
