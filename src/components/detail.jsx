// ── Detail renderers (card backs) ─────────────────────────────
// Pure presentational components for the back of each word card,
// one per category. Plus the noun declension/gender helpers.
import { COLORS, TXT, MUTE, FAINT } from "../config/theme";

export function VerbTable({ v }) {
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
        {"  ·  "}Perfekt mit: <span style={{ color: v.hs === "sein" ? COLORS.streak : COLORS.der, fontWeight: 700 }}>{v.hs}</span>
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

export function NounDetail({ it }) {
  const gender = it.a === "der" ? "maskulin" : it.a === "die" ? "feminin" : "neutrum";
  const hint = genderHint(it);
  const gc = it.a === "der" ? COLORS.der : it.a === "die" ? COLORS.die : COLORS.das;
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

export function AdjDetail({ it }) {
  return (
    <div style={{ marginTop: 12, fontSize: 13, color: MUTE, display: "flex", gap: 16, flexWrap: "wrap" }}>
      <span>Komparativ: <b style={{ color: TXT }}>{it.cmp}</b></span>
      <span>Superlativ: <b style={{ color: TXT }}>{it.sup}</b></span>
      {it.opp && it.opp !== "–" && <span style={{ width: "100%" }}>Gegenteil: <b style={{ color: TXT }}>{it.opp}</b></span>}
    </div>
  );
}

export function GramDetail({ it }) {
  return (
    <div style={{ marginTop: 12, fontSize: 13, color: MUTE, display: "flex", flexDirection: "column", gap: 4 }}>
      <div>{it.wt} · <span style={{ fontStyle: "italic" }}>{it.st}</span></div>
      {it.ce && it.ce !== "None — keeps word order" && <div>Fall/Effekt: <b style={{ color: TXT }}>{it.ce}</b></div>}
      {it.mh && <div style={{ fontSize: 12.5, color: FAINT, fontStyle: "italic", marginTop: 4, lineHeight: 1.5 }}>💡 {it.mh}</div>}
    </div>
  );
}

export function PhraseDetail({ it }) {
  return (
    <div style={{ marginTop: 10 }}>
      <span style={{ background: "#1f1f1f", borderRadius: 6, padding: "3px 9px", fontSize: 11.5, color: "#eab308", fontWeight: 600 }}>{it.c}</span>
    </div>
  );
}

export function OtherDetail({ it }) {
  const CAT_COLORS = {
    "Pronoun": "#a855f7", "Article": "#3b82f6", "Preposition": "#f97316",
    "Conjunction": "#eab308", "Adverb": "#22c55e", "Number": "#ec4899",
    "Function Word": "#06b6d4",
  };
  const c = CAT_COLORS[it.c] || "#06b6d4";
  return (
    <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
      <span style={{ background: "#1f1f1f", borderRadius: 6, padding: "3px 9px", fontSize: 11.5, color: c, fontWeight: 600 }}>{it.c}</span>
    </div>
  );
}
