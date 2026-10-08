import { os, StorageKeys } from "../framework.js";
import {
  fetchViaWisp,
  fetchViaWispRaw,
  resetWispSessions,
} from "./libcurlWispClient.js";
import { fetchThroughWisp, resetWispTransport } from "./wispTransport.js";

const textPattern = /text|html|xml|json|javascript|css|svg|csv|yaml|markdown/i;
const titlePattern = /<title[^>]*>([^<]*)<\/title>/i;

export function getActiveTransport() {
  try {
    const stored = os.storage.get(StorageKeys.browserTransport);
    if (stored === "epoxy" || stored === "libcurl") {
      return stored;
    }
  } catch (err) {
    void err;
  }
  return "libcurl";
}

function extractTitle(html, fallback) {
  try {
    const match = titlePattern.exec(String(html || ""));
    if (match && match[1]) {
      const title = match[1].trim().slice(0, 200);
      if (title) {
        return title;
      }
    }
  } catch (err) {
    void err;
  }
  return fallback;
}

function readMime(response) {
  try {
    const rawType = response.headers.get("content-type") || "";
    return String(rawType).split(";")[0].trim().toLowerCase();
  } catch (err) {
    void err;
  }
  return "";
}

function buildForwarded(options) {
  return {
    method: options.method,
    headers: options.headers,
    range: options.range,
    wispUrl: options.wispUrl,
  };
}

function buildEpoxyOptions(options) {
  const headers = Object.assign({}, options.headers);
  if (options.range && !headers.Range && !headers.range) {
    headers.Range = options.range;
  }
  return {
    method: options.method || "GET",
    headers,
    wispUrl: options.wispUrl,
  };
}

export async function fetchPage(target, opts = {}) {
  const options = opts || {};
  if (getActiveTransport() !== "epoxy") {
    return fetchViaWisp(target, buildForwarded(options));
  }
  const response = await fetchThroughWisp(target, buildEpoxyOptions(options));
  const status = response.status || 0;
  const mime = readMime(response);
  if (!mime || textPattern.test(mime)) {
    const text = await response.text();
    return {
      status,
      contentType: mime,
      text,
      blobUrl: null,
      title: extractTitle(text, target),
    };
  }
  const buffer = await response.arrayBuffer();
  const blob = new Blob([buffer], { type: mime || "application/octet-stream" });
  return {
    status,
    contentType: mime,
    text: null,
    blobUrl: URL.createObjectURL(blob),
    title: target,
  };
}

export async function fetchRaw(target, opts = {}) {
  const options = opts || {};
  if (getActiveTransport() !== "epoxy") {
    return fetchViaWispRaw(target, buildForwarded(options));
  }
  const response = await fetchThroughWisp(target, buildEpoxyOptions(options));
  const buffer = await response.arrayBuffer();
  const bag = {};
  try {
    response.headers.forEach((value, key) => {
      bag[String(key).toLowerCase()] = value;
    });
  } catch (err) {
    void err;
  }
  return {
    status: response.status || 0,
    contentType: readMime(response),
    headers: bag,
    buffer,
  };
}

export function resetTransports() {
  try {
    resetWispSessions();
  } catch (sessionErr) {
    void sessionErr;
  }
  try {
    resetWispTransport();
  } catch (transportErr) {
    void transportErr;
  }
}

export function checkWispHealth(url, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const started = Date.now();
    let socket = null;
    try {
      socket = new WebSocket(url);
    } catch (err) {
      resolve({
        ok: false,
        error: err && err.message ? err.message : String(err),
      });
      return;
    }
    const finish = (result) => {
      clearTimeout(timer);
      try {
        socket.close();
      } catch (closeErr) {
        void closeErr;
      }
      resolve(result);
    };
    const timer = setTimeout(() => {
      finish({ ok: false, error: "connection timed out" });
    }, timeoutMs);
    socket.onopen = () => {
      finish({ ok: true, ms: Date.now() - started });
    };
    socket.onerror = () => {
      finish({ ok: false, error: "connection failed" });
    };
  });
}
