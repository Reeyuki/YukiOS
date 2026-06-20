import { CDN_CONFIG } from "../shared/cdnConfig.js";
import { descriptionMap } from "./gameDescriptions.js";
import { shouldEnableAds } from "../ads.js";
import { resolveIconUrl } from "../shared/assetResolver.js";

import { StorageKeys, os } from "../framework.js";
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

                <div class="settings-item">
                  <div class="settings-item-label">
                    <div class="settings-item-title">Hide LuminSDK Games</div>
                    <div class="settings-item-description">Hide LuminSDK game catalog section from library view</div>
                  </div>
                  <div class="settings-toggle" data-setting="hideLuminSDK">
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
    hideArchiveGames: false,
    hideLuminSDK: false
  };

  static KEY = StorageKeys.steamSettings;

  static load() {
    try {
      const saved = os.storage.get(this.KEY);
      if (saved) {
        return { ...this.DEFAULTS, ...saved };
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
    return { ...this.DEFAULTS };
  }

  static save(settings) {
    try {
      os.storage.set(this.KEY, settings);
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

      if (["hideArchiveGames", "hideLuminSDK", "recentlyPlayedRow"].includes(setting)) {
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

  const closeAll = () =>
    allDropdownMenus.forEach((m) => {
      m.classList.remove("visible");
      if (m.dataset.movedToBody === "true") {
        m.remove();
        m.dataset.movedToBody = "false";
        container.appendChild(m);
      }
    });

  container.querySelectorAll(".steam-dropdown-trigger").forEach((trigger) => {
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const dropdownId = trigger.dataset.dropdown + "-dropdown";
      const menu = container.querySelector(`#${dropdownId}`);
      const isVisible = menu.classList.contains("visible");
      closeAll();
      if (!isVisible) {
        const rect = trigger.getBoundingClientRect();
        menu.style.top = `${rect.bottom}px`;
        menu.style.left = `${rect.left}px`;
        menu.style.position = "fixed";
        menu.style.zIndex = "99999";
        document.body.appendChild(menu);
        menu.dataset.movedToBody = "true";
        menu.classList.add("visible");
      }
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
      app: "catGoesFishing",
      icon: resolveIconUrl("static/icons/cat.webp"),
      title: "Cat Goes Fishing",
      tags: ["Fishing", "Simulation", "Relaxing", "Casual"]
    },
    {
      app: "angryBirds2",
      icon: resolveIconUrl("static/icons/angryBirds2.webp"),
      title: "Angry Birds 2",
      tags: ["Slingshot", "Physics", "Puzzle"]
    },
    {
      app: "slimeRancher",
      icon: resolveIconUrl("static/icons/slime.webp"),
      title: "Slime Rancher",
      tags: ["Farming Sim", "Exploration", "First-Person"]
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
      app: "slenderina",
      icon: resolveIconUrl("static/icons/slenderina.webp"),
      title: "Slenderina The Cellar",
      tags: ["Horror", "Action"]
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
