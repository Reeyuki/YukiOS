import {
  sendLaunchAnalytics,
  getAnalyticsBase,
  fetchGamePlayCounts,
  getCachedPlayCounts,
} from "../analytics.js";
import { gameMatchesTag } from "./gameTags.js";
import { CDN_CONFIG } from "../shared/cdnConfig.js";
import {
  lazyImg,
  observeLazyImages,
  SteamDataManager,
  launcher,
  steamAudio,
} from "./games.js";
import { SteamSettings } from "./steamSettings.js";
import { os } from "../framework.js";
import { $, $$, createElement, setText } from "../shared/domUtils.js";

let luminFsSyncBound = false;

const toggleLuminFullscreen = (container) => {
  if (!container) return;
  try {
    if (
      document.fullscreenElement === container ||
      document.webkitFullscreenElement === container
    ) {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    } else if (container.requestFullscreen) {
      container.requestFullscreen();
    } else if (container.webkitRequestFullscreen) {
      container.webkitRequestFullscreen();
    }
  } catch {}
};

const syncLuminFullscreenState = () => {
  const btn = $(".steam-luminsdk-fullscreen-btn");
  if (!btn) return;
  const content = btn.closest(".steam-luminsdk-container");
  const active =
    !!content &&
    (document.fullscreenElement === content ||
      document.webkitFullscreenElement === content);
  const icon = $(".steam-luminsdk-fullscreen-icon", btn);
  const label = $(".steam-luminsdk-fullscreen-label", btn);
  if (icon)
    icon.className = active
      ? "fas fa-compress steam-luminsdk-fullscreen-icon"
      : "fas fa-expand steam-luminsdk-fullscreen-icon";
  if (label) setText(label, active ? "Exit Fullscreen" : "Fullscreen");
};

const bindLuminFullscreenSync = () => {
  if (luminFsSyncBound) return;
  luminFsSyncBound = true;
  document.addEventListener("fullscreenchange", syncLuminFullscreenState);
  document.addEventListener("webkitfullscreenchange", syncLuminFullscreenState);
};

export class GameLauncher {
  constructor(renderer) {
    this.renderer = renderer;
    this.playCounts = getCachedPlayCounts();
  }

  loadPlayCounts() {
    fetchGamePlayCounts().then((counts) => {
      this.playCounts = counts;
      this.updateAllBadges();
    });
  }

  updateAllBadges() {
    $$(".steam-play-count-badge").forEach((badge) => {
      const card = badge.closest(".steam-game-card");
      if (card) {
        const appId = card.dataset.app.toLowerCase().trim();
        badge.textContent = this.playCounts[appId] || 0;
      }
    });
  }

  setCurrentGame(appId) {
    this.renderer.currentGame = appId;
    this.renderer.currentArchiveGame = null;
  }

  closeGame() {}

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

