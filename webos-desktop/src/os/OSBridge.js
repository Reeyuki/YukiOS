import { WindowAPI } from "./window.js";
import { FileSystemAPI } from "./fs.js";
import { StorageAPI } from "./storage.js";
import { DialogAPI } from "./dialog.js";
import { ModeAPI } from "./modes.js";
import { TorManager } from "../tor/TorManager.js";
import { AccountAPI } from "../account/accountApi.js";
import { $ } from "../shared/domUtils.js";

export class NotificationAPI {
  constructor(nc) {
    this.nc = nc;
  }

  send(title, message, options) {
    return this.nc.addNotification(
      title,
      message,
      options?.type || "info",
      options?.duration || 5000,
      options?.icon,
      options?.appSource
    );
  }

  clear(id) {
    this.nc.removeNotification(id);
  }

  clearAll() {
    this.nc.clearAllNotifications();
  }

  getAll() {
    return this.nc.getNotifications?.() || [];
  }

  getCount() {
    return this.nc.getNotificationCount?.() || 0;
  }

  setDoNotDisturb(enabled) {
    this.nc.setDoNotDisturb?.(enabled);
  }

  getDoNotDisturb() {
    return this.nc.doNotDisturb ?? false;
  }
}

export class AppAPI {
  constructor() {
    this.registry = new Map();
    this.launcher = null;
  }

  setLauncher(launcher) {
    this.launcher = launcher;
  }

  register(key, instance) {
    this.registry.set(key, instance);
  }

  getInstance(key) {
    return this.registry.get(key) || null;
  }

  launch(appId, options) {
    if (!this.launcher) return Promise.reject(new Error("AppLauncher not initialized"));
    if (options && options.deckMode && this.launcher.wm) {
      this.launcher.wm.pendingLaunchOptions = { deckMode: true, ...(this.launcher.wm.pendingLaunchOptions || {}) };
    }
    return this.launcher.launch(appId, false, options);
  }

  launchGame(appId, isSwf, options) {
    if (!this.launcher) return Promise.reject(new Error("AppLauncher not initialized"));
    if (options && options.deckMode && this.launcher.wm) {
      this.launcher.wm.pendingLaunchOptions = { deckMode: true, ...(this.launcher.wm.pendingLaunchOptions || {}) };
    }
    return this.launcher.launch(appId, isSwf, options);
  }

  close(winId) {
    const win = $("#" + winId);
    if (win) this.launcher?.wm?.closeWindow?.(win);
  }

  getRunningApps() {
    if (!this.launcher) return [];
    return this.launcher.listRunningApps?.() ?? [];
  }

  getAllApps() {
    return this.launcher?.appMap ?? {};
  }

  getAppInfo(appId) {
    return this.launcher?.appMap?.[appId] ?? null;
  }

  hasApp(appId) {
    return !!this.launcher?.appMap?.[appId];
  }

  searchApps(query) {
    if (!this.launcher) return [];
    const q = query.toLowerCase();
    return Object.entries(this.launcher.appMap)
      .filter(([, app]) => app.title?.toLowerCase().includes(q))
      .map(([id]) => id);
  }

  async openIframeApp(options) {
    if (!this.launcher) return;
    await this.launcher.openIframeApp(options);
  }

  lockSession() {
    this.registry.get("sessionManager")?.lockSession();
  }

  lockToLoginScreen() {
    this.registry.get("sessionManager")?.lockToLoginScreen();
  }

  triggerAchievement(id) {
    this.registry.get("achievementsApp")?.trigger(id);
  }

  incrementScreenshotTaken() {
    this.registry.get("achievementsApp")?.incrementScreenshotTaken();
  }

  incrementCalculationDone() {
    this.registry.get("achievementsApp")?.incrementCalculationDone();
  }

  incrementPowerProfileChange() {
    this.registry.get("achievementsApp")?.incrementPowerProfileChange();
  }

  executeCommand(cmd) {
    const term = this.registry.get("terminalApp");
    if (term) {
      term.open();
      term.executeCommand(cmd);
    }
  }

