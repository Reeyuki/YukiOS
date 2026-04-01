import { GamesAppRenderer, FlashAppRenderer, SystemAppRenderer } from "./games.js";

export class CategoriesApp {
  openFlash(appLauncher, wm) {
    const winId = "flash-app-win";
    const existing = document.getElementById(winId);
    if (existing) {
      wm.bringToFront(existing);
      return;
    }
    const win = wm.createWindow(winId, "Flash Games");
    win.classList.add("window-root");
    win.style.width = "860px";
    win.style.height = "560px";
    win.style.left = "100px";
    win.style.top = "60px";
    const flashRenderer = new FlashAppRenderer();
    const flashCount = flashRenderer.getGames().length;
    win.innerHTML = `
      <div class="window-header">
        <span>Flash Games <span class="games-app-count">${flashCount}</span></span>
        ${wm.getWindowControls()}
      </div>
      <div class="window-content flash-app-window" style="width:100%;height:100%;overflow:auto;padding:18px;box-sizing:border-box;">
        <div id="flash-app-container"></div>
      </div>`;
    desktop.appendChild(win);
    wm.makeDraggable(win);
    wm.makeResizable(win);
    wm.setupWindowControls(win);
    wm.addToTaskbar(winId, "Flash Games", "/static/icons/flash.webp");
    const container = win.querySelector("#flash-app-container");
    flashRenderer.render(container, (appId) => {
      if (appLauncher) appLauncher.launch(appId);
    });
  }

  openGamesApp(appLauncher, wm) {
    const winId = "games-app-win";
    const existing = document.getElementById(winId);
    if (existing) {
      wm.bringToFront(existing);
      return;
    }

    const win = wm.createWindow(winId, "Games");
    win.classList.add("window-root");
    win.style.width = "860px";
    win.style.height = "560px";
    win.style.left = "80px";
    win.style.top = "40px";
    win.style.display = "flex";
    win.style.flexDirection = "column";

    const gamesRenderer = new GamesAppRenderer();
    const gamesCount = gamesRenderer.getGames().length;

    win.innerHTML = `
    <div class="window-header">
      <span>Games <span class="games-app-count">${gamesCount + 2588}</span></span>
      ${wm.getWindowControls()}
    </div>
    <div class="window-content games-app-window" style="flex:1;overflow:auto;padding:18px;box-sizing:border-box;">
      <div id="games-app-container" style="height:100%;"></div>
    </div>`;

    desktop.appendChild(win);
    wm.makeDraggable(win);
    wm.makeResizable(win);
    wm.setupWindowControls(win);
    wm.addToTaskbar(winId, "Games", "fas fa-gamepad");

    const container = win.querySelector("#games-app-container");
    gamesRenderer.render(container, (appId) => {
      if (appLauncher) appLauncher.launch(appId);
    });
  }

  openSystemsApp(appLauncher, wm) {
    const winId = "system-apps-win";
    const existing = document.getElementById(winId);
    if (existing) {
      wm.bringToFront(existing);
      return;
    }
    const win = wm.createWindow(winId, "System Apps");
    win.classList.add("window-root");
    win.style.width = "600px";
    win.style.height = "480px";
    win.style.left = "100px";
    win.style.top = "60px";

    const systemRenderer = new SystemAppRenderer(appLauncher?.appMap);
    const systemCount = systemRenderer.getSystemApps().length;

    win.innerHTML = `
    <div class="window-header">
      <span>System Apps <span class="games-app-count">${systemCount}</span></span>
      ${wm.getWindowControls()}
    </div>
    <div class="window-content games-app-window" style="width:100%;height:100%;overflow:auto;padding:18px;box-sizing:border-box;">
      <div id="system-app-container"></div>
    </div>`;
    desktop.appendChild(win);
    wm.makeDraggable(win);
    wm.makeResizable(win);
    wm.setupWindowControls(win);
    wm.addToTaskbar(winId, "System Apps", "fas fa-desktop");
    const container = win.querySelector("#system-app-container");
    systemRenderer.render(container, (appId) => {
      if (appLauncher) appLauncher.launch(appId);
    });
  }
}
