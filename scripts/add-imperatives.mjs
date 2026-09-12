#!/usr/bin/env node
// ── Imperativ ─────────────────────────────────────────────────────────────
//
// The imperative is A1 material — every classroom instruction, recipe step and
// form field is phrased with it — and the app had none of it. This writes an
// `imp: { du, ihr, sie }` object onto each verb so the card renders data
// rather than deriving forms at runtime.
//
// The derivation is deliberately conservative, because a generated form that
// is merely plausible is exactly the defect this dataset already had once (see
// scripts/fix-adjectives.mjs). A verb gets an imperative only when the rule is
// safe; everything else is either hand-listed in IRREGULAR or left with no
// `imp` at all, and the card simply omits the row.
//
//   du   the du-form minus its ending, keeping an e→i/ie stem change
//        (sprichst → sprich, liest → lies) but never an a→ä one, which is
//        indicative-only (fährst → fahr, not fähr)
//   ihr  identical to the ihr-form of the present tense
//   Sie  infinitive + Sie
//
// A separable prefix goes to the end, as in the present tense; a reflexive
// verb takes its pronoun (dich / euch / sich).
//
// Usage:
//   node scripts/add-imperatives.mjs           # report
//   node scripts/add-imperatives.mjs --apply   # write

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, "..", "public/data/verbs.json");
const APPLY = process.argv.includes("--apply");
const SHOW = process.argv.includes("--all");

// Modal verbs have no imperative at all; these simply get none.
const NO_IMPERATIVE = new Set([
  "können", "müssen", "dürfen", "sollen", "wollen", "mögen", "möchten",
  "wissen", "heißen", "gefallen", "passieren", "geschehen", "regnen",
  "schneien", "bedeuten", "gehören", "kosten", "brauchen", "scheinen",
  "stattfinden", "sich lohnen", "sich befinden", "bestehen aus",
]);

// …and neither do compounds of them ("mitmüssen", "mitkönnen").
const MODAL_SUFFIX = /(können|müssen|dürfen|sollen|wollen|mögen)$/;

// Forms no rule reaches.
const IRREGULAR = {
  sein: { du: "Sei!", ihr: "Seid!", sie: "Seien Sie!" },
  haben: { du: "Hab!", ihr: "Habt!", sie: "Haben Sie!" },
  werden: { du: "Werde!", ihr: "Werdet!", sie: "Werden Sie!" },
  essen: { du: "Iss!", ihr: "Esst!", sie: "Essen Sie!" },
  nehmen: { du: "Nimm!", ihr: "Nehmt!", sie: "Nehmen Sie!" },
  geben: { du: "Gib!", ihr: "Gebt!", sie: "Geben Sie!" },
  lesen: { du: "Lies!", ihr: "Lest!", sie: "Lesen Sie!" },
  sehen: { du: "Sieh!", ihr: "Seht!", sie: "Sehen Sie!" },
  vergessen: { du: "Vergiss!", ihr: "Vergesst!", sie: "Vergessen Sie!" },
  treffen: { du: "Triff!", ihr: "Trefft!", sie: "Treffen Sie!" },
  helfen: { du: "Hilf!", ihr: "Helft!", sie: "Helfen Sie!" },
  sprechen: { du: "Sprich!", ihr: "Sprecht!", sie: "Sprechen Sie!" },
};

