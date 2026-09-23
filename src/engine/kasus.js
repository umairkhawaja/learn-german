// ── Kasus engine: decline article + adjective + noun, build drills ─
// Every answer this file produces comes out of the four standard German
// declension tables below (definite article, ein-word endings, and the weak /
// mixed / strong adjective endings) applied to a noun from nouns.json. No
// question is written by hand, so none can be written wrong — and
// scripts/check-kasus.mjs holds the tables against textbook paradigms on
// every build.
//
// It is deliberately free of imports so the check script can run it in Node.

export const CASES = ["nom", "akk", "dat", "gen"];
export const CASE_LABEL = { nom: "Nominativ", akk: "Akkusativ", dat: "Dativ", gen: "Genitiv" };
export const CASE_SHORT = { nom: "Nom", akk: "Akk", dat: "Dat", gen: "Gen" };

// Gender/number slot: m, f, n (singular) and pl.
export const SLOTS = ["m", "f", "n", "pl"];
export const SLOT_LABEL = { m: "maskulin", f: "feminin", n: "neutrum", pl: "Plural" };
export const SLOT_SHORT = { m: "m", f: "f", n: "n", pl: "Pl" };

// ── Determiners ───────────────────────────────────────────────
// `def` = der/die/das; `ein`, `kein`, `mein` are ein-words; `none` is the
// Nullartikel. `ein` has no plural (its plural is the Nullartikel).
export const DETS = ["def", "ein", "kein", "mein", "none"];
export const DET_LABEL = { def: "der/die/das", ein: "ein", kein: "kein", mein: "mein", none: "ohne Artikel" };

const DEF = {
  nom: { m: "der", f: "die", n: "das", pl: "die" },
  akk: { m: "den", f: "die", n: "das", pl: "die" },
  dat: { m: "dem", f: "der", n: "dem", pl: "den" },
  gen: { m: "des", f: "der", n: "des", pl: "der" },
};

const EIN_END = {
  nom: { m: "", f: "e", n: "", pl: "e" },
  akk: { m: "en", f: "e", n: "", pl: "e" },
  dat: { m: "em", f: "er", n: "em", pl: "en" },
  gen: { m: "es", f: "er", n: "es", pl: "er" },
};

// Adjective endings by what precedes the adjective.
//   weak   — after a der-word (the article already shows the case)
//   mixed  — after an ein-word (nom m / nom-akk n have no ending on ein)
//   strong — no article: the adjective carries the der-word ending itself
const ADJ_END = {
  weak: {
    nom: { m: "e", f: "e", n: "e", pl: "en" },
    akk: { m: "en", f: "e", n: "e", pl: "en" },
    dat: { m: "en", f: "en", n: "en", pl: "en" },
    gen: { m: "en", f: "en", n: "en", pl: "en" },
  },
  mixed: {
    nom: { m: "er", f: "e", n: "es", pl: "en" },
    akk: { m: "en", f: "e", n: "es", pl: "en" },
    dat: { m: "en", f: "en", n: "en", pl: "en" },
    gen: { m: "en", f: "en", n: "en", pl: "en" },
  },
  strong: {
    nom: { m: "er", f: "e", n: "es", pl: "e" },
    akk: { m: "en", f: "e", n: "es", pl: "e" },
    dat: { m: "em", f: "er", n: "em", pl: "en" },
    gen: { m: "en", f: "er", n: "en", pl: "er" },
  },
};

export function article(det, kase, slot) {
  if (det === "none") return "";
  if (det === "def") return DEF[kase][slot];
  if (det === "ein" && slot === "pl") return null; // no plural of ein
  return det + EIN_END[kase][slot];
}

export function adjEnding(det, kase, slot) {
  const table = det === "def" ? "weak" : det === "none" ? "strong" : "mixed";
  return ADJ_END[table][kase][slot];
}

export function adjTableOf(det) {
  return det === "def" ? "weak" : det === "none" ? "strong" : "mixed";
}

// Adjectives used in the drill. Kept to ones whose stem never changes
// (no teuer → teure, dunkel → dunkle, hoch → hohe) and that sit naturally
// in front of almost any noun.
export const DRILL_ADJS = ["neu", "alt", "groß", "klein", "schön", "gut"];

