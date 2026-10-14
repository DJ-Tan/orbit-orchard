const CACHE = "orchard-__VERSION__";
const FILES = __FILES__;
const FONTS = "__FONTS__";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all([c.addAll(FILES), c.add(FONTS).catch(() => {})])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

function keep(req, res) {
  if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
  return res;
}

self.addEventListener("fetch", (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET") return;
  if ((u.origin === "https://www.gstatic.com" && u.pathname.startsWith("/firebasejs/")) || u.origin === "https://fonts.gstatic.com") {
    e.respondWith(caches.match(r).then((hit) => hit || fetch(r).then((res) => keep(r, res))));
  } else if ((u.origin === location.origin && !u.pathname.startsWith("/__/")) || u.origin === "https://fonts.googleapis.com") {
    e.respondWith(fetch(r).then((res) => keep(r, res)).catch(() => caches.match(r, { ignoreSearch: true })
      .then((hit) => hit || (r.mode === "navigate" ? caches.match("./") : null))
      .then((hit) => hit || Response.error())));
  }
});
