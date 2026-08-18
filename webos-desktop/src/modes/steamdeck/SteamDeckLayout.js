import { os, $, $$, createElement, setText, setHTML, StorageKeys } from "../../framework.js";
import { resolveAvatarUrl } from "../../social/avatarResolver.js";
import { fetchFriends, getCachedFriends } from "../../social/friendsApi.js";
import {
  avatarSrcForIndex,
  fetchCommunityOverview,
  fetchActivityOverview,
  buildPlayerRows,
  buildFriendCards,
  buildAvatarStrip,
  achievementsPercent
} from "../../games/steamOverviewData.js";
import { STEAM_NEWS_ITEMS } from "../../games/steamNewsData.js";
import { resolveIconHtml } from "../../shared/iconUtils.js";
import { renderFriendsListPanel, renderRequestsPanel } from "../../games/steamSocial.js";
import { steamDeckAudio } from "./SteamDeckAudio.js";
import { renderDeckMediaView, destroyActiveCarousel } from "./deckMediaCarousel.js";
import { escapeHtml as esc, formatGameActivityTime, formatLastPlayed } from "../../utils/utils.js";
import { isUrlIcon } from "../../shared/urlUtils.js";
import { SteamDataManager } from "../../games/games.js";
import { collectSpatialFocusables } from "./focusGrid.js";
import { injectAdsterraAd, ADSTERRA_KEYS } from "../../ads.js";

const NAV_ITEMS = [
  { id: "great", label: "Great On Deck" },
  { id: "all", label: "Installed" },
  { id: "archive", label: "Games" },
  { id: "lumin", label: "LuminSdk Games" },
  { id: "favorites", label: "Favorites" },
  { id: "collections", label: "Collections" }
];

const RAIL_ITEMS = [
  { id: "home", icon: "fa-house", label: "Home" },
  { id: "library", icon: "fa-table-list", label: "Library" },
  { id: "store", icon: "fa-tag", label: "Store" },
  { id: "friends", icon: "fa-user-group", label: "Friends & Chat" },
  { id: "media", icon: "fa-photo-film", label: "Media" },
  { id: "settings", icon: "fa-gear", label: "Settings" },
  { id: "power", icon: "fa-power-off", label: "Power" }
];

const NAV_ITEMS_HOME = [
  { id: "news", label: "What's new" },
  { id: "friends", label: "Friends", friendsPill: true },
  { id: "recommended", label: "Recommended" }
];

export function getNavSlideDirection(scope, fromTab, toTab) {
  const order = scope === "home" ? NAV_ITEMS_HOME : NAV_ITEMS;
  const from = order.findIndex((item) => item.id === fromTab);
  const to = order.findIndex((item) => item.id === toTab);
  if (from === -1 || to === -1) return "left";
  return to > from ? "left" : "right";
}

const buildFootHintHtml = (opts) => {
  if (opts.legend) {
    return `
      <div class="deck-foot-hint">
        <span class="deck-key" data-key="${opts.key}">${opts.key}</span>
        <div class="deck-hint-text">
          <span class="deck-hint-title">Showing</span>
          <div class="deck-status-pills">
            <span class="deck-status-pill play" title="Playable"><i class="fas fa-check"></i></span>
            <span class="deck-status-pill info" title="Info"><i class="fas fa-info"></i></span>
            <span class="deck-status-pill unknown" title="Unknown"><i class="fas fa-question"></i></span>
            <span class="deck-status-pill block" title="Unsupported"><i class="fas fa-ban"></i></span>
          </div>
        </div>
      </div>
    `;
  }
  if (opts.subId || opts.sub || opts.subText) {
    return `
      <div class="deck-foot-hint clickable" data-hint="${opts.key}" data-action="${opts.action || ""}">
        <span class="deck-key" data-key="${opts.key}">${opts.key}</span>
        <div class="deck-hint-text">
          <span class="deck-hint-title">${opts.title}</span>
          <span class="deck-hint-sub" id="${opts.subId || ""}">${opts.sub ?? opts.subText}</span>
        </div>
      </div>
    `;
  }
  return `
    <div class="deck-foot-hint clickable" data-hint="${opts.key}" data-action="${opts.action || ""}">
      <span class="deck-key" data-key="${opts.key}">${opts.key}</span>
      <div class="deck-hint-text">
        <span class="deck-hint-title">${opts.title}</span>
      </div>
    </div>
  `;
};
const EAGER_TILE_COUNT = 24;
const buildRecentGamesHtml = (games) => {
  if (!games || games.length === 0) return "";
  return `
    <div class="deck-section deck-recent-games" id="deck-recent-games">
      <h1 class="deck-recent-title">Recent Games</h1>
      <div class="deck-row deck-recent-list">
        ${games
          .map((game, index) => {
            const artHtml = isUrlIcon(game.icon)
              ? `<img src="${game.icon}" alt="${esc(game.title)}" loading="lazy" decoding="async">`
              : `<i class="deck-tile-icon ${game.icon}"></i>`;
            const glowVar = isUrlIcon(game.icon) ? ` style="--tile-art:url('${game.icon}')"` : "";
            return `
          <button class="deck-tile${index === 0 ? " recent-hero" : ""}" data-app-id="${game.appId}"${glowVar}>
            <div class="deck-tile-art">${artHtml}<span class="deck-tile-play"><i class="fas fa-check"></i></span></div>
            <span class="deck-tile-label">${esc(game.title)}</span>
          </button>`;
          })
          .join("")}
      </div>
    </div>
  `;
};
const buildNewsHref = (item) => {
  const match = /\/steam\/apps\/(\d+)\/header\.jpg/.exec(item.image || "");
  if (match) return `https://store.steampowered.com/app/${match[1]}/`;
  return "https://store.steampowered.com/";
};