// ── Nouns ─────────────────────────────────────────────────────
// The engine only takes a noun when every form it needs is certain. It is
// cheaper to drop a noun than to teach a wrong ending, so the filter is
// strict:
//   • one plain word, article der/die/das, a real plural form;
//   • no masculine/neuter noun whose plural is singular + (e)n — that catches
//     every n-noun (der Student → den Studenten) and the mixed ones (der
//     Name → des Namens, das Herz → dem Herzen) that do not follow the
//     regular pattern in the singular;
//   • no noun ending in -e that comes from an adjective (der/die Deutsche,
//     der Bekannte, die Angestellte) — those decline like adjectives;
//   • no masculine/neuter noun ending in -s, whose genitive (des Busses,
//     des Zeugnisses, des Tourismus) no simple rule gets right, and none
//     whose plural is the singular unchanged after a sibilant (das Quiz,
//     des Quiz) or that is an English loan in -service (des Service).
const ADJ_NOUN = /(ende|ene|ige|liche|sche|te)$/;
const fold = (w) => w.toLowerCase().replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u");

// `adjSet` (optional) is the set of adjectives in adj.json: a noun in -e
// whose stem is one of them (die Deutsche ← deutsch) is dropped too.
export function drillNoun(it, adjSet) {
  if (!it || !["der", "die", "das"].includes(it.a)) return null;
  const m = String(it.w).match(/^(der|die|das)\s+([A-ZÄÖÜ][a-zäöüß]+)$/);
  if (!m || m[1] !== it.a) return null;
  const sg = m[2];
  const p = String(it.p || "").trim();
  const pm = p.match(/^die\s+([A-ZÄÖÜ][a-zäöüß]+)$/);
  if (!pm) return null;
  const pl = pm[1];
  // A "plural" much longer than the noun is a different word standing in
  // for a missing plural (der Stock → die Stockwerke, der Sport → die
  // Sportarten); declining it as this noun's plural would teach nonsense.
  if (fold(pl).length - fold(sg).length > 3 || fold(pl).slice(0, 2) !== fold(sg).slice(0, 2)) return null;
  const slot = { der: "m", die: "f", das: "n" }[it.a];
  if (slot !== "f") {
    if (pl === sg + "n" || pl === sg + "en") return null;
    if (/s$/.test(sg)) return null;
    if (pl === sg && /(z|x)$/.test(sg)) return null;
    if (/service$/i.test(sg)) return null;
  }
  if (/e$/.test(sg) && pl === sg + "n") {
    if (ADJ_NOUN.test(sg)) return null;
    if (adjSet && adjSet.has(sg.slice(0, -1).toLowerCase())) return null;
  }
  return { w: it.w, sg, pl, slot, e: it.e, lvl: it.lvl || "A1" };
}

const VOWEL_END = /[aeiouyäöü]$/i;
const syllables = (w) => (w.match(/[aeiouyäöü]+/gi) || []).length;

// Genitive singular masculine/neuter. Nouns in -s never reach here
// (drillNoun drops them). ß, x, z and sch force -es (des Tisches, des
// Platzes, des Fußes). One-syllable nouns take -es (des Tages, des Kindes —
// -s is also allowed, -es is never wrong); vowel endings and longer nouns
// take -s (des Autos, des Lehrers, des Computers).
export function genitiveSg(sg, pl) {
  if (/(ß|x|z|sch)$/.test(sg)) return sg + "es";
  // s-plural loanwords take -s: des Teams, des Jobs, des Hotels.
  if (pl && pl === sg + "s") return sg + "s";
  // A vowel or a silent h after one (der Schuh) takes -s.
  if (VOWEL_END.test(sg) || /[aeiouyäöü]h$/i.test(sg)) return sg + "s";
  return syllables(sg) <= 1 ? sg + "es" : sg + "s";
}

// Every form a one-syllable genitive may take, for the typing mode.
// Only a one-syllable noun that took -es by the syllable rule may also be
// spelled with -s (des Tages / des Tags); a sibilant's -es is obligatory.
export function genitiveAlternatives(sg, pl) {
  const main = genitiveSg(sg, pl);
  return main === sg + "es" && !/(ß|x|z|sch)$/.test(sg) ? [main, sg + "s"] : [main];
}

