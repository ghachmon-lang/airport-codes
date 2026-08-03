/*
 * Tests for the Type Ratings quiz engine. Run: node tests/quiz.test.js
 */
const assert = require("assert");
const { Quiz } = require("../js/quiz.js");
const { FLEET, GROUPS, RIVALS, TWINS } = require("../js/data.js");

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
const ctxWith = (stats) => ({ fleet: FLEET, groups: GROUPS, rivals: RIVALS, twins: TWINS, stats });
// stats where every type has n correct (unlocks everything for n >= UNLOCK_CORRECT)
function allCorrect(n) {
  const s = {};
  for (const t of FLEET) s[t.id] = { seen: n, correct: n };
  return s;
}

test("fleet data is well-formed", () => {
  const ids = new Set();
  for (const t of FLEET) {
    for (const k of ["id", "name", "family", "maker", "body", "spot", "clues", "sil"])
      assert.ok(t[k], `${t.id || "?"} missing ${k}`);
    assert.ok(!ids.has(t.id), `duplicate id ${t.id}`);
    ids.add(t.id);
    assert.ok(t.aisles === 1 || t.aisles === 2);
    assert.ok(t.seats > 100 && t.seats < 500, `${t.id} seats implausible`);
    assert.ok(t.lenFt > 90 && t.lenFt < 260, `${t.id} length implausible`);
    assert.ok(t.rangeMi > 2000 && t.rangeMi < 10000, `${t.id} range implausible`);
    assert.strictEqual(t.clues.length, 3, `${t.id} needs exactly 3 clues`);
    assert.strictEqual(t.aisles === 2, t.body === "widebody", `${t.id} aisles/body mismatch`);
  }
  for (const [id, rivals] of Object.entries(RIVALS)) {
    assert.ok(ids.has(id), `RIVALS key ${id} not in FLEET`);
    for (const r of rivals) {
      assert.ok(ids.has(r), `rival ${r} of ${id} not in FLEET`);
      assert.notStrictEqual(r, id, `${id} is its own rival`);
    }
  }
});

test("groups cover every type exactly once", () => {
  const seen = new Set();
  for (const g of GROUPS)
    for (const id of g.types) {
      assert.ok(FLEET.some((t) => t.id === id), `unknown type ${id} in ${g.id}`);
      assert.ok(!seen.has(id), `${id} appears in two groups`);
      seen.add(id);
    }
  assert.strictEqual(seen.size, FLEET.length, "every type is placed in a group");
});

test("twins pairs reference real, distinct types", () => {
  const ids = new Set(FLEET.map((t) => t.id));
  for (const p of TWINS) {
    assert.ok(ids.has(p.a) && ids.has(p.b), `twins pair ${p.a}/${p.b} unknown`);
    assert.notStrictEqual(p.a, p.b);
    assert.ok(p.tell && p.tell.length > 20, "twins pair needs a real tell");
  }
});

test("fleet tree unlocks in order", () => {
  assert.strictEqual(Quiz.unlockedGroupCount(GROUPS, {}), 1, "fresh player: 1 group");
  const g1done = {};
  for (const id of GROUPS[0].types) g1done[id] = { seen: 6, correct: Quiz.UNLOCK_CORRECT };
  assert.strictEqual(Quiz.unlockedGroupCount(GROUPS, g1done), 2, "group 1 done → 2 open");
  // one type short → still 1
  const short = { ...g1done, [GROUPS[0].types[0]]: { seen: 6, correct: Quiz.UNLOCK_CORRECT - 1 } };
  assert.strictEqual(Quiz.unlockedGroupCount(GROUPS, short), 1);
  assert.strictEqual(Quiz.unlockedGroupCount(GROUPS, allCorrect(99)), GROUPS.length, "all done → all open");
  // rounds only draw unlocked types
  const rng = mulberry32(5);
  const fresh = Quiz.buildRound("spot", ctxWith({}), 8, rng);
  const g1 = new Set(GROUPS[0].types);
  for (const q of fresh) assert.ok(g1.has(q.typeId), `locked type ${q.typeId} drawn for fresh player`);
});

test("spot questions have 4 unique options including the answer", () => {
  const rng = mulberry32(7);
  const stats = allCorrect(99);
  for (let i = 0; i < 60; i++) {
    const round = Quiz.buildRound("spot", ctxWith(stats), 8, rng);
    for (const q of round) {
      assert.strictEqual(q.options.length, 4);
      const ids = q.options.map((o) => o.id);
      assert.strictEqual(new Set(ids).size, 4, "duplicate options");
      assert.ok(ids.includes(q.answer), "answer missing from options");
    }
  }
});

