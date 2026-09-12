#!/usr/bin/env node
// ── Reflexive verb repair ─────────────────────────────────────────────────
//
// Every verb in verbs.json flagged `refl: true` is a *true* reflexive
// (echt reflexiv) or an accusative-reflexive use — "sich anmelden",
// "sich freuen", "sich beeilen". The conjugation tables were generated from
// the bare stem, so they read
//
//     ich melde an          ich habe angemeldet
//
// which is a different verb: "anmelden" (transitive, "to register someone").
// A German teacher marks that wrong. The reflexive pronoun is obligatory and
// sits directly after the finite verb:
//
//     ich melde mich an     ich habe mich angemeldet
//
// This script inserts the accusative reflexive pronoun into every Präsens,
// Präteritum and Perfekt cell of every `refl` verb. All 39 reflexives in the
// dataset take the accusative (there is no dative-reflexive entry such as
// "sich etwas vorstellen"), which the guard below asserts before writing.
//
// Usage:
//   node scripts/fix-reflexive-verbs.mjs           # report only
//   node scripts/fix-reflexive-verbs.mjs --apply   # rewrite verbs.json

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, "..", "public/data/verbs.json");
const APPLY = process.argv.includes("--apply");

// Akkusativ reflexive pronouns, by the person keys used in the data.
const PRON = { ich: "mich", du: "dich", er: "sich", wir: "uns", ihr: "euch", sie: "sich" };

// The pronoun goes immediately after the finite verb — which is always the
// first token of a stored form ("melde an", "habe angemeldet", "meldete an").
function withPronoun(form, person) {
  if (!form || typeof form !== "string") return form;
  const p = PRON[person];
  if (!p) return form;
  const parts = form.trim().split(/\s+/);
  // Already repaired (idempotent re-run).
  if (parts.includes(p)) return form;
  return [parts[0], p, ...parts.slice(1)].join(" ");
}

const verbs = JSON.parse(readFileSync(FILE, "utf8"));
let changed = 0;
const report = [];

for (const v of verbs) {
  if (!v.refl) continue;
  // Guard: reflexives take `haben` in the Perfekt. A `sein` entry would mean
  // the flag is on something this rule does not describe — stop rather than
  // write a wrong form.
  if (v.hs !== "haben") {
    console.error(`! ${v.w}: refl but Perfekt with "${v.hs}" — skipped, check by hand`);
    continue;
  }
  const before = JSON.stringify({ pr: v.pr, pt: v.pt, pk: v.pk });
  for (const tense of ["pr", "pt", "pk"]) {
    if (!v[tense]) continue;
    for (const person of Object.keys(v[tense])) {
      v[tense][person] = withPronoun(v[tense][person], person);
    }
  }
  if (JSON.stringify({ pr: v.pr, pt: v.pt, pk: v.pk }) !== before) {
    changed++;
    report.push(`  ${v.w.padEnd(22)} ich ${v.pr.ich.padEnd(22)} · ${v.pk.ich}`);
  }
}

console.log(`Reflexive verbs repaired: ${changed}`);
console.log(report.join("\n"));

if (APPLY) {
  writeFileSync(FILE, JSON.stringify(verbs, null, 1) + "\n");
  console.log(`\nWrote ${FILE}`);
} else {
  console.log("\n(dry run — pass --apply to write)");
}
