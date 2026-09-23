// ── Wrong answers that test the form, not the vocabulary ──────
// The plural, Partizip II and er-form quiz modes used to fill their options
// with other words' forms: "der Tisch → die Tische / die Lampen / die
// Bücher", where the stem gives the answer away and the question never asks
// whether it is Tische, Tischen or Tischer. These build the wrong options
// from the word itself, the way a learner would get it wrong: the wrong
// plural ending, the wrong umlaut, a weak participle for a strong verb, ge-
// in the wrong place, the ihr-form for the er-form.
//
// A wrong option that is in fact also correct is worse than an easy one, so
// every generator stays away from forms German allows as alternatives
// (die Worte beside die Wörter, gesandt beside gesendet, die Kontos beside
// die Konten).
//
// Free of imports so scripts/check-kasus.mjs can run it in Node.

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const pick = (cands, answer, n, bad = () => false) => {
  const out = [];
  for (const c of shuffle([...new Set(cands)])) {
    if (!c || c === answer || bad(c)) continue;
    out.push(c);
    if (out.length >= n) break;
  }
  return out;
};

// Umlaut the last a, o, u or au of a word (Vater → Väter, Haus → Häus).
// null when there is nothing to umlaut.
function umlaut(w) {
  // A doubled vowel umlauts once: der Saal → die Säle, das Boot → *Böte.
  const dbl = w.match(/^(.*)(aa|oo)([^aeiouäöü]*)$/i);
  if (dbl) return dbl[1] + (dbl[2][0] === "a" ? "ä" : dbl[2][0] === "A" ? "Ä" : dbl[2][0] === "o" ? "ö" : "Ö") + dbl[3];
  const i = Math.max(w.lastIndexOf("a"), w.lastIndexOf("o"), w.lastIndexOf("u"),
    w.lastIndexOf("A"), w.lastIndexOf("O"), w.lastIndexOf("U"));
  if (i < 0) return null;
  const c = w[i];
  if ((c === "u" || c === "U") && /[aA]/.test(w[i - 1] || "")) {
    return w.slice(0, i - 1) + (w[i - 1] === "a" ? "ä" : "Ä") + "u" + w.slice(i + 1);
  }
  const map = { a: "ä", o: "ö", u: "ü", A: "Ä", O: "Ö", U: "Ü" };
  return w.slice(0, i) + map[c] + w.slice(i + 1);
}

// ── Plural ────────────────────────────────────────────────────
// Nouns with a second plural that is also standard German, often with its
// own meaning (die Worte / die Wörter, die Banken / die Bänke). None of
// these may be offered as a wrong answer.
const ALT_PLURALS = {
  Wort: ["Worte", "Wörter"], Bank: ["Bänke", "Banken"], Mutter: ["Mütter", "Muttern"],
  Ding: ["Dinge", "Dinger"], Wagen: ["Wagen", "Wägen"], Magen: ["Magen", "Mägen"],
  Kragen: ["Kragen", "Krägen"], Bogen: ["Bogen", "Bögen"], Laden: ["Läden", "Laden"],
  Schild: ["Schilder", "Schilde"], Band: ["Bänder", "Bände", "Bands"], Gesicht: ["Gesichter", "Gesichte"],
  Land: ["Länder", "Lande"], Strauß: ["Sträuße", "Strauße"], Block: ["Blöcke", "Blocks"],
  Park: ["Parks", "Parke"], Balkon: ["Balkone", "Balkons"], Schal: ["Schals", "Schale"],
  Tunnel: ["Tunnel", "Tunnels"], Kumpel: ["Kumpel", "Kumpels"], Onkel: ["Onkel", "Onkels"],
  Kerl: ["Kerle", "Kerls"], Junge: ["Jungen", "Jungs"], Mädel: ["Mädel", "Mädels"],
  Pizza: ["Pizzen", "Pizzas"], Konto: ["Konten", "Kontos"], Risiko: ["Risiken", "Risikos"],
  Komma: ["Kommas", "Kommata"], Thema: ["Themen"], Globus: ["Globen", "Globusse"],
  Atlas: ["Atlanten", "Atlasse"], Kaktus: ["Kakteen", "Kaktusse"], Visum: ["Visa", "Visen"],
  Praktikum: ["Praktika"], Espresso: ["Espressos", "Espressi"], Cappuccino: ["Cappuccinos", "Cappuccini"],
  Pony: ["Ponys"], Stock: ["Stöcke", "Stockwerke"], Rat: ["Räte", "Ratschläge"],
  Saal: ["Säle"], Mann: ["Männer", "Mannen"], Tuch: ["Tücher", "Tuche"],
  Stiefel: ["Stiefel"], Keks: ["Kekse"], Zeh: ["Zehen", "Zehe"], Zehe: ["Zehen"],
  Muskel: ["Muskeln"], Lexikon: ["Lexika", "Lexiken"], Material: ["Materialien"],
  Album: ["Alben", "Albums"], Forum: ["Foren", "Fora"], Bonus: ["Boni", "Bonusse"],
  Klima: ["Klimas", "Klimata", "Klimate"], Schema: ["Schemas", "Schemata", "Schemen"],
  Ballon: ["Ballons", "Ballone"], Karton: ["Kartons", "Kartone"], Datum: ["Daten", "Data"],
};
const altsOf = (sg) => {
  const key = Object.keys(ALT_PLURALS).find((k) => sg === k || sg.endsWith(k.toLowerCase()));
  return key ? ALT_PLURALS[key].map((a) => sg.slice(0, sg.length - key.length) + (sg === key ? a : a.toLowerCase())) : [];
};

