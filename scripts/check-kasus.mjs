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
import { nounParadigm } from "../src/engine/nounForms.js";

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

// ── Card-back declension tables (engine/nounForms.js) ─────────
// [entry, expected singular Nom|Akk|Dat|Gen, expected plural Nom|Akk|Dat|Gen]
// A null means the table must leave that number out.
const TABLES = [
  [{ w: "der Tag", a: "der", p: "die Tage" }, "der Tag|den Tag|dem Tag|des Tag(e)s", "die Tage|die Tage|den Tagen|der Tage"],
  [{ w: "der Tisch", a: "der", p: "die Tische" }, "der Tisch|den Tisch|dem Tisch|des Tisches", null],
  [{ w: "der Herr", a: "der", p: "die Herren" }, "der Herr|den Herrn|dem Herrn|des Herrn", "die Herren|die Herren|den Herren|der Herren"],
  [{ w: "der Nachbar", a: "der", p: "die Nachbarn" }, "der Nachbar|den Nachbarn|dem Nachbarn|des Nachbarn", null],
  [{ w: "der Bauer", a: "der", p: "die Bauern" }, "der Bauer|den Bauern|dem Bauern|des Bauern", null],
  [{ w: "der Student", a: "der", p: "die Studenten" }, "der Student|den Studenten|dem Studenten|des Studenten", null],
  [{ w: "der Kollege", a: "der", p: "die Kollegen" }, "der Kollege|den Kollegen|dem Kollegen|des Kollegen", null],
  [{ w: "der See", a: "der", p: "die Seen" }, "der See|den See|dem See|des Sees", "die Seen|die Seen|den Seen|der Seen"],
  [{ w: "der Staat", a: "der", p: "die Staaten" }, "der Staat|den Staat|dem Staat|des Staat(e)s", null],
  [{ w: "der Doktor", a: "der", p: "die Doktoren" }, "der Doktor|den Doktor|dem Doktor|des Doktors", null],
  [{ w: "der Name", a: "der", p: "die Namen" }, "der Name|den Namen|dem Namen|des Namens", null],
  [{ w: "der Vorname", a: "der", p: "die Vornamen" }, "der Vorname|den Vornamen|dem Vornamen|des Vornamens", null],
  [{ w: "das Herz", a: "das", p: "die Herzen" }, "das Herz|das Herz|dem Herzen|des Herzens", null],
  [{ w: "das Zeugnis", a: "das", p: "die Zeugnisse" }, "das Zeugnis|das Zeugnis|dem Zeugnis|des Zeugnisses", "die Zeugnisse|die Zeugnisse|den Zeugnissen|der Zeugnisse"],
  [{ w: "der Bus", a: "der", p: "die Busse" }, "der Bus|den Bus|dem Bus|des Busses", null],
  [{ w: "der Zirkus", a: "der", p: "die Zirkusse" }, "der Zirkus|den Zirkus|dem Zirkus|des Zirkus", null],
  [{ w: "der Tourismus", a: "der", p: "(kein Plural)" }, "der Tourismus|den Tourismus|dem Tourismus|des Tourismus", null],
  [{ w: "das Chaos", a: "das", p: "(kein Plural)" }, "das Chaos|das Chaos|dem Chaos|des Chaos", null],
  [{ w: "das Krankenhaus", a: "das", p: "die Krankenhäuser" }, "das Krankenhaus|das Krankenhaus|dem Krankenhaus|des Krankenhauses", "die Krankenhäuser|die Krankenhäuser|den Krankenhäusern|der Krankenhäuser"],
  [{ w: "das Quiz", a: "das", p: "die Quiz" }, "das Quiz|das Quiz|dem Quiz|des Quiz", "die Quiz|die Quiz|den Quiz|der Quiz"],
  [{ w: "der Job", a: "der", p: "die Jobs" }, "der Job|den Job|dem Job|des Jobs", "die Jobs|die Jobs|den Jobs|der Jobs"],
  [{ w: "das Feiern", a: "das", p: "" }, "das Feiern|das Feiern|dem Feiern|des Feierns", null],
  [{ w: "das WLAN", a: "das", p: "" }, "das WLAN|das WLAN|dem WLAN|des WLANs", null],
  [{ w: "der Kundenservice", a: "der", p: "" }, "der Kundenservice|den Kundenservice|dem Kundenservice|des Kundenservice", null],
  [{ w: "die Lampe", a: "die", p: "die Lampen" }, "die Lampe|die Lampe|der Lampe|der Lampe", "die Lampen|die Lampen|den Lampen|der Lampen"],
  [{ w: "die Mutter", a: "die", p: "die Mütter" }, "die Mutter|die Mutter|der Mutter|der Mutter", "die Mütter|die Mütter|den Müttern|der Mütter"],
  [{ w: "der Bekannte", a: "der", p: "die Bekannten" }, "der Bekannte|den Bekannten|dem Bekannten|des Bekannten", null],
  [{ w: "die Ehrenamtliche", a: "die", p: "die Ehrenamtlichen" }, "die Ehrenamtliche|die Ehrenamtliche|der Ehrenamtlichen|der Ehrenamtlichen", null],
  [{ w: "das Richtige", a: "das", p: "" }, "das Richtige|das Richtige|dem Richtigen|des Richtigen", null],
  [{ w: "die Eltern", a: "die", p: "(immer Plural)" }, null, "die Eltern|die Eltern|den Eltern|der Eltern"],
  [{ w: "die Leute", a: "die", p: "(immer Plural)" }, null, "die Leute|die Leute|den Leuten|der Leute"],
  [{ w: "die möblierte Wohnung", a: "die", p: "die möblierten Wohnungen" }, "die möblierte Wohnung|die möblierte Wohnung|der möblierten Wohnung|der möblierten Wohnung", "die möblierten Wohnungen|die möblierten Wohnungen|den möblierten Wohnungen|der möblierten Wohnungen"],
  [{ w: "der Englische Garten", a: "der", p: "" }, "der Englische Garten|den Englischen Garten|dem Englischen Garten|des Englischen Gartens", null],
];
const flat = (rows) => rows && rows.map(([a, f]) => `${a} ${f}`).join("|");
for (const [it, sg, pl] of TABLES) {
  const d = nounParadigm(it);
  if (!d) { fail(`nounParadigm(${it.w}) returned nothing`); continue; }
  if ((flat(d.sg) ?? null) !== sg) fail(`${it.w} singular: ${flat(d.sg)}, want ${sg}`);
  if (pl && flat(d.pl) !== pl) fail(`${it.w} plural: ${flat(d.pl)}, want ${pl}`);
}
if (nounParadigm({ w: "das Blatt Papier", a: "das", p: "" })) fail("a noun phrase that is not adjective + noun must get no table");
for (const it of nouns) {
  if (!it.a) continue;
  const d = nounParadigm(it);
  for (const [, form] of [...(d?.sg || []), ...(d?.pl || [])]) {
    if (!form || /undefined|null/.test(form)) fail(`${it.w}: broken table cell "${form}"`);
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
console.log(`check-kasus: ${PARADIGMS.length} paradigms hold, ${TABLES.length} card tables hold, ${pass.length} drill nouns, ${cells.length} cells ok.`);
