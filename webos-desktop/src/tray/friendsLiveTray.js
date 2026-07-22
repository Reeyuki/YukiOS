import { StorageKeys, os } from "../framework.js";
import { resolveAppName } from "../shared/appNameResolver.js";
import { appMap } from "../games/gamesList.js";
import { fetchLiveStats } from "../analytics.js";
import { resolveIconUrl } from "../shared/assetResolver.js";
import { $, setHTML, bindEvent, toggleClass, createElement } from "../shared/domUtils.js";
import { getTrayPosition } from "./tray.js";

class FriendsLiveTray {
  constructor() {
    this.panel = null;
    this.isOpen = false;
    this.updateTimer = null;
  }

  init() {
    const winId = "friends-live-tray";
    os.tray.register(winId, "fas fa-user-friends", "Live Activity", {
      showInTray: true,
      residence: false,
      priority: 3,
      onClick: () => this.toggle()
    });
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }

    this.panel = createElement("div", {
      id: "friends-live-panel",
      className: "friends-live-panel"
    });

    const pos = getTrayPosition();
    Object.assign(this.panel.style, {
      position: "fixed",
      right: pos.right,
      top: pos.top,
      bottom: pos.bottom,
      width: "310px",
      maxHeight: "calc(100vh - 120px)",
      background: "rgba(20, 20, 25, 0.75)",
      backdropFilter: "blur(25px) saturate(180%)",
      border: "1px solid rgba(255, 255, 255, 0.08)",
      borderRadius: "16px",
      boxShadow: "0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05) inset",
      display: "flex",
      flexDirection: "column",
      zIndex: "100001",
      opacity: "0",
      transform: "translateY(20px) scale(0.96)",
      transition: "opacity 0.3s cubic-bezier(0.16,1,0.3,1), transform 0.3s cubic-bezier(0.16,1,0.3,1)",
      pointerEvents: "none"
    });

    this.panel.innerHTML = `
      <div style="padding:15px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:13px;font-weight:700;color:var(--text-primary);">
          <i class="fas fa-user-friends" style="margin-right:8px;color:var(--brand);"></i>Live Activity
        </span>
        <button class="friends-live-close" style="background:none;border:none;color:var(--text-secondary);font-size:16px;cursor:pointer;padding:4px;">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="friends-live-content" style="flex:1;overflow-y:auto;padding:12px 15px;">
        <div style="color:var(--text-secondary);font-size:12px;text-align:center;padding-top:24px;">Loading...</div>
      </div>
    `;

    document.body.appendChild(this.panel);

    bindEvent(this.panel.querySelector(".friends-live-close"), "click", () => this.close());

    requestAnimationFrame(() => {
      this.panel.style.opacity = "1";
      this.panel.style.transform = "translateY(0) scale(1)";
      this.panel.style.pointerEvents = "auto";
    });

    this.isOpen = true;
    this.loadContent();
    this.updateTimer = setInterval(() => this.loadContent(), 30000);
  }

  close() {
    if (!this.panel) return;
    this.panel.style.opacity = "0";
    this.panel.style.transform = "translateY(20px) scale(0.96)";
    this.panel.style.pointerEvents = "none";
    setTimeout(() => {
      if (this.panel) {
        this.panel.remove();
        this.panel = null;
      }
    }, 300);
    this.isOpen = false;
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  async loadContent() {
    const content = this.panel?.querySelector(".friends-live-content");
    if (!content) return;

    const stats = await fetchLiveStats();
    if (!this.panel) return;

    if (!stats) {
      setHTML(
        content,
        `<div style="color:var(--text-secondary);font-size:12px;text-align:center;padding-top:24px;">Could not load live stats.</div>`
      );
      return;
    }

    const appLookup = new Map();
    for (const [key, val] of Object.entries(appMap)) {
      appLookup.set(key.toLowerCase(), { id: key, ...val });
    }

    const renderAppIcon = (appId) => {
      const entry = appLookup.get(appId.toLowerCase());
      if (!entry) {
        return `<div style="width:24px;height:24px;background:var(--surface-1);border-radius:4px;flex-shrink:0;"></div>`;
      }
      const icon = entry.icon;
      if (!icon) {
        return `<i class="fas fa-gamepad" style="font-size:15px;color:var(--brand);width:24px;text-align:center;flex-shrink:0;"></i>`;
      }
      if (typeof icon === "string" && icon.startsWith("fa")) {
        return `<i class="${icon}" style="font-size:15px;color:var(--brand);width:24px;text-align:center;flex-shrink:0;"></i>`;
      }
      return `<img src="${resolveIconUrl(icon)}" style="width:24px;height:24px;border-radius:4px;object-fit:cover;flex-shrink:0;" />`;
    };

    const topApps = (stats.top_active_apps || []).slice(0, 5);
    const trendingHtml = topApps.length
      ? topApps
          .map(
            ({ app, count }) => `
        <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--glass-border);">
          ${renderAppIcon(app)}
          <div style="flex:1;min-width:0;">
            <div style="font-size:12px;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${resolveAppName(app)}</div>
          </div>
          <div style="font-size:11px;color:var(--brand);font-weight:600;flex-shrink:0;">${count}</div>
        </div>`
          )
          .join("")
      : `<div style="color:var(--text-secondary);font-size:12px;">No trending data right now</div>`;

    setHTML(
      content,
      `
      <div style="display:flex;gap:8px;margin-bottom:16px;">
        <div style="flex:1;background:var(--surface-1);border:1px solid var(--glass-border);border-radius:6px;padding:10px 6px;text-align:center;">
          <div style="font-size:24px;font-weight:700;color:var(--brand);line-height:1.1;">${stats.active_users_5min}</div>
          <div style="font-size:10px;color:var(--text-secondary);text-transform:uppercase;margin-top:3px;letter-spacing:.4px;">Active Users</div>
        </div>
        <div style="flex:1;background:var(--surface-1);border:1px solid var(--glass-border);border-radius:6px;padding:10px 6px;text-align:center;">
          <div style="font-size:24px;font-weight:700;color:var(--brand);line-height:1.1;">${stats.active_sessions}</div>
          <div style="font-size:10px;color:var(--text-secondary);text-transform:uppercase;margin-top:3px;letter-spacing:.4px;">Active Sessions</div>
        </div>
      </div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px;letter-spacing:.5px;">Trending Now</div>
      ${trendingHtml}
    `
    );
  }
}

export const friendsLiveTray = new FriendsLiveTray();