// Wrong plurals of the noun `it` ({ w, p }), each with "die ", or [] when
// the headword is not a single noun.
export function pluralDistractors(it, n = 3) {
  const m = String(it.w).match(/^(der|die|das)\s+(\S+)$/);
  const pm = String(it.p || "").trim().match(/^die\s+(\S+)$/);
  if (!m || !pm) return [];
  const sg = m[2];
  const answer = pm[1];
  const u = umlaut(sg);
  let cands;
  if (/e$/.test(sg)) {
    cands = [sg + "n", sg + "s", sg, u && u + "n", sg + "r"];
  } else if (/(chen|lein)$/.test(sg)) {
    cands = [sg + "s", sg + "e", u];
  } else if (/(er|el)$/.test(sg)) {
    cands = [sg, sg + "n", sg + "s", u, u && u + "n"];
  } else if (/en$/.test(sg)) {
    cands = [sg, sg + "s", u, sg + "e"];
  } else if (/([aeiouy]|um|us)$/.test(sg) && !/(aus|ei)$/.test(sg) && (sg.match(/[aeiouyäöü]+/g) || []).length > 1) {
    // Latin/Greek and other loans (das Museum, die Firma, das Konto).
    // Their -s plural is often a valid variant after a vowel (die Kontos,
    // die Pizzas), so it is only offered where the answer is itself -s.
    const stem = sg.replace(/(um|us|a|o)$/, "");
    cands = [stem + "en", stem + "a", stem + "ien", sg + "en", sg + "e", sg + "s"]
      .filter((c) => !(c === sg + "s" && /[aeiouy]$/.test(sg)));
  } else {
    cands = [sg + "e", sg + "en", sg + "er", sg + "s", sg, u && u + "e", u && u + "er"];
  }
  const alts = new Set(altsOf(sg));
  // An -s plural beside a native one (die Parks, die Jungs) is colloquial
  // but real for many nouns ending in -el/-er, so it is never offered to
  // them as wrong.
  // Masculine and neuter loans in -on take -s or -e (die Balkons, die
  // Balkone), so neither is offered as wrong; -ion is German and takes -en.
  // After s, ß, x or z a bare -s (*die Hauss) is not a spelling anyone
  // would consider.
  const bad = (c) => alts.has(c) || (/[^i]on$/.test(sg) && (c === sg + "s" || c === sg + "e")) ||
    (/[sßxz]$/.test(sg) && c === sg + "s");
  return pick(cands, answer, n, bad).map((c) => "die " + c);
}