const buildNewsFeedHtml = () => {
  const newsItems = (STEAM_NEWS_ITEMS || []).flat();
  if (newsItems.length === 0) return "";
  return `
    <div class="deck-section deck-news-feed deck-home-panel" id="deck-news-feed">
      <h1 class="deck-recent-title">What's New</h1>
      <div class="deck-row deck-news-list">
        ${newsItems
          .map(
            (item) => `
          <a class="deck-news-card" href="${buildNewsHref(item)}" target="_blank" rel="noopener noreferrer">
            <div class="deck-news-art">${resolveIconHtml(item.image, { alt: esc(item.title) })}</div>
            <div class="deck-news-posted">POSTED ${esc(item.date)}</div>
            <div class="deck-news-title">${esc(item.title)}</div>
            <div class="deck-news-desc">${esc(item.description || "")}</div>
          </a>
        `
          )
          .join("")}
      </div>
    </div>
  `;
};
const buildHomeHtml = (games) => `
  <div class="deck-rail-dimmer" id="deck-rail-dimmer"></div>
  <nav class="deck-rail">
    ${RAIL_ITEMS.map(
      (item) => `
      <button class="deck-rail-btn" data-rail="${item.id}" title="${item.label}">
        <i class="fas ${item.icon}"></i><span class="deck-rail-label">${item.label}</span>
      </button>
    `
    ).join("")}
  </nav>
  <div class="deck-shell">
    <div class="deck-recent-bg" id="deck-recent-bg"><div class="deck-bg-layer deck-bg-front"></div><div class="deck-bg-layer deck-bg-back"></div></div>
    <div class="deck-topbar">
      <img class="deck-topbar-avatar" id="steamdeck-topbar-avatar" alt="Profile" />
      <div class="deck-topbar-item" id="steamdeck-topbar-time"></div>
      <div class="deck-topbar-tray" id="steamdeck-topbar-tray"></div>
      <button class="deck-topbar-search" title="Search" data-action="search"><i class="fas fa-magnifying-glass"></i></button>
      <button class="deck-topbar-quick" title="Quick Access" data-action="quick"><i class="fas fa-sliders"></i></button>
      <button class="deck-topbar-power" title="Power" data-action="showPower"><i class="fas fa-power-off"></i></button>
    </div>
    <div class="deck-main">
    ${buildRecentGamesHtml(games)}
       <div class="deck-nav">
        ${NAV_ITEMS_HOME.map(
          (item) => `
          <button class="deck-nav-btn" data-action="${item.id}">
            <span>${item.label}</span>${item.friendsPill ? `<span class="deck-nav-friend-pill"><i class="fas fa-user-group"></i><span class="deck-friend-count">0</span></span>` : ""}
          </button>
        `
        ).join("")}
    </div>
      <div id="steamdeck-recents"></div>
      <div class="deck-steam-panel" id="deck-steam-panel"></div>
      <div id="steamdeck-home-panel"></div>
    </div>
     

    <div class="deck-foot">
      <div class="deck-foot-left">
        <button class="deck-foot-btn" title="Yuki Deck" data-action="deckHome"><span>Yuki Deck</span></button>
        <button class="deck-foot-btn deck-foot-btn-menu" title="Menu" data-action="menu"><span>Menu</span></button>
      </div>
      <div class="deck-foot-right">
        ${buildFootHintHtml({ key: "X", legend: true })}
        ${buildFootHintHtml({ key: "Y", title: "Sort By", subId: "deck-sort-label", subText: "Original" })}
        ${buildFootHintHtml({ key: "A", title: "Select" })}
        ${buildFootHintHtml({ key: "B", title: "Back", action: "back" })}
      </div>
    </div>
  </div>
  <div class="deck-detail" id="steamdeck-detail"></div>
  <div class="deck-power" id="steamdeck-power">
    <div class="deck-power-title">Power</div>
    <div class="deck-power-content">
      <div class="deck-power-buttons">
        <button class="deck-menu-btn deck-power-btn" data-action="sleep"><span>Sleep</span></button>
        <button class="deck-menu-btn deck-power-btn" data-action="shutdown"><span>Shutdown</span></button>
        <button class="deck-menu-btn deck-power-btn" data-action="restart"><span>Restart</span></button>
        <button class="deck-menu-btn deck-power-btn" data-action="changeAccount"><span>Change Account</span></button>
        <button class="deck-menu-btn deck-power-btn" data-action="signOut"><span>Sign Out</span></button>
        <button class="deck-menu-btn deck-power-btn" data-action="switchToDesktop"><span>Switch to Desktop</span></button>
        <button class="deck-menu-btn deck-power-btn" data-action="cancel"><span>Cancel</span></button>
      </div>
    </div>
  </div>
`;
const buildShellHtml = () => `
  <div class="deck-rail-dimmer" id="deck-rail-dimmer"></div>
  <nav class="deck-rail">
    ${RAIL_ITEMS.map(
      (item) => `
      <button class="deck-rail-btn" data-rail="${item.id}" title="${item.label}">
        <i class="fas ${item.icon}"></i><span class="deck-rail-label">${item.label}</span>
      </button>
    `
    ).join("")}
  </nav>
  <div class="deck-shell">
    <div class="deck-topbar">
      <img class="deck-topbar-avatar" id="steamdeck-topbar-avatar" alt="Profile" />
      <div class="deck-topbar-item" id="steamdeck-topbar-time"></div>
      <div class="deck-topbar-tray" id="steamdeck-topbar-tray"></div>
      <button class="deck-topbar-search" title="Search" data-action="search"><i class="fas fa-magnifying-glass"></i></button>
      <button class="deck-topbar-quick" title="Quick Access" data-action="quick"><i class="fas fa-sliders"></i></button>
      <button class="deck-topbar-power" title="Power" data-action="showPower"><i class="fas fa-power-off"></i></button>
    </div>
    <div class="deck-header">
      <button class="deck-brand" title="Menu"><div class="deck-brand-icon">L1</div></button>
      <div class="deck-nav">
        ${NAV_ITEMS.map(
          (item) => `
          <button class="deck-nav-btn" data-action="${item.id}">
            <span>${item.label}</span><span class="deck-nav-count" data-nav-count="${item.id}"></span>
          </button>
        `
        ).join("")}
      </div>
      <div class="deck-total-count"><span id="deck-total-games">0</span> Games</div>
      <button class="deck-brand" title="R1"><div class="deck-brand-icon r1">R1</div></button>
    </div>
    <div class="deck-main">
      <div id="steamdeck-view"></div>
      <div id="steamdeck-recents"></div>
      <div class="deck-steam-panel" id="deck-steam-panel"></div>
    </div>
    <div class="deck-foot">
      <div class="deck-foot-left">
        <button class="deck-foot-btn" title="Yuki Deck" data-action="deckHome"><span>Yuki Deck</span></button>
        <button class="deck-foot-btn deck-foot-btn-menu" title="Menu" data-action="menu"><span>Menu</span></button>
      </div>
      <div class="deck-foot-right">
        ${buildFootHintHtml({ key: "X", legend: true })}
        ${buildFootHintHtml({ key: "Y", title: "Sort By", subId: "deck-sort-label", subText: "Original" })}
        ${buildFootHintHtml({ key: "A", title: "Select" })}
        ${buildFootHintHtml({ key: "B", title: "Back", action: "back" })}
      </div>
    </div>
  </div>
  <div class="deck-detail" id="steamdeck-detail"></div>
  <div class="deck-power" id="steamdeck-power">
    <div class="deck-power-title">Power</div>
    <div class="deck-power-content">
      <div class="deck-power-buttons">
        <button class="deck-menu-btn deck-power-btn" data-action="sleep"><span>Sleep</span></button>
        <button class="deck-menu-btn deck-power-btn" data-action="shutdown"><span>Shutdown</span></button>
        <button class="deck-menu-btn deck-power-btn" data-action="restart"><span>Restart</span></button>
        <button class="deck-menu-btn deck-power-btn" data-action="changeAccount"><span>Change Account</span></button>
        <button class="deck-menu-btn deck-power-btn" data-action="signOut"><span>Sign Out</span></button>
        <button class="deck-menu-btn deck-power-btn" data-action="switchToDesktop"><span>Switch to Desktop</span></button>
        <button class="deck-menu-btn deck-power-btn" data-action="cancel"><span>Cancel</span></button>
      </div>
    </div>
  </div>
`;

export class SteamDeckLayout {
  constructor(manager) {
    this.manager = manager;
    this.root = null;
    this.view = null;
    this.mainEl = null;
    this.recentsEl = null;
    this.detailEl = null;
    this.navBtnEls = [];
    this.railBtns = [];
    this.steamPanel = null;
    this.rail = null;
    this.railDimmer = null;
    this.railExpanded = false;
    this.homePanel = null;
    this.viewCache = null;
    this.viewCacheKey = null;
    this.lastFocusedGameId = null;
  }

