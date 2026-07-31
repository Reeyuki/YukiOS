import "../styles/liveStats.css";
import { appMap } from "../games/gamesList.js";
import { resolveAppName, resolveAppIcon, escapeHtml } from "../utils/utils.js";
import { resolveIconUrl } from "./assetResolver.js";
import { $$, bindEvent } from "./domUtils.js";

export function renderLiveStats(stats, target, options = {}) {
  if (!target) return;

  const clickable = typeof options.onAppClick === "function";

  if (!stats) {
    target.innerHTML = `<div class="live-stats-message">Could not load live stats.</div>`;
    return;
  }

  const appLookup = new Map();
  for (const [key, val] of Object.entries(appMap)) {
    appLookup.set(key.toLowerCase(), { id: key, ...val });
  }

  const renderAppIcon = (appId) => {
    const entry = appLookup.get(appId.toLowerCase());
    const icon = entry?.icon || resolveAppIcon(appId);
    if (!icon) return `<span class="live-stats-icon"><i class="fas fa-gamepad"></i></span>`;
    if (typeof icon === "string" && icon.startsWith("fa")) {
      return `<span class="live-stats-icon"><i class="${icon}"></i></span>`;
    }
    return `<span class="live-stats-icon"><img src="${resolveIconUrl(icon)}" alt="" /></span>`;
  };

  const topApps = (stats.top_active_apps || []).slice(0, 5);
  const trendingHtml = topApps.length
    ? topApps
        .map(
          ({ app, count }) => `
      <div class="live-stats-item${clickable ? " live-stats-item--clickable" : ""}"${clickable ? ` data-app="${escapeHtml(app)}"` : ""}>
        ${renderAppIcon(app)}
        <span class="live-stats-name">${escapeHtml(resolveAppName(app))}</span>
        <span class="live-stats-count">${count}</span>
      </div>`
        )
        .join("")
    : `<div class="live-stats-message">No trending data right now</div>`;

  const showStats = options.showStats !== false;
  const statsCardsHtml = showStats
    ? `
    <div class="live-stats-stats">
      <div class="live-stats-stat">
        <div class="live-stats-stat-value">${stats.active_users_5min}</div>
        <div class="live-stats-stat-label">Active Users</div>
      </div>
      <div class="live-stats-stat">
        <div class="live-stats-stat-value">${stats.active_sessions}</div>
        <div class="live-stats-stat-label">Active Sessions</div>
      </div>
    </div>`
    : "";

  target.innerHTML = `
    ${statsCardsHtml}
    <div class="live-stats-heading">Trending Now</div>
    <div class="live-stats-list">
      ${trendingHtml}
    </div>
  `;

  if (clickable) {
    $$(".live-stats-item--clickable", target).forEach((item) => {
      bindEvent(item, "click", () => {
        const appId = item.dataset.app;
        if (appId) options.onAppClick(appId);
      });
    });
  }
}
