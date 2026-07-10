import { makeDraggable } from "./shared/dragUtils.js";
import { isImageFile } from "./fileDisplay.js";
import { appMap } from "./games/gamesList.js";
import { audioMixer, SystemAudio } from "./audioMixer.js";
import { getSetting } from "./shared/settingsUtils.js";
import {
  $,
  createElement,
  setHTML,
  setText,
  toggleClass,
  addClass,
  removeClass,
  setClasses
} from "./shared/domUtils.js";

import { APP_MANIFESTS, StorageKeys, os } from "./framework.js";
function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const APP_SOURCE_TO_APP_MAP_KEY = APP_MANIFESTS.reduce(
  (acc, manifest) => {
    acc[manifest.title] = manifest.serviceKey;
    return acc;
  },
  {
    V86App: "v86app",
    JsDosApp: "jsDosApp",
    RuffleApp: "ruffleApp",
    MonacoApp: "monaco"
  }
);

export class NotificationCenter {
  constructor() {
    this.notifications = [];
    this.snoozedNotifications = [];
    this.isOpen = false;
    this.maxNotifications = 50;
    this.notificationId = 0;
    this.doNotDisturb = this.loadDoNotDisturb();
    this.createNotificationCenterUI();
    this.setupTaskbarButton();
    this.updateDoNotDisturbUI();
  }

  getSetting(key, defaultValue) {
    return getSetting(key, defaultValue);
  }

  applyNotificationPosition(container) {
    const position = this.getSetting("notificationsPosition", "bottom-right");
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
    const centerContainer = createElement("div", {
      id: "ntf-panel",
      className: "ntf-panel ntf-panel--closed"
    });

    setHTML(
      centerContainer,
      `
      <div class="ntf-panel__head">
        <span>Notifications</span>
        <button class="ntf-panel__dnd" title="Do Not Disturb">DND</button>
        <button class="ntf-panel__dismiss" title="Close">×</button>
      </div>
      <div class="ntf-panel__feed"></div>
      <div class="ntf-panel__foot">
        <button class="ntf-purge-btn">Clear All</button>
      </div>
    `
    );

    document.body.appendChild(centerContainer);

    $(".ntf-panel__dismiss", centerContainer).addEventListener("click", () => {
      this.closeCenter();
    });

    $(".ntf-panel__dnd", centerContainer).addEventListener("click", () => {
      this.setDoNotDisturb(!this.doNotDisturb);
    });

    $(".ntf-purge-btn", centerContainer).addEventListener("click", () => {
      this.clearAllNotifications();
    });
  }

  setupTaskbarButton() {
    const systemTray = $("#system-tray");
    if (!systemTray) return;

    const notificationBtn = createElement("div", {
      id: "ntf-tray-btn",
      className: "ntf-tray-btn",
      attributes: { title: "Notification Center" }
    });

    setHTML(
      notificationBtn,
      `
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
      </svg>
      <span class="ntf-count ntf-count--hidden">0</span>
    `
    );

    notificationBtn.addEventListener("click", () => {
      this.toggleCenter();
    });

    systemTray.insertBefore(notificationBtn, systemTray.lastChild);
  }

