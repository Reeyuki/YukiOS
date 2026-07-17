import { appMap } from "./gamesList.js";
import { descriptionMap } from "./gameDescriptions.js";
import { GameRenderer } from "./GameRenderer.js";
import { GameLauncher } from "./GameLauncher.js";
import { GameUI } from "./GameUI.js";
import { LargeModeAudio } from "./steamAudio.js";
import { resolveGhUrl, resolveIconUrl } from "../shared/assetResolver.js";
import { CDN_CONFIG } from "../shared/cdnConfig.js";
import { getAppRegistry } from "../appRegistry.js";
import { getCurrentUser } from "../desktopui/startMenu.js";
import { $, $$ } from "../shared/domUtils.js";

import { StorageKeys, os } from "../framework.js";
export function getCdnBase() {
  return CDN_CONFIG.repos.main.base;
}

export function getCdnBaseGames() {
  return CDN_CONFIG.repos.games.base;
}

export let launcher = null;
export let desktopUI = null;

export const steamAudio = new LargeModeAudio();

export function setGameLauncher(appLauncher) {
  launcher = appLauncher;
}

export function setDesktopUI(ui) {
  desktopUI = ui;
}

export function refreshSteamUI() {
  const user = getCurrentUser();
  const username = user.name;
  const profilePic = user.avatar;

  const steamUserProfiles = $$(".steam-user-profile span");
  steamUserProfiles.forEach((span) => {
    if (span && span.textContent !== username) {
      span.textContent = username;
    }
  });

  const userTab = $('.steam-tab[data-page="user"]');
  if (userTab && userTab.textContent !== username) {
    userTab.textContent = username;
  }

  const steamProfileImgs = $$(".steam-user-profile img");
  steamProfileImgs.forEach((img) => {
    if (img instanceof HTMLImageElement && img.src !== profilePic) {
      img.src = profilePic;
    }
  });

  const friendsName = $(".friends-name");
  if (friendsName && friendsName.textContent !== username) {
    friendsName.textContent = username;
  }

  const friendsProfileImg = $(".friends-profile img");
  if (friendsProfileImg instanceof HTMLImageElement && friendsProfileImg.src !== profilePic) {
    friendsProfileImg.src = profilePic;
  }
}

const imgObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const img = entry.target;
      if (img.dataset.src) {
        img.src = img.dataset.src;
        delete img.dataset.src;
      }
      imgObserver.unobserve(img);
    });
  },
  { rootMargin: "200px" }
);

export function lazyImg(src, attrs = "") {
  return `<img data-src="${src}" ${attrs}/>`;
}

export function observeLazyImages(root) {
  root.querySelectorAll("img[data-src]").forEach((img) => imgObserver.observe(img));
}

function patchAppMap(appMap) {
  for (const key in appMap) {
    const app = appMap[key];

    if (app.icon && app.icon.startsWith("/static/")) {
      if (key.startsWith("subwaySurfers")) {
        app.icon = resolveGhUrl(
          `https://cdn.jsdelivr.net/gh/Reeyuki/yukios-games@main/subwaySurfers/${app.icon.split("/").pop()}`
        );
      } else {
        app.icon = `${getCdnBase()}${app.icon}`;
      }
    }
    if (app.swf && app.swf.startsWith("/static/games/")) {
      app.swf = getCdnBaseGames() + app.swf.replace("/static/games/", "/");
    }
    if (app.url && app.url.startsWith("/static/games/")) {
      app.url = getCdnBaseGames() + app.url.replace("/static/games/", "/");
    }
  }

  return appMap;
}
patchAppMap(appMap);

export const popularityMap = new Map(Object.keys(appMap).map((id, index) => [id, index]));

export function getGameName(appId) {
  return appMap[appId]?.title || null;
}

const GAMES_APP_EXCLUDED = new Set(["TMNP", "vscode", "paint", "photopea", "liventcord"]);

