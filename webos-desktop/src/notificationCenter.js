import { isImageFile } from "./utils.js";

export class NotificationCenter {
  constructor() {
    this.notifications = [];
    this.isOpen = false;
    this.maxNotifications = 50;
    this.notificationId = 0;
  }

  initialize() {
    this.createNotificationCenterUI();
    this.setupTaskbarButton();
  }

  createNotificationCenterUI() {
    const centerContainer = document.createElement("div");
    centerContainer.id = "notification-center";
    centerContainer.className = "notification-center";
    centerContainer.style.display = "none";

    centerContainer.innerHTML = `
      <div class="notification-center-header">
        <span>Notifications</span>
        <button class="notification-center-close" title="Close">×</button>
      </div>
      <div class="notification-center-list"></div>
      <div class="notification-center-footer">
        <button class="clear-all-btn">Clear All</button>
      </div>
    `;

    document.body.appendChild(centerContainer);

    centerContainer.querySelector(".notification-center-close").addEventListener("click", () => {
      this.closeCenter();
    });

    centerContainer.querySelector(".clear-all-btn").addEventListener("click", () => {
      this.clearAllNotifications();
    });
  }

  setupTaskbarButton() {
    const systemTray = document.getElementById("system-tray");
    if (!systemTray) return;

    const notificationBtn = document.createElement("div");
    notificationBtn.id = "taskbar-notification-btn";
    notificationBtn.className = "taskbar-notification-btn";
    notificationBtn.title = "Notification Center";
    notificationBtn.innerHTML = `
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
      </svg>
      <span class="notification-badge" style="display: none;">0</span>
    `;

    notificationBtn.addEventListener("click", () => {
      this.toggleCenter();
    });

    systemTray.insertBefore(notificationBtn, systemTray.lastChild);
  }

  addNotification(title, message, type = "info", duration = 5000, icon = null) {
    const notification = {
      id: this.notificationId++,
      title,
      message,
      type,
      timestamp: new Date(),
      icon
    };

    this.notifications.unshift(notification);

    if (this.notifications.length > this.maxNotifications) {
      this.notifications.pop();
    }

    this.updateNotificationCenter();
    this.updateBadge();

    return notification.id;
  }

  removeNotification(id) {
    this.notifications = this.notifications.filter((n) => n.id !== id);
    this.updateNotificationCenter();
    this.updateBadge();
  }

  clearAllNotifications() {
    this.notifications = [];
    this.updateNotificationCenter();
    this.updateBadge();
  }

  updateNotificationCenter() {
    const list = document.querySelector(".notification-center-list");
    if (!list) return;

    list.innerHTML = "";

    if (this.notifications.length === 0) {
      const empty = document.createElement("div");
      empty.className = "notification-empty";
      empty.textContent = "No notifications";
      list.appendChild(empty);
      return;
    }

    this.notifications.forEach((notif) => {
      const item = document.createElement("div");
      item.className = `notification-item notification-${notif.type}`;
      item.dataset.id = notif.id;

      const timestamp = this.formatTime(notif.timestamp);

      let iconHtml = "";
      if (notif.icon) {
        const isImagePath = isImageFile(notif.icon);
        const isDataUrl = typeof notif.icon === "string" && notif.icon.startsWith("data:");

        if (isImagePath || isDataUrl) {
          iconHtml = `<img src="${notif.icon}" class="notification-item-icon" />`;
        } else if (typeof notif.icon === "string" && notif.icon.trim().length > 0) {
          const cls = notif.icon.startsWith("fa") ? notif.icon : `fa ${notif.icon}`;
          iconHtml = `<i class="${cls} notification-item-icon"></i>`;
        }
      } else {
        const iconMap = {
          info: "fas fa-info-circle",
          success: "fas fa-check-circle",
          warning: "fas fa-exclamation-circle",
          error: "fas fa-times-circle"
        };
        iconHtml = `<i class="${iconMap[notif.type]} notification-item-icon"></i>`;
      }

      item.innerHTML = `
        <div class="notification-item-icon-container">
          ${iconHtml}
        </div>
        <div class="notification-item-content">
          <div class="notification-item-title">${notif.title}</div>
          <div class="notification-item-message">${notif.message ?? ""}</div>
          <div class="notification-item-time">${timestamp}</div>
        </div>
        <button class="notification-item-close" title="Remove">×</button>
      `;

      item.querySelector(".notification-item-close").addEventListener("click", () => {
        this.removeNotification(notif.id);
      });

      list.appendChild(item);
    });
  }

  updateBadge() {
    const badge = document.querySelector(".notification-badge");
    if (!badge) return;

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
    const center = document.getElementById("notification-center");
    if (!center) return;

    center.style.display = "block";
    this.isOpen = true;

    const btn = document.getElementById("taskbar-notification-btn");
    if (btn) btn.classList.add("active");
  }

  closeCenter() {
    const center = document.getElementById("notification-center");
    if (!center) return;

    center.style.display = "none";
    this.isOpen = false;

    const btn = document.getElementById("taskbar-notification-btn");
    if (btn) btn.classList.remove("active");
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
    return [...this.notifications];
  }

  getNotificationCount() {
    return this.notifications.length;
  }
}
