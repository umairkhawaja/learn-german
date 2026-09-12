#!/usr/bin/env node
// ── Repair clipped example sentences ──────────────────────────────────────
//
// The vocabulary data was extracted from a coursebook at a fixed column width,
// which cut the German half of ~280 example sentences mid-phrase while leaving
// the English translation whole:
//
//     die Familie   "Am Morgen mache ich Frühstück für — In the morning I make
//                    breakfast for the family."
//
// The learner is shown that fragment as a model sentence. This script applies
// the hand-written replacements in scripts/data/example-repairs.json.
//
// Safety: each repair carries the exact text it expects to find. A mismatch is
// skipped and reported rather than written, so the patch is idempotent (a
// second run finds nothing to do) and cannot silently clobber a later edit.
//
// Usage:
//   node scripts/fix-truncated-examples.mjs           # report
//   node scripts/fix-truncated-examples.mjs --apply   # write

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const APPLY = process.argv.includes("--apply");

const repairs = JSON.parse(readFileSync(join(__dirname, "data/example-repairs.json"), "utf8"));

let applied = 0, missed = 0, already = 0;

for (const [file, byWord] of Object.entries(repairs)) {
  if (file.startsWith("_")) continue;
  const path = join(ROOT, "public/data", `${file}.json`);
  const data = JSON.parse(readFileSync(path, "utf8"));
  const byW = new Map(data.map((x) => [x.w, x]));
  let touched = 0;

  for (const [w, [from, to]] of Object.entries(byWord)) {
    const entry = byW.get(w);
    if (!entry) { missed++; console.warn(`? ${file}: no entry "${w}"`); continue; }

    if (Array.isArray(entry.ex)) {
      const i = entry.ex.indexOf(from);
      if (i === -1) {
        if (entry.ex.includes(to)) already++;
        else { missed++; console.warn(`! ${file}/${w}: example not found as written`); }
        continue;
      }
      entry.ex[i] = to;
    } else {
      if (entry.ex !== from) {
        if (entry.ex === to) already++;
        else { missed++; console.warn(`! ${file}/${w}: example not found as written`); }
        continue;
      }
      entry.ex = to;
    }
    touched++; applied++;
  }

  if (touched && APPLY) {
    writeFileSync(path, JSON.stringify(data, null, 1) + "\n");
    console.log(`${file}.json: ${touched} repaired`);
  } else if (touched) {
    console.log(`${file}.json: ${touched} would be repaired`);
  }
}

console.log(`\napplied ${applied} · already current ${already} · not matched ${missed}`);
if (!APPLY) console.log("(dry run — pass --apply to write)");
