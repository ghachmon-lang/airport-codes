/*
 * linecheck.js — the "Line Check" mode engine (pure logic, no DOM).
 *
 * WHY THIS MODE EXISTS
 * --------------------
 * Academy mode trains RECOGNITION inside a fixed context: four options on
 * screen, letter tiles that pre-give the three letters, a unit that narrows the
 * answer space to six airports, the same layout every time. That memory is
 * bound to cues that don't exist when a friend asks her at dinner.
 *
 * Line Check strips the cues instead of adding features:
 *   - no multiple choice, ever — she PRODUCES the answer on a real keyboard
 *     (or out loud)
 *   - interleaved across everything she's seen, so the answer space is the
 *     whole map, not one route
 *   - prompts are natural-language crew scenarios, never the same wording twice
 *   - the same fact is asked in shapes Academy never uses: free recall by
 *     category, trip sheets, timed rushes
 *
 * Everything here is pure so tests can cover the grading, which is the part
 * that has to be forgiving of real typing ("ohare", "chicago o hare", "chigago")
 * without ever accepting an answer that's actually a different airport.
 */

const LineCheck = (() => {
  // --- small utils ----------------------------------------------------------
  function shuffleArr(arr, rng = Math.random) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const pick = (arr, rng = Math.random) => arr[Math.floor(rng() * arr.length)];

  /*
   * Fold a typed answer down to something comparable: lowercase, accents
   * stripped, punctuation gone ("St. Thomas" -> "st thomas", "O'Hare" -> "ohare").
   * Apostrophes close up (o'hare -> ohare) but slashes/dots/dashes become spaces
   * (Minneapolis/St. Paul -> "minneapolis st paul").
   */
  function normalize(s) {
    return String(s == null ? "" : s)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // strip accents: São -> Sao
      .toLowerCase()
      .replace(/['’`]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  // Tokens that are never a destination on their own — "san" must not resolve
  // to San Francisco, "fort" must not resolve to Fort Myers.
  const WEAK_TOKENS = new Set([
    "new", "san", "santa", "sao", "saint", "st", "los", "las", "el", "fort", "ft", "port",
    "city", "international", "airport", "intl", "west", "east", "north", "south", "field",
    "de", "del", "la", "the", "and", "grand", "punta", "cape", "hong", "tel", "salt",
  ]);

  /*
   * A few city names contain their own code ("New York JFK"), which would hand
   * her the answer inside the question. When we ASK for a code we use this cue
   * name instead; the cue's own words are accepted right back as answers.
   */
  const CITY_CUE = { JFK: "New York Kennedy" };

  function cityCue(airport) {
    if (CITY_CUE[airport.code]) return CITY_CUE[airport.code];
    // generic guard, so a future data edit can't reopen the leak
    const stripped = String(airport.city)
      .replace(new RegExp("\\b" + airport.code + "\\b", "gi"), "")
      .replace(/\s+/g, " ")
      .trim();
    return stripped || airport.city;
  }

  /*
   * Every string that should count as "she named this airport".
   * "Chicago O'Hare" -> {"chicago ohare", "chicago", "ohare"}
   * "Kahului (Maui)" -> {"kahului maui", "kahului", "maui"}
   * Note "chicago" is deliberately an alias of BOTH Chicago airports — that
   * makes it ambiguous rather than correct, which is the honest answer.
   */
  function aliasesFor(airport) {
    const out = new Set();
    const full = normalize(airport.city);
    out.add(full);
    // the cue name we ask with is also an answer we accept ("Kennedy" -> JFK)
    if (CITY_CUE[airport.code]) {
      const cue = normalize(CITY_CUE[airport.code]);
      out.add(cue);
      for (const tok of cue.split(" ")) if (tok.length >= 4 && !WEAK_TOKENS.has(tok)) out.add(tok);
      const ct = cue.split(" ");
      for (let k = 2; k < ct.length; k++) out.add(ct.slice(0, k).join(" "));
    }
    // the part before any parenthetical, e.g. "San Jose (CA)" -> "san jose"
    const bare = normalize(String(airport.city).replace(/\(.*?\)/g, ""));
    if (bare) out.add(bare);
    // the parenthetical itself, e.g. "(Maui)" -> "maui"
    const paren = String(airport.city).match(/\(([^)]+)\)/);
    if (paren) {
      const p = normalize(paren[1]);
      if (p && p.length >= 3) out.add(p);
    }
    // individual strong tokens, so "dulles" and "ohare" both land
    const tokens = full.split(" ");
    for (const tok of tokens) {
      if (tok.length >= 4 && !WEAK_TOKENS.has(tok)) out.add(tok);
    }
    // leading phrases, so "New York" reaches both New York airports (and is
    // therefore ambiguous) even though "new" alone is meaningless
    for (let k = 2; k < tokens.length; k++) out.add(tokens.slice(0, k).join(" "));
    out.delete("");
    return out;
  }

  // alias -> [codes]. Built once from the airport list.
  function buildAliasIndex(all) {
    const map = new Map();
    for (const a of all) {
      for (const alias of aliasesFor(a)) {
        if (!map.has(alias)) map.set(alias, []);
        const arr = map.get(alias);
        if (!arr.includes(a.code)) arr.push(a.code);
      }
    }
    return map;
  }

  // Classic Levenshtein — short strings only, so the simple DP is plenty.
  function editDistance(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[n];
  }

  // How much misspelling to forgive for an alias of this length.
  function typoTolerance(len) {
    if (len >= 8) return 2;
    if (len >= 5) return 1;
    return 0; // short names must be exact — "lima"/"lira" are different places
  }

  /*
   * Which airports could this typed text mean? Exact alias first; only if
   * nothing matches do we allow near-misses, so a typo can never outrank a
   * real destination's name.
   */
  function matchCodes(given, index) {
    const g = normalize(given);
    if (!g) return [];
    if (index.has(g)) return index.get(g).slice();
    const hits = [];
    for (const [alias, codes] of index) {
      const tol = typoTolerance(alias.length);
      if (!tol || Math.abs(alias.length - g.length) > tol) continue;
      if (editDistance(g, alias) <= tol) {
        for (const c of codes) if (!hits.includes(c)) hits.push(c);
      }
    }
    return hits;
  }

  // Is the typed text the beginning of this city's name? ("los" -> Los Angeles)
  // Word-aligned, so "los ang" doesn't count but "los" and "new york" do.
  function isPrefixOfCity(given, airport) {
    const g = normalize(given);
    if (!g) return false;
    for (const name of [normalize(airport.city), normalize(CITY_CUE[airport.code] || "")]) {
      if (!name || name === g) continue;
      if (name.startsWith(g + " ")) return true;
    }
    return false;
  }

  /*
   * Grade a typed CITY answer.
   *   { ok }                     -> correct
   *   { ambiguous, matched }     -> named a city with two airports ("Chicago")
   *   { partial: true }          -> only the first word ("Los" for Los Angeles)
   *   { wasCode: true }          -> typed the code back at us
   *   { ok: false }              -> wrong (or another airport entirely)
   */
  function gradeCity(given, targetCode, index, byCode) {
    const raw = String(given == null ? "" : given).trim();
    const g = normalize(raw);
    if (!g) return { ok: false, empty: true, matched: [] };
    if (/^[a-z]{3}$/.test(g) && byCode && byCode[g.toUpperCase()]) {
      // she answered with a code where a city was asked
      return { ok: false, matched: [], wasCode: true, codeMeant: g.toUpperCase() };
    }
    const matched = matchCodes(raw, index);
    if (matched.length === 1 && matched[0] === targetCode) return { ok: true, matched };
    if (matched.length > 1 && matched.includes(targetCode)) return { ok: false, ambiguous: true, matched };
    // She started the right name — that's a nudge, not a miss.
    if (!matched.length && byCode && byCode[targetCode] && isPrefixOfCity(raw, byCode[targetCode])) {
      return { ok: false, partial: true, matched: [] };
    }
    return { ok: false, matched };
  }

  // Grade a typed CODE answer (forgiving of case, spaces and dots: "d e n").
  function gradeCode(given, targetCode) {
    const g = String(given == null ? "" : given).toUpperCase().replace(/[^A-Z]/g, "");
    return { ok: g === targetCode, given: g };
  }

  /*
   * Turn a speech-recognition transcript into a 3-letter code.
   * Handles the three ways a person says a code out loud:
   *   "D E N" / "dee ee en"      -> letter by letter
   *   "delta echo november"      -> the phonetic alphabet
   *   "den"                      -> said as a word
   * Returns null when the transcript clearly isn't a code.
   */
  const LETTER_WORDS = {
    a: "A", ay: "A", eh: "A", alpha: "A", alfa: "A",
    b: "B", bee: "B", be: "B", bravo: "B",
    c: "C", see: "C", sea: "C", cee: "C", charlie: "C",
    d: "D", dee: "D", delta: "D",
    e: "E", ee: "E", echo: "E",
    f: "F", ef: "F", eff: "F", foxtrot: "F",
    g: "G", gee: "G", golf: "G",
    h: "H", aitch: "H", haitch: "H", hotel: "H",
    i: "I", eye: "I", india: "I",
    j: "J", jay: "J", juliet: "J", juliett: "J",
    k: "K", kay: "K", kilo: "K",
    l: "L", el: "L", ell: "L", lima: "L",
    m: "M", em: "M", mike: "M",
    n: "N", en: "N", november: "N",
    o: "O", oh: "O", owe: "O", oscar: "O",
    p: "P", pee: "P", pea: "P", papa: "P",
    q: "Q", cue: "Q", queue: "Q", quebec: "Q",
    r: "R", ar: "R", are: "R", romeo: "R",
    s: "S", es: "S", ess: "S", sierra: "S",
    t: "T", tee: "T", tea: "T", tango: "T",
    u: "U", you: "U", yew: "U", uniform: "U",
    v: "V", vee: "V", victor: "V",
    w: "W", "double u": "W", whiskey: "W",
    x: "X", ex: "X", xray: "X",
    y: "Y", why: "Y", wye: "Y", yankee: "Y",
    z: "Z", zee: "Z", zed: "Z", zulu: "Z",
  };

  function parseSpokenCode(transcript) {
    const t = normalize(transcript).replace(/\bdouble u\b/g, "w");
    if (!t) return null;
    const words = t.split(" ");
    // letter-by-letter or phonetic
    const letters = words.map((w) => LETTER_WORDS[w] || (w.length === 1 ? w.toUpperCase() : null));
    if (letters.length === 3 && letters.every(Boolean)) return letters.join("");
    // said as one word ("den", "ord") — or run together with no spaces
    const squashed = t.replace(/[^a-z]/g, "");
    if (squashed.length === 3) return squashed.toUpperCase();
    return null;
  }

  // Speech-synthesis form of a code: "DEN" must be read out as letters, not "den".
  function spellCode(code) {
    return String(code).split("").join(". ") + ".";
  }

  // --- scenario prompts -----------------------------------------------------
  /*
   * Crew-voice framings. The point is that the SAME fact arrives wrapped in a
   * different sentence every time, so the sentence never becomes the cue.
   * INVARIANT (covered by tests): an ASK_CODE prompt never contains the code,
   * and an ASK_CITY prompt never contains the city.
   */
  const ASK_CODE = [
    { t: "You're working the flight to {city} tonight. What's the code?", tag: "TONIGHT'S TRIP" },
    { t: "The gate agent asks you to confirm the code for {city}.", tag: "AT THE GATE" },
    { t: "A passenger is connecting to {city}. What code do you look for on the board?", tag: "IN THE AISLE" },
    { t: "Crew scheduling added {city} to your trip. Tag it with the right code.", tag: "CREW SCHEDULING" },
    { t: "This bag is headed to {city}. What should the tag read?", tag: "BAG TAG" },
    { t: "Jumpseat quiz — {city}?", tag: "JUMPSEAT" },
    { t: "You're making the welcome PA for {city}. What's the three-letter code?", tag: "CABIN PA" },
    { t: "Layover in {city}. What airport are you landing at?", tag: "LAYOVER" },
    { t: "Someone at dinner says they're flying to {city}. Impress them.", tag: "OFF DUTY" },
    { t: "Your trip sheet says {city}. Write the code.", tag: "TRIP SHEET" },
    { t: "Ops radios: “confirm destination {city}.” Code?", tag: "OPS" },
    { t: "Which code takes you to {city}?", tag: null },
  ];

  const ASK_CITY = [
    { t: "A bag tag reads {code}. Where is it going?", tag: "BAG TAG" },
    { t: "The departure board shows {code}. Name the city.", tag: "DEPARTURES" },
    { t: "Jumpseat quiz — {code}?", tag: "JUMPSEAT" },
    { t: "You're deadheading on the {code} turn. Where do you end up?", tag: "DEADHEAD" },
    { t: "Crew scheduling texts: “{code} tomorrow, report 0600.” Where are you flying?", tag: "CREW SCHEDULING" },
    { t: "A friend asks what {code} means. Tell them.", tag: "OFF DUTY" },
    { t: "Your trip sheet says {code}. What city is that?", tag: "TRIP SHEET" },
    { t: "You're reading the arrival PA for {code}. What city do you welcome them to?", tag: "CABIN PA" },
    { t: "A boarding pass says {code}. Where are they headed?", tag: "BOARDING PASS" },
    { t: "{code} — go.", tag: null },
    { t: "The ramp agent holds up a bag: “this one's {code}?” Which city?", tag: "ON THE RAMP" },
  ];

  // --- question builders ----------------------------------------------------
  /*
   * One cold call: a single airport, one direction, wrapped in a scenario.
   * `terse` (Ramp Rush) drops the scenario entirely — just the bare fact, fast.
   */
  function qColdCall(airport, dir, rng = Math.random, { terse = false } = {}) {
    const askCode = dir === "CITY_TO_CODE";
    const chosen = terse ? { t: askCode ? "{city}" : "{code}", tag: null } : pick(askCode ? ASK_CODE : ASK_CITY, rng);
    const template = chosen.t;
    const cue = cityCue(airport);
    const prompt = template.replace("{city}", cue).replace("{code}", airport.code);
    return {
      type: "lc-call",
      dir,
      code: airport.code,
      city: airport.city,
      prompt,
      tag: chosen.tag, // the scenario names its own artifact, so the card label can't contradict it
      // what the phone says out loud — codes have to be spelled, not pronounced
      speak: template.replace("{city}", cue).replace("{code}", spellCode(airport.code)),
      answerType: askCode ? "code" : "city",
      answer: askCode ? airport.code : airport.city,
      terse,
      miles: terse ? 8 : 20,
    };
  }

  /*
   * Free recall by category — the format Academy has no equivalent for, and the
   * one closest to being asked cold ("name some airports in Hawaii"). No cue at
   * all beyond the category itself.
   */
  function qList(group, n, rng = Math.random) {
    const want = Math.max(2, Math.min(n, group.codes.length));
    const prompt = `Name ${want} airport codes in ${group.label}.`;
    return {
      type: "lc-list",
      group: { id: group.id, label: group.label, codes: group.codes.slice() },
      n: want,
      prompt,
      tag: "CREW RECALL",
      speak: prompt,
      answerType: "list",
      code: group.codes[0], // representative, for miles bookkeeping only
      miles: 12 * want,
    };
  }

  /*
   * A trip sheet: three legs, all three answers at once. Recall under load, and
   * it mirrors the actual artifact she reads at work.
   */
  function qChain(airports, dir, rng = Math.random) {
    const askCode = dir === "CITY_TO_CODE";
    const shown = airports.map((a) => (askCode ? cityCue(a) : a.code));
    const prompt = askCode
      ? `Trip sheet: ${shown.join(" → ")}. Give all three codes.`
      : `Trip sheet: ${shown.join(" → ")}. Name all three cities.`;
    return {
      type: "lc-chain",
      dir,
      codes: airports.map((a) => a.code),
      legs: airports.map((a) => ({ code: a.code, city: a.city, cue: cityCue(a), answer: askCode ? a.code : a.city })),
      prompt,
      tag: "TRIP SHEET",
      speak: askCode
        ? `Trip sheet. ${shown.join(", then ")}. Give all three codes.`
        : `Trip sheet. ${airports.map((a) => spellCode(a.code)).join(" then ")} Name all three cities.`,
      answerType: askCode ? "code" : "city",
      miles: 45,
    };
  }

  /*
   * Category groups for free recall, built from the same UNITS she already
   * flew plus the hubs and any country with enough destinations. Only groups
   * where she's seen `minKnown` of the codes are offered — being asked to name
   * four airports in a route she's never flown isn't recall, it's a wall.
   */
  function buildGroups(units, all, knownCodes, minKnown = 4) {
    const known = new Set(knownCodes);
    const groups = [];
    const hubs = all.filter((a) => a.region === "Hub").map((a) => a.code);
    if (hubs.filter((c) => known.has(c)).length >= minKnown) {
      groups.push({ id: "hubs", label: "United's hubs", codes: hubs });
    }
    for (const u of units) {
      const seen = u.codes.filter((c) => known.has(c));
      if (seen.length >= minKnown) groups.push({ id: u.id, label: `${u.emoji} ${u.title}`, codes: u.codes.slice() });
    }
    const byCountry = new Map();
    for (const a of all) {
      if (!byCountry.has(a.country)) byCountry.set(a.country, []);
      byCountry.get(a.country).push(a.code);
    }
    for (const [country, codes] of byCountry) {
      if (country === "United States") continue; // far too broad to be a question
      if (codes.filter((c) => known.has(c)).length >= minKnown) {
        groups.push({ id: `country:${country}`, label: country, codes: codes.slice() });
      }
    }
    return groups;
  }

  /*
   * Grade a free-recall list. Entries may be codes OR city names; both resolve
   * to a code. Duplicates count once. Omissions are NOT misses — she was asked
   * for `n`, not for everything, so nothing gets penalised in the scheduler.
   */
  function gradeList(entries, group, index, byCode) {
    const inGroup = new Set(group.codes);
    const seen = new Set();
    const results = [];
    for (const raw of entries) {
      const text = String(raw == null ? "" : raw).trim();
      if (!text) continue;
      const asCode = text.toUpperCase().replace(/[^A-Z]/g, "");
      let code = null;
      if (asCode.length === 3 && byCode[asCode]) code = asCode;
      else {
        const m = matchCodes(text, index);
        if (m.length === 1) code = m[0];
        else if (m.length > 1) {
          results.push({ text, ok: false, ambiguous: true, matched: m });
          continue;
        }
      }
      if (!code) {
        results.push({ text, ok: false, unknown: true });
        continue;
      }
      if (seen.has(code)) {
        results.push({ text, code, ok: false, duplicate: true });
        continue;
      }
      seen.add(code);
      results.push({ text, code, ok: inGroup.has(code), city: (byCode[code] || {}).city });
    }
    const correct = results.filter((r) => r.ok).map((r) => r.code);
    return { results, correct, count: correct.length, needed: group.n || 0 };
  }

  /*
   * Build one Line Check round out of the airports she's actually seen.
   * Cold calls carry the round; one trip sheet and one free-recall list drop in
   * when there's enough material. Directions alternate, and the same airport
   * never lands twice in a row.
   */
  function buildRound(pool, all, opts = {}) {
    const { length = 10, rng = Math.random, groups = [], includeList = true, includeChain = true } = opts;
    if (!pool.length) return [];
    const qs = [];
    const bag = shuffleArr(pool, rng);
    let i = 0;
    const nextAirport = () => bag[i++ % bag.length];

    const calls = Math.max(1, length - (includeList && groups.length ? 1 : 0) - (includeChain && pool.length >= 3 ? 1 : 0));
    let lastCode = null;
    for (let k = 0; k < calls; k++) {
      let a = nextAirport();
      if (bag.length > 1 && a.code === lastCode) a = nextAirport();
      lastCode = a.code;
      // alternate directions so neither becomes the default expectation
      const dir = (k + (rng() < 0.5 ? 0 : 1)) % 2 === 0 ? "CITY_TO_CODE" : "CODE_TO_CITY";
      qs.push(qColdCall(a, dir, rng));
    }
    if (includeChain && pool.length >= 3) {
      const legs = shuffleArr(pool, rng).slice(0, 3);
      qs.push(qChain(legs, rng() < 0.5 ? "CITY_TO_CODE" : "CODE_TO_CITY", rng));
    }
    if (includeList && groups.length) {
      const g = pick(groups, rng);
      qs.push(qList(g, 4, rng));
    }
    // Shuffle the shapes together (keeping a plain cold call in the opening slot,
    // since that's how she'll most often be asked in real life), then separate
    // any two questions about the same airport — back-to-back is a giveaway.
    const out = [qs[0], ...shuffleArr(qs.slice(1), rng)].slice(0, length);
    const codeOf = (q) => (q && q.type === "lc-call" ? q.code : null);
    for (let k = 1; k < out.length; k++) {
      if (codeOf(out[k]) === null || codeOf(out[k]) !== codeOf(out[k - 1])) continue;
      for (let j = k + 1; j < out.length; j++) {
        if (codeOf(out[j]) !== codeOf(out[k - 1]) && (j + 1 >= out.length || codeOf(out[j + 1]) !== codeOf(out[k]))) {
          [out[k], out[j]] = [out[j], out[k]];
          break;
        }
      }
    }
    return out;
  }

  return {
    normalize,
    cityCue,
    aliasesFor,
    buildAliasIndex,
    editDistance,
    matchCodes,
    gradeCity,
    gradeCode,
    isPrefixOfCity,
    gradeList,
    parseSpokenCode,
    spellCode,
    qColdCall,
    qList,
    qChain,
    buildGroups,
    buildRound,
    shuffleArr,
    ASK_CODE,
    ASK_CITY,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = { LineCheck };
}
