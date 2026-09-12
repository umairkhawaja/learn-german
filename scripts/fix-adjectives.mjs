#!/usr/bin/env node
// ── Adjective data repair ─────────────────────────────────────────────────
//
// Three defects, all visible to the learner in the Adjectives quiz:
//
// 1. COMPARATIVES WERE GENERATED BLINDLY. Every entry got `-er` / `am …sten`
//    appended, including the ones that are not gradable and the ones that are
//    not adjectives at all. The quiz then asks for the comparative and marks
//    the invented form correct:
//        tja  → "tjaer",  "am tjasten"
//        plus → "pluser", "am plusesten"
//        geradeaus → "geradeauser"
//    The real adjectives came out right (alt → älter, groß → größer, gut →
//    besser), so the fix is not to regenerate but to *withdraw* the forms
//    where no comparative exists. "–" is the dataset's existing marker for
//    "this form does not exist", and quiz.hasField() already excludes it, so
//    those words simply stop appearing in the comparative/superlative modes
//    while staying available for translation practice.
//
// 2. NON-ADJECTIVES ARE FILED AS ADJECTIVES. Particles (tja, na), adverbs
//    (hoffentlich, samstags, übermorgen), prepositions (ab, außerhalb) and
//    ordinals (erst, viert) sit in adj.json with no indication of what they
//    are. They keep their entry — the vocabulary is worth knowing — but get a
//    `wc` (Wortklasse) field so the card can label them honestly instead of
//    presenting a particle as an adjective.
//
// 3. TOPIC BUCKETS. 178 of 458 adjectives sat in a catch-all "Other", which
//    makes the topic filter useless, while "Feelings & States" duplicated
//    "Emotion & Feeling". Colours, ordinals, weather and word-class groups are
//    pulled out into the topics a course actually teaches them as.
//
// Usage:
//   node scripts/fix-adjectives.mjs           # report
//   node scripts/fix-adjectives.mjs --apply   # write

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, "..", "public/data/adj.json");
const APPLY = process.argv.includes("--apply");

// ── Word class ────────────────────────────────────────────────────────────
// Entries that are not adjectives. None of them takes a comparative.
const WORD_CLASS = {
  Partikel: ["tja", "na", "okay", "schade", "klar", "wohl", "echt", "total", "bitteschön", "gleichfalls", "bestimmt", "soweit"],
  Adverb: [
    "hoffentlich", "normalerweise", "plötzlich", "vormittags", "samstags", "einmal", "zweimal",
    "nochmal", "außerdem", "dabei", "dazu", "ebenso", "dadurch", "dorthin", "daneben", "drüben",
    "nebenan", "unterwegs", "vorn(e)", "zurück", "geradeaus", "vorwärts", "vorbei", "übermorgen",
    "vorgestern", "damals", "sogar", "meistens", "momentan", "lange", "früher", "getrennt",
    "gern(e)", "lieber", "sowie", "live", "online", "wahrscheinlich",
  ],
  Präposition: ["ab", "hinter", "pro", "inklusive", "außer", "außerhalb"],
  Zahlwort: ["plus", "minus", "maximal", "beide", "bisschen", "halb", "gesamt", "einzel", "mehr"],
  Ordinalzahl: ["erst", "zweit", "dritt", "viert", "siebt", "dreizehnt", "siebenundzwanzigst"],
  Artikelwort: ["folgend(e)", "letzt", "ander", "dies", "nächst", "selbst"],
};

// ── Absolute adjectives ───────────────────────────────────────────────────
// Genuine adjectives that name an either/or state, an origin, a frequency or
// a material. They decline normally but do not grade: nothing is "more dead",
// "more pregnant" or "more monthly", and the generated forms ("am totesten",
// "schwangrer", "am geöffnetesten") were simply wrong German.
const ABSOLUTE = [
  "tot", "schwanger", "geöffnet", "geschlossen", "verboten", "erlaubt", "gebrochen",
  "verletzt", "geschieden", "pensioniert", "berufstätig", "arbeitslos", "schriftlich",
  "mündlich", "männlich", "weiblich", "deutsch", "japanisch", "international", "täglich",
  "monatlich", "jährlich", "körperlich", "zeitlich", "wirtschaftlich", "automatisch",
  "freiwillig", "eingeladen", "beendet", "gesendet", "geschafft", "fertig", "satt",
  "besetzt", "frei", "einverstanden", "zuständig", "willkommen", "wahr", "eigen",
  "fehlend", "sofortig", "unterirdisch", "dreieckig", "viereckig", "golden", "silbern",
  "orangefarben", "lila", "rosa", "violett", "pink", "orange", "gekocht", "roh", "fix",
  "geehrt", "notwendig", "nötig", "möglich", "unbedingt", "sportlich", "kommunikativ",
  "regelmäßig", "spontan", "aktuell",
];

// ── Irregular forms the generator could not know ─────────────────────────
// gern is the classic A1/A2 drill (gern – lieber – am liebsten) and is worth
// keeping in the comparative mode even though the headword is an adverb.
const IRREGULAR = {
  "gern(e)": { cmp: "lieber", sup: "am liebsten" },
};