export const HIGHLIGHTED_GAMES = new Set([
  "tabs",
  "lobotomyCorporation",
  "slimeRancher",
  "plagueIncEvolved",
  "helltaker",
  "passpartout",
  "inStarsAndTime",
  "inscryption",
  "nightInTheWoods",
  "daddy",
  "yt",
  "ytlifeomg",
  "suicideGuy",
  "antidisestablishmentarianism",
  "theMathIsLeaking",
  "minusThree",
  "three",
  "fiveNightsAtFrickbears3",
  "baldisBasicsTeachingOnTwos",
  "playtimeHellBear5van",
  "baldiBalds",
  "pneumo",
  "wheresBaldi"
]);

const FLASH_EMUPEDIA_EXCLUDED = new Set([
  "doom",
  "doom2",
  "vscode",
  "geometryDash",
  "game2048",
  "mario",
  "fruitNinja",
  "cutTheRope",
  "jetpack"
]);
const FLASH_EMUPEDIA_PATTERN = "emupedia.net";
const FLASH_URL_PATTERNS = [
  "papasgamesfree.io",
  "flashpointarchive.html",
  "/static/rfiv.html",
  "cache.armorgames.com",
  "silvergames.com"
];

const FLASH_LOCAL_IDS = new Set(["badIceCream", "henry", "badIceCream2", "badIceCream3", "trinitas"]);

function isFlashGame(id, data) {
  if (data.type === "swf") return true;
  if (data.swf) return true;
  if (FLASH_LOCAL_IDS.has(id)) return true;
  if (data.type !== "game") return false;
  const url = data.url || "";
  if (FLASH_URL_PATTERNS.some((p) => url.includes(p))) return true;
  if (url.includes(FLASH_EMUPEDIA_PATTERN) && !FLASH_EMUPEDIA_EXCLUDED.has(id)) return true;
  return false;
}

export const SteamDataManager = {
  getStats: () => os.storage.get(StorageKeys.steamStats) || {},

  getRecentMinutes: (appId) => {
    const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    try {
      const sessions = os.storage.get(StorageKeys.steamSessions) || {};
      const appSessions = sessions[appId] || [];
      return appSessions.filter((s) => now - s.ts < ONE_WEEK_MS).reduce((sum, s) => sum + s.min, 0);
    } catch {
      return 0;
    }
  },
  getFavorites: () => os.storage.get(StorageKeys.steamFavorites) || [],
  setFavorites: (favs) => os.storage.set(StorageKeys.steamFavorites, favs),
  getCollections: () => os.storage.get(StorageKeys.steamCollections) || {},
  setCollections: (cols) => os.storage.set(StorageKeys.steamCollections, cols),
  getHidden: () => os.storage.get(StorageKeys.steamHidden) || [],
  setHidden: (hidden) => os.storage.set(StorageKeys.steamHidden, hidden),
  getCollapsed: () => {
    const stored = os.storage.get(StorageKeys.steamCollapsed);
    if (stored === null) {
      const defaultExpanded = ["Webports/Html games"];
      os.storage.set(StorageKeys.steamCollapsed, defaultExpanded);
      return defaultExpanded;
    }
    return stored || [];
  },
  setCollapsed: (collapsed) => os.storage.set(StorageKeys.steamCollapsed, collapsed),

  setupDefaultCollections: () => {
    const cols = SteamDataManager.getCollections();
    if (cols["Webports/Html games"] && cols["Flash Games"]) return;
    const allEntries = Object.entries(appMap).filter(
      ([id, data]) => data.type !== "system" && !GAMES_APP_EXCLUDED.has(id) && data.icon && data.title
    );

    const flashIds = allEntries.filter(([id, data]) => isFlashGame(id, data)).map(([id]) => id);
    const webIds = allEntries.filter(([id, data]) => !isFlashGame(id, data)).map(([id]) => id);

    cols["Webports/Html games"] = webIds;
    cols["Flash Games"] = flashIds;
    SteamDataManager.setCollections(cols);
  },

  toggleFavorite: (appId) => {
    const favs = SteamDataManager.getFavorites();
    const index = favs.indexOf(appId);
    if (index === -1) favs.push(appId);
    else favs.splice(index, 1);
    SteamDataManager.setFavorites(favs);
    return index === -1;
  },
  toggleHide: (appId) => {
    const hidden = SteamDataManager.getHidden();
    const index = hidden.indexOf(appId);
    if (index === -1) hidden.push(appId);
    else hidden.splice(index, 1);
    SteamDataManager.setHidden(hidden);
    return index === -1;
  },
  toggleCollapsed: (name) => {
    const collapsed = SteamDataManager.getCollapsed();
    const index = collapsed.indexOf(name);
    if (index === -1) collapsed.push(name);
    else collapsed.splice(index, 1);
    SteamDataManager.setCollapsed(collapsed);
    return index === -1;
  },
  addToCollection: (name, appId) => {
    const cols = SteamDataManager.getCollections();
    if (!cols[name]) cols[name] = [];
    if (!cols[name].includes(appId)) {
      cols[name].push(appId);
      SteamDataManager.setCollections(cols);
    }
  },
  createCollection: (name) => {
    const cols = SteamDataManager.getCollections();
    if (!cols[name]) {
      cols[name] = [];
      SteamDataManager.setCollections(cols);
    }
  },
  getRecentGames: () => {
    try {
      const stored = os.storage.get(StorageKeys.steamRecentGames);
      return stored || [];
    } catch (e) {
      return [];
    }
  },
  setRecentGames: (games) => {
    try {
      os.storage.set(StorageKeys.steamRecentGames, games);
    } catch (e) {
      console.warn("Failed to save recent games:", e);
    }
  },
  addRecentGame: (gameId, gameTitle) => {
    const recentGames = SteamDataManager.getRecentGames();
    const existingIndex = recentGames.findIndex((g) => g.id === gameId);
    if (existingIndex !== -1) {
      recentGames.splice(existingIndex, 1);
    }
    recentGames.unshift({ id: gameId, title: gameTitle, timestamp: Date.now() });
    const trimmed = recentGames.slice(0, 10);
    SteamDataManager.setRecentGames(trimmed);
    return trimmed;
  },
  getSteamContextMenuItems: (appLauncher) => {
    const recentGames = SteamDataManager.getRecentGames();
    const items = [
      { label: "Library", icon: "fa-book", action: null },
      { label: "Store", icon: "fa-store", action: null },
      { type: "divider" }
    ];

    if (recentGames.length > 0) {
      items.push({ label: "Recent Games", icon: "fa-clock", action: null });
      recentGames.forEach((game) => {
        items.push({
          label: game.title,
          icon: "fa-gamepad",
          action: () => {
            if (appLauncher) appLauncher.launch(game.id);
          }
        });
      });
      items.push({ type: "divider" });
    }

    return items;
  }
};

