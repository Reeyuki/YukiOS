import "./styles/papirusIcons.css";
import "./styles/batterySaver.css";
import { ExplorerApp } from "./apps/explorer.js";
import { WindowManager } from "./windowManager.js";
import { AppLauncher } from "./appLauncher.js";
import { BrowserApp } from "./apps/browser.js";
import { NotepadApp } from "./apps/notepad.js";
import { SystemUtilities } from "./system.js";
import { setGameLauncher, initSteamDataManagerCache, setDesktopUI, handleSteamUrlParam } from "./games/games.js";
import { FileSystemManager } from "./fs.js";
import { setupStartMenu } from "./desktopui/startMenu.js";
import { DesktopUI } from "./desktopui/desktopui.js";
import { DesktopPeekManager } from "./desktopPeek.js";
import { SettingsApp } from "./settings/settings.js";
import { AppCreatorApp } from "./apps/appCreator.js";
import { OfficeAppProxy } from "./office/officeLoader.js";
import { parseBool } from "./utils/utils.js";
import { NotificationCenter } from "./notificationCenter.js";
import { JsDosApp } from "./apps/jsdos.js";
import { V86App } from "./apps/v86.js";
import { registerPWA } from "./pwa/pwa.js";
import { SessionManager } from "./SessionManager.js";
import { CommandPalette } from "./commandPalette.js";
import { ClipboardManager } from "./systemClipboardManager.js";
import { initializeMirrors } from "./shared/assetResolver.js";
import { applyIconPack, getIconPack } from "./shared/iconPack.js";
import { initLiveIconRefresh } from "./shared/liveIconRefresh.js";
import { appMap } from "./games/gamesList.js";
import { taskbarPositionManager } from "./desktopui/taskbarPositionManager.js";
import { isMobile, isTouchDevice } from "./shared/platformUtils.js";
import { batteryPerformanceManager } from "./services/BatteryPerformanceManager.js";
import { PortManager } from "./services/PortManager.js";
import logoImg from "./assets/logo.png";
import { initializeOSBridge, setDialogExplorerApp } from "./os/index.js";
import { loadApps } from "./AppLoader.js";
import { init as initCursorEffect } from "./cursorEffect.js";
import { versionChecker } from "./versionChecker.js";
import { $, createElement } from "./shared/domUtils.js";
import { StorageKeys } from "./StorageKeys.js";
import { ServiceKeys } from "./ServiceKeys.js";
import { showBootScreen } from "./bootScreen.js";
import { deckCapture } from "./modes/steamdeck/deckCapture.js";
import { initPopunder } from "./ads.js";
import { bus } from "./core/EventBus.js";
import { resolveDeepLink } from "./core/deepLinks.js";
import { trayManager } from "./tray/tray.js";
import { MacControlCenter } from "./modes/macos/ControlCenter.js";
import { MenuBarManager } from "./modes/macos/MenuBarManager.js";
import { applyStartButtonIcon } from "./desktopui/startButtonManager.js";

const LEGACY_HOST = "yukios.vercel.app";
const CANONICAL_HOST = "yukios.netlify.app";
const ACCOUNT_SYNC_DELAY_MS = 2500;
const POPUNDER_DELAY_MS = 5000;
const FONT_AWESOME_CDN = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/js/all.min.js";

let bootScreen = null;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/** Runs a non-critical startup step; a failure is logged instead of aborting boot. */
function safely(label, fn) {
  try {
    return fn();
  } catch (err) {
    console.warn(`[boot] ${label} failed:`, err);
    return undefined;
  }
}

/** Sends old-domain visitors to the canonical host before anything else loads. */
function redirectLegacyHost() {
  if (location.hostname !== LEGACY_HOST) return false;
  const url = new URL(location.href);
  url.hostname = CANONICAL_HOST;
  location.replace(url.toString());
  return true;
}

function isPapirusEnabled(os) {
  try {
    const value = os.storage.get(StorageKeys.papirusEnabled);
    return value === true || value === "true" || value === "1";
  } catch {
    return true;
  }
}

// Without the Papirus icon theme, fall back to Font Awesome's script build.
function loadFontAwesomeFallback() {
  if ($('script[src*="font-awesome"], script[src*="fontawesome"]')) return;
  const script = createElement("script");
  script.src = FONT_AWESOME_CDN;
  script.defer = true;
  script.crossOrigin = "anonymous";
  document.head.appendChild(script);
}

/** Pulls then pushes account data, in that order, so a push never overwrites unsynced remote changes. */
async function syncAccountIfEnabled() {
  const [{ syncPull, syncPush, isSyncEnabledPref }, { isLoggedIn }] = await Promise.all([
    import("./account/syncEngine.js"),
    import("./account/session.js")
  ]);
  if (!isLoggedIn() || !isSyncEnabledPref()) return;
  await syncPull().catch((err) => console.warn("[sync] pull failed:", err));
  await syncPush().catch((err) => console.warn("[sync] push failed:", err));
}

function runDeepLink(link, appLauncher, windowManager) {
  setTimeout(() => {
    if (link.action === "steam") handleSteamUrlParam(appLauncher, windowManager);
    else if (link.swf === undefined) appLauncher.launch(link.id);
    else appLauncher.launch(link.id, link.swf);
  }, 0);
}

