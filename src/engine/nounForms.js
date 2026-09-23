// ── Noun paradigms for the card back ──────────────────────────
// The declension table on a noun card shows the definite article + noun in
// all four cases, singular and plural. engine/kasus.js only drills nouns
// whose every form is certain; this module has to produce a table for every
// noun in the list, so it carries the special groups the drill leaves out:
//
//   • n-nouns (der Student → den Studenten), including the irregular
//     obliques der Herr → den Herrn and der Nachbar → den Nachbarn;
//   • mixed nouns (der Name → den Namen, des Namens; das Herz);
//   • adjectival nouns (die Angestellte → der Angestellten);
//   • genitives no simple rule reaches (des Zeugnisses, des Busses,
//     des Tourismus);
//   • nouns that only exist in the plural (die Eltern);
//   • adjective + noun headwords (die möblierte Wohnung).
//
// Anything it cannot decline with confidence (a multi-word headword that is
// not adjective + noun) returns null, and the card simply shows no table:
// no table is better than a wrong one. scripts/check-kasus.mjs holds this
// file to known paradigms on every build.
//
// Free of imports so the check script can run it in Node.

const ART = {
  m: ["der", "den", "dem", "des"],
  f: ["die", "die", "der", "der"],
  n: ["das", "das", "dem", "des"],
  pl: ["die", "die", "den", "der"],
};
const SLOT = { der: "m", die: "f", das: "n" };

// `p` doubles as a note field. A headword that is itself a plural is marked
// "(immer Plural)", "(nur Plural)" or "(meist Plural)".
const PLURAL_ONLY = /\((immer|nur|meist) Plural\)/;
export const isPluralOnly = (it) => PLURAL_ONLY.test(String(it?.p || ""));

// A real plural form ("die Tische"), as opposed to a note or a dash.
export const pluralFormOf = (it) => {
  const m = String(it?.p || "").trim().match(/^die\s+(.+)$/);
  return m ? m[1] : null;
};

// Diphthongs and long vowels count once; any other vowel pair is two
// syllables (Cha-os, Fei-ern).
const syllables = (w) => (w.match(/ei|ie|au|äu|eu|ai|ee|aa|oo|[aeiouyäöü]/gi) || []).length;

// Dative plural: -n after a plural in -e, -er or -el. Plurals already in -n
// or -s, in another vowel (die Praktika, die Kiwis) or in a consonant (die
// SMS) take nothing.
export function dativePlural(pl) {
  return /(e|er|el)$/.test(pl) ? pl + "n" : pl;
}

// ── Special groups ────────────────────────────────────────────
// Mixed nouns: -n in Akk/Dat, -ns in the genitive. Compounds count too
// (der Vorname, der Familienname).
const MIXED = ["Name", "Gedanke", "Glaube", "Buchstabe", "Friede", "Funke", "Wille", "Same", "Haufe"];
const mixedOf = (sg) => MIXED.find((m) => sg === m || sg.endsWith(m.toLowerCase()));

// Masculine nouns that are n-nouns without the tell-tale -e or foreign
// ending (der Mensch, der Held), and strong nouns that look like n-nouns
// because their plural adds -en (der Staat, des Staates).
const WEAK_WORDS = /^(Mensch|Herr|Nachbar|Bauer|Held|Prinz|Graf|Fürst|Bär|Narr|Christ|Kamerad|Rebell)$/;
const WEAK_ENDINGS = /(ist|ent|ant|and|at|et|it|ot|ekt|graf|graph|nom|soph|krat|log|urg|ad)$/;
const STRONG_EN = /^(Staat|Senat|Magistrat|Schmerz|Strahl|Typ|Dorn|Mast|Nerv|Vetter|Sporn|Stachel|Muskel)$/;
const lastPart = (sg) => {
  const m = sg.match(/[A-ZÄÖÜ][a-zäöüß]+$/) || sg.match(/[a-zäöüß]+$/);
  return m ? m[0].charAt(0).toUpperCase() + m[0].slice(1) : sg;
};

// Adjectival nouns decline like adjectives: -en after the article in Dat and
// Gen (and Akk for masculine). For masculine nouns that is identical to the
// n-noun table, so only feminine and neuter ones need naming here.
const ADJECTIVAL = new Set([
  "Angestellte", "Bekannte", "Verwandte", "Erwachsene", "Jugendliche", "Deutsche", "Ehrenamtliche",
  "Selbstständige", "Arbeitslose", "Kranke", "Reisende", "Verlobte", "Vorsitzende", "Alleinerziehende",
  "Richtige", "Gute", "Neue", "Beste", "Einzige", "Beamte", "Fremde", "Fortgeschrittene", "Ermäßigte",
]);

// English and other loans whose genitive no German rule predicts.
const GEN_LOANS = {
  Business: "Business", Jazz: "Jazz", Pilates: "Pilates", Service: "Service", Tennis: "Tennis",
  Golf: "Golfs", Pink: "Pinks",
};

