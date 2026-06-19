#!/usr/bin/env node
// ── German noun validator / enricher ──────────────────────────────────────
//
// Validates and corrects public/data/nouns.json against the German Wiktionary
// (de.wiktionary.org) — the authoritative, freely-queryable source of German
// nouns with their canonical gender (Genus) and plural (Nominativ Plural).
//
// What it does for every noun:
//   • confirms the word actually exists as a German *noun* (Substantiv).
//     Words with no German noun entry are hallucinations / mis-tagged
//     English words and are dropped.
//   • corrects the article (der/die/das) when Wiktionary disagrees.
//   • corrects / fills the plural from Wiktionary's Nominativ Plural.
//
// Usage:
//   node scripts/validate-nouns.mjs            # dry-run report only
//   node scripts/validate-nouns.mjs --apply    # rewrite nouns.json + dist copy
//
// Network results are cached in scripts/.cache/wiktionary.json so re-runs are
// cheap and the same data is reused across report / apply.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SOURCES = [
  join(ROOT, "public/data/nouns.json"),
  join(ROOT, "dist/data/nouns.json"),
];
const CACHE_FILE = join(__dirname, ".cache/wiktionary.json");
const APPLY = process.argv.includes("--apply");
const DROP_REVIEW = process.argv.includes("--drop-review");

// Curated removals: entries that aren't real German nouns (interjections,
// adjectives, misspellings, broken entries) or are made-up Denglish that no
// learner needs. Matched against the exact "w" field. Real loanwords
// (der Login, der/das Blog, die Salsa, …) are deliberately NOT here.
const CURATED_DROP = new Set([
  // junk / not a noun
  "Hi", "Hey", "Indisch", "die Stundentin", "die Nr. (= Nummer",
  "Wirklich?", "Wohin?",
  // made-up Denglish
  "das Ferienpark-WiFi", "das WIFI", "der Winter-Fan",
  "der Coworker", "die Coworkerin", "der Dance Contest",
  "das Hip Hop-Festival", "das Sprach-Tandem",
]);

// Curated article corrections for unambiguous data errors (e.g. "-in" nouns
// are always feminine). Other gender mismatches are only flagged, not changed.
const CURATED_ARTICLE = new Map([
  ["der Programmiererin", "die"],
]);

const API = "https://de.wiktionary.org/w/api.php";
const BATCH = 50; // titles per API request (MediaWiki cap is 50)
const GENUS_TO_ART = { m: "der", f: "die", n: "das" };

// ── helpers ────────────────────────────────────────────────────────────────

const lemmaOf = (entry) => {
  // strip a leading article from "w" to get the bare lemma Wiktionary indexes
  const w = (entry.w || "").trim();
  return w.replace(/^(der|die|das)\s+/i, "").trim();
};

function loadCache() {
  if (existsSync(CACHE_FILE)) return JSON.parse(readFileSync(CACHE_FILE, "utf8"));
  return {};
}
function saveCache(cache) {
  mkdirSync(dirname(CACHE_FILE), { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 0));
}

// Pull the {{Sprache|Deutsch}} section out of a Wiktionary page's wikitext.
function germanSection(content) {
  if (!content) return "";
  // level-2 headings look like:  == Wort ({{Sprache|Deutsch}}) ==
  const parts = content.split(/\n(?===[^=])/);
  for (const part of parts) {
    if (/^==[^\n]*\{\{Sprache\|Deutsch\}\}/.test(part)) return part;
  }
  // single-language pages sometimes have the marker without a clean split
  return /\{\{Sprache\|Deutsch\}\}/.test(content) ? content : "";
}