test("distractors prefer declared rivals", () => {
  const rng = mulberry32(11);
  const target = FLEET.find((t) => t.id === "b737-800");
  for (let i = 0; i < 60; i++) {
    const ds = Quiz.pickDistractors(target, FLEET, RIVALS, rng).map((d) => d.id);
    assert.strictEqual(new Set(ds).size, 3);
    assert.ok(!ds.includes(target.id), "target leaked into distractors");
    for (const r of RIVALS["b737-800"])
      assert.ok(ds.includes(r), `rival ${r} should always be a distractor`);
  }
});

test("twins rounds only use unlocked pairs and answer is one of two options", () => {
  const rng = mulberry32(13);
  // fresh player: only pairs within group 1 are available
  const avail = Quiz.availableTwins(TWINS, FLEET, GROUPS, {});
  const g1 = new Set(GROUPS[0].types);
  assert.ok(avail.length >= 2, "twins must be playable from day one");
  for (const p of avail) assert.ok(g1.has(p.a) && g1.has(p.b));
  const round = Quiz.buildRound("twins", ctxWith({}), 8, rng);
  assert.strictEqual(round.length, 8);
  for (const q of round) {
    assert.strictEqual(q.options.length, 2);
    assert.ok(q.options.some((o) => o.id === q.answer));
    assert.ok(q.tell, "twins question carries its tell");
  }
  // full unlock: every pair reachable
  assert.strictEqual(Quiz.availableTwins(TWINS, FLEET, GROUPS, allCorrect(99)).length, TWINS.length);
});

test("trump questions: the bigger value always wins, gaps respected", () => {
  const rng = mulberry32(17);
  const round = Quiz.buildRound("trump", ctxWith(allCorrect(99)), 40, rng);
  assert.ok(round.length >= 30, "trump rounds fill up");
  const byId = Object.fromEntries(FLEET.map((t) => [t.id, t]));
  for (const q of round) {
    const [a, b] = q.options.map((o) => byId[o.id]);
    const winner = byId[q.answer];
    const loser = a.id === winner.id ? b : a;
    assert.ok(winner[q.statKey] > loser[q.statKey], `${q.statKey}: winner must be bigger`);
    if (q.statKey !== "aisles")
      assert.ok(
        winner[q.statKey] / loser[q.statKey] >= Quiz.TRUMP_GAP,
        `${winner.id} vs ${loser.id} ${q.statKey} gap too small to ask`
      );
    assert.strictEqual(q.reveal.length, 2, "reveal shows both values");
  }
});

test("riddle questions carry 3 clues and 4 options", () => {
  const rng = mulberry32(19);
  const round = Quiz.buildRound("riddle", ctxWith(allCorrect(99)), 8, rng);
  assert.strictEqual(round.length, 8);
  for (const q of round) {
    assert.strictEqual(q.clues.length, 3);
    assert.strictEqual(q.options.length, 4);
    assert.ok(q.options.some((o) => o.id === q.answer));
  }
});

test("rounds avoid back-to-back repeats", () => {
  const rng = mulberry32(23);
  for (let s = 0; s < 20; s++) {
    const round = Quiz.buildRound("spot", ctxWith(allCorrect(99)), 8, rng);
    for (let i = 1; i < round.length; i++)
      assert.notStrictEqual(round[i].typeId, round[i - 1].typeId, "same type twice in a row");
  }
});

test("adaptive weighting favors missed types", () => {
  const rng = mulberry32(31);
  const stats = {};
  for (const t of FLEET) stats[t.id] = { seen: 20, correct: 20 };
  stats["b757-200"] = { seen: 20, correct: 4 };
  assert.strictEqual(Quiz.typeWeight(FLEET.find((t) => t.id === "b757-200"), stats), 4);
  assert.strictEqual(Quiz.typeWeight(FLEET[0], stats), 1);
  assert.strictEqual(Quiz.typeWeight(FLEET[0], {}), 3, "unseen types run hot");

  const g1types = FLEET.filter((t) => GROUPS[0].types.includes(t.id));
  let hits = 0, draws = 0;
  for (let i = 0; i < 200; i++)
    for (const t of Quiz.drawTypes(g1types, stats, 8, rng)) {
      draws++;
      if (t.id === "b757-200") hits++;
    }
  const share = hits / draws;
  assert.ok(share > 0.3, `missed type only drew ${(share * 100).toFixed(1)}% (want > 30%)`);
});

console.log(`\n${passed} tests passed ✅`);
