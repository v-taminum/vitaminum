// Vitaminum SW v1: push notifikasi pesanan + fallback offline ringan.
// Strategi fetch: network-first (agar admin/toko selalu versi terbaru), cache sebagai cadangan.
const CACHE = "vitaminum-v1";
const CORE = ["./", "./index.html", "./admin.html", "./manifest.webmanifest", "./assets/icons/icon-192.png", "./assets/icons/icon-512.png"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(fetch(e.request).then((r) => {
    const cp = r.clone();
    caches.open(CACHE).then((c) => c.put(e.request, cp));
    return r;
  }).catch(() => caches.match(e.request).then((m) => m || caches.match("./admin.html"))));
});
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch {}
  e.waitUntil(self.registration.showNotification(d.title || "Vitaminum", {
    body: d.body || "Ada kabar baru dari toko.",
    icon: "./assets/icons/icon-192.png",
    badge: "./assets/icons/icon-192.png",
    vibrate: [200, 100, 200, 100, 300],
    tag: "vit-order",
    renotify: true,
    requireInteraction: true,
    data: { url: d.url || "./admin.html" },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "./admin.html";
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((ws) => {
    for (const w of ws) { if (String(w.url).includes("admin.html")) { w.focus(); return; } }
    return clients.openWindow(url);
  }));
});
