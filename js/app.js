/*
 * app.js — wires the data, scheduler, and storage to the screen.
 *
 * Globals available (from the earlier <script> tags):
 *   AIRPORTS   (js/data.js)
 *   SRS_API    (js/srs.js)
 *   STORAGE_API(js/storage.js)
 */
(function () {
  "use strict";

  const Srs = SRS_API;
  const Store = STORAGE_API;

  // Quick lookup from code -> airport record.
  const byCode = Object.fromEntries(AIRPORTS.map((a) => [a.code, a]));
  // Curriculum priority per airport (hubs first, then major cities, then rest).
  const priority = Object.fromEntries(AIRPORTS.map((a) => [a.code, airportTier(a)]));

  // --- App state ---------------------------------------------------------
  let state = Store.loadState();
  // Rebuild item set against the current airport list (merges in saved progress).
  state.items = Srs.buildItems(AIRPORTS, state.items);
  Store.saveState(state);

  let session = null; // { queue:[ids], index, reviewed, got, missed, flipped }

  // --- Element helpers ---------------------------------------------------
  const $ = (id) => document.getElementById(id);
  // Null-safe event binding: a single missing element can never break the rest
  // of the wiring (e.g. during a stale-cache mismatch between HTML and JS).
  function on(id, event, handler) {
    const el = $(id);
    if (el) el.addEventListener(event, handler);
  }
  const screens = ["home", "study", "summary", "settings"];
  function show(screen) {
    screens.forEach((s) => ($(s).hidden = s !== screen));
  }

  // The set of codes allowed by the current study-set scope (null = all).
  function allowedCodes() {
    const scope = state.settings.scope || "all";
    if (scope === "all") return null;
    return new Set(AIRPORTS.filter((a) => a.region === scope).map((a) => a.code));
  }

  function renderStreak() {
    const st = state.streak || { count: 0, best: 0 };
    const chip = $("streak-chip");
    if (st.count > 0) {
      chip.textContent =
        `🔥 ${st.count}-day streak` + (st.best > st.count ? ` · best ${st.best}` : "");
    } else {
      chip.textContent = "Study today to start a streak 🔥";
    }
  }

  // --- Home / stats ------------------------------------------------------
  function renderHome() {
    renderStreak();
    $("scope-select").value = state.settings.scope || "all";
    const s = Srs.summarize(state.items, Date.now(), allowedCodes());
    $("stat-due").textContent = s.dueNow;
    $("stat-new").textContent = s.new;
    $("stat-learning").textContent = s.learning;
    $("stat-mastered").textContent = s.mastered;

    const pct = s.total ? Math.round((s.mastered / s.total) * 100) : 0;
    $("mastery-bar").style.width = pct + "%";
    $("mastery-caption").textContent = `${s.mastered} of ${s.total} cards mastered (${pct}%)`;

    const hasWork = s.dueNow > 0 || s.new > 0;
    $("nothing-due").hidden = hasWork;
    $("start-btn").textContent = s.dueNow > 0 ? `Study ${s.dueNow} due` : "Start studying";
    show("home");
  }

  // --- Encouragement for Corrine ----------------------------------------
  // Shown after a hot streak of consecutive correct answers (every 5–10).
  const CHEERS = [
    "Brilliant, Corrine! 🎉 Beauty and brains — you've got both.",
    "Look at you go, Corrine! 💕 Smartest (and prettiest) one in the sky.",
    "Nailing it, Corrine! ✨ That gorgeous brain of yours never misses.",
    "Yes, Corrine! 😍 Smart, stunning, and absolutely on fire.",
    "That's my girl, Corrine! 💖 So clever it's almost unfair.",
    "Wow, Corrine! 💫 Gorgeous and a genius — how'd I get so lucky?",
    "Crushing it, Corrine! 🌟 Pretty and brilliant in equal measure.",
    "Incredible, Corrine! 🛫 These codes don't stand a chance against you.",
    "Keep soaring, Corrine! 💕 Clever mind, beautiful heart.",
    "Perfect, Corrine! ✨ Your brilliance shines as bright as your smile.",
    "Unstoppable, Corrine! 😘 Smart, lovely, and getting better every minute.",
    "Amazing, Corrine! 💝 Beauty, brains, and a memory like a steel trap.",
  ];
  // Reward shown the moment she fully learns a destination (10 in a row).
  const MAPLE_CHEERS = [
    "10 for 10, Corrine! 🐕 You've won a kiss from Maple 💋",
    "Learned it, Corrine! 🐶 Go collect your kiss from Maple 💕",
    "Mastered, Corrine! 🌟 Maple owes you a big sloppy kiss 🐕💋",
    "Perfect 10, Corrine! 🐾 Maple is wagging — that's a kiss for you 💋",
  ];
  let cheerTimer = null;
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  function showCheer(message, special) {
    const el = $("cheer-toast");
    if (!el) return;
    el.textContent = message || pick(CHEERS);
    el.classList.toggle("maple", !!special);
    el.classList.add("show");
    clearTimeout(cheerTimer);
    cheerTimer = setTimeout(() => el.classList.remove("show"), special ? 4600 : 3800);
  }

  // --- Session flow ------------------------------------------------------
  function startSession() {
    const allow = allowedCodes();
    const queue = Srs.buildSessionQueue(state.items, {
      maxActive: state.settings.maxActive,
      allowCodes: allow,
      priority,
    });
    if (queue.length === 0) {
      // Nothing due and no new cards: offer a quick refresher of the soonest items,
      // shuffled with directions separated (same as a normal session).
      const soonest = Object.values(state.items)
        .filter((it) => !Srs.isNew(it) && (!allow || allow.has(it.code)))
        .sort((a, b) => a.due - b.due)
        .slice(0, 20);
      if (soonest.length === 0) return renderHome();
      session = newSession(Srs.arrangeStudyOrder(soonest));
    } else {
      session = newSession(queue);
    }
    showCurrentCard();
  }

  function newSession(queue) {
    return { queue, index: 0, reviewed: 0, got: 0, missed: 0, flipped: false, correctRun: 0, nextCheer: randInt(5, 10) };
  }

  function currentItem() {
    return state.items[session.queue[session.index]];
  }

  function showCurrentCard() {
    if (!session || session.index >= session.queue.length) return endSession();

    const item = currentItem();
    const airport = byCode[item.code];
    session.flipped = false;

    // Per-card progress toward "known": how many correct in a row out of the target.
    const streakEl = $("card-streak");
    if (Srs.isMastered(item)) {
      streakEl.textContent = "✓ Known";
      streakEl.classList.add("known");
    } else {
      streakEl.textContent = `🔥 ${item.reps} / ${Srs.learnTarget(item)}`;
      streakEl.classList.remove("known");
    }

    const codeToCity = item.dir === "CODE_TO_CITY";
    $("card-dir").textContent = codeToCity ? "Code → Destination" : "Destination → Code";
    $("card-prompt").textContent = codeToCity ? item.code : airport.city;
    $("card-answer").textContent = codeToCity
      ? `${airport.city}${airport.country && airport.country !== "United States" ? " · " + airport.country : ""}`
      : item.code;

    $("card-answer").hidden = true;
    $("card-hint").hidden = false;
    $("grade-row").hidden = true;
    $("card").classList.remove("flipped");

    // Session progress bar.
    const done = session.reviewed;
    const total = session.reviewed + (session.queue.length - session.index);
    $("session-bar").style.width = (total ? (done / total) * 100 : 0) + "%";
    $("session-count").textContent = `${session.index + 1} / ${session.queue.length}`;

    show("study");
  }

  function flipCard() {
    if (!session || session.flipped) return;
    session.flipped = true;
    $("card-answer").hidden = false;
    $("card-hint").hidden = true;
    $("grade-row").hidden = false;
    $("card").classList.add("flipped");
  }

  function gradeCurrent(correct) {
    if (!session || !session.flipped) return;
    const item = currentItem();
    const updated = Srs.grade(item, correct);
    state.items[updated.id] = updated;

    session.reviewed++;
    correct ? session.got++ : session.missed++;

    // Encouragement for Corrine. A first-time "10/10" mastery wins a kiss from
    // Maple and takes priority; otherwise a hot streak (every 5–10 correct) cheers.
    const justLearned = correct && !item.learnedOnce && updated.learnedOnce;
    if (correct) session.correctRun++;
    else session.correctRun = 0;

    if (justLearned) {
      showCheer(pick(MAPLE_CHEERS), true);
      session.correctRun = 0;
      session.nextCheer = randInt(5, 10);
    } else if (correct && session.correctRun >= session.nextCheer) {
      showCheer();
      session.correctRun = 0;
      session.nextCheer = randInt(5, 10);
    }

    // Reviewing a card counts today toward her daily streak (idempotent per day).
    state.streak = Srs.bumpStreak(state.streak, Date.now());

    // Keep drilling a card within THIS session until its streak reaches "known":
    // correct-but-not-yet-known cards come back spaced out (others interleave) so
    // she can build the 10-in-a-row; missed cards come back sooner. A card that
    // just became known is not requeued — it graduates to occasional checks.
    if (Srs.isActiveLearning(updated)) {
      const offset = correct ? 9 : 4;
      const insertAt = Math.min(session.index + offset, session.queue.length);
      session.queue.splice(insertAt, 0, updated.id);
    }

    Store.saveState(state);
    session.index++;
    showCurrentCard();
  }

  function endSession() {
    if (!session) return renderHome();
    $("sum-reviewed").textContent = session.reviewed;
    $("sum-got").textContent = session.got;
    $("sum-missed").textContent = session.missed;
    const acc = session.reviewed ? Math.round((session.got / session.reviewed) * 100) : 0;
    $("sum-accuracy").textContent = session.reviewed
      ? `Accuracy this session: ${acc}%`
      : "No cards reviewed.";
    session = null;
    show("summary");
  }

  // --- Settings ----------------------------------------------------------
  function renderSettings() {
    $("active-limit").value = state.settings.maxActive;
    show("settings");
  }

  function wireSettings() {
    on("active-limit", "change", (e) => {
      const v = parseInt(e.target.value, 10);
      state.settings.maxActive = Number.isFinite(v) ? Math.max(2, Math.min(120, v)) : 16;
      e.target.value = state.settings.maxActive;
      Store.saveState(state);
    });

    on("export-btn", "click", () => Store.exportState(state));

    on("import-btn", "click", () => $("import-file").click());
    on("import-file", "change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const imported = Store.parseImported(text);
        imported.items = Srs.buildItems(AIRPORTS, imported.items);
        state = imported;
        Store.saveState(state);
        alert("Progress imported.");
        renderHome();
      } catch (err) {
        alert("Import failed: " + err.message);
      } finally {
        e.target.value = "";
      }
    });

    on("reset-btn", "click", () => {
      if (!confirm("Reset ALL progress? This can't be undone.")) return;
      state = Store.resetState();
      state.items = Srs.buildItems(AIRPORTS, {});
      Store.saveState(state);
      renderHome();
    });
  }

  // --- Event wiring ------------------------------------------------------
  function wire() {
    on("start-btn", "click", startSession);
    on("again-btn", "click", startSession);
    on("home-btn", "click", renderHome);
    on("end-session-btn", "click", endSession);

    on("card", "click", flipCard);
    on("card", "keydown", (e) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        flipCard();
      }
    });
    on("got-btn", "click", () => gradeCurrent(true));
    on("miss-btn", "click", () => gradeCurrent(false));

    on("scope-select", "change", (e) => {
      state.settings.scope = e.target.value;
      Store.saveState(state);
      renderHome();
    });

    on("settings-btn", "click", renderSettings);
    on("settings-back-btn", "click", renderHome);
    wireSettings();

    // Desktop keyboard shortcuts: space = flip, 1 = missed, 2 = got.
    document.addEventListener("keydown", (e) => {
      if ($("study").hidden) return;
      if (e.key === " ") {
        e.preventDefault();
        flipCard();
      } else if (session && session.flipped && e.key === "1") {
        gradeCurrent(false);
      } else if (session && session.flipped && e.key === "2") {
        gradeCurrent(true);
      }
    });
  }

  // --- Service worker (offline + auto-update) ---------------------------
  if ("serviceWorker" in navigator) {
    // When a new service worker takes control, reload once so the page and its
    // scripts are always a matched, fresh set (prevents stale-cache mismatches).
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("sw.js")
        .then((reg) => reg.update()) // check for a newer worker on every load
        .catch(() => {
          /* offline support is optional; ignore failures */
        });
    });
  }

  wire();
  renderHome();
})();
