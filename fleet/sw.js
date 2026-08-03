/*
 * sw.js — offline cache for Type Ratings. Core files are precached;
 * photos are cached on first view (they can be added/refreshed any time
 * by re-running tools/fetch-photos.mjs, so they're runtime-cached).
 */
const CACHE = "type-ratings-v1";
const CORE = [
  ".",
  "index.html",
  "styles.css",
  "manifest.webmanifest",
  "js/data.js",
  "js/quiz.js",
  "js/photos.js",
  "js/audio.js",
  "js/app.js",
  "photos/manifest.json",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(
      (hit) =>
        hit ||
        fetch(e.request).then((res) => {
          // Runtime-cache same-origin responses (photos, mainly).
          if (res.ok && new URL(e.request.url).origin === location.origin) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        })
    )
  );
});
