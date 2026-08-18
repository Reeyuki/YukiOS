import "./style.css";
import { os, StorageKeys, $, $$, setHTML, createElement } from "../../framework.js";
import { BusEvents } from "../../core/EventBus.js";
import { trayManager } from "../../tray/tray.js";
import { KeybindManager } from "../../keybindManager.js";
import { SteamDeckLayout, getNavSlideDirection } from "./SteamDeckLayout.js";
import { setCurrentCalendarMonth, createCalendarPopup } from "../../apps/calendar.js";
import { QuickAccessPanel } from "./quickAccess.js";
import { performanceManager } from "../../shared/performanceManager.js";
import { showDynamicContextMenu } from "../../shared/contextMenu.js";
import { SteamDataManager, HIGHLIGHTED_GAMES, SteamAppRenderer, launcher } from "../../games/games.js";
import { descriptionMap, APP_DESCRIPTIONS } from "../../games/gameDescriptions.js";
import { getAppRegistry } from "../../appRegistry.js";
import { STORE_GAMES } from "../../games/steam.js";
import { launchSplash } from "./launchSplash.js";
import { isDeckBootVideoVisible } from "./deckBootVideo.js";
import { steamDeckAudio } from "./SteamDeckAudio.js";
import { destroyActiveCarousel } from "./deckMediaCarousel.js";
import { escapeHtml, formatGameActivityTime, formatLastPlayed } from "../../utils/utils.js";
import { moveSpatialFocus } from "./focusGrid.js";

const HOLD_CONFIRM_DURATION = 800;
const HOLD_TICK_MS = 30;
const HOLD_TICKS = Math.round(HOLD_CONFIRM_DURATION / HOLD_TICK_MS);
const STORE_GAME_IDS = new Set(STORE_GAMES.map((g) => g.app));

export class SteamDeckManager {
  constructor() {
    this.active = false;
    this.root = null;
    this.layout = null;
    this.games = [];
    this.apps = [];
    this.focusables = [];
    this.focusIndex = 0;
    this.libraryTab = "great";
    this.homeTab = "news";
    this.nameSort = 0;
    this.detailAppId = null;
    this.detailReturnFocusIndex = 0;
    this.detailTab = "activity";
    this.quickAccessOpen = false;
    this.qta = null;
    this.batteryData = { level: 100, charging: true };
    this.timers = {};
    this.gamepadRaf = null;
    this.gamepadPrev = new Array(16).fill(false);
    this.unsubscribers = [];
    this.keyHandler = null;
    this.favorites = this.loadFavorites();
    this.collections = this.loadCollections();
    this.recentHidden = this.loadRecentHidden();
    this.activeCollectionId = null;
    this.isLibraryStart = false;
    this.storedFocus = {};
    this.viewStamp = 0;
    this.holdTimer = null;
    this.holdAction = null;
    this.holdEl = null;
    this.holdProgress = 0;
    this.modeRoots = {};
    this.displayMode = null;
    this.mediaPath = ["Pictures"];
    this.deckTransitionTimer = null;
    this.deckTransitionEl = null;
    this.greatGamesCache = null;
    this.greatGamesNameSort = 0;
  }

  gamepadConnectedHandler = () => {
    this.updateGamepadGlyphMode();
    if (this.active && !this.gamepadRaf) this.startGamepad();
  };
  gamepadDisconnectedHandler = () => this.updateGamepadGlyphMode();
  holdKeyUpHandler = (e) => {
    if (!this.holdAction || this.holdProgress >= 100) return;
    if (KeybindManager.matches(e, "steamdeck.confirm")) {
      this.cancelHoldConfirm();
    }
  };

  setup() {
    if (this.active) return;
    this.active = true;
    const catalog = this.buildCatalog();
    this.games = catalog.games;
    this.apps = catalog.apps;
    this.layout = new SteamDeckLayout(this);
    this.sideNav = "home";
    this.modeRoots = {};
    this.isLibraryStart = false;
    this.root = this.getModeRoot(false);
    this.root.style.display = "";
    this.layout.render();
    this.layout.setRailActive("home");
    this.bindBus();
    this.bindInput();
    this.startPollers();
    this.startGamepad();
    this.setupTray();
    this.requestFullscreen();
    window.addEventListener("gamepadconnected", this.gamepadConnectedHandler);
    window.addEventListener("gamepaddisconnected", this.gamepadDisconnectedHandler);
    this.updateGamepadGlyphMode();
    if (os.storage.get(StorageKeys.deckPerfHud) === "true") {
      import("./deckPerfHud.js").then(({ deckPerfHud }) => deckPerfHud.init(this.root)).catch(() => {});
    }
    this.collectFocus();
    this.updateFocus();
  }

  teardown() {
    if (!this.active) return;
    this.active = false;
    destroyActiveCarousel();
    window.removeEventListener("gamepadconnected", this.gamepadConnectedHandler);
    window.removeEventListener("gamepaddisconnected", this.gamepadDisconnectedHandler);
    this.cancelHoldConfirm();
    if (this.pollTick) clearInterval(this.pollTick);
    if (this.splashTimeout) clearTimeout(this.splashTimeout);
    this.pollTick = null;
    this.splashTimeout = null;
    launchSplash.close();
    this.unsubscribers.forEach((unsub) => {
      try {
        unsub();
      } catch {}
    });
    this.unsubscribers = [];
    if (this.keyHandler) {
      document.removeEventListener("keydown", this.keyHandler);
      this.keyHandler = null;
    }
    document.removeEventListener("keyup", this.holdKeyUpHandler);
    this.stopGamepad();
    this.stopPollers();
    this.teardownTray();
    this.exitFullscreen();
    Object.values(this.modeRoots).forEach((root) => {
      if (root && root.parentNode) root.parentNode.removeChild(root);
    });
    this.modeRoots = {};
    this.root = null;
    if (this.qta) {
      this.qta.destroy();
      this.qta = null;
    }
    this.layout = null;
    this.focusables = [];
    this.focusIndex = 0;
    this.quickAccessOpen = false;
    this.detailAppId = null;
    this.detailTab = "activity";
    this.sideNav = "home";
    this.steamPanelPage = null;
    this.steamPanelOpen = false;
    this.steamPanelRenderer = null;
    this.railExpanded = false;
    this.displayMode = null;
    this.mediaPath = ["Pictures"];
  }

  buildCatalog() {
    const all = os.app.getAllApps() || {};
    const games = [];
    const apps = [];
    Object.entries(all).forEach(([appId, meta]) => {
      if (!meta || !meta.title) return;
      const entry = {
        appId,
        title: meta.title,
        icon: meta.icon || "fas fa-gamepad",
        type: meta.type === "system" ? "app" : "game"
      };
      (entry.type === "app" ? apps : games).push(entry);
    });
    return { games, apps };
  }

  getDescription(appId) {
    return descriptionMap[appId] || APP_DESCRIPTIONS[appId] || "Play this title right from the Deck.";
  }

  getFeatured() {
    return this.games.filter((g) => HIGHLIGHTED_GAMES.has(g.appId)).slice(0, 12);
  }

