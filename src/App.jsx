import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { DB } from "./data/db";
import { storage } from "./storage";
import { speak } from "./speak";
import { buildBackup, parseBackup, shareOrDownloadBackup, copyBackup } from "./backup";
import * as drive from "./driveSync";

/* ============================================================
   DEUTSCH MEISTER
   ------------------------------------------------------------
   HOW TO EXTEND (no engine changes needed):
   • Add words  → push objects into the relevant DB array.
                  Tag an entry with  lv:"A2"  to assign a level
                  (entries with no `lv` default to "A1").
   • Add a level → just use lv:"A2" / "B1" on entries, then add
                  the code to LEVELS below. The level filter and
                  stats pick it up automatically.
   • Add a category → push one descriptor into CATEGORIES.
                  Declare its fields, color, catOf(), modes[] and
                  a detail renderer. The quiz/browse/stats engine
                  is generic and needs no edits.
   Schemas (compact keys, kept from the original data):
     noun {w,a,e,c,p,ex,n}   verb {w,e,t,p2,hs,pr,pt,pk}
     adj  {w,e,c,cmp,sup,opp,ex}   gram {w,e,wt,st,ce,ex,mh}
   ============================================================ */


// ── Levels (scaffold — current data is all A1) ───────────────
const LEVELS = ["A1", "A2", "B1"];
const lvlOf = (item) => item.lv || "A1";

// ── Storage (versioned, migrates v1, supports reset) ─────────
const STORE_KEY = "dm-progress-v2";
const LEGACY_KEY = "dm-progress-v1";

async function loadProgress() {
  try {
    const r = await storage.get(STORE_KEY);
    if (r && r.value) return JSON.parse(r.value);
  } catch { }
  try {
    const old = await storage.get(LEGACY_KEY);
    if (old && old.value) {
      const data = JSON.parse(old.value);
      await storage.set(STORE_KEY, JSON.stringify(data));
      return data;
    }
  } catch { }
  return {};
}
async function saveProgress(p) {
  try { await storage.set(STORE_KEY, JSON.stringify(p)); } catch { }
}
async function clearProgress() {
  try { await storage.delete(STORE_KEY); } catch { }
  try { await storage.delete(LEGACY_KEY); } catch { }
}

// ── Helpers ──────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function distractors(pool, correct, accessor, n = 3) {
  const get = typeof accessor === "function" ? accessor : (x) => x[accessor];
  const seen = new Set([correct]);
  const out = [];
  for (const it of shuffle(pool)) {
    const v = get(it);
    if (v && !seen.has(v) && String(v).trim() !== "" && v !== "–") {
      seen.add(v);
      out.push(v);
      if (out.length >= n) break;
    }
  }
  return out;
}

function mcq(prompt, sub, answer, options) {
  return { prompt, sub, answer, options: shuffle([...new Set([answer, ...options])]).filter(Boolean) };
}


// ── Detail renderers (card backs) ─────────────────────────────
const TXT = "#e2e8f0", MUTE = "#8b94a3", FAINT = "#5b626f";

