/*
 * quiz.js — Plane Spotting round builder (pure logic, no DOM).
 *
 * One question = one photo (or placeholder silhouette) + 4 type-name
 * options. Distractors come from RIVALS first (the confusable siblings),
 * then same body class, then anywhere — same "desirable difficulty" idea
 * as the airport app's game.js.
 *
 * Rounds are adaptive: types the player misses most get drawn more often,
 * and no type repeats back-to-back. Missed questions are re-queued once at
 * the end of the round so every session finishes on a save.
 */

const Quiz = (() => {
  function shuffleArr(arr, rng = Math.random) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /*
   * Pick 3 distractor types for a target. Preference order:
   * declared rivals > same body class > anything else.
   */
  function pickDistractors(target, fleet, rivals, rng = Math.random) {
    const seen = new Set([target.id]);
    const out = [];
    const take = (cands) => {
      for (const c of shuffleArr(cands, rng)) {
        if (out.length >= 3) break;
        if (!seen.has(c.id)) {
          seen.add(c.id);
          out.push(c);
        }
      }
    };
    const byId = Object.fromEntries(fleet.map((t) => [t.id, t]));
    take((rivals[target.id] || []).map((id) => byId[id]).filter(Boolean));
    take(fleet.filter((t) => t.body === target.body));
    take(fleet);
    return out;
  }

  /*
   * Weight for adaptive drawing. Unseen types are the hottest (weight 3);
   * otherwise weight grows with miss rate, floored at 1 so mastered types
   * still cycle through.  stats[id] = { seen, correct }
   */
  function typeWeight(type, stats) {
    const s = stats && stats[type.id];
    if (!s || s.seen === 0) return 3;
    const missRate = 1 - s.correct / s.seen;
    return 1 + Math.round(missRate * 4); // 1 (perfect) .. 5 (all wrong)
  }

  /* Weighted draw of `n` types, avoiding immediate repeats. */
  function drawTypes(fleet, stats, n, rng = Math.random) {
    const out = [];
    let prev = null;
    for (let i = 0; i < n; i++) {
      let pool = fleet.filter((t) => t.id !== prev);
      if (pool.length === 0) pool = fleet; // single-type fleet, degenerate
      const weights = pool.map((t) => typeWeight(t, stats));
      let total = weights.reduce((a, b) => a + b, 0);
      let roll = rng() * total;
      let chosen = pool[pool.length - 1];
      for (let k = 0; k < pool.length; k++) {
        roll -= weights[k];
        if (roll <= 0) {
          chosen = pool[k];
          break;
        }
      }
      out.push(chosen);
      prev = chosen.id;
    }
    return out;
  }

  /* Build one photo→name question. */
  function makeQuestion(target, fleet, rivals, rng = Math.random) {
    const distractors = pickDistractors(target, fleet, rivals, rng);
    const options = shuffleArr([target, ...distractors], rng).map((t) => ({
      id: t.id,
      label: t.name,
    }));
    return { kind: "spot", typeId: target.id, answer: target.id, options };
  }

  /* Build a full round of `size` questions. */
  function buildRound(fleet, rivals, stats, size = 8, rng = Math.random) {
    return drawTypes(fleet, stats, size, rng).map((t) =>
      makeQuestion(t, fleet, rivals, rng)
    );
  }

  return { shuffleArr, pickDistractors, typeWeight, drawTypes, makeQuestion, buildRound };
})();

if (typeof module !== "undefined") module.exports = { Quiz };
