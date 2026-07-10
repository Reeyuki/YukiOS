import { HIGHLIGHTED_GAMES } from "./games.js";
import { SteamDataManager } from "./games.js";
import { popularityMap } from "./games.js";
import { SteamSettings } from "./steam.js";
import { lazyImg, observeLazyImages } from "./games.js";
import { fetchGamePlayCounts, getCachedPlayCounts } from "../analytics.js";
import { $, $$ } from "../shared/domUtils.js";

export class GameRenderer {
  constructor(renderer) {
    this.renderer = renderer;
    this.playCounts = getCachedPlayCounts();
  }

  loadPlayCounts() {
    fetchGamePlayCounts().then((counts) => {
      const previousCounts = this.playCounts;
      this.playCounts = counts;
      this.updateAllBadges();
      if (this.renderer.sortBy === "popularity" && Object.keys(previousCounts).length === 0) {
        const container = $(".steam-library-page");
        if (container) {
          const onLaunch = (appId) => this.renderer.launch(appId);
          this.renderGrid(container, onLaunch, this.renderer.focusCollection);
        }
      }
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

  createCard(game) {
    const isHighlighted = HIGHLIGHTED_GAMES.has(game.app);
    const normalizedApp = game.app.toLowerCase().trim();
    const playCount = this.playCounts[normalizedApp] || 0;

    return `
    <div class="steam-game-card ${isHighlighted ? "steam-game-card-highlight" : ""}" data-app="${game.app}">
      <div class="steam-game-img-wrap">
        ${lazyImg(game.icon, `alt="${game.title}"`)}

        ${
          isHighlighted
            ? `
          <div class="steam-reeyuki-badge">
            <i class="fas fa-bolt"></i>
          </div>
        `
            : ""
        }
        <div class="steam-play-count-badge">${playCount}</div>
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

  getSortedGames(games, sortBy, sortReverse) {
    const stats = SteamDataManager.getStats();
    let sorted = [...games];
    sorted.sort((a, b) => {
      let valA, valB;
      if (sortBy === "alphabetical") {
        valA = a.title.toLowerCase();
        valB = b.title.toLowerCase();
      } else if (sortBy === "hours") {
        valA = stats[a.app]?.totalMin || 0;
        valB = stats[b.app]?.totalMin || 0;
      } else if (sortBy === "lastPlayed") {
        valA = stats[a.app]?.lastPlayed || 0;
        valB = stats[b.app]?.lastPlayed || 0;
      } else if (sortBy === "relevant") {
        valA = popularityMap.get(a.app) ?? 999999;
        valB = popularityMap.get(b.app) ?? 999999;
      } else if (sortBy === "popularity") {
        const normalizedAppA = a.app.toLowerCase().trim();
        const normalizedAppB = b.app.toLowerCase().trim();
        valA = this.playCounts[normalizedAppA] || 0;
        valB = this.playCounts[normalizedAppB] || 0;
        const effectiveReverse = !sortReverse;
        if (valA < valB) return effectiveReverse ? 1 : -1;
        if (valA > valB) return effectiveReverse ? -1 : 1;
        return 0;
      }
      if (valA < valB) return sortReverse ? 1 : -1;
      if (valA > valB) return sortReverse ? -1 : 1;
      return 0;
    });
    return sorted;
  }

  renderGameOverview(container, appId, onLaunch) {
    const game = this.renderer.getGames().find((g) => g.app === appId);
    if (!game) return;

    this.renderer.currentGame = appId;
    this.renderer.currentArchiveGame = null;

    const stats = SteamDataManager.getStats();
    const gameStats = stats[appId] || { totalMin: 0, lastPlayed: 0 };
    const target = container.querySelector(".steam-library-page");
    const mainContent = container.querySelector(".steam-main-content");
    if (mainContent) mainContent.scrollTop = 0;

    target.innerHTML = `
    <div class="steam-game-overview" style="background: var(--bg-secondary); min-height: 100%; color: var(--text-primary); display: flex; flex-direction: column;">
      <div class="overview-banner" style="height: 300px; position: relative; overflow: hidden; background: var(--bg-base);">
        <img src="${game.icon}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.4;" />

        <div class="banner-content" style="position: absolute; bottom: 0; left: 0; right: 0; padding: 40px; background: linear-gradient(transparent, var(--bg-secondary)); display: flex; align-items: flex-end; gap: 30px;">
          
          <img src="${game.icon}" style="width: 200px; height: 280px; object-fit: cover; border-radius: 4px; box-shadow: 0 10px 30px var(--overlay-bg);" />

          <div class="banner-info" style="flex: 1;">
            
            <h1 style="font-size: 48px; margin: 0 0 6px 0; color: var(--text-primary); text-shadow: 0 2px 10px var(--overlay-bg); font-family: 'Motiva Sans', Sans-serif;">
              ${game.title}
            </h1>

            ${this.getReeyukiBadge(game)}

            <div class="play-bar" style="display: flex; align-items: center; gap: 20px;">
              <button class="steam-play-btn" style="background: var(--charging); border: none; color: var(--text-primary); padding: 12px 60px; font-size: 20px; font-weight: 700; border-radius: 2px; cursor: pointer; text-transform: uppercase; box-shadow: 0 4px 15px var(--overlay-bg);">
                Play
              </button>

              <div class="overview-stats" style="display: flex; gap: 30px; font-size: 13px; color: var(--text-secondary);">
                <div>
                  <div style="text-transform: uppercase; margin-bottom: 4px;">Last Played</div>
                  <div style="color: var(--text-primary);">
                    ${gameStats.lastPlayed ? new Date(gameStats.lastPlayed).toLocaleDateString() : "Never"}
                  </div>
                </div>

                <div>
                  <div style="text-transform: uppercase; margin-bottom: 4px;">Play Time</div>
                  <div style="color: var(--text-primary);">
                    ${this.formatTime(gameStats.totalMin)}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      <div class="overview-content" style="padding: 40px; display: grid; grid-template-columns: 2fr 1fr; gap: 40px;">
        <div class="overview-main">
          <div style="background: var(--surface-1); padding: 20px; border-radius: 4px; margin-bottom: 20px;">
            <h3 style="margin-top: 0; color: var(--brand); text-transform: uppercase; font-size: 14px;">Game Info</h3>
            <p style="line-height: 1.6; color: var(--text-muted);">
              ${this.renderer.getGameDescription(game.app)}
            </p>
          </div>

          <div class="steam-whats-new-header" style="margin-bottom: 15px;">Recent Activity</div>
          <div style="color: var(--text-secondary); font-style: italic; font-size: 13px;">No recent activity to show.</div>
        </div>

        <div class="overview-sidebar">
          <div style="background: var(--surface-1); padding: 20px; border-radius: 4px;">
            <h3 style="margin-top: 0; color: var(--text-primary); font-size: 14px; text-transform: uppercase;">Friends who play</h3>
            <div style="color: var(--text-secondary); font-size: 13px;">None of your friends have played this game.</div>
          </div>
        </div>
      </div>
    </div>
  `;

    this.injectReeyukiStyle(target);

    target.querySelector(".steam-play-btn").onclick = () => onLaunch(appId);
    this.renderer.setActiveSidebarItem(container, appId);
  }

  renderArchiveGameOverview(container, archiveGame, onLaunch) {
    this.renderer.currentGame = null;
    this.renderer.currentArchiveGame = archiveGame;

    const stats = SteamDataManager.getStats();
    const gameStats = stats[archiveGame.appId] || { totalMin: 0, lastPlayed: 0 };
    const target = container.querySelector(".steam-library-page");
    const thumb = archiveGame.thumb || "";

    target.innerHTML = `
      <div class="steam-game-overview" style="background: var(--bg-secondary); min-height: 100%; color: var(--text-primary); display: flex; flex-direction: column;">
        <div class="overview-banner" style="height: 300px; position: relative; overflow: hidden; background: var(--bg-base);">
          ${thumb ? `<img src="${thumb}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.4; " />` : ""}
          <div class="banner-content" style="position: absolute; bottom: 0; left: 0; right: 0; padding: 40px; background: linear-gradient(transparent, var(--bg-secondary)); display: flex; align-items: flex-end; gap: 30px;">
            ${
              thumb
                ? `<img src="${thumb}" style="width: 200px; height: 280px; object-fit: cover; border-radius: 4px; box-shadow: 0 10px 30px var(--overlay-bg);" />`
                : `<div style="width:200px;height:280px;background:var(--bg-secondary);border-radius:4px;display:flex;align-items:center;justify-content:center;"><i class="fas fa-gamepad" style="font-size:60px;color:var(--text-secondary);"></i></div>`
            }
            <div class="banner-info" style="flex: 1;">
              <h1 style="font-size: 48px; margin: 0 0 10px 0; color: var(--text-primary); text-shadow: 0 2px 10px var(--overlay-bg); font-family: 'Motiva Sans', Sans-serif;">${archiveGame.title}</h1>
              <div class="play-bar" style="display: flex; align-items: center; gap: 20px;">
                <button class="steam-play-btn" style="background: var(--charging); border: none; color: var(--text-primary); padding: 12px 60px; font-size: 20px; font-weight: 700; border-radius: 2px; cursor: pointer; text-transform: uppercase; box-shadow: 0 4px 15px var(--overlay-bg);">Play</button>
                <div class="overview-stats" style="display: flex; gap: 30px; font-size: 13px; color: var(--text-secondary);">
                  <div>
                    <div style="text-transform: uppercase; margin-bottom: 4px;">Last Played</div>
                    <div style="color: var(--text-primary);">${gameStats.lastPlayed ? new Date(gameStats.lastPlayed).toLocaleDateString() : "Never"}</div>
                  </div>
                  <div>
                    <div style="text-transform: uppercase; margin-bottom: 4px;">Play Time</div>
                    <div style="color: var(--text-primary);">${this.formatTime(gameStats.totalMin)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="overview-content" style="padding: 40px; display: grid; grid-template-columns: 2fr 1fr; gap: 40px;">
          <div class="overview-main">
            <div style="background: var(--surface-1); padding: 20px; border-radius: 4px; margin-bottom: 20px;">
              <h3 style="margin-top: 0; color: var(--brand); text-transform: uppercase; font-size: 14px;">Game Info</h3>
              <p style="line-height: 1.6; color: var(--text-muted);">Experience ${archiveGame.title} on YukiOS. This game is part of the archive collection.</p>
            </div>
            <div class="steam-whats-new-header" style="margin-bottom: 15px;">Recent Activity</div>
            <div style="color: var(--text-secondary); font-style: italic; font-size: 13px;">No recent activity to show.</div>
          </div>
          <div class="overview-sidebar">
             <div style="background: var(--surface-1); padding: 20px; border-radius: 4px;">
               <h3 style="margin-top: 0; color: var(--text-primary); font-size: 14px; text-transform: uppercase;">Friends who play</h3>
               <div style="color: var(--text-secondary); font-size: 13px;">None of your friends have played this game.</div>
             </div>
          </div>
        </div>
      </div>
    `;

    target.querySelector(".steam-play-btn").onclick = () =>
      this.renderer.showGameOverlay(archiveGame.title, archiveGame.url);
    this.renderer.setActiveSidebarItem(container, archiveGame.appId);
  }

  renderGrid(container, onLaunch, focusCollection = null) {
    this.loadPlayCounts();

    if (this.renderer.currentArchiveGame) {
      this.renderArchiveGameOverview(container, this.renderer.currentArchiveGame, onLaunch);
      return;
    }
    if (this.renderer.currentGame) {
      this.renderGameOverview(container, this.renderer.currentGame, onLaunch);
      return;
    }
    const allGames = this.renderer.getGames();
    const stats = SteamDataManager.getStats();
    const favorites = SteamDataManager.getFavorites();
    const collections = SteamDataManager.getCollections();
    const hidden = SteamDataManager.getHidden();
    const collapsed = SteamDataManager.getCollapsed();

    const filteredGames = allGames.filter((g) => !hidden.includes(g.app));
    const sortedGames = this.getSortedGames(filteredGames, this.renderer.sortBy, this.renderer.sortReverse);

    const settings = SteamSettings.load();
    const showRecent = settings.recentlyPlayedRow !== false;

    const recentGames = showRecent
      ? filteredGames
          .filter((g) => stats[g.app]?.lastPlayed)
          .sort((a, b) => stats[b.app].lastPlayed - stats[a.app].lastPlayed)
          .slice(0, 5)
      : [];

    const target = container.querySelector(".steam-library-page");
    if (!target) return;

    const isNewsExpanded = collapsed.includes("What's New");

    const shellHtml = `
      <div class="steam-grid-controls-bar" style="margin-bottom: 20px; display: flex; justify-content: flex-end; align-items: center; gap: 15px;">
        <div class="steam-grid-filters" style="display: flex; align-items: center; gap: 15px;">
          <span class="steam-control-label">Sort by</span>
          <select class="steam-sort-select">
            <option value="relevant" ${this.renderer.sortBy === "relevant" ? "selected" : ""}>Relevant</option>
            <option value="popularity" ${this.renderer.sortBy === "popularity" ? "selected" : ""}>Popularity</option>
            <option value="alphabetical" ${this.renderer.sortBy === "alphabetical" ? "selected" : ""}>Alphabetical</option>
            <option value="hours" ${this.renderer.sortBy === "hours" ? "selected" : ""}>Hours Played</option>
            <option value="lastPlayed" ${this.renderer.sortBy === "lastPlayed" ? "selected" : ""}>Last Played</option>
          </select>
          <button class="steam-sort-order-btn">
            <i class="fas ${this.renderer.sortReverse ? "fa-sort-amount-up" : "fa-sort-amount-down"}"></i>
          </button>
        </div>
      </div>
      <div class="steam-yukios-content">
        <div class="steam-whats-new">
          <div class="steam-whats-new-header steam-section-header" data-title="What's New" style="cursor: pointer; display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
            <i class="fas ${isNewsExpanded ? "fa-chevron-down" : "fa-chevron-right"}" style="font-size: 10px; color: var(--text-secondary);"></i>
            <div class="steam-section-title">What's New</div>
            <div style="height: 1px; flex: 1; background: var(--glass); margin-left: 10px;"></div>
          </div>
          <div class="steam-whats-new-list" style="display: ${isNewsExpanded ? "flex" : "none"}">
            ${this.renderer.newsItems
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
      const isExpanded = collapsed.includes(title);
      const wrapper = document.createElement("div");
      wrapper.dataset.sectionWrapper = title;
      wrapper.innerHTML = `
        <div class="steam-section-header" id="${sectionId}" data-title="${title}" style="cursor: pointer; display: flex; align-items: center; gap: 10px;">
          <i class="fas ${isExpanded ? "fa-chevron-down" : "fa-chevron-right"}" style="font-size: 10px; color: var(--text-secondary);"></i>
          <div class="steam-section-title">${title}</div>
          <div style="height: 1px; flex: 1; background: var(--glass); margin-left: 10px;"></div>
        </div>
        <div class="steam-game-grid" data-section="${title}" style="display: ${isExpanded ? "grid" : "none"}"></div>
      `;
      sectionsHost.appendChild(wrapper);

      if (isExpanded) {
        this.fillGridLazy(wrapper.querySelector(".steam-game-grid"), games);
      }
    });

    sectionsHost.appendChild(document.createComment("archive-placeholder"));
    this.renderer.loadArchiveSection(container, onLaunch, collapsed);
    this.renderer.loadLuminSDKSection(container, collapsed);

    const sidebar = container.querySelector(".steam-library-sidebar");
    const mainContent = container.querySelector(".steam-main-content");

    if (container.querySelector(".steam-tab[data-page='library']").classList.contains("active")) {
      sidebar.classList.remove("hidden");
    }
    if (target) target.style.height = "auto";
    if (mainContent) {
      mainContent.style.padding = this.renderer.currentGame ? "0" : "20px";
      mainContent.style.overflowY = "auto";
    }

    this.renderer.attachGridDelegation(container, onLaunch);

    const sortSelect = target.querySelector(".steam-sort-select");
    const sortBtn = target.querySelector(".steam-sort-order-btn");
    if (sortSelect) {
      sortSelect.addEventListener("change", () => {
        this.renderer.sortBy = sortSelect.value;
        this.renderGrid(container, onLaunch, focusCollection);
      });
    }
    if (sortBtn) {
      sortBtn.addEventListener("click", () => {
        this.renderer.sortReverse = !this.renderer.sortReverse;
        this.renderGrid(container, onLaunch, focusCollection);
      });
    }

    if (this.renderer.currentGame) this.renderer.setActiveSidebarItem(container, this.renderer.currentGame);
    else if (this.renderer.currentArchiveGame)
      this.renderer.setActiveSidebarItem(container, this.renderer.currentArchiveGame.appId);

    target.querySelectorAll(".steam-section-header").forEach((header) => {
      header.onclick = () => {
        SteamDataManager.toggleCollapsed(header.dataset.title);
        this.renderGrid(container, onLaunch, focusCollection);
      };
    });
  }
  getReeyukiBadge(game) {
    if (!HIGHLIGHTED_GAMES.has(game.app)) return "";

    return `
    <div class="reeyuki-runtime-header">
      ✨ Reeyuki Web Port ✨
    </div>
  `;
  }

  injectReeyukiStyle(target) {
    const style = document.createElement("style");
    style.textContent = `
      .reeyuki-runtime-header {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin: 6px 0 18px 0;
        padding: 4px 10px;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.8px;
        text-transform: uppercase;
        color: var(--brand);
        background: var(--brand-dim);
        border: 1px solid var(--brand-glow);
        border-radius: 2px;
        width: fit-content;
      }
    `;
    target.appendChild(style);
  }

  fillGridLazy(grid, games) {
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
}
