import { os, StorageKeys, $, $$, setHTML, createElement, setText, bindEvent, toggleClass } from "../../framework.js";
import { KeybindManager } from "../../keybindManager.js";
import { steamDeckAudio } from "./SteamDeckAudio.js";
import { audioMixer } from "../../audioMixer.js";
import { mediaTray } from "../../mediaTray.js";
import { performanceManager } from "../../shared/performanceManager.js";
import {
  renderRangeSlider,
  getRangeSliderValue,
  setRangeSliderValue,
  bindRangeSlider
} from "../../shared/rangeSlider.js";
import {
  fetchFriends,
  getCachedFriends,
  acceptFriendRequest,
  removeFriend,
  fetchConversations
} from "../../social/friendsApi.js";
import { avatarUrlForIndex } from "../../social/userIdentity.js";
import { formatRelativeTime, isUserOnline } from "../../social/socialApi.js";
import { openFriendDmWindow, openFriendRowContextMenu, openStatusPicker } from "../../games/steamSocial.js";
import { escapeHtml, resolveAppName } from "../../utils/utils.js";
import { getPresence } from "../../social/presence.js";
import { getCurrentUser } from "../../desktopui/startMenu.js";
import { resolveAvatarUrl } from "../../social/avatarResolver.js";
import { BusEvents } from "../../core/EventBus.js";
import { YUKIOS_VERSION } from "../../apps/about.js";

const QTA_TABS = [
  { id: "notifications", icon: "fa-bell", label: "Notifications" },
  { id: "friends", icon: "fa-users", label: "Friends" },
  { id: "media", icon: "fa-music", label: "Now Playing" },
  { id: "settings", icon: "fa-gear", label: "Quick Settings" },
  { id: "power", icon: "fa-battery-half", label: "Power" },
  { id: "help", icon: "fa-circle-question", label: "Help" }
];

const FRIEND_TABS = [
  { id: "favorites", icon: "fa-star", label: "Favorites" },
  { id: "all", icon: "fa-user", label: "All Friends" },
  { id: "groups", icon: "fa-users", label: "Group Chats" },
  { id: "dms", icon: "fa-comment", label: "Direct Messages" }
];

const POWER_MODE_LABELS = {
  performance: "Performance",
  balanced: "Balanced",
  high: "High"
};

export class QuickAccessPanel {
  constructor(manager) {
    this.manager = manager;
    this.el = null;
    this.isOpen = false;
    this.tab = "settings";
    this.friendsTab = "all";
    this.closeHandler = null;
    this.mediaTimer = null;
    this.mediaSource = null;
    this.focusIndex = 0;
    this.focusMode = "panel";
    this.qtaKeyHandler = null;
    this.friendQuery = "";
    this.showingRequests = false;
    this.friendsPollTimer = null;
    this.friendsPresenceHandler = null;
    this.friendRequestsData = [];
  }

  build() {
    if (this.el) return this.el;
    const el = createElement("div", { id: "steamdeck-qta" });
    const railBtns = QTA_TABS.map(
      (t) =>
        `<button class="deck-qta-rail-btn" data-qta-tab="${t.id}" title="${t.label}"><i class="fas ${t.icon}"></i></button>`
    ).join("");
    setHTML(
      el,
      `<div class="deck-qta-shell">
        <div class="deck-qta-rail">
          ${railBtns}
          <button class="deck-qta-rail-btn deck-qta-rail-close" data-qta-close="1" title="Close"><i class="fas fa-xmark"></i></button>
        </div>
        <div class="deck-qta-panel">
          <div class="deck-qta-panel-head">
            <div class="deck-qta-panel-title"></div>
            <div class="deck-qta-panel-action"></div>
          </div>
          <div class="deck-qta-panel-body"></div>
        </div>
      </div>`
    );
    document.body.appendChild(el);
    this.el = el;
    $$(".deck-qta-rail-btn", el).forEach((btn) => {
      bindEvent(btn, "click", () => {
        if (btn.dataset.qtaClose) {
          this.close();
          return;
        }
        if (btn.dataset.qtaTab !== this.tab) steamDeckAudio.playRailChange();
        this.setTab(btn.dataset.qtaTab);
      });
    });
    bindEvent(el, "click", (e) => e.stopPropagation());
    bindEvent(el, "contextmenu", (e) => e.preventDefault());
    bindRangeSlider(el);
    this.refreshTabState();
    this.renderPanel();
    this.refreshMediaTab();
    return el;
  }

  toggle(force) {
    if (force === undefined) force = !this.isOpen;
    if (force) this.open();
    else this.close();
  }

  open() {
    const el = this.build();
    steamDeckAudio.playSlide();
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
    this.isOpen = true;
    el.classList.remove("closing");
    el.classList.add("open");
    this.refreshTabState();
    this.renderPanel();
    this.focusMode = "panel";
    this.focusIndex = 0;
    this.refreshQtaFocus();
    this.refreshMediaTab();
    this.closeHandler = (e) => {
      if (this.isOpen && this.el && !this.el.contains(e.target) && !e.target.closest("#context-menu")) this.close();
    };
    document.addEventListener("mousedown", this.closeHandler);
    this.qtaKeyHandler = (e) => this.handleQtaKeydown(e);
    document.addEventListener("keydown", this.qtaKeyHandler, true);
    if (!this.mediaTimer) this.mediaTimer = setInterval(() => this.updateMediaPlayState(), 1000);
    this.startFriendsPolling();
    this.setupFriendsPresenceListener();
    if (this.manager) this.manager.quickAccessOpen = true;
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    steamDeckAudio.playHideSidebarModal();
    if (this.qtaKeyHandler) {
      document.removeEventListener("keydown", this.qtaKeyHandler, true);
      this.qtaKeyHandler = null;
    }
    $$(".deck-qta-focused", this.el).forEach((el) => el.classList.remove("deck-qta-focused"));
    const activeEl = document.activeElement;
    if (activeEl && this.el && this.el.contains(activeEl)) activeEl.blur();
    if (this.mediaTimer) {
      clearInterval(this.mediaTimer);
      this.mediaTimer = null;
    }
    this.stopFriendsPolling();
    this.teardownFriendsPresenceListener();
    if (this.el) {
      this.el.classList.remove("open");
      this.el.classList.add("closing");
      this.closeTimer = setTimeout(() => {
        this.closeTimer = null;
        if (this.el) this.el.classList.remove("closing");
      }, 220);
    }
    if (this.closeHandler) {
      document.removeEventListener("mousedown", this.closeHandler);
      this.closeHandler = null;
    }
    if (this.manager) this.manager.quickAccessOpen = false;
  }

