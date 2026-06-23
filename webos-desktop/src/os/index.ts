import { WindowAPI } from "./window.js";
import { FileSystemAPI } from "./fs.js";
import { NotificationAPI } from "./notify.js";
import { TrayAPI } from "./tray.js";
import { AppAPI } from "./app.js";
import { EventAPI } from "./events.js";
import { StorageAPI } from "./storage.js";
import { DialogAPI } from "./dialog.js";
import { TorManager } from "../tor/TorManager.js";

let windowAPI: WindowAPI | null = null;
let fileSystemAPI: FileSystemAPI | null = null;
let notificationAPI: NotificationAPI | null = null;
let trayAPI: TrayAPI | null = null;
let appAPI: AppAPI | null = null;
let eventAPI: EventAPI | null = null;
const storageAPI = new StorageAPI();
const dialogAPI = new DialogAPI();

let boundWindowAPI: OSBridge["window"] | null = null;
let boundFileSystemAPI: OSBridge["fs"] | null = null;
let boundNotificationAPI: OSBridge["notify"] | null = null;
let boundTrayAPI: OSBridge["tray"] | null = null;
let boundAppAPI: OSBridge["app"] | null = null;
let boundEventAPI: OSBridge["events"] | null = null;
let boundStorageAPI: OSBridge["storage"] | null = null;
let boundDialogAPI: OSBridge["dialog"] | null = null;
let boundTorAPI: OSBridge["tor"] | null = null;
let torManager: any = null;

interface OSBridge {
  window: {
    create: WindowAPI["create"];
    close: WindowAPI["close"];
    closeAll: WindowAPI["closeAll"];
    focus: WindowAPI["focus"];
    minimize: WindowAPI["minimize"];
    maximize: WindowAPI["maximize"];
    bringToFront: WindowAPI["bringToFront"];
    addToTaskbar: WindowAPI["addToTaskbar"];
    removeFromTaskbar: WindowAPI["removeFromTaskbar"];
    getWindowControls: WindowAPI["getWindowControls"];
  };
  fs: {
    read: FileSystemAPI["read"];
    write: FileSystemAPI["write"];
    readdir: FileSystemAPI["readdir"];
    mkdir: FileSystemAPI["mkdir"];
    delete: FileSystemAPI["delete"];
    exists: FileSystemAPI["exists"];
    copy: FileSystemAPI["copy"];
    rename: FileSystemAPI["rename"];
    isFile: FileSystemAPI["isFile"];
    getFileKind: FileSystemAPI["getFileKind"];
    getFileIcon: FileSystemAPI["getFileIcon"];
    writeBinaryFile: FileSystemAPI["writeBinaryFile"];
    readBinaryFile: FileSystemAPI["readBinaryFile"];
    deleteBinaryFile: FileSystemAPI["deleteBinaryFile"];
    renameBinaryFile: FileSystemAPI["renameBinaryFile"];
    createFile: FileSystemAPI["createFile"];
    createFolder: FileSystemAPI["createFolder"];
    deleteItem: FileSystemAPI["deleteItem"];
    renameItem: FileSystemAPI["renameItem"];
    updateFile: FileSystemAPI["updateFile"];
    trashFile: FileSystemAPI["trashFile"];
    getTrashItems: FileSystemAPI["getTrashItems"];
    restoreTrashItem: FileSystemAPI["restoreTrashItem"];
    restoreAllTrashItems: FileSystemAPI["restoreAllTrashItems"];
    deleteTrashItem: FileSystemAPI["deleteTrashItem"];
    emptyTrash: FileSystemAPI["emptyTrash"];
    getTrashCount: FileSystemAPI["getTrashCount"];
  };
  notify: {
    send: NotificationAPI["send"];
    clear: NotificationAPI["clear"];
    clearAll: NotificationAPI["clearAll"];
  };
  tray: {
    register: TrayAPI["register"];
    unregister: TrayAPI["unregister"];
    updateIcon: TrayAPI["updateIcon"];
    updateLabel: TrayAPI["updateLabel"];
    updateContextMenuItems: TrayAPI["updateContextMenuItems"];
    sendToTray: TrayAPI["sendToTray"];
    restoreFromTray: TrayAPI["restoreFromTray"];
    getTrayItems: TrayAPI["getTrayItems"];
    updateItemVisibility: TrayAPI["updateItemVisibility"];
    isRegistered: TrayAPI["isRegistered"];
  };
  app: {
    launch: AppAPI["launch"];
    launchGame: AppAPI["launchGame"];
    close: AppAPI["close"];
    getRunningApps: AppAPI["getRunningApps"];
    getAllApps: AppAPI["getAllApps"];
    getAppInfo: AppAPI["getAppInfo"];
  };
  events: {
    on: EventAPI["on"];
    off: EventAPI["off"];
    emit: EventAPI["emit"];
    once: EventAPI["once"];
  };
  storage: {
    get: StorageAPI["get"];
    set: StorageAPI["set"];
    remove: StorageAPI["remove"];
    clear: StorageAPI["clear"];
    has: StorageAPI["has"];
  };
  dialog: {
    alert: DialogAPI["alert"];
    confirm: DialogAPI["confirm"];
    prompt: DialogAPI["prompt"];
    fileOpen: DialogAPI["fileOpen"];
    fileSave: DialogAPI["fileSave"];
    openDirectory: DialogAPI["openDirectory"];
  };
  tor: {
    start: (options?: any) => Promise<void>;
    stop: () => Promise<void>;
    fetch: (url: string) => Promise<any>;
    post: (url: string, body: Uint8Array) => Promise<any>;
    request: (method: string, url: string, headers?: any, body?: any, timeout?: number) => Promise<any>;
    createClient: () => Promise<{
      fetch: (url: string) => Promise<any>;
      post: (url: string, body: Uint8Array) => Promise<any>;
      request: (method: string, url: string, headers?: any, body?: any, timeout?: number) => Promise<any>;
      getFetchCount: () => number;
      close: () => Promise<void>;
      waitForCircuit: () => Promise<void>;
    }>;
    getStatus: () => { running: boolean; phase: string; ready: boolean };
    isReady: boolean;
    running: boolean;
  };
  telemetry: {
    getLegacyCalls: typeof getLegacyAPICalls;
    getStats: typeof getLegacyAPICallStats;
    clearCalls: typeof clearLegacyAPICalls;
  };
}

