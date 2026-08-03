# Corrine's Flight Academy ✈️🐕

A Duolingo-style game for learning **United's airport codes and destinations** — built
for a flight-attendant trainee. No accounts, no backend, no cost: a self-contained
PWA that runs offline and saves progress on the device.

Two modes, one brain: **Academy** teaches, **Line Check** checks. The switch sits at
the top of the home screen.

## Academy mode 🎓 — how the game works

- **The Flight Path** — 158 destinations grouped into 25 themed *routes* (The Hubs
  first, then Big East, West Coast Stars, Sunshine State… through Europe, Asia and
  Down Under). Each route has 2–3 *flights* plus a *landing* test. Finish a route and
  the next gate opens.
- **Flights are short and always land** — ~10 real, graded questions (~2 minutes):
  multiple choice in both directions, letter-tile code building, and Baggage-Claim
  match-the-pairs boards. Wrong answers come back at the end of the flight ("Final
  approach — let's fix 2") so every session ends on a success.
- **Miles, ranks, and the daily goal** — every correct answer earns Sky Miles
  (combo bonuses at 3+ in a row, landing and flawless-flight bonuses, tight-connection
  bonus for jumping straight into the next flight). Miles climb the crew ladder:
  Trainee 🎓 → Flight Attendant ✈️ → Senior FA 🌟 → Purser 👑 → Chief Purser 🏆.
- **Streaks with Weather Delays** — landing one flight a day keeps the streak alive.
  Every 3 flawless flights banks a *Weather Delay* (streak shield, max 2 — also
  buyable for 200 miles) that auto-protects a single missed day.
- **Passport & badges** — every completed route stamps the passport; badges for
  milestones (Hub Captain, Flawless Flight, Week in the Sky, Maple's Best Friend…).
- **Maple the mascot 🐕** — reacts to every answer, guards streaks, and hands out
  kisses when a destination is learned.
- **Spaced repetition under the hood** — every answer feeds an SM-2-style scheduler
  (`js/srs.js`). Due cards surface as a *Standby* flight so learned codes get
  re-checked right before they'd fade. Memory hooks ("ORD was ORcharD Field") appear
  when a code is introduced and after misses.

## Line Check mode 🎧 — the one that transfers

Academy trains *recognition inside a fixed context*: four options on screen, letter
tiles that pre-give the three letters, a route that has already narrowed the answer
to six airports, the same layout every time. That memory is bound to cues that don't
exist when someone asks her at dinner. Line Check strips them:

- **No multiple choice, ever.** She types the answer on a real keyboard, or says it.
- **Interleaved.** Any airport she's met, in any order — the answer space is the whole
  map, not one route.
- **Crew-voice scenarios, never the same wording twice.** "A bag tag reads MSY — where
  is it going?", "Ops radios: confirm destination Lisbon. Code?"
- **The phone talks and listens.** Prompts are spoken aloud (codes spelled out, not
  pronounced), and where the browser supports it she can answer out loud — letters
  ("D-E-N"), phonetics ("delta echo november"), or the word. Typing always works too.
- **The layout changes every question** — index card, bag tag, departure board, cabin
  PA, plain text — so the layout can't become the cue either.

Five ways to run it:

| | |
|---|---|
| **Line check · 10 questions** | Cold calls, a trip sheet, a free-recall list |
| **Ramp rush · 60s** | Bare city names, type as many codes as you can |
| **Trip sheets** | `ORD → MSY → IAH` — name every stop |
| **Free recall** | "Name four codes in Hawaii." No cue but the category |
| **Quiz me** | Hand the phone to someone else; they read, they grade. The real test |

Plus a **cold call on open**: occasionally the app's first screen is a single question,
no warm-up — the closest thing to being asked out of the blue. (Settings can turn it off.)

Grading is forgiving of real typing but never of the wrong airport: `ohare`, `Denvor`
and `maui` all pass; `Chicago` alone asks *which one* (O'Hare or Midway) instead of
guessing; `Los` is nudged to finish the name. None of those cost her anything.

Both modes feed the same scheduler, streak and Sky Miles — but producing an answer
cold counts double while a card is still being learned, because it's stronger evidence
than picking one of four.

## Run locally

```bash
python3 -m http.server 8000    # then open http://localhost:8000
```

## Deploy free with GitHub Pages

Repo **Settings → Pages → Deploy from a branch**, pick the branch + `/ (root)`.
The service worker precaches everything, so it works in airplane mode after one load.

## Editing the destinations

`js/data.js` — one line per airport, plus the `UNITS` route grouping and `HOOKS`
memory hooks. Edits never wipe progress (cards merge by code+direction).

## Project layout

```
index.html      app shell (path / lesson / boarding pass / line check / passport / settings)
styles.css      design system: 3D buttons, path nodes, boarding pass, confetti
js/data.js      airports + route units + memory hooks (edit me)
js/srs.js       spaced-repetition scheduler + streak/freeze logic
js/game.js      graded question generation (choice, tiles, pairs) + distractors
js/audio.js     synthesized sound effects (WebAudio, no assets)
js/storage.js   persistence, export/import, v1→v2 migration
js/app.js       the game orchestrator
sw.js           offline cache
tests/          node tests: srs.test.js, game.test.js, linecheck.test.js
```

## Tests

```bash
node tests/srs.test.js && node tests/game.test.js && node tests/linecheck.test.js
```
