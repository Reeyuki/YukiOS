import { WindowAPI } from "./window.js";
import { FileSystemAPI } from "./fs.js";
import { StorageAPI } from "./storage.js";
import { DialogAPI } from "./dialog.js";
import { trayManager } from "../tray/tray.js";
import { TorManager } from "../tor/TorManager.js";
import type { OSServices, TorManagerService, ExplorerAppService } from "./types.js";

let osServices: OSServices | null = null;
let windowAPI: WindowAPI | null = null;
let fileSystemAPI: FileSystemAPI | null = null;
const storageAPI = new StorageAPI();
const dialogAPI = new DialogAPI();
let torManager: TorManagerService | null = null;

function requireServices(): NonNullable<OSServices> {
  if (!osServices) throw new Error("[OS Bridge] API not initialized. Call initializeOSBridge() first.");
  return osServices;
}

function requireWindow(): WindowAPI {
  if (!windowAPI) throw new Error("[OS Bridge] Window API not initialized.");
  return windowAPI;
}

function requireFS(): FileSystemAPI {
  if (!fileSystemAPI) throw new Error("[OS Bridge] FileSystem API not initialized.");
  return fileSystemAPI;
}

export function initializeOSBridge(services: OSServices) {
  osServices = services;
  windowAPI = new WindowAPI(services.windowManager);
  fileSystemAPI = new FileSystemAPI(services.fileSystemManager);
  cachedWindow = buildWindow();
  cachedFS = buildFS();
  cachedNotify = buildNotify();
  cachedApp = buildApp();
  cachedEvents = buildEvents();
  cachedTray = buildTray();

  console.log("[OS Bridge] Initialized");
  (window as unknown as Record<string, unknown>).os = os;
}

export function setDialogExplorerApp(app: ExplorerAppService): void {
  dialogAPI.setExplorerApp(app);
}

let torUnsub: (() => void) | null = null;

let cachedWindow: object | null = null;
let cachedFS: object | null = null;
let cachedNotify: object | null = null;
let cachedTray: object | null = null;
let cachedApp: object | null = null;
let cachedEvents: object | null = null;
let cachedTor: object | null = null;

function buildWindow() {
  const api = requireWindow();
  return {
    create: (id: string, title: string, width?: string | number, height?: string | number, options?: any) =>
      api.create(id, title, width, height, options),
    close: (win: any) => api.close(win),
    closeAll: () => api.closeAll(),
    focus: (win: any) => api.focus(win),
    minimize: (win: any) => api.minimize(win),
    maximize: (win: any) => api.maximize(win),
    bringToFront: (win: any) => api.bringToFront(win),
    addToTaskbar: (winId: string, title: string, icon: string, color?: string) =>
      api.addToTaskbar(winId, title, icon, color),
    removeFromTaskbar: (winId: string) => api.removeFromTaskbar(winId),
    getWindowControls: (url?: string, showDownload?: boolean) => api.getWindowControls(url, showDownload)
  };
}

