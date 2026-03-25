let pageLoadTime = Date.now();

const CLOSE_ANALYTICS_EXCLUDED_APPS = new Set(["aboutApp"]);

export function initAnalytics() {
  pageLoadTime = Date.now();
  sendAnalytics({ ...getAnalyticsBase("hit-page"), event: "start" });
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
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") return;
  fetch("https://analytics.liventcord-a60.workers.dev/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).catch((err) => console.warn("Analytics failed:", err));
}

export function sendLaunchAnalytics(app) {
  sendAnalytics({ ...getAnalyticsBase(app), event: "launch" });
}

export function sendAppInstallAnalytics(app) {
  sendAnalytics({ ...getAnalyticsBase(app ?? "unknown"), event: "installApp" });
}

export function recordUsage(winId) {
  const startTime = Date.now();
  const win = document.getElementById(winId);
  if (!win) return;

  const appId = win.dataset.appId || "";

  if (CLOSE_ANALYTICS_EXCLUDED_APPS.has(appId)) return;

  let sent = false;

  const sendUsage = () => {
    if (sent) return;
    sent = true;
    sendAnalytics({
      app: appId,
      event: "usage",
      durationMs: Date.now() - startTime,
      timestamp: Date.now(),
      sessionAgeMs: Date.now() - pageLoadTime
    });
  };

  win.querySelector(".close-btn")?.addEventListener("click", sendUsage);
}