const STEAM_WIN_ID = "games-app-win";

export function openSteamWindow(appLauncher, wm, focusCollection = null, gameId = null) {
  const existing = document.getElementById(STEAM_WIN_ID);
  if (existing) {
    if (existing.style.display === "none") {
      os.tray.restoreFromTray(STEAM_WIN_ID);
    } else {
      existing.style.display = "flex";
      wm.bringToFront(existing);
    }
    const taskbarItem = document.getElementById(`taskbar-${STEAM_WIN_ID}`);
    if (taskbarItem) {
      taskbarItem.style.display = "";
      taskbarItem.classList.remove("minimized");
    }

    if (gameId) {
      const container = existing.querySelector("#games-app-container");
      const onLaunch = (appId) => {
        if (appLauncher) os.app.launch(appId);
      };

      if (container.classList.contains("steam-app-root")) {
        const gamesRenderer = new steamAppRenderer();
        gamesRenderer.renderGameOverview(container, gameId, onLaunch);
      } else {
        const gamesRenderer = new steamAppRenderer();
        gamesRenderer.render(container, onLaunch, wm, focusCollection);
        setTimeout(() => {
          gamesRenderer.renderGameOverview(container, gameId, onLaunch);
        }, 100);
      }
    }
    return;
  }

  const winTitle = "Steam";
  const taskbarIcon =
    focusCollection === "Flash Games"
      ? resolveIconUrl("static/icons/flash.webp")
      : resolveIconUrl("static/icons/steam.webp");

  const win = os.window.create(STEAM_WIN_ID, winTitle, "90%", "90%", {
    icon: taskbarIcon,
    position: { x: "5%", y: "5%" },
    skipHeader: true
  });
  win.classList.add("window-root");
  win.style.display = "flex";
  win.style.flexDirection = "column";

  const gamesRenderer = new steamAppRenderer();

  win.innerHTML = `
    <div class="window-content games-app-window" style="flex:1;overflow:auto;padding:0;box-sizing:border-box;">
      <div id="games-app-container" style="height:100%;"></div>
    </div>`;

  os.tray.register(STEAM_WIN_ID, taskbarIcon, winTitle, {
    showInTray: true,
    contextMenuItems: SteamDataManager.getSteamContextMenuItems(appLauncher),
    priority: 100
  });

  const container = win.querySelector("#games-app-container");
  const onLaunch = (appId) => {
    if (appLauncher) {
      const game = appLauncher.appMap?.[appId];
      if (game) {
        SteamDataManager.addRecentGame(appId, game.title);
      }
      os.app.launch(appId);
    }
  };

  const setupSteamControls = () => {
    const closeBtn = win.querySelector(".close-btn");
    if (closeBtn) {
      closeBtn.onclick = () => {
        os.tray.sendToTray(STEAM_WIN_ID);
      };
    }
  };

  const gameParam = new URLSearchParams(window.location.search).get("steam") || gameId;
  if (gameParam) {
    if (gameId && !new URLSearchParams(window.location.search).get("steam")) {
      gamesRenderer.render(container, onLaunch, wm, focusCollection);
      setupSteamControls();
      setTimeout(() => {
        gamesRenderer.renderGameOverview(container, gameId, onLaunch);
      }, 100);
    } else {
      handleGameUrlParam(gamesRenderer, container, onLaunch, wm);
      setupSteamControls();
    }
  } else {
    gamesRenderer.render(container, onLaunch, wm, focusCollection);
    setupSteamControls();
  }
}

