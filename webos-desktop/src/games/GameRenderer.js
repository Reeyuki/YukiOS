import { HIGHLIGHTED_GAMES } from "./games.js";
import { SteamDataManager } from "./games.js";
import { popularityMap } from "./games.js";
import { SteamSettings } from "./steamSettings.js";
import { lazyImg, observeLazyImages } from "./games.js";
import { GAME_TAGS, gameMatchesTag } from "./gameTags.js";
import { os } from "../framework.js";
import { StorageKeys } from "../StorageKeys.js";
import { resolveIconHtml } from "../shared/iconUtils.js";
import { resolveIconUrl } from "../shared/assetResolver.js";
import { getEffectiveIcon } from "../shared/iconPack.js";
import { fetchGamePlayCounts, getCachedPlayCounts } from "../analytics.js";
import { $, $$, createElement, bindEvent } from "../shared/domUtils.js";
import {
  renderSelectMenu,
  bindSelectMenu,
  getSelectMenuValue,
  setSelectMenuValue,
} from "../shared/selectMenu.js";
import {
  injectAdsterraAd,
  injectNativeAd,
  suppressAdBlocks,
  ADSTERRA_KEYS,
} from "../ads.js";
import { formatGameActivityTime, escapeHtml as esc } from "../utils/utils.js";
import {
  achievementsPercent,
  fetchCommunityOverview,
  fetchActivityOverview,
  buildPlayerRows,
  buildFriendCards,
  buildAvatarStrip,
} from "./steamOverviewData.js";

const SORT_OPTIONS = [
  { value: "relevant", label: "Relevant" },
  { value: "popularity", label: "Popularity" },
  { value: "alphabetical", label: "Alphabetical" },
  { value: "hours", label: "Hours Played" },
  { value: "lastPlayed", label: "Last Played" },
];

function getPapirusHtml(papirus, style) {
  const eff = getEffectiveIcon(papirus);
  if (eff.startsWith("papirus:"))
    return `<img src="${resolveIconUrl(eff)}" style="${style}" alt="" />`;
  const m = style.match(/width\s*:\s*([^;]+)/);
  const size = m ? m[1] : "16px";
  return `<i class="${eff}" style="font-size:${size}"></i>`;
}

export class GameRenderer {
  constructor(renderer) {
    this.renderer = renderer;
    this.playCounts = getCachedPlayCounts();
    this.activeTag = os.storage.get(StorageKeys.steamActiveTag) || "";
    this.renderer.activeTag = this.activeTag;
    this.searchQuery = "";
    this.currentSections = [];
  }

  shouldAutoExpandSection(title, games) {
    if (!games || games.length === 0) return false;
    if (this.activeTag) return true;
    const query = (this.searchQuery || "").trim().toLowerCase();
    if (!query) return false;
    return (
      title.toLowerCase().includes(query) ||
      games.some((g) => g.title.toLowerCase().includes(query))
    );
  }

  dropAllGamesOverlap(sections) {
    const activeTagLabel = this.activeTag
      ? GAME_TAGS.find((t) => t.id === this.activeTag)?.label
      : "";
    if (!activeTagLabel) return;
    const tagSection = sections.find((s) => s.title === activeTagLabel);
    const allGamesSection = sections.find((s) => s.title === "All Games");
    if (!tagSection || !allGamesSection) return;
    const shown = new Set(tagSection.games.map((g) => g.app));
    allGamesSection.games = allGamesSection.games.filter(
      (g) => !shown.has(g.app),
    );
    if (allGamesSection.games.length === 0) {
      sections.splice(sections.indexOf(allGamesSection), 1);
    }
  }

  expandSectionsMatchingQuery(container) {
    const query = (this.searchQuery || "").trim().toLowerCase();
    if (!query || !this.currentSections) return;
    const sectionsHost = container.querySelector("#steam-sections-host");
    if (!sectionsHost) return;
    this.currentSections.forEach(({ title, games }) => {
      const matching = games.filter((g) =>
        g.title.toLowerCase().includes(query),
      );
      if (matching.length === 0) return;
      const wrapper = Array.from(
        sectionsHost.querySelectorAll("[data-section-wrapper]"),
      ).find((el) => el.dataset.sectionWrapper === title);
      if (!wrapper) return;
      const grid = wrapper.querySelector(".steam-game-grid");
      const header = wrapper.querySelector(".steam-section-header");
      if (grid && header && grid.style.display === "none") {
        grid.style.display = "grid";
        const icon = header.querySelector("i");
        if (icon) icon.className = "fas fa-chevron-down";
        this.fillGridLazy(grid, matching);
      }
    });
  }

