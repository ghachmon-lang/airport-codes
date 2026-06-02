/*
 * Minimal, dependency-free tests for the spaced-repetition engine.
 * Run with:  node tests/srs.test.js
 */
const assert = require("assert");
const Srs = require("../js/srs.js");
const { AIRPORTS } = require("../js/data.js");

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("  ✓ " + name);
}

const DAY = Srs.SRS.DAY_MS;
const now = 1_700_000_000_000; // fixed clock

test("a new item is new and not due", () => {
  const it = Srs.newItem("DEN", "CODE_TO_CITY");
  assert.strictEqual(Srs.isNew(it), true);
  assert.strictEqual(Srs.isDue(it, now), false);
});

test("'Got it' builds a streak; the card stays in learning until the 10th correct", () => {
  let it = Srs.newItem("DEN", "CODE_TO_CITY");
  for (let i = 1; i <= 9; i++) {
    it = Srs.grade(it, true, now);
    assert.strictEqual(it.reps, i);
    assert.strictEqual(Srs.isMastered(it), false, `not known yet at ${i} correct`);
    assert.ok(it.due - now <= Srs.SRS.LAPSE_DELAY_MS, "still drilled this session");
  }
  it = Srs.grade(it, true, now); // 10th in a row -> known
  assert.strictEqual(it.reps, 10);
  assert.strictEqual(Srs.isMastered(it), true, "known after 10 in a row");
  assert.strictEqual(it.interval, Srs.SRS.GRAD_INTERVAL_DAYS);
  assert.strictEqual(it.due, now + Srs.SRS.GRAD_INTERVAL_DAYS * DAY, "first check a few days out");
});

test("known cards space their occasional checks further out each time", () => {
  let it = Srs.newItem("DEN", "CODE_TO_CITY");
  for (let i = 0; i < 10; i++) it = Srs.grade(it, true, now); // learn it
  const first = it.interval; // GRAD_INTERVAL_DAYS
  it = Srs.grade(it, true, now); // a later correct check
  assert.ok(it.interval > first, "next check is spaced further out");
  assert.ok(it.interval <= Srs.SRS.MAX_INTERVAL_DAYS, "but capped");
});

test("'Missed it' breaks the streak, drops ease, and reappears almost immediately", () => {
  let it = Srs.newItem("DEN", "CODE_TO_CITY");
  it = Srs.grade(it, true, now);
  it = Srs.grade(it, true, now);
  const easeBefore = it.ease;

  it = Srs.grade(it, false, now); // missed
  assert.strictEqual(it.interval, 0);
  assert.strictEqual(it.reps, 0, "streak resets to zero");
  assert.strictEqual(it.lapses, 1);
  assert.ok(it.ease < easeBefore, "ease should drop on a miss");
  assert.ok(it.due - now <= Srs.SRS.LAPSE_DELAY_MS, "missed card comes back fast");
  assert.strictEqual(Srs.isDue(it, now + Srs.SRS.LAPSE_DELAY_MS), true);
});

test("ease never falls below the floor", () => {
  let it = Srs.newItem("DEN", "CODE_TO_CITY");
  for (let i = 0; i < 20; i++) it = Srs.grade(it, false, now);
  assert.ok(it.ease >= Srs.SRS.MIN_EASE);
});

test("10 correct in a row marks a card known on the same day", () => {
  let it = Srs.newItem("DEN", "CODE_TO_CITY");
  for (let i = 0; i < 10; i++) it = Srs.grade(it, true, now); // all at the SAME `now`
  assert.strictEqual(Srs.isMastered(it), true);
  assert.strictEqual(Srs.isActiveLearning(it), false, "no longer counts against intake");
});

test("after a known card is missed, only 3 correct in a row re-learns it", () => {
  let it = Srs.newItem("DEN", "CODE_TO_CITY");
  for (let i = 0; i < 10; i++) it = Srs.grade(it, true, now); // known
  assert.strictEqual(it.learnedOnce, true);

  it = Srs.grade(it, false, now); // a later slip
  assert.strictEqual(Srs.isMastered(it), false, "back to learning");

  it = Srs.grade(it, true, now); // 1
  it = Srs.grade(it, true, now); // 2
  assert.strictEqual(Srs.isMastered(it), false, "still relearning at 2");
  it = Srs.grade(it, true, now); // 3 -> re-known (quick refresh)
  assert.strictEqual(Srs.isMastered(it), true, "known again after 3 in a row");
});

