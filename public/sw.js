// Cipherati Service Worker (PWA Offline Shell & Web Push Handler)
const CACHE_NAME = "cipherati-shell-v1";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./favicon.svg",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// 1. Install event: Cache core app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate event: Cleanup stale caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch event: Stale-While-Revalidate for app shell, Network-First for live data
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Bypass cache for data feeds and analytics to guarantee real-time threat intelligence
  if (url.pathname.includes("/data/") || url.searchParams.has("v") || event.request.method !== "GET") {
    return;
  }

  // Network-first with cache fallback for HTML pages
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match("./index.html");
      })
    );
    return;
  }

  // Stale-while-revalidate for static icons, fonts, CSS
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// 4. Background Push Notification Handler (Native Fallback & OneSignal)
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const title = payload.title || "🚨 Cipherati Security Alert";
    const options = {
      body: payload.body || "New high-risk cyber incident or scam defense playbook updated.",
      icon: "./icons/icon-192.png",
      badge: "./icons/icon-192.png",
      vibrate: [200, 100, 200],
      tag: payload.tag || "cipherati-alert",
      renotify: true,
      data: {
        url: payload.url || "./#news"
      },
      actions: [
        { action: "open", title: "View Briefing" },
        { action: "dismiss", title: "Dismiss" }
      ]
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification("🚨 Cipherati Alert", {
        body: text,
        icon: "./icons/icon-192.png"
      })
    );
  }
});

// 5. Notification Click Handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const rawUrl = (event.notification.data && event.notification.data.url) ? String(event.notification.data.url) : "./#news";
  let targetUrl = "./#news";
  try {
    const parsed = new URL(rawUrl, self.location.origin);
    if (parsed.origin === self.location.origin || parsed.hostname === "cipherati.com") {
      targetUrl = parsed.href;
    }
  } catch {
    targetUrl = "./#news";
  }

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes("cipherati.com") && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// 6. Optional OneSignal SDK Integration
try {
  importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
} catch (e) {
  // Graceful fallback if offline
}
