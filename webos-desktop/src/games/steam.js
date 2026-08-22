import { CDN_CONFIG } from "../shared/cdnConfig.js";
import { descriptionMap } from "./gameDescriptions.js";
import { injectAdsterraAd, suppressAdBlocks, ADSTERRA_KEYS } from "../ads.js";
import { steamAudio } from "./steamAudio.js";
import { resolveIconUrl } from "../shared/assetResolver.js";
import { parseBool } from "../utils/utils.js";
import { StorageKeys, os, createElement } from "../framework.js";
import { showContextMenu } from "../shared/contextMenu.js";
import { startSteamTour } from "../apps/steamIntro.js";
import { SteamSettings, openSteamSettingsWindow, buildSettingsPageHTML, getGridMin } from "./steamSettings.js";

export const STORE_GAMES = [
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

export function getCdnBase() {
  return CDN_CONFIG.repos.main.base;
}

export function getCdnBaseGames() {
  return CDN_CONFIG.repos.games.base;
}

export function buildSteamShell(container, username, profilePic, hiddenGamesCount, CDN_BASE_REF) {
  const settings = SteamSettings.load();
  const showAnimation = settings.enableStartupAnimation !== false;
  const gridMin = getGridMin(settings.gridSize);

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
            <span class="steam-menu-item steam-dropdown-trigger" data-dropdown="steam-menu">Yuki</span>
            <div class="steam-dropdown-menu" id="steam-menu-dropdown">
              <div class="steam-dropdown-item" data-action="steam-settings">Settings</div>
              <div class="steam-dropdown-item" data-action="steam-account">Account</div>
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
          <button type="button" class="steam-quick-nav-btn" data-steam-nav="quests" title="Daily Quests"><i class="fas fa-clipboard-list"></i></button>
          <button type="button" class="steam-quick-nav-btn" data-steam-nav="shop" title="Profile Store"><i class="fas fa-store"></i></button>
          <button type="button" class="steam-quick-nav-btn" data-steam-nav="login" title="Account"><i class="fas fa-gear"></i></button>
          <div class="steam-user-profile">
            <span class="steam-profile-name">${username}</span>
            <span class="steam-profile-coins" title="YukiCoins"><i class="fas fa-coins"></i> <span class="steam-profile-coins-value"></span></span>
            <span class="steam-profile-streak steam-profile-streak--hidden" title="Day streak"><i class="fas fa-fire"></i> <span class="steam-profile-streak-value"></span> days</span>
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
      <div class="steam-address-bar hidden">
        <i class="fas fa-globe"></i>
        <span class="steam-address-text"></span>
        <button type="button" class="steam-address-reload" title="Reload page">
          <i class="fas fa-rotate-right"></i>
        </button>
      </div>

      <div class="steam-disclaimer">
        <i class="fas fa-info-circle"></i>
        <span>This application is not affiliated with Steam or Valve Corporation.</span>
        <button class="steam-disclaimer-close"><i class="fas fa-times"></i></button>
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
                  <h2 class="store-section-title">Ports Catalog</h2>
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
          <div class="steam-community-page hidden"></div>
          <div class="steam-user-page hidden"></div>
          <div class="steam-friends-page hidden"></div>
          <div class="steam-profile-page hidden"></div>
          <div class="steam-edit-page hidden"></div>
          <div class="steam-login-page hidden"></div>
          <div class="steam-games-page hidden"></div>
          <div class="steam-achievements-page hidden"></div>
          <div class="steam-quests-page hidden"></div>
          <div class="steam-shop-page hidden"></div>
          <div class="steam-downloads-page hidden" style="display:flex;align-items:center;justify-content:center;height:100%;font-size:24px;opacity:0.5;">
            Downloads Center
          </div>
          ${buildSettingsPageHTML({ prefix: "steam-ui", hidden: true })}
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
export function initDropdowns(container, navigateTo, openFriendsWindow, wm) {
  const allDropdownMenus = container.querySelectorAll(".steam-dropdown-menu");

  const userProfile = container.querySelector(".steam-user-profile");
  if (userProfile) {
    userProfile.addEventListener("click", (e) => {
      e.stopPropagation();
      const items = [
        { id: "up-my-profile", action: "up-my-profile", label: "My Profile", icon: "fa-user" },
        { id: "up-quests", action: "up-quests", label: "Daily Quests", icon: "fa-clipboard-list" },
        { id: "up-shop", action: "up-shop", label: "Profile Store", icon: "fa-store" },
        "hr",
        { id: "up-friends", action: "up-friends", label: "Friends & Chat", icon: "fa-user-group" },
        { id: "up-settings", action: "up-settings", label: "Settings", icon: "fa-gear" },
        { id: "up-account", action: "up-account", label: "Account", icon: "fa-user-lock" },
        { id: "up-social-tour", action: "up-social-tour", label: "Yuki Steam Tour", icon: "fa-question-circle" }
      ];
      const handlers = {
        "up-my-profile": () => navigateTo("user"),
        "up-quests": () => navigateTo("quests"),
        "up-shop": () => navigateTo("shop"),
        "up-friends": () => openFriendsWindow(wm),
        "up-settings": () => navigateTo("settings"),
        "up-account": () => navigateTo("login"),
        "up-social-tour": () => startSteamTour()
      };
      showContextMenu(e, items, handlers);
    });
  }

  const closeAll = () =>
    allDropdownMenus.forEach((m) => {
      m.classList.remove("visible");
      if (parseBool(m.dataset.movedToBody)) {
        m.remove();
        m.dataset.movedToBody = "false";
        container.appendChild(m);
      }
    });

  container.querySelectorAll(".steam-dropdown-trigger").forEach((trigger) => {
    trigger.addEventListener("mouseenter", () => steamAudio.playHover());

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const dropdownId = trigger.dataset.dropdown + "-dropdown";
      const menu = container.querySelector(`#${dropdownId}`);
      const isVisible = menu.classList.contains("visible");
      closeAll();
      if (!isVisible) {
        steamAudio.playNavigate();
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
    item.addEventListener("mouseenter", () => steamAudio.playHover());

    item.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAll();
      const action = item.dataset.action;
      if (action === "steam-settings") {
        steamAudio.playSelect();
        openSteamSettingsWindow(wm);
      } else if (action === "steam-account") {
        steamAudio.playSelect();
        navigateTo("login");
      } else if (action === "steam-exit") {
        steamAudio.playBack();
        const winRoot = container.closest(".window");
        if (winRoot) {
          const closeBtn = winRoot.querySelector(".window-close-btn, .close-btn, [data-action='close']");
          if (closeBtn) closeBtn.click();
          else winRoot.remove();
        }
      } else if (action === "view-library") {
        steamAudio.playNavigate();
        navigateTo("library");
      } else if (action === "view-downloads") {
        steamAudio.playNavigate();
        navigateTo("downloads");
      } else if (action === "view-friends") {
        steamAudio.playNavigate();
        openFriendsWindow(wm);
      } else if (action === "games-view-library") {
        steamAudio.playNavigate();
        navigateTo("library");
      }
    });
  });

  container.querySelectorAll(".steam-tab").forEach((tab) => {
    tab.addEventListener("mouseenter", () => steamAudio.playHover());
  });

  container.querySelectorAll(".steam-nav-btn").forEach((btn) => {
    btn.addEventListener("mouseenter", () => steamAudio.playHover());
    btn.addEventListener("click", () => {
      if (btn.classList.contains("steam-back-btn")) {
        steamAudio.playBack();
      } else {
        steamAudio.playNavigate();
      }
    });
  });

  container.querySelectorAll(".steam-quick-nav-btn").forEach((btn) => {
    btn.addEventListener("mouseenter", () => steamAudio.playHover());
    btn.addEventListener("click", () => {
      const page = btn.dataset.steamNav;
      if (page) {
        steamAudio.playNavigate();
        navigateTo(page);
      }
    });
  });

  container.querySelectorAll(".steam-downloads-btn, .steam-friends-btn, .steam-notifications").forEach((btn) => {
    btn.addEventListener("mouseenter", () => steamAudio.playHover());
    btn.addEventListener("click", () => steamAudio.playSelect());
  });

  document.addEventListener("click", closeAll);

  const disclaimer = container.querySelector(".steam-disclaimer");
  const disclaimerClose = container.querySelector(".steam-disclaimer-close");

  const disclaimerAcknowledged = os.storage.get(StorageKeys.steamDisclaimerAcknowledged);
  if (disclaimerAcknowledged && disclaimer) {
    disclaimer.classList.add("hidden");
  }

  if (disclaimerClose && disclaimer) {
    disclaimerClose.addEventListener("mouseenter", () => steamAudio.playHover());
    disclaimerClose.addEventListener("click", () => {
      steamAudio.playSelect();
      disclaimer.classList.add("hidden");
      os.storage.set(StorageKeys.steamDisclaimerAcknowledged, true);
    });
  }
}

export function initStorePage(container, onLaunch, navigateTo, CDN_BASE_REF, imgObserver) {
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
    const thumb = createElement("div");
    thumb.className = "store-hero-thumb" + (i === 0 ? " active" : "");
    thumb.innerHTML = `<img src="${h.img}" />`;

    thumb.addEventListener("mouseenter", () => steamAudio.playHover());

    thumb.addEventListener("click", () => {
      steamAudio.playNavigate();
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

  heroPlayBtn.addEventListener("mouseenter", () => steamAudio.playHover());
  heroPlayBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    steamAudio.playSelect();
    onLaunch(heroPlayBtn.dataset.app);
  });

  const heroInfo = storePage.querySelector("#store-hero-info");
  if (heroInfo) {
    heroInfo.style.cursor = "pointer";
    heroInfo.addEventListener("mouseenter", () => steamAudio.playHover());
    heroInfo.addEventListener("click", (e) => {
      if (e.target.closest(".store-play-btn")) return;
      steamAudio.playNavigate();
      const appId = heroPlayBtn.dataset.app;
      navigateTo("library");
    });
  }

  const grid = storePage.querySelector("#store-games-grid");
  if (grid) {
    STORE_GAMES.forEach((g) => {
      const card = createElement("div");
      card.className = "store-game-card";
      card.innerHTML = `
  <div class="store-game-card-img">
    <img data-src="${g.icon}" alt="${g.title}" />
    <div class="store-port-corner">Webport</div>
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
      card.addEventListener("mouseenter", () => steamAudio.playHover());

      card.querySelector(".store-card-play-btn").addEventListener("mouseenter", (e) => e.stopPropagation());
      card.querySelector(".store-card-play-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        steamAudio.playSelect();
        onLaunch(g.app);
      });
      card.addEventListener("click", (e) => {
        if (e.target.closest(".store-card-play-btn")) return;
        steamAudio.playNavigate();
        navigateTo("library");
      });
      grid.appendChild(card);
      imgObserver.observe(card.querySelector("img[data-src]"));
    });
  }

  suppressAdBlocks(storePage);
  injectAdsterraAd("store-ad-slot-1", ADSTERRA_KEYS.storeWide, 300, 160, 0);
  injectAdsterraAd("store-ad-slot-2", ADSTERRA_KEYS.storeRect, 600, 160, 1000);
}

window.addEventListener("steam-settings-changed", (e) => {
  if (e.detail.setting === "gridSize") {
    document.documentElement.style.setProperty("--steam-grid-min", getGridMin(e.detail.value));
  }
});
