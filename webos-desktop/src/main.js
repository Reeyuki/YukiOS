import { ExplorerApp } from "./apps/explorer.js";
import { WindowManager } from "./windowManager.js";
import { AppLauncher } from "./appLauncher.js";
import { BrowserApp } from "./apps/browser.js";
import { NotepadApp } from "./apps/notepad.js";
import { SystemUtilities } from "./system.js";
import { setGameLauncher } from "./games/games.js";
import { FileSystemManager } from "./fs.js";
import { setupStartMenu, toggleStartMenu } from "./desktopui/startMenu.js";
import { DesktopUI } from "./desktopui/desktopui.js";
import { DesktopPeekManager } from "./desktopPeek.js";
import { SettingsApp } from "./settings/settings.js";
import { AppCreatorApp } from "./apps/appCreator.js";
import { OfficeAppProxy } from "./office/officeLoader.js";
import { parseBool } from "./shared/boolUtils.js";
import { NotificationCenter } from "./notificationCenter.js";
import { JsDosApp } from "./apps/jsdos.js";
import { V86App } from "./apps/v86.js";

import { setDesktopUI, handleSteamUrlParam } from "./games/games.js";
import { registerPWA } from "./pwa/pwa.js";
import { SessionManager } from "./SessionManager.js";
import { CommandPalette } from "./commandPalette.js";
import { ClipboardManager } from "./systemClipboardManager.js";

import { resolveIconUrl, initializeMirrors, CDN_MIRRORS, getCdnMirror, setCdnMirror } from "./shared/assetResolver.js";
import { appMap } from "./games/gamesList.js";
import "./desktopui/taskbarPositionManager.js";
import { isMobile, isTouchDevice } from "./shared/platformUtils.js";
import { batteryPerformanceManager } from "./services/BatteryPerformanceManager.js";
import "./styles/batterySaver.css";
import logoImg from "./assets/logo.png";
import { showCdnPrompt } from "./shared/dialogs.js";
import { initializeOSBridge, setDialogExplorerApp } from "./os/index.js";
import { loadApps } from "./AppLoader.js";
import { init } from "./cursorEffect.js";
import { versionChecker } from "./versionChecker.js";
import { $ } from "./shared/domUtils.js";
import { showBootScreen } from "./bootScreen.js";
import { checkAndShowDonationPopup } from "./donationPopup.js";
import { bus } from "./core/EventBus.js";
import { trayManager } from "./tray/tray.js";
import { MacControlCenter } from "./tray/macControlCenter.js";
import { MenuBarManager } from "./menuBar/MenuBarManager.js";

registerPWA();

document.documentElement.removeAttribute("style");

const root = document.documentElement;
if (isMobile() || isTouchDevice()) {
  root.classList.add("is-mobile");
  document.body.style.cursor = "default";
}

const notificationCenter = new NotificationCenter();
const fileSystemManager = new FileSystemManager();
const windowManager = new WindowManager(notificationCenter);
const desktopPeekManager = new DesktopPeekManager(windowManager);
const clipboardManager = new ClipboardManager(bus);

trayManager.init(windowManager, bus);

const os = initializeOSBridge({
  windowManager,
  fileSystemManager,
  notificationCenter,
  eventBus: bus,
  trayManager
});

os.clipboardManager = clipboardManager;
new MacControlCenter();
init();
window.os = os;

const boot = showBootScreen();

const preloaded = {};

{
  const apps = [
    ["notepadApp", new NotepadApp(os)],
    ["explorerApp", new ExplorerApp(os)],
    ["officeApp", new OfficeAppProxy(os)],
    ["browserApp", new BrowserApp(os)],
    ["jsDosApp", new JsDosApp(os)],
    ["v86app", new V86App(os)],
    ["settingsApp", new SettingsApp(os)],
    ["appCreatorApp", new AppCreatorApp(os)]
  ];
  for (const [key, instance] of apps) {
    preloaded[key] = instance;
    os.app.register(key, instance);
  }
}

setDialogExplorerApp(preloaded.explorerApp);

const appRegistry = loadApps(os, preloaded);

const explorerApp = preloaded.explorerApp;
const notepadApp = preloaded.notepadApp;
const browserApp = preloaded.browserApp;
const officeApp = preloaded.officeApp;
const jsDosApp = preloaded.jsDosApp;
const v86App = preloaded.v86app;
const settingsApp = preloaded.settingsApp;
const appCreatorApp = preloaded.appCreatorApp;

const appLauncher = new AppLauncher(windowManager, fileSystemManager, os.app._registry);
os.setAppLauncher(appLauncher);
windowManager.setAppLauncher(appLauncher);
setGameLauncher(appLauncher);

appLauncher.setEmulatorApp(os.app.getInstance("emulatorApp"));
appLauncher.overlayController = null;

appCreatorApp.restoreInstalledApps();

const installedAppsApp = os.app.getInstance("installedAppsApp");

const desktopUI = new DesktopUI(explorerApp);
os.desktopUI = desktopUI;
explorerApp.desktopUI = desktopUI;
desktopUI.fs = fileSystemManager;
fileSystemManager.setDesktopUI(desktopUI);
setDesktopUI(desktopUI);

const sessionManager = new SessionManager(os);
const commandPalette = new CommandPalette(os);

const menuBar = new MenuBarManager(os);

SystemUtilities.startClock();
SystemUtilities.setSettings(settingsApp);
SystemUtilities.startTaskbarWeather();

async function start() {
  const faScript = $('script[src*="font-awesome"], script[src*="fontawesome"]');
  if (!faScript) {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.0.1/js/all.min.js";
    s.defer = true;
    s.crossOrigin = "anonymous";
    document.head.appendChild(s);
  }

  await clipboardManager.init();
  setTimeout(() => initializeMirrors(appMap), 100);

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
  setDesktopUI(desktopUI);
  await SystemUtilities.loadWallpaper();
  windowManager.restorePinnedItems();
  desktopPeekManager.setupPeekButton();

  const sessionPromise = sessionManager.showLogin();
  await boot.hide();
  await sessionPromise;

  batteryPerformanceManager.init();
  versionChecker.start();
  menuBar.init();
  setTimeout(() => checkAndShowDonationPopup(), 4000);

  const url = new URL(location.href);

  if (url.hostname === "yukios.vercel.app") {
    url.hostname = "yukios.netlify.app";
    location.replace(url.toString());
  }

  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);
  const game = urlParams.get("game");
  const app = urlParams.get("app");
  const swf = parseBool(urlParams.get("swf"));
  const steamParam = urlParams.get("steam");

  const pathMatch = window.location.pathname.match(/^\/(app|game)\/(.+)\.html$/);
  const featureMatch = window.location.pathname.match(/^\/feature\/(.+)\.html$/);
  const isFeatureIndex = window.location.pathname === "/features.html";

  if (pathMatch) {
    const id = pathMatch[2];
    setTimeout(() => {
      appLauncher.launch(id);
    }, 0);
  } else if (featureMatch) {
    const FEATURE_APP_MAP = {
      terminal: "terminalApp",
      games: "steamApp",
      tiling: null,
      "mac-mode": null,
      emulators: null,
      "3d-room": "room3dApp",
      "start-menu": null,
      workspaces: null,
      widgets: null,
      "audio-mixer": null,
      "user-accounts": null
    };
    const appId = FEATURE_APP_MAP[featureMatch[1]];
    if (appId) {
      setTimeout(() => {
        appLauncher.launch(appId);
      }, 0);
    }
  } else if (isFeatureIndex) {
  } else if (steamParam) {
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
  setupStartMenu(sessionManager);
}

start();
