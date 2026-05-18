import { CDN_CONFIG } from "./shared/cdnConfig.js";
import { descriptionMap } from "./gameDescriptions.js";
import { shouldEnableAds } from "./ads.js";
import { resolveIconUrl } from "./shared/assetResolver.js";
import { StorageKeys } from "./settings.js";

export function getCdnBase() {
  return CDN_CONFIG.repos.main.base;
}

export function getCdnBaseGames() {
  return CDN_CONFIG.repos.games.base;
}
export function buildSteamShell(container, username, profilePic, hiddenGamesCount, CDN_BASE_REF) {
  const settings = SteamSettings.load();
  const showAnimation = settings.enableStartupAnimation !== false;
  let gridMin = "140px";
  if (settings.gridSize === "small") gridMin = "100px";
  else if (settings.gridSize === "large") gridMin = "180px";

  return `
    <style>
      :root {
        --steam-grid-min: ${gridMin};
      }
      .steam-game-grid, .steam-archive-grid {
        grid-template-columns: repeat(auto-fill, minmax(var(--steam-grid-min, 140px), 1fr)) !important;
      }
      .store-games-grid {
        grid-template-columns: repeat(auto-fill, minmax(calc(var(--steam-grid-min, 140px) + 40px), 1fr)) !important;
      }
      .store-layout { display: flex; gap: 0; height: 100%; background: #1b2838; color: #c6d4df; }
      .store-main-col { flex: 1; overflow-y: auto; padding: 20px 24px; min-width: 0; }
      .store-side-col { width: 186px; flex-shrink: 0; background: #16202d; padding: 12px 8px; display: flex; flex-direction: column; gap: 16px; overflow-y: auto; }
      .store-section-title { font-size: 14px; font-weight: 700; color: #c6d4df; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.08); }
      .store-section-divider { height: 1px; background: rgba(255,255,255,0.08); margin: 24px 0; }
      .store-featured-hero { display: flex; gap: 0; background: #16202d; border-radius: 4px; overflow: hidden; min-height: 220px; margin-bottom: 4px; }
      .store-hero-img-wrap { width: 340px; height: 340px; flex-shrink: 0; overflow: hidden; }
      .store-hero-img { width: 100%; height: 100%; object-fit: cover; object-position: center; display: block; max-width: 100%; max-height: 100%; }
      .store-hero-info { flex: 1; padding: 24px 20px; display: flex; flex-direction: column; justify-content: flex-end; gap: 8px; background: linear-gradient(to right, #16202d, #1b2838); }
      .store-hero-title { font-size: 26px; font-weight: 700; color: #fff; line-height: 1.2; }
      .store-hero-tags { display: flex; gap: 6px; flex-wrap: wrap; }
      .store-tag { font-size: 11px; background: rgba(103,193,245,0.15); color: #67c1f5; padding: 2px 8px; border-radius: 2px; border: 1px solid rgba(103,193,245,0.3); }
      .store-hero-desc { font-size: 12px; color: #8f98a0; line-height: 1.5; max-width: 360px; }
      .store-play-btn { background: linear-gradient(90deg,#06bfff,#2d73ff); border: none; color: #fff; font-size: 13px; font-weight: 700; padding: 10px 24px; border-radius: 2px; cursor: pointer; align-self: flex-start; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; transition: opacity 0.15s; }
      .store-play-btn:hover { opacity: 0.85; }
      .store-hero-thumbs { display: flex; flex-direction: column; gap: 4px; width: 100px; flex-shrink: 0; background: #171d25; padding: 6px 4px; overflow-y: auto; }
      .store-hero-thumb { cursor: pointer; border: 2px solid transparent; border-radius: 2px; overflow: hidden; flex-shrink: 0; }
      .store-hero-thumb img { width: 100%; height: 54px; object-fit: cover; display: block; }
      .store-hero-thumb.active { border-color: #67c1f5; }
      .store-hero-thumb:hover:not(.active) { border-color: rgba(103,193,245,0.4); }
      .store-games-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
      .store-game-card { background: #16202d; border-radius: 3px; overflow: hidden; display: flex; flex-direction: column; cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; }
      .store-game-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.5); }
      .store-game-card-img { height: 120px; overflow: hidden; }
      .store-game-card-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .store-game-card-info { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 6px; }
      .store-game-card-title { font-size: 13px; font-weight: 600; color: #c6d4df; }
      .store-game-card-tags { display: flex; gap: 4px; flex-wrap: wrap; }
      .store-card-play-btn { background: #2a475e; border: none; color: #67c1f5; font-size: 11px; font-weight: 700; padding: 5px 12px; border-radius: 2px; cursor: pointer; align-self: flex-start; margin-top: 2px; text-transform: uppercase; transition: background 0.15s; }
      .store-card-play-btn:hover { background: #3d6b8a; }
      .store-ad-block { display: flex; flex-direction: column; align-items: center; gap: 4px; }
      .store-ad-label { font-size: 9px; color: #4a5a6a; text-transform: uppercase; letter-spacing: 1px; align-self: flex-start; }
      .steam-dropdown {
        position: relative;
        display: inline-block;
      }
      .steam-dropdown-menu {
        display: none;
        position: absolute;
        top: 100%;
        left: 0;
        background: #171a21;
        border: 1px solid rgba(255,255,255,0.1);
        min-width: 160px;
        z-index: 9999;
        box-shadow: 0 4px 16px rgba(0,0,0,0.6);
      }
      .steam-dropdown-menu.visible {
        display: block;
      }
      .steam-dropdown-item {
        padding: 8px 14px;
        font-size: 12px;
        color: #c6d4df;
        cursor: pointer;
        white-space: nowrap;
        user-select: none;
      }
      .steam-dropdown-item:hover {
        background: #2a475e;
        color: #fff;
      }
      .steam-dropdown-separator {
        height: 1px;
        background: rgba(255,255,255,0.08);
        margin: 4px 0;
      }
      .sidebar-search-container {
        position: relative;
        display: flex;
        align-items: center;
      }
      .sidebar-search-icon {
        position: absolute;
        left: 10px;
        color: #8f98a0;
        font-size: 12px;
        pointer-events: none;
      }
      .sidebar-search-input {
        padding-left: 28px !important;
      }
      .steam-top-bar {
        display: flex !important;
        align-items: center !important;
        grid-template-columns: unset !important;
      }
      .steam-top-bar > * {
        grid-column: unset !important;
        grid-row: unset !important;
      }
      .steam-menu-items {
        display: flex !important;
        align-items: center !important;
        flex: 1 !important;
        margin-left: 0 !important;
        position: static !important;
      }
      .steam-top-right {
        margin-left: auto !important;
      }

      .settings-container {
        background: rgba(0,0,0,0.2);
        border-radius: 4px;
        padding: 0;
        max-width: 800px;
      }

      .settings-section {
        border-bottom: 1px solid rgba(255,255,255,0.08);
        padding: 24px;
      }

      .settings-section:last-child {
        border-bottom: none;
      }

      .settings-section-title {
        font-size: 16px;
        font-weight: 600;
        color: #fff;
        margin: 0 0 16px 0;
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      .settings-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 0;
      }

      .settings-item-label {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .settings-item-title {
        font-size: 14px;
        color: #c6d4df;
        font-weight: 500;
      }

      .settings-item-description {
        font-size: 12px;
        color: #8f98a0;
      }

      .settings-toggle {
        position: relative;
        width: 48px;
        height: 24px;
        background: #3d4450;
        border-radius: 12px;
        cursor: pointer;
        transition: background 0.2s;
        flex-shrink: 0;
      }

      .settings-toggle.active {
        background: #5c9eff;
      }

      .settings-toggle-slider {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 20px;
        height: 20px;
        background: #fff;
        border-radius: 50%;
        transition: transform 0.2s;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      }

      .settings-toggle.active .settings-toggle-slider {
        transform: translateX(24px);
      }

      .settings-select {
        background: #2a475e;
        border: 1px solid rgba(255,255,255,0.1);
        color: #c6d4df;
        padding: 8px 12px;
        border-radius: 3px;
        font-size: 13px;
        cursor: pointer;
        min-width: 150px;
      }

      .settings-select:hover {
        background: #3d6b8a;
      }

      .settings-select option {
        background: #1b2838;
        color: #c6d4df;
      }
    </style>

    <div class="steam-loading-screen" style="${showAnimation ? "" : "display:none !important; opacity:0; pointer-events:none;"}">
      <div class="steam-loading-logo">
        <div class="steam-spinner"></div>
        <i class="fab fa-steam"></i>
      </div>
    </div>

    <div class="steam-main">
      <div class="steam-top-bar window-header">
        <i class="fab fa-steam" style="font-size: 20px; margin-right: 8px;"></i>
        <div class="steam-menu-items">
          <div class="steam-dropdown">
            <span class="steam-menu-item steam-dropdown-trigger" data-dropdown="steam-menu">Steam</span>
            <div class="steam-dropdown-menu" id="steam-menu-dropdown">
              <div class="steam-dropdown-item" data-action="steam-settings">Settings</div>
              <div class="steam-dropdown-separator"></div>
              <div class="steam-dropdown-item" data-action="steam-exit">Exit</div>
            </div>
          </div>
          <div class="steam-dropdown">
            <span class="steam-menu-item steam-dropdown-trigger" data-dropdown="view-menu">View</span>
            <div class="steam-dropdown-menu" id="view-menu-dropdown">
              <div class="steam-dropdown-item" data-action="view-library">Library</div>
              <div class="steam-dropdown-item" data-action="view-downloads">Downloads</div>
              <div class="steam-dropdown-item" data-action="view-friends">Friends &amp; Chat</div>
            </div>
          </div>
          <div class="steam-dropdown">
            <span class="steam-menu-item steam-dropdown-trigger" data-dropdown="games-menu">Games</span>
            <div class="steam-dropdown-menu" id="games-menu-dropdown">
              <div class="steam-dropdown-item" data-action="games-view-library">View Games Library</div>
            </div>
          </div>
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
          <span class="steam-tab" data-page="library">Library</span>
          <span class="steam-tab" data-page="community">Community</span>
          <span class="steam-tab" data-page="user">${username}</span>
        </div>
      </div>

      <div class="steam-content-area">
        <div class="steam-library-sidebar hidden">
          <div class="sidebar-search-container">
            <i class="fas fa-search sidebar-search-icon"></i>
            <input type="text" class="sidebar-search-input" placeholder="Search" />
          </div>
          <div class="sidebar-game-list"></div>
          <div class="sidebar-hidden-section" style="display:${hiddenGamesCount > 0 ? "block" : "none"};" data-collapsed="1">
            <div class="sidebar-hidden-header">
              <i class="fas fa-chevron-right sidebar-hidden-chevron"></i>
              <span>Hidden Games</span>
              <span class="sidebar-hidden-count">${hiddenGamesCount}</span>
            </div>
            <div class="sidebar-hidden-list" style="display:none;"></div>
          </div>
          <div class="sidebar-resize-handle"></div>
        </div>

        <div class="steam-main-content">
          <div class="steam-library-page"></div>
          <div class="steam-store-page hidden">
            <div class="store-layout">
              <div class="store-main-col">
                <div class="store-featured-header">
                  <h2 class="store-section-title">Reeyuki Ports Catalog</h2>
                </div>
                <div class="store-featured-hero">
                  <div class="store-hero-img-wrap">
                    <img src="${resolveIconUrl("static/icons/tabs.webp")}" class="store-hero-img" id="store-hero-img" />
                  </div>
                  <div class="store-hero-info" id="store-hero-info">
                    <div class="store-hero-title" id="store-hero-title">TABS: Totaly Accurate Battle Simulator</div>
                    <div class="store-hero-tags" id="store-hero-tags">
                      <span class="store-tag">Strategy</span>
                      <span class="store-tag">Simulation</span>
                      <span class="store-tag">War</span>
                    </div>
                    <div class="store-hero-desc" id="store-hero-desc"></div>
                    <button class="store-play-btn" id="store-hero-play-btn" data-app="tabs">Play Now</button>
                  </div>
                  <div class="store-hero-thumbs" id="store-hero-thumbs"></div>
                </div>
                <div class="store-section-divider"></div>
                <h2 class="store-section-title">All WebPorts</h2>
                <div class="store-games-grid" id="store-games-grid"></div>
              </div>
              <div class="store-side-col">
                <div class="store-ad-block">
                  <div class="store-ad-label">Advertisement</div>
                  <div id="store-ad-slot-1"></div>
                </div>
                <div class="store-ad-block">
                  <div class="store-ad-label">Advertisement</div>
                  <div id="store-ad-slot-2"></div>
                </div>
              </div>
            </div>
          </div>
          <div class="steam-community-page hidden" style="display:flex;align-items:center;justify-content:center;height:100%;font-size:24px;opacity:0.5;">
            Community Page
          </div>
          <div class="steam-downloads-page hidden" style="display:flex;align-items:center;justify-content:center;height:100%;font-size:24px;opacity:0.5;">
            Downloads Center
          </div>
          <div class="steam-settings-page hidden" style="display:flex;flex-direction:column;padding:30px;height:100%;color:#c6d4df;overflow-y:auto;">
            <h2 style="margin:0 0 20px 0;font-size:20px;color:#fff;">Steam Settings</h2>
            <div class="settings-container">
              <div class="settings-section">
                <h3 class="settings-section-title">General</h3>

                <div class="settings-item">
                  <div class="settings-item-label">
                    <div class="settings-item-title">Run on Startup</div>
                    <div class="settings-item-description">Launch Steam when your computer starts</div>
                  </div>
                  <div class="settings-toggle" data-setting="runOnStartup">
                    <div class="settings-toggle-slider"></div>
                  </div>
                </div>

                <div class="settings-item">
                  <div class="settings-item-label">
                    <div class="settings-item-title">Start Minimized</div>
                    <div class="settings-item-description">Start Steam minimized to system tray</div>
                  </div>
                  <div class="settings-toggle" data-setting="startMinimized">
                    <div class="settings-toggle-slider"></div>
                  </div>
                </div>

                <div class="settings-item">
                  <div class="settings-item-label">
                    <div class="settings-item-title">Enable Startup Animation</div>
                    <div class="settings-item-description">Show loading animation when Steam starts</div>
                  </div>
                  <div class="settings-toggle active" data-setting="enableStartupAnimation">
                    <div class="settings-toggle-slider"></div>
                  </div>
                </div>
              </div>

              <div class="settings-section">
                <h3 class="settings-section-title">Library</h3>

                <div class="settings-item">
                  <div class="settings-item-label">
                    <div class="settings-item-title">Recently Played Row</div>
                    <div class="settings-item-description">Show recently played games section in library</div>
                  </div>
                  <div class="settings-toggle" data-setting="recentlyPlayedRow">
                    <div class="settings-toggle-slider"></div>
                  </div>
                </div>

                <div class="settings-item">
                  <div class="settings-item-label">
                    <div class="settings-item-title">Grid Size</div>
                    <div class="settings-item-description">Set the size of game tiles in library</div>
                  </div>
                  <select class="settings-select" data-setting="gridSize">
                    <option value="small">Small</option>
                    <option value="medium" selected>Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>

                <div class="settings-item">
                  <div class="settings-item-label">
                    <div class="settings-item-title">Hide Archive Games</div>
                    <div class="settings-item-description">Hide archive games from library view</div>
                  </div>
                  <div class="settings-toggle" data-setting="hideArchiveGames">
                    <div class="settings-toggle-slider"></div>
                  </div>
                </div>
              </div>
            </div>
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
            <span>FRIENDS &amp; CHAT</span>
          </div>
        </div>
      </div>
    </div>

    <div class="steam-game-popover"></div>
    <div class="steam-context-menu"></div>
    <div class="steam-scroll-top"><i class="fas fa-chevron-up"></i></div>
  `;
}
export class SteamSettings {
  static DEFAULTS = {
    runOnStartup: false,
    startMinimized: false,
    enableStartupAnimation: true,
    recentlyPlayedRow: true,
    gridSize: "medium",
    hideArchiveGames: false
  };

