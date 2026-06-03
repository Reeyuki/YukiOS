import { refreshIcons } from "../shared/contextMenu.js";
import { customAlert, customPrompt } from "../shared/dialogs.js";
import { SteamDataManager, _launcher, _desktopUI } from "./games.js";
import { observeLazyImages } from "./games.js";
import { WindowHelper } from "../utils/WindowHelper.js";
import { StorageKeys } from "../settings/settings.js";
import { buildSteamShell, initDropdowns, initStorePage, getCdnBase, initSettingsPage } from "./steam.js";
import { resolveIconUrl } from "../shared/assetResolver.js";
import { fetchLiveStats } from "../analytics.js";
import { appMap } from "./gamesList.js";
import { os } from "../os/index.js";

export class GameUI {
  constructor(renderer) {
    this.renderer = renderer;
  }

  _rebuildSidebar(container, onLaunch) {
    const allGames = this.renderer.getGames();
    const hidden = SteamDataManager.getHidden();

    const sidebarHiddenSection = container.querySelector(".sidebar-hidden-section");

    const visibleGames = allGames.filter((g) => !hidden.includes(g.app));
    this._renderSidebarChunked(container, visibleGames, onLaunch);

    this.renderer._archiveGamesCache.forEach((archiveGame) => {
      this.renderer._appendArchiveGameToSidebar(container, archiveGame, onLaunch);
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
        this.renderer.gameRenderer.renderArchiveGameOverview(container, game, onLaunch);
      } else {
        this.renderer.gameRenderer.renderGameOverview(container, appId, onLaunch);
      }
    });
    item.addEventListener("dblclick", () => {
      if (isArchive) {
        this.renderer.gameLauncher.showGameOverlay(game.title, game.url);
      } else {
        onLaunch(appId);
      }
    });
    item.oncontextmenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const launchFn = isArchive ? () => this.renderer.gameLauncher.showGameOverlay(game.title, game.url) : onLaunch;
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
        if (this.renderer.currentGame) this._setActiveSidebarItem(container, this.renderer.currentGame);
        else if (this.renderer.currentArchiveGame)
          this._setActiveSidebarItem(container, this.renderer.currentArchiveGame.appId);
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
      this.renderer.gameRenderer.renderGrid(container, onLaunch);
      this._rebuildSidebar(container, onLaunch);
    };
    menu.querySelector("#ctx-hide").onclick = () => {
      SteamDataManager.toggleHide(appId);
      this.renderer.gameRenderer.renderGrid(container, onLaunch);
      this._rebuildSidebar(container, onLaunch);
    };
    menu.querySelector("#ctx-new-col").onclick = async () => {
      const name = await customPrompt("Enter collection name:");
      if (name && name.trim()) {
        SteamDataManager.createCollection(name.trim());
        SteamDataManager.addToCollection(name.trim(), appId);
        this.renderer.gameRenderer.renderGrid(container, onLaunch);
      }
    };
    menu.querySelectorAll(".ctx-col-item").forEach((item) => {
      item.onclick = () => {
        SteamDataManager.addToCollection(item.dataset.name, appId);
        this.renderer.gameRenderer.renderGrid(container, onLaunch);
      };
    });

    menu.querySelector("#ctx-add-home").onclick = async () => {
      const game =
        this.renderer.getGames().find((g) => g.app === appId) ||
        this.renderer._archiveGamesCache.find((g) => g.appId === appId);
      if (!game) return;
      const title = game.title;
      const icon = game.icon || game.thumb;
      const fileName = `${title}.desktop`;
      const fileContent = JSON.stringify({ app: "steamApp", steamGameId: appId, name: title, path: icon });

      try {
        await os.fs.createFile(["Desktop"], fileName, fileContent, "text");
        if (_desktopUI) {
          await _desktopUI.createDesktopFileIcon(fileName);
          os.notify.send(`"${title}" added to home screen`);
        }
      } catch (err) {
        console.error("Failed to add to home screen:", err);
        os.notify.send(`Failed to add "${title}" to home screen`);
      }
    };

    menu.querySelector("#ctx-report").onclick = async () => {
      const game = this.renderer.getGames().find((g) => g.app === appId);
      const title = game ? game.title : appId;
      const reason = await customPrompt(`Report ${title} as broken? Please provide a reason:`);
      if (reason === null) return;

      try {
        const res = await fetch("https://analytics.liventcord-a60.workers.dev/api/report-broken", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appId, title, reason })
        });
        if (res.ok) {
          customAlert("Thank you! Your report has been sent to the developers.");
        } else {
          customAlert("Failed to send report. Please try again later.");
        }
      } catch (err) {
        customAlert("An error occurred while sending the report.");
      }
    };
  }

  _attachGridDelegation(container, onLaunch) {
    const mainContent = container.querySelector(".steam-main-content");
    const popover = container.querySelector(".steam-game-popover");
    const stats = SteamDataManager.getStats();
    const allGames = this.renderer.getGames();
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
        this.renderer.gameRenderer.renderGameOverview(container, appId, onLaunch);
        return;
      }
      const archiveGame = this.renderer._archiveGamesCache.find((g) => g.appId === appId);
      if (archiveGame) {
        this.renderer.gameRenderer.renderArchiveGameOverview(container, archiveGame, onLaunch);
      }
    });

    mainContent.addEventListener("dblclick", async (e) => {
      const card = e.target.closest(".steam-game-card");
      if (!card) return;
      const appId = card.dataset.app;
      const cardUrl = card.dataset.url || null;
      if (cardUrl) {
        const title = card.querySelector(".steam-game-title")?.textContent || appId;
        await this.renderer.gameLauncher.showGameOverlay(title, cardUrl);
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

  render(container, onLaunch, wm = null, focusCollection = null) {
    SteamDataManager.setupDefaultCollections();
    const allGames = this.renderer.getGames();
    const hidden = SteamDataManager.getHidden();
    const visibleGames = allGames.filter((g) => !hidden.includes(g.app));
    const hiddenGames = allGames.filter((g) => hidden.includes(g.app));
    const username = os.storage.get(StorageKeys.username) || "Reeyuki";
    const profilePic = os.storage.get(StorageKeys.profilePicture) || resolveIconUrl("static/icons/guest.webp");

    container.classList.add("steam-app-root");
    container.style.padding = "0";

    const winRootn = container.closest(".window");
    const existingControls = winRootn?.querySelector(".window-controls");
    if (existingControls && container.contains(existingControls)) {
      winRootn.appendChild(existingControls);
    }

    container.innerHTML = buildSteamShell(container, username, profilePic, hiddenGames.length, getCdnBase());

    const winRoot = container.closest(".window");
    if (winRoot) {
      const slot = container.querySelector(".steam-window-controls-slot");
      if (slot) {
        slot.innerHTML = wm ? wm.getWindowControls() : "";
      }

      const header = winRoot.querySelector(".window-header:not(.steam-top-bar)");
      if (header) header.style.display = "none";
    }

    const loader = container.querySelector(".steam-loading-screen");
    const main = container.querySelector(".steam-main");
    const isFirstOpen = !this.renderer._hasRendered;
    this.renderer._hasRendered = true;

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
        this.renderer.gameRenderer.renderGrid(container, onLaunch, focusCollection);
        initSettingsPage(container);
        setTimeout(revealUI, 600);
      }, 50);
    } else {
      this.renderer.gameRenderer.renderGrid(container, onLaunch, focusCollection);
      initSettingsPage(container);
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
    const settingsPage = container.querySelector(".steam-settings-page");
    const scrollTop = container.querySelector(".steam-scroll-top");
    const tabs = container.querySelectorAll(".steam-tab");

    const updatePageUI = (page) => {
      [libraryPage, storePage, communityPage, downloadsPage, settingsPage].forEach(
        (p) => p && p.classList.add("hidden")
      );
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
      } else if (page === "settings") {
        settingsPage.classList.remove("hidden");
        initSettingsPage(container);
      }
    };

    const navigateTo = (page) => {
      if (this.renderer.history[this.renderer.historyIndex] !== page) {
        this.renderer.history = this.renderer.history.slice(0, this.renderer.historyIndex + 1);
        this.renderer.history.push(page);
        this.renderer.historyIndex++;
        os.storage.set(StorageKeys.steamLastPage, page);
      }
      updatePageUI(page);
    };

    initDropdowns(container, navigateTo, this.openFriendsWindow.bind(this), wm);

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        this.renderer.currentGame = null;
        this.renderer.currentArchiveGame = null;
        navigateTo(tab.dataset.page);
        this.renderer.gameRenderer.renderGrid(container, onLaunch);
        if (tab.dataset.page === "store") {
          const sp = container.querySelector(".steam-store-page");
          if (sp && !sp._storeInited) {
            sp._storeInited = true;
            initStorePage(container, onLaunch, navigateTo, getCdnBase(), this.renderer._imgObserver);
          }
        }
      });
    });

    container.querySelector(".steam-back-btn").addEventListener("click", () => {
      if (this.renderer.historyIndex > 0) {
        this.renderer.historyIndex--;
        updatePageUI(this.renderer.history[this.renderer.historyIndex]);
      }
    });

    container.querySelector(".steam-forward-btn").addEventListener("click", () => {
      if (this.renderer.historyIndex < this.renderer.history.length - 1) {
        this.renderer.historyIndex++;
        updatePageUI(this.renderer.history[this.renderer.historyIndex]);
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
      const archiveMatches = this.renderer._archiveGamesCache.filter((g) => g.title.toLowerCase().includes(query));

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
            this.renderer.gameRenderer.renderArchiveGameOverview(container, g, onLaunch);
          } else {
            this.renderer.gameRenderer.renderGameOverview(container, appId, onLaunch);
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

    if (!this.renderer._ctrlFBound) {
      this.renderer._ctrlFBound = true;

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

    const _lastPage = os.storage.get(StorageKeys.steamLastPage);
    const _isReturning = !!os.storage.get(StorageKeys.steamVisited);
    os.storage.set(StorageKeys.steamVisited, "1");

    if (_isReturning && (_lastPage === "library" || _lastPage === "store")) {
      this.renderer.currentGame = null;
      this.renderer.currentArchiveGame = null;
      updatePageUI(_lastPage);
      if (_lastPage === "store") {
        const sp = container.querySelector(".steam-store-page");
        if (sp) sp._storeInited = true;
        initStorePage(container, onLaunch, navigateTo, getCdnBase(), this.renderer._imgObserver);
      } else {
        this.renderer.gameRenderer.renderGrid(container, onLaunch);
      }
    } else {
      const sp = container.querySelector(".steam-store-page");
      if (sp) sp._storeInited = true;
      updatePageUI("store");
      initStorePage(container, onLaunch, navigateTo, getCdnBase(), this.renderer._imgObserver);
    }
  }

  openFriendsWindow(wm) {
    if (!wm) return;
    const winId = "steam-friends-win";
    const existing = document.getElementById(winId);
    if (existing) {
      wm.bringToFront(existing);
      return;
    }

    const windowHelper = new WindowHelper(wm);
    const username = os.storage.get(StorageKeys.username) || "Reeyuki";
    const profilePic = os.storage.get(StorageKeys.profilePicture) || resolveIconUrl("static/icons/guest.webp");

    const content = `
      <div class="window-content" style="display:flex; flex-direction:column; height:100%; color:#dcdedf;">
        <div class="friends-header" style="padding: 15px; background: rgba(0,0,0,0.2); display: flex; align-items: center; gap: 12px;">
          <div class="friends-profile-img" style="width: 48px; height: 48px; border: 2px solid #57cbde; padding: 2px; background: #171a21;">
            <img src="${profilePic}" loading="lazy" style="width:100%; height:100%;" />
          </div>
          <div class="friends-profile-info">
            <div class="friends-name" style="font-size: 14px; font-weight: 700; color: #57cbde;">${username}</div>
            <div class="friends-status" style="font-size: 12px; color: #66c0f4;">Online</div>
          </div>
        </div>
        <div style="padding: 8px 15px; background: rgba(0,0,0,0.15);">
          <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #b8b6b4;">Online Now</span>
        </div>
        <div class="friends-live-panel" style="flex: 1; overflow-y: auto; padding: 12px 15px;">
          <div style="color: #898989; font-size: 12px; text-align: center; padding-top: 24px;">Loading...</div>
        </div>
      </div>
    `;

    const win = windowHelper.createAndMountWindow(winId, "Friends List", content, "301px", "401px", {
      className: "window-root",
      style: { background: "#1b2838" },
      icon: "fas fa-user-friends"
    });

    const downloadBtn = win.querySelector(".download-btn");
    if (downloadBtn) downloadBtn.remove();

    wm.bringToFront(win);
    this._loadFriendsLiveStats(win);
  }

  async _loadFriendsLiveStats(win) {
    const panel = win.querySelector(".friends-live-panel");
    if (!panel) return;

    const stats = await fetchLiveStats();
    if (!win.isConnected) return;

    if (!stats) {
      panel.innerHTML = `<div style="color: #898989; font-size: 12px; text-align: center; padding-top: 24px;">Could not load live stats.</div>`;
      return;
    }

    const appLookup = new Map();
    for (const [key, val] of Object.entries(appMap)) {
      appLookup.set(key.toLowerCase(), { id: key, ...val });
    }

    const renderAppIcon = (appId) => {
      const entry = appLookup.get(appId.toLowerCase());
      if (!entry) {
        return `<div style="width:24px;height:24px;background:#2a475e;border-radius:4px;flex-shrink:0;"></div>`;
      }
      const icon = entry.icon;
      if (!icon) {
        return `<i class="fas fa-gamepad" style="font-size:15px;color:#57cbde;width:24px;text-align:center;flex-shrink:0;"></i>`;
      }
      if (typeof icon === "string" && icon.startsWith("fa")) {
        return `<i class="${icon}" style="font-size:15px;color:#57cbde;width:24px;text-align:center;flex-shrink:0;"></i>`;
      }
      return `<img src="${resolveIconUrl(icon)}" style="width:24px;height:24px;border-radius:4px;object-fit:cover;flex-shrink:0;" />`;
    };

    const formatAppName = (appId) => {
      const entry = appLookup.get(appId.toLowerCase());
      if (entry?.title) return entry.title;
      return appId.replace(/app$/i, " App").replace(/([a-z])([A-Z])/g, "$1 $2");
    };

    const topApps = (stats.top_active_apps || []).slice(0, 5);
    const trendingHtml = topApps.length
      ? topApps
          .map(
            ({ app, count }) => `
        <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
          ${renderAppIcon(app)}
          <div style="flex:1;min-width:0;">
            <div style="font-size:12px;color:#dcdedf;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${formatAppName(app)}</div>
          </div>
          <div style="font-size:11px;color:#66c0f4;font-weight:600;flex-shrink:0;">${count}</div>
        </div>`
          )
          .join("")
      : `<div style="color:#898989;font-size:12px;">No trending data.</div>`;

    panel.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:16px;">
        <div style="flex:1;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:10px 6px;text-align:center;">
          <div style="font-size:24px;font-weight:700;color:#57cbde;line-height:1.1;">${stats.active_users_5min}</div>
          <div style="font-size:10px;color:#898989;text-transform:uppercase;margin-top:3px;letter-spacing:.4px;">Active Users</div>
        </div>
        <div style="flex:1;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:10px 6px;text-align:center;">
          <div style="font-size:24px;font-weight:700;color:#57cbde;line-height:1.1;">${stats.active_sessions}</div>
          <div style="font-size:10px;color:#898989;text-transform:uppercase;margin-top:3px;letter-spacing:.4px;">Active Sessions</div>
        </div>
      </div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#b8b6b4;margin-bottom:8px;letter-spacing:.5px;">Trending Now</div>
      ${trendingHtml}
    `;
  }
}