test("buildItems creates two directions per airport and preserves progress", () => {
  const items = Srs.buildItems(AIRPORTS);
  assert.strictEqual(Object.keys(items).length, AIRPORTS.length * 2);

  // Simulate saved progress, then rebuild — progress should survive.
  const id = Srs.itemId("DEN", "CODE_TO_CITY");
  items[id] = Srs.grade(items[id], true, now);
  const savedReps = items[id].reps;
  const rebuilt = Srs.buildItems(AIRPORTS, items);
  assert.strictEqual(rebuilt[id].reps, savedReps);
});

test("session serves due items first, then new ones up to the active ceiling", () => {
  const items = Srs.buildItems(AIRPORTS);
  // Make one item due in the past.
  const dueId = Srs.itemId("DEN", "CODE_TO_CITY");
  items[dueId] = { ...items[dueId], due: now - DAY, interval: 1, reps: 1 };

  const q = Srs.buildSessionQueue(items, { now, maxActive: 10 });
  assert.strictEqual(q[0], dueId, "due item comes first");
  // 1 active/due card already, so room for 9 more new -> 1 + 9.
  assert.strictEqual(q.length, 10, "fills up to the active ceiling");
});

test("new airports are introduced hubs-first (curriculum order)", () => {
  const { airportTier } = require("../js/data.js");
  const priority = Object.fromEntries(AIRPORTS.map((a) => [a.code, airportTier(a)]));
  const items = Srs.buildItems(AIRPORTS);

  const q = Srs.buildSessionQueue(items, { now, maxActive: 12, priority, rng: mulberry32(1) });
  assert.strictEqual(q.length, 12);
  const tiers = q.map((id) => priority[items[id].code]);
  assert.ok(tiers.every((t) => t === 1), "the first cards introduced are all hubs (tier 1)");
});

test("new-card intake pauses while she's at the active-learning ceiling", () => {
  const items = Srs.buildItems(AIRPORTS);
  // Mark 12 cards as actively learning (started, short interval, not due yet).
  let marked = 0;
  for (const id of Object.keys(items)) {
    if (marked >= 12) break;
    items[id] = { ...items[id], due: now + DAY, interval: 1, reps: 1 };
    marked++;
  }
  const q = Srs.buildSessionQueue(items, { now, maxActive: 10 });
  const newCards = q.filter((id) => Srs.isNew(items[id]));
  assert.strictEqual(newCards.length, 0, "no new cards while over the ceiling");
});

// Tiny seeded PRNG so shuffle-based tests are deterministic.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("the two directions of an airport are never adjacent in a session", () => {
  const items = Srs.buildItems(AIRPORTS);
  const q = Srs.buildSessionQueue(items, { now, maxActive: 40, rng: mulberry32(98765) });
  assert.ok(q.length === 40, "40 new cards queued");
  for (let i = 1; i < q.length; i++) {
    assert.notStrictEqual(
      items[q[i]].code,
      items[q[i - 1]].code,
      `adjacent cards share airport ${items[q[i]].code} at position ${i}`
    );
  }
  // Passing the adjacency check already proves it isn't the raw paired data
  // order (which has each airport's two directions next to each other).
});

test("study-set filter limits the queue and stats to allowed codes", () => {
  const items = Srs.buildItems(AIRPORTS);
  const hubCodes = new Set(AIRPORTS.filter((a) => a.region === "Hub").map((a) => a.code));

  const q = Srs.buildSessionQueue(items, { now, maxActive: 100, allowCodes: hubCodes });
  assert.ok(q.length > 0);
  assert.ok(q.every((id) => hubCodes.has(items[id].code)), "only hub cards in the queue");

  const s = Srs.summarize(items, now, hubCodes);
  assert.strictEqual(s.total, hubCodes.size * 2, "two directions per hub");
});

test("daily streak: increments on consecutive days, resets after a gap", () => {
  const DAY = Srs.SRS.DAY_MS;
  const base = Date.UTC(2026, 5, 10, 15, 0, 0); // mid-month, mid-day (avoids edge cases)

  let s = Srs.bumpStreak({ count: 0, best: 0, lastDay: null }, base);
  assert.strictEqual(s.count, 1);

  s = Srs.bumpStreak(s, base + 3 * 60 * 60 * 1000); // same day -> unchanged
  assert.strictEqual(s.count, 1);

  s = Srs.bumpStreak(s, base + DAY); // next day -> 2
  assert.strictEqual(s.count, 2);

  s = Srs.bumpStreak(s, base + 3 * DAY); // skipped a day -> reset to 1, best kept
  assert.strictEqual(s.count, 1);
  assert.strictEqual(s.best, 2);
});

test("summarize counts add up to the total", () => {
  const items = Srs.buildItems(AIRPORTS);
  const s = Srs.summarize(items, now);
  assert.strictEqual(s.new + s.learning + s.mastered, s.total);
});

console.log(`\n${passed} tests passed.`);
