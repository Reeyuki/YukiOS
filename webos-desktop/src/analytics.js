import { os, $ } from "./framework.js";
import { StorageKeys } from "./StorageKeys.js";
import { getLiveUserId, ensureLiveUserId } from "./social/userIdentity.js";
import { SOCIAL_BASE } from "./social/endpoints.js";

const ANALYTICS_QUEUE_KEY = StorageKeys.analyticsQueue;
import { parseBool } from "./utils/utils.js";

const ENDPOINT = SOCIAL_BASE + "/analytics";
const DOWNLOAD_ENDPOINT = SOCIAL_BASE + "/api/download";
const ELECTRON_USAGE_ENDPOINT = SOCIAL_BASE + "/api/electron-usage";
const hostname = window.location.hostname;
const ANALYTICS_DISABLED = () => parseBool(os.storage.get(StorageKeys.analyticsDisabled));
const FLUSH_INTERVAL_MS = 30000;
const MAX_QUEUE_SIZE = 15;

let cachedPlayCounts = null;
let playCountsPromise = null;

const LIVE_STATS_TTL_MS = 5 * 60 * 1000;
let cachedLiveStats = null;
let liveStatsCacheTime = 0;
let liveStatsPromise = null;

let pageLoadTime = Date.now();
let flushTimer = null;

function shouldExcludeFromAnalytics(app) {
  return app?.startsWith("custom-");
}

export function getAnalyticsBase(app) {
  const now = Date.now();
  return {
    app: app ?? "unknown",
    name: $(".start-user span")?.textContent ?? "",
    timestamp: now,
    sessionAgeMs: now - pageLoadTime
  };
}

function loadQueue() {
  if (ANALYTICS_DISABLED()) return [];
  try {
    return os.storage.get(ANALYTICS_QUEUE_KEY) || [];
  } catch {
    return [];
  }
}

function saveQueue(q) {
  if (ANALYTICS_DISABLED()) return;
  os.storage.set(ANALYTICS_QUEUE_KEY, q);
}

function sendBatch(events) {
  if (!events.length) return;
  const payload = JSON.stringify(events);
  const sent = navigator.sendBeacon ? navigator.sendBeacon(ENDPOINT, payload) : false;
  if (!sent) {
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload
    }).catch(() => {});
  }
}

function flushQueue() {
  if (ANALYTICS_DISABLED()) return;
  const queue = loadQueue();
  if (!queue.length) return;
  os.storage.remove(ANALYTICS_QUEUE_KEY);
  sendBatch(queue);
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushQueue();
  }, FLUSH_INTERVAL_MS);
}

function queueEvent(event) {
  if (ANALYTICS_DISABLED()) return;
  const userId = getLiveUserId();
  if (userId) event.userId = userId;
  const queue = loadQueue();
  queue.push(event);
  if (queue.length >= MAX_QUEUE_SIZE) {
    os.storage.remove(ANALYTICS_QUEUE_KEY);
    sendBatch(queue);
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
  } else {
    saveQueue(queue);
    scheduleFlush();
  }
}

export function initAnalytics() {
  if (ANALYTICS_DISABLED()) return;
  ensureLiveUserId().catch(() => {});
  pageLoadTime = Date.now();
  flushQueue();
  queueEvent({
    app: "hit-page",
    event: "start",
    timestamp: Date.now(),
    sessionAgeMs: 0
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushQueue();
  });
  window.addEventListener("pagehide", flushQueue);
}

export function sendLaunchAnalytics(app) {
  if (ANALYTICS_DISABLED()) return;
  if (shouldExcludeFromAnalytics(app)) return;
  queueEvent({
    app,
    event: "launch",
    timestamp: Date.now(),
    sessionAgeMs: Date.now() - pageLoadTime
  });
}