export function handleSteamUrlParam(appLauncher, wm) {
  const gameParam = new URLSearchParams(window.location.search).get("steam");
  if (!gameParam) return false;
  const run = () => openSteamWindow(appLauncher, wm);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
  return true;
}

class GameWindowRenderer {
  constructor() {
    this.history = ["store"];
    this.historyIndex = 0;
    this.sortBy = "relevant";
    this.sortReverse = false;
    this.currentGame = null;
    this.currentArchiveGame = null;
    this.archiveGamesCache = [];
    this.hasRendered = false;
    this.ctrlFBound = false;
    this.newsItems = [
      {
        image: `${getCdnBase()}/static/icons/steam.webp`,
        title: "Steam App Added",
        date: "May 1, 2026",
        excerpt: "The Steam app is now available in YukiOS."
      }
    ];
    this.imgObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            delete img.dataset.src;
          }
          this.imgObserver.unobserve(img);
        });
      },
      { rootMargin: "200px" }
    );

    this.gameRenderer = new GameRenderer(this);
    this.gameLauncher = new GameLauncher(this);
    this.gameUI = new GameUI(this);
  }

  getGames() {
    return [];
  }

  getGameDescription(appId) {
    if (descriptionMap[appId]) {
      return descriptionMap[appId];
    }
    const title = appMap[appId]?.title || appId;
    return `Experience ${title} on YukiOS. This game is part of your Steam library.`;
  }

  setCurrentGame(appId) {
    this.currentGame = appId;
    this.currentArchiveGame = null;
  }

  showGameOverlay(title, url) {
    return this.gameLauncher.showGameOverlay(title, url);
  }

  renderGameOverview(container, appId, onLaunch) {
    return this.gameRenderer.renderGameOverview(container, appId, onLaunch);
  }

  renderArchiveGameOverview(container, archiveGame, onLaunch) {
    return this.gameRenderer.renderArchiveGameOverview(container, archiveGame, onLaunch);
  }

  renderGrid(container, onLaunch, focusCollection = null) {
    return this.gameRenderer.renderGrid(container, onLaunch, focusCollection);
  }

  render(container, onLaunch, wm = null, focusCollection = null) {
    return this.gameUI.render(container, onLaunch, wm, focusCollection);
  }

  openFriendsWindow(wm) {
    return this.gameUI.openFriendsWindow(wm);
  }

  setActiveSidebarItem(container, appId) {
    return this.gameUI.setActiveSidebarItem(container, appId);
  }

  makeSidebarItem(game, container, onLaunch, isArchive = false) {
    return this.gameUI.makeSidebarItem(game, container, onLaunch, isArchive);
  }

  appendArchiveGameToSidebar(container, archiveGame, onLaunch) {
    const sidebarList = container.querySelector(".sidebar-game-list");
    if (!sidebarList) return;

    const existing = sidebarList.querySelector(`.sidebar-game-item[data-app="${archiveGame.appId}"]`);
    if (existing) return;

    const item = this.makeSidebarItem(archiveGame, container, onLaunch, true);
    item.classList.add("sidebar-archive-item");
    sidebarList.appendChild(item);
    observeLazyImages(item);
  }

  async loadArchiveSection(container, onLaunch, collapsed) {
    const launcher = new GameLauncher(this);
    return launcher.loadArchiveSection(container, onLaunch, collapsed);
  }

  async loadLuminSDKSection(container, collapsed) {
    const launcher = new GameLauncher(this);
    return launcher.loadLuminSDKSection(container, collapsed);
  }

  attachGridDelegation(container, onLaunch) {
    return this.gameUI.attachGridDelegation(container, onLaunch);
  }

  showContextMenu(e, appId, container, onLaunch) {
    return this.gameUI.showContextMenu(e, appId, container, onLaunch);
  }

  rebuildSidebar(container, onLaunch) {
    return this.gameUI.rebuildSidebar(container, onLaunch);
  }

  renderSidebarChunked(container, games, onLaunch) {
    return this.gameUI.renderSidebarChunked(container, games, onLaunch);
  }

  renderHiddenSidebar(container, hiddenGames, onLaunch) {
    return this.gameUI.renderHiddenSidebar(container, hiddenGames, onLaunch);
  }

  initSidebarDrag(container) {
    return this.gameUI.initSidebarDrag(container);
  }
}