// ── Verbs ─────────────────────────────────────────────────────
// Verbs whose weak and strong participle are both standard (or mean
// different things): neither form may be offered as a wrong answer.
const ALT_P2 = {
  senden: ["sendet", "sandt"], wenden: ["wendet", "wandt"], winken: ["winkt", "wunken"],
  saugen: ["saugt", "sogen"], hängen: ["hängt", "hangen"], schrecken: ["schreckt", "schrocken"],
  bewegen: ["wegt", "wogen"], schaffen: ["schafft", "schaffen"], schleifen: ["schleift", "schliffen"],
  weichen: ["weicht", "wichen"], wiegen: ["wiegt", "wogen"],
  melken: ["melkt", "molken"], quellen: ["quellt", "quollen"], schwellen: ["schwellt", "schwollen"],
  löschen: ["löscht", "loschen"],
};

const infOf = (v) => String(v.w).replace(/^sich\s+/, "");
// The separable prefix, read off the present tense (er zieht um → um).
const sepPrefixOf = (v) => {
  if (!v.sep) return "";
  const last = String(v.pr?.er || "").trim().split(/\s+/).pop();
  return last && infOf(v).startsWith(last) ? last : "";
};

export function participleDistractors(v, n = 3) {
  const answer = v.p2;
  if (!answer) return [];
  const inf = infOf(v);
  const pre = sepPrefixOf(v);
  const base = inf.slice(pre.length);
  const stem = /[eä]rn$|eln$/.test(base) ? base.slice(0, -1) : base.replace(/e?n$/, "");
  // Whether the participle takes ge- is read off the answer rather than
  // guessed from the prefix: gehen → gegangen, but gewinnen → gewonnen.
  const afterPre = answer.slice(pre.length);
  const noGe = !afterPre.startsWith("ge") || (base.startsWith("ge") && !afterPre.startsWith("geg"));
  const ge = noGe ? "" : "ge";
  const dental = /([dt]|[^aeiouäöülrhmn][mn])$/.test(stem);   // arbeitet, atmet, öffnet
  const weak = pre + ge + stem + (dental ? "et" : "t");
  const strong = pre + ge + base;
  // A strong Präteritum stem in a participle: *gegingen, *gegingt. A weak
  // Präteritum (machte, brachte) adds nothing the weak form does not.
  const ptFirst = String(v.pt?.er || "").trim().split(/\s+/)[0] || "";
  const strongPt = ptFirst && !/te$/.test(ptFirst) ? ptFirst.replace(/e$/, "") : null; // wurde → wurd
  const fromPast = strongPt && pre + ge + strongPt + "en";
  const fromPastWeak = strongPt && pre + ge + strongPt + (/[dt]$/.test(strongPt) ? "et" : "t");
  // ge- in the wrong place: *geumgezogen for umgezogen, *gestudiert for
  // studiert, *geverstanden for verstanden.
  const misplaced = pre
    ? "ge" + pre + answer.slice(pre.length).replace(/^ge/, "")
    : noGe ? "ge" + answer : null;
  // ge- forgotten: *arbeitet for gearbeitet.
  const bare = ge ? pre + stem + (dental ? "et" : "t") : null;
  const cands = [weak, strong, fromPast, fromPastWeak, misplaced, bare, noGe ? "ge" + base : null];

  const altKey = Object.keys(ALT_P2).find((k) => base.endsWith(k));
  const alts = altKey ? ALT_P2[altKey].map((a) => pre + ge + base.slice(0, base.length - altKey.length) + a) : [];
  const bad = (c) => alts.includes(c);
  return pick(cands, answer, n, bad);
}

// The er-form next to the verb's own other present-tense forms: the
// question becomes "which ending, which vowel" instead of "which verb".
export function presentDistractors(v, n = 3) {
  const pr = v.pr || {};
  return pick([pr.ich, pr.du, pr.wir, pr.ihr], pr.er, n);
}