// Dative plural adds -n to a plural in -e, -er or -el (den Tischen, den
// Kindern, den Äpfeln). A plural already in -n or -s, in another vowel (die
// Praktika → den Praktika, die Kiwis) or in any other consonant takes nothing.
export function dativePl(pl) {
  return /(e|er|el)$/.test(pl) ? pl + "n" : pl;
}

export function nounForm(noun, kase, number) {
  if (number === "pl") return kase === "dat" ? dativePl(noun.pl) : noun.pl;
  if (kase === "gen" && noun.slot !== "f") return genitiveSg(noun.sg, noun.pl);
  return noun.sg;
}

// ── Prepositions ──────────────────────────────────────────────
// The fixed case of each preposition is textbook fact. Only prepositions
// that make sense in front of an arbitrary thing are drilled (seit, nach
// and während want a time or a place, zwischen wants two things).
export const PREPS = {
  akk: ["durch", "für", "gegen", "ohne", "um"],
  dat: ["aus", "bei", "mit", "von", "zu", "gegenüber"],
  gen: ["wegen", "trotz", "statt"],
};
// Wechselpräpositionen: Wo? → Dativ, Wohin? → Akkusativ.
export const TWO_WAY = ["an", "auf", "hinter", "in", "neben", "über", "unter", "vor"];

// Contractions of preposition + definite article that standard German
// uses by default. (aufs, übers, fürs… are colloquial, so the drill keeps
// those spelled out and never offers them.)
const CONTRACT = {
  "an dem": "am", "an das": "ans", "in dem": "im", "in das": "ins",
  "bei dem": "beim", "von dem": "vom", "zu dem": "zum", "zu der": "zur",
};

export function contract(prep, art) {
  return CONTRACT[`${prep} ${art}`] || null;
}

// ── Building one phrase ───────────────────────────────────────
// Returns { text, … } or null when the combination is not drilled: ein +
// plural does not exist, a bare singular count noun is not a phrase, and a
// bare plural with no adjective has nothing to decline but the dative -n
// (and no genitive at all — German says von + Dativ instead).
export function decline({ noun, det, adj, kase, number, prep }) {
  const slot = number === "pl" ? "pl" : noun.slot;
  if (det === "ein" && slot === "pl") return null;
  if (det === "none" && slot !== "pl") return null;
  if (det === "none" && !adj) return null;
  const art = article(det, kase, slot);
  const adjForm = adj ? adj + adjEnding(det, kase, slot) : "";
  const n = nounForm(noun, kase, number);
  let lead = prep || "";
  let artOut = art;
  if (prep && det === "def") {
    const c = contract(prep, art);
    if (c) { lead = c; artOut = ""; }
  }
  const text = [lead, artOut, adjForm, n].filter(Boolean).join(" ");
  return { text, lead, artOut, art, adj: adjForm, noun: n, slot };
}

// Why the answer is what it is, in one line — the rule, not the answer.
export function explain({ noun, det, adj, kase, number, prep, where }) {
  const slot = number === "pl" ? "pl" : noun.slot;
  const bits = [];
  if (prep) {
    if (TWO_WAY.includes(prep)) bits.push(`${prep} + ${where === "wohin" ? "Wohin? → Akkusativ" : "Wo? → Dativ"}`);
    else bits.push(`${prep} → ${CASE_LABEL[kase]}`);
  } else bits.push(CASE_LABEL[kase]);
  bits.push(SLOT_LABEL[slot]);
  if (adj) {
    const t = adjTableOf(det);
    const tn = t === "weak" ? "nach der-Wort" : t === "strong" ? "ohne Artikel" : "nach ein-Wort";
    bits.push(`Adjektiv ${tn} → -${adjEnding(det, kase, slot)}`);
  }
  if (number === "pl" && kase === "dat" && dativePl(noun.pl) !== noun.pl) bits.push("Dativ Plural: Nomen + -n");
  if (number !== "pl" && kase === "gen" && noun.slot !== "f") bits.push("Genitiv m/n: Nomen + -(e)s");
  return bits.join(" · ");
}

// ── Cells: what the weak-spot grid tracks ─────────────────────
// One cell = case × slot × determiner × with/without adjective. Progress for
// a cell is stored in the shared progress map under "kasus:<cell>".
export const KASUS_CAT_ID = "kasus";
export const cellId = ({ kase, slot, det, adj }) => `${kase}|${slot}|${det}|${adj ? "adj" : "-"}`;

