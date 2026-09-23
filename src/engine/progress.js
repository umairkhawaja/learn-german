// ── Progress engine: persistence, keys, mastery + SRS schedule ─
import { storage } from "../storage";
import { RENAMED_KEYS } from "./renamedKeys";

const STORE_KEY = "dm-progress-v2";
const LEGACY_KEY = "dm-progress-v1";

export async function loadProgress() {
  try {
    const r = await storage.get(STORE_KEY);
    if (r && r.value) {
      const data = JSON.parse(r.value);
      const migrated = migrateKeys(data);
      if (migrated !== data) await saveProgress(migrated);
      return migrated;
    }
  } catch { }
  try {
    const old = await storage.get(LEGACY_KEY);
    if (old && old.value) {
      const data = migrateKeys(JSON.parse(old.value));
      await storage.set(STORE_KEY, JSON.stringify(data));
      return data;
    }
  } catch { }
  return {};
}

export async function saveProgress(p) {
  try { await storage.set(STORE_KEY, JSON.stringify(p)); } catch { }
}

export async function clearProgress() {
  try { await storage.delete(STORE_KEY); } catch { }
  try { await storage.delete(LEGACY_KEY); } catch { }
}

export function keyOf(catId, item) {
  return catId + ":" + item.w;
}

// ── Merging two records of one word ───────────────────────────
// Used by sync (driveSync.mergeProgress) and by migrateKeys below. The side
// with more attempts wins (more attempts = more recent); a tie goes to the
// higher mastery.
//
// The "Mark as mastered" flag does not move the attempt count, so it is
// decided on its own. toggleSkip stamps `skipAt`, and the later stamp
// wins — in both directions. It used to be OR'd across sides, which made
// "click to undo" impossible to sync: the other device still had the flag,
// and the next merge put it back. Records from before the stamp existed
// (skipAt missing on both sides) keep the old OR.
export function mergeEntry(a, b) {
  if (!a) return b;
  if (!b) return a;
  const winner = (b.total > a.total || (b.total === a.total && b.mastery > a.mastery)) ? b : a;
  const out = { ...winner };
  const as = a.skipAt || 0, bs = b.skipAt || 0;
  const skip = as === bs ? !!(a.skip || b.skip) : !!(as > bs ? a : b).skip;
  if (skip) out.skip = true; else delete out.skip;
  if (as || bs) out.skipAt = Math.max(as, bs); else delete out.skipAt;
  return out;
}

// Move progress saved under a renamed word's old key to its new key (see
// engine/renamedKeys). Returns the same object when there is nothing to
// move, so callers can tell whether to save.
export function migrateKeys(progress) {
  let out = progress;
  for (const [from, to] of RENAMED_KEYS) {
    if (!out || !out[from]) continue;
    if (out === progress) out = { ...progress };
    out[to] = mergeEntry(out[to], out[from]);
    delete out[from];
  }
  return out;
}

// "Mark as mastered" and its undo. The timestamp lets a sync merge tell
// which side changed the flag last (see mergeEntry).
export function toggleSkip(prev) {
  const base = prev || { mastery: 0, correct: 0, total: 0 };
  return { ...base, skip: !base.skip, skipAt: Date.now() };
}

// A word counts as "mastered" — and is hidden from quiz + review — once it
// reaches 4+ star mastery automatically, or is force-mastered via the
// "Mark as mastered" button (`skip`). This matches the threshold Stats and
// Browse use to display the green "mastered" label, so the label and the
// hide-from-practice behaviour stay in sync.
export const MASTERY_THRESHOLD = 4;
export function isMastered(p) {
  return !!p && (p.skip || p.mastery >= MASTERY_THRESHOLD);
}

// Leitner-style intervals (days) indexed by mastery level 0..5.
const INTERVALS_DAYS = [0, 1, 3, 7, 16, 35];
const DAY = 86400000;

// Apply an answer to a progress entry, returning the new entry.
// Keeps the original mastery/correct/total/skip fields and adds the
// SRS schedule fields `last` (answered at) and `due` (next review).
export function applyAnswer(prev, ok) {
  const base = prev || { mastery: 0, correct: 0, total: 0 };
  const mastery = ok
    ? Math.min(base.mastery + 1, 5)
    : Math.max(base.mastery - 1, 0);
  const now = Date.now();
  return {
    ...base,
    mastery,
    correct: base.correct + (ok ? 1 : 0),
    total: base.total + 1,
    last: now,
    // wrong answers are due again immediately; correct ones step out
    due: ok ? now + INTERVALS_DAYS[mastery] * DAY : now,
  };
}
