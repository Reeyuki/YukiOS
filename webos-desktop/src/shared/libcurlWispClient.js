import { getWispUrl } from "./wispConfig.js";
import { createElement } from "./domUtils.js";
import { StorageKeys } from "../StorageKeys.js";

const scriptSources = [
  "https://cdn.jsdelivr.net/npm/libcurl.js@0.7.4/libcurl_full.js",
  "https://unpkg.com/libcurl.js@0.7.4/libcurl_full.js",
];

const textPattern = /text|html|xml|json|javascript|css|svg|csv|yaml|markdown/i;
const titlePattern = /<title[^>]*>([^<]*)<\/title>/i;
const binaryExtPattern =
  /\.(png|jpe?g|gif|webp|avif|ico|bmp|mp3|mp4|webm|ogg|wav|flac|pdf|zip|rar|7z|gz|exe|dmg|iso|woff2?|ttf|otf|eot)$/i;

let loadPromise = null;
let scriptAppended = false;
const sessionByUrl = new Map();

function getLibcurl() {
  try {
    const direct = globalThis ? globalThis.libcurl : undefined;
    if (direct) {
      return direct;
    }
  } catch (directErr) {
    void directErr;
  }
  try {
    const probed = (0, eval)(
      'typeof libcurl !== "undefined" ? libcurl : undefined',
    );
    if (probed) {
      return probed;
    }
  } catch (probeErr) {
    void probeErr;
  }
  return undefined;
}

function findLibcurlScripts() {
  try {
    return Array.from(document.querySelectorAll('script[src*="libcurl_full"]'));
  } catch (queryErr) {
    void queryErr;
    return [];
  }
}

function isTextResponse(mime, url) {
  const clean = String(mime || "").toLowerCase();
  if (!clean) {
    return binaryExtPattern.test(String(url || "")) === false;
  }
  return textPattern.test(clean);
}

function extractTitle(html) {
  try {
    const match = titlePattern.exec(String(html || ""));
    if (match && match[1]) {
      return match[1].trim().slice(0, 200);
    }
  } catch (err) {
    return "";
  }
  return "";
}

function buildRequestHeaders(options) {
  const headers = Object.assign({}, options.headers || {});
  if (options.range && !headers.Range && !headers.range) {
    headers.Range = options.range;
  }
  if (!headers["User-Agent"] && !headers["user-agent"]) {
    try {
      const stored =
        globalThis && globalThis.os && globalThis.os.storage
          ? globalThis.os.storage.get(StorageKeys.browserUserAgent)
          : "";
      if (stored) headers["User-Agent"] = String(stored);
    } catch (uaErr) {
      void uaErr;
    }
  }
  return headers;
}

function readContentType(response) {
  try {
    return response.headers ? response.headers.get("content-type") || "" : "";
  } catch (err) {
    return "";
  }
}

function readHeaderBag(response) {
  const bag = {};
  try {
    if (response.headers && response.headers.forEach) {
      response.headers.forEach((value, key) => {
        bag[String(key).toLowerCase()] = value;
      });
    }
  } catch (err) {
    return {};
  }
  return bag;
}

function throwForStatus(target, status) {
  if (status >= 400) {
    throw new Error("Request failed for " + target + " with status " + status);
  }
}

function injectScript(source) {
  return new Promise((resolve, reject) => {
    scriptAppended = true;
    const tag = createElement("script", {
      attributes: { src: source, crossorigin: "anonymous" },
    });
    tag.async = true;
    tag.onload = () => {
      if (!getLibcurl()) {
        try {
          tag.remove();
        } catch (removeErr) {
          void removeErr;
        }
        scriptAppended = false;
        reject(new Error("Networking engine missing after script load"));
        return;
      }
      resolve();
    };
    tag.onerror = () => {
      try {
        tag.remove();
      } catch (removeErr) {
        void removeErr;
      }
      if (!getLibcurl()) {
        scriptAppended = false;
      }
      reject(new Error("Script load failed for " + source));
    };
    document.head.appendChild(tag);
  });
}

function waitForScriptTag(tag) {
  return new Promise((resolve, reject) => {
    if (getLibcurl()) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      if (getLibcurl()) {
        resolve();
      } else {
        reject(new Error("Networking script timed out"));
      }
    }, 20000);
    tag.addEventListener(
      "load",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    tag.addEventListener(
      "error",
      () => {
        clearTimeout(timer);
        reject(new Error("Existing networking script failed to load"));
      },
      { once: true },
    );
  });
}

