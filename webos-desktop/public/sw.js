const CACHE = "yukios-pwa-cache-v1";

function asUrl(path) {
  return new URL(path, self.registration.scope).toString();
}

const PRECACHE_URLS = [
  asUrl("./"),
  asUrl("./index.html"),
  asUrl("./favicon.ico"),
  asUrl("./manifest.webmanifest"),
  asUrl("./icons/icon-128.png"),
  asUrl("./icons/icon-256.png")
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(PRECACHE_URLS);
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith("yukios-pwa-cache-") && k !== CACHE).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  return cached || (await fetchPromise);
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (await cache.match(asUrl("./index.html")));
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (!isSameOrigin) return;

  const destination = request.destination;
  if (["script", "style", "image", "font"].includes(destination)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
