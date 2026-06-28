// ── Progress engine: persistence, keys, mastery + SRS schedule ─
import { storage } from "../storage";

const STORE_KEY = "dm-progress-v2";
const LEGACY_KEY = "dm-progress-v1";

export async function loadProgress() {
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
