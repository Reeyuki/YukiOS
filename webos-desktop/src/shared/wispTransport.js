import { getWispUrl, WISP_SERVERS, DEFAULT_WISP_URL } from "./wispConfig.js";

let transportPromise = null;

function sanitizeWispUrl(url) {
  if (typeof url === "string" && url.length > 0) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "ws:" || parsed.protocol === "wss:") {
        return url;
      }
    } catch (error) {
      return DEFAULT_WISP_URL;
    }
  }
  return DEFAULT_WISP_URL;
}

function probeTransport(rawTransport, timeoutMs = 10000) {
  const probe = new Promise((resolve) => {
    try {
      rawTransport
        .request(new URL("https://example.com/"), "GET", null, [], new AbortController().signal)
        .then(() => resolve({ ok: true }))
        .catch((error) => resolve({ ok: false, error: String((error && error.message) || error) }));
    } catch (error) {
      resolve({ ok: false, error: String((error && error.message) || error) });
    }
  });
  const deadline = new Promise((resolve) => setTimeout(() => resolve({ ok: false, error: "timed out" }), timeoutMs));
  return Promise.race([probe, deadline]);
}

async function loadEpoxyTransport() {
  const module = await import("https://cdn.jsdelivr.net/npm/@mercuryworkshop/epoxy-transport@3.0.1/dist/index.mjs");
  return module.default;
}

async function establishTransport() {
  const TransportClass = await loadEpoxyTransport();
  const candidates = [];
  const initial = [getWispUrl(), DEFAULT_WISP_URL];
  for (const url of initial) {
    const clean = sanitizeWispUrl(url);
    if (candidates.indexOf(clean) === -1) {
      candidates.push(clean);
    }
  }
  for (const entry of WISP_SERVERS) {
    const clean = sanitizeWispUrl(entry.url);
    if (candidates.indexOf(clean) === -1) {
      candidates.push(clean);
    }
  }
  for (const wispUrl of candidates) {
    try {
      const rawTransport = new TransportClass({ wisp: wispUrl });
      await rawTransport.init();
      const probeResult = await probeTransport(rawTransport, 10000);
      if (probeResult.ok) {
        return rawTransport;
      }
    } catch (error) {
      continue;
    }
  }
  return null;
}

async function getWispTransport() {
  if (!transportPromise) transportPromise = establishTransport();
  return transportPromise;
}

export async function fetchThroughWisp(url, options = {}) {
  const rawTransport = await getWispTransport();
  if (!rawTransport) throw new Error("No WISP transport available");
  const headersArr = options.headers ? Object.entries(options.headers) : [];
  let body = options.body || null;
  if (typeof body === "string") body = new TextEncoder().encode(body);
  const res = await rawTransport.request(new URL(url), options.method || "GET", body, headersArr, new AbortController().signal);
  const headers = new Headers();
  if (Array.isArray(res.headers)) {
    for (const pair of res.headers) {
      headers.append(pair[0], pair[1]);
    }
  } else if (res.headers && typeof res.headers === "object") {
    for (const [key, value] of Object.entries(res.headers)) {
      headers.append(key, value);
    }
  }
  return new Response(res.body, { status: res.status || 200, statusText: res.statusText || "", headers });
}

export { getWispTransport, probeTransport };