import { isImageFile } from "./utils.js";
import { StorageKeys } from "./settings/settings.js";
import { appMap } from "./gamesList.js";
import { audioMixer, SystemAudio } from "./audioMixer.js";

function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Map AppSource enum values to appMap keys
const APP_SOURCE_TO_APP_MAP_KEY = {
  CommandPalette: "commandPalette",
  "Clipboard Manager": "clipboardManager",
  Explorer: "explorer",
  "Yuki Convert": "yukiConvert",
  YouTube: "youtube",
  Setup: "setupApp",
  "Installed Apps": "installedApps",
  "Archive Extractor": "archiveExtractor",
  Settings: "settingsApp",
  Notepad: "notepad",
  Terminal: "terminal",
  Browser: "browserApp",
  Calculator: "calculatorApp",
  Calendar: "calendar",
  Camera: "cameraApp",
  Markdown: "markdown",
  Office: "officeApp",
  "Data Editor": "dataEditor",
  "3D Model Viewer": "model3dApp",
  "Task Manager": "taskManagerApp",
  Achievements: "achievementsApp",
  About: "aboutApp",
  News: "newsApp",
  Weather: "weatherApp",
  Categories: "systemApps",
  "Profile Customizer": "profileCustomizer",
  Shortcuts: "shortcutsApp",
  "App Creator": "appCreatorApp",
  "Yuki OS Guide": "yukiOsGuide",
  System: "system",
  V86App: "v86app",
  JsDosApp: "jsDosApp",
  RuffleApp: "ruffleApp",
  MonacoApp: "monaco",
  "Evil Spotify": "shittify"
};

export class NotificationCenter {
  constructor() {
    this.notifications = [];
    this.snoozedNotifications = [];
    this.isOpen = false;
    this.maxNotifications = 50;
    this.notificationId = 0;
    this.doNotDisturb = this._loadDoNotDisturb();
    this.createNotificationCenterUI();
    this.setupTaskbarButton();
    this.updateDoNotDisturbUI();
  }

  _getSetting(key, defaultValue) {
    if (window._settings && window._settings[key] !== undefined) {
      return window._settings[key];
    }
    const storageKey = StorageKeys[key];
    if (!storageKey) return defaultValue;
    const val = localStorage.getItem(storageKey);
    if (val === null) return defaultValue;
    if (val === "true") return true;
    if (val === "false") return false;
    const num = Number(val);
    if (!isNaN(num)) return num;
    return val;
  }

  _applyNotificationPosition(container) {
    const position = this._getSetting("notificationsPosition", "bottom-right");
    container.className = "ntf-toast-container";

    switch (position) {
      case "bottom-left":
        container.classList.add("ntf-toast-container--bottom-left");
        break;
      case "top-right":
        container.classList.add("ntf-toast-container--top-right");
        break;
      case "top-left":
        container.classList.add("ntf-toast-container--top-left");
        break;
      default:
        container.classList.add("ntf-toast-container--bottom-right");
    }
  }

  createNotificationCenterUI() {
    const centerContainer = document.createElement("div");
    centerContainer.id = "ntf-panel";
    centerContainer.className = "ntf-panel";
    centerContainer.style.display = "none";

    centerContainer.innerHTML = `
      <div class="ntf-panel__head">
        <span>Notifications</span>
        <button class="ntf-panel__dnd" title="Do Not Disturb">DND</button>
        <button class="ntf-panel__dismiss" title="Close">×</button>
      </div>
      <div class="ntf-panel__feed"></div>
      <div class="ntf-panel__foot">
        <button class="ntf-purge-btn">Clear All</button>
      </div>
    `;

    document.body.appendChild(centerContainer);

    centerContainer.querySelector(".ntf-panel__dismiss").addEventListener("click", () => {
      this.closeCenter();
    });

    centerContainer.querySelector(".ntf-panel__dnd").addEventListener("click", () => {
      this.setDoNotDisturb(!this.doNotDisturb);
    });

    centerContainer.querySelector(".ntf-purge-btn").addEventListener("click", () => {
      this.clearAllNotifications();
    });
  }

  setupTaskbarButton() {
    const systemTray = document.getElementById("system-tray");
    if (!systemTray) return;

    const notificationBtn = document.createElement("div");
    notificationBtn.id = "ntf-tray-btn";
    notificationBtn.className = "ntf-tray-btn";
    notificationBtn.title = "Notification Center";
    notificationBtn.innerHTML = `
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
      </svg>
      <span class="ntf-count" style="display: none;">0</span>
    `;

    notificationBtn.addEventListener("click", () => {
      this.toggleCenter();
    });

    systemTray.insertBefore(notificationBtn, systemTray.lastChild);
  }

  addNotification(title, message, type = "info", duration = 5000, icon = null, appSource = null) {
    const enabled = this._getSetting("notificationsEnabled", true);
    if (!enabled) return null;

    // Auto-fallback to app icon from appMap if no icon provided
    if (!icon && appSource) {
      const appMapKey = APP_SOURCE_TO_APP_MAP_KEY[appSource];
      if (appMapKey && appMap[appMapKey]) {
        icon = appMap[appMapKey].icon;
      } else {
        // Fallback: search appMap by title if direct key lookup fails
        for (const [key, app] of Object.entries(appMap)) {
          if (app.title === appSource) {
            icon = app.icon;
            break;
          }
        }
      }
    }

    const notification = {
      id: this.notificationId++,
      title,
      message,
      type,
      timestamp: new Date(),
      icon,
      appSource
    };

    if (this.doNotDisturb) {
      this.snoozedNotifications.unshift(notification);
      this._enforceMaxNotifications();
      return notification.id;
    }

    this.notifications.unshift(notification);
    this._enforceMaxNotifications();
    this.updateNotificationCenter();
    this.updateBadge();
    this.showToast(notification);

    return notification.id;
  }

  showToast(notif) {
    if (this.doNotDisturb) return;

    if (notif.type === "warning") {
      audioMixer.playSystemSound(SystemAudio.WARNING);
    }

    let container = document.getElementById("ntf-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "ntf-toast-container";
      container.className = "ntf-toast-container";
      this._applyNotificationPosition(container);
      document.body.appendChild(container);
    } else {
      this._applyNotificationPosition(container);
    }

    while (container.children.length >= 4) {
      const oldest = container.firstChild;
      if (oldest) {
        oldest.remove();
      }
    }

    const toast = document.createElement("div");
    const typeMap = {
      info: "ntf-toast--info",
      success: "ntf-toast--ok",
      warning: "ntf-toast--warn",
      error: "ntf-toast--fail"
    };
    const showAnim = this._getSetting("notificationsPopAnimation", true);
    toast.className = `ntf-toast ${typeMap[notif.type] || "ntf-toast--info"}${showAnim ? "" : " ntf-toast--no-animation"}`;

    let iconHtml = "";
    if (notif.icon) {
      const isImagePath = isImageFile(notif.icon);
      const isDataUrl = typeof notif.icon === "string" && notif.icon.startsWith("data:");

      if (isImagePath || isDataUrl) {
        iconHtml = `<img src="${escapeHtml(notif.icon)}" class="ntf-toast__glyph" style="width:16px;height:16px;object-fit:cover;" />`;
      } else if (typeof notif.icon === "string" && notif.icon.trim().length > 0) {
        let cls = notif.icon;
        if (cls.startsWith("fa-") && !cls.startsWith("fas ") && !cls.startsWith("far ") && !cls.startsWith("fab ")) {
          cls = `fas ${cls}`;
        } else if (!cls.startsWith("fa")) {
          cls = `fa ${cls}`;
        }
        iconHtml = `<i class="${escapeHtml(cls)} ntf-toast__glyph"></i>`;
      }
    } else {
      const iconMap = {
        info: "fas fa-info-circle",
        success: "fas fa-check-circle",
        warning: "fas fa-exclamation-circle",
        error: "fas fa-times-circle"
      };
      iconHtml = `<i class="${iconMap[notif.type] ?? "fas fa-info-circle"} ntf-toast__glyph"></i>`;
    }

    toast.innerHTML = `
      <div class="ntf-toast__glyph-wrap">${iconHtml}</div>
      <div class="ntf-toast__body">
        ${notif.appSource ? `<div class="ntf-toast__source">${escapeHtml(notif.appSource)}</div>` : ""}
        <div class="ntf-toast__heading">${escapeHtml(notif.title)}</div>
        <div class="ntf-toast__text">${escapeHtml(notif.message ?? "")}</div>
      </div>
      <button class="ntf-toast__close" title="Dismiss">×</button>
      <div class="ntf-toast__progress"></div>
    `;

    container.appendChild(toast);

    let removed = false;
    const removeToast = () => {
      if (removed) return;
      removed = true;
      toast.classList.add("ntf-toast-out");
      setTimeout(() => toast.remove(), 300);
    };

    toast.querySelector(".ntf-toast__close").addEventListener("click", removeToast);

    const removeTimeout = this._getSetting("notificationsRemoveTimeout", true);
    if (removeTimeout) {
      const durationSec = this._getSetting("notificationsDuration", 5);
      const progressBar = toast.querySelector(".ntf-toast__progress");
      if (progressBar) {
        progressBar.style.animation = `toastProgress ${durationSec}s linear forwards`;
      }
      setTimeout(removeToast, durationSec * 1000);
    }
  }

  removeNotification(id) {
    this.notifications = this.notifications.filter((n) => n.id !== id);
    this.snoozedNotifications = this.snoozedNotifications.filter((n) => n.id !== id);
    this.updateNotificationCenter();
    this.updateBadge();
  }

  clearAllNotifications() {
    this.notifications = [];
    this.snoozedNotifications = [];
    this.updateNotificationCenter();
    this.updateBadge();
  }

  updateNotificationCenter() {
    const list = document.querySelector(".ntf-panel__feed");
    if (!list) return;

    list.innerHTML = "";

    const visibleNotifications = this.doNotDisturb
      ? [...this.snoozedNotifications, ...this.notifications]
      : this.notifications;

    if (visibleNotifications.length === 0) {
      const empty = document.createElement("div");
      empty.className = "ntf-panel__blank";
      empty.textContent = "No notifications";
      list.appendChild(empty);
      return;
    }

    visibleNotifications.forEach((notif) => {
      const item = document.createElement("div");
      const typeMap = {
        info: "ntf-card--info",
        success: "ntf-card--ok",
        warning: "ntf-card--warn",
        error: "ntf-card--fail"
      };
      item.className = `ntf-card ${typeMap[notif.type] || "ntf-card--info"}`;
      item.dataset.id = notif.id;

      const timestamp = this.formatTime(notif.timestamp);

      let iconHtml = "";
      if (notif.icon) {
        const isImagePath = isImageFile(notif.icon);
        const isDataUrl = typeof notif.icon === "string" && notif.icon.startsWith("data:");

        if (isImagePath || isDataUrl) {
          iconHtml = `<img src="${escapeHtml(notif.icon)}" class="ntf-card__glyph" />`;
        } else if (typeof notif.icon === "string" && notif.icon.trim().length > 0) {
          let cls = notif.icon;
          if (cls.startsWith("fa-") && !cls.startsWith("fas ") && !cls.startsWith("far ") && !cls.startsWith("fab ")) {
            cls = `fas ${cls}`;
          } else if (!cls.startsWith("fa")) {
            cls = `fa ${cls}`;
          }
          iconHtml = `<i class="${escapeHtml(cls)} ntf-card__glyph"></i>`;
        }
      } else {
        const iconMap = {
          info: "fas fa-info-circle",
          success: "fas fa-check-circle",
          warning: "fas fa-exclamation-circle",
          error: "fas fa-times-circle"
        };
        iconHtml = `<i class="${iconMap[notif.type] ?? "fas fa-info-circle"} ntf-card__glyph"></i>`;
      }

      item.innerHTML = `
        <div class="ntf-card__glyph-wrap">
          ${iconHtml}
        </div>
        <div class="ntf-card__body">
          ${notif.appSource ? `<div class="ntf-card__source">${escapeHtml(notif.appSource)}</div>` : ""}
          <div class="ntf-card__heading">${escapeHtml(notif.title)}</div>
          <div class="ntf-card__text">${escapeHtml(notif.message ?? "")}</div>
          <div class="ntf-card__stamp">${timestamp}</div>
        </div>
        <button class="ntf-card__remove" title="Remove">×</button>
      `;

      item.querySelector(".ntf-card__remove").addEventListener("click", () => {
        this.removeNotification(notif.id);
      });

      list.appendChild(item);
    });
  }