// Genitive singular of a regular masculine/neuter noun.
function genitive(sg, pl) {
  for (const [k, g] of Object.entries(GEN_LOANS)) {
    if (sg.toLowerCase().endsWith(k.toLowerCase())) return sg + g.slice(k.length); // des Kundenservice
  }
  if (/^[A-Z0-9-]+$/.test(sg)) return sg + "s";                    // des WLANs, des PCs
  if (/nis$/.test(sg)) return sg + "ses";                         // des Zeugnisses
  if (/^(Bus|.*bus)$/.test(sg) && syllables(sg) === 1) return sg + "ses"; // des Busses
  if (pl === sg && /(z|x|s)$/.test(sg)) return sg;                // des Quiz
  // Unstressed Latin/Greek -us, -os, -as stay as they are: des Zirkus,
  // des Tourismus, des Chaos. -aus is German Haus and takes -es.
  if (syllables(sg) >= 2 && /(us|os|as)$/.test(sg) && !/aus$/.test(sg)) return sg;
  if (/(s|ß|x|z|sch)$/.test(sg)) return sg + "es";               // des Hauses, des Platzes
  if (pl && pl === sg + "s") return sg + "s";                     // des Jobs, des Teams
  if (/[aeiouyäöü]$/i.test(sg)) return sg + "s";                  // des Autos, des Knies
  return syllables(sg) <= 1 ? sg + "(e)s" : sg + "s";            // des Tag(e)s, des Lehrers
}

// ── The paradigm ──────────────────────────────────────────────
// Returns { sg, pl, kind } where sg and pl are arrays of four
// [article, form] pairs (Nom, Akk, Dat, Gen) or null, and kind names the
// special group the noun belongs to, if any. Returns null when the noun has
// no article (countries, languages) or its headword cannot be declined
// reliably.
export function nounParadigm(it) {
  const slot = SLOT[it?.a];
  if (!slot) return null;
  const head = String(it.w).replace(/^(der|die|das)\s+/i, "").trim();
  const toks = head.split(/\s+/);

  if (isPluralOnly(it)) {
    const last = toks[toks.length - 1];
    const dat = [...toks.slice(0, -1), dativePlural(last)].join(" ");
    return { sg: null, pl: ART.pl.map((a, i) => [a, i === 2 ? dat : head]), kind: "plural-only" };
  }

  const plForm = pluralFormOf(it);

  // Adjective + noun: die möblierte Wohnung, der Englische Garten. The
  // adjective after der/die/das takes the weak endings.
  if (toks.length > 1) {
    if (toks.length !== 2 || !/e$/.test(toks[0])) return null;
    const stem = toks[0].slice(0, -1);
    const noun = toks[1];
    const weak = { m: ["e", "en", "en", "en"], f: ["e", "e", "en", "en"], n: ["e", "e", "en", "en"] }[slot];
    const nounSg = (i) => (i === 3 && slot !== "f" ? genitive(noun, null).replace("(e)s", "s") : noun);
    const sg = ART[slot].map((a, i) => [a, `${stem}${weak[i]} ${nounSg(i)}`]);
    let pl = null;
    if (plForm) {
      const [adjPl, ...rest] = plForm.split(/\s+/);
      const nounPl = rest.join(" ");
      pl = ART.pl.map((a, i) => [a, i === 2 ? `${adjPl} ${dativePlural(nounPl)}` : plForm]);
    }
    return { sg, pl, kind: null };
  }

  const pl = plForm ? ART.pl.map((a, i) => [a, i === 2 ? dativePlural(plForm) : plForm]) : null;
  const sgOf = (forms) => ART[slot].map((a, i) => [a, forms[i]]);

  if (slot === "n" && head === "Herz") {
    return { sg: sgOf(["Herz", "Herz", "Herzen", "Herzens"]), pl, kind: "mixed" };
  }
  if (slot === "m" && mixedOf(head)) {
    return { sg: sgOf([head, head + "n", head + "n", head + "ns"]), pl, kind: "mixed" };
  }
  if (slot !== "m" && ADJECTIVAL.has(head)) {
    const obl = head + "n";
    const forms = slot === "f" ? [head, head, obl, obl] : [head, head, obl, obl];
    return { sg: sgOf(forms), pl, kind: "adjectival" };
  }
  if (slot === "m") {
    const base = lastPart(head);
    const weak =
      !STRONG_EN.test(base) && plForm && (
        WEAK_WORDS.test(base) ||
        (/[^aeiou]e$/.test(head) && plForm === head + "n") ||    // not der See, die Seen
        (WEAK_ENDINGS.test(head) && plForm === head + "en")
      );
    if (weak) {
      // Herr is the one n-noun whose singular oblique is shorter than its
      // plural: den Herrn, die Herren.
      const obl = /herr$/i.test(head) ? head + "n" : plForm;
      return { sg: sgOf([head, obl, obl, obl]), pl, kind: ADJECTIVAL.has(head) ? "adjectival" : "weak" };
    }
  }
  if (slot === "f") return { sg: sgOf([head, head, head, head]), pl, kind: null };
  // der Rock is the skirt (des Rock(e)s) or the music (des Rocks).
  const gen = head === "Rock" && /music/i.test(it.e || "") ? "Rocks" : genitive(head, plForm);
  return { sg: sgOf([head, head, head, gen]), pl, kind: null };
}