  setClipboardContent(value) {
    this.registry.get("clipboardManagerApp")?.set(value, "text");
  }

  takeScreenshot(autoCapture) {
    const app = this.registry.get("screenshotApp");
    if (app) {
      app.open();
      if (autoCapture) app.captureFull(true);
    }
  }

  registerCustomApp(appId, entry) {
    if (this.launcher) {
      this.launcher.appMap[appId] = entry;
    }
  }

  unregisterCustomApp(appId) {
    if (this.launcher) {
      delete this.launcher.appMap[appId];
    }
  }

  registerAppRuntime(appId, instance) {
    if (this.launcher?.appRuntime) {
      this.launcher.appRuntime.register(appId, instance);
    }
  }

  unregisterAppRuntime(appId) {
    if (this.launcher?.appRuntime) {
      this.launcher.appRuntime.unregister(appId);
    }
  }

  openFileInApp(name, path) {
    const pathStr = Array.isArray(path) ? path.join("/") : path;
    import("../fileDisplay.js").then((mod) => {
      mod.openFileWith({ name, path: pathStr });
    });
  }
}

export class EventBusAPI {
  constructor(bus) {
    this.bus = bus;
  }

  on(event, handler) {
    this.bus.on(event, handler);
  }

  off(event, handler) {
    this.bus.off(event, handler);
  }

  emit(event, data) {
    this.bus.emit(event, data);
  }

  once(event, handler) {
    this.bus.once(event, handler);
  }
}

export class TrayAPI {
  constructor(tray) {
    this.tray = tray;
  }

  register(winId, icon, label, options) {
    this.tray.register(winId, icon, label, options);
  }

  unregister(winId) {
    this.tray.unregister(winId);
  }

  updateIcon(winId, icon) {
    this.tray.updateIcon(winId, icon);
  }

  updateLabel(winId, label) {
    this.tray.updateLabel(winId, label);
  }

  updateContextMenuItems(winId, items) {
    this.tray.updateContextMenuItems(winId, items);
  }

  sendToTray(winId) {
    this.tray.sendToTray(winId);
  }

  restoreFromTray(winId) {
    this.tray.restoreFromTray(winId);
  }

  getTrayItems() {
    return this.tray.items;
  }

  isRegistered(winId) {
    return this.tray.isRegistered(winId);
  }

  isInTray(winId) {
    return this.tray.isInTray(winId);
  }

  updateItemVisibility(winId, visible) {
    const item = this.tray.items.get(winId);
    if (item) {
      item.visibleInSettings = visible;
      this.tray.render();
    }
  }
}

export class TilingAPI {
  constructor(wm) {
    this.wm = wm;
  }

  get enabled() {
    return this.wm?.isTilingEnabled() ?? false;
  }

  setEnabled(enabled) {
    this.wm?.setTilingEnabled(enabled);
  }

  getEffectiveConfig() {
    return this.wm?.tilingManager?.getEffectiveConfig() ?? null;
  }

  updateConfig(changes) {
    this.wm?.tilingManager?.updateConfig(changes);
  }

  applyBarSettings() {
    this.wm?.tilingManager?.tilingBar?.applySettings();
  }

  focusDirection(dir) {
    this.wm?.tilingManager?.focusDirection(dir);
  }

  swapDirection(dir) {
    this.wm?.tilingManager?.swapDirection(dir);
  }

  resizeDirection(dir) {
    this.wm?.tilingManager?.resizeDirection(dir);
  }

  cycleFocus(forward) {
    this.wm?.tilingManager?.cycleFocus(forward);
  }

  toggleFloating() {
    this.wm?.tilingManager?.toggleFloating();
  }

  toggleFullscreenOnTiled() {
    this.wm?.tilingManager?.toggleFullscreenOnTiled();
  }

  toggleSplitType() {
    this.wm?.tilingManager?.toggleSplitType();
  }

  closeFocusedWindow() {
    this.wm?.tilingManager?.closeFocusedWindow();
  }
}

class TorAPI {
  constructor() {
    this.manager = null;
  }

  setManager(m) {
    this.manager = m;
  }

