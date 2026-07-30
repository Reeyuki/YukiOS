importScripts("./controller.sw.js");
importScripts("./adblock.js");

const { route, shouldRoute } = $scramjetController;

var adblock = new self.AdBlockEngine();
var adblockReady = false;
var adblockPageCount = 0;
var adblockTotalRequests = 0;
var adblockRecentBlocks = [];

self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  if (adblockReady && adblock.enabled && adblock.shouldBlock(event.request.url)) {
    adblockTotalRequests++;
    adblockPageCount++;
    adblockRecentBlocks.push({ url: event.request.url, time: Date.now() });
    if (adblockRecentBlocks.length > 200) adblockRecentBlocks.splice(0, 50);
    event.respondWith(new Response(null, { status: 204, statusText: "Blocked by AdBlock" }));
    return;
  }
  if (shouldRoute(event)) {
    event.respondWith(route(event));
  }
});

self.addEventListener("message", (event) => {
  var data = event.data;
  if (data.type === "adblock:init") {
    if (data.enabled) {
      adblock.init().then(() => {
        adblockReady = true;
        adblock.enabled = true;
        self.clients.matchAll().then((clients) => {
          clients.forEach((c) => c.postMessage({ type: "adblock:ready" }));
        });
      });
    } else {
      adblock.enabled = false;
      adblockReady = true;
    }
  }
  if (data.type === "adblock:toggle") {
    adblock.enabled = data.enabled;
    if (!data.enabled) adblockPageCount = 0;
  }
  if (data.type === "adblock:pagechange") {
    adblockPageCount = 0;
  }
  if (data.type === "adblock:log") {
    if (event.source) {
      event.source.postMessage({
        type: "adblock:log",
        entries: adblockRecentBlocks.slice(-100)
      });
    }
  }
  if (data.type === "adblock:stats" && event.source) {
    event.source.postMessage({
      type: "adblock:stats",
      blockedCount: adblock.blockedCount,
      pageBlockedCount: adblockPageCount,
      totalRequests: adblockTotalRequests,
      enabled: adblock.enabled,
      ready: adblockReady,
      filterCount: adblock.blockFilters.length
    });
  }
});
