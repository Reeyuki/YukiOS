import { refreshIcons, showContextMenu } from "../shared/contextMenu.js";
import { SteamDataManager, desktopUI, steamAudio, refreshSteamUI, updateSteamProfileCoins } from "./games.js";
import { observeLazyImages } from "./games.js";
import { buildSteamShell, initDropdowns, initStorePage, getCdnBase, initSettingsPage } from "./steam.js";
import { KeybindManager } from "../keybindManager.js";
import { sendLaunchAnalytics, getAnalyticsBase } from "../analytics.js";
import {
  renderFriendsListPanel,
  renderFriendsPage,
  renderCommunityPage,
  renderSelfProfilePage,
  renderProfilePage,
  renderGamesPage,
  renderAchievementsPage,
  renderEditProfilePage,
  renderLoginPage,
  renderQuestsPage,
  renderStorePage,
  renderRequestsPanel,
  renderSocialDisabledPage,
  openStatusPicker
} from "./steamSocial.js";
import { fetchFriends, fetchMessages, removeFriend, sendMessage } from "../social/friendsApi.js";
import { $, $$, bindEvent, setText, setHTML, createElement } from "../shared/domUtils.js";
import { isSocialDisabled } from "../social/socialSettings.js";
import { getCurrentUser } from "../desktopui/startMenu.js";
import { resolveAppId } from "../utils/utils.js";
import { resolveAvatarUrl } from "../social/avatarResolver.js";
import { registerLiveIdentity, getLiveUserId } from "../social/userIdentity.js";
import { fetchDiscover, SOCIAL_BASE } from "../social/socialApi.js";
import { getPresence } from "../social/presence.js";
import { BusEvents } from "../core/EventBus.js";

import { StorageKeys, os } from "../framework.js";
import { windowMakeDraggable } from "../windowManager/makeDraggable.js";
export class GameUI {
  constructor(renderer) {
    this.renderer = renderer;
  }

  rebuildSidebar(container, onLaunch) {
    const allGames = this.renderer.getGames();
    const hidden = SteamDataManager.getHidden();

    const sidebarHiddenSection = container.querySelector(".sidebar-hidden-section");

    const visibleGames = allGames.filter((g) => !hidden.includes(g.app));
    this.renderSidebarChunked(container, visibleGames, onLaunch);
    this.appendArchiveSidebarGames(container, onLaunch);

    if (sidebarHiddenSection) {
      const hiddenGames = allGames.filter((g) => hidden.includes(g.app));
      if (hiddenGames.length === 0) {
        sidebarHiddenSection.style.display = "none";
      } else {
        sidebarHiddenSection.style.display = "block";
        const countEl = sidebarHiddenSection.querySelector(".sidebar-hidden-count");
        if (countEl) countEl.textContent = hiddenGames.length;
        this.renderHiddenSidebar(container, hiddenGames, onLaunch);
      }
    }
  }

  appendArchiveSidebarGames(container, onLaunch) {
    (this.renderer.archiveGamesCache || []).forEach((archiveGame) => {
      this.renderer.appendArchiveGameToSidebar(container, archiveGame, onLaunch);
    });
  }

  setActiveSidebarItem(container, appId) {
    container.querySelectorAll(".sidebar-game-item").forEach((item) => {
      item.classList.toggle("active", item.dataset.app === appId);
    });
  }