function VerbTable({ v }) {
  const rows = [
    ["ich", v.pr.ich, v.pt.ich, v.pk.ich],
    ["du", v.pr.du, v.pt.du, v.pk.du],
    ["er/sie/es", v.pr.er, v.pt.er, v.pk.er],
    ["wir", v.pr.wir, v.pt.wir, v.pk.wir],
    ["ihr", v.pr.ihr, v.pt.ihr, v.pk.ihr],
    ["sie/Sie", v.pr.sie, "", v.pk.sie],
  ];
  return (
    <div style={{ overflowX: "auto", marginTop: 12 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr>
            {["", "Präsens", "Präteritum", "Perfekt"].map((h) => (
              <th key={h} style={{ padding: "4px 8px", textAlign: "left", color: MUTE, fontWeight: 600, borderBottom: "1px solid #333", whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([p, pr, pt, pk]) => (
            <tr key={p}>
              <td style={{ padding: "3px 8px", color: MUTE, fontStyle: "italic", whiteSpace: "nowrap" }}>{p}</td>
              <td style={{ padding: "3px 8px", color: TXT }}>{pr}</td>
              <td style={{ padding: "3px 8px", color: TXT }}>{pt}</td>
              <td style={{ padding: "3px 8px", color: TXT, whiteSpace: "nowrap" }}>{pk}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 8, fontSize: 12.5, color: MUTE }}>
        Partizip II: <span style={{ color: TXT, fontWeight: 600 }}>{v.p2}</span>
        {"  ·  "}Perfekt mit: <span style={{ color: v.hs === "sein" ? "#f97316" : "#3b82f6", fontWeight: 700 }}>{v.hs}</span>
        {"  ·  "}<span style={{ color: FAINT }}>{({ irr: "irregular", mix: "mixed", reg: "regular" })[v.t]}</span>
      </div>
    </div>
  );
}

// Gender-by-suffix hints (from the A1 checkpoints + standard rules)
const GENDER_RULES = [
  { re: /(ung|heit|keit|schaft|ion|tät|ik|enz|anz|ie)$/i, art: "die", label: "-" },
  { re: /(chen|lein|ment|tum|um|ma)$/i, art: "das", label: "-" },
  { re: /(ling|ismus|ant|ent|ist|or|eur)$/i, art: "der", label: "-" },
];
function genderHint(it) {
  const bare = it.w.replace(/^(der|die|das)\s+/i, "");
  for (const r of GENDER_RULES) {
    const m = bare.match(r.re);
    if (m && it.a === r.art) return { suffix: m[0], art: r.art };
  }
  return null;
}

// Generate the 4-case declension (article forms are 100% reliable; noun-form
// changes apply the standard A1 rules, incl. weak/n-noun detection).
function declension(it) {
  const G = { der: "masc", die: "fem", das: "neut" }[it.a];
  const sing = it.w.replace(/^(der|die|das)\s+/i, "");
  const pl = (it.p || "").replace(/^die\s+/i, "").trim();
  const isWeak =
    it.a === "der" && pl && !/(er|el|en|chen|lein|s)$/.test(sing) && (
      (/e$/.test(sing) && pl === sing + "n" && !/(ee|ie)$/.test(sing)) ||
      (/(ist|ent|and|ant|at|graph|graf|nom|loge|soph|krat|och)$/.test(sing) && pl === sing + "en") ||
      /^(Mensch|Nachbar|Herr|Bauer|Held|Prinz)$/i.test(sing)
    );
  const obl = sing + (/e$/.test(sing) ? "n" : "en");           // weak oblique form
  const syll = (sing.match(/[aeiouyäöü]+/gi) || []).length;
  const gens = /(s|ß|x|z|sch|tz)$/.test(sing) ? sing + "es"     // sibilant → -es
    : /[aeiouyäöü]$/i.test(sing) ? sing + "s"                   // vowel → -s
      : syll <= 1 ? sing + "(e)s"                               // one syllable → -(e)s
        : sing + "s";                                          // polysyllabic → -s
  const datPl = pl ? (/(n|s)$/.test(pl) ? pl : pl + "n") : "";

  let sg;
  if (G === "masc") sg = isWeak
    ? [["der", sing], ["den", obl], ["dem", obl], ["des", obl]]
    : [["der", sing], ["den", sing], ["dem", sing], ["des", gens]];
  else if (G === "fem") sg = [["die", sing], ["die", sing], ["der", sing], ["der", sing]];
  else sg = [["das", sing], ["das", sing], ["dem", sing], ["des", gens]];

  const plr = pl ? [["die", pl], ["die", pl], ["den", datPl], ["der", pl]] : null;
  return { sg, plr, isWeak };
}

const CASES = ["Nominativ", "Akkusativ", "Dativ", "Genitiv"];

function DeclTable({ it }) {
  const d = declension(it);
  const cell = (pair) => pair
    ? <span><span style={{ color: "#60a5fa", fontWeight: 700 }}>{pair[0]}</span> {pair[1]}</span>
    : <span style={{ color: FAINT }}>—</span>;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11, color: FAINT, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>Deklination</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "3px 8px 3px 0", color: MUTE, fontWeight: 600 }}>Fall</th>
              <th style={{ textAlign: "left", padding: "3px 8px", color: MUTE, fontWeight: 600 }}>Singular</th>
              <th style={{ textAlign: "left", padding: "3px 8px", color: MUTE, fontWeight: 600 }}>Plural</th>
            </tr>
          </thead>
          <tbody>
            {CASES.map((c, i) => (
              <tr key={c} style={{ borderTop: "1px solid #222" }}>
                <td style={{ padding: "4px 8px 4px 0", color: MUTE, fontStyle: "italic", whiteSpace: "nowrap" }}>{c}</td>
                <td style={{ padding: "4px 8px", color: TXT, whiteSpace: "nowrap" }}>{cell(d.sg[i])}</td>
                <td style={{ padding: "4px 8px", color: TXT, whiteSpace: "nowrap" }}>{d.plr ? cell(d.plr[i]) : <span style={{ color: FAINT }}>—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: "#3f4651", marginTop: 6, lineHeight: 1.5 }}>
        {d.isWeak ? "N-noun: takes -(e)n in every case except the nominative singular." : "Genitive adds -(e)s; dative plural adds -n. A few n-nouns add -ns in the genitive (des Namens)."}
      </div>
    </div>
  );
}

function NounDetail({ it }) {
  const gender = it.a === "der" ? "maskulin" : it.a === "die" ? "feminin" : "neutrum";
  const hint = genderHint(it);
  const gc = it.a === "der" ? "#3b82f6" : it.a === "die" ? "#ec4899" : "#22c55e";
  return (
    <div style={{ marginTop: 12, fontSize: 13, color: MUTE }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <span>Plural: <b style={{ color: TXT }}>{it.p}</b></span>
        <span>Genus: <b style={{ color: gc }}>{gender}</b></span>
      </div>
      {hint && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#9aa6b6", background: "#13161c", border: "1px solid #1f2630", borderRadius: 8, padding: "6px 10px" }}>
          💡 Nouns ending in <b style={{ color: TXT }}>-{hint.suffix}</b> are almost always <b style={{ color: gc }}>{hint.art}</b>.
        </div>
      )}
      <DeclTable it={it} />
      {it.n && <div style={{ color: MUTE, fontStyle: "italic", fontSize: 12.5, marginTop: 10, lineHeight: 1.5 }}>{it.n}</div>}
    </div>
  );
}

function AdjDetail({ it }) {
  return (
    <div style={{ marginTop: 12, fontSize: 13, color: MUTE, display: "flex", gap: 16, flexWrap: "wrap" }}>
      <span>Komparativ: <b style={{ color: TXT }}>{it.cmp}</b></span>
      <span>Superlativ: <b style={{ color: TXT }}>{it.sup}</b></span>
      {it.opp && it.opp !== "–" && <span style={{ width: "100%" }}>Gegenteil: <b style={{ color: TXT }}>{it.opp}</b></span>}
    </div>
  );
}

function GramDetail({ it }) {
  return (
    <div style={{ marginTop: 12, fontSize: 13, color: MUTE, display: "flex", flexDirection: "column", gap: 4 }}>
      <div>{it.wt} · <span style={{ fontStyle: "italic" }}>{it.st}</span></div>
      {it.ce && it.ce !== "None — keeps word order" && <div>Fall/Effekt: <b style={{ color: TXT }}>{it.ce}</b></div>}
      {it.mh && <div style={{ fontSize: 12.5, color: FAINT, fontStyle: "italic", marginTop: 4, lineHeight: 1.5 }}>💡 {it.mh}</div>}
    </div>
  );
}

function PhraseDetail({ it }) {
  return (
    <div style={{ marginTop: 10 }}>
      <span style={{ background: "#1f1f1f", borderRadius: 6, padding: "3px 9px", fontSize: 11.5, color: "#eab308", fontWeight: 600 }}>{it.c}</span>
    </div>
  );
}

// ── Category registry (the modular core) ──────────────────────
const CATEGORIES = [
  {
    id: "nouns", label: "Nouns", color: "#3b82f6", key: "nouns",
    catOf: (x) => x.c,
    german: (x) => x.w,
    detail: (it) => <NounDetail it={it} />,
    modes: [
      { id: "translation", label: "Translation", build: (it, p) => mcq(it.w, "What does this mean?", it.e, distractors(p, it.e, "e")) },
      { id: "article", label: "Article", build: (it) => ({ prompt: it.w.replace(/^(der|die|das)\s+/i, ""), sub: "der, die or das?", answer: it.a, options: ["der", "die", "das"] }) },
      { id: "plural", label: "Plural", build: (it, p) => mcq(it.w, "What is the plural form?", it.p, distractors(p, it.p, "p")) },
      { id: "german", label: "EN → DE", build: (it, p) => mcq(it.e, "German noun (with article)?", it.w, distractors(p, it.w, "w")) },
    ],
  },
  {
    id: "verbs", label: "Verbs", color: "#f97316", key: "verbs",
    catOf: (x) => ({ irr: "Irregular", mix: "Mixed", reg: "Regular" })[x.t] || x.t,
    german: (x) => x.w,
    detail: (it) => <VerbTable v={it} />,
    modes: [
      { id: "translation", label: "Translation", build: (it, p) => mcq(it.w, "What does this mean?", it.e, distractors(p, it.e, "e")) },
      { id: "partizip2", label: "Partizip II", build: (it, p) => mcq(it.w, "What is the Partizip II?", it.p2, distractors(p, it.p2, "p2")) },
      { id: "haben_sein", label: "haben / sein", build: (it) => ({ prompt: it.w, sub: "Perfekt with haben or sein?", answer: it.hs, options: ["haben", "sein"] }) },
      { id: "present_er", label: "Präsens (er)", build: (it, p) => mcq(it.w, "er/sie/es form (Präsens)?", it.pr.er, distractors(p, it.pr.er, (x) => x.pr && x.pr.er)) },
    ],
  },
  {
    id: "adj", label: "Adjectives", color: "#a855f7", key: "adj",
    catOf: (x) => x.c,
    german: (x) => x.w,
    detail: (it) => <AdjDetail it={it} />,
    modes: [
      { id: "translation", label: "Translation", build: (it, p) => mcq(it.w, "What does this mean?", it.e, distractors(p, it.e, "e")) },
      { id: "comparative", label: "Comparative", build: (it, p) => mcq(it.w, "Comparative form?", it.cmp, distractors(p, it.cmp, "cmp")) },
      { id: "superlative", label: "Superlative", build: (it, p) => mcq(it.w, "Superlative form?", it.sup, distractors(p, it.sup, "sup")) },
      { id: "opposite", label: "Opposite", build: (it, p) => mcq(it.w, "What is the opposite?", it.opp, distractors(p, it.opp, "opp")) },
    ],
  },
  {
    id: "gram", label: "Grammar", color: "#22c55e", key: "gram",
    catOf: (x) => x.wt,
    german: (x) => x.w.replace(/\s*\(.*?\)\s*/g, "").trim(),
    detail: (it) => <GramDetail it={it} />,
    modes: [
      { id: "translation", label: "Translation", build: (it, p) => mcq(it.w, "What does this mean?", it.e, distractors(p, it.e, "e")) },
      { id: "type", label: "Word Type", build: (it, p) => mcq(it.w, "What type of word is this?", it.wt, distractors(p, it.wt, "wt")) },
      { id: "subtype", label: "Subtype", build: (it, p) => mcq(it.w, "Its grammatical subtype?", it.st, distractors(p, it.st, "st")) },
      { id: "case", label: "Case Effect", build: (it, p) => mcq(it.w, "What does it do to case/word order?", it.ce, distractors(p, it.ce, "ce")) },
    ],
  },
  {
    id: "phrases", label: "Phrases", color: "#eab308", key: "phrases",
    catOf: (x) => x.c,
    german: (x) => x.w,
    detail: (it) => <PhraseDetail it={it} />,
    modes: [
      { id: "translation", label: "DE → EN", build: (it, p) => mcq(it.w, "What does this phrase mean?", it.e, distractors(p, it.e, "e")) },
      { id: "german", label: "EN → DE", build: (it, p) => mcq(it.e, "Say this in German", it.w, distractors(p, it.w, "w")) },
    ],
  },
];

function keyOf(catId, item) { return catId + ":" + item.w; }
function subcatsOf(cat, pool) { return [...new Set(pool.map(cat.catOf))].filter(Boolean).sort(); }
function levelsPresent(pool) { return LEVELS.filter((L) => pool.some((x) => lvlOf(x) === L)); }

// ── Audio button ──────────────────────────────────────────────
function SpeakBtn({ text, color = "#3b82f6", size = 30 }) {
  return (
    <button
      title="Listen (Deutsch)"
      onClick={(e) => { e.stopPropagation(); speak(text); }}
      style={{ width: size, height: size, flex: "0 0 auto", borderRadius: 8, border: "1px solid #2a2a2a", background: "#1a1a1a", color, cursor: "pointer", fontSize: 14, lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
    >🔊</button>
  );
}

// ── Browse view ───────────────────────────────────────────────
function BrowseView({ cat, progress, levelFilter }) {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [expanded, setExpanded] = useState(null);

  const pool = useMemo(
    () => DB[cat.key].filter((x) => levelFilter === "All" || lvlOf(x) === levelFilter),
    [cat, levelFilter]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pool.filter((it) => {
      const matchCat = catFilter === "All" || cat.catOf(it) === catFilter;
      const matchSearch = !q || it.w.toLowerCase().includes(q) || it.e.toLowerCase().includes(q) || (it.n && it.n.toLowerCase().includes(q));
      return matchCat && matchSearch;
    });
  }, [pool, search, catFilter, cat]);

  const cats = ["All", ...subcatsOf(cat, pool)];

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input
          value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search words, meanings, notes…"
          style={{ flex: 1, minWidth: 180, background: "#161616", border: "1px solid #2a2a2a", borderRadius: 10, padding: "9px 13px", color: TXT, fontSize: 14 }}
        />
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
          style={{ background: "#161616", border: "1px solid #2a2a2a", borderRadius: 10, padding: "9px 12px", color: TXT, fontSize: 13 }}>
          {cats.map((c) => (
            <option key={c} value={c}>{c === "All" ? `All (${pool.length})` : `${c} (${pool.filter((i) => cat.catOf(i) === c).length})`}</option>
          ))}
        </select>
      </div>
      <div style={{ fontSize: 12, color: FAINT, marginBottom: 10 }}>{filtered.length} entries</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {filtered.map((it) => {
          const k = keyOf(cat.id, it);
          const p = progress[k] || { mastery: 0, correct: 0, total: 0 };
          const isOpen = expanded === k;
          return (
            <div key={k} onClick={() => setExpanded(isOpen ? null : k)}
              style={{ background: "#141414", border: `1px solid ${isOpen ? cat.color + "55" : "#242424"}`, borderRadius: 12, padding: "11px 14px", cursor: "pointer", transition: "border-color .15s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: 15.5, color: "#f1f5f9" }}>{it.w}</span>
                  <span style={{ marginLeft: 8, fontSize: 13, color: MUTE }}>{it.e}</span>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flex: "0 0 auto" }}>
                  {p.total > 0 && (
                    <span style={{ fontSize: 11, color: p.mastery >= 4 ? "#22c55e" : p.correct / p.total >= 0.7 ? "#eab308" : "#f97316", background: "#1f1f1f", borderRadius: 5, padding: "2px 7px", fontWeight: 600 }}>
                      {"★".repeat(p.mastery)}{"☆".repeat(5 - p.mastery)}
                    </span>
                  )}
                  <SpeakBtn text={cat.german(it)} color={cat.color} size={28} />
                </div>
              </div>
              {isOpen && (
                <div className="dm-reveal" style={{ marginTop: 9, borderTop: "1px solid #242424", paddingTop: 9 }}>
                  {it.ex && <div style={{ fontSize: 13, color: "#9aa6b6", fontStyle: "italic" }}>„{it.ex}"</div>}
                  {cat.detail(it)}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <div style={{ color: FAINT, textAlign: "center", padding: 30 }}>No matches.</div>}
      </div>
    </div>
  );
}

// ── Quiz view (10-question sessions, spaced repetition) ───────
const SESSION_LEN = 10;

function pickSession(pool, progress, catId, focusWeak) {
  let candidates = pool;
  if (focusWeak) {
    const weak = pool.filter((it) => {
      const p = progress[keyOf(catId, it)];
      return !p || p.mastery < 3;
    });
    if (weak.length >= 4) candidates = weak;
  }
  // weight: weaker / unseen words appear more often
  const weighted = candidates.map((it) => {
    const p = progress[keyOf(catId, it)];
    const m = p ? p.mastery : 0;
    let w = (5 - m) + 1;          // 1..6
    if (!p || !p.total) w += 3;   // unseen boost
    return { it, w };
  });
  const out = [];
  const used = new Set();
  const n = Math.min(SESSION_LEN, candidates.length);
  let guard = 0;
  while (out.length < n && guard < 4000) {
    guard++;
    const total = weighted.reduce((s, x) => (used.has(x.it.w) ? s : s + x.w), 0);
    let r = Math.random() * total;
    for (const x of weighted) {
      if (used.has(x.it.w)) continue;
      r -= x.w;
      if (r <= 0) { used.add(x.it.w); out.push(x.it); break; }
    }
  }
  return out;
}

function QuizView({ cat, progress, setProgress, levelFilter }) {
  const [mode, setMode] = useState(cat.modes[0].id);
  const [catFilter, setCatFilter] = useState("All");
  const [focusWeak, setFocusWeak] = useState(false);
  const [queue, setQueue] = useState([]);
  const [idx, setIdx] = useState(0);
  const [q, setQ] = useState(null);
  const [chosen, setChosen] = useState(null);
  const [streak, setStreak] = useState(0);
  const [results, setResults] = useState([]); // {item, ok}
  const [done, setDone] = useState(false);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  const modeDef = cat.modes.find((m) => m.id === mode);

  const pool = useMemo(() => {
    return DB[cat.key].filter((x) => {
      if (levelFilter !== "All" && lvlOf(x) !== levelFilter) return false;
      if (catFilter !== "All" && cat.catOf(x) !== catFilter) return false;
      return true;
    });
  }, [cat, catFilter, levelFilter]);

  const startSession = useCallback(() => {
    const items = pickSession(pool, progressRef.current, cat.id, focusWeak);
    setQueue(items);
    setIdx(0);
    setResults([]);
    setDone(false);
    setStreak(0);
    setChosen(null);
    setQ(items.length ? modeDef.build(items[0], pool) : null);
  }, [pool, cat, focusWeak, modeDef]);

  useEffect(() => { startSession(); /* eslint-disable-next-line */ }, [mode, catFilter, focusWeak, cat, levelFilter]);

  const item = queue[idx];

  const answer = useCallback((opt) => {
    if (chosen !== null || !q || !item) return;
    const ok = opt === q.answer;
    setChosen(opt);
    setStreak((s) => (ok ? s + 1 : 0));
    setResults((r) => [...r, { item, ok }]);
    const k = keyOf(cat.id, item);
    const prev = progressRef.current[k] || { mastery: 0, correct: 0, total: 0 };
    const updated = {
      mastery: ok ? Math.min(prev.mastery + 1, 5) : Math.max(prev.mastery - 1, 0),
      correct: prev.correct + (ok ? 1 : 0),
      total: prev.total + 1,
    };
    const np = { ...progressRef.current, [k]: updated };
    setProgress(np);
    saveProgress(np);
  }, [chosen, q, item, cat, setProgress]);

  const advance = useCallback(() => {
    if (chosen === null) return;
    if (idx + 1 >= queue.length) { setDone(true); return; }
    const ni = idx + 1;
    setIdx(ni);
    setChosen(null);
    setQ(modeDef.build(queue[ni], pool));
  }, [chosen, idx, queue, modeDef, pool]);

  // keyboard: 1-4 to answer, Enter/→/Space to advance or restart
  useEffect(() => {
    const onKey = (e) => {
      if (done) { if (e.key === "Enter") startSession(); return; }
      if (chosen === null && q) {
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= q.options.length) { answer(q.options[n - 1]); e.preventDefault(); }
      } else if (chosen !== null) {
        if (e.key === "Enter" || e.key === "ArrowRight" || e.key === " ") { advance(); e.preventDefault(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chosen, q, done, answer, advance, startSession]);

  // ── Session summary ──
  if (done) {
    const score = results.filter((r) => r.ok).length;
    const missed = results.filter((r) => !r.ok).map((r) => r.item);
    const pct = results.length ? Math.round((score / results.length) * 100) : 0;
    return (
      <div className="dm-reveal" style={{ textAlign: "center", paddingTop: 8 }}>
        <div style={{ fontSize: 13, color: MUTE, letterSpacing: 1, textTransform: "uppercase" }}>Session complete</div>
        <div style={{ fontSize: 56, fontWeight: 800, color: cat.color, margin: "6px 0", letterSpacing: "-1px" }}>{score}/{results.length}</div>
        <div style={{ fontSize: 14, color: MUTE, marginBottom: 22 }}>{pct}% correct{score === results.length ? " · perfect! 🎉" : ""}</div>
        {missed.length > 0 && (
          <div style={{ textAlign: "left", background: "#141414", border: "1px solid #242424", borderRadius: 12, padding: 14, marginBottom: 18 }}>
            <div style={{ fontSize: 12, color: FAINT, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Review ({missed.length})</div>
            {missed.map((m, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "5px 0", borderTop: i ? "1px solid #1f1f1f" : "none" }}>
                <div><b style={{ color: "#f1f5f9" }}>{m.w}</b> <span style={{ color: MUTE, fontSize: 13 }}>— {m.e}</span></div>
                <SpeakBtn text={cat.german(m)} color={cat.color} size={26} />
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          {missed.length > 0 && (
            <button onClick={() => { setFocusWeak(true); startSession(); }}
              style={{ flex: 1, background: "#1a1a1a", border: `1px solid ${cat.color}55`, borderRadius: 12, padding: "13px", color: cat.color, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              Practice weak words
            </button>
          )}
          <button onClick={startSession}
            style={{ flex: 1, background: cat.color, border: "none", borderRadius: 12, padding: "13px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            New session →
          </button>
        </div>
      </div>
    );
  }

  if (!q || !item) {
    return <div style={{ color: FAINT, textAlign: "center", padding: 40 }}>No words match these filters.</div>;
  }

  const oneCol = q.options.some((o) => String(o).length > 22) || q.options.length <= 2;
  const sub = q.sub || (modeDef && modeDef.label);

  return (
    <div>
      {/* Controls */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 3, background: "#161616", borderRadius: 9, padding: 3, flexWrap: "wrap" }}>
          {cat.modes.map((m) => (
            <button key={m.id} onClick={() => setMode(m.id)}
              style={{
                padding: "5px 11px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12,
                background: mode === m.id ? cat.color : "transparent", color: mode === m.id ? "#fff" : MUTE, fontWeight: mode === m.id ? 700 : 400
              }}>
              {m.label}
            </button>
          ))}
        </div>
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
          style={{ background: "#161616", border: "1px solid #2a2a2a", borderRadius: 9, padding: "6px 10px", color: TXT, fontSize: 12 }}>
          <option value="All">All categories</option>
          {subcatsOf(cat, DB[cat.key]).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={() => setFocusWeak((v) => !v)} title="Prioritise words you struggle with"
          style={{ padding: "6px 10px", borderRadius: 9, border: `1px solid ${focusWeak ? cat.color : "#2a2a2a"}`, background: focusWeak ? cat.color + "22" : "#161616", color: focusWeak ? cat.color : MUTE, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
          ◎ Weak
        </button>
      </div>

      {/* progress + streak */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1, height: 5, background: "#1f1f1f", borderRadius: 999 }}>
          <div style={{ width: `${(idx / queue.length) * 100}%`, height: 5, background: cat.color, borderRadius: 999, transition: "width .3s" }} />
        </div>
        <span style={{ fontSize: 12, color: FAINT, fontVariantNumeric: "tabular-nums" }}>{idx + 1}/{queue.length}</span>
        {streak > 1 && <span style={{ fontSize: 13, color: "#f97316", fontWeight: 700 }}>🔥 {streak}</span>}
      </div>

      {/* Question card */}
      <div style={{ background: "#131313", border: `1px solid ${cat.color}33`, borderRadius: 16, padding: "22px 22px 24px", marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ fontSize: 12, color: FAINT, textTransform: "uppercase", letterSpacing: 0.5 }}>{sub}</div>
          <SpeakBtn text={cat.german(item)} color={cat.color} />
        </div>
        <div style={{ fontSize: 30, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.5px", marginTop: 8, lineHeight: 1.15 }}>{q.prompt}</div>
        {chosen !== null && (
          <div className="dm-reveal" style={{ marginTop: 16, borderTop: "1px solid #222", paddingTop: 12 }}>
            <div style={{ fontSize: 13, color: MUTE }}>
              Answer: <span style={{ color: "#4ade80", fontWeight: 700 }}>{q.answer}</span>
            </div>
            {item.ex && <div style={{ marginTop: 8, fontSize: 13, color: FAINT, fontStyle: "italic" }}>„{item.ex}"</div>}
            {cat.detail(item)}
          </div>
        )}
      </div>

      {/* Options */}
      <div style={{ display: "grid", gridTemplateColumns: oneCol ? "1fr" : "1fr 1fr", gap: 8 }}>
        {q.options.map((opt, i) => {
          const isChosen = chosen === opt;
          const isCorrect = opt === q.answer;
          let bg = "#171717", border = "#2a2a2a", color = TXT, mark = null;
          if (chosen !== null) {
            if (isCorrect) { bg = "#0a2a16"; border = "#22c55e"; color = "#5eead4"; mark = "✓"; }
            else if (isChosen) { bg = "#2a0d0d"; border = "#ef4444"; color = "#fca5a5"; mark = "✗"; }
            else { color = "#6b7280"; }
          }
          return (
            <button key={i} className="dm-opt" onClick={() => answer(opt)} disabled={chosen !== null}
              style={{
                background: bg, border: `1.5px solid ${border}`, borderRadius: 12, padding: "13px 14px", color, fontSize: 14.5, fontWeight: 600,
                cursor: chosen ? "default" : "pointer", textAlign: "left", transition: "all .15s", lineHeight: 1.3, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8
              }}>
              <span><span style={{ color: FAINT, fontWeight: 400, marginRight: 8, fontSize: 12 }}>{i + 1}</span>{opt}</span>
              {mark && <span style={{ fontWeight: 800 }}>{mark}</span>}
            </button>
          );
        })}
      </div>

      {chosen !== null && (
        <button onClick={advance}
          style={{ marginTop: 14, width: "100%", background: cat.color, border: "none", borderRadius: 12, padding: "14px", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
          {idx + 1 >= queue.length ? "Finish session" : "Next →"}
        </button>
      )}
      <div style={{ textAlign: "center", marginTop: 10, fontSize: 11, color: "#3a3f49" }}>
        Tip: keys 1–{q.options.length} to answer · Enter to continue
      </div>
    </div>
  );
}

// ── Backup: export / import progress ──────────────────────────
function ImportExportPanel({ progress, setProgress, driveStatus, setDriveStatus }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState(null);
  const fileRef = useRef(null);

  const count = Object.keys(progress).length;
  const [lastBackup, setLastBackup] = useState(null);
  useEffect(() => { storage.get("dm-last-backup").then((r) => { if (r && r.value) setLastBackup(Number(r.value)); }).catch(() => { }); }, []);
  const markBackup = () => { const t = Date.now(); setLastBackup(t); storage.set("dm-last-backup", String(t)); };
  const daysSince = lastBackup ? Math.floor((Date.now() - lastBackup) / 86400000) : null;

  const download = async () => {
    try { const how = await shareOrDownloadBackup(progress); markBackup(); setMsg({ ok: true, t: how === "shared" ? "Backup shared." : "Backup file downloaded." }); }
    catch { setMsg({ ok: false, t: "Export blocked — use Copy instead." }); }
  };

  const copy = async () => {
    try { await copyBackup(progress); markBackup(); setMsg({ ok: true, t: "Copied to clipboard." }); }
    catch { setText(buildBackup(progress)); setOpen(true); setMsg({ ok: true, t: "Clipboard blocked — JSON shown below to copy manually." }); }
  };

  const doImport = (raw) => {
    try {
      const incoming = parseBackup(raw);
      const merged = { ...progress, ...incoming };
      setProgress(merged); saveProgress(merged);
      setMsg({ ok: true, t: `Restored ${Object.keys(incoming).length} words.` });
      setText("");
    } catch (e) { setMsg({ ok: false, t: (e && e.message === "empty") ? "No valid progress found in that data." : "That doesn't look like valid backup JSON." }); }
  };

  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => doImport(String(r.result));
    r.onerror = () => setMsg({ ok: false, t: "Couldn't read that file." });
    r.readAsText(f);
    e.target.value = "";
  };

  // ── Google Drive sync ──
  // IMPORTANT: drive.connect() must be invoked synchronously, in the same
  // tick as the click event — no `await` before it — or iOS Safari treats
  // the resulting window.open() as not user-initiated and silently blocks
  // the popup (no error, just nothing happens).
  const driveConnect = () => {
    const connectPromise = drive.connect({ interactive: true }); // ← fires popup synchronously, first
    setDriveStatus((s) => ({ ...s, busy: true, error: null }));
    connectPromise
      .then(async (ok) => {
        if (!ok) { setDriveStatus((s) => ({ ...s, busy: false })); return; }
        const remote = await drive.pullProgress({ interactive: false });
        let merged = progress;
        if (remote) {
          merged = drive.mergeProgress(progress, remote);
          setProgress(merged);
          await saveProgress(merged);
        }
        await drive.pushProgress(merged, { interactive: false });
        setDriveStatus({ connected: true, busy: false, lastSync: Date.now(), error: null });
        setMsg({ ok: true, t: "Connected to Google Drive and synced." });
      })
      .catch((e) => {
        setDriveStatus((s) => ({ ...s, busy: false, error: e.message }));
        setMsg({ ok: false, t: e.message });
      });
  };

  const driveSyncNow = async () => {
    setDriveStatus((s) => ({ ...s, busy: true, error: null }));
    try {
      const remote = await drive.pullProgress({ interactive: false });
      const merged = remote ? drive.mergeProgress(progress, remote) : progress;
      if (remote) { setProgress(merged); await saveProgress(merged); }
      await drive.pushProgress(merged, { interactive: false });
      setDriveStatus({ connected: true, busy: false, lastSync: Date.now(), error: null });
      setMsg({ ok: true, t: "Synced with Google Drive." });
    } catch (e) {
      setDriveStatus((s) => ({ ...s, busy: false, connected: e.message.includes("reconnect") ? false : s.connected, error: e.message }));
      setMsg({ ok: false, t: e.message });
    }
  };

  const driveDisconnect = async () => {
    await drive.disconnect();
    setDriveStatus({ connected: false, busy: false, lastSync: null, error: null });
    setMsg({ ok: true, t: "Disconnected from Google Drive." });
  };


  return (
    <div style={{ background: "#141414", border: "1px solid #242424", borderRadius: 12, padding: 15, marginTop: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setOpen((v) => !v)}>
        <span style={{ fontWeight: 700, color: "#f1f5f9", fontSize: 14 }}>💾 Backup &amp; restore</span>
        <span style={{ color: FAINT, fontSize: 14, transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }}>›</span>
      </div>
      {!open && <div style={{ fontSize: 12.5, color: MUTE, marginTop: 3 }}>Export your progress to a file, or restore it on another device.</div>}
      {open && (
        <div className="dm-reveal" style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, color: FAINT, marginBottom: 8 }}>You have progress on <b style={{ color: TXT }}>{count}</b> words.</div>
          {count > 0 && daysSince !== null && (
            <div style={{ fontSize: 12, color: daysSince >= 7 ? "#fbbf24" : MUTE, marginBottom: 10 }}>
              {daysSince === 0 ? "Backed up today." : `Last backup ${daysSince} day${daysSince === 1 ? "" : "s"} ago.${daysSince >= 7 ? " Consider exporting." : ""}`}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            <button onClick={download} style={{ flex: 1, minWidth: 130, background: "#3b82f6", border: "none", borderRadius: 10, padding: "10px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>⬇ Export file</button>
            <button onClick={copy} style={{ flex: 1, minWidth: 130, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, padding: "10px", color: TXT, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>⧉ Copy JSON</button>
          </div>
          <div style={{ fontSize: 12, color: FAINT, marginBottom: 6 }}>Restore from a backup:</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <button onClick={() => fileRef.current && fileRef.current.click()} style={{ flex: 1, minWidth: 130, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, padding: "10px", color: TXT, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>⬆ Load file</button>
            <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} style={{ display: "none" }} />
            <button onClick={() => text.trim() && doImport(text)} style={{ flex: 1, minWidth: 130, background: "#22c55e", border: "none", borderRadius: 10, padding: "10px", color: "#06240f", fontSize: 13, fontWeight: 700, cursor: text.trim() ? "pointer" : "not-allowed", opacity: text.trim() ? 1 : 0.5 }}>Restore pasted JSON</button>
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="…or paste backup JSON here, then press Restore."
            style={{ width: "100%", minHeight: 70, background: "#0f0f0f", border: "1px solid #2a2a2a", borderRadius: 10, padding: 10, color: TXT, fontSize: 12, fontFamily: "ui-monospace, monospace", resize: "vertical" }} />
          {msg && <div style={{ marginTop: 8, fontSize: 12.5, color: msg.ok ? "#4ade80" : "#fca5a5" }}>{msg.ok ? "✓ " : "✗ "}{msg.t}</div>}
          <div style={{ marginTop: 8, fontSize: 11, color: "#3f4651", lineHeight: 1.5 }}>Restoring merges into your current progress; words missing from a backup stay at zero, so older backups still work after new words are added.</div>

          {/* Google Drive sync */}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #242424" }}>
            <div style={{ fontSize: 12, color: FAINT, marginBottom: 8 }}>☁️ Google Drive sync:</div>
            {!driveStatus.connected ? (
              <button onClick={driveConnect} disabled={driveStatus.busy}
                style={{ width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, padding: "10px", color: TXT, fontSize: 13, fontWeight: 600, cursor: driveStatus.busy ? "default" : "pointer", opacity: driveStatus.busy ? 0.6 : 1 }}>
                {driveStatus.busy ? "Connecting…" : "Connect Google Drive"}
              </button>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={driveSyncNow} disabled={driveStatus.busy}
                  style={{ flex: 1, minWidth: 130, background: "#3b82f6", border: "none", borderRadius: 10, padding: "10px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: driveStatus.busy ? "default" : "pointer", opacity: driveStatus.busy ? 0.6 : 1 }}>
                  {driveStatus.busy ? "Syncing…" : "↻ Sync now"}
                </button>
                <button onClick={driveDisconnect}
                  style={{ flex: 1, minWidth: 130, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, padding: "10px", color: TXT, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Disconnect
                </button>
              </div>
            )}
            <div style={{ fontSize: 11, color: "#3f4651", marginTop: 8, lineHeight: 1.5 }}>
              {driveStatus.connected
                ? `Auto-syncs in the background. ${driveStatus.lastSync ? `Last synced ${new Date(driveStatus.lastSync).toLocaleString()}.` : ""}`
                : "Stores progress in your Drive's hidden app folder (not visible in your normal Drive files) — syncs automatically across devices once connected."}
            </div>
            {driveStatus.error && <div style={{ marginTop: 6, fontSize: 12, color: "#fca5a5" }}>✗ {driveStatus.error}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Stats view ────────────────────────────────────────────────
function StatsView({ progress, setProgress, levelFilter, driveStatus, setDriveStatus }) {
  const [confirm, setConfirm] = useState(false);

  let mastered = 0, seen = 0, totalWords = 0, totCorrect = 0, totAns = 0;
  const perCat = CATEGORIES.map((cat) => {
    const pool = DB[cat.key].filter((x) => levelFilter === "All" || lvlOf(x) === levelFilter);
    let cSeen = 0, cMast = 0, cCorrect = 0, cTot = 0;
    pool.forEach((it) => {
      const p = progress[keyOf(cat.id, it)];
      if (p && p.total > 0) { cSeen++; seen++; cCorrect += p.correct; cTot += p.total; totCorrect += p.correct; totAns += p.total; }
      if (p && p.mastery >= 4) { cMast++; mastered++; }
    });
    totalWords += pool.length;
    return { cat, total: pool.length, seen: cSeen, mastered: cMast, correct: cCorrect, answered: cTot };
  });

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        {[["Mastered", mastered, "#22c55e"], ["Seen", seen, "#3b82f6"], ["Accuracy", totAns ? Math.round((totCorrect / totAns) * 100) + "%" : "—", "#a855f7"]].map(([l, v, c]) => (
          <div key={l} style={{ flex: 1, background: "#141414", border: "1px solid #242424", borderRadius: 12, padding: "14px 12px", textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: c, fontVariantNumeric: "tabular-nums" }}>{v}</div>
            <div style={{ fontSize: 11.5, color: MUTE, marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: FAINT, marginBottom: 8 }}>{mastered} of {totalWords} words mastered (★★★★+)</div>
      <div style={{ display: "grid", gap: 11 }}>
        {perCat.map(({ cat, total, seen, mastered, correct, answered }) => {
          const pct = total ? Math.round((seen / total) * 100) : 0;
          const mpct = total ? Math.round((mastered / total) * 100) : 0;
          return (
            <div key={cat.id} style={{ background: "#141414", border: "1px solid #242424", borderRadius: 12, padding: 15 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: cat.color, fontWeight: 700 }}>{cat.label}</span>
                <span style={{ color: MUTE, fontSize: 13 }}>{seen}/{total} seen · {mastered} mastered</span>
              </div>
              <div style={{ position: "relative", background: "#1f1f1f", borderRadius: 999, height: 7, marginBottom: 8, overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, width: `${pct}%`, background: cat.color + "55", borderRadius: 999, transition: "width .5s" }} />
                <div style={{ position: "absolute", inset: 0, width: `${mpct}%`, background: cat.color, borderRadius: 999, transition: "width .5s" }} />
              </div>
              <div style={{ fontSize: 12, color: FAINT }}>{answered > 0 ? `${correct}/${answered} correct (${Math.round((correct / answered) * 100)}%)` : "No quizzes yet"}</div>
            </div>
          );
        })}
      </div>

      <ImportExportPanel progress={progress} setProgress={setProgress} driveStatus={driveStatus} setDriveStatus={setDriveStatus} />

      <div style={{ marginTop: 22, textAlign: "center" }}>
        {!confirm ? (
          <button onClick={() => setConfirm(true)} style={{ background: "transparent", border: "1px solid #2a2a2a", color: FAINT, borderRadius: 9, padding: "8px 16px", fontSize: 12.5, cursor: "pointer" }}>
            Reset all progress
          </button>
        ) : (
          <div style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
            <span style={{ fontSize: 12.5, color: MUTE }}>Erase everything? Export a backup first if unsure.</span>
            <button onClick={async () => { await clearProgress(); setProgress({}); setConfirm(false); }}
              style={{ background: "#2a0d0d", border: "1px solid #ef4444", color: "#fca5a5", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Yes, reset</button>
            <button onClick={() => setConfirm(false)} style={{ background: "transparent", border: "1px solid #2a2a2a", color: MUTE, borderRadius: 8, padding: "7px 14px", fontSize: 12.5, cursor: "pointer" }}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Grammatik reference — comprehensive A1 (Goethe Start Deutsch 1 scope) ──
// Block types: {p}, {ex:[[de,en]...]}, {table:{head,rows}}, {tip}
const GRAMMAR_TOPICS = [
  // ===== BASICS =====
  {
    id: "pronouns", sec: "Basics", title: "Pronouns · sein, haben, werden", summary: "The building blocks plus the three essential irregular verbs.", blocks: [
      { p: "Personal pronouns (subject): ich, du, er/sie/es, wir, ihr, sie/Sie. 'Sie' (formal you) is always capitalised." },
      { table: { head: ["", "sein (be)", "haben (have)", "werden (become)"], rows: [["ich", "bin", "habe", "werde"], ["du", "bist", "hast", "wirst"], ["er/sie/es", "ist", "hat", "wird"], ["wir", "sind", "haben", "werden"], ["ihr", "seid", "habt", "werdet"], ["sie/Sie", "sind", "haben", "werden"]] } },
      { ex: [["Ich bin müde.", "I am tired."], ["Hast du Zeit?", "Do you have time?"], ["Es wird kalt.", "It's getting cold."]] },
    ]
  },
  {
    id: "present", sec: "Basics", title: "Present tense", summary: "Regular -en endings plus the vowel-changing irregular stems.", blocks: [
      { p: "Drop -en from the infinitive and add endings to the stem (lernen → lern-):" },
      { table: { head: ["", "lernen", "wohnen", "arbeiten"], rows: [["ich", "lerne", "wohne", "arbeite"], ["du", "lernst", "wohnst", "arbeitest"], ["er/sie/es", "lernt", "wohnt", "arbeitet"], ["wir", "lernen", "wohnen", "arbeiten"], ["ihr", "lernt", "wohnt", "arbeitet"], ["sie/Sie", "lernen", "wohnen", "arbeiten"]] } },
      { tip: "Stems ending in -t/-d add an extra -e- in du/er/ihr: du arbeitest, er findet." },
      { p: "Some common verbs change their stem vowel in the du / er-sie-es forms:" },
      { ex: [["lesen → du liest, er liest", "to read"], ["sprechen → du sprichst, er spricht", "to speak"], ["fahren → du fährst, er fährt", "to drive"], ["essen → du isst, er isst", "to eat"]] },
    ]
  },
  {
    id: "register", sec: "Basics", title: "du, ihr or Sie?", summary: "Choosing the right 'you' — informal vs formal.", blocks: [
      { p: "du = one person you know well (friends, family, children). ihr = several people you know well. Sie = formal, for one or several people (strangers, officials, shops). Always capitalise Sie." },
      { ex: [["Wie heißt du?", "informal, one person"], ["Wie heißt ihr?", "informal, a group"], ["Wie heißen Sie?", "formal"]] },
      { tip: "In Bavaria you'll also hear 'Servus' and 'Grüß Gott' — but stick to Sie with people you don't know." },
    ]
  },
  {
    id: "wordorder", sec: "Basics", title: "Word order (verb second)", summary: "The conjugated verb loves position 2.", blocks: [
      { p: "In a main clause the conjugated verb is always the second element. If something other than the subject comes first, the subject moves to just after the verb." },
      { ex: [["Ich gehe heute ins Kino.", "I'm going to the cinema today."], ["Heute gehe ich ins Kino.", "Today I'm going to the cinema."]] },
      { tip: "Order of extra info: Time – Manner – Place (TeKaMoLo). 'Ich fahre morgen mit dem Bus nach München.'" },
    ]
  },

  // ===== QUESTIONS & NEGATION =====
  {
    id: "questions", sec: "Questions & Negation", title: "Asking questions", summary: "Yes/no inversion, W-questions, and which/how-many.", blocks: [
      { p: "Yes/no question: put the verb first. 'Kommst du?' 'Hast du Zeit?'" },
      { table: { head: ["W-word", "Meaning"], rows: [["Wer?", "Who?"], ["Was?", "What?"], ["Wo? / Wohin? / Woher?", "Where? / Where to? / From where?"], ["Wann?", "When?"], ["Warum?", "Why?"], ["Wie?", "How?"], ["Wie viel? / Wie viele?", "How much? / How many?"], ["Welcher/Welche/Welches?", "Which?"]] } },
      { ex: [["Woher kommst du?", "Where are you from?"], ["Welches Buch liest du?", "Which book are you reading?"], ["Was für ein Auto ist das?", "What kind of car is that?"]] },
    ]
  },
  {
    id: "negation", sec: "Questions & Negation", title: "Negation: nicht vs kein", summary: "Two ways to say no — pick by what you're negating.", blocks: [
      { p: "nicht negates a verb, adjective or whole sentence. kein negates a noun (it replaces ein and 'some')." },
      { table: { head: ["kein", "masc", "fem", "neut", "Plural"], rows: [["Nominativ", "kein", "keine", "kein", "keine"], ["Akkusativ", "keinen", "keine", "kein", "keine"], ["Dativ", "keinem", "keiner", "keinem", "keinen"]] } },
      { ex: [["Ich komme nicht.", "I'm not coming."], ["Das ist nicht gut.", "That's not good."], ["Ich habe kein Geld.", "I have no money."], ["Sie hat keine Zeit.", "She has no time."]] },
    ]
  },

  // ===== NOUNS & CASES =====
  {
    id: "articles", sec: "Nouns & Cases", title: "Articles & gender", summary: "der/die/das, ein/eine, kein — plus suffix shortcuts.", blocks: [
      { p: "Definite (the): der (masc), die (fem), das (neut), die (plural). Indefinite (a): ein (masc/neut), eine (fem). Negative: kein/keine." },
      { p: "Gender is mostly memorised, but endings hint strongly:" },
      { ex: [["-ung, -heit, -keit, -schaft, -ion, -tät", "→ die"], ["-chen, -lein", "→ das"], ["-er (agent), -ling, -ismus", "→ der"], ["days, months, seasons", "→ der (der Montag, der Mai, der Sommer)"]] },
    ]
  },
  {
    id: "plurals", sec: "Nouns & Cases", title: "Plurals", summary: "No single rule — but common families.", blocks: [
      { p: "Plurals are learned per word, but patterns help: -e (der Tisch → die Tische), -er + umlaut (das Buch → die Bücher), -(e)n (die Frau → die Frauen), -s (das Auto → die Autos), or no change (der Lehrer → die Lehrer)." },
      { tip: "All plurals take die in the nominative, and add -n in the dative plural: mit den Kindern." },
    ]
  },
  {
    id: "cases", sec: "Nouns & Cases", title: "The four cases", summary: "Nominativ, Akkusativ, Dativ, Genitiv — with the full article tables.", blocks: [
      { p: "Case shows a noun's job. The article changes; the noun itself usually doesn't (except dative plural +n and genitive +(e)s)." },
      { table: { head: ["Definit", "masc", "fem", "neut", "Plural"], rows: [["Nominativ", "der", "die", "das", "die"], ["Akkusativ", "den", "die", "das", "die"], ["Dativ", "dem", "der", "dem", "den"], ["Genitiv", "des", "der", "des", "der"]] } },
      { table: { head: ["Indefinit", "masc", "fem", "neut"], rows: [["Nominativ", "ein", "eine", "ein"], ["Akkusativ", "einen", "eine", "ein"], ["Dativ", "einem", "einer", "einem"], ["Genitiv", "eines", "einer", "eines"]] } },
      { tip: "Only the masculine changes in the accusative (der → den, ein → einen). Open any noun card to see its full declension." },
    ]
  },
  {
    id: "akkusativ", sec: "Nouns & Cases", title: "Accusative (direct object)", summary: "The thing being acted on. Only masculine changes.", blocks: [
      { p: "Used for the direct object, and after these prepositions (always accusative): durch, für, gegen, ohne, um." },
      { ex: [["Ich sehe den Mann.", "I see the man."], ["Ich habe einen Bruder.", "I have a brother."], ["Das Geschenk ist für dich.", "The gift is for you."], ["Wir gehen durch den Park.", "We walk through the park."]] },
    ]
  },
  {
    id: "dativ", sec: "Nouns & Cases", title: "Dative (indirect object)", summary: "The recipient — and a fixed set of prepositions.", blocks: [
      { p: "Definite: dem (masc/neut), der (fem), den + noun-n (plural). Always dative after: mit, bei, von, zu, aus, nach, seit, gegenüber." },
      { ex: [["Ich gebe dem Kind das Buch.", "I give the child the book."], ["Ich fahre mit dem Bus.", "I travel by bus."], ["Ich komme aus der Türkei.", "I come from Turkey."]] },
    ]
  },
  {
    id: "procases", sec: "Nouns & Cases", title: "Pronouns in accusative & dative", summary: "me, you, him … and to me, to you, to him.", blocks: [
      { table: { head: ["Nominativ", "Akkusativ", "Dativ"], rows: [["ich", "mich", "mir"], ["du", "dich", "dir"], ["er", "ihn", "ihm"], ["sie", "sie", "ihr"], ["es", "es", "ihm"], ["wir", "uns", "uns"], ["ihr", "euch", "euch"], ["sie/Sie", "sie/Sie", "ihnen/Ihnen"]] } },
      { ex: [["Ich sehe dich.", "I see you. (accusative)"], ["Kannst du mir helfen?", "Can you help me? (dative)"], ["Ich gebe ihm das Buch.", "I give him the book."]] },
    ]
  },
  {
    id: "possessives", sec: "Nouns & Cases", title: "Possessives", summary: "mein, dein, sein … take ein-endings.", blocks: [
      { p: "mein, dein, sein, ihr, unser, euer, ihr/Ihr. They follow the ein-pattern for gender and case." },
      { ex: [["Das ist mein Buch.", "That is my book."], ["Wo ist deine Tasche?", "Where is your bag?"], ["Ich sehe seinen Bruder.", "I see his brother. (acc. masc → -en)"]] },
    ]
  },
  {
    id: "esgibt", sec: "Nouns & Cases", title: "es gibt (there is / are)", summary: "One handy phrase, always with the accusative.", blocks: [
      { p: "'es gibt' = there is / there are. It never changes form and is always followed by the accusative." },
      { ex: [["Es gibt einen Supermarkt.", "There is a supermarket."], ["Gibt es hier eine Toilette?", "Is there a toilet here?"], ["Es gibt keine Probleme.", "There are no problems."]] },
    ]
  },

  // ===== VERBS =====
  {
    id: "modals", sec: "Verbs", title: "Modal verbs", summary: "können, müssen, wollen … verb 2nd, infinitive last.", blocks: [
      { p: "The modal sits in position 2; the main verb goes to the end as an infinitive." },
      { table: { head: ["", "können", "müssen", "wollen", "dürfen"], rows: [["ich", "kann", "muss", "will", "darf"], ["du", "kannst", "musst", "willst", "darfst"], ["er/sie/es", "kann", "muss", "will", "darf"], ["wir", "können", "müssen", "wollen", "dürfen"]] } },
      { ex: [["Ich kann Deutsch sprechen.", "I can speak German."], ["Du musst jetzt gehen.", "You have to go now."], ["Darf ich hier rauchen?", "May I smoke here?"]] },
    ]
  },
  {
    id: "moechten", sec: "Verbs", title: "Likes & wishes: mögen, möchten, gern", summary: "How to say what you like and would like.", blocks: [
      { p: "mögen = to like (something). möchten = would like (polite wish). gern + verb = to like doing something." },
      { ex: [["Ich mag Kaffee.", "I like coffee."], ["Ich möchte einen Tee, bitte.", "I'd like a tea, please."], ["Ich spiele gern Fußball.", "I like playing football."]] },
      { tip: "Preference ladder: gern → lieber → am liebsten. 'Ich trinke lieber Tee.' = I prefer tea." },
    ]
  },
  {
    id: "imperative", sec: "Verbs", title: "Imperative (commands)", summary: "Telling someone to do something.", blocks: [
      { table: { head: ["Form", "How", "Example"], rows: [["du", "stem, no ending", "Komm! / Geh! / Nimm!"], ["ihr", "stem + -t", "Kommt! / Geht!"], ["Sie", "infinitive + Sie", "Kommen Sie! / Gehen Sie!"]] } },
      { ex: [["Warte bitte hier!", "Wait here please! (du)"], ["Steh bitte auf!", "Get up please! (separable)"], ["Sprechen Sie langsamer, bitte.", "Speak more slowly, please. (Sie)"]] },
      { tip: "e→i stem-changers keep the change (nehmen → Nimm!), but a→ä verbs drop the umlaut (fahren → Fahr!)." },
    ]
  },
  {
    id: "separable", sec: "Verbs", title: "Separable verbs", summary: "The prefix flies to the end of the clause.", blocks: [
      { p: "Verbs like aufstehen, einkaufen, anrufen split in the present tense — the prefix moves to the end." },
      { ex: [["Ich stehe um 7 auf.", "I get up at 7."], ["Er kauft jeden Tag ein.", "He shops every day."], ["Ich rufe dich später an.", "I'll call you later."]] },
      { tip: "In the Perfekt the prefix rejoins around -ge-: aufgestanden, eingekauft, angerufen." },
    ]
  },
  {
    id: "perfekt", sec: "Verbs", title: "Perfekt tense", summary: "The everyday past: haben/sein + past participle.", blocks: [
      { p: "haben or sein (position 2) + past participle (at the end). Participles: regular ge-…-t (gemacht), irregular ge-…-en (gegessen, getrunken)." },
      { p: "Use sein for movement and change of state (gehen, fahren, kommen, bleiben, aufstehen); haben for everything else." },
      { ex: [["Ich habe Pizza gegessen.", "I ate pizza."], ["Ich bin nach Hause gegangen.", "I went home."], ["Sie hat das Buch gelesen.", "She read the book."]] },
    ]
  },

  // ===== ADJECTIVES & ADVERBS =====
  {
    id: "adjendings", sec: "Adjectives & Adverbs", title: "Adjective endings", summary: "Endings shift after der-words vs ein-words.", blocks: [
      { p: "An adjective before a noun takes an ending. After a definite article (der/die/das) the endings are 'weak':" },
      { table: { head: ["nach der", "masc", "fem", "neut", "Plural"], rows: [["Nominativ", "-e", "-e", "-e", "-en"], ["Akkusativ", "-en", "-e", "-e", "-en"], ["Dativ", "-en", "-en", "-en", "-en"]] } },
      { p: "After an indefinite article (ein/kein/mein) the adjective carries more info ('mixed'):" },
      { table: { head: ["nach ein", "masc", "fem", "neut"], rows: [["Nominativ", "-er", "-e", "-es"], ["Akkusativ", "-en", "-e", "-es"], ["Dativ", "-en", "-en", "-en"]] } },
      { ex: [["der alte Mann / ein alter Mann", "the / an old man"], ["das kleine Kind / ein kleines Kind", "the / a small child"], ["Ich sehe den alten Mann.", "I see the old man. (acc → -en)"]] },
      { tip: "With no article the adjective takes the der-endings itself: kalter Kaffee, frische Milch." },
    ]
  },
  {
    id: "comparison", sec: "Adjectives & Adverbs", title: "Comparison (bigger, biggest)", summary: "Comparative -er and superlative am …sten.", blocks: [
      { p: "Comparative: adjective + -er (often + umlaut). Superlative: am + adjective + -sten. 'als' = than; 'so … wie' = as … as." },
      { table: { head: ["Adjektiv", "Komparativ", "Superlativ"], rows: [["schnell", "schneller", "am schnellsten"], ["alt", "älter", "am ältesten"], ["gut", "besser", "am besten"], ["viel", "mehr", "am meisten"], ["gern", "lieber", "am liebsten"], ["hoch", "höher", "am höchsten"]] } },
      { ex: [["Anna ist schneller als Tom.", "Anna is faster than Tom."], ["München ist so schön wie Wien.", "Munich is as nice as Vienna."]] },
    ]
  },
  {
    id: "adverbs", sec: "Adjectives & Adverbs", title: "Adverbs of frequency & time", summary: "How often, and when.", blocks: [
      { p: "Frequency: immer (always), oft (often), manchmal (sometimes), selten (rarely), nie (never). They usually come right after the verb." },
      { ex: [["Ich trinke immer Kaffee.", "I always drink coffee."], ["Er kommt selten zu spät.", "He's rarely late."]] },
      { p: "Time words: heute (today), morgen (tomorrow), gestern (yesterday), jetzt (now), bald (soon), früh/spät (early/late)." },
    ]
  },

  // ===== SENTENCES & PREPOSITIONS =====
  {
    id: "conjunctions", sec: "Sentences & Prepositions", title: "Conjunctions", summary: "Joining clauses — and what they do to word order.", blocks: [
      { p: "Coordinating conjunctions (und, oder, aber, denn, sondern) sit between two main clauses and do NOT change word order — the verb stays second." },
      { ex: [["Ich bleibe zu Hause, denn ich bin müde.", "I'm staying home, because I'm tired."], ["Ich trinke Tee, aber er trinkt Kaffee.", "I drink tea, but he drinks coffee."]] },
      { p: "Subordinating conjunctions (weil, dass, wenn, ob) send the verb to the very end of their clause." },
      { ex: [["Ich bleibe zu Hause, weil ich müde bin.", "… because I'm tired."], ["Ich weiß, dass du Recht hast.", "I know that you're right."]] },
    ]
  },
  {
    id: "wechsel", sec: "Sentences & Prepositions", title: "Two-way prepositions", summary: "Location vs. direction decides the case.", blocks: [
      { p: "an, auf, hinter, in, neben, über, unter, vor, zwischen take the dative for location (where?) and the accusative for direction (where to?)." },
      { ex: [["Ich bin im Café.", "I'm in the café. (location → dative)"], ["Ich gehe in das Café.", "I go into the café. (direction → accusative)"]] },
      { tip: "Ask 'Wo?' → dative, 'Wohin?' → accusative." },
    ]
  },
  {
    id: "timeprep", sec: "Sentences & Prepositions", title: "Prepositions of time", summary: "am, um, im and friends.", blocks: [
      { table: { head: ["Preposition", "Use", "Example"], rows: [["am", "days & dates", "am Montag, am 3. Mai"], ["um", "clock time", "um 8 Uhr"], ["im", "months & seasons", "im Januar, im Sommer"], ["von … bis", "from … to", "von 9 bis 17 Uhr"], ["seit", "since (dative)", "seit 2020"], ["vor / nach", "before / after (dative)", "vor dem Essen"]] } },
      { ex: [["Am Wochenende schlafe ich lange.", "At the weekend I sleep in."], ["Der Kurs ist um 18 Uhr.", "The class is at 6 p.m."]] },
    ]
  },

  // ===== NUMBERS & TIME =====
  {
    id: "numbers", sec: "Numbers & Time", title: "Numbers", summary: "Counting, and the famous reversed teens.", blocks: [
      { p: "0 null, 1 eins, 2 zwei, 3 drei, 4 vier, 5 fünf, 6 sechs, 7 sieben, 8 acht, 9 neun, 10 zehn, 11 elf, 12 zwölf." },
      { p: "From 21, German says the units first: 21 = einundzwanzig (one-and-twenty), 34 = vierunddreißig. Hundreds: 100 hundert, 1000 tausend." },
      { p: "Ordinals (1st, 2nd …): add -te up to 19, -ste from 20. Irregular: erste (1.), dritte (3.), siebte (7.), achte (8.)." },
      { ex: [["Ich bin einundzwanzig Jahre alt.", "I'm 21 years old."], ["Heute ist der dritte Mai.", "Today is the 3rd of May."]] },
    ]
  },
  {
    id: "time", sec: "Numbers & Time", title: "Telling the time", summary: "Watch out — halb means half TO the next hour!", blocks: [
      { p: "Es ist … Uhr. For minutes: 'nach' (past) and 'vor' (to). 'Viertel' = quarter." },
      { ex: [["Es ist drei Uhr.", "It's three o'clock."], ["Es ist Viertel nach drei.", "3:15"], ["Es ist Viertel vor vier.", "3:45"], ["Es ist halb vier.", "3:30 (lit. 'half four' = half to four!)"]] },
      { tip: "'halb' counts toward the NEXT hour: halb drei = 2:30, not 3:30. Officially you can also just say 'vierzehn Uhr dreißig'." },
    ]
  },
  {
    id: "dates", sec: "Numbers & Time", title: "Days, months & dates", summary: "All masculine — der Montag, der Mai.", blocks: [
      { table: { head: ["Wochentage", "Monate (Jan–Jun)", "Monate (Jul–Dez)"], rows: [["Montag, Dienstag", "Januar, Februar", "Juli, August"], ["Mittwoch, Donnerstag", "März, April", "September, Oktober"], ["Freitag, Samstag, Sonntag", "Mai, Juni", "November, Dezember"]] } },
      { p: "Days, months and seasons are all masculine (der). Seasons: der Frühling, der Sommer, der Herbst, der Winter." },
      { ex: [["Welcher Tag ist heute?", "What day is it today?"], ["Am Montag, dem 12. April.", "On Monday the 12th of April."]] },
    ]
  },
];

const GRAMMAR_SECTIONS = ["Basics", "Questions & Negation", "Nouns & Cases", "Verbs", "Adjectives & Adverbs", "Sentences & Prepositions", "Numbers & Time"];

function Block({ b }) {
  if (b.p) return <p style={{ margin: "0 0 10px", fontSize: 13.5, color: "#c3cad6", lineHeight: 1.6 }}>{b.p}</p>;
  if (b.tip) return <div style={{ fontSize: 12.5, color: "#9aa6b6", background: "#13161c", border: "1px solid #1f2630", borderRadius: 8, padding: "8px 11px", margin: "0 0 10px", lineHeight: 1.5 }}>💡 {b.tip}</div>;
  if (b.ex) return (
    <div style={{ margin: "0 0 10px", display: "flex", flexDirection: "column", gap: 4 }}>
      {b.ex.map(([de, en], i) => (
        <div key={i} style={{ fontSize: 13, lineHeight: 1.5 }}>
          <span style={{ color: "#f1f5f9", fontWeight: 600 }}>{de}</span>
          <span style={{ color: FAINT }}>  ·  {en}</span>
        </div>
      ))}
    </div>
  );
  if (b.table) return (
    <div style={{ overflowX: "auto", margin: "0 0 12px" }}>
      <table style={{ borderCollapse: "collapse", fontSize: 12.5, minWidth: "100%" }}>
        <thead><tr>{b.table.head.map((h, i) => <th key={i} style={{ textAlign: "left", padding: "4px 12px 4px 0", color: MUTE, fontWeight: 600, borderBottom: "1px solid #2a2a2a", whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
        <tbody>{b.table.rows.map((r, ri) => (
          <tr key={ri}>{r.map((c, ci) => <td key={ci} style={{ padding: "4px 12px 4px 0", color: ci === 0 ? MUTE : "#e2e8f0", fontStyle: ci === 0 ? "italic" : "normal", whiteSpace: "nowrap" }}>{c}</td>)}</tr>
        ))}</tbody>
      </table>
    </div>
  );
  return null;
}

function GrammatikView() {
  const [open, setOpen] = useState("cases");
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const match = (t) => !q || t.title.toLowerCase().includes(q) || t.summary.toLowerCase().includes(q) || t.sec.toLowerCase().includes(q);

  return (
    <div>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search grammar topics…"
        style={{ width: "100%", background: "#161616", border: "1px solid #2a2a2a", borderRadius: 10, padding: "9px 13px", color: TXT, fontSize: 14, marginBottom: 16 }} />
      {GRAMMAR_SECTIONS.map((sec) => {
        const topics = GRAMMAR_TOPICS.filter((t) => t.sec === sec && match(t));
        if (!topics.length) return null;
        return (
          <div key={sec} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, color: "#22c55e", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, marginBottom: 8 }}>{sec}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {topics.map((t) => {
                const isOpen = open === t.id;
                return (
                  <div key={t.id} onClick={() => setOpen(isOpen ? null : t.id)}
                    style={{ background: "#141414", border: `1px solid ${isOpen ? "#22c55e55" : "#242424"}`, borderRadius: 12, padding: "12px 15px", cursor: "pointer", transition: "border-color .15s" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: "#f1f5f9" }}>{t.title}</span>
                      <span style={{ color: FAINT, fontSize: 14, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }}>›</span>
                    </div>
                    {!isOpen && <div style={{ fontSize: 12.5, color: MUTE, marginTop: 3 }}>{t.summary}</div>}
                    {isOpen && (
                      <div className="dm-reveal" style={{ marginTop: 12, borderTop: "1px solid #242424", paddingTop: 12 }} onClick={(e) => e.stopPropagation()}>
                        {t.blocks.map((b, i) => <Block key={i} b={b} />)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────
const FONT = "ui-sans-serif, -apple-system, 'Segoe UI', Roboto, system-ui, sans-serif";
const TOTAL = CATEGORIES.reduce((s, c) => s + DB[c.key].length, 0);

export default function DeutschMeister() {
  const [activeCat, setActiveCat] = useState(0);
  const [view, setView] = useState("quiz"); // quiz | browse | stats
  const [progress, setProgress] = useState({});
  const [levelFilter, setLevelFilter] = useState("All");

  useEffect(() => { loadProgress().then(setProgress); }, []);
  useEffect(() => { try { window.speechSynthesis.getVoices(); } catch { } }, []);
  // Preload Google Identity Services eagerly so the Drive "Connect" button
  // can call requestAccessToken() synchronously on click (required for the
  // OAuth popup to work on iOS Safari).
  useEffect(() => { drive.preloadGis().catch(() => { }); }, []);

  // ── Drive auto-sync: silently pull+merge on load, push on hide/unload ──
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const [driveStatus, setDriveStatus] = useState({ connected: false, busy: false, lastSync: null, error: null });

  useEffect(() => {
    drive.isConnected().then((connected) => {
      setDriveStatus((s) => ({ ...s, connected }));
      if (!connected) return;
      (async () => {
        try {
          setDriveStatus((s) => ({ ...s, busy: true }));
          const remote = await drive.pullProgress({ interactive: false });
          if (remote) {
            const merged = drive.mergeProgress(progressRef.current, remote);
            setProgress(merged);
            await saveProgress(merged);
          }
          setDriveStatus((s) => ({ ...s, busy: false, lastSync: Date.now(), error: null }));
        } catch (e) {
          setDriveStatus((s) => ({ ...s, busy: false, error: e.message }));
        }
      })();
    });
  }, []);

  useEffect(() => {
    const pushIfConnected = () => {
      if (!driveStatus.connected) return;
      drive.pushProgress(progressRef.current, { interactive: false }).catch(() => { });
    };
    const onVisibility = () => { if (document.visibilityState === "hidden") pushIfConnected(); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", pushIfConnected);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", pushIfConnected);
    };
  }, [driveStatus.connected]);


  const cat = CATEGORIES[activeCat];
  const allLevels = useMemo(() => levelsPresent(DB[cat.key]), [cat]);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: TXT, fontFamily: FONT }}>
      <style>{`
        @keyframes dmReveal { from { opacity:0; transform: translateY(4px); } to { opacity:1; transform:none; } }
        .dm-reveal { animation: dmReveal .18s ease; }
        .dm-opt:focus-visible { outline: 2px solid #60a5fa; outline-offset: 2px; }
        * { box-sizing: border-box; }
        ::selection { background:#3b82f655; }
      `}</style>

      {/* Sticky header */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(15,15,15,0.92)", backdropFilter: "blur(8px)", borderBottom: "1px solid #1e1e1e", paddingTop: "env(safe-area-inset-top)" }}>
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.3px" }}>🇩🇪 Deutsch Meister</div>
              <div style={{ fontSize: 11, color: "#4a4f59", marginTop: 1 }}>{TOTAL} words · A1</div>
            </div>
            <div style={{ display: "flex", gap: 4, background: "#161616", borderRadius: 9, padding: 4 }}>
              {[["quiz", "📚 Quiz"], ["browse", "🔍 Browse"], ["grammatik", "📖 Grammatik"], ["stats", "📊 Stats"]].map(([m, label]) => (
                <button key={m} onClick={() => setView(m)}
                  style={{
                    padding: "6px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12,
                    background: view === m ? "#2a2a2a" : "transparent", color: view === m ? "#f1f5f9" : "#5b626f", fontWeight: view === m ? 600 : 400
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Category pills */}
          {view !== "stats" && view !== "grammatik" && (
            <div style={{ display: "flex", gap: 6 }}>
              {CATEGORIES.map((t, i) => (
                <button key={t.id} onClick={() => setActiveCat(i)}
                  style={{
                    flex: 1, padding: "8px 4px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600,
                    background: activeCat === i ? t.color : "#161616", color: activeCat === i ? "#fff" : "#6b7280"
                  }}>
                  {t.label}
                  <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.75 }}>{DB[t.key].length}</div>
                </button>
              ))}
            </div>
          )}

          {/* Level filter — appears once more than one level exists */}
          {view !== "stats" && view !== "grammatik" && allLevels.length > 1 && (
            <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
              {["All", ...allLevels].map((L) => (
                <button key={L} onClick={() => setLevelFilter(L)}
                  style={{
                    padding: "4px 12px", borderRadius: 7, border: "1px solid #2a2a2a", cursor: "pointer", fontSize: 11.5,
                    background: levelFilter === L ? "#2a2a2a" : "transparent", color: levelFilter === L ? "#f1f5f9" : MUTE
                  }}>{L}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Body — natural page scroll, no fixed heights */}
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "18px 16px 80px", width: "100%" }}>
        {view === "stats" && <StatsView progress={progress} setProgress={setProgress} levelFilter={levelFilter} driveStatus={driveStatus} setDriveStatus={setDriveStatus} />}
        {view === "grammatik" && <GrammatikView />}
        {view === "browse" && <BrowseView key={cat.id} cat={cat} progress={progress} levelFilter={levelFilter} />}
        {view === "quiz" && <QuizView key={cat.id} cat={cat} progress={progress} setProgress={setProgress} levelFilter={levelFilter} />}
      </div>
    </div>
  );
}
