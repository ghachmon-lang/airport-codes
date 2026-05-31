/*
 * srs.js — the adaptive scheduler (a simplified SM-2 / Leitner algorithm).
 *
 * This is what makes the app "change as she learns": every airport is split into two
 * independent review items (one per direction), and each item carries its own schedule.
 *   - Cards she MISSES come back almost immediately and keep coming back until they stick.
 *   - Cards she GETS get pushed further into the future each time, so knowns are only
 *     re-checked once in a while to confirm they held.
 *
 * Everything here is pure (no DOM, no localStorage) so it can be unit-tested easily.
 */

// Two study directions per airport.
const DIRECTIONS = ["CODE_TO_CITY", "CITY_TO_CODE"];

// Tunable scheduler constants.
const SRS = {
  DAY_MS: 24 * 60 * 60 * 1000,
  // When a card is missed it reappears after this short delay (drilled this session).
  LAPSE_DELAY_MS: 60 * 1000, // 1 minute
  // Ease (interval multiplier) bounds.
  MIN_EASE: 1.3,
  MAX_EASE: 2.8,
  START_EASE: 2.3,
  EASE_DROP_ON_MISS: 0.2, // ease falls each time a card is missed
  EASE_GAIN_ON_HIT: 0.05, // ease creeps up on smooth recall
  // First two successful intervals (in days) before ease-based growth takes over.
  FIRST_INTERVAL_DAYS: 1,
  SECOND_INTERVAL_DAYS: 3,
  // An item is considered "mastered" once its interval reaches this many days.
  MASTERED_INTERVAL_DAYS: 21,
};

// Build the unique id for an airport+direction review item.
function itemId(code, dir) {
  return `${code}|${dir}`;
}

// Create a fresh, never-studied review item.
function newItem(code, dir) {
  return {
    id: itemId(code, dir),
    code,
    dir,
    interval: 0, // in days; 0 = brand new / not yet scheduled
    ease: SRS.START_EASE,
    due: null, // ms timestamp when it's next due; null = new
    reps: 0, // total successful reviews in a row
    lapses: 0, // total times missed
    lastSeen: null,
  };
}

/*
 * Build the full set of review items for the given airport list, preserving any
 * existing progress. Adding/removing airports in data.js won't wipe what she's learned:
 *   - existing items are kept,
 *   - new airports get fresh items,
 *   - items whose airport no longer exists are dropped.
 */
function buildItems(airports, existingById = {}) {
  const items = {};
  for (const a of airports) {
    for (const dir of DIRECTIONS) {
      const id = itemId(a.code, dir);
      // Keep saved progress if present, but refresh code/dir in case of edits.
      items[id] = existingById[id]
        ? { ...newItem(a.code, dir), ...existingById[id], code: a.code, dir }
        : newItem(a.code, dir);
    }
  }
  return items;
}

// Has this item ever been studied?
function isNew(item) {
  return item.due === null;
}

// Is this item due for review at time `now`?
function isDue(item, now) {
  return item.due !== null && item.due <= now;
}

function isMastered(item) {
  return item.interval >= SRS.MASTERED_INTERVAL_DAYS;
}

// Bucket an item for stats display.
function statusOf(item, now) {
  if (isNew(item)) return "new";
  if (isMastered(item)) return "mastered";
  return "learning";
}

function clampEase(ease) {
  return Math.max(SRS.MIN_EASE, Math.min(SRS.MAX_EASE, ease));
}

/*
 * Grade a review and return the UPDATED item (does not mutate the input).
 *   correct === true  -> "Got it"
 *   correct === false -> "Missed it"
 *
 * `now` is the current time in ms (passed in so tests are deterministic).
 */
function grade(item, correct, now = Date.now()) {
  const next = { ...item, lastSeen: now };

  if (!correct) {
    // Missed: reset progress, drop ease, reappear within the session.
    next.reps = 0;
    next.lapses = item.lapses + 1;
    next.ease = clampEase(item.ease - SRS.EASE_DROP_ON_MISS);
    next.interval = 0;
    next.due = now + SRS.LAPSE_DELAY_MS;
    return next;
  }

  // Correct: advance through the schedule.
  next.reps = item.reps + 1;
  if (next.reps === 1) {
    next.interval = SRS.FIRST_INTERVAL_DAYS;
  } else if (next.reps === 2) {
    next.interval = SRS.SECOND_INTERVAL_DAYS;
  } else {
    next.ease = clampEase(item.ease + SRS.EASE_GAIN_ON_HIT);
    next.interval = Math.round(item.interval * next.ease);
  }
  next.due = now + next.interval * SRS.DAY_MS;
  return next;
}

