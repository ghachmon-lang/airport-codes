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
  ];

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

  function dueReviewCodes() {
    const now = Date.now();
    const codes = new Set();
    for (const it of Object.values(state.items)) {
      if (!Srs.isNew(it) && Srs.isDue(it, now)) codes.add(it.code);
    }
    return [...codes];
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
  const SCREENS = ["path-screen", "lesson-screen", "complete-screen", "passport-screen", "settings-screen"];
  function show(id) {
    SCREENS.forEach((s) => ($(s).hidden = s !== id));
    $("tabbar").hidden = id === "lesson-screen" || id === "complete-screen";
    clearInterval(connTimer);
    if (id !== "lesson-screen") clearInterval(bonusTimer);
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
      const due = dueReviewCodes().length;
      (due > 0 ? navigator.setAppBadge(due) : navigator.clearAppBadge && navigator.clearAppBadge()).catch?.(() => {});
    }
  }

  function nodeButton(node, cls, inner, label) {
    return `<div class="path-row"><button class="node ${cls}" data-node="${node.id}" aria-label="${label}">
      <span class="node-label">${label}</span>${inner}</button></div>`;
  }

  function renderPath() {
    renderTopbar();
    const cont = $("path-container");
    let html = "";

    const due = dueReviewCodes();
    if (due.length >= 4) {
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
    const remaining = UNITS.filter((_, i) => !unitUnlocked(i)).length;
    if (remaining > 1) html += `<p class="muted" style="text-align:center">…${remaining} more routes to unlock ✈️</p>`;
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
    const codes = Game.shuffleArr(dueReviewCodes()).slice(0, 7);
    const pool = codes.map((c) => byCode[c]);
    const questions = Game.buildLesson(pool, AIRPORTS, { length: 10, familiar: () => true });
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
    const q = currentQ();
    if (!q) return land();
    const area = $("q-area");
    if (flight.showFA) {
      // entering Final Approach — the banner survives this question render
      setMaple(null, `🛬 Final approach — let's fix ${flight.retries.length}!`);
      flight.showFA = false;
    } else {
      setMaple(null, q.intro ? hookFor(q.code) : null);
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
          <div class="type-box" data-slot="0"></div><div class="type-box" data-slot="1"></div><div class="type-box" data-slot="2"></div>
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
          if (b.classList.contains("matched")) return;
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
          setTimeout(() => answer(q, Game.checkTyped(typed, q.answer), typed), 120);
        }
      };
      tiles.forEach((t) =>
        t.addEventListener("click", () => {
          if (t.classList.contains("dim")) return;
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
          if (!placed[i]) return;
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
      flight.learnedCodes.push(code);
      setMaple("happy", pick(MAPLE_LEARNED).replace("CODE", code));
      Sfx.match();
    }
  }

  function dirOf(q) {
    return q.type === "mc-city" ? "CODE_TO_CITY" : "CITY_TO_CODE";
  }

  function answer(q, correct, given, optBtn, extra = {}) {
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
      setTimeout(advance, 650);
      return;
    }

    if (correct) {
      flight.combo++;
      flight.maxCombo = Math.max(flight.maxCombo, flight.combo);
      const bonus = flight.combo >= 3 ? 2 : 0;
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
      if (flight.combo === 3 || flight.combo === 6 || flight.combo === 9) setMaple("happy", pick(MAPLE_COMBO));
      else if (!flight.learnedCodes.includes(q.code)) setMaple("happy", null);
      flight.passed++;
      if (flight.bonus) {
        flight.bonusScore = (flight.bonusScore || 0) + 1;
        setTimeout(nextBonusQ, 350);
      } else {
        setTimeout(advance, 650);
      }
    } else {
      flight.combo = 0;
      flight.wrong++;
      $("combo-flame").textContent = "";
      if (optBtn) optBtn.classList.add("wrong");
      // reveal the right option
      $("q-area").querySelectorAll("[data-opt]").forEach((b) => {
        if (b.dataset.opt === q.answer) b.classList.add("correct");
      });
      Sfx.wrong();
      if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
      setMaple("sad", pick(MAPLE_MISS));
      if (flight.bonus) {
        setTimeout(nextBonusQ, 550);
        return;
      }
      if (!flight.inFinalApproach && (q.retried || 0) < 1 && q.type !== "pairs") {
        flight.retries.push({ ...q, retried: 1 });
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
    $("fb-headline").textContent = "Not quite…";
    const ans = q.type === "pairs" ? "" : `${q.type === "mc-city" ? q.prompt + " → " + q.answer : q.answer + " = " + q.prompt}`;
    $("fb-detail").textContent = ans;
    const hook = hookFor(q.code);
    $("fb-hint").textContent = hook ? `💡 ${hook}` : "";
  }

  function hideFeedback() {
    $("feedback").classList.remove("show");
  }

  function advance() {
    hideFeedback();
    flight.qi++;
    const mainDone = flight.qi >= flight.questions.length;
    if (mainDone && !flight.inFinalApproach && flight.retries.length > 0) {
      flight.inFinalApproach = true;
      flight.planned = flight.questions.length + flight.retries.length;
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

    // badges
    for (const b of BADGES) {
      if (!state.badges[b.id] && b.check(state)) {
        state.badges[b.id] = Date.now();
        cheerQueue.push({ dog: b.emoji, msg: `Badge earned: ${b.name}! ${pick(CHEERS)}` });
        Sfx.unlock();
      }
    }

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

    // tight connection: next flight quickly = bonus miles
    setupContinue();
    // Final Boarding offer
    $("bonus-btn").hidden = flight.bonus || masteredCodes().length < 10;

    // daily goal crossing
    if (state.day.miles >= state.settings.dailyGoal && state.day.miles - flight.miles < state.settings.dailyGoal) {
      cheerQueue.push({ dog: "🏅", msg: `Daily goal hit! ${pick(CHEERS)}` });
    }
    drainCheers();
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
    setTimeout(drainCheers, 250);
  });

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
      renderPath();
      show("path-screen");
      setTab("path");
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
    renderPath();
    show("path-screen");
    setTab("path");
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
        renderPath();
        show("path-screen");
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
    hideFeedback();
    Store.saveState(state);
    renderPath();
    show("path-screen");
  });
  on("fb-continue", "click", () => {
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
  renderPath();
  show("path-screen");
})();