// All valid cells for a filter selection.
export function cellsFor({ cases, slots, dets, adjModes }) {
  const out = [];
  for (const kase of cases) for (const slot of slots) for (const det of dets) for (const a of adjModes) {
    const adj = a === "adj";
    if (det === "ein" && slot === "pl") continue;
    if (det === "none" && slot !== "pl") continue;
    if (det === "none" && !adj) continue;
    out.push({ kase, slot, det, adj });
  }
  return out;
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Build one multiple-choice question for a cell.
//   context "plain"  — the case is named; decline the phrase
//   context "prep"   — a fixed-case preposition; the case is NOT named
//   context "twoway" — a Wechselpräposition with Wo?/Wohin?
export function buildQuestion(cell, nounsBySlot, context = "plain") {
  const { kase, slot, det } = cell;
  let prep = null, where = null;
  if (context === "twoway") {
    if (kase !== "akk" && kase !== "dat") return null;
    prep = pick(TWO_WAY);
    where = kase === "akk" ? "wohin" : "wo";
  } else if (context === "prep") {
    if (kase === "nom") return null;
    // "ohne keine …" is a double negative, not a drill.
    prep = pick(PREPS[kase].filter((p) => !(det === "kein" && p === "ohne")));
  }
  const pool = slot === "pl" ? [...nounsBySlot.m, ...nounsBySlot.f, ...nounsBySlot.n] : nounsBySlot[slot];
  if (!pool || pool.length === 0) return null;
  const noun = pick(pool);
  const adj = cell.adj ? pick(DRILL_ADJS) : null;
  const number = slot === "pl" ? "pl" : "sg";
  const spec = { noun, det, adj, kase, number, prep, where };
  const right = decline(spec);
  if (!right) return null;

  // Distractors are the same phrase in the other cases, then with the other
  // genders' endings — exactly the mix-ups the drill is for. Anything that
  // comes out identical to the answer (die neue Tür is Nom and Akk) is
  // dropped, so a distractor can never be a second right answer.
  const cands = [];
  for (const k of CASES) {
    if (k === kase) continue;
    const r = decline({ ...spec, kase: k });
    if (r) cands.push(r.text);
  }
  for (const s of SLOTS) {
    if (s === slot || (s === "pl") !== (slot === "pl")) continue;
    const fake = { ...noun, slot: s };
    const r = decline({ ...spec, noun: fake });
    if (r) cands.push(r.text);
  }
  if (adj) {
    // Right article, wrong adjective ending.
    for (const end of ["e", "en", "er", "es", "em"]) {
      cands.push([right.lead, right.artOut, adj + end, right.noun].filter(Boolean).join(" "));
    }
  }
  // An uncontracted "zu dem" beside the answer "zum" would be a second,
  // if stilted, right answer — never offer it.
  const banned = new Set([right.text]);
  if (prep && det === "def" && contract(prep, right.art)) {
    banned.add([prep, right.art, right.adj, right.noun].filter(Boolean).join(" "));
  }
  const seen = new Set(banned);
  const distract = [];
  for (const c of shuffleCopy(cands)) {
    if (seen.has(c)) continue;
    seen.add(c);
    distract.push(c);
    if (distract.length >= 3) break;
  }

  const accepted = new Set([right.text]);
  // Typing mode accepts the uncontracted form and either genitive spelling.
  if (prep && det === "def" && contract(prep, right.art)) {
    accepted.add([prep, right.art, right.adj, right.noun].filter(Boolean).join(" "));
  }
  if (number !== "pl" && kase === "gen" && noun.slot !== "f") {
    for (const g of genitiveAlternatives(noun.sg, noun.pl)) {
      accepted.add([prep, right.art, right.adj, g].filter(Boolean).join(" "));
    }
  }

  return {
    cell, context, prep, where, noun, adj, det, kase, number,
    answer: right.text,
    accepted: [...accepted],
    options: shuffleCopy([right.text, ...distract]),
    why: explain(spec),
  };
}

function shuffleCopy(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Loose compare for the typing mode: case-insensitive on the first letter
// only would still let "Dem" pass, so compare exactly apart from spacing.
export function normalize(s) {
  return String(s).trim().replace(/\s+/g, " ");
}
