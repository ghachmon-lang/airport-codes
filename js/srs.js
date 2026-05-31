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

/*
 * Build the queue for a study session.
 *   - All items currently due (most overdue first) so she clears her backlog.
 *   - Then new items, up to `newLimit`, to grow her deck gradually.
 * Returns an array of item ids in the order they should be shown.
 */
function buildSessionQueue(itemsById, { now = Date.now(), newLimit = 12 } = {}) {
  const all = Object.values(itemsById);

  const due = all
    .filter((it) => isDue(it, now))
    .sort((a, b) => a.due - b.due); // most overdue first

  const fresh = all.filter(isNew).slice(0, Math.max(0, newLimit));

  return [...due.map((it) => it.id), ...fresh.map((it) => it.id)];
}

// Counts for the home/stats screen.
function summarize(itemsById, now = Date.now()) {
  const all = Object.values(itemsById);
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
  summarize,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = SRS_API;
}
