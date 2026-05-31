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
  const screens = ["home", "study", "summary", "settings"];
  function show(screen) {
    screens.forEach((s) => ($(s).hidden = s !== screen));
  }

  // --- Home / stats ------------------------------------------------------
  function renderHome() {
    const s = Srs.summarize(state.items);
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
    const queue = Srs.buildSessionQueue(state.items, {
      newLimit: state.settings.newLimit,
    });
    if (queue.length === 0) {
      // Nothing due and no new cards: offer a quick refresher of the soonest items.
      const soonest = Object.values(state.items)
        .filter((it) => !Srs.isNew(it))
        .sort((a, b) => a.due - b.due)
        .slice(0, 20)
        .map((it) => it.id);
      if (soonest.length === 0) return renderHome();
      session = newSession(soonest);
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
    $("new-limit").addEventListener("change", (e) => {
      const v = parseInt(e.target.value, 10);
      state.settings.newLimit = Number.isFinite(v) ? Math.max(0, Math.min(80, v)) : 12;
      e.target.value = state.settings.newLimit;
      Store.saveState(state);
    });

    $("export-btn").addEventListener("click", () => Store.exportState(state));

    $("import-btn").addEventListener("click", () => $("import-file").click());
    $("import-file").addEventListener("change", async (e) => {
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

    $("reset-btn").addEventListener("click", () => {
      if (!confirm("Reset ALL progress? This can't be undone.")) return;
      state = Store.resetState();
      state.items = Srs.buildItems(AIRPORTS, {});
      Store.saveState(state);
      renderHome();
    });
  }

  // --- Event wiring ------------------------------------------------------
  function wire() {
    $("start-btn").addEventListener("click", startSession);
    $("again-btn").addEventListener("click", startSession);
    $("home-btn").addEventListener("click", renderHome);
    $("end-session-btn").addEventListener("click", endSession);

    $("card").addEventListener("click", flipCard);
    $("card").addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        flipCard();
      }
    });
    $("got-btn").addEventListener("click", () => gradeCurrent(true));
    $("miss-btn").addEventListener("click", () => gradeCurrent(false));

    $("settings-btn").addEventListener("click", renderSettings);
    $("settings-back-btn").addEventListener("click", renderHome);
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

  // --- Service worker (offline) -----------------------------------------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {
        /* offline support is optional; ignore failures */
      });
    });
  }

  wire();
  renderHome();
})();
