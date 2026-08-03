/*
 * quiz.js — round builders for all four game modes (pure logic, no DOM).
 *
 *   "spot"   — photo/silhouette + 4 type names (the core mode)
 *   "twins"  — two lookalikes side by side: tap the named one
 *   "trump"  — Top Trumps: which of two planes has more seats / range / length
 *   "riddle" — Who Am I?: 3 clues, 4 type-name options
 *
 * Shared ideas:
 *   - Distractors prefer declared RIVALS (the confusable siblings), then
 *     same body class, then anything — "desirable difficulty".
 *   - Rounds are adaptive: types the player misses most get drawn more
 *     often, and no type repeats back-to-back.
 *   - The fleet tree gates content: GROUPS unlock in order once every type
 *     in the previous group has UNLOCK_CORRECT lifetime correct answers.
 */

const Quiz = (() => {
  const UNLOCK_CORRECT = 5; // lifetime correct per type to open the next group
  const TRUMP_GAP = 1.12; // min big/small ratio before a stat is askable

  function shuffleArr(arr, rng = Math.random) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const pick = (arr, rng = Math.random) => arr[Math.floor(rng() * arr.length)];

  // ---------- fleet tree / unlocks ---------------------------------------
  /* Number of groups currently open (always ≥ 1). */
  function unlockedGroupCount(groups, stats) {
    let open = 1;
    for (let i = 0; i < groups.length - 1; i++) {
      const done = groups[i].types.every(
        (id) => (stats[id]?.correct || 0) >= UNLOCK_CORRECT
      );
      if (done) open = i + 2;
      else break;
    }
    return open;
  }

  function unlockedTypes(fleet, groups, stats) {
    const n = unlockedGroupCount(groups, stats);
    const ids = new Set(groups.slice(0, n).flatMap((g) => g.types));
    return fleet.filter((t) => ids.has(t.id));
  }

  /* Twins pairs whose both halves are unlocked. */
  function availableTwins(twins, fleet, groups, stats) {
    const ids = new Set(unlockedTypes(fleet, groups, stats).map((t) => t.id));
    return twins.filter((p) => ids.has(p.a) && ids.has(p.b));
  }

  // ---------- adaptive drawing ------------------------------------------
  function typeWeight(type, stats) {
    const s = stats && stats[type.id];
    if (!s || s.seen === 0) return 3; // unseen types run hot
    const missRate = 1 - s.correct / s.seen;
    return 1 + Math.round(missRate * 4); // 1 (perfect) .. 5 (all wrong)
  }

  function drawTypes(pool, stats, n, rng = Math.random) {
    const out = [];
    let prev = null;
    for (let i = 0; i < n; i++) {
      let cands = pool.filter((t) => t.id !== prev);
      if (cands.length === 0) cands = pool;
      const weights = cands.map((t) => typeWeight(t, stats));
      let roll = rng() * weights.reduce((a, b) => a + b, 0);
      let chosen = cands[cands.length - 1];
      for (let k = 0; k < cands.length; k++) {
        roll -= weights[k];
        if (roll <= 0) {
          chosen = cands[k];
          break;
        }
      }
      out.push(chosen);
      prev = chosen.id;
    }
    return out;
  }

  // ---------- spot -------------------------------------------------------
  function pickDistractors(target, pool, rivals, rng = Math.random) {
    const seen = new Set([target.id]);
    const out = [];
    const take = (cands) => {
      for (const c of shuffleArr(cands, rng)) {
        if (out.length >= 3) break;
        if (c && !seen.has(c.id)) {
          seen.add(c.id);
          out.push(c);
        }
      }
    };
    const byId = Object.fromEntries(pool.map((t) => [t.id, t]));
    take((rivals[target.id] || []).map((id) => byId[id]));
    take(pool.filter((t) => t.body === target.body));
    take(pool);
    return out;
  }

  function makeSpotQuestion(target, pool, rivals, rng = Math.random) {
    const distractors = pickDistractors(target, pool, rivals, rng);
    const options = shuffleArr([target, ...distractors], rng).map((t) => ({
      id: t.id,
      label: t.name,
    }));
    return { kind: "spot", typeId: target.id, answer: target.id, options };
  }

  // ---------- twins ------------------------------------------------------
  function makeTwinQuestion(pair, fleet, rng = Math.random) {
    const byId = Object.fromEntries(fleet.map((t) => [t.id, t]));
    const target = rng() < 0.5 ? pair.a : pair.b;
    const options = shuffleArr([pair.a, pair.b], rng).map((id) => ({
      id,
      label: byId[id].name,
    }));
    return { kind: "twins", typeId: target, answer: target, options, tell: pair.tell };
  }

  // ---------- trump (Top Trumps) ----------------------------------------
  const TRUMP_STATS = [
    { key: "seats", prompt: "Which one carries more passengers?", fmt: (v) => `≈${v} seats` },
    { key: "rangeMi", prompt: "Which one can fly farther?", fmt: (v) => `≈${v.toLocaleString("en-US")} mi range` },
    { key: "lenFt", prompt: "Which one is longer nose-to-tail?", fmt: (v) => `≈${v} ft long` },
    { key: "aisles", prompt: "Which one has two aisles?", fmt: (v) => (v === 2 ? "2 aisles (widebody)" : "1 aisle (narrowbody)") },
  ];

  /* Stats askable for a pair: numeric gaps must clear TRUMP_GAP; aisles
   * only when they differ. */
  function askableStats(a, b) {
    return TRUMP_STATS.filter((s) => {
      const va = a[s.key], vb = b[s.key];
      if (s.key === "aisles") return va !== vb;
      return Math.max(va, vb) / Math.min(va, vb) >= TRUMP_GAP;
    });
  }

  function makeTrumpQuestion(a, b, rng = Math.random) {
    const stats = askableStats(a, b);
    if (!stats.length) return null;
    const stat = pick(stats, rng);
    const answer = a[stat.key] > b[stat.key] ? a : b;
    const options = shuffleArr([a, b], rng).map((t) => ({ id: t.id, label: t.name }));
    return {
      kind: "trump",
      statKey: stat.key,
      prompt: stat.prompt,
      typeId: answer.id,
      answer: answer.id,
      options,
      reveal: [a, b].map((t) => ({ id: t.id, label: t.name, value: stat.fmt(t[stat.key]) })),
    };
  }

  /* All unordered pairs from a pool that have at least one askable stat. */
  function trumpPairs(pool) {
    const out = [];
    for (let i = 0; i < pool.length; i++)
      for (let j = i + 1; j < pool.length; j++)
        if (askableStats(pool[i], pool[j]).length) out.push([pool[i], pool[j]]);
    return out;
  }

  // ---------- riddle (Who Am I?) ----------------------------------------
  function makeRiddleQuestion(target, pool, rivals, rng = Math.random) {
    const distractors = pickDistractors(target, pool, rivals, rng);
    const options = shuffleArr([target, ...distractors], rng).map((t) => ({
      id: t.id,
      label: t.name,
    }));
    return {
      kind: "riddle",
      typeId: target.id,
      answer: target.id,
      clues: target.clues.slice(),
      options,
    };
  }

  // ---------- round builders --------------------------------------------
  function buildRound(mode, ctx, size = 8, rng = Math.random) {
    const { fleet, groups, rivals, twins, stats } = ctx;
    const pool = unlockedTypes(fleet, groups, stats);

    if (mode === "twins") {
      const pairs = availableTwins(twins, fleet, groups, stats);
      if (!pairs.length) return [];
      // cycle through a shuffled pair list so a round covers variety
      const seq = [];
      while (seq.length < size) seq.push(...shuffleArr(pairs, rng));
      return seq.slice(0, size).map((p) => makeTwinQuestion(p, fleet, rng));
    }

    if (mode === "trump") {
      const pairs = trumpPairs(pool);
      if (!pairs.length) return [];
      const seq = [];
      while (seq.length < size) seq.push(...shuffleArr(pairs, rng));
      return seq
        .slice(0, size)
        .map(([a, b]) => makeTrumpQuestion(a, b, rng))
        .filter(Boolean);
    }

    const targets = drawTypes(pool, stats, size, rng);
    if (mode === "riddle")
      return targets.map((t) => makeRiddleQuestion(t, pool, rivals, rng));
    return targets.map((t) => makeSpotQuestion(t, pool, rivals, rng));
  }

  return {
    UNLOCK_CORRECT,
    TRUMP_GAP,
    shuffleArr,
    unlockedGroupCount,
    unlockedTypes,
    availableTwins,
    typeWeight,
    drawTypes,
    pickDistractors,
    makeSpotQuestion,
    makeTwinQuestion,
    askableStats,
    makeTrumpQuestion,
    trumpPairs,
    makeRiddleQuestion,
    buildRound,
  };
})();

if (typeof module !== "undefined") module.exports = { Quiz };
