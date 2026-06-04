import { TerminalApp } from "./apps/terminal.js";
import { ExplorerApp } from "./apps/explorer.js";
import { WindowManager } from "./windowManager.js";
import { AppLauncher } from "./appLauncher.js";
import { BrowserApp } from "./apps/browserApp.js";
import { NotepadApp } from "./apps/notepad.js";
import { CameraApp } from "./apps/camera.js";
import { AboutApp } from "./apps/about.js";
import { NewsApp } from "./apps/news.js";
import { SystemUtilities } from "./system.js";
import { FileSystemManager } from "./fs.js";
import { setupStartMenu } from "./desktopui/startMenu.js";
import { DesktopUI } from "./desktopui/desktopui.js";
import { CalculatorApp } from "./apps/calculator.js";
import { SettingsApp } from "./settings/settings.js";
import { TaskManagerApp } from "./apps/taskManager.js";
import { WeatherApp } from "./apps/weather.js";
import { AppCreatorApp } from "./apps/appCreator.js";
import { OfficeAppProxy } from "./office/officeLoader.js";
import { MarkdownApp } from "./apps/markdown.js";
import { YouTubeApp } from "./apps/youtube.js";
import { ShittifyApp } from "./apps/shittify.js";
import { MonacoApp } from "./apps/monaco.js";
import { Model3DApp } from "./apps/model3d.js";
import { NotificationCenter } from "./notificationCenter.js";
import { JsDosApp } from "./apps/jsdos.js";
import { V86App } from "./apps/v86.js";
import { EmulatorApp } from "./apps/emulator.js";
import { AchievementsApp } from "./achievements.js";
import { customAlert } from "./shared/dialogs.js";
import { ProfileCustomizerApp } from "./apps/profileCustomizer.js";
import { setDesktopUI as setGamesDesktopUI, handleSteamUrlParam } from "./games/games.js";
import { AdsManager } from "./ads.js";
import { registerPWA } from "./pwa/pwa.js";
import { RuffleApp } from "./apps/ruffle.js";
import { SessionManager } from "./SessionManager.js";
import { CommandPalette } from "./commandPalette.js";
import { ShortcutsApp } from "./apps/shortcuts.js";
import { YukiConvertApp } from "./apps/yukiConvert.js";
import { HybridAdapter } from "./runtime/HybridAdapter.js";
import { SetupApp } from "./apps/setupApp.js";
import { DataEditorApp } from "./apps/dataEditor.js";
import { InstalledAppsApp } from "./apps/installedApps.js";
import { YukiOsGuideApp } from "./apps/yukiOsGuide.js";
import { ClipboardManager } from "./clipboardManager.js";
import { ClipboardManagerApp } from "./apps/clipboardApp.js";
import { AIAssistantApp } from "./apps/aiAssistant.js";
import { DisplayPerformanceApp } from "./apps/displayPerformanceApp.js";
import { NetworkTrayApp } from "./tray/networkTray.js";
import { EmojiSelectorApp } from "./apps/emojiSelector.js";
import { SystemAppsApp } from "./apps/systemApps.js";
import { RhythmsApp } from "./apps/rhythms.js";
import "./osBridgeTelemetry.js";
import { resolveIconUrl, initializeMirrors, CDN_MIRRORS, getCdnMirror, setCdnMirror } from "./shared/assetResolver.js";
import { appMap } from "./games/gamesList.js";
import "./desktopui/taskbarPositionManager.js";
import logoImg from "./assets/logo.png";
import { showCdnPrompt } from "./shared/dialogs.js";
import { initializeOSBridge } from "./os/index.js";

initializeMirrors(appMap);
registerPWA();
const notificationCenter = new NotificationCenter();
const fileSystemManager = new FileSystemManager();
const windowManager = new WindowManager(notificationCenter);
import { bus } from "./core/EventBus.js";
import { trayManager } from "./tray/tray.js";
initializeOSBridge({
  windowManager,
  fileSystemManager,
  notificationCenter,
  appLauncher: null,
  eventBus: bus
});
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
const EnhancedEmojiSelectorApp = HybridAdapter.enhanceBaseApp(EmojiSelectorApp);
const EnhancedDataEditorApp = HybridAdapter.enhanceBaseApp(DataEditorApp);
const EnhancedYukiOsGuideApp = HybridAdapter.enhanceBaseApp(YukiOsGuideApp);
const EnhancedRhythmsApp = HybridAdapter.enhanceBaseApp(RhythmsApp);

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
explorerApp.setBrowser(browserApp);

const appCreatorApp = new AppCreatorApp(services);
services.appCreatorApp = appCreatorApp;

const monacoApp = new EnhancedMonacoApp(services);
services.monacoApp = monacoApp;

const shittifyApp = new ShittifyApp(services);

const model3dApp = new Model3DApp(services);
services.model3dApp = model3dApp;

const setupApp = new SetupApp(services);
services.setupApp = setupApp;

const dataEditorApp = new EnhancedDataEditorApp(services);
services.dataEditorApp = dataEditorApp;

const installedAppsApp = new InstalledAppsApp(services);
services.installedAppsApp = installedAppsApp;

const yukiOsGuideApp = new EnhancedYukiOsGuideApp(services);
services.yukiOsGuideApp = yukiOsGuideApp;

const clipboardManagerApp = new ClipboardManagerApp(services);
services.clipboardManagerApp = clipboardManagerApp;

const aiAssistantApp = new AIAssistantApp(services);
services.aiAssistantApp = aiAssistantApp;

const displayPerformanceApp = new DisplayPerformanceApp(services);
services.displayPerformanceApp = displayPerformanceApp;

const networkTrayApp = new NetworkTrayApp(services);
services.networkTrayApp = networkTrayApp;

const emojiSelectorApp = new EnhancedEmojiSelectorApp(services);
services.emojiSelectorApp = emojiSelectorApp;

const systemAppsApp = new SystemAppsApp(services);
services.systemAppsApp = systemAppsApp;

const rhythmsApp = new EnhancedRhythmsApp(services);
services.rhythmsApp = rhythmsApp;

const appLauncher = new AppLauncher(windowManager, fileSystemManager, {
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
  monaco: monacoApp,
  model3dApp,
  jsDosApp,
  v86app,
  youtubeApp,
  achievementsApp,
  adsManager: adsApp,
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
  brightnessApp: displayPerformanceApp,
  emojiSelectorApp,
  systemAppsApp,
  rhythmsApp
});
services.appLauncher = appLauncher;
windowManager.setAppLauncher(appLauncher);
appCreatorApp.setAppLauncher(appLauncher);
explorerApp.setAppLauncher(appLauncher);
installedAppsApp.setAppLauncher(appLauncher);

initializeOSBridge({
  windowManager,
  fileSystemManager,
  notificationCenter,
  appLauncher,
  eventBus: bus
});

import {
  trackLegacyCall as trackLegacyCallImport,
  getLegacyAPICalls,
  getLegacyAPICallStats,
  clearLegacyAPICalls
} from "./os/index.js";

window.trackLegacyCall = trackLegacyCallImport;

window.osBridgeTelemetry = {
  getLegacyCalls: getLegacyAPICalls,
  getStats: getLegacyAPICallStats,
  clearCalls: clearLegacyAPICalls
};

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
      "Neocities does not support loading assets from other domains! OS will be severely limited to load apps and data.",
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
      handleSteamUrlParam(appLauncher, windowManager);
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
