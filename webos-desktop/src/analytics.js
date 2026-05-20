const ANALYTICS_QUEUE_KEY = "yuki_analytics_queue";
const ENDPOINT = "https://analytics.liventcord-a60.workers.dev/analytics";

const hostname = window.location.hostname;
const ANALYTICS_DISABLED = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";

let pageLoadTime = Date.now();

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
    return JSON.parse(localStorage.getItem(ANALYTICS_QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveQueue(q) {
  if (ANALYTICS_DISABLED) return;
  localStorage.setItem(ANALYTICS_QUEUE_KEY, JSON.stringify(q));
}

function flushQueue() {
  if (ANALYTICS_DISABLED) return;

  const queue = loadQueue();
  if (queue.length === 0) return;

  const payload = JSON.stringify(queue);

  const sent = navigator.sendBeacon ? navigator.sendBeacon(ENDPOINT, payload) : false;

  if (sent) {
    localStorage.removeItem(ANALYTICS_QUEUE_KEY);
    return;
  }

  fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload
  })
    .then(() => {
      localStorage.removeItem(ANALYTICS_QUEUE_KEY);
    })
    .catch(() => {});
}

function queueEvent(event) {
  if (ANALYTICS_DISABLED) return;

  const queue = loadQueue();
  queue.push(event);
  saveQueue(queue);

  const single = JSON.stringify(event);

  const sent = navigator.sendBeacon ? navigator.sendBeacon(ENDPOINT, single) : false;

  if (!sent) {
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: single
    }).catch(() => {});
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
}

export function sendLaunchAnalytics(app) {
  if (ANALYTICS_DISABLED) return;

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
