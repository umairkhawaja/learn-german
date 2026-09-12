#!/usr/bin/env node
// ── Conjugation corrections ───────────────────────────────────────────────
//
// Six verbs carried wrong forms in the conjugation table the Verbs card shows
// and the Präsens quiz mode asks about.
//
// Four had a spurious -e- in the du/ihr endings. German inserts it only after
// a stem in -d/-t, or after an obstruent + m/n (atmen → du atmest, öffnen → du
// öffnest, rechnen → du rechnest). After l/m/n/r + m/n it does not, so
// "trennest", "kennest", "bestimmest" and "kommest" are all wrong.
//
// Two had the separable prefix mangled outright, splitting the word in the
// wrong place: herunterladen became "unterlade her" and wehtun became
// "tut west".
//
// Usage:
//   node scripts/fix-verb-conjugations.mjs           # report
//   node scripts/fix-verb-conjugations.mjs --apply   # write

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, "..", "public/data/verbs.json");
const APPLY = process.argv.includes("--apply");

const FIXES = {
  "sich trennen": { pr: { du: "trennst dich", ihr: "trennt euch" }, pt: { du: "trenntest dich", ihr: "trenntet euch" } },
  "sich auskennen": { pr: { du: "kennst dich aus", ihr: "kennt euch aus" } },
  bestimmen: { pr: { du: "bestimmst", ihr: "bestimmt" } },
  vorkommen: { pr: { du: "kommst vor", ihr: "kommt vor" } },
  "sich unterhalten": { pr: { du: "unterhältst dich" } },

  herunterladen: {
    pr: { ich: "lade herunter", du: "lädst herunter", er: "lädt herunter", wir: "laden herunter", ihr: "ladet herunter", sie: "laden herunter" },
    pt: { ich: "lud herunter", du: "ludst herunter", er: "lud herunter", wir: "luden herunter", ihr: "ludet herunter" },
    pk: { ich: "habe heruntergeladen", du: "hast heruntergeladen", er: "hat heruntergeladen", wir: "haben heruntergeladen", ihr: "habt heruntergeladen", sie: "haben heruntergeladen" },
  },
  wehtun: {
    pr: { ich: "tue weh", du: "tust weh", er: "tut weh", wir: "tun weh", ihr: "tut weh", sie: "tun weh" },
    pt: { ich: "tat weh", du: "tatst weh", er: "tat weh", wir: "taten weh", ihr: "tatet weh" },
    pk: { ich: "habe wehgetan", du: "hast wehgetan", er: "hat wehgetan", wir: "haben wehgetan", ihr: "habt wehgetan", sie: "haben wehgetan" },
  },
};

const verbs = JSON.parse(readFileSync(FILE, "utf8"));
const byW = new Map(verbs.map((x) => [x.w, x]));
let changed = 0;

for (const [w, tenses] of Object.entries(FIXES)) {
  const v = byW.get(w);
  if (!v) { console.warn(`? no verb "${w}"`); continue; }
  for (const [tense, forms] of Object.entries(tenses)) {
    for (const [person, form] of Object.entries(forms)) {
      if (v[tense][person] === form) continue;
      console.log(`${w.padEnd(20)} ${tense}.${person}: "${v[tense][person]}" → "${form}"`);
      v[tense][person] = form;
      changed++;
    }
  }
}

console.log(`\nforms corrected: ${changed}`);
if (APPLY) {
  writeFileSync(FILE, JSON.stringify(verbs, null, 1) + "\n");
  console.log(`Wrote ${FILE}`);
} else {
  console.log("(dry run — pass --apply to write)");
}
