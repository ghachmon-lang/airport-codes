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

  // --- Session flow ------------------------------------------------------
  function startSession() {
    const allow = allowedCodes();
    const queue = Srs.buildSessionQueue(state.items, {
      newLimit: state.settings.newLimit,
      allowCodes: allow,
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
    return { queue, index: 0, reviewed: 0, got: 0, missed: 0, flipped: false };
  }

  function currentItem() {
    return state.items[session.queue[session.index]];
  }

  function showCurrentCard() {
    if (!session || session.index >= session.queue.length) return endSession();

    const item = currentItem();
    const airport = byCode[item.code];
    session.flipped = false;

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

    // Reviewing a card counts today toward her daily streak (idempotent per day).
    state.streak = Srs.bumpStreak(state.streak, Date.now());

    // A missed card gets requeued later in THIS session so she drills it now.
    if (!correct) {
      const insertAt = Math.min(session.index + 4, session.queue.length);
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
    $("new-limit").value = state.settings.newLimit;
    show("settings");
  }

  function wireSettings() {
    on("new-limit", "change", (e) => {
      const v = parseInt(e.target.value, 10);
      state.settings.newLimit = Number.isFinite(v) ? Math.max(0, Math.min(80, v)) : 12;
      e.target.value = state.settings.newLimit;
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
