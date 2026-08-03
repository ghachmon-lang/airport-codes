/*
 * app.js — Type Ratings orchestrator: home (hangar) / quiz / results /
 * credits. Same universe as Corrine's Flight Academy next door: Maple,
 * the palette, chunky 3D buttons, end on a win.
 *
 * Progress model (localStorage "fleet.v1"):
 *   stats[typeId] = { seen, correct, rated }   — lifetime numbers
 *   bestCombo, rounds, sound
 * A type becomes "rated" (stamped) at ≥8 lifetime correct with ≥80%
 * accuracy — recognition fluency, not one lucky guess.
 */

(() => {
  const KEY = "fleet.v1";
  const ROUND_SIZE = 8;
  const RATED_MIN_CORRECT = 8;
  const RATED_MIN_ACC = 0.8;

  const $ = (id) => document.getElementById(id);

  // ---------- state ------------------------------------------------------
  function freshState() {
    return { stats: {}, bestCombo: 0, rounds: 0, sound: true };
  }
  function loadState() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && typeof s === "object" && s.stats) return { ...freshState(), ...s };
    } catch (_) {}
    return freshState();
  }
  const save = () => localStorage.setItem(KEY, JSON.stringify(state));
  let state = loadState();
  const statFor = (id) => (state.stats[id] = state.stats[id] || { seen: 0, correct: 0, rated: false });

  // ---------- screens ----------------------------------------------------
  function show(name) {
    for (const s of document.querySelectorAll(".screen")) s.hidden = true;
    $(name + "-screen").hidden = false;
    window.scrollTo(0, 0);
  }

  // ---------- home (the hangar) -----------------------------------------
  function accOf(id) {
    const s = state.stats[id];
    return s && s.seen ? s.correct / s.seen : null;
  }

  function renderHome() {
    $("ph-banner").hidden = Photos.anyPhotos();
    const grid = $("hangar");
    grid.innerHTML = "";
    for (const t of FLEET) {
      const acc = accOf(t.id);
      const s = state.stats[t.id];
      const card = document.createElement("div");
      card.className = "plane-card" + (s && s.rated ? " rated" : "");
      const art = Photos.hasPhotos(t.id)
        ? `<img src="photos/${Photos.next(t.id).file}" alt="" loading="lazy"/>`
        : Photos.silhouette(t);
      card.innerHTML = `
        <div class="art">${art}</div>
        <div class="plane-name">${t.name}</div>
        <div class="plane-meta">${s && s.rated ? "✈️ Type rated!" : acc == null ? "Not spotted yet" : Math.round(acc * 100) + "% · " + s.correct + " correct"}</div>`;
      grid.appendChild(card);
    }
    const ratedCount = FLEET.filter((t) => state.stats[t.id] && state.stats[t.id].rated).length;
    $("rated-count").textContent = `${ratedCount} / ${FLEET.length}`;
    $("sound-toggle").checked = state.sound;
  }

  // ---------- quiz -------------------------------------------------------
  let queue = [], qIndex = 0, total = 0, roundCorrect = 0, roundFirstTry = 0;
  let combo = 0, bestComboRound = 0, current = null, locked = false;
  let newlyRated = [];

  function startRound() {
    queue = Quiz.buildRound(FLEET, RIVALS, state.stats, ROUND_SIZE);
    qIndex = 0;
    total = queue.length;
    roundCorrect = 0;
    roundFirstTry = 0;
    combo = 0;
    bestComboRound = 0;
    newlyRated = [];
    show("quiz");
    nextQuestion();
  }

  function setMaple(msg, ms = 1600) {
    const b = $("maple-bubble");
    b.textContent = msg;
    b.hidden = false;
    clearTimeout(setMaple.t);
    setMaple.t = setTimeout(() => (b.hidden = true), ms);
  }

  function nextQuestion() {
    if (qIndex >= queue.length) return endRound();
    current = queue[qIndex];
    locked = false;
    $("quiz-fill").style.width = Math.round((qIndex / queue.length) * 100) + "%";
    $("quiz-count").textContent = `${qIndex + 1} / ${queue.length}`;
    $("fixup-tag").hidden = !current.retry;

    const t = FLEET.find((x) => x.id === current.typeId);
    const photo = Photos.hasPhotos(t.id) ? Photos.next(t.id) : null;
    $("photo-box").innerHTML = photo
      ? `<img src="photos/${photo.file}" alt="Mystery airplane"/>`
      : Photos.silhouette(t);

    const opts = $("options");
    opts.innerHTML = "";
    for (const o of current.options) {
      const b = document.createElement("button");
      b.className = "opt";
      b.textContent = o.label;
      b.onclick = () => answer(o.id, b);
      opts.appendChild(b);
    }
  }

  function answer(pickedId, btn) {
    if (locked) return;
    locked = true;
    const t = FLEET.find((x) => x.id === current.typeId);
    const right = pickedId === current.answer;
    const s = statFor(t.id);
    s.seen++;
    if (right) s.correct++;

    for (const b of document.querySelectorAll(".opt")) {
      b.disabled = true;
      const isAnswer = b.textContent === t.name;
      if (isAnswer) b.classList.add("good");
    }
    if (!right) btn.classList.add("bad");

    if (right) {
      combo++;
      bestComboRound = Math.max(bestComboRound, combo);
      state.bestCombo = Math.max(state.bestCombo, combo);
      roundCorrect++;
      if (!current.retry) roundFirstTry++;
      Sfx.correct(combo);
      if (combo >= 3) setMaple(combo >= 5 ? "🔥 " + combo + " in a row!!" : "Combo x" + combo + "!");
    } else {
      combo = 0;
      Sfx.wrong();
      // re-queue once at the end so the round still lands on a win
      if (!current.retry) queue.push({ ...current, retry: true });
    }

    // "rated" check — the stamp moment
    if (!s.rated && s.correct >= RATED_MIN_CORRECT && s.correct / s.seen >= RATED_MIN_ACC) {
      s.rated = true;
      newlyRated.push(t);
    }
    save();

    // feedback card: verdict + the spotting cue (the actual teaching beat)
    const fb = $("feedback");
    fb.className = "feedback show " + (right ? "good" : "bad");
    $("fb-headline").textContent = right
      ? ["Nailed it!", "Sharp eyes!", "That's the one!"][Math.floor(Math.random() * 3)]
      : "It's the " + t.name;
    $("fb-spot").textContent = "👀 How to spot it: " + t.spot;
  }

  $("fb-continue").onclick = () => {
    $("feedback").className = "feedback";
    qIndex++;
    nextQuestion();
  };

  // ---------- results ----------------------------------------------------
  function endRound() {
    state.rounds++;
    save();
    Sfx.fanfare();
    const acc = total ? Math.round((roundFirstTry / total) * 100) : 0;
    $("res-acc").textContent = acc + "%";
    $("res-combo").textContent = bestComboRound;
    $("res-title").textContent =
      acc === 100 ? "Flawless spotting! 🏆" : acc >= 75 ? "Great eyes! 🛬" : "Round complete! 🛬";
    $("res-note").textContent =
      acc === 100
        ? "🐕 Maple says nobody sneaks a MAX past you."
        : "🐕 Maple double-checked every answer. Good dog.";

    const stampRow = $("res-stamps");
    stampRow.innerHTML = "";
    if (newlyRated.length) {
      Sfx.unlock();
      for (const t of newlyRated) {
        const el = document.createElement("div");
        el.className = "stamp-new";
        el.textContent = "✈️ TYPE RATED: " + t.name;
        stampRow.appendChild(el);
      }
    }
    show("results");
  }

  // ---------- credits ----------------------------------------------------
  function renderCredits() {
    const list = $("credits-list");
    const items = Photos.credits();
    list.innerHTML = items.length
      ? ""
      : `<p class="muted">No photos yet — the app is using placeholder art.
         Run <code>node tools/fetch-photos.mjs</code> (see the README) to pull
         freely-licensed photos from Wikimedia Commons, credited here automatically.</p>`;
    for (const p of items) {
      const t = FLEET.find((x) => x.id === p.type);
      const li = document.createElement("div");
      li.className = "credit-row";
      li.innerHTML = `<span>${t ? t.name : p.type}</span>
        <span class="muted">${p.credit || "Unknown"} · ${p.license || ""} ·
        <a href="${p.source}" target="_blank" rel="noopener">source</a></span>`;
      list.appendChild(li);
    }
  }

  // ---------- wiring -----------------------------------------------------
  $("play-btn").onclick = () => { Sfx.tick(); startRound(); };
  $("again-btn").onclick = () => { Sfx.tick(); startRound(); };
  $("home-btn").onclick = () => { Sfx.tick(); renderHome(); show("home"); };
  $("quit-btn").onclick = () => { renderHome(); show("home"); };
  $("credits-btn").onclick = () => { renderCredits(); show("credits"); };
  $("credits-back").onclick = () => { renderHome(); show("home"); };
  $("sound-toggle").onchange = (e) => { state.sound = e.target.checked; Sfx.muted = !state.sound; save(); };
  $("reset-btn").onclick = () => {
    if (confirm("Reset all Type Ratings progress?")) {
      state = freshState();
      save();
      renderHome();
    }
  };

  // ---------- boot -------------------------------------------------------
  Photos.load().then(() => {
    Sfx.muted = !state.sound;
    renderHome();
    show("home");
  });

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
