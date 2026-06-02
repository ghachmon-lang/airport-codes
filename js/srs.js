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
  // Consecutive correct answers needed to "know" a brand-new card (same-day OK).
  LEARN_TARGET: 10,
  // Consecutive correct needed to re-learn a card she once knew but later missed.
  RELEARN_TARGET: 3,
  // When still learning (or just missed) a card reappears after this short delay,
  // so it's drilled again within the same session.
  LAPSE_DELAY_MS: 60 * 1000, // 1 minute
  // Once known, the first occasional check is this many days out, then it grows.
  GRAD_INTERVAL_DAYS: 4,
  // Cap on how far apart occasional checks can space.
  MAX_INTERVAL_DAYS: 180,
  // Ease (interval multiplier) bounds for spacing occasional checks.
  MIN_EASE: 1.3,
  MAX_EASE: 2.8,
  START_EASE: 2.3,
  EASE_DROP_ON_MISS: 0.2, // ease falls each time a card is missed
  EASE_GAIN_ON_HIT: 0.05, // ease creeps up on smooth recall
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
    reps: 0, // current streak of consecutive correct answers (resets on a miss)
    learnedOnce: false, // has it ever reached the learn target? (relaxes future target)
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

// Consecutive-correct streak needed for this card to count as "known".
// Drops from 10 to 3 once she's learned it at least once (a later slip only needs
// a quick refresh).
function learnTarget(item) {
  return item.learnedOnce ? SRS.RELEARN_TARGET : SRS.LEARN_TARGET;
}

// "Known": her current correct streak has reached the target for this card.
function isMastered(item) {
  return item.reps >= learnTarget(item);
}

// Still being learned (started but streak not yet at target) — counts against the
// new-card ceiling so intake waits until she gets current cards known.
function isActiveLearning(item) {
  return !isNew(item) && item.reps < learnTarget(item);
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
    // Missed: break the streak, drop ease, reappear within the session.
    next.reps = 0;
    next.lapses = item.lapses + 1;
    next.ease = clampEase(item.ease - SRS.EASE_DROP_ON_MISS);
    next.interval = 0;
    next.due = now + SRS.LAPSE_DELAY_MS;
    return next;
  }

  const wasKnown = isMastered(item); // known before this answer?
  next.reps = item.reps + 1;
  if (next.reps >= SRS.LEARN_TARGET) next.learnedOnce = true; // first full learn
  const target = learnTarget(next);

  if (next.reps < target) {
    // Still learning: keep drilling it this session until the streak reaches target.
    next.interval = 0;
    next.due = now + SRS.LAPSE_DELAY_MS;
  } else if (!wasKnown) {
    // Just reached "known": start occasional checks a few days out.
    next.interval = SRS.GRAD_INTERVAL_DAYS;
    next.due = now + next.interval * SRS.DAY_MS;
  } else {
    // Already known, passing an occasional check: space the next one further out.
    next.ease = clampEase(item.ease + SRS.EASE_GAIN_ON_HIT);
    const grown = Math.round(Math.max(item.interval, SRS.GRAD_INTERVAL_DAYS) * next.ease);
    next.interval = Math.min(SRS.MAX_INTERVAL_DAYS, grown);
    next.due = now + next.interval * SRS.DAY_MS;
  }
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
 *   - Items currently due (so she clears her backlog), then NEW cards.
 *   - New cards are NOT capped per session. Instead they are gated by how many
 *     she's still actively learning: new ones are introduced only up to
 *     `maxActive` cards in flight, so the deck grows in step with her mastery.
 *   - New airports are introduced in curriculum order via `priority`
 *     (hubs first, then major cities, then the rest), shuffled within a tier.
 *   - Within each group the two directions of an airport are spread apart and
 *     never adjacent, so answering DEN→Denver doesn't give away Denver→DEN.
 * Returns an array of item ids in the order they should be shown.
 */
function buildSessionQueue(itemsById, { now = Date.now(), maxActive = 16, allowCodes = null, priority = null, rng = Math.random } = {}) {
  let all = Object.values(itemsById);
  if (allowCodes) all = all.filter((it) => allowCodes.has(it.code)); // study-set filter

  const due = all.filter((it) => isDue(it, now));

  // How much room is there for new cards? Open slots = ceiling minus the cards
  // she's still actively learning. As cards stabilize, room re-opens for more.
  const activeCount = all.filter(isActiveLearning).length;
  const room = Math.max(0, maxActive - activeCount);

  // Group new items by airport, order airports by curriculum priority (lower
  // number first), shuffling within the same priority for variety.
  const newByCode = new Map();
  for (const it of all) {
    if (!isNew(it)) continue;
    const a = newByCode.get(it.code);
    if (a) a.push(it);
    else newByCode.set(it.code, [it]);
  }
  const prio = (code) => (priority && priority[code] != null ? priority[code] : 1);
  const codes = shuffle([...newByCode.keys()], rng).sort((a, b) => prio(a) - prio(b));

  const fresh = [];
  for (const code of codes) {
    if (fresh.length >= room) break;
    for (const it of newByCode.get(code)) {
      if (fresh.length >= room) break;
      fresh.push(it);
    }
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
  isActiveLearning,
  buildSessionQueue,
  arrangeStudyOrder,
  summarize,
  localDayIndex,
  bumpStreak,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = SRS_API;
}
