/*
 * Tests for Line Check (mode 2). Run: node tests/linecheck.test.js
 *
 * The grading is the risky part: it has to forgive real typing on a phone
 * without ever accepting an answer that is a DIFFERENT airport. Most of what's
 * below is defending that line.
 */
const assert = require("assert");
const { LineCheck } = require("../js/linecheck.js");
const { AIRPORTS, UNITS } = require("../js/data.js");

const byCode = Object.fromEntries(AIRPORTS.map((a) => [a.code, a]));
const index = LineCheck.buildAliasIndex(AIRPORTS);
let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("  ✓ " + name);
}
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const city = (given, code) => LineCheck.gradeCity(given, code, index, byCode);

// ---------- normalising / aliases -------------------------------------------
test("normalize folds case, accents and punctuation", () => {
  assert.strictEqual(LineCheck.normalize("São Paulo"), "sao paulo");
  assert.strictEqual(LineCheck.normalize("  Chicago O'Hare "), "chicago ohare");
  assert.strictEqual(LineCheck.normalize("Minneapolis/St. Paul"), "minneapolis st paul");
  assert.strictEqual(LineCheck.normalize(null), "");
});

test("aliases cover the ways a person actually names an airport", () => {
  const ord = LineCheck.aliasesFor(byCode["ORD"]);
  assert.ok(ord.has("chicago ohare") && ord.has("ohare") && ord.has("chicago"));
  const ogg = LineCheck.aliasesFor(byCode["OGG"]);
  assert.ok(ogg.has("maui"), "the parenthetical is how she'd say it");
  const iad = LineCheck.aliasesFor(byCode["IAD"]);
  assert.ok(iad.has("dulles"));
});

test("weak tokens never resolve to an airport on their own", () => {
  for (const weak of ["san", "new", "fort", "st", "los"]) {
    assert.strictEqual(LineCheck.matchCodes(weak, index).length, 0, `"${weak}" must not name an airport`);
  }
});

// ---------- grading a typed city ---------------------------------------------
test("city grading accepts the full name, a distinctive half, and the nickname", () => {
  assert.ok(city("Chicago O'Hare", "ORD").ok);
  assert.ok(city("ohare", "ORD").ok);
  assert.ok(city("Dulles", "IAD").ok);
  assert.ok(city("maui", "OGG").ok);
  assert.ok(city("  denver  ", "DEN").ok);
});

test("a shared city name is ambiguous, not wrong — and never silently correct", () => {
  const r = city("Chicago", "ORD");
  assert.ok(!r.ok && r.ambiguous, "Chicago alone can't pick O'Hare over Midway");
  assert.ok(r.matched.includes("ORD") && r.matched.includes("MDW"));
  for (const [given, code] of [["Washington", "IAD"], ["New York", "JFK"], ["Tokyo", "NRT"], ["San Jose", "SJC"]]) {
    assert.ok(city(given, code).ambiguous, `${given} should ask which one`);
  }
});

test("the first word of a name is a nudge, not a miss", () => {
  const r = city("Los", "LAX");
  assert.ok(!r.ok && r.partial, "starting the right name should ask her to finish it");
  assert.ok(city("New", "JFK").partial);
  assert.ok(!city("Denver", "LAX").partial, "a whole different city is just wrong");
  assert.ok(!city("Los Angeles", "LAX").partial && city("Los Angeles", "LAX").ok);
});

test("a different airport is a miss, and we can say which one she named", () => {
  const r = city("Denver", "DFW");
  assert.ok(!r.ok && !r.ambiguous);
  assert.deepStrictEqual(r.matched, ["DEN"]);
});

test("phone typos are forgiven, near-miss real cities are not", () => {
  assert.ok(city("Denvor", "DEN").ok, "one slipped letter still counts");
  assert.ok(city("Amsterdm", "AMS").ok);
  assert.ok(!city("Lima", "LIR").ok, "short names must be exact — Lima is a real place");
  assert.ok(city("Boston", "BOS").ok, "sanity: an exact name still passes");
});

test("answering a city question with a code says so instead of just failing", () => {
  const r = city("DEN", "DEN");
  assert.ok(!r.ok && r.wasCode && r.codeMeant === "DEN");
});

test("empty answers are never accepted", () => {
  assert.ok(!city("", "DEN").ok);
  assert.ok(!city("   ", "DEN").ok);
  assert.ok(!LineCheck.gradeCode("", "DEN").ok);
});

// ---------- grading a typed code ----------------------------------------------
test("code grading forgives case and spacing but nothing else", () => {
  assert.ok(LineCheck.gradeCode("den", "DEN").ok);
  assert.ok(LineCheck.gradeCode(" d e n ", "DEN").ok);
  assert.ok(LineCheck.gradeCode("D.E.N.", "DEN").ok);
  assert.ok(!LineCheck.gradeCode("DFW", "DEN").ok);
  assert.ok(!LineCheck.gradeCode("DE", "DEN").ok);
});

// ---------- speech ---------------------------------------------------------------
test("spoken codes parse from letters, phonetics, or a single word", () => {
  assert.strictEqual(LineCheck.parseSpokenCode("D E N"), "DEN");
  assert.strictEqual(LineCheck.parseSpokenCode("dee ee en"), "DEN");
  assert.strictEqual(LineCheck.parseSpokenCode("delta echo november"), "DEN");
  assert.strictEqual(LineCheck.parseSpokenCode("den"), "DEN");
  assert.strictEqual(LineCheck.parseSpokenCode("oh are dee"), "ORD");
  assert.strictEqual(LineCheck.parseSpokenCode("I have no idea"), null);
});

