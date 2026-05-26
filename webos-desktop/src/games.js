import { appMap } from "./gamesList.js";
import { descriptionMap } from "./gameDescriptions.js";
import { GameRenderer } from "./GameRenderer.js";
import { GameLauncher } from "./GameLauncher.js";
import { GameUI } from "./GameUI.js";
import { SteamSettings } from "./steam.js";
import { resolveGhUrl, resolveIconUrl } from "./shared/assetResolver.js";
import { CDN_CONFIG } from "./shared/cdnConfig.js";
import { StorageKeys } from "./settings.js";
import { getAppRegistry } from "./appRegistry.js";

export function getCdnBase() {
  return CDN_CONFIG.repos.main.base;
}

export function getCdnBaseGames() {
  return CDN_CONFIG.repos.games.base;
}

export let _launcher = null;
export let _desktopUI = null;

export function setGameLauncher(launcher) {
  _launcher = launcher;

  setTimeout(() => {
    const settings = SteamSettings.load();
    if (settings.runOnStartup && !window._steamStartupHandled) {
      window._steamStartupHandled = true;
      launcher.launch("steamApp");

      if (settings.startMinimized) {
        setTimeout(() => {
          const steamWin = document.getElementById("games-app-win");
          if (steamWin) {
            const closeBtn = steamWin.querySelector(".close-btn");
            if (closeBtn) closeBtn.click();
          }
        }, 500);
      }
    }
  }, 1000);
}

export function setDesktopUI(ui) {
  _desktopUI = ui;
}

export function refreshSteamUI() {
  const username = localStorage.getItem(StorageKeys.username) || "Reeyuki";
  const profilePic = localStorage.getItem(StorageKeys.profilePicture) || resolveIconUrl("static/icons/guest.webp");

  const steamUserProfiles = document.querySelectorAll(".steam-user-profile span");
  steamUserProfiles.forEach((span) => {
    if (span && span.textContent !== username) {
      span.textContent = username;
    }
  });

  const userTab = document.querySelector('.steam-tab[data-page="user"]');
  if (userTab && userTab.textContent !== username) {
    userTab.textContent = username;
  }

  const steamProfileImgs = document.querySelectorAll(".steam-user-profile img");
  steamProfileImgs.forEach((img) => {
    if (img instanceof HTMLImageElement && img.src !== profilePic) {
      img.src = profilePic;
    }
  });

  const friendsName = document.querySelector(".friends-name");
  if (friendsName && friendsName.textContent !== username) {
    friendsName.textContent = username;
  }

  const friendsProfileImg = document.querySelector(".friends-profile img");
  if (friendsProfileImg instanceof HTMLImageElement && friendsProfileImg.src !== profilePic) {
    friendsProfileImg.src = profilePic;
  }
}

const _imgObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const img = entry.target;
      if (img.dataset.src) {
        img.src = img.dataset.src;
        delete img.dataset.src;
      }
      _imgObserver.unobserve(img);
    });
  },
  { rootMargin: "200px" }
);

export function lazyImg(src, attrs = "") {
  return `<img data-src="${src}" ${attrs}/>`;
}

export function observeLazyImages(root) {
  root.querySelectorAll("img[data-src]").forEach((img) => _imgObserver.observe(img));
}

