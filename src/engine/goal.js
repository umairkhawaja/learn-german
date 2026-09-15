// ── The learning goal: N new words a day, and the month that follows ──
//
// The app had a daily goal already, but it counted *cards answered* — and a
// card is not a word. Twenty answers can be the same five words drilled four
// times each; the number went up while nothing new entered your vocabulary.
// "Ten words a day" is the goal people actually set, and the only honest way
// to count it is to count words met for the first time.
//
// That count is derived, not logged: `first` on each progress entry is the
// moment the word was met (engine/progress.applyAnswer writes it once and
// never moves it). Deriving from the progress map rather than keeping a second
// tally means the goal history cannot drift out of step with mastery, and it
// syncs and backs up with everything else — the streak in engine/activity is
// per-device precisely because it is a separate log.
//
// Words met before `first` existed simply have no stamp; they count as learned
// before tracking began, which is what they are.
import { storage } from "../storage";
import { dayKey, shiftDay } from "./activity";

const KEY = "dm-word-goal-v1";

export const DEFAULT_WORD_GOAL = 10;
// The chips offered in Stats. Any whole number in range can be typed instead.
export const WORD_GOAL_CHOICES = [5, 10, 15, 20, 30];
export const MIN_WORD_GOAL = 1;
export const MAX_WORD_GOAL = 100;

export function clampGoal(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return DEFAULT_WORD_GOAL;
  return Math.min(MAX_WORD_GOAL, Math.max(MIN_WORD_GOAL, v));
}

export async function loadWordGoal() {
  try {
    const r = await storage.get(KEY);
    const n = r && r.value ? parseInt(r.value, 10) : NaN;
    if (Number.isFinite(n)) return clampGoal(n);
  } catch { }
  return DEFAULT_WORD_GOAL;
}

export async function saveWordGoal(goal) {
  try { await storage.set(KEY, String(clampGoal(goal))); } catch { }
}

// ── Counting what was learned, and when ───────────────────────
export const monthKey = (ts = Date.now()) => dayKey(ts).slice(0, 7);

export function daysInMonth(ts = Date.now()) {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

// { "2026-09-15": 7, ... } — how many words were met for the first time on
// each day. One pass over the progress map; callers memoise it on `progress`.
export function learnedByDay(progress) {
  const out = {};
  for (const k in progress) {
    const p = progress[k];
    if (!p || !p.total || !Number.isFinite(p.first)) continue;
    const day = dayKey(p.first);
    out[day] = (out[day] || 0) + 1;
  }
  return out;
}

export const learnedOn = (byDay, key) => byDay[key] || 0;
export const learnedToday = (byDay, ts = Date.now()) => learnedOn(byDay, dayKey(ts));

// The last `days` calendar days, oldest first, for the Stats bar strip.
export function recentLearned(byDay, days = 14, ts = Date.now()) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = shiftDay(dayKey(ts), -i);
    out.push({ key, count: learnedOn(byDay, key) });
  }
  return out;
}

// Consecutive days the goal was actually met, ending today — or ending
// yesterday, so a goal still in progress this morning does not read as a
// streak already broken. This is deliberately *not* the practice streak in
// engine/activity: that one counts turning up, this one counts delivering.
export function goalStreak(byDay, goal, ts = Date.now()) {
  if (!goal) return 0;
  const today = dayKey(ts);
  let cursor = learnedOn(byDay, today) >= goal ? today : shiftDay(today, -1);
  let n = 0;
  while (learnedOn(byDay, cursor) >= goal && n < 3650) {
    n++;
    cursor = shiftDay(cursor, -1);
  }
  return n;
}

// ── The month a daily goal adds up to ─────────────────────────
// A monthly target is not a second thing to configure: ten a day through
// September is 300, and that is the number worth seeing.
//
// `expected` is the pace line — where you would be if every day had hit the
// goal — counted from the day you *started* this month, not from the 1st.
// Installing on the 15th and doing your ten does not make you 140 words
// behind; it makes you on pace, one day in. Miss days after that and the gap
// opens exactly as it should.
export function monthStats(byDay, goal, ts = Date.now()) {
  const month = monthKey(ts);
  const today = new Date(ts).getDate();
  const total = daysInMonth(ts);
  let learned = 0, bestDay = 0, daysMet = 0, startedOn = 0;
  for (const key in byDay) {
    if (!key.startsWith(month)) continue;
    const n = byDay[key];
    if (n <= 0) continue;
    const day = parseInt(key.slice(8), 10);
    learned += n;
    if (n > bestDay) bestDay = n;
    if (goal && n >= goal) daysMet++;
    if (!startedOn || day < startedOn) startedOn = day;
  }
  const daysCounted = startedOn ? today - startedOn + 1 : 0;
  const target = goal * total;
  const expected = goal * daysCounted;
  return {
    month, learned, target, expected, bestDay, daysMet, startedOn, daysCounted,
    daysElapsed: today,
    daysTotal: total,
    daysLeft: total - today,
    pace: learned - expected,           // + ahead of the daily goal, − behind
    perDay: daysCounted ? learned / daysCounted : 0,
    remaining: Math.max(0, target - learned),
  };
}
