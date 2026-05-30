import { bus, BusEvents } from "./core/EventBus.js";
import { PREDEFINED_AVATARS, STORAGE_KEYS } from "./profileCustomizer.js";
import { resolveIconUrl } from "./shared/assetResolver.js";
import { StorageKeys } from "./settings/settings.js";
import { SystemUtilities } from "./system.js";
import { audioMixer, SystemAudio } from "./audioMixer.js";

export class SessionManager {
  constructor(services) {
    this.services = services;
    this.currentSession = null;
    this.container = null;
    this.isLocked = false;
    this.lockContainer = null;
    this.timeInterval = null;
    this.userHistory = this._loadUserHistory();
  }

  _loadUserHistory() {
    try {
      const history = localStorage.getItem(StorageKeys.userHistory);
      return history ? JSON.parse(history) : [];
    } catch (e) {
      return [];
    }
  }

  _saveUserHistory() {
    try {
      localStorage.setItem(StorageKeys.userHistory, JSON.stringify(this.userHistory));
    } catch (e) {}
  }

  _addToUserHistory(session) {
    const existingIndex = this.userHistory.findIndex((u) => u.key === session.key);
    const userEntry = {
      name: session.name,
      key: session.key,
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
    if (!localStorage.getItem(StorageKeys.setupCompleted)) {
      const lastUsername = localStorage.getItem(STORAGE_KEYS.username) || "";
      const lastAvatar = localStorage.getItem(STORAGE_KEYS.profilePicture) || PREDEFINED_AVATARS[0];
      const displayName = lastUsername || "Guest";
      const sessionKey = lastUsername.toLowerCase().replace(/[^a-z0-9]/g, "") || "guest";
      this.currentSession = {
        name: displayName,
        key: sessionKey,
        avatar: lastAvatar
      };
      await this._initializeSession();
      return this.currentSession;
    }

    const lastLaunch = localStorage.getItem(StorageKeys.lastLaunchTime);
    const now = Date.now();
    const isWithin15Mins = lastLaunch && now - Number(lastLaunch) < 15 * 60 * 1000;
    localStorage.setItem(StorageKeys.lastLaunchTime, now.toString());

    if (localStorage.getItem(StorageKeys.disableBootScreen) === "true" || isWithin15Mins) {
      const lastUsername = localStorage.getItem(STORAGE_KEYS.username) || "";
      const lastAvatar = localStorage.getItem(STORAGE_KEYS.profilePicture) || PREDEFINED_AVATARS[0];
      const displayName = lastUsername || "Guest";
      const sessionKey = lastUsername.toLowerCase().replace(/[^a-z0-9]/g, "") || "guest";
      this.currentSession = {
        name: displayName,
        key: sessionKey,
        avatar: lastAvatar
      };
      await this._initializeSession();
      return this.currentSession;
    }
    return new Promise((resolve) => {
      this._createUI(resolve);
    });
  }

  _createUI(onComplete) {
    if (document.getElementById("login-screen-container")) return;

    this.container = document.createElement("div");
    this.container.id = "login-screen-container";
    this.container.className = "login-screen-overlay";

    const lastUsername = localStorage.getItem(STORAGE_KEYS.username) || "";
    const lastAvatar = localStorage.getItem(STORAGE_KEYS.profilePicture) || PREDEFINED_AVATARS[0];
    const displayName = lastUsername || "Guest";

    const userHistoryHtml =
      this.userHistory.length > 0
        ? `
      <div class="user-history-section">
        <label>Recent Users</label>
        <div class="user-history-grid">
          ${this.userHistory.map((user) => this._renderUserTile(user)).join("")}
        </div>
      </div>
    `
        : "";

    this.container.innerHTML = `
      <div class="login-container">
        <div class="login-left-panel glass">
          ${userHistoryHtml}
        </div>
        
        <div class="login-card glass">
          <div class="login-header">
            <div class="login-logo">
              <img class="abx-badge" src="${resolveIconUrl("static/icons/logo.png")}" style="height: 64px;">
            </div>
            <h1>Yuki OS</h1>
            <p>Sign in to start your session</p>
          </div>

          <div class="login-body">
            <div class="profile-preview-section">
              <div class="profile-preview-card">
                <img id="preview-avatar" src="${lastAvatar}" alt="Preview">
                <div class="preview-info">
                  <div class="preview-label">Your Profile</div>
                  <div id="preview-name" class="preview-name">${displayName}</div>
                </div>
              </div>
            </div>

            <div class="input-group">
              <label for="nickname-input">Nickname</label>
              <div class="input-wrapper">
                <i class="fas fa-user-tag"></i>
                <input type="text" id="nickname-input" placeholder="Enter nickname (optional)" value="${lastUsername}" autocomplete="off">
              </div>
            </div>

            <div class="avatar-section">
              <label>Select Avatar</label>
              <div class="avatar-grid-wrapper">
                <div class="login-avatar-grid" id="login-avatar-grid">
                  ${PREDEFINED_AVATARS.map(
                    (url) => `
                    <div class="login-avatar-tile ${url === lastAvatar ? "active" : ""}" data-url="${url}">
                      <img src="${url}" alt="Avatar">
                      <div class="tile-check"><i class="fas fa-check"></i></div>
                    </div>
                  `
                  ).join("")}
                </div>
              </div>
              
              <div class="avatar-actions">
                <button class="btn-secondary" id="login-upload-btn">
                  <i class="fas fa-upload"></i> Upload Custom
                </button>
              </div>
            </div>
          </div>

          <div class="login-footer">
            <button class="btn-primary" id="login-continue-btn">
              Continue <i class="fas fa-arrow-right"></i>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.container);
    this._bindEvents(onComplete);
    this._applyLoginWallpaper(this.container);
  }

  _renderUserTile(user) {
    const lastLoginDate = new Date(user.lastLogin);
    const timeAgo = this._formatTimeAgo(lastLoginDate);

    return `
      <div class="user-history-tile" data-key="${user.key}" data-name="${user.name}" data-avatar="${user.avatar}">
        <img src="${user.avatar}" alt="${user.name}">
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

  async _applyLoginWallpaper(container) {
    const wp = await SystemUtilities.getLoginWallpaper();
    let bgEl = container.querySelector(".login-wallpaper-bg");
    if (!wp) {
      if (bgEl) bgEl.remove();
      return;
    }
    if (!bgEl) {
      bgEl = wp.isVideo ? document.createElement("video") : document.createElement("img");
      bgEl.className = "login-wallpaper-bg";
      container.insertBefore(bgEl, container.firstChild);
    } else if (wp.isVideo !== (bgEl.tagName.toLowerCase() === "video")) {
      bgEl.remove();
      bgEl = wp.isVideo ? document.createElement("video") : document.createElement("img");
      bgEl.className = "login-wallpaper-bg";
      container.insertBefore(bgEl, container.firstChild);
    }
    bgEl.src = wp.url;
    if (wp.isVideo) {
      bgEl.autoplay = true;
      bgEl.loop = true;
      bgEl.muted = true;
      bgEl.playsInline = true;
    }
  }

  _bindEvents(onComplete) {
    const grid = this.container.querySelector("#login-avatar-grid");
    const nicknameInput = this.container.querySelector("#nickname-input");
    const uploadBtn = this.container.querySelector("#login-upload-btn");
    const continueBtn = this.container.querySelector("#login-continue-btn");
    const userHistoryGrid = this.container.querySelector(".user-history-grid");
    const previewAvatar = this.container.querySelector("#preview-avatar");
    const previewName = this.container.querySelector("#preview-name");

    let selectedAvatar = localStorage.getItem(STORAGE_KEYS.profilePicture) || PREDEFINED_AVATARS[0];

    const updatePreview = () => {
      const name = nicknameInput.value.trim() || "Guest";
      if (previewName) previewName.textContent = name;
      if (previewAvatar) previewAvatar.src = selectedAvatar;
    };

    nicknameInput.addEventListener("input", updatePreview);

    if (userHistoryGrid) {
      userHistoryGrid.addEventListener("click", (e) => {
        const tile = e.target.closest(".user-history-tile");
        if (!tile) return;

        const name = tile.dataset.name;
        const avatar = tile.dataset.avatar;

        nicknameInput.value = name;

        grid.querySelectorAll(".login-avatar-tile").forEach((t) => t.classList.remove("active"));

        const avatarTile = grid.querySelector(`[data-url="${avatar}"]`);
        if (avatarTile) {
          avatarTile.classList.add("active");
          selectedAvatar = avatar;
        } else {
          const newTile = document.createElement("div");
          newTile.className = "login-avatar-tile active";
          newTile.dataset.url = avatar;
          newTile.innerHTML = `
            <img src="${avatar}" alt="Avatar">
            <div class="tile-check"><i class="fas fa-check"></i></div>
          `;
          grid.querySelectorAll(".login-avatar-tile").forEach((t) => t.classList.remove("active"));
          grid.prepend(newTile);
          grid.scrollTop = 0;
          selectedAvatar = avatar;
        }

        userHistoryGrid.querySelectorAll(".user-history-tile").forEach((t) => t.classList.remove("selected"));
        tile.classList.add("selected");

        updatePreview();
      });
    }

    grid.addEventListener("click", (e) => {
      const tile = e.target.closest(".login-avatar-tile");
      if (!tile) return;

      grid.querySelectorAll(".login-avatar-tile").forEach((t) => t.classList.remove("active"));
      tile.classList.add("active");
      selectedAvatar = tile.dataset.url;

      updatePreview();
    });

    uploadBtn.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target.result;
          selectedAvatar = dataUrl;

          const newTile = document.createElement("div");
          newTile.className = "login-avatar-tile active";
          newTile.dataset.url = dataUrl;
          newTile.innerHTML = `
            <img src="${dataUrl}" alt="Avatar">
            <div class="tile-check"><i class="fas fa-check"></i></div>
          `;

          grid.querySelectorAll(".login-avatar-tile").forEach((t) => t.classList.remove("active"));
          grid.prepend(newTile);
          grid.scrollTop = 0;

          updatePreview();
        };
        reader.readAsDataURL(file);
      };
      input.click();
    });

    const handleContinue = async () => {
      if (continueBtn.disabled) return;
      const nickname = nicknameInput.value.trim();
      const displayName = nickname || "Guest";
      const sessionKey = nickname.toLowerCase().replace(/[^a-z0-9]/g, "") || "guest";

      this.currentSession = {
        name: displayName,
        key: sessionKey,
        avatar: selectedAvatar
      };

      continueBtn.disabled = true;
      continueBtn.innerHTML = `Signing in... <i class="fas fa-spinner fa-spin"></i>`;
      nicknameInput.disabled = true;
      grid.style.pointerEvents = "none";
      uploadBtn.disabled = true;

      await this._initializeSession();

      this.container.classList.add("exit");

      setTimeout(() => {
        this.container.remove();
        onComplete(this.currentSession);
      }, 500);
    };

    continueBtn.addEventListener("click", handleContinue);
    nicknameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        continueBtn.click();
      }
    });
  }

  async _initializeSession() {
    const { name, key, avatar } = this.currentSession;

    localStorage.setItem(StorageKeys.lastLaunchTime, Date.now().toString());
    this._addToUserHistory(this.currentSession);

    if (this.services.fileSystemManager) {
      await this.services.fileSystemManager.setSession(key);
    }

    bus.emit(BusEvents.SESSION_INITIALIZED, this.currentSession);

    if (this.services.windowManager) {
      this.services.windowManager.setFileSystemManager(this.services.fileSystemManager);
      this.services.windowManager.restoreSession();
    }

    audioMixer.playSystemSound(SystemAudio.START);

    if (!localStorage.getItem(StorageKeys.setupCompleted) && this.services.setupApp) {
      setTimeout(() => this.services.setupApp.open(), 1000);
    }
  }

  lockToLoginScreen() {
    if (this.isLocked) return;
    this.isLocked = true;

    audioMixer.playSystemSound(SystemAudio.SHUTDOWN);

    if (this.services.windowManager && typeof this.services.windowManager.closeAll === "function") {
      this.services.windowManager.closeAll();
    }

    const startMenu = document.getElementById("start-menu");
    if (startMenu) {
      startMenu.style.display = "none";
      startMenu.classList.remove("closing");
    }

    return new Promise((resolve) => {
      this._createUI((session) => {
        this.isLocked = false;
        resolve(session);
      });
    });
  }

  lockSession() {
    if (!this.currentSession || this.isLocked) return;
    this.isLocked = true;

    this.lastActiveWindow = document.querySelector(".window.active") || null;

    this._createLockUI();

    bus.emit(BusEvents.SYSTEM_LOCKED, this.currentSession);
  }

  unlockSession() {
    if (!this.isLocked) return;
    this.isLocked = false;

    if (this.lockContainer) {
      this.lockContainer.classList.add("exit");
      setTimeout(() => {
        this.lockContainer.remove();
        this.lockContainer = null;
      }, 500);
    }

    if (this.timeInterval) {
      clearInterval(this.timeInterval);
      this.timeInterval = null;
    }

    if (this.lastActiveWindow && this.services.windowManager) {
      this.services.windowManager.bringToFront(this.lastActiveWindow);
    }
    this.lastActiveWindow = null;

    bus.emit(BusEvents.SYSTEM_UNLOCKED, this.currentSession);
  }

  _createLockUI() {
    if (document.getElementById("lock-screen-container")) return;

    this.lockContainer = document.createElement("div");
    this.lockContainer.id = "lock-screen-container";
    this.lockContainer.className = "lock-screen-overlay";

    const { name, avatar } = this.currentSession;
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const dateStr = now.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });

    this.lockContainer.innerHTML = `
      <div class="lock-background"></div>
      <div class="lock-content">
        <div class="lock-time">${timeStr}</div>
        <div class="lock-date">${dateStr}</div>
        <div class="lock-user">
          <img src="${avatar}" alt="Avatar">
          <h2>${name}</h2>
        </div>
        <button class="btn-primary" id="lock-unlock-btn">
          Unlock <i class="fas fa-unlock"></i>
        </button>
      </div>
    `;

    document.body.appendChild(this.lockContainer);
    this._applyLoginWallpaper(this.lockContainer);

    const unlockBtn = this.lockContainer.querySelector("#lock-unlock-btn");
    unlockBtn.addEventListener("click", () => this.unlockSession());

    this.timeInterval = setInterval(() => {
      if (!this.isLocked || !this.lockContainer) {
        clearInterval(this.timeInterval);
        return;
      }
      const timeEl = this.lockContainer.querySelector(".lock-time");
      if (timeEl) {
        const d = new Date();
        timeEl.textContent = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      }
    }, 1000 * 60);

    unlockBtn.focus();
  }
}
