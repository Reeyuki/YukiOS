import { desktop } from "./desktop.js";
import { appMap } from "./gamesList.js";
import { fetchHtmlAsBlobUrl, looksLikeHtml, isJsDelivrGhUrl } from "./shared/assetResolver.js";
import { sendLaunchAnalytics } from "./analytics.js";
import { refreshIcons } from "./shared/contextMenu.js";
import { descriptionMap } from "./gameDescriptions.js";
import { getAnalyticsBase } from "./analytics.js";

let _launcher = null;
let _desktopUI = null;
export function setGameLauncher(launcher) {
  _launcher = launcher;
}
export function setDesktopUI(ui) {
  _desktopUI = ui;
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

function lazyImg(src, attrs = "") {
  return `<img data-src="${src}" ${attrs}/>`;
}

function observeLazyImages(root) {
  root.querySelectorAll("img[data-src]").forEach((img) => _imgObserver.observe(img));
}

const CDN_BASE_GAMES = "https://cdn.jsdelivr.net/gh/reeyuki/yukios-games@main";
const CDN_BASE = "https://cdn.jsdelivr.net/gh/reeyuki/yukios@main";

export function patchAppMap(appMap) {
  for (const key in appMap) {
    const app = appMap[key];

    if (app.icon && app.icon.startsWith("/static/")) {
      if (key.startsWith("subwaySurfers")) {
        app.icon = `https://cdn.jsdelivr.net/gh/reeyuki/yukios-games@main/subwaySurfers/${app.icon.split("/").pop()}`;
      } else {
        app.icon = `${CDN_BASE}${app.icon}`;
      }
    }
    if (app.swf && app.swf.startsWith("/static/games/")) {
      app.swf = CDN_BASE_GAMES + app.swf.replace("/static/games/", "/");
    }
    if (app.url && app.url.startsWith("/static/games/")) {
      app.url = CDN_BASE_GAMES + app.url.replace("/static/games/", "/");
    }
  }

  return appMap;
}
patchAppMap(appMap);

const popularityMap = new Map(Object.keys(appMap).map((id, index) => [id, index]));

export function getGameName(appId) {
  return appMap[appId]?.title || null;
}

const GAMES_APP_EXCLUDED = new Set(["TMNP", "vscode", "paint", "photopea", "liventcord"]);

export const HIGHLIGHTED_GAMES = new Set([
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
  "Three",
  "fiveNightsAtFrickbears3",
  "baldisBasicsTeachingOnTwos",
  "playtimeHellBear5van",
  "baldiBalds"
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

const SteamDataManager = {
  getStats: () => JSON.parse(localStorage.getItem("steam_stats") || "{}"),
  getFavorites: () => JSON.parse(localStorage.getItem("steam_favorites") || "[]"),
  setFavorites: (favs) => localStorage.setItem("steam_favorites", JSON.stringify(favs)),
  getCollections: () => JSON.parse(localStorage.getItem("steam_collections") || "{}"),
  setCollections: (cols) => localStorage.setItem("steam_collections", JSON.stringify(cols)),
  getHidden: () => JSON.parse(localStorage.getItem("steam_hidden") || "[]"),
  setHidden: (hidden) => localStorage.setItem("steam_hidden", JSON.stringify(hidden)),
  getCollapsed: () => JSON.parse(localStorage.getItem("steam_collapsed") || "[]"),
  setCollapsed: (collapsed) => localStorage.setItem("steam_collapsed", JSON.stringify(collapsed)),

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
    this.history = ["library"];
    this.historyIndex = 0;
    this.sortBy = "popularity";
    this.sortReverse = false;
    this.currentGame = null;
    this.currentArchiveGame = null;
    this._archiveGamesCache = [];
    this._hasRendered = false;
    this.newsItems = [
      {
        image: `${CDN_BASE}/static/icons/steam.webp`,
        title: "Steam App Added",
        date: "May 1, 2026",
        excerpt: "The Steam app is now available in YukiOS."
      }
    ];
  }

  getGames() {
    return [];
  }
  getFlashGames() {
    return [];
  }

  createCard(game) {
    const isHighlighted = HIGHLIGHTED_GAMES.has(game.app);
    return `
      <div class="steam-game-card ${isHighlighted ? "steam-game-card-highlight" : ""}" data-app="${game.app}">
        <div class="steam-game-img-wrap">
          ${lazyImg(game.icon, `alt="${game.title}"`)}
        </div>
        <div class="steam-game-title">${game.title}</div>
      </div>`;
  }

  formatTime(min) {
    if (!min) return "0min";
    if (min < 60) return `${min}min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  getSortedGames(games) {
    const stats = SteamDataManager.getStats();
    let sorted = [...games];
    sorted.sort((a, b) => {
      let valA, valB;
      if (this.sortBy === "alphabetical") {
        valA = a.title.toLowerCase();
        valB = b.title.toLowerCase();
      } else if (this.sortBy === "hours") {
        valA = stats[a.app]?.totalMin || 0;
        valB = stats[b.app]?.totalMin || 0;
      } else if (this.sortBy === "lastPlayed") {
        valA = stats[a.app]?.lastPlayed || 0;
        valB = stats[b.app]?.lastPlayed || 0;
      } else if (this.sortBy === "popularity") {
        valA = popularityMap.get(a.app) ?? 999999;
        valB = popularityMap.get(b.app) ?? 999999;
      }
      if (valA < valB) return this.sortReverse ? 1 : -1;
      if (valA > valB) return this.sortReverse ? -1 : 1;
      return 0;
    });
    return sorted;
  }

  renderGameOverview(container, appId, onLaunch) {
    const game = this.getGames().find((g) => g.app === appId);
    if (!game) return;

    this.currentGame = appId;
    this.currentArchiveGame = null;
    const stats = SteamDataManager.getStats();
    const gameStats = stats[appId] || { totalMin: 0, lastPlayed: 0 };
    const target = container.querySelector(".steam-library-page");

    target.innerHTML = `
      <div class="steam-game-overview" style="background: #1b2838; min-height: 100%; color: #dcdedf; display: flex; flex-direction: column;">
        <div class="overview-banner" style="height: 300px; position: relative; overflow: hidden; background: #171a21;">
          <img src="${game.icon}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.4; " />
          <div class="banner-content" style="position: absolute; bottom: 0; left: 0; right: 0; padding: 40px; background: linear-gradient(transparent, rgba(27, 40, 56, 1)); display: flex; align-items: flex-end; gap: 30px;">
            <img src="${game.icon}" style="width: 200px; height: 280px; object-fit: cover; border-radius: 4px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);" />
            <div class="banner-info" style="flex: 1;">
              <h1 style="font-size: 48px; margin: 0 0 10px 0; color: #fff; text-shadow: 0 2px 10px rgba(0,0,0,0.5); font-family: 'Motiva Sans', Sans-serif;">${game.title}</h1>
              <div class="play-bar" style="display: flex; align-items: center; gap: 20px;">
                <button class="steam-play-btn" style="background: linear-gradient(to right, #47b230, #5ab941); border: none; color: #fff; padding: 12px 60px; font-size: 20px; font-weight: 700; border-radius: 2px; cursor: pointer; text-transform: uppercase; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">Play</button>
                <div class="overview-stats" style="display: flex; gap: 30px; font-size: 13px; color: #898989;">
                  <div>
                    <div style="text-transform: uppercase; margin-bottom: 4px;">Last Played</div>
                    <div style="color: #fff;">${gameStats.lastPlayed ? new Date(gameStats.lastPlayed).toLocaleDateString() : "Never"}</div>
                  </div>
                  <div>
                    <div style="text-transform: uppercase; margin-bottom: 4px;">Play Time</div>
                    <div style="color: #fff;">${this.formatTime(gameStats.totalMin)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="overview-content" style="padding: 40px; display: grid; grid-template-columns: 2fr 1fr; gap: 40px;">
          <div class="overview-main">
            <div style="background: rgba(0,0,0,0.2); padding: 20px; border-radius: 4px; margin-bottom: 20px;">
              <h3 style="margin-top: 0; color: #66c0f4; text-transform: uppercase; font-size: 14px;">Game Info</h3>
              <p style="line-height: 1.6; color: #acb2b8;">${this.getGameDescription(game.app)}</p>
            </div>
            <div class="steam-whats-new-header" style="margin-bottom: 15px;">Recent Activity</div>
            <div style="color: #898989; font-style: italic; font-size: 13px;">No recent activity to show.</div>
          </div>
          <div class="overview-sidebar">
             <div style="background: rgba(0,0,0,0.2); padding: 20px; border-radius: 4px;">
               <h3 style="margin-top: 0; color: #fff; font-size: 14px; text-transform: uppercase;">Friends who play</h3>
               <div style="color: #898989; font-size: 13px;">None of your friends have played this game.</div>
             </div>
          </div>
        </div>
      </div>
    `;

    target.querySelector(".steam-play-btn").onclick = () => onLaunch(appId);
    this._setActiveSidebarItem(container, appId);
  }

  renderArchiveGameOverview(container, archiveGame, onLaunch) {
    this.currentGame = null;
    this.currentArchiveGame = archiveGame;

    const stats = SteamDataManager.getStats();
    const gameStats = stats[archiveGame.appId] || { totalMin: 0, lastPlayed: 0 };
    const target = container.querySelector(".steam-library-page");
    const thumb = archiveGame.thumb || "";

    target.innerHTML = `
      <div class="steam-game-overview" style="background: #1b2838; min-height: 100%; color: #dcdedf; display: flex; flex-direction: column;">
        <div class="overview-banner" style="height: 300px; position: relative; overflow: hidden; background: #171a21;">
          ${thumb ? `<img src="${thumb}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.4; " />` : ""}
          <div class="banner-content" style="position: absolute; bottom: 0; left: 0; right: 0; padding: 40px; background: linear-gradient(transparent, rgba(27, 40, 56, 1)); display: flex; align-items: flex-end; gap: 30px;">
            ${
              thumb
                ? `<img src="${thumb}" style="width: 200px; height: 280px; object-fit: cover; border-radius: 4px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);" />`
                : `<div style="width:200px;height:280px;background:#1b2838;border-radius:4px;display:flex;align-items:center;justify-content:center;"><i class="fas fa-gamepad" style="font-size:60px;color:#2a475e;"></i></div>`
            }
            <div class="banner-info" style="flex: 1;">
              <h1 style="font-size: 48px; margin: 0 0 10px 0; color: #fff; text-shadow: 0 2px 10px rgba(0,0,0,0.5); font-family: 'Motiva Sans', Sans-serif;">${archiveGame.title}</h1>
              <div class="play-bar" style="display: flex; align-items: center; gap: 20px;">
                <button class="steam-play-btn" style="background: linear-gradient(to right, #47b230, #5ab941); border: none; color: #fff; padding: 12px 60px; font-size: 20px; font-weight: 700; border-radius: 2px; cursor: pointer; text-transform: uppercase; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">Play</button>
                <div class="overview-stats" style="display: flex; gap: 30px; font-size: 13px; color: #898989;">
                  <div>
                    <div style="text-transform: uppercase; margin-bottom: 4px;">Last Played</div>
                    <div style="color: #fff;">${gameStats.lastPlayed ? new Date(gameStats.lastPlayed).toLocaleDateString() : "Never"}</div>
                  </div>
                  <div>
                    <div style="text-transform: uppercase; margin-bottom: 4px;">Play Time</div>
                    <div style="color: #fff;">${this.formatTime(gameStats.totalMin)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="overview-content" style="padding: 40px; display: grid; grid-template-columns: 2fr 1fr; gap: 40px;">
          <div class="overview-main">
            <div style="background: rgba(0,0,0,0.2); padding: 20px; border-radius: 4px; margin-bottom: 20px;">
              <h3 style="margin-top: 0; color: #66c0f4; text-transform: uppercase; font-size: 14px;">Game Info</h3>
              <p style="line-height: 1.6; color: #acb2b8;">Experience ${archiveGame.title} on YukiOS. This game is part of the archive collection.</p>
            </div>
            <div class="steam-whats-new-header" style="margin-bottom: 15px;">Recent Activity</div>
            <div style="color: #898989; font-style: italic; font-size: 13px;">No recent activity to show.</div>
          </div>
          <div class="overview-sidebar">
             <div style="background: rgba(0,0,0,0.2); padding: 20px; border-radius: 4px;">
               <h3 style="margin-top: 0; color: #fff; font-size: 14px; text-transform: uppercase;">Friends who play</h3>
               <div style="color: #898989; font-size: 13px;">None of your friends have played this game.</div>
             </div>
          </div>
        </div>
      </div>
    `;

    target.querySelector(".steam-play-btn").onclick = () => this.showGameOverlay(archiveGame.title, archiveGame.url);

    this._setActiveSidebarItem(container, archiveGame.appId);
  }

  getGameDescription(appId) {
    if (descriptionMap[appId]) {
      return descriptionMap[appId];
    }

    const title = appMap[appId]?.title || appId;
    return `Experience ${title} on YukiOS. This game is part of your Steam library.`;
  }

  async showGameOverlay(title, url) {
    const gameId = url
      .split("?")[0]
      .replace(/\/index\.html$/, "")
      .replace(/\.html$/, "")
      .split("/")
      .filter(Boolean)
      .pop()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
    const analyticsBase = getAnalyticsBase(gameId);
    sendLaunchAnalytics(gameId);

    if (_launcher) {
      _launcher.openIframeApp({ appId: gameId, type: "game", source: url, originalName: title, analyticsBase });
      return;
    }

    let overlay = document.getElementById("game-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "game-overlay";
      document.body.appendChild(overlay);
    }

    let iframeUrl = url;
    if (looksLikeHtml(url) && isJsDelivrGhUrl(url)) {
      try {
        iframeUrl = await fetchHtmlAsBlobUrl(url);
      } catch (err) {
        console.error("Failed to fetch game HTML:", err);
      }
    }

    overlay.innerHTML = `
      <div class="controls">
        <span id="current-game-title">${title}</span>
        <button class="close-btn">CLOSE GAME</button>
      </div>
      <iframe id="game-iframe" src="${iframeUrl}" allow="autoplay; fullscreen; clipboard-write; encrypted-media; picture-in-picture" sandbox="allow-forms allow-downloads allow-modals allow-pointer-lock allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation"></iframe>
    `;

    overlay.style.display = "flex";
    overlay.querySelector(".close-btn").onclick = () => this.closeGame();
    window.closeGame = () => this.closeGame();
  }

  closeGame() {
    const overlay = document.getElementById("game-overlay");
    if (overlay) {
      overlay.style.display = "none";
      overlay.innerHTML = "";
    }
  }

  async fetchFirstJson(urls) {
    let lastErr = null;
    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("Failed to load JSON");
  }

  formatArchiveName(name, url) {
    if (name && name !== "Yuki Game") return name;
    const n = url
      .split("/")
      .pop()
      .replace(/\.html$/, "");
    return n.charAt(0).toUpperCase() + n.slice(1);
  }

  _archiveGameId(url) {
    return url
      .split("?")[0]
      .replace(/\/index\.html$/, "")
      .replace(/\.html$/, "")
      .split("/")
      .filter(Boolean)
      .pop()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  getArchiveBase() {
    return `${CDN_BASE_GAMES}/archive/`;
  }

  _appendArchiveGameToSidebar(container, archiveGame, onLaunch) {
    const sidebarList = container.querySelector(".sidebar-game-list");
    if (!sidebarList) return;

    const existing = sidebarList.querySelector(`.sidebar-game-item[data-app="${archiveGame.appId}"]`);
    if (existing) return;

    const item = this._makeSidebarItem(archiveGame, container, onLaunch, true);
    item.classList.add("sidebar-archive-item");
    sidebarList.appendChild(item);
    observeLazyImages(item);
  }

  async _loadArchiveSection(container, onLaunch, collapsed) {
    const target = container.querySelector(".steam-library-page");
    if (!target) return;

    const sectionTitle = "All Games (Archive)";
    const sectionId = `steam-section-${sectionTitle.toLowerCase().replace(/\s+/g, "-")}`;
    const isCollapsed = collapsed.includes(sectionTitle);
    const base = this.getArchiveBase();

    const yukiosContent = target.querySelector(".steam-yukios-content");
    if (!yukiosContent) return;

    const placeholder = document.createElement("div");
    placeholder.id = "archive-section-placeholder";
    placeholder.innerHTML = `
      <div class="steam-section-header" id="${sectionId}" data-title="${sectionTitle}" style="cursor: pointer; display: flex; align-items: center; gap: 10px;">
        <i class="fas fa-spinner fa-spin" style="font-size: 10px; color: #898989;"></i>
        <div class="steam-section-title">${sectionTitle}</div>
        <div style="height: 1px; flex: 1; background: rgba(255,255,255,0.1); margin-left: 10px;"></div>
        <span style="font-size: 11px; color: #898989; margin-left: 8px;">Loading...</span>
      </div>
    `;
    yukiosContent.appendChild(placeholder);

    try {
      const data = await this.fetchFirstJson([`${base}games.json`]);
      const allGames = Array.isArray(data) ? data : data?.games || [];

      this._archiveGamesCache = allGames.map((game) => {
        const name = this.formatArchiveName(game.name, game.url);
        const fullUrl = game.url.startsWith("http") ? game.url : base + game.url;
        const appId = this._archiveGameId(fullUrl);
        let thumb = game.thumbnail
          ? game.thumbnail.startsWith("http")
            ? game.thumbnail
            : base.replace(/\/$/, "") + "/" + game.thumbnail.replace(/^\//, "")
          : "";
        return { appId, title: name, url: fullUrl, thumb };
      });

      this._archiveGamesCache.forEach((archiveGame) => {
        this._appendArchiveGameToSidebar(container, archiveGame, onLaunch);
      });

      const cards = this._archiveGamesCache
        .map(({ appId, title, url: fullUrl, thumb }) => {
          return `
          <div class="steam-game-card steam-archive-card" data-app="${appId}" data-url="${fullUrl}" title="${title}">
            <div class="steam-game-img-wrap">
              ${
                thumb
                  ? lazyImg(
                      thumb,
                      `alt="${title}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML='<div style=\\'width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#1b2838;color:#2a475e;\\'><i class=\\'fas fa-gamepad\\' style=\\'font-size:40px;\\'></i></div>'"`
                    )
                  : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#1b2838;color:#2a475e;"><i class="fas fa-gamepad" style="font-size:40px;"></i></div>`
              }
            </div>
            <div class="steam-game-title">${title}</div>
          </div>`;
        })
        .join("");

      placeholder.innerHTML = `
        <div class="steam-section-header" id="${sectionId}" data-title="${sectionTitle}" style="cursor: pointer; display: flex; align-items: center; gap: 10px;">
          <i class="fas ${isCollapsed ? "fa-chevron-right" : "fa-chevron-down"}" style="font-size: 10px; color: #898989;"></i>
          <div class="steam-section-title">${sectionTitle}</div>
          <div style="height: 1px; flex: 1; background: rgba(255,255,255,0.1); margin-left: 10px;"></div>
          <span style="font-size: 11px; color: #898989; margin-left: 8px;">${allGames.length} games</span>
        </div>
        <div class="steam-game-grid steam-archive-grid" style="display: ${isCollapsed ? "none" : "grid"}">
          ${cards}
        </div>
      `;

      observeLazyImages(placeholder);

      placeholder.querySelector(".steam-section-header").onclick = () => {
        SteamDataManager.toggleCollapsed(sectionTitle);
        const grid = placeholder.querySelector(".steam-archive-grid");
        const icon = placeholder.querySelector(".steam-section-header i");
        const nowCollapsed = SteamDataManager.getCollapsed().includes(sectionTitle);
        grid.style.display = nowCollapsed ? "none" : "grid";
        icon.className = `fas ${nowCollapsed ? "fa-chevron-right" : "fa-chevron-down"}`;
        icon.style.cssText = "font-size: 10px; color: #898989;";
      };

      const popover = container.querySelector(".steam-game-popover");
      const stats = SteamDataManager.getStats();

      placeholder.querySelectorAll(".steam-archive-card").forEach((card) => {
        const appId = card.dataset.app;
        const cardUrl = card.dataset.url;
        const cardTitle = card.querySelector(".steam-game-title")?.textContent || appId;
        const thumbImg = card.querySelector("img")?.dataset.src || card.querySelector("img")?.src || "";
        const archiveGame = { appId, title: cardTitle, url: cardUrl, thumb: thumbImg };

        card.addEventListener("click", () => {
          popover.style.display = "none";
          this.renderArchiveGameOverview(container, archiveGame, onLaunch);
        });

        card.addEventListener("dblclick", async () => {
          await this.showGameOverlay(cardTitle, cardUrl);
        });

        card.oncontextmenu = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.showContextMenu(e, appId, container, () => this.showGameOverlay(cardTitle, cardUrl));
        };

        card.addEventListener("mouseenter", () => {
          const rect = card.getBoundingClientRect();
          const gameStats = stats[appId] || { totalMin: 0, recentMin: 0 };

          popover.innerHTML = `
            <img class="popover-banner" src="${thumbImg}" />
            <div class="popover-content">
              <div class="popover-title">${cardTitle}</div>
              <div class="popover-stats">
                <div class="popover-stat-item">
                  <span class="popover-stat-label">Last two weeks:</span>
                  <span class="popover-stat-value">${this.formatTime(gameStats.recentMin)}</span>
                </div>
                <div class="popover-stat-item">
                  <span class="popover-stat-label">Total played:</span>
                  <span class="popover-stat-value">${this.formatTime(gameStats.totalMin)}</span>
                </div>
              </div>
            </div>
          `;

          popover.style.display = "block";
          const containerRect = container.getBoundingClientRect();
          popover.style.left = `${rect.right - containerRect.left + 10}px`;
          popover.style.top = `${rect.top - containerRect.top}px`;

          const popRect = popover.getBoundingClientRect();
          if (popRect.right > window.innerWidth) {
            popover.style.left = `${rect.left - popRect.width - 10}px`;
          }
          if (popRect.bottom > window.innerHeight) {
            popover.style.top = `${window.innerHeight - popRect.height - 10}px`;
          }
        });

        card.addEventListener("mouseleave", () => {
          popover.style.display = "none";
        });
      });
    } catch (err) {
      console.error("Archive load failed:", err);
      placeholder.innerHTML = `<div style="color:#898989;font-size:13px;padding:10px 0;">Failed to load archive games.</div>`;
    }
  }

  renderGrid(container, onLaunch, focusCollection = null) {
    if (this.currentArchiveGame) {
      this.renderArchiveGameOverview(container, this.currentArchiveGame, onLaunch);
      return;
    }
    if (this.currentGame) {
      this.renderGameOverview(container, this.currentGame, onLaunch);
      return;
    }
    const allGames = this.getGames();
    const stats = SteamDataManager.getStats();
    const favorites = SteamDataManager.getFavorites();
    const collections = SteamDataManager.getCollections();
    const hidden = SteamDataManager.getHidden();
    const collapsed = SteamDataManager.getCollapsed();

    const filteredGames = allGames.filter((g) => !hidden.includes(g.app));
    const sortedGames = this.getSortedGames(filteredGames);

    const recentGames = filteredGames
      .filter((g) => stats[g.app]?.lastPlayed)
      .sort((a, b) => stats[b.app].lastPlayed - stats[a.app].lastPlayed)
      .slice(0, 5);

    const target = container.querySelector(".steam-library-page");
    if (!target) return;

    const isNewsCollapsed = collapsed.includes("What's New");

    const shellHtml = `
      <div class="steam-grid-controls-bar" style="margin-bottom: 20px; display: flex; justify-content: flex-end; align-items: center; gap: 15px;">
        <div class="steam-grid-filters" style="display: flex; align-items: center; gap: 15px;">
          <span class="steam-control-label">Sort by</span>
          <select class="steam-sort-select">
            <option value="popularity" ${this.sortBy === "popularity" ? "selected" : ""}>Popularity</option>
            <option value="alphabetical" ${this.sortBy === "alphabetical" ? "selected" : ""}>Alphabetical</option>
            <option value="hours" ${this.sortBy === "hours" ? "selected" : ""}>Hours Played</option>
            <option value="lastPlayed" ${this.sortBy === "lastPlayed" ? "selected" : ""}>Last Played</option>
          </select>
          <button class="steam-sort-order-btn">
            <i class="fas ${this.sortReverse ? "fa-sort-amount-up" : "fa-sort-amount-down"}"></i>
          </button>
        </div>
      </div>
      <div class="steam-yukios-content">
        <div class="steam-whats-new">
          <div class="steam-whats-new-header steam-section-header" data-title="What's New" style="cursor: pointer; display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
            <i class="fas ${isNewsCollapsed ? "fa-chevron-right" : "fa-chevron-down"}" style="font-size: 10px; color: #898989;"></i>
            <div class="steam-section-title">What's New</div>
            <div style="height: 1px; flex: 1; background: rgba(255,255,255,0.1); margin-left: 10px;"></div>
          </div>
          <div class="steam-whats-new-list" style="display: ${isNewsCollapsed ? "none" : "flex"}">
            ${this.newsItems
              .map(
                (item) => `
              <div class="news-card">
                <img src="${item.image}" />
                <div class="news-info">
                  <div class="news-title">${item.title}</div>
                  <div class="news-date">${item.date}</div>
                </div>
              </div>`
              )
              .join("")}
          </div>
        </div>
        <div id="steam-sections-host"></div>
      </div>
    `;

    target.innerHTML = shellHtml;

    const sectionsHost = target.querySelector("#steam-sections-host");

    const webIds = collections["Webports/Html games"] || [];
    const flashIds = collections["Flash Games"] || [];

    const sections = [
      { title: "Recent", games: recentGames },
      { title: "Favorites", games: sortedGames.filter((g) => favorites.includes(g.app)) },
      { title: "Webports/Html games", games: sortedGames.filter((g) => webIds.includes(g.app)) },
      { title: "Flash Games", games: sortedGames.filter((g) => flashIds.includes(g.app)) },
      ...Object.entries(collections)
        .filter(([name]) => name !== "Webports/Html games" && name !== "Flash Games")
        .map(([name, ids]) => ({ title: name, games: sortedGames.filter((g) => ids.includes(g.app)) })),
      { title: "All Games", games: sortedGames }
    ].filter((s) => s.games.length > 0);

    sections.forEach(({ title, games }) => {
      const sectionId = `steam-section-${title.toLowerCase().replace(/\s+/g, "-")}`;
      const isCollapsed = collapsed.includes(title);
      const wrapper = document.createElement("div");
      wrapper.dataset.sectionWrapper = title;
      wrapper.innerHTML = `
        <div class="steam-section-header" id="${sectionId}" data-title="${title}" style="cursor: pointer; display: flex; align-items: center; gap: 10px;">
          <i class="fas ${isCollapsed ? "fa-chevron-right" : "fa-chevron-down"}" style="font-size: 10px; color: #898989;"></i>
          <div class="steam-section-title">${title}</div>
          <div style="height: 1px; flex: 1; background: rgba(255,255,255,0.1); margin-left: 10px;"></div>
        </div>
        <div class="steam-game-grid" data-section="${title}" style="display: ${isCollapsed ? "none" : "grid"}"></div>
      `;
      sectionsHost.appendChild(wrapper);

      if (!isCollapsed) {
        this._fillGridLazy(wrapper.querySelector(".steam-game-grid"), games);
      }
    });

    sectionsHost.appendChild(document.createComment("archive-placeholder"));
    this._loadArchiveSection(container, onLaunch, collapsed);

    const sidebar = container.querySelector(".steam-library-sidebar");
    const mainContent = container.querySelector(".steam-main-content");

    if (container.querySelector(".steam-tab[data-page='library']").classList.contains("active")) {
      sidebar.classList.remove("hidden");
    }
    if (target) target.style.height = "auto";
    if (mainContent) {
      mainContent.style.padding = this.currentGame ? "0" : "20px";
      mainContent.style.overflowY = "auto";
    }

    this._attachGridDelegation(container, onLaunch);

    const sortSelect = target.querySelector(".steam-sort-select");
    const sortBtn = target.querySelector(".steam-sort-order-btn");
    if (sortSelect) {
      sortSelect.addEventListener("change", () => {
        this.sortBy = sortSelect.value;
        this.renderGrid(container, onLaunch, focusCollection);
      });
    }
    if (sortBtn) {
      sortBtn.addEventListener("click", () => {
        this.sortReverse = !this.sortReverse;
        this.renderGrid(container, onLaunch, focusCollection);
      });
    }

    if (this.currentGame) this._setActiveSidebarItem(container, this.currentGame);
    else if (this.currentArchiveGame) this._setActiveSidebarItem(container, this.currentArchiveGame.appId);

    target.querySelectorAll(".steam-section-header").forEach((header) => {
      header.onclick = () => {
        SteamDataManager.toggleCollapsed(header.dataset.title);
        this.renderGrid(container, onLaunch, focusCollection);
      };
    });
  }

  _fillGridLazy(grid, games) {
    const CHUNK = 30;
    let index = 0;
    const renderChunk = (deadline) => {
      while (index < games.length && (deadline ? deadline.timeRemaining() > 1 : index === 0)) {
        const end = Math.min(index + CHUNK, games.length);
        const frag = document.createDocumentFragment();
        const tmp = document.createElement("div");
        tmp.innerHTML = games
          .slice(index, end)
          .map((g) => this.createCard(g))
          .join("");
        while (tmp.firstChild) frag.appendChild(tmp.firstChild);
        grid.appendChild(frag);
        observeLazyImages(grid);
        index = end;
        if (!deadline) break;
      }
      if (index < games.length) {
        requestIdleCallback(renderChunk, { timeout: 500 });
      }
    };
    requestIdleCallback(renderChunk, { timeout: 200 });
  }

  _attachGridDelegation(container, onLaunch) {
    const mainContent = container.querySelector(".steam-main-content");
    const popover = container.querySelector(".steam-game-popover");
    const stats = SteamDataManager.getStats();
    const allGames = this.getGames();
    const gameMap = new Map(allGames.map((g) => [g.app, g]));

    if (mainContent._steamDelegated) return;
    mainContent._steamDelegated = true;

    mainContent.addEventListener("click", (e) => {
      const card = e.target.closest(".steam-game-card");
      if (!card) return;
      popover.style.display = "none";
      const appId = card.dataset.app;
      const game = gameMap.get(appId);
      if (game) {
        this.renderGameOverview(container, appId, onLaunch);
        return;
      }
      const archiveGame = this._archiveGamesCache.find((g) => g.appId === appId);
      if (archiveGame) {
        this.renderArchiveGameOverview(container, archiveGame, onLaunch);
      }
    });

    mainContent.addEventListener("dblclick", async (e) => {
      const card = e.target.closest(".steam-game-card");
      if (!card) return;
      const appId = card.dataset.app;
      const cardUrl = card.dataset.url || null;
      if (cardUrl) {
        const title = card.querySelector(".steam-game-title")?.textContent || appId;
        await this.showGameOverlay(title, cardUrl);
      } else {
        onLaunch(appId);
      }
    });

    mainContent.addEventListener("contextmenu", (e) => {
      const card = e.target.closest(".steam-game-card");
      if (!card) return;
      e.preventDefault();
      e.stopPropagation();
      const appId = card.dataset.app;
      this.showContextMenu(e, appId, container, onLaunch);
    });

    mainContent.addEventListener(
      "mouseenter",
      (e) => {
        const card = e.target.closest(".steam-game-card");
        if (!card) return;
        const appId = card.dataset.app;
        const game = gameMap.get(appId);
        const gameStats = stats[appId] || { totalMin: 0, recentMin: 0 };
        const icon = game?.icon || card.querySelector("img")?.src || card.querySelector("img")?.dataset.src || "";
        const title = game?.title || card.querySelector(".steam-game-title")?.textContent || appId;

        popover.innerHTML = `
        <img class="popover-banner" src="${icon}" />
        <div class="popover-content">
          <div class="popover-title">${title}</div>
          <div class="popover-stats">
            <div class="popover-stat-item">
              <span class="popover-stat-label">Last two weeks:</span>
              <span class="popover-stat-value">${this.formatTime(gameStats.recentMin)}</span>
            </div>
            <div class="popover-stat-item">
              <span class="popover-stat-label">Total played:</span>
              <span class="popover-stat-value">${this.formatTime(gameStats.totalMin)}</span>
            </div>
          </div>
        </div>
      `;
        popover.style.display = "block";
        const rect = card.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        popover.style.left = `${rect.right - containerRect.left + 10}px`;
        popover.style.top = `${rect.top - containerRect.top}px`;
        const popRect = popover.getBoundingClientRect();
        if (popRect.right > window.innerWidth) popover.style.left = `${rect.left - popRect.width - 10}px`;
        if (popRect.bottom > window.innerHeight) popover.style.top = `${window.innerHeight - popRect.height - 10}px`;
      },
      true
    );

    mainContent.addEventListener(
      "mouseleave",
      (e) => {
        const card = e.target.closest?.(".steam-game-card");
        if (card) popover.style.display = "none";
      },
      true
    );
  }

  showContextMenu(e, appId, container, onLaunch) {
    const menu = container.querySelector(".steam-context-menu");
    const favorites = SteamDataManager.getFavorites();
    const collections = SteamDataManager.getCollections();
    const isFav = favorites.includes(appId);
    const isHidden = SteamDataManager.getHidden().includes(appId);

    let html = `
    <div class="steam-context-item" id="ctx-launch"><i class="fas fa-play" style="width:16px;margin-right:8px;opacity:0.6;"></i>Launch</div>
    <div class="steam-context-item" id="ctx-fav"><i class="fas ${isFav ? "fa-star-half-alt" : "fa-star"}" style="width:16px;margin-right:8px;opacity:0.6;"></i>${isFav ? "Remove from Favorites" : "Add to Favorites"}</div>
    <div class="steam-context-item" id="ctx-hide"><i class="fas ${isHidden ? "fa-eye" : "fa-eye-slash"}" style="width:16px;margin-right:8px;opacity:0.6;"></i>${isHidden ? "Unhide this game" : "Hide this game"}</div>
    <div class="steam-context-item" id="ctx-add-home"><i class="fas fa-home" style="width:16px;margin-right:8px;opacity:0.6;"></i>Add to home screen</div>
    <div class="steam-context-item" id="ctx-report" style="color: #ff4d4d;"><i class="fas fa-bug" style="width:16px;margin-right:8px;opacity:0.6;"></i>Report broken game</div>
    <div class="steam-context-item">
      <i class="fas fa-folder-plus" style="width:16px;margin-right:8px;opacity:0.6;"></i>Add to Collection <i class="fas fa-chevron-right" style="font-size:10px;margin-left:auto;"></i>
      <div class="steam-context-submenu">
        <div class="steam-context-item" id="ctx-new-col"><i class="fas fa-plus" style="width:16px;margin-right:8px;opacity:0.6;"></i><b>New Collection...</b></div>
        ${Object.keys(collections)
          .map(
            (name) =>
              `<div class="steam-context-item ctx-col-item" data-name="${name}"><i class="fas fa-folder" style="width:16px;margin-right:8px;opacity:0.6;"></i>${name}</div>`
          )
          .join("")}
      </div>
    </div>
  `;

    menu.innerHTML = html;
    refreshIcons(menu);
    menu.style.display = "block";

    const containerRect = container.getBoundingClientRect();
    let x = e.clientX - containerRect.left;
    let y = e.clientY - containerRect.top;

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    const menuRect = menu.getBoundingClientRect();
    if (menuRect.right > window.innerWidth) x -= menuRect.width;
    if (menuRect.bottom > window.innerHeight) y -= menuRect.height;

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    const closeMenu = () => {
      menu.style.display = "none";
      document.removeEventListener("click", closeMenu);
    };
    setTimeout(() => document.addEventListener("click", closeMenu), 0);

    menu.querySelector("#ctx-launch").onclick = () => onLaunch(appId);
    menu.querySelector("#ctx-fav").onclick = () => {
      SteamDataManager.toggleFavorite(appId);
      this.renderGrid(container, onLaunch);
      this._rebuildSidebar(container, onLaunch);
    };
    menu.querySelector("#ctx-hide").onclick = () => {
      SteamDataManager.toggleHide(appId);
      this.renderGrid(container, onLaunch);
      this._rebuildSidebar(container, onLaunch);
    };
    menu.querySelector("#ctx-new-col").onclick = () => {
      const name = prompt("Enter collection name:");
      if (name && name.trim()) {
        SteamDataManager.createCollection(name.trim());
        SteamDataManager.addToCollection(name.trim(), appId);
        this.renderGrid(container, onLaunch);
      }
    };
    menu.querySelectorAll(".ctx-col-item").forEach((item) => {
      item.onclick = () => {
        SteamDataManager.addToCollection(item.dataset.name, appId);
        this.renderGrid(container, onLaunch);
      };
    });

    menu.querySelector("#ctx-add-home").onclick = async () => {
      const game =
        this.getGames().find((g) => g.app === appId) || this._archiveGamesCache.find((g) => g.appId === appId);
      if (!game) return;
      const title = game.title;
      const icon = game.icon || game.thumb;
      const fileName = `${title}.desktop`;
      const fileContent = JSON.stringify({ app: "steamApp", steamGameId: appId, name: title, path: icon });

      try {
        await _launcher.fs.createFile(["Desktop"], fileName, fileContent, "text");
        if (_desktopUI) {
          await _desktopUI.createDesktopFileIcon(fileName);
          _launcher.wm.sendNotify(`"${title}" added to home screen`);
        }
      } catch (err) {
        console.error("Failed to add to home screen:", err);
        _launcher.wm.sendNotify(`Failed to add "${title}" to home screen`);
      }
    };

    menu.querySelector("#ctx-report").onclick = async () => {
      const game = this.getGames().find((g) => g.app === appId);
      const title = game ? game.title : appId;
      const reason = prompt(`Report ${title} as broken? Please provide a reason:`);
      if (reason === null) return;

      try {
        const res = await fetch("https://analytics.liventcord-a60.workers.dev/api/report-broken", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appId, title, reason })
        });
        if (res.ok) {
          alert("Thank you! Your report has been sent to the developers.");
        } else {
          alert("Failed to send report. Please try again later.");
        }
      } catch (err) {
        alert("An error occurred while sending the report.");
      }
    };
  }

  _rebuildSidebar(container, onLaunch) {
    const allGames = this.getGames();
    const hidden = SteamDataManager.getHidden();

    const sidebarHiddenSection = container.querySelector(".sidebar-hidden-section");

    const visibleGames = allGames.filter((g) => !hidden.includes(g.app));
    this._renderSidebarChunked(container, visibleGames, onLaunch);

    this._archiveGamesCache.forEach((archiveGame) => {
      this._appendArchiveGameToSidebar(container, archiveGame, onLaunch);
    });

    if (sidebarHiddenSection) {
      const hiddenGames = allGames.filter((g) => hidden.includes(g.app));
      if (hiddenGames.length === 0) {
        sidebarHiddenSection.style.display = "none";
      } else {
        sidebarHiddenSection.style.display = "block";
        const countEl = sidebarHiddenSection.querySelector(".sidebar-hidden-count");
        if (countEl) countEl.textContent = hiddenGames.length;
        this._renderHiddenSidebar(container, hiddenGames, onLaunch);
      }
    }
  }

  _setActiveSidebarItem(container, appId) {
    container.querySelectorAll(".sidebar-game-item").forEach((item) => {
      item.classList.toggle("active", item.dataset.app === appId);
    });
  }

  _makeSidebarItem(game, container, onLaunch, isArchive = false) {
    const appId = isArchive ? game.appId : game.app;
    const title = game.title;
    const icon = isArchive ? game.thumb : game.icon;
    const item = document.createElement("div");
    item.className = "sidebar-game-item";
    item.dataset.app = appId;
    item.innerHTML = icon
      ? `<img data-src="${icon}" /><span>${title}</span>`
      : `<i class="fas fa-gamepad" style="font-size:16px;color:#2a475e;flex-shrink:0;"></i><span>${title}</span>`;

    item.addEventListener("click", () => {
      if (isArchive) {
        this.renderArchiveGameOverview(container, game, onLaunch);
      } else {
        this.renderGameOverview(container, appId, onLaunch);
      }
    });
    item.addEventListener("dblclick", () => {
      if (isArchive) {
        this.showGameOverlay(game.title, game.url);
      } else {
        onLaunch(appId);
      }
    });
    item.oncontextmenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const launchFn = isArchive ? () => this.showGameOverlay(game.title, game.url) : onLaunch;
      this.showContextMenu(e, appId, container, launchFn);
    };
    return item;
  }

  _renderSidebarChunked(container, games, onLaunch) {
    const sidebarList = container.querySelector(".sidebar-game-list");
    if (!sidebarList) return;
    sidebarList.innerHTML = "";

    const CHUNK = 50;
    let index = 0;

    const renderChunk = (deadline) => {
      while (index < games.length && (deadline ? deadline.timeRemaining() > 2 : true)) {
        const end = Math.min(index + CHUNK, games.length);
        const fragment = document.createDocumentFragment();
        for (let i = index; i < end; i++) {
          fragment.appendChild(this._makeSidebarItem(games[i], container, onLaunch, false));
        }
        sidebarList.appendChild(fragment);
        observeLazyImages(sidebarList);
        index = end;
        if (!deadline) break;
      }
      if (index < games.length) {
        requestIdleCallback(renderChunk, { timeout: 200 });
      } else {
        if (this.currentGame) this._setActiveSidebarItem(container, this.currentGame);
        else if (this.currentArchiveGame) this._setActiveSidebarItem(container, this.currentArchiveGame.appId);
      }
    };

    requestIdleCallback(renderChunk, { timeout: 100 });
  }

  _renderHiddenSidebar(container, hiddenGames, onLaunch) {
    const hiddenList = container.querySelector(".sidebar-hidden-list");
    if (!hiddenList) return;
    hiddenList.innerHTML = "";
    hiddenGames.forEach((g) => {
      const item = this._makeSidebarItem(g, container, onLaunch, false);
      item.classList.add("sidebar-hidden-item");
      hiddenList.appendChild(item);
    });
    observeLazyImages(hiddenList);
  }

  _initSidebarDrag(container) {
    const sidebar = container.querySelector(".steam-library-sidebar");
    if (!sidebar || sidebar._dragInited) return;
    sidebar._dragInited = true;

    const handle = sidebar.querySelector(".sidebar-resize-handle");
    if (!handle) return;

    let startX = 0;
    let startWidth = 0;
    let isDragging = false;

    handle.addEventListener("mousedown", (e) => {
      isDragging = true;
      startX = e.clientX;
      startWidth = sidebar.offsetWidth;
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const delta = e.clientX - startX;
      const newWidth = Math.max(140, Math.min(400, startWidth + delta));
      sidebar.style.width = `${newWidth}px`;
    });

    document.addEventListener("mouseup", () => {
      if (!isDragging) return;
      isDragging = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    });
  }

  render(container, onLaunch, wm = null, focusCollection = null) {
    SteamDataManager.setupDefaultCollections();
    const allGames = this.getGames();
    const hidden = SteamDataManager.getHidden();
    const visibleGames = allGames.filter((g) => !hidden.includes(g.app));
    const hiddenGames = allGames.filter((g) => hidden.includes(g.app));
    const username = localStorage.getItem("yukiOS_username") || "Reeyuki";
    const profilePic = localStorage.getItem("yukiOS_profilePicture") || "static/icons/guest.webp";

    container.classList.add("steam-app-root");
    container.style.padding = "0";

    const winRootn = container.closest(".window");
    const existingControls = winRootn?.querySelector(".window-controls");
    if (existingControls && container.contains(existingControls)) {
      winRootn.appendChild(existingControls);
    }

    container.innerHTML = `
      <div class="steam-loading-screen">
        <div class="steam-loading-logo">
          <div class="steam-spinner"></div>
          <i class="fab fa-steam"></i>
        </div>
      </div>

      <div class="steam-main">
        <div class="steam-top-bar window-header">
          <div class="steam-menu-items">
            <span class="steam-menu-item">Steam</span>
            <span class="steam-menu-item">View</span>
            <span class="steam-menu-item">Games</span>
          </div>
          <div class="steam-top-right">
            <div class="steam-notifications"><i class="fas fa-bell"></i></div>
            <div class="steam-user-profile">
              <span>${username}</span>
              <img src="${profilePic}" />
            </div>
            <div class="steam-window-controls-slot"></div>
          </div>
        </div>

        <div class="steam-nav-bar">
          <div class="steam-nav-buttons">
            <button class="steam-nav-btn steam-back-btn"><i class="fas fa-arrow-left"></i></button>
            <button class="steam-nav-btn steam-forward-btn"><i class="fas fa-arrow-right"></i></button>
          </div>
          <div class="steam-tabs">
            <span class="steam-tab" data-page="store">Store</span>
            <span class="steam-tab active" data-page="library">Library</span>
            <span class="steam-tab" data-page="community">Community</span>
            <span class="steam-tab" data-page="user">${username}</span>
          </div>
        </div>

        <div class="steam-content-area">
          <div class="steam-library-sidebar hidden">
            <div class="sidebar-search-container">
               <input type="text" class="sidebar-search-input" placeholder="Search" />
            </div>
            <div class="sidebar-game-list"></div>
            <div class="sidebar-hidden-section" style="display:${hiddenGames.length > 0 ? "block" : "none"};" data-collapsed="1">
              <div class="sidebar-hidden-header">
                <i class="fas fa-chevron-right sidebar-hidden-chevron"></i>
                <span>Hidden Games</span>
                <span class="sidebar-hidden-count">${hiddenGames.length}</span>
              </div>
              <div class="sidebar-hidden-list" style="display:none;"></div>
            </div>
            <div class="sidebar-resize-handle"></div>
          </div>

          <div class="steam-main-content">
            <div class="steam-library-page"></div>
            <div class="steam-store-page hidden" style="display:flex;align-items:center;justify-content:center;height:100%;font-size:24px;opacity:0.5;">
               Steam Store
            </div>
            <div class="steam-community-page hidden" style="display:flex;align-items:center;justify-content:center;height:100%;font-size:24px;opacity:0.5;">
               Community Page
            </div>
            <div class="steam-downloads-page hidden" style="display:flex;align-items:center;justify-content:center;height:100%;font-size:24px;opacity:0.5;">
               Downloads Center
            </div>
          </div>
        </div>

        <div class="steam-bottom-bar">
          <div class="steam-bottom-left"></div>
          <div class="steam-bottom-center">
            <button class="steam-downloads-btn"><i class="fas fa-download"></i> DOWNLOADS</button>
          </div>
          <div class="steam-bottom-right">
            <div class="steam-friends-btn">
              <i class="fas fa-user-friends"></i>
              <span>FRIENDS & CHAT</span>
            </div>
          </div>
        </div>
      </div>

      <div class="steam-game-popover"></div>
      <div class="steam-context-menu"></div>
      <div class="steam-scroll-top"><i class="fas fa-chevron-up"></i></div>
    `;

    const winRoot = container.closest(".window");
    if (winRoot) {
      const header = winRoot.querySelector(".window-header:not(.steam-top-bar)");
      let controls = winRoot.querySelector(".window-controls");
      const slot = container.querySelector(".steam-window-controls-slot");

      if (controls && slot) {
        slot.appendChild(controls);
        if (header) header.style.display = "none";
      }
      if (wm) wm.makeDraggable(winRoot);
    }

    const loader = container.querySelector(".steam-loading-screen");
    const main = container.querySelector(".steam-main");
    const isFirstOpen = !this._hasRendered;
    this._hasRendered = true;

    const revealUI = () => {
      if (main) main.classList.remove("hidden");
      if (loader) {
        loader.style.transition = "opacity 200ms ease";
        loader.style.opacity = "0";
        loader.addEventListener("transitionend", () => loader.classList.add("hidden"), { once: true });
      }
    };

    if (isFirstOpen) {
      setTimeout(() => {
        this.renderGrid(container, onLaunch, focusCollection);
        setTimeout(revealUI, 600);
      }, 50);
    } else {
      this.renderGrid(container, onLaunch, focusCollection);
      revealUI();
    }

    if (focusCollection) {
      setTimeout(() => {
        const sectionId = `steam-section-${focusCollection.toLowerCase().replace(/\s+/g, "-")}`;
        const sectionEl = container.querySelector(`#${sectionId}`);
        const mainContent = container.querySelector(".steam-main-content");
        if (sectionEl && mainContent) {
          mainContent.scrollTo({
            top: sectionEl.offsetTop - 20,
            behavior: "smooth"
          });
        }
      }, 1500);
    }

    const sidebar = container.querySelector(".steam-library-sidebar");
    const mainContent = container.querySelector(".steam-main-content");
    const libraryPage = container.querySelector(".steam-library-page");
    const storePage = container.querySelector(".steam-store-page");
    const communityPage = container.querySelector(".steam-community-page");
    const downloadsPage = container.querySelector(".steam-downloads-page");
    const scrollTop = container.querySelector(".steam-scroll-top");
    const tabs = container.querySelectorAll(".steam-tab");

    const updatePageUI = (page) => {
      [libraryPage, storePage, communityPage, downloadsPage].forEach((p) => p.classList.add("hidden"));
      tabs.forEach((t) => t.classList.remove("active"));
      sidebar.classList.add("hidden");
      scrollTop.classList.remove("visible");

      if (page === "library") {
        libraryPage.classList.remove("hidden");
        sidebar.classList.remove("hidden");
        observeLazyImages(sidebar);
        container.querySelector(".steam-tab[data-page='library']").classList.add("active");
      } else if (page === "store") {
        storePage.classList.remove("hidden");
        container.querySelector(".steam-tab[data-page='store']").classList.add("active");
      } else if (page === "community") {
        communityPage.classList.remove("hidden");
        container.querySelector(".steam-tab[data-page='community']").classList.add("active");
      } else if (page === "downloads") {
        downloadsPage.classList.remove("hidden");
      }
    };

    const navigateTo = (page) => {
      if (this.history[this.historyIndex] === page) return;
      this.history = this.history.slice(0, this.historyIndex + 1);
      this.history.push(page);
      this.historyIndex++;
      updatePageUI(page);
    };

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        this.currentGame = null;
        this.currentArchiveGame = null;
        navigateTo(tab.dataset.page);
        this.renderGrid(container, onLaunch);
      });
    });

    container.querySelector(".steam-back-btn").addEventListener("click", () => {
      if (this.historyIndex > 0) {
        this.historyIndex--;
        updatePageUI(this.history[this.historyIndex]);
      }
    });

    container.querySelector(".steam-forward-btn").addEventListener("click", () => {
      if (this.historyIndex < this.history.length - 1) {
        this.historyIndex++;
        updatePageUI(this.history[this.historyIndex]);
      }
    });

    mainContent.addEventListener("scroll", () => {
      if (mainContent.scrollTop > 300) scrollTop.classList.add("visible");
      else scrollTop.classList.remove("visible");
    });

    scrollTop.addEventListener("click", () => {
      mainContent.scrollTo({ top: 0, behavior: "smooth" });
    });

    const sidebarSearch = container.querySelector(".sidebar-search-input");
    sidebarSearch.addEventListener("input", () => {
      const query = sidebarSearch.value.toLowerCase().trim();
      const sidebarList = container.querySelector(".sidebar-game-list");

      if (!query) {
        this._renderSidebarChunked(container, visibleGames, onLaunch);
        const gridCards = container.querySelectorAll(".steam-game-card");
        gridCards.forEach((card) => {
          card.style.display = "";
        });
        return;
      }

      const matchedGames = visibleGames.filter((g) => g.title.toLowerCase().includes(query));
      const archiveMatches = this._archiveGamesCache.filter((g) => g.title.toLowerCase().includes(query));

      sidebarList.innerHTML = "";
      [...matchedGames, ...archiveMatches].forEach((g) => {
        const isArchive = !g.app;
        const appId = g.app || g.appId;
        const title = g.title;
        const icon = g.icon || g.thumb;
        const item = document.createElement("div");
        item.className = "sidebar-game-item";
        item.dataset.app = appId;
        item.innerHTML = icon
          ? `<img data-src="${icon}" /><span>${title}</span>`
          : `<i class="fas fa-gamepad" style="font-size:16px;color:#2a475e;flex-shrink:0;"></i><span>${title}</span>`;
        item.addEventListener("click", () => {
          if (isArchive) {
            this.renderArchiveGameOverview(container, g, onLaunch);
          } else {
            this.renderGameOverview(container, appId, onLaunch);
          }
        });
        sidebarList.appendChild(item);
        observeLazyImages(item);
      });

      const gridCards = container.querySelectorAll(".steam-game-card");
      gridCards.forEach((card) => {
        const title = card.querySelector(".steam-game-title").textContent.toLowerCase();
        card.style.display = title.includes(query) ? "" : "none";
      });
    });

    this._renderSidebarChunked(container, visibleGames, onLaunch);
    this._renderHiddenSidebar(container, hiddenGames, onLaunch);

    const hiddenSection = container.querySelector(".sidebar-hidden-section");
    const hiddenHeader = container.querySelector(".sidebar-hidden-header");
    if (hiddenHeader && hiddenSection) {
      hiddenHeader.addEventListener("click", () => {
        const isCollapsed = hiddenSection.dataset.collapsed === "1";
        const hiddenList = hiddenSection.querySelector(".sidebar-hidden-list");
        const chevron = hiddenSection.querySelector(".sidebar-hidden-chevron");

        if (isCollapsed) {
          hiddenSection.dataset.collapsed = "0";
          hiddenList.style.display = "block";
          chevron.classList.remove("fa-chevron-right");
          chevron.classList.add("fa-chevron-down");
        } else {
          hiddenSection.dataset.collapsed = "1";
          hiddenList.style.display = "none";
          chevron.classList.remove("fa-chevron-down");
          chevron.classList.add("fa-chevron-right");
        }
      });
    }

    this._initSidebarDrag(container);

    container.querySelector(".steam-downloads-btn").addEventListener("click", () => navigateTo("downloads"));
    container.querySelector(".steam-friends-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      this.openFriendsWindow(wm);
    });

    if (!this._ctrlFBound) {
      this._ctrlFBound = true;

      document.addEventListener(
        "keydown",
        (e) => {
          const isFind = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f";
          if (!isFind) return;

          const root = container;
          if (!root || !document.body.contains(root)) return;

          const input = root.querySelector(".sidebar-search-input");

          if (!input) return;

          e.preventDefault();
          e.stopPropagation();

          input.focus();
          input.select?.();
        },
        true
      );
    }
    window.addEventListener(
      "beforeinput",
      (e) => {
        if (e.inputType === "insertText" && e.data === "f" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
        }
      },
      true
    );

    updatePageUI("library");
  }

  openFriendsWindow(wm) {
    if (!wm) return;
    const winId = "steam-friends-win";
    const existing = document.getElementById(winId);
    if (existing) {
      wm.bringToFront(existing);
      return;
    }

    const win = wm.createWindow(winId, "Friends List", "280px", "450px");
    win.classList.add("window-root");
    win.style.background = "#1b2838";

    const username = localStorage.getItem("yukiOS_username") || "Reeyuki";
    const profilePic = localStorage.getItem("yukiOS_profilePicture") || "static/icons/guest.webp";

    win.innerHTML = `
      <div class="window-header" style="background: #171d25 !important; border-bottom: 1px solid rgba(255,255,255,0.1);">
        <span>Friends</span>
        ${wm.getWindowControls()}
      </div>
      <div class="window-content" style="display:flex; flex-direction:column; height:100%; color:#dcdedf;">
        <div class="friends-header" style="padding: 15px; background: rgba(0,0,0,0.2); display: flex; align-items: center; gap: 12px;">
          <div class="friends-profile-img" style="width: 48px; height: 48px; border: 2px solid #57cbde; padding: 2px; background: #171a21;">
            <img src="${profilePic}" style="width:100%; height:100%;" />
          </div>
          <div class="friends-profile-info">
            <div class="friends-name" style="font-size: 14px; font-weight: 700; color: #57cbde;">${username}</div>
            <div class="friends-status" style="font-size: 12px; color: #66c0f4;">Online</div>
          </div>
        </div>
        <div class="friends-search-bar" style="padding: 10px 15px; display: flex; align-items: center; gap: 10px; background: rgba(0,0,0,0.1);">
          <span class="friends-title" style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #b8b6b4; white-space: nowrap;">Friends</span>
          <input type="text" class="friends-search-input" placeholder="Search" style="flex: 1; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 4px 8px; color: #fff; font-size: 11px; outline: none;" />
        </div>
        <div class="friends-list-content" style="flex: 1; overflow-y: auto; padding: 10px 0;">
          <div class="friend-item" style="padding: 8px 15px; display: flex; align-items: center; gap: 10px; cursor: pointer;">
            <div class="friend-avatar" style="width: 32px; height: 32px; background: #57cbde; border: 1px solid rgba(255,255,255,0.2);"></div>
            <div class="friend-info">
              <span class="friend-name" style="font-size: 13px; color: #57cbde;">Gabe Newell</span>
              <span class="friend-status-text" style="font-size: 11px; color: #898989;">In-game: Half-Life 3</span>
            </div>
          </div>
        </div>
      </div>
    `;

    desktop.appendChild(win);
    wm.makeDraggable(win);
    wm.makeResizable(win);
    wm.setupWindowControls(win);
    wm.bringToFront(win);
  }
}

export class steamAppRenderer extends GameWindowRenderer {
  getGames() {
    if (this._gamesCache) return this._gamesCache;
    this._gamesCache = Object.entries(appMap)
      .filter(([id, data]) => {
        if (data.type === "system") return false;
        if (GAMES_APP_EXCLUDED.has(id)) return false;
        if (!data.icon || !data.title) return false;
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
    return Object.entries(targetMap)
      .filter(([id, data]) => data.type === "system" && data.icon && data.title)
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

    updateCount(allCards.length);
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
        updateCount(visibleCount);
      });
    }
  }
}

function updateCount(count) {
  count = count + 2588;
  const countEl = document.querySelector(".games-app-count");
  if (countEl) countEl.textContent = count;
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
