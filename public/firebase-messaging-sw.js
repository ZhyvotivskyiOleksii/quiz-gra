// Placeholder service worker for Firebase Messaging.
// Replace with your real messaging handler when ready.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// No-op fetch handler - pass-through
self.addEventListener('fetch', () => {});

