importScripts("./cont.sw.js");

const { route, shouldRoute } = $scramjetController;

self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  if (shouldRoute(event)) {
    event.respondWith(route(event));
  }
});