interface LegacyAPICall {
  timestamp: number;
  api: string;
  method: string;
  source?: string;
}

const legacyAPICalls: LegacyAPICall[] = [];
const MAX_LEGACY_CALLS = 1000;

export function trackLegacyCall(api: string, method: string, source?: string) {
  const call: LegacyAPICall = {
    timestamp: Date.now(),
    api,
    method,
    source
  };

  legacyAPICalls.push(call);

  if (legacyAPICalls.length > MAX_LEGACY_CALLS) {
    legacyAPICalls.shift();
  }

  try {
    const recentCalls = legacyAPICalls.slice(-100);
    localStorage.setItem("osBridge:legacyCalls", JSON.stringify(recentCalls));
  } catch (e) {}
}

export function getLegacyAPICalls(): LegacyAPICall[] {
  return [...legacyAPICalls];
}

export function getLegacyAPICallStats(): {
  totalCalls: number;
  byAPI: Record<string, number>;
  byMethod: Record<string, number>;
  recentCalls: LegacyAPICall[];
} {
  const byAPI: Record<string, number> = {};
  const byMethod: Record<string, number> = {};

  for (const call of legacyAPICalls) {
    byAPI[call.api] = (byAPI[call.api] || 0) + 1;
    byMethod[call.method] = (byMethod[call.method] || 0) + 1;
  }

  return {
    totalCalls: legacyAPICalls.length,
    byAPI,
    byMethod,
    recentCalls: legacyAPICalls.slice(-20)
  };
}

export function clearLegacyAPICalls(): void {
  legacyAPICalls.length = 0;
  try {
    localStorage.removeItem("osBridge:legacyCalls");
  } catch (e) {}
}

try {
  const persisted = localStorage.getItem("osBridge:legacyCalls");
  if (persisted) {
    const calls = JSON.parse(persisted) as LegacyAPICall[];
    legacyAPICalls.push(...calls);
  }
} catch (e) {}

