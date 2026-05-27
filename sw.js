const CACHE_NAME = "smartchart-v1";

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./settings.js",
  "./templates.js",
  "./storage.js",
  "./markdown.js",
  "./clipboard.js",
  "./manifest.json",
  "./vendor/marked.min.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});