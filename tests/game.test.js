/*
 * Tests for the question/lesson engine. Run: node tests/game.test.js
 */
const assert = require("assert");
const { Game } = require("../js/game.js");
const { AIRPORTS, UNITS } = require("../js/data.js");

const byCode = Object.fromEntries(AIRPORTS.map((a) => [a.code, a]));
let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("  ✓ " + name);
}
// deterministic rng
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("every unit code exists and no airport is in two units", () => {
  const seen = new Set();
  for (const u of UNITS)
    for (const c of u.codes) {
      assert.ok(byCode[c], `unknown code ${c} in unit ${u.id}`);
      assert.ok(!seen.has(c), `${c} appears in two units`);
      seen.add(c);
    }
  assert.strictEqual(seen.size, AIRPORTS.length, "every airport is placed");
});

test("multiple-choice questions have 4 unique options including the answer", () => {
  const rng = mulberry32(7);
  const pool = UNITS[0].codes.map((c) => byCode[c]);
  for (let i = 0; i < 30; i++) {
    const target = pool[i % pool.length];
    const q1 = Game.qMcCity(target, pool, AIRPORTS, rng);
    assert.strictEqual(new Set(q1.options).size, 4, "4 unique city options");
    assert.ok(q1.options.includes(q1.answer), "answer present");
    const q2 = Game.qMcCode(target, pool, AIRPORTS, rng);
    assert.strictEqual(new Set(q2.options).size, 4, "4 unique code options");
    assert.ok(q2.options.includes(q2.answer), "answer present");
  }
});

test("lessons are the right length, include a pairs board, and never repeat an airport back-to-back", () => {
  const rng = mulberry32(99);
  for (const u of UNITS.slice(0, 6)) {
    const pool = u.codes.map((c) => byCode[c]);
    const lesson = Game.buildLesson(pool, AIRPORTS, { length: 10, rng });
    assert.strictEqual(lesson.length, 10);
    assert.ok(lesson.some((q) => q.type === "pairs"), "has a pairs board");
    for (let i = 1; i < lesson.length; i++) {
      const prev = lesson[i - 1], cur = lesson[i];
      if (prev.code && cur.code && prev.type !== "pairs" && cur.type !== "pairs")
        assert.notStrictEqual(prev.code, cur.code, "no immediate repeats");
    }
  }
});

test("first exposure is recognition (mc), typing only appears for familiar codes", () => {
  const rng = mulberry32(3);
  const pool = UNITS[1].codes.map((c) => byCode[c]);
  const fresh = Game.buildLesson(pool, AIRPORTS, { length: 10, familiar: () => false, rng });
  for (const q of fresh) {
    if (q.type === "type-code") {
      const earlier = fresh.slice(0, fresh.indexOf(q)).some((p) => p.code === q.code || (p.codes || []).includes(q.code));
      assert.ok(earlier, "type-code only after the airport already appeared");
    }
  }
  const drilled = Game.buildLesson(pool, AIRPORTS, { length: 12, familiar: () => true, rng });
  assert.ok(drilled.some((q) => q.type === "type-code"), "familiar pools get typing questions");
});

test("pairs boards have consistent left/right/answerMap", () => {
  const rng = mulberry32(11);
  const pool = UNITS[2].codes.map((c) => byCode[c]).slice(0, 4);
  const q = Game.qPairs(pool, rng);
  assert.strictEqual(q.left.length, 4);
  assert.strictEqual(q.right.length, 4);
  for (const code of q.left) {
    assert.ok(q.right.includes(q.answerMap[code]), `right side contains match for ${code}`);
  }
});

test("intro questions offer exactly 2 options; first exposures are intros", () => {
  const rng = mulberry32(5);
  const pool = UNITS[0].codes.map((c) => byCode[c]);
  const q = Game.qMcCity(pool[0], pool, AIRPORTS, rng, { intro: true });
  assert.strictEqual(q.options.length, 2, "intro = 2 choices");
  assert.ok(q.options.includes(q.answer));
  const lesson = Game.buildLesson(pool, AIRPORTS, { length: 10, familiar: () => false, rng });
  const firstByCode = {};
  for (const item of lesson) {
    if (item.type === "pairs" || !item.code) continue;
    if (!(item.code in firstByCode)) {
      firstByCode[item.code] = item;
      assert.ok(item.intro, `first exposure of ${item.code} is an intro guess`);
    }
  }
});

test("type-code questions ship a 7-letter tile bank containing the answer's letters", () => {
  const rng = mulberry32(13);
  for (const code of ["DEN", "ORD", "MSY", "YYZ"]) {
    const a = byCode[code];
    const unit = UNITS.find((u) => u.codes.includes(code));
    const q = Game.qTypeCode(a, unit.codes.map((c) => byCode[c]), AIRPORTS, rng);
    assert.strictEqual(q.letters.length, 7, "7 tiles");
    // every answer letter must be available with enough multiplicity (YYZ needs two Ys)
    const bank = q.letters.slice();
    for (const ch of code) {
      const i = bank.indexOf(ch);
      assert.ok(i >= 0, `tile bank for ${code} has '${ch}'`);
      bank.splice(i, 1);
    }
  }
});

test("typed answers are graded case/space-insensitively", () => {
  assert.ok(Game.checkTyped("den", "DEN"));
  assert.ok(Game.checkTyped("  DeN ", "DEN"));
  assert.ok(!Game.checkTyped("DFW", "DEN"));
  assert.ok(!Game.checkTyped("", "DEN"));
});

test("distractors are 3 unique airports, never the target, never a same-city duplicate", () => {
  const rng = mulberry32(21);
  for (const a of AIRPORTS) {
    const unit = UNITS.find((u) => u.codes.includes(a.code));
    const pool = unit.codes.map((c) => byCode[c]);
    const ds = Game.pickDistractors(a, pool, AIRPORTS, rng);
    assert.strictEqual(ds.length, 3, `3 distractors for ${a.code}`);
    const codes = new Set(ds.map((d) => d.code));
    assert.strictEqual(codes.size, 3, "unique");
    assert.ok(!codes.has(a.code), "target excluded");
    assert.ok(!ds.some((d) => d.city === a.city), "no duplicate city text");
  }
});

console.log(`\n${passed} tests passed.`);