  loadPlayCounts() {
    fetchGamePlayCounts().then((counts) => {
      const previousCounts = this.playCounts;
      this.playCounts = counts;
      this.updateAllBadges();
      if (
        this.renderer.sortBy === "popularity" &&
        Object.keys(previousCounts).length === 0
      ) {
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
            ${getPapirusHtml("papirus:actions/bookmark-new", "width:14px;height:14px;")}
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
    return formatGameActivityTime(min);
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
    const achPct = achievementsPercent(gameStats.totalMin);
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

            <div class="play-bar">
              <button class="steam-play-btn">
                Play
              </button>

              <button class="steam-overview-btn" data-action="favorite">
                ${getPapirusHtml("papirus:actions/bookmark-new", "width:16px;height:16px;")}
                <span>Add to Favorites</span>
              </button>

              <button class="steam-overview-btn" data-action="saveToCollection">
                ${getPapirusHtml("papirus:actions/folder-new", "width:16px;height:16px;")}
                <span>Save to Collection</span>
              </button>

              <div class="overview-stats">
                <div>
                  <div class="overview-stats-label">Last Played</div>
                  <div class="overview-stats-value">
                    ${gameStats.lastPlayed ? new Date(gameStats.lastPlayed).toLocaleDateString() : "Never"}
                  </div>
                </div>

                <div>
                  <div class="overview-stats-label">Play Time</div>
                  <div class="overview-stats-value">
                    ${this.formatTime(gameStats.totalMin)}
                  </div>
                </div>

                <div>
                  <div class="overview-stats-label">Achievements</div>
                  <div class="overview-stats-value">${achPct}%</div>
                  <div class="steam-overview-ach-bar"><span class="steam-overview-ach-fill"></span></div>
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

          <div class="steam-overview-panel">
            <div class="steam-overview-panel-head">
              <h3 class="steam-overview-panel-title">Friends Activity</h3>
              <span class="steam-overview-panel-sub" data-overview-friends-count>Loading...</span>
            </div>
            <div data-overview-friends></div>
            <div class="steam-overview-avatar-strips">
              <div>
                <h4>Played Previously</h4>
                <div class="steam-overview-avatar-row" data-overview-played></div>
              </div>
              <div>
                <h4>On Their Wishlist</h4>
                <div class="steam-overview-avatar-row" data-overview-wishlist></div>
              </div>
            </div>
          </div>
        </div>

        <div class="overview-sidebar">
          <div class="steam-overview-panel">
            <div class="steam-overview-panel-head">
              <h3 class="steam-overview-panel-title">Community</h3>
              <span class="steam-overview-panel-sub" data-overview-plays>0 PLAYS ALL TIME</span>
            </div>
            <div class="steam-overview-row"><span>Total Plays</span><b data-overview-total-plays>0</b></div>
            <div class="steam-overview-row"><span>Playing Now</span><b data-overview-playing-now>0</b></div>
            <h3 class="steam-overview-panel-title steam-overview-community-sub">Recently Played By</h3>
            <div data-overview-recent><span class="steam-overview-note">Loading...</span></div>
          </div>
          <div class="store-ad-block" style="margin-top:20px;"><div class="store-ad-label">Advertisement</div><div id="overview-ad-slot"></div></div>
          <div id="container-5f797791a9771b6940fb9385a69ce168" style="margin-top:20px;"></div>
        </div>
      </div>
    </div>
  `;

    this.injectReeyukiStyle(target);

    injectAdsterraAd(
      "overview-ad-slot",
      ADSTERRA_KEYS.rectangle,
      300,
      250,
      200,
    );
    injectNativeAd("container-5f797791a9771b6940fb9385a69ce168");
    suppressAdBlocks(target);

    const achFill = target.querySelector(".steam-overview-ach-fill");
    if (achFill) achFill.style.width = `${achPct}%`;

    target.querySelector(".steam-play-btn").onclick = () => onLaunch(appId);

    const favoriteBtn = target.querySelector('[data-action="favorite"]');
    if (favoriteBtn) {
      favoriteBtn.onclick = () => {
        SteamDataManager.toggleFavorite(appId);
        const span = favoriteBtn.querySelector("span");
        const isFavorite = SteamDataManager.isFavorite(appId);
        const papirusIcon = isFavorite
          ? "papirus:actions/bookmarks"
          : "papirus:actions/bookmark-new";
        const eff = getEffectiveIcon(papirusIcon);
        const iconEl = favoriteBtn.querySelector("img, i");
        if (iconEl) {
          if (eff.startsWith("papirus:")) {
            if (iconEl.tagName.toLowerCase() === "img")
              iconEl.src = resolveIconUrl(eff);
            else {
              const newImg = document.createElement("img");
              newImg.src = resolveIconUrl(eff);
              newImg.style.width = "16px";
              newImg.style.height = "16px";
              iconEl.replaceWith(newImg);
            }
          } else {
            if (iconEl.tagName.toLowerCase() === "i") iconEl.className = eff;
            else {
              const newI = document.createElement("i");
              newI.className = eff;
              newI.style.fontSize = "16px";
              iconEl.replaceWith(newI);
            }
          }
        }
        span.textContent = isFavorite ? "In Favorites" : "Add to Favorites";
      };
    }

    const saveToCollectionBtn = target.querySelector(
      '[data-action="saveToCollection"]',
    );
    if (saveToCollectionBtn) {
      saveToCollectionBtn.onclick = () => {
        SteamDataManager.addCurrentToCollection(appId);
      };
    }

    this.renderer.setActiveSidebarItem(container, appId);
    this.hydrateOverview(target, appId);
  }

  async hydrateOverview(target, appId) {
    const [community, activity] = await Promise.all([
      fetchCommunityOverview(appId),
      fetchActivityOverview(),
    ]);
    if (!target.isConnected) return;
    const sub = target.querySelector("[data-overview-plays]");
    if (sub)
      sub.textContent = `${community.playCount.toLocaleString()} PLAYS ALL TIME`;
    const total = target.querySelector("[data-overview-total-plays]");
    if (total) total.textContent = community.playCount.toLocaleString();
    const playing = target.querySelector("[data-overview-playing-now]");
    if (playing) playing.textContent = String(community.playingNow.length);
    const recent = target.querySelector("[data-overview-recent]");
    if (recent) {
      const rows = buildPlayerRows(
        community.recentPlayers,
        community.playingNow,
        {
          row: "steam-overview-friend",
          avatar: "steam-overview-friend-avatar",
          info: "steam-overview-friend-info",
        },
      );
      recent.innerHTML =
        rows ||
        '<span class="steam-overview-note">No one has played this recently.</span>';
    }
    const friendsCount = target.querySelector("[data-overview-friends-count]");
    if (friendsCount)
      friendsCount.textContent = `${activity.count} FRIEND${activity.count === 1 ? "" : "S"} HAVE PLAYED RECENTLY`;
    const friendsEl = target.querySelector("[data-overview-friends]");
    if (friendsEl) {
      const cards = buildFriendCards(activity.friends, activity.count, {
        row: "steam-overview-friend",
        avatar: "steam-overview-friend-avatar",
        info: "steam-overview-friend-info",
      });
      friendsEl.innerHTML =
        cards ||
        '<span class="steam-overview-note">Add friends to see their activity here.</span>';
    }
    const playedEl = target.querySelector("[data-overview-played]");
    if (playedEl)
      playedEl.innerHTML =
        buildAvatarStrip(activity.friends, "steam-overview-avatar") ||
        '<span class="steam-overview-note">No activity yet.</span>';
    const wishlistEl = target.querySelector("[data-overview-wishlist]");
    if (wishlistEl)
      wishlistEl.innerHTML =
        buildAvatarStrip(activity.friends, "steam-overview-avatar") ||
        '<span class="steam-overview-note">No activity yet.</span>';
  }

  renderArchiveGameOverview(container, archiveGame, onLaunch) {
    this.renderer.currentGame = null;
    this.renderer.currentArchiveGame = archiveGame;

    const stats = SteamDataManager.getStats();
    const gameStats = stats[archiveGame.appId] || {
      totalMin: 0,
      lastPlayed: 0,
    };
    const achPct = achievementsPercent(gameStats.totalMin);
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
                : `<div style="width:200px;height:280px;background:var(--bg-secondary);border-radius:4px;display:flex;align-items:center;justify-content:center;">${getPapirusHtml("papirus:apps/preferences-desktop-gaming", "width:60px;height:60px;opacity:0.6;")}</div>`
            }
            <div class="banner-info" style="flex: 1;">
              <h1 style="font-size: 48px; margin: 0 0 10px 0; color: var(--text-primary); text-shadow: 0 2px 10px var(--overlay-bg); font-family: 'Motiva Sans', Sans-serif;">${archiveGame.title}</h1>
              <div class="play-bar">
                <button class="steam-play-btn">Play</button>
                <button class="steam-overview-btn" data-action="favorite">
                  ${getPapirusHtml("papirus:actions/bookmark-new", "width:16px;height:16px;")}
                  <span>Add to Favorites</span>
                </button>
                <button class="steam-overview-btn" data-action="saveToCollection">
                  ${getPapirusHtml("papirus:actions/folder-new", "width:16px;height:16px;")}
                  <span>Save to Collection</span>
                </button>
                <div class="overview-stats">
                  <div>
                    <div class="overview-stats-label">Last Played</div>
                    <div class="overview-stats-value">${gameStats.lastPlayed ? new Date(gameStats.lastPlayed).toLocaleDateString() : "Never"}</div>
                  </div>
                  <div>
                    <div class="overview-stats-label">Play Time</div>
                    <div class="overview-stats-value">${this.formatTime(gameStats.totalMin)}</div>
                  </div>
                  <div>
                    <div class="overview-stats-label">Achievements</div>
                    <div class="overview-stats-value">${achPct}%</div>
                    <div class="steam-overview-ach-bar"><span class="steam-overview-ach-fill"></span></div>
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
            <div class="steam-overview-panel">
              <div class="steam-overview-panel-head">
                <h3 class="steam-overview-panel-title">Friends Activity</h3>
                <span class="steam-overview-panel-sub" data-overview-friends-count>Loading...</span>
              </div>
              <div data-overview-friends></div>
              <div class="steam-overview-avatar-strips">
                <div>
                  <h4>Played Previously</h4>
                  <div class="steam-overview-avatar-row" data-overview-played></div>
                </div>
                <div>
                  <h4>On Their Wishlist</h4>
                  <div class="steam-overview-avatar-row" data-overview-wishlist></div>
                </div>
              </div>
            </div>
          </div>
          <div class="overview-sidebar">
             <div class="steam-overview-panel">
               <div class="steam-overview-panel-head">
                 <h3 class="steam-overview-panel-title">Community</h3>
                 <span class="steam-overview-panel-sub" data-overview-plays>0 PLAYS ALL TIME</span>
               </div>
               <div class="steam-overview-row"><span>Total Plays</span><b data-overview-total-plays>0</b></div>
               <div class="steam-overview-row"><span>Playing Now</span><b data-overview-playing-now>0</b></div>
               <h3 class="steam-overview-panel-title steam-overview-community-sub">Recently Played By</h3>
               <div data-overview-recent><span class="steam-overview-note">Loading...</span></div>
             </div>
             <div class="store-ad-block" style="margin-top:20px;"><div class="store-ad-label">Advertisement</div><div id="archive-overview-ad-slot"></div></div>
             <div id="container-5f797791a9771b6940fb9385a69ce168" style="margin-top:20px;"></div>
          </div>
        </div>
      </div>
    `;

    injectAdsterraAd(
      "archive-overview-ad-slot",
      ADSTERRA_KEYS.rectangle,
      300,
      250,
      200,
    );
    injectNativeAd("container-5f797791a9771b6940fb9385a69ce168");
    suppressAdBlocks(target);

    const achFill = target.querySelector(".steam-overview-ach-fill");
    if (achFill) achFill.style.width = `${achPct}%`;

    target.querySelector(".steam-play-btn").onclick = () =>
      this.renderer.showGameOverlay(archiveGame.title, archiveGame.url);

    const favoriteBtn = target.querySelector('[data-action="favorite"]');
    if (favoriteBtn) {
      favoriteBtn.onclick = () => {
        SteamDataManager.toggleFavorite(archiveGame.appId);
        const span = favoriteBtn.querySelector("span");
        const isFavorite = SteamDataManager.isFavorite(archiveGame.appId);
        const papirusIcon = isFavorite
          ? "papirus:actions/bookmarks"
          : "papirus:actions/bookmark-new";
        const eff = getEffectiveIcon(papirusIcon);
        const iconEl = favoriteBtn.querySelector("img, i");
        if (iconEl) {
          if (eff.startsWith("papirus:")) {
            if (iconEl.tagName.toLowerCase() === "img")
              iconEl.src = resolveIconUrl(eff);
            else {
              const newImg = document.createElement("img");
              newImg.src = resolveIconUrl(eff);
              newImg.style.width = "16px";
              newImg.style.height = "16px";
              iconEl.replaceWith(newImg);
            }
          } else {
            if (iconEl.tagName.toLowerCase() === "i") iconEl.className = eff;
            else {
              const newI = document.createElement("i");
              newI.className = eff;
              newI.style.fontSize = "16px";
              iconEl.replaceWith(newI);
            }
          }
        }
        span.textContent = isFavorite ? "In Favorites" : "Add to Favorites";
      };
    }

    const saveToCollectionBtn = target.querySelector(
      '[data-action="saveToCollection"]',
    );
    if (saveToCollectionBtn) {
      saveToCollectionBtn.onclick = () => {
        SteamDataManager.addCurrentToCollection(archiveGame.appId);
      };
    }

    this.renderer.setActiveSidebarItem(container, archiveGame.appId);
    this.hydrateOverview(target, archiveGame.appId);
  }

  renderGrid(container, onLaunch, focusCollection = null) {
    this.loadPlayCounts();

    if (this.renderer.currentArchiveGame) {
      this.renderArchiveGameOverview(
        container,
        this.renderer.currentArchiveGame,
        onLaunch,
      );
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
    const sortedGames = this.getSortedGames(
      filteredGames,
      this.renderer.sortBy,
      this.renderer.sortReverse,
    );

    const settings = SteamSettings.load();
    const showRecent = settings.recentlyPlayedRow !== false;

    const visibleGames = this.activeTag
      ? sortedGames.filter((g) => gameMatchesTag(g, this.activeTag))
      : sortedGames;
    const filteredByTag = this.activeTag
      ? filteredGames.filter((g) => gameMatchesTag(g, this.activeTag))
      : filteredGames;

    const recentGames = showRecent
      ? filteredByTag
          .filter((g) => stats[g.app]?.lastPlayed)
          .sort((a, b) => stats[b.app].lastPlayed - stats[a.app].lastPlayed)
          .slice(0, 5)
      : [];

    const target = container.querySelector(".steam-library-page");
    if (!target) return;

    const isNewsExpanded = collapsed.includes("What's New");

    const shellHtml = `
      <div class="steam-grid-controls-bar" style="margin-bottom: 20px; display: flex; justify-content: flex-end; align-items: center; gap: 15px;">
        <div class="steam-grid-filters">
          <span class="steam-control-label">Sort by</span>
          ${renderSelectMenu("steam-sort-select", SORT_OPTIONS, this.renderer.sortBy, "steam-sort-menu")}
          <button class="steam-sort-order-btn">
            <i class="fas ${this.renderer.sortReverse ? "fa-sort-amount-up" : "fa-sort-amount-down"}"></i>
          </button>
        </div>
      </div>
      <div class="steam-tag-filters" aria-label="Filter by tag">
        <button class="steam-tag-chip${this.activeTag === "" ? " active" : ""}" data-tag=""><i class="fas fa-gamepad"></i>All games</button>
        ${GAME_TAGS.map((t) => `<button class="steam-tag-chip${this.activeTag === t.id ? " active" : ""}" data-tag="${t.id}"><i class="${t.icon}"></i>${t.label}</button>`).join("")}
      </div>
      <div class="store-ad-block"><div class="store-ad-label">Advertisement</div><div id="ad-library-top"></div></div>
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
                ${resolveIconHtml(item.image)}
                <div class="news-info">
                  <div class="news-title">${item.title}</div>
                  <div class="news-date">${item.date}</div>
                </div>
              </div>`,
              )
              .join("")}
          </div>
        </div>
        <div id="steam-sections-host" style="min-height:200px;content-visibility:auto"></div>
        <div class="steam-tag-empty" ${visibleGames.length ? 'style="display:none"' : ""}>No games match this filter</div>
        <div class="store-ad-block" style="margin-top:20px;"><div class="store-ad-label">Advertisement</div><div id="ad-library-bottom"></div></div>
      </div>
    `;

    target.innerHTML = shellHtml;

    target.querySelectorAll(".steam-tag-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        this.activeTag = chip.getAttribute("data-tag") || "";
        this.renderer.activeTag = this.activeTag;
        os.storage.set(StorageKeys.steamActiveTag, this.activeTag);
        this.renderGrid(container, onLaunch, focusCollection);
      });
    });

    const sectionsHost = target.querySelector("#steam-sections-host");

    const tagSections = GAME_TAGS.map((t) => ({
      title: t.label,
      games: visibleGames.filter((g) => gameMatchesTag(g, t.id)),
    }));

    const sections = [
      { title: "Recent", games: recentGames },
      {
        title: "Favorites",
        games: visibleGames.filter((g) => favorites.includes(g.app)),
      },
      ...tagSections,
      ...Object.entries(collections)
        .filter(
          ([name]) => name !== "Webports/Html games" && name !== "Flash Games",
        )
        .map(([name, ids]) => ({
          title: name,
          games: visibleGames.filter((g) => ids.includes(g.app)),
        })),
      { title: "All Games", games: visibleGames },
    ].filter((s) => s.games.length > 0);

    this.dropAllGamesOverlap(sections);
    this.currentSections = sections;

    sections.forEach(({ title, games }) => {
      const sectionId = `steam-section-${title.toLowerCase().replace(/\s+/g, "-")}`;
      const isExpanded =
        collapsed.includes(title) || this.shouldAutoExpandSection(title, games);
      const wrapper = createElement("div");
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

    injectAdsterraAd("ad-library-top", ADSTERRA_KEYS.leaderboard, 728, 90, 0);
    injectAdsterraAd(
      "ad-library-bottom",
      ADSTERRA_KEYS.rectangle,
      300,
      250,
      500,
    );
    suppressAdBlocks(target);

    const sidebar = container.querySelector(".steam-library-sidebar");
    const mainContent = container.querySelector(".steam-main-content");

    if (
      container
        .querySelector(".steam-tab[data-page='library']")
        .classList.contains("active")
    ) {
      sidebar.classList.remove("hidden");
    }
    if (target) target.style.height = "auto";
    if (mainContent) {
      mainContent.style.padding = this.renderer.currentGame ? "0" : "20px";
      mainContent.style.overflowY = "auto";
    }

    this.renderer.attachGridDelegation(container, onLaunch);

    const sortSelect = $("#steam-sort-select", target);
    const sortBtn = $(".steam-sort-order-btn", target);
    if (sortSelect) {
      setSelectMenuValue("steam-sort-select", this.renderer.sortBy, target);
      bindSelectMenu(target);
      bindEvent(sortSelect, "change", () => {
        this.renderer.sortBy = getSelectMenuValue("steam-sort-select", target);
        this.renderGrid(container, onLaunch, focusCollection);
      });
    }
    if (sortBtn) {
      bindEvent(sortBtn, "click", () => {
        this.renderer.sortReverse = !this.renderer.sortReverse;
        this.renderGrid(container, onLaunch, focusCollection);
      });
    }

    if (this.renderer.currentGame)
      this.renderer.setActiveSidebarItem(container, this.renderer.currentGame);
    else if (this.renderer.currentArchiveGame)
      this.renderer.setActiveSidebarItem(
        container,
        this.renderer.currentArchiveGame.appId,
      );

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
    const style = createElement("style");
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
      let hasBudget = !deadline || index === 0 || deadline.timeRemaining() > 1;
      while (index < games.length && hasBudget) {
        const end = Math.min(index + CHUNK, games.length);
        const frag = document.createDocumentFragment();
        const tmp = createElement("div");
        tmp.innerHTML = games
          .slice(index, end)
          .map((g) => this.createCard(g))
          .join("");
        while (tmp.firstChild) frag.appendChild(tmp.firstChild);
        grid.appendChild(frag);
        observeLazyImages(grid);
        index = end;
        if (!deadline) break;
        hasBudget = deadline.timeRemaining() > 1;
      }
      if (index < games.length) {
        requestIdleCallback(renderChunk, { timeout: 500 });
      }
    };
    renderChunk();
  }
}
