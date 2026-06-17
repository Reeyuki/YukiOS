import { ExplorerApp } from "./apps/explorer.js";
import { WindowManager } from "./windowManager.js";
import { AppLauncher } from "./appLauncher.js";
import { BrowserApp } from "./apps/browserApp.js";
import { NotepadApp } from "./apps/notepad.js";
import { SystemUtilities } from "./system.js";
import { setGameLauncher } from "./games/games.js";
import { FileSystemManager } from "./fs.js";
import { setupStartMenu } from "./desktopui/startMenu.js";
import { DesktopUI } from "./desktopui/desktopui.js";
import { SettingsApp } from "./settings/settings.js";
import { AppCreatorApp } from "./apps/appCreator.js";
import { OfficeAppProxy } from "./office/officeLoader.js";
import { YouTubeUtilsApp } from "./apps/youtubeUtils.js";
import { NotificationCenter } from "./notificationCenter.js";
import { JsDosApp } from "./apps/jsdos.js";
import { V86App } from "./apps/v86.js";

import { AccountManagerApp } from "./apps/accountManager.js";
import { setDesktopUI as setGamesDesktopUI, handleSteamUrlParam } from "./games/games.js";
import { AdsManager } from "./ads.js";
import { registerPWA } from "./pwa/pwa.js";
import { SessionManager } from "./SessionManager.js";
import { CommandPalette } from "./commandPalette.js";
import { ClipboardManager } from "./systemClipboardManager.js";
import "./osBridgeTelemetry.js";
import { resolveIconUrl, initializeMirrors, CDN_MIRRORS, getCdnMirror, setCdnMirror } from "./shared/assetResolver.js";
import { appMap } from "./games/gamesList.js";
import "./desktopui/taskbarPositionManager.js";
import logoImg from "./assets/logo.png";
import { showCdnPrompt } from "./shared/dialogs.js";
import { initializeOSBridge, setDialogExplorerApp } from "./os/index.js";
import { loadApps } from "./AppLoader.js";

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

const notepadApp = new NotepadApp(services);
services.notepadApp = notepadApp;

const youtubeUtilsApp = new YouTubeUtilsApp(services);
services.youtubeUtilsApp = youtubeUtilsApp;

const explorerApp = new ExplorerApp(services);
services.explorerApp = explorerApp;
setDialogExplorerApp(explorerApp);

const officeApp = new OfficeAppProxy(services);
services.officeApp = officeApp;

officeApp.setExplorer(explorerApp);
explorerApp.setOfficeApp(officeApp);

notepadApp.setExplorer(explorerApp);

const browserApp = new BrowserApp(services);
services.browserApp = browserApp;

youtubeUtilsApp.setBrowserApp(browserApp);

const jsDosApp = new JsDosApp(services);
services.jsDosApp = jsDosApp;
explorerApp.setJsDos(jsDosApp);

const v86app = new V86App(services);
services.v86app = v86app;
explorerApp.setv86App(v86app);

const settingsApp = new SettingsApp(services);
services.settingsApp = settingsApp;
settingsApp.setFileSystemManager(fileSystemManager);

const accountManagerApp = new AccountManagerApp(services);
services.accountManagerApp = accountManagerApp;
accountManagerApp.setSettingsApp(settingsApp);

const adsApp = new AdsManager(windowManager);
services.adsApp = adsApp;
explorerApp.setBrowser(browserApp);

const appCreatorApp = new AppCreatorApp(services);
services.appCreatorApp = appCreatorApp;

loadApps(services);

const appLauncher = new AppLauncher(windowManager, fileSystemManager, services);
services.appLauncher = appLauncher;
appLauncher.setEmulatorApp(services.emulatorApp);
setGameLauncher(appLauncher);
windowManager.setAppLauncher(appLauncher);
appCreatorApp.setAppLauncher(appLauncher);
explorerApp.setAppLauncher(appLauncher);
services.installedAppsApp.setAppLauncher(appLauncher);

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
  accountManagerApp.setSettingsApp(settingsApp);
  appCreatorApp.setDesktopUI(desktopUI);
  appCreatorApp.setAppLauncher(appLauncher);
  appCreatorApp.restoreInstalledApps();
  SystemUtilities.startClock();
  SystemUtilities.setSettings(settingsApp);
  SystemUtilities.startTaskbarWeather(appLauncher);
  await SystemUtilities.loadWallpaper();
  windowManager.restorePinnedItems();

  await sessionManager.showLogin();

  if (location.hostname.endsWith("neocities.org")) {
    os.dialog.alert(
      "Neocities Warning",
      "Neocities does not support loading assets from other domains! OS will be severely limited to load apps and data."
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