  destroy() {
    this.close();
    if (this.el && this.el.parentNode) this.el.parentNode.removeChild(this.el);
    this.el = null;
  }

  setTab(tab) {
    if (!QTA_TABS.some((t) => t.id === tab)) tab = "settings";
    if (tab === this.tab) return;
    const prevIndex = QTA_TABS.findIndex((t) => t.id === this.tab);
    const newIndex = QTA_TABS.findIndex((t) => t.id === tab);
    const direction = newIndex > prevIndex ? "down" : "up";
    this.tab = tab;
    this.refreshTabState();
    this.animateTabChange(direction);
  }

  animateTabChange(direction) {
    const bodyEl = $(".deck-qta-panel-body", this.el);
    if (!bodyEl || this.panelAnimating) return;
    this.panelAnimating = true;

    bodyEl.classList.add("deck-qta-panel-body--out", `deck-qta-panel-body--${direction}`);

    const startIn = () => {
      bodyEl.classList.remove("deck-qta-panel-body--out", "deck-qta-panel-body--up", "deck-qta-panel-body--down");
      this.renderPanel();
      bodyEl.classList.add("deck-qta-panel-body--in", `deck-qta-panel-body--${direction}`);
      bodyEl.addEventListener("animationend", finishIn, { once: true });
    };

    const finishIn = () => {
      bodyEl.classList.remove("deck-qta-panel-body--in", "deck-qta-panel-body--up", "deck-qta-panel-body--down");
      this.panelAnimating = false;
    };

    bodyEl.addEventListener("animationend", startIn, { once: true });
  }

  refreshTabState() {
    if (!this.el) return;
    $$(".deck-qta-rail-btn", this.el).forEach((btn) => toggleClass(btn, "active", btn.dataset.qtaTab === this.tab));
    this.updateBattery();
  }

  refreshMediaTab() {
    if (!this.el) return;
    const btn = $('[data-qta-tab="media"]', this.el);
    if (!btn) return;
    const active = !!mediaTray().getActiveSource();
    toggleClass(btn, "deck-qta-rail-btn--hidden", !active);
    if (!active && this.tab === "media") this.setTab("settings");
  }

  renderPanel() {
    if (!this.el) return;
    const titleEl = $(".deck-qta-panel-title", this.el);
    const actionEl = $(".deck-qta-panel-action", this.el);
    const bodyEl = $(".deck-qta-panel-body", this.el);
    if (!titleEl || !actionEl || !bodyEl) return;
    const tabDef = QTA_TABS.find((t) => t.id === this.tab);
    setText(titleEl, tabDef ? tabDef.label : "Quick Settings");
    setHTML(actionEl, "");
    if (this.tab === "notifications") {
      setHTML(
        actionEl,
        '<button class="deck-qta-btn" data-qta-action="clearNotifications"><i class="fas fa-trash"></i><span>Clear</span></button>'
      );
    } else if (this.tab === "friends") {
      setHTML(
        actionEl,
        '<button class="deck-qta-btn" data-qta-action="addFriend"><i class="fas fa-plus"></i><span>Add Friend</span></button>'
      );
    }
    const actionBtn = $("[data-qta-action]", actionEl);
    if (actionBtn) {
      bindEvent(actionBtn, "click", () => this.handleAction(actionBtn.dataset.qtaAction));
    }
    if (this.tab === "notifications") this.renderNotifications(bodyEl);
    else if (this.tab === "friends") this.renderFriends(bodyEl);
    else if (this.tab === "media") this.renderMedia(bodyEl);
    else if (this.tab === "settings") this.renderSettings(bodyEl);
    else if (this.tab === "power") this.renderPower(bodyEl);
    else if (this.tab === "help") this.renderHelp(bodyEl);
    if (this.isOpen) this.refreshQtaFocus();
  }

  getQtaFocusables() {
    if (!this.el) return [];
    if (this.focusMode === "rail") return $$(".deck-qta-rail-btn", this.el);
    return $$(
      "[data-qta-action], [data-qta-friend-tab], [data-qta-friend-row], [data-qta-friend-group], [data-power-mode], [data-qta-media], [data-help-app], [data-qta-powermenu], .deck-qta-toggle, .range-slider, [data-qta-status-picker], [data-qta-friend-requests], [data-friends-search-input], [data-friends-banner-close]",
      this.el
    );
  }

  setQtaFocus(index) {
    const list = this.getQtaFocusables();
    if (!list.length) {
      this.focusIndex = -1;
      return;
    }
    this.focusIndex = ((index % list.length) + list.length) % list.length;
    $$(".deck-qta-focused", this.el).forEach((el) => el.classList.remove("deck-qta-focused"));
    const el = list[this.focusIndex];
    if (el) {
      el.classList.add("deck-qta-focused");
      const row = el.closest(".deck-qta-row");
      if (row) row.classList.add("deck-qta-focused");
      el.scrollIntoView({ block: "nearest" });
      el.focus({ preventScroll: true });
    }
  }

  stepQtaFocus(delta) {
    const list = this.getQtaFocusables();
    if (!list.length) return;
    const idx = this.focusIndex < 0 ? 0 : this.focusIndex;
    this.setQtaFocus(idx + delta);
  }

  refreshQtaFocus() {
    const list = this.getQtaFocusables();
    if (!list.length) {
      this.focusIndex = -1;
      return;
    }
    if (this.focusIndex < 0) this.focusIndex = 0;
    if (this.focusIndex >= list.length) this.focusIndex = list.length - 1;
    this.setQtaFocus(this.focusIndex);
  }

  enterRailMode() {
    this.focusMode = "rail";
    const railBtns = $$(".deck-qta-rail-btn", this.el);
    const idx = railBtns.findIndex((btn) => btn.dataset.qtaTab === this.tab);
    this.setQtaFocus(idx < 0 ? 0 : idx);
  }

  enterPanelMode() {
    this.focusMode = "panel";
    this.focusIndex = 0;
    this.refreshQtaFocus();
  }

  activateQtaFocus() {
    const list = this.getQtaFocusables();
    const el = list[this.focusIndex];
    if (!el) return;
    if (el.classList.contains("range-slider")) return;
    el.click();
    if (el.dataset.qtaTab) {
      this.focusMode = "panel";
      this.focusIndex = 0;
    }
  }

