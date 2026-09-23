// Holds src/engine/kasus.js to the textbook paradigms, and checks the
// exercise files built by scripts/build-exercises.mjs.
//
//   node scripts/check-kasus.mjs            # check (runs in `npm run data:check`)
//   node scripts/check-kasus.mjs --nouns    # also list every noun the drill uses
//
// The expected forms below are the standard declension tables every German
// course prints (der Tisch / die Lampe / das Buch / die Tische, with and
// without an adjective, after der-, ein- and no article). If the engine ever
// disagrees with one of them, the build stops.
import { readFileSync } from "node:fs";
import {
  decline, drillNoun, buildQuestion, cellsFor, CASES, SLOTS, DETS, contract,
} from "../src/engine/kasus.js";

const read = (f) => JSON.parse(readFileSync(new URL(`../public/data/${f}`, import.meta.url), "utf8"));
let failures = 0;
const fail = (msg) => { failures++; console.error("✗ " + msg); };

const tisch = { sg: "Tisch", pl: "Tische", slot: "m" };
const lampe = { sg: "Lampe", pl: "Lampen", slot: "f" };
const buch = { sg: "Buch", pl: "Bücher", slot: "n" };
const auto = { sg: "Auto", pl: "Autos", slot: "n" };
const lehrer = { sg: "Lehrer", pl: "Lehrer", slot: "m" };

// [noun, det, adj, case, number, prep, expected]
const PARADIGMS = [
  // der-words, no adjective
  [tisch, "def", null, "nom", "sg", null, "der Tisch"],
  [tisch, "def", null, "akk", "sg", null, "den Tisch"],
  [tisch, "def", null, "dat", "sg", null, "dem Tisch"],
  [tisch, "def", null, "gen", "sg", null, "des Tisches"],
  [lampe, "def", null, "dat", "sg", null, "der Lampe"],
  [buch, "def", null, "gen", "sg", null, "des Buches"],
  [tisch, "def", null, "dat", "pl", null, "den Tischen"],
  [buch, "def", null, "dat", "pl", null, "den Büchern"],
  [auto, "def", null, "dat", "pl", null, "den Autos"],
  [auto, "def", null, "gen", "sg", null, "des Autos"],
  [lehrer, "def", null, "gen", "sg", null, "des Lehrers"],
  [lehrer, "def", null, "dat", "pl", null, "den Lehrern"],
  // weak adjective endings (after der-word)
  [tisch, "def", "neu", "nom", "sg", null, "der neue Tisch"],
  [tisch, "def", "neu", "akk", "sg", null, "den neuen Tisch"],
  [lampe, "def", "neu", "akk", "sg", null, "die neue Lampe"],
  [buch, "def", "neu", "nom", "sg", null, "das neue Buch"],
  [buch, "def", "neu", "dat", "sg", null, "dem neuen Buch"],
  [lampe, "def", "neu", "gen", "sg", null, "der neuen Lampe"],
  [tisch, "def", "neu", "nom", "pl", null, "die neuen Tische"],
  [tisch, "def", "neu", "dat", "pl", null, "den neuen Tischen"],
  // mixed endings (after ein-word)
  [tisch, "ein", "neu", "nom", "sg", null, "ein neuer Tisch"],
  [tisch, "ein", "neu", "akk", "sg", null, "einen neuen Tisch"],
  [tisch, "ein", "neu", "dat", "sg", null, "einem neuen Tisch"],
  [tisch, "ein", "neu", "gen", "sg", null, "eines neuen Tisches"],
  [lampe, "ein", "neu", "nom", "sg", null, "eine neue Lampe"],
  [lampe, "ein", "neu", "dat", "sg", null, "einer neuen Lampe"],
  [buch, "ein", "neu", "nom", "sg", null, "ein neues Buch"],
  [buch, "ein", "neu", "akk", "sg", null, "ein neues Buch"],
  [buch, "ein", "neu", "dat", "sg", null, "einem neuen Buch"],
  [tisch, "kein", "neu", "nom", "pl", null, "keine neuen Tische"],
  [tisch, "kein", "neu", "gen", "pl", null, "keiner neuen Tische"],
  [buch, "mein", "alt", "dat", "pl", null, "meinen alten Büchern"],
  [lampe, "mein", null, "gen", "sg", null, "meiner Lampe"],
  // strong endings (no article, plural)
  [tisch, "none", "neu", "nom", "pl", null, "neue Tische"],
  [tisch, "none", "neu", "akk", "pl", null, "neue Tische"],
  [tisch, "none", "neu", "dat", "pl", null, "neuen Tischen"],
  [tisch, "none", "neu", "gen", "pl", null, "neuer Tische"],
  // prepositions and their standard contractions
  [tisch, "def", null, "dat", "sg", "zu", "zum Tisch"],
  [lampe, "def", null, "dat", "sg", "zu", "zur Lampe"],
  [buch, "def", "neu", "dat", "sg", "in", "im neuen Buch"],
  [buch, "def", "neu", "akk", "sg", "in", "ins neue Buch"],
  [tisch, "def", null, "dat", "sg", "an", "am Tisch"],
  [buch, "def", null, "akk", "sg", "an", "ans Buch"],
  [tisch, "def", null, "dat", "sg", "von", "vom Tisch"],
  [tisch, "def", null, "dat", "sg", "bei", "beim Tisch"],
  [tisch, "def", null, "akk", "sg", "auf", "auf den Tisch"],
  [buch, "def", null, "akk", "sg", "auf", "auf das Buch"],
  [tisch, "ein", "alt", "gen", "sg", "wegen", "wegen eines alten Tisches"],
  [lampe, "ein", null, "akk", "sg", "ohne", "ohne eine Lampe"],
];

