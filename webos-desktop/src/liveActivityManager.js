import { BusEvents } from "./core/EventBus.js";
import { StorageKeys, os } from "./framework.js";
import { resolveAppName, resolveAppIcon } from "./shared/appNameResolver.js";
import { PREDEFINED_AVATARS } from "./utils/avatarData.js";

const ACTIVITY_ENDPOINT = "https://analytics.liventcord-a60.workers.dev/live/activity";
const NOW_PLAYING_ENDPOINT = "https://analytics.liventcord-a60.workers.dev/live/now-playing";
const ACTIVITY_FLUSH_INTERVAL = 15000;
const POLL_INTERVAL = 60000;
const ACTIVITY_TTL_MINUTES = 5;

export class LiveActivityManager {
  constructor() {
    this.queue = [];
    this.activeUsers = new Map();
    this.knownUsers = new Map();
    this.flushTimer = null;
    this.pollTimer = null;
    this.isShowingPopup = false;
    this.popupQueue = [];
  }

  init() {
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
  }

  isEnabled() {
    return os.storage.get(StorageKeys.friendsLiveActivity) !== "false";
  }

  startTimers() {
    this.stopTimers();
    if (!this.isEnabled()) return;
    this.flushTimer = setInterval(() => this.flush(), ACTIVITY_FLUSH_INTERVAL);
    this.pollTimer = setInterval(() => this.poll(), POLL_INTERVAL);
    this.poll();
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

    this.queue.push({
      username: String(username).slice(0, 32),
      appId: String(appId).slice(0, 64),
      gameTitle: String(name).slice(0, 128),
      gameIcon: String(icon || "").slice(0, 512),
      avatarIndex: avatarIndex >= 0 ? avatarIndex : -1,
      event: "start",
      timestamp: Date.now()
    });

    if (this.queue.length >= 10) this.flush();
  }

  flush() {
    if (!this.isEnabled()) return;
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0);
    const payload = JSON.stringify(batch);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ACTIVITY_ENDPOINT, payload);
    } else {
      fetch(ACTIVITY_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload
      }).catch(() => {});
    }
  }

  async poll() {
    if (!this.isEnabled()) return;
    try {
      const res = await fetch(NOW_PLAYING_ENDPOINT);
      if (!res.ok) return;
      const data = await res.json();
      if (!data || !Array.isArray(data.users)) return;

      const current = new Map();
      for (const user of data.users) {
        if (!user.username) continue;
        current.set(user.username, user);
        if (!this.knownUsers.has(user.username)) {
          this.knownUsers.set(user.username, user);
          this.queuePopup(user);
        }
        const known = this.knownUsers.get(user.username);
        if (known && known.appId !== user.appId) {
          this.queuePopup(user);
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

  queuePopup(user) {
    this.popupQueue.push(user);
  }

  processPopupQueue() {
    if (this.isShowingPopup || this.popupQueue.length === 0) return;
    this.isShowingPopup = true;
    const user = this.popupQueue.shift();
    this.showActivityPopup(user);
  }

  showActivityPopup(user) {
    const gameName = resolveAppName(user.appId);
    const gameIcon = resolveAppIcon(user.appId);

    const avatarIndex = user.avatarIndex;
    const avatarUrl = typeof avatarIndex === "number" && avatarIndex >= 0 && avatarIndex < PREDEFINED_AVATARS.length
      ? PREDEFINED_AVATARS[avatarIndex]
      : null;

    const popup = document.createElement("div");
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
        <div class="activity-popup__name">${user.username}</div>
        <div class="activity-popup__action">is now playing</div>
        <div class="activity-popup__game">
          ${gameIconHtml}
          <span class="activity-popup__game-name">${gameName}</span>
        </div>
      </div>
    `;

    document.body.appendChild(popup);

    popup.addEventListener("click", () => {
      if (os.app.hasApp(user.appId)) {
        os.app.launch(user.appId);
      }
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
