#!/usr/bin/env node
// ── Cross-category deduplication ──────────────────────────────────────────
//
// 137 headwords existed in two or three data files at once — "und" in both
// gram.json and other.json, "sich duschen" in verbs.json and other.json,
// "spazieren gehen" in other.json and phrases.json.
//
// Progress is keyed `<categoryId>:<w>`, so a duplicate is two separate words
// to the app: it can be dealt twice in the same Mixed deck, mastering one copy
// leaves the other in the pool forever, and the Stats totals count it twice.
//
// Each word is kept in exactly one category, chosen by PRIORITY below. The
// order reflects which file actually describes the word:
//   • verbs   — has the full conjugation, so a reflexive verb belongs there,
//               not as a bare phrase in other.json
//   • gram    — has wt / st / ce (word type, subtype, case effect), so the
//               conjunctions, prepositions and da-words belong there; the
//               other.json copies carried coursebook-context glosses like
//               "here: from" that only make sense next to the original text
//   • adj     — real adjectives
//   • phrases — fixed expressions and Redemittel
//   • other   — the residual bucket, so it loses every contest
//
// Usage:
//   node scripts/dedupe-across-categories.mjs           # report
//   node scripts/dedupe-across-categories.mjs --apply   # write

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const APPLY = process.argv.includes("--apply");

const PRIORITY = ["verbs", "gram", "adj", "phrases", "other", "nouns", "chunks"];

// Genuine homographs: different word, same spelling. Both entries stay.
//   erfahren — verb "to find out" vs adjective "experienced"
const HOMOGRAPHS = new Set(["erfahren"]);

// chunks.json is the Chunks tab's own dataset, documented as "A2 upwards only;
// the truly basic A1 material lives in the word categories".
//
// A clash with a *structured* category (verbs, gram, adj, nouns) always goes to
// that category — it holds conjugations, case effects and declensions the chunk
// card cannot show. A clash with one of the loose buckets (phrases, other) is
// settled by level, following the rule above: A1 stays a word card, A2 and up
// becomes a chunk, where it gets the fuller bilingual example.
const LOOSE = new Set(["phrases", "other"]);
const lvlOf = (x) => x.lvl ?? x.lv ?? "A1";
function resolveChunkClash(wordCat, entries) {
  if (!LOOSE.has(wordCat)) return wordCat;
  return lvlOf(entries[wordCat]) === "A1" ? wordCat : "chunks";
}

const files = Object.fromEntries(
  PRIORITY.map((f) => [f, JSON.parse(readFileSync(join(ROOT, "public/data", `${f}.json`), "utf8"))])
);

// Where each headword appears, in priority order, and the entry itself so the
// chunk clash can be resolved by level.
const where = new Map();
const entryOf = new Map(); // word → { file: entry }
for (const f of PRIORITY) {
  for (const x of files[f]) {
    const k = x.w.trim();
    if (!where.has(k)) { where.set(k, []); entryOf.set(k, {}); }
    where.get(k).push(f);
    entryOf.get(k)[f] = x;
  }
}

const drop = {};   // file → Set of headwords to remove
for (const f of PRIORITY) drop[f] = new Set();

let dupes = 0;
for (const [w, present] of where) {
  if (present.length < 2 || HOMOGRAPHS.has(w)) continue;
  dupes++;
  let keep = present[0]; // already in priority order
  if (present.includes("chunks") && present.length === 2) {
    keep = resolveChunkClash(present.find((f) => f !== "chunks"), entryOf.get(w));
  }
  for (const f of present) if (f !== keep) drop[f].add(w);
  console.log(`${w.padEnd(26)} keep ${keep.padEnd(8)} drop ${present.filter((f) => f !== keep).join(", ")}`);
}

console.log(`\nduplicate headwords: ${dupes}`);
for (const f of PRIORITY) {
  if (!drop[f].size) continue;
  const before = files[f].length;
  const kept = files[f].filter((x) => !drop[f].has(x.w.trim()));
  console.log(`  ${f}.json: ${before} → ${kept.length} (−${before - kept.length})`);
  if (APPLY) writeFileSync(join(ROOT, "public/data", `${f}.json`), JSON.stringify(kept, null, 1) + "\n");
}

if (!APPLY) console.log("\n(dry run — pass --apply to write)");
