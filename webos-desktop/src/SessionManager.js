import { BusEvents } from "./core/EventBus.js";
import { Achievements } from "./achievements.js";
import { PREDEFINED_AVATARS } from "./utils/avatarData.js";
import { SystemUtilities } from "./system.js";
import { audioMixer, SystemAudio } from "./audioMixer.js";
import { YUKIOS_VERSION } from "./apps/about.js";
import { resolveAvatarUrl } from "./shared/avatarResolver.js";
import { $ } from "./shared/domUtils.js";
import { renderLiveStats } from "./shared/liveStats.js";
import { resolveAppId, generateUUID, timeAgo } from "./utils/utils.js";
import { StorageKeys, os, brand, wasRandomYuriTrigger } from "./framework.js";
import { KeybindManager } from "./keybindManager.js";
import { applyTheme } from "./settings/settingsApply.js";
import { taskbarPositionManager } from "./desktopui/taskbarPositionManager.js";
import { fetchLiveStats } from "./analytics.js";
import { liveActivityManager } from "./liveActivityManager.js";
import { runBootPreview } from "./bootScreen.js";
import { BOOT_ANIMATIONS } from "./bootAnimations.js";
import { modeManager, MODES } from "./modeManager.js";
import { applyMacSettings, disableMacSettings } from "./modes/macos/session.js";
import { applyTilingSettings, disableTilingSettings } from "./modes/tiling/session.js";
import { applyChromeOsSettings, disableChromeOsSettings } from "./modes/chromeos/session.js";
import { showDonationPopup } from "./donationPopup.js";
import { getRecentNews } from "./apps/news.js";

export class SessionManager {
  constructor(os) {
    this.os = os;
    this.currentSession = null;
    this.container = null;
    this.isLocked = false;
    this.timeInterval = null;
    this.userHistory = this.loadUserHistory();
    this.sessionState = "login";
    this.selectedUser = null;
    this.selectedSession = os.storage.get(StorageKeys.selectedSession) || "Yuki Desktop(Default)";
    this.ensureUserId();
    this.setupProfileUpdateListener();
    this.startTime = Date.now();
    this.uptimeInterval = null;
    this.contextMenuHandler = null;
    this.keyboardHandler = null;
    this.IDLE_TIMEOUT = 15 * 60 * 1000;
    this.idleTimer = null;
    this.boundResetIdle = this.handleActivity.bind(this);
    this.signingIn = false;
    this.onSessionComplete = null;
  }

  ensureUserId() {
    let userId = os.storage.get(StorageKeys.userId);
    if (!userId) {
      userId = generateUUID();
      os.storage.set(StorageKeys.userId, userId);
    }
    return userId;
  }

  setupProfileUpdateListener() {
    os.events.on(BusEvents.PROFILE_UPDATED, (data) => {
      this.handleProfileUpdate(data);
    });
  }

  async handleProfileUpdate(data) {
    const { userId, name, avatar } = data;

    const existingIndex = this.userHistory.findIndex((u) => u.key === userId || u.userId === userId);
    if (existingIndex >= 0) {
      this.userHistory[existingIndex].name = name;
      this.userHistory[existingIndex].avatar = avatar;
      this.saveUserHistory();
    }

    if (this.container) {
      const carousel = this.container.querySelector("#user-carousel-row");
      if (carousel) {
        carousel.innerHTML = await this.renderUserCarousel();
        this.bindCarouselTileEvents();
      }
    }
  }

  loadUserHistory() {
    try {
      const history = os.storage.get(StorageKeys.userHistory);
      if (!history) return [];

      let needsMigration = false;

      const migratedHistory = history.map((user) => {
        if (!user.userId) {
          needsMigration = true;
          const id = user.key || generateUUID();
          return {
            ...user,
            userId: id,
            key: id
          };
        }
        return user;
      });

      if (needsMigration) {
        this.userHistory = migratedHistory;
        this.saveUserHistory();
      }

      return migratedHistory;
    } catch (e) {
      return [];
    }
  }

  saveUserHistory() {
    try {
      os.storage.set(StorageKeys.userHistory, this.userHistory);
    } catch (e) {}
  }

  addToUserHistory(session) {
    const userKey = session.key || this.ensureUserId();
    const existingIndex = this.userHistory.findIndex((u) => u.key === userKey || u.userId === userKey);
    const userEntry = {
      userId: userKey,
      name: session.name,
      key: userKey,
      avatar: session.avatar,
      lastLogin: Date.now()
    };

    if (existingIndex >= 0) {
      this.userHistory[existingIndex] = userEntry;
    } else {
      this.userHistory.unshift(userEntry);
    }

    this.userHistory = this.userHistory.slice(0, 5);
    this.saveUserHistory();
  }

  async showLogin() {
    const seoOverlay = document.getElementById("seo-overlay");
    if (seoOverlay && !seoOverlay.classList.contains("hidden")) {
      return new Promise((resolve) => {
        const observer = new MutationObserver(() => {
          if (seoOverlay.classList.contains("hidden")) {
            observer.disconnect();
            this.startLogin().then(resolve);
          }
        });
        observer.observe(seoOverlay, { attributes: true, attributeFilter: ["class"] });
      });
    }
    return this.startLogin();
  }

  async startLogin() {
    const lastLaunch = os.storage.get(StorageKeys.lastLaunchTime);
    const now = Date.now();
    os.storage.set(StorageKeys.lastLaunchTime, now.toString());

    if (os.storage.get(StorageKeys.autoLogin)) {
      const savedName = os.storage.get(StorageKeys.username);
      if (savedName) {
        this.currentSession = {
          name: savedName,
          key: os.storage.get(StorageKeys.userId) || this.ensureUserId(),
          avatar: os.storage.get(StorageKeys.profilePicture) || PREDEFINED_AVATARS[0]
        };
        await this.initializeSession();
        return;
      }
    }

    return new Promise(async (resolve) => {
      await this.createSessionUI("login", resolve);
    });
  }

