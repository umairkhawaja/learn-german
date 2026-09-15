#!/usr/bin/env node
// ── Usage-frequency ranker ────────────────────────────────────────────────
//
// Writes an `f` field onto every entry in public/data/*.json: a 1-based rank
// across the whole dataset, where f:1 is the word you are most likely to meet
// in everyday German. The app sorts new words by it (see src/config/
// frequency.js), so practice starts with the words that actually earn their
// keep instead of wherever the data file happens to begin.
//
// Why a corpus rank and not the CEFR level: the levels say how *hard* a word
// is, not how *often* it turns up. "die Mahlzeit" and "das Angebot" are both
// A2, but one of them you hear every day. Level and frequency answer different
// questions, so the app keeps both and orders by frequency inside whatever
// level you have selected.
//
//   node scripts/add-frequency.mjs            # download (cached) and apply
//   node scripts/add-frequency.mjs --dry-run  # report only, write nothing
//   node scripts/add-frequency.mjs --source path/to/list.txt
//   node scripts/add-frequency.mjs --report 40
//
// SOURCE: the German OpenSubtitles-2018 frequency list from
// hermitdave/FrequencyWords ("<token> <count>", one per line, lowercased).
// Subtitles are the closest freely available corpus to *spoken, everyday*
// German — which is the thing being ranked. A newspaper corpus would put
// "Bundesregierung" above "Frühstück".
//
// The list is cached under scripts/.cache/ (gitignored) and is only needed
// when regenerating: the ranks themselves are committed with the data.
//
// ── How an entry is scored ────────────────────────────────────────────────
// The corpus counts *tokens*, so "sprechen" alone would score far below its
// own "spricht". The data already carries the full paradigm of every verb,
// the plural of every noun and the graded forms of every adjective, so each
// entry is scored as a LEMMA: the counts of all its surface forms, summed.
// That is what makes a verb comparable with a noun.
//
// Two deliberate approximations, both fine for a ranking and neither safe to
// read as linguistics:
//   • Adjective declensions are generated (gut → gute/guten/guter/gutes/
//     gutem), so a generated form can collide with an unrelated homograph.
//     It moves a rank by a place or two; it never invents a word the learner
//     sees, because nothing generated here is written back to the data.
//   • A multi-word phrase is scored by its RAREST token. The rare token is
//     the content-bearing one and it is what gates the phrase: everyone knows
//     "ich bin der …", the question is whether they know "Meinung".
//
// Separable verbs get their own treatment rather than that second rule. Their
// finite forms are written apart — "rufe an" — and a unigram list counts the
// two halves as unrelated words, which scored "mitgehen" as if it were
// "gehen". The joined spelling is a real corpus token though (it is what a
// subordinate clause uses: "… weil ich anrufe"), so those forms are looked up
// joined, and a separable verb is ranked on its own paradigm.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "..", "public/data");
const CACHE_DIR = join(__dirname, ".cache");
const CACHE = join(CACHE_DIR, "de_50k.txt");
const SOURCE_URL =
  "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/de/de_50k.txt";

const FILES = ["nouns", "verbs", "adj", "gram", "other", "phrases", "chunks"];

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const DRY = flag("--dry-run");
const REPORT = Number(opt("--report", 25));

// ── The frequency list ────────────────────────────────────────────────────
async function loadFrequencies() {
  const src = opt("--source", null);
  let text;
  if (src) {
    text = readFileSync(src, "utf8");
    console.log(`source: ${src}`);
  } else if (existsSync(CACHE)) {
    text = readFileSync(CACHE, "utf8");
    console.log(`source: ${CACHE} (cached)`);
  } else {
    console.log(`source: ${SOURCE_URL} (downloading)`);
    const res = await fetch(SOURCE_URL);
    if (!res.ok) throw new Error(`download failed: ${res.status} ${res.statusText}`);
    text = await res.text();
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE, text);
  }

  const freq = new Map();
  for (const line of text.split("\n")) {
    const sp = line.lastIndexOf(" ");
    if (sp < 1) continue;
    const token = line.slice(0, sp).trim().toLowerCase();
    const n = Number(line.slice(sp + 1));
    if (!token || !Number.isFinite(n)) continue;
    freq.set(token, (freq.get(token) || 0) + n);
  }
  if (freq.size < 1000) throw new Error(`frequency list looks wrong: ${freq.size} tokens`);
  console.log(`tokens: ${freq.size.toLocaleString()}\n`);
  return freq;
}

// ── Surface forms → counts ────────────────────────────────────────────────
const PARENS = /\([^)]*\)/g;
// Leading article, including the "der/das Blog" spelling used for nouns whose
// gender is genuinely both ways.
const ARTICLE = /^(?:(?:der|die|das)\/)*(?:der|die|das)\s+/i;
const REFLEXIVE = new Set(["mich", "dich", "sich", "uns", "euch", "mir", "dir"]);

