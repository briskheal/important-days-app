const CACHE_NAME = 'important-days-v2';
const ASSETS = [
  '/',
  '/landing.html',
  '/index.html',
  '/login.html',
  '/app.js',
  '/data.js',
  '/style.css',
  '/privacy.html',
  '/terms.html',
  '/refund.html'
];

// Install: Cache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting()) // Force update
  );
});

// Activate: Clear old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim()) // Take control immediately
  );
});

// Fetch: Network First, fallback to cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).then((response) => {
      // If network works, update cache and return
      if (response && response.status === 200 && response.type === 'basic') {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
      }
      return response;
    }).catch(() => {
      // If network fails, try cache
      return caches.match(event.request);
    })
  );
});