  handleQtaKeydown(e) {
    if (!this.isOpen || !this.el) return;
    const target = e.target instanceof Element ? e.target : null;
    if (target && target.closest("input, textarea")) return;
    const contextMenu = document.getElementById("context-menu");
    if (contextMenu && contextMenu.style.display !== "none") return;
    const searchOverlay = document.querySelector(".deck-search-overlay");
    if (searchOverlay) return;
    const focused = this.getQtaFocusables()[this.focusIndex] || null;
    const onSlider = focused && focused.classList.contains("range-slider");
    if (
      onSlider &&
      (KeybindManager.matches(e, "steamdeck.moveLeft") || KeybindManager.matches(e, "steamdeck.moveRight"))
    )
      return;
    if (KeybindManager.matches(e, "steamdeck.moveUp")) {
      e.preventDefault();
      e.stopPropagation();
      steamDeckAudio.playRailChange();
      this.stepQtaFocus(-1);
      return;
    }
    if (KeybindManager.matches(e, "steamdeck.moveDown")) {
      e.preventDefault();
      e.stopPropagation();
      steamDeckAudio.playRailChange();
      this.stepQtaFocus(1);
      return;
    }
    if (KeybindManager.matches(e, "steamdeck.moveLeft")) {
      e.preventDefault();
      e.stopPropagation();
      steamDeckAudio.playRailChange();
      if (this.focusMode === "panel") this.enterRailMode();
      return;
    }
    if (KeybindManager.matches(e, "steamdeck.moveRight")) {
      e.preventDefault();
      e.stopPropagation();
      steamDeckAudio.playRailChange();
      if (this.focusMode === "rail") this.enterPanelMode();
      return;
    }
    if (KeybindManager.matches(e, "steamdeck.confirm")) {
      e.preventDefault();
      e.stopPropagation();
      this.activateQtaFocus();
      return;
    }
    if (KeybindManager.matches(e, "steamdeck.back")) {
      e.preventDefault();
      e.stopPropagation();
      this.close();
    }
  }

  handleAction(action) {
    if (action === "clearNotifications") {
      os.notify.clearAll();
      this.renderPanel();
    } else if (action === "addFriend") {
      this.close();
      os.app.launch("steamApp", { steamPage: "community" }).catch(() => {});
    } else if (action === "screenshot") {
      this.close();
      os.app.takeScreenshot(true);
    } else if (action === "lock") {
      this.close();
      os.app.lockSession();
    }
  }

  renderNotifications(bodyEl) {
    const items = os.notify.getAll() || [];
    if (!items.length) {
      setHTML(
        bodyEl,
        '<div class="deck-qta-empty"><i class="fas fa-bell-slash"></i><span>No notifications</span></div>'
      );
      return;
    }
    const list = items
      .map(
        (n) =>
          `<div class="deck-qta-notif-item"><i class="fas ${n.icon || "fa-info-circle"}"></i><div class="deck-qta-notif-meta"><div class="deck-qta-notif-title">${escapeHtml(n.title || "")}</div><div class="deck-qta-notif-msg">${escapeHtml(n.message || "")}</div></div></div>`
      )
      .join("");
    setHTML(bodyEl, `<div class="deck-qta-notif-list">${list}</div>`);
  }

  setFriendsTab(tab) {
    this.friendsTab = tab;
    this.showingRequests = false;
    const bodyEl = $(".deck-qta-panel-body", this.el);
    if (bodyEl) {
      const rPanel = $("[data-friends-requests-panel]", bodyEl);
      if (rPanel) rPanel.hidden = true;
      this.renderFriends(bodyEl);
    }
  }

