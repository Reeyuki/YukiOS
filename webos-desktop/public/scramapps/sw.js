try {
  importScripts("./controller.sw.js");
} catch (e) {
  console.error("Failed to load controller.sw.js:", e);
  throw e;
}

const { route, shouldRoute } = $scramjetController;

addEventListener("fetch", (event) => {
  if (shouldRoute(event)) {
    event.respondWith(route(event));
  }
});
