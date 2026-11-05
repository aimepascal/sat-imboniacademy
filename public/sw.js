// Imboni SAT Hub offline support.
// Pages: network first, the last copy is used when there is no connection.
// Built files (/assets/*), fonts and images: stored after the first visit.
const VERSION = "imboni-v1";
const OFFLINE_PAGES = ["/learn"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(OFFLINE_PAGES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Never store account data or database answers.
  if (url.origin !== location.origin && !/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) return;
  if (/^\/(admin|auth|me|review|welcome|today|api)/.test(url.pathname)) return;

  const isStatic = url.pathname.startsWith("/assets/") || /\.(png|jpg|svg|woff2?|css)$/.test(url.pathname) || url.origin !== location.origin;
  if (isStatic) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      })),
    );
    return;
  }
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req).then((hit) => hit || caches.match("/learn"))),
    );
  }
});