export function initializeOSBridge(services: {
  windowManager: any;
  fileSystemManager: any;
  notificationCenter: any;
  appLauncher: any;
  eventBus: any;
}) {
  windowAPI = new WindowAPI(services.windowManager);
  fileSystemAPI = new FileSystemAPI(services.fileSystemManager);
  notificationAPI = new NotificationAPI(services.notificationCenter);
  trayAPI = new TrayAPI();
  appAPI = new AppAPI(services.appLauncher);
  eventAPI = new EventAPI(services.eventBus);

  boundWindowAPI = {
    create: windowAPI.create.bind(windowAPI),
    close: windowAPI.close.bind(windowAPI),
    closeAll: windowAPI.closeAll.bind(windowAPI),
    focus: windowAPI.focus.bind(windowAPI),
    minimize: windowAPI.minimize.bind(windowAPI),
    maximize: windowAPI.maximize.bind(windowAPI),
    bringToFront: windowAPI.bringToFront.bind(windowAPI),
    addToTaskbar: windowAPI.addToTaskbar.bind(windowAPI),
    removeFromTaskbar: windowAPI.removeFromTaskbar.bind(windowAPI),
    getWindowControls: windowAPI.getWindowControls.bind(windowAPI)
  };

  boundFileSystemAPI = {
    read: fileSystemAPI.read.bind(fileSystemAPI),
    write: fileSystemAPI.write.bind(fileSystemAPI),
    readdir: fileSystemAPI.readdir.bind(fileSystemAPI),
    mkdir: fileSystemAPI.mkdir.bind(fileSystemAPI),
    delete: fileSystemAPI.delete.bind(fileSystemAPI),
    exists: fileSystemAPI.exists.bind(fileSystemAPI),
    copy: fileSystemAPI.copy.bind(fileSystemAPI),
    rename: fileSystemAPI.rename.bind(fileSystemAPI),
    isFile: fileSystemAPI.isFile.bind(fileSystemAPI),
    getFileKind: fileSystemAPI.getFileKind.bind(fileSystemAPI),
    getFileIcon: fileSystemAPI.getFileIcon.bind(fileSystemAPI),
    writeBinaryFile: fileSystemAPI.writeBinaryFile.bind(fileSystemAPI),
    readBinaryFile: fileSystemAPI.readBinaryFile.bind(fileSystemAPI),
    deleteBinaryFile: fileSystemAPI.deleteBinaryFile.bind(fileSystemAPI),
    renameBinaryFile: fileSystemAPI.renameBinaryFile.bind(fileSystemAPI),
    createFile: fileSystemAPI.createFile.bind(fileSystemAPI),
    createFolder: fileSystemAPI.createFolder.bind(fileSystemAPI),
    deleteItem: fileSystemAPI.deleteItem.bind(fileSystemAPI),
    renameItem: fileSystemAPI.renameItem.bind(fileSystemAPI),
    updateFile: fileSystemAPI.updateFile.bind(fileSystemAPI),
    trashFile: fileSystemAPI.trashFile.bind(fileSystemAPI),
    getTrashItems: fileSystemAPI.getTrashItems.bind(fileSystemAPI),
    restoreTrashItem: fileSystemAPI.restoreTrashItem.bind(fileSystemAPI),
    restoreAllTrashItems: fileSystemAPI.restoreAllTrashItems.bind(fileSystemAPI),
    deleteTrashItem: fileSystemAPI.deleteTrashItem.bind(fileSystemAPI),
    emptyTrash: fileSystemAPI.emptyTrash.bind(fileSystemAPI),
    getTrashCount: fileSystemAPI.getTrashCount.bind(fileSystemAPI)
  };

  boundNotificationAPI = {
    send: notificationAPI.send.bind(notificationAPI),
    clear: notificationAPI.clear.bind(notificationAPI),
    clearAll: notificationAPI.clearAll.bind(notificationAPI)
  };

  boundTrayAPI = {
    register: trayAPI.register.bind(trayAPI),
    unregister: trayAPI.unregister.bind(trayAPI),
    updateIcon: trayAPI.updateIcon.bind(trayAPI),
    updateLabel: trayAPI.updateLabel.bind(trayAPI),
    updateContextMenuItems: trayAPI.updateContextMenuItems.bind(trayAPI),
    sendToTray: trayAPI.sendToTray.bind(trayAPI),
    restoreFromTray: trayAPI.restoreFromTray.bind(trayAPI),
    getTrayItems: trayAPI.getTrayItems.bind(trayAPI),
    updateItemVisibility: trayAPI.updateItemVisibility.bind(trayAPI),
    isRegistered: trayAPI.isRegistered.bind(trayAPI)
  };

  boundAppAPI = {
    launch: appAPI.launch.bind(appAPI),
    launchGame: appAPI.launchGame.bind(appAPI),
    close: appAPI.close.bind(appAPI),
    getRunningApps: appAPI.getRunningApps.bind(appAPI),
    getAllApps: appAPI.getAllApps.bind(appAPI),
    getAppInfo: appAPI.getAppInfo.bind(appAPI)
  };

  boundEventAPI = {
    on: eventAPI.on.bind(eventAPI),
    off: eventAPI.off.bind(eventAPI),
    emit: eventAPI.emit.bind(eventAPI),
    once: eventAPI.once.bind(eventAPI)
  };

  boundStorageAPI = {
    get: storageAPI.get.bind(storageAPI),
    set: storageAPI.set.bind(storageAPI),
    remove: storageAPI.remove.bind(storageAPI),
    clear: storageAPI.clear.bind(storageAPI),
    has: storageAPI.has.bind(storageAPI)
  };

  boundDialogAPI = {
    alert: dialogAPI.alert.bind(dialogAPI),
    confirm: dialogAPI.confirm.bind(dialogAPI),
    prompt: dialogAPI.prompt.bind(dialogAPI),
    fileOpen: dialogAPI.fileOpen.bind(dialogAPI),
    fileSave: dialogAPI.fileSave.bind(dialogAPI),
    openDirectory: dialogAPI.openDirectory.bind(dialogAPI)
  };

  console.log("[OS Bridge] Initialized");

  (window as any).os = os;
}

