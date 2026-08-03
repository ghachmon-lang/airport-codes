# Corrine's Type Ratings ✈️🐕

Sibling app to Flight Academy: learn to **recognize every plane in the United
mainline fleet** (17 types) before training starts.

## Four game modes

- **🔭 Plane Spotting** — a photo appears, name the type. Every answer (right
  or wrong) teaches the *spotting cue* that separates the lookalikes.
- **👯 Twins** — two lookalikes side by side (737-800 vs MAX 8, A320 vs
  A321neo, 767-300 vs -400…), tap the named one. Feedback teaches the one
  tell that separates the pair. More pairs appear as the fleet unlocks.
- **⚔️ Top Trumps** — two planes: which carries more? flies farther? is
  longer? has two aisles? Comparisons are only asked when the gap is real
  (≥12%), so there's always one defensible answer.
- **🎭 Who Am I?** — three clues, vague → giveaway, reveal at your own pace.

## The fleet tree

17 types in 5 groups: **First Wings** (737-800, A320, 757-200, 777-300ER,
787-9) → **The 737 Family** (-700, -900ER, MAX 8, MAX 9) → **The Airbus
Corner** (A319, A321neo) → **Long-Haul Classics** (757-300, 767-300ER,
-400ER) → **Widebody Flagships** (777-200ER, 787-8, 787-10). Get 5+ correct
on every plane in a group to unlock the next.

- **Adaptive rounds** — 8 questions; types you miss come up more often,
  misses are retried at the end so every round lands on a win.
- **Type ratings** — 8 lifetime correct at ≥80% accuracy stamps the type.
  Only *recognition* modes (Spotting, Twins) count toward a rating, so a
  stamp always means "knows it on sight."
- Same no-backend PWA setup as the airport app: offline after one load,
  progress in localStorage.

## Run locally

```bash
python3 -m http.server 8000    # then open http://localhost:8000/fleet/
```

## Real photos (do this once)

The app ships with placeholder silhouettes. To swap in real photos of real
United planes, run (from `fleet/`, needs Node 18+ and open internet):

```bash
node tools/fetch-photos.mjs
```

It searches Wikimedia Commons for freely-licensed United-livery shots,
downloads a few per type into `photos/`, and writes `photos/manifest.json`
with author + license, shown on the in-app **Photo credits** screen (that's
what the CC licenses ask for).

**Then curate:** open `photos/`, delete any bad shots (wrong angle, blurry,
another airline in frame), and run:

```bash
node tools/fetch-photos.mjs --prune   # drops deleted files from the manifest
```

You can also add your own photos by hand — drop a file in `photos/` and add a
manifest entry: `{ "type": "b737-800", "file": "myshot.jpg", "credit": "...",
"license": "...", "source": "..." }`.

## Adding aircraft types

`js/data.js` — one entry per type (facts + the all-important `spot` cue) and a
`RIVALS` line saying which types it gets confused with. Then give the new type
a search term in `tools/fetch-photos.mjs` and re-run it.

## Project layout

```
index.html      app shell (hangar / quiz / results / credits)
styles.css      Flight Academy design system, photo-first
js/data.js      the fleet: facts, spotting cues, clues, twins, groups
js/quiz.js      round builders for all 4 modes + fleet-tree unlock logic
js/photos.js    photo manifest + rotation + placeholder silhouette renderer
js/audio.js     synthesized sound effects (shared with the airport app)
js/app.js       orchestrator
tools/          fetch-photos.mjs (Wikimedia Commons downloader)
tests/          node tests: quiz.test.js
```

## Tests

```bash
node tests/quiz.test.js
```
