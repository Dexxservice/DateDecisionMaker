importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCKF4yb7X6XDt5PSTMwiXmn0y7j9aTVMjc",
  authDomain: "date-decision-maker.firebaseapp.com",
  databaseURL: "https://date-decision-maker-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "date-decision-maker",
  storageBucket: "date-decision-maker.firebasestorage.app",
  messagingSenderId: "187389563873",
  appId: "1:187389563873:web:4fa5fea6a44c42e18078a0"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || 'MerSam OS';
  const body = (payload.notification && payload.notification.body) || '';
  self.registration.showNotification(title, {
    body,
    icon: '/icon.png',
    badge: '/icon.png',
    tag: (payload.data && payload.data.tag) || 'mersam-os',
    data: payload.data || {}
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});

// --- OFFLINE-FÄHIGKEIT ---
// App-Shell + alle geladenen Assets (Tailwind, Fonts, Leaflet, Firebase-SDK) werden gecacht,
// damit die App auch ganz ohne Netz noch startet und die zuletzt gesehenen Daten zeigt.
const CACHE_NAME = 'mersam-os-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.json', '/icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Firebase Realtime Database / Storage / Messaging API-Aufrufe nie cachen - müssen immer live sein
  if (req.url.includes('firebasedatabase.app') || req.url.includes('firebasestorage.app') || req.url.includes('firebaseinstallations.googleapis.com') || req.url.includes('fcm.googleapis.com')) {
    return;
  }

  // HTML-Seite selbst: immer versuchen aktuell zu laden (Updates sollen ankommen),
  // nur bei fehlendem Netz auf die zuletzt gecachte Version zurückfallen
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('/index.html')))
    );
    return;
  }

  // Alles andere (Skripte, Styles, Fonts, Bilder, CDN-Ressourcen):
  // sofort aus dem Cache liefern falls vorhanden (schnell + offline-fähig),
  // im Hintergrund parallel aktualisieren
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