  buildRoot(isLibraryStart = false) {
    const root = createElement("div", { id: "steamdeck-root" });
    root.classList.toggle("home", !isLibraryStart);
    if (isLibraryStart) setHTML(root, buildShellHtml());
    else setHTML(root, buildHomeHtml(this.manager.getContinuePlaying()));
    this.syncRefs(root);
    this.railDimmer.addEventListener("click", () => this.manager.closeRail({ hideSound: true }));
    this.railBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.rail === "power") {
          this.manager.runAction("showPower");
          this.manager.closeRail();
        } else {
          this.manager.setSideNav(btn.dataset.rail);
          this.manager.closeRail();
        }
      });
    });

    $("#steamdeck-topbar-avatar", this.root).addEventListener("click", () => this.manager.openAccountMenu());
    $("#steamdeck-topbar-time", this.root).addEventListener("click", () => this.manager.openCalendar());
    $(".deck-topbar-search", this.root).addEventListener("click", () => this.manager.toggleSearchOverlay());
    $(".deck-topbar-quick", this.root).addEventListener("click", () => this.manager.toggleQuickAccess());
    $(".deck-topbar-power", this.root).addEventListener("click", () => this.manager.runAction("showPower"));

    this.navBtnEls.forEach((btn) =>
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        if (action === "news" || action === "friends" || action === "recommended") {
          this.manager.setHomeTab(action);
        } else {
          this.manager.setLibraryTab(action);
        }
      })
    );

    $$(".deck-brand", this.root).forEach((btn) =>
      btn.addEventListener("click", () => {
        if (btn.title === "R1") this.manager.toggleQuickAccess();
        else this.manager.toggleRail();
      })
    );

    const recentGamesEl = $("#deck-recent-games", this.root);
    recentGamesEl?.addEventListener("click", (e) => {
      const tile = e.target.closest("[data-app-id]");
      if (!tile) return;
      this.scrollRecentTileToStart(tile);
      if (tile.classList.contains("deck-focused")) {
        this.manager.openDetail(tile.dataset.appId);
      } else {
        this.manager.focusElement(tile);
      }
    });

    if (this.view) this.view.addEventListener("click", (e) => this.handleViewClick(e));

    $$(".deck-power-btn", this.root).forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.classList.contains("deck-power-selected")) {
          steamDeckAudio.playSwitchNav();
          this.manager.runAction(btn.dataset.action);
        } else {
          steamDeckAudio.playNavigation();
          $$(".deck-power-btn", this.root).forEach((b) => b.classList.remove("deck-power-selected"));
          btn.classList.add("deck-power-selected");
        }
      });
    });

    this.root.addEventListener(
      "contextmenu",
      (e) => {
        if (!e.target.closest(".deck-carousel-item")) {
          e.preventDefault();
        }
      },
      true
    );
    this.root.addEventListener("contextmenu", (e) => this.handleTileContextMenu(e));
    this.recentsEl.addEventListener("click", (e) => this.handleRecentsClick(e));
    this.detailEl.addEventListener("click", (e) => this.handleDetailClick(e));

    $$(".deck-foot-left [data-action], .deck-foot-hint[data-action]", this.root).forEach((el) =>
      el.addEventListener("click", () => this.manager.runAction(el.dataset.action))
    );
    $('.deck-foot-hint[data-hint="Y"]', this.root).addEventListener("click", () => this.manager.cycleSortByName());
    $('.deck-foot-hint[data-hint="A"]', this.root).addEventListener("click", () => this.manager.confirmFocus());

    this.root.addEventListener("wheel", (e) => this.handleRowWheel(e), { passive: false });

    this.updateTopbarAvatar();
    this.updateFriendCount();
    return root;
  }

  syncRefs(root) {
    this.root = root;
    this.railDimmer = $("#deck-rail-dimmer", root);
    this.rail = $(".deck-rail", root);
    this.railBtns = $$(".deck-rail-btn", root);
    this.topbarTrayEl = $("#steamdeck-topbar-tray", root);
    this.navBtnEls = $$(".deck-nav-btn", root);
    this.view = $("#steamdeck-view", root);
    this.mainEl = $(".deck-main", root);
    this.recentsEl = $("#steamdeck-recents", root);
    this.steamPanel = $("#deck-steam-panel", root);
    this.detailEl = $("#steamdeck-detail", root);
    this.powerEl = $("#steamdeck-power", root);
    this.homePanelEl = $("#steamdeck-home-panel", root);
    return this.root;
  }

  handleRowWheel(e) {
    const target = e.target.closest(".deck-main *");
    const scroller = target?.closest(
      ".deck-row, .deck-recent-list, .deck-news-list, .deck-recents-list, .deck-sections-col"
    );
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth) return;
    e.preventDefault();
    const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    scroller.scrollLeft += delta;
  }

  scrollRecentTileToStart(tile) {
    const scroller = tile.closest(".deck-row, .deck-recent-list");
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth) return;
    const tileLeft = tile.getBoundingClientRect().left;
    const scrollerLeft = scroller.getBoundingClientRect().left;
    scroller.scrollLeft += Math.max(0, tileLeft - scrollerLeft);
  }

  handleViewClick(e) {
    const manager = this.manager;
    const newsCard = e.target.closest(".deck-news-card");
    if (newsCard) {
      e.preventDefault();
      e.stopPropagation();
      const url = newsCard.getAttribute("href");
      if (url) os.app.launch("browserApp", { openUrl: url }).catch(() => {});
      return;
    }
    if (e.target.closest('[data-action="luminFullscreen"]')) return this.toggleLuminFullscreen();
    const collectionTile = e.target.closest(".deck-collection-tile[data-collection-id]");
    if (collectionTile) return manager.openCollection(collectionTile.dataset.collectionId);
    const playBtn = e.target.closest(".deck-tile-play");
    if (playBtn) {
      const tile = playBtn.closest(".deck-tile[data-app-id]");
      if (tile) return manager.launchApp(tile.dataset.appId);
    }
    const tile = e.target.closest(".deck-tile[data-app-id]");
    if (tile) {
      const appId = tile.dataset.appId;
      const archiveGame = this.manager.archiveGamesCache?.find((g) => g.appId === appId);
      if (archiveGame) return manager.launchArchiveGame(archiveGame);
      if (tile.classList.contains("deck-focused")) return manager.openDetail(tile.dataset.appId);
      return manager.focusElement(tile);
    }
  }

  handleTileContextMenu(e) {
    const tile = e.target.closest(".deck-tile[data-app-id]");
    if (!tile) return;
    e.preventDefault();
    e.stopPropagation();
    this.manager.focusElement(tile);
    this.manager.showGameContextMenu(e, tile.dataset.appId);
  }

  handleRecentsClick(e) {
    const item = e.target.closest(".deck-recent-item[data-win-id]");
    if (item) this.manager.focusWindow(item.dataset.winId);
  }

  handleDetailClick(e) {
    const actionEl = e.target.closest("[data-action]");
    if (!actionEl) return;
    const appId = this.manager.detailAppId;
    const action = actionEl.dataset.action;
    if (action.startsWith("tab-")) {
      this.switchDetailTab(action.slice(4));
      return;
    }
    const actions = {
      back: () => this.manager.closeDetail(),
      play: () => this.manager.launchApp(appId),
      favorite: () => this.manager.toggleFavorite(appId),
      saveToCollection: () => this.manager.addCurrentToCollection(appId)
    };
    actions[action]?.();
  }

  async updateTopbarAvatar() {
    const el = $("#steamdeck-topbar-avatar", this.root);
    if (!el) return;
    const userId = os.storage.get(StorageKeys.userId);
    const history = os.storage.get(StorageKeys.userHistory) || [];
    const current = history.find((u) => u.userId === userId);
    const avatar = (current && current.avatar) || os.storage.get(StorageKeys.profilePicture);
    const url = await resolveAvatarUrl(avatar, "static/icons/guest.webp");
    el.src = url;
  }

  async updateFriendCount() {
    const els = $$(".deck-friend-count", this.root);
    if (els.length === 0) return;
    const setCount = (n) => els.forEach((el) => setText(el, String(n)));
    const cached = getCachedFriends();
    const cachedCount = Array.isArray(cached?.friends) ? cached.friends.length : 0;
    setCount(cachedCount);
    try {
      const data = await fetchFriends({ refresh: true });
      const count = Array.isArray(data?.friends) ? data.friends.length : 0;
      setCount(count);
    } catch {}
  }

  setRailActive(id) {
    this.railBtns.forEach((btn) => btn.classList.toggle("active", btn.dataset.rail === id));
  }

  setRailExpanded(expanded) {
    this.railExpanded = !!expanded;
    if (this.rail) this.rail.classList.toggle("expanded", this.railExpanded);
    if (this.railDimmer) this.railDimmer.classList.toggle("on", this.railExpanded);
  }

  ensureSteamPanel() {
    if (!this.steamPanel) {
      this.steamPanel = createElement("div", { className: "deck-steam-panel", id: "deck-steam-panel" });
    }
    return this.steamPanel;
  }

  setPanelPage(page) {
    if (!this.root) return;
    if (page) {
      this.root.dataset.panel = page;
    } else {
      delete this.root.dataset.panel;
    }
  }

  showSteamPanel() {
    if (this.steamPanel) this.steamPanel.classList.add("open");
    if (this.view) this.view.style.display = "none";
  }

  hideSteamPanel() {
    if (this.steamPanel) this.steamPanel.classList.remove("open");
    if (this.view) this.view.style.display = "";
  }

  async render() {
    this.updateNavState();
    this.updateNavCounts();
    if (this.manager.displayMode === "media" && this.view) {
      this.renderMediaView();
      this.renderRecents();
      this.renderHomePanel();
      return;
    }
    destroyActiveCarousel();
    if (!this.view) {
      this.renderRecents();
      this.renderHomePanel();
      return;
    }
    this.view.classList.remove("deck-media-view");
    this.view.classList.remove("deck-library-view");
    const stamp = this.manager.viewStamp ?? 0;
    const key = this.manager.activeCollectionId
      ? `collection:${this.manager.activeCollectionId}:${stamp}`
      : `${this.manager.libraryTab}:${stamp}`;
    if (this.viewCacheKey === key && this.viewCache && this.manager.libraryTab !== "lumin") {
      setHTML(this.view, this.viewCache);
      this.view.addEventListener("click", (e) => this.handleViewClick(e));
    } else {
      this.viewCacheKey = key;
      setHTML(this.view, "");
      const tab = this.manager.libraryTab;
      this.syncRendered = true;
      if (this.manager.activeCollectionId) {
        this.renderCollectionDetail();
        this.view.addEventListener("click", (e) => this.handleViewClick(e));
      } else if (tab === "all") {
        this.renderAllGames();
      } else if (tab === "great") {
        this.renderGreatGames();
      } else if (tab === "archive") {
        await this.renderArchive();
      } else if (tab === "lumin") {
        this.renderLumin();
        this.view.addEventListener("click", (e) => this.handleViewClick(e));
      } else if (tab === "favorites") {
        this.renderFavorites();
        this.view.addEventListener("click", (e) => this.handleViewClick(e));
      } else if (tab === "collections") {
        this.renderCollections();
        this.view.addEventListener("click", (e) => this.handleViewClick(e));
      }
      if (this.syncRendered) this.viewCache = this.view.innerHTML;
    }
    this.renderRecents();
    this.renderHomePanel();
  }

  async renderMediaView() {
    if (!this.view) return;
    this.view.classList.add("deck-media-view");
    setHTML(this.view, "");
    await renderDeckMediaView(this.view);
  }

  updateNavState() {
    this.navBtnEls.forEach((btn) => {
      const action = btn.dataset.action;
      const isHome = action === "news" || action === "friends" || action === "recommended";
      const isSelected = isHome ? action === this.manager.homeTab : action === this.manager.libraryTab;
      btn.classList.toggle("active", isSelected);
      btn.classList.toggle("deck-focused", isSelected);
    });
  }

  async updateNavCounts() {
    const counts = {
      great: this.manager.getGreatGames().length,
      all: this.manager.getInstalledGames().length,
      archive: 1680,
      lumin: 1000,
      favorites: this.manager.getFavoriteEntries().length,
      collections: this.manager.getCollections().length
    };
    $$(".deck-nav-count", this.root).forEach((el) => {
      const id = el.dataset.navCount;
      if (id in counts) setText(el, counts[id]);
    });
    const totalEl = $("#deck-total-games", this.root);
    if (totalEl) setText(totalEl, counts.all + counts.archive + counts.lumin);
  }

  fillGridIncrementally(grid, list, manager, onDone, anchor, opts = {}) {
    const token = opts.token || null;
    if (token) {
      token.aborted = false;
    } else {
      if (this.gridChunkToken) this.gridChunkToken.aborted = true;
    }
    const t = token || { aborted: false };
    if (!token) this.gridChunkToken = t;
    const eagerBase = opts.eagerBase || 0;
    let index = 0;
    const CHUNK_SIZE = 60;
    const step = () => {
      if (t.aborted) return;
      const end = Math.min(index + CHUNK_SIZE, list.length);
      const frag = document.createDocumentFragment();
      for (let i = index; i < end; i++) {
        frag.appendChild(this.htmlToElement(this.buildTileHtml(list[i], { eager: eagerBase + i < EAGER_TILE_COUNT })));
      }
      if (anchor && anchor.isConnected) grid.insertBefore(frag, anchor);
      else grid.appendChild(frag);
      index = end;
      if (index < list.length) {
        requestAnimationFrame(step);
      } else {
        if (!token) this.gridChunkToken = null;
        onDone?.();
      }
    };
    step();
  }

  renderScrollableGrid(grid, list, manager, opts = {}) {
    const pageSize = opts.pageSize || 120;
    const onDone = opts.onDone;
    const onPage = opts.onPage;
    if (this.gridChunkToken) this.gridChunkToken.aborted = true;
    const token = { aborted: false };
    this.gridChunkToken = token;
    let offset = 0;
    let pageIndex = 0;
    let sentinel = null;
    let io = null;

    const finish = () => {
      io?.disconnect();
      sentinel?.remove();
      if (this.gridChunkToken === token) this.gridChunkToken = null;
      onDone?.();
    };

    const renderPage = () => {
      if (token.aborted) return;
      const eagerBase = offset;
      const chunk = list.slice(offset, offset + pageSize);
      offset += pageSize;
      if (!chunk.length) {
        finish();
        return;
      }
      const eager = pageIndex === 0;
      pageIndex++;
      this.fillGridIncrementally(grid, chunk, manager, () => onPage?.(), sentinel, { eager, eagerBase, token });
    };

    sentinel = createElement("div", { className: "deck-load-sentinel" });
    grid.appendChild(sentinel);
    io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) renderPage();
      },
      { root: this.mainEl || null, rootMargin: "1000px 0px" }
    );
    renderPage();
    io.observe(sentinel);
    return () => {
      token.aborted = true;
      io?.disconnect();
      sentinel?.remove();
    };
  }

  renderSearchableLibrary(initialList, filterSource = initialList) {
    const manager = this.manager;
    this.syncRendered = false;
    this.view?.classList.add("deck-library-view");
    this.view?.insertAdjacentHTML(
      "beforeend",
      `
      <div class="deck-library">
        <div class="deck-search"><i class="fas fa-magnifying-glass"></i><input placeholder="Search games..."></div>
        <div class="deck-grid"></div>
        <div class="deck-ad-block"><div class="deck-ad-label">Advertisement</div><div id="deck-library-ad"></div></div>
      </div>
    `
    );
    const wrap = this.view?.lastElementChild;
    const input = $(".deck-search input", wrap);
    const grid = $(".deck-grid", wrap);
    injectAdsterraAd("deck-library-ad", ADSTERRA_KEYS.leaderboard, 728, 90, 400);
    this.view?.addEventListener("click", (e) => this.handleViewClick(e));
    let stopLoad = null;
    const fillGrid = (list, cacheResult, preserveScroll = 0) => {
      stopLoad?.();
      setHTML(grid, "");
      stopLoad = this.renderScrollableGrid(grid, list, manager, {
        onPage: () => {
          manager.collectFocus();
          manager.updateFocus(false);
        },
        onDone: () => {
          if (cacheResult) this.viewCache = this.view.innerHTML;
          manager.collectFocus();
          manager.updateFocus(false);
          if (preserveScroll && this.mainEl) this.mainEl.scrollTop = preserveScroll;
        }
      });
    };
    input?.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      const preserveScroll = q ? 0 : this.mainEl ? this.mainEl.scrollTop : 0;
      fillGrid(q ? filterSource.filter((g) => g.title.toLowerCase().includes(q)) : filterSource, false, preserveScroll);
    });
    fillGrid(initialList, true);
  }

  renderGreatGames() {
    this.renderSearchableLibrary(this.manager.getGreatGames(), this.manager.getGreatGames());
  }

  renderAllGames() {
    this.renderSearchableLibrary(this.manager.getLibraryList(), this.manager.getLibraryList());
  }

  renderTileSection(icon, titleText, entries, emptyText, headerHtml) {
    this.syncRendered = false;
    this.view?.insertAdjacentHTML(
      "beforeend",
      `
      <div class="deck-section">
        <div class="deck-section-title">${headerHtml ?? `<i class="fas ${icon}"></i><span>${esc(titleText)}</span>`}</div>
        <div class="deck-grid"></div>
      </div>
    `
    );
    const grid = $(".deck-grid", this.view);
    if (!grid) return;
    if (!entries.length) {
      setHTML(grid, `<div class="deck-note">${esc(emptyText)}</div>`);
    } else {
      this.renderScrollableGrid(grid, entries, this.manager, {
        onDone: () => {
          this.viewCache = this.view.innerHTML;
        }
      });
    }
  }

  renderFavorites() {
    this.renderTileSection(
      "fa-star",
      "Favorites",
      this.manager.getFavoriteEntries(),
      "No favorites yet. Star something from a detail page."
    );
  }

  async renderArchive() {
    const archiveGames = await this.manager.getArchiveGames();
    this.renderSearchableLibrary(archiveGames, archiveGames);
    this.updateNavCounts();
  }

  renderLumin() {
    if (!this.view) return;
    this.view.insertAdjacentHTML(
      "beforeend",
      `
      <div class="deck-section">
        <div class="deck-section-title"><i class="fas fa-gamepad"></i><span>LuminSdk Games</span></div>
        <div class="deck-lumin-container">
          <div class="deck-lumin-toolbar">
            <button class="deck-btn deck-lumin-fullscreen-btn" data-action="luminFullscreen" title="Toggle fullscreen">
              <i class="fas fa-expand deck-lumin-fullscreen-icon"></i>
              <span class="deck-lumin-fullscreen-label">Fullscreen</span>
            </button>
          </div>
          <iframe id="deck-luminsdk-iframe" allowfullscreen class="deck-lumin-iframe"></iframe>
        </div>
      </div>
    `
    );
    if (!this.luminFsBound) {
      this.luminFsBound = true;
      document.addEventListener("fullscreenchange", () => this.syncLuminFullscreenButton());
      document.addEventListener("webkitfullscreenchange", () => this.syncLuminFullscreenButton());
    }
    const iframe = this.view.querySelector("#deck-luminsdk-iframe");
    if (iframe) {
      iframe.onload = () => {
        if (!iframe.contentWindow) return;
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { margin: 0; padding: 0; background: var(--bg-secondary); }
              #games { width: 100%; height: 100%; }
            </style>
          </head>
          <body>
            <div id="games"></div>
            <script src="https://cdn.jsdelivr.net/gh/luminsdk/script@latest/lumin.min.js"><\/script>
            <script>
              Lumin.init({
                container: '#games',
                theme: 'dark'
              });
            <\/script>
          </body>
          </html>
        `);
        iframeDoc.close();
      };
    }
  }

  toggleLuminFullscreen() {
    const container = $(".deck-lumin-container", this.view);
    if (!container) return;
    try {
      if (document.fullscreenElement === container || document.webkitFullscreenElement === container) {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      } else if (container.requestFullscreen) {
        container.requestFullscreen();
      } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
      }
    } catch {}
  }

  syncLuminFullscreenButton() {
    const btn = $('[data-action="luminFullscreen"]', this.view);
    if (!btn) return;
    const container = $(".deck-lumin-container", this.view);
    const active =
      !!container && (document.fullscreenElement === container || document.webkitFullscreenElement === container);
    const icon = $(".deck-lumin-fullscreen-icon", btn);
    const label = $(".deck-lumin-fullscreen-label", btn);
    if (icon)
      icon.className = active
        ? "fas fa-compress deck-lumin-fullscreen-icon"
        : "fas fa-expand deck-lumin-fullscreen-icon";
    if (label) setText(label, active ? "Exit Fullscreen" : "Fullscreen");
  }

  renderCollections() {
    const collections = this.manager.getCollections();
    const tilesHtml = collections.length
      ? collections
          .map(
            (col) => `
          <button class="deck-tile deck-collection-tile" data-collection-id="${col.id}">
            <div class="deck-tile-art"><i class="deck-tile-icon fas fa-folder"></i><span class="deck-tile-count">${col.gameIds.length}</span></div>
            <span class="deck-tile-label">${esc(col.name)}</span>
          </button>
        `
          )
          .join("")
      : `<div class="deck-note">Create collections to group your games.</div>`;
    this.view.insertAdjacentHTML(
      "beforeend",
      `
      <div class="deck-section deck-collections">
        <div class="deck-section-title"><i class="fas fa-folder-open"></i><span>Collections</span></div>
        <button class="deck-btn" data-action="newCollection"><i class="fas fa-plus"></i><span>New Collection</span></button>
        <div class="deck-grid">${tilesHtml}</div>
      </div>
    `
    );
  }

  renderCollectionDetail() {
    const entries = this.manager.getCollectionEntries(this.manager.activeCollectionId);
    const headerHtml = `<button class="deck-btn" data-action="closeCollection"><i class="fas fa-arrow-left"></i><span>All Collections</span></button>`;
    this.renderTileSection(
      null,
      null,
      entries,
      "This collection is empty. Add a game from its detail page.",
      headerHtml
    );
  }

  buildTileHtml(entry, opts) {
    const icon = entry.thumb || entry.icon;
    const imgAttrs = opts?.eager
      ? `loading="eager" fetchpriority="high" decoding="async"`
      : `loading="lazy" fetchpriority="low" decoding="async"`;
    const artHtml = isUrlIcon(icon)
      ? `<img src="${icon}" alt="${esc(entry.title)}" ${imgAttrs}>`
      : `<i class="deck-tile-icon ${icon}"></i>`;
    const glowVar = isUrlIcon(icon) ? ` style="--tile-art:url('${icon}')"` : "";
    return `
      <button class="deck-tile${opts?.hero ? " hero" : ""}" data-app-id="${entry.appId}"${glowVar}>
        <div class="deck-tile-art">${artHtml}<span class="deck-tile-play"><i class="fas fa-check"></i></span></div>
        <span class="deck-tile-label">${esc(entry.title)}</span>
      </button>
    `;
  }

  buildGameTileHtml(game) {
    const artHtml = isUrlIcon(game.icon)
      ? `<img src="${game.icon}" alt="${esc(game.title)}" loading="lazy" decoding="async">`
      : `<i class="deck-tile-icon ${game.icon}"></i>`;
    const glowVar = isUrlIcon(game.icon) ? ` style="--tile-art:url('${game.icon}')"` : "";
    return `
      <button class="deck-tile" data-app-id="${game.appId}"${glowVar}>
        <div class="deck-tile-art">${artHtml}<span class="deck-tile-play"><i class="fas fa-check"></i></span></div>
        <span class="deck-tile-label">${esc(game.title)}</span>
      </button>
    `;
  }

  buildSectionHtml(titleText, iconClass, entries, opts) {
    const containerClass = opts?.row ? "deck-row" : "deck-grid";
    return `
      <div class="deck-section">
        <div class="deck-section-title"><i class="fas ${iconClass}"></i><span>${esc(titleText)}</span></div>
        <div class="${containerClass}">${entries.map((entry) => this.buildTileHtml(entry, opts)).join("")}</div>
      </div>
    `;
  }

  htmlToElement(html) {
    const tpl = document.createElement("template");
    tpl.innerHTML = html.trim();
    return tpl.content.firstElementChild;
  }

  buildSection(titleText, iconClass, entries, opts) {
    return this.htmlToElement(this.buildSectionHtml(titleText, iconClass, entries, opts));
  }

  buildTile(entry, opts) {
    const tile = this.htmlToElement(this.buildTileHtml(entry, opts));
    tile.addEventListener("click", () => {
      if (tile.classList.contains("deck-focused")) this.manager.openDetail(entry.appId);
      else this.manager.focusElement(tile);
    });
    return tile;
  }

  renderHomePanel() {
    const el = this.homePanelEl;
    if (!el) return;
    const tab = this.manager.homeTab || "news";
    setHTML(el, "");
    if (tab === "friends") {
      const refresh = async () => {
        const data = await fetchFriends().catch(() => null);
        const requests = data && Array.isArray(data.requests) ? data.requests : [];
        const requestsHtml = requests.length
          ? '<div id="deck-friends-requests" class="deck-friends-requests"></div>'
          : "";
        setHTML(
          el,
          `<div class="deck-section deck-home-panel"><h1 class="deck-recent-title">Friends</h1>${requestsHtml}<div class="deck-home-friends" id="deck-home-friends"></div></div>`
        );
        if (requests.length) {
          renderRequestsPanel($("#deck-friends-requests", el), { onChange: refresh }).catch(() => {});
        }
        const friendsBody = $("#deck-home-friends", el);
        if (friendsBody) {
          renderFriendsListPanel(friendsBody, {
            onLaunch: (appId) => os.app.launch(appId).catch(() => {}),
            onUpdate: refresh
          }).catch(() => {
            setHTML(friendsBody, '<div class="deck-note">Could not load friends.</div>');
          });
        }
        this.updateFriendCount();
        el.insertAdjacentHTML("beforeend", '<div class="deck-home-spacer"></div>');
      };
      refresh();
    } else if (tab === "recommended") {
      const games = this.manager.getRecommendedGames();
      setHTML(
        el,
        `<div class="deck-section deck-home-panel"><h1 class="deck-recent-title">Recommended</h1><div class="deck-row deck-news-list">${games.map((game) => this.buildGameTileHtml(game)).join("")}</div></div>`
      );
    } else {
      setHTML(el, buildNewsFeedHtml());
    }
    el.insertAdjacentHTML("beforeend", '<div class="deck-home-spacer"></div>');
    this.manager.collectFocus();
    this.manager.updateFocus();
  }

  renderRecents() {
    if (!this.recentsEl) return;
    const recents = this.manager.getRecents();
    if (recents.length === 0) {
      setHTML(this.recentsEl, "");
      this.recentsEl.style.display = "none";
      return;
    }
    this.recentsEl.style.display = "flex";
    setHTML(
      this.recentsEl,
      `
      <span class="deck-recents-title"><i class="fas fa-layer-group"></i><span>Running</span></span>
      <div class="deck-recents-list">
        ${recents
          .map((r) => {
            const icon = typeof r.icon === "string" && r.icon.includes("fa-") ? r.icon : "fa-window-restore";
            return `<button class="deck-recent-item" data-win-id="${r.winId}"><i class="fas ${icon}"></i><span>${esc(r.title)}</span></button>`;
          })
          .join("")}
      </div>
    `
    );
  }

  revealHomePanel() {
    const main = this.mainEl;
    const panel = this.homePanelEl;
    if (!main || !panel) return;
    const target = panel.offsetTop - main.offsetTop;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        main.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
      });
    });
  }

  buildOverviewTabs(activeTab) {
    const tabs = [
      { id: "activity", label: "Activity" },
      { id: "stuff", label: "Your Stuff" },
      { id: "community", label: "Community" },
      { id: "info", label: "Game Info", icon: "fa-circle-info" }
    ];
    return tabs
      .map(
        (t) => `
        <button class="deck-nav-btn${t.id === activeTab ? " active" : ""}" data-action="tab-${t.id}">
          ${t.icon ? `<i class="fas ${t.icon}"></i>` : ""}<span>${t.label}</span>
        </button>
      `
      )
      .join("");
  }

  renderDetail(appId) {
    const manager = this.manager;
    const entry = manager.games.concat(manager.apps).find((g) => g.appId === appId);
    if (!entry) return;
    const isFavorite = manager.isFavorite(appId);
    const gameStats = SteamDataManager.getStats()[appId] || { totalMin: 0, lastPlayed: 0 };
    const recentMin = SteamDataManager.getRecentMinutes(appId);
    const artHtml = isUrlIcon(entry.icon)
      ? `<img src="${entry.icon}" alt="${esc(entry.title)}" loading="lazy" decoding="async">`
      : `<i class="deck-detail-icon ${entry.icon}"></i>`;
    const tab = manager.detailTab || "activity";
    setHTML(
      this.detailEl,
      `
      <div class="deck-overview">
        <div class="deck-overview-banner">
          <div class="deck-overview-banner-bg">${artHtml}</div>
          <button class="deck-detail-back" data-action="back"><i class="fas fa-arrow-left"></i><span>Back</span></button>
          <div class="deck-overview-title">${esc(entry.title)}</div>
          <div class="deck-overview-hero">${artHtml}</div>
        </div>
        <div class="deck-overview-bar">
          <button class="deck-overview-play" data-action="play"><i class="fas fa-play"></i><span>Play</span></button>
          <div class="deck-overview-stats">
            <div class="deck-overview-stat">
              <span>Last Played</span>
              <b>${formatLastPlayed(gameStats.lastPlayed)}</b>
            </div>
<div class="deck-overview-stat">
              <span>Recent</span>
              <b>${formatGameActivityTime(recentMin)}</b>
            </div>
          </div>
          <div class="deck-overview-tools">
            <button class="deck-overview-tool" data-action="controller"><svg class="deck-gamepad-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7,6H17A6,6 0 0,1 23,12A6,6 0 0,1 17,18C15.22,18 13.63,17.23 12.53,16H11.47C10.37,17.23 8.78,18 7,18A6,6 0 0,1 1,12A6,6 0 0,1 7,6M6,9V11H4V13H6V15H8V13H10V11H8V9H6M15.5,12A1.5,1.5 0 0,0 14,13.5A1.5,1.5 0 0,0 15.5,15A1.5,1.5 0 0,0 17,13.5A1.5,1.5 0 0,0 15.5,12M18.5,9A1.5,1.5 0 0,0 17,10.5A1.5,1.5 0 0,0 18.5,12A1.5,1.5 0 0,0 20,10.5A1.5,1.5 0 0,0 18.5,9Z"/></svg></button>
            <button class="deck-overview-tool" data-action="settings"><i class="fas fa-gear"></i></button>
          </div>
        </div>
        <div class="deck-overview-subbar">
          <div class="deck-overview-cloud"><i class="fas fa-cloud"></i><span>Yuki Steam Cloud: Up To Date</span></div>
          <div class="deck-overview-tabs">${this.buildOverviewTabs(tab)}</div>
        </div>
        <div class="deck-overview-content" id="deck-overview-content"></div>
      </div>
    `
    );
    this.detailEl.classList.add("open");
    this.renderDetailContent(tab, entry, isFavorite, gameStats);
  }

  renderDetailContent(tab, entry, isFavorite, gameStats) {
    const contentEl = $("#deck-overview-content", this.detailEl);
    if (!contentEl) return;
    const manager = this.manager;
    if (tab === "stuff") {
      const pct = achievementsPercent(gameStats.totalMin);
      setHTML(
        contentEl,
        `
        <div class="deck-overview-grid">
          <section class="deck-overview-panel">
            <h3 class="deck-overview-panel-title">Achievements</h3>
            <div class="deck-overview-ach-block">
              <div class="deck-overview-ach-row"><span>Progress</span><b>${pct}%</b></div>
              <div class="deck-overview-ach-bar"><span class="deck-overview-ach-fill"></span></div>
            </div>
            <p class="deck-overview-note">Keep playing to earn more achievements.</p>
          </section>
          <section class="deck-overview-panel">
            <h3 class="deck-overview-panel-title">Your Stuff</h3>
            <div class="deck-overview-actions">
              <button class="steam-overview-btn" data-action="favorite"><i class="fas ${isFavorite ? "fa-star" : "far fa-star"}"></i><span>${isFavorite ? "Remove from Favorites" : "Add to Favorites"}</span></button>
              <button class="steam-overview-btn" data-action="saveToCollection"><i class="fas fa-folder-plus"></i><span>Save to Collection</span></button>
            </div>
            <p class="deck-overview-note">${esc(entry.title)} · ${entry.type === "game" ? "Game" : "Application"}</p>
          </section>
        </div>
      `
      );
      const fill = $(".deck-overview-ach-fill", contentEl);
      if (fill) fill.style.width = `${pct}%`;
      this.appendDetailAd(contentEl);
      return;
    }
    if (tab === "community") {
      setHTML(
        contentEl,
        `
        <div class="deck-overview-grid">
          <section class="deck-overview-panel deck-overview-desc">
            <h3 class="deck-overview-panel-title">Description</h3>
            <p>${esc(manager.getDescription(entry.appId))}</p>
          </section>
          <section class="deck-overview-panel">
            <h3 class="deck-overview-panel-title">Community</h3>
            <p class="deck-overview-note">Loading community stats…</p>
          </section>
        </div>
      `
      );
      this.renderCommunityContent(contentEl, entry);
      return;
    }
    if (tab === "info") {
      setHTML(
        contentEl,
        `
        <div class="deck-overview-grid">
          <section class="deck-overview-panel deck-overview-desc">
            <h3 class="deck-overview-panel-title">About This Game</h3>
            <p>${esc(manager.getDescription(entry.appId))}</p>
          </section>
          <section class="deck-overview-panel">
            <h3 class="deck-overview-panel-title">Details</h3>
            <div class="deck-overview-detail-row"><span>Type</span><b>${entry.type === "game" ? "Game" : "Application"}</b></div>
            <div class="deck-overview-detail-row"><span>Last Played</span><b>${formatLastPlayed(gameStats.lastPlayed)}</b></div>
            <div class="deck-overview-detail-row"><span>Play Time</span><b>${formatGameActivityTime(gameStats.totalMin)}</b></div>
          </section>
        </div>
      `
      );
      this.appendDetailAd(contentEl);
      return;
    }
    setHTML(contentEl, '<div class="deck-overview-activity"><p class="deck-overview-note">Loading friends…</p></div>');
    this.renderActivityContent(contentEl);
    this.appendDetailAd(contentEl);
  }

  appendDetailAd(contentEl) {
    const slot = createElement("div", { className: "deck-ad-block" });
    slot.innerHTML = '<div class="deck-ad-label">Advertisement</div><div id="deck-detail-ad"></div>';
    contentEl.appendChild(slot);
    injectAdsterraAd("deck-detail-ad", ADSTERRA_KEYS.rectangle, 300, 250, 300);
  }

  async renderCommunityContent(contentEl, entry) {
    const manager = this.manager;
    const { playCount, playingNow, recentPlayers } = await fetchCommunityOverview(entry.appId);
    const playerRows = buildPlayerRows(recentPlayers, playingNow, {
      row: "deck-overview-friend",
      avatar: "deck-overview-friend-avatar",
      info: "deck-overview-friend-info"
    });
    setHTML(
      contentEl,
      `
      <div class="deck-overview-grid">
        <section class="deck-overview-panel deck-overview-desc">
          <h3 class="deck-overview-panel-title">Description</h3>
          <p>${esc(manager.getDescription(entry.appId))}</p>
        </section>
        <section class="deck-overview-panel deck-overview-friends">
          <div class="deck-overview-panel-head">
            <h3 class="deck-overview-panel-title">Community</h3>
            <span class="deck-overview-panel-sub">${playCount.toLocaleString()} PLAYS ALL TIME</span>
          </div>
          <div class="deck-overview-ach-row"><span>Total Plays</span><b>${playCount.toLocaleString()}</b></div>
          <div class="deck-overview-ach-row"><span>Playing Now</span><b>${playingNow.length}</b></div>
          <h3 class="deck-overview-panel-title deck-overview-community-sub">Recently Played By</h3>
          ${playerRows || '<p class="deck-overview-note">No one has played this recently.</p>'}
        </section>
      </div>
    `
    );
    this.appendDetailAd(contentEl);
  }

  async renderActivityContent(contentEl) {
    const { friends, count } = await fetchActivityOverview();
    const friendCards = buildFriendCards(friends, count, {
      row: "deck-overview-friend",
      avatar: "deck-overview-friend-avatar",
      info: "deck-overview-friend-info"
    });
    const avatarStrip = buildAvatarStrip(friends, "deck-overview-avatar");
    setHTML(
      contentEl,
      `
      <section class="deck-overview-panel deck-overview-friends">
        <div class="deck-overview-panel-head">
          <h3 class="deck-overview-panel-title">Friends</h3>
          <span class="deck-overview-panel-sub">${count} FRIEND${count === 1 ? "" : "S"} HAVE PLAYED RECENTLY</span>
        </div>
        ${count ? friendCards : '<p class="deck-overview-note">Add friends to see their activity here.</p>'}
      </section>
      <div class="deck-overview-cols">
        <section class="deck-overview-panel">
          <h3 class="deck-overview-panel-title">Played Previously</h3>
          <div class="deck-overview-avatar-row">${avatarStrip || '<span class="deck-overview-note">No activity yet.</span>'}</div>
        </section>
        <section class="deck-overview-panel">
          <h3 class="deck-overview-panel-title">On Their Wishlist</h3>
          <div class="deck-overview-avatar-row">${avatarStrip || '<span class="deck-overview-note">No activity yet.</span>'}</div>
        </section>
      </div>
    `
    );
  }

  switchDetailTab(tab) {
    if (this.manager.detailTab === tab) return;
    this.manager.detailTab = tab;
    steamDeckAudio.playSwitchNav();
    this.renderDetail(this.manager.detailAppId);
    this.manager.collectFocus();
    this.manager.updateFocus();
  }

  hideDetail() {
    if (this.detailEl) {
      this.detailEl.classList.remove("open");
      setHTML(this.detailEl, "");
    }
  }

  animateDetailIn() {
    const el = this.detailEl;
    if (!el) return;
    el.classList.remove("deck-detail-anim-out");
    el.classList.add("deck-detail-anim-in");
    setTimeout(() => el.classList.remove("deck-detail-anim-in"), 420);
  }

  animateDetailOut(callback) {
    const el = this.detailEl;
    if (!el) {
      callback?.();
      return;
    }
    el.classList.remove("deck-detail-anim-in");
    el.classList.add("deck-detail-anim-out");
    setTimeout(() => {
      el.classList.remove("deck-detail-anim-out");
      if (el.classList.contains("deck-detail-anim-in")) return;
      callback?.();
    }, 190);
  }

  slidePanelTransition(target, renderCallback, direction = "left") {
    const main = this.mainEl;
    const panel = target || this.view;
    if (!main || !panel) {
      renderCallback();
      return;
    }
    if (this.gridSlideTimer) clearTimeout(this.gridSlideTimer);
    if (this.gridSlideLayer) this.gridSlideLayer.remove();
    const forward = direction !== "right";
    const outX = forward ? "-100%" : "100%";
    const inX = forward ? "100%" : "-100%";
    main.classList.add("deck-grid-slide-active");
    const oldLayer = createElement("div", { class: "deck-grid-slide-layer deck-grid-slide-old" });
    oldLayer.style.top = main.scrollTop + "px";
    oldLayer.style.height = panel.offsetHeight + "px";
    setHTML(oldLayer, panel.innerHTML);
    panel.classList.remove("deck-grid-slide-new");
    panel.style.transform = "";
    panel.style.opacity = "";
    void panel.offsetWidth;
    main.appendChild(oldLayer);
    panel.style.transform = `translateX(${inX})`;
    panel.style.opacity = "0";
    void panel.offsetWidth;
    panel.classList.add("deck-grid-slide-new");
    oldLayer.style.transform = `translateX(${outX})`;
    oldLayer.style.opacity = "0";
    panel.style.transform = "translateX(0)";
    panel.style.opacity = "1";
    this.gridSlideLayer = oldLayer;
    this.gridSlideTimer = setTimeout(() => {
      this.gridSlideTimer = null;
      this.gridSlideLayer = null;
      oldLayer.remove();
      panel.classList.remove("deck-grid-slide-new");
      panel.style.transform = "";
      panel.style.opacity = "";
      main.classList.remove("deck-grid-slide-active");
    }, 580);
    renderCallback();
  }

  slideGridTransition(renderCallback, direction = "left") {
    this.slidePanelTransition(this.view, renderCallback, direction);
  }

  collectFocusables() {
    return collectSpatialFocusables(this.root, {
      detailEl: this.detailEl,
      detailOpen: !!this.manager.detailAppId
    });
  }

  scrollFocusedIntoView(el) {
    const margin = 12;
    let node = el.parentElement;
    while (node && node !== this.root) {
      if (node.scrollHeight > node.clientHeight || node.scrollWidth > node.clientWidth) {
        const containerRect = node.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const y =
          elRect.top - containerRect.top < 0
            ? elRect.top - containerRect.top - margin
            : elRect.bottom - containerRect.bottom > 0
              ? elRect.bottom - containerRect.bottom + margin
              : 0;
        const x =
          elRect.left - containerRect.left < 0
            ? elRect.left - containerRect.left - margin
            : elRect.right - containerRect.right > 0
              ? elRect.right - containerRect.right + margin
              : 0;
        if (x || y) node.scrollBy({ left: x, top: y, behavior: "smooth" });
      }
      node = node.parentElement;
    }
  }

  applyFocus(index, scroll = true) {
    if (!this.root) return;
    $$(".deck-focused", this.root).forEach((el) => el.classList.remove("deck-focused"));
    const entry = this.manager.focusables[index];
    if (!entry || !entry.el) return;
    entry.el.classList.add("deck-focused");
    const appId = entry.el.dataset.appId;
    if (appId && appId !== this.lastFocusedGameId) steamDeckAudio.playRailChange();
    if (appId) this.lastFocusedGameId = appId;
    if (scroll) this.scrollFocusedIntoView(entry.el);
    this.updateNavState();
    this.updateRecentBg(entry.el);
  }

  updateRecentBg(tile) {
    const bg = $("#deck-recent-bg", this.root);
    if (!bg) return;
    const recentSection = $("#deck-recent-games", this.root);
    if (!recentSection || !tile || !recentSection.contains(tile)) {
      bg.classList.remove("deck-recent-bg-visible");
      $$(".deck-bg-layer-active", bg).forEach((l) => l.classList.remove("deck-bg-layer-active"));
      delete bg.dataset.url;
      return;
    }
    const art = tile.querySelector(".deck-tile-art img, .deck-tile-art .deck-tile-icon");
    let bgUrl = "";
    if (art?.tagName === "IMG") bgUrl = art.currentSrc || art.src || "";
    else if (art) bgUrl = art.textContent.trim();
    if (!bgUrl) return;
    if (bg.dataset.url === bgUrl) return;
    bg.dataset.url = bgUrl;

    const layers = [bg.querySelector(".deck-bg-front"), bg.querySelector(".deck-bg-back")];
    if (!layers[0] || !layers[1]) return;

    const wasVisible = bg.classList.contains("deck-recent-bg-visible");
    const activeIdx = layers.findIndex((l) => l.classList.contains("deck-bg-layer-active"));
    const incomingIdx = activeIdx >= 0 ? 1 - activeIdx : 0;
    const incoming = layers[incomingIdx];
    const outgoing = layers[1 - incomingIdx];

    const setImage = (layer, el) => {
      layer.textContent = "";
      const child = el?.tagName === "IMG" ? document.createElement("img") : document.createElement("i");
      if (el?.tagName === "IMG") {
        child.src = bgUrl;
        child.alt = "";
      } else {
        child.className = bgUrl;
      }
      layer.appendChild(child);
    };

    setImage(incoming, art);
    if (wasVisible) {
      requestAnimationFrame(() => {
        incoming.classList.add("deck-bg-layer-active");
        void incoming.offsetWidth;
        outgoing.classList.remove("deck-bg-layer-active");
        window.setTimeout(() => {
          if (!outgoing.classList.contains("deck-bg-layer-active")) outgoing.textContent = "";
        }, 700);
      });
    } else {
      incoming.classList.add("deck-bg-layer-active");
      bg.classList.add("deck-recent-bg-visible");
    }
  }
}
