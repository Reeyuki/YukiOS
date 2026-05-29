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
import { ShittifyApp } from "./shittify.js";
import { MonacoApp } from "./monaco.js";
import { Model3DApp } from "./model3d.js";
import { NotificationCenter } from "./notificationCenter.js";
import { CategoriesApp } from "./categories.js";
import { JsDosApp } from "./jsdos.js";
import { V86App } from "./v86.js";
import { EmulatorApp } from "./emulator.js";
import { AchievementsApp } from "./achievements.js";
import { customAlert } from "./shared/dialogs.js";
import { ProfileCustomizerApp } from "./profileCustomizer.js";
import { setDesktopUI as setGamesDesktopUI } from "./games.js";
import { AdsManager } from "./ads.js";
import { registerPWA } from "./pwa.js";
import { RuffleApp } from "./ruffle.js";
import { SessionManager } from "./SessionManager.js";
import { CommandPalette } from "./commandPalette.js";
import { ShortcutsApp } from "./shortcuts.js";
import { YukiConvertApp } from "./yukiConvert.js";
import { HybridAdapter } from "./runtime/HybridAdapter.js";
import { SetupApp } from "./setupApp.js";
import { DataEditorApp } from "./dataEditor.js";
import { InstalledAppsApp } from "./installedApps.js";
import { YukiOsGuideApp } from "./yukiOsGuide.js";
import { ClipboardManager } from "./clipboardManager.js";
import { ClipboardManagerApp } from "./clipboardApp.js";
import { AIAssistantApp } from "./apps/aiAssistant.js";
import { BrightnessApp } from "./brightnessApp.js";
import { PowerApp } from "./powerApp.js";
import { NetworkTrayApp } from "./networkTray.js";
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
import { trayManager } from "./tray.js";
trayManager.init(windowManager);
const clipboardManager = new ClipboardManager(bus);