  static KEY = StorageKeys.steamSettings;

  static load() {
    try {
      const saved = localStorage.getItem(this.KEY);
      if (saved) {
        return { ...this.DEFAULTS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
    return { ...this.DEFAULTS };
  }

  static save(settings) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(settings));
      return true;
    } catch (e) {
      console.error("Failed to save settings:", e);
      return false;
    }
  }

  static get(key) {
    const settings = this.load();
    return settings[key] ?? this.DEFAULTS[key];
  }

  static set(key, value) {
    const settings = this.load();
    settings[key] = value;
    return this.save(settings);
  }

  static reset() {
    return this.save({ ...this.DEFAULTS });
  }
}

export function initSettingsPage(container) {
  const settingsPage = container.querySelector(".steam-settings-page");
  if (!settingsPage) return;

  const settings = SteamSettings.load();

  settingsPage.querySelectorAll(".settings-toggle").forEach((toggle) => {
    if (toggle._inited) return;
    toggle._inited = true;
    const setting = toggle.dataset.setting;
    const value = settings[setting];

    if (value) {
      toggle.classList.add("active");
    } else {
      toggle.classList.remove("active");
    }

    toggle.addEventListener("click", () => {
      const isActive = toggle.classList.contains("active");
      toggle.classList.toggle("active");
      SteamSettings.set(setting, !isActive);

      if (["hideArchiveGames", "recentlyPlayedRow"].includes(setting)) {
        window.dispatchEvent(
          new CustomEvent("steam-settings-changed", {
            detail: { setting, value: !isActive }
          })
        );
      }
    });
  });

  settingsPage.querySelectorAll(".settings-select").forEach((select) => {
    if (select._inited) return;
    select._inited = true;
    const setting = select.dataset.setting;
    const value = settings[setting];

    select.value = value;

    select.addEventListener("change", (e) => {
      SteamSettings.set(setting, e.target.value);

      if (setting === "gridSize") {
        window.dispatchEvent(
          new CustomEvent("steam-settings-changed", {
            detail: { setting, value: e.target.value }
          })
        );
      }
    });
  });
}

