/*
 * game.js — question generation and lesson building (pure logic, no DOM).
 *
 * Exercise types (all REAL graded answers — no self-grading):
 *   "mc-city"  : show a code, pick the city from 4 options
 *   "mc-code"  : show a city, pick the code from 4 options
 *   "type-code": show a city, type the 3-letter code
 *   "pairs"    : match 4 codes to 4 cities (one board = one question slot)
 *
 * Distractors are chosen to be *plausibly confusable*: codes sharing letters
 * (DEN/DFW/DTW), same-region cities, near-alphabet neighbours — that's the
 * "desirable difficulty" that makes it a game instead of a giveaway.
 */

const Game = (() => {
  // --- small utils --------------------------------------------------------
  function shuffleArr(arr, rng = Math.random) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const pick = (arr, rng = Math.random) => arr[Math.floor(rng() * arr.length)];

  // How confusable are two codes? (shared letters, shared prefix -> higher)
  function codeSimilarity(a, b) {
    if (a === b) return -1;
    let s = 0;
    for (const ch of new Set(a)) if (b.includes(ch)) s++;
    if (a[0] === b[0]) s += 2; // same first letter is extra confusing
    if (a[1] === b[1]) s += 1;
    return s;
  }

  /*
   * Pick 3 distractor airports for a target. Prefer: same unit > similar code
   * > same region > anything. `pool` = airports in the current unit,
   * `all` = every airport.
   */
  function pickDistractors(target, pool, all, rng = Math.random) {
    const seen = new Set([target.code]);
    const out = [];
    const take = (cands) => {
      for (const c of shuffleArr(cands, rng)) {
        if (out.length >= 3) break;
        if (!seen.has(c.code) && c.city !== target.city) {
          seen.add(c.code);
          out.push(c);
        }
      }
    };
    take(pool.filter((a) => a.code !== target.code));
    if (out.length < 3) {
      const similar = all
        .filter((a) => !seen.has(a.code))
        .map((a) => ({ a, s: codeSimilarity(target.code, a.code) }))
        .sort((x, y) => y.s - x.s)
        .slice(0, 12)
        .map((x) => x.a);
      take(similar);
    }
    if (out.length < 3) take(all.filter((a) => a.region === target.region));
    if (out.length < 3) take(all);
    return out;
  }

  // --- question builders ---------------------------------------------------
  // `intro: true` = first exposure "New destination!" guess with only 2 options
  // (the pretesting effect: guessing first makes the reveal stick better).
  function qMcCity(target, pool, all, rng = Math.random, { intro = false } = {}) {
    const distractors = pickDistractors(target, pool, all, rng).slice(0, intro ? 1 : 3);
    const options = shuffleArr([target, ...distractors], rng).map((a) => a.city);
    return {
      type: "mc-city",
      intro,
      code: target.code,
      prompt: target.code,
      sub: intro ? "✨ New destination! Take a guess…" : "Which destination is this?",
      options,
      answer: target.city,
      miles: intro ? 5 : 10, // 2-choice guesses pay less than real recall
    };
  }

  function qMcCode(target, pool, all, rng = Math.random, { intro = false } = {}) {
    const distractors = pickDistractors(target, pool, all, rng).slice(0, intro ? 1 : 3);
    const options = shuffleArr([target, ...distractors], rng).map((a) => a.code);
    return {
      type: "mc-code",
      intro,
      code: target.code,
      prompt: target.city,
      sub: intro ? "✨ New destination! Take a guess…" : "What's the airport code?",
      options,
      answer: target.code,
      miles: intro ? 5 : 10, // 2-choice guesses pay less than real recall
    };
  }

  // Letter-tile typing: 3 answer letters + 4 decoy letters drawn from
  // confusable codes, so she assembles the code by tapping tiles.
  function qTypeCode(target, pool = [], all = [], rng = Math.random) {
    const decoySrc = pickDistractors(target, pool, all, rng)
      .flatMap((a) => a.code.split(""))
      .filter((ch) => !target.code.includes(ch));
    const decoys = shuffleArr([...new Set(decoySrc)], rng).slice(0, 4);
    while (decoys.length < 4) {
      const ch = String.fromCharCode(65 + Math.floor(rng() * 26));
      if (!target.code.includes(ch) && !decoys.includes(ch)) decoys.push(ch);
    }
    return {
      type: "type-code",
      code: target.code,
      prompt: target.city,
      sub: "Build the 3-letter code",
      letters: shuffleArr([...target.code.split(""), ...decoys], rng),
      answer: target.code,
      miles: 15, // production is harder -> worth more
    };
  }

  function qPairs(targets, rng = Math.random) {
    return {
      type: "pairs",
      codes: targets.map((a) => a.code),
      sub: "Match the pairs",
      left: shuffleArr(targets.map((a) => a.code), rng),
      right: shuffleArr(targets.map((a) => a.city), rng),
      answerMap: Object.fromEntries(targets.map((a) => [a.code, a.city])),
      miles: 20,
      code: targets[0] && targets[0].code, // representative (miles bookkeeping)
    };
  }

  /*
   * Build one lesson: ~`length` questions over `airports` (the lesson's pool).
   * Difficulty ramps with familiarity: an airport not yet seen starts with an
   * intro (mc) before typing appears. A pairs board is dropped in the middle.
   * `familiar(code)` -> true when SRS says she's answered it before.
   */
  function buildLesson(airports, all, { length = 10, familiar = () => false, rng = Math.random } = {}) {
    const qs = [];
    const pool = shuffleArr(airports, rng);
    // round-robin over the pool so every airport shows up
    let i = 0;
    const next = () => pool[i++ % pool.length];

    while (qs.length < length - 1) {
      const a = next();
      const known = familiar(a.code);
      const seenThisLesson = qs.some((q) => q.code === a.code || (q.codes || []).includes(a.code));
      let q;
      if (!known && !seenThisLesson) {
        // first exposure: a 2-choice "new destination" guess (pretesting effect)
        q = rng() < 0.5 ? qMcCity(a, airports, all, rng, { intro: true }) : qMcCode(a, airports, all, rng, { intro: true });
      } else {
        // familiar: mix in harder recall
        const r = rng();
        q = r < 0.34 ? qTypeCode(a, airports, all, rng) : r < 0.67 ? qMcCode(a, airports, all, rng) : qMcCity(a, airports, all, rng);
      }
      // avoid the same airport twice in a row (impossible with a 1-airport pool —
      // skipping there would loop forever)
      const prev = qs[qs.length - 1];
      if (pool.length > 1 && prev && (prev.code === a.code || (prev.codes || []).includes(a.code))) continue;
      qs.push(q);
    }

    // pairs board in the middle (needs >= 4 airports)
    if (airports.length >= 4) {
      const board = qPairs(shuffleArr(airports, rng).slice(0, 4), rng);
      qs.splice(Math.floor(qs.length / 2), 0, board);
    } else {
      const a = next();
      qs.push(qMcCity(a, airports, all, rng));
    }
    return qs;
  }

  // Grade a free-typed code (forgiving of case/whitespace).
  function checkTyped(input, answer) {
    return String(input || "").trim().toUpperCase() === answer;
  }

  return { buildLesson, qMcCity, qMcCode, qTypeCode, qPairs, pickDistractors, codeSimilarity, checkTyped, shuffleArr };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = { Game };
}
