// Basic Service Worker for Maxi Dial Reports
// This is a minimal service worker to prevent 404 errors

self.addEventListener('install', (event) => {
  console.log('Service Worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activated');
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Let the browser handle all fetch requests normally
  event.respondWith(fetch(event.request));
});

