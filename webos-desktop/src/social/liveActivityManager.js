import { BusEvents } from "../core/EventBus.js";
import { StorageKeys, os, createElement } from "../framework.js";
import { resolveAppName, resolveAppIcon, escapeHtml } from "../utils/utils.js";
import { PREDEFINED_AVATARS } from "../utils/avatarData.js";
import { SteamSettings } from "../games/steamSettings.js";
import { isSocialDisabled } from "./socialSettings.js";
import { getLiveUserId, ensureLiveUserId } from "./userIdentity.js";
import { SOCIAL_ACTIVITY_ENDPOINT, SOCIAL_NOW_PLAYING_ENDPOINT, SOCIAL_BASE } from "./endpoints.js";
import { isBroadcastAllowed, isPopupAllowed } from "./presence.js";
import { areFriends } from "./friendsApi.js";

function isUrlPrefixed(value) {
  const v = String(value).trim().toLowerCase();
  return v.startsWith("http") || v.startsWith("://");
}

const ACTIVITY_FLUSH_INTERVAL = 15000;
const POLL_INTERVAL = 120000;
const ACTIVITY_TTL_MINUTES = 5;

export class LiveActivityManager {
  constructor() {
    this.queue = [];
    this.activeUsers = new Map();
    this.knownUsers = new Map();
    this.flushTimer = null;
    this.pollTimer = null;
    this.onVisibilityChange = () => {
      if (!this.isEnabled()) return;
      if (document.hidden) {
        if (this.pollTimer) {
          clearInterval(this.pollTimer);
          this.pollTimer = null;
        }
      } else {
        this.startTimers();
      }
    };
    this.isShowingPopup = false;
    this.popupQueue = [];
  }

  init() {
    window.addEventListener("steam-settings-changed", (e) => {
      if (e.detail?.setting === "shareLiveActivity") {
        if (e.detail.value) {
          this.startTimers();
        } else {
          this.stopTimers();
          this.queue = [];
          this.popupQueue = [];
        }
      }
      if (e.detail?.setting === "dnd" && e.detail.value) {
        this.popupQueue = [];
      }
      if (e.detail?.setting === "socialDisabled") {
        if (e.detail.value) {
          this.stopTimers();
          this.queue = [];
          this.popupQueue = [];
        } else {
          this.startTimers();
        }
      }
    });
    os.events.on(BusEvents.SOCIAL_PRESENCE_CHANGED, ({ presence }) => {
      if (presence === "online") {
        this.startTimers();
      } else {
        this.stopTimers();
        this.queue = [];
        this.popupQueue = [];
      }
    });
    os.events.on(BusEvents.SOCIAL_DND_CHANGED, ({ enabled }) => {
      if (enabled) this.popupQueue = [];
    });
    if (!this.isEnabled()) return;
    os.events.on(BusEvents.APP_LAUNCHED, ({ appId }) => this.onAppLaunched(appId));
    os.events.on(BusEvents.SETTINGS_CHANGED, (settings) => {
      if (settings.friendsLiveActivity !== undefined) {
        if (settings.friendsLiveActivity) {
          this.startTimers();
        } else {
          this.stopTimers();
        }
      }
    });
    this.startTimers();
    ensureLiveUserId().catch(() => {});
  }

  isEnabled() {
    return (
      !isSocialDisabled() &&
      os.storage.get(StorageKeys.friendsLiveActivity) !== "false" &&
      SteamSettings.get("shareLiveActivity") !== false &&
      isBroadcastAllowed()
    );
  }

  startTimers() {
    this.stopTimers();
    if (!this.isEnabled()) return;
    this.flushTimer = setInterval(() => this.flush(), ACTIVITY_FLUSH_INTERVAL);
    this.pollTimer = setInterval(() => this.poll(), POLL_INTERVAL);
    this.poll();
    document.addEventListener("visibilitychange", this.onVisibilityChange);
  }