export function patchAppMap(appMap) {
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
  "angryBirds2",
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
  getStats: () => JSON.parse(localStorage.getItem(StorageKeys.steamStats) || "{}"),

  getRecentMinutes: (appId) => {
    const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    try {
      const sessions = JSON.parse(localStorage.getItem(StorageKeys.steamSessions) || "{}");
      const appSessions = sessions[appId] || [];
      return appSessions.filter((s) => now - s.ts < ONE_WEEK_MS).reduce((sum, s) => sum + s.min, 0);
    } catch {
      return 0;
    }
  },
  getFavorites: () => JSON.parse(localStorage.getItem(StorageKeys.steamFavorites) || "[]"),
  setFavorites: (favs) => localStorage.setItem(StorageKeys.steamFavorites, JSON.stringify(favs)),
  getCollections: () => JSON.parse(localStorage.getItem(StorageKeys.steamCollections) || "{}"),
  setCollections: (cols) => localStorage.setItem(StorageKeys.steamCollections, JSON.stringify(cols)),
  getHidden: () => JSON.parse(localStorage.getItem(StorageKeys.steamHidden) || "[]"),
  setHidden: (hidden) => localStorage.setItem(StorageKeys.steamHidden, JSON.stringify(hidden)),
  getCollapsed: () => {
    const stored = localStorage.getItem(StorageKeys.steamCollapsed);
    if (stored === null) {
      const defaultExpanded = ["Webports/Html games"];
      localStorage.setItem(StorageKeys.steamCollapsed, JSON.stringify(defaultExpanded));
      return defaultExpanded;
    }
    return JSON.parse(stored || "[]");
  },
  setCollapsed: (collapsed) => localStorage.setItem(StorageKeys.steamCollapsed, JSON.stringify(collapsed)),

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
  }
};

export class GameWindowRenderer {
  constructor() {
    this.history = ["store"];
    this.historyIndex = 0;
    this.sortBy = "relevant";
    this.sortReverse = false;
    this.currentGame = null;
    this.currentArchiveGame = null;
    this._archiveGamesCache = [];
    this._hasRendered = false;
    this._ctrlFBound = false;
    this.newsItems = [
      {
        image: `${getCdnBase()}/static/icons/steam.webp`,
        title: "Steam App Added",
        date: "May 1, 2026",
        excerpt: "The Steam app is now available in YukiOS."
      }
    ];
    this._imgObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            delete img.dataset.src;
          }
          this._imgObserver.unobserve(img);
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

  getFlashGames() {
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
    this.gameLauncher.setCurrentGame(appId);
  }

  showGameOverlay(title, url) {
    return this.gameLauncher.showGameOverlay(title, url);
  }

  closeGame() {
    return this.gameLauncher.closeGame();
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

  _setActiveSidebarItem(container, appId) {
    return this.gameUI._setActiveSidebarItem(container, appId);
  }

  _makeSidebarItem(game, container, onLaunch, isArchive = false) {
    return this.gameUI._makeSidebarItem(game, container, onLaunch, isArchive);
  }

  _appendArchiveGameToSidebar(container, archiveGame, onLaunch) {
    return this.gameLauncher._appendArchiveGameToSidebar(container, archiveGame, onLaunch);
  }

  _loadArchiveSection(container, onLaunch, collapsed) {
    return this.gameLauncher._loadArchiveSection(container, onLaunch, collapsed);
  }

  _loadLuminSDKSection(container, collapsed) {
    return this.gameLauncher._loadLuminSDKSection(container, collapsed);
  }

  _attachGridDelegation(container, onLaunch) {
    return this.gameUI._attachGridDelegation(container, onLaunch);
  }

  showContextMenu(e, appId, container, onLaunch) {
    return this.gameUI.showContextMenu(e, appId, container, onLaunch);
  }

  _rebuildSidebar(container, onLaunch) {
    return this.gameUI._rebuildSidebar(container, onLaunch);
  }

  _renderSidebarChunked(container, games, onLaunch) {
    return this.gameUI._renderSidebarChunked(container, games, onLaunch);
  }

  _renderHiddenSidebar(container, hiddenGames, onLaunch) {
    return this.gameUI._renderHiddenSidebar(container, hiddenGames, onLaunch);
  }

  _initSidebarDrag(container) {
    return this.gameUI._initSidebarDrag(container);
  }
}

export class steamAppRenderer extends GameWindowRenderer {
  getGames() {
    if (this._gamesCache) return this._gamesCache;
    const appRegistry = getAppRegistry();
    this._gamesCache = Object.entries(appMap)
      .filter(([id, data]) => {
        if (data.type === "system") return false;
        if (GAMES_APP_EXCLUDED.has(id)) return false;
        if (!data.icon || !data.title) return false;
        if (appRegistry.isAppUninstalled(id) || appRegistry.isAppDisabled(id)) return false;
        return true;
      })
      .map(([id, data]) => ({ app: id, ...data }));
    return this._gamesCache;
  }
}

export class SystemAppRenderer {
  constructor(appMap = null) {
    this.appMap = appMap;
  }
  getSystemApps() {
    const targetMap = this.appMap || appMap;
    const appRegistry = getAppRegistry();
    appRegistry.refresh();
    return Object.entries(targetMap)
      .filter(([id, data]) => {
        if (data.type !== "system" || !data.icon || !data.title) return false;
        if (appRegistry.isAppUninstalled(id) || appRegistry.isAppDisabled(id)) return false;
        return true;
      })
      .map(([id, data]) => ({ app: id, ...data }));
  }

