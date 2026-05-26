import { steamAppRenderer, FlashAppRenderer, SystemAppRenderer, handleGameUrlParam } from "./games.js";
import { WindowHelper } from "./utils/WindowHelper.js";
import { resolveIconUrl } from "./assetUrl.js";
import { trayManager } from "./tray.js";

const STEAM_WIN_ID = "games-app-win";

export class CategoriesApp {
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

    trayManager.register(STEAM_WIN_ID, taskbarIcon, winTitle, { showInTray: true });

    const container = win.querySelector("#games-app-container");
    const onLaunch = (appId) => {
      if (appLauncher) appLauncher.launch(appId);
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
