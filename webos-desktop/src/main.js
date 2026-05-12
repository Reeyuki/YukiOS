import { TerminalApp } from "./terminal.js";
import { ExplorerApp } from "./explorer.js";
import { WindowManager } from "./windowManager.js";
import { AppLauncher } from "./appLauncher.js";
import { BrowserApp } from "./browserApp.js";
import { NotepadApp } from "./notepad.js";
import { CameraApp } from "./camera.js";
import { AboutApp } from "./about.js";
import { NewsApp } from "./news.js";
import { SystemUtilities } from "./system.js";
import { FileSystemManager } from "./fs.js";
import { setupStartMenu } from "./startMenu.js";
import { DesktopUI } from "./desktopui.js";
import { CalculatorApp } from "./calculator.js";
import { SettingsApp } from "./settings.js";
import { TaskManagerApp } from "./taskManager.js";
import { WeatherApp } from "./weather.js";
import { detectOS, isMobile } from "./shared/platformUtils.js";
import { AppCreatorApp } from "./appCreator.js";
import { OfficeAppProxy } from "./officeLoader.js";
import { MarkdownApp } from "./markdown.js";
import { YouTubeApp } from "./youtube.js";
import { MonacoApp } from "./monaco.js";
import { Model3DApp } from "./model3d.js";
import { NotificationCenter } from "./notificationCenter.js";
import { CategoriesApp } from "./categories.js";
import { MusicPlayerApp } from "./music.js";
import { JsDosApp } from "./jsdos.js";
import { V86App } from "./v86.js";
import { AchievementsApp } from "./achievements.js";
import { ProfileCustomizerApp } from "./profileCustomizer.js";
import { setDesktopUI as setGamesDesktopUI } from "./games.js";
import { AdsManager } from "./ads.js";
import { registerPWA } from "./pwa.js";
import { taskbarPositionManager } from "./taskbarPositionManager.js";

registerPWA();
const notificationCenter = new NotificationCenter();
const fileSystemManager = new FileSystemManager();
const windowManager = new WindowManager(notificationCenter);

const services = {
  notificationCenter,
  fileSystemManager,
  windowManager,
  get wm() {
    return windowManager;
  },
  get fs() {
    return fileSystemManager;
  }
};
const achievementsApp = new AchievementsApp(services);
services.achievementsApp = achievementsApp;

const notepadApp = new NotepadApp(services);
services.notepadApp = notepadApp;

const markdownApp = new MarkdownApp(services);
services.markdownApp = markdownApp;

const youtubeApp = new YouTubeApp(services);
services.youtubeApp = youtubeApp;

const explorerApp = new ExplorerApp(services);
services.explorerApp = explorerApp;

const officeApp = new OfficeAppProxy(services);
services.officeApp = officeApp;

officeApp.setExplorer(explorerApp);
explorerApp.setOfficeApp(officeApp);

const calculatorApp = new CalculatorApp(services);
services.calculatorApp = calculatorApp;

notepadApp.setExplorer(explorerApp);

const browserApp = new BrowserApp(services);
services.browserApp = browserApp;

youtubeApp.setBrowserApp(browserApp);

const terminalApp = new TerminalApp(services);
services.terminalApp = terminalApp;

const musicPlayer = new MusicPlayerApp(services);
services.musicPlayer = musicPlayer;

musicPlayer.setBrowserApp(browserApp);

const jsDosApp = new JsDosApp(services);
services.jsDosApp = jsDosApp;
explorerApp.setJsDos(jsDosApp);

const v86app = new V86App(services);
services.v86app = v86app;
explorerApp.setv86App(v86app);

const cameraApp = new CameraApp(services);
services.cameraApp = cameraApp;

const aboutApp = new AboutApp(services);
services.aboutApp = aboutApp;

const newsApp = new NewsApp(services);
services.newsApp = newsApp;

const settingsApp = new SettingsApp(services);
services.settingsApp = settingsApp;
settingsApp.setFileSystemManager(fileSystemManager);

const profileCustomizerApp = new ProfileCustomizerApp(services);
services.profileCustomizerApp = profileCustomizerApp;
profileCustomizerApp.setSettingsApp(settingsApp);

const taskManagerApp = new TaskManagerApp(services);
services.taskManagerApp = taskManagerApp;

const weatherApp = new WeatherApp(services);
services.weatherApp = weatherApp;

const adsApp = new AdsManager(windowManager);
services.adsApp = adsApp;

explorerApp.setBrowser(browserApp);

const appCreatorApp = new AppCreatorApp(services);
services.appCreatorApp = appCreatorApp;

const monacoApp = new MonacoApp(services);
services.monacoApp = monacoApp;

const categoriesApp = new CategoriesApp(services);
services.categoriesApp = categoriesApp;

const model3dApp = new Model3DApp(services);
services.model3dApp = model3dApp;
const appLauncher = new AppLauncher(
  windowManager,
  fileSystemManager,
  musicPlayer,
  explorerApp,
  terminalApp,
  notepadApp,
  browserApp,
  cameraApp,
  calculatorApp,
  aboutApp,
  newsApp,
  settingsApp,
  taskManagerApp,
  weatherApp,
  appCreatorApp,
  officeApp,
  monacoApp,
  model3dApp,
  categoriesApp,
  jsDosApp,
  v86app,
  youtubeApp,
  achievementsApp,
  adsApp,
  profileCustomizerApp
);
appCreatorApp.setAppLauncher(appLauncher);
explorerApp.setAppLauncher(appLauncher);
const desktopUI = new DesktopUI(appLauncher, notepadApp, explorerApp, fileSystemManager);
setGamesDesktopUI(desktopUI);
explorerApp.setDesktopUI(desktopUI);
settingsApp.setDesktopUI(desktopUI);
settingsApp.setAppLauncher(appLauncher);
profileCustomizerApp.setSettingsApp(settingsApp);
appCreatorApp.setDesktopUI(desktopUI);
appCreatorApp.restoreInstalledApps();
SystemUtilities.startClock();
SystemUtilities.setSettings(settingsApp);
SystemUtilities.startTaskbarWeather(appLauncher);
await SystemUtilities.loadWallpaper();

const ads = new AdsManager(windowManager);

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const game = urlParams.get("game");
const swf = urlParams.get("swf") === "true";
const steamParam = urlParams.get("steam");

if (steamParam) {
  setTimeout(() => {
    categoriesApp.initUrlParamHandling(appLauncher, windowManager);
  }, 0);
} else if (game) {
  setTimeout(() => {
    appLauncher.launch(game, swf);
  }, 0);
}
setupStartMenu(appLauncher);

// Initialize user profile from localStorage
function initializeUserProfile() {
  const savedUsername = localStorage.getItem("yukiOS_username") || "reeyuki";
  const savedProfilePic = localStorage.getItem("yukiOS_profilePicture") || "static/icons/guest.webp";

  const startUserSpan = document.querySelector(".start-user span");
  if (startUserSpan) startUserSpan.textContent = savedUsername;

  const startUserImg = document.querySelector(".start-user img");
  if (startUserImg) startUserImg.src = savedProfilePic;
}

// Initialize profile when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeUserProfile);
} else {
  initializeUserProfile();
}
