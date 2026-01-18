import { registerSW } from "virtual:pwa-register";
import { TerminalApp } from "./terminal.js";
import { ExplorerApp } from "./explorer.js";
import { WindowManager } from "./windowManager.js";
import { BrowserApp } from "./browser.js";
import { AppLauncher } from "./appLauncher.js";
import { NotepadApp } from "./notepad.js";
import { CameraApp } from "./camera.js";
import { SystemUtilities } from "./system.js";
import { FileSystemManager } from "./fs.js";
import { setupStartMenu } from "./startMenu.js";
import { desktop } from "./desktop.js";
import { DesktopUI } from "./desktopui.js";

class MusicPlayer {
  constructor() {}
  open(windowManager) {
    if (document.getElementById("music-win")) {
      console.log("bringing window to front");
      windowManager.bringToFront(document.getElementById("music-win"));
      return;
    }
    console.log("Creating window");
    const win = windowManager.createWindow("music-win", "MUSIC");

    win.innerHTML = `
    <div class="window-header">
      <span>MUSIC</span>
      ${windowManager.getWindowControls()}
    </div>
    <div class="window-content" style="width:100%; height:100%;">
      <div id="player-container" style="display:flex; flex-direction:column; align-items:center; gap:10px; padding:10px;"></div>
      </div>
    </div>`;

    desktop.appendChild(win);
    explorerApp.renderMusicPage(document.getElementById("player-container"));
    windowManager.makeDraggable(win);
    windowManager.makeResizable(win);
    windowManager.setupWindowControls(win);
    windowManager.addToTaskbar(win.id, "MUSIC", "/static/icons/music.png");
  }
}

const fileSystemManager = new FileSystemManager();
const windowManager = new WindowManager();

const notepadApp = new NotepadApp(fileSystemManager, windowManager, null);
const explorerApp = new ExplorerApp(fileSystemManager, windowManager, notepadApp);

notepadApp.setExplorer(explorerApp);

const browserApp = new BrowserApp(windowManager);
const terminalApp = new TerminalApp(fileSystemManager, windowManager);
const musicPlayer = new MusicPlayer();
const cameraApp = new CameraApp(windowManager);

const appLauncher = new AppLauncher(
  windowManager,
  fileSystemManager,
  musicPlayer,
  explorerApp,
  terminalApp,
  notepadApp,
  browserApp,
  cameraApp
);

new DesktopUI(appLauncher, notepadApp, explorerApp);

SystemUtilities.startClock();
SystemUtilities.setRandomWallpaper();

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);

const game = urlParams.get("game");
if (game) {
  setTimeout(() => {
    appLauncher.launch(game);
  }, 100);
}
const icons = desktop.querySelectorAll(".icon");

function layoutIcons() {
  const desktopHeight = desktop.clientHeight;
  const ICON_WIDTH = 80;
  const ICON_HEIGHT = 100;
  const GAP = 5;

  let x = GAP;
  let y = GAP;

  icons.forEach((icon) => {
    if (!icon.style.left || !icon.style.top) {
      icon.style.position = "absolute";
      icon.style.left = `${x}px`;
      icon.style.top = `${y}px`;

      y += ICON_HEIGHT + GAP;

      if (y + ICON_HEIGHT > desktopHeight) {
        y = GAP;
        x += ICON_WIDTH + GAP;
      }
    }
  });
}

window.addEventListener("load", layoutIcons);
window.addEventListener("resize", layoutIcons);

console.log(
  "Howdy, devtools user! the source of this site is available at: https://github.com/Reeyuki/reeyuki.github.io"
);
setupStartMenu();

registerSW({ immediate: true });