export class steamAppRenderer extends GameWindowRenderer {
  getGames() {
    if (this.gamesCache) return this.gamesCache;
    const appRegistry = getAppRegistry();
    this.gamesCache = Object.entries(appMap)
      .filter(([id, data]) => {
        if (data.type === "system") return false;
        if (GAMES_APP_EXCLUDED.has(id)) return false;
        if (!data.icon || !data.title) return false;
        if (appRegistry.isAppUninstalled(id) || appRegistry.isAppDisabled(id)) return false;
        return true;
      })
      .map(([id, data]) => ({ app: id, ...data }));
    return this.gamesCache;
  }
}

function handleGameUrlParam(renderer, container, onLaunch, wm = null) {
  const urlParams = new URLSearchParams(window.location.search);
  const gameParam = urlParams.get("steam");
  if (!gameParam) return;

  const matchedGame = renderer.getGames().find((g) => g.app === gameParam);
  if (!matchedGame) return;

  renderer.render(container, onLaunch, wm);

  setTimeout(() => {
    const sidebarEl = container.querySelector(".steam-library-sidebar");
    const libraryPageEl = container.querySelector(".steam-library-page");
    const storePageEl = container.querySelector(".steam-store-page");
    const communityPageEl = container.querySelector(".steam-community-page");
    const downloadsPageEl = container.querySelector(".steam-downloads-page");
    const tabEls = container.querySelectorAll(".steam-tab");

    [libraryPageEl, storePageEl, communityPageEl, downloadsPageEl].forEach((p) => p && p.classList.add("hidden"));
    tabEls.forEach((t) => t.classList.remove("active"));
    const libTab = container.querySelector(".steam-tab[data-page='library']");
    if (libTab) libTab.classList.add("active");
    if (libraryPageEl) libraryPageEl.classList.remove("hidden");
    if (sidebarEl) sidebarEl.classList.remove("hidden");

    renderer.renderGameOverview(container, gameParam, onLaunch);

    const sidebarItems = container.querySelectorAll(".sidebar-game-item");
    sidebarItems.forEach((item) => {
      item.classList.toggle("active", item.dataset.app === gameParam);
    });

    const activeItem = container.querySelector(`.sidebar-game-item[data-app="${gameParam}"]`);
    if (activeItem) {
      activeItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, 1600);
}
