#!/usr/bin/env node
// ── Noun topics: fold the near-duplicate buckets together ─────────────────
//
// The topic dropdown in Browse and Quiz is built from the `c` field, and it
// was offering two names for the same set: "Time & Dates" (5 nouns) alongside
// "Time & Calendar" (115), "Home & Furniture" (4) alongside "Home & Living"
// (152), plus a "Size & Quantity" bucket holding a single word. Picking the
// small one hid the 115 nouns a learner actually wanted.
//
// Usage:
//   node scripts/fix-noun-topics.mjs           # report
//   node scripts/fix-noun-topics.mjs --apply   # write

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, "..", "public/data/nouns.json");
const APPLY = process.argv.includes("--apply");

const MERGE = {
  "Time & Dates": "Time & Calendar",
  "Home & Furniture": "Home & Living",
  "Size & Quantity": "Abstract Concepts",
  Directions: "Travel & Places",
};

const data = JSON.parse(readFileSync(FILE, "utf8"));
let changed = 0;
for (const it of data) {
  if (MERGE[it.c]) { it.c = MERGE[it.c]; changed++; }
}

const counts = {};
for (const x of data) counts[x.c] = (counts[x.c] || 0) + 1;
console.log(`retopiced: ${changed}`);
console.log(`topics: ${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join("  ")}`);

if (APPLY) {
  writeFileSync(FILE, JSON.stringify(data, null, 1) + "\n");
  console.log(`\nWrote ${FILE}`);
} else {
  console.log("\n(dry run — pass --apply to write)");
}
