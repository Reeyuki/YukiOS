import { WindowAPI } from "./window.js";
import { FileSystemAPI } from "./fs.js";
import { StorageAPI } from "./storage.js";
import { DialogAPI } from "./dialog.js";
import { ModeAPI } from "./modes.js";
import type { OSServices, TorManagerService, ExplorerAppService } from "./types.js";
import { TorManager } from "../tor/TorManager.js";

export class NotificationAPI {
  constructor(private nc: any) {}

  send(title: string, message: string, options?: any): number {
    return this.nc.addNotification(
      title,
      message,
      options?.type || "info",
      options?.duration || 5000,
      options?.icon,
      options?.appSource
    );
  }

  clear(id: number): void {
    this.nc.removeNotification(id);
  }

  clearAll(): void {
    this.nc.clearAllNotifications();
  }

  getAll(): any[] {
    return this.nc.getNotifications?.() || [];
  }

  getCount(): number {
    return this.nc.getNotificationCount?.() || 0;
  }

  setDoNotDisturb(enabled: boolean): void {
    this.nc.setDoNotDisturb?.(enabled);
  }

  getDoNotDisturb(): boolean {
    return this.nc.doNotDisturb ?? false;
  }
}

export class AppAPI {
  _registry: Map<string, any> = new Map();
  private _launcher: any = null;

  setLauncher(launcher: any): void {
    this._launcher = launcher;
  }

  register(key: string, instance: any): void {
    this._registry.set(key, instance);
  }

  getInstance(key: string): any {
    return this._registry.get(key) || null;
  }

  launch(appId: string, options?: any): Promise<void> {
    if (!this._launcher) return Promise.reject(new Error("AppLauncher not initialized"));
    return this._launcher.launch(appId, false, options);
  }

  launchGame(appId: string, isSwf?: boolean, options?: any): Promise<void> {
    if (!this._launcher) return Promise.reject(new Error("AppLauncher not initialized"));
    return this._launcher.launch(appId, isSwf, options);
  }

  close(winId: string): void {
    const win = document.getElementById(winId);
    if (win) this._launcher?.wm?.closeWindow?.(win);
  }

  getRunningApps(): any[] {
    if (!this._launcher) return [];
    return this._launcher.listRunningApps?.() ?? [];
  }

  getAllApps(): Record<string, any> {
    return this._launcher?.appMap ?? {};
  }

  getAppInfo(appId: string): any {
    return this._launcher?.appMap?.[appId] ?? null;
  }

  hasApp(appId: string): boolean {
    return !!this._launcher?.appMap?.[appId];
  }

  searchApps(query: string): string[] {
    if (!this._launcher) return [];
    const q = query.toLowerCase();
    return Object.entries(this._launcher.appMap)
      .filter(([, app]: any) => app.title?.toLowerCase().includes(q))
      .map(([id]) => id);
  }

  async openIframeApp(options: any): Promise<void> {
    if (!this._launcher) return;
    await this._launcher.openIframeApp(options);
  }

  lockSession(): void {
    this._registry.get("sessionManager")?.lockSession();
  }

  lockToLoginScreen(): void {
    this._registry.get("sessionManager")?.lockToLoginScreen();
  }

  triggerAchievement(id: string): void {
    this._registry.get("achievementsApp")?.trigger(id);
  }

  incrementScreenshotTaken(): void {
    this._registry.get("achievementsApp")?.incrementScreenshotTaken();
  }

  incrementCalculationDone(): void {
    this._registry.get("achievementsApp")?.incrementCalculationDone();
  }

  incrementPowerProfileChange(): void {
    this._registry.get("achievementsApp")?.incrementPowerProfileChange();
  }

  executeCommand(cmd: string): void {
    const term = this._registry.get("terminalApp");
    if (term) {
      term.open();
      term.executeCommand(cmd);
    }
  }

  setClipboardContent(value: string): void {
    this._registry.get("clipboardManagerApp")?.set(value, "text");
  }

  takeScreenshot(autoCapture?: boolean): void {
    const app = this._registry.get("screenshotApp");
    if (app) {
      app.open();
      if (autoCapture) app.captureFull(true);
    }
  }

