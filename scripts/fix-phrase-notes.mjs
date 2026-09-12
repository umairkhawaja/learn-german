#!/usr/bin/env node
// ── Phrase data repair: usage notes are not example sentences ─────────────
//
// `ex` is documented as a bilingual example — "German sentence — English
// translation" — and every renderer treats it that way: ExampleLine puts the
// text before the em dash in German quotation marks and greys out the rest as
// the translation.
//
// In phrases.json, though, most `ex` values are English *usage notes*:
//
//     "Guten Morgen!"  ex: "Used until about 11 a.m."
//     "Gute Nacht!"    ex: "Only when going to bed — not a general goodbye."
//
// which render as „Used until about 11 a.m."  and, worse, as
// „Only when going to bed" — not a general goodbye. — an English fragment
// presented to a learner as German.
//
// This script sorts each `ex` into one of two fields:
//   • ex — a genuine German example (kept as-is, rendered as a quote)
//   • n  — a usage note (rendered as a note, the same field nouns and verbs
//          already use for their hints)
//
// Classification counts German vs English function words in the text (in the
// part before the em dash, where there is one), which separates the two kinds
// cleanly; `--report` prints every decision so it can be eyeballed.
//
// Usage:
//   node scripts/fix-phrase-notes.mjs            # summary
//   node scripts/fix-phrase-notes.mjs --report   # every decision
//   node scripts/fix-phrase-notes.mjs --apply    # rewrite phrases.json

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, "..", "public/data/phrases.json");
const APPLY = process.argv.includes("--apply");
const REPORT = process.argv.includes("--report");

const DE = new Set(`ich du er sie es wir ihr mich dich sich uns euch mir dir ihm ihnen
bin bist ist sind seid war waren habe hast hat haben habt hatte
der die das den dem des ein eine einen einem einer eines kein keine
nicht und oder aber denn weil dass wenn als wie wo was wer wen wem
zu zum zur in im ins an am auf aus bei mit nach von vor über unter für
hier da dort jetzt heute morgen gestern sehr auch noch schon nur mal bitte danke
kann kannst können möchte möchten muss müssen darf dürfen soll sollen will wollen
gibt geht macht machen kommt kommen sagt sagen wird werden würde wäre hätte`.split(/\s+/));

const EN = new Set(`the a an is are was were be been i you he she it we they
this that these those of to in on at for with from by about as
not no yes and or but if when where what who how why
used use uses using also only more most less than then
formal informal literally common commonly means meaning reply replies
polite politely stronger slightly standard general usually often typically
say says saying said said note remember careful always never sounds sound
shop shops german germans english people you're don't doesn't it's
dative accusative genitive nominative plural singular masculine feminine neuter`.split(/\s+/));

const score = (text) => {
  const words = text.toLowerCase().match(/[a-zäöüß']+/g) || [];
  let de = 0, en = 0;
  for (const w of words) {
    if (DE.has(w)) de++;
    if (EN.has(w)) en++;
  }
  return { de, en, words: words.length };
};

// Notes that open with an English framing word and then *quote* German score
// as German on word counts alone ("Informal. Formal: 'Wie geht es Ihnen?'"),
// so the opener is checked first and wins.
const NOTE_OPENER =
  /^(also|answer|used|use|short for|literally|informal|formal|polite|note|reply|common|standard|more|less|a |an |the |one of|many |make |only |in german|german[s]? )/i;

// A value is a German example when the part before the em dash reads as
// German. Ties and empty evidence fall back to "note", which is the safe
// side: a note is rendered as plain prose, so a misfiled example still reads
// correctly — while a misfiled note is presented as German, which does not.
// A gloss of one German word — "'aus' + dative: …", "'zum' = zu dem" — is a
// note about the headword, not a sentence using it.
const GLOSS_OPENER = /^['"„][^'"“]{1,20}['"“]\s*[+=]/;

function isGermanExample(ex) {
  if (NOTE_OPENER.test(ex.trim()) || GLOSS_OPENER.test(ex.trim())) return false;
  const head = ex.includes(" — ") ? ex.slice(0, ex.indexOf(" — ")) : ex;
  const { de, en } = score(head);
  return de > en;
}

const phrases = JSON.parse(readFileSync(FILE, "utf8"));
let toNote = 0, keptEx = 0;

for (const p of phrases) {
  if (!p.ex || typeof p.ex !== "string") continue;
  if (isGermanExample(p.ex)) {
    keptEx++;
    if (REPORT) console.log(`EX   ${p.w.padEnd(30)} ${p.ex}`);
  } else {
    toNote++;
    if (REPORT) console.log(`NOTE ${p.w.padEnd(30)} ${p.ex}`);
    // Preserve an existing note rather than overwrite it.
    p.n = p.n ? `${p.n} ${p.ex}` : p.ex;
    delete p.ex;
  }
}

console.log(`\nkept as German example: ${keptEx}\nmoved to usage note (n): ${toNote}`);

if (APPLY) {
  writeFileSync(FILE, JSON.stringify(phrases, null, 1) + "\n");
  console.log(`Wrote ${FILE}`);
} else {
  console.log("(dry run — pass --apply to write)");
}
