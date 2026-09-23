// Builds the two sentence-based exercise files from real sentences:
//
//   public/data/satzbau.json     — rebuild-the-sentence items
//   public/data/kasus-echt.json  — "which case is the highlighted phrase?"
//
//   node scripts/build-exercises.mjs <path/to/de_pud-ud-test.conllu>
//
// Nothing here is written by hand. The sentences come from two places:
//
//   1. The app's own example sentences (every "German — English" example in
//      public/data/*.json). Scrambling a sentence and asking for it back has
//      exactly one source of truth: the sentence itself.
//
//   2. The German PUD treebank of Universal Dependencies — 1,000 real
//      sentences from news and Wikipedia, each with a human English
//      translation and hand-checked grammatical annotation, including the
//      case of every article and noun. Get it with
//        git clone --depth 1 https://github.com/UniversalDependencies/UD_German-PUD
//      License: CC BY-SA 3.0 (text and translations), annotations as-is.
//      The case questions are that annotation, used as the answer key — and
//      only where the treebank's case agrees with the article's own form in
//      the declension tables of src/engine/kasus.js, so an annotation slip
//      cannot become a wrong answer.
import { readFileSync, writeFileSync } from "node:fs";
import { article } from "../src/engine/kasus.js";

const pudPath = process.argv[2];
if (!pudPath) {
  console.error("usage: node scripts/build-exercises.mjs <de_pud-ud-test.conllu>");
  process.exit(1);
}

const dataUrl = (f) => new URL(`../public/data/${f}`, import.meta.url);
const read = (f) => JSON.parse(readFileSync(dataUrl(f), "utf8"));

// ── Shared sentence helpers ───────────────────────────────────
const SUBORD = new Set(["dass", "weil", "wenn", "ob", "obwohl", "als", "damit", "bevor", "nachdem",
  "bis", "seit", "seitdem", "falls", "sodass", "während", "sobald", "solange", "indem", "ehe"]);
const W_WORDS = new Set(["wer", "was", "wo", "wohin", "woher", "wann", "warum", "wie", "welche", "welcher",
  "welches", "welchen", "wem", "wen", "wieso", "weshalb", "wozu", "womit", "worüber", "wofür"]);
const REL = new Set(["der", "die", "das", "den", "dem", "deren", "dessen", "denen"]);

// Tags only choose which rule the card shows after an answer and let you
// filter; they never decide what counts as right.
function tagsOf(words, end) {
  const tags = new Set();
  const low = words.map((w) => w.toLowerCase().replace(/[,;:]$/, ""));
  if (end === "?") tags.add(W_WORDS.has(low[0]) ? "w-frage" : "ja-nein-frage");
  for (let i = 0; i < words.length; i++) {
    const afterComma = i > 0 && /,$/.test(words[i - 1]);
    if ((afterComma || i === 0) && SUBORD.has(low[i]) && words.some((w, j) => j > i && /,$/.test(w) || afterComma)) tags.add("nebensatz");
    if (afterComma && REL.has(low[i])) tags.add("relativsatz");
  }
  if (!tags.size) tags.add("hauptsatz");
  return [...tags];
}

// ── 1. The app's own example sentences ────────────────────────
function appSentences() {
  const files = ["nouns", "verbs", "adj", "gram", "other", "phrases", "chunks"];
  const out = [];
  for (const f of files) {
    for (const it of read(`${f}.json`)) {
      const exs = Array.isArray(it.ex) ? it.ex : it.ex ? [it.ex] : [];
      for (const ex of exs) {
        const i = ex.indexOf(" — ");
        if (i < 0) continue;
        out.push({ de: ex.slice(0, i).trim(), en: ex.slice(i + 3).trim(), lvl: it.lvl || "A1", src: f });
      }
    }
  }
  return out;
}