// Everything outside a German word is a separator. "…", commas, question
// marks and em dashes all just fall away; hyphens stay, because "U-Bahn" is
// one token in the corpus too.
// One-character leftovers are dropped: they are never a German word we are
// ranking, and the corpus's own "s" (from "geht's") is one of its most
// frequent tokens — enough to have made "das Omelette" a top-100 word.
const wordsOf = (s) =>
  String(s)
    .replace(PARENS, " ")
    .toLowerCase()
    .replace(/[^a-zäöüß0-9\-]+/g, " ")
    .split(" ")
    .map((t) => t.replace(/^-+|-+$/g, ""))
    .filter((t) => t.length > 1);

const countOf = (freq, token) => freq.get(token) || 0;

// One surface form. Single token → its count; multi-word → its rarest token
// (see the header).
//
// A slash means "either of these" only when every side of it is a single word
// ("der/die/das", "kalt/kühl") — then the best alternative wins. Anywhere else
// the slash is punctuation inside one form and splitting on it would score the
// form as whichever fragment happened to be a common little word.
// Both scorers return { key, count }: the corpus entry the form resolved to,
// and its count. The key is what lets an entry's forms be de-duplicated —
// a paradigm repeats itself (infinitive = wir = sie, er = ihr), and counting
// the same corpus token three times would inflate every verb in the file.
const NOTHING = { key: "", count: 0 };

function formScore(freq, form, blocked) {
  if (form == null) return NOTHING;
  // "die Picknicke/-s" is one plural written two ways, not an alternative
  // word — the "-s" half is a suffix and has no count of its own.
  const alts = String(form).replace(PARENS, " ").split("/")
    .map((s) => s.trim()).filter((s) => s && !s.startsWith("-"));
  const parts = alts.length > 1 && alts.every((a) => wordsOf(a).length === 1) ? alts : [form];
  let best = NOTHING;
  for (const part of parts) {
    const ws = wordsOf(part);
    if (!ws.length) continue;
    const key = ws.length === 1 ? ws[0] : ws.join(" ");
    const hit = { key, count: blocked?.has(key) ? 0 : ws.length === 1
      ? countOf(freq, key)
      : Math.min(...ws.map((w) => countOf(freq, w))) };
    if (hit.count > best.count) best = hit;
  }
  return best;
}

// A verb form, where "apart" does not mean "a phrase". Reflexive pronouns and
// the polite "Sie" are dropped (they are the same handful of words for every
// verb and say nothing about how common this one is) and what is left, if it
// is still two pieces, is a separable verb written apart: look up the joined
// spelling.
function verbFormScore(freq, form) {
  const ws = wordsOf(form).filter((w) => !REFLEXIVE.has(w) && w !== "sie");
  if (!ws.length) return NOTHING;
  const key = ws.length === 1 ? ws[0] : ws[ws.length - 1] + ws.slice(0, -1).join("");
  return { key, count: countOf(freq, key) };
}

const hasField = (v) => v != null && String(v).trim() !== "" && v !== "–";
const push = (out, v) => { if (hasField(v)) out.push(String(v)); };

// Generated adjective declensions. `gut` → gute/guten/guter/gutes/gutem;
// `leise` drops its -e first; `teuer`/`dunkel` elide theirs (teure, dunkle).
// Entries tagged as adverbs decline for nobody, so they keep their one form.
function adjectiveForms(x) {
  const base = String(x.w).trim();
  if (!base || /\s/.test(base) || x.wc === "Adverb") return [base];
  const out = new Set([base]);
  const stems = [base.replace(/e$/, "")];
  const elided = base.match(/^(.*)e([lr])$/);
  if (elided) stems.push(elided[1] + elided[2]);
  for (const stem of stems) for (const end of ["e", "en", "er", "es", "em"]) out.add(stem + end);
  return [...out];
}

// The forms that make up one entry's lemma count, per category.
function formsOf(file, x) {
  const out = [];
  switch (file) {
    case "nouns":
      push(out, String(x.w).replace(ARTICLE, ""));
      push(out, String(x.p ?? "").replace(ARTICLE, ""));
      break;

    case "verbs":
      // The infinitive, every finite form, the participle and the
      // imperatives. `pk` is skipped: it is auxiliary + p2, both already
      // counted, and counting it again would double every verb's weight.
      push(out, x.w);
      push(out, x.p2);
      for (const tense of ["pr", "pt"]) {
        for (const form of Object.values(x[tense] ?? {})) push(out, form);
      }
      // Imperatives are deliberately left out. The du-imperative is the bare
      // stem, and bare stems are where German homographs live: "Mal!" is the
      // particle mal, "Mein!" the possessive, and counting them made malen
      // the 64th most useful word in the app. The polite form is just the
      // infinitive, and a separable "Ruf an!" has no joined spelling at all.
      // What they would add, the present tense already says.
      break;

    case "adj":
      for (const form of adjectiveForms(x)) push(out, form);
      push(out, x.cmp);
      push(out, x.sup);
      break;

    // Function words, pronouns, set phrases and chunks have no paradigm in
    // the data — the headword itself is the whole signal.
    default:
      push(out, x.w);
  }
  return out;
}

// A lemma's count is the sum of its *distinct* forms. A phrase has only the
// one "form", already reduced to its rarest word by formScore, so the two
// agree there.
function scoreEntry(freq, file, x, blocked) {
  const scorer = file === "verbs" ? verbFormScore : formScore;
  const forms = formsOf(file, x);
  const seen = new Set();
  let score = 0;
  const counts = forms.map((f) => {
    const { key, count } = scorer(freq, f, blocked);
    if (!key || seen.has(key)) return 0;
    seen.add(key);
    score += count;
    return count;
  });
  return { score, forms, counts };
}

// ── Run ───────────────────────────────────────────────────────────────────
const freq = await loadFrequencies();

const db = Object.fromEntries(
  FILES.map((f) => [f, JSON.parse(readFileSync(join(DATA, `${f}.json`), "utf8"))])
);

// ── Homograph guard for nouns ─────────────────────────────────────────────
// The corpus is lowercased, and lowercasing is exactly what erases the one
// signal German gives for free: nouns are capitalised. So "die Ware" picked up
// every "waren" (were), "das Weiß" every "weiß" (knows), "die Bitte" every
// "bitte" (please) — three rare nouns landing in the top 150.
//
// The dataset can spot its own collisions: if a noun's form is spelled the
// same as some *other* word the app teaches, the corpus count for it is a
// mixture and says nothing about the noun. Those forms are scored 0, leaving
// the noun to stand on its remaining form (usually the plural) or, if that
// collides too, on nothing — which is the honest answer.
const claimedByOthers = new Set();
for (const file of FILES) {
  if (file === "nouns") continue;
  for (const x of db[file]) {
    for (const form of formsOf(file, x)) {
      const { key } = (file === "verbs" ? verbFormScore : formScore)(freq, form);
      if (key && !key.includes(" ")) claimedByOthers.add(key);
    }
  }
}

const scored = [];
for (const file of FILES) {
  const blocked = file === "nouns" ? claimedByOthers : null;
  db[file].forEach((x, i) => scored.push({ file, i, x, ...scoreEntry(freq, file, x, blocked) }));
}

// Rank descending by usage. Ties fall back to the order the data already had,
// so re-running on unchanged data produces an unchanged file — which matters
// most for the entries the corpus knows nothing about, all tied on 0.
scored.sort((a, b) =>
  b.score - a.score ||
  a.file.localeCompare(b.file) ||
  a.i - b.i
);
scored.forEach((e, rank) => { e.rank = rank + 1; });

// `--explain <headword>` shows the forms an entry was scored on — the way to
// check a rank that looks wrong before believing it.
const explain = opt("--explain", null);
if (explain) {
  const hits = scored.filter((e) => e.x.w.toLowerCase().includes(explain.toLowerCase()));
  if (!hits.length) console.log(`no entry matching "${explain}"`);
  for (const e of hits.slice(0, 5)) {
    console.log(`\n${e.x.w}  (${e.file})  rank ${e.rank} · ${e.score.toLocaleString()}`);
    e.forms.forEach((f, i) => console.log(`  ${String(e.counts[i]).padStart(9)}  ${f}`));
  }
  console.log("");
}

// ── Report ────────────────────────────────────────────────────────────────
console.log(`top ${REPORT} by everyday usage:`);
for (const e of scored.slice(0, REPORT)) {
  console.log(`  ${String(e.rank).padStart(4)}  ${e.x.w.padEnd(24)} ${e.file.padEnd(8)} ${e.score.toLocaleString()}`);
}

console.log("\ncoverage (entries with a corpus signal):");
for (const file of FILES) {
  const rows = scored.filter((e) => e.file === file);
  const hit = rows.filter((e) => e.score > 0).length;
  const pct = rows.length ? Math.round((hit / rows.length) * 100) : 0;
  console.log(`  ${file.padEnd(8)} ${String(hit).padStart(5)}/${String(rows.length).padEnd(5)} ${pct}%`);
}
const blind = scored.filter((e) => e.score === 0);
if (blind.length) {
  console.log(`\n${blind.length} entr${blind.length === 1 ? "y" : "ies"} scored 0 — ranked last, in data order. First few:`);
  for (const e of blind.slice(0, 10)) console.log(`  ${e.file}: ${e.x.w}`);
}

// ── Write ─────────────────────────────────────────────────────────────────
if (DRY) {
  console.log("\n--dry-run: nothing written.");
  process.exit(0);
}

for (const e of scored) e.x.f = e.rank;
for (const file of FILES) {
  const path = join(DATA, `${file}.json`);
  writeFileSync(path, JSON.stringify(db[file], null, 1) + "\n");
}
console.log(`\nwrote f: 1…${scored.length} across ${FILES.length} files.`);