/**
 * Get the window management API
 * @throws {Error} if OS Bridge not initialized
 */
export function getWindowAPI(): WindowAPI {
  if (!windowAPI) throw new Error("[OS Bridge] Window API not initialized. Call initializeOSBridge() first.");
  return windowAPI;
}

/**
 * Get the filesystem API
 * @throws {Error} if OS Bridge not initialized
 */
export function getFileSystemAPI(): FileSystemAPI {
  if (!fileSystemAPI) throw new Error("[OS Bridge] FileSystem API not initialized. Call initializeOSBridge() first.");
  return fileSystemAPI;
}

/**
 * Get the notification API
 * @throws {Error} if OS Bridge not initialized
 */
export function getNotificationAPI(): NotificationAPI {
  if (!notificationAPI)
    throw new Error("[OS Bridge] Notification API not initialized. Call initializeOSBridge() first.");
  return notificationAPI;
}

/**
 * Get the tray API
 * @throws {Error} if OS Bridge not initialized
 */
export function getTrayAPI(): TrayAPI {
  if (!trayAPI) throw new Error("[OS Bridge] Tray API not initialized. Call initializeOSBridge() first.");
  return trayAPI;
}

/**
 * Get the app launcher API
 * @throws {Error} if OS Bridge not initialized
 */
export function getAppAPI(): AppAPI {
  if (!appAPI) throw new Error("[OS Bridge] App API not initialized. Call initializeOSBridge() first.");
  return appAPI;
}

/**
 * Get the event bus API
 * @throws {Error} if OS Bridge not initialized
 */
export function getEventAPI(): EventAPI {
  if (!eventAPI) throw new Error("[OS Bridge] Event API not initialized. Call initializeOSBridge() first.");
  return eventAPI;
}

/**
 * Get the storage API
 * Storage API is always available as it doesn't require initialization
 */
export function getStorageAPI(): StorageAPI {
  return storageAPI;
}

/**
 * Get the dialog API
 * Dialog API is always available as it doesn't require services
 */
export function getDialogAPI(): DialogAPI {
  return dialogAPI;
}

/**
 * Set the explorer app on the dialog API for file dialogs
 */
export function setDialogExplorerApp(app: any): void {
  dialogAPI.setExplorerApp(app);
}

export function getTorStatus() {
  if (!torManager) return { running: false, phase: "unavailable", ready: false };
  return torManager.getStatus();
}

let _torUnsub = null;

