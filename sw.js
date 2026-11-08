// Service Worker для PWA "Сайт с 0 по созданию сайтов"
// Кэширует все файлы для офлайн-работы

const CACHE_VERSION = "v7-cache-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/styles.css",
  "./assets/app.js",
  "./assets/icons.js",
  "./data/lessons.json",
  "./data/quizzes.json",
  "./data/block-quizzes.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-192-maskable.png",
  "./icons/icon-512-maskable.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
  "./icons/favicon-16.png",
  "./icons/favicon.ico",
  "./offline.html"
];

// === УСТАНОВКА: кэшируем app shell ===
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn("SW install error:", err))
  );
});

// === АКТИВАЦИЯ: чистим старые кэши ===
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((k) => k !== CACHE_VERSION)
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// === ЗАПРОСЫ: стратегия cache-first, потом network с кэшированием ===
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Только GET
  if (req.method !== "GET") return;

  // Игнорируем chrome-extension и другие протоколы
  const url = new URL(req.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // Для навигационных запросов (HTML) — network first, fallback на кэш, потом offline.html
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // кэшируем свежий HTML
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put("./index.html", clone));
          return res;
        })
        .catch(() => caches.match("./index.html").then((r) => r || caches.match("./offline.html")))
    );
    return;
  }

  // Для остальных (CSS, JS, JSON, иконки) — cache first, потом network с обновлением кэша
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // Возвращаем кэш сразу, в фоне обновляем
        fetch(req)
          .then((res) => {
            if (res && res.status === 200) {
              const clone = res.clone();
              caches.open(CACHE_VERSION).then((c) => c.put(req, clone));
            }
          })
          .catch(() => {});
        return cached;
      }
      // Нет в кэше — идём в сеть
      return fetch(req)
        .then((res) => {
          if (!res || res.status !== 200 || res.type !== "basic") return res;
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, clone));
          return res;
        })
        .catch(() => caches.match("./offline.html"));
    })
  );
});

// === PUSH-уведомления (на будущее) ===
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "Сайт с 0";
  const options = {
    body: data.body || "Новое в курсе",
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-192.png",
    vibrate: [100, 50, 100]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// === Клик по уведомлению ===
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("./"));
});
