import { StorageKeys } from "./settings.js";

let pageLoadTime = Date.now();

const CLOSE_ANALYTICS_EXCLUDED_APPS = new Set(["aboutApp"]);
const CUSTOM_APP_PREFIX = "custom-";
const ANALYTICS_DISABLED_KEY = StorageKeys.analyticsDisabled;

function isAnalyticsDisabled() {
  return localStorage.getItem(ANALYTICS_DISABLED_KEY) === "true";
}

function shouldIgnoreApp(app) {
  if (!app) return false;
  return CLOSE_ANALYTICS_EXCLUDED_APPS.has(app) || app.startsWith(CUSTOM_APP_PREFIX);
}

function isBlocked(app) {
  if (isAnalyticsDisabled()) return true;
  if (shouldIgnoreApp(app)) return true;
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") return true;
  return false;
}

export function initAnalytics() {
  pageLoadTime = Date.now();
  const base = getAnalyticsBase("hit-page");
  if (isBlocked(base.app)) return;
  sendAnalytics({ ...base, event: "start" });
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

export function sendAnalytics(data) {
  if (isBlocked(data?.app)) return;

  if (window.AdsManager?.analyticsHook) {
    window.AdsManager.analyticsHook(data);
  }

  fetch("https://analytics.liventcord-a60.workers.dev/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).catch(() => {});
}

export function sendLaunchAnalytics(app) {
  if (isBlocked(app)) return;

  const data = { ...getAnalyticsBase(app), event: "launch" };

  if (window.AdsManager?.analyticsHook) {
    window.AdsManager.analyticsHook(data);
  }

  sendAnalytics(data);
}

export function recordUsage(winId) {
  const startTime = Date.now();
  const win = document.getElementById(winId);
  if (!win) return;

  const appId = win.dataset.appId || "";
  if (isBlocked(appId)) return;

  let sent = false;

  const sendUsage = () => {
    if (sent) return;
    sent = true;

    const payload = {
      app: appId,
      event: "usage",
      durationMs: Date.now() - startTime,
      timestamp: Date.now(),
      sessionAgeMs: Date.now() - pageLoadTime
    };

    if (window.AdsManager?.analyticsHook) {
      window.AdsManager.analyticsHook(payload);
    }

    sendAnalytics(payload);
  };

  win.querySelector(".close-btn")?.addEventListener("click", sendUsage);
}
