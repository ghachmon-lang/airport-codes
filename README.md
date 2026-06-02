# Airport Code Trainer ✈️

An adaptive flashcard web app for memorizing **United Airlines destinations** and their
3-letter airport codes — built for flight-attendant training.

It uses **spaced repetition** (the technique behind Anki/Duolingo): codes you miss come
back quickly and repeat until they stick, while codes you know get pushed further out and
are only re-checked once in a while to confirm they held. The app adapts as you learn.

## Features

- **Both directions** — quizzes both `Code → Destination` (DEN → Denver) and
  `Destination → Code` (Denver → DEN), tracked separately.
- **Self-graded flip cards** — read the prompt, think, tap to reveal, then tap
  **Got it** or **Missed it**.
- **Learn by getting it right** — answer a card correctly **4 times in a row** and it's
  learned (achievable the same day); after that it's only checked occasionally. A miss
  breaks the streak. Slip on one you already knew? Just **2 in a row** to refresh it.
- **Curriculum-paced** — teaches hubs first, then major cities, then everything else,
  adding new destinations only as you learn the current ones (no fixed per-session count).
  Tune how many you juggle at once in Settings → "Cards to learn at once".
- **Works offline** — installable to your phone's home screen (PWA); great on a plane.
- **Progress saved on your device** — close it and pick up later. Export/import to back
  up or move to another phone.
- **No accounts, no backend, no cost.**

## Use it on your phone

1. Open the app's URL in your phone browser (see *Deploy* below).
2. Tap the browser menu → **Add to Home Screen**.
3. Open it like any app. It works without signal once loaded.

## Run locally

It's plain HTML/CSS/JS — no build step. From the project folder:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

(A static server is needed so the service worker / module loading behave like production;
opening `index.html` directly via `file://` mostly works but the offline cache won't.)

## Deploy free with GitHub Pages

1. Push this repo to GitHub.
2. Repo **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
3. Pick the branch and the `/ (root)` folder, then **Save**.
4. After a minute, your app is live at `https://<user>.github.io/<repo>/`. Share that URL.

## Editing the destination list

All destinations live in **`js/data.js`** as a simple list:

```js
{ code: "DEN", city: "Denver", country: "United States", region: "Hub" }
```

Add, remove, or fix lines as needed. Editing the list **won't erase progress** — cards are
matched by code + direction, and the app merges changes on load.

> **Accuracy note:** the included list is a curated starter set of United's hubs and many
> mainline destinations. Routes change over time, so verify it against the official United
> training materials and correct anything here.

## Project layout

```
index.html            # the app shell / screens
styles.css            # mobile-first styling
js/data.js            # the United destinations dataset (edit me)
js/srs.js             # spaced-repetition scheduler (the adaptive brain)
js/storage.js         # save/load + export/import progress (localStorage)
js/app.js             # ties everything to the UI
manifest.webmanifest  # PWA metadata
sw.js                 # service worker (offline caching)
icons/                # app icons
tests/srs.test.js     # tests for the scheduler
```

## Tests

```bash
node tests/srs.test.js
```

Verifies the core scheduling rules: correct answers grow the interval, misses shrink it and
resurface fast, ease has a floor, mastery is reached, and progress survives data edits.