  stopTimers() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
  }

  onAppLaunched(appId) {
    if (!this.isEnabled()) return;
    if (!appId) return;
    const info = os.app.getAppInfo(appId);
    if (!info) return;
    if (info.type === "system") return;

    const name = resolveAppName(appId);
    const icon = resolveAppIcon(appId);
    const username = os.storage.get(StorageKeys.username) || "Anonymous";

    const profilePic = os.storage.get(StorageKeys.profilePicture) || "";
    const avatarIndex = PREDEFINED_AVATARS.indexOf(profilePic);

    const item = {
      username: String(username).slice(0, 32),
      userId: getLiveUserId() || undefined,
      appId: String(appId).slice(0, 64),
      gameTitle: String(name).slice(0, 128),
      gameIcon: String(icon || "").slice(0, 512),
      avatarIndex: avatarIndex >= 0 ? avatarIndex : -1,
      event: "start",
      timestamp: Date.now()
    };

    if (isUrlPrefixed(item.username) || isUrlPrefixed(item.appId) || isUrlPrefixed(item.gameTitle)) return;

    this.queue.push(item);

    if (this.queue.length >= 10) this.flush();
  }

  flush() {
    if (!this.isEnabled()) return;
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0);
    const payload = JSON.stringify(batch);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(SOCIAL_ACTIVITY_ENDPOINT, payload);
    } else {
      fetch(SOCIAL_ACTIVITY_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload
      }).catch(() => {});
    }
  }

  async poll() {
    if (!this.isEnabled()) return;
    try {
      const res = await fetch(SOCIAL_NOW_PLAYING_ENDPOINT);
      if (!res.ok) return;
      const data = await res.json();
      if (!data || !Array.isArray(data.users)) return;

      const current = new Map();
      for (const user of data.users) {
        if (user.userId && user.userId === getLiveUserId()) continue;
        if (!user.username) continue;
        current.set(user.username, user);
        if (!this.knownUsers.has(user.username)) {
          this.knownUsers.set(user.username, user);
          this.maybeQueueFriendPopup(user);
        }
        const known = this.knownUsers.get(user.username);
        if (known && known.appId !== user.appId) {
          this.maybeQueueFriendPopup(user);
        }
        this.knownUsers.set(user.username, user);
      }

      for (const [username] of this.knownUsers) {
        if (!current.has(username)) {
          this.knownUsers.delete(username);
        }
      }

      this.processPopupQueue();
    } catch (e) {
      // silent - network errors expected when offline
    }
  }

  async getNowPlaying() {
    try {
      const res = await fetch(SOCIAL_NOW_PLAYING_ENDPOINT);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.users) ? data.users : [];
    } catch {
      return [];
    }
  }

  async getRecentPlayers(appId) {
    try {
      const res = await fetch(SOCIAL_BASE + "/live/recent-players?app=" + encodeURIComponent(appId));
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.users) ? data.users : [];
    } catch {
      return [];
    }
  }

  queuePopup(user) {
    if (!isPopupAllowed()) return;
    this.popupQueue.push(user);
  }

  async maybeQueueFriendPopup(user) {
    if (!isPopupAllowed()) return;
    if (!user.userId) return;
    const isFriend = await areFriends(user.userId).catch(() => false);
    if (!isFriend) return;
    this.queuePopup(user);
    this.processPopupQueue();
  }

  processPopupQueue() {
    if (this.isShowingPopup || this.popupQueue.length === 0) return;
    this.isShowingPopup = true;
    const user = this.popupQueue.shift();
    this.showActivityPopup(user);
  }

  showActivityPopup(user) {
    if (user.userId && user.userId === getLiveUserId()) {
      this.isShowingPopup = false;
      this.processPopupQueue();
      return;
    }
    const gameName = resolveAppName(user.appId);
    const gameIcon = resolveAppIcon(user.appId);

    const avatarIndex = user.avatarIndex;
    const avatarUrl =
      typeof avatarIndex === "number" && avatarIndex >= 0 && avatarIndex < PREDEFINED_AVATARS.length
        ? PREDEFINED_AVATARS[avatarIndex]
        : null;

    const popup = createElement("div");
    popup.className = "activity-popup";

    const avatarHtml = avatarUrl
      ? `<img src="${avatarUrl}" class="activity-popup__avatar" />`
      : `<div class="activity-popup__avatar activity-popup__avatar--default"><i class="fas fa-user"></i></div>`;

    const gameIconHtml = gameIcon
      ? `<img src="${gameIcon}" class="activity-popup__game-icon" />`
      : `<i class="fas fa-gamepad activity-popup__game-icon--fa"></i>`;

    popup.innerHTML = `
      <div class="activity-popup__avatar-col">
        ${avatarHtml}
      </div>
      <div class="activity-popup__body">
        <div class="activity-popup__name">${escapeHtml(user.username)}</div>
        <div class="activity-popup__action">is now playing</div>
        <div class="activity-popup__game">
          ${gameIconHtml}
          <span class="activity-popup__game-name">${escapeHtml(gameName)}</span>
        </div>
      </div>
    `;

    document.body.appendChild(popup);

    popup.addEventListener("click", () => {
      os.app.launch("steamApp", { steamPage: "settings" });
    });

    requestAnimationFrame(() => popup.classList.add("activity-popup--show"));

    setTimeout(() => {
      popup.classList.remove("activity-popup--show");
      popup.classList.add("activity-popup--hide");
      setTimeout(() => {
        popup.remove();
        this.isShowingPopup = false;
        this.processPopupQueue();
      }, 600);
    }, 4000);
  }
}

export const liveActivityManager = new LiveActivityManager();
