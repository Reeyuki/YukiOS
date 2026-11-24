import { os, StorageKeys } from "../framework.js";

export const DEFAULT_WISP_URL =
  "wss://hurt-agata-liventcord-api-7072e9a6.koyeb.app/";

export const WISP_SERVERS = [
  { name: "Reeyuki Wisp", url: DEFAULT_WISP_URL },
  { name: "Mercury Wisp", url: "wss://wisp.mercurywork.shop/" },
];

const RETIRED_WISP_URLS = [
  "wss://reeyukiwisp.onrender.com/",
  "wss://racialequityleadership.com/ws?reconnect=1",
];

export const EPOXY_ONLY_WISP_URLS = [
  "wss://racialequityleadership.com/ws?reconnect=1",
];

export function isEpoxyOnlyWisp(url) {
  return EPOXY_ONLY_WISP_URLS.indexOf(String(url || "").trim()) !== -1;
}

export function getWispUrl() {
  let stored = os.storage.get(StorageKeys.wispServer);
  if (
    stored &&
    !stored.includes("?") &&
    !stored.includes("#") &&
    !stored.endsWith("/")
  ) {
    stored += "/";
  }
  if (!stored || RETIRED_WISP_URLS.indexOf(stored) !== -1) {
    stored = DEFAULT_WISP_URL;
    os.storage.set(StorageKeys.wispServer, stored);
  }
  return stored;
}

export function sanitizeWispUrlCandidate(url) {
  if (typeof url !== "string") {
    return "";
  }
  const trimmed = url.trim();
  if (!trimmed) {
    return "";
  }
  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol === "ws:" || protocol === "wss:") {
      return trimmed;
    }
  } catch {
    return "";
  }
  return "";
}

export function getWispCandidates(preferredUrl) {
  try {
    const candidates = [];
    const seen = new Set();
    const pushCandidate = (value) => {
      const cleaned = sanitizeWispUrlCandidate(value);
      if (!cleaned) {
        return;
      }
      if (RETIRED_WISP_URLS.indexOf(cleaned) !== -1) {
        return;
      }
      if (seen.has(cleaned)) {
        return;
      }
      seen.add(cleaned);
      candidates.push(cleaned);
    };
    pushCandidate(preferredUrl);
    pushCandidate(os.storage.get(StorageKeys.wispServer));
    pushCandidate(DEFAULT_WISP_URL);
    for (const entry of WISP_SERVERS) {
      pushCandidate(entry.url);
    }
    const customList = os.storage.get(StorageKeys.browserCustomWisps);
    if (Array.isArray(customList)) {
      for (const item of customList) {
        if (typeof item === "string") {
          pushCandidate(item);
        } else if (item && typeof item.url === "string") {
          pushCandidate(item.url);
        }
      }
    }
    if (candidates.length === 0) {
      return [DEFAULT_WISP_URL];
    }
    return candidates;
  } catch {
    return [DEFAULT_WISP_URL];
  }
}