  updateBadge() {
    const badge = document.querySelector(".ntf-count");
    if (!badge) return;

    if (this.doNotDisturb) {
      badge.style.display = "none";
      return;
    }

    const count = this.notifications.length;
    if (count > 0) {
      badge.textContent = count > 99 ? "99+" : count;
      badge.style.display = "flex";
    } else {
      badge.style.display = "none";
    }
  }

  toggleCenter() {
    if (this.isOpen) {
      this.closeCenter();
    } else {
      this.openCenter();
    }
  }

  openCenter() {
    const center = document.getElementById("ntf-panel");
    if (!center) return;

    center.style.display = "flex";
    center.offsetHeight;
    center.classList.add("open");
    this.isOpen = true;

    const btn = document.getElementById("ntf-tray-btn");
    if (btn) btn.classList.add("active");
  }

  closeCenter() {
    const center = document.getElementById("ntf-panel");
    if (!center) return;

    center.classList.remove("open");
    setTimeout(() => {
      if (!this.isOpen) {
        center.style.display = "none";
      }
    }, 300);
    this.isOpen = false;

    const btn = document.getElementById("ntf-tray-btn");
    if (btn) btn.classList.remove("active");
  }

  setDoNotDisturb(enabled) {
    this.doNotDisturb = Boolean(enabled);
    try {
      localStorage.setItem(StorageKeys.dndKey, this.doNotDisturb ? "1" : "0");
    } catch {}

    if (!this.doNotDisturb && this.snoozedNotifications.length > 0) {
      for (let i = this.snoozedNotifications.length - 1; i >= 0; i--) {
        this.notifications.unshift(this.snoozedNotifications[i]);
      }
      this.snoozedNotifications = [];
      this._enforceMaxNotifications();
    }

    this.updateDoNotDisturbUI();
    this.updateNotificationCenter();
    this.updateBadge();
  }

  _loadDoNotDisturb() {
    try {
      return localStorage.getItem(StorageKeys.dndKey) === "1";
    } catch {
      return false;
    }
  }

  _enforceMaxNotifications() {
    while (this.notifications.length + this.snoozedNotifications.length > this.maxNotifications) {
      if (this.notifications.length > 0) {
        this.notifications.pop();
      } else {
        this.snoozedNotifications.pop();
      }
    }
  }

  updateDoNotDisturbUI() {
    const dndBtn = document.querySelector(".ntf-panel__dnd");
    if (dndBtn) dndBtn.classList.toggle("active", this.doNotDisturb);

    const trayBtn = document.getElementById("ntf-tray-btn");
    if (trayBtn) {
      trayBtn.classList.toggle("ntf-tray-btn--dnd", this.doNotDisturb);
      const svg = trayBtn.querySelector("svg");
      if (svg) {
        if (this.doNotDisturb) {
          svg.innerHTML = `<path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/><line x1="2" y1="2" x2="22" y2="22" stroke="#e0e0e0" stroke-width="2"/>`;
        } else {
          svg.innerHTML = `<path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>`;
        }
      }
    }
  }

  formatTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  }

  getNotifications() {
    return [...this.notifications, ...this.snoozedNotifications];
  }

  getNotificationCount() {
    return this.notifications.length + this.snoozedNotifications.length;
  }
}