  renderFriends(bodyEl) {
    const user = getCurrentUser();
    const bannerDismissed = !!os.storage.get(StorageKeys.steamFriendsBannerDismissed);
    const presence = getPresence();
    const statusText = presence === "invisible" ? "Invisible" : presence === "offline" ? "Offline" : "Online";
    const statusCls = presence === "invisible" || presence === "offline" ? "offline" : "online";
    const requestCount = this.friendRequestsData.length;
    const badgeHtml = requestCount ? `<span class="deck-qta-friends-badge">${requestCount}</span>` : "";
    const bannerHtml = bannerDismissed
      ? ""
      : `<div class="deck-qta-friends-banner"><span>Tap a friend for profile, double-tap to chat</span><button class="deck-qta-friends-banner-close" data-friends-banner-close>GOT IT</button></div>`;
    setHTML(
      bodyEl,
      `<div class="deck-qta-friend-profile"><div class="deck-qta-friend-profile-avatar" data-qta-status-picker></div><div class="deck-qta-friend-profile-info"><span class="deck-qta-friend-profile-name">${escapeHtml(user.name)}</span><button class="deck-qta-friend-profile-status" data-qta-status-picker><span class="deck-qta-status-dot deck-qta-status-dot--${statusCls}"></span>${statusText} <i class="fas fa-chevron-down"></i></button></div></div>${bannerHtml}<div class="deck-qta-friends-toolbar"><div class="deck-qta-friends-search"><i class="fas fa-search"></i><input type="text" data-friends-search-input placeholder="Search friends..." /></div><button class="deck-qta-friends-requests-btn" data-qta-friend-requests><i class="fas fa-user-plus"></i>${badgeHtml}</button></div><div class="deck-qta-friends-requests-panel" data-friends-requests-panel hidden></div><div class="deck-qta-friends-tabs">${FRIEND_TABS.map((t) => `<button class="deck-qta-friend-tab" data-qta-friend-tab="${t.id}" title="${t.label}"><i class="fas ${t.icon}"></i></button>`).join("")}</div><div class="deck-qta-friend-body"></div>`
    );
    const profileAvatar = $(".deck-qta-friend-profile-avatar", bodyEl);
    if (profileAvatar) {
      resolveAvatarUrl(user.avatar, "static/icons/guest.webp").then((url) => {
        if (profileAvatar.isConnected) {
          profileAvatar.style.backgroundImage = `url(${url})`;
          profileAvatar.style.backgroundSize = "cover";
          profileAvatar.style.backgroundPosition = "center";
        }
      });
    }
    $$(".deck-qta-friend-tab", bodyEl).forEach((btn) =>
      toggleClass(btn, "active", btn.dataset.qtaFriendTab === this.friendsTab)
    );
    $$(".deck-qta-friend-tab", bodyEl).forEach((btn) =>
      bindEvent(btn, "click", () => {
        this.showingRequests = false;
        const rPanel = $("[data-friends-requests-panel]", bodyEl);
        if (rPanel) rPanel.hidden = true;
        this.setFriendsTab(btn.dataset.qtaFriendTab);
      })
    );
    $$("[data-qta-status-picker]", bodyEl).forEach((el) => {
      bindEvent(el, "click", (e) => {
        e.stopPropagation();
        openStatusPicker(e);
        setTimeout(() => {
          this.refreshPresenceDisplay(bodyEl);
        }, 150);
      });
    });
    const bannerClose = $("[data-friends-banner-close]", bodyEl);
    if (bannerClose) {
      bindEvent(bannerClose, "click", () => {
        os.storage.set(StorageKeys.steamFriendsBannerDismissed, "true");
        const banner = $(".deck-qta-friends-banner", bodyEl);
        if (banner) banner.remove();
      });
    }
    const searchInput = $("[data-friends-search-input]", bodyEl);
    if (searchInput) {
      let debounce = null;
      bindEvent(searchInput, "input", () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          this.friendQuery = searchInput.value;
          this.renderFriendList($(".deck-qta-friend-body", bodyEl));
        }, 200);
      });
    }
    const requestsBtn = $("[data-qta-friend-requests]", bodyEl);
    if (requestsBtn) {
      bindEvent(requestsBtn, "click", () => this.toggleFriendRequests(bodyEl));
    }
    this.renderFriendList($(".deck-qta-friend-body", bodyEl));
  }

  async renderFriendList(friendBody) {
    if (!friendBody) return;
    setHTML(friendBody, '<div class="deck-qta-empty">Loading friends...</div>');
    const data = await fetchFriends().catch(() => getCachedFriends());
    if (!friendBody.isConnected) return;
    const friends = Array.isArray(data?.friends) ? data.friends : [];
    this.qtaFriends = friends;
    const query = (this.friendQuery || "").toLowerCase().trim();
    const searchFiltered = query
      ? friends.filter((f) =>
          String(f.username || "")
            .toLowerCase()
            .includes(query)
        )
      : friends;
    if (this.friendsTab === "groups") {
      setHTML(
        friendBody,
        '<div class="deck-qta-empty"><i class="fas fa-users"></i><span>No group chats yet</span></div>'
      );
      return;
    }
    if (this.friendsTab === "dms") {
      let conversations = [];
      try {
        const convData = await fetchConversations({ refresh: false });
        conversations = Array.isArray(convData?.conversations) ? convData.conversations : [];
      } catch (_) {}
      if (!conversations.length) {
        setHTML(
          friendBody,
          '<div class="deck-qta-empty"><i class="fas fa-comment"></i><span>No direct messages</span></div>'
        );
        return;
      }
      const convHtml = conversations
        .map((c) => {
          const name = c.username || c.name || "Unknown";
          const lastMsg = c.lastMessage || "";
          const avatarUrl = avatarUrlForIndex(c.avatarIndex);
          const avatar = avatarUrl
            ? `<img class="deck-qta-friend-avatar" src="${avatarUrl}" alt="" loading="lazy"/>`
            : '<span class="deck-qta-friend-avatar deck-qta-friend-avatar--default"><i class="fas fa-user"></i></span>';
          return `<button class="deck-qta-friend-row deck-qta-friend-row--dms" data-dm-user-id="${escapeHtml(String(c.userId || ""))}"><span class="deck-qta-friend-avatar-frame">${avatar}</span><span class="deck-qta-friend-meta"><span class="deck-qta-friend-name">${escapeHtml(name)}</span><span class="deck-qta-friend-sub">${escapeHtml(lastMsg.slice(0, 60))}</span></span></button>`;
        })
        .join("");
      setHTML(friendBody, `<div class="deck-qta-friend-list">${convHtml}</div>`);
      $$("[data-dm-user-id]", friendBody).forEach((row) => {
        bindEvent(row, "click", () => {
          const uid = row.dataset.dmUserId;
          const friend = this.findFriendById(uid);
          if (friend) {
            this.close();
            openFriendDmWindow(friend);
          }
        });
      });
      if (this.isOpen) this.refreshQtaFocus();
      return;
    }
    if (this.friendsTab === "favorites") {
      const active = searchFiltered.filter((f) => f.nowPlaying || isUserOnline(f));
      if (!active.length) {
        setHTML(friendBody, '<div class="deck-qta-empty">No active friends</div>');
        return;
      }
      setHTML(friendBody, `<div class="deck-qta-friend-list">${this.buildIngameGroups(active)}</div>`);
      this.bindFriendRows(friendBody);
      this.bindFriendGroups(friendBody);
      if (this.isOpen) this.refreshQtaFocus();
      return;
    }
    if (!searchFiltered.length) {
      setHTML(friendBody, '<div class="deck-qta-empty">No friends yet</div>');
      return;
    }
    const ingame = searchFiltered.filter((f) => f.nowPlaying);
    const online = searchFiltered.filter((f) => !f.nowPlaying && isUserOnline(f));
    const offline = searchFiltered.filter((f) => !f.nowPlaying && !isUserOnline(f));
    const html =
      this.buildIngameGroups(ingame) +
      this.buildFriendGroupHtml("Online Friends", online, "online") +
      this.buildFriendGroupHtml("Offline", offline, "offline");
    setHTML(
      friendBody,
      `<div class="deck-qta-friend-list">${html || '<div class="deck-qta-empty">No friends yet</div>'}</div>`
    );
    this.bindFriendRows(friendBody);
    this.bindFriendGroups(friendBody);
    if (this.isOpen) this.refreshQtaFocus();
  }

  buildIngameGroups(ingame) {
    if (!ingame.length) return "";
    const byGame = new Map();
    ingame.forEach((f) => {
      const name = f.nowPlaying.gameTitle || resolveAppName(f.nowPlaying.appId);
      if (!byGame.has(name)) byGame.set(name, []);
      byGame.get(name).push(f);
    });
    let html = "";
    const singles = [];
    byGame.forEach((group, name) => {
      if (group.length > 1) html += this.buildFriendGroupHtml(name, group, "ingame");
      else singles.push(group[0]);
    });
    if (singles.length) html += this.buildFriendGroupHtml("Other Games", singles, "ingame");
    return html;
  }

  buildFriendGroupHtml(title, friends, kind) {
    if (!friends.length) return "";
    const key = `${kind}:${title}`;
    const collapsed = this.collapsedFriendGroups && this.collapsedFriendGroups[key] ? " collapsed" : "";
    return `<div class="deck-qta-friend-group${collapsed}" data-group-key="${escapeHtml(key)}"><button class="deck-qta-friend-group-head" data-qta-friend-group><span class="deck-qta-friend-group-arrow"><i class="fas fa-chevron-down"></i></span><span class="deck-qta-friend-group-title">${escapeHtml(title)}</span><span class="deck-qta-friend-group-count">${friends.length}</span></button><div class="deck-qta-friend-group-children">${friends
      .map((f) => this.friendRowHtml(f, kind))
      .join("")}</div></div>`;
  }

  friendRowHtml(friend, kind) {
    const avatarUrl = avatarUrlForIndex(friend.avatarIndex);
    const avatar = avatarUrl
      ? `<img class="deck-qta-friend-avatar" src="${avatarUrl}" alt="" loading="lazy"/>`
      : '<span class="deck-qta-friend-avatar deck-qta-friend-avatar--default"><i class="fas fa-user"></i></span>';
    let sub;
    if (kind === "ingame") sub = friend.nowPlaying.gameTitle || resolveAppName(friend.nowPlaying.appId);
    else if (kind === "online") sub = "Online";
    else sub = `Last online ${formatRelativeTime(friend.lastSeen)}`;
    return `<button class="deck-qta-friend-row deck-qta-friend-row--${kind}" data-friend-id="${escapeHtml(friend.userId)}"><span class="deck-qta-friend-avatar-frame">${avatar}</span><span class="deck-qta-friend-meta"><span class="deck-qta-friend-name">${escapeHtml(friend.username || "Unknown")}</span><span class="deck-qta-friend-sub">${escapeHtml(sub)}</span></span></button>`;
  }

  bindFriendRows(friendBody) {
    $$(".deck-qta-friend-row", friendBody).forEach((row) => {
      bindEvent(row, "click", () => {
        const id = row.dataset.friendId;
        if (!id) return;
        this.close();
        os.app.launch("steamApp", { steamPage: "profile", steamUserId: id }).catch(() => {});
      });
      bindEvent(row, "dblclick", () => {
        const friend = this.findFriendById(row.dataset.friendId);
        if (!friend) return;
        openFriendDmWindow(friend);
      });
      bindEvent(row, "contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const friend = this.findFriendById(row.dataset.friendId);
        if (!friend) return;
        openFriendRowContextMenu(e, friend, () => {
          const bodyEl = $(".deck-qta-panel-body", this.el);
          if (bodyEl && this.isOpen) this.renderFriends(bodyEl);
        });
      });
    });
  }

  bindFriendGroups(friendBody) {
    $$(".deck-qta-friend-group-head", friendBody).forEach((head) => {
      bindEvent(head, "click", () => {
        const group = head.closest(".deck-qta-friend-group");
        if (!group) return;
        const key = group.dataset.groupKey;
        if (!key) return;
        if (!this.collapsedFriendGroups) this.collapsedFriendGroups = {};
        this.collapsedFriendGroups[key] = group.classList.toggle("collapsed");
        steamDeckAudio.playNavigation();
      });
    });
  }

  findFriendById(id) {
    return (this.qtaFriends || []).find((friend) => String(friend.userId) === String(id)) || null;
  }

  refreshPresenceDisplay(bodyEl) {
    if (!bodyEl || !bodyEl.isConnected) return;
    const presence = getPresence();
    const statusText = presence === "invisible" ? "Invisible" : presence === "offline" ? "Offline" : "Online";
    const statusCls = presence === "invisible" || presence === "offline" ? "offline" : "online";
    $$(".deck-qta-friend-profile-status", bodyEl).forEach((btn) => {
      const dot = $(".deck-qta-status-dot", btn);
      if (dot) dot.className = `deck-qta-status-dot deck-qta-status-dot--${statusCls}`;
      btn.childNodes.forEach((node) => {
        if (node.nodeType === 3) node.textContent = statusText + " ";
      });
    });
  }

  toggleFriendRequests(bodyEl) {
    this.showingRequests = !this.showingRequests;
    const panel = $("[data-friends-requests-panel]", bodyEl);
    if (!panel) return;
    panel.hidden = !this.showingRequests;
    if (this.showingRequests) {
      this.renderFriendRequestsPanel(panel);
    }
  }

  async renderFriendRequestsPanel(panel) {
    if (!panel) return;
    setHTML(panel, '<div class="deck-qta-empty" style="padding:12px"><span>Loading requests...</span></div>');
    const data = await fetchFriends({ refresh: true }).catch(() => getCachedFriends());
    const requests = Array.isArray(data?.requests) ? data.requests : [];
    this.friendRequestsData = requests;
    this.updateFriendRequestsBadge();
    if (!requests.length) {
      setHTML(
        panel,
        '<div class="deck-qta-empty" style="padding:16px"><i class="fas fa-user-plus"></i><span>No pending requests</span></div>'
      );
      return;
    }
    const rows = requests
      .map((r) => {
        const avatarUrl = avatarUrlForIndex(r.avatarIndex);
        const avatar = avatarUrl
          ? `<img class="deck-qta-friend-avatar" src="${avatarUrl}" alt="" loading="lazy"/>`
          : '<span class="deck-qta-friend-avatar deck-qta-friend-avatar--default"><i class="fas fa-user"></i></span>';
        return `<div class="deck-qta-friend-request-row"><span class="deck-qta-friend-avatar-frame">${avatar}</span><span class="deck-qta-friend-meta"><span class="deck-qta-friend-name">${escapeHtml(r.username || "Unknown")}</span></span><div class="deck-qta-friend-request-actions"><button class="deck-qta-friend-req-btn deck-qta-friend-req-btn--accept" data-req-accept="${escapeHtml(String(r.userId))}"><i class="fas fa-check"></i></button><button class="deck-qta-friend-req-btn deck-qta-friend-req-btn--decline" data-req-decline="${escapeHtml(String(r.userId))}"><i class="fas fa-xmark"></i></button></div></div>`;
      })
      .join("");
    setHTML(panel, `<div class="deck-qta-friend-request-list">${rows}</div>`);
    $$("[data-req-accept]", panel).forEach((btn) =>
      bindEvent(btn, "click", async (e) => {
        e.stopPropagation();
        btn.disabled = true;
        await acceptFriendRequest(btn.dataset.reqAccept);
        this.renderFriendRequestsPanel(panel);
        const bodyEl = $(".deck-qta-panel-body", this.el);
        if (bodyEl && this.isOpen) this.renderFriendList($(".deck-qta-friend-body", bodyEl));
      })
    );
    $$("[data-req-decline]", panel).forEach((btn) =>
      bindEvent(btn, "click", async (e) => {
        e.stopPropagation();
        btn.disabled = true;
        await removeFriend(btn.dataset.reqDecline);
        this.renderFriendRequestsPanel(panel);
      })
    );
  }

  updateFriendRequestsBadge() {
    if (!this.el) return;
    const badge = $("[data-friends-badge]", this.el);
    if (!badge) return;
    const count = this.friendRequestsData.length;
    badge.textContent = count ? String(count) : "";
    badge.classList.toggle("deck-qta-friends-badge--hidden", !count);
  }

  startFriendsPolling() {
    this.stopFriendsPolling();
    this.friendsPollTimer = setInterval(() => {
      if (!this.isOpen || this.tab !== "friends" || this.showingRequests) return;
      const bodyEl = $(".deck-qta-panel-body", this.el);
      if (!bodyEl) return;
      const friendBody = $(".deck-qta-friend-body", bodyEl);
      if (friendBody) this.renderFriendList(friendBody);
      fetchFriends({ refresh: true })
        .then((data) => {
          const requests = Array.isArray(data?.requests) ? data.requests : [];
          this.friendRequestsData = requests;
          this.updateFriendRequestsBadge();
        })
        .catch(() => {});
    }, 10000);
  }

  stopFriendsPolling() {
    if (this.friendsPollTimer) {
      clearInterval(this.friendsPollTimer);
      this.friendsPollTimer = null;
    }
  }

  setupFriendsPresenceListener() {
    this.teardownFriendsPresenceListener();
    this.friendsPresenceHandler = () => {
      const bodyEl = $(".deck-qta-panel-body", this.el);
      if (bodyEl && this.isOpen && this.tab === "friends") {
        this.refreshPresenceDisplay(bodyEl);
      }
    };
    os.events.on(BusEvents.SOCIAL_PRESENCE_CHANGED, this.friendsPresenceHandler);
  }

  teardownFriendsPresenceListener() {
    if (this.friendsPresenceHandler) {
      os.events.off(BusEvents.SOCIAL_PRESENCE_CHANGED, this.friendsPresenceHandler);
      this.friendsPresenceHandler = null;
    }
  }

  renderSettings(bodyEl) {
    const brightness = parseInt(os.storage.get(StorageKeys.brightness), 10) || 100;
    const overlayEnabled = os.app.launcher?.overlayController?.settings?.enabled ?? true;
    const mx = audioMixer();
    const volume = mx.muted ? 0 : Math.round(mx.masterVolume * 100);
    const mic = parseInt(os.storage.get(StorageKeys.steamDeckMicLevel), 10);
    const micLevel = isNaN(mic) ? 80 : mic;
    setHTML(
      bodyEl,
      `<div class="deck-qta-section">
        <div class="deck-qta-section-title">Brightness</div>
        <div class="deck-qta-row"><i class="fas fa-sun"></i><div class="deck-qta-row-main">${renderRangeSlider("qtaBrightness", 0, 100, 5, brightness)}</div><span class="deck-qta-row-value">${brightness}%</span></div>
      </div>
      <div class="deck-qta-section">
        <div class="deck-qta-section-title">Audio</div>
        <div class="deck-qta-row"><i class="fas fa-volume-high"></i><div class="deck-qta-row-main">${renderRangeSlider("qtaVolume", 0, 100, 5, volume)}</div><span class="deck-qta-row-value">${volume}%</span></div>
        <div class="deck-qta-row"><i class="fas fa-microphone"></i><div class="deck-qta-row-main">${renderRangeSlider("qtaMic", 0, 100, 5, micLevel)}</div><span class="deck-qta-row-value">${micLevel}%</span></div>
      </div>
      <div class="deck-qta-section">
        <div class="deck-qta-section-title">Quick Actions</div>
        <div class="deck-qta-actions">
          <button class="deck-qta-action-btn" data-qta-action="screenshot"><i class="fas fa-camera"></i><span>Screenshot</span></button>
          <button class="deck-qta-action-btn" data-qta-action="lock"><i class="fas fa-lock"></i><span>Lock</span></button>
        </div>
        </div>
        <div class="deck-qta-section">
        <div class="deck-qta-section-title">Other</div>
        ${this.toggleRowHtml("fa-layer-group", "Game Overlay", "qtaOverlay", overlayEnabled)}
        ${this.toggleRowHtml("fa-volume-off", "UI Sounds", "qtaUiSounds", os.storage.get(StorageKeys.steamDeckAudioEnabled) !== "false")}
        ${this.toggleRowHtml("fa-plane", "Airplane mode", "qtaAirplane", this.getBoolSetting(StorageKeys.steamDeckAirplane, false))}
        ${this.toggleRowHtml("fa-wifi", "Wi-Fi", "qtaWifi", !!navigator.onLine)}
        ${this.toggleRowHtml("fa-moon", "Night mode", "qtaNight", os.storage.get(StorageKeys.nightModeEnabled) === "true")}
        ${this.toggleRowHtml("fa-bell-slash", "Do Not Disturb", "qtaDnd", os.notify.getDoNotDisturb())}
        ${this.toggleRowHtml("fa-gauge-high", "Performance HUD", "qtaPerfHud", os.storage.get(StorageKeys.deckPerfHud) === "true")}
        ${this.toggleRowHtml("fa-wave-square", "Haptics", "qtaHaptics", os.storage.get(StorageKeys.steamDeckHaptics) === "true")}
      </div>`
    );
    this.bindSettings(bodyEl);
  }

  getBoolSetting(key, defaultValue) {
    const raw = os.storage.get(key);
    if (raw === undefined || raw === null || raw === "") return defaultValue;
    return raw === "true";
  }

  toggleRowHtml(icon, label, id, on) {
    return `<div class="deck-qta-row"><i class="fas ${icon}"></i><div class="deck-qta-row-main"><span class="deck-qta-row-label">${label}</span></div><button class="deck-qta-toggle${on ? " on" : ""}" id="${id}" data-on="${on ? "true" : "false"}" aria-pressed="${on ? "true" : "false"}"><span class="deck-qta-toggle-knob"></span></button></div>`;
  }

  bindSettings(bodyEl) {
    const brightnessSlider = $("#qtaBrightness", bodyEl);
    if (brightnessSlider) {
      bindEvent(brightnessSlider, "input", () => {
        const value = getRangeSliderValue("qtaBrightness", bodyEl);
        if (value >= 100) steamDeckAudio.playSliderMax();
        else steamDeckAudio.playSliderTick();
        os.storage.set(StorageKeys.brightness, String(value));
        this.applyDisplayFilter();
        const val = $(".deck-qta-row-value", brightnessSlider.closest(".deck-qta-row"));
        if (val) setText(val, `${value}%`);
      });
    }
    const volSlider = $("#qtaVolume", bodyEl);
    if (volSlider) {
      bindEvent(volSlider, "input", () => {
        const mx = audioMixer();
        const value = getRangeSliderValue("qtaVolume", bodyEl);
        if (value >= 100) steamDeckAudio.playSliderMax();
        else steamDeckAudio.playSliderTick();
        if (mx.muted && value > 0) mx.muted = false;
        mx.setMaster(value / 100);
      });
      bindEvent(volSlider, "change", () => {
        const mx = audioMixer();
        mx.setMaster(getRangeSliderValue("qtaVolume", bodyEl) / 100);
      });
    }
    const micSlider = $("#qtaMic", bodyEl);
    if (micSlider) {
      bindEvent(micSlider, "input", () => {
        if (getRangeSliderValue("qtaMic", bodyEl) >= 100) steamDeckAudio.playSliderMax();
        else steamDeckAudio.playSliderTick();
      });
      bindEvent(micSlider, "change", () => {
        const value = getRangeSliderValue("qtaMic", bodyEl);
        os.storage.set(StorageKeys.steamDeckMicLevel, String(value));
        const val = $(".deck-qta-row-value", micSlider.closest(".deck-qta-row"));
        if (val) setText(val, `${value}%`);
      });
    }
    $$(".deck-qta-toggle", bodyEl).forEach((toggle) => bindEvent(toggle, "click", () => this.handleToggle(toggle)));
    $$("[data-qta-action]", bodyEl).forEach((btn) =>
      bindEvent(btn, "click", () => this.handleAction(btn.dataset.qtaAction))
    );
  }

  handleToggle(toggle) {
    steamDeckAudio.playToggleChange();
    const on = toggle.dataset.on !== "true";
    toggle.dataset.on = String(on);
    toggle.classList.toggle("on", on);
    toggle.setAttribute("aria-pressed", String(on));
    const id = toggle.id;
    if (id === "qtaAirplane") {
      os.storage.set(StorageKeys.steamDeckAirplane, String(on));
    } else if (id === "qtaNight") {
      os.storage.set(StorageKeys.nightModeEnabled, String(on));
      this.applyDisplayFilter();
    } else if (id === "qtaDnd") {
      os.notify.setDoNotDisturb(on);
    } else if (id === "qtaOverlay") {
      const controller = os.app.launcher?.overlayController;
      if (controller) {
        controller.settings.enabled = on;
        controller.saveSettings();
      }
    } else if (id === "qtaUiSounds") {
      os.storage.set(StorageKeys.steamDeckAudioEnabled, String(on));
    } else if (id === "qtaPerfHud") {
      import("./deckPerfHud.js").then(({ deckPerfHud }) => deckPerfHud.setEnabled(on)).catch(() => {});
    } else if (id === "qtaHaptics") {
      os.storage.set(StorageKeys.steamDeckHaptics, String(on));
    }
  }

  applyDisplayFilter() {
    const deckRoot = document.getElementById("steamdeck-root");
    if (!deckRoot) return;
    const brightness = parseInt(os.storage.get(StorageKeys.brightness), 10) || 100;
    const night = os.storage.get(StorageKeys.nightModeEnabled) === "true";
    deckRoot.style.filter = night
      ? `brightness(${brightness / 100}) sepia(0.3) saturate(0.85)`
      : `brightness(${brightness / 100}) contrast(1) saturate(1) sepia(0)`;
  }

  renderPower(bodyEl) {
    const battery = this.manager?.batteryData || { level: 100, charging: false };
    const mode = performanceManager.getMode();
    setHTML(
      bodyEl,
      `<div class="deck-qta-section">
        <div class="deck-qta-section-title">Battery</div>
        <div class="deck-qta-row deck-qta-battery-row" id="qtaBatteryStatus"><i class="fas ${this.batteryIcon(battery.level)}"></i><div class="deck-qta-row-main"><span class="deck-qta-row-label">${battery.level}%</span><span class="deck-qta-row-sub">${battery.charging ? "Charging" : battery.level <= 15 ? "Low battery" : "On battery"}</span></div></div>
      </div>
      <div class="deck-qta-section">
        <div class="deck-qta-section-title">Performance</div>
        <div class="deck-qta-power-status"><i class="fas fa-bolt"></i><span>Mode: ${POWER_MODE_LABELS[mode] || mode}</span></div>
        <div class="deck-qta-power-modes">${Object.keys(POWER_MODE_LABELS)
          .map((m) => `<button class="deck-qta-power-mode" data-power-mode="${m}">${POWER_MODE_LABELS[m]}</button>`)
          .join("")}</div>
      </div>
      <div class="deck-qta-section">
        <div class="deck-qta-section-title">Power</div>
        <button class="deck-qta-row deck-qta-powermenu-row" data-qta-powermenu="1"><i class="fas fa-power-off"></i><div class="deck-qta-row-main"><span class="deck-qta-row-label">Power Menu</span></div><i class="fas fa-chevron-right"></i></button>
      </div>`
    );
    $$("[data-power-mode]", bodyEl).forEach((btn) => {
      toggleClass(btn, "active", btn.dataset.powerMode === mode);
      bindEvent(btn, "click", () => {
        if (this.manager) this.manager.setPowerMode(btn.dataset.powerMode);
        this.renderPower(bodyEl);
        const active = $(".deck-qta-power-mode.active", bodyEl);
        if (active) {
          active.classList.remove("deck-qta-mode-flash");
          void active.offsetWidth;
          active.classList.add("deck-qta-mode-flash");
        }
      });
    });
    $$("[data-qta-powermenu]", bodyEl).forEach((btn) =>
      bindEvent(btn, "click", () => {
        this.close();
        this.manager?.showPowerMenu?.();
      })
    );
  }

  renderMedia(bodyEl) {
    const src = mediaTray().getActiveSource();
    this.mediaSource = src;
    if (!src) {
      setHTML(bodyEl, '<div class="deck-qta-empty"><i class="fas fa-music"></i><span>Nothing playing</span></div>');
      return;
    }
    const artwork = this.mediaArtwork(src);
    const title = this.mediaTitle(src);
    const subtitle = this.mediaSubtitle(src);
    const sourceLabel = this.mediaSourceLabel(src);
    const artHtml = artwork
      ? `<img class="deck-qta-media-art" src="${artwork}" alt=""/>`
      : '<div class="deck-qta-media-art deck-qta-media-art--fallback"><i class="fas fa-music"></i></div>';
    const progressHtml =
      src.type === "element" && (src.element.duration || 0) > 0
        ? `<div class="deck-qta-media-progress"><div class="deck-qta-media-progress-fill"></div></div><div class="deck-qta-media-times"><span class="deck-qta-media-time">0:00</span><span class="deck-qta-media-time">${this.formatTime(src.element.duration)}</span></div>`
        : "";
    const playing = this.isMediaPlaying(src);
    setHTML(
      bodyEl,
      `<div class="deck-qta-media">
        ${artHtml}
        <div class="deck-qta-media-meta">
          <div class="deck-qta-media-title">${escapeHtml(title)}</div>
          <div class="deck-qta-media-sub">${escapeHtml(subtitle)}</div>
          ${sourceLabel ? `<div class="deck-qta-media-source">${escapeHtml(sourceLabel)}</div>` : ""}
        </div>
        ${progressHtml}
        <div class="deck-qta-media-controls">
          <button class="deck-qta-media-btn" data-qta-media="prev" title="Previous"><i class="fas fa-backward-step"></i></button>
          <button class="deck-qta-media-btn deck-qta-media-btn--play" data-qta-media="playpause" title="${playing ? "Pause" : "Play"}"><i class="fas ${playing ? "fa-pause" : "fa-play"}"></i></button>
          <button class="deck-qta-media-btn" data-qta-media="next" title="Next"><i class="fas fa-forward-step"></i></button>
        </div>
      </div>`
    );
    $$("[data-qta-media]", bodyEl).forEach((btn) =>
      bindEvent(btn, "click", () => {
        mediaTray().sendControl({ stopPropagation() {} }, btn.dataset.qtaMedia);
        this.updateMediaPlayState();
      })
    );
    this.updateMediaPlayState();
  }

  mediaArtwork(src) {
    if (src.type === "metadata") return src.channel.nowPlaying?.artwork || "";
    return mediaTray().getArtwork(src.element);
  }

  mediaTitle(src) {
    if (src.type === "metadata") return src.channel.nowPlaying?.track || "Untitled";
    const win = src.element.closest(".window");
    return win ? os.window.getTitle(win.id) : "Now Playing";
  }

  mediaSubtitle(src) {
    if (src.type === "metadata") return src.channel.nowPlaying?.artist || "";
    const win = src.element.closest(".window");
    return win ? mediaTray().getSubtitle(win) : "Media";
  }

  mediaSourceLabel(src) {
    if (src.type === "metadata") return src.channel.title || "";
    const win = src.element.closest(".window");
    return win ? mediaTray().getSubtitle(win) : "";
  }

  isMediaPlaying(src) {
    if (src.type === "metadata") return src.channel.nowPlaying?.playbackState === "playing";
    return !src.element.paused;
  }

  updateMediaPlayState() {
    if (!this.el || !this.isOpen) return;
    this.refreshMediaTab();
    if (this.tab !== "media") return;
    const mt = mediaTray();
    const src = mt.getActiveSource();
    if (!src) {
      const bodyEl = $(".deck-qta-panel-body", this.el);
      if (bodyEl) this.renderMedia(bodyEl);
      return;
    }
    this.mediaSource = src;
    const playBtn = $('[data-qta-media="playpause"]', this.el);
    if (!playBtn) return;
    const playing = this.isMediaPlaying(src);
    playBtn.classList.toggle("deck-qta-media-btn--playing", playing);
    playBtn.title = playing ? "Pause" : "Play";
    const icon = $("i", playBtn);
    if (icon) icon.className = `fas ${playing ? "fa-pause" : "fa-play"}`;
    if (src.type === "element") {
      const el = src.element;
      const duration = el.duration || 0;
      const current = el.currentTime || 0;
      const fill = $(".deck-qta-media-progress-fill", this.el);
      if (fill) fill.style.width = duration ? `${Math.min(100, (current / duration) * 100)}%` : "0%";
      const times = $$(".deck-qta-media-time", this.el);
      if (times.length === 2) {
        setText(times[0], this.formatTime(current));
        setText(times[1], this.formatTime(duration));
      }
    }
  }

  formatTime(sec) {
    if (!isFinite(sec) || sec < 0) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  batteryIcon(level) {
    if (level > 65) return "fa-battery-three-quarters";
    if (level > 15) return "fa-battery-half";
    return "fa-battery-empty";
  }

  renderHelp(bodyEl) {
    const items = [
      { icon: "fa-book-open", label: "YukiOS Guide", app: "yukiOsGuideApp" },
      { icon: "fa-keyboard", label: "Shortcuts", app: "shortcutsApp" },
      { icon: "fa-info-circle", label: "About YukiOS", app: "aboutApp" }
    ];
    const infoRows = [
      { icon: "fa-tag", label: "Version", value: `YukiOS ${YUKIOS_VERSION}` },
      { icon: "fa-display", label: "Platform", value: navigator.platform },
      { icon: "fa-expand", label: "Display", value: `${window.innerWidth} × ${window.innerHeight}` }
    ];
    setHTML(
      bodyEl,
      `<div class="deck-qta-section">
        <div class="deck-qta-section-title">System</div>
        ${infoRows
          .map(
            (r) =>
              `<div class="deck-qta-row"><i class="fas ${r.icon}"></i><div class="deck-qta-row-main"><span class="deck-qta-row-label">${r.label}</span></div><span class="deck-qta-row-value">${escapeHtml(r.value)}</span></div>`
          )
          .join("")}
      </div>
      <div class="deck-qta-help-list">${items
        .map(
          (it) =>
            `<button class="deck-qta-help-row" data-help-app="${it.app}"><i class="fas ${it.icon}"></i><span>${it.label}</span><i class="fas fa-chevron-right"></i></button>`
        )
        .join("")}</div>`
    );
    $$("[data-help-app]", bodyEl).forEach((btn) =>
      bindEvent(btn, "click", () => {
        this.close();
        os.app.launch(btn.dataset.helpApp).catch(() => {});
      })
    );
  }

  updateBattery() {
    if (!this.el) return;
    const battery = this.manager?.batteryData || { level: 100, charging: false };
    const railBtn = $('[data-qta-tab="power"]', this.el);
    if (railBtn) toggleClass(railBtn, "charging", !!battery.charging);
    if (this.isOpen && this.tab === "power") {
      const statusEl = $("#qtaBatteryStatus", this.el);
      if (statusEl) {
        const icon = $(".deck-qta-battery-row i", statusEl);
        if (icon) icon.className = `fas ${this.batteryIcon(battery.level)}`;
        const labelEl = $(".deck-qta-row-label", statusEl);
        if (labelEl) setText(labelEl, `${battery.level}%`);
        const subEl = $(".deck-qta-row-sub", statusEl);
        if (subEl) setText(subEl, battery.charging ? "Charging" : battery.level <= 15 ? "Low battery" : "On battery");
      }
    }
  }

  updateVolume() {
    if (!this.el || !this.isOpen || this.tab !== "settings") return;
    const mx = audioMixer();
    const volume = mx.muted ? 0 : Math.round(mx.masterVolume * 100);
    const slider = $("#qtaVolume", this.el);
    if (slider) {
      setRangeSliderValue("qtaVolume", volume, this.el);
      const val = $(".deck-qta-row-value", slider.closest(".deck-qta-row"));
      if (val) setText(val, `${volume}%`);
    }
  }

  updateNetwork() {
    if (!this.el || !this.isOpen || this.tab !== "settings") return;
    const toggle = $("#qtaWifi", this.el);
    if (toggle) {
      const on = !!navigator.onLine;
      toggle.dataset.on = String(on);
      toggle.classList.toggle("on", on);
      toggle.setAttribute("aria-pressed", String(on));
    }
  }
}