// In-place Fisher–Yates shuffle (rng injectable so tests are deterministic).
function shuffle(arr, rng = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Spread items so the two directions of the same airport land far apart:
// split each airport's directions across two halves, then shuffle each half.
function spreadDirections(items, rng = Math.random) {
  const byCode = new Map();
  for (const it of items) {
    const a = byCode.get(it.code);
    if (a) a.push(it);
    else byCode.set(it.code, [it]);
  }
  const firstHalf = [];
  const secondHalf = [];
  for (const dirs of byCode.values()) {
    shuffle(dirs, rng); // randomize which direction goes early vs late
    dirs.forEach((it, i) => (i % 2 === 0 ? firstHalf : secondHalf).push(it));
  }
  return [...shuffle(firstHalf, rng), ...shuffle(secondHalf, rng)];
}

// Guarantee no two neighbours share an airport code (fixes the half/section seams).
function fixAdjacency(items) {
  for (let i = 1; i < items.length; i++) {
    if (items[i].code === items[i - 1].code) {
      for (let j = i + 1; j < items.length; j++) {
        if (items[j].code !== items[i - 1].code) {
          [items[i], items[j]] = [items[j], items[i]];
          break;
        }
      }
    }
  }
  return items;
}

// Shuffle a set of items into a study order with directions separated; returns ids.
function arrangeStudyOrder(items, rng = Math.random) {
  return fixAdjacency(spreadDirections(items, rng)).map((it) => it.id);
}

/*
 * Build the queue for a study session.
 *   - Items currently due (so she clears her backlog), then new items up to
 *     `newLimit` to grow her deck gradually.
 *   - Within each group the two directions of an airport are spread apart and
 *     never adjacent, so answering DEN→Denver doesn't give away Denver→DEN.
 * Returns an array of item ids in the order they should be shown.
 */
function buildSessionQueue(itemsById, { now = Date.now(), newLimit = 12, allowCodes = null, rng = Math.random } = {}) {
  let all = Object.values(itemsById);
  if (allowCodes) all = all.filter((it) => allowCodes.has(it.code)); // study-set filter

  const due = all.filter((it) => isDue(it, now));

  // New cards: introduce a RANDOM set of airports each session (not always the
  // same ones in data order), keeping an airport's directions together for
  // selection, then capping at `newLimit` cards.
  const newByCode = new Map();
  for (const it of all) {
    if (!isNew(it)) continue;
    const a = newByCode.get(it.code);
    if (a) a.push(it);
    else newByCode.set(it.code, [it]);
  }
  const fresh = [];
  const cap = Math.max(0, newLimit);
  for (const code of shuffle([...newByCode.keys()], rng)) {
    for (const it of newByCode.get(code)) {
      if (fresh.length >= cap) break;
      fresh.push(it);
    }
    if (fresh.length >= cap) break;
  }

  const ordered = [...spreadDirections(due, rng), ...spreadDirections(fresh, rng)];
  fixAdjacency(ordered); // also breaks any same-code pair at the due→new seam
  return ordered.map((it) => it.id);
}

// Counts for the home/stats screen.
function summarize(itemsById, now = Date.now(), allowCodes = null) {
  let all = Object.values(itemsById);
  if (allowCodes) all = all.filter((it) => allowCodes.has(it.code)); // stats for the chosen study set
  let dueNow = 0,
    learning = 0,
    mastered = 0,
    fresh = 0;
  for (const it of all) {
    if (isNew(it)) fresh++;
    else if (isMastered(it)) mastered++;
    else learning++;
    if (isDue(it, now)) dueNow++;
  }
  return { total: all.length, dueNow, learning, mastered, new: fresh };
}

// --- Daily streak -------------------------------------------------------
// A "study day" is a local calendar day on which she reviewed at least one card.

// Whole-day index in LOCAL time (DST-safe: built from local Y/M/D at UTC midnight).
function localDayIndex(ts) {
  const d = new Date(ts);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / SRS.DAY_MS);
}

// Given the previous streak and "now", return the updated streak.
//   - same day        -> unchanged (counts once per day)
//   - the next day     -> +1
//   - a gap (or first) -> resets to 1
function bumpStreak(streak, now = Date.now()) {
  const prev = streak || { count: 0, best: 0, lastDay: null };
  const today = localDayIndex(now);
  if (prev.lastDay === today) return prev;
  const count = prev.lastDay === today - 1 ? prev.count + 1 : 1;
  const best = Math.max(prev.best || 0, count);
  return { count, best, lastDay: today };
}

// Export for both browser (<script>) and Node (tests).
const SRS_API = {
  DIRECTIONS,
  SRS,
  itemId,
  newItem,
  buildItems,
  isNew,
  isDue,
  isMastered,
  statusOf,
  grade,
  buildSessionQueue,
  arrangeStudyOrder,
  summarize,
  localDayIndex,
  bumpStreak,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = SRS_API;
}
