// One-off data cleanup for public/data/verbs.json (+ adj.json / other.json):
//
//  1. Repairs the conjugation tables of separable verbs that a naive generator
//     corrupted — it regularised irregular stems ("gehte hin", "mitgenehmt")
//     and mis-split compound prefixes ("rückruft zu", "zufügt hin"). Each is
//     rebuilt from its (correct) base verb + prefix, and its `t`/`hs` are set
//     to match the base.
//  2. Deletes 14 non-verb entries that are exact duplicates of correct entries
//     already living in adj/other/gram.json.
//  3. Moves the remaining genuine non-verbs into adj.json / other.json with the
//     proper schema.
//
// Idempotent. Run: node scripts/fix-verb-data.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = (f) => join(__dirname, "..", "public", "data", f);
const load = (f) => JSON.parse(readFileSync(dataPath(f), "utf8"));
const save = (f, d) => writeFileSync(dataPath(f), JSON.stringify(d, null, 2) + "\n");

const verbs = load("verbs.json");
const byWord = Object.fromEntries(verbs.map((v) => [v.w, v]));

// Base verbs not present in the dataset, needed to rebuild separable forms.
const BASE_OVERRIDE = {
  laden:    { t: "irr", hs: "haben", pr: { ich: "lade", du: "lädst", er: "lädt", wir: "laden", ihr: "ladet", sie: "laden" }, pt: { ich: "lud", du: "ludst", er: "lud", wir: "luden", ihr: "ludet" }, p2: "geladen" },
  fügen:    { t: "reg", hs: "haben", pr: { ich: "füge", du: "fügst", er: "fügt", wir: "fügen", ihr: "fügt", sie: "fügen" }, pt: { ich: "fügte", du: "fügtest", er: "fügte", wir: "fügten", ihr: "fügtet" }, p2: "gefügt" },
  bereiten: { t: "reg", hs: "haben", pr: { ich: "bereite", du: "bereitest", er: "bereitet", wir: "bereiten", ihr: "bereitet", sie: "bereiten" }, pt: { ich: "bereitete", du: "bereitetest", er: "bereitete", wir: "bereiteten", ihr: "bereitetet" }, p2: "bereitet" },
};
const base = (name) => BASE_OVERRIDE[name] || byWord[name];

// Corrupted separable verbs → how to rebuild them (base verb + separable prefix).
const SEP_FIX = {
  "hingehen":        ["gehen", "hin"],
  "mitgehen":        ["gehen", "mit"],
  "losgehen":        ["gehen", "los"],
  "mitnehmen":       ["nehmen", "mit"],
  "annehmen":        ["nehmen", "an"],
  "abnehmen":        ["nehmen", "ab"],
  "aufschreiben":    ["schreiben", "auf"],
  "dazuschreiben":   ["schreiben", "dazu"],
  "zurückkommen":    ["kommen", "zurück"],
  "reinkommen":      ["kommen", "rein"],
  "vorbeikommen":    ["kommen", "vorbei"],
  "eingeben":        ["geben", "ein"],
  "hochladen":       ["laden", "hoch"],
  "hinzufügen":      ["fügen", "hinzu"],
  "dabeihaben":      ["haben", "dabei"],
  "rausbringen":     ["bringen", "raus"],
  "zurückrufen":     ["rufen", "zurück"],
  "weiterfahren":    ["fahren", "weiter"],
  "losfahren":       ["fahren", "los"],
  "zusammenwohnen":  ["wohnen", "zusammen"],
  "zusammendrücken": ["drücken", "zusammen"],
  "vorbereiten":     ["bereiten", "vor"],
  "wegkönnen":       ["können", "weg"],
  "hinwollen":       ["wollen", "hin"],
  "losmüssen":       ["müssen", "los"],
  "mitmüssen":       ["müssen", "mit"],
  // separable verbs the prefix-scan missed (statt-/wieder-/teil-/kennen-/fertig-)
  "stattfinden":     ["finden", "statt"],
  "wiederkommen":    ["kommen", "wieder"],
  "teilnehmen":      ["nehmen", "teil"],
  "kennenlernen":    ["lernen", "kennen"],
  "fertigmachen":    ["machen", "fertig"],
};

const AUX = {
  haben: { ich: "habe", du: "hast", er: "hat", wir: "haben", ihr: "habt", sie: "haben" },
  sein:  { ich: "bin", du: "bist", er: "ist", wir: "sind", ihr: "seid", sie: "sind" },
};

function rebuildSeparable(v, baseName, prefix) {
  const b = base(baseName);
  if (!b) throw new Error(`missing base verb: ${baseName}`);
  const suffix = " " + prefix;
  const pr = {}, pt = {};
  for (const k of Object.keys(b.pr)) pr[k] = b.pr[k] + suffix;
  for (const k of Object.keys(b.pt)) pt[k] = b.pt[k] + suffix;
  const p2 = prefix + b.p2;                    // prefix wraps the participle: hin+gegangen
  const hs = b.hs;
  const pk = {};
  for (const k of Object.keys(AUX[hs])) pk[k] = AUX[hs][k] + " " + p2;
  return { ...v, t: b.t, hs, pr, pt, pk, p2, sep: true };
}