/** Last-resort screen so a boot failure never leaves the user stuck on the splash. */
function showFatalBootError(err) {
  console.error("[boot] YukiOS failed to start:", err);
  safely("hide boot screen", () => bootScreen?.hide());

  const overlay = document.createElement("div");
  overlay.setAttribute("role", "alert");
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;" +
    "justify-content:center;gap:16px;background:#0f0f1a;color:#ddd;font:16px/1.5 system-ui,sans-serif;padding:24px;text-align:center";

  const title = document.createElement("h1");
  title.textContent = "YukiOS failed to start";
  title.style.cssText = "margin:0;color:#fff;font-size:24px";

  const detail = document.createElement("pre");
  detail.textContent = String(err?.message || err);
  detail.style.cssText = "max-width:min(640px,90vw);white-space:pre-wrap;color:#f99;margin:0;font-size:13px";

  const button = document.createElement("button");
  button.textContent = "Reload";
  button.style.cssText =
    "padding:10px 28px;border-radius:8px;border:2px solid #d97706;background:transparent;color:#d97706;font:600 16px system-ui;cursor:pointer";
  button.addEventListener("click", () => location.reload());

  overlay.append(title, detail, button);
  document.body.appendChild(overlay);
}

/* -------------------------------------------------------------------------- */
/*  Boot                                                                      */
/* -------------------------------------------------------------------------- */

async function bootstrap() {
  registerPWA();

  document.documentElement.removeAttribute("style");
  if (isMobile() || isTouchDevice()) {
    document.documentElement.classList.add("is-mobile");
    document.body.style.cursor = "default";
  }

  // Core services
  const notificationCenter = new NotificationCenter();
  const portManager = new PortManager();
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
    trayManager,
    portManager
  });

  notificationCenter.restorePersistedState();
  safely("restore taskbar position", () => taskbarPositionManager.restorePersistedPosition());

  os.clipboardManager = clipboardManager;
  void new MacControlCenter(); // constructed for its side effects (registers itself)
  initCursorEffect();
  window.os = os;
  deckCapture.install();

  bootScreen = showBootScreen();

  // Built-in apps that must exist before the rest of the registry loads
  const preloaded = {};
  const builtIns = [
    ["notepadApp", new NotepadApp(os)],
    ["explorerApp", new ExplorerApp(os)],
    ["officeApp", new OfficeAppProxy(os)],
    ["browserApp", new BrowserApp(os)],
    ["jsDosApp", new JsDosApp(os)],
    ["v86app", new V86App(os)],
    ["settingsApp", new SettingsApp(os)],
    ["appCreatorApp", new AppCreatorApp(os)]
  ];
  for (const [key, instance] of builtIns) {
    preloaded[key] = instance;
    os.app.register(key, instance);
  }

  const { explorerApp, settingsApp, appCreatorApp } = preloaded;
  setDialogExplorerApp(explorerApp);
  loadApps(os, preloaded);

  const appLauncher = new AppLauncher(windowManager, fileSystemManager, os.app.registry);
  os.setAppLauncher(appLauncher);
  windowManager.setAppLauncher(appLauncher);
  setGameLauncher(appLauncher);
  initSteamDataManagerCache();
  appLauncher.setEmulatorApp(os.app.getInstance(ServiceKeys.EMULATOR));

  appCreatorApp.restoreInstalledApps();

  // Desktop shell
  const desktopUI = new DesktopUI(explorerApp);
  os.desktopUI = desktopUI;
  os.app.register("desktopUI", desktopUI);
  explorerApp.desktopUI = desktopUI;
  desktopUI.fs = fileSystemManager;
  fileSystemManager.setDesktopUI(desktopUI);
  setDesktopUI(desktopUI);

  const sessionManager = new SessionManager(os);
  os.app.register("sessionManager", sessionManager);
  os.app.register("commandPalette", new CommandPalette(os));

  const menuBar = new MenuBarManager(os);

  SystemUtilities.startClock();
  SystemUtilities.setSettings(settingsApp);
  SystemUtilities.startTaskbarWeather();

  // Appearance and background services
  setTimeout(() => {
    syncAccountIfEnabled().catch((err) => console.warn("[sync] skipped:", err));
  }, ACCOUNT_SYNC_DELAY_MS);

  safely("icon pack", () => applyIconPack(getIconPack()));
  safely("live icon refresh", initLiveIconRefresh);
  if (!isPapirusEnabled(os)) loadFontAwesomeFallback();

  await clipboardManager.init();

  setTimeout(() => {
    initializeMirrors(appMap);
    safely("start button icon", applyStartButtonIcon);
  }, 100);

  document.documentElement.style.setProperty("--start-logo-url", `url("${logoImg}")`);
  safely("start button icon", applyStartButtonIcon);

  await SystemUtilities.loadWallpaper();
  windowManager.restorePinnedItems();
  desktopPeekManager.setupPeekButton();

  // Login, then reveal the desktop
  const sessionPromise = sessionManager.showLogin();
  await bootScreen.hide();
  await sessionPromise;

  batteryPerformanceManager.init();
  versionChecker.start();
  menuBar.init();
  setTimeout(() => initPopunder(), POPUNDER_DELAY_MS);

  const link = resolveDeepLink({ pathname: location.pathname, search: location.search }, { parseBool });
  if (link) runDeepLink(link, appLauncher, windowManager);

  setupStartMenu(sessionManager);

  if (window.electronAPI?.onTrayAction) {
    import("./services/electronTrayBridge.js")
      .then(({ initElectronTrayBridge }) => initElectronTrayBridge(os))
      .catch((err) => console.warn("[tray] bridge failed to start:", err));
  }
}

if (!redirectLegacyHost()) {
  bootstrap().catch(showFatalBootError);
}
