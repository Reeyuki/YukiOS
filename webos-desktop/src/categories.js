import { steamAppRenderer, FlashAppRenderer, SystemAppRenderer, handleGameUrlParam } from "./games.js";
import { WindowHelper } from "./utils/WindowHelper.js";
import { resolveIconUrl } from "./assetUrl.js";
import { trayManager } from "./tray.js";

const STEAM_WIN_ID = "games-app-win";

export class CategoriesApp {
  constructor(services) {
    this.services = services;
    this._recentGames = this._loadRecentGames();
  }

  _loadRecentGames() {
    try {
      const stored = localStorage.getItem("yukiOS_steam_recent_games");
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  _saveRecentGames() {
    try {
      localStorage.setItem("yukiOS_steam_recent_games", JSON.stringify(this._recentGames));
    } catch (e) {
      console.warn("Failed to save recent games:", e);
    }
  }

  _addRecentGame(gameId, gameTitle) {
    const existingIndex = this._recentGames.findIndex((g) => g.id === gameId);
    if (existingIndex !== -1) {
      this._recentGames.splice(existingIndex, 1);
    }
    this._recentGames.unshift({ id: gameId, title: gameTitle, timestamp: Date.now() });
    this._recentGames = this._recentGames.slice(0, 10);
    this._saveRecentGames();
    this._updateTrayContextMenu();
  }

  _updateTrayContextMenu() {
    const appLauncher = this.services.appLauncher;
    if (appLauncher) {
      trayManager.updateContextMenuItems(STEAM_WIN_ID, this._getSteamContextMenuItems(appLauncher));
    }
  }

  _getSteamContextMenuItems(appLauncher) {
    const items = [
      { label: "Library", icon: "fa-book", action: () => this.opensteamApp(appLauncher, this.services.windowManager) },
      { label: "Store", icon: "fa-store", action: () => this.opensteamApp(appLauncher, this.services.windowManager) },
      { type: "divider" }
    ];

    if (this._recentGames.length > 0) {
      items.push({ label: "Recent Games", icon: "fa-clock", action: null });
      this._recentGames.forEach((game) => {
        items.push({
          label: game.title,
          icon: "fa-gamepad",
          action: () => {
            appLauncher.launch(game.id);
          }
        });
      });
      items.push({ type: "divider" });
    }

    return items;
  }

  openFlash(appLauncher, wm) {
    this.opensteamApp(appLauncher, wm, "Flash Games");
  }

  opensteamApp(appLauncher, wm, focusCollection = null, gameId = null) {
    const existing = document.getElementById(STEAM_WIN_ID);
    if (existing) {
      if (existing.style.display === "none") {
        trayManager.restoreFromTray(STEAM_WIN_ID);
      } else {
        existing.style.display = "flex";
        wm.bringToFront(existing);
      }
      const taskbarItem = document.getElementById(`taskbar-${STEAM_WIN_ID}`);
      if (taskbarItem) {
        taskbarItem.style.display = "";
        taskbarItem.classList.remove("minimized");
      }

      if (gameId) {
        const container = existing.querySelector("#games-app-container");
        const onLaunch = (appId) => {
          if (appLauncher) appLauncher.launch(appId);
        };

        if (container.classList.contains("steam-app-root")) {
          const gamesRenderer = new steamAppRenderer();
          gamesRenderer.renderGameOverview(container, gameId, onLaunch);
        } else {
          const gamesRenderer = new steamAppRenderer();
          gamesRenderer.render(container, onLaunch, wm, focusCollection);
          setTimeout(() => {
            gamesRenderer.renderGameOverview(container, gameId, onLaunch);
          }, 100);
        }
      }
      return;
    }

    const winTitle = "Steam";
    const win = wm.createWindow(STEAM_WIN_ID, winTitle);
    win.classList.add("window-root");
    win.style.width = "90%";
    win.style.height = "90%";
    win.style.left = "5%";
    win.style.top = "5%";
    win.style.display = "flex";
    win.style.flexDirection = "column";

    const gamesRenderer = new steamAppRenderer();

    win.innerHTML = `
      <div class="window-content games-app-window" style="flex:1;overflow:auto;padding:0;box-sizing:border-box;">
        <div id="games-app-container" style="height:100%;"></div>
      </div>`;

    const windowHelper = new WindowHelper(wm);
    windowHelper.mountWindow(win, STEAM_WIN_ID, winTitle, null, {
      setupWindowControls: false,
      addToTaskbar: false
    });

    const taskbarIcon =
      focusCollection === "Flash Games"
        ? resolveIconUrl("static/icons/flash.webp")
        : resolveIconUrl("static/icons/steam.webp");
    wm.addToTaskbar(STEAM_WIN_ID, winTitle, taskbarIcon);

    trayManager.register(STEAM_WIN_ID, taskbarIcon, winTitle, {
      showInTray: true,
      contextMenuItems: this._getSteamContextMenuItems(appLauncher),
      priority: 100
    });

    const container = win.querySelector("#games-app-container");
    const onLaunch = (appId) => {
      if (appLauncher) {
        const game = appLauncher.appMap?.[appId];
        if (game) {
          this._addRecentGame(appId, game.title);
        }
        appLauncher.launch(appId);
      }
    };

    const setupSteamControls = () => {
      const closeBtn = win.querySelector(".close-btn");
      if (closeBtn) {
        closeBtn.onclick = () => {
          trayManager.sendToTray(STEAM_WIN_ID);
        };
      }
    };

    const gameParam = new URLSearchParams(window.location.search).get("steam") || gameId;
    if (gameParam) {
      if (gameId && !new URLSearchParams(window.location.search).get("steam")) {
        gamesRenderer.render(container, onLaunch, wm, focusCollection);
        wm.makeDraggable(win);
        setupSteamControls();
        setTimeout(() => {
          gamesRenderer.renderGameOverview(container, gameId, onLaunch);
        }, 100);
      } else {
        handleGameUrlParam(gamesRenderer, container, onLaunch, wm);
        wm.makeDraggable(win);
        setupSteamControls();
      }
    } else {
      gamesRenderer.render(container, onLaunch, wm, focusCollection);
      wm.makeDraggable(win);
      setupSteamControls();
    }
  }

  openSystemsApp(appLauncher, wm) {
    const winId = "system-apps-win";
    const existing = document.getElementById(winId);
    if (existing) {
      wm.bringToFront(existing);
      return;
    }

    const win = wm.createWindow(winId, "System Apps", "800px", "600px");
    win.classList.add("window-root");

    const systemRenderer = new SystemAppRenderer(appLauncher?.appMap);

    win.innerHTML = `
      <div class="window-header">
        <span>System Apps</span>
        ${wm.getWindowControls()}
      </div>
      <div class="window-content system-apps-window" style="width:100%;height:100%;overflow:auto;padding:24px;box-sizing:border-box;">
        <div id="system-app-container"></div>
      </div>`;

    const windowHelper = new WindowHelper(wm);
    windowHelper.mountWindow(win, winId, "System Apps", "fas fa-desktop");

    const container = win.querySelector("#system-app-container");
    systemRenderer.render(container, (appId) => {
      if (appLauncher) appLauncher.launch(appId);
    });
  }

  initUrlParamHandling(appLauncher, wm) {
    const gameParam = new URLSearchParams(window.location.search).get("steam");
    if (!gameParam) return false;
    const run = () => this.opensteamApp(appLauncher, wm);
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run);
    } else {
      run();
    }
    return true;
  }
}