  makeSidebarItem(game, container, onLaunch, isArchive = false) {
    const appId = isArchive ? game.appId : game.app;
    const title = game.title;
    const icon = isArchive ? game.thumb : game.icon;
    const item = createElement("div");
    item.className = "sidebar-game-item";
    item.dataset.app = appId;
    item.innerHTML = icon
      ? `<img data-src="${icon}" /><span>${title}</span>`
      : `<i class="fas fa-gamepad" style="font-size:16px;color:var(--text-secondary);flex-shrink:0;"></i><span>${title}</span>`;

    item.addEventListener("click", () => {
      steamAudio.playSelect();
      if (isArchive) {
        this.renderer.gameRenderer.renderArchiveGameOverview(container, game, onLaunch);
      } else {
        this.renderer.gameRenderer.renderGameOverview(container, appId, onLaunch);
      }
    });
    item.addEventListener("mouseenter", () => {
      steamAudio.playHover();
    });
    item.addEventListener("dblclick", () => {
      if (isArchive) {
        const gameId = game.url
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
        os.app.launchGame(gameId, false, { source: game.url, originalName: game.title, analyticsBase });
      } else {
        onLaunch(appId);
      }
    });
    item.oncontextmenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const launchFn = isArchive
        ? () => {
            const gameId = game.url
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
            os.app.launchGame(gameId, false, { source: game.url, originalName: game.title, analyticsBase });
          }
        : onLaunch;
      this.showContextMenu(e, appId, container, launchFn);
    };
    return item;
  }

  renderSidebarChunked(container, games, onLaunch) {
    const sidebarList = container.querySelector(".sidebar-game-list");
    if (!sidebarList) return;
    sidebarList.innerHTML = "";

    const CHUNK = 50;
    let index = 0;

    const renderChunk = (deadline) => {
      let hasBudget = !deadline || index === 0 || deadline.timeRemaining() > 2;
      while (index < games.length && hasBudget) {
        const end = Math.min(index + CHUNK, games.length);
        const fragment = document.createDocumentFragment();
        for (let i = index; i < end; i++) {
          fragment.appendChild(this.makeSidebarItem(games[i], container, onLaunch, false));
        }
        sidebarList.appendChild(fragment);
        observeLazyImages(sidebarList);
        index = end;
        if (!deadline) break;
        hasBudget = deadline.timeRemaining() > 2;
      }
      if (index < games.length) {
        requestIdleCallback(renderChunk, { timeout: 200 });
      } else {
        if (this.renderer.currentGame) this.setActiveSidebarItem(container, this.renderer.currentGame);
        else if (this.renderer.currentArchiveGame)
          this.setActiveSidebarItem(container, this.renderer.currentArchiveGame.appId);
      }
    };

    renderChunk();
  }

  renderHiddenSidebar(container, hiddenGames, onLaunch) {
    const hiddenList = container.querySelector(".sidebar-hidden-list");
    if (!hiddenList) return;
    hiddenList.innerHTML = "";
    hiddenGames.forEach((g) => {
      const item = this.makeSidebarItem(g, container, onLaunch, false);
      item.classList.add("sidebar-hidden-item");
      hiddenList.appendChild(item);
    });
    observeLazyImages(hiddenList);
  }

  navigateSidebar(container, onLaunch, direction) {
    const items = Array.from(container.querySelectorAll(".sidebar-game-list .sidebar-game-item")).filter(
      (item) => item.offsetParent !== null
    );
    if (items.length === 0) return;

    const currentIndex = items.findIndex((item) => item.classList.contains("active"));
    const nextIndex =
      currentIndex === -1
        ? direction > 0
          ? 0
          : items.length - 1
        : (currentIndex + direction + items.length) % items.length;

    const nextItem = items[nextIndex];
    if (!nextItem) return;

    nextItem.scrollIntoView({ block: "nearest" });
    nextItem.click();
  }

  navigateGamesList(container, onLaunch, direction) {
    const libraryPage = container.querySelector(".steam-library-page");
    if (!libraryPage) return;

    const cards = Array.from(libraryPage.querySelectorAll(".steam-game-card")).filter(
      (card) => card.offsetParent !== null
    );
    if (cards.length === 0) return;

    const currentAppId = this.renderer.currentGame || this.renderer.currentArchiveGame?.appId || null;
    const currentIndex = currentAppId ? cards.findIndex((card) => card.dataset.app === currentAppId) : -1;
    const nextIndex =
      currentIndex === -1
        ? direction > 0
          ? 0
          : cards.length - 1
        : (currentIndex + direction + cards.length) % cards.length;

    const nextCard = cards[nextIndex];
    if (!nextCard) return;

    nextCard.scrollIntoView({ block: "nearest", inline: "nearest" });
    nextCard.click();
  }

  initSidebarDrag(container) {
    const sidebar = container.querySelector(".steam-library-sidebar");
    if (!sidebar || sidebar.dragInited) return;
    sidebar.dragInited = true;

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
    <div class="steam-context-item" id="ctx-report" style="color: var(--error);"><i class="fas fa-bug" style="width:16px;margin-right:8px;opacity:0.6;"></i>Report broken game</div>
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
      this.rebuildSidebar(container, onLaunch);
    };
    menu.querySelector("#ctx-hide").onclick = () => {
      SteamDataManager.toggleHide(appId);
      this.renderer.gameRenderer.renderGrid(container, onLaunch);
      this.rebuildSidebar(container, onLaunch);
    };
    menu.querySelector("#ctx-new-col").onclick = async () => {
      const name = await os.dialog.prompt("Prompt", "Enter collection name:");
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
        this.renderer.archiveGamesCache.find((g) => g.appId === appId);
      if (!game) return;
      const title = game.title;
      const icon = game.icon || game.thumb;
      const fileName = `${title}.desktop`;
      const fileContent = JSON.stringify({ app: "steamApp", steamGameId: appId, name: title, path: icon });

      try {
        await os.fs.createFile(["Desktop"], fileName, fileContent, "text");
        if (desktopUI) {
          await desktopUI.createDesktopFileIcon(fileName);
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
      const reason = await os.dialog.prompt("Prompt", `Report ${title} as broken? Please provide a reason:`);
      if (reason === null) return;

      try {
        const res = await fetch(`${SOCIAL_BASE}/api/report-broken`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appId, title, reason })
        });
        if (res.ok) {
          os.dialog.alert("Alert", "Thank you! Your report has been sent to the developers.");
        } else {
          os.dialog.alert("Alert", "Failed to send report. Please try again later.");
        }
      } catch (err) {
        os.dialog.alert("Alert", "An error occurred while sending the report.");
      }
    };
  }

  attachGridDelegation(container, onLaunch) {
    const mainContent = container.querySelector(".steam-main-content");
    const popover = container.querySelector(".steam-game-popover");
    const stats = SteamDataManager.getStats();
    const allGames = this.renderer.getGames();
    const gameMap = new Map(allGames.map((g) => [g.app, g]));

    if (mainContent.steamDelegated) return;
    mainContent.steamDelegated = true;

    mainContent.addEventListener("click", (e) => {
      const card = e.target.closest(".steam-game-card");
      if (!card) return;
      popover.style.display = "none";
      const appId = card.dataset.app;
      const game = gameMap.get(appId);
      if (game) {
        steamAudio.playSelect();
        this.renderer.gameRenderer.renderGameOverview(container, appId, onLaunch);
        return;
      }
      const archiveGame = this.renderer.archiveGamesCache.find((g) => g.appId === appId);
      if (archiveGame) {
        steamAudio.playSelect();
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
        await os.app.launchGame(gameId, false, { source: cardUrl, originalName: title, analyticsBase });
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
        steamAudio.playHover();
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
    steamAudio.playSelect();
    SteamDataManager.setupDefaultCollections();
    const allGames = this.renderer.getGames();
    const hidden = SteamDataManager.getHidden();
    const visibleGames = allGames.filter((g) => !hidden.includes(g.app));
    const hiddenGames = allGames.filter((g) => hidden.includes(g.app));
    const user = getCurrentUser();
    const username = user.name;
    const profilePic = user.avatar;

    container.classList.add("steam-app-root");
    container.style.padding = "0";

    const winRootn = container.closest(".window");
    const existingControls = winRootn?.querySelector(".window-controls");
    if (existingControls && container.contains(existingControls)) {
      winRootn.appendChild(existingControls);
    }

    container.innerHTML = buildSteamShell(container, username, profilePic, hiddenGames.length, getCdnBase());

    resolveAvatarUrl(profilePic, "static/icons/guest.webp").then((url) => {
      const headerImg = container.querySelector(".steam-user-profile img");
      if (headerImg instanceof HTMLImageElement) headerImg.src = url;
    });

    updateSteamProfileCoins();

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
    const isFirstOpen = !this.renderer.hasRendered;
    this.renderer.hasRendered = true;

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
    const userPage = container.querySelector(".steam-user-page");
    const profilePage = container.querySelector(".steam-profile-page");
    const editPage = container.querySelector(".steam-edit-page");
    const loginPage = container.querySelector(".steam-login-page");
    const gamesPage = container.querySelector(".steam-games-page");
    const achievementsPage = container.querySelector(".steam-achievements-page");
    const questsPage = container.querySelector(".steam-quests-page");
    const shopPage = container.querySelector(".steam-shop-page");
    const friendsPage = container.querySelector(".steam-friends-page");
    const addressBar = container.querySelector(".steam-address-bar");
    let currentPage = null;
    const downloadsPage = container.querySelector(".steam-downloads-page");
    const settingsPage = container.querySelector(".steam-settings-page");
    const scrollTop = container.querySelector(".steam-scroll-top");
    const tabs = container.querySelectorAll(".steam-tab");

    const updatePageUI = (page) => {
      currentPage = page;
      [
        libraryPage,
        storePage,
        communityPage,
        userPage,
        profilePage,
        editPage,
        loginPage,
        gamesPage,
        achievementsPage,
        questsPage,
        shopPage,
        friendsPage,
        downloadsPage,
        settingsPage
      ].forEach((p) => p && p.classList.add("hidden"));
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
        if (isSocialDisabled()) {
          renderSocialDisabledPage(communityPage);
        } else {
          renderCommunityPage(communityPage, { onLaunch });
        }
      } else if (page === "user") {
        userPage.classList.remove("hidden");
        container.querySelector(".steam-tab[data-page='user']").classList.add("active");
        if (isSocialDisabled()) {
          renderSocialDisabledPage(userPage);
        } else {
          renderSelfProfilePage(userPage, {
            onLaunch,
            onShowGames: (uid) => {
              this.renderer.profileUserId = uid;
              navigateTo("games");
            },
            onShowAchievements: (uid) => {
              this.renderer.profileUserId = uid;
              navigateTo("achievements");
            },
            onShowQuests: () => navigateTo("quests"),
            onShowStore: () => navigateTo("shop")
          });
        }
      } else if (page === "profile") {
        profilePage.classList.remove("hidden");
        if (isSocialDisabled()) {
          renderSocialDisabledPage(profilePage);
        } else {
          renderProfilePage(profilePage, {
            userId: this.renderer.profileUserId,
            onLaunch,
            onShowGames: (uid) => {
              this.renderer.profileUserId = uid;
              navigateTo("games");
            },
            onShowAchievements: (uid) => {
              this.renderer.profileUserId = uid;
              navigateTo("achievements");
            }
          });
        }
      } else if (page === "games") {
        gamesPage.classList.remove("hidden");
        if (isSocialDisabled()) {
          renderSocialDisabledPage(gamesPage);
        } else {
          renderGamesPage(gamesPage, {
            userId: this.renderer.profileUserId,
            onLaunch
          });
        }
      } else if (page === "achievements") {
        achievementsPage.classList.remove("hidden");
        if (isSocialDisabled()) {
          renderSocialDisabledPage(achievementsPage);
        } else {
          renderAchievementsPage(achievementsPage, {
            userId: this.renderer.profileUserId,
            onLaunch
          });
        }
      } else if (page === "downloads") {
        downloadsPage.classList.remove("hidden");
      } else if (page === "settings") {
        settingsPage.classList.remove("hidden");
        initSettingsPage(container);
      } else if (page === "edit") {
        editPage.classList.remove("hidden");
        renderEditProfilePage(editPage);
      } else if (page === "login") {
        loginPage.classList.remove("hidden");
        renderLoginPage(loginPage);
      } else if (page === "quests") {
        questsPage.classList.remove("hidden");
        if (isSocialDisabled()) {
          renderSocialDisabledPage(questsPage);
        } else {
          renderQuestsPage(questsPage, {
            onShowLogin: () => navigateTo("login")
          });
        }
      } else if (page === "shop") {
        shopPage.classList.remove("hidden");
        if (isSocialDisabled()) {
          renderSocialDisabledPage(shopPage);
        } else {
          renderStorePage(shopPage, {
            onShowLogin: () => navigateTo("login")
          });
        }
      } else if (page === "friends" || page === "friends-add") {
        friendsPage.classList.remove("hidden");
        if (isSocialDisabled()) {
          renderSocialDisabledPage(friendsPage);
        } else {
          renderFriendsPage(friendsPage, {
            view: page === "friends-add" ? "add" : "list",
            userId: getLiveUserId(),
            onNavigate: (next) => navigateTo(next),
            onLaunch
          });
        }
      }
      let addressUrl = "";
      if (page === "community") addressUrl = "yukisteam://community";
      else if (page === "user") addressUrl = `yukisteam://profiles/${getLiveUserId() || "me"}`;
      else if (page === "edit") addressUrl = `yukisteam://profiles/${getLiveUserId() || "me"}/edit`;
      else if (page === "login") addressUrl = "yukisteam://login";
      else if (page === "profile") addressUrl = `yukisteam://profiles/${this.renderer.profileUserId || "unknown"}`;
      else if (page === "games") addressUrl = `yukisteam://profiles/${this.renderer.profileUserId || "unknown"}/games`;
      else if (page === "achievements")
        addressUrl = `yukisteam://profiles/${this.renderer.profileUserId || "unknown"}/achievements`;
      else if (page === "quests") addressUrl = "yukisteam://quests";
      else if (page === "shop") addressUrl = "yukisteam://shop";
      else if (page === "friends") addressUrl = `yukisteam://profiles/${getLiveUserId() || "me"}/friends`;
      else if (page === "friends-add") addressUrl = `yukisteam://profiles/${getLiveUserId() || "me"}/friends/add`;
      if (addressBar) {
        const addressText = addressBar.querySelector(".steam-address-text");
        if (addressUrl) {
          addressBar.classList.remove("hidden");
          if (addressText) addressText.textContent = addressUrl;
        } else {
          addressBar.classList.add("hidden");
        }
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

    if (!container.dataset.steamNavBound) {
      container.dataset.steamNavBound = "1";
      container.addEventListener("steam-navigate", (e) => {
        const page = e?.detail?.page;
        if (page) {
          if (e.detail.userId) this.renderer.profileUserId = e.detail.userId;
          navigateTo(page);
        }
      });
      const reloadBtn = addressBar && addressBar.querySelector(".steam-address-reload");
      if (reloadBtn) {
        reloadBtn.addEventListener("click", async () => {
          const socialPages = ["community", "user", "profile", "games", "achievements"];
          if (!currentPage || !socialPages.includes(currentPage)) return;
          updatePageUI(currentPage);
          reloadBtn.classList.add("is-refreshing");
          try {
            await fetchDiscover({ refresh: true });
            if (currentPage && socialPages.includes(currentPage)) updatePageUI(currentPage);
          } finally {
            reloadBtn.classList.remove("is-refreshing");
          }
        });
      }
    }

    if (!container.dataset.steamSocialEventsBound) {
      container.dataset.steamSocialEventsBound = "1";
      const steamWinEl = container.closest(".window");
      const refreshSteamProfile = () => {
        if (!steamWinEl || !steamWinEl.isConnected) return;
        refreshSteamUI();
        registerLiveIdentity().catch(() => {});
        const userPageEl = container.querySelector(".steam-user-page");
        if (userPageEl && !userPageEl.classList.contains("hidden")) {
          renderSelfProfilePage(userPageEl, {
            onLaunch,
            onShowGames: (uid) => {
              this.renderer.profileUserId = uid;
              navigateTo("games");
            },
            onShowAchievements: (uid) => {
              this.renderer.profileUserId = uid;
              navigateTo("achievements");
            },
            onShowQuests: () => navigateTo("quests"),
            onShowStore: () => navigateTo("shop")
          });
        }
      };
      const refreshSocialPages = () => {
        if (isSocialDisabled()) return;
        if (!steamWinEl || !steamWinEl.isConnected) return;
        const communityEl = container.querySelector(".steam-community-page");
        const userPageEl = container.querySelector(".steam-user-page");
        const profileEl = container.querySelector(".steam-profile-page");
        if (communityEl && !communityEl.classList.contains("hidden")) {
          delete communityEl.dataset.steamCommunityRendered;
          renderCommunityPage(communityEl, { onLaunch });
        }
        if (userPageEl && !userPageEl.classList.contains("hidden")) {
          renderSelfProfilePage(userPageEl, {
            onLaunch,
            onShowGames: (uid) => {
              this.renderer.profileUserId = uid;
              navigateTo("games");
            },
            onShowAchievements: (uid) => {
              this.renderer.profileUserId = uid;
              navigateTo("achievements");
            },
            onShowQuests: () => navigateTo("quests"),
            onShowStore: () => navigateTo("shop")
          });
        }
        if (profileEl && !profileEl.classList.contains("hidden")) {
          renderProfilePage(profileEl, {
            userId: this.renderer.profileUserId,
            onLaunch,
            onShowGames: (uid) => {
              this.renderer.profileUserId = uid;
              navigateTo("games");
            },
            onShowAchievements: (uid) => {
              this.renderer.profileUserId = uid;
              navigateTo("achievements");
            }
          });
        }
        const questsEl = container.querySelector(".steam-quests-page");
        if (questsEl && !questsEl.classList.contains("hidden")) {
          renderQuestsPage(questsEl, { onShowLogin: () => navigateTo("login") });
        }
        const shopEl = container.querySelector(".steam-shop-page");
        if (shopEl && !shopEl.classList.contains("hidden")) {
          renderStorePage(shopEl, { onShowLogin: () => navigateTo("login") });
        }
      };
      os.events.on(BusEvents.PROFILE_UPDATED, refreshSteamProfile);
      os.events.on(BusEvents.SESSION_INITIALIZED, refreshSteamProfile);
      os.events.on(BusEvents.SOCIAL_PRESENCE_CHANGED, refreshSocialPages);
      os.events.on(BusEvents.SOCIAL_DND_CHANGED, refreshSocialPages);
      if (steamWinEl) {
        steamWinEl.addEventListener("remove", () => {
          os.events.off(BusEvents.PROFILE_UPDATED, refreshSteamProfile);
          os.events.off(BusEvents.SESSION_INITIALIZED, refreshSteamProfile);
          os.events.off(BusEvents.SOCIAL_PRESENCE_CHANGED, refreshSocialPages);
          os.events.off(BusEvents.SOCIAL_DND_CHANGED, refreshSocialPages);
        });
      }
    }

    initDropdowns(container, navigateTo, this.openFriendsWindow.bind(this), wm);

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        steamAudio.playNavigate();
        this.renderer.currentGame = null;
        this.renderer.currentArchiveGame = null;
        navigateTo(tab.dataset.page);
        this.renderer.gameRenderer.renderGrid(container, onLaunch);
        if (tab.dataset.page === "store") {
          const sp = container.querySelector(".steam-store-page");
          if (sp && !sp.storeInited) {
            sp.storeInited = true;
            initStorePage(container, onLaunch, navigateTo, getCdnBase(), this.renderer.imgObserver);
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
        this.renderSidebarChunked(container, visibleGames, onLaunch);
        this.appendArchiveSidebarGames(container, onLaunch);
        const gridCards = container.querySelectorAll(".steam-game-card");
        gridCards.forEach((card) => {
          card.style.display = "";
        });
        return;
      }

      const matchedGames = visibleGames.filter((g) => g.title.toLowerCase().includes(query));
      const archiveMatches = this.renderer.archiveGamesCache.filter((g) => g.title.toLowerCase().includes(query));

      sidebarList.innerHTML = "";
      [...matchedGames, ...archiveMatches].forEach((g) => {
        const isArchive = !g.app;
        const appId = g.app || g.appId;
        const title = g.title;
        const icon = g.icon || g.thumb;
        const item = createElement("div");
        item.className = "sidebar-game-item";
        item.dataset.app = appId;
        item.innerHTML = icon
          ? `<img data-src="${icon}" /><span>${title}</span>`
          : `<i class="fas fa-gamepad" style="font-size:16px;color:var(--text-secondary);flex-shrink:0;"></i><span>${title}</span>`;
        item.addEventListener("click", () => {
          steamAudio.playSelect();
          if (isArchive) {
            this.renderer.gameRenderer.renderArchiveGameOverview(container, g, onLaunch);
          } else {
            this.renderer.gameRenderer.renderGameOverview(container, appId, onLaunch);
          }
        });
        item.addEventListener("mouseenter", () => {
          steamAudio.playHover();
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

    this.renderSidebarChunked(container, visibleGames, onLaunch);
    this.renderHiddenSidebar(container, hiddenGames, onLaunch);

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

    this.initSidebarDrag(container);

    container.querySelector(".steam-downloads-btn").addEventListener("click", () => navigateTo("downloads"));
    container.querySelector(".steam-friends-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      this.openFriendsWindow(wm);
    });

    if (!this.renderer.ctrlFBound) {
      this.renderer.ctrlFBound = true;

      document.addEventListener(
        "keydown",
        (e) => {
          if (!KeybindManager.matches(e, "games.search")) return;

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

    if (!this.renderer.arrowNavBound) {
      this.renderer.arrowNavBound = true;

      document.addEventListener(
        "keydown",
        (e) => {
          const root = container;
          if (!root || !document.body.contains(root)) return;
          if (root.offsetParent === null) return;

          const active = document.activeElement;
          if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)) {
            return;
          }

          const sidebar = root.querySelector(".steam-library-sidebar");
          if (!sidebar || sidebar.classList.contains("hidden")) return;

          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            this.navigateGamesList(root, onLaunch, e.key === "ArrowRight" ? 1 : -1);
          } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            this.navigateSidebar(root, onLaunch, e.key === "ArrowDown" ? 1 : -1);
          }
        },
        true
      );
    }

    const lastPage = os.storage.get(StorageKeys.steamLastPage);
    const isReturning = !!os.storage.get(StorageKeys.steamVisited);
    os.storage.set(StorageKeys.steamVisited, "1");

    if (isReturning && (lastPage === "library" || lastPage === "store")) {
      this.renderer.currentGame = null;
      this.renderer.currentArchiveGame = null;
      updatePageUI(lastPage);
      if (lastPage === "store") {
        const sp = container.querySelector(".steam-store-page");
        if (sp) sp.storeInited = true;
        initStorePage(container, onLaunch, navigateTo, getCdnBase(), this.renderer.imgObserver);
      } else {
        this.renderer.gameRenderer.renderGrid(container, onLaunch);
      }
    } else {
      const sp = container.querySelector(".steam-store-page");
      if (sp) sp.storeInited = true;
      updatePageUI("store");
      initStorePage(container, onLaunch, navigateTo, getCdnBase(), this.renderer.imgObserver);
    }
  }

  async openFriendsWindow(wm) {
    if (isSocialDisabled()) {
      os.notify.send("Social features are disabled", "Enable them in Steam Settings to use Friends & Chat.", {
        type: "info"
      });
      return;
    }
    if (!wm) return;
    this.wm = wm;
    const winId = "steam-friends-win";
    const existing = $("#" + winId);
    if (existing) {
      wm.bringToFront(existing);
      return;
    }

    const user = getCurrentUser();
    const username = user.name;
    const profilePic = user.avatar;

    const resolvedProfilePic = await resolveAvatarUrl(profilePic, "static/icons/guest.webp");

    const presence = getPresence();
    const statusText = presence === "invisible" ? "Invisible" : presence === "offline" ? "Offline" : "Online";
    const statusCls =
      presence === "invisible"
        ? "friends-status-text--invisible"
        : presence === "offline"
          ? "friends-status-text--offline"
          : "friends-status-text--online";

    const bannerDismissed = !!os.storage.get(StorageKeys.steamFriendsBannerDismissed);

    const content = `
      <div class="window-content steam-friends-window" style="display:flex; flex-direction:column; height:100%; color:var(--text-primary);">
        <div class="friends-profile-header">
          <div class="friends-profile-img">
            <img src="${resolvedProfilePic}" loading="lazy" />
          </div>
          <div class="friends-profile-info">
            <div class="friends-name-line">
              <span class="friends-name">${username}</span>
              <button type="button" class="steam-status-picker-btn steam-status-picker-btn--presence"><i class="fas fa-chevron-down"></i></button>
            </div>
            <div class="friends-status"><span class="friends-status-text ${statusCls}">${statusText}</span></div>
          </div>
        </div>
        ${
          bannerDismissed
            ? ""
            : `
        <div class="steam-friends-banner">
          <span>Drag friends &amp; favorites here for quick access</span>
          <button type="button" class="steam-friends-banner-gotit" data-friends-banner-close>GOT IT!</button>
        </div>`
        }
        <div class="steam-friends-head">
          <div class="steam-friends-head-row">
            <span class="steam-friends-title">FRIENDS</span>
            <div class="steam-friends-actions">
              <button type="button" class="steam-friends-icon-btn" data-friends-search-toggle title="Search friends"><i class="fas fa-search"></i></button>
              <button type="button" class="steam-friends-add-btn" data-friends-requests title="Friend Requests"><i class="fas fa-user-plus"></i><span class="friends-requests-bubble"></span></button>
            </div>
          </div>
          <div class="steam-friends-search" data-friends-search>
            <i class="fas fa-search"></i>
            <input type="text" data-friends-search-input placeholder="Search friends..." />
          </div>
        </div>
        <div class="friends-requests-inline" data-friends-requests-panel hidden></div>
        <div class="friends-live-panel">
          <div style="color: var(--text-secondary); font-size: 12px; text-align: center; padding-top: 24px;">Loading...</div>
        </div>
      </div>
    `;

    const win = os.window.create(winId, "Friends List", "380px", "520px", {
      className: "window-root",
      style: { background: "var(--bg-secondary)" },
      icon: "fas fa-user-friends",
      skipHeader: true,
      skipAutoSetup: true
    });

    const headerHtml = wm.utils.generateWindowHeader("Friends List", "fas fa-user-friends");
    win.insertAdjacentHTML("afterbegin", headerHtml);

    const contentDiv = createElement("div");
    contentDiv.className = "window-content";
    contentDiv.style.cssText = "width:100%; height:100%; overflow:hidden; position:relative;";
    contentDiv.innerHTML = content;
    win.appendChild(contentDiv);

    wm.mountWindow(win, winId, "Friends List", "fas fa-user-friends");

    const downloadBtn = win.querySelector(".download-btn");
    if (downloadBtn) downloadBtn.remove();

    wm.bringToFront(win);

    windowMakeDraggable(win, wm);
    wm.makeResizable(win);
    wm.setupWindowControls(win);
    const addBtn = win.querySelector(".steam-friends-add-btn");
    if (addBtn) {
      const navigateToFriends = () => {
        const container = $("#games-app-container");
        if (container) {
          container.dispatchEvent(
            new CustomEvent("steam-navigate", { detail: { page: "friends-add", userId: getLiveUserId() } })
          );
        }
        const steamWin = $("#games-app-win");
        if (steamWin && this.wm) this.wm.bringToFront(steamWin);
        if (win) wm.close(win);
      };
      const toggleRequestsInline = () => {
        const panel = win.querySelector("[data-friends-requests-panel]");
        if (!panel) return;
        const opening = panel.hidden;
        panel.hidden = false;
        panel.classList.toggle("friends-requests-inline--open", opening);
        if (opening) {
          const reloadRequests = () =>
            renderRequestsPanel(panel, {
              onChange: reloadRequests,
              onOpenContextMenu: (event, request) => this.showFriendContextMenu(event, request)
            }).catch(() => {});
          reloadRequests();
        }
      };
      bindEvent(addBtn, "dblclick", (e) => {
        if (e.preventDefault) e.preventDefault();
        navigateToFriends();
      });
      let clickTimer = null;
      bindEvent(addBtn, "click", () => {
        if (clickTimer) {
          clearTimeout(clickTimer);
          clickTimer = null;
          return;
        }
        clickTimer = setTimeout(() => {
          clickTimer = null;
          toggleRequestsInline();
        }, 220);
      });
    }
    const bannerClose = win.querySelector("[data-friends-banner-close]");
    if (bannerClose) {
      bindEvent(bannerClose, "click", () => {
        os.storage.set(StorageKeys.steamFriendsBannerDismissed, "true");
        const banner = win.querySelector(".steam-friends-banner");
        if (banner) banner.remove();
      });
    }
    const searchToggle = win.querySelector("[data-friends-search-toggle]");
    const searchWrap = win.querySelector("[data-friends-search]");
    const searchInput = win.querySelector("[data-friends-search-input]");
    if (searchToggle && searchWrap) {
      bindEvent(searchToggle, "click", () => {
        const open = searchWrap.classList.toggle("steam-friends-search--open");
        searchToggle.classList.toggle("steam-friends-icon-btn--active", open);
        if (open && searchInput) searchInput.focus();
      });
    }
    if (searchInput) {
      let searchDebounce = null;
      bindEvent(searchInput, "input", () => {
        clearTimeout(searchDebounce);
        const query = searchInput.value;
        searchDebounce = setTimeout(() => this.loadFriendsPanel(win, query), 250);
      });
    }
    const pickerBtn = win.querySelector(".steam-status-picker-btn--presence");
    if (pickerBtn) {
      pickerBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openStatusPicker(e);
      });
    }
    const statusTextEl = win.querySelector(".friends-status-text");
    const onPresenceChanged = () => {
      if (!statusTextEl || !statusTextEl.isConnected) return;
      const current = getPresence();
      statusTextEl.textContent = current === "invisible" ? "Invisible" : current === "offline" ? "Offline" : "Online";
      statusTextEl.className = `friends-status-text ${
        current === "invisible"
          ? "friends-status-text--invisible"
          : current === "offline"
            ? "friends-status-text--offline"
            : "friends-status-text--online"
      }`;
    };
    os.events.on(BusEvents.SOCIAL_PRESENCE_CHANGED, onPresenceChanged);
    const refreshFriends = async () => {
      if (!win.isConnected) return;
      const queryInput = win.querySelector("[data-friends-search-input]");
      const searchWrap = win.querySelector("[data-friends-search]");
      const query =
        searchWrap && searchWrap.classList.contains("steam-friends-search--open") && queryInput ? queryInput.value : "";
      await this.loadFriendsPanel(win, query);
    };
    this.friendsPollTimer = setInterval(refreshFriends, 8000);
    win.addEventListener("remove", () => {
      os.events.off(BusEvents.SOCIAL_PRESENCE_CHANGED, onPresenceChanged);
      if (this.friendsPollTimer) {
        clearInterval(this.friendsPollTimer);
        this.friendsPollTimer = null;
      }
    });
    this.loadFriendsPanel(win);
  }

  async loadFriendsPanel(win, query) {
    const panel = $(".friends-live-panel", win);
    if (!panel) return;
    await renderFriendsListPanel(panel, {
      query,
      onLaunch: (appId) => {
        const resolvedId = resolveAppId(appId);
        if (resolvedId) os.app.launch(resolvedId).catch(() => {});
      },
      onOpenChat: (friend) => {
        if (this.wm) {
          this.openDmWindow(this.wm, {
            friendId: friend.userId,
            username: friend.username,
            presence: friend.presence
          });
        }
      },
      onOpenContextMenu: (event, friend) => this.showFriendContextMenu(event, friend)
    });
    this.updateFriendRequestsBadge(win);
  }

  showFriendContextMenu(event, friend) {
    const items = [
      { id: "friend-chat", label: "Send Message", icon: "fa-comment-dots", action: "chat" },
      { id: "friend-profile", label: "View Profile", icon: "fa-id-badge", action: "profile" },
      "hr",
      { id: "friend-remove", label: "Remove Friend", icon: "fa-user-slash", action: "remove" }
    ];
    const handlers = {
      chat: () => {
        if (!this.wm) return;
        this.openDmWindow(this.wm, {
          friendId: friend.userId,
          username: friend.username,
          presence: friend.presence
        });
      },
      profile: () => {
        os.app.launch("steamApp", { steamPage: "profile", steamUserId: friend.userId });
      },
      remove: async () => {
        const confirmed = await os.dialog.confirm(
          "Remove Friend",
          `Remove ${friend.username || "this friend"} from your friends list?`
        );
        if (!confirmed) return;
        const res = await removeFriend(friend.userId);
        if (res && (res.success || res.status)) {
          const win = $("#steam-friends-win");
          this.loadFriendsPanel(win);
        }
      }
    };
    showContextMenu(event, items, handlers);
  }

  openDmWindow(wm, conversation) {
    if (!conversation) return;
    const winId = `steam-dm-${conversation.friendId}`;
    const existing = $("#" + winId);
    if (existing) {
      wm.bringToFront(existing);
      return;
    }
    const title = `Chat with ${conversation.username || "Friend"}`;
    const host = createElement("div", {
      className: "window-content dm-window",
      html: `
        <div class="dm-header">
          <div class="dm-header-info">
            <span class="dm-header-name"></span>
            <span class="dm-header-status"></span>
          </div>
        </div>
        <div class="dm-messages" data-dm-messages></div>
        <div class="dm-composer">
          <input type="text" class="dm-input" data-dm-input placeholder="Message" maxlength="1000" />
          <button type="button" class="steam-friend-btn steam-friend-btn--accept dm-send"><i class="fas fa-paper-plane"></i></button>
        </div>
      `
    });

    const win = os.window.create(winId, title, "320px", "420px", {
      className: "window-root",
      style: { background: "var(--bg-secondary)" },
      icon: "fas fa-comment-dots",
      skipHeader: true,
      skipAutoSetup: true
    });
    win.appendChild(host);
    this.dmPollTimers = this.dmPollTimers || {};
    win.addEventListener("remove", () => {
      if (this.dmPollTimers[conversation.friendId]) {
        clearInterval(this.dmPollTimers[conversation.friendId]);
        delete this.dmPollTimers[conversation.friendId];
      }
    });

    wm.mountWindow(win, winId, title, "fas fa-comment-dots");
    const headerHtml = wm.utils.generateWindowHeader(title, "fas fa-comment-dots");
    win.insertAdjacentHTML("afterbegin", headerHtml);
    wm.bringToFront(win);
    windowMakeDraggable(win, wm);
    if (wm.makeResizable) wm.makeResizable(win);
    if (wm.setupWindowControls) wm.setupWindowControls(win);

    const input = win.querySelector("[data-dm-input]");
    const sendBtn = win.querySelector(".dm-send");
    const messagesEl = win.querySelector("[data-dm-messages]");
    const nameEl = win.querySelector(".dm-header-name");
    if (nameEl) nameEl.textContent = conversation.username || "Friend";
    const statusEl = win.querySelector(".dm-header-status");
    if (statusEl) {
      statusEl.textContent = conversation.presence === "online" ? "Online" : "Offline";
    }

    const poll = async () => {
      if (!messagesEl || !messagesEl.isConnected) return;
      const messages = await fetchMessages(conversation.friendId);
      if (!messagesEl.isConnected) return;
      if (!messages || messages.length === 0) {
        setHTML(messagesEl, '<div class="dm-empty">Say hello!</div>');
        return;
      }
      const myUserId = getLiveUserId();
      setHTML(messagesEl, "");
      messages.forEach((message) => {
        const isMe = message.fromId === myUserId;
        const bubble = createElement("div", {
          className: `dm-bubble ${isMe ? "dm-bubble--me" : ""}`,
          text: message.body
        });
        const time = createElement("div", {
          className: "dm-bubble-time",
          text: new Date(message.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        });
        bubble.appendChild(time);
        messagesEl.appendChild(bubble);
      });
      messagesEl.scrollTop = messagesEl.scrollHeight;
    };
    const doSend = async () => {
      const text = (input && input.value.trim()) || "";
      if (!text) return;
      const res = await sendMessage(conversation.friendId, text);
      if (res && res.error) {
        os.notify.send("Message failed", res.error, { type: "error" });
        return;
      }
      if (input) input.value = "";
      await poll();
    };
    if (sendBtn) bindEvent(sendBtn, "click", doSend);
    if (input) {
      bindEvent(input, "keydown", (e) => {
        if (e.key === "Enter") doSend();
      });
    }
    poll();
    this.dmPollTimers[conversation.friendId] = setInterval(poll, 6000);
  }

  async updateFriendRequestsBadge(win) {
    const data = await fetchFriends();
    const count = Array.isArray(data?.requests) ? data.requests.length : 0;
    const bubble = win.querySelector(".friends-requests-bubble");
    if (bubble) setText(bubble, count ? String(count) : "");
  }
}