    if (launcher) {
      launcher.openIframeApp({
        appId: gameId,
        type: "game",
        source: url,
        originalName: title,
        analyticsBase,
        isArchive: true,
      });
    } else {
      console.error("No launcher available to open game.");
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

  archiveGameId(url) {
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
    return `${CDN_CONFIG.repos.games.archiveBase}/archive/`;
  }

  appendArchiveGameToSidebar(container, archiveGame, onLaunch) {
    const sidebarList = container.querySelector(".sidebar-game-list");
    if (!sidebarList) return;

    const existing = sidebarList.querySelector(
      `.sidebar-game-item[data-app="${archiveGame.appId}"]`,
    );
    if (existing) return;

    const item = this.renderer.makeSidebarItem(
      archiveGame,
      container,
      onLaunch,
      true,
    );
    item.classList.add("sidebar-archive-item");
    sidebarList.appendChild(item);
    observeLazyImages(item);
  }

  async loadArchiveSection(container, onLaunch, collapsed) {
    this.loadPlayCounts();

    const target = container.querySelector(".steam-library-page");
    if (!target) return;

    const settings = SteamSettings.load();
    if (settings.hideArchiveGames) return;

    const sectionTitle = "All Games (Archive)";
    const sectionId = `steam-section-${sectionTitle.toLowerCase().replace(/\s+/g, "-")}`;
    const isExpanded = collapsed.includes(sectionTitle);
    const base = this.getArchiveBase();

    const yukiosContent = target.querySelector(".steam-yukios-content");
    if (!yukiosContent) return;

    const placeholder = createElement("div");
    placeholder.id = "archive-section-placeholder";
    placeholder.style.minHeight = "36px";
    placeholder.innerHTML = `
      <div class="steam-section-header" id="${sectionId}" data-title="${sectionTitle}" style="cursor: pointer; display: flex; align-items: center; gap: 10px;">
        <i class="fas fa-spinner fa-spin" style="font-size: 10px; color: var(--text-secondary);"></i>
        <div class="steam-section-title">${sectionTitle}</div>
        <div style="height: 1px; flex: 1; background: var(--glass); margin-left: 10px;"></div>
        <span style="font-size: 11px; color: var(--text-secondary); margin-left: 8px;">Loading...</span>
      </div>
    `;
    yukiosContent.appendChild(placeholder);

    try {
      const data = await this.fetchFirstJson([`${base}games.json`]);
      const allGames = Array.isArray(data) ? data : data?.games || [];

      this.renderer.archiveGamesCache = allGames.map((game) => {
        const name = this.formatArchiveName(game.name, game.url);
        const fullUrl = game.url.startsWith("http")
          ? game.url
          : base + game.url;
        const appId = this.archiveGameId(fullUrl);
        let thumb = game.thumbnail
          ? game.thumbnail.startsWith("http")
            ? game.thumbnail
            : base.replace(/\/$/, "") + "/" + game.thumbnail.replace(/^\//, "")
          : "";
        return { appId, title: name, url: fullUrl, thumb };
      });

      const activeTag = this.renderer.activeTag || "";
      const renderGames = activeTag
        ? this.renderer.archiveGamesCache.filter((g) =>
            gameMatchesTag(g, activeTag),
          )
        : this.renderer.archiveGamesCache;

      const archiveExpanded =
        isExpanded || (renderGames.length > 0 && Boolean(activeTag));

      const CHUNK = 50;
      let archiveIndex = 0;

      const renderArchiveChunk = (deadline) => {
        let hasBudget =
          !deadline || archiveIndex === 0 || deadline.timeRemaining() > 2;
        while (
          archiveIndex < this.renderer.archiveGamesCache.length &&
          hasBudget
        ) {
          const end = Math.min(
            archiveIndex + CHUNK,
            this.renderer.archiveGamesCache.length,
          );
          for (let i = archiveIndex; i < end; i++) {
            this.appendArchiveGameToSidebar(
              container,
              this.renderer.archiveGamesCache[i],
              onLaunch,
            );
          }
          archiveIndex = end;
          if (!deadline) break;
          hasBudget = deadline.timeRemaining() > 2;
        }
        if (archiveIndex < this.renderer.archiveGamesCache.length) {
          requestIdleCallback(renderArchiveChunk, { timeout: 200 });
        }
      };

      renderArchiveChunk();

      placeholder.innerHTML = `
        <div class="steam-section-header" id="${sectionId}" data-title="${sectionTitle}" style="cursor: pointer; display: flex; align-items: center; gap: 10px;">
          <i class="fas ${isExpanded ? "fa-chevron-down" : "fa-chevron-right"}" style="font-size: 10px; color: var(--text-secondary);"></i>
          <div class="steam-section-title">${sectionTitle}</div>
          <div style="height: 1px; flex: 1; background: var(--glass); margin-left: 10px;"></div>
          <span style="font-size: 11px; color: var(--text-secondary); margin-left: 8px;">${renderGames.length} games</span>
        </div>
        <div class="steam-game-grid steam-archive-grid" style="display: ${archiveExpanded ? "grid" : "none"}"></div>
      `;

      const gridEl = placeholder.querySelector(".steam-archive-grid");
      if (archiveExpanded && gridEl) {
        gridEl.style.display = "grid";
      }
      const CARD_CHUNK = 40;
      let gridIndex = 0;
      const renderChunk = (deadline) => {
        let hasBudget =
          !deadline || gridIndex === 0 || deadline.timeRemaining() > 1;
        while (gridIndex < renderGames.length && hasBudget) {
          const end = Math.min(gridIndex + CARD_CHUNK, renderGames.length);
          const tmp = document.createElement("div");
          tmp.innerHTML = renderGames
            .slice(gridIndex, end)
            .map(({ appId, title, url: fullUrl, thumb }) => {
              const normalizedApp = appId.toLowerCase().trim();
              const playCount = this.playCounts[normalizedApp] || 0;
              return `
          <div class="steam-game-card steam-archive-card" data-app="${appId}" data-url="${fullUrl}" title="${title}">
            <div class="steam-game-img-wrap">
              ${
                thumb
                  ? lazyImg(
                      thumb,
                      `alt="${title}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML='<div style=\\'width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--bg-secondary);color:var(--text-secondary);\\'><i class=\\'fas fa-gamepad\\' style=\\'font-size:40px;\\'></i></div>'"`,
                    )
                  : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--bg-secondary);color:var(--text-secondary);"><i class="fas fa-gamepad" style="font-size:40px;"></i></div>`
              }
              <div class="steam-play-count-badge">${playCount}</div>
            </div>
            <div class="steam-game-title">${title}</div>
          </div>`;
            })
            .join("");
          gridEl.append(...tmp.children);
          observeLazyImages(gridEl);
          gridIndex = end;
          if (!deadline) break;
          hasBudget = deadline.timeRemaining() > 1;
        }
        if (gridIndex < renderGames.length) {
          requestIdleCallback(renderChunk, { timeout: 500 });
        }
      };
      if (archiveExpanded && gridEl) {
        requestIdleCallback(renderChunk, { timeout: 500 });
      }

      placeholder.querySelector(".steam-section-header").onclick = () => {
        SteamDataManager.toggleCollapsed(sectionTitle);
        const grid = placeholder.querySelector(".steam-archive-grid");
        const icon = placeholder.querySelector(".steam-section-header i");
        const nowExpanded =
          SteamDataManager.getCollapsed().includes(sectionTitle);
        grid.style.display = nowExpanded ? "grid" : "none";
        if (nowExpanded && grid.children.length === 0) {
          requestIdleCallback(renderChunk, { timeout: 500 });
        }
        if (icon) {
          icon.className = `fas ${nowExpanded ? "fa-chevron-down" : "fa-chevron-right"}`;
          icon.style.cssText = "font-size: 10px; color: var(--text-secondary);";
        }
      };
    } catch (err) {
      console.error("Archive load failed:", err);
      placeholder.innerHTML = `<div style="color:var(--text-secondary);font-size:13px;padding:10px 0;">Failed to load archive games.</div>`;
    }
  }

  loadLuminSDKSection(container, collapsed) {
    const target = container.querySelector(".steam-library-page");
    if (!target) return;

    const settings = SteamSettings.load();
    if (settings.hideLuminSDK) return;

    const sectionTitle = "LuminSDK Games";
    const sectionId = `steam-section-${sectionTitle.toLowerCase().replace(/\s+/g, "-")}`;
    const isExpanded = collapsed.includes(sectionTitle);

    const yukiosContent = target.querySelector(".steam-yukios-content");
    if (!yukiosContent) return;

    const placeholder = createElement("div");
    placeholder.id = "luminsdk-section-placeholder";
    placeholder.innerHTML = `
      <div class="steam-section-header" id="${sectionId}" data-title="${sectionTitle}" style="cursor: pointer; display: flex; align-items: center; gap: 10px;">
        <i class="fas ${isExpanded ? "fa-chevron-down" : "fa-chevron-right"}" style="font-size: 10px; color: var(--text-secondary);"></i>
        <div class="steam-section-title">${sectionTitle}</div>
        <div style="height: 1px; flex: 1; background: var(--glass); margin-left: 10px;"></div>
      </div>
      <div class="steam-luminsdk-container" style="display: ${isExpanded ? "block" : "none"}; padding: 20px 0;">
        <div class="steam-luminsdk-toolbar">
          <button class="steam-luminsdk-fullscreen-btn" type="button">
            <i class="fas fa-expand steam-luminsdk-fullscreen-icon"></i>
            <span class="steam-luminsdk-fullscreen-label">Fullscreen</span>
          </button>
        </div>
        <iframe id="luminsdk-iframe" allowfullscreen class="steam-luminsdk-iframe"></iframe>
      </div>
    `;
    yukiosContent.appendChild(placeholder);

    const iframe = placeholder.querySelector("#luminsdk-iframe");
    if (iframe) {
      iframe.onload = () => {
        if (!iframe.contentWindow) return;
        const iframeDoc =
          iframe.contentDocument || iframe.contentWindow.document;
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
            <script src="https://gcore.jsdelivr.net/gh/luminsdk/script@latest/lumin.min.js"><\/script>
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

    placeholder.querySelector(".steam-section-header").onclick = () => {
      SteamDataManager.toggleCollapsed(sectionTitle);
      const content = placeholder.querySelector(".steam-luminsdk-container");
      const icon = placeholder.querySelector(".steam-section-header i");
      const nowExpanded =
        SteamDataManager.getCollapsed().includes(sectionTitle);
      content.style.display = nowExpanded ? "block" : "none";
      if (icon) {
        icon.className = `fas ${nowExpanded ? "fa-chevron-down" : "fa-chevron-right"}`;
        icon.style.cssText = "font-size: 10px; color: var(--text-secondary);";
      }
    };

    const fullscreenBtn = $(".steam-luminsdk-fullscreen-btn", placeholder);
    if (fullscreenBtn) {
      fullscreenBtn.onclick = () =>
        toggleLuminFullscreen($(".steam-luminsdk-container", placeholder));
    }
    bindLuminFullscreenSync();
  }
}
