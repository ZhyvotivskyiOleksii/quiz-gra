// Placeholder service worker for Firebase Messaging.
// Replace with your real messaging handler when ready.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Pass-through fetch handler to silence devtools warning
self.addEventListener('fetch', (event) => {
  // Let the request go to network unchanged
  try {
    event.respondWith(fetch(event.request));
  } catch {
    // In case respondWith throws (non-navigation preloads), ignore
  }
});