  registerCustomApp(appId: string, entry: any): void {
    if (this._launcher) {
      this._launcher.appMap[appId] = entry;
    }
  }

  unregisterCustomApp(appId: string): void {
    if (this._launcher) {
      delete this._launcher.appMap[appId];
    }
  }

  registerAppRuntime(appId: string, instance: any): void {
    if (this._launcher?.appRuntime) {
      this._launcher.appRuntime.register(appId, instance);
    }
  }

  unregisterAppRuntime(appId: string): void {
    if (this._launcher?.appRuntime) {
      this._launcher.appRuntime.unregister(appId);
    }
  }

  openFileInApp(name: string, path: string | string[]): void {
    const pathStr = Array.isArray(path) ? path.join("/") : path;
    import("../fileDisplay.js").then((mod) => {
      mod.openFileWith({ name, path: pathStr });
    });
  }
}

export class EventBusAPI {
  constructor(private bus: any) {}

  on(event: string, handler: any): void {
    this.bus.on(event, handler);
  }

  off(event: string, handler: any): void {
    this.bus.off(event, handler);
  }

  emit(event: string, data?: any): void {
    this.bus.emit(event, data);
  }

  once(event: string, handler: any): void {
    this.bus.once(event, handler);
  }
}

export class TrayAPI {
  constructor(private tray: any) {}

  register(winId: string, icon: string, label: string, options?: any): void {
    this.tray.register(winId, icon, label, options);
  }

  unregister(winId: string): void {
    this.tray.unregister(winId);
  }

  updateIcon(winId: string, icon: string): void {
    this.tray.updateIcon(winId, icon);
  }

  updateLabel(winId: string, label: string): void {
    this.tray.updateLabel(winId, label);
  }

  updateContextMenuItems(winId: string, items: any): void {
    this.tray.updateContextMenuItems(winId, items);
  }

  sendToTray(winId: string): void {
    this.tray.sendToTray(winId);
  }

  restoreFromTray(winId: string): void {
    this.tray.restoreFromTray(winId);
  }

  getTrayItems(): Map<string, any> {
    return this.tray.items;
  }

  isRegistered(winId: string): boolean {
    return this.tray.isRegistered(winId);
  }

  isInTray(winId: string): boolean {
    return this.tray.isInTray(winId);
  }

  updateItemVisibility(winId: string, visible: boolean): void {
    const item = this.tray.items.get(winId);
    if (item) {
      item.visibleInSettings = visible;
      this.tray.render();
    }
  }
}

export class TilingAPI {
  constructor(private wm: any) {}

  get enabled(): boolean {
    return this.wm?.isTilingEnabled() ?? false;
  }

  setEnabled(enabled: boolean): void {
    this.wm?.setTilingEnabled(enabled);
  }

  getEffectiveConfig(): any {
    return this.wm?.tilingManager?.getEffectiveConfig() ?? null;
  }

  updateConfig(changes: any): void {
    this.wm?.tilingManager?.updateConfig(changes);
  }

  applyBarSettings(): void {
    this.wm?.tilingManager?.tilingBar?.applySettings();
  }

  focusDirection(dir: string): void {
    this.wm?.tilingManager?.focusDirection(dir);
  }

  swapDirection(dir: string): void {
    this.wm?.tilingManager?.swapDirection(dir);
  }

  resizeDirection(dir: string): void {
    this.wm?.tilingManager?.resizeDirection(dir);
  }

  cycleFocus(forward: boolean): void {
    this.wm?.tilingManager?.cycleFocus(forward);
  }

  toggleFloating(): void {
    this.wm?.tilingManager?.toggleFloating();
  }

  toggleFullscreenOnTiled(): void {
    this.wm?.tilingManager?.toggleFullscreenOnTiled();
  }

  toggleSplitType(): void {
    this.wm?.tilingManager?.toggleSplitType();
  }

  closeFocusedWindow(): void {
    this.wm?.tilingManager?.closeFocusedWindow();
  }
}