export function initDropdowns(container, navigateTo, openFriendsWindow, wm) {
  const allDropdownMenus = container.querySelectorAll(".steam-dropdown-menu");

  const closeAll = () => allDropdownMenus.forEach((m) => m.classList.remove("visible"));

  container.querySelectorAll(".steam-dropdown-trigger").forEach((trigger) => {
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const dropdownId = trigger.dataset.dropdown + "-dropdown";
      const menu = container.querySelector(`#${dropdownId}`);
      const isVisible = menu.classList.contains("visible");
      closeAll();
      if (!isVisible) menu.classList.add("visible");
    });
  });

  container.querySelectorAll(".steam-dropdown-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAll();
      const action = item.dataset.action;
      if (action === "steam-settings") {
        navigateTo("settings");
      } else if (action === "steam-exit") {
        const winRoot = container.closest(".window");
        if (winRoot) {
          const closeBtn = winRoot.querySelector(".window-close-btn, .close-btn, [data-action='close']");
          if (closeBtn) closeBtn.click();
          else winRoot.remove();
        }
      } else if (action === "view-library") {
        navigateTo("library");
      } else if (action === "view-downloads") {
        navigateTo("downloads");
      } else if (action === "view-friends") {
        openFriendsWindow(wm);
      } else if (action === "games-view-library") {
        navigateTo("library");
      }
    });
  });

  document.addEventListener("click", closeAll);
}