const services = {
  notificationCenter,
  fileSystemManager,
  windowManager,
  eventBus: bus,
  clipboardManager,
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

const EnhancedBrowserApp = HybridAdapter.enhanceBaseApp(BrowserApp);
const EnhancedTerminalApp = HybridAdapter.enhanceBaseApp(TerminalApp);
const EnhancedNotepadApp = HybridAdapter.enhanceBaseApp(NotepadApp);
const EnhancedMarkdownApp = HybridAdapter.enhanceBaseApp(MarkdownApp);
const EnhancedEmulatorApp = HybridAdapter.enhanceBaseApp(EmulatorApp);
const EnhancedRuffleApp = HybridAdapter.enhanceBaseApp(RuffleApp);
const EnhancedMonacoApp = HybridAdapter.enhanceBaseApp(MonacoApp);
const EnhancedCameraApp = HybridAdapter.enhanceBaseApp(CameraApp);
const EnhancedSettingsApp = HybridAdapter.enhanceBaseApp(SettingsApp);
const EnhancedCalculatorApp = HybridAdapter.enhanceBaseApp(CalculatorApp);
const EnhancedAchievementsApp = HybridAdapter.enhanceBaseApp(AchievementsApp);
const EnhancedNewsApp = HybridAdapter.enhanceBaseApp(NewsApp);

const achievementsApp = new EnhancedAchievementsApp(services);
services.achievementsApp = achievementsApp;
window.achievements = achievementsApp;

const notepadApp = new EnhancedNotepadApp(services);
services.notepadApp = notepadApp;

const markdownApp = new EnhancedMarkdownApp(services);
services.markdownApp = markdownApp;

const youtubeApp = new YouTubeApp(services);
services.youtubeApp = youtubeApp;

const explorerApp = new ExplorerApp(services);
services.explorerApp = explorerApp;

const officeApp = new OfficeAppProxy(services);
services.officeApp = officeApp;

officeApp.setExplorer(explorerApp);
explorerApp.setOfficeApp(officeApp);

const calculatorApp = new EnhancedCalculatorApp(services);
services.calculatorApp = calculatorApp;

notepadApp.setExplorer(explorerApp);

const browserApp = new EnhancedBrowserApp(services);
services.browserApp = browserApp;

youtubeApp.setBrowserApp(browserApp);

const terminalApp = new EnhancedTerminalApp(services);
services.terminalApp = terminalApp;

const jsDosApp = new JsDosApp(services);
services.jsDosApp = jsDosApp;
explorerApp.setJsDos(jsDosApp);

const v86app = new V86App(services);
services.v86app = v86app;
explorerApp.setv86App(v86app);

const emulatorApp = new EnhancedEmulatorApp(services);
services.emulatorApp = emulatorApp;

const ruffleApp = new EnhancedRuffleApp(services);
services.ruffleApp = ruffleApp;

const cameraApp = new EnhancedCameraApp(services);
services.cameraApp = cameraApp;

const aboutApp = new AboutApp(services);
services.aboutApp = aboutApp;

const shortcutsApp = new ShortcutsApp(services);
services.shortcutsApp = shortcutsApp;

const yukiConvertApp = new YukiConvertApp(services);
services.yukiConvertApp = yukiConvertApp;

const newsApp = new EnhancedNewsApp(services);
services.newsApp = newsApp;

const settingsApp = new EnhancedSettingsApp(services);
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

const monacoApp = new EnhancedMonacoApp(services);
services.monacoApp = monacoApp;

const shittifyApp = new ShittifyApp(services);
const categoriesApp = new CategoriesApp(services);
services.categoriesApp = categoriesApp;

const model3dApp = new Model3DApp(services);
services.model3dApp = model3dApp;

const setupApp = new SetupApp(services);
services.setupApp = setupApp;

const dataEditorApp = new DataEditorApp(services);
services.dataEditorApp = dataEditorApp;

const installedAppsApp = new InstalledAppsApp(services);
services.installedAppsApp = installedAppsApp;

const yukiOsGuideApp = new YukiOsGuideApp(services);
services.yukiOsGuideApp = yukiOsGuideApp;

const clipboardManagerApp = new ClipboardManagerApp(services);
services.clipboardManagerApp = clipboardManagerApp;

const aiAssistantApp = new AIAssistantApp(services);
services.aiAssistantApp = aiAssistantApp;

const brightnessApp = new BrightnessApp(services);
services.brightnessApp = brightnessApp;

const powerApp = new PowerApp(services);
services.powerApp = powerApp;

const networkTrayApp = new NetworkTrayApp(services);
services.networkTrayApp = networkTrayApp;

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
  shittifyApp,
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
  shortcutsApp,
  yukiConvertApp,
  setupApp,
  dataEditorApp,
  installedAppsApp,
  yukiOsGuideApp,
  clipboardManagerApp,
  aiAssistantApp,
  brightnessApp
);
window.appLauncher = appLauncher;
services.appLauncher = appLauncher;
windowManager.setAppLauncher(appLauncher);
appCreatorApp.setAppLauncher(appLauncher);
explorerApp.setAppLauncher(appLauncher);
installedAppsApp.setAppLauncher(appLauncher);
const desktopUI = new DesktopUI(appLauncher, notepadApp, explorerApp, fileSystemManager);

const sessionManager = new SessionManager(services);
services.sessionManager = sessionManager;

const commandPalette = new CommandPalette(services);
services.commandPalette = commandPalette;

async function start() {
  await clipboardManager.init();
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
    customAlert(
      "Neocities does not suppo rt loading assets from other domains! OS will be severely limited to load apps and data.",
      "Neocities Warning"
    );
  }
  const url = new URL(location.href);

  if (url.hostname === "yukios.vercel.app") {
    url.hostname = "yukios.netlify.app";
    location.replace(url.toString());
  }

  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);
  const game = urlParams.get("game");
  const app = urlParams.get("app");
  const swf = urlParams.get("swf") === "true";
  const steamParam = urlParams.get("steam");

  if (steamParam) {
    setTimeout(() => {
      categoriesApp.initUrlParamHandling(appLauncher, windowManager);
    }, 0);
  } else if (app) {
    setTimeout(() => {
      appLauncher.launch(app);
    }, 0);
  } else if (game) {
    setTimeout(() => {
      appLauncher.launch(game, swf);
    }, 0);
  }
  setupStartMenu(appLauncher, sessionManager);
}

start();