class TorAPI {
  private _manager: TorManagerService | null = null;

  setManager(m: TorManagerService): void {
    this._manager = m;
  }

  private require(): TorManagerService {
    if (!this._manager) throw new Error("Tor not initialized");
    return this._manager;
  }

  get isReady(): boolean {
    return this._manager?.getStatus().ready ?? false;
  }

  get running(): boolean {
    return this._manager?.getStatus().running ?? false;
  }

  fetch(url: string): Promise<Response> {
    return this.require().fetch(url);
  }

  post(url: string, body: Uint8Array): Promise<Response> {
    return this.require().post(url, body);
  }

  request(
    method: string,
    url: string,
    headers?: Record<string, string>,
    body?: Uint8Array,
    timeout?: number
  ): Promise<Response> {
    return this.require().request(method, url, headers, body, timeout);
  }

  createClient(): Promise<any> {
    return this.require().createClient();
  }

  getStatus(): { running: boolean; phase: string; ready: boolean } {
    return this._manager?.getStatus() ?? { running: false, phase: "stopped", ready: false };
  }

  start(options?: Record<string, unknown>): Promise<void> {
    return this.require().start(options);
  }

  stop(): Promise<void> {
    return this.require().stop();
  }

  getLogs(): string[] {
    return this._manager?.getLogs() ?? [];
  }

  getSnowflakeUrl(): string {
    return (this._manager as any)?.snowflakeUrl;
  }

  setSnowflakeUrl(url: string): void {
    (this._manager as any).snowflakeUrl = url;
  }

  getFetchCount(): number {
    return this._manager?.getFetchCount() ?? 0;
  }

  reconnect(): void {
    this.require().reconnect();
  }
}

export class AchievementsAPI {
  constructor(private registry: Map<string, any>) {}

  trigger(id: string): void {
    this.registry.get("achievementsApp")?.trigger(id);
  }

  incrementAppLaunched(): void {
    this.registry.get("achievementsApp")?.incrementAppLaunched();
  }

  incrementGameLaunched(): void {
    this.registry.get("achievementsApp")?.incrementGameLaunched();
  }

  incrementScreenshotTaken(): void {
    this.registry.get("achievementsApp")?.incrementScreenshotTaken();
  }

  incrementCalculationDone(): void {
    this.registry.get("achievementsApp")?.incrementCalculationDone();
  }

  incrementPowerProfileChange(): void {
    this.registry.get("achievementsApp")?.incrementPowerProfileChange();
  }

  incrementSession(): void {
    this.registry.get("achievementsApp")?.incrementSession();
  }

  incrementWallpaper(): void {
    this.registry.get("achievementsApp")?.incrementWallpaper();
  }

  incrementTerminalCmd(): void {
    this.registry.get("achievementsApp")?.incrementTerminalCmd();
  }

  incrementFileUploaded(): void {
    this.registry.get("achievementsApp")?.incrementFileUploaded();
  }

  triggerCommandExecution(command: string): void {
    this.registry.get("achievementsApp")?.triggerCommandExecution(command);
  }

  unlock(achievementKey: string): any {
    return this.registry.get("achievementsApp")?.unlock?.(achievementKey);
  }
}

export class OSBridge {
  window: WindowAPI;
  fs: FileSystemAPI;
  notify: NotificationAPI;
  achievements: AchievementsAPI;
  app: AppAPI;
  events: EventBusAPI;
  storage: StorageAPI;
  dialog: DialogAPI;
  tray: TrayAPI;
  tor: TorAPI;
  tiling: TilingAPI;
  modes: ModeAPI;
  clipboardManager: any = null;
  fileSystemManager: any = null;
  windowManager: any = null;

  constructor(services: OSServices) {
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

    (window as any).os = this;
  }

  setAppLauncher(launcher: any): void {
    this.app.setLauncher(launcher);
  }

  setDialogExplorerApp(app: ExplorerAppService): void {
    this.dialog.setExplorerApp(app);
  }

  setTorManager(manager: TorManagerService): void {
    this.tor.setManager(manager);
  }
}