export function initStorePage(container, onLaunch, navigateTo, CDN_BASE_REF, imgObserver) {
  const STORE_GAMES = [
    {
      app: "tabs",
      icon: resolveIconUrl("static/icons/tabs.webp"),
      title: "TABS: Totaly Accurate Battle Simulator",
      tags: ["Strategy", "Simulation", "War"]
    },
    {
      app: "slimeRancher",
      icon: resolveIconUrl("static/icons/slime.webp"),
      title: "Slime Rancher",
      tags: ["Farming Sim", "Exploration", "First-Person"]
    },
    {
      app: "angryBirds2",
      icon: resolveIconUrl("static/icons/angryBirds2.webp"),
      title: "Angry Birds 2",
      tags: ["Slingshot", "Physics", "Puzzle"]
    },
    {
      app: "lobotomyCorporation",
      icon: resolveIconUrl("static/icons/lobotomy.webp"),
      title: "Lobotomy Corporation,",
      tags: ["Strategy", "Simulation"]
    },

    {
      app: "plagueIncEvolved",
      icon: resolveIconUrl("static/icons/plague.webp"),
      title: "Plague Inc Evolved",
      tags: ["Strategy", "Simulation"]
    },
    {
      app: "fiveNightsAtFrickbears3",
      icon: resolveIconUrl("static/icons/fiveNightsAtFrickbears.webp"),
      title: "Five Nights At Frickbears 3",
      tags: ["Horror", "Survival"]
    },
    {
      app: "helltaker",
      icon: resolveIconUrl("static/icons/helltaker.jpg"),
      title: "Helltaker",
      tags: ["Puzzle", "Anime"]
    },
    {
      app: "inscryption",
      icon: resolveIconUrl("static/icons/inscryption.webp"),
      title: "Inscryption",
      tags: ["Card Game", "Roguelike"]
    },
    {
      app: "nightInTheWoods",
      icon: resolveIconUrl("static/icons/night.webp"),
      title: "Night In The Woods",
      tags: ["Adventure", "Narrative"]
    },
    {
      app: "daddy",
      icon: resolveIconUrl("static/icons/daddy.webp"),
      title: "Who's Your Daddy",
      tags: ["Casual", "Multiplayer"]
    },
    {
      app: "suicideGuy",
      icon: resolveIconUrl("static/icons/suicideguy.webp"),
      title: "Suicide Guy",
      tags: ["Puzzle", "Platformer"]
    },
    {
      app: "ytlifeomg",
      icon: resolveIconUrl("static/icons/yt.webp"),
      title: "Youtubers Life Omg",
      tags: ["Simulation", "Management"]
    },
    {
      app: "inStarsAndTime",
      icon: resolveIconUrl("static/icons/star.webp"),
      title: "In Stars And Time",
      tags: ["RPG", "Story"]
    },
    {
      app: "wheresBaldi",
      icon: resolveIconUrl("static/icons/wheresBaldi.webp"),
      title: "Where's Baldi",
      tags: ["Horror", "Action"]
    },
    {
      app: "baldiBalds",
      icon: resolveIconUrl("static/icons/baldiBalds.webp"),
      title: "Baldi Balds The Universe",
      tags: ["Horror", "Action"]
    },
    {
      app: "baldisBasicsTeachingOnTwos",
      icon: resolveIconUrl("static/icons/baldisBasicsTeachingOnTwos.webp"),
      title: "Baldi's Basics: Teaching On Twos",
      tags: ["Horror", "Education"]
    },
    {
      app: "playtimeHellBear5van",
      icon: resolveIconUrl("static/icons/playtimeHellBear5van.webp"),
      title: "Playtime Hell & Bear 5 Van",
      tags: ["Horror", "Action"]
    },
    {
      app: "antidisestablishmentarianism",
      icon: resolveIconUrl("static/icons/antiDisestablishism.webp"),
      title: "Antidisestablishmentarianism",
      tags: ["Puzzle", "Indie", "Education"]
    },
    {
      app: "minusThree",
      icon: resolveIconUrl("static/icons/minusThree.webp"),
      title: "Minus Three",
      tags: ["Puzzle", "Indie", "Education"]
    },
    {
      app: "three",
      icon: resolveIconUrl("static/icons/three.webp"),
      title: "Three",
      tags: ["Puzzle", "Indie", "Education"]
    },
    {
      app: "theMathIsLeaking",
      icon: resolveIconUrl("static/icons/theMathIsLeaking.webp"),
      title: "The Math Is Leaking",
      tags: ["Puzzle", "Education"]
    },
    {
      app: "pneumonoultramicroscopicsilicovolcanoconiosis",
      icon: resolveIconUrl("static/icons/pneumo.webp"),
      title: "Pneumonoultramicroscopicsilicovolcanoconiosis",
      tags: ["Puzzle", "Educational", "Word", "Indie"]
    }
  ];

  const heroImgs = [
    {
      app: "tabs",
      img: resolveIconUrl("static/icons/tabs.webp"),
      title: "TABS: Totaly Accurate Battle Simulator",
      tags: ["Strategy", "Simulation", "War"],
      desc: "A physics based tactics game where wobbly historical and mythological armies clash in chaotic, ragdoll powered battles."
    },
    {
      app: "plagueIncEvolved",
      img: resolveIconUrl("static/icons/plague.webp"),
      title: "Plague Inc: Evolved",
      tags: ["Strategy", "Simulation"],
      desc: "A unique mix of high strategy and terrifyingly realistic simulation. Can you infect the world?"
    },
    {
      app: "inscryption",
      img: resolveIconUrl("static/icons/inscryption.webp"),
      title: "Inscryption",
      tags: ["Card Game", "Roguelike", "Dark"],
      desc: "A deck-building roguelike where you're trapped playing a sinister card game with a mysterious figure."
    },
    {
      app: "helltaker",
      img: resolveIconUrl("static/icons/helltaker.jpg"),
      title: "Helltaker",
      tags: ["Puzzle", "Anime", "Free"],
      desc: "A free game about making a harem of demon girls. Fight your way through hell one puzzle at a time."
    },
    {
      app: "nightInTheWoods",
      img: resolveIconUrl("static/icons/night.webp"),
      title: "Night In The Woods",
      tags: ["Adventure", "Narrative", "Indie"],
      desc: "An adventure game focused on exploration, story and character, featuring a 20-something college dropout."
    }
  ];

  const storePage = container.querySelector(".steam-store-page");
  if (!storePage) return;

  const heroImg = storePage.querySelector("#store-hero-img");
  const heroTitle = storePage.querySelector("#store-hero-title");
  const heroTagsEl = storePage.querySelector("#store-hero-tags");
  const heroDesc = storePage.querySelector("#store-hero-desc");
  const heroPlayBtn = storePage.querySelector("#store-hero-play-btn");
  const heroThumbs = storePage.querySelector("#store-hero-thumbs");

  heroDesc.textContent = descriptionMap[heroImgs[0].app] || heroImgs[0].desc;

  heroImgs.forEach((h, i) => {
    const thumb = document.createElement("div");
    thumb.className = "store-hero-thumb" + (i === 0 ? " active" : "");
    thumb.innerHTML = `<img src="${h.img}" />`;

    thumb.addEventListener("click", () => {
      storePage.querySelectorAll(".store-hero-thumb").forEach((t) => t.classList.remove("active"));
      thumb.classList.add("active");

      heroImg.src = h.img;
      heroTitle.textContent = h.title;
      heroDesc.textContent = descriptionMap[h.app] || h.desc;
      heroPlayBtn.dataset.app = h.app;
      heroTagsEl.innerHTML = h.tags.map((t) => `<span class="store-tag">${t}</span>`).join("");
    });

    heroThumbs.appendChild(thumb);
  });
  heroPlayBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    onLaunch(heroPlayBtn.dataset.app);
  });

  const heroInfo = storePage.querySelector("#store-hero-info");
  if (heroInfo) {
    heroInfo.style.cursor = "pointer";
    heroInfo.addEventListener("click", (e) => {
      if (e.target.closest(".store-play-btn")) return;
      const appId = heroPlayBtn.dataset.app;
      navigateTo("library");
      onLaunch.__rendererRef?.setCurrentGame(appId);
    });
  }

  const grid = storePage.querySelector("#store-games-grid");
  if (grid) {
    STORE_GAMES.forEach((g) => {
      const card = document.createElement("div");
      card.className = "store-game-card";
      card.innerHTML = `
  <div class="store-game-card-img">
    <img data-src="${g.icon}" alt="${g.title}" />
    <div class="store-port-corner">Reeyuki Port</div>
  </div>

  <div class="store-game-card-info">
    <div class="store-game-card-title">${g.title}</div>

    <div class="store-game-card-tags">
      ${g.tags.map((t) => `<span class="store-tag">${t}</span>`).join("")}
    </div>
    <button class="store-card-play-btn" data-app="${g.app}">
      Play
    </button>
  </div>
`;
      card.querySelector(".store-card-play-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        onLaunch(g.app);
      });
      card.addEventListener("click", (e) => {
        if (e.target.closest(".store-card-play-btn")) return;
        navigateTo("library");
        onLaunch.__rendererRef?.setCurrentGame(g.app);
      });
      grid.appendChild(card);
      imgObserver.observe(card.querySelector("img[data-src]"));
    });
  }

  const _injectAd = (slotId, key, height, width) => {
    if (!shouldEnableAds()) return;
    const slot = storePage.querySelector(`#${slotId}`);
    if (!slot) return;
    const cfgScript = document.createElement("script");
    cfgScript.text = `atOptions = { 'key': '${key}', 'format': 'iframe', 'height': ${height}, 'width': ${width}, 'params': {} };`;
    slot.appendChild(cfgScript);
    const invokeScript = document.createElement("script");
    invokeScript.src = `https://www.highperformanceformat.com/${key}/invoke.js`;
    invokeScript.async = true;
    slot.appendChild(invokeScript);
  };

  _injectAd("store-ad-slot-1", "f88fd46583493c3820f283948e5e5391", 300, 160);
  setTimeout(() => {
    _injectAd("store-ad-slot-2", "ee9dc67de90729e2804aa8aba6454ec8", 600, 160);
  }, 1000);
}

window.addEventListener("steam-settings-changed", (e) => {
  if (e.detail.setting === "gridSize") {
    let gridMin = "140px";
    if (e.detail.value === "small") gridMin = "100px";
    else if (e.detail.value === "large") gridMin = "180px";
    document.documentElement.style.setProperty("--steam-grid-min", gridMin);
  }
});
