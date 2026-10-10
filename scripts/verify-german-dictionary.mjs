#!/usr/bin/env node
// Verify the German wordbank against LEO (dict.leo.org) and dict.cc.
//
// For every entry the headword is looked up on both sites. Nouns are checked
// for article and plural, verbs for Präteritum and Partizip II, adjectives for
// comparative and superlative, and every entry's English gloss is compared
// with the translations the dictionaries list.
//
// Setup (once): both sites reject Node's TLS fingerprint (LEO answers 403 from
// Cloudflare, dict.cc truncates results to 3 rows), so requests go through a
// small Python helper that uses curl_cffi to look like a browser:
//   python3 -m venv ~/.venvs/dict && ~/.venvs/dict/bin/pip install curl_cffi
//   export DICT_PYTHON=~/.venvs/dict/bin/python
//
// Usage:
//   node scripts/verify-german-dictionary.mjs               # dry run, all word files
//   node scripts/verify-german-dictionary.mjs --apply       # write two-source-backed fixes
//   node scripts/verify-german-dictionary.mjs --file nouns  # one file (also: phrases, chunks)
//   node scripts/verify-german-dictionary.mjs --limit 50    # first N entries per file
//   node scripts/verify-german-dictionary.mjs --only "die Band,gehen"  # just these headwords
//   node scripts/verify-german-dictionary.mjs --refresh     # ignore the cache
//   (dict.cc: --delay ms between requests per lane, default 500, --lanes default 2;
//    LEO: --leo-delay ms, default 5000, one lane — LEO's published long-term limit)
//   node scripts/verify-german-dictionary.mjs --offline     # cache only, no network
//   node scripts/verify-german-dictionary.mjs --budget 600  # stop fetching after N seconds;
//                                                           # rerun to resume from the cache
//
// What --apply changes (never anything else):
//   - noun article, when LEO and dict.cc each list exactly one gender for the
//     word, agree, and the stored article is not it;
//   - noun plural, when the stored plural is listed by neither site and both
//     sites give the same single plural for the stored article;
//   - verb Partizip II (and the Perfekt forms built from it), when both sites
//     agree and the stored participle is listed by neither.
// Entries are never removed: compounds and proper names are legitimately
// absent from dictionaries, so "not found" is only reported for review.
// A lookup that errors, times out or is blocked counts as unknown, not missing.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA = join(ROOT, "public", "data");
const CACHE_DIR = join(__dirname, ".cache");
const CACHE_FILE = join(CACHE_DIR, "dictionary-cache-v4.json");
const REPORT_FILE = join(CACHE_DIR, "dictionary-report.json");
const SUMMARY_FILE = join(CACHE_DIR, "dictionary-report.md");
const HELPER = join(__dirname, "lib", "dict_fetch.py");
const WORD_FILES = ["nouns", "verbs", "adj", "other", "gram"];
const ALL_FILES = [...WORD_FILES, "phrases", "chunks"];

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d = null) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1] ?? d; };
const APPLY = flag("--apply");
const REFRESH = flag("--refresh");
const OFFLINE = flag("--offline");
const LIMIT = Number(opt("--limit", "0")) || 0;
const ONLY = opt("--only") ? new Set(opt("--only").split(",").map((w) => w.trim())) : null;
const BUDGET_S = Number(opt("--budget", "0")) || 0;
const DEADLINE = BUDGET_S ? Date.now() + BUDGET_S * 1000 : Infinity;
const SKIP = new Set((opt("--skip") ?? "").split(",").filter(Boolean)); // e.g. --skip leo while LEO is rate-limiting
const LANES_DEFAULT = Math.min(4, Math.max(1, Number(opt("--lanes", "2")) || 2));
const DELAY_MS = Math.max(300, Number(opt("--delay", "500")) || 500);
const files = opt("--file") ? [opt("--file")] : WORD_FILES;
if (files.some((f) => !ALL_FILES.includes(f))) {
  console.error(`Unknown --file. Choose one of: ${ALL_FILES.join(", ")}`);
  process.exit(2);
}

