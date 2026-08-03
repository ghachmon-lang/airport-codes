/*
 * app.js — Corrine's Flight Academy: the game orchestrator.
 *
 * Globals from earlier <script> tags:
 *   AIRPORTS, UNITS, HOOKS  (js/data.js)
 *   SRS_API                 (js/srs.js)     — spaced-repetition brain
 *   STORAGE_API             (js/storage.js) — persistence
 *   Sfx                     (js/audio.js)   — synthesized sounds
 *   Game                    (js/game.js)    — graded question generation
 */
(function () {
  "use strict";

  const Srs = SRS_API;
  const Store = STORAGE_API;
  const byCode = Object.fromEntries(AIRPORTS.map((a) => [a.code, a]));

  // ---------- constants -----------------------------------------------------
  const RANKS = [
    { min: 0, name: "Trainee", emoji: "🎓" },
    { min: 2500, name: "Flight Attendant", emoji: "✈️" },
    { min: 7500, name: "Senior Flight Attendant", emoji: "🌟" },
    { min: 20000, name: "Purser", emoji: "👑" },
    { min: 50000, name: "Chief Purser", emoji: "🏆" },
  ];

  const CHEERS = [
    "Brilliant, Corrine! Beauty and brains — you've got both. 💕",
    "Look at you go, Corrine! Smartest (and prettiest) one in the sky. ✨",
    "That gorgeous brain of yours never misses, Corrine! 😍",
    "Smart, stunning, and absolutely on fire, Corrine! 🔥",
    "Gorgeous and a genius — how'd I get so lucky? 💖",
    "Pretty and brilliant in equal measure, Corrine! 🌟",
    "Clever mind, beautiful heart. Keep soaring, Corrine! 🛫",
    "Your brilliance shines as bright as your smile, Corrine! ✨",
  ];
  const MAPLE_COMBO = ["Maple's tail is wagging! 🐕", "You're on fire, Corrine! 🔥", "Maple can't believe her eyes! 🤩", "Zoomies-level streak! 🐾"];
  const MAPLE_MISS = ["Maple still loves you 💛", "Shake it off — next one's yours!", "Even captains hit turbulence ✈️", "Maple believes in you, Corrine 🐕"];
  const MAPLE_LEARNED = ["💋 Kiss from Maple — CODE learned!", "🐶 Maple smooch! CODE is yours now!", "💕 CODE mastered — collect your Maple kiss!"];

  const BADGES = [
    { id: "first-flight", emoji: "🛫", name: "First Flight", check: (s) => Object.keys(s.nodes).length >= 1 },
    { id: "hub-captain", emoji: "⭐", name: "Hub Captain", check: (s) => unitStamped(s, "hubs") },
    { id: "aloha", emoji: "🌺", name: "Aloha Expert", check: (s) => unitStamped(s, "hawaii") },
    { id: "texas", emoji: "🤠", name: "Texas Two-Step", check: (s) => unitStamped(s, "texas") },
    { id: "flawless", emoji: "💯", name: "Flawless Flight", check: (s) => s.flawless >= 1 },
    { id: "week-sky", emoji: "🔥", name: "Week in the Sky", check: (s) => s.streak.count >= 7 || s.streak.best >= 7 },
    { id: "century", emoji: "💺", name: "Century Club", check: (s) => s.correctTotal >= 100 },
    { id: "globetrotter", emoji: "🌍", name: "Globetrotter", check: (s) => mastersIntl(s) >= 10 },
    { id: "best-friend", emoji: "🐕", name: "Maple's Best Friend", check: (s) => s.kisses >= 10 },
    { id: "chiefs-club", emoji: "🏆", name: "Chief's Club", check: (s) => UNITS.every((u) => unitStamped(s, u.id)) },
    // ---- Line Check badges (mode 2) ----
    { id: "line-check", emoji: "🎧", name: "First Line Check", check: (s) => lcStat(s, "rounds") >= 1 },
    { id: "off-cuff", emoji: "🗣️", name: "Off the Cuff", check: (s) => lcStat(s, "rounds") >= 10 },
    { id: "said-aloud", emoji: "🎤", name: "Said It Out Loud", check: (s) => lcStat(s, "spoken") >= 10 },
    { id: "ramp-rush", emoji: "⏱️", name: "Ramp Rush", check: (s) => lcStat(s, "rushBest") >= 15 },
    { id: "quizmaster", emoji: "📱", name: "Quizmaster", check: (s) => lcStat(s, "cards") >= 20 },
  ];
  const lcStat = (s, key) => Number((s.lc || {})[key]) || 0;

  const CONN_SECONDS = 20; // tight-connection bonus window
  const CONN_MILES = 25;
  const BONUS_SECONDS = 45; // Final Boarding round

  // ---------- state ----------------------------------------------------------
  let state = Store.loadState();
  state.items = Srs.buildItems(AIRPORTS, state.items);
  rolloverDay();
  Store.saveState(state);
  Sfx.muted = !state.settings.sound;

  let flight = null; // active flight (lesson) state
  let connTimer = null, bonusTimer = null;
  let pendingContinue = false; // tight-connection countdown deferred until cheers close
  const cheerQueue = [];

  // ---------- tiny helpers ---------------------------------------------------
  const $ = (id) => document.getElementById(id);
  function on(id, event, handler) {
    const el = $(id);
    if (el) el.addEventListener(event, handler);
  }
  // function declarations (hoisted — used during state init above)
  function todayIdx() {
    return Srs.localDayIndex(Date.now());
  }
  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function rolloverDay() {
    const t = todayIdx();
    if (state.day.dayIndex !== t) state.day = { dayIndex: t, miles: 0 };
  }

  function hookFor(code) {
    if (HOOKS[code]) return HOOKS[code];
    const city = (byCode[code] || {}).city || "";
    const cityU = city.toUpperCase().replace(/[^A-Z]/g, "");
    if (cityU.startsWith(code)) return `${code} starts ${city}`;
    return null;
  }

  function unitStamped(s, unitId) {
    const unit = UNITS.find((u) => u.id === unitId);
    if (!unit) return false;
    return nodesForUnit(unit).every((n) => s.nodes[n.id]);
  }
  function mastersIntl(s) {
    let n = 0;
    for (const a of AIRPORTS) {
      if (a.region !== "International") continue;
      const i1 = s.items[`${a.code}|CODE_TO_CITY`], i2 = s.items[`${a.code}|CITY_TO_CODE`];
      if (i1 && i2 && Srs.isMastered(i1) && Srs.isMastered(i2)) n++;
    }
    return n;
  }

  // deterministic flight number from a node id
  function flightNo(nodeId) {
    let h = 0;
    for (const ch of nodeId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return "UA " + (1000 + (h % 8999));
  }

  // ---------- path structure -------------------------------------------------
  function nodesForUnit(unit) {
    const codes = unit.codes;
    const nodes = [];
    if (codes.length > 5) {
      const half = Math.ceil(codes.length / 2);
      nodes.push({ id: `${unit.id}:0`, label: "Flight 1", codes: codes.slice(0, half), len: 10 });
      nodes.push({ id: `${unit.id}:1`, label: "Flight 2", codes: codes.slice(half), len: 10 });
    } else {
      nodes.push({ id: `${unit.id}:0`, label: "Flight 1", codes: codes.slice(), len: 10 });
    }
    nodes.push({ id: `${unit.id}:land`, label: "Landing", codes: codes.slice(), len: 12, landing: true });
    return nodes;
  }

  function unitUnlocked(idx) {
    return idx === 0 || unitStamped(state, UNITS[idx - 1].id);
  }

  function firstOpenNode() {
    for (let i = 0; i < UNITS.length; i++) {
      if (!unitUnlocked(i)) break;
      for (const n of nodesForUnit(UNITS[i])) if (!state.nodes[n.id]) return { unit: UNITS[i], node: n, unitIdx: i };
    }
    return null;
  }

  /*
   * Items for the Standby list: cards she has LEARNED that are now due for an
   * occasional check (or slipped and need a refresh). Cards still mid-learning
   * inside a unit are excluded — they re-drill in their own unit's flights, and
   * counting them here would make standby nag one minute after every lesson.
   */
  function dueReviewItems() {
    const now = Date.now();
    return Object.values(state.items)
      .filter((it) => it.learnedOnce && !Srs.isNew(it) && Srs.isDue(it, now))
      .sort((a, b) => a.due - b.due);
  }
  function dueReviewCodes() {
    return [...new Set(dueReviewItems().map((it) => it.code))];
  }

  function masteredCodes() {
    const out = [];
    for (const a of AIRPORTS) {
      const i1 = state.items[`${a.code}|CODE_TO_CITY`];
      if (i1 && Srs.isMastered(i1)) out.push(a.code);
    }
    return out;
  }

  // ---------- screens --------------------------------------------------------
  const SCREENS = [
    "path-screen", "lesson-screen", "complete-screen", "passport-screen", "settings-screen",
    "lc-home-screen", "lc-screen", "lc-report-screen", "lc-cards-screen",
  ];
  const FULL_SCREENS = ["lesson-screen", "complete-screen", "lc-screen", "lc-cards-screen"];
  function show(id) {
    SCREENS.forEach((s) => ($(s).hidden = s !== id));
    $("tabbar").hidden = FULL_SCREENS.includes(id);
    // Line Check screens take over the whole page chrome — that visual break is
    // the point: she should never mistake one mode for the other.
    document.body.classList.toggle("lc-mode", id.indexOf("lc-") === 0);
    clearInterval(connTimer);
    if (id !== "lesson-screen") clearInterval(bonusTimer);
    if (id !== "lc-screen") stopLcTimers();
  }

  // ---------- topbar / path rendering ---------------------------------------
  function renderTopbar() {
    rolloverDay();
    const flownToday = state.streak.lastDay === todayIdx();
    $("streak-num").textContent = state.streak.count;
    $("streak-chip").classList.toggle("cold", !flownToday);
    $("miles-num").textContent = state.miles.toLocaleString();
    const pct = Math.min(100, Math.round((state.day.miles / state.settings.dailyGoal) * 100));
    const ring = $("goal-ring");
    ring.style.setProperty("--pct", pct);
    ring.classList.toggle("done", pct >= 100);
    $("goal-plane").textContent = pct >= 100 ? "🏅" : "🎯";
    const atRisk = state.streak.count > 0 && state.streak.lastDay === todayIdx() - 1;
    $("risk-banner").hidden = !atRisk;
    if (atRisk) $("risk-text").textContent = `Don't lose your ${state.streak.count}-day streak, Corrine — land one flight today! 🔥`;
    if ("setAppBadge" in navigator) {
      try {
        const due = dueReviewCodes().length;
        Promise.resolve(due > 0 ? navigator.setAppBadge(due) : navigator.clearAppBadge && navigator.clearAppBadge()).catch(() => {});
      } catch (e) {
        /* badge is decorative — never let it break the topbar */
      }
    }
  }

  function nodeButton(node, cls, inner, label) {
    // locked nodes get a real disabled attribute — CSS pointer-events alone
    // doesn't stop keyboard/assistive-tech activation
    const dis = cls.includes("locked") ? " disabled" : "";
    return `<div class="path-row"><button class="node ${cls}" data-node="${node.id}" aria-label="${label}"${dis}>
      <span class="node-label">${label}</span>${inner}</button></div>`;
  }

  function renderPath() {
    renderTopbar();
    const cont = $("path-container");
    let html = "";

    const due = dueReviewCodes();
    if (due.length >= 1) { // even a single due card gets a way home — no stranding
      html += `<div class="path" style="padding-top:34px">
        <div class="path-row"><button class="node review current" data-node="standby" aria-label="Standby flight">
          <span class="start-pill" style="color:var(--sky)">STANDBY · ${due.length} WAITING</span>🧳</button></div>
      </div>`;
    }

    const open = firstOpenNode();
    for (let i = 0; i < UNITS.length; i++) {
      const unit = UNITS[i];
      const unlocked = unitUnlocked(i);
      const stamped = unitStamped(state, unit.id);
      html += `<div class="unit-header ${stamped ? "done" : ""}">
        <div class="kicker">Route ${i + 1} of ${UNITS.length} ${stamped ? "· DEPARTED ✓" : unlocked ? "· NOW BOARDING" : "· GATE CLOSED"}</div>
        <div class="name">${unit.emoji} ${unit.title}</div></div>`;
      html += '<div class="path" style="padding-top:30px">';
      const nodes = nodesForUnit(unit);
      for (const n of nodes) {
        const rec = state.nodes[n.id];
        const isCurrent = open && open.node.id === n.id;
        const nodeUnlockedNow = unlocked && (rec || isCurrent || nodes.slice(0, nodes.indexOf(n)).every((p) => state.nodes[p.id]));
        let cls = "locked", inner = n.landing ? "🛬" : "✈️";
        if (rec) {
          cls = "done";
          inner = (n.landing ? "🛬" : "✈️") + `<span class="stars">${"★".repeat(rec.stars)}${"☆".repeat(3 - rec.stars)}</span>`;
        } else if (isCurrent) {
          cls = "current";
          inner = `<span class="start-pill">NOW BOARDING</span>` + (n.landing ? "🛬" : "✈️");
        } else if (nodeUnlockedNow) {
          cls = "";
        } else {
          inner = "🔒";
        }
        html += nodeButton(n, cls, inner, n.label);
      }
      html += "</div>";
      if (!unlocked) break; // don't render the whole locked world — keeps focus
    }
    // the first locked unit is already rendered above, so don't count it twice
    const remaining = UNITS.filter((_, i) => !unitUnlocked(i)).length - 1;
    if (remaining > 0) html += `<p class="muted" style="text-align:center">…${remaining} more routes to unlock ✈️</p>`;
    cont.innerHTML = html;

    cont.querySelectorAll(".node").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.node;
        Sfx.tick();
        if (id === "standby") return startStandby();
        for (const u of UNITS) for (const n of nodesForUnit(u)) if (n.id === id) return startFlight(u, n);
      });
    });

    const cur = cont.querySelector(".node.current");
    if (cur && cur.scrollIntoView) setTimeout(() => cur.scrollIntoView({ block: "center", behavior: "smooth" }), 60);
  }

  // ---------- flight runner --------------------------------------------------
  function familiarFn() {
    return (code) => {
      const i1 = state.items[`${code}|CODE_TO_CITY`], i2 = state.items[`${code}|CITY_TO_CODE`];
      return (i1 && (i1.reps > 0 || i1.learnedOnce)) || (i2 && (i2.reps > 0 || i2.learnedOnce));
    };
  }

  function startFlight(unit, node) {
    const pool = node.codes.map((c) => byCode[c]);
    const questions = Game.buildLesson(pool, AIRPORTS, { length: node.len, familiar: node.landing ? () => true : familiarFn() });
    beginFlight({ nodeId: node.id, unit, node, questions, review: false, bonus: false });
  }

  function startStandby() {
    // Target the exact due items, in their due DIRECTION, so finishing the
    // standby flight actually clears the standby list.
    const items = dueReviewItems().slice(0, 12);
    if (!items.length) return;
    const poolOf = (code) => {
      const unit = UNITS.find((u) => u.codes.includes(code));
      return (unit ? unit.codes : [code]).map((c) => byCode[c]);
    };
    let questions = items.map((it) => {
      const a = byCode[it.code];
      if (it.dir === "CODE_TO_CITY") return Game.qMcCity(a, poolOf(it.code), AIRPORTS);
      return Math.random() < 0.5 ? Game.qTypeCode(a, poolOf(it.code), AIRPORTS) : Game.qMcCode(a, poolOf(it.code), AIRPORTS);
    });
    questions = Game.shuffleArr(questions);
    beginFlight({ nodeId: "standby", unit: null, node: null, questions, review: true, bonus: false });
  }

  function beginFlight(cfg) {
    flight = {
      ...cfg,
      qi: 0,
      passed: 0,
      planned: cfg.questions.length,
      wrong: 0,
      combo: 0,
      maxCombo: 0,
      miles: 0,
      retries: [],
      inFinalApproach: false,
      learnedCodes: [],
      pairState: null,
    };
    $("combo-flame").textContent = "";
    $("lesson-fill").style.width = "0%";
    $("lesson-fill").style.background = "";
    show("lesson-screen");
    renderQuestion();
  }

  function currentQ() {
    if (flight.qi < flight.questions.length) return flight.questions[flight.qi];
    return flight.retries[flight.qi - flight.questions.length] || null;
  }

  function setMaple(mood, text) {
    const m = $("maple");
    m.classList.remove("happy", "sad");
    if (mood) m.classList.add(mood);
    const b = $("maple-bubble");
    if (text) {
      b.textContent = text;
      b.hidden = false;
    } else b.hidden = true;
  }

  function renderQuestion() {
    if (!flight) return; // quit raced a pending timer
    const q = currentQ();
    if (!q) return land();
    flight.locked = false; // new question, grading unlocked
    const area = $("q-area");
    if (flight.showFA) {
      // entering Final Approach — the banner survives this question render
      setMaple(null, `🛬 Final approach — let's fix ${flight.retries.length}!`);
      flight.showFA = false;
    } else if (flight.stickyBubble) {
      // a kiss/hook earned on the last answer stays visible through this question
      setMaple("happy", flight.stickyBubble);
      flight.stickyBubble = null;
    } else {
      // NOTE: hooks are never shown during a live question — they'd leak the answer
      setMaple(null, null);
    }
    let html = `<div class="q-sub">${q.sub}</div>`;
    if (q.type === "pairs") {
      html += `<div class="pairs-grid" id="pairs-grid">`;
      for (let i = 0; i < q.left.length; i++) {
        html += `<button class="opt code" data-side="l" data-val="${q.left[i]}">${q.left[i]}</button>`;
        html += `<button class="opt" data-side="r" data-val="${escapeHtml(q.right[i])}">${escapeHtml(q.right[i])}</button>`;
      }
      html += `</div>`;
      flight.pairState = { sel: { l: null, r: null }, matched: 0, mistakes: 0 };
    } else {
      const isCode = q.type === "mc-city"; // prompt is a code
      html += `<div class="q-prompt ${isCode ? "" : "city"}">${escapeHtml(q.prompt)}</div>`;
      if (q.type === "type-code") {
        html += `<div class="type-row" id="slots">
          <button type="button" class="type-box" data-slot="0" aria-label="letter slot 1"></button><button type="button" class="type-box" data-slot="1" aria-label="letter slot 2"></button><button type="button" class="type-box" data-slot="2" aria-label="letter slot 3"></button>
        </div>
        <div class="options grid2" id="tiles" style="grid-template-columns:repeat(4,1fr)">` +
          q.letters.map((ch, i) => `<button class="opt code" data-tile="${i}" data-ch="${ch}">${ch}</button>`).join("") +
          `</div>`;
      } else {
        const codeOpts = q.type === "mc-code";
        html += `<div class="options ${codeOpts ? "grid2" : ""}">` +
          q.options.map((o) => `<button class="opt ${codeOpts ? "code" : ""}" data-opt="${escapeHtml(o)}">${escapeHtml(o)}</button>`).join("") +
          `</div>`;
      }
    }
    area.innerHTML = html;
    wireQuestion(q);
    updateBar();
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  }

  function wireQuestion(q) {
    const area = $("q-area");
    if (q.type === "pairs") {
      area.querySelectorAll(".opt").forEach((b) =>
        b.addEventListener("click", () => {
          if (flight.locked || b.classList.contains("matched")) return;
          Sfx.tick();
          const side = b.dataset.side;
          area.querySelectorAll(`.opt[data-side="${side}"]`).forEach((x) => x.classList.remove("selected"));
          b.classList.add("selected");
          flight.pairState.sel[side] = b;
          const { l, r } = flight.pairState.sel;
          if (l && r) checkPair(q, l, r);
        })
      );
    } else if (q.type === "type-code") {
      const slots = [...area.querySelectorAll(".type-box")];
      const tiles = [...area.querySelectorAll("[data-tile]")];
      const placed = [null, null, null];
      const sync = () => {
        slots.forEach((s, i) => (s.textContent = placed[i] ? placed[i].dataset.ch : ""));
        if (placed.every(Boolean)) {
          const typed = placed.map((t) => t.dataset.ch).join("");
          flight.timer = setTimeout(() => answer(q, Game.checkTyped(typed, q.answer), typed), 120);
        }
      };
      tiles.forEach((t) =>
        t.addEventListener("click", () => {
          if (flight.locked || t.classList.contains("dim")) return;
          const i = placed.findIndex((x) => !x);
          if (i === -1) return;
          Sfx.tick();
          placed[i] = t;
          t.classList.add("dim");
          sync();
        })
      );
      slots.forEach((s, i) =>
        s.addEventListener("click", () => {
          if (flight.locked || !placed[i]) return;
          Sfx.tick();
          placed[i].classList.remove("dim");
          placed[i] = null;
          // compact leftwards
          const rest = placed.filter(Boolean);
          placed.fill(null);
          rest.forEach((t, j) => (placed[j] = t));
          sync();
        })
      );
    } else {
      area.querySelectorAll("[data-opt]").forEach((b) =>
        b.addEventListener("click", () => {
          const val = b.dataset.opt;
          answer(q, val === q.answer, val, b);
        })
      );
    }
  }

  function checkPair(q, l, r) {
    flight.pairState.sel = { l: null, r: null };
    const ok = q.answerMap[l.dataset.val] === r.dataset.val;
    l.classList.remove("selected");
    r.classList.remove("selected");
    if (ok) {
      l.classList.add("matched");
      r.classList.add("matched");
      Sfx.match();
      gradeSrs(l.dataset.val, "CODE_TO_CITY", true);
      flight.pairState.matched++;
      if (flight.pairState.matched === q.left.length) {
        const flawlessBoard = flight.pairState.mistakes === 0;
        answer(q, flawlessBoard, null, null, { pairsDone: true });
      }
    } else {
      l.classList.add("wrong");
      r.classList.add("wrong");
      Sfx.wrong();
      if (navigator.vibrate) navigator.vibrate(40);
      flight.pairState.mistakes++;
      gradeSrs(l.dataset.val, "CODE_TO_CITY", false);
      setTimeout(() => {
        l.classList.remove("wrong");
        r.classList.remove("wrong");
      }, 450);
    }
  }

  function gradeSrs(code, dir, correct) {
    if (flight.bonus) return; // bonus round never punishes the schedule
    const id = `${code}|${dir}`;
    const item = state.items[id];
    if (!item) return;
    const updated = Srs.grade(item, correct);
    state.items[id] = updated;
    if (correct) state.correctTotal++;
    if (correct && !item.learnedOnce && updated.learnedOnce) {
      state.kisses++;
      if (!flight.learnedCodes.includes(code)) flight.learnedCodes.push(code); // both directions -> one mention
      const msg = pick(MAPLE_LEARNED).replace("CODE", code);
      flight.stickyBubble = msg; // survives into the next question instead of flashing
      setMaple("happy", msg);
      Sfx.match();
    }
  }

  function dirOf(q) {
    return q.type === "mc-city" ? "CODE_TO_CITY" : "CITY_TO_CODE";
  }

  function answer(q, correct, given, optBtn, extra = {}) {
    if (!flight || flight.locked) return; // re-entry guard: one grade per question
    flight.locked = true;
    rolloverDay(); // miles land on the correct calendar day, even past midnight

    // lock options
    $("q-area").querySelectorAll(".opt").forEach((b) => b.classList.add("dim"));
    if (optBtn) optBtn.classList.remove("dim");

    if (q.type !== "pairs") gradeSrs(q.code, dirOf(q), correct);

    // a pairs board finished WITH mistakes: mismatches were already penalized
    // per-pair (SRS + sound + shake); the board itself just moves on gently.
    if (extra.pairsDone && !correct) {
      flight.combo = 0;
      flight.wrong++;
      $("combo-flame").textContent = "";
      flight.miles += 10;
      state.miles += 10;
      state.day.miles += 10;
      flight.passed++;
      setMaple("sad", pick(MAPLE_MISS));
      flight.timer = setTimeout(advance, 650);
      return;
    }

    if (correct) {
      flight.combo++;
      flight.maxCombo = Math.max(flight.maxCombo, flight.combo);
      // combo bonus GROWS with the streak (x3 -> +1 ... capped +10) so the
      // flame's escalation is backed by real miles
      const bonus = flight.combo >= 3 ? Math.min(10, flight.combo - 2) : 0;
      const gained = flight.bonus ? 5 : q.miles + bonus;
      flight.miles += gained;
      state.miles += gained;
      state.day.miles += gained;
      if (optBtn) optBtn.classList.add("correct");
      if (q.type === "type-code") $("q-area").querySelectorAll(".type-box").forEach((s) => s.classList.add?.("correct"));
      Sfx.correct(flight.combo);
      if (navigator.vibrate) navigator.vibrate(18);
      const flame = $("combo-flame");
      flame.textContent = flight.combo >= 2 ? `🔥 x${flight.combo}` : "";
      flame.classList.remove("hot");
      void flame.offsetWidth;
      flame.classList.add("hot");
      if (q.intro && hookFor(q.code)) {
        // right after an intro guess is the moment the hook actually teaches
        flight.stickyBubble = `💡 ${hookFor(q.code)}`;
        setMaple("happy", flight.stickyBubble);
      } else if (flight.stickyBubble) {
        // a kiss message was just set by gradeSrs — don't clobber it
      } else if (flight.combo === 3 || flight.combo === 6 || flight.combo === 9) {
        setMaple("happy", pick(MAPLE_COMBO));
      } else {
        setMaple("happy", null);
      }
      flight.passed++;
      if (flight.bonus) {
        flight.bonusScore = (flight.bonusScore || 0) + 1;
        flight.timer = setTimeout(nextBonusQ, 350);
      } else {
        flight.timer = setTimeout(advance, 650);
      }
    } else {
      flight.combo = 0;
      flight.wrong++;
      $("combo-flame").textContent = "";
      if (optBtn) optBtn.classList.add("wrong");
      // reveal the right option at full strength — this is the learning moment
      $("q-area").querySelectorAll("[data-opt]").forEach((b) => {
        if (b.dataset.opt === q.answer) {
          b.classList.add("correct");
          b.classList.remove("dim");
        }
      });
      if (q.type === "type-code") {
        // rewrite the slots with the correct code, highlighted
        $("q-area").querySelectorAll(".type-box").forEach((s, i) => {
          s.textContent = q.answer[i] || "";
          s.classList.add("correct");
        });
      }
      Sfx.wrong();
      if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
      setMaple("sad", pick(MAPLE_MISS));
      if (flight.bonus) {
        flight.timer = setTimeout(nextBonusQ, 550);
        return;
      }
      if (!flight.inFinalApproach && (q.retried || 0) < 1 && q.type !== "pairs") {
        flight.retries.push({ ...q, retried: 1 });
        flight.passed++; // the missed slot is consumed…
        flight.planned++; // …and its retry becomes a new slot NOW, so the bar never shrinks
      } else {
        flight.passed++; // retried and still missed — slot passes so she always lands
      }
      showFeedback(q, given);
    }
  }

  function showFeedback(q, given) {
    const fb = $("feedback");
    fb.classList.remove("good");
    fb.classList.add("bad", "show");
    // make room so the footer can't hide the revealed correct answer…
    $("lesson-screen").classList.add("fb-open");
    // …and bring that answer into view (the learning moment must be visible)
    const revealed = $("q-area").querySelector(".opt.correct, .type-box.correct");
    if (revealed && revealed.scrollIntoView) revealed.scrollIntoView({ block: "center", behavior: "smooth" });
    $("fb-headline").textContent = "Not quite…";
    const ans = q.type === "pairs" ? "" : `${q.type === "mc-city" ? q.prompt + " → " + q.answer : q.answer + " = " + q.prompt}`;
    $("fb-detail").textContent = ans;
    const hook = hookFor(q.code);
    const city = (byCode[q.code] || {}).city || "";
    $("fb-hint").textContent = hook
      ? `💡 ${hook}`
      : `📝 Say it three times: ${q.code} = ${city}`; // every miss teaches something
  }

  function hideFeedback() {
    $("feedback").classList.remove("show");
    $("lesson-screen").classList.remove("fb-open");
  }

  function advance() {
    if (!flight) return; // flight was quit while a timer was pending
    hideFeedback();
    flight.qi++;
    const mainDone = flight.qi >= flight.questions.length;
    if (mainDone && !flight.inFinalApproach && flight.retries.length > 0) {
      flight.inFinalApproach = true;
      // planned already grew when each retry was queued — only announce the phase
      flight.showFA = true; // banner is applied by the next renderQuestion
    }
    renderQuestion();
  }

  function updateBar() {
    const pct = Math.min(100, Math.round((flight.passed / flight.planned) * 100));
    $("lesson-fill").style.width = pct + "%";
  }

  // when a retried question is answered correctly its slot passes via flight.passed++ in answer()

  // ---------- landing ---------------------------------------------------------
  function land() {
    updateBar();
    const flawless = flight.wrong === 0;
    const stars = flawless ? 3 : flight.wrong <= 2 ? 2 : 1;
    const bonusMiles = flight.bonus ? 0 : 30 + (flawless ? 20 : 0); // landing + flawless bonus
    flight.miles += bonusMiles;
    state.miles += bonusMiles;
    state.day.miles += bonusMiles;

    // node completion
    if (flight.nodeId !== "standby" && !flight.bonus) {
      const prev = state.nodes[flight.nodeId];
      state.nodes[flight.nodeId] = { stars: Math.max(stars, prev ? prev.stars : 0), plays: (prev ? prev.plays : 0) + 1 };
    }

    // streak (any landed flight counts the day) + weather delay
    const { streak, usedFreeze } = Srs.bumpStreakWithFreeze(state.streak, Date.now(), state.freezes);
    const streakGrew = streak.count > state.streak.count || streak.lastDay !== state.streak.lastDay;
    state.streak = streak;
    if (usedFreeze) {
      state.freezes--;
      cheerQueue.push({ dog: "🌦️", msg: "Weather delay! Maple guarded your streak while you were away. 🐕⛑️" });
    }

    // flawless economy: every 3rd flawless flight banks a Weather Delay
    if (flawless && !flight.bonus) {
      state.flawless++;
      if (state.flawless % 3 === 0 && state.freezes < 2) {
        state.freezes++;
        cheerQueue.push({ dog: "🌦️", msg: "3 flawless flights — Maple fetched you a Weather Delay! (streak shield) 🛡️" });
      }
    }

    // unit stamp ceremony
    if (flight.unit && unitStamped(state, flight.unit.id) && !state.badges[`stamp-${flight.unit.id}`]) {
      state.badges[`stamp-${flight.unit.id}`] = Date.now(); // internal marker so the ceremony fires once
      cheerQueue.push({ dog: "🛂", msg: `${flight.unit.emoji} ${flight.unit.title} — STAMPED into your passport! Maple is doing zoomies! 🐕💨` });
      Sfx.unlock();
    }

    awardBadges();

    // streak milestones
    if (streakGrew && [3, 7, 14, 30, 100].includes(state.streak.count)) {
      cheerQueue.push({ dog: "🔥", msg: `${state.streak.count} days on duty, Corrine! ${pick(CHEERS)}` });
    }

    Store.saveState(state);

    // render the boarding pass
    $("complete-title").textContent = flight.bonus ? "Doors closed! ⚡" : flight.review ? "Standby cleared! 🧳" : "Flight landed! 🛬";
    $("complete-stars").textContent = flight.bonus ? "" : "⭐".repeat(stars) + "☆".repeat(3 - stars);
    $("bp-flight").textContent = flightNo(flight.nodeId || "bonus");
    const acc = flight.bonus
      ? `${flight.bonusScore || 0}✓`
      : Math.round((100 * (flight.planned - flight.wrong)) / Math.max(1, flight.planned)) + "%";
    $("bp-acc").textContent = acc;
    $("bp-combo").textContent = flight.maxCombo;
    const learned = flight.learnedCodes.length
      ? `💋 Maple kissed you for learning: ${flight.learnedCodes.join(", ")}`
      : pick([`🐕 Maple approves this landing.`, `🐕 ${pick(CHEERS)}`]);
    $("bp-note").textContent = learned;

    // miles count-up
    const target = flight.miles;
    const mEl = $("bp-miles");
    let cur = 0;
    const step = Math.max(1, Math.round(target / 30));
    const iv = setInterval(() => {
      cur = Math.min(target, cur + step);
      mEl.textContent = "+" + cur;
      if (cur >= target) clearInterval(iv);
    }, 28);

    show("complete-screen");
    Sfx.fanfare();
    confetti(flawless ? 80 : 40);

    // Final Boarding offer
    $("bonus-btn").hidden = flight.bonus || masteredCodes().length < 10;

    // daily goal crossing
    if (state.day.miles >= state.settings.dailyGoal && state.day.miles - flight.miles < state.settings.dailyGoal) {
      cheerQueue.push({ dog: "🏅", msg: `Daily goal hit! ${pick(CHEERS)}` });
    }

    // Tight connection: the countdown must NOT burn while she reads her
    // celebration modals — start it only once the cheer queue is empty.
    if (cheerQueue.length) {
      pendingContinue = true;
      const cont = $("continue-btn");
      cont.textContent = "Continue";
      cont.onclick = () => {
        renderPath();
        show("path-screen");
      };
      drainCheers();
    } else {
      setupContinue();
    }
  }

  function setupContinue() {
    clearInterval(connTimer);
    const next = firstOpenNode();
    const cont = $("continue-btn");
    $("path-btn").hidden = !next;
    if (!next || flight.bonus) {
      cont.textContent = "Continue";
      cont.onclick = () => {
        renderPath();
        show("path-screen");
      };
      return;
    }
    let left = CONN_SECONDS;
    const labelBase = `⚡ Tight connection · next flight +${CONN_MILES} ✈️`;
    cont.textContent = `${labelBase} (0:${String(left).padStart(2, "0")})`;
    connTimer = setInterval(() => {
      left--;
      if (left <= 0) {
        clearInterval(connTimer);
        cont.textContent = "Continue";
        cont.onclick = () => {
          renderPath();
          show("path-screen");
        };
        return;
      }
      cont.textContent = `${labelBase} (0:${String(left).padStart(2, "0")})`;
    }, 1000);
    cont.onclick = () => {
      const stillOpen = firstOpenNode();
      clearInterval(connTimer);
      if (left > 0 && stillOpen) {
        state.miles += CONN_MILES;
        state.day.miles += CONN_MILES;
        Store.saveState(state);
        startFlight(stillOpen.unit, stillOpen.node);
      } else {
        renderPath();
        show("path-screen");
      }
    };
  }

  // ---------- Final Boarding (timed bonus) ------------------------------------
  function startBonus() {
    const codes = masteredCodes();
    flight = {
      nodeId: "bonus", unit: null, node: null, questions: [], qi: 0, passed: 0, planned: 1,
      wrong: 0, combo: 0, maxCombo: 0, miles: 0, retries: [], inFinalApproach: false,
      learnedCodes: [], bonus: true, bonusScore: 0, bonusCodes: codes,
    };
    show("lesson-screen");
    $("combo-flame").textContent = "";
    const fill = $("lesson-fill");
    fill.style.width = "100%";
    fill.style.background = "var(--red)";
    let left = BONUS_SECONDS;
    clearInterval(bonusTimer);
    bonusTimer = setInterval(() => {
      left--;
      fill.style.width = Math.max(0, (left / BONUS_SECONDS) * 100) + "%";
      if (left <= 5 && left > 0) Sfx.tick();
      if (left <= 0) {
        clearInterval(bonusTimer);
        land(); // miles were banked per correct answer (+5 each)
      }
    }, 1000);
    nextBonusQ();
  }

  function nextBonusQ() {
    if (!flight || !flight.bonus) return;
    const code = pick(flight.bonusCodes);
    const a = byCode[code];
    const q = Math.random() < 0.5 ? Game.qMcCity(a, AIRPORTS, AIRPORTS) : Game.qMcCode(a, AIRPORTS, AIRPORTS);
    flight.questions = [q];
    flight.qi = 0;
    const area = $("q-area");
    const isCode = q.type === "mc-city";
    const codeOpts = q.type === "mc-code";
    area.innerHTML =
      `<div class="q-sub">⚡ DOORS CLOSING — ${q.sub}</div>
       <div class="q-prompt ${isCode ? "" : "city"}">${escapeHtml(q.prompt)}</div>
       <div class="options ${codeOpts ? "grid2" : ""}">` +
      q.options.map((o) => `<button class="opt ${codeOpts ? "code" : ""}" data-opt="${escapeHtml(o)}">${escapeHtml(o)}</button>`).join("") +
      `</div>`;
    setMaple(null, null);
    area.querySelectorAll("[data-opt]").forEach((b) =>
      b.addEventListener("click", () => answer(q, b.dataset.opt === q.answer, b.dataset.opt, b))
    );
  }

  // Award any newly-earned badges (shared by both modes).
  function awardBadges() {
    for (const b of BADGES) {
      if (!state.badges[b.id] && b.check(state)) {
        state.badges[b.id] = Date.now();
        cheerQueue.push({ dog: b.emoji, msg: `Badge earned: ${b.name}! ${pick(CHEERS)}` });
        Sfx.unlock();
      }
    }
  }

  // ---------- confetti ---------------------------------------------------------
  function confetti(n) {
    const colors = ["#f0a500", "#58cc02", "#4a90d9", "#ff4b4b", "#1d4e9c", "#ff9ff3"];
    for (let i = 0; i < n; i++) {
      const p = document.createElement("div");
      p.className = "confetti-piece";
      p.style.left = Math.random() * 100 + "vw";
      p.style.background = pick(colors);
      p.style.animationDuration = 1.6 + Math.random() * 1.6 + "s";
      p.style.animationDelay = Math.random() * 0.5 + "s";
      p.style.transform = `rotate(${Math.random() * 360}deg)`;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 4000);
    }
  }

  // ---------- cheer overlay ------------------------------------------------------
  function drainCheers() {
    if (!cheerQueue.length) return;
    const { dog, msg } = cheerQueue.shift();
    $("cheer-dog").textContent = dog;
    $("cheer-msg").textContent = msg;
    $("cheer-overlay").classList.add("show");
  }
  on("cheer-btn", "click", () => {
    $("cheer-overlay").classList.remove("show");
    Sfx.tick();
    if (cheerQueue.length) {
      setTimeout(drainCheers, 250);
    } else if (pendingContinue && !$("complete-screen").hidden) {
      pendingContinue = false;
      setupContinue(); // now she's watching — start the tight-connection clock
    }
  });

  /* ==========================================================================
   * LINE CHECK — mode 2
   *
   * Academy asks the question the same way every time, inside a route that has
   * already narrowed the answer to six airports, with the answer sitting on
   * screen. That builds a memory bound to this app's cues.
   *
   * Line Check removes them: she types or says the answer, the questions are
   * interleaved across everything she's seen, the wording changes every time,
   * and the card's SKIN changes every question so the layout can't become the
   * cue either. Same SRS brain, same miles — different retrieval path.
   * ========================================================================== */

  const lcIndex = LineCheck.buildAliasIndex(AIRPORTS); // alias -> codes, built once
  let lc = null; // active Line Check round
  let lcTimer = null; // Ramp Rush countdown
  let lcMic = null; // live speech-recognition handle
  let lcLastSkin = null;
  let deck = null; // hand-the-phone-over card deck

  const SKINS = [
    { cls: "skin-plain", align: "center" },
    { cls: "skin-note", align: "left" },
    { cls: "skin-tag", align: "center" },
    { cls: "skin-board", align: "left" },
    { cls: "skin-pa", align: "center" },
    { cls: "skin-pass", align: "left" },
    { cls: "skin-bare", align: "left" },
  ];

  const RUSH_SECONDS = 60;

  function stopLcTimers() {
    clearInterval(lcTimer);
    lcTimer = null;
    stopMic();
    if (typeof Voice !== "undefined") Voice.stopSpeaking();
  }
  function stopMic() {
    if (lcMic) {
      lcMic.stop();
      lcMic = null;
    }
    if (typeof Voice !== "undefined") Voice.stopListening();
    const btn = $("lc-mic");
    if (btn) btn.classList.remove("listening");
  }

  const voiceMode = () => state.settings.voice || "full";
  const canSpeak = () => voiceMode() !== "off" && typeof Voice !== "undefined" && Voice.supportsSpeak;
  const canListen = () => voiceMode() === "full" && typeof Voice !== "undefined" && Voice.supportsListen;

  /*
   * The airports Line Check may ask about: everything she's already met in
   * Academy. On a brand-new account that's empty, so the hubs stand in — this
   * mode should never be a locked door.
   */
  function lcPool() {
    const fam = familiarFn();
    const pool = AIRPORTS.filter((a) => fam(a.code));
    if (pool.length >= 6) return pool;
    const starter = UNITS[0].codes.map((c) => byCode[c]);
    const seen = new Set(pool.map((a) => a.code));
    return pool.concat(starter.filter((a) => !seen.has(a.code)));
  }

  function lcGroups(pool) {
    return LineCheck.buildGroups(UNITS, AIRPORTS, pool.map((a) => a.code));
  }

  /*
   * Grade an answer into the scheduler.
   *
   * Producing an answer cold is stronger evidence than picking it out of four
   * options, so while a card is still being LEARNED a Line Check hit counts
   * twice. Once she knows it we grade once — the review interval should track
   * what she's actually proven, not get inflated by the bonus.
   */
  function lcGradeSrs(code, dir, correct) {
    const id = `${code}|${dir}`;
    const item = state.items[id];
    if (!item) return;
    let updated = Srs.grade(item, correct);
    if (correct && !Srs.isMastered(item) && !Srs.isMastered(updated)) updated = Srs.grade(updated, true);
    state.items[id] = updated;
    if (correct) state.correctTotal++;
    if (correct && !item.learnedOnce && updated.learnedOnce) {
      state.kisses++;
      if (lc && !lc.learned.includes(code)) lc.learned.push(code);
    }
  }

  function lcAddMiles(n) {
    rolloverDay();
    lc.miles += n;
    state.miles += n;
    state.day.miles += n;
  }

  // ---------- Line Check home (ops board) ------------------------------------
  function renderLcHome() {
    rolloverDay();
    const pool = lcPool();
    const s = state.lc || {};
    $("lc-stats").innerHTML =
      `<span class="pill">✈️ ${state.miles.toLocaleString()} miles</span>` +
      `<span class="pill">🔥 ${state.streak.count}-day streak</span>` +
      `<span class="pill">🎧 ${Number(s.rounds) || 0} line checks</span>` +
      `<span class="pill">⏱️ Rush best ${Number(s.rushBest) || 0}</span>`;

    const groups = lcGroups(pool);
    const menu = [
      { kind: "call", ico: "🎧", name: "Line check · 10 questions", desc: "Cold calls in plain language, a trip sheet, and a free-recall list. Type it or say it." },
      { kind: "rush", ico: "⏱️", name: "Ramp rush · 60 seconds", desc: "Bare city names, as many codes as you can spell before the doors close." },
      { kind: "sheets", ico: "🧾", name: "Trip sheets", desc: "Three legs at a time — read the routing, name every stop." },
      { kind: "recall", ico: "🧠", name: "Free recall", desc: groups.length ? "“Name four codes in Hawaii.” No cue but the category." : "Fly a few more routes to unlock category recall.", off: !groups.length },
      { kind: "cards", ico: "📱", name: "Quiz me — hand the phone over", desc: "Someone else reads the questions out loud. The real test." },
    ];
    $("lc-menu").innerHTML = menu
      .map(
        (m) => `<button class="lc-card ${m.off ? "dim" : ""}" data-kind="${m.kind}" ${m.off ? "disabled" : ""}>
          <span class="ico">${m.ico}</span>
          <span class="body"><span class="name">${m.name}</span><span class="desc">${escapeHtml(m.desc)}</span></span>
          <span class="go">›</span></button>`
      )
      .join("");
    $("lc-menu").querySelectorAll(".lc-card").forEach((btn) =>
      btn.addEventListener("click", () => {
        Sfx.tick();
        if (typeof Voice !== "undefined") Voice.warmUp(); // unlock iOS speech inside the tap
        const kind = btn.dataset.kind;
        if (kind === "cards") return startDeck();
        startLineCheck(kind);
      })
    );
  }

  // ---------- building a round -----------------------------------------------
  function startLineCheck(kind, opts = {}) {
    const pool = lcPool();
    if (!pool.length) return;
    const groups = lcGroups(pool);
    let questions = [];
    if (kind === "call") {
      questions = LineCheck.buildRound(pool, AIRPORTS, { length: 10, groups });
    } else if (kind === "sheets") {
      for (let i = 0; i < 5 && pool.length >= 3; i++) {
        const legs = LineCheck.shuffleArr(pool).slice(0, 3);
        questions.push(LineCheck.qChain(legs, Math.random() < 0.5 ? "CITY_TO_CODE" : "CODE_TO_CITY"));
      }
    } else if (kind === "recall") {
      const gs = LineCheck.shuffleArr(groups).slice(0, 4);
      questions = gs.map((g) => LineCheck.qList(g, 4));
    } else if (kind === "cold") {
      const a = pick(pool);
      questions = [LineCheck.qColdCall(a, Math.random() < 0.5 ? "CITY_TO_CODE" : "CODE_TO_CITY")];
    }
    beginLineCheck({ kind, questions, pool, ...opts });
  }

  function beginLineCheck(cfg) {
    lc = {
      ...cfg,
      qi: 0,
      correct: 0,
      wrong: 0,
      miles: 0,
      spoken: 0,
      learned: [],
      log: [],
      answered: false,
      rushLeft: RUSH_SECONDS,
      rushScore: 0,
    };
    lcLastSkin = null;
    $("lc-fill").style.width = "0%";
    show("lc-screen");
    if (cfg.kind === "rush") return startRush();
    renderLcQuestion();
  }

  // ---------- rendering one question ------------------------------------------
  function skinFor() {
    let s = pick(SKINS);
    if (lcLastSkin && s.cls === lcLastSkin && SKINS.length > 1) s = pick(SKINS.filter((x) => x.cls !== lcLastSkin));
    lcLastSkin = s.cls;
    return s;
  }

  function lcCurrent() {
    return lc.questions[lc.qi] || null;
  }

  function lcMetaText() {
    if (lc.kind === "rush") return `0:${String(lc.rushLeft).padStart(2, "0")}`;
    if (lc.kind === "cold") return "COLD CALL";
    return `${lc.qi + 1}/${lc.questions.length}`;
  }

  function renderLcQuestion() {
    const q = lcCurrent();
    if (!q) return finishLineCheck();
    lc.answered = false;
    stopMic();
    const skin = skinFor();
    $("lc-meta").textContent = lcMetaText();
    $("lc-fill").style.width = Math.round((lc.qi / Math.max(1, lc.questions.length)) * 100) + "%";

    const tag = q.tag ? `<span class="tag-line">${escapeHtml(q.tag)}</span>` : "";
    let card = `<div class="skin ${skin.cls} ${skin.align}">${tag}<div>${escapeHtml(q.prompt)}</div></div>`;
    let body = "";

    if (q.type === "lc-chain") {
      const askCode = q.dir === "CITY_TO_CODE";
      body =
        `<div class="legs">` +
        q.legs
          .map(
            (leg, i) =>
              `<div class="leg"><span class="n">Leg ${i + 1} · ${escapeHtml(askCode ? leg.cue || leg.city : leg.code)}</span>
                <input class="lc-input ${askCode ? "code" : ""}" data-leg="${i}" ${inputAttrs(askCode)} />
              </div>`
          )
          .join("") +
        `</div><div class="lc-row"><button class="btn" id="lc-check">Check the sheet</button></div>`;
    } else if (q.type === "lc-list") {
      body = `<div class="chips" id="lc-chips"></div>
        <input class="lc-input" id="lc-entry" placeholder="Type one, press enter…" ${inputAttrs(false)} />
        <div class="lc-heard" id="lc-heard">0 of ${q.n}</div>
        <div class="lc-row"><button class="btn" id="lc-check">Check my list</button></div>`;
    } else {
      const askCode = q.answerType === "code";
      const mic = canListen() ? `<button class="mic-btn" id="lc-mic" aria-label="Answer out loud">🎙️</button>` : "";
      const replay = canSpeak() ? `<button class="replay-btn" id="lc-replay">🔊 Hear it again</button>` : "";
      body = `${replay}
        <input class="lc-input ${askCode ? "code" : ""}" id="lc-entry" ${inputAttrs(askCode)}
          placeholder="${askCode ? "___" : "the city…"}" />
        <div class="lc-heard" id="lc-heard"></div>
        <div class="lc-row">${mic}<button class="btn" id="lc-check">Check</button></div>`;
    }

    $("lc-stage").innerHTML = `<div id="lc-card">${card}</div><div class="lc-answer" id="lc-body">${body}</div><div id="lc-fb-slot"></div>`;
    wireLcQuestion(q);
  }

  // Phone keyboards love to "help" — for a 3-letter code every one of those
  // helpers (autocorrect, capitalisation, suggestions) is a cue we don't want.
  function inputAttrs(isCode) {
    const base = `autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="go"`;
    return isCode
      ? `${base} maxlength="3" inputmode="text" autocapitalize="characters"`
      : `${base} autocapitalize="words"`;
  }

  function wireLcQuestion(q) {
    const check = $("lc-check");
    if (check) check.addEventListener("click", () => submitLc());

    if (q.type === "lc-list") {
      const entry = $("lc-entry");
      lc.entries = [];
      entry.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const v = entry.value.trim();
        if (!v) return submitLc();
        lc.entries.push(v);
        entry.value = "";
        Sfx.tick();
        renderChips(q);
      });
      entry.focus();
      speakPrompt(q);
      return;
    }

    if (q.type === "lc-chain") {
      const inputs = [...$("lc-body").querySelectorAll("input")];
      inputs.forEach((inp, i) =>
        inp.addEventListener("keydown", (e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          if (i < inputs.length - 1) inputs[i + 1].focus();
          else submitLc();
        })
      );
      inputs[0].focus();
      speakPrompt(q);
      return;
    }

    const entry = $("lc-entry");
    entry.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submitLc();
      }
    });
    const replay = $("lc-replay");
    if (replay) replay.addEventListener("click", () => Voice.speak(q.speak));
    const mic = $("lc-mic");
    if (mic) mic.addEventListener("click", () => (lcMic ? stopMic() : listenForAnswer(q)));

    // Hands-free: say the prompt, then open the mic. If she's typing instead,
    // the keyboard is right there — both paths stay live.
    if (canListen() && !lc.noAutoSpeak) speakPrompt(q).then(() => { if (!lc.answered && lcCurrent() === q) listenForAnswer(q); });
    else {
      entry.focus();
      speakPrompt(q);
    }
  }

  function speakPrompt(q) {
    if (!canSpeak() || lc.noAutoSpeak) return Promise.resolve();
    return Voice.speak(q.speak || q.prompt);
  }

  function renderChips(q) {
    const wrap = $("lc-chips");
    if (!wrap) return;
    wrap.innerHTML = lc.entries
      .map((e, i) => `<span class="chip" data-i="${i}">${escapeHtml(e)}<span class="x">✕</span></span>`)
      .join("");
    wrap.querySelectorAll(".chip").forEach((c) =>
      c.addEventListener("click", () => {
        if (lc.answered) return;
        lc.entries.splice(Number(c.dataset.i), 1);
        renderChips(q);
      })
    );
    const heard = $("lc-heard");
    if (heard) heard.textContent = `${lc.entries.length} of ${q.n}`;
  }

  // ---------- answering out loud -----------------------------------------------
  function listenForAnswer(q) {
    if (lc.answered) return;
    const btn = $("lc-mic");
    const heard = $("lc-heard");
    if (btn) btn.classList.add("listening");
    if (heard) heard.textContent = "Listening… say it out loud";
    lcMic = Voice.listen({
      onPartial: (t) => {
        if (heard) heard.textContent = `“${t}”`;
      },
      onFinal: (best, alts) => {
        if (lc.answered) return;
        const entry = $("lc-entry");
        let value = null;
        if (q.answerType === "code") {
          for (const alt of alts && alts.length ? alts : [best]) {
            const parsed = LineCheck.parseSpokenCode(alt);
            if (parsed) {
              value = parsed;
              break;
            }
          }
        } else {
          value = best;
        }
        if (heard) heard.textContent = `Heard: “${best}”`;
        if (!value) return; // couldn't make a code of it — she can retry or type
        if (entry) entry.value = value;
        lc.viaVoice = true;
        setTimeout(() => submitLc(), 120);
      },
      onError: (kind) => {
        if (!heard) return;
        if (kind === "not-allowed") heard.textContent = "Mic blocked — type it instead.";
        else if (kind === "no-speech") heard.textContent = "Didn't catch that — tap 🎙️ or type it.";
      },
      onEnd: () => {
        lcMic = null;
        const b = $("lc-mic");
        if (b) b.classList.remove("listening");
      },
    });
  }

  // ---------- grading ----------------------------------------------------------
  function submitLc() {
    if (!lc || lc.answered) return;
    const q = lcCurrent();
    if (!q) return;
    stopMic();

    if (q.type === "lc-list") return submitList(q);
    if (q.type === "lc-chain") return submitChain(q);

    const given = ($("lc-entry") || {}).value || "";
    if (!String(given).trim()) return; // nothing typed — don't burn the question

    if (q.answerType === "code") {
      const res = LineCheck.gradeCode(given, q.answer);
      lcGradeSrs(q.code, "CITY_TO_CODE", res.ok);
      return resolveCall(q, res.ok, res.given || given);
    }
    const res = LineCheck.gradeCity(given, q.code, lcIndex, byCode);
    if (res.partial) {
      // She's started the right name — finish it. No penalty for a half-answer.
      showLcFeedback("warn", "Keep going…", `“${String(given).trim()}” is the start of it.`, "Give me the whole name.", { retry: true });
      return;
    }
    if (res.ambiguous) {
      // "Chicago" is not wrong, it's under-specified — ask again, no penalty.
      const others = res.matched.map((c) => byCode[c].city).join(" or ");
      showLcFeedback("warn", "Which one?", `${others}?`, "Two airports share that city — name the one on the tag.", { retry: true });
      return;
    }
    lcGradeSrs(q.code, "CODE_TO_CITY", res.ok);
    resolveCall(q, res.ok, given, res);
  }

  function resolveCall(q, ok, given, res) {
    lc.answered = true;
    const entry = $("lc-entry");
    if (entry) {
      entry.disabled = true;
      entry.classList.add(ok ? "ok" : "bad");
    }
    if (ok) {
      lc.correct++;
      if (lc.viaVoice) {
        lc.spoken++;
        state.lc.spoken = (Number(state.lc.spoken) || 0) + 1;
      }
      lcAddMiles(q.miles + (lc.viaVoice ? 5 : 0)); // saying it out loud pays extra
      Sfx.correct(lc.correct);
      if (navigator.vibrate) navigator.vibrate(18);
      showLcFeedback("good", pick(["Correct.", "That's it.", "Nailed it.", "Yes — clean."]),
        `${q.code} = ${byCode[q.code].city}`, lc.viaVoice ? "🎤 +5 miles for saying it out loud." : "");
    } else {
      lc.wrong++;
      Sfx.wrong();
      if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
      const detail = `${q.code} = ${byCode[q.code].city}`;
      const wrongPlace = res && res.matched && res.matched.length === 1 ? `You said ${byCode[res.matched[0]].city}. ` : "";
      const wasCode = res && res.wasCode ? "That's a code — I asked for the city. " : "";
      showLcFeedback("bad", "Not this time.", detail, `${wasCode}${wrongPlace}${hookFor(q.code) ? "💡 " + hookFor(q.code) : "📝 Say it out loud three times."}`);
    }
    lc.log.push({ code: q.code, city: byCode[q.code].city, ok, given: String(given).toUpperCase() });
    lc.viaVoice = false;
  }

  function submitChain(q) {
    const inputs = [...$("lc-body").querySelectorAll("input")];
    if (inputs.every((i) => !i.value.trim())) return;
    lc.answered = true;
    const askCode = q.dir === "CITY_TO_CODE";
    let got = 0;
    q.legs.forEach((leg, i) => {
      const given = inputs[i].value;
      const res = askCode ? LineCheck.gradeCode(given, leg.code) : LineCheck.gradeCity(given, leg.code, lcIndex, byCode);
      inputs[i].disabled = true;
      inputs[i].classList.add(res.ok ? "ok" : "bad");
      // an under-specified city on a trip sheet counts as a miss for the leg,
      // but never poisons the schedule for an airport she actually named
      if (!res.ambiguous) lcGradeSrs(leg.code, askCode ? "CITY_TO_CODE" : "CODE_TO_CITY", res.ok);
      if (res.ok) got++;
      lc.log.push({ code: leg.code, city: leg.city, ok: res.ok, given: String(given).toUpperCase() });
    });
    const all = got === q.legs.length;
    if (all) lc.correct++;
    else lc.wrong++;
    lcAddMiles(Math.round((q.miles * got) / q.legs.length));
    if (all) Sfx.correct(lc.correct);
    else Sfx.wrong();
    const answerLine = q.legs.map((l) => `${l.code} = ${l.city}`).join(" · ");
    showLcFeedback(all ? "good" : "bad", all ? "Whole sheet. 🧾" : `${got} of ${q.legs.length} legs.`, answerLine, "");
  }

  function submitList(q) {
    const entry = $("lc-entry");
    if (entry && entry.value.trim()) {
      lc.entries.push(entry.value.trim());
      entry.value = "";
    }
    if (!lc.entries.length) return;
    lc.answered = true;
    const graded = LineCheck.gradeList(lc.entries, { ...q.group, n: q.n }, lcIndex, byCode);
    const wrap = $("lc-chips");
    if (wrap) {
      wrap.innerHTML = graded.results
        .map((r) => `<span class="chip ${r.ok ? "ok" : "bad"}">${escapeHtml(r.text)}${r.ok ? " ✓" : " ✗"}</span>`)
        .join("");
    }
    if (entry) entry.disabled = true;
    // Correct recalls feed the scheduler; anything she DIDN'T name is not a
    // miss — she was asked for four, not for all of them.
    graded.correct.forEach((code) => lcGradeSrs(code, "CITY_TO_CODE", true));
    const hit = graded.count >= q.n;
    if (hit) lc.correct++;
    else lc.wrong++;
    lcAddMiles(12 * graded.count);
    if (hit) Sfx.correct(lc.correct);
    else Sfx.wrong();
    graded.correct.forEach((code) => lc.log.push({ code, city: byCode[code].city, ok: true, given: code }));
    const missedHint = q.group.codes
      .filter((c) => !graded.correct.includes(c))
      .slice(0, 4)
      .map((c) => `${c} (${byCode[c].city})`)
      .join(", ");
    showLcFeedback(
      hit ? "good" : "bad",
      `${graded.count} of ${q.n} in ${q.group.label}`,
      graded.correct.map((c) => `${c} = ${byCode[c].city}`).join(" · ") || "—",
      missedHint ? `Also there: ${missedHint}` : ""
    );
  }

  function showLcFeedback(kind, headline, detail, hint, { retry = false } = {}) {
    const slot = $("lc-fb-slot");
    const check = $("lc-check");
    if (check && !retry) check.closest(".lc-row").hidden = true; // one button on screen at a time
    slot.innerHTML = `<div class="lc-fb ${kind}">
        <span class="big">${escapeHtml(headline)}</span>${escapeHtml(detail || "")}
        ${hint ? `<span class="hint">${escapeHtml(hint)}</span>` : ""}
      </div>
      <div class="lc-row" style="margin-top:12px"><button class="btn ${retry ? "ghost" : ""}" id="lc-continue">${retry ? "Try again" : "Continue"}</button></div>`;
    const btn = $("lc-continue");
    btn.addEventListener("click", () => {
      Sfx.tick();
      if (retry) {
        slot.innerHTML = "";
        const e = $("lc-entry");
        if (e) {
          e.value = "";
          e.focus();
        }
        return;
      }
      nextLc();
    });
    if (!retry) btn.focus({ preventScroll: true });
    if (btn.scrollIntoView) setTimeout(() => btn.scrollIntoView({ block: "nearest", behavior: "smooth" }), 40);
  }

  function nextLc() {
    if (!lc) return;
    lc.qi++;
    if (lc.qi >= lc.questions.length) return finishLineCheck();
    renderLcQuestion();
  }

  // ---------- Ramp Rush --------------------------------------------------------
  /*
   * 60 seconds, bare city names, type the code. Speed is the point: it forces
   * retrieval before she can reason her way there. Correct answers feed the
   * scheduler; misses under a clock don't count against it.
   */
  function startRush() {
    lc.rushLeft = RUSH_SECONDS;
    $("lc-fill").style.width = "100%";
    clearInterval(lcTimer);
    lcTimer = setInterval(() => {
      lc.rushLeft--;
      $("lc-fill").style.width = Math.max(0, (lc.rushLeft / RUSH_SECONDS) * 100) + "%";
      const meta = $("lc-meta");
      meta.textContent = `0:${String(Math.max(0, lc.rushLeft)).padStart(2, "0")}`;
      meta.classList.toggle("hot", lc.rushLeft <= 10);
      if (lc.rushLeft <= 5 && lc.rushLeft > 0) Sfx.tick();
      if (lc.rushLeft <= 0) {
        clearInterval(lcTimer);
        finishLineCheck();
      }
    }, 1000);
    nextRushQ();
  }

  function nextRushQ() {
    if (!lc || lc.kind !== "rush" || lc.rushLeft <= 0) return;
    const a = pick(lc.pool);
    const q = LineCheck.qColdCall(a, "CITY_TO_CODE", Math.random, { terse: true });
    lc.questions = [q];
    lc.qi = 0;
    lc.answered = false;
    const skin = skinFor();
    $("lc-stage").innerHTML = `<div id="lc-card"><div class="skin ${skin.cls} center"><div>${escapeHtml(q.prompt)}</div></div></div>
      <div class="lc-answer" id="lc-body">
        <input class="lc-input code" id="lc-entry" ${inputAttrs(true)} placeholder="___" />
        <div class="lc-heard" id="lc-heard">${lc.rushScore} correct</div>
      </div><div id="lc-fb-slot"></div>`;
    const entry = $("lc-entry");
    entry.focus();
    // auto-submit on the third letter — no Check button, no pause to reconsider
    entry.addEventListener("input", () => {
      const v = entry.value.replace(/[^a-zA-Z]/g, "");
      if (v.length >= 3) gradeRush(q, v.slice(0, 3));
    });
    entry.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (entry.value.trim()) gradeRush(q, entry.value);
      }
    });
  }

  function gradeRush(q, given) {
    if (lc.answered) return;
    lc.answered = true;
    const res = LineCheck.gradeCode(given, q.answer);
    const entry = $("lc-entry");
    if (entry) {
      entry.disabled = true;
      entry.classList.add(res.ok ? "ok" : "bad");
    }
    if (res.ok) {
      lc.rushScore++;
      lc.correct++;
      lcGradeSrs(q.code, "CITY_TO_CODE", true);
      lcAddMiles(q.miles);
      Sfx.correct(lc.rushScore);
    } else {
      lc.wrong++;
      Sfx.wrong();
      $("lc-heard").textContent = `${q.city} = ${q.code}`;
    }
    lc.log.push({ code: q.code, city: q.city, ok: res.ok, given: String(given).toUpperCase() });
    setTimeout(() => {
      if (lc && lc.rushLeft > 0) nextRushQ();
    }, res.ok ? 260 : 900);
  }

  // ---------- the debrief -------------------------------------------------------
  function finishLineCheck() {
    if (!lc) return;
    stopLcTimers();
    const asked = lc.correct + lc.wrong;
    const acc = asked ? Math.round((100 * lc.correct) / asked) : 0;

    state.lc.rounds = (Number(state.lc.rounds) || 0) + 1;
    state.lc.best = Math.max(Number(state.lc.best) || 0, lc.correct);
    if (lc.kind === "rush") state.lc.rushBest = Math.max(Number(state.lc.rushBest) || 0, lc.rushScore);

    // A line check counts as a day flown — same streak, same daily goal.
    const { streak, usedFreeze } = Srs.bumpStreakWithFreeze(state.streak, Date.now(), state.freezes);
    const streakGrew = streak.count > state.streak.count || streak.lastDay !== state.streak.lastDay;
    state.streak = streak;
    if (usedFreeze) {
      state.freezes--;
      cheerQueue.push({ dog: "🌦️", msg: "Weather delay! Maple guarded your streak while you were away. 🐕⛑️" });
    }
    if (lc.learned.length) {
      cheerQueue.push({ dog: "💋", msg: `Maple kiss — you produced ${lc.learned.join(", ")} cold. That one's yours now. 🐕` });
    }
    if (streakGrew && [3, 7, 14, 30, 100].includes(state.streak.count)) {
      cheerQueue.push({ dog: "🔥", msg: `${state.streak.count} days on duty, Corrine! ${pick(CHEERS)}` });
    }
    awardBadges();
    Store.saveState(state);

    // cold open is a single question — no report screen, just get out of the way
    if (lc.kind === "cold") {
      goHome();
      drainCheers();
      lc = null;
      return;
    }

    const verdict =
      lc.kind === "rush"
        ? `${lc.rushScore} IN 60`
        : acc >= 100 ? "UNRESTRICTED" : acc >= 80 ? "SATISFACTORY" : acc >= 55 ? "SATISFACTORY · WITH NOTES" : "MORE LINE TIME";
    $("rep-verdict").textContent = verdict;
    $("rep-sub").textContent =
      lc.kind === "rush"
        ? `Personal best: ${state.lc.rushBest}. ${lc.rushScore >= state.lc.rushBest ? "That's a new one. ⏱️" : "Beat it next run."}`
        : acc >= 80
        ? "That's the version that works outside the app, Corrine. 🎧"
        : "Every miss here is one that would've caught you at the gate — worth finding.";
    $("rep-score").textContent = lc.kind === "rush" ? lc.rushScore : `${lc.correct}/${asked}`;
    $("rep-acc").textContent = acc + "%";
    $("rep-miles").textContent = "+" + lc.miles;

    const misses = lc.log.filter((r) => !r.ok);
    const rows = (misses.length ? misses : lc.log.slice(0, 6))
      .map(
        (r) => `<div class="rep-row ${r.ok ? "" : "miss"}">
          <span class="mark">${r.ok ? "✓" : "✗"}</span>
          <span class="code">${r.code}</span><span class="city">${escapeHtml(r.city)}</span>
          ${r.ok || !r.given ? "" : `<span class="city" style="margin-left:auto">you said ${escapeHtml(r.given)}</span>`}
        </div>`
      )
      .join("");
    $("rep-list").innerHTML = (misses.length ? `<div class="lc-kicker" style="margin-top:6px">WORTH ANOTHER LOOK</div>` : "") + rows;

    show("lc-report-screen");
    Sfx.fanfare();
    if (acc >= 80 || (lc.kind === "rush" && lc.rushScore >= 10)) confetti(acc >= 100 ? 80 : 40);
    drainCheers();
  }

  // ---------- hand-the-phone-over deck --------------------------------------------
  /*
   * The failure this whole mode exists for is "someone asked me and I blanked".
   * This is that, rehearsed: the phone shows a question for SOMEONE ELSE to read
   * aloud, the answer stays hidden, and they grade her. It's the one place
   * self-grading is honest, because a human is holding the card.
   */
  function startDeck() {
    const pool = lcPool();
    const cards = LineCheck.shuffleArr(pool)
      .slice(0, 12)
      .map((a) => LineCheck.qColdCall(a, Math.random() < 0.5 ? "CITY_TO_CODE" : "CODE_TO_CITY"));
    deck = { cards, i: 0, got: 0 };
    show("lc-cards-screen");
    renderDeckCard();
  }

  function renderDeckCard() {
    const q = deck.cards[deck.i];
    if (!q) return finishDeck();
    $("cards-meta").textContent = `${deck.i + 1}/${deck.cards.length}`;
    $("cards-fill").style.width = Math.round((deck.i / deck.cards.length) * 100) + "%";
    $("qcard-q").textContent = q.prompt;
    $("qcard-a").textContent = `${q.code} = ${byCode[q.code].city}`;
    $("qcard-a").hidden = true;
    $("qcard-reveal").hidden = false;
    $("qcard-grade").hidden = true;
  }

  function gradeDeckCard(ok) {
    const q = deck.cards[deck.i];
    lcGradeSrs(q.code, q.dir, ok);
    state.lc.cards = (Number(state.lc.cards) || 0) + 1;
    if (ok) {
      deck.got++;
      rolloverDay();
      state.miles += 10;
      state.day.miles += 10;
      Sfx.correct(deck.got);
    } else Sfx.wrong();
    deck.i++;
    Store.saveState(state);
    renderDeckCard();
  }

  function finishDeck() {
    awardBadges();
    Store.saveState(state);
    cheerQueue.push({
      dog: "📱",
      msg: `${deck.got}/${deck.cards.length} answered out loud to a real person. That's the one that counts, Corrine. ${pick(CHEERS)}`,
    });
    goHome();
    drainCheers();
    deck = null;
  }

  // ---------- cold open ------------------------------------------------------------
  /*
   * Occasionally the very first thing the app does is ask one question — no
   * home screen, no warm-up. That's the closest we can get to being asked out
   * of the blue, which is exactly the situation she wants to be ready for.
   */
  const COLD_OPEN_GAP_MS = 5 * 60 * 60 * 1000;
  function maybeColdOpen() {
    if (!state.settings.coldOpen) return false;
    const last = Number(state.lc.lastColdOpen) || 0;
    if (Date.now() - last < COLD_OPEN_GAP_MS) return false;
    if (Math.random() > 0.45) return false;
    const fam = familiarFn();
    if (AIRPORTS.filter((a) => fam(a.code)).length < 6) return false; // nothing to ask yet
    state.lc.lastColdOpen = Date.now();
    Store.saveState(state);
    // no autoplay on boot — browsers block it and it's startling; she taps 🔊
    startLineCheck("cold", { noAutoSpeak: true });
    return true;
  }

  // ---------- mode switching --------------------------------------------------------
  function goHome() {
    if (state.mode === "linecheck") {
      renderLcHome();
      show("lc-home-screen");
    } else {
      renderPath();
      show("path-screen");
    }
    setTab("path");
  }

  function setMode(mode) {
    state.mode = mode === "linecheck" ? "linecheck" : "academy";
    Store.saveState(state);
    document.querySelectorAll(".ms-btn").forEach((b) => b.classList.toggle("active", b.dataset.mode === state.mode));
    goHome();
  }

  document.querySelectorAll(".ms-btn").forEach((b) =>
    b.addEventListener("click", () => {
      Sfx.tick();
      if (typeof Voice !== "undefined") Voice.warmUp(); // first tap unlocks iOS speech
      setMode(b.dataset.mode);
    })
  );

  on("lc-quit", "click", () => {
    if (lc && lc.qi > 0 && !confirm("Leave this line check? Your answers so far are saved.")) return;
    stopLcTimers();
    lc = null;
    Store.saveState(state);
    goHome();
  });
  on("cards-quit", "click", () => {
    deck = null;
    Store.saveState(state);
    goHome();
  });
  on("rep-again", "click", () => {
    Sfx.tick();
    const kind = lc && lc.kind ? lc.kind : "call";
    lc = null;
    startLineCheck(kind);
  });
  on("rep-done", "click", () => {
    Sfx.tick();
    lc = null;
    goHome();
  });
  on("qcard-reveal", "click", () => {
    Sfx.tick();
    $("qcard-a").hidden = false;
    $("qcard-reveal").hidden = true;
    $("qcard-grade").hidden = false;
  });
  on("qcard-got", "click", () => gradeDeckCard(true));
  on("qcard-miss", "click", () => gradeDeckCard(false));

  // ---------- passport -----------------------------------------------------------
  function renderPassport() {
    const rank = RANKS.filter((r) => state.miles >= r.min).pop();
    const next = RANKS[RANKS.indexOf(rank) + 1];
    $("rank-name").textContent = `${rank.name} ${rank.emoji}`;
    if (next) {
      const pct = Math.round(((state.miles - rank.min) / (next.min - rank.min)) * 100);
      $("rank-fill").style.width = pct + "%";
      $("rank-next").textContent = `${(next.min - state.miles).toLocaleString()} miles to ${next.name} ${next.emoji}`;
    } else {
      $("rank-fill").style.width = "100%";
      $("rank-next").textContent = "Top of the crew. Maple salutes you. 🫡🐕";
    }
    $("stamps").innerHTML = UNITS.map((u) => {
      const done = unitStamped(state, u.id);
      return `<div class="stamp ${done ? "earned" : ""}"><div><span class="big">${u.emoji}</span><br>${u.title}</div></div>`;
    }).join("");
    $("badges").innerHTML = BADGES.map(
      (b) => `<div class="badge ${state.badges[b.id] ? "earned" : ""}"><span class="ico">${b.emoji}</span>${b.name}</div>`
    ).join("");
  }

  // ---------- settings -------------------------------------------------------------
  function renderSettings() {
    $("sound-toggle").checked = !!state.settings.sound;
    const sel = $("voice-select");
    sel.value = state.settings.voice || "full";
    const noSpeak = typeof Voice === "undefined" || !Voice.supportsSpeak;
    const noListen = typeof Voice === "undefined" || !Voice.supportsListen;
    $("voice-status").textContent = noSpeak
      ? "This browser can't speak — Line Check stays typed."
      : noListen
      ? "This browser can't listen — prompts are spoken, answers are typed."
      : "The phone asks out loud and grades what you say back.";
    sel.disabled = noSpeak;
    $("coldopen-toggle").checked = !!state.settings.coldOpen;
    $("goal-input").value = state.settings.dailyGoal;
    $("freeze-status").textContent = `Banked: ${state.freezes}/2 — auto-protects a missed day`;
    $("freeze-btn").disabled = state.freezes >= 2 || state.miles < 200;
  }
  on("sound-toggle", "change", (e) => {
    state.settings.sound = e.target.checked;
    Sfx.muted = !state.settings.sound;
    Store.saveState(state);
    if (state.settings.sound) Sfx.correct(0);
  });
  on("voice-select", "change", (e) => {
    const v = e.target.value;
    state.settings.voice = ["full", "prompts", "off"].includes(v) ? v : "full";
    Store.saveState(state);
    if (state.settings.voice !== "off" && typeof Voice !== "undefined") {
      Voice.warmUp();
      Voice.speak("Ready when you are, Corrine.");
    }
  });
  on("coldopen-toggle", "change", (e) => {
    state.settings.coldOpen = e.target.checked;
    Store.saveState(state);
  });
  on("goal-input", "change", (e) => {
    const v = parseInt(e.target.value, 10);
    state.settings.dailyGoal = Number.isFinite(v) ? Math.max(10, Math.min(500, v)) : 150;
    e.target.value = state.settings.dailyGoal;
    Store.saveState(state);
  });
  on("freeze-btn", "click", () => {
    if (state.miles < 200 || state.freezes >= 2) return;
    state.miles -= 200;
    state.freezes++;
    Store.saveState(state);
    Sfx.unlock();
    renderSettings();
    renderTopbar();
  });
  on("export-btn", "click", () => Store.exportState(state));
  on("import-btn", "click", () => $("import-file").click());
  on("import-file", "change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const imported = Store.parseImported(await file.text());
      imported.items = Srs.buildItems(AIRPORTS, imported.items);
      state = imported;
      Store.saveState(state);
      Sfx.unlock();
      alert("Welcome back, Corrine! Progress restored. ✈️");
      goHome();
    } catch (err) {
      alert("Import failed: " + err.message);
    } finally {
      e.target.value = "";
    }
  });
  on("reset-btn", "click", () => {
    if (!confirm("Reset ALL progress, miles, streak and badges? This can't be undone.")) return;
    state = Store.resetState();
    state.items = Srs.buildItems(AIRPORTS, {});
    Store.saveState(state);
    document.querySelectorAll(".ms-btn").forEach((b) => b.classList.toggle("active", b.dataset.mode === state.mode));
    goHome();
  });

  // ---------- tabs / navigation ---------------------------------------------------
  function setTab(name) {
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  }
  document.querySelectorAll(".tab").forEach((t) =>
    t.addEventListener("click", () => {
      Sfx.tick();
      setTab(t.dataset.tab);
      if (t.dataset.tab === "path") {
        goHome();
      } else if (t.dataset.tab === "passport") {
        renderPassport();
        show("passport-screen");
      } else {
        renderSettings();
        show("settings-screen");
      }
    })
  );

  on("quit-btn", "click", () => {
    if (!confirm("Leave this flight? Your answers so far are saved.")) return;
    clearInterval(bonusTimer);
    if (flight && flight.timer) clearTimeout(flight.timer); // no ghost advance() later
    flight = null;
    hideFeedback();
    Store.saveState(state);
    renderPath();
    show("path-screen");
  });
  on("fb-continue", "click", () => {
    if (!$("feedback").classList.contains("show")) return; // double-tap = no-op
    Sfx.tick();
    advance();
  });
  on("bonus-btn", "click", () => {
    Sfx.tick();
    startBonus();
  });
  on("path-btn", "click", () => {
    clearInterval(connTimer);
    renderPath();
    show("path-screen");
  });

  // streak chip tap = little status toast via cheer overlay
  on("streak-chip", "click", () => {
    cheerQueue.push({
      dog: "🔥",
      msg: state.streak.count > 0
        ? `${state.streak.count} days on duty (best ${state.streak.best}). Weather Delays banked: ${state.freezes}/2.`
        : "Land one flight today to start your streak!",
    });
    drainCheers();
  });

  // ---------- service worker (offline + auto-update) --------------------------------
  if ("serviceWorker" in navigator) {
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").then((reg) => reg.update()).catch(() => {});
    });
  }

  // ---------- boot -------------------------------------------------------------------
  document.querySelectorAll(".ms-btn").forEach((b) => b.classList.toggle("active", b.dataset.mode === state.mode));
  // A cold call can hijack the opening — that's the whole idea of it.
  if (!maybeColdOpen()) goHome();
})();
