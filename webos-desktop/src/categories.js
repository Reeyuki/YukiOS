import { steamAppRenderer, FlashAppRenderer, SystemAppRenderer, handleGameUrlParam } from "./games.js";
import { desktop } from "./desktop.js";

const STEAM_WIN_ID = "games-app-win";

export class CategoriesApp {
  openFlash(appLauncher, wm) {
    this.opensteamApp(appLauncher, wm, "Flash Games");
  }

  opensteamApp(appLauncher, wm, focusCollection = null, gameId = null) {
    const existing = document.getElementById(STEAM_WIN_ID);
    if (existing) {
      existing.style.display = "flex";
      wm.bringToFront(existing);
      const taskbarItem = document.getElementById(`taskbar-${STEAM_WIN_ID}`);
      if (taskbarItem) taskbarItem.classList.remove("minimized");

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

    const winTitle = focusCollection || "Games";
    const win = wm.createWindow(STEAM_WIN_ID, winTitle);
    win.classList.add("window-root");
    win.style.width = "90%";
    win.style.height = "90%";
    win.style.left = "5%";
    win.style.top = "5%";
    win.style.display = "flex";
    win.style.flexDirection = "column";

    const gamesRenderer = new steamAppRenderer();
    const gamesCount = gamesRenderer.getGames().length;

    win.innerHTML = `
      <div class="window-header">
        <span>${winTitle} <span class="games-app-count">${gamesCount + 2588}</span></span>
        ${wm.getWindowControls()}
      </div>
      <div class="window-content games-app-window" style="flex:1;overflow:auto;padding:18px;box-sizing:border-box;">
        <div id="games-app-container" style="height:100%;"></div>
      </div>`;

    desktop.appendChild(win);
    wm.makeDraggable(win);
    wm.makeResizable(win);

    win.querySelector(".close-btn").onclick = () => {
      win.style.display = "none";
      const taskbarItem = document.getElementById(`taskbar-${STEAM_WIN_ID}`);
      if (taskbarItem) {
        taskbarItem.classList.remove("active");
        taskbarItem.classList.add("minimized");
      }
    };
    win.querySelector(".minimize-btn").onclick = () => wm.minimizeWindow(win);
    win.querySelector(".maximize-btn").onclick = () => wm.toggleFullscreen(win);
    const downloadBtn = win.querySelector(".download-btn");
    if (downloadBtn) downloadBtn.onclick = () => wm._downloadWindowContent(win);

    const taskbarIcon = focusCollection === "Flash Games" ? "static/icons/flash.webp" : "static/icons/steam.webp";
    wm.addToTaskbar(STEAM_WIN_ID, winTitle, taskbarIcon);

    const container = win.querySelector("#games-app-container");
    const onLaunch = (appId) => {
      if (appLauncher) appLauncher.launch(appId);
    };

    const gameParam = new URLSearchParams(window.location.search).get("steam") || gameId;
    if (gameParam) {
      if (gameId && !new URLSearchParams(window.location.search).get("steam")) {
        gamesRenderer.render(container, onLaunch, wm, focusCollection);
        setTimeout(() => {
          gamesRenderer.renderGameOverview(container, gameId, onLaunch);
        }, 100);
      } else {
        handleGameUrlParam(gamesRenderer, container, onLaunch, wm);
      }
    } else {
      gamesRenderer.render(container, onLaunch, wm, focusCollection);
    }
  }

  openSystemsApp(appLauncher, wm) {
    const winId = "system-apps-win";
    const existing = document.getElementById(winId);
    if (existing) {
      wm.bringToFront(existing);
      return;
    }

    const win = wm.createWindow(winId, "All Apps", "800px", "600px");
    win.classList.add("window-root");

    const systemRenderer = new SystemAppRenderer(appLauncher?.appMap);
    const systemCount = systemRenderer.getSystemApps().length;

    win.innerHTML = `
      <div class="window-header">
        <span>All Apps <span class="games-app-count">${systemCount}</span></span>
        ${wm.getWindowControls()}
      </div>
      <div class="window-content system-apps-window" style="width:100%;height:100%;overflow:auto;padding:24px;box-sizing:border-box;background: linear-gradient(180deg, rgba(20,20,30,0.95), rgba(15,15,25,0.98));">
        <div style="margin-bottom:20px;">
          <input type="text" class="games-search-input" placeholder="Search apps..." style="width:100%;max-width:400px;padding:12px 16px;border:1px solid rgba(255,255,255,0.2);border-radius:8px;background:rgba(255,255,255,0.1);color:#fff;font-size:14px;outline:none;transition:all 0.3s ease;" 
                 onmouseover="this.style.borderColor='rgba(255,255,255,0.4)';this.style.background='rgba(255,255,255,0.15)'"
                 onmouseout="this.style.borderColor='rgba(255,255,255,0.2)';this.style.background='rgba(255,255,255,0.1)'"
                 onfocus="this.style.borderColor='#6677dd';this.style.background='rgba(255,255,255,0.2)';this.style.boxShadow='0 0 0 2px rgba(102,119,221,0.3)'"
                 onblur="this.style.borderColor='rgba(255,255,255,0.2)';this.style.background='rgba(255,255,255,0.1)';this.style.boxShadow='none'" />
        </div>
        <div id="system-app-container"></div>
      </div>`;

    desktop.appendChild(win);
    wm.makeDraggable(win);
    wm.makeResizable(win);
    wm.setupWindowControls(win);
    wm.addToTaskbar(winId, "All Apps", "fas fa-desktop");

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
