import { sendLaunchAnalytics, getAnalyticsBase, fetchGamePlayCounts, getCachedPlayCounts } from "../analytics.js";
import { CDN_CONFIG } from "../shared/cdnConfig.js";
import { lazyImg, observeLazyImages, SteamDataManager, launcher, steamAudio } from "./games.js";
import { SteamSettings } from "./steam.js";
import { os } from "../framework.js";
import { $$ } from "../shared/domUtils.js";

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
      launcher.openIframeApp({ appId: gameId, type: "game", source: url, originalName: title, analyticsBase });
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

    const existing = sidebarList.querySelector(`.sidebar-game-item[data-app="${archiveGame.appId}"]`);
    if (existing) return;

    const item = this.renderer.makeSidebarItem(archiveGame, container, onLaunch, true);
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

    const placeholder = document.createElement("div");
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
        const fullUrl = game.url.startsWith("http") ? game.url : base + game.url;
        const appId = this.archiveGameId(fullUrl);
        let thumb = game.thumbnail
          ? game.thumbnail.startsWith("http")
            ? game.thumbnail
            : base.replace(/\/$/, "") + "/" + game.thumbnail.replace(/^\//, "")
          : "";
        return { appId, title: name, url: fullUrl, thumb };
      });

      const CHUNK = 50;
      let archiveIndex = 0;

      const renderArchiveChunk = (deadline) => {
        while (
          archiveIndex < this.renderer.archiveGamesCache.length &&
          (deadline ? deadline.timeRemaining() > 2 : true)
        ) {
          const end = Math.min(archiveIndex + CHUNK, this.renderer.archiveGamesCache.length);
          for (let i = archiveIndex; i < end; i++) {
            this.appendArchiveGameToSidebar(container, this.renderer.archiveGamesCache[i], onLaunch);
          }
          archiveIndex = end;
          if (!deadline) break;
        }
        if (archiveIndex < this.renderer.archiveGamesCache.length) {
          requestIdleCallback(renderArchiveChunk, { timeout: 200 });
        }
      };

      requestIdleCallback(renderArchiveChunk, { timeout: 100 });

      const cards = this.renderer.archiveGamesCache
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
                      `alt="${title}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML='<div style=\\'width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--bg-secondary);color:var(--text-secondary);\\'><i class=\\'fas fa-gamepad\\' style=\\'font-size:40px;\\'></i></div>'"`
                    )
                  : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--bg-secondary);color:var(--text-secondary);"><i class="fas fa-gamepad" style="font-size:40px;"></i></div>`
              }
              <div class="steam-play-count-badge">${playCount}</div>
            </div>
            <div class="steam-game-title">${title}</div>
          </div>`;
        })
        .join("");

      placeholder.innerHTML = `
        <div class="steam-section-header" id="${sectionId}" data-title="${sectionTitle}" style="cursor: pointer; display: flex; align-items: center; gap: 10px;">
          <i class="fas ${isExpanded ? "fa-chevron-down" : "fa-chevron-right"}" style="font-size: 10px; color: var(--text-secondary);"></i>
          <div class="steam-section-title">${sectionTitle}</div>
          <div style="height: 1px; flex: 1; background: var(--glass); margin-left: 10px;"></div>
          <span style="font-size: 11px; color: var(--text-secondary); margin-left: 8px;">${allGames.length} games</span>
        </div>
        <div class="steam-game-grid steam-archive-grid" style="display: ${isExpanded ? "grid" : "none"}">
          ${cards}
        </div>
      `;

      observeLazyImages(placeholder);

      placeholder.querySelector(".steam-section-header").onclick = () => {
        SteamDataManager.toggleCollapsed(sectionTitle);
        const grid = placeholder.querySelector(".steam-archive-grid");
        const icon = placeholder.querySelector(".steam-section-header i");
        const nowExpanded = SteamDataManager.getCollapsed().includes(sectionTitle);
        grid.style.display = nowExpanded ? "grid" : "none";
        if (icon) {
          icon.className = `fas ${nowExpanded ? "fa-chevron-down" : "fa-chevron-right"}`;
          icon.style.cssText = "font-size: 10px; color: var(--text-secondary);";
        }
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
          steamAudio.playSelect();
          this.renderer.gameRenderer.renderArchiveGameOverview(container, archiveGame, onLaunch);
        });

        card.addEventListener("dblclick", async () => {
          const gameId = cardUrl
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
          await os.app.launchGame(gameId, false, { source: cardUrl, originalName: cardTitle, analyticsBase });
        });

        card.oncontextmenu = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const gameId = cardUrl
            .split("?")[0]
            .replace(/\/index\.html$/, "")
            .replace(/\.html$/, "")
            .split("/")
            .filter(Boolean)
            .pop()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "");
          const analyticsBase = getAnalyticsBase(gameId);
          this.renderer.gameUI.showContextMenu(e, appId, container, () => {
            sendLaunchAnalytics(gameId);
            os.app.launchGame(gameId, false, { source: cardUrl, originalName: cardTitle, analyticsBase });
          });
        };

        card.addEventListener("mouseenter", () => {
          steamAudio.playHover();
          const rect = card.getBoundingClientRect();
          const gameStats = stats[appId] || { totalMin: 0, recentMin: 0 };

          popover.innerHTML = `
            <img class="popover-banner" src="${thumbImg}" />
            <div class="popover-content">
              <div class="popover-title">${cardTitle}</div>
              <div class="popover-stats">
                <div class="popover-stat-item">
                  <span class="popover-stat-label">Last two weeks:</span>
                  <span class="popover-stat-value">${this.renderer.gameRenderer.formatTime(gameStats.recentMin)}</span>
                </div>
                <div class="popover-stat-item">
                  <span class="popover-stat-label">Total played:</span>
                  <span class="popover-stat-value">${this.renderer.gameRenderer.formatTime(gameStats.totalMin)}</span>
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

    const placeholder = document.createElement("div");
    placeholder.id = "luminsdk-section-placeholder";
    placeholder.innerHTML = `
      <div class="steam-section-header" id="${sectionId}" data-title="${sectionTitle}" style="cursor: pointer; display: flex; align-items: center; gap: 10px;">
        <i class="fas ${isExpanded ? "fa-chevron-down" : "fa-chevron-right"}" style="font-size: 10px; color: var(--text-secondary);"></i>
        <div class="steam-section-title">${sectionTitle}</div>
        <div style="height: 1px; flex: 1; background: var(--glass); margin-left: 10px;"></div>
      </div>
      <div class="steam-luminsdk-container" style="display: ${isExpanded ? "block" : "none"}; padding: 20px 0;">
        <iframe id="luminsdk-iframe" style="width: 100%; height: 600px; border: none; background: var(--bg-secondary);"></iframe>
      </div>
    `;
    yukiosContent.appendChild(placeholder);

    const iframe = placeholder.querySelector("#luminsdk-iframe");
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

    placeholder.querySelector(".steam-section-header").onclick = () => {
      SteamDataManager.toggleCollapsed(sectionTitle);
      const content = placeholder.querySelector(".steam-luminsdk-container");
      const icon = placeholder.querySelector(".steam-section-header i");
      const nowExpanded = SteamDataManager.getCollapsed().includes(sectionTitle);
      content.style.display = nowExpanded ? "block" : "none";
      if (icon) {
        icon.className = `fas ${nowExpanded ? "fa-chevron-down" : "fa-chevron-right"}`;
        icon.style.cssText = "font-size: 10px; color: var(--text-secondary);";
      }
    };
  }
}