  createCard(app) {
    const icon = app.icon || "";
    const isFontAwesome =
      typeof icon === "string" && (icon.startsWith("fa ") || icon.startsWith("fas ") || icon.startsWith("fab "));
    return `<div class="games-app-card" data-app="${app.app}" title="${app.title}">
      <div class="games-app-card-img-wrap">
        ${isFontAwesome ? `<i style="color:#6677dd;" class="icon ${icon}"></i>` : `<img src="${icon}" alt="${app.title}" loading="lazy" />`}
      </div>
      <div class="games-app-card-title">${app.title}</div>
    </div>`;
  }

  render(container, onLaunch, wm = null) {
    const apps = this.getSystemApps();
    container.innerHTML = `
      <div style="margin-bottom:20px;">
        <input type="text" class="games-search-input" placeholder="Search apps..." style="width:100%;max-width:400px;padding:12px 16px;border:1px solid rgba(255,255,255,0.2);border-radius:8px;background:rgba(255,255,255,0.1);color:#fff;font-size:14px;outline:none;transition:all 0.3s ease;" 
               onmouseover="this.style.borderColor='rgba(255,255,255,0.4)';this.style.background='rgba(255,255,255,0.15)'"
               onmouseout="this.style.borderColor='rgba(255,255,255,0.2)';this.style.background='rgba(255,255,255,0.1)'"
               onfocus="this.style.borderColor='#6677dd';this.style.background='rgba(255,255,255,0.2)';this.style.boxShadow='0 0 0 2px rgba(102,119,221,0.3)'"
               onblur="this.style.borderColor='rgba(255,255,255,0.2)';this.style.background='rgba(255,255,255,0.1)';this.style.boxShadow='none'" />
      </div>
      <div class="games-app-grid">
        ${apps.map((a) => this.createCard(a)).join("")}
      </div>
      <div class="games-no-results" style="display:none;">No apps found</div>`;

    const noResults = container.querySelector(".games-no-results");
    const allCards = Array.from(container.querySelectorAll(".games-app-card"));

    const applyAnimations = (cards) => {
      cards.forEach((card, i) => (card.style.animationDelay = `${Math.min(i * 18, 400)}ms`));
    };

    const attachCardHandlers = (cards) => {
      cards.forEach((card) => {
        card.addEventListener("dblclick", () => onLaunch?.(card.dataset.app));
        card.addEventListener("click", () => {
          container.querySelectorAll(".games-app-card").forEach((c) => c.classList.remove("active"));
          card.classList.add("active");
        });
      });
    };

    applyAnimations(allCards);
    attachCardHandlers(allCards);

    const searchInput = container.querySelector(".games-search-input");
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        const query = searchInput.value.trim().toLowerCase();
        let visibleCount = 0;
        allCards.forEach((card) => {
          const title = card.querySelector(".games-app-card-title").textContent.toLowerCase();
          const isMatch = !query || title.includes(query);
          card.style.display = isMatch ? "" : "none";
          if (isMatch) visibleCount++;
        });
        noResults.style.display = visibleCount === 0 ? "block" : "none";
      });
    }
  }
}

export class FlashAppRenderer extends GameWindowRenderer {
  getGames() {
    return Object.entries(appMap)
      .filter(([id, data]) => {
        if (!isFlashGame(id, data)) return false;
        if (GAMES_APP_EXCLUDED.has(id)) return false;
        if (!data.icon || !data.title) return false;
        return true;
      })
      .map(([id, data]) => ({ app: id, ...data }));
  }
}

export function handleGameUrlParam(renderer, container, onLaunch, wm = null) {
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
