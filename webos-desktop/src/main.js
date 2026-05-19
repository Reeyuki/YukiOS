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
import { AppCreatorApp } from "./appCreator.js";
import { OfficeAppProxy } from "./officeLoader.js";
import { MarkdownApp } from "./markdown.js";
import { YouTubeApp } from "./youtube.js";
import { MonacoApp } from "./monaco.js";
import { Model3DApp } from "./model3d.js";
import { NotificationCenter } from "./notificationCenter.js";
import { CategoriesApp } from "./categories.js";
import { JsDosApp } from "./jsdos.js";
import { V86App } from "./v86.js";
import { EmulatorApp } from "./emulator.js";
import { AchievementsApp } from "./achievements.js";
import { ProfileCustomizerApp } from "./profileCustomizer.js";
import { setDesktopUI as setGamesDesktopUI } from "./games.js";
import { AdsManager } from "./ads.js";
import { registerPWA } from "./pwa.js";
import { RuffleApp } from "./ruffle.js";
import { SessionManager } from "./SessionManager.js";
import { CommandPalette } from "./commandPalette.js";
import { ShortcutsApp } from "./shortcuts.js";
import {
  resolveGhUrl,
  resolveIconUrl,
  initializeMirrors,
  CDN_MIRRORS,
  getCdnMirror,
  setCdnMirror
} from "./shared/assetResolver.js";
import { appMap } from "./gamesList.js";
import "./taskbarPositionManager.js";
import logoImg from "./assets/logo.png";
import { showCdnPrompt } from "./shared/dialogs.js";

initializeMirrors(appMap);
registerPWA();
const notificationCenter = new NotificationCenter();
const fileSystemManager = new FileSystemManager();
const windowManager = new WindowManager(notificationCenter);
import { bus } from "./core/EventBus.js";

const services = {
  notificationCenter,
  fileSystemManager,
  windowManager,
  eventBus: bus,
  get wm() {
    return windowManager;
  },
  get fs() {
    return fileSystemManager;
  },
  get bus() {
    return bus;
  }
};
const achievementsApp = new AchievementsApp(services);
services.achievementsApp = achievementsApp;
window.achievements = achievementsApp;

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

const jsDosApp = new JsDosApp(services);
services.jsDosApp = jsDosApp;
explorerApp.setJsDos(jsDosApp);

const v86app = new V86App(services);
services.v86app = v86app;
explorerApp.setv86App(v86app);

const emulatorApp = new EmulatorApp(services);
services.emulatorApp = emulatorApp;

const ruffleApp = new RuffleApp(services);
services.ruffleApp = ruffleApp;

const cameraApp = new CameraApp(services);
services.cameraApp = cameraApp;

const aboutApp = new AboutApp(services);
services.aboutApp = aboutApp;

const shortcutsApp = new ShortcutsApp(services);
services.shortcutsApp = shortcutsApp;

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
window.AdsManager = adsApp;
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
  profileCustomizerApp,
  markdownApp,
  emulatorApp,
  ruffleApp,
  shortcutsApp
);
windowManager.setAppLauncher(appLauncher);
appCreatorApp.setAppLauncher(appLauncher);
explorerApp.setAppLauncher(appLauncher);
const desktopUI = new DesktopUI(appLauncher, notepadApp, explorerApp, fileSystemManager);

const sessionManager = new SessionManager(services);
services.sessionManager = sessionManager;

const commandPalette = new CommandPalette(services);
services.commandPalette = commandPalette;

async function start() {
  await sessionManager.showLogin();

  document.documentElement.style.setProperty("--start-logo-url", `url("${logoImg}")`);

  setTimeout(() => {
    const testImg = new Image();
    testImg.onload = () => {};
    testImg.onerror = async () => {
      const newMirror = await showCdnPrompt(CDN_MIRRORS, getCdnMirror());
      if (newMirror) {
        setCdnMirror(newMirror);
        window.location.reload();
      }
    };
    testImg.src = resolveIconUrl("static/icons/file.webp");
  }, 1500);
  setGamesDesktopUI(desktopUI);
  explorerApp.setDesktopUI(desktopUI);
  settingsApp.setDesktopUI(desktopUI);
  settingsApp.setAppLauncher(appLauncher);
  profileCustomizerApp.setSettingsApp(settingsApp);
  appCreatorApp.setDesktopUI(desktopUI);
  appCreatorApp.setAppLauncher(appLauncher);
  appCreatorApp.restoreInstalledApps();
  SystemUtilities.startClock();
  SystemUtilities.setSettings(settingsApp);
  SystemUtilities.startTaskbarWeather(appLauncher);
  await SystemUtilities.loadWallpaper();
  windowManager.restorePinnedItems();

  if (location.hostname.endsWith("neocities.org")) {
    alert(
      "Neocities does not support loading assets from other domains! OS will be severely limited to load apps and data."
    );
  }

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
  setupStartMenu(appLauncher, sessionManager);
}

start();