test("codes are spelled out for the speaker, not pronounced as words", () => {
  assert.strictEqual(LineCheck.spellCode("DEN"), "D. E. N.");
});

// ---------- questions -------------------------------------------------------------
test("a prompt never contains its own answer", () => {
  const rng = mulberry32(11);
  for (const a of AIRPORTS) {
    for (let i = 0; i < 4; i++) {
      const askCode = LineCheck.qColdCall(a, "CITY_TO_CODE", rng);
      assert.ok(!askCode.prompt.includes(a.code), `${a.code} leaked into its own prompt: ${askCode.prompt}`);
      assert.strictEqual(askCode.answer, a.code);
      assert.strictEqual(askCode.answerType, "code");

      const askCity = LineCheck.qColdCall(a, "CODE_TO_CITY", rng);
      assert.ok(
        !LineCheck.normalize(askCity.prompt).includes(LineCheck.normalize(a.city)),
        `${a.city} leaked into its own prompt: ${askCity.prompt}`
      );
      assert.strictEqual(askCity.answer, a.city);
      assert.strictEqual(askCity.answerType, "city");
    }
  }
});

test("spoken prompts spell the code instead of reading it as a word", () => {
  const q = LineCheck.qColdCall(byCode["ORD"], "CODE_TO_CITY", mulberry32(3));
  assert.ok(q.speak.includes("O. R. D."), q.speak);
});

test("rush questions are bare — no scenario to lean on", () => {
  const q = LineCheck.qColdCall(byCode["LIS"], "CITY_TO_CODE", mulberry32(5), { terse: true });
  assert.strictEqual(q.prompt, "Lisbon");
  assert.ok(q.miles < 20, "a snap answer is worth less than a considered one");
});

test("trip sheets ask for every leg", () => {
  const legs = ["ORD", "MSY", "IAH"].map((c) => byCode[c]);
  const q = LineCheck.qChain(legs, "CODE_TO_CITY", mulberry32(2));
  assert.strictEqual(q.legs.length, 3);
  assert.deepStrictEqual(q.legs.map((l) => l.answer), legs.map((l) => l.city));
  assert.ok(q.prompt.includes("ORD") && q.prompt.includes("IAH"));
});

// ---------- free recall -----------------------------------------------------------
test("category groups only appear once she's seen enough of them", () => {
  const hawaii = UNITS.find((u) => u.id === "hawaii");
  const none = LineCheck.buildGroups(UNITS, AIRPORTS, []);
  assert.strictEqual(none.length, 0, "no groups before she's seen anything");
  const some = LineCheck.buildGroups(UNITS, AIRPORTS, hawaii.codes);
  assert.ok(some.some((g) => g.id === "hawaii"));
  assert.ok(!some.some((g) => g.id === "euro-icons"), "routes she's never flown stay out");
});

test("free recall accepts codes or cities, flags duplicates and outsiders", () => {
  const group = { id: "hawaii", label: "Hawaii", codes: ["HNL", "OGG", "KOA", "LIH", "ITO"], n: 4 };
  const g = LineCheck.gradeList(["HNL", "maui", "hnl", "Denver", "kona"], group, index, byCode);
  assert.deepStrictEqual(g.correct, ["HNL", "OGG", "KOA"]);
  assert.ok(g.results[2].duplicate, "the same airport twice only counts once");
  assert.ok(g.results[3].ok === false, "Denver is not in Hawaii");
  assert.strictEqual(g.count, 3);
});

test("free recall ignores blanks and reports nonsense as unknown", () => {
  const group = { id: "hubs", label: "hubs", codes: ["ORD", "DEN"], n: 2 };
  const g = LineCheck.gradeList(["", "   ", "zzzz", "ORD"], group, index, byCode);
  assert.strictEqual(g.count, 1);
  assert.ok(g.results.some((r) => r.unknown));
});

// ---------- round building ----------------------------------------------------------
test("a round is the requested length, all production, and mixes both directions", () => {
  const rng = mulberry32(9);
  const pool = UNITS[0].codes.map((c) => byCode[c]);
  const groups = LineCheck.buildGroups(UNITS, AIRPORTS, pool.map((a) => a.code));
  const qs = LineCheck.buildRound(pool, AIRPORTS, { length: 10, rng, groups });
  assert.strictEqual(qs.length, 10);
  for (const q of qs) {
    assert.ok(!q.options, "Line Check never offers options");
    assert.ok(["lc-call", "lc-chain", "lc-list"].includes(q.type));
  }
  const dirs = new Set(qs.filter((q) => q.dir).map((q) => q.dir));
  assert.strictEqual(dirs.size, 2, "both directions show up");
});

test("a round still builds from a tiny pool and never repeats back to back", () => {
  const rng = mulberry32(4);
  const pool = [byCode["DEN"], byCode["DFW"]];
  const qs = LineCheck.buildRound(pool, AIRPORTS, { length: 6, rng, groups: [] });
  assert.strictEqual(qs.length, 6);
  for (let i = 1; i < qs.length; i++) {
    if (qs[i].type === "lc-call" && qs[i - 1].type === "lc-call") {
      assert.notStrictEqual(qs[i].code, qs[i - 1].code, "same airport twice in a row is a giveaway");
    }
  }
});

test("an empty pool yields nothing rather than throwing", () => {
  assert.deepStrictEqual(LineCheck.buildRound([], AIRPORTS, { length: 5 }), []);
});

console.log(`\n${passed} Line Check tests passed ✅`);
