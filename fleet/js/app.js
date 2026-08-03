/*
 * app.js — Type Ratings orchestrator: hangar / quiz / results / credits.
 * Four modes (Plane Spotting, Twins, Top Trumps, Who Am I?) over a fleet
 * tree that unlocks group by group. Same universe as Flight Academy:
 * Maple, the palette, chunky 3D buttons, end on a win.
 *
 * Progress model (localStorage "fleet.v1"):
 *   stats[typeId]  = { seen, correct, rated }  — RECOGNITION reps only
 *                    (spot + twins). Top Trumps / riddles are knowledge
 *                    games and track modeStats instead, so a type rating
 *                    always means "she can recognize it on sight."
 *   modeStats[mode] = { seen, correct }
 * A type becomes "rated" (stamped) at ≥8 recognition correct with ≥80%.
 */

(() => {
  const KEY = "fleet.v1";
  const ROUND_SIZE = 8;
  const RATED_MIN_CORRECT = 8;
  const RATED_MIN_ACC = 0.8;

  const $ = (id) => document.getElementById(id);
  const byId = Object.fromEntries(FLEET.map((t) => [t.id, t]));

  // ---------- state ------------------------------------------------------
  function freshState() {
    return { stats: {}, modeStats: {}, bestCombo: 0, rounds: 0, sound: true };
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
  const modeStat = (m) => (state.modeStats[m] = state.modeStats[m] || { seen: 0, correct: 0 });
  const ctx = () => ({ fleet: FLEET, groups: GROUPS, rivals: RIVALS, twins: TWINS, stats: state.stats });

  // ---------- screens ----------------------------------------------------
  function show(name) {
    for (const s of document.querySelectorAll(".screen")) s.hidden = true;
    $(name + "-screen").hidden = false;
    window.scrollTo(0, 0);
  }

  const art = (t, cls = "") =>
    Photos.hasPhotos(t.id)
      ? `<img class="${cls}" src="photos/${Photos.next(t.id).file}" alt=""/>`
      : Photos.silhouette(t);

  // ---------- home (the hangar) -----------------------------------------
  const MODES = [
    { id: "spot", icon: "🔭", name: "Plane Spotting", desc: "See a plane, name the type" },
    { id: "twins", icon: "👯", name: "Twins", desc: "Two lookalikes — tap the right one" },
    { id: "trump", icon: "⚔️", name: "Top Trumps", desc: "Bigger? Farther? Longer?" },
    { id: "riddle", icon: "🎭", name: "Who Am I?", desc: "Three clues, one plane" },
  ];

  function renderHome() {
    $("ph-banner").hidden = Photos.anyPhotos();

    // mode buttons
    const modeRow = $("modes");
    modeRow.innerHTML = "";
    for (const m of MODES) {
      const ms = state.modeStats[m.id];
      const b = document.createElement("button");
      b.className = "mode-card";
      b.innerHTML = `<span class="mi">${m.icon}</span>
        <span class="mn">${m.name}</span>
        <span class="md">${m.desc}</span>
        ${ms && ms.seen ? `<span class="ms">${Math.round((ms.correct / ms.seen) * 100)}%</span>` : ""}`;
      b.onclick = () => { Sfx.tick(); startRound(m.id); };
      modeRow.appendChild(b);
    }

    // fleet tree, grouped, with locks
    const wrap = $("hangar");
    wrap.innerHTML = "";
    const open = Quiz.unlockedGroupCount(GROUPS, state.stats);
    GROUPS.forEach((g, gi) => {
      const locked = gi >= open;
      const head = document.createElement("div");
      head.className = "group-head" + (locked ? " locked" : "");
      let hint = "";
      if (locked) {
        const prev = GROUPS[gi - 1];
        const need = prev.types.filter((id) => (state.stats[id]?.correct || 0) < Quiz.UNLOCK_CORRECT).length;
        hint = gi === open
          ? `🔒 Get ${Quiz.UNLOCK_CORRECT}+ correct on ${need} more “${prev.name}” plane${need === 1 ? "" : "s"}`
          : "🔒";
      }
      head.innerHTML = `<span>${g.icon} ${g.name}</span><span class="gh-hint">${hint}</span>`;
      wrap.appendChild(head);

      const grid = document.createElement("div");
      grid.className = "hangar-grid";
      for (const id of g.types) {
        const t = byId[id];
        const s = state.stats[id];
        const acc = s && s.seen ? s.correct / s.seen : null;
        const card = document.createElement("div");
        card.className = "plane-card" + (s && s.rated ? " rated" : "") + (locked ? " locked" : "");
        card.innerHTML = locked
          ? `<div class="art mystery">❓</div><div class="plane-name">???</div><div class="plane-meta">Locked</div>`
          : `<div class="art">${art(t)}</div>
             <div class="plane-name">${t.name}</div>
             <div class="plane-meta">${s && s.rated ? "✈️ Type rated!" : acc == null ? "Not spotted yet" : Math.round(acc * 100) + "% · " + s.correct + " correct"}</div>`;
        grid.appendChild(card);
      }
      wrap.appendChild(grid);
    });

    const ratedCount = FLEET.filter((t) => state.stats[t.id]?.rated).length;
    $("rated-count").textContent = `${ratedCount} / ${FLEET.length}`;
    $("sound-toggle").checked = state.sound;
  }

  // ---------- quiz -------------------------------------------------------
  let mode = "spot", queue = [], qIndex = 0, total = 0;
  let roundFirstTry = 0, combo = 0, bestComboRound = 0;
  let current = null, locked = false, newlyRated = [], groupsAtStart = 1;
  let cluesShown = 1;

  function startRound(m) {
    mode = m;
    queue = Quiz.buildRound(m, ctx(), ROUND_SIZE);
    if (!queue.length) return; // shouldn't happen: modes are always playable
    qIndex = 0;
    total = queue.length;
    roundFirstTry = 0;
    combo = 0;
    bestComboRound = 0;
    newlyRated = [];
    groupsAtStart = Quiz.unlockedGroupCount(GROUPS, state.stats);
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

  const PROMPTS = {
    spot: () => "What plane is this?",
    twins: (q) => `Tap the <b>${byId[q.answer].name}</b>`,
    trump: (q) => q.prompt,
    riddle: () => "Who am I?",
  };

  function nextQuestion() {
    if (qIndex >= queue.length) return endRound();
    current = queue[qIndex];
    locked = false;
    cluesShown = 1;
    $("quiz-fill").style.width = Math.round((qIndex / queue.length) * 100) + "%";
    $("quiz-count").textContent = `${qIndex + 1} / ${queue.length}`;
    $("fixup-tag").hidden = !current.retry;
    $("q-prompt").innerHTML = PROMPTS[current.kind](current);

    const body = $("q-body");
    const opts = $("options");
    opts.innerHTML = "";
    body.innerHTML = "";

    if (current.kind === "spot") {
      body.innerHTML = `<div class="photo-box">${art(byId[current.typeId])}</div>`;
      renderTextOptions(opts);
    } else if (current.kind === "twins") {
      // two art panels ARE the options — no names, that would give it away
      body.innerHTML = "";
      const row = document.createElement("div");
      row.className = "twin-row";
      for (const o of current.options) {
        const b = document.createElement("button");
        b.className = "twin-panel";
        b.dataset.id = o.id;
        b.innerHTML = `<div class="tp-art">${art(byId[o.id])}</div><div class="tp-label" hidden>${o.label}</div>`;
        b.onclick = () => answer(o.id, b);
        row.appendChild(b);
      }
      body.appendChild(row);
    } else if (current.kind === "trump") {
      const row = document.createElement("div");
      row.className = "twin-row";
      for (const o of current.options) {
        const b = document.createElement("button");
        b.className = "twin-panel";
        b.dataset.id = o.id;
        b.innerHTML = `<div class="tp-art">${art(byId[o.id])}</div><div class="tp-label">${o.label}</div>`;
        b.onclick = () => answer(o.id, b);
        row.appendChild(b);
      }
      body.appendChild(row);
    } else if (current.kind === "riddle") {
      const list = document.createElement("div");
      list.className = "clues";
      list.id = "clues";
      body.appendChild(list);
      renderClues();
      const more = document.createElement("button");
      more.className = "btn ghost small";
      more.id = "more-clues";
      more.textContent = "🔍 Another clue";
      more.onclick = () => {
        cluesShown = Math.min(cluesShown + 1, current.clues.length);
        Sfx.tick();
        renderClues();
        if (cluesShown >= current.clues.length) more.hidden = true;
      };
      body.appendChild(more);
      renderTextOptions(opts);
    }
  }

  function renderClues() {
    // only the newest clue gets the pop animation — re-animating the old
    // ones on every reveal looks glitchy
    $("clues").innerHTML = current.clues
      .slice(0, cluesShown)
      .map((c, i) => `<div class="clue${i === cluesShown - 1 ? " fresh" : ""}">${i + 1}. ${c}</div>`)
      .join("");
  }

  function renderTextOptions(opts) {
    for (const o of current.options) {
      const b = document.createElement("button");
      b.className = "opt";
      b.dataset.id = o.id;
      b.textContent = o.label;
      b.onclick = () => answer(o.id, b);
      opts.appendChild(b);
    }
  }

  function answer(pickedId, btn) {
    if (locked) return;
    locked = true;
    const t = byId[current.answer];
    const right = pickedId === current.answer;

    // ---- stats: recognition modes feed type ratings; knowledge modes
    //      feed mode stats only, so "rated" stays an on-sight claim.
    if (current.kind === "spot" || current.kind === "twins") {
      const s = statFor(t.id);
      s.seen++;
      if (right) s.correct++;
      if (!s.rated && s.correct >= RATED_MIN_CORRECT && s.correct / s.seen >= RATED_MIN_ACC) {
        s.rated = true;
        newlyRated.push(t);
      }
    }
    const ms = modeStat(mode);
    ms.seen++;
    if (right) ms.correct++;

    // ---- paint the choices
    for (const b of document.querySelectorAll(".opt, .twin-panel")) {
      b.disabled = true;
      if (b.dataset.id === current.answer) b.classList.add("good");
      const lbl = b.querySelector(".tp-label");
      if (lbl) lbl.hidden = false; // reveal names on twins panels
    }
    if (!right && btn) btn.classList.add("bad");

    if (right) {
      combo++;
      bestComboRound = Math.max(bestComboRound, combo);
      state.bestCombo = Math.max(state.bestCombo, combo);
      if (!current.retry) roundFirstTry++;
      Sfx.correct(combo);
      if (combo >= 3) setMaple(combo >= 5 ? "🔥 " + combo + " in a row!!" : "Combo x" + combo + "!");
    } else {
      combo = 0;
      Sfx.wrong();
      if (!current.retry) queue.push({ ...current, retry: true }); // land on a win
    }
    save();

    // ---- feedback: verdict + the teaching beat for this question kind
    const fb = $("feedback");
    fb.className = "feedback show " + (right ? "good" : "bad");
    $("fb-headline").textContent = right
      ? ["Nailed it!", "Sharp eyes!", "That's the one!"][Math.floor(Math.random() * 3)]
      : "It's the " + t.name;
    let detail = "";
    if (current.kind === "twins") detail = "👯 Tell them apart: " + current.tell;
    else if (current.kind === "trump")
      detail = "⚔️ " + current.reveal.map((r) => `${r.label}: ${r.value}`).join("  ·  ");
    else detail = "👀 How to spot it: " + t.spot;
    $("fb-spot").textContent = detail;
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
      acc === 100 ? "Flawless round! 🏆" : acc >= 75 ? "Great eyes! 🛬" : "Round complete! 🛬";
    $("res-note").textContent =
      acc === 100
        ? "🐕 Maple says nobody sneaks a MAX past you."
        : "🐕 Maple double-checked every answer. Good dog.";

    const stampRow = $("res-stamps");
    stampRow.innerHTML = "";
    for (const t of newlyRated) {
      const el = document.createElement("div");
      el.className = "stamp-new";
      el.textContent = "✈️ TYPE RATED: " + t.name;
      stampRow.appendChild(el);
    }

    // fleet-tree unlock celebration
    const openNow = Quiz.unlockedGroupCount(GROUPS, state.stats);
    for (let gi = groupsAtStart; gi < openNow; gi++) {
      const el = document.createElement("div");
      el.className = "stamp-new unlock";
      el.textContent = `🔓 NEW PLANES: ${GROUPS[gi].icon} ${GROUPS[gi].name}`;
      stampRow.appendChild(el);
    }
    if (newlyRated.length || openNow > groupsAtStart) Sfx.unlock();

    $("again-btn").textContent =
      { spot: "🔭 Spot more planes", twins: "👯 More twins", trump: "⚔️ Play again", riddle: "🎭 More riddles" }[mode];
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
      const t = byId[p.type];
      const li = document.createElement("div");
      li.className = "credit-row";
      li.innerHTML = `<span>${t ? t.name : p.type}</span>
        <span class="muted">${p.credit || "Unknown"} · ${p.license || ""} ·
        <a href="${p.source}" target="_blank" rel="noopener">source</a></span>`;
      list.appendChild(li);
    }
  }

  // ---------- wiring -----------------------------------------------------
  $("again-btn").onclick = () => { Sfx.tick(); startRound(mode); };
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
