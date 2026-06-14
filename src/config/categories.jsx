// ── Category registry (the word-type extension core) ──────────
// To add a category: push ONE descriptor here. Declare its data
// `key` (→ public/data/<key>.json), colour, catOf() for sub-grouping,
// german() for TTS, a detail renderer, and its quiz modes[]. The
// quiz/browse/stats engine is generic and needs no further edits.
//
// Schemas (compact keys, kept from the original data):
//   noun {w,a,e,c,p,ex,n}   verb {w,e,t,p2,hs,pr,pt,pk}
//   adj  {w,e,c,cmp,sup,opp,ex}   gram {w,e,wt,st,ce,ex,mh}
import { mcq, distractors } from "../engine/quiz";
import {
  NounDetail, VerbTable, AdjDetail, GramDetail, PhraseDetail, OtherDetail,
} from "../components/detail";

export const CATEGORIES = [
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
  {
    id: "other", label: "Other", color: "#06b6d4", key: "other",
    catOf: (x) => x.c,
    german: (x) => x.w,
    detail: (it) => <OtherDetail it={it} />,
    modes: [
      { id: "translation", label: "DE → EN", build: (it, p) => mcq(it.w, "What does this word mean?", it.e, distractors(p, it.e, "e")) },
      { id: "german", label: "EN → DE", build: (it, p) => mcq(it.e, "Say this in German", it.w, distractors(p, it.w, "w")) },
    ],
  },
];

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);

export function subcatsOf(cat, pool) {
  return [...new Set(pool.map(cat.catOf))].filter(Boolean).sort();
}