  addNotification(title, message, type = "info", duration = 5000, icon = null, appSource = null) {
    const enabled = this.getSetting("notificationsEnabled", true);
    if (!enabled) return null;

    if (!icon && appSource) {
      const appMapKey = APP_SOURCE_TO_APP_MAP_KEY[appSource];
      if (appMapKey && appMap[appMapKey]) {
        icon = appMap[appMapKey].icon;
      } else {
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
      this.enforceMaxNotifications();
      return notification.id;
    }

    this.notifications.unshift(notification);
    this.enforceMaxNotifications();
    this.updateNotificationCenter();
    this.updateBadge();
    this.showToast(notification);

    return notification.id;
  }

  showToast(notif) {
    if (this.doNotDisturb) return;

    if (notif.type === "warning") {
      audioMixer().playSystemSound(SystemAudio.WARNING);
    }

    let container = $("#ntf-toast-container");
    if (!container) {
      container = createElement("div", {
        id: "ntf-toast-container",
        className: "ntf-toast-container"
      });
      this.applyNotificationPosition(container);
      document.body.appendChild(container);
    } else {
      this.applyNotificationPosition(container);
    }

    while (container.children.length >= 4) {
      const oldest = container.firstChild;
      if (oldest) {
        oldest.remove();
      }
    }

    const typeMap = {
      info: "ntf-toast--info",
      success: "ntf-toast--ok",
      warning: "ntf-toast--warn",
      error: "ntf-toast--fail"
    };
    const showAnim = this.getSetting("notificationsPopAnimation", true);
    const toast = createElement("div", {
      className: `ntf-toast ${typeMap[notif.type] || "ntf-toast--info"}${showAnim ? "" : " ntf-toast--no-animation"}`
    });

    let iconHtml = "";
    if (notif.icon) {
      const isImagePath = isImageFile(notif.icon);
      const isDataUrl = typeof notif.icon === "string" && notif.icon.startsWith("data:");

      if (isImagePath || isDataUrl) {
        iconHtml = `<img src="${escapeHtml(notif.icon)}" class="ntf-toast__glyph ntf-toast__glyph-img" />`;
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

    setHTML(
      toast,
      `
      <div class="ntf-toast__glyph-wrap">${iconHtml}</div>
      <div class="ntf-toast__body">
        ${notif.appSource ? `<div class="ntf-toast__source">${escapeHtml(notif.appSource)}</div>` : ""}
        <div class="ntf-toast__heading">${escapeHtml(notif.title)}</div>
        <div class="ntf-toast__text">${escapeHtml(notif.message ?? "")}</div>
      </div>
      <button class="ntf-toast__close" title="Dismiss">×</button>
      <div class="ntf-toast__progress"></div>
    `
    );

    container.appendChild(toast);

    let removed = false;
    let dismissTimer = null;
    let dragHistory = [];
    let dragCleanup = null;
    let startPointerX = 0;

    const threshold = toast.offsetWidth * 0.3;

    const removeToast = () => {
      if (removed) return;
      removed = true;
      if (dragCleanup) dragCleanup();
      toast.classList.add("ntf-toast-out");
      setTimeout(() => toast.remove(), 300);
    };

    $(".ntf-toast__close", toast).addEventListener("click", removeToast);

    const removeTimeout = this.getSetting("notificationsRemoveTimeout", true);
    if (removeTimeout) {
      const durationSec = this.getSetting("notificationsDuration", 5);
      const progressBar = toast.querySelector(".ntf-toast__progress");
      if (progressBar) {
        progressBar.style.animation = `toastProgress ${durationSec}s linear forwards`;
      }
      dismissTimer = setTimeout(removeToast, durationSec * 1000);
    }

    const self = this;
    dragCleanup = makeDraggable(
      toast,
      {
        start() {
          dragHistory = [];
          startPointerX = 0;
          toast.classList.add("ntf-toast--dragging");
          if (dismissTimer) {
            clearTimeout(dismissTimer);
            dismissTimer = null;
          }
        },
        move(e, dx, dy, clientX, clientY, pageX, pageY, totalDx) {
          toast.style.transform = `translateX(${totalDx}px)`;
          toast.style.opacity = Math.abs(totalDx) > threshold ? "0.5" : "1";
          dragHistory.push({ x: clientX, t: performance.now() });
          if (dragHistory.length > 5) dragHistory.shift();
        },
        end(e, totalDx) {
          let velocity = 0;
          if (dragHistory.length >= 2) {
            const first = dragHistory[0];
            const last = dragHistory[dragHistory.length - 1];
            const dt = last.t - first.t;
            if (dt > 0) {
              velocity = (last.x - first.x) / dt;
            }
          }
          dragHistory = [];

          if (Math.abs(totalDx) > threshold || Math.abs(velocity) > 0.3) {
            self.removeNotification(notif.id);
            const flyDir = Math.abs(totalDx) > threshold ? Math.sign(totalDx) : Math.sign(velocity);
            const extra = Math.max(Math.abs(velocity) * 500, 0);
            toast.style.transition = "transform 0.4s cubic-bezier(0.15, 0.7, 0.3, 1), opacity 0.4s ease";
            toast.style.transform = `translateX(${flyDir * (Math.abs(totalDx) + extra + window.innerWidth)}px)`;
            toast.style.opacity = "0";
            setTimeout(() => {
              removed = true;
              if (dragCleanup) dragCleanup();
              toast.remove();
            }, 450);
          } else {
            toast.classList.remove("ntf-toast--dragging");
            toast.style.transition = "none";
            toast.style.transform = "translateX(0px)";
            toast.style.opacity = "1";
          }
        }
      },
      { axis: "x", ignoreFrom: ".ntf-toast__close" }
    );
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
    const list = $(".ntf-panel__feed");
    if (!list) return;

    setHTML(list, "");

    const visibleNotifications = this.doNotDisturb
      ? [...this.snoozedNotifications, ...this.notifications]
      : this.notifications;

    if (visibleNotifications.length === 0) {
      const empty = createElement("div", {
        className: "ntf-panel__blank",
        text: "No notifications"
      });
      list.appendChild(empty);
      return;
    }

    visibleNotifications.forEach((notif) => {
      const typeMap = {
        info: "ntf-card--info",
        success: "ntf-card--ok",
        warning: "ntf-card--warn",
        error: "ntf-card--fail"
      };
      const item = createElement("div", {
        className: `ntf-card ${typeMap[notif.type] || "ntf-card--info"}`
      });
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

      setHTML(
        item,
        `
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
      `
      );

      $(".ntf-card__remove", item).addEventListener("click", () => {
        this.removeNotification(notif.id);
      });

      list.appendChild(item);
    });
  }

  updateBadge() {
    const badge = $(".ntf-count");
    if (!badge) return;

    if (this.doNotDisturb) {
      removeClass(badge, "ntf-count--visible");
      return;
    }

    const count = this.notifications.length;
    if (count > 0) {
      setText(badge, count > 99 ? "99+" : count);
      addClass(badge, "ntf-count--visible");
    } else {
      removeClass(badge, "ntf-count--visible");
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
    const center = $("#ntf-panel");
    if (!center) return;

    removeClass(center, "ntf-panel--closed");
    center.offsetHeight;
    addClass(center, "open");
    this.isOpen = true;

    const btn = $("#ntf-tray-btn");
    if (btn) addClass(btn, "active");
  }

  closeCenter() {
    const center = $("#ntf-panel");
    if (!center) return;

    removeClass(center, "open");
    setTimeout(() => {
      if (!this.isOpen) {
        addClass(center, "ntf-panel--closed");
      }
    }, 300);
    this.isOpen = false;

    const btn = $("#ntf-tray-btn");
    if (btn) removeClass(btn, "active");
  }

  setDoNotDisturb(enabled) {
    this.doNotDisturb = Boolean(enabled);
    try {
      os.storage.set(StorageKeys.dndKey, this.doNotDisturb ? "1" : "0");
    } catch {}

    if (!this.doNotDisturb && this.snoozedNotifications.length > 0) {
      for (let i = this.snoozedNotifications.length - 1; i >= 0; i--) {
        this.notifications.unshift(this.snoozedNotifications[i]);
      }
      this.snoozedNotifications = [];
      this.enforceMaxNotifications();
    }

    this.updateDoNotDisturbUI();
    this.updateNotificationCenter();
    this.updateBadge();
  }

  loadDoNotDisturb() {
    try {
      return os.storage.get(StorageKeys.dndKey) === "1";
    } catch {
      return false;
    }
  }

  enforceMaxNotifications() {
    while (this.notifications.length + this.snoozedNotifications.length > this.maxNotifications) {
      if (this.notifications.length > 0) {
        this.notifications.pop();
      } else {
        this.snoozedNotifications.pop();
      }
    }
  }

  updateDoNotDisturbUI() {
    const dndBtn = $(".ntf-panel__dnd");
    if (dndBtn) toggleClass(dndBtn, "active", this.doNotDisturb);

    const trayBtn = $("#ntf-tray-btn");
    if (trayBtn) {
      toggleClass(trayBtn, "ntf-tray-btn--dnd", this.doNotDisturb);
      const svg = $("svg", trayBtn);
      if (svg) {
        if (this.doNotDisturb) {
          setHTML(
            svg,
            `<path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/><line x1="2" y1="2" x2="22" y2="22" class="ntf-dnd-line" stroke-width="2"/>`
          );
        } else {
          setHTML(
            svg,
            `<path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>`
          );
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