export function recordUsage(winId) {
  if (ANALYTICS_DISABLED()) return;
  const start = Date.now();
  const win = $("#" + winId);
  if (!win) return;
  const appId = win.dataset.appId;
  if (shouldExcludeFromAnalytics(appId)) return;
  let sent = false;
  const send = () => {
    if (sent) return;
    sent = true;
    queueEvent({
      app: appId,
      event: "usage",
      durationMs: Date.now() - start,
      timestamp: Date.now(),
      sessionAgeMs: Date.now() - pageLoadTime
    });
  };
  win.querySelector(".close-btn")?.addEventListener("click", send);
}

export function recordUsageDuration(appId, durationMs) {
  if (ANALYTICS_DISABLED()) return;
  if (!appId || shouldExcludeFromAnalytics(appId)) return;
  queueEvent({
    app: appId,
    event: "usage",
    durationMs: Math.max(1000, Number(durationMs) || 0),
    timestamp: Date.now(),
    sessionAgeMs: Date.now() - pageLoadTime
  });
}

export async function fetchGamePlayCounts() {
  if (ANALYTICS_DISABLED()) {
    console.error("Analytics disabled, skipping gameplay count fetch");
    return {};
  }
  if (cachedPlayCounts) return cachedPlayCounts;
  if (playCountsPromise) return playCountsPromise;

  playCountsPromise = (async () => {
    try {
      const res = await fetch(SOCIAL_BASE + "/api/game-play-counts");
      if (!res.ok) return {};
      const data = await res.json();
      cachedPlayCounts = data;
      return data;
    } catch {
      return {};
    }
  })();

  return playCountsPromise;
}

export function getCachedPlayCounts() {
  return cachedPlayCounts || {};
}

export async function fetchLiveStats() {
  if (ANALYTICS_DISABLED()) return null;
  const now = Date.now();
  if (cachedLiveStats && now - liveStatsCacheTime < LIVE_STATS_TTL_MS) return cachedLiveStats;
  if (liveStatsPromise) return liveStatsPromise;
  liveStatsPromise = (async () => {
    try {
      const res = await fetch(SOCIAL_BASE + "/live");
      if (!res.ok) return null;
      const data = await res.json();
      cachedLiveStats = data;
      liveStatsCacheTime = Date.now();
      return data;
    } catch {
      return null;
    } finally {
      liveStatsPromise = null;
    }
  })();
  return liveStatsPromise;
}

export function trackDownload(event) {
  if (ANALYTICS_DISABLED()) return;
  if (!event || !event.fileName) return;
  const payload = {
    app: event.app || "unknown",
    fileName: event.fileName,
    fileSize: typeof event.fileSize === "number" ? event.fileSize : 0,
    fileType: event.fileType || "",
    source: event.source || "browser",
    timestamp: Date.now()
  };
  const body = JSON.stringify([payload]);
  const sent = navigator.sendBeacon ? navigator.sendBeacon(DOWNLOAD_ENDPOINT, body) : false;
  if (!sent) {
    fetch(DOWNLOAD_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    }).catch(() => {});
  }
}

export function trackElectronUsage(event) {
  if (ANALYTICS_DISABLED()) return;
  if (!event || !event.action) return;
  const payload = {
    action: event.action,
    platform: event.platform || "",
    version: event.version || "",
    details: event.details || "",
    isDev: !!event.isDev,
    timestamp: Date.now()
  };
  const body = JSON.stringify([payload]);
  const sent = navigator.sendBeacon ? navigator.sendBeacon(ELECTRON_USAGE_ENDPOINT, body) : false;
  if (!sent) {
    fetch(ELECTRON_USAGE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    }).catch(() => {});
  }
}

export function trackElectronUsageFromMain(event) {
  if (!event || !event.action) return;
  const payload = {
    action: event.action,
    platform: event.platform || "",
    version: event.version || "",
    details: event.details || "",
    isDev: !!event.isDev,
    timestamp: Date.now()
  };
  const body = JSON.stringify([payload]);
  fetch(ELECTRON_USAGE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body
  }).catch(() => {});
}