const upper = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Split a stored form into its finite verb and whatever trails it (a separable
// prefix, usually).
function parts(form) {
  const bits = String(form || "").trim().split(/\s+/);
  return { head: bits[0] || "", tail: bits.slice(1).join(" ") };
}

// The ich-form is stem + -e for every regular and strong verb alike, so it is
// the one reliable source of the stem. Deriving it from the du-form instead
// cannot tell "überweis + t" from "überwei + st" and produced "Überwei!".
function stemFromIch(ichForm) {
  return ichForm.replace(/e$/, "");
}

// Strip the du-ending, used only to detect a stem-vowel change.
function stemFromDu(duForm) {
  const s = duForm.replace(/t$/, "");        // …st → …s
  if (/es$/.test(s) && /(?:[dt]|[^aeiouäöü][mn])es$/.test(s)) return s.slice(0, -2);
  return s.replace(/s$/, "");
}

const verbs = JSON.parse(readFileSync(FILE, "utf8"));
let written = 0, skipped = 0;
const sample = [];

for (const v of verbs) {
  const infinitive = v.w.replace(/^sich\s+/, "");

  if (NO_IMPERATIVE.has(v.w) || NO_IMPERATIVE.has(infinitive) || MODAL_SUFFIX.test(infinitive)) {
    if (v.imp) delete v.imp;
    skipped++;
    continue;
  }

  // The conjugation already carries the reflexive pronoun and the separable
  // prefix in its tail ("meldest dich an"), so the tail is simply kept.
  const tailOf = (p) => (p.tail ? " " + p.tail : "");

  let imp = IRREGULAR[infinitive];
  if (imp) {
    imp = { ...imp };
  } else {
    const du = parts(v.pr.du);
    const ich = parts(v.pr.ich);
    let stem = stemFromIch(ich.head);

    // The imperative keeps an e→i / e→ie stem change (sprechen → Sprich!,
    // empfehlen → Empfiehl!) but not an a→ä one, which is indicative-only
    // (fahren → Fahr!, not Fähr!). Take the du-stem only when undoing that
    // i/ie gives exactly the ich-stem back — which is true of the e→i change
    // and of nothing else.
    const duS = stemFromDu(du.head);
    if (duS !== stem && duS.replace("ie", "e").replace("i", "e") === stem) stem = duS;

    // Whether the -e is needed is already recorded in the data: a verb that
    // takes it in the imperative is exactly one whose du-form ends in -est
    // (arbeitest → Arbeite!), and one that does not, does not (hältst →
    // Halt!, lernst → Lern!). Deriving it from the stem shape instead gave
    // "Halte!" for halten. -ig verbs are the one addition (Entschuldige!).
    if (/est$/.test(du.head) || /ig$/.test(stem)) stem += "e";
    // Only genuine -eln verbs contract (lächeln → Lächle!). Testing the stem
    // instead caught spielen, whose stem merely ends in the same two letters.
    else if (/eln$/.test(infinitive)) stem = stem.replace(/el$/, "le");
    // -ern verbs keep the -e (erinnere dich!, ändere!, wundere dich nicht!).
    else if (/ern$/.test(infinitive)) stem += "e";

    const ihr = parts(v.pr.ihr);
    // The Sie-imperative is the sie/Sie present form with "Sie" inserted after
    // the finite verb — which means pr.sie already carries the right shape,
    // prefix and reflexive pronoun included: "hören auf" → "Hören Sie auf!",
    // "melden sich an" → "Melden Sie sich an!". Building it from the
    // infinitive instead produced "Aufhören Sie!".
    const sie = parts(v.pr.sie);
    imp = {
      du: upper(stem) + tailOf(du) + "!",
      ihr: upper(ihr.head) + tailOf(ihr) + "!",
      sie: upper(sie.head) + " Sie" + tailOf(sie) + "!",
    };
  }

  const changed = JSON.stringify(v.imp) !== JSON.stringify(imp);
  v.imp = imp;
  if (changed) written++;
  if (SHOW || sample.length < 30) sample.push(`  ${v.w.padEnd(20)} ${imp.du.padEnd(22)} ${imp.ihr.padEnd(20)} ${imp.sie}`);
}

console.log(sample.join("\n"));
console.log(`\nimperatives written: ${written} · no imperative: ${skipped}`);

if (APPLY) {
  writeFileSync(FILE, JSON.stringify(verbs, null, 1) + "\n");
  console.log(`Wrote ${FILE}`);
} else {
  console.log("(dry run — pass --apply to write)");
}