// Classify a Wiktionary page's German section. Returns:
//   { type: "noun", genera, plurals }  — a noun lemma (correctable)
//   { type: "declined" }               — a declined/plural form of a noun (keep)
//   { type: "other" }                  — German word but not a noun (trash)
//   { type: "no-german" }              — page exists, no German section (trash)
function parseNoun(content) {
  const de = germanSection(content);
  if (!de) return { type: "no-german" };

  // Anything Wiktionary tags as a noun-like part of speech is a real word we
  // keep: Substantiv, proper nouns / countries (Toponym, Eigenname, names),
  // plurale tantum (Substantiv, no Genus) and abbreviations (CD, WLAN, …).
  const isNoun =
    /\{\{Wortart\|(Substantiv|Nachname|Vorname|Toponym|Eigenname|Abkürzung|Kurzwort)\b/.test(de);
  if (!isNoun) {
    // declined / plural form pages still represent a real noun → keep
    if (/\{\{Wortart\|Deklinierte Form\|Deutsch\}\}/.test(de)) {
      return { type: "declined" };
    }
    return { type: "other" };
  }

  const genera = [];
  for (const m of de.matchAll(/\|\s*Genus(?:\s*\d+)?\s*=\s*([mfn])\b/g)) {
    if (!genera.includes(m[1])) genera.push(m[1]);
  }

  const plurals = [];
  for (const m of de.matchAll(/\|\s*Nominativ Plural(?:\s*\d+)?\s*=\s*([^\n|}]*)/g)) {
    const v = m[1].replace(/\*/g, "").trim();
    if (v && v !== "—" && v !== "-" && !plurals.includes(v)) plurals.push(v);
  }

  return { type: "noun", genera, plurals };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchBatch(titles, attempt = 0) {
  const url =
    `${API}?action=query&format=json&formatversion=2` +
    `&prop=revisions&rvprop=content&rvslots=main` +
    `&titles=${titles.map(encodeURIComponent).join("|")}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "learn-german-validator/1.0 (vocab cleanup)" },
  });
  if (res.status === 429 || res.status >= 500) {
    if (attempt >= 6) throw new Error(`HTTP ${res.status} after retries`);
    const wait = Math.min(2000 * 2 ** attempt, 30000);
    await sleep(wait);
    return fetchBatch(titles, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} for batch`);
  const data = await res.json();
  const out = {};
  for (const p of data?.query?.pages || []) {
    if (p.missing) {
      out[p.title] = { missing: true };
    } else {
      out[p.title] = {
        content: p.revisions?.[0]?.slots?.main?.content || "",
      };
    }
  }
  // map normalized titles back to what we asked for
  for (const n of data?.query?.normalized || []) {
    if (out[n.to]) out[n.from] = out[n.to];
  }
  return out;
}

// ── main ─────────────────────────────────────────────────────────────────

const nouns = JSON.parse(readFileSync(SOURCES[0], "utf8"));
const cache = loadCache();

// figure out which lemmas still need fetching
const lemmas = [...new Set(nouns.map(lemmaOf))];
const todo = lemmas.filter((l) => !(l in cache));
console.log(`${nouns.length} nouns · ${lemmas.length} unique lemmas · ${todo.length} to fetch`);

for (let i = 0; i < todo.length; i += BATCH) {
  const batch = todo.slice(i, i + BATCH);
  process.stdout.write(`  fetching ${i + 1}-${i + batch.length}/${todo.length}\r`);
  try {
    const got = await fetchBatch(batch);
    for (const t of batch) cache[t] = got[t] || { missing: true };
  } catch (e) {
    console.error(`\n  batch failed (${e.message}); will retry next run`);
  }
  saveCache(cache);
  await sleep(700); // be polite to the API between batches
}
console.log("\nfetch complete\n");

// Build the set of confirmed German noun lemmas + their gender, so we can
// rescue legit compounds (e.g. "Italienischkurs" → ends in confirmed "Kurs").
const confirmed = new Map(); // lowercase lemma → first gender letter
for (const entry of nouns) {
  const raw = cache[lemmaOf(entry)];
  if (!raw || raw.missing) continue;
  const p = parseNoun(raw.content);
  if (p.type === "noun") confirmed.set(lemmaOf(entry).toLowerCase(), p.genera[0]);
}
// also seed with common heads that may not appear as standalone entries
const compoundHead = (lemma) => {
  const low = lemma.toLowerCase();
  for (const [head, g] of confirmed) {
    if (head.length >= 4 && low.length > head.length && low.endsWith(head)) {
      return g; // gender of a compound = gender of its last element
    }
  }
  return null;
};

const removed = [];   // high-confidence trash (page exists, not a noun)
const review = [];    // pageless + not a recognisable compound — needs a human
const genderFixes = [];
const pluralFixes = [];
const unverified = []; // kept, but gender couldn't be confirmed

const kept = [];
for (const entry of nouns) {
  const lemma = lemmaOf(entry);

  // Curated removals first — explicit, reviewed by a human.
  if (CURATED_DROP.has(entry.w)) {
    removed.push({ ...entry, _reason: "curated removal" });
    continue;
  }

  const raw = cache[lemma];
  const multiword = /\s/.test(lemma); // phrases like "die sozialen Medien"

  // No page at all: rescue plausible compounds, else send to review.
  if (!raw || raw.missing) {
    if (!multiword && compoundHead(lemma)) {
      kept.push({ ...entry });
    } else {
      review.push({ ...entry, _reason: multiword ? "multi-word phrase" : "no Wiktionary page" });
    }
    continue;
  }

  const parsed = parseNoun(raw.content);

  // Page exists but isn't a noun → genuine trash (articles, adjectives, …).
  if (parsed.type === "other" || parsed.type === "no-german") {
    removed.push({ ...entry, _reason: parsed.type === "other" ? "not a German noun" : "no German entry" });
    continue;
  }
  // Declined/plural form of a real noun → keep as-is.
  if (parsed.type === "declined") {
    kept.push({ ...entry });
    continue;
  }

  const next = { ...entry };

  // curated article fix overrides everything
  if (CURATED_ARTICLE.has(entry.w)) {
    const correct = CURATED_ARTICLE.get(entry.w);
    genderFixes.push({ w: entry.w, was: entry.a, now: `${correct} (fixed)` });
    next.a = correct;
    next.w = `${correct} ${lemma}`;
    kept.push(next);
    continue;
  }

  // article: gender data in the DB is essentially sound and the few Wiktionary
  // disagreements are ambiguous (adjectival nouns valid in both genders, the
  // neuter continent "Europa" vs the feminine myth, …). So we only *flag*
  // single-gender mismatches for a human rather than auto-rewriting them.
  if (parsed.genera.length && entry.a) {
    const allowed = parsed.genera.map((g) => GENUS_TO_ART[g]);
    if (!allowed.includes(entry.a)) {
      genderFixes.push({ w: entry.w, was: entry.a, now: allowed.join("/") });
    }
  }

  // plural: only auto-fix *corrupted* values — text from example sentences has
  // bled into some plural fields ("die FotoapparateIch", "die anrufen",
  // "die das"). Legit differences (Sportarten vs Sporte, Stockwerke vs Stöcke)
  // are just flagged. Deliberate "(kein Plural)" annotations are left alone.
  const curRaw = (entry.p || "").trim();
  const isAnnotation = curRaw === "" || /^\(|kein|immer|Plural/i.test(curRaw);
  const curPl = curRaw.replace(/^(der|die|das)\s+/i, "").trim();
  const corrupted =
    !isAnnotation && curPl &&
    (/[a-zäöüß][A-ZÄÖÜ]/.test(curPl) ||           // camelCase intrusion
      /^[a-zäöüß]/.test(curPl) ||                  // German nouns are capitalised
      /\s/.test(curPl));                           // stray words glued on
  if (parsed.plurals.length && !isAnnotation && !parsed.plurals.includes(curPl)) {
    const correct = `die ${parsed.plurals[0]}`;
    if (corrupted) {
      pluralFixes.push({ w: entry.w, was: entry.p, now: correct });
      next.p = correct;
    } else {
      unverified.push({ w: entry.w, why: `plural ${entry.p} ≠ Wiktionary ${correct}` });
    }
  } else if (corrupted) {
    // corrupted and Wiktionary has no plural → reset to empty
    pluralFixes.push({ w: entry.w, was: entry.p, now: "" });
    next.p = "";
  }
  kept.push(next);
}

// ── report ─────────────────────────────────────────────────────────────────

console.log(`KEEP       ${kept.length}`);
console.log(`REMOVE     ${removed.length}  (page exists but is not a German noun)`);
console.log(`REVIEW     ${review.length}  (no page / phrase — ${DROP_REVIEW ? "DROPPED" : "kept"} on --apply)`);
console.log(`gender Δ   ${genderFixes.length}`);
console.log(`plural Δ   ${pluralFixes.length}`);
console.log(`unverified ${unverified.length}  (kept)\n`);

const show = (title, arr, fmt) => {
  console.log(`── ${title} (${arr.length}) ──`);
  arr.forEach((x) => console.log("  " + fmt(x)));
  console.log("");
};
show("REMOVED", removed, (x) => `${x.w}  [${x.lvl}] — ${x.e}  (${x._reason})`);
show("NEEDS REVIEW", review, (x) => `${x.w}  [${x.lvl}] — ${x.e}  (${x._reason})`);
show("GENDER FIXES", genderFixes, (x) => `${x.w}: ${x.was} → ${x.now}`);
show("PLURAL FIXES", pluralFixes, (x) => `${x.w}: ${x.was} → ${x.now}`);

// Persist the full report so it can be inspected outside the terminal.
writeFileSync(
  join(__dirname, ".cache/report.json"),
  JSON.stringify({ removed, review, genderFixes, pluralFixes, unverified }, null, 2)
);

if (APPLY) {
  // review items (valid-but-unverifiable compounds) are kept by default;
  // pass --drop-review to also strip them.
  const final = DROP_REVIEW
    ? kept
    : [...kept, ...review.map(({ _reason, ...e }) => e)];
  for (const f of SOURCES) {
    if (existsSync(f)) writeFileSync(f, JSON.stringify(final, null, 2) + "\n");
  }
  console.log(`APPLIED → wrote ${final.length} nouns to ${SOURCES.length} file(s)`);
} else {
  console.log("dry run — re-run with --apply to write changes");
}