function ensureLibcurlLoaded() {
  const current = getLibcurl();
  if (current && current.ready) {
    return Promise.resolve(current);
  }
  if (loadPromise) {
    return loadPromise;
  }
  loadPromise = (async () => {
    if (!getLibcurl()) {
      const existingScripts = findLibcurlScripts();
      const foundScript =
        existingScripts.length > 0 ? existingScripts[0] : null;
      if (foundScript) {
        scriptAppended = true;
        try {
          await waitForScriptTag(foundScript);
        } catch (err) {
          if (!getLibcurl()) {
            const remaining = findLibcurlScripts();
            for (let index = 0; index < remaining.length; index++) {
              try {
                remaining[index].remove();
              } catch (removeErr) {
                void removeErr;
              }
            }
            scriptAppended = false;
            throw err;
          }
        }
      }
    }
    if (!getLibcurl() && !scriptAppended) {
      let lastError = null;
      for (let i = 0; i < scriptSources.length; i++) {
        if (getLibcurl() || scriptAppended || findLibcurlScripts().length > 0) {
          break;
        }
        try {
          await injectScript(scriptSources[i]);
        } catch (err) {
          lastError = err;
          if (getLibcurl()) {
            break;
          }
        }
      }
      if (!getLibcurl()) {
        throw (
          lastError ||
          new Error("Networking engine failed to load from all sources")
        );
      }
    }
    const lib = getLibcurl();
    if (!lib) {
      throw new Error("Networking engine unavailable after load");
    }
    if (!lib.ready && typeof lib.load_wasm === "function") {
      await lib.load_wasm();
    }
    return lib;
  })();
  const pending = loadPromise;
  pending.catch(() => {
    if (loadPromise === pending) {
      loadPromise = null;
    }
  });
  return pending;
}

async function ensureSession(wispUrl) {
  const active = wispUrl || getWispUrl();
  const lib = await ensureLibcurlLoaded();
  try {
    lib.set_websocket(active);
  } catch (err) {
    throw new Error(
      "Tunnel setup failed for " +
        active +
        ": " +
        (err && err.message ? err.message : String(err)),
    );
  }
  const cached = sessionByUrl.get(active);
  if (cached) {
    return cached;
  }
  let session = null;
  try {
    session = new lib.HTTPSession();
  } catch (err) {
    throw new Error(
      "Session create failed: " +
        (err && err.message ? err.message : String(err)),
    );
  }
  sessionByUrl.set(active, session);
  return session;
}

async function runSessionFetch(target, wispUrl, options) {
  const session = await ensureSession(wispUrl);
  try {
    return await session.fetch(target, {
      method: options.method || "GET",
      headers: buildRequestHeaders(options),
      redirect: "follow",
    });
  } catch (err) {
    sessionByUrl.delete(wispUrl);
    throw new Error(
      "Page load failed for " +
        target +
        ": " +
        (err && err.message ? err.message : String(err)),
    );
  }
}

export async function fetchViaWisp(url, options = {}) {
  const target = String(url || "").trim();
  if (!target) {
    throw new Error("fetchViaWisp requires a URL");
  }
  if (!/^https?:\/\//i.test(target)) {
    throw new Error("fetchViaWisp handles web addresses only: " + target);
  }
  const wispUrl = options.wispUrl || getWispUrl();
  const response = await runSessionFetch(target, wispUrl, options);
  const status = response.status || 0;
  throwForStatus(target, status);
  const contentType = readContentType(response);
  const mime = String(contentType || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (isTextResponse(mime, target)) {
    let text = "";
    try {
      text = await response.text();
    } catch (err) {
      throw new Error(
        "Page read failed for " +
          target +
          ": " +
          (err && err.message ? err.message : String(err)),
      );
    }
    return {
      status,
      contentType: mime,
      text,
      blobUrl: null,
      title: extractTitle(text) || target,
    };
  }
  let blobUrl = null;
  try {
    const buffer = await response.arrayBuffer();
    const blob = new Blob([buffer], {
      type: mime || "application/octet-stream",
    });
    blobUrl = URL.createObjectURL(blob);
  } catch (err) {
    throw new Error(
      "Binary read failed for " +
        target +
        ": " +
        (err && err.message ? err.message : String(err)),
    );
  }
  return {
    status,
    contentType: mime,
    text: null,
    blobUrl,
    title: target,
  };
}

export async function fetchViaWispRaw(url, options = {}) {
  const target = String(url || "").trim();
  if (!target) {
    throw new Error("fetchViaWispRaw requires a URL");
  }
  if (!/^https?:\/\//i.test(target)) {
    throw new Error("fetchViaWispRaw handles web addresses only: " + target);
  }
  const wispUrl = options.wispUrl || getWispUrl();
  const response = await runSessionFetch(target, wispUrl, options);
  const status = response.status || 0;
  throwForStatus(target, status);
  const contentType = readContentType(response);
  const mime = String(contentType || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  let buffer = null;
  try {
    buffer = await response.arrayBuffer();
  } catch (err) {
    throw new Error(
      "Binary read failed for " +
        target +
        ": " +
        (err && err.message ? err.message : String(err)),
    );
  }
  return {
    status,
    contentType: mime,
    headers: readHeaderBag(response),
    buffer,
  };
}

export function resetWispSessions() {
  sessionByUrl.clear();
}
