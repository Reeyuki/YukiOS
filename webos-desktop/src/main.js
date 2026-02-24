import { TerminalApp } from "./terminal.js";
import { ExplorerApp } from "./explorer.js";
import { WindowManager } from "./windowManager.js";
import { BrowserApp } from "./browser.js";
import { AppLauncher } from "./appLauncher.js";
import { NotepadApp } from "./notepad.js";
import { CameraApp } from "./camera.js";
import { AboutApp } from "./about.js";
import { PythonEditorApp } from "./python.js";
import { SystemUtilities } from "./system.js";
import { FileSystemManager } from "./fs.js";
import { setupStartMenu } from "./startMenu.js";
import { desktop } from "./desktop.js";
import { DesktopUI } from "./desktopui.js";
import { CalculatorApp } from "./calculator.js";
import { NodeEditorApp } from "./node.js";
import { SettingsApp } from "./settings.js";

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
    windowManager.addToTaskbar(win.id, "MUSIC", "/static/icons/music.webp");
  }
}

function detectOS() {
  const platform = navigator.platform.toLowerCase();
  const ua = navigator.userAgent.toLowerCase();
  if (platform.includes("win")) return "windows";
  if (platform.includes("mac") || ua.includes("macintosh") || ua.includes("mac os")) return "mac";
  if (platform.includes("linux")) return "linux";
  if (/android|iphone|ipad|ipod/.test(ua)) return "mobile";
  return "windows";
}
function isMobile() {
  return window.matchMedia("(max-width: 768px)").matches;
}
function initDownloadButton() {
  if (isMobile()) return;

  const installBtn = document.createElement("div");
  installBtn.id = "install-app";
  installBtn.textContent = "Install Desktop App";
  document.body.appendChild(installBtn);
  setTimeout(() => {
    if (installBtn) installBtn.remove();
  }, 10000);
  installBtn.addEventListener("click", () => {
    appLauncher.sendAppInstallAnalytics();
    fetch("https://api.github.com/repos/Reeyuki/YukiOS/releases/latest")
      .then((res) => res.json())
      .then((release) => {
        const files = release.assets.map((asset) => ({
          name: asset.name,
          url: asset.browser_download_url
        }));

        const osFiles = {
          linux: files.filter((f) => f.name.includes("linux")),
          mac: files.filter((f) => f.name.includes("mac")),
          windows: files.filter((f) => f.name.includes("windows"))
        };
        function downloadFile(fileUrl) {
          const a = document.createElement("a");
          a.href = fileUrl;
          a.download = "";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }

        function askLinuxPackage(files) {
          const choice = prompt(
            "Linux detected. Choose install type:\n1 = .deb (debian based)\n2 = .zip (portable)",
            "1"
          );
          if (choice === "2") {
            const zipFile = files.find((f) => f.name.endsWith(".zip"));
            if (zipFile) downloadFile(zipFile.url);
          } else {
            const debFile = files.find((f) => f.name.endsWith(".deb"));
            if (debFile) downloadFile(debFile.url);
          }
        }

        const os = detectOS();
        if (isMobile()) return;

        const osSpecificFiles = osFiles[os];
        if (!osSpecificFiles || osSpecificFiles.length === 0) return;

        if (os === "linux") {
          askLinuxPackage(osSpecificFiles);
        } else {
          downloadFile(osSpecificFiles[0].url);
        }
      });
  });
}
if (!window.electronAPI) {
  initDownloadButton();
}

const fileSystemManager = new FileSystemManager();
const windowManager = new WindowManager();

const notepadApp = new NotepadApp(fileSystemManager, windowManager, null);
const explorerApp = new ExplorerApp(fileSystemManager, windowManager, notepadApp);
const calculatorApp = new CalculatorApp(windowManager);
notepadApp.setExplorer(explorerApp);

const browserApp = new BrowserApp(windowManager);
const terminalApp = new TerminalApp(fileSystemManager, windowManager);
const nodeApp = new NodeEditorApp(fileSystemManager, windowManager);
const pythonApp = new PythonEditorApp(fileSystemManager, windowManager);
pythonApp.setExplorer(explorerApp);
nodeApp.setExplorer(explorerApp);
const musicPlayer = new MusicPlayer();
const cameraApp = new CameraApp(windowManager);
const aboutApp = new AboutApp(windowManager);
const settingsApp = new SettingsApp(windowManager);
const appLauncher = new AppLauncher(
  windowManager,
  fileSystemManager,
  musicPlayer,
  explorerApp,
  terminalApp,
  notepadApp,
  browserApp,
  cameraApp,
  pythonApp,
  nodeApp,
  calculatorApp,
  aboutApp,
  settingsApp
);
window.appLauncher = appLauncher;
const desktopUI = new DesktopUI(appLauncher, notepadApp, explorerApp, fileSystemManager);

explorerApp.setDesktopUI(desktopUI);

SystemUtilities.startClock();
SystemUtilities.setRandomWallpaper();
SystemUtilities.setSettings(settingsApp);

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);

const game = urlParams.get("game");
const swf = urlParams.get("swf") === "true";
if (game) {
  setTimeout(() => {
    appLauncher.launch(game, swf);
  }, 0);
}
setupStartMenu();
