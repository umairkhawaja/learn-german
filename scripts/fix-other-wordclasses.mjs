#!/usr/bin/env node
// ── other.json: sort the residual bucket by word class ────────────────────
//
// other.json is the catch-all category, and its `c` field had drifted into
// four meaningless buckets: "Function Word" (59), "Other" (84), "Adverb" (53)
// and "Pronoun" (1). "Function Word" held question words, pronouns, adjectives
// and conjunctions together; "Other" held pronoun case forms next to fixed
// expressions like "Spaß haben".
//
// That matters twice over. The topic dropdown in Browse and Quiz is built from
// `c`, so it offered no useful way to narrow down; and components/detail.jsx
// colour-codes `c` against a map of word classes (Pronoun, Article,
// Preposition, Conjunction, Adverb, Number, Function Word) that almost nothing
// in the data ever matched.
//
// The buckets below are the word classes a German course actually teaches
// separately — W-Fragen get drilled as a set, personal-pronoun case forms get
// drilled as a table, Redemittel get learned whole.
//
// Usage:
//   node scripts/fix-other-wordclasses.mjs           # report
//   node scripts/fix-other-wordclasses.mjs --apply   # write

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, "..", "public/data/other.json");
const APPLY = process.argv.includes("--apply");

const CLASSES = {
  // W-Fragen — taught and tested as one closed set from the first A1 lesson.
  "Question Word": [
    "wer?", "wie?", "woher?", "wo?", "welch-?", "was?", "wann?", "warum?", "wem?", "wen?",
    "wann", "warum", "was", "wie", "wo", "woher", "wohin",
  ],
  // Personal, possessive and indefinite pronouns, including the case forms
  // the data lists separately ("mir (ich)", "den (der)").
  Pronoun: [
    "ich", "du", "er", "sie", "es", "wir", "ihr", "Sie",
    "mich (ich)", "mir (ich)", "dir (du)", "euch (ihr)", "uns (wir)",
    "ihm (er)", "ihm (es)", "ihnen", "Ihnen (Sie)",
    "mein, meine", "dein, deine", "unser, unsere", "euer, eure", "Ihr, Ihre",
    "das Meiste", "der Einzige", "verschiedene",
  ],
  // Articles and article-like determiners.
  Article: ["ein, eine", "kein, keine", "den (der)", "einen (ein)", "einem (ein)", "was (etwas)", "kommend-", "nächst-"],
  Conjunction: [
    "beziehungsweise", "daher", "dennoch", "einerseits", "andererseits", "indem",
    "entweder … oder", "weder … noch", "doch",
  ],
  Preposition: ["bis", "bis zu", "zum", "südlich (von)", "gegenüber"],
  Adverb: [
    "danke", "gar", "bitte", "nun", "circa", "gemeinsam", "wirklich", "mal", "wieder",
    "nachher", "ganz", "abends", "gerade", "fast", "genug", "vorher", "mindestens",
    "nachts", "morgens", "mittags", "mitten", "eben", "etwa", "kaum", "los", "ungefähr",
    "vorne", "ziemlich", "zufällig", "anschließend", "beinahe", "bloß", "ebenfalls",
    "eher", "heutzutage", "immerhin", "insgesamt", "inzwischen", "jedenfalls", "kürzlich",
    "sowieso", "vermutlich", "zunächst", "zumindest", "herum", "gewöhnlich", "niemals",
    "öfters", "nochmals", "erstens", "mittlerweile", "jeden Tag", "da", "hinten",
    "nirgends", "weiter", "wenigstens", "zuletzt", "zuletzt (zul.)", "eigentlich",
    "noch einmal", "weit weg", "in Ruhe", "so um", "in einem", "zu Ende", "nach Hause",
    "zu Hause", "zum Beispiel", "zum Glück",
  ],
  "Number & Time": [
    "ein bisschen", "viele", "genügend", "beide, beides", "einmal, zweimal, dreimal",
    "Viertel vor", "Viertel nach", "zu Mittag", "rund", "Nord-West (Singular)",
  ],
  // Ja / nein / doch and the conversational particles.
  Particle: ["ja", "nein", "nicht", "na klar", "Na ja", "Oh weh", "Mann, …", "Herr (Anrede)", "Frau (Anrede)", "@", "bio (biologisch)", "Open Air"],
  // Ready-made expressions: Nomen-Verb-Verbindungen, greetings, set phrases.
  // These are learned whole, which is exactly how the Chunks tab treats them.
  Expression: [
    "es geht", "Herzlich willkommen", "sich vorstellen", "beruflich machen",
    "Vielen Dank.", "verstanden (verstehen)", "gern(e) machen", "Ski fahren",
    "leid tun", "Lust haben", "mögen (mag)", "satt sein", "Spaß machen",
    "Violine spielen", "frei haben", "dabei sein", "Lieben Dank.", "Bis bald.",
    "bis dann", "Spaß haben", "sich kennen", "Glückwunsch, Glückwünsche",
    "Frohe Weihnachten", "Gitarre spielen", "bitte sehr", "los sein", "da sein",
    "her sein", "in Ordnung", "weh tun", "aus sein", "Bescheid sagen",
    "Fahrrad fahren", "Snowboard fahren", "sich anziehen", "Fußball spielen",
    "Recht haben", "an Bord", "Schlitten fahren",
  ],
  // Adjectives that ended up here rather than in adj.json; left in place (the
  // adj.json copies were removed as duplicates elsewhere) but labelled.
  Adjective: ["arm", "bar", "geboren"],
};

const data = JSON.parse(readFileSync(FILE, "utf8"));
const classOf = new Map();
for (const [c, words] of Object.entries(CLASSES)) for (const w of words) classOf.set(w, c);

let changed = 0;
const unclassified = [];
for (const it of data) {
  const c = classOf.get(it.w);
  if (!c) { unclassified.push(it.w); continue; }
  if (it.c !== c) { it.c = c; changed++; }
}

const counts = {};
for (const x of data) counts[x.c] = (counts[x.c] || 0) + 1;

console.log(`reclassified: ${changed}`);
console.log(`classes: ${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join("  ")}`);
if (unclassified.length) console.log(`\nleft unclassified (${unclassified.length}): ${unclassified.join(" · ")}`);

if (APPLY) {
  writeFileSync(FILE, JSON.stringify(data, null, 1) + "\n");
  console.log(`\nWrote ${FILE}`);
} else {
  console.log("\n(dry run — pass --apply to write)");
}