function buildFS() {
  const api = requireFS();
  return {
    read: (path: any, options?: any) => api.read(path, options),
    write: (path: any, content: any, options?: any) => api.write(path, content, options),
    readdir: (path: any) => api.readdir(path),
    mkdir: (path: any) => api.mkdir(path),
    delete: (path: any, name?: string) => api.delete(path, name),
    exists: (path: any) => api.exists(path),
    copy: (src: any, dest: any) => api.copy(src, dest),
    rename: (oldPath: any, newPath: any) => api.rename(oldPath, newPath),
    isFile: (path: any) => api.isFile(path),
    getFileKind: (path: any) => api.getFileKind(path),
    getFileIcon: (path: any) => api.getFileIcon(path),
    getMetadata: (path: any, name: string) => api.getMetadata(path, name),
    calcDirSize: (path: any) => api.calcDirSize(path),
    writeBinaryFile: (path: any, name: string, blob: any, kind?: any, icon?: any) =>
      api.writeBinaryFile(path, name, blob, kind, icon),
    readBinaryFile: (path: any, name: string) => api.readBinaryFile(path, name),
    deleteBinaryFile: (path: any, name: string) => api.deleteBinaryFile(path, name),
    renameBinaryFile: (path: any, oldName: string, newName: string) => api.renameBinaryFile(path, oldName, newName),
    createFile: (path: any, name: string, content: string, kind?: any, icon?: any, faIcon?: any) =>
      api.createFile(path, name, content, kind, icon, faIcon),
    createFolder: (path: any, name: string) => api.createFolder(path, name),
    deleteItem: (path: any, name: string) => api.deleteItem(path, name),
    renameItem: (path: any, oldName: string, newName: string) => api.renameItem(path, oldName, newName),
    updateFile: (path: any, name: string, content: string, meta?: any) => api.updateFile(path, name, content, meta),
    trashFile: (path: any, name: string) => api.trashFile(path, name),
    getTrashItems: () => api.getTrashItems(),
    restoreTrashItem: (id: string) => api.restoreTrashItem(id),
    restoreAllTrashItems: () => api.restoreAllTrashItems(),
    deleteTrashItem: (id: string) => api.deleteTrashItem(id),
    emptyTrash: () => api.emptyTrash(),
    getTrashCount: () => api.getTrashCount(),
    pickDirectory: () => api.pickDirectory(),
    registerMount: (handle: any, label: string) => api.registerMount(handle, label),
    unmount: (label: string) => api.unmount(label),
    getMounts: () => api.getMounts()
  };
}

function buildNotify() {
  const nc = requireServices().notificationCenter;
  return {
    send: (title: string, message: string, options?: any) =>
      nc.addNotification(
        title,
        message,
        options?.type || "info",
        options?.duration || 5000,
        options?.icon,
        options?.appSource
      ),
    clear: (id: number) => nc.removeNotification(id),
    clearAll: () => nc.clearAllNotifications()
  };
}

function buildTray() {
  return {
    register: (winId: string, icon: string, label: string, options?: any) =>
      trayManager.register(winId, icon, label, options),
    unregister: (winId: string) => trayManager.unregister(winId),
    updateIcon: (winId: string, icon: string) => trayManager.updateIcon(winId, icon),
    updateLabel: (winId: string, label: string) => trayManager.updateLabel(winId, label),
    updateContextMenuItems: (winId: string, items: any) => trayManager.updateContextMenuItems(winId, items),
    sendToTray: (winId: string) => trayManager.sendToTray(winId),
    restoreFromTray: (winId: string) => trayManager.restoreFromTray(winId),
    getTrayItems: () => trayManager.getTrayItems(),
    updateItemVisibility: (winId: string, visible: boolean) => {
      const item = trayManager.items.get(winId);
      if (item) {
        item.visibleInSettings = visible;
        trayManager.render();
      }
    },
    isRegistered: (winId: string) => trayManager.isRegistered(winId)
  };
}

function buildApp() {
  const al = requireServices().appLauncher;
  return {
    launch: (appId: string, options?: any) => al.launch(appId, false, options),
    launchGame: (appId: string, isSwf?: boolean, options?: any) => al.launch(appId, isSwf, options),
    close: (winId: string) => {
      const win = document.getElementById(winId);
      if (win) al.wm.closeWindow(win);
    },
    getRunningApps: () => listRunningApps(),
    getAllApps: () => al.appMap,
    getAppInfo: (appId: string) => al.appMap[appId] || null,
    hasApp: (appId: string) => appId in al.appMap,
    searchApps: (query: string) => {
      const q = query.toLowerCase();
      return Object.entries(al.appMap)
        .filter(([, app]: any) => app.title?.toLowerCase().includes(q))
        .map(([id]) => id);
    }
  };
}

function buildEvents() {
  const bus = requireServices().eventBus;
  return {
    on: (event: string, handler: any) => bus.on(event, handler),
    off: (event: string, handler: any) => bus.off(event, handler),
    emit: (event: string, data?: any) => bus.emit(event, data),
    once: (event: string, handler: any) => bus.once(event, handler)
  };
}

