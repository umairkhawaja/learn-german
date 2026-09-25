// ── Detail renderers (card backs) ─────────────────────────────
// Pure presentational components for the back of each word card,
// one per category. Plus the noun declension/gender helpers.
import { COLORS, TXT, MUTE, FAINT } from "../config/theme";
import { Tag, UsageNote, splitExample } from "./ui";
import { nounParadigm, isPluralOnly } from "../engine/nounForms";

export function VerbTable({ v }) {
  const rows = [
    ["ich", v.pr.ich, v.pt.ich, v.pk.ich],
    ["du", v.pr.du, v.pt.du, v.pk.du],
    ["er/sie/es", v.pr.er, v.pt.er, v.pk.er],
    ["wir", v.pr.wir, v.pt.wir, v.pk.wir],
    ["ihr", v.pr.ihr, v.pt.ihr, v.pk.ihr],
    // The data has no pt.sie, which left the last Präteritum cell permanently
    // blank. In German the sie/Sie form is always identical to the wir form,
    // so the table can be completed rather than showing a hole — except for
    // the reflexive pronoun: wir freuten uns, but sie freuten sich.
    ["sie/Sie", v.pr.sie, v.pt.sie || (v.pt.wir || "").replace(/\buns\b/, "sich"), v.pk.sie],
  ];
  return (
    <div style={{ marginTop: 12 }}>
      {/* Cells wrap at word boundaries ("haben angefangen" onto two lines),
          and a single long form hyphenates (interes-sierten), so the table
          always fits the card instead of scrolling sideways. */}
      <table lang="de" className="dm-fit" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
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
              <td style={{ padding: "3px 8px", color: TXT }}>{pk}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 10, fontSize: 12.5, color: MUTE, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span>Partizip II: <span lang="de" style={{ color: TXT, fontWeight: 600 }}>{v.refl ? "sich " : ""}{v.p2}</span></span>
        <span>{"·"}</span>
        <span>Perfekt mit: <span lang="de" style={{ color: v.hs === "sein" ? COLORS.streak : COLORS.der, fontWeight: 700 }}>{v.hs}</span></span>
        <span>{"·"}</span>
        <span style={{ color: FAINT }}>{({ irr: "irregular", mix: "mixed", reg: "regular" })[v.t]}</span>
        {v.sep && <Tag color="#7dd3fc" bg="#1e293b" title="The prefix splits off and goes to the end of the clause">trennbar · separable</Tag>}
        {/* Reflexive verbs need their pronoun to be a verb at all; the data
            marks them and the conjugation above now carries mich/dich/sich. */}
        {v.refl && <Tag color="#f0abfc" bg="#2a1533" title="Always used with a reflexive pronoun in the accusative">reflexiv · mich/dich/sich</Tag>}
      </div>

      {v.ex && v.ex.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: FAINT, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>Beispiele</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(Array.isArray(v.ex) ? v.ex : [v.ex]).map((ex, i) => {
              // Split on the FIRST " — " only: a translation may legitimately
              // contain an em dash, and destructuring a 3-way split dropped it.
              const { de, en } = typeof ex === "string" ? splitExample(ex) : { de: ex.de, en: ex.en };
              return (
                <div key={i} style={{ fontSize: 13, lineHeight: 1.5 }}>
                  <span lang="de" style={{ color: TXT }}>{de}</span>
                  {en && <span style={{ color: FAINT }}> — {en}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <UsageNote text={v.n} style={{ marginTop: 10 }} />
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

const CASES = ["Nominativ", "Akkusativ", "Dativ", "Genitiv"];
const CASE_COLORS = [COLORS.nom, COLORS.akk, COLORS.dat, COLORS.gen];

// What the table shows that the learner would not guess from the article
// alone, per noun group.
function declNote(it, d) {
  const head = it.w.replace(/^(der|die|das)\s+/i, "");
  switch (d.kind) {
    case "weak": return "N-noun: adds -(e)n in every case except the nominative singular.";
    case "mixed": return head === "Herz"
      ? "Irregular: dem Herzen, des Herzens — the only neuter noun that declines like this."
      : "Mixed noun: -n like an n-noun, but -ns in the genitive (des Namens).";
    case "adjectival": return it.a === "die"
      ? `Declines like an adjective: der ${head}n in the dative and genitive; plural without article: ${head}.`
      : `Declines like an adjective, so the article changes the ending: ${it.a} ${head}, but ${it.a === "der" ? "ein " + head + "r" : "ein " + head + "s"}.`;
    case "plural-only": return "Only used in the plural. The dative adds -n unless the form already ends in -n or -s.";
    default: return it.a === "die"
      ? "Feminine nouns never change in the singular. The dative plural adds -n unless the plural already ends in -n or -s."
      : "The genitive singular adds -(e)s (-es after s, ß, x, z, sch). The dative plural adds -n unless the plural already ends in -n or -s.";
  }
}

function DeclTable({ it }) {
  // Nouns the paradigm cannot decline with confidence (a multi-word
  // headword that is not adjective + noun) get no table rather than a
  // wrong one.
  const d = nounParadigm(it);
  if (!d) return null;
  // Articles take the noun's gender colour (plural grey), and the case names
  // the case colours, as they do in the Spickzettel.
  const sgColor = isPluralOnly(it) ? COLORS.plural
    : ({ der: COLORS.derText, die: COLORS.dieText, das: COLORS.dasText })[it.a] || COLORS.derText;
  const cell = (pair, color) => pair
    ? <span><span style={{ color, fontWeight: 700 }}>{pair[0]}</span> {pair[1]}</span>
    : <span style={{ color: FAINT }}>—</span>;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11, color: FAINT, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>Deklination</div>
      <div>
        <table lang="de" className="dm-fit" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
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
                <td style={{ padding: "4px 8px 4px 0", color: CASE_COLORS[i], fontWeight: 600, whiteSpace: "nowrap" }}>{c}</td>
                <td style={{ padding: "4px 8px", color: TXT }}>{cell(d.sg?.[i], sgColor)}</td>
                <td style={{ padding: "4px 8px", color: TXT }}>{cell(d.pl?.[i], COLORS.plural)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: FAINT, marginTop: 6, lineHeight: 1.5 }}>{declNote(it, d)}</div>
    </div>
  );
}

// ── Plural pattern ────────────────────────────────────────────
// German courses teach the plural as five patterns rather than as a list to
// memorise word by word, and naming the pattern on the card is what turns
// "die Bücher" from one more fact into an instance of a rule (-er + Umlaut).
// Case matters: the plural of a noun is capitalised, so "Ärzte" needs the
// uppercase umlauts folded too or Arzt → Ärzte reads as irregular.
const deUmlaut = (s) =>
  s.replace(/äu/gi, "au").replace(/[äÄ]/g, (c) => (c === "ä" ? "a" : "A"))
   .replace(/[öÖ]/g, (c) => (c === "ö" ? "o" : "O"))
   .replace(/[üÜ]/g, (c) => (c === "ü" ? "u" : "U"));

// Suffix families, most specific first. "se" covers the -nis nouns that
// double the s (Zeugnis → Zeugnisse).
const PLURAL_SUFFIXES = [
  ["-(e)n", ["nen", "en", "n"]],
  ["-er", ["er"]],
  ["-e", ["se", "e"]],
  ["-s", ["s"]],
];

// `p` doubles as a note field for nouns that have no plural or only a plural
// ("(kein Plural)", "(immer Plural)"), so a parenthesised value is not a form.
const isPluralForm = (p) => !!p && p !== "–" && !/^[([]/.test(p.trim());

function pluralPattern(it) {
  if (!isPluralForm(it.p)) return null;
  const sing = it.w.replace(/^(der|die|das)\s+/i, "").trim();
  const plur = it.p.replace(/^die\s+/i, "").trim();

  for (const [id, suffixes] of PLURAL_SUFFIXES) {
    for (const suf of suffixes) {
      // Exact match: no stem change, just the ending.
      if (plur === sing + suf) return { id, umlaut: false };
      // Same ending once both sides are stripped of umlauts: the plural
      // umlauts the stem (Arzt → Ärzte, Buch → Bücher).
      if (deUmlaut(plur) === deUmlaut(sing) + suf) return { id, umlaut: true };
    }
  }
  if (plur === sing) return { id: "unchanged", umlaut: false };
  if (deUmlaut(plur) === deUmlaut(sing)) return { id: "Umlaut only", umlaut: false };

  // Latin and Greek borrowings form their plural on the original stem —
  // Museum → Museen, Thema → Themen, Stipendium → Stipendien, Konto → Konten.
  // Courses teach these as one group ("Fremdwörter") rather than as
  // exceptions, so they get their own label.
  const stem = sing.replace(/(um|us|a|o|is)$/, "");
  if (stem !== sing && (plur === stem + "en" || plur === stem + "ien" || plur === stem + "a"))
    return { id: "Fremdwort", umlaut: false };

  return null;
}

export function NounDetail({ it }) {
  // A plural-only noun (die Eltern, die Leute) takes "die" because it is
  // plural, not because it is feminine.
  const pluralOnly = isPluralOnly(it);
  const gender = pluralOnly ? "nur Plural" : it.a === "der" ? "maskulin" : it.a === "die" ? "feminin" : "neutrum";
  const hint = pluralOnly ? null : genderHint(it);
  const gc = pluralOnly ? MUTE : it.a === "der" ? COLORS.derText : it.a === "die" ? COLORS.dieText : COLORS.dasText;
  const pattern = pluralPattern(it);
  // 228 nouns have no plural — proper nouns, mass nouns, countries. The card
  // used to render "Plural:" followed by nothing, which reads as missing data
  // rather than as the grammatical fact it is.
  const hasPlural = isPluralForm(it.p);
  const pluralNote = it.p && !hasPlural && /^[([]/.test(it.p.trim()) ? it.p.trim() : null;
  return (
    <div style={{ marginTop: 12, fontSize: 13, color: MUTE }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <span>
          Plural:{" "}
          {hasPlural
            ? <b lang="de" style={{ color: TXT }}>{it.p}</b>
            : <span style={{ color: FAINT }}>{pluralNote || "kein Plural"}</span>}
        </span>
        {it.a && <span>Genus: <b style={{ color: gc }}>{gender}</b></span>}
        {pattern && (
          <Tag color="#c4b5fd" bg="#241e3a" title="Which of the five plural patterns this noun follows">
            {pattern.id}{pattern.umlaut ? " + Umlaut" : ""}
          </Tag>
        )}
      </div>
      {hint && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#9aa6b6", background: "#13161c", border: "1px solid #1f2630", borderRadius: 8, padding: "6px 10px" }}>
          💡 Nouns ending in <b lang="de" style={{ color: TXT }}>-{hint.suffix}</b> are almost always <b style={{ color: gc }}>{hint.art}</b>.
        </div>
      )}
      {it.a && <DeclTable it={it} />}
      {it.n && <div style={{ color: MUTE, fontStyle: "italic", fontSize: 12.5, marginTop: 10, lineHeight: 1.5 }}>{it.n}</div>}
    </div>
  );
}

const has = (v) => v != null && String(v).trim() !== "" && v !== "–";

export function AdjDetail({ it }) {
  // Not every entry in adj.json is a gradable adjective: particles, adverbs,
  // prepositions and ordinals live here too, tagged with `wc`. Showing them a
  // "Komparativ: –" row told the learner nothing; naming the word class tells
  // them why there is no comparative.
  const gradable = has(it.cmp);
  return (
    <div style={{ marginTop: 12, fontSize: 13, color: MUTE, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
      {it.wc && <Tag color="#93c5fd" bg="#1e293b" title="Word class — this is not an adjective">{it.wc}</Tag>}
      {gradable ? (
        <>
          <span>Komparativ: <b lang="de" style={{ color: TXT }}>{it.cmp}</b></span>
          {has(it.sup) && <span>Superlativ: <b lang="de" style={{ color: TXT }}>{it.sup}</b></span>}
        </>
      ) : (
        !it.wc && <span style={{ color: FAINT }}>Keine Steigerung — this adjective does not grade.</span>
      )}
      {has(it.opp) && <span style={{ width: "100%" }}>Gegenteil: <b lang="de" style={{ color: TXT }}>{it.opp}</b></span>}
    </div>
  );
}

// What a grammar word does to the clause is the single most useful thing to
// know about it — whether it kicks the verb to the end, inverts, or governs a
// case — so it is colour-coded rather than left as grey prose.
const CASE_EFFECT = {
  "Verb to end (subordinating)": { color: "#fca5a5", bg: "#2a0d0d" },
  "Verb-Subject swap (inverter)": { color: "#fcd34d", bg: "#2a210d" },
  Accusative: { color: COLORS.akk, bg: COLORS.akkBg },
  Dative: { color: COLORS.dat, bg: COLORS.datBg },
  "Accusative or Dative": { color: "#c4b5fd", bg: "#1f1a2e" },
  Genitive: { color: COLORS.gen, bg: COLORS.genBg },
};

export function GramDetail({ it }) {
  const effect = CASE_EFFECT[it.ce];
  return (
    <div style={{ marginTop: 12, fontSize: 13, color: MUTE, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Tag color="#86efac" bg="#0f2419">{it.wt}</Tag>
        {it.st && <span style={{ fontStyle: "italic", fontSize: 12.5 }}>{it.st}</span>}
      </div>
      {effect && <div>Wirkung: <Tag color={effect.color} bg={effect.bg}>{it.ce}</Tag></div>}
      <UsageNote text={it.mh} style={{ marginTop: 2 }} />
    </div>
  );
}

export function PhraseDetail({ it }) {
  return (
    <div style={{ marginTop: 10 }}>
      <Tag color="#eab308">{it.c}</Tag>
      {/* 89 phrases carry an English usage note — when the greeting stops
          being appropriate, what the standard reply is. It used to sit in the
          `ex` field and be rendered in German quotation marks. */}
      <UsageNote text={it.n} />
    </div>
  );
}

// Word-class colours for other.json. These now match the values the data
// actually holds (see scripts/fix-other-wordclasses.mjs) — the previous map
// was keyed on classes no entry was ever tagged with, so every word fell
// through to the same default colour.
const OTHER_COLORS = {
  Pronoun: "#a855f7", Article: "#3b82f6", Preposition: "#f97316",
  Conjunction: "#eab308", Adverb: "#22c55e", "Question Word": "#ec4899",
  "Number & Time": "#38bdf8", Particle: "#fb7185", Expression: "#14b8a6",
  Adjective: "#c084fc",
};

export function OtherDetail({ it }) {
  return (
    <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
      <Tag color={OTHER_COLORS[it.c] || "#06b6d4"}>{it.c}</Tag>
      <UsageNote text={it.n} style={{ width: "100%" }} />
    </div>
  );
}