// ── Topics ────────────────────────────────────────────────────────────────
const TOPIC = {
  Farben: ["rot", "blau", "schwarz", "grün", "weiß", "gelb", "grau", "pink", "braun", "lila", "rosa", "orange", "orangefarben", "violett", "golden", "silbern", "bunt", "blond", "hell", "dunkel"],
  "Weather & Seasons": ["sonnig", "windig", "bewölkt", "neblig", "feucht", "trocken", "nass", "kühl", "warm", "kalt", "heiß"],
  "Numbers & Order": ["erst", "zweit", "dritt", "viert", "siebt", "dreizehnt", "siebenundzwanzigst", "plus", "minus", "maximal", "beide", "bisschen", "halb", "gesamt", "einzel", "mehr", "einmal", "zweimal"],
  "Function Words": ["tja", "na", "okay", "schade", "klar", "wohl", "echt", "total", "bitteschön", "gleichfalls", "bestimmt", "soweit", "ab", "hinter", "pro", "inklusive", "außer", "außerhalb", "folgend(e)", "letzt", "ander", "dies", "nächst", "selbst", "sowie", "dazu", "ebenso", "dadurch"],
  "Time & Frequency": ["hoffentlich", "normalerweise", "plötzlich", "vormittags", "samstags", "nochmal", "damals", "meistens", "momentan", "lange", "früher", "übermorgen", "vorgestern", "täglich", "monatlich", "jährlich", "regelmäßig", "aktuell", "sofortig"],
  "Distance & Position": ["dorthin", "daneben", "drüben", "nebenan", "unterwegs", "vorn(e)", "zurück", "geradeaus", "vorwärts", "vorbei", "unterirdisch"],
  "Work & Study": ["arbeitslos", "berufstätig", "pensioniert", "geschieden", "schriftlich", "mündlich", "zuständig", "selbstständig", "freiwillig", "beendet", "gesendet", "offiziell", "privat"],
};

// Older near-duplicate buckets folded into the one that already holds the
// bulk of the words, so the topic filter stops offering two names for one set.
const TOPIC_MERGE = {
  "Feelings & States": "Emotion & Feeling",
  States: "Status & Condition",
};

// ── Straight corrections ─────────────────────────────────────────────────
// "spännend" is a misspelling of "spannend", which is also in the file; the
// duplicate is dropped rather than corrected into a second identical entry.
const DROP = ["spännend"];

const adj = JSON.parse(readFileSync(FILE, "utf8"));
const byW = new Map(adj.map((x) => [x.w, x]));

const wcOf = new Map();
for (const [wc, words] of Object.entries(WORD_CLASS)) for (const w of words) wcOf.set(w, wc);
const topicOf = new Map();
for (const [t, words] of Object.entries(TOPIC)) for (const w of words) topicOf.set(w, t);
const nonGradable = new Set([...wcOf.keys(), ...ABSOLUTE]);

const stats = { dropped: 0, wc: 0, degraded: 0, retopiced: 0, merged: 0, irregular: 0, unknown: [] };

for (const w of [...nonGradable, ...topicOf.keys(), ...Object.keys(IRREGULAR), ...DROP]) {
  if (!byW.has(w)) stats.unknown.push(w);
}

const out = [];
for (const it of adj) {
  if (DROP.includes(it.w)) { stats.dropped++; continue; }

  const wc = wcOf.get(it.w);
  if (wc && it.wc !== wc) { it.wc = wc; stats.wc++; }

  if (IRREGULAR[it.w]) {
    const f = IRREGULAR[it.w];
    if (it.cmp !== f.cmp || it.sup !== f.sup) { it.cmp = f.cmp; it.sup = f.sup; stats.irregular++; }
  } else if (nonGradable.has(it.w)) {
    if (it.cmp !== "–" || it.sup !== "–") { it.cmp = "–"; it.sup = "–"; stats.degraded++; }
  }

  const topic = topicOf.get(it.w);
  if (topic && it.c !== topic) { it.c = topic; stats.retopiced++; }
  else if (TOPIC_MERGE[it.c]) { it.c = TOPIC_MERGE[it.c]; stats.merged++; }

  out.push(it);
}

console.log(`dropped duplicates:      ${stats.dropped}`);
console.log(`tagged with word class:  ${stats.wc}`);
console.log(`comparative withdrawn:   ${stats.degraded}`);
console.log(`irregular forms fixed:   ${stats.irregular}`);
console.log(`re-topiced:              ${stats.retopiced}`);
console.log(`merged duplicate topics: ${stats.merged}`);
if (stats.unknown.length) console.log(`\n! not in the file (check spelling): ${stats.unknown.join(", ")}`);

const topics = {};
for (const x of out) topics[x.c] = (topics[x.c] || 0) + 1;
console.log(`\ntopics after: ${Object.entries(topics).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join("  ")}`);

if (APPLY) {
  writeFileSync(FILE, JSON.stringify(out, null, 1) + "\n");
  console.log(`\nWrote ${FILE}`);
} else {
  console.log("\n(dry run — pass --apply to write)");
}
