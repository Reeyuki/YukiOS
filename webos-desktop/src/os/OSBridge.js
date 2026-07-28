import { WindowAPI } from "./window.js";
import { FileSystemAPI } from "./fs.js";
import { StorageAPI } from "./storage.js";
import { DialogAPI } from "./dialog.js";
import { ModeAPI } from "./modes.js";
import { TorManager } from "../tor/TorManager.js";

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
    this._registry = new Map();
    this._launcher = null;
  }

  setLauncher(launcher) {
    this._launcher = launcher;
  }

  register(key, instance) {
    this._registry.set(key, instance);
  }

  getInstance(key) {
    return this._registry.get(key) || null;
  }

  launch(appId, options) {
    if (!this._launcher) return Promise.reject(new Error("AppLauncher not initialized"));
    return this._launcher.launch(appId, false, options);
  }

  launchGame(appId, isSwf, options) {
    if (!this._launcher) return Promise.reject(new Error("AppLauncher not initialized"));
    return this._launcher.launch(appId, isSwf, options);
  }

  close(winId) {
    const win = document.getElementById(winId);
    if (win) this._launcher?.wm?.closeWindow?.(win);
  }

  getRunningApps() {
    if (!this._launcher) return [];
    return this._launcher.listRunningApps?.() ?? [];
  }

  getAllApps() {
    return this._launcher?.appMap ?? {};
  }

  getAppInfo(appId) {
    return this._launcher?.appMap?.[appId] ?? null;
  }

  hasApp(appId) {
    return !!this._launcher?.appMap?.[appId];
  }

  searchApps(query) {
    if (!this._launcher) return [];
    const q = query.toLowerCase();
    return Object.entries(this._launcher.appMap)
      .filter(([, app]) => app.title?.toLowerCase().includes(q))
      .map(([id]) => id);
  }

  async openIframeApp(options) {
    if (!this._launcher) return;
    await this._launcher.openIframeApp(options);
  }

  lockSession() {
    this._registry.get("sessionManager")?.lockSession();
  }

  lockToLoginScreen() {
    this._registry.get("sessionManager")?.lockToLoginScreen();
  }

  triggerAchievement(id) {
    this._registry.get("achievementsApp")?.trigger(id);
  }

  incrementScreenshotTaken() {
    this._registry.get("achievementsApp")?.incrementScreenshotTaken();
  }

  incrementCalculationDone() {
    this._registry.get("achievementsApp")?.incrementCalculationDone();
  }

  incrementPowerProfileChange() {
    this._registry.get("achievementsApp")?.incrementPowerProfileChange();
  }

  executeCommand(cmd) {
    const term = this._registry.get("terminalApp");
    if (term) {
      term.open();
      term.executeCommand(cmd);
    }
  }

  setClipboardContent(value) {
    this._registry.get("clipboardManagerApp")?.set(value, "text");
  }

  takeScreenshot(autoCapture) {
    const app = this._registry.get("screenshotApp");
    if (app) {
      app.open();
      if (autoCapture) app.captureFull(true);
    }
  }

  registerCustomApp(appId, entry) {
    if (this._launcher) {
      this._launcher.appMap[appId] = entry;
    }
  }

  unregisterCustomApp(appId) {
    if (this._launcher) {
      delete this._launcher.appMap[appId];
    }
  }

  registerAppRuntime(appId, instance) {
    if (this._launcher?.appRuntime) {
      this._launcher.appRuntime.register(appId, instance);
    }
  }

  unregisterAppRuntime(appId) {
    if (this._launcher?.appRuntime) {
      this._launcher.appRuntime.unregister(appId);
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
    this._manager = null;
  }

  setManager(m) {
    this._manager = m;
  }

  require() {
    if (!this._manager) throw new Error("Tor not initialized");
    return this._manager;
  }

  get isReady() {
    return this._manager?.getStatus().ready ?? false;
  }

  get running() {
    return this._manager?.getStatus().running ?? false;
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
    return this._manager?.getStatus() ?? { running: false, phase: "stopped", ready: false };
  }

  start(options) {
    return this.require().start(options);
  }

  stop() {
    return this.require().stop();
  }

  getLogs() {
    return this._manager?.getLogs() ?? [];
  }

  getSnowflakeUrl() {
    return this._manager?.snowflakeUrl;
  }

  setSnowflakeUrl(url) {
    this._manager.snowflakeUrl = url;
  }

  getFetchCount() {
    return this._manager?.getFetchCount() ?? 0;
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

export class OSBridge {
  constructor(services) {
    this.window = new WindowAPI(services.windowManager);
    this.windowManager = services.windowManager;
    this.fileSystemManager = services.fileSystemManager;
    this.fs = new FileSystemAPI(services.fileSystemManager);
    this.notify = new NotificationAPI(services.notificationCenter);
    this.app = new AppAPI();
    this.achievements = new AchievementsAPI(this.app._registry);
    this.events = new EventBusAPI(services.eventBus);
    this.storage = new StorageAPI();
    this.dialog = new DialogAPI();
    this.tray = new TrayAPI(services.trayManager);
    this.tor = new TorAPI();
    this.tiling = new TilingAPI(services.windowManager);
    this.modes = new ModeAPI();
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
