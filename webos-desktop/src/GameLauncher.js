import { sendLaunchAnalytics, getAnalyticsBase } from "./analytics.js";
import { CDN_CONFIG } from "./shared/cdnConfig.js";
import { lazyImg, observeLazyImages, SteamDataManager, _launcher } from "./games.js";
import { SteamSettings } from "./steam.js";

export class GameLauncher {
  constructor(renderer) {
    this.renderer = renderer;
  }

  setCurrentGame(appId) {
    this.renderer.currentGame = appId;
    this.renderer.currentArchiveGame = null;
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
    } else {
      console.error("No launcher available to open game.");
    }
  }

  closeGame() {}

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
    return `${CDN_CONFIG.repos.games.archiveBase}/archive/`;
  }

  _appendArchiveGameToSidebar(container, archiveGame, onLaunch) {
    const sidebarList = container.querySelector(".sidebar-game-list");
    if (!sidebarList) return;

    const existing = sidebarList.querySelector(`.sidebar-game-item[data-app="${archiveGame.appId}"]`);
    if (existing) return;

    const item = this.renderer._makeSidebarItem(archiveGame, container, onLaunch, true);
    item.classList.add("sidebar-archive-item");
    sidebarList.appendChild(item);
    observeLazyImages(item);
  }

  async _loadArchiveSection(container, onLaunch, collapsed) {
    const target = container.querySelector(".steam-library-page");
    if (!target) return;

    const settings = SteamSettings.load();
    if (settings.hideArchiveGames) return;

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

      this.renderer._archiveGamesCache = allGames.map((game) => {
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

      const CHUNK = 50;
      let archiveIndex = 0;

      const renderArchiveChunk = (deadline) => {
        while (
          archiveIndex < this.renderer._archiveGamesCache.length &&
          (deadline ? deadline.timeRemaining() > 2 : true)
        ) {
          const end = Math.min(archiveIndex + CHUNK, this.renderer._archiveGamesCache.length);
          for (let i = archiveIndex; i < end; i++) {
            this._appendArchiveGameToSidebar(container, this.renderer._archiveGamesCache[i], onLaunch);
          }
          archiveIndex = end;
          if (!deadline) break;
        }
        if (archiveIndex < this.renderer._archiveGamesCache.length) {
          requestIdleCallback(renderArchiveChunk, { timeout: 200 });
        }
      };

      requestIdleCallback(renderArchiveChunk, { timeout: 100 });

      const cards = this.renderer._archiveGamesCache
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
          this.renderer.gameRenderer.renderArchiveGameOverview(container, archiveGame, onLaunch);
        });

        card.addEventListener("dblclick", async () => {
          await this.showGameOverlay(cardTitle, cardUrl);
        });

        card.oncontextmenu = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.renderer.gameUI.showContextMenu(e, appId, container, () => this.showGameOverlay(cardTitle, cardUrl));
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
      placeholder.innerHTML = `<div style="color:#898989;font-size:13px;padding:10px 0;">Failed to load archive games.</div>`;
    }
  }
}
