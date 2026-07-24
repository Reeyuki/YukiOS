import { os } from "./framework.js";

const ANALYTICS_QUEUE_KEY = "yuki_analytics_queue";
const ENDPOINT_BASE = "https://analytics.liventcord-a60.workers.dev";
const ENDPOINT = ENDPOINT_BASE + "/analytics";
const hostname = window.location.hostname;
const ANALYTICS_DISABLED = () =>
  os.storage.get(StorageKeys.analyticsDisabled) === "true";
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
    name: document.querySelector(".start-user span")?.textContent ?? "",
    timestamp: now,
    sessionAgeMs: now - pageLoadTime
  };
}

function loadQueue() {
  if (ANALYTICS_DISABLED) return [];
  try {
    return os.storage.get(ANALYTICS_QUEUE_KEY) || [];
  } catch {
    return [];
  }
}

function saveQueue(q) {
  if (ANALYTICS_DISABLED) return;
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
  if (ANALYTICS_DISABLED) return;
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
  if (ANALYTICS_DISABLED) return;
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
  if (ANALYTICS_DISABLED) return;
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
  if (ANALYTICS_DISABLED) return;
  if (shouldExcludeFromAnalytics(app)) return;
  queueEvent({
    app,
    event: "launch",
    timestamp: Date.now(),
    sessionAgeMs: Date.now() - pageLoadTime
  });
}

export function recordUsage(winId) {
  if (ANALYTICS_DISABLED) return;
  const start = Date.now();
  const win = document.getElementById(winId);
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

export async function fetchGamePlayCounts() {
  if (ANALYTICS_DISABLED) {
    console.error("Analytics disabled, skipping gameplay count fetch");
    return {};
  }
  if (cachedPlayCounts) return cachedPlayCounts;
  if (playCountsPromise) return playCountsPromise;

  playCountsPromise = (async () => {
    try {
      const res = await fetch(ENDPOINT_BASE + "/api/game-play-counts");
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
      const res = await fetch(ENDPOINT_BASE + "/live");
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