// ---------- text helpers ----------
const ARTICLE = /^(?:der|die|das)(?:\s*\/\s*(?:der|die|das))*\s+/i;
const articlesOf = (s) => (String(s).match(ARTICLE)?.[0] ?? "").toLowerCase().match(/der|die|das/g) ?? [];
const decode = (s) => String(s)
  .replace(/&nbsp;|&#160;|&#xa0;/gi, " ").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, "&");
// Tags are dropped without inserting spaces: LEO wraps the searched part of a
// form in <b> ("ge<b>laufen</b>"), and both sites put real spaces between words.
const text = (html) => decode(String(html).replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
const norm = (s) => String(s ?? "").normalize("NFC").toLocaleLowerCase("de-DE")
  .replace(/[’‘`]/g, "'").replace(/[^\p{L}\p{N}']+/gu, " ").trim();
const same = (a, b) => norm(a) === norm(b);
const stripArticle = (s) => String(s).trim().replace(ARTICLE, "");
const stripSich = (s) => String(s).trim().replace(/^sich\s+/i, "").replace(/\s+sich$/i, "");

// The query sent to the dictionaries: the headword without article, trailing
// punctuation, ellipses or slash alternatives.
function queryFor(entry) {
  let w = String(entry.w ?? "").trim();
  w = w.split(/\s*\/\s*/)[0].split(/,\s+/)[0];
  w = w.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\(([^)]*)\)/g, "");
  w = w.replace(ARTICLE, "").replace(/^sich\s+/i, "").replace(/[!?.…]+$/u, "").replace(/\s*…\s*/gu, " ").trim();
  return w.replace(/\s+/g, " ");
}
function matchesQuery(candidate, query) {
  const c = stripArticle(candidate);
  return same(c, query) || same(stripSich(c), stripSich(query));
}

// ---------- fetching through the curl_cffi helper ----------
function pythonCandidates() {
  return [process.env.DICT_PYTHON, join(__dirname, ".venv", "bin", "python"),
    join(homedir(), ".venvs", "dict", "bin", "python"), "python3"].filter(Boolean);
}
class Fetcher {
  static async start() {
    for (const py of pythonCandidates()) {
      if (py.includes("/") && !existsSync(py)) continue;
      const f = new Fetcher(py);
      if (await f.ready) return f;
      f.close();
    }
    throw new Error("No Python with curl_cffi found. Install it (see the header of this script) and set DICT_PYTHON.");
  }
  constructor(py) {
    this.next = 0; this.waiting = new Map();
    this.proc = spawn(py, [HELPER], { stdio: ["pipe", "pipe", "ignore"] });
    let readyResolve; this.ready = new Promise((r) => { readyResolve = r; });
    this.proc.on("error", () => readyResolve(false));
    this.proc.on("exit", () => { readyResolve(false); for (const r of this.waiting.values()) r({ error: "helper exited" }); this.waiting.clear(); });
    createInterface({ input: this.proc.stdout }).on("line", (line) => {
      let msg; try { msg = JSON.parse(line); } catch { return; }
      if (msg.ready) return readyResolve(true);
      if (msg.fatal) return readyResolve(false);
      const r = this.waiting.get(msg.id); this.waiting.delete(msg.id); r?.(msg);
    });
  }
  get(url) {
    const id = ++this.next;
    return new Promise((resolve) => { this.waiting.set(id, resolve); this.proc.stdin.write(JSON.stringify({ id, url }) + "\n"); });
  }
  close() { try { this.proc.stdin.end(); this.proc.kill(); } catch { /* already gone */ } }
}

// ---------- LEO (XML API behind the website) ----------
function parseLeo(xml, query) {
  if (!/<xml\b[^>]*lp="ende"/.test(xml)) return { status: "unknown", note: "not a LEO result document" };
  const nouns = [], verbs = [], english = new Set();
  let exact = false;
  for (const [, body] of xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/g)) {
    const de = body.match(/<side\b[^>]*lang="de"[^>]*>([\s\S]*?)<\/side>/)?.[1] ?? "";
    const en = body.match(/<side\b[^>]*lang="en"[^>]*>([\s\S]*?)<\/side>/)?.[1] ?? "";
    const words = [...de.matchAll(/<word>([\s\S]*?)<\/word>/g)].map((m) => decode(m[1]).trim());
    const hit = words[0] && matchesQuery(words[0], query) ? words[0] : null;
    if (!hit) continue;
    exact = true;
    for (const m of en.matchAll(/<word>([\s\S]*?)<\/word>/g)) english.add(decode(m[1]).trim());
    const type = body.match(/<category type="([^"]+)"/)?.[1] ?? "";
    const repr = text(de.match(/<repr\b[^>]*>([\s\S]*?)<\/repr>/)?.[1] ?? "");
    const articles = articlesOf(hit);
    if (articles.length && (type === "noun" || !type)) {
      const pl = repr.match(/Pl\.:\s*([^|]+?)(?:\s+-\s|\s{2,}|$)/)?.[1] ?? "";
      const plurals = /kein Pl/i.test(repr) ? [] : pl.split(/\s*,\s*|\s+or\s+|\s*\/\s*/)
        .map((p) => p.replace(ARTICLE, "").trim()).filter((p) => /^[\p{L}-]+$/u.test(p));
      for (const article of articles) nouns.push({ article, plurals });
    }
    const vf = repr.match(/\|\s*([^|,]+?),\s*([^|]+?)\s*\|/);
    if (vf) verbs.push({ preterite: vf[1].split(/\s*\/\s*/), participle: vf[2].split(/\s*\/\s*/) });
  }
  return exact ? { status: "found", nouns, verbs, adjectives: [], english: [...english] }
    : { status: "missing", note: "no exact German entry in LEO's result list" };
}
const leo = {
  id: "leo",
  url: (q) => `https://dict.leo.org/dictQuery/m-vocab/ende/query.xml?tolerMode=nof&lp=ende&lang=en&rmWords=off&rmSearch=on&search=${encodeURIComponent(q)}&searchLoc=0&resultOrder=basic&multiwordShowSingle=on&sectLenMax=16`,
  parse: parseLeo,
  // LEO publishes its limits in the 429 body: 1.5 req/s short-term, 0.2 req/s
  // long-term. Default to the long-term rate; a full fresh run takes hours, so
  // rely on the cache (60 days) and --budget to spread it across sessions.
  delay: () => Number(opt("--leo-delay", "5000")) || 5000,
  lanes: 1,
};

// ---------- dict.cc (HTML) ----------
function parseDictcc(html, query) {
  if (!/dict\.cc/i.test(html) || !/<html/i.test(html)) return { status: "unknown", note: "not a dict.cc page" };
  if (/limited result set/i.test(html)) return { status: "unknown", note: "dict.cc served the truncated bot view" };
  const nouns = [], verbs = [], adjectives = [], english = new Set();
  let exact = false;
  for (const [, row] of html.matchAll(/<tr id='tr\d+'[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...row.matchAll(/<td class="td7nl"[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
    if (cells.length < 2) continue;
    const deHtml = cells[1].replace(/<div style="float:right[^>]*>[\s\S]*?<\/div>/, "");
    const genders = [...deHtml.matchAll(/<var[^>]*>\{(m|f|n|pl)\}<\/var>|\{(m|f|n|pl)\}/g)].map((m) => m[1] ?? m[2]);
    const de = text(deHtml).replace(/\{[^}]*\}|\[[^\]]*\]|<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (!matchesQuery(de, query)) continue;
    exact = true;
    english.add(text(cells[0]).replace(/\{[^}]*\}|\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim());
    for (const g of genders) if (g !== "pl") nouns.push({ article: { m: "der", f: "die", n: "das" }[g], plurals: null });
  }
  // Inflection summary rows: "das Haus | die Häuser", "gehen | ging | gegangen", "schnell | schneller | am schnellsten".
  for (const [, kind, body] of html.matchAll(/<b[^>]*>(NOUN|VERB|ADJ)<\/b>[\s\S]*?<td width="95%"\s*>([\s\S]*?)<\/td>/g)) {
    const parts = text(body.replace(/<a href="javascript[\s\S]*$/, "")).replace(/\bedit\b.*$/, "")
      .replace(/\[[^\]]*\]/g, " ").split("|").map((p) => p.replace(/\s+/g, " ").trim());
    const alts = (p) => (p ?? "").split(/\s*\/\s*/).map((x) => x.trim()).filter((x) => x && x !== "-");
    const words = (p) => alts(p).map(stripArticle).filter((x) => /^[\p{L}-]+$/u.test(x));
    if (kind === "NOUN" && ARTICLE.test(parts[0]) && matchesQuery(parts[0], query)) {
      for (const article of articlesOf(parts[0])) nouns.push({ article, plurals: words(parts[1]) });
    } else if (kind === "VERB" && !/^to\s/i.test(parts[0]) && matchesQuery(parts[0], query) && parts.length >= 3) {
      verbs.push({ preterite: alts(parts[1]), participle: alts(parts[2]) });
    } else if (kind === "ADJ" && /^am\s/i.test(parts[2] ?? "") && matchesQuery(parts[0], query)) {
      adjectives.push({ comparative: words(parts[1]), superlative: [...parts[2].matchAll(/\bam\s+([\p{L}-]+)/gu)].map((m) => m[1]) });
    }
  }
  if (exact || nouns.length || verbs.length || adjectives.length) return { status: "found", nouns, verbs, adjectives, english: [...english] };
  if (/No entries found|no translations found/i.test(html)) return { status: "missing", note: "dict.cc: no entries found" };
  return { status: "missing", note: "no exact German row in dict.cc's results" };
}
const dictcc = {
  id: "dictcc", url: (q) => `https://www.dict.cc/?s=${encodeURIComponent(q)}`, parse: parseDictcc,
  // dict.cc answers multi-word queries with a "bot check" 403; those stay inconclusive.
  delay: () => DELAY_MS, lanes: LANES_DEFAULT,
};
const SOURCES = [leo, dictcc];

// ---------- cache ----------
mkdirSync(CACHE_DIR, { recursive: true });
let cache = {};
try { cache = JSON.parse(readFileSync(CACHE_FILE, "utf8")); } catch { /* first run */ }
const saveCache = () => writeFileSync(CACHE_FILE, JSON.stringify(cache) + "\n");
// Keep finished lookups if the run is interrupted; the next run resumes from the cache.
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { saveCache(); process.exit(130); });
const MAX_AGE = 60 * 24 * 3600 * 1000;

// ---------- load entries ----------
const datasets = Object.fromEntries(files.map((f) => [f, JSON.parse(readFileSync(join(DATA, `${f}.json`), "utf8"))]));
const entries = [];
for (const f of files) for (const entry of LIMIT ? datasets[f].slice(0, LIMIT) : datasets[f]) if (!ONLY || ONLY.has(entry.w)) entries.push({ file: f, entry, query: queryFor(entry) });
const queries = [...new Set(entries.map((e) => e.query).filter(Boolean))];

// ---------- run lookups: one queue per source, the two sources in parallel ----------
const results = new Map(queries.map((q) => [q, {}]));
const fetchers = [];

let done = 0;
async function runLane(source, lane) {
  let fetcher = null;
  for (let i = lane; i < queries.length; i += source.lanes) {
    const q = queries[i];
    const key = `${source.id}:${q}`;
    const hit = cache[key];
    if (hit && !REFRESH && Date.now() - hit.at < MAX_AGE) { results.get(q)[source.id] = hit.r; continue; }
    if (OFFLINE || SKIP.has(source.id) || Date.now() > DEADLINE) { results.get(q)[source.id] = { status: "unknown", note: Date.now() > DEADLINE ? "time budget used up" : "not cached (source offline or skipped)" }; continue; }
    if (!fetcher) { fetcher = await Fetcher.start(); fetchers.push(fetcher); }
    let r;
    for (let attempt = 0; attempt < 3; attempt++) {
      await new Promise((res) => setTimeout(res, source.delay() * (attempt + 1)));
      if (Date.now() > DEADLINE) { r = { status: "unknown", note: "time budget used up" }; break; }
      const resp = await fetcher.get(source.url(q));
      if (resp.status === 429) { r = { status: "unknown", note: "HTTP 429 rate limited" }; await new Promise((res) => setTimeout(res, Math.max(0, Math.min(30000, DEADLINE - Date.now())))); continue; }
      if (resp.error) r = { status: "unknown", note: resp.error };
      else if (resp.status !== 200) r = { status: "unknown", note: `HTTP ${resp.status}` };
      else r = source.parse(resp.text, q);
      if (r.status !== "unknown") break;
    }
    results.get(q)[source.id] = r;
    if (r.status !== "unknown") cache[key] = { at: Date.now(), r };
    if (++done % 20 === 0) saveCache();
    if (done % 200 === 0) console.log(`fetched ${done} pages`);
  }
}
const runSource = (source) => Promise.all(Array.from({ length: source.lanes }, (_, lane) => runLane(source, lane)));
try {
  await Promise.all(SOURCES.map(runSource));
} finally {
  fetchers.forEach((f) => f.close());
  saveCache();
}

// ---------- compare ----------
const lowerSet = (xs) => new Set(xs.map((x) => norm(x)));
const sourcesWith = (res, pick) => SOURCES.map((s) => res[s.id]).filter((r) => r?.status === "found" && pick(r).length);
const report = [];
const fixes = [];
for (const { file, entry, query } of entries) {
  const res = results.get(query) ?? {};
  const statuses = SOURCES.map((s) => res[s.id]?.status ?? "unknown");
  const status = statuses.includes("found") ? "found" : statuses.every((s) => s === "missing") ? "missing" : "unknown";
  const issues = [];

  if (file === "nouns" && status === "found" && entry.a) {
    const per = sourcesWith(res, (r) => r.nouns).map((r) => new Set(r.nouns.map((n) => n.article)));
    const union = new Set(per.flatMap((s) => [...s]));
    if (union.size && !union.has(entry.a)) {
      const agreed = per.length === 2 && per.every((s) => s.size === 1) && [...per[0]][0] === [...per[1]][0] ? [...per[0]][0] : null;
      issues.push({ field: "a", stored: entry.a, dictionary: [...union], fix: agreed });
    }
    const stored = String(entry.p ?? "").replace(ARTICLE, "").trim();
    const plSets = sourcesWith(res, (r) => r.nouns.filter((n) => n.article === entry.a && n.plurals?.length))
      .map((r) => r.nouns.filter((n) => n.article === entry.a && n.plurals?.length).flatMap((n) => n.plurals));
    const plUnion = [...new Map(plSets.flat().map((p) => [norm(p), p])).values()];
    if (/^[\p{L}-]+$/u.test(stored) && plUnion.length && !lowerSet(plUnion).has(norm(stored))) {
      const agreed = plSets.length === 2 && plSets.every((s) => lowerSet(s).size === 1) && same(plSets[0][0], plSets[1][0]) ? plSets[0][0] : null;
      issues.push({ field: "p", stored: entry.p, dictionary: plUnion.map((p) => `die ${p}`), fix: agreed ? `die ${agreed}` : null });
    }
  }
  if (file === "verbs" && status === "found") {
    for (const [field, key, storedVal] of [["p2", "participle", entry.p2], ["pt.ich", "preterite", entry.pt?.ich]]) {
      if (!storedVal) continue;
      const sets = sourcesWith(res, (r) => r.verbs).map((r) => r.verbs.flatMap((v) => v[key]));
      const union = [...new Map(sets.flat().map((p) => [norm(p), p])).values()];
      // Reflexive verbs: the data stores "erkundigte mich", the dictionaries "erkundigte sich" / "sich erkundigte".
      const canon = (x) => norm(String(x).replace(/(^|\s)(sich|mich|dich|uns|euch)(?=\s|$)/gi, " "));
      if (!union.length || new Set(union.map(canon)).has(canon(storedVal))) continue;
      const both = sets.length === 2 ? sets[0].filter((x) => new Set(sets[1].map(canon)).has(canon(x))) : [];
      const agreed = field === "p2" && new Set(both.map(canon)).size === 1 ? both[0].replace(/(^|\s)sich(?=\s|$)/gi, " ").trim() : null;
      issues.push({ field, stored: storedVal, dictionary: union, fix: agreed });
    }
  }
  if (file === "adj" && status === "found" && /^[\p{L}-]+$/u.test(entry.cmp ?? "")) {
    const a = sourcesWith(res, (r) => r.adjectives).flatMap((r) => r.adjectives);
    const cmp = a.flatMap((x) => x.comparative), sup = a.flatMap((x) => x.superlative);
    if (cmp.length && !lowerSet(cmp).has(norm(entry.cmp))) issues.push({ field: "cmp", stored: entry.cmp, dictionary: cmp, fix: null });
    const storedSup = String(entry.sup ?? "").replace(/^am\s+/i, "");
    if (sup.length && storedSup && !lowerSet(sup).has(norm(storedSup))) issues.push({ field: "sup", stored: entry.sup, dictionary: sup.map((s) => `am ${s}`), fix: null });
  }
  let gloss = null;
  if (status === "found" && entry.e) {
    const english = SOURCES.flatMap((s) => res[s.id]?.english ?? []).map(norm).join(" | ");
    const variants = String(entry.e).split(/[;/,]|\(|\)/).map((g) => norm(g.replace(/^to\s+/i, ""))).filter((g) => g.length > 1);
    gloss = variants.some((g) => english.includes(g)) ? "confirmed" : "unconfirmed";
  }
  report.push({ file, w: entry.w, query, status, sources: Object.fromEntries(SOURCES.map((s) => [s.id, res[s.id]?.status ?? "unknown"])), gloss, issues });
  for (const i of issues) if (i.fix) fixes.push({ file, w: entry.w, ...i });
}

// ---------- apply ----------
if (APPLY && fixes.length) {
  for (const f of files) {
    let changed = 0;
    datasets[f] = datasets[f].map((entry) => {
      const mine = fixes.filter((x) => x.file === f && x.w === entry.w);
      if (!mine.length) return entry;
      const e = structuredClone(entry);
      for (const fx of mine) {
        if (fx.field === "a") { e.a = fx.fix; e.w = e.w.replace(/^(der|die|das)\s+/i, `${fx.fix} `); }
        if (fx.field === "p") e.p = fx.fix;
        if (fx.field === "p2") {
          const old = e.p2; e.p2 = fx.fix;
          for (const k of Object.keys(e.pk ?? {})) e.pk[k] = e.pk[k].replace(old, fx.fix);
        }
      }
      changed++; return e;
    });
    if (changed) { writeFileSync(join(DATA, `${f}.json`), JSON.stringify(datasets[f], null, 1) + "\n"); console.log(`${f}.json: ${changed} entr${changed === 1 ? "y" : "ies"} corrected`); }
  }
}

// ---------- report ----------
const count = (s) => report.filter((r) => r.status === s).length;
const reviews = report.filter((r) => r.issues.some((i) => !i.fix));
const missing = report.filter((r) => r.status === "missing");
const unknown = report.filter((r) => r.status === "unknown");
writeFileSync(REPORT_FILE, JSON.stringify({ generatedAt: new Date().toISOString(), files, apply: APPLY, fixes, entries: report }, null, 1) + "\n");
const line = (r) => `- ${r.file}: **${r.w}**` + (r.issues.length ? " — " + r.issues.map((i) => `${i.field}: ${i.stored} → ${i.fix ?? i.dictionary.join(" / ")}`).join("; ") : "");
writeFileSync(SUMMARY_FILE, [
  `# Dictionary verification (${new Date().toISOString().slice(0, 10)})`, "",
  `Entries: ${report.length} · found ${count("found")} · not in LEO or dict.cc ${count("missing")} · inconclusive ${count("unknown")}`,
  `Two-source fixes ${APPLY ? "applied" : "available (dry run)"}: ${fixes.length}`, "",
  "## Fixes", ...fixes.map((x) => `- ${x.file}: **${x.w}** — ${x.field}: ${x.stored} → ${x.fix}`), "",
  "## Needs review (sources disagree with the stored form, no two-source consensus)", ...reviews.map(line), "",
  "## Not found in either dictionary", ...missing.map(line), "",
  "## Inconclusive lookups", ...unknown.map((r) => `- ${r.file}: ${r.w} (${Object.entries(r.sources).map(([k, v]) => `${k} ${v}`).join(", ")})`), "",
  `## Glosses not matched by either dictionary: ${report.filter((r) => r.gloss === "unconfirmed").length} (see dictionary-report.json)`,
].join("\n") + "\n");

console.log(`\n${report.length} entries · ${count("found")} found · ${count("missing")} in neither dictionary · ${count("unknown")} inconclusive`);
console.log(`${fixes.length} two-source fixes${APPLY ? " applied" : " (dry run, pass --apply)"} · ${reviews.length} entries need review`);
console.log(`report: ${SUMMARY_FILE}`);