function buildTor() {
  const m = torManager!;
  return {
    fetch: (url: string) => m.fetch(url),
    post: (url: string, body: Uint8Array) => m.post(url, body),
    request: (method: string, url: string, headers?: Record<string, string>, body?: Uint8Array, timeout?: number) =>
      m.request(method, url, headers, body, timeout),
    createClient: () => m.createClient(),
    getStatus: () => m.getStatus(),
    start: (options?: Record<string, unknown>) => m.start(options),
    stop: () => m.stop(),
    getLogs: () => m.getLogs(),
    setSnowflakeUrl: (url: string) => {
      (m as any).snowflakeUrl = url;
    },
    getSnowflakeUrl: () => (m as any).snowflakeUrl,
    getFetchCount: () => m.getFetchCount(),
    reconnect: () => m.reconnect(),
    get isReady() {
      return m.getStatus().ready;
    },
    get running() {
      return m.getStatus().running;
    }
  };
}

export function setTorManager(manager: TorManagerService): void {
  if (torManager === manager) return;
  torManager = manager;

  if (torUnsub) {
    torUnsub();
    torUnsub = null;
  }
  torUnsub = manager.onEvent((type, data) => {
    try {
      if (type === "status") {
        osServices?.eventBus?.emit("TOR_STATUS_CHANGED", data);
        if (data.ready) {
          trayManager.register("tor-service", "fas fa-shield-halved", "Tor Active", {
            resident: true,
            showInTray: true,
            priority: 90,
            onClick: () => osServices?.appLauncher?.launch("torBrowserApp"),
            contextMenuItems: [
              {
                label: "Open Tor Manager",
                icon: "fas fa-external-link-alt",
                action: () => osServices?.appLauncher?.launch("torBrowserApp")
              },
              { label: "Stop Tor", icon: "fas fa-stop", action: () => manager.stop() }
            ]
          });
        } else if (!data.running) {
          try {
            trayManager.unregister("tor-service");
          } catch (e) {}
        }
      }
      if (type === "log") {
        osServices?.eventBus?.emit("TOR_LOG", data);
      }
    } catch (e) {}
  });
}

function listRunningApps() {
  const al = osServices?.appLauncher;
  if (!al) return [];

  const result: Array<{
    winId: string;
    appId?: string;
    title: string;
    icon?: string | null;
    status?: string;
    isTray?: boolean;
  }> = [];

  al.wm.openWindows.forEach((entry: { title?: string; iconValue?: string }, winId: string) => {
    const win = document.getElementById(winId);
    if (!win) return;
    result.push({
      winId,
      appId: win.dataset.appId,
      title: entry.title || winId,
      icon: entry.iconValue || null,
      status: win.style.display !== "none" ? "Running" : "Suspended",
      isTray: false
    });
  });

  if (al.trayManager && al.trayManager.trayItems instanceof Map) {
    al.trayManager.trayItems.forEach((item: { inTray?: boolean; label?: string; icon?: string }, winId: string) => {
      if (item.inTray && !result.find((r) => r.winId === winId)) {
        result.push({
          winId,
          title: item.label || winId,
          icon: item.icon || null,
          status: "Tray",
          isTray: true
        });
      }
    });
  }

  return result;
}

export const os = {
  get window() {
    if (!cachedWindow) cachedWindow = buildWindow();
    return cachedWindow;
  },

  get fs() {
    if (!cachedFS) cachedFS = buildFS();
    return cachedFS;
  },

  get notify() {
    if (!cachedNotify) cachedNotify = buildNotify();
    return cachedNotify;
  },

  get tray() {
    if (!cachedTray) cachedTray = buildTray();
    return cachedTray;
  },

  get app() {
    if (!cachedApp) cachedApp = buildApp();
    return cachedApp;
  },

  get events() {
    if (!cachedEvents) cachedEvents = buildEvents();
    return cachedEvents;
  },

  get storage() {
    return storageAPI;
  },

  get dialog() {
    return dialogAPI;
  },

  get tor() {
    if (!cachedTor) {
      if (!torManager) {
        setTorManager(TorManager.getInstance());
      }
      cachedTor = buildTor();
    }
    return cachedTor;
  }
};

export { WindowAPI } from "./window.js";
export { FileSystemAPI } from "./fs.js";
export { StorageAPI } from "./storage.js";
export { DialogAPI } from "./dialog.js";

export type * from "./types.js";
