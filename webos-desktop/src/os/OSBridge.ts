import { WindowAPI } from "./window.js";
import { FileSystemAPI } from "./fs.js";
import { StorageAPI } from "./storage.js";
import { DialogAPI } from "./dialog.js";
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
  private _appsProxy: any = null;

  get apps() {
    if (!this._appsProxy) {
      this._appsProxy = new Proxy(
        {},
        {
          get: (_: any, prop: string) => {
            if (typeof prop !== "string") return undefined;
            return this._registry.get(prop) || this._registry.get(prop + "App") || null;
          }
        }
      );
    }
    return this._appsProxy;
  }

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

export class OSBridge {
  window: WindowAPI;
  fs: FileSystemAPI;
  notify: NotificationAPI;
  app: AppAPI;
  events: EventBusAPI;
  storage: StorageAPI;
  dialog: DialogAPI;
  tray: TrayAPI;
  tor: TorAPI;
  kernel: Record<string, any> = {};

  constructor(services: OSServices) {
    this.window = new WindowAPI(services.windowManager);
    this.fs = new FileSystemAPI(services.fileSystemManager);
    this.notify = new NotificationAPI(services.notificationCenter);
    this.app = new AppAPI();
    this.events = new EventBusAPI(services.eventBus);
    this.storage = new StorageAPI();
    this.dialog = new DialogAPI();
    this.tray = new TrayAPI(services.trayManager);
    this.tor = new TorAPI();

    this.kernel.windowManager = services.windowManager;
    this.kernel.fileSystemManager = services.fileSystemManager;
    this.kernel.appRegistry = this.app._registry;

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
