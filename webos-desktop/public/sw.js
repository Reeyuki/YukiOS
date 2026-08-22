const CACHE = "yukios-pwa-cache-v1";
const OVERRIDES_CACHE = "yukios-system-overrides-v1";

const overrideMap = new Map();

function asUrl(path) {
  return new URL(path, self.registration.scope).toString();
}

async function loadOverridesFromCache() {
  const cache = await caches.open(OVERRIDES_CACHE);
  for (const request of await cache.keys()) {
    const response = await cache.match(request);
    if (!response) continue;
    overrideMap.set(new URL(request.url).pathname, await response.text());
  }
}

async function storeOverride(pathname, content) {
  overrideMap.set(pathname, content);
  const cache = await caches.open(OVERRIDES_CACHE);
  await cache.put(new Request(self.location.origin + pathname), new Response(content));
}

async function clearOverride(pathname) {
  overrideMap.delete(pathname);
  const cache = await caches.open(OVERRIDES_CACHE);
  await cache.delete(self.location.origin + pathname);
}

function mimeForOverride(path) {
  if (path.endsWith(".js") || path.endsWith(".mjs")) return "text/javascript";
  if (path.endsWith(".css")) return "text/css";
  if (path.endsWith(".json")) return "application/json";
  return "application/octet-stream";
}

loadOverridesFromCache();

const PRECACHE_URLS = [
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
      loadOverridesFromCache();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  } else if (event.data && event.data.type === "SYSTEM_OVERRIDES_PUSH") {
    const incoming = (event.data && event.data.overrides) || {};
    event.waitUntil(
      (async () => {
        for (const pathname of [...overrideMap.keys()]) {
          if (!Object.prototype.hasOwnProperty.call(incoming, pathname)) await clearOverride(pathname);
        }
        for (const pathname of Object.keys(incoming)) {
          await storeOverride(pathname, incoming[pathname]);
        }
        const port = event.ports && event.ports[0];
        if (port) port.postMessage({ ok: true });
      })()
    );
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

  if (overrideMap.has(url.pathname)) {
    event.respondWith(
      new Response(overrideMap.get(url.pathname), {
        headers: { "Content-Type": mimeForOverride(url.pathname) }
      })
    );
    return;
  }

  const destination = request.destination;
  if (["script", "style", "image", "font"].includes(destination)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