  async createSessionUI(state, onComplete) {
    if (document.getElementById("session-overlay")) return;

    this.sessionState = state;
    this.onSessionComplete = onComplete;
    this.container = document.createElement("div");
    this.container.id = "session-overlay";
    this.container.className = "session-overlay";

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const dateStr = now.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });

    const lastUsername = os.storage.get(StorageKeys.username) || "";
    const lastAvatarRef = os.storage.get(StorageKeys.profilePicture) || PREDEFINED_AVATARS[0];
    const displayName = lastUsername || "Guest";
    const userId = this.ensureUserId();

    this.userHistory = this.loadUserHistory();

    const primaryUser = { name: displayName, key: userId, avatar: lastAvatarRef, userId: userId };

    const allUsers = this.userHistory.length > 0 ? this.userHistory : [primaryUser];
    const selectedKey = this.userHistory.length > 0 ? this.userHistory[0].key : primaryUser.key;
    this.selectedUser = allUsers.find((u) => u.key === selectedKey) || allUsers[0];

    this.container.innerHTML = `
      <div class="session-wallpaper"></div>
      <div class="session-background"></div>
      <div class="session-content${state === "locked" ? "" : " extra-hidden"}">
        <div class="session-brand">${brand("YukiOS")}</div>
        <div class="session-time">${timeStr}</div>
        <div class="session-date">${dateStr}</div>

        <div class="session-extra">
        <div class="session-info-btn" id="session-info-btn">
          <i class="fas fa-info"></i>
        </div>
        <div class="session-boot-preview-btn" id="session-boot-preview-btn">
          <i class="fas fa-play"></i>
        </div>
        ${
          os.storage.get(StorageKeys.donationDismissed) === "true"
            ? ""
            : `<button class="session-support-btn" id="session-support-btn" title="Support ${brand("YukiOS")}"><i class="fas fa-heart"></i></button>`
        }
        <a class="session-discord-btn" href="https://discord.gg/wufbWFwr4G" target="_blank" rel="noopener" title="Join Discord"><i class="fab fa-discord"></i></a>
        <a class="session-github-btn" href="https://github.com/Reeyuki/YukiOS" target="_blank" rel="noopener" title="Star Us On Github"><i class="fab fa-github"></i></a>
        <div class="session-boot-preview-modal" id="session-boot-preview-modal" style="display: none;">
          <div class="boot-preview-modal-content">
            <div class="boot-preview-modal-header">
              <h3>Boot Animations</h3>
            </div>
            <div class="boot-preview-modal-body" id="boot-preview-list">
            </div>
          </div>
        </div>
        <div class="session-info-modal" id="session-info-modal" style="display: none;">
          <div class="info-modal-content">
            <div class="info-modal-header">
              <h3>System Info</h3>
            </div>
            <div class="info-modal-body">
              <div class="info-row">
                <span class="info-label">Version</span>
                <span class="info-value">${brand("YukiOS")} ${YUKIOS_VERSION}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Build</span>
                <span class="info-value">${__GIT_COMMIT__}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Uptime</span>
                <span class="info-value" id="uptime-display">0s</span>
              </div>
            </div>
          </div>
        </div>
        <div class="online-users-badge" id="online-users-badge">
          <i class="fas fa-users"></i>
          <span id="online-users-count">--</span> online
        </div>
        <div class="session-activity-widget" id="session-activity-widget">
          <button class="session-activity-toggle" id="session-activity-toggle" title="Toggle live activity">
            <i class="fas fa-gamepad"></i>
            <span>Live Activity</span>
            <i class="fas fa-chevron-down"></i>
          </button>
          <div class="session-activity-panel" id="session-activity-panel">
            <div style="color:var(--text-secondary);font-size:12px;text-align:center;padding-top:24px;">Loading...</div>
          </div>
        </div>
        <div class="session-news-widget" id="session-news-widget">
          <div class="session-news-header">
            <i class="fas fa-newspaper"></i>
            <span>What's New</span>
            <button class="session-news-close" id="session-news-close" aria-label="Close" title="Close">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="session-news-list" id="session-news-list"></div>
        </div>
        <div class="user-carousel-row" id="user-carousel-row"></div>

        <div class="login-center-panel">
          <button class="action-button" id="action-button">
            ${this.getActionButtonText()}
          </button>

          <div class="system-actions-row">
            <button class="system-icon" id="power-btn" title="Shutdown">
              <i class="fas fa-power-off"></i>
            </button>
            <button class="system-icon" id="restart-btn" title="Restart">
              <i class="fas fa-rotate"></i>
            </button>
            <button class="system-icon" id="sleep-btn" title="Sleep">
              <i class="fas fa-moon"></i>
            </button>
          </div>

          ${
            state !== "locked"
              ? `
          <div class="remember-me-row" id="remember-me-row">
            <label class="remember-me-label">
              <input type="checkbox" class="remember-me-checkbox" id="remember-checkbox" ${os.storage.get(StorageKeys.autoLogin) ? "checked" : ""}>
              <span class="remember-me-checkmark"></span>
              Remember me
            </label>
          </div>
          `
              : ""
          }
        </div>

        <div class="session-selector" id="session-selector">
          <div class="session-modes" id="session-modes">
            <button type="button" class="session-mode-btn" data-mode="reset">
              <i class="fas fa-snowflake"></i>
              <span>${brand("YukiOS")}</span>
            </button>
            <button type="button" class="session-mode-btn" data-mode="mac">
              <i class="fab fa-apple"></i>
              <span>Mac</span>
            </button>
            <button type="button" class="session-mode-btn" data-mode="chromeos">
              <i class="fab fa-chrome"></i>
              <span>Chrome OS</span>
            </button>
            <button type="button" class="session-mode-btn" data-mode="tiling">
              <i class="fas fa-th-large"></i>
              <span>Tiling</span>
            </button>
            <button type="button" class="session-mode-btn" data-mode="3d">
              <i class="fas fa-cube"></i>
              <span>3D Fps</span>
            </button>
          </div>
        </div>

        <div class="session-electron-banner" id="session-electron-banner">
          <button class="session-electron-banner__close" id="electron-banner-close" aria-label="Dismiss" title="Dismiss">
            <i class="fas fa-times"></i>
          </button>
          <i class="fas fa-download"></i>
          <span><strong>${brand("YukiOS")} now has a desktop app.</strong> Persistent storage, system tray, remote desktop, and better performance. The ${brand("YukiOS")} you know, now as a real desktop application.</span>
          <div class="electron-banner-actions">
            <span class="electron-download-link" id="electron-download-btn"><i class="fas fa-download"></i> Download</span>
            <a href="https://github.com/reeyuki/yukios/releases" target="_blank" class="electron-releases-link">View all releases</a>
          </div>
        </div>

        <a href="/features.html" class="session-features-link">Explore Features</a>
        </div>
      </div>

      <div class="avatar-edit-modal" id="avatar-edit-modal" style="display: none;">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Edit Avatar</h3>
            <button class="modal-close" id="avatar-modal-close">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="modal-body">
            <div class="avatar-grid" id="avatar-grid">
              ${PREDEFINED_AVATARS.map(
                (url) => `
                <div class="avatar-tile ${url === this.selectedUser.avatar ? "active" : ""}" data-url="${url}">
                  <img src="${url}" alt="Avatar" loading="lazy">
                </div>
              `
              ).join("")}
            </div>
        </div>
      </div>

    `;

    document.body.appendChild(this.container);

    const electronBanner = this.container.querySelector("#session-electron-banner");
    if (
      electronBanner &&
      (typeof window.electronAPI !== "undefined" || os.storage.get(StorageKeys.electronBannerDismissed))
    ) {
      electronBanner.style.display = "none";
    } else if (electronBanner) {
      const closeBtn = electronBanner.querySelector("#electron-banner-close");
      if (closeBtn) {
        closeBtn.addEventListener("click", () => {
          os.storage.set(StorageKeys.electronBannerDismissed, true);
          electronBanner.style.display = "none";
        });
      }
    }

    const carouselRow = this.container.querySelector("#user-carousel-row");
    if (carouselRow) {
      carouselRow.innerHTML = await this.renderUserCarousel();
    }

    const newsList = this.container.querySelector("#session-news-list");
    if (newsList) {
      newsList.innerHTML = this.renderRecentNews();
    }
    const newsWidget = this.container.querySelector("#session-news-widget");
    const newsCloseBtn = this.container.querySelector("#session-news-close");
    if (newsWidget && newsCloseBtn) {
      newsCloseBtn.addEventListener("click", () => {
        newsWidget.classList.add("closed");
      });
    }

    await this.applySessionWallpaper(this.container);
    await this.bindSessionEvents(onComplete);
    this.startClock();
    this.startUptimeCounter();
    this.disableContextMenu();
    this.setupDragVisibility();
    this.fetchOnlineUsersCount();
    this.startOnlineUsersPolling();
    this.initSessionActivity();
    this.startSessionActivityPolling();
  }

  async renderUserCarousel() {
    const users = this.userHistory.length > 0 ? this.userHistory : [this.selectedUser];
    const renderedUsers = await Promise.all(
      users.map(async (user) => {
        const isSelected = user.key === this.selectedUser?.key;
        const avatarUrl = await resolveAvatarUrl(user.avatar, PREDEFINED_AVATARS[0]);
        return `
        <div class="user-carousel-tile ${isSelected ? "selected" : ""}"
             data-key="${user.key}" data-name="${user.name}" data-avatar="${user.avatar}" data-user-id="${user.userId || user.key}">
          <div class="carousel-avatar-wrap">
            <img src="${avatarUrl}" alt="${user.name}" loading="lazy">
          </div>
          <span>${user.name}</span>
        </div>
      `;
      })
    );

    return renderedUsers.join("");
  }

  getActionButtonText() {
    if (this.sessionState === "locked") return "Unlock";
    if (this.sessionState === "login") {
      return this.selectedUser ? "Sign in" : "Select User";
    }
    return "Start Session";
  }

  updateActionButtonText() {
    const actionBtn = this.container?.querySelector("#action-button");
    if (actionBtn) {
      actionBtn.innerHTML = this.getActionButtonText();
    }
  }

  async signInAndExit() {
    if (this.sessionState === "locked") {
      this.unlockSession();
      if (this.onSessionComplete) this.onSessionComplete(this.currentSession);
      return;
    }
    if (!this.selectedUser) return;
    this.currentSession = {
      name: this.selectedUser.name,
      key: this.selectedUser.key,
      avatar: this.selectedUser.avatar
    };
    await this.initializeSession();
    this.container.classList.add("exit");
    await new Promise((resolve) => setTimeout(resolve, 500));
    this.container.remove();
    this.enableContextMenu();
    if (this.keyboardHandler) {
      document.removeEventListener("keydown", this.keyboardHandler);
      this.keyboardHandler = null;
    }
    if (this.onSessionComplete) this.onSessionComplete(this.currentSession);
  }

  async quickLaunch(appId) {
    if (this.signingIn) return;
    const resolvedId = resolveAppId(appId);
    if (!resolvedId) return;
    this.signingIn = true;
    try {
      await this.signInAndExit();
    } catch (e) {
      console.error("Session init failed:", e);
    } finally {
      this.signingIn = false;
    }
    setTimeout(() => {
      os.app.launch(resolvedId).catch(() => {});
    }, 800);
  }

  renderUserTile(user) {
    const lastLoginDate = new Date(user.lastLogin);
    const timeAgo = this.formatTimeAgo(lastLoginDate);

    return `
      <div class="user-history-tile" data-key="${user.key}" data-name="${user.name}" data-avatar="${user.avatar}">
        <img src="${user.avatar}" alt="${user.name}" loading="lazy">
        <div class="user-info">
          <div class="user-name">${user.name}</div>
          <div class="user-last-login">Last seen: ${timeAgo}</div>
        </div>
      </div>
    `;
  }

  formatTimeAgo(date) {
    return timeAgo(date);
  }

  async applySessionWallpaper(container) {
    const wp = await SystemUtilities.getLoginWallpaper();
    let bgEl = container.querySelector(".session-wallpaper");
    const blurOverlay = container.querySelector(".session-background");
    if (!wp) {
      if (bgEl) bgEl.remove();
      if (blurOverlay) blurOverlay.style.display = "";
      return;
    }
    const currentTag = bgEl?.tagName.toLowerCase();
    const needsReplacement = !bgEl || currentTag === "div" || wp.isVideo !== (currentTag === "video");
    if (needsReplacement) {
      if (bgEl) bgEl.remove();
      bgEl = wp.isVideo ? document.createElement("video") : document.createElement("img");
      bgEl.className = "session-wallpaper";
      container.insertBefore(bgEl, container.firstChild);
    }
    bgEl.src = wp.url;
    if (wp.isVideo) {
      bgEl.autoplay = true;
      bgEl.loop = true;
      bgEl.muted = true;
      bgEl.playsInline = true;
    }
    if (blurOverlay) blurOverlay.style.display = "none";
  }

  startClock() {
    import("./services/timeWorker.js").then(({ subscribeTimeTick }) => {
      const timeEl = this.container?.querySelector(".session-time");
      if (!timeEl) return;
      const update = (data) => {
        if (!this.container) {
          unsub();
          return;
        }
        timeEl.textContent = data.timeStr;
      };
      const unsub = subscribeTimeTick(update);
      this.timeWorkerUnsub = unsub;
    });
  }

  startUptimeCounter() {
    this.uptimeInterval = setInterval(() => {
      if (!this.container) {
        clearInterval(this.uptimeInterval);
        return;
      }
      const uptimeEl = this.container.querySelector("#uptime-display");
      if (uptimeEl) {
        const uptime = Date.now() - this.startTime;
        uptimeEl.textContent = this.formatUptime(uptime);
      }
    }, 1000);
  }

  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  renderRecentNews() {
    return getRecentNews(12)
      .map(
        (update) => `
          <div class="session-news-update">
            <div class="session-news-date">${update.date}</div>
            ${(update.sections || [])
              .flatMap((section) => section.items || [])
              .slice(0, 3)
              .map(
                ([icon, title, desc]) => `
                  <div class="session-news-item">
                    <div class="session-news-item-icon" aria-hidden="true">
                      <i class="fas ${icon}"></i>
                    </div>
                    <div class="session-news-item-body">
                      <div class="session-news-item-title">${title}</div>
                      <div class="session-news-item-desc">${desc}</div>
                    </div>
                  </div>
                `
              )
              .join("")}
          </div>
        `
      )
      .join("");
  }

  async fetchOnlineUsersCount() {
    try {
      const stats = await fetchLiveStats();
      if (stats && stats.active_users_5min !== undefined) {
        const el = this.container?.querySelector("#online-users-count");
        if (el) el.textContent = stats.active_users_5min;
      }
    } catch {}
  }

  startOnlineUsersPolling() {
    this.onlineUsersInterval = setInterval(() => {
      this.fetchOnlineUsersCount();
    }, 60000);
  }

  async loadSessionActivity() {
    const widget = this.container?.querySelector("#session-activity-widget");
    if (!widget || widget.classList.contains("collapsed")) return;
    const panel = widget.querySelector("#session-activity-panel");
    if (!panel) return;

    const stats = await fetchLiveStats();
    if (!this.container || !panel.isConnected) return;
    renderLiveStats(stats, panel, { showStats: false, onAppClick: (appId) => this.quickLaunch(appId) });
  }

  initSessionActivity() {
    const widget = this.container?.querySelector("#session-activity-widget");
    if (!widget) return;
    const toggle = widget.querySelector("#session-activity-toggle");
    const collapsed = os.storage.get(StorageKeys.sessionActivityCollapsed) === "true";
    if (collapsed) widget.classList.add("collapsed");
    toggle?.addEventListener("click", () => {
      const nowCollapsed = !widget.classList.contains("collapsed");
      widget.classList.toggle("collapsed", nowCollapsed);
      os.storage.set(StorageKeys.sessionActivityCollapsed, nowCollapsed ? "true" : "false");
      if (!nowCollapsed) this.loadSessionActivity();
    });
    if (!collapsed) this.loadSessionActivity();
  }

  startSessionActivityPolling() {
    this.sessionActivityInterval = setInterval(() => {
      this.loadSessionActivity();
    }, 60000);
  }

  disableContextMenu() {
    this.contextMenuHandler = (e) => e.preventDefault();
    document.addEventListener("contextmenu", this.contextMenuHandler);
  }

  enableContextMenu() {
    if (this.contextMenuHandler) {
      document.removeEventListener("contextmenu", this.contextMenuHandler);
      this.contextMenuHandler = null;
    }
  }

  async bindSessionEvents(onComplete) {
    const actionBtn = this.container.querySelector("#action-button");
    const powerBtn = this.container.querySelector("#power-btn");
    const restartBtn = this.container.querySelector("#restart-btn");
    const sleepBtn = this.container.querySelector("#sleep-btn");
    const avatarModal = this.container.querySelector("#avatar-edit-modal");
    const avatarModalClose = this.container.querySelector("#avatar-modal-close");
    const avatarGrid = this.container.querySelector("#avatar-grid");
    const infoBtn = this.container.querySelector("#session-info-btn");
    const infoModal = this.container.querySelector("#session-info-modal");
    const bootPreviewBtn = this.container.querySelector("#session-boot-preview-btn");
    const bootPreviewModal = this.container.querySelector("#session-boot-preview-modal");
    const bootPreviewList = this.container.querySelector("#boot-preview-list");
    const supportBtn = this.container.querySelector("#session-support-btn");
    const electronBanner = this.container.querySelector("#session-electron-banner");

    const showBootModal = () => {
      bootPreviewModal.style.display = "block";
      if (electronBanner) {
        electronBanner.classList.add("session-electron-banner--hidden");
        electronBanner.classList.remove("session-electron-banner--reveal");
      }
    };

    const hideBootModal = () => {
      bootPreviewModal.style.display = "none";
      if (electronBanner) {
        electronBanner.classList.remove("session-electron-banner--hidden");
      }
    };

    const savedAnimId = os.storage.get(StorageKeys.selectedBootAnimation);
    BOOT_ANIMATIONS.forEach((anim) => {
      const item = document.createElement("div");
      item.className = "boot-preview-option";
      if (anim.id === savedAnimId) item.classList.add("selected");
      item.innerHTML = `<span>${anim.label || anim.id}</span><i class="fas fa-check"></i>`;
      item.addEventListener("click", () => {
        const wasSelected = item.classList.contains("selected");
        bootPreviewList.querySelectorAll(".boot-preview-option").forEach((el) => el.classList.remove("selected"));
        if (!wasSelected) {
          item.classList.add("selected");
          os.storage.set(StorageKeys.selectedBootAnimation, anim.id);
          os.events.emit(BusEvents.ACHIEVEMENT_TRIGGER, { achievementId: Achievements.BootStyler });
        } else {
          os.storage.remove(StorageKeys.selectedBootAnimation);
        }
        hideBootModal();
        runBootPreview(anim);
      });
      bootPreviewList.appendChild(item);
    });

    let selectedAvatar = this.selectedUser.avatar;

    const handleAction = async () => {
      if (actionBtn.disabled) return;
      if (this.signingIn) return;

      if (this.sessionState !== "locked") {
        if (!this.selectedUser) return;
        actionBtn.disabled = true;
        actionBtn.innerHTML = `Signing in... <i class="fas fa-spinner fa-spin"></i>`;
      }

      this.signingIn = true;
      try {
        await this.signInAndExit();
      } catch (e) {
        console.error("Session init failed:", e);
        actionBtn.disabled = false;
        actionBtn.innerHTML = `Sign in`;
        os.dialog.alert("Session Error", e?.message || String(e));
      } finally {
        this.signingIn = false;
      }
    };

    actionBtn.addEventListener("click", handleAction);

    this.container.addEventListener("click", (e) => {
      if (e.target.closest("#avatar-edit-btn")) {
        avatarModal.style.display = "flex";
      }
    });

    avatarModalClose.addEventListener("click", () => {
      avatarModal.style.display = "none";
    });

    avatarModal.addEventListener("click", (e) => {
      if (e.target === avatarModal) {
        avatarModal.style.display = "none";
      }
    });

    avatarGrid.addEventListener("click", async (e) => {
      const tile = e.target.closest(".avatar-tile");
      if (!tile) return;

      avatarGrid.querySelectorAll(".avatar-tile").forEach((t) => t.classList.remove("active"));
      tile.classList.add("active");
      selectedAvatar = tile.dataset.url;

      this.selectedUser.avatar = selectedAvatar;
      await this.selectCarouselUser(this.selectedUser.key, this.selectedUser.name, selectedAvatar);
      avatarModal.style.display = "none";
    });

    const rememberCheckbox = this.container.querySelector("#remember-checkbox");
    if (rememberCheckbox) {
      rememberCheckbox.addEventListener("change", () => {
        if (rememberCheckbox.checked) {
          os.storage.set(StorageKeys.autoLogin, "true");
        } else {
          os.storage.remove(StorageKeys.autoLogin);
        }
      });
    }

    powerBtn.addEventListener("click", async () => {
      if (await os.dialog.confirm("Shutdown", `Shut down ${brand("YukiOS")}?`)) {
        window.close();
      }
    });

    restartBtn.addEventListener("click", async () => {
      if (await os.dialog.confirm("Restart", `Restart ${brand("YukiOS")}?`)) {
        location.reload();
      }
    });

    sleepBtn.addEventListener("click", () => {
      this.enterSleepMode();
    });

    infoBtn.addEventListener("click", () => {
      hideBootModal();
      const isVisible = infoModal.style.display !== "none";
      infoModal.style.display = isVisible ? "none" : "block";
    });

    bootPreviewBtn.addEventListener("click", () => {
      infoModal.style.display = "none";
      const isVisible = bootPreviewModal.style.display !== "none";
      if (isVisible) {
        hideBootModal();
      } else {
        showBootModal();
      }
    });

    document.addEventListener("click", (e) => {
      if (!infoBtn.contains(e.target) && !infoModal.contains(e.target)) {
        infoModal.style.display = "none";
      }
      if (!bootPreviewBtn.contains(e.target) && !bootPreviewModal.contains(e.target)) {
        hideBootModal();
      }
    });

    const sessionModes = this.container.querySelectorAll("#session-modes .session-mode-btn");
    const modeToSession = {
      reset: "Yuki Desktop(Default)",
      mac: "Yuki Mac Desktop",
      chromeos: "Yuki Chrome OS",
      tiling: "Yuki Tiling VM",
      "3d": "Yuki 3D Desktop"
    };
    const sessionToMode = {
      "Yuki Desktop(Default)": "reset",
      "Yuki Mac Desktop": "mac",
      "Yuki Chrome OS": "chromeos",
      "Yuki Tiling VM": "tiling",
      "Yuki 3D Desktop": "3d",
      tiling: "tiling"
    };
    const activeMode = sessionToMode[this.selectedSession] || "reset";
    sessionModes.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === activeMode);
      btn.addEventListener("click", () => {
        this.selectedSession = modeToSession[btn.dataset.mode];
        os.storage.set(StorageKeys.selectedSession, this.selectedSession);
        sessionModes.forEach((b) => b.classList.toggle("active", b === btn));
      });
    });
    await this.bindCarouselEvents();

    const electronDownloadBtn = this.container.querySelector("#electron-download-btn");
    if (electronDownloadBtn) {
      electronDownloadBtn.addEventListener("click", () => this.handleElectronDownload());
    }

    if (supportBtn) supportBtn.addEventListener("click", () => showDonationPopup());

    this.keyboardHandler = (e) => this.handleKeyboardNav(e, handleAction);
    document.addEventListener("keydown", this.keyboardHandler);
  }

  async handleElectronDownload() {
    const btn = document.getElementById("electron-download-btn");
    if (!btn) return;
    const originalText = btn.innerHTML;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Detecting...`;
    btn.style.pointerEvents = "none";
    btn.style.opacity = "0.6";

    try {
      const resp = await fetch("https://api.github.com/repos/reeyuki/yukios/releases/latest", {
        headers: { Accept: "application/vnd.github.v3+json" }
      });
      if (!resp.ok) throw new Error(`GitHub API returned ${resp.status}`);
      const release = await resp.json();

      const os = this.detectElectronOS();
      const asset = release.assets.find((a) => {
        const name = a.name.toLowerCase();
        if (os === "win") return name.endsWith(".exe") || name.endsWith(".exe");
        if (os === "mac") return name.endsWith(".dmg");
        if (os === "linux") return name.endsWith(".appimage");
        return false;
      });

      if (!asset) {
        window.open(release.html_url, "_blank");
        return;
      }

      btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Downloading...`;
      const a = document.createElement("a");
      a.href = asset.browser_download_url;
      a.download = asset.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      btn.innerHTML = `<i class="fas fa-check"></i> Downloaded`;
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.pointerEvents = "";
        btn.style.opacity = "";
      }, 3000);
    } catch (e) {
      btn.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Failed`;
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.pointerEvents = "";
        btn.style.opacity = "";
      }, 3000);
      window.open("https://github.com/reeyuki/yukios/releases", "_blank");
    }
  }

  detectElectronOS() {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("win") || ua.includes("windows")) return "win";
    if (ua.includes("mac") || ua.includes("darwin")) return "mac";
    if (ua.includes("linux")) return "linux";
    return "win";
  }

  async bindCarouselEvents() {
    await this.bindCarouselTileEvents();

    const carousel = this.container.querySelector("#user-carousel-row");
    const selectedTile = carousel?.querySelector(".user-carousel-tile.selected");
    if (selectedTile) {
      setTimeout(() => selectedTile.scrollIntoView({ behavior: "instant", inline: "center", block: "nearest" }), 50);
    }
  }

  async bindCarouselTileEvents() {
    const carousel = this.container.querySelector("#user-carousel-row");
    if (!carousel) return;

    carousel.querySelectorAll(".user-carousel-tile").forEach((tile) => {
      tile.addEventListener("click", (e) => {
        const avatarClicked = e.target.closest(".carousel-avatar-wrap");
        const isSelected = tile.classList.contains("selected");

        if (avatarClicked && isSelected) {
          const avatarModal = this.container.querySelector("#avatar-edit-modal");
          avatarModal.style.display = "flex";
          return;
        }

        this.selectCarouselUser(tile.dataset.key, tile.dataset.name, tile.dataset.avatar);
      });
    });
  }
  async selectCarouselUser(key, name, avatar) {
    this.selectedUser = { key, name, avatar };

    os.storage.set(StorageKeys.userId, key);
    os.storage.set(StorageKeys.username, name);
    os.storage.set(StorageKeys.profilePicture, avatar);

    const existingIndex = this.userHistory.findIndex((u) => u.key === key || u.userId === key);
    if (existingIndex >= 0) {
      this.userHistory[existingIndex].avatar = avatar;
      this.userHistory[existingIndex].name = name;
      this.userHistory[existingIndex].userId = key;
    } else {
      this.userHistory.unshift({ userId: key, key, name, avatar, lastLogin: Date.now() });
    }
    this.saveUserHistory();

    const carousel = this.container.querySelector("#user-carousel-row");
    if (carousel) {
      carousel.innerHTML = await this.renderUserCarousel();
      this.bindCarouselTileEvents();

      const selectedTile = carousel.querySelector(".user-carousel-tile.selected");
      if (selectedTile) {
        selectedTile.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }

      const newEditBtn = carousel.querySelector("#avatar-edit-btn");
      if (newEditBtn) {
        const avatarModal = this.container.querySelector("#avatar-edit-modal");
        newEditBtn.addEventListener("click", () => {
          avatarModal.style.display = "flex";
        });
      }
    }

    const actionBtn = this.container?.querySelector("#action-button");
    if (actionBtn) {
      actionBtn.classList.add("transitioning-out");
      await new Promise((r) => setTimeout(r, 100));
      this.updateActionButtonText();
      actionBtn.classList.remove("transitioning-out");
      actionBtn.classList.add("transitioning-in");
      await new Promise((r) => setTimeout(r, 150));
      actionBtn.classList.remove("transitioning-in");
    } else {
      this.updateActionButtonText();
    }
  }

  async handleKeyboardNav(e, handleAction) {
    if (KeybindManager.matches(e, "session.confirm")) {
      e.preventDefault();
      handleAction();
    } else if (KeybindManager.matches(e, "session.cancel")) {
      const avatarModal = this.container.querySelector("#avatar-edit-modal");
      if (avatarModal && avatarModal.style.display !== "none") {
        avatarModal.style.display = "none";
      } else {
        this.hideExtraElements();
      }
    } else if (
      KeybindManager.matches(e, "session.navigateLeft") ||
      KeybindManager.matches(e, "session.navigateRight")
    ) {
      const users = this.userHistory.length > 0 ? this.userHistory : [this.selectedUser];
      if (users.length < 2) return;

      const currentIndex = users.findIndex((u) => u.key === this.selectedUser?.key);
      const direction = KeybindManager.matches(e, "session.navigateRight") ? 1 : -1;
      const nextIndex = (currentIndex + direction + users.length) % users.length;
      const next = users[nextIndex];

      await this.selectCarouselUser(next.key, next.name, next.avatar);
    }
  }

  async initializeSession() {
    const { name, key, avatar } = this.currentSession;

    os.storage.set(StorageKeys.userId, key);
    os.storage.set(StorageKeys.username, name);
    os.storage.set(StorageKeys.lastLaunchTime, Date.now().toString());
    if (!os.storage.get(StorageKeys.firstLaunchTime)) {
      const lastLaunch = os.storage.get(StorageKeys.lastLaunchTime);
      os.storage.set(StorageKeys.firstLaunchTime, lastLaunch || Date.now().toString());
    }
    this.addToUserHistory(this.currentSession);

    if (this.selectedSession !== "Yuki 3D Desktop") {
      await os.fs.setSession(name);
    }

    os.events.emit(BusEvents.SESSION_INITIALIZED, this.currentSession);
    if (wasRandomYuriTrigger()) {
      os.notify.send("YuriOS", "Random chance triggered YuriOS! Pink mode has appeared.", {
        type: "info",
        duration: 6000,
        icon: "fas fa-heart"
      });
    }
    liveActivityManager.init();

    if (this.selectedSession === "Yuki Mac Desktop") {
      applyMacSettings();
    } else {
      disableMacSettings();
    }

    if (this.selectedSession === "Yuki Tiling VM" || this.selectedSession === "tiling") {
      applyTilingSettings();
    } else {
      disableTilingSettings();
    }

    if (this.selectedSession === "Yuki Chrome OS") {
      applyChromeOsSettings();
    } else {
      disableChromeOsSettings();
    }

    if (this.selectedSession === "Yuki 3D Desktop") {
      await this.apply3DSettings();
    } else {
      this.disable3DSettings();
    }

    os.window.setFileSystemManager(os.fileSystemManager);
    setTimeout(() => os.window.restoreSession(), 500);

    if (this.selectedSession === "Yuki Desktop(Default)") {
      audioMixer().playSystemSound(SystemAudio.START);
    }

    if (!os.storage.get(StorageKeys.setupCompleted)) {
      const setupApp = this.os.app.getInstance("setupApp");
      if (setupApp) setTimeout(() => setupApp.open(), 1000);
    }

    this.launchStartupApps();

    this.startIdleDetection();
  }

  async apply3DSettings() {
    modeManager.enter(MODES["3D"]);
    const app = this.os.app.getInstance("room3dApp");
    if (app) {
      try {
        await app.launchSystemMode(() => {
          this.disable3DSettings();
        });
      } catch (e) {
        console.error("3D room launch failed:", e);
        this.disable3DSettings();
      }
    }
  }

  disable3DSettings() {
    modeManager.exit(MODES["3D"]);
    const app = this.os.app.getInstance("room3dApp");
    if (app) {
      app.exitSystemMode();
    }
  }

  launchStartupApps() {
    try {
      const startupApps = os.storage.get(StorageKeys.startupApps);
      if (!startupApps || !Array.isArray(startupApps) || startupApps.length === 0) return;
      const delay = 800;
      startupApps.forEach((appId, i) => {
        setTimeout(
          () => {
            os.app.launch(appId).catch(() => {});
          },
          (i + 1) * delay
        );
      });
    } catch {}
  }

  lockToLoginScreen() {
    if (this.isLocked) return;
    this.isLocked = true;

    if (this.onlineUsersInterval) {
      clearInterval(this.onlineUsersInterval);
      this.onlineUsersInterval = null;
    }

    audioMixer().playSystemSound(SystemAudio.SHUTDOWN);

    os.window.closeAll();

    const startMenu = document.getElementById("start-menu");
    if (startMenu) {
      startMenu.style.display = "none";
      startMenu.classList.remove("closing");
    }

    return new Promise(async (resolve) => {
      await this.createSessionUI("login", (session) => {
        this.isLocked = false;
        resolve(session);
      });
    });
  }

  async lockSession() {
    if (!this.currentSession || this.isLocked) return;
    this.isLocked = true;
    this.stopIdleDetection();

    this.lastActiveWindow = $(".window.active") || null;

    await this.createSessionUI("locked", null);

    os.events.emit(BusEvents.SYSTEM_LOCKED, {});
  }

  unlockSession() {
    if (!this.isLocked) return;
    this.isLocked = false;

    if (this.container) {
      this.container.classList.add("exit");
      setTimeout(() => {
        this.container.remove();
        this.container = null;
        this.enableContextMenu();
        if (this.keyboardHandler) {
          document.removeEventListener("keydown", this.keyboardHandler);
          this.keyboardHandler = null;
        }
      }, 500);
    }

    if (this.timeWorkerUnsub) {
      this.timeWorkerUnsub();
      this.timeWorkerUnsub = null;
    }

    if (this.uptimeInterval) {
      clearInterval(this.uptimeInterval);
      this.uptimeInterval = null;
    }

    if (this.onlineUsersInterval) {
      clearInterval(this.onlineUsersInterval);
      this.onlineUsersInterval = null;
    }

    if (this.lastActiveWindow) {
      os.window.bringToFront(this.lastActiveWindow);
    }
    this.lastActiveWindow = null;

    this.startIdleDetection();

    os.events.emit(BusEvents.SYSTEM_UNLOCKED, {});
  }

  enterSleepMode() {
    if (!this.container || this.container.classList.contains("sleep")) return;

    this.container.classList.add("sleep");

    const sleepOverlay = document.createElement("div");
    sleepOverlay.className = "sleep-overlay";
    sleepOverlay.id = "sleep-overlay";
    this.container.appendChild(sleepOverlay);

    const wakeLayer = document.createElement("div");
    wakeLayer.className = "sleep-wake-layer";
    wakeLayer.id = "sleep-wake-layer";
    this.container.appendChild(wakeLayer);

    const wallpaper = this.container.querySelector(".session-wallpaper");
    if (wallpaper && wallpaper.tagName === "VIDEO") {
      wallpaper.pause();
    }

    if (this.timeWorkerUnsub) {
      this.timeWorkerUnsub();
      this.timeWorkerUnsub = null;
    }

    const wakeHandler = () => {
      this.exitSleepMode();
      wakeLayer.removeEventListener("mousemove", wakeHandler);
      wakeLayer.removeEventListener("mousedown", wakeHandler);
      wakeLayer.removeEventListener("keydown", wakeHandler);
    };

    wakeLayer.addEventListener("mousemove", wakeHandler);
    wakeLayer.addEventListener("mousedown", wakeHandler);
    wakeLayer.addEventListener("keydown", wakeHandler);
  }

  exitSleepMode() {
    if (!this.container) return;

    this.container.classList.remove("sleep");

    const sleepOverlay = this.container.querySelector("#sleep-overlay");
    if (sleepOverlay) {
      sleepOverlay.remove();
    }

    const wakeLayer = this.container.querySelector("#sleep-wake-layer");
    if (wakeLayer) {
      wakeLayer.remove();
    }

    const wallpaper = this.container.querySelector(".session-wallpaper");
    if (wallpaper && wallpaper.tagName === "VIDEO") {
      wallpaper.play();
    }

    this.startClock();
  }

  setupDragVisibility() {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    const dragThreshold = 10;

    const handleMouseDown = (e) => {
      isDragging = false;
      startX = e.clientX;
      startY = e.clientY;
    };

    const handleMouseMove = (e) => {
      if (!isDragging) {
        const deltaX = Math.abs(e.clientX - startX);
        const deltaY = Math.abs(e.clientY - startY);
        if (deltaX > dragThreshold || deltaY > dragThreshold) {
          isDragging = true;
          this.showExtraElements();
        }
      }
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    this.container.addEventListener("mousedown", handleMouseDown);
    this.container.addEventListener("mousemove", handleMouseMove);
    this.container.addEventListener("mouseup", handleMouseUp);
    this.container.addEventListener("mouseleave", handleMouseUp);
  }

  startIdleDetection() {
    if (this.idleTimer) return;
    this.resetIdleTimer();
    document.addEventListener("mousemove", this.boundResetIdle, { passive: true });
    document.addEventListener("mousedown", this.boundResetIdle, { passive: true });
    document.addEventListener("keydown", this.boundResetIdle, { passive: true });
    document.addEventListener("touchstart", this.boundResetIdle, { passive: true });
    document.addEventListener("scroll", this.boundResetIdle, { passive: true });
  }

  stopIdleDetection() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    document.removeEventListener("mousemove", this.boundResetIdle);
    document.removeEventListener("mousedown", this.boundResetIdle);
    document.removeEventListener("keydown", this.boundResetIdle);
    document.removeEventListener("touchstart", this.boundResetIdle);
    document.removeEventListener("scroll", this.boundResetIdle);
  }

  handleActivity() {
    if (!this.currentSession) return;
    this.resetIdleTimer();
  }

  resetIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    this.idleTimer = setTimeout(() => {
      this.lockSession();
    }, this.IDLE_TIMEOUT);
  }

  showExtraElements() {
    const content = this.container.querySelector(".session-content");
    if (content && content.classList.contains("extra-hidden")) {
      content.classList.remove("extra-hidden");
      content.classList.add("extra-visible");
    }
  }

  hideExtraElements() {
    const content = this.container.querySelector(".session-content");
    if (content && content.classList.contains("extra-visible")) {
      content.classList.remove("extra-visible");
      content.classList.add("extra-hidden");
    }
  }
}