export function setTorManager(manager: any): void {
  if (torManager === manager && boundTorAPI) return;
  torManager = manager;

  if (_torUnsub) {
    _torUnsub();
    _torUnsub = null;
  }
  _torUnsub = manager.onEvent((type, data) => {
    try {
      if (type === "status") {
        boundEventAPI?.emit("TOR_STATUS_CHANGED", data);
        if (data.ready) {
          boundTrayAPI?.register("tor-service", "fas fa-shield-halved", "Tor Active", {
            resident: true,
            showInTray: true,
            priority: 90,
            onClick: () => boundAppAPI?.launch("torBrowserApp"),
            contextMenuItems: [
              {
                label: "Open Tor Manager",
                icon: "fas fa-external-link-alt",
                action: () => boundAppAPI?.launch("torBrowserApp")
              },
              { label: "Stop Tor", icon: "fas fa-stop", action: () => manager.stop() }
            ]
          });
        } else if (!data.running) {
          try {
            boundTrayAPI?.unregister("tor-service");
          } catch (e) {}
        }
      }
      if (type === "log") {
        boundEventAPI?.emit("TOR_LOG", data);
      }
    } catch (e) {}
  });

  boundTorAPI = {
    fetch: (url: string) => manager.fetch(url),
    post: (url: string, body: Uint8Array) => manager.post(url, body),
    request: (method: string, url: string, headers?: any, body?: any, timeout?: number) =>
      manager.request(method, url, headers, body, timeout),
    createClient: () => manager.createClient(),
    getStatus: () => manager.getStatus(),
    start: (options?: any) => manager.start(options),
    stop: () => manager.stop(),
    getLogs: () => manager.getLogs(),
    setSnowflakeUrl: (url: string) => (manager.snowflakeUrl = url),
    getSnowflakeUrl: () => manager.snowflakeUrl,
    getFetchCount: () => manager.getFetchCount(),
    reconnect: () => manager.reconnect(),
    get isReady() {
      return manager.getStatus().ready;
    },
    get running() {
      return manager.getStatus().running;
    }
  };
}

/**
 * Unified OS API surface for applications
 * This is the primary export that apps should use
 */
export const os: OSBridge = {
  get window() {
    if (!boundWindowAPI) throw new Error("[OS Bridge] Window API not initialized. Call initializeOSBridge() first.");
    return boundWindowAPI;
  },

  get fs() {
    if (!boundFileSystemAPI)
      throw new Error("[OS Bridge] FileSystem API not initialized. Call initializeOSBridge() first.");
    return boundFileSystemAPI;
  },

  get notify() {
    if (!boundNotificationAPI)
      throw new Error("[OS Bridge] Notification API not initialized. Call initializeOSBridge() first.");
    return boundNotificationAPI;
  },

  get tray() {
    if (!boundTrayAPI) throw new Error("[OS Bridge] Tray API not initialized. Call initializeOSBridge() first.");
    return boundTrayAPI;
  },

  get app() {
    if (!boundAppAPI) throw new Error("[OS Bridge] App API not initialized. Call initializeOSBridge() first.");
    return boundAppAPI;
  },

  get events() {
    if (!boundEventAPI) throw new Error("[OS Bridge] Event API not initialized. Call initializeOSBridge() first.");
    return boundEventAPI;
  },

  get storage() {
    if (!boundStorageAPI) {
      boundStorageAPI = {
        get: storageAPI.get.bind(storageAPI),
        set: storageAPI.set.bind(storageAPI),
        remove: storageAPI.remove.bind(storageAPI),
        clear: storageAPI.clear.bind(storageAPI),
        has: storageAPI.has.bind(storageAPI)
      };
    }
    return boundStorageAPI;
  },

  get dialog() {
    if (!boundDialogAPI) {
      boundDialogAPI = {
        alert: dialogAPI.alert.bind(dialogAPI),
        confirm: dialogAPI.confirm.bind(dialogAPI),
        prompt: dialogAPI.prompt.bind(dialogAPI),
        fileOpen: dialogAPI.fileOpen.bind(dialogAPI),
        fileSave: dialogAPI.fileSave.bind(dialogAPI),
        openDirectory: dialogAPI.openDirectory.bind(dialogAPI)
      };
    }
    return boundDialogAPI;
  },

  get tor() {
    if (!boundTorAPI) {
      setTorManager(TorManager.getInstance());
    }
    return boundTorAPI;
  },

  telemetry: {
    getLegacyCalls: getLegacyAPICalls,
    getStats: getLegacyAPICallStats,
    clearCalls: clearLegacyAPICalls
  }
};

export { WindowAPI } from "./window.js";
export { FileSystemAPI } from "./fs.js";
export { NotificationAPI } from "./notify.js";
export { TrayAPI } from "./tray.js";
export { AppAPI } from "./app.js";
export { EventAPI } from "./events.js";
export { StorageAPI } from "./storage.js";
export { DialogAPI } from "./dialog.js";

export type * from "./types.js";
