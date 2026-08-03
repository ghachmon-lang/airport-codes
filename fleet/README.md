# Corrine's Type Ratings ✈️🐕

Sibling app to Flight Academy: learn to **recognize every plane in the United
mainline fleet** before training starts. Plane Spotting prototype — a photo
appears, you name the type, and every answer teaches the *spotting cue* that
separates the lookalikes (737 vs A320, 777 vs 787…).

- **Adaptive rounds** — 8 photo questions; types you miss come up more often,
  misses are retried at the end so every round lands on a win.
- **Type ratings** — 8 lifetime correct at ≥80% accuracy stamps the type.
  Collect all 5 (more types coming: MAX 9, A321neo, 767s, the whole tree).
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
js/data.js      the fleet: facts, spotting cues, silhouette proportions
js/quiz.js      round builder: adaptive draw, rival-first distractors
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
