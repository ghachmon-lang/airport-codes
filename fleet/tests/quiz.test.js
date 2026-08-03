/*
 * Tests for the Plane Spotting quiz engine. Run: node tests/quiz.test.js
 */
const assert = require("assert");
const { Quiz } = require("../js/quiz.js");
const { FLEET, RIVALS } = require("../js/data.js");

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("  ✓ " + name);
}
// deterministic rng (same mulberry32 as the airport app's tests)
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("fleet data is well-formed", () => {
  const ids = new Set();
  for (const t of FLEET) {
    for (const k of ["id", "name", "family", "maker", "body", "spot", "sil"])
      assert.ok(t[k], `${t.id || "?"} missing ${k}`);
    assert.ok(!ids.has(t.id), `duplicate id ${t.id}`);
    ids.add(t.id);
    assert.ok(t.aisles === 1 || t.aisles === 2);
    assert.ok(t.seats > 100 && t.seats < 500, `${t.id} seats ${t.seats} implausible`);
  }
  for (const [id, rivals] of Object.entries(RIVALS)) {
    assert.ok(ids.has(id), `RIVALS key ${id} not in FLEET`);
    for (const r of rivals) {
      assert.ok(ids.has(r), `rival ${r} of ${id} not in FLEET`);
      assert.notStrictEqual(r, id, `${id} is its own rival`);
    }
  }
});

test("questions have 4 unique options including the answer", () => {
  const rng = mulberry32(7);
  for (let i = 0; i < 40; i++) {
    const target = FLEET[i % FLEET.length];
    const q = Quiz.makeQuestion(target, FLEET, RIVALS, rng);
    assert.strictEqual(q.options.length, 4);
    const ids = q.options.map((o) => o.id);
    assert.strictEqual(new Set(ids).size, 4, "duplicate options");
    assert.ok(ids.includes(q.answer), "answer missing from options");
    assert.strictEqual(q.answer, target.id);
  }
});

test("distractors prefer declared rivals", () => {
  const rng = mulberry32(11);
  let rivalHits = 0, trials = 60;
  for (let i = 0; i < trials; i++) {
    const target = FLEET[0]; // b737-800, rivals a320 + b757-200
    const ds = Quiz.pickDistractors(target, FLEET, RIVALS, rng).map((d) => d.id);
    assert.strictEqual(new Set(ds).size, 3);
    assert.ok(!ds.includes(target.id), "target leaked into distractors");
    if (ds.includes("a320") && ds.includes("b757-200")) rivalHits++;
  }
  assert.strictEqual(rivalHits, trials, "rivals should always be present as distractors");
});

test("rounds avoid back-to-back repeats and hit requested size", () => {
  const rng = mulberry32(23);
  for (let s = 0; s < 20; s++) {
    const round = Quiz.buildRound(FLEET, RIVALS, {}, 8, rng);
    assert.strictEqual(round.length, 8);
    for (let i = 1; i < round.length; i++)
      assert.notStrictEqual(round[i].typeId, round[i - 1].typeId, "same type twice in a row");
  }
});

test("adaptive weighting favors missed types", () => {
  const rng = mulberry32(31);
  // b757-200 missed badly; everything else perfect and well-practiced.
  const stats = {};
  for (const t of FLEET) stats[t.id] = { seen: 20, correct: 20 };
  stats["b757-200"] = { seen: 20, correct: 4 };

  assert.strictEqual(Quiz.typeWeight(FLEET.find((t) => t.id === "b757-200"), stats), 4);
  assert.strictEqual(Quiz.typeWeight(FLEET[0], stats), 1);
  assert.strictEqual(Quiz.typeWeight(FLEET[0], {}), 3, "unseen types run hot");

  let hits = 0, draws = 0;
  for (let i = 0; i < 200; i++) {
    for (const t of Quiz.drawTypes(FLEET, stats, 8, rng)) {
      draws++;
      if (t.id === "b757-200") hits++;
    }
  }
  const share = hits / draws;
  assert.ok(share > 0.3, `missed type only drew ${(share * 100).toFixed(1)}% (want > 30%)`);
});

test("weights stay in sane bounds", () => {
  for (const t of FLEET) {
    assert.strictEqual(Quiz.typeWeight(t, { [t.id]: { seen: 10, correct: 0 } }), 5);
    assert.strictEqual(Quiz.typeWeight(t, { [t.id]: { seen: 10, correct: 10 } }), 1);
  }
});

console.log(`\n${passed} tests passed ✅`);
