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
import { TaskManagerApp } from "./taskManager.js";
import { WeatherApp } from "./weather.js";
import { EmulatorApp } from "./emulatorApp.js";
import { detectOS, isMobile } from "./shared/platformUtils.js";
import { AppCreatorApp } from "./appCreator.js";
import { OfficeAppProxy } from "./officeLoader.js";
import { MarkdownApp } from "./markdown.js";
import { MonacoApp } from "./monaco.js";
import { Model3DApp } from "./model3d.js";

class MusicPlayer {
  constructor() {}
  open(windowManager) {
    if (document.getElementById("music-win")) {
      windowManager.bringToFront(document.getElementById("music-win"));
      return;
    }
    const win = windowManager.createWindow("music-win", "MUSIC", "700px", "400px");
    win.innerHTML = `
      <div class="window-header">
        <span>MUSIC</span>
        ${windowManager.getWindowControls()}
      </div>
      <div class="window-content" style="width:100%; height:100%;">
        <div id="player-container" style="display:flex; flex-direction:column; align-items:center; gap:10px; padding:10px;"></div>
      </div>`;
    desktop.appendChild(win);
    this.renderMusicPage(document.getElementById("player-container"));
    windowManager.makeDraggable(win);
    windowManager.makeResizable(win);
    windowManager.setupWindowControls(win);
    windowManager.addToTaskbar(win.id, "MUSIC", "/static/icons/music.webp");
  }
  renderMusicPage(element) {
    if (!element) return;
    element.innerHTML = `
        <div style="display:flex;gap:20px;flex-wrap:wrap;">
          <iframe src="https://open.spotify.com/embed/playlist/6oK6F4LglYBr4mYLSRDJOa" width="300" height="380" frameborder="0" allowtransparency="true" allow="encrypted-media"></iframe>
          <iframe src="https://open.spotify.com/embed/playlist/1q7zv2ScwtR2jIxaIRj9iG" width="300" height="380" frameborder="0" allowtransparency="true" allow="encrypted-media"></iframe>
          <iframe src="https://open.spotify.com/embed/playlist/6q8mgrJZ5L4YxabVQoAZZf" width="300" height="380" frameborder="0" allowtransparency="true" allow="encrypted-media"></iframe>
        </div>
      `;
  }
}

function initDownloadButton() {
  if (isMobile()) return;
  const installBtn = document.createElement("div");
  installBtn.id = "install-app";
  installBtn.textContent = "Install Desktop App";
  document.body.appendChild(installBtn);
  setTimeout(() => {
    if (installBtn) installBtn.remove();
  }, 3000);
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
const markdownApp = new MarkdownApp(windowManager);
const explorerApp = new ExplorerApp(fileSystemManager, windowManager, notepadApp, markdownApp);
const officeApp = new OfficeAppProxy(fileSystemManager, windowManager);
officeApp.setExplorer(explorerApp);
explorerApp.setOfficeApp(officeApp);
const calculatorApp = new CalculatorApp(windowManager);
notepadApp.setExplorer(explorerApp);
const browserApp = new BrowserApp(windowManager, fileSystemManager);
const terminalApp = new TerminalApp(fileSystemManager, windowManager);
const nodeApp = new NodeEditorApp(fileSystemManager, windowManager);
const pythonApp = new PythonEditorApp(fileSystemManager, windowManager);
pythonApp.setExplorer(explorerApp);
nodeApp.setExplorer(explorerApp);
const musicPlayer = new MusicPlayer();
const cameraApp = new CameraApp(windowManager, fileSystemManager);
const aboutApp = new AboutApp(windowManager);
const settingsApp = new SettingsApp(windowManager);
const taskManagerApp = new TaskManagerApp(windowManager);
const weatherApp = new WeatherApp(windowManager);
window.weatherApp = weatherApp;
const emulatorApp = new EmulatorApp(fileSystemManager, windowManager);
explorerApp.setEmulator(emulatorApp);
explorerApp.setBrowser(browserApp);
const appCreatorApp = new AppCreatorApp(fileSystemManager, windowManager);
const monacoApp = new MonacoApp(fileSystemManager, windowManager, explorerApp);
const model3dApp = new Model3DApp(fileSystemManager, windowManager, explorerApp);
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
  settingsApp,
  taskManagerApp,
  weatherApp,
  emulatorApp,
  appCreatorApp,
  officeApp,
  monacoApp,
  model3dApp
);
appCreatorApp.setAppLauncher(appLauncher);
explorerApp.setAppLauncher(appLauncher);

const desktopUI = new DesktopUI(appLauncher, notepadApp, explorerApp, fileSystemManager, emulatorApp);
explorerApp.setDesktopUI(desktopUI);
settingsApp.setDesktopUI(desktopUI);
settingsApp.setAppLauncher(appLauncher);
appCreatorApp.setDesktopUI(desktopUI);
appCreatorApp.restoreInstalledApps();
SystemUtilities.startClock();
SystemUtilities.setSettings(settingsApp);
SystemUtilities.startTaskbarWeather(appLauncher);
SystemUtilities.loadWallpaper();
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const game = urlParams.get("game");
const swf = urlParams.get("swf") === "true";
if (game) {
  setTimeout(() => {
    appLauncher.launch(game, swf);
  }, 0);
}
setupStartMenu(appLauncher);
