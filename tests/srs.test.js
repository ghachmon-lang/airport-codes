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

test("'Got it' grows the interval and pushes the due date out", () => {
  let it = Srs.newItem("DEN", "CODE_TO_CITY");
  it = Srs.grade(it, true, now); // 1st success -> 1 day
  assert.strictEqual(it.interval, Srs.SRS.FIRST_INTERVAL_DAYS);
  assert.strictEqual(it.due, now + 1 * DAY);

  it = Srs.grade(it, true, now); // 2nd success -> 3 days
  assert.strictEqual(it.interval, Srs.SRS.SECOND_INTERVAL_DAYS);

  const before = it.interval;
  it = Srs.grade(it, true, now); // 3rd -> interval * ease
  assert.ok(it.interval > before, "interval should keep growing");
});

test("'Missed it' shrinks interval, drops ease, and reappears almost immediately", () => {
  let it = Srs.newItem("DEN", "CODE_TO_CITY");
  it = Srs.grade(it, true, now);
  it = Srs.grade(it, true, now);
  const easeBefore = it.ease;

  it = Srs.grade(it, false, now); // missed
  assert.strictEqual(it.interval, 0);
  assert.strictEqual(it.reps, 0);
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

test("an item becomes 'mastered' after enough successful reviews", () => {
  let it = Srs.newItem("DEN", "CODE_TO_CITY");
  for (let i = 0; i < 8 && !Srs.isMastered(it); i++) it = Srs.grade(it, true, now);
  assert.strictEqual(Srs.isMastered(it), true);
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

test("session queue serves due items first, then caps new items", () => {
  const items = Srs.buildItems(AIRPORTS);
  // Make one item due in the past.
  const dueId = Srs.itemId("DEN", "CODE_TO_CITY");
  items[dueId] = { ...items[dueId], due: now - DAY, interval: 1, reps: 1 };

  const q = Srs.buildSessionQueue(items, { now, newLimit: 5 });
  assert.strictEqual(q[0], dueId, "due item comes first");
  assert.strictEqual(q.length, 1 + 5, "1 due + 5 new");
});

test("summarize counts add up to the total", () => {
  const items = Srs.buildItems(AIRPORTS);
  const s = Srs.summarize(items, now);
  assert.strictEqual(s.new + s.learning + s.mastered, s.total);
});

console.log(`\n${passed} tests passed.`);
