// ── Daily activity: today's count, the streak, the goal ───────
//
// The app already recorded, per word, how it is going. What it never recorded
// is how *you* are going: whether you practised today, and how many days in a
// row you have. That is the one number that keeps a language habit alive, and
// every course app puts it in front of you.
//
// The word-level progress map cannot answer it — `last` is overwritten on
// every answer, so yesterday's evidence is gone as soon as you practise again.
// So this keeps its own small log: one integer per calendar day.
//
// It lives in its own storage key rather than inside the progress map, because
// the progress map is what gets merged across devices per word, and a day
// count is not a per-word fact. That does mean the streak is per-device; the
// mastery it is counting is not.
import { storage } from "../storage";

const KEY = "dm-activity-v1";
const GOAL_KEY = "dm-daily-goal-v1";

export const DEFAULT_GOAL = 20;
export const GOAL_CHOICES = [10, 20, 40, 80];

// Local calendar day, not UTC: a session at 23:30 belongs to the day you
// think it does.
export function dayKey(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const shiftDay = (key, delta) => {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + delta).getTime());
};

export async function loadActivity() {
  try {
    const r = await storage.get(KEY);
    const v = r && r.value ? JSON.parse(r.value) : null;
    if (v && v.days && typeof v.days === "object") return v;
  } catch { }
  return { days: {} };
}

export async function saveActivity(activity) {
  try { await storage.set(KEY, JSON.stringify(activity)); } catch { }
}

export async function loadGoal() {
  try {
    const r = await storage.get(GOAL_KEY);
    const n = r && r.value ? parseInt(r.value, 10) : NaN;
    if (GOAL_CHOICES.includes(n)) return n;
  } catch { }
  return DEFAULT_GOAL;
}

export async function saveGoal(goal) {
  try { await storage.set(GOAL_KEY, String(goal)); } catch { }
}

// Add `n` answers to today's tally, returning the new activity object.
export function addAnswers(activity, n = 1, ts = Date.now()) {
  const key = dayKey(ts);
  const days = { ...activity.days, [key]: (activity.days[key] || 0) + n };
  // A year of daily counts is a few kilobytes; anything older is not shown
  // anywhere, so it is dropped rather than carried forever.
  const cutoff = shiftDay(dayKey(ts), -370);
  for (const k of Object.keys(days)) if (k < cutoff) delete days[k];
  return { ...activity, days };
}

export const answeredOn = (activity, key) => activity.days[key] || 0;
export const answeredToday = (activity, ts = Date.now()) => answeredOn(activity, dayKey(ts));

// Consecutive days ending today — or ending yesterday, so the streak is not
// declared broken at midnight before you have had a chance to practise. A
// streak shown as "3" with nothing done today means "3 so far, keep it".
export function streakOf(activity, ts = Date.now()) {
  const today = dayKey(ts);
  let cursor = answeredOn(activity, today) > 0 ? today : shiftDay(today, -1);
  let n = 0;
  while (answeredOn(activity, cursor) > 0 && n < 3650) {
    n++;
    cursor = shiftDay(cursor, -1);
  }
  return n;
}

// The last `days` calendar days, oldest first, for the activity strip.
export function recentDays(activity, days = 14, ts = Date.now()) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = shiftDay(dayKey(ts), -i);
    out.push({ key, count: answeredOn(activity, key) });
  }
  return out;
}