  getContinuePlaying() {
    const hidden = new Set(this.recentHidden);
    const recent = SteamDataManager.getRecentGames();
    const recentGames =
      recent && recent.length > 0
        ? recent.map((g) => this.games.find((x) => x.appId === g.id)).filter((g) => g && !hidden.has(g.appId))
        : [];
    const seen = new Set(recentGames.map((g) => g.appId));
    const filler = this.getFeatured().filter((g) => !seen.has(g.appId) && !hidden.has(g.appId));
    const result = recentGames.concat(filler).slice(0, 30);
    const heroIndex = result.findIndex((g) => g.appId === "helltaker");
    if (heroIndex > 0) {
      const hero = result.splice(heroIndex, 1)[0];
      result.unshift(hero);
    }
    return result;
  }

  getFavorites() {
    return this.favorites;
  }

  isFavorite(appId) {
    return this.favorites.some((f) => f.appId === appId);
  }

  loadFavorites() {
    try {
      const stored = os.storage.get(StorageKeys.steamDeckFavorites);
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  }

  saveFavorites() {
    os.storage.set(StorageKeys.steamDeckFavorites, this.favorites);
  }

  loadRecentHidden() {
    try {
      const stored = os.storage.get(StorageKeys.steamDeckRecentHidden);
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  }

  saveRecentHidden() {
    os.storage.set(StorageKeys.steamDeckRecentHidden, this.recentHidden);
  }

  getInstalledGames() {
    const registry = getAppRegistry();
    const aggAll = this.games.concat(this.apps);
    if (!registry) return aggAll;
    const result = aggAll.filter((g) => !registry.isAppUninstalled(g.appId) && !registry.isAppDisabled(g.appId));
    return result;
  }

  getFavoriteEntries() {
    const result = this.getFavorites()
      .map((f) => this.games.concat(this.apps).find((g) => g.appId === f.appId))
      .filter(Boolean);
    return result;
  }

  getLuminGames() {
    return this.games.filter((g) => g.type === "lumin");
  }

  async getArchiveGames() {
    if (this.archiveGamesCache) return this.archiveGamesCache;
    try {
      const { CDN_CONFIG } = await import("../../shared/cdnConfig.js");
      const base = `${CDN_CONFIG.repos.games.archiveBase}/archive/`;
      const response = await fetch(`${base}games.json`);
      const data = await response.json();
      const allGames = Array.isArray(data) ? data : data?.games || [];

      this.archiveGamesCache = allGames.map((game) => {
        const name = game.name;
        const fullUrl = game.url.startsWith("http") ? game.url : base + game.url;
        const appId = this.archiveGameId(fullUrl);
        let thumb = game.thumbnail
          ? game.thumbnail.startsWith("http")
            ? game.thumbnail
            : base.replace(/\/$/, "") + "/" + game.thumbnail.replace(/^\//, "")
          : "";
        return { appId, title: name, url: fullUrl, thumb, type: "archive" };
      });
      return this.archiveGamesCache;
    } catch (e) {
      console.error("Failed to load archive games:", e);
      return [];
    }
  }

  archiveGameId(url) {
    return url
      .replace(/https?:\/\//, "")
      .replace(/[^a-z0-9]+/gi, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  toggleFavorite(appId) {
    steamDeckAudio.playToggleChange();
    if (this.isFavorite(appId)) {
      this.favorites = this.favorites.filter((f) => f.appId !== appId);
    } else {
      this.favorites.push({ appId, addedAt: Date.now() });
    }
    this.saveFavorites();
    this.bumpViewStamp();
    if (this.detailAppId) this.layout.renderDetail(this.detailAppId);
    this.layout.render();
    this.collectFocus();
    this.updateFocus();
  }

  launchApp(appId) {
    const info = os.app.getAppInfo(appId);
    if (!info) return;
    const isGame = info.type !== "system";
    if (this.splashTimeout) clearTimeout(this.splashTimeout);
    this.launchSplashTarget = appId;
    this.splashHandled = false;
    this.splashFrameBound = null;
    const gameStats = SteamDataManager.getStats()[appId] || { totalMin: 0, lastPlayed: 0 };
    const description = descriptionMap[appId] || info.description || "";
    const stats = isGame
      ? [
          { icon: "fa-clock", value: formatGameActivityTime(gameStats.totalMin) },
          { icon: "fa-calendar-check", value: formatLastPlayed(gameStats.lastPlayed) }
        ]
      : [];
    launchSplash.show({
      title: info.title || info.name || appId,
      icon: info.icon || "fas fa-gamepad",
      mode: isGame ? "game" : "app",
      description,
      stats
    });
    os.app.launch(appId, { deckMode: true }).catch(() => {});
    if (isGame) {
      steamDeckAudio.playLaunchGame();
      SteamDataManager.addRecentGame(appId, info.title);
      const hiddenIndex = this.recentHidden.indexOf(appId);
      if (hiddenIndex !== -1) {
        this.recentHidden.splice(hiddenIndex, 1);
        this.saveRecentHidden();
      }
    }
    if (this.detailAppId) this.closeDetail();
    if (isGame) {
      this.pollTick = setInterval(() => this.pollLaunchSplash(appId), 140);
      this.splashTimeout = setTimeout(() => this.revealLaunchSplash(appId), 3500);
    } else {
      this.splashTimeout = setTimeout(() => this.revealLaunchSplash(appId), 450);
    }
  }

  launchArchiveGame(archiveGame) {
    if (!launcher) {
      console.error("No launcher available to open archive game.");
      return;
    }
    const gameStats = SteamDataManager.getStats()[archiveGame.appId] || { totalMin: 0, lastPlayed: 0 };
    const stats = [
      { icon: "fa-clock", value: formatGameActivityTime(gameStats.totalMin) },
      { icon: "fa-calendar-check", value: formatLastPlayed(gameStats.lastPlayed) }
    ];
    launchSplash.show({
      title: archiveGame.title,
      icon: archiveGame.thumb || "fas fa-gamepad",
      mode: "game",
      description: "Experience this game from the archive collection.",
      stats
    });
    steamDeckAudio.playLaunchGame();
    SteamDataManager.addRecentGame(archiveGame.appId, archiveGame.title);
    const gameId = archiveGame.url
      .split("?")[0]
      .replace(/\/index\.html$/, "")
      .replace(/\.html$/, "")
      .split("/")
      .filter(Boolean)
      .pop()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
    launcher.openIframeApp({
      appId: gameId,
      type: "game",
      source: archiveGame.url,
      originalName: archiveGame.title,
      isArchive: true
    });
    if (this.detailAppId) this.closeDetail();
    setTimeout(() => launchSplash.reveal(), 2000);
  }

  pollLaunchSplash(appId) {
    if (this.splashHandled || this.launchSplashTarget !== appId) return;
    const win = $(`#${appId}-win`) || $(`#${appId}`);
    if (!win || win.dataset === undefined) return;
    const frame = win.querySelector("iframe");
    if (!frame) return;
    if (frame.dataset.loaded !== "1") {
      if (frame.contentDocument && frame.contentDocument.readyState === "complete") {
        frame.dataset.loaded = "1";
      } else if (!this.splashFrameBound) {
        this.splashFrameBound = frame;
        frame.addEventListener("load", () => {
          frame.dataset.loaded = "1";
          this.splashFrameBound = null;
          this.revealLaunchSplash(appId);
        });
      }
    }
    if (frame.dataset.loaded === "1") {
      this.revealLaunchSplash(appId);
    }
  }

  revealLaunchSplash(appId) {
    if (this.launchSplashTarget !== appId) return;
    this.launchSplashTarget = null;
    this.splashHandled = true;
    if (this.pollTick) clearInterval(this.pollTick);
    if (this.splashTimeout) clearTimeout(this.splashTimeout);
    this.pollTick = null;
    this.splashTimeout = null;
    launchSplash.reveal();
  }

  openDetail(appId) {
    steamDeckAudio.playIntoGameDetail();
    this.detailReturnFocusIndex = this.focusIndex;
    this.detailAppId = appId;
    this.detailTab = "activity";
    this.layout.renderDetail(appId);
    this.layout.animateDetailIn();
    this.collectFocus();
    this.updateFocus();
  }

  closeDetail() {
    if (!this.detailAppId) {
      this.layout.hideDetail();
      return;
    }
    this.detailAppId = null;
    this.focusIndex = this.detailReturnFocusIndex ?? 0;
    this.collectFocus();
    this.updateFocus();
    this.layout.animateDetailOut(() => this.layout.hideDetail());
  }

  getTabKey() {
    return this.activeCollectionId ? `collection:${this.activeCollectionId}` : this.libraryTab;
  }

  restoreLibraryFocus() {
    const key = this.getTabKey();
    const saved = this.storedFocus[key];
    if (saved != null && this.focusables.length > 0) {
      this.focusIndex = Math.max(0, Math.min(saved, this.focusables.length - 1));
      this.updateFocus();
    }
  }

  setLibraryTab(tab) {
    if (this.steamPanelOpen) this.closeSteamPanel();
    this.storedFocus[this.getTabKey()] = this.focusIndex;
    if (tab !== this.libraryTab) {
      steamDeckAudio.playSwitchNav();
      const direction = getNavSlideDirection("library", this.libraryTab, tab);
      this.layout.slideGridTransition(() => {
        this.libraryTab = tab;
        this.displayMode = null;
        this.layout.render();
        this.collectFocus();
        this.updateFocus();
        this.restoreLibraryFocus();
      }, direction);
    } else {
      this.libraryTab = tab;
      this.displayMode = null;
      this.layout.render();
      this.collectFocus();
      this.updateFocus();
      this.restoreLibraryFocus();
    }
  }

  setHomeTab(tab) {
    if (this.steamPanelOpen) this.closeSteamPanel();
    if (tab !== this.homeTab) {
      steamDeckAudio.playSwitchNav();
      const direction = getNavSlideDirection("home", this.homeTab, tab);
      this.layout.slidePanelTransition(
        this.layout.homePanelEl,
        () => {
          this.homeTab = tab;
          this.displayMode = null;
          this.layout.render();
          this.collectFocus();
          this.updateFocus();
          this.layout.revealHomePanel();
        },
        direction
      );
    } else {
      this.homeTab = tab;
      this.displayMode = null;
      this.layout.render();
      this.collectFocus();
      this.updateFocus();
      this.layout.revealHomePanel();
    }
  }

  animateViewTransition(callback) {
    if (this.deckTransitionTimer) clearTimeout(this.deckTransitionTimer);
    if (this.deckTransitionEl) this.deckTransitionEl.classList.remove("deck-panel-transition-out");
    const oldMain = this.layout?.mainEl;
    if (!oldMain) {
      callback();
      return;
    }
    this.deckTransitionEl = oldMain;
    oldMain.classList.add("deck-panel-transition-out");
    this.deckTransitionTimer = setTimeout(() => {
      this.deckTransitionTimer = null;
      this.deckTransitionEl = null;
      oldMain.classList.remove("deck-panel-transition-out");
      callback();
      requestAnimationFrame(() => {
        const newMain = this.layout?.mainEl;
        if (newMain) {
          newMain.classList.add("deck-panel-transition-in");
          setTimeout(() => {
            newMain.classList.remove("deck-panel-transition-in");
          }, 500);
        }
      });
    }, 260);
  }

  setSideNav(id) {
    if (this.detailAppId) this.closeDetail();
    if (id !== this.sideNav) steamDeckAudio.playRailChange();
    this.sideNav = id;
    if (id === "power") {
      this.toggleQuickAccess();
      if (this.layout) this.layout.setRailActive("power");
      return;
    }
    this.animateViewTransition(() => {
      if (id === "home") {
        this.enterMode(false);
      } else if (id === "library") {
        this.enterMode(true);
      } else if (id === "media") {
        this.showMedia();
      } else {
        this.openSteamPanel(id);
      }
      if (this.layout) this.layout.setRailActive(id);
    });
  }

  toggleRail() {
    this.railExpanded = !this.railExpanded;
    if (this.layout) this.layout.setRailExpanded(this.railExpanded);
    this.collectFocus();
    this.updateFocus();
    steamDeckAudio.playSlide();
  }

  closeRail(opts = {}) {
    if (!this.railExpanded) return;
    this.railExpanded = false;
    if (this.layout) this.layout.setRailExpanded(false);
    if (opts.hideSound) steamDeckAudio.playHideSidebarModal();
    this.collectFocus();
    this.updateFocus();
  }

  ensureQuickAccess() {
    if (!this.qta) this.qta = new QuickAccessPanel(this);
    return this.qta;
  }

  toggleQuickAccess(force) {
    this.ensureQuickAccess().toggle(force);
  }

  openSteamPanel(page) {
    this.steamPanelPage = page;
    this.steamPanelOpen = true;
    const panel = this.layout.ensureSteamPanel();
    if (!this.steamPanelRenderer) {
      this.steamPanelRenderer = new SteamAppRenderer();
      this.steamPanelRenderer.render(panel, (appId) => os.app.launch(appId).catch(() => {}));
    }
    this.layout.showSteamPanel();
    this.layout.setPanelPage(page);
    panel.dispatchEvent(new CustomEvent("steam-navigate", { detail: { page } }));
    this.collectFocus();
    this.updateFocus();
  }

  closeSteamPanel() {
    this.steamPanelOpen = false;
    this.layout.hideSteamPanel();
    this.layout.setPanelPage(null);
    this.collectFocus();
    this.updateFocus();
  }

  getRecents() {
    const wins = os.window.getOpenWindows();
    if (!wins || wins.size === 0) return [];
    const list = [];
    wins.forEach((entry, winId) => {
      if (!entry || entry.record?.minimized) return;
      const el = $("#" + winId);
      if (!el || el.style.display === "none") return;
      list.push({ winId, title: entry.title || winId, icon: entry.iconValue || "fas fa-window-restore" });
    });
    return list;
  }

  getLibraryList() {
    const all = this.getInstalledGames();
    if (!this.nameSort) return all;
    const copy = [...all];
    copy.sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
    const result = this.nameSort === 2 ? copy.reverse() : copy;
    return result;
  }

  getGreatGames() {
    if (this.greatGamesCache && this.greatGamesNameSort === this.nameSort) return this.greatGamesCache;
    const filtered = this.games.filter((g) => STORE_GAME_IDS.has(g.appId));
    let result = filtered;
    if (this.nameSort) {
      const copy = [...filtered];
      copy.sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
      result = this.nameSort === 2 ? copy.reverse() : copy;
    }
    this.greatGamesCache = result;
    this.greatGamesNameSort = this.nameSort;
    return result;
  }

  getRecommendedGames() {
    const MAX = 12;
    const recentIds = new Set(SteamDataManager.getRecentGames().map((r) => r.id));
    const pool = this.games.filter((g) => !recentIds.has(g.appId));
    const featured = this.getFeatured();
    const favIds = new Set(this.favorites.map((f) => f.appId));
    const chosen = [];
    const push = (g) => {
      if (g && !chosen.includes(g) && chosen.length < MAX) chosen.push(g);
    };
    featured.forEach((g) => push(g));
    favIds.forEach((id) => push(pool.find((g) => g.appId === id)));
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    shuffled.forEach((g) => push(g));
    return chosen;
  }

  loadCollections() {
    try {
      const stored = os.storage.get(StorageKeys.steamDeckCollections);
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  }

  saveCollections() {
    os.storage.set(StorageKeys.steamDeckCollections, this.collections);
  }

  getCollections() {
    return this.collections;
  }

  getCollection(collectionId) {
    return this.collections.find((c) => c.id === collectionId) || null;
  }

  getCollectionEntries(collectionId) {
    const col = this.getCollection(collectionId);
    if (!col) return [];
    const all = this.games.concat(this.apps);
    return col.gameIds.map((id) => all.find((g) => g.appId === id)).filter(Boolean);
  }

  isInCollection(collectionId, appId) {
    const col = this.getCollection(collectionId);
    return !!col && col.gameIds.includes(appId);
  }

  async createNewCollection(appId = null) {
    const name = await os.dialog.prompt("New Collection", "Name this collection", "");
    if (!name || !name.trim()) return;
    const clean = name.trim();
    if (this.collections.some((c) => c.name.toLowerCase() === clean.toLowerCase())) {
      os.notify.send("Collections", "A collection with that name already exists.", { type: "info", icon: "fa-folder" });
      return;
    }
    const col = { id: "col-" + Date.now(), name: clean, gameIds: appId ? [appId] : [] };
    this.collections.unshift(col);
    steamDeckAudio.playToggleChange();
    this.saveCollections();
    this.bumpViewStamp();
    this.layout.render();
    this.collectFocus();
    this.updateFocus();
    if (appId) os.notify.send("Collections", `Added to "${clean}".`, { type: "success", icon: "fa-folder" });
  }

  openCollection(collectionId) {
    this.activeCollectionId = collectionId;
    steamDeckAudio.playNavigation();
    if (this.detailAppId) this.closeDetail();
    this.layout.render();
    this.collectFocus();
    this.updateFocus();
  }

  closeCollection() {
    this.activeCollectionId = null;
    steamDeckAudio.playHideSidebarModal();
    this.layout.render();
    this.collectFocus();
    this.updateFocus();
  }

  async addCurrentToCollection(appId) {
    const col = this.getCollection(this.activeCollectionId);
    const target = col ? col : await this.pickCollectionForGame();
    if (!target) return;
    this.addToCollection(target.id, appId);
  }

  addToCollection(collectionId, appId) {
    const col = this.getCollection(collectionId);
    if (!col) return;
    if (col.gameIds.includes(appId)) {
      os.notify.send("Collections", `Already in "${col.name}".`, { type: "info", icon: "fa-folder" });
      return;
    }
    col.gameIds.push(appId);
    this.saveCollections();
    steamDeckAudio.playToggleChange();
    this.bumpViewStamp();
    if (this.detailAppId) this.layout.renderDetail(this.detailAppId);
    this.layout.render();
    this.collectFocus();
    this.updateFocus();
    os.notify.send("Collections", `Added to "${col.name}".`, { type: "success", icon: "fa-folder" });
  }

  removeFromCollection(collectionId, appId) {
    const col = this.getCollection(collectionId);
    if (!col || !col.gameIds.includes(appId)) return;
    col.gameIds = col.gameIds.filter((id) => id !== appId);
    this.saveCollections();
    steamDeckAudio.playToggleChange();
    this.bumpViewStamp();
    if (this.detailAppId) this.layout.renderDetail(this.detailAppId);
    this.layout.render();
    this.collectFocus();
    this.updateFocus();
    os.notify.send("Collections", `Removed from "${col.name}".`, { type: "info", icon: "fa-folder" });
  }

  removeFromRecentGames(appId) {
    SteamDataManager.removeRecentGame(appId);
    if (!this.recentHidden.includes(appId)) this.recentHidden.push(appId);
    this.saveRecentHidden();
    const applyRemoval = () => {
      this.bumpViewStamp();
      this.layout.render();
      this.collectFocus();
      this.updateFocus();
      os.notify.send("Recent Games", "Removed from recent games.", { type: "info", icon: "fa-clock-rotate-left" });
    };
    const tile = $('.deck-tile[data-app-id="' + appId + '"]', this.layout?.mainEl);
    if (tile) {
      tile.classList.add("deck-tile-removing");
      setTimeout(applyRemoval, 180);
    } else {
      applyRemoval();
    }
  }

  async pickCollectionForGame() {
    if (this.collections.length === 0) {
      await this.createNewCollection();
      return this.collections[0] || null;
    }
    const name = await os.dialog.prompt("Save to Collection", "Collection name", this.collections[0].name);
    if (!name || !name.trim()) return null;
    const clean = name.trim();
    let match = this.collections.find((c) => c.name.toLowerCase() === clean.toLowerCase());
    if (!match) {
      match = { id: "col-" + Date.now(), name: clean, gameIds: [] };
      this.collections.unshift(match);
      this.saveCollections();
      this.bumpViewStamp();
    }
    return match;
  }

  showGameContextMenu(e, appId) {
    const isFav = this.isFavorite(appId);
    const inContinuePlaying = this.getContinuePlaying().some((g) => g.appId === appId);
    const collections = this.getCollections();
    showDynamicContextMenu(e, (menu, item, hr, submenu) => {
      const launchItem = item("Launch", () => this.launchApp(appId), "fa-play");
      launchItem.classList.add("deck-ctx-play");
      menu.appendChild(launchItem);
      menu.appendChild(item("View Details", () => this.openDetail(appId), "fa-circle-info"));
      menu.appendChild(hr());
      menu.appendChild(
        item(
          isFav ? "Remove from Favorites" : "Add to Favorites",
          () => this.toggleFavorite(appId),
          isFav ? "fa-star" : "far fa-star"
        )
      );
      if (inContinuePlaying) {
        menu.appendChild(
          item("Remove from Recent Games", () => this.removeFromRecentGames(appId), "fa-clock-rotate-left")
        );
      }
      menu.appendChild(
        submenu(
          "Add to Collection",
          (subMenuEl, subItem, subHr) => {
            subMenuEl.appendChild(subItem("New Collection...", () => this.createNewCollection(appId), "fa-plus"));
            if (collections.length > 0) subMenuEl.appendChild(subHr());
            collections.forEach((col) => {
              const hasGame = col.gameIds.includes(appId);
              subMenuEl.appendChild(
                subItem(
                  hasGame ? `In "${col.name}"` : col.name,
                  () => {
                    if (hasGame) this.removeFromCollection(col.id, appId);
                    else this.addToCollection(col.id, appId);
                  },
                  hasGame ? "fa-check" : "fa-folder"
                )
              );
            });
          },
          "fa-folder-plus"
        )
      );
    });
  }

  cycleSortByName() {
    this.nameSort = (this.nameSort + 1) % 3;
    steamDeckAudio.playNavigation();
    const label = $("#deck-sort-label");
    if (label) label.textContent = ["Original", "Name A-Z", "Name Z-A"][this.nameSort];
    this.bumpViewStamp();
    this.layout.render();
    this.collectFocus();
    this.updateFocus();
  }

  focusWindow(winId) {
    const win = $("#" + winId);
    if (win) os.window.focus(win);
  }

  enterMode(isLibrary) {
    this.closeSteamPanel();
    this.libraryTab = "all";
    this.displayMode = null;
    if (this.isLibraryStart !== isLibrary) {
      this.isLibraryStart = isLibrary;
      this.switchModeRoot(isLibrary);
    } else {
      this.layout.render();
    }
    this.collectFocus();
    this.updateFocus();
  }

  showMedia() {
    this.closeSteamPanel();
    this.displayMode = null;
    this.enterMode(true);
    this.displayMode = "media";
    this.layout.render();
    this.layout.setPanelPage("media");
    this.collectFocus();
    this.updateFocus();
  }

  navigateMedia(path) {
    this.mediaPath = Array.isArray(path) ? [...path] : [];
    if (this.displayMode !== "media") this.displayMode = "media";
    this.layout.render();
    this.collectFocus();
    this.updateFocus();
  }

  getModeRoot(isLibrary) {
    const key = isLibrary ? "library" : "home";
    if (this.modeRoots[key]) return this.modeRoots[key];
    const root = this.layout.buildRoot(isLibrary);
    root.style.display = "none";
    this.modeRoots[key] = root;
    if (!root.parentNode) document.body.appendChild(root);
    this.layout.syncRefs(root);
    return root;
  }

  switchModeRoot(isLibrary) {
    this.closeDetail();
    this.teardownTray();
    const previous = this.modeRoots[isLibrary ? "home" : "library"];
    const target = this.getModeRoot(isLibrary);
    if (previous && previous !== target) previous.style.display = "none";
    target.style.display = "";
    this.root = target;
    this.layout.syncRefs(target);
    this.steamPanelRenderer = null;
    if (this.qta) this.qta.close();
    this.layout.render();
    this.layout.setRailActive(isLibrary ? "library" : "home");
    this.setupTray();
  }

  toggleShellMode() {
    if (!this.layout) return;
    this.animateViewTransition(() => this.enterMode(!this.isLibraryStart));
  }

  bumpViewStamp() {
    this.viewStamp++;
  }

  setPowerMode(mode) {
    performanceManager.setMode(mode);
    this.updateBattery();
  }

  setupTray() {
    if (this.layout && this.layout.topbarTrayEl) {
      trayManager.addSecondaryContainer(this.layout.topbarTrayEl);
    }
    trayManager.render();
  }

  teardownTray() {
    if (this.layout && this.layout.topbarTrayEl) {
      trayManager.removeSecondaryContainer(this.layout.topbarTrayEl);
    }
    trayManager.render();
  }

  bindBus() {
    this.unsubscribers.push(os.events.on(BusEvents.WINDOW_CREATED, () => this.layout?.renderRecents()));
    this.unsubscribers.push(os.events.on(BusEvents.WINDOW_CLOSED, () => this.layout?.renderRecents()));
    this.unsubscribers.push(
      os.events.on(BusEvents.SCREENSHOT_CAPTURED, () => {
        if (this.displayMode === "media" && this.layout) this.layout.renderMediaView();
      })
    );
    this.unsubscribers.push(
      os.events.on(BusEvents.MODE_EXITED, ({ id }) => {
        if (id === "steamdeck") this.teardown();
      })
    );
  }

  bindInput() {
    this.keyHandler = (e) => this.handleKeydown(e);
    document.addEventListener("keydown", this.keyHandler);
    document.addEventListener("keyup", this.holdKeyUpHandler);
  }

  handleKeydown(e) {
    if (!this.active) return;
    if (isDeckBootVideoVisible()) return;
    if (KeybindManager.matches(e, "steamdeck.openQuickAccess")) {
      e.preventDefault();
      this.toggleQuickAccess();
      return;
    }
    if (KeybindManager.matches(e, "steamdeck.home")) {
      e.preventDefault();
      this.closeDetail();
      this.setLibraryTab("all");
      return;
    }
    if (this.quickAccessOpen) return;
    if (this.layout && this.layout.powerEl && this.layout.powerEl.classList.contains("open")) {
      e.preventDefault();
      this.handlePowerMenuKey(e);
      return;
    }
    if (this.hasActiveWindow()) return;
    const target = e.target instanceof Element ? e.target : null;
    if (target && target.closest("input, textarea, .window, .deck-search")) return;
    if (KeybindManager.matches(e, "steamdeck.moveUp")) {
      e.preventDefault();
      this.moveFocus(0, -1);
    } else if (KeybindManager.matches(e, "steamdeck.moveDown")) {
      e.preventDefault();
      this.moveFocus(0, 1);
    } else if (KeybindManager.matches(e, "steamdeck.moveLeft")) {
      e.preventDefault();
      this.moveFocus(-1, 0);
    } else if (KeybindManager.matches(e, "steamdeck.moveRight")) {
      e.preventDefault();
      this.moveFocus(1, 0);
    } else if (KeybindManager.matches(e, "steamdeck.confirm")) {
      e.preventDefault();
      this.confirmFocus();
    } else if (KeybindManager.matches(e, "steamdeck.back")) {
      e.preventDefault();
      this.goBack();
    }
  }

  handlePowerMenuKey(e) {
    if (e.repeat) return;
    const buttons = $$(".deck-power-btn", this.layout.root);
    const selected = buttons.find((b) => b.classList.contains("deck-power-selected"));
    const selectedIndex = selected ? buttons.indexOf(selected) : -1;
    if (KeybindManager.matches(e, "steamdeck.confirm")) {
      e.preventDefault();
      if (selected) {
        steamDeckAudio.playSwitchNav();
        if (this.isHoldableAction(selected.dataset.action)) {
          this.startHoldConfirm(selected.dataset.action, selected);
        } else {
          this.runAction(selected.dataset.action);
        }
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      this.cancelHoldConfirm();
      this.runAction("cancel");
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      this.cancelHoldConfirm();
      const direction = e.key === "ArrowDown" ? 1 : -1;
      const nextIndex = selectedIndex === -1 ? 0 : (selectedIndex + direction + buttons.length) % buttons.length;
      buttons.forEach((b) => b.classList.remove("deck-power-selected"));
      buttons[nextIndex].classList.add("deck-power-selected");
      steamDeckAudio.playRailChange();
    }
  }

  hasActiveWindow() {
    const wins = os.window.getOpenWindows();
    if (!wins || wins.size === 0) return false;
    let active = false;
    wins.forEach((entry, winId) => {
      if (active) return;
      const el = $("#" + winId);
      if (el && el.style.display !== "none" && !entry?.record?.minimized) active = true;
    });
    return active;
  }

  goBack() {
    this.vibrate(0.5, 20);
    if (this.detailAppId) {
      this.closeDetail();
      steamDeckAudio.playHideSidebarModal();
      return;
    }
    if (this.activeCollectionId) {
      this.closeCollection();
      steamDeckAudio.playHideSidebarModal();
      return;
    }
    if (this.libraryTab !== "all") {
      this.setLibraryTab("all");
      steamDeckAudio.playHideSidebarModal();
      return;
    }
  }

  focusSearch() {
    if (this.detailAppId) this.closeDetail();
    if (this.activeCollectionId) this.closeCollection();
    this.setLibraryTab("all");
    requestAnimationFrame(() => {
      const input = $(".deck-search input", this.layout ? this.layout.view : null);
      if (input) input.focus();
    });
  }

  toggleSearchOverlay() {
    if (this.searchOverlayVisible) {
      this.hideSearchOverlay();
    } else {
      this.showSearchOverlay();
    }
  }

  showSearchOverlay() {
    if (this.searchOverlayVisible) return;
    this.searchOverlayVisible = true;
    steamDeckAudio.playSlide();
    this.layout.root.classList.add("deck-search-visible");
    const overlay = createElement("div", { className: "deck-search-overlay" });
    overlay.innerHTML = `
      <div class="deck-search-container">
        <div class="deck-search-input-wrapper">
          <i class="fas fa-magnifying-glass"></i>
          <input type="text" placeholder="Search games, apps..." class="deck-search-input">
          <button class="deck-search-close"><i class="fas fa-times"></i></button>
        </div>
        <div class="deck-search-results"></div>
      </div>
    `;
    this.layout.root.appendChild(overlay);
    this.searchOverlayEl = overlay;
    const input = $(".deck-search-input", overlay);
    const closeBtn = $(".deck-search-close", overlay);
    const resultsEl = $(".deck-search-results", overlay);

    input.focus();
    input.addEventListener("input", () => this.handleSearchInput(input.value, resultsEl));
    closeBtn.addEventListener("click", () => this.hideSearchOverlay());
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) this.hideSearchOverlay();
    });

    document.addEventListener("keydown", this.searchKeyHandler);
  }

  hideSearchOverlay() {
    if (!this.searchOverlayVisible) return;
    this.searchOverlayVisible = false;
    steamDeckAudio.playHideSidebarModal();
    this.layout.root.classList.remove("deck-search-visible");
    if (this.searchOverlayEl) {
      this.searchOverlayEl.classList.add("closing");
      setTimeout(() => {
        if (this.searchOverlayEl) {
          this.searchOverlayEl.remove();
          this.searchOverlayEl = null;
        }
      }, 150);
    }
    document.removeEventListener("keydown", this.searchKeyHandler);
  }

  searchKeyHandler = (e) => {
    if (e.key === "Escape") {
      this.hideSearchOverlay();
    }
  };

  handleSearchInput(query, resultsEl) {
    const q = query.trim().toLowerCase();
    if (!q) {
      setHTML(resultsEl, "");
      return;
    }

    const games = this.games.filter((g) => g.title.toLowerCase().includes(q));
    const gameResults = games
      .slice(0, 8)
      .map(
        (game) => `
      <div class="deck-search-result-item" data-app-id="${game.appId}">
        <div class="deck-search-result-icon">
          ${game.icon ? (game.icon.startsWith("http") ? `<img src="${game.icon}">` : `<i class="${game.icon}"></i>`) : `<i class="fas fa-gamepad"></i>`}
        </div>
        <div class="deck-search-result-info">
          <div class="deck-search-result-title">${escapeHtml(game.title)}</div>
          <div class="deck-search-result-subtitle">Game</div>
        </div>
      </div>
    `
      )
      .join("");

    setHTML(resultsEl, gameResults || `<div class="deck-search-no-results">No results found</div>`);

    $$(".deck-search-result-item", resultsEl).forEach((item) => {
      item.addEventListener("click", () => {
        this.launchApp(item.dataset.appId);
        this.hideSearchOverlay();
      });
    });
  }

  collectFocus() {
    const lastKey = this.getFocusKey();
    if (this.layout) {
      this.focusables = this.layout.collectFocusables();
    } else {
      this.focusables = [];
    }
    if (lastKey != null) {
      this.focusIndex = this.restoreFocusIndex(lastKey);
    } else {
      this.focusIndex = this.getDefaultFocusIndex();
    }
  }

  getDefaultFocusIndex() {
    for (let i = 0; i < this.focusables.length; i++) {
      const entry = this.focusables[i];
      if (!entry || !entry.el) continue;
      if (entry.el.closest(".deck-topbar")) continue;
      if (entry.el.dataset.appId) return i;
    }
    for (let i = 0; i < this.focusables.length; i++) {
      const entry = this.focusables[i];
      if (!entry || !entry.el) continue;
      if (entry.el.closest(".deck-topbar")) continue;
      return i;
    }
    return 0;
  }

  getFocusKey() {
    const entry = this.focusables[this.focusIndex];
    if (!entry || !entry.el) return null;
    return entry.el.dataset.appId || entry.el.dataset.action || entry.el;
  }

  restoreFocusIndex(lastKey) {
    if (lastKey != null) {
      const idx = this.focusables.findIndex(
        (f) => f.el === lastKey || f.el.dataset.appId === lastKey || f.el.dataset.action === lastKey
      );
      if (idx >= 0) return idx;
    }
    if (this.focusIndex >= this.focusables.length) return Math.max(0, this.focusables.length - 1);
    if (this.focusIndex < 0) return 0;
    return this.focusIndex;
  }

  updateFocus(scroll = true) {
    if (this.layout) this.layout.applyFocus(this.focusIndex, scroll);
  }

  focusElement(el) {
    const idx = this.focusables.findIndex((f) => f.el === el);
    if (idx < 0) return;
    this.focusIndex = idx;
    this.updateFocus();
  }

  moveFocus(dx, dy) {
    if (this.focusables.length === 0) return;
    const next = moveSpatialFocus(this.focusables, this.focusIndex, dx, dy);
    if (next !== this.focusIndex) {
      this.focusIndex = next;
      this.updateFocus();
      steamDeckAudio.playNavigation();
      this.vibrate(0.35, 10);
    }
  }

  confirmFocus() {
    const entry = this.focusables[this.focusIndex];
    if (!entry || !entry.el) return;
    if (entry.el.dataset.appId) {
      this.launchApp(entry.el.dataset.appId);
      return;
    }
    if (entry.el.dataset.action) {
      this.runAction(entry.el.dataset.action);
      return;
    }
    steamDeckAudio.playNavigation();
    entry.el.click();
  }

  runAction(action) {
    if (!action) return;
    if (action === "quick") this.toggleQuickAccess();
    else if (action === "search") this.toggleSearchOverlay();
    else if (action === "news" || action === "friends" || action === "recommended") this.setHomeTab(action);
    else if (action === "all") this.setLibraryTab("all");
    else if (action === "great") this.setLibraryTab("great");
    else if (action === "archive") this.setLibraryTab("archive");
    else if (action === "lumin") this.setLibraryTab("lumin");
    else if (action === "favorites") this.setLibraryTab("favorites");
    else if (action === "collections") this.setLibraryTab("collections");
    else if (action === "newCollection") this.createNewCollection();
    else if (action === "closeCollection") this.closeCollection();
    else if (action === "saveToCollection" && this.detailAppId) this.addCurrentToCollection(this.detailAppId);
    else if (action === "back") this.goBack();
    else if (action === "deckHome") {
      this.closeDetail();
      this.setLibraryTab("all");
    } else if (action === "menu") this.toggleRail();
    else if (action === "play" && this.detailAppId) this.launchApp(this.detailAppId);
    else if (action.startsWith("tab-") && this.detailAppId) this.layout.switchDetailTab(action.slice(4));
    else if (action === "favorite" && this.detailAppId) this.toggleFavorite(this.detailAppId);
    else if (action === "showPower") this.showPowerMenu();
    else if (action === "cancel") this.hidePowerMenu();
    else if (action === "sleep") this.handleSleep();
    else if (action === "shutdown") this.handleShutdown();
    else if (action === "restart") this.handleRestart();
    else if (action === "changeAccount") this.handleChangeAccount();
    else if (action === "signOut") this.handleSignOut();
    else if (action === "switchToDesktop") this.handleSwitchToDesktop();
  }

  openAccountMenu() {
    os.app.launch("settingsApp", { section: "pane-accounts" }).catch(() => {});
  }

  openCalendar() {
    setCurrentCalendarMonth();
    createCalendarPopup();
  }

  showPowerMenu() {
    this.layout.powerEl.classList.add("open");
    steamDeckAudio.playSlide();
    if (document.activeElement && typeof document.activeElement.blur === "function") document.activeElement.blur();
    $$(".deck-power-btn", this.layout.root).forEach((b) => b.classList.remove("deck-power-selected"));
  }

  hidePowerMenu() {
    this.layout.powerEl.classList.remove("open");
    $$(".deck-power-btn", this.layout.root).forEach((b) => b.classList.remove("deck-power-selected"));
  }

  async handleSleep() {
    this.hidePowerMenu();
    this.enterSleepMode();
  }

  enterSleepMode() {
    if (!this.layout.root || this.layout.root.classList.contains("deck-sleep")) return;

    const sleepOverlay = createElement("div");
    sleepOverlay.className = "deck-sleep-overlay";
    sleepOverlay.id = "deck-sleep-overlay";
    this.layout.root.appendChild(sleepOverlay);

    const wakeLayer = createElement("div");
    wakeLayer.className = "deck-sleep-wake-layer";
    wakeLayer.id = "deck-sleep-wake-layer";
    this.layout.root.appendChild(wakeLayer);

    const wakeHandler = () => {
      this.exitSleepMode();
      wakeLayer.removeEventListener("mousemove", wakeHandler);
      wakeLayer.removeEventListener("mousedown", wakeHandler);
      wakeLayer.removeEventListener("keydown", wakeHandler);
    };

    wakeLayer.addEventListener("mousemove", wakeHandler);
    wakeLayer.addEventListener("mousedown", wakeHandler);
    wakeLayer.addEventListener("keydown", wakeHandler);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.layout.root.classList.add("deck-sleep");
      });
    });
  }

  exitSleepMode() {
    if (!this.layout.root) return;

    this.layout.root.classList.remove("deck-sleep");

    const sleepOverlay = this.layout.root.querySelector("#deck-sleep-overlay");
    if (sleepOverlay) {
      sleepOverlay.remove();
    }

    const wakeLayer = this.layout.root.querySelector("#deck-sleep-wake-layer");
    if (wakeLayer) {
      wakeLayer.remove();
    }
  }

  async handleShutdown(skipConfirm = false) {
    this.hidePowerMenu();
    if (skipConfirm) {
      window.location.reload();
      return;
    }
    const { showDeckConfirm } = await import("./deckDialog.js");
    showDeckConfirm(this.layout.root, "Shutdown", "Are you sure you want to shutdown?", () => {
      window.location.reload();
    });
  }

  async handleRestart(skipConfirm = false) {
    this.hidePowerMenu();
    if (skipConfirm) {
      window.location.reload();
      return;
    }
    const { showDeckConfirm } = await import("./deckDialog.js");
    showDeckConfirm(this.layout.root, "Restart", "Are you sure you want to restart?", () => {
      window.location.reload();
    });
  }

  isHoldableAction(action) {
    return action === "shutdown" || action === "restart";
  }

  startHoldConfirm(action, el) {
    this.cancelHoldConfirm();
    this.holdAction = action;
    this.holdEl = el;
    this.holdProgress = 0;
    el.classList.add("holding");
    el.style.setProperty("--hold-progress", "0%");
    this.holdTimer = setInterval(() => {
      this.holdProgress += 100 / HOLD_TICKS;
      if (this.holdEl) this.holdEl.style.setProperty("--hold-progress", `${this.holdProgress}%`);
      if (this.holdProgress >= 100) {
        if (this.holdTimer) clearInterval(this.holdTimer);
        this.holdTimer = null;
        this.completeHold();
      }
    }, HOLD_TICK_MS);
  }

  cancelHoldConfirm() {
    if (this.holdTimer) clearInterval(this.holdTimer);
    this.holdTimer = null;
    if (this.holdEl) {
      this.holdEl.classList.remove("holding");
      this.holdEl.style.removeProperty("--hold-progress");
    }
    this.holdAction = null;
    this.holdEl = null;
    this.holdProgress = 0;
  }

  completeHold() {
    const action = this.holdAction;
    this.cancelHoldConfirm();
    if (action === "shutdown") this.handleShutdown(true);
    else if (action === "restart") this.handleRestart(true);
    else this.runAction(action);
  }

  handleGamepadPowerMenu(pressed, prevPressed) {
    const powerEl = this.layout && this.layout.powerEl;
    if (!powerEl) return false;
    const buttons = $$(".deck-power-btn", this.layout.root);
    if (buttons.length === 0) return true;
    const selected = buttons.find((b) => b.classList.contains("deck-power-selected"));
    const selectedIndex = selected ? buttons.indexOf(selected) : -1;
    const getSelected = () => buttons.find((b) => b.classList.contains("deck-power-selected"));
    for (let i = 0; i < pressed.length; i++) {
      const rise = pressed[i] && !prevPressed[i];
      const fall = !pressed[i] && prevPressed[i];
      if (i === 12 || i === 13 || i === 14 || i === 15) {
        if (rise) {
          this.cancelHoldConfirm();
          const direction = i === 12 ? -1 : i === 13 ? 1 : 0;
          if (direction !== 0) {
            const nextIndex = selectedIndex === -1 ? 0 : (selectedIndex + direction + buttons.length) % buttons.length;
            buttons.forEach((b) => b.classList.remove("deck-power-selected"));
            buttons[nextIndex].classList.add("deck-power-selected");
            steamDeckAudio.playRailChange();
          }
        }
        continue;
      }
      if (i === 0) {
        if (rise) {
          const target = getSelected();
          if (target) {
            steamDeckAudio.playSwitchNav();
            if (this.isHoldableAction(target.dataset.action)) {
              this.startHoldConfirm(target.dataset.action, target);
            } else {
              this.runAction(target.dataset.action);
            }
          }
        } else if (fall && this.holdAction && this.holdProgress < 100) {
          this.cancelHoldConfirm();
        }
        continue;
      }
      if (i === 1 && rise) {
        this.cancelHoldConfirm();
        this.runAction("cancel");
        continue;
      }
    }
    return true;
  }

  async handleChangeAccount() {
    this.hidePowerMenu();
    const { getOtherUsers, showAccountSwitchDialog, switchToUser } = await import("../../shared/accountSwitcher.js");
    const { showDeckDialog } = await import("./deckDialog.js");

    const otherUsers = getOtherUsers();
    if (otherUsers.length === 0) {
      showDeckDialog({
        container: this.layout.root,
        title: "No Accounts",
        message: "No other accounts available to switch to.",
        type: "default",
        confirmText: "OK",
        cancelText: null,
        onConfirm: () => {}
      });
      return;
    }

    showAccountSwitchDialog(this.layout.root, async (userId) => {
      const switched = await switchToUser(userId);
      if (switched) {
        window.location.reload();
      }
    });
  }

  async handleSignOut() {
    this.hidePowerMenu();
    const { showDeckConfirm } = await import("./deckDialog.js");
    showDeckConfirm(this.layout.root, "Sign Out", "Are you sure you want to sign out?", () => {
      os.account.signOut?.();
      os.app.lockToLoginScreen();
    });
  }

  async handleSwitchToDesktop() {
    this.hidePowerMenu();
    this.layout.root.classList.add("deck-exit-animation");
    await new Promise((resolve) => setTimeout(resolve, 500));
    const { disableSteamDeckSettings } = await import("./session.js");
    disableSteamDeckSettings();
    os.storage.set(StorageKeys.selectedSession, "Yuki Desktop(Default)");
  }

  startPollers() {
    this.stopPollers();
    this.updateClock();
    this.updateVolume();
    this.updateNetwork();
    this.initBattery();
    this.timers.clock = setInterval(() => this.updateClock(), 10000);
    this.timers.volume = setInterval(() => this.updateVolume(), 2000);
    this.timers.network = setInterval(() => this.updateNetwork(), 5000);
  }

  stopPollers() {
    Object.keys(this.timers).forEach((key) => {
      if (this.timers[key]) clearInterval(this.timers[key]);
    });
    this.timers = {};
  }

  updateClock() {
    const now = new Date();
    const topTime = $("#steamdeck-topbar-time");
    if (topTime) {
      topTime.innerHTML = `<span>${now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>`;
    }
  }

  async initBattery() {
    if (!("getBattery" in navigator)) return;
    try {
      const battery = await navigator.getBattery();
      this.batteryData = { level: Math.round(battery.level * 100), charging: battery.charging };
      this.updateBattery();
      battery.addEventListener("levelchange", () => {
        this.batteryData.level = Math.round(battery.level * 100);
        this.updateBattery();
      });
      battery.addEventListener("chargingchange", () => {
        this.batteryData.charging = battery.charging;
        this.updateBattery();
      });
    } catch {}
  }

  updateBattery() {
    if (this.qta) this.qta.updateBattery();
  }

  updateVolume() {
    if (this.qta) this.qta.updateVolume();
  }

  updateNetwork() {
    if (this.qta) this.qta.updateNetwork();
  }

  startGamepad() {
    this.stopGamepad();
    const poll = () => {
      if (!this.active) return;
      const pad = this.getConnectedGamepad();
      if (!pad) {
        this.stopGamepad();
        return;
      }
      if (isDeckBootVideoVisible()) {
        this.gamepadRaf = requestAnimationFrame(poll);
        return;
      }
      const pressed = Array.from({ length: 16 }, (_, i) => !!(pad.buttons[i] && pad.buttons[i].pressed));
      const prevPressed = this.gamepadPrev;
      const changed = pressed.some((value, i) => value !== prevPressed[i]);
      this.gamepadPrev = pressed;
      if (changed) {
        const powerEl = this.layout && this.layout.powerEl;
        if (powerEl && powerEl.classList.contains("open")) {
          this.handleGamepadPowerMenu(pressed, prevPressed);
        } else {
          for (let i = 0; i < 16; i++) {
            if (pressed[i] && !prevPressed[i]) {
              if (i === 12) this.moveFocus(0, -1);
              else if (i === 13) this.moveFocus(0, 1);
              else if (i === 14) this.moveFocus(-1, 0);
              else if (i === 15) this.moveFocus(1, 0);
              else if (i === 0) {
                this.confirmFocus();
                this.vibrate();
              } else if (i === 1) this.goBack();
              else if (i === 4 || i === 5) this.toggleQuickAccess();
            }
          }
        }
      }
      this.gamepadRaf = requestAnimationFrame(poll);
    };
    poll();
  }

  stopGamepad() {
    if (this.gamepadRaf) {
      cancelAnimationFrame(this.gamepadRaf);
      this.gamepadRaf = null;
    }
    this.gamepadPrev = new Array(16).fill(false);
  }

  getConnectedGamepad() {
    try {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      return pads.find((p) => p && p.connected) || null;
    } catch {
      return null;
    }
  }

  isHapticsEnabled() {
    return os.storage.get(StorageKeys.steamDeckHaptics) === "true";
  }

  vibrate(intensity = 0.8, duration = 30) {
    if (!this.isHapticsEnabled()) return;
    const pad = this.getConnectedGamepad();
    if (pad && pad.hapticActuators && pad.hapticActuators.length) {
      try {
        pad.hapticActuators[0].pulse(intensity, duration).catch(() => {});
        return;
      } catch {}
    }
    try {
      if (navigator.vibrate) navigator.vibrate(duration);
    } catch {}
  }

  updateGamepadGlyphMode() {
    try {
      const root = document.getElementById("steamdeck-root");
      if (!root) return;
      if (this.getConnectedGamepad()) {
        root.setAttribute("data-gamepad", "");
      } else {
        root.removeAttribute("data-gamepad");
      }
    } catch {}
  }

  requestFullscreen() {
    if (location.host.includes("localhost")) return;
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) return;
      const el = document.documentElement;
      if (el.requestFullscreen) el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } catch {}
  }

  exitFullscreen() {
    try {
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
    } catch {}
  }
}

export const steamDeckManager = new SteamDeckManager();
