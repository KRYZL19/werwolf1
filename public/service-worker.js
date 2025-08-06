// Service Worker für Werwolf-Webspiel

const CACHE_NAME = 'werwolf-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/client.js',
  '/js/ui.js',
  '/assets/werewolf.png',
  '/assets/villager.png'
];

// Installation des Service Workers
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache geöffnet');
        return cache.addAll(urlsToCache);
      })
  );
});

// Aktivierung des Service Workers
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch-Event abfangen
self.addEventListener('fetch', event => {
  // Nur für GET-Anfragen cachen
  if (event.request.method !== 'GET') return;

  // Keine Socket.IO-Anfragen cachen
  if (event.request.url.includes('socket.io')) return;

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache-Hit - Ressource zurückgeben
        if (response) {
          return response;
        }

        // Anfrage klonen, da sie nur einmal verwendet werden kann
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(response => {
          // Überprüfen, ob die Antwort gültig ist
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Antwort klonen, da sie auch nur einmal verwendet werden kann
          const responseToCache = response.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });

          return response;
        });
      })
  );
});