// One sentence, one clean ending, nothing a tile cannot hold.
const CLEAN = /^[A-ZÄÖÜa-zäöüß0-9][A-Za-zÄÖÜäöüß0-9 ,'’\-]*[.?!]$/;

function tilesOf(de) {
  const end = de.slice(-1);
  const words = de.slice(0, -1).trim().split(/\s+/);
  return { words, end };
}

// ── 2. The PUD treebank ───────────────────────────────────────
function parseConllu(text) {
  const sents = [];
  for (const block of text.split(/\n\s*\n/)) {
    const lines = block.split("\n").filter(Boolean);
    if (!lines.length) continue;
    const s = { id: "", text: "", en: "", toks: [], mwt: [] };
    for (const line of lines) {
      if (line.startsWith("# sent_id = ")) s.id = line.slice(12).trim();
      else if (line.startsWith("# text = ")) s.text = line.slice(9).trim();
      else if (line.startsWith("# text_en = ")) s.en = line.slice(12).trim();
      else if (!line.startsWith("#")) {
        const c = line.split("\t");
        if (c.length !== 10) continue;
        if (/^\d+-\d+$/.test(c[0])) {
          const [a, b] = c[0].split("-").map(Number);
          s.mwt.push({ a, b, form: c[1], misc: c[9] });
        } else if (/^\d+$/.test(c[0])) {
          const feats = {};
          if (c[5] !== "_") for (const kv of c[5].split("|")) { const [k, v] = kv.split("="); feats[k] = v; }
          s.toks.push({ id: +c[0], form: c[1], lemma: c[2], upos: c[3], feats, head: +c[6], rel: c[7], misc: c[9] });
        }
      }
    }
    if (s.toks.length) sents.push(s);
  }
  return sents;
}

// Surface words of a sentence: multi-word tokens (am = an + dem) collapse
// back to their written form, and punctuation glued to a word (SpaceAfter=No)
// stays on it. Returns [{ text, ids:[token ids] }].
function surfaceWords(s) {
  const units = [];
  const inMwt = new Map();
  for (const m of s.mwt) for (let k = m.a; k <= m.b; k++) inMwt.set(k, m);
  for (let i = 0; i < s.toks.length; i++) {
    const t = s.toks[i];
    const m = inMwt.get(t.id);
    if (m) {
      if (t.id !== m.a) continue;
      const ids = []; for (let k = m.a; k <= m.b; k++) ids.push(k);
      units.push({ text: m.form, ids, noSpace: /SpaceAfter=No/.test(m.misc), punct: false });
    } else {
      units.push({ text: t.form, ids: [t.id], noSpace: /SpaceAfter=No/.test(t.misc), punct: t.upos === "PUNCT" });
    }
  }
  // Glue: a unit with no space after it absorbs the next punctuation mark.
  const words = [];
  for (const u of units) {
    const prev = words[words.length - 1];
    if (prev && prev.noSpace && u.punct) {
      prev.text += u.text; prev.ids.push(...u.ids); prev.noSpace = u.noSpace;
    } else words.push({ ...u, ids: [...u.ids] });
  }
  return words;
}

const CASE_OF = { Nom: "nom", Acc: "akk", Dat: "dat", Gen: "gen" };
const SLOT_OF = (f) => (f.Number === "Plur" ? "pl" : { Masc: "m", Fem: "f", Neut: "n" }[f.Gender]);
const TWO_WAY = new Set(["an", "auf", "hinter", "in", "neben", "über", "unter", "vor", "zwischen"]);
const POSS = new Set(["mein", "dein", "sein", "ihr", "unser", "kein", "ein"]);
// Prepositions with one fixed case (standard grammar tables).
const PREP_CASE = {
  durch: "akk", für: "akk", gegen: "akk", ohne: "akk", um: "akk", bis: "akk",
  aus: "dat", bei: "dat", mit: "dat", nach: "dat", seit: "dat", von: "dat", zu: "dat", gegenüber: "dat", außer: "dat", ab: "dat",
  wegen: "gen", trotz: "gen", statt: "gen", anstatt: "gen", während: "gen", innerhalb: "gen", außerhalb: "gen",
};
const CASE_DE = { nom: "Nominativ", akk: "Akkusativ", dat: "Dativ", gen: "Genitiv" };

// Does the article's own spelling agree with the treebank's case? Uses the
// same tables as the drill, so the two sources check each other.
function articleAgrees(det, kase, slot) {
  const form = det.form.toLowerCase();
  const lemma = det.lemma.toLowerCase();
  if (lemma === "der") return article("def", kase, slot) === form;
  if (POSS.has(lemma)) {
    if (lemma === "ein") return article("ein", kase, slot) === form;
    const ending = article("kein", kase, slot).slice(4);
    return form === lemma + ending;
  }
  return false;
}

function whyOf(s, noun, kase, byId) {
  const kids = s.toks.filter((t) => t.head === noun.id);
  const adp = kids.find((t) => t.rel === "case" && t.upos === "ADP");
  const head = byId.get(noun.head);
  const nounHead = head && (head.upos === "NOUN" || head.upos === "PROPN");
  if (adp) {
    const p = adp.form.toLowerCase();
    if (TWO_WAY.has(p)) {
      if (kase !== "dat" && kase !== "akk") return null;
      return `„${p}“ ist eine Wechselpräposition: Dativ für Ort oder Zeitpunkt (wo? wann?), Akkusativ für Richtung (wohin?); nach festen Verben und Nomen gilt deren Fall (warten auf + Akk, Angst vor + Dat). Hier: ${CASE_DE[kase]}`;
    }
    // A fixed-case preposition the treebank tags with a different case is
    // either colloquial (wegen dem) or an annotation slip: leave it out.
    if (!PREP_CASE[p] || PREP_CASE[p] !== kase) return null;
    return `„${p}“ steht immer mit ${CASE_DE[kase]}`;
  }
  if (kids.some((t) => t.rel === "cop")) return "Prädikatsnomen nach „sein/werden“ → Nominativ";
  switch (noun.rel) {
    case "nsubj": case "nsubj:pass": return "Subjekt des Satzes (wer/was?)";
    case "obj": return head ? `Objekt von „${head.lemma}“` : "Objekt des Verbs";
    case "iobj": return head ? `Dativobjekt von „${head.lemma}“ (wem?)` : "Dativobjekt (wem?)";
    case "nmod": case "nmod:poss": return kase === "gen" && nounHead ? `Genitivattribut zu „${head.form}“ (wessen?)` : null;
    case "obl:tmod": return "Zeitangabe ohne Präposition";
    case "appos": return nounHead ? `Apposition zu „${head.form}“ — gleicher Fall` : null;
    // Only a real und/oder list; UD also files "als …" comparisons as conj.
    case "conj": return kids.some((t) => t.rel === "cc") ? "Teil einer Aufzählung — gleicher Fall wie das erste Glied" : null;
    default: return null;
  }
}

function pudItems(sents) {
  const satz = [];
  const echt = [];
  for (const s of sents) {
    if (!s.en) continue;
    const words = surfaceWords(s);
    const byId = new Map(s.toks.map((t) => [t.id, t]));
    const plain = words.map((w) => w.text);
    // The final mark is glued to the last word; give it its own slot.
    const lastWord = plain[plain.length - 1];
    const endMark = /[^.?!][.?!]$/.test(lastWord) ? lastWord.slice(-1) : null;
    const hasQuote = /[„“"«»()\[\]]/.test(s.text);

    // Satzbau: short, one sentence, no quotes or brackets.
    const last = endMark;
    if (!hasQuote && last && plain.length >= 4 && plain.length <= 11) {
      const ws = [...plain.slice(0, -1), lastWord.slice(0, -1)];
      if (ws.every((w) => /^[A-Za-zÄÖÜäöüß0-9][A-Za-zÄÖÜäöüß0-9.\-’',]*$/.test(w))) {
        const first = s.toks[0];
        const tags = new Set();
        if (last === "?") tags.add(W_WORDS.has(first.form.toLowerCase()) ? "w-frage" : "ja-nein-frage");
        if (s.toks.some((t) => t.rel === "mark")) tags.add("nebensatz");
        if (s.toks.some((t) => t.rel === "acl:relcl")) tags.add("relativsatz");
        if (s.toks.some((t) => t.rel === "aux" || t.rel === "aux:pass" || t.rel === "compound:prt")) tags.add("satzklammer");
        if (!tags.size) tags.add("hauptsatz");
        const keepCap = first.upos === "NOUN" || first.upos === "PROPN" || first.form === "Sie";
        satz.push({ de: ws.join(" ") + last, en: s.en, words: ws, end: last, lvl: "echt", src: "pud", id: s.id, tags: [...tags], keepCap });
      }
    }

    // Kasus erkennen: article + (adjectives) + noun, all agreeing.
    if (hasQuote || plain.length > 20) continue;
    let perSentence = 0;
    for (const noun of s.toks) {
      if (perSentence >= 3) break;
      if (noun.upos !== "NOUN" || !CASE_OF[noun.feats.Case]) continue;
      const kase = CASE_OF[noun.feats.Case];
      const slot = SLOT_OF(noun.feats);
      if (!slot) continue;
      const kids = s.toks.filter((t) => t.head === noun.id);
      const dets = kids.filter((t) => t.rel === "det" || t.rel === "det:poss");
      if (dets.length !== 1) continue;
      const det = dets[0];
      if (det.feats.Case !== noun.feats.Case) continue;
      if (!articleAgrees(det, kase, slot)) continue;
      const adjs = kids.filter((t) => t.rel === "amod" && t.upos === "ADJ");
      if (adjs.some((a) => a.feats.Case && a.feats.Case !== noun.feats.Case)) continue;
      // The phrase must be one unbroken run: det, adjectives, noun — nothing else.
      const ids = [det.id, ...adjs.map((a) => a.id), noun.id].sort((a, b) => a - b);
      if (ids[0] !== det.id || ids[ids.length - 1] !== noun.id || ids[ids.length - 1] - ids[0] + 1 !== ids.length) continue;
      const wStart = words.findIndex((w) => w.ids.includes(det.id));
      const wEnd = words.findIndex((w) => w.ids.includes(noun.id));
      if (wStart < 0 || wEnd < wStart) continue;
      // Skip a phrase whose article is hidden in a contraction (am, zum…):
      // there is no article word to look at.
      if (s.mwt.some((m) => det.id >= m.a && det.id <= m.b)) continue;
      const why = whyOf(s, noun, kase, byId);
      if (!why) continue;
      echt.push({
        id: `${s.id}:${noun.id}`, tok: plain, span: [wStart, wEnd + 1], case: kase, slot, why,
        en: s.en, phrase: words.slice(wStart, wEnd + 1).map((w) => w.text.replace(/[,.;:?!]+$/, "")).join(" "),
      });
      perSentence++;
    }
  }
  return { satz, echt };
}

// ── Assemble ──────────────────────────────────────────────────
const items = [];
const seen = new Set();
for (const s of appSentences()) {
  if (!CLEAN.test(s.de) || seen.has(s.de)) continue;
  const { words, end } = tilesOf(s.de);
  if (words.length < 4 || words.length > 11) continue;
  seen.add(s.de);
  items.push({ de: s.de, en: s.en, words, end, lvl: s.lvl, src: s.src, tags: tagsOf(words, end) });
}

// First-word capital: a capital letter on one tile gives the first
// position away. Lower it when the word is seen lower-case mid-sentence
// somewhere in the corpus (ich, was, morgen…) — a noun never is.
const midLower = new Set();
for (const it of items) for (const w of it.words.slice(1)) {
  const bare = w.replace(/[,;:]$/, "");
  if (/^[a-zäöüß]/.test(bare)) midLower.add(bare);
}

const pud = pudItems(parseConllu(readFileSync(pudPath, "utf8")));
for (const it of pud.satz) {
  if (seen.has(it.de)) continue;
  seen.add(it.de);
  items.push(it);
}

const out = items.map((it) => {
  const first = it.words[0];
  const bare = first.replace(/[,;:]$/, "");
  const lower = bare[0].toLowerCase() + bare.slice(1);
  const lowerIt = it.src === "pud" ? !it.keepCap : bare !== "Sie" && midLower.has(lower);
  const tok = [...it.words];
  if (lowerIt) tok[0] = lower + first.slice(bare.length);
  const o = { de: it.de, en: it.en, tok, end: it.end, lvl: it.lvl, src: it.src === "pud" ? "pud" : "app", tags: it.tags };
  if (it.id) o.id = it.id;
  return o;
});

const PUD_CREDIT = "Universal Dependencies German PUD treebank (Google, CC BY-SA 3.0) — https://github.com/UniversalDependencies/UD_German-PUD";
writeFileSync(dataUrl("satzbau.json"), JSON.stringify({
  sources: { app: "Example sentences from this app's word lists", pud: PUD_CREDIT },
  items: out,
}, null, 1) + "\n");
writeFileSync(dataUrl("kasus-echt.json"), JSON.stringify({
  source: PUD_CREDIT,
  items: pud.echt,
}, null, 1) + "\n");

const byTag = {};
for (const it of out) for (const t of it.tags) byTag[t] = (byTag[t] || 0) + 1;
const byCase = {};
for (const q of pud.echt) byCase[q.case] = (byCase[q.case] || 0) + 1;
console.log(`satzbau.json: ${out.length} sentences (${out.filter((x) => x.src === "app").length} app, ${out.filter((x) => x.src === "pud").length} PUD)`, byTag);
console.log(`kasus-echt.json: ${pud.echt.length} phrases`, byCase);
