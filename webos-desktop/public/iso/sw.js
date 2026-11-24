const ISOLATED_SCOPE = "/iso/";
const ALLOWED_HOSTS = new Set([
  "angry-webports.pages.dev",
  "katana-zero-webport.pages.dev",
  "sonic-triple-trouble-16-bit-webport.pages.dev",
]);
const DROPPED_HEADERS = [
  "content-encoding",
  "content-length",
  "cross-origin-opener-policy",
];
const ISOLATION_HEADERS = {
  "Document-Isolation-Policy": "isolate-and-credentialless",
  "Cross-Origin-Embedder-Policy": "credentialless",
  "Cross-Origin-Resource-Policy": "cross-origin",
};

function resolveTarget(requestUrl) {
  const url = new URL(requestUrl);
  if (url.origin !== location.origin) return null;
  if (!url.pathname.startsWith(ISOLATED_SCOPE)) return null;
  const path = url.pathname.slice(ISOLATED_SCOPE.length);
  const slash = path.indexOf("/");
  if (slash === -1) return null;
  const host = path.slice(0, slash);
  if (!ALLOWED_HOSTS.has(host)) return null;
  return `https://${host}${path.slice(slash)}${url.search}`;
}

async function fetchIsolated(request, target) {
  const requestHeaders = new Headers();
  const range = request.headers.get("range");
  if (range) requestHeaders.set("range", range);
  const upstream = await fetch(target, {
    method: request.method,
    headers: requestHeaders,
    credentials: "omit",
  });
  const headers = new Headers(upstream.headers);
  DROPPED_HEADERS.forEach((name) => headers.delete(name));
  Object.entries(ISOLATION_HEADERS).forEach(([name, value]) =>
    headers.set(name, value),
  );
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

addEventListener("install", () => skipWaiting());
addEventListener("activate", (event) => event.waitUntil(clients.claim()));
addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" && request.method !== "HEAD") return;
  const target = resolveTarget(request.url);
  if (target) event.respondWith(fetchIsolated(request, target));
});