for (const [noun, det, adj, kase, number, prep, want] of PARADIGMS) {
  const got = decline({ noun, det, adj, kase, number, prep });
  if (!got || got.text !== want) fail(`decline(${noun.sg}, ${det}, ${adj}, ${kase}, ${number}, ${prep}) = ${got && got.text}, want ${want}`);
}

// Combinations German does not have must come back empty.
if (decline({ noun: tisch, det: "ein", adj: null, kase: "nom", number: "pl" })) fail("ein + plural should not exist");
if (decline({ noun: tisch, det: "none", adj: "neu", kase: "nom", number: "sg" })) fail("bare singular count noun should not exist");
if (contract("auf", "das")) fail("aufs is colloquial and must not be produced");

// ── Noun filter ───────────────────────────────────────────────
const nouns = read("nouns.json");
const adjSet = new Set(read("adj.json").map((a) => a.w.toLowerCase()));
const pass = nouns.map((n) => drillNoun(n, adjSet)).filter(Boolean);
const passW = new Set(pass.map((n) => n.w));
// n-nouns, mixed nouns and adjectival nouns must never reach the drill.
for (const w of ["der Student", "der Junge", "der Kollege", "der Herr", "der Nachbar", "der Mensch",
  "der Name", "das Herz", "der Deutsche", "die Deutsche", "der Bekannte", "der Bus", "das Haus"]) {
  if (passW.has(w)) fail(`${w} must not be in the drill — its forms are irregular`);
}
if (pass.length < 300) fail(`only ${pass.length} nouns pass the drill filter`);

// ── Questions: the answer is always among the options, never twice ─
const bySlot = { m: [], f: [], n: [] };
for (const n of pass) bySlot[n.slot].push(n);
const cells = cellsFor({ cases: CASES, slots: SLOTS, dets: DETS, adjModes: ["adj", "-"] });
for (let round = 0; round < 40; round++) {
  for (const cell of cells) {
    for (const ctx of ["plain", "prep", "twoway"]) {
      const q = buildQuestion(cell, bySlot, ctx);
      if (!q) continue;
      if (!q.options.includes(q.answer)) fail(`answer missing from options: ${q.answer}`);
      if (new Set(q.options).size !== q.options.length) fail(`duplicate options: ${q.options.join(" | ")}`);
      if (q.options.length < 2) fail(`too few options for ${q.answer}`);
      if (!q.accepted.includes(q.answer)) fail(`answer not accepted in typing mode: ${q.answer}`);
      for (const o of q.options) if (o !== q.answer && q.accepted.includes(o)) fail(`a distractor is also accepted: ${o}`);
    }
  }
}

// ── Built exercise files ──────────────────────────────────────
const CASE_OK = new Set(["nom", "akk", "dat", "gen"]);
try {
  const satz = read("satzbau.json");
  const seen = new Set();
  for (const s of satz.items) {
    if (!s.de || !Array.isArray(s.tok) || s.tok.length < 3) fail(`satzbau: bad item ${JSON.stringify(s).slice(0, 80)}`);
    if (seen.has(s.de)) fail(`satzbau: duplicate sentence ${s.de}`);
    seen.add(s.de);
  }
  const real = read("kasus-echt.json");
  for (const q of real.items) {
    if (!CASE_OK.has(q.case)) fail(`kasus-echt: bad case ${q.case}`);
    const [a, b] = q.span;
    if (!(a >= 0 && b > a && b <= q.tok.length)) fail(`kasus-echt: bad span in ${q.id}`);
  }
} catch (e) {
  fail(`exercise files: ${e.message}`);
}

if (process.argv.includes("--nouns")) {
  for (const n of pass) console.log(`${n.slot}\t${n.w}\t${n.pl}\t${decline({ noun: n, det: "def", adj: null, kase: "gen", number: "sg" }).text}\t${decline({ noun: n, det: "def", adj: null, kase: "dat", number: "pl" }).text}`);
}

if (failures) {
  console.error(`\ncheck-kasus: ${failures} problem(s).`);
  process.exit(1);
}
console.log(`check-kasus: ${PARADIGMS.length} paradigms hold, ${pass.length} drill nouns, ${cells.length} cells ok.`);
