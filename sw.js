/*
 * sw.js — service worker for offline use.
 *
 * Caches the app shell so the trainer loads even with no signal (e.g. on a plane).
 * Bump CACHE_VERSION whenever the app files change to push an update to devices.
 */
const CACHE_VERSION = "airport-trainer-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./js/data.js",
  "./js/srs.js",
  "./js/storage.js",
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

// Cache-first for the app shell; fall back to network otherwise.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).catch(() => cached))
  );
});
