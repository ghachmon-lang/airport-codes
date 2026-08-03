/*
 * sw.js — service worker for offline use.
 *
 * Caches the app shell so the trainer loads even with no signal (e.g. on a plane).
 * Bump CACHE_VERSION whenever the app files change to push an update to devices.
 */
const CACHE_VERSION = "airport-trainer-v6";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./js/data.js",
  "./js/srs.js",
  "./js/storage.js",
  "./js/audio.js",
  "./js/game.js",
  "./js/linecheck.js",
  "./js/voice.js",
  "./js/app.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first: always prefer fresh files when online (so updates land
// immediately and HTML/JS never drift out of sync), and fall back to the
// cached copy when offline. Successful responses refresh the cache.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