  require() {
    if (!this.manager) throw new Error("Tor not initialized");
    return this.manager;
  }

  get isReady() {
    return this.manager?.getStatus().ready ?? false;
  }

  get running() {
    return this.manager?.getStatus().running ?? false;
  }

  fetch(url) {
    return this.require().fetch(url);
  }

  post(url, body) {
    return this.require().post(url, body);
  }

  request(method, url, headers, body, timeout) {
    return this.require().request(method, url, headers, body, timeout);
  }

  createClient() {
    return this.require().createClient();
  }

  getStatus() {
    return this.manager?.getStatus() ?? { running: false, phase: "stopped", ready: false };
  }

  start(options) {
    return this.require().start(options);
  }

  stop() {
    return this.require().stop();
  }

  getLogs() {
    return this.manager?.getLogs() ?? [];
  }

  getSnowflakeUrl() {
    return this.manager?.snowflakeUrl;
  }

  setSnowflakeUrl(url) {
    this.manager.snowflakeUrl = url;
  }

  getFetchCount() {
    return this.manager?.getFetchCount() ?? 0;
  }

  reconnect() {
    this.require().reconnect();
  }
}

export class AchievementsAPI {
  constructor(registry) {
    this.registry = registry;
  }

  trigger(id) {
    this.registry.get("achievementsApp")?.trigger(id);
  }

  incrementAppLaunched() {
    this.registry.get("achievementsApp")?.incrementAppLaunched();
  }

  incrementGameLaunched() {
    this.registry.get("achievementsApp")?.incrementGameLaunched();
  }

  incrementScreenshotTaken() {
    this.registry.get("achievementsApp")?.incrementScreenshotTaken();
  }

  incrementCalculationDone() {
    this.registry.get("achievementsApp")?.incrementCalculationDone();
  }

  incrementPowerProfileChange() {
    this.registry.get("achievementsApp")?.incrementPowerProfileChange();
  }

  incrementSession() {
    this.registry.get("achievementsApp")?.incrementSession();
  }

  incrementWallpaper() {
    this.registry.get("achievementsApp")?.incrementWallpaper();
  }

  incrementTerminalCmd() {
    this.registry.get("achievementsApp")?.incrementTerminalCmd();
  }

  incrementFileUploaded() {
    this.registry.get("achievementsApp")?.incrementFileUploaded();
  }

  triggerCommandExecution(command) {
    this.registry.get("achievementsApp")?.triggerCommandExecution(command);
  }

  unlock(achievementKey) {
    return this.registry.get("achievementsApp")?.unlock?.(achievementKey);
  }
}

export class PortAPI {
  constructor(manager) {
    this.manager = manager;
  }

  register(port, handler, root) {
    return this.manager.register(port, handler, root);
  }

  unregister(port) {
    return this.manager.unregister(port);
  }

  get(port) {
    return this.manager.get(port);
  }

  isRegistered(port) {
    return this.manager.isRegistered(port);
  }

  list() {
    return this.manager.list();
  }
}

export class OSBridge {
  constructor(services) {
    this.window = new WindowAPI(services.windowManager);
    this.windowManager = services.windowManager;
    this.fileSystemManager = services.fileSystemManager;
    this.fs = new FileSystemAPI(services.fileSystemManager);
    this.notify = new NotificationAPI(services.notificationCenter);
    this.app = new AppAPI();
    this.achievements = new AchievementsAPI(this.app.registry);
    this.events = new EventBusAPI(services.eventBus);
    this.storage = new StorageAPI();
    this.dialog = new DialogAPI();
    this.tray = new TrayAPI(services.trayManager);
    this.ports = new PortAPI(services.portManager);
    this.tor = new TorAPI();
    this.tiling = new TilingAPI(services.windowManager);
    this.modes = new ModeAPI();
    this.account = new AccountAPI();
    this.clipboardManager = null;

    window.os = this;
  }

  setAppLauncher(launcher) {
    this.app.setLauncher(launcher);
  }

  setDialogExplorerApp(app) {
    this.dialog.setExplorerApp(app);
  }

  setTorManager(manager) {
    this.tor.setManager(manager);
  }
}