// Non-separable strong verbs the generator wrongly regularised.
const mkPk = (hs, p2) => Object.fromEntries(Object.entries(AUX[hs]).map(([k, a]) => [k, a + " " + p2]));
const FULL_FIX = {
  "brechen": { t: "irr", hs: "haben", p2: "gebrochen", pr: { ich: "breche", du: "brichst", er: "bricht", wir: "brechen", ihr: "brecht", sie: "brechen" }, pt: { ich: "brach", du: "brachst", er: "brach", wir: "brachen", ihr: "bracht" } },
  "klingen": { t: "irr", hs: "haben", p2: "geklungen", pr: { ich: "klinge", du: "klingst", er: "klingt", wir: "klingen", ihr: "klingt", sie: "klingen" }, pt: { ich: "klang", du: "klangst", er: "klang", wir: "klangen", ihr: "klangt" } },
  "heben":   { t: "irr", hs: "haben", p2: "gehoben",   pr: { ich: "hebe", du: "hebst", er: "hebt", wir: "heben", ihr: "hebt", sie: "heben" }, pt: { ich: "hob", du: "hobst", er: "hob", wir: "hoben", ihr: "hobt" } },
  "backen":  { t: "irr", hs: "haben", p2: "gebacken",  pr: { ich: "backe", du: "backst", er: "backt", wir: "backen", ihr: "backt", sie: "backen" }, pt: { ich: "backte", du: "backtest", er: "backte", wir: "backten", ihr: "backtet" } },
};

let fixed = 0;
for (let i = 0; i < verbs.length; i++) {
  const f = SEP_FIX[verbs[i].w];
  if (f) { verbs[i] = rebuildSeparable(verbs[i], f[0], f[1]); fixed++; continue; }
  const g = FULL_FIX[verbs[i].w];
  if (g) { verbs[i] = { ...verbs[i], ...g, pk: mkPk(g.hs, g.p2) }; fixed++; }
}

// ── Delete duplicates already present in adj/other/gram ─────────
const DELETE = new Set([
  "zusammen", "hinten", "wegen", "zufrieden", "geschlossen", "geboren",
  "draußen", "gestern", "morgen", "selten", "neben", "gegen", "verschieden", "zwischen",
  "offen",
]);

// ── Move genuine non-verbs to their real category ──────────────
const MOVE_ADJ = [
  { w: "eingeladen", e: "invited",            c: "States", cmp: "–", sup: "–", opp: "–",            ex: "Wir sind herzlich eingeladen.", lvl: "A1" },
  { w: "geschieden", e: "divorced",           c: "States", cmp: "–", sup: "–", opp: "verheiratet",  ex: "Meine Eltern sind geschieden.", lvl: "A1" },
  { w: "verboten",   e: "forbidden / banned", c: "States", cmp: "–", sup: "–", opp: "erlaubt",      ex: "Rauchen ist hier verboten.",    lvl: "A1" },
  { w: "gebrochen",  e: "broken",             c: "States", cmp: "–", sup: "–", opp: "heil / ganz",  ex: "Mein Arm ist gebrochen.",       lvl: "A1" },
];
const MOVE_OTHER = [
  { w: "mitten", e: "in the middle (of)",   c: "Adverb",        ex: "Wir standen mitten im Park.",   lvl: "A1" },
  { w: "eben",   e: "just (now) / flat",    c: "Adverb",        ex: "Sie ist eben erst gegangen.",   lvl: "A1" },
  { w: "ihnen",  e: "them (dative)",        c: "Function Word", ex: "Ich gebe ihnen das Buch.",      lvl: "A1" },
];
const MOVED = new Set([...MOVE_ADJ, ...MOVE_OTHER].map((x) => x.w));

const keptVerbs = verbs.filter((v) => !DELETE.has(v.w) && !MOVED.has(v.w));

const adj = load("adj.json");
const other = load("other.json");
const adjWords = new Set(adj.map((x) => x.w));
const otherWords = new Set(other.map((x) => x.w));
for (const a of MOVE_ADJ) if (!adjWords.has(a.w)) adj.push(a);
for (const o of MOVE_OTHER) if (!otherWords.has(o.w)) other.push(o);

save("verbs.json", keptVerbs);
save("adj.json", adj);
save("other.json", other);

console.log(`Rebuilt ${fixed} corrupted separable verbs.`);
console.log(`Verbs: ${verbs.length} → ${keptVerbs.length} (deleted ${DELETE.size} dups, moved ${MOVED.size}).`);
console.log(`adj.json: ${adj.length}, other.json: ${other.length}.`);
