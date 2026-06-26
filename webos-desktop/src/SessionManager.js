import { BusEvents } from "./core/EventBus.js";
import { PREDEFINED_AVATARS } from "./utils/avatarData.js";
import { SystemUtilities } from "./system.js";
import { audioMixer, SystemAudio } from "./audioMixer.js";
import { YUKIOS_VERSION } from "./apps/about.js";
import { resolveAvatarUrl } from "./shared/avatarResolver.js";
import { $ } from "./shared/domUtils.js";

import { StorageKeys, os } from "./framework.js";
import { KeybindManager } from "./keybindManager.js";
function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class SessionManager {
  constructor(services) {
    this.services = services;
    this.currentSession = null;
    this.container = null;
    this.isLocked = false;
    this.timeInterval = null;
    this.userHistory = this._loadUserHistory();
    this.sessionState = "login";
    this.selectedUser = null;
    this.selectedSession = os.storage.get(StorageKeys.selectedSession) || "Yuki Desktop";
    this._ensureUserId();
    this._setupProfileUpdateListener();
    this.startTime = Date.now();
    this.uptimeInterval = null;
    this.contextMenuHandler = null;
    this.keyboardHandler = null;
    this.IDLE_TIMEOUT = 15 * 60 * 1000;
    this._idleTimer = null;
    this._boundResetIdle = this._handleActivity.bind(this);
  }

  _ensureUserId() {
    let userId = os.storage.get(StorageKeys.userId);
    if (!userId) {
      userId = generateUUID();
      os.storage.set(StorageKeys.userId, userId);
    }
    return userId;
  }

  _setupProfileUpdateListener() {
    os.events.on(BusEvents.PROFILE_UPDATED, (data) => {
      this._handleProfileUpdate(data);
    });
  }

  async _handleProfileUpdate(data) {
    const { userId, name, avatar } = data;

    const existingIndex = this.userHistory.findIndex((u) => u.key === userId || u.userId === userId);
    if (existingIndex >= 0) {
      this.userHistory[existingIndex].name = name;
      this.userHistory[existingIndex].avatar = avatar;
      this._saveUserHistory();
    }

    if (this.container) {
      const carousel = this.container.querySelector("#user-carousel-row");
      if (carousel) {
        carousel.innerHTML = await this._renderUserCarousel();
        this._bindCarouselTileEvents();
      }
    }
  }

  _loadUserHistory() {
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
        this._saveUserHistory();
      }

      return migratedHistory;
    } catch (e) {
      return [];
    }
  }

  _saveUserHistory() {
    try {
      os.storage.set(StorageKeys.userHistory, this.userHistory);
    } catch (e) {}
  }

  _addToUserHistory(session) {
    const userKey = session.key || this._ensureUserId();
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
    this._saveUserHistory();
  }

  async showLogin() {
    const lastLaunch = os.storage.get(StorageKeys.lastLaunchTime);
    const now = Date.now();
    os.storage.set(StorageKeys.lastLaunchTime, now.toString());

    return new Promise(async (resolve) => {
      await this._createSessionUI("login", resolve);
    });
  }

  async _createSessionUI(state, onComplete) {
    if (document.getElementById("session-overlay")) return;

    this.sessionState = state;
    this.container = document.createElement("div");
    this.container.id = "session-overlay";
    this.container.className = "session-overlay";

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const dateStr = now.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });

    const lastUsername = os.storage.get(StorageKeys.username) || "";
    const lastAvatarRef = os.storage.get(StorageKeys.profilePicture) || PREDEFINED_AVATARS[0];
    const displayName = lastUsername || "Guest";
    const userId = this._ensureUserId();

    this.userHistory = this._loadUserHistory();

    const primaryUser = { name: displayName, key: userId, avatar: lastAvatarRef, userId: userId };

    const allUsers = this.userHistory.length > 0 ? this.userHistory : [primaryUser];
    const selectedKey = this.userHistory.length > 0 ? this.userHistory[0].key : primaryUser.key;
    this.selectedUser = allUsers.find((u) => u.key === selectedKey) || allUsers[0];

    this.container.innerHTML = `
      <div class="session-wallpaper"></div>
      <div class="session-background"></div>
      <div class="session-content${state === "locked" ? "" : " extra-hidden"}">
        <div class="session-info-btn" id="session-info-btn">
          <i class="fas fa-info"></i>
        </div>
        <div class="session-info-modal" id="session-info-modal" style="display: none;">
          <div class="info-modal-content">
            <div class="info-modal-header">
              <h3>System Info</h3>
            </div>
            <div class="info-modal-body">
              <div class="info-row">
                <span class="info-label">Version</span>
                <span class="info-value">YukiOS ${YUKIOS_VERSION}</span>
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
        <div class="session-time">${timeStr}</div>
        <div class="session-date">${dateStr}</div>

        <div class="user-carousel-row" id="user-carousel-row"></div>

        <div class="login-center-panel">
          <button class="action-button" id="action-button">
            ${this._getActionButtonText()}
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
        </div>

        <div class="session-selector" id="session-selector">
          <button class="session-selector-btn" id="session-selector-btn">
            <i class="fas fa-desktop"></i>
            <span id="session-selector-label">${this.selectedSession}</span>
            <i class="fas fa-chevron-down"></i>
          </button>

          <div class="session-dropdown" id="session-dropdown">
            <div class="session-option" data-value="desktop">Yuki Desktop</div>
            <div class="session-option" data-value="tiling">Yuki Tiling WM</div>
          </div>
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
      </div>
    `;

    document.body.appendChild(this.container);

    const carouselRow = this.container.querySelector("#user-carousel-row");
    if (carouselRow) {
      carouselRow.innerHTML = await this._renderUserCarousel();
    }

    await this._applySessionWallpaper(this.container);
    await this._bindSessionEvents(onComplete);
    this._startClock();
    this._startUptimeCounter();
    this._disableContextMenu();
    this._setupDragVisibility();
  }

  async _renderUserCarousel() {
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

  _getActionButtonText() {
    if (this.sessionState === "locked") return "Unlock";
    if (this.sessionState === "login") {
      return this.selectedUser ? "Sign in" : "Select User";
    }
    return "Start Session";
  }

  _updateActionButtonText() {
    const actionBtn = this.container?.querySelector("#action-button");
    if (actionBtn) {
      actionBtn.innerHTML = this._getActionButtonText();
    }
  }

  _renderUserTile(user) {
    const lastLoginDate = new Date(user.lastLogin);
    const timeAgo = this._formatTimeAgo(lastLoginDate);

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

  _formatTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  async _applySessionWallpaper(container) {
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

  _startClock() {
    this.timeInterval = setInterval(() => {
      if (!this.container) {
        clearInterval(this.timeInterval);
        return;
      }
      const timeEl = this.container.querySelector(".session-time");
      if (timeEl) {
        const d = new Date();
        timeEl.textContent = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      }
    }, 1000 * 60);
  }

  _startUptimeCounter() {
    this.uptimeInterval = setInterval(() => {
      if (!this.container) {
        clearInterval(this.uptimeInterval);
        return;
      }
      const uptimeEl = this.container.querySelector("#uptime-display");
      if (uptimeEl) {
        const uptime = Date.now() - this.startTime;
        uptimeEl.textContent = this._formatUptime(uptime);
      }
    }, 1000);
  }

  _formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  _disableContextMenu() {
    this.contextMenuHandler = (e) => e.preventDefault();
    document.addEventListener("contextmenu", this.contextMenuHandler);
  }

  _enableContextMenu() {
    if (this.contextMenuHandler) {
      document.removeEventListener("contextmenu", this.contextMenuHandler);
      this.contextMenuHandler = null;
    }
  }

  async _bindSessionEvents(onComplete) {
    const actionBtn = this.container.querySelector("#action-button");
    const powerBtn = this.container.querySelector("#power-btn");
    const restartBtn = this.container.querySelector("#restart-btn");
    const sleepBtn = this.container.querySelector("#sleep-btn");
    const sessionSelectorBtn = this.container.querySelector("#session-selector-btn");
    const avatarModal = this.container.querySelector("#avatar-edit-modal");
    const avatarModalClose = this.container.querySelector("#avatar-modal-close");
    const avatarGrid = this.container.querySelector("#avatar-grid");
    const infoBtn = this.container.querySelector("#session-info-btn");
    const infoModal = this.container.querySelector("#session-info-modal");

    let selectedAvatar = this.selectedUser.avatar;

    const handleAction = async () => {
      if (actionBtn.disabled) return;

      if (this.sessionState === "locked") {
        this.unlockSession();
        if (onComplete) onComplete(this.currentSession);
        return;
      }

      if (!this.selectedUser) return;

      if (this.selectedSession === "Yuki Tiling VM" || this.selectedSession === "tiling") {
        await os.dialog.alert("Not Implemented", "Tiling VM isn't ready yet");
        return;
      }

      this.currentSession = {
        name: this.selectedUser.name,
        key: this.selectedUser.key,
        avatar: this.selectedUser.avatar
      };

      actionBtn.disabled = true;
      actionBtn.innerHTML = `Signing in... <i class="fas fa-spinner fa-spin"></i>`;

      await this._initializeSession();

      this.container.classList.add("exit");

      setTimeout(() => {
        this.container.remove();
        this._enableContextMenu();
        if (this.keyboardHandler) {
          document.removeEventListener("keydown", this.keyboardHandler);
          this.keyboardHandler = null;
        }
        if (onComplete) onComplete(this.currentSession);
      }, 500);
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
      await this._selectCarouselUser(this.selectedUser.key, this.selectedUser.name, selectedAvatar);
      avatarModal.style.display = "none";
    });

    powerBtn.addEventListener("click", async () => {
      if (await os.dialog.confirm("Shutdown", "Shut down YukiOS?")) {
        window.close();
      }
    });

    restartBtn.addEventListener("click", async () => {
      if (await os.dialog.confirm("Restart", "Restart YukiOS?")) {
        location.reload();
      }
    });

    sleepBtn.addEventListener("click", () => {
      this._enterSleepMode();
    });

    infoBtn.addEventListener("click", () => {
      const isVisible = infoModal.style.display !== "none";
      infoModal.style.display = isVisible ? "none" : "block";
    });

    document.addEventListener("click", (e) => {
      if (!infoBtn.contains(e.target) && !infoModal.contains(e.target)) {
        infoModal.style.display = "none";
      }
    });

    sessionSelectorBtn.value = this.selectedSession === "tiling" ? "Yuki Tiling WM" : "Yuki Desktop";
    sessionSelectorBtn.addEventListener("change", (e) => {
      const value = e.target.value;

      this.selectedSession = value === "tiling" ? "Yuki Tiling VM" : "Yuki Desktop";
      os.storage.set(StorageKeys.selectedSession, this.selectedSession);
    });
    const sessionRoot = this.container.querySelector("#session-selector");
    const sessionBtn = this.container.querySelector("#session-selector-btn");
    const dropdown = this.container.querySelector("#session-dropdown");
    const label = this.container.querySelector("#session-selector-label");

    const toggle = () => {
      sessionRoot.classList.toggle("open");
    };

    sessionBtn.addEventListener("click", toggle);

    dropdown.addEventListener("click", (e) => {
      const option = e.target.closest(".session-option");
      if (!option) return;

      const value = option.dataset.value;

      const sessionMap = {
        desktop: "Yuki Desktop",
        tiling: "Yuki Tiling VM"
      };

      const labelText = sessionMap[value];

      this.selectedSession = labelText;
      os.storage.set(StorageKeys.selectedSession, this.selectedSession);
      label.textContent = labelText;

      sessionRoot.classList.remove("open");
    });

    document.addEventListener("click", (e) => {
      if (!sessionRoot.contains(e.target)) {
        sessionRoot.classList.remove("open");
      }
    });
    await this._bindCarouselEvents();

    this.keyboardHandler = (e) => this._handleKeyboardNav(e, handleAction);
    document.addEventListener("keydown", this.keyboardHandler);
  }

  async _bindCarouselEvents() {
    await this._bindCarouselTileEvents();

    const carousel = this.container.querySelector("#user-carousel-row");
    const selectedTile = carousel?.querySelector(".user-carousel-tile.selected");
    if (selectedTile) {
      setTimeout(() => selectedTile.scrollIntoView({ behavior: "instant", inline: "center", block: "nearest" }), 50);
    }
  }

  async _bindCarouselTileEvents() {
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

        this._selectCarouselUser(tile.dataset.key, tile.dataset.name, tile.dataset.avatar);
      });
    });
  }
  async _selectCarouselUser(key, name, avatar) {
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
    this._saveUserHistory();

    const carousel = this.container.querySelector("#user-carousel-row");
    if (carousel) {
      carousel.innerHTML = await this._renderUserCarousel();
      this._bindCarouselTileEvents();

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

    this._updateActionButtonText();
  }

  async _handleKeyboardNav(e, handleAction) {
    if (KeybindManager.matches(e, "session.confirm")) {
      e.preventDefault();
      handleAction();
    } else if (KeybindManager.matches(e, "session.cancel")) {
      const avatarModal = this.container.querySelector("#avatar-edit-modal");
      if (avatarModal && avatarModal.style.display !== "none") {
        avatarModal.style.display = "none";
      } else {
        this._hideExtraElements();
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

      await this._selectCarouselUser(next.key, next.name, next.avatar);
    }
  }

  async _initializeSession() {
    const { name, key, avatar } = this.currentSession;

    os.storage.set(StorageKeys.userId, key);
    os.storage.set(StorageKeys.username, name);
    os.storage.set(StorageKeys.lastLaunchTime, Date.now().toString());
    this._addToUserHistory(this.currentSession);

    if (this.services.fileSystemManager) {
      await this.services.fileSystemManager.setSession(key);
    }

    os.events.emit(BusEvents.SESSION_INITIALIZED, this.currentSession);

    if (this.services.windowManager) {
      this.services.windowManager.setFileSystemManager(this.services.fileSystemManager);
      setTimeout(() => this.services.windowManager.restoreSession(), 500);
    }

    audioMixer().playSystemSound(SystemAudio.START);

    if (!os.storage.get(StorageKeys.setupCompleted) && this.services.setupApp) {
      setTimeout(() => this.services.setupApp.open(), 1000);
    }

    this._startIdleDetection();
  }

  lockToLoginScreen() {
    if (this.isLocked) return;
    this.isLocked = true;

    audioMixer().playSystemSound(SystemAudio.SHUTDOWN);

    if (this.services.windowManager && typeof this.services.windowManager.closeAll === "function") {
      this.services.windowManager.closeAll();
    }

    const startMenu = document.getElementById("start-menu");
    if (startMenu) {
      startMenu.style.display = "none";
      startMenu.classList.remove("closing");
    }

    return new Promise(async (resolve) => {
      await this._createSessionUI("login", (session) => {
        this.isLocked = false;
        resolve(session);
      });
    });
  }

  async lockSession() {
    if (!this.currentSession || this.isLocked) return;
    this.isLocked = true;
    this._stopIdleDetection();

    this.lastActiveWindow = $(".window.active") || null;

    await this._createSessionUI("locked", null);

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
        this._enableContextMenu();
        if (this.keyboardHandler) {
          document.removeEventListener("keydown", this.keyboardHandler);
          this.keyboardHandler = null;
        }
      }, 500);
    }

    if (this.timeInterval) {
      clearInterval(this.timeInterval);
      this.timeInterval = null;
    }

    if (this.uptimeInterval) {
      clearInterval(this.uptimeInterval);
      this.uptimeInterval = null;
    }

    if (this.lastActiveWindow && this.services.windowManager) {
      this.services.windowManager.bringToFront(this.lastActiveWindow);
    }
    this.lastActiveWindow = null;

    this._startIdleDetection();

    os.events.emit(BusEvents.SYSTEM_UNLOCKED, {});
  }

  _enterSleepMode() {
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

    if (this.timeInterval) {
      clearInterval(this.timeInterval);
    }

    const wakeHandler = () => {
      this._exitSleepMode();
      wakeLayer.removeEventListener("mousemove", wakeHandler);
      wakeLayer.removeEventListener("mousedown", wakeHandler);
      wakeLayer.removeEventListener("keydown", wakeHandler);
    };

    wakeLayer.addEventListener("mousemove", wakeHandler);
    wakeLayer.addEventListener("mousedown", wakeHandler);
    wakeLayer.addEventListener("keydown", wakeHandler);
  }

  _exitSleepMode() {
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

    this._startClock();
  }

  _setupDragVisibility() {
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
          this._showExtraElements();
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

  _startIdleDetection() {
    if (this._idleTimer) return;
    this._resetIdleTimer();
    document.addEventListener("mousemove", this._boundResetIdle, { passive: true });
    document.addEventListener("mousedown", this._boundResetIdle, { passive: true });
    document.addEventListener("keydown", this._boundResetIdle, { passive: true });
    document.addEventListener("touchstart", this._boundResetIdle, { passive: true });
    document.addEventListener("scroll", this._boundResetIdle, { passive: true });
  }

  _stopIdleDetection() {
    if (this._idleTimer) {
      clearTimeout(this._idleTimer);
      this._idleTimer = null;
    }
    document.removeEventListener("mousemove", this._boundResetIdle);
    document.removeEventListener("mousedown", this._boundResetIdle);
    document.removeEventListener("keydown", this._boundResetIdle);
    document.removeEventListener("touchstart", this._boundResetIdle);
    document.removeEventListener("scroll", this._boundResetIdle);
  }

  _handleActivity() {
    if (!this.currentSession) return;
    this._resetIdleTimer();
  }

  _resetIdleTimer() {
    if (this._idleTimer) {
      clearTimeout(this._idleTimer);
    }
    this._idleTimer = setTimeout(() => {
      this.lockSession();
    }, this.IDLE_TIMEOUT);
  }

  _showExtraElements() {
    const content = this.container.querySelector(".session-content");
    if (content && content.classList.contains("extra-hidden")) {
      content.classList.remove("extra-hidden");
      content.classList.add("extra-visible");
    }
  }

  _hideExtraElements() {
    const content = this.container.querySelector(".session-content");
    if (content && content.classList.contains("extra-visible")) {
      content.classList.remove("extra-visible");
      content.classList.add("extra-hidden");
    }
  }
}
