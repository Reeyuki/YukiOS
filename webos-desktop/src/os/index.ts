import { WindowAPI } from "./window.js";
import { FileSystemAPI } from "./fs.js";
import { NotificationAPI } from "./notify.js";
import { TrayAPI } from "./tray.js";
import { AppAPI } from "./app.js";
import { EventAPI } from "./events.js";
import { StorageAPI } from "./storage.js";

let windowAPI: WindowAPI | null = null;
let fileSystemAPI: FileSystemAPI | null = null;
let notificationAPI: NotificationAPI | null = null;
let trayAPI: TrayAPI | null = null;
let appAPI: AppAPI | null = null;
let eventAPI: EventAPI | null = null;
const storageAPI = new StorageAPI();

interface OSBridge {
  window: {
    create: WindowAPI["create"];
    close: WindowAPI["close"];
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
  if (typeof window !== "undefined") {
    (window as any).__osBridgeLegacyWarnings = false;
  }

  windowAPI = new WindowAPI(services.windowManager);
  fileSystemAPI = new FileSystemAPI(services.fileSystemManager);
  notificationAPI = new NotificationAPI(services.notificationCenter);
  trayAPI = new TrayAPI();
  appAPI = new AppAPI(services.appLauncher);
  eventAPI = new EventAPI(services.eventBus);

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
 * Unified OS API surface for applications
 * This is the primary export that apps should use
 */
export const os: OSBridge = {
  window: {
    get create() {
      return getWindowAPI().create.bind(getWindowAPI());
    },
    get close() {
      return getWindowAPI().close.bind(getWindowAPI());
    },
    get focus() {
      return getWindowAPI().focus.bind(getWindowAPI());
    },
    get minimize() {
      return getWindowAPI().minimize.bind(getWindowAPI());
    },
    get maximize() {
      return getWindowAPI().maximize.bind(getWindowAPI());
    },
    get bringToFront() {
      return getWindowAPI().bringToFront.bind(getWindowAPI());
    },
    get addToTaskbar() {
      return getWindowAPI().addToTaskbar.bind(getWindowAPI());
    },
    get removeFromTaskbar() {
      return getWindowAPI().removeFromTaskbar.bind(getWindowAPI());
    },
    get getWindowControls() {
      return getWindowAPI().getWindowControls.bind(getWindowAPI());
    }
  },

  fs: {
    get read() {
      return getFileSystemAPI().read.bind(getFileSystemAPI());
    },
    get write() {
      return getFileSystemAPI().write.bind(getFileSystemAPI());
    },
    get readdir() {
      return getFileSystemAPI().readdir.bind(getFileSystemAPI());
    },
    get mkdir() {
      return getFileSystemAPI().mkdir.bind(getFileSystemAPI());
    },
    get delete() {
      return getFileSystemAPI().delete.bind(getFileSystemAPI());
    },
    get exists() {
      return getFileSystemAPI().exists.bind(getFileSystemAPI());
    },
    get copy() {
      return getFileSystemAPI().copy.bind(getFileSystemAPI());
    },
    get rename() {
      return getFileSystemAPI().rename.bind(getFileSystemAPI());
    },
    get isFile() {
      return getFileSystemAPI().isFile.bind(getFileSystemAPI());
    },
    get getFileKind() {
      return getFileSystemAPI().getFileKind.bind(getFileSystemAPI());
    },
    get getFileIcon() {
      return getFileSystemAPI().getFileIcon.bind(getFileSystemAPI());
    },
    get writeBinaryFile() {
      return getFileSystemAPI().writeBinaryFile.bind(getFileSystemAPI());
    },
    get readBinaryFile() {
      return getFileSystemAPI().readBinaryFile.bind(getFileSystemAPI());
    },
    get deleteBinaryFile() {
      return getFileSystemAPI().deleteBinaryFile.bind(getFileSystemAPI());
    },
    get renameBinaryFile() {
      return getFileSystemAPI().renameBinaryFile.bind(getFileSystemAPI());
    },
    get createFile() {
      return getFileSystemAPI().createFile.bind(getFileSystemAPI());
    },
    get createFolder() {
      return getFileSystemAPI().createFolder.bind(getFileSystemAPI());
    },
    get deleteItem() {
      return getFileSystemAPI().deleteItem.bind(getFileSystemAPI());
    },
    get renameItem() {
      return getFileSystemAPI().renameItem.bind(getFileSystemAPI());
    },
    get updateFile() {
      return getFileSystemAPI().updateFile.bind(getFileSystemAPI());
    }
  },

  notify: {
    get send() {
      return getNotificationAPI().send.bind(getNotificationAPI());
    },
    get clear() {
      return getNotificationAPI().clear.bind(getNotificationAPI());
    },
    get clearAll() {
      return getNotificationAPI().clearAll.bind(getNotificationAPI());
    }
  },

  tray: {
    get register() {
      return getTrayAPI().register.bind(getTrayAPI());
    },
    get unregister() {
      return getTrayAPI().unregister.bind(getTrayAPI());
    },
    get updateIcon() {
      return getTrayAPI().updateIcon.bind(getTrayAPI());
    },
    get updateLabel() {
      return getTrayAPI().updateLabel.bind(getTrayAPI());
    },
    get updateContextMenuItems() {
      return getTrayAPI().updateContextMenuItems.bind(getTrayAPI());
    },
    get sendToTray() {
      return getTrayAPI().sendToTray.bind(getTrayAPI());
    },
    get restoreFromTray() {
      return getTrayAPI().restoreFromTray.bind(getTrayAPI());
    },
    get getTrayItems() {
      return getTrayAPI().getTrayItems.bind(getTrayAPI());
    },
    get updateItemVisibility() {
      return getTrayAPI().updateItemVisibility.bind(getTrayAPI());
    },
    get isRegistered() {
      return getTrayAPI().isRegistered.bind(getTrayAPI());
    }
  },

  app: {
    get launch() {
      return getAppAPI().launch.bind(getAppAPI());
    },
    get close() {
      return getAppAPI().close.bind(getAppAPI());
    },
    get getRunningApps() {
      return getAppAPI().getRunningApps.bind(getAppAPI());
    },
    get getAllApps() {
      return getAppAPI().getAllApps.bind(getAppAPI());
    },
    get getAppInfo() {
      return getAppAPI().getAppInfo.bind(getAppAPI());
    }
  },

  events: {
    get on() {
      return getEventAPI().on.bind(getEventAPI());
    },
    get off() {
      return getEventAPI().off.bind(getEventAPI());
    },
    get emit() {
      return getEventAPI().emit.bind(getEventAPI());
    },
    get once() {
      return getEventAPI().once.bind(getEventAPI());
    }
  },

  storage: {
    get get() {
      return getStorageAPI().get.bind(getStorageAPI());
    },
    get set() {
      return getStorageAPI().set.bind(getStorageAPI());
    },
    get remove() {
      return getStorageAPI().remove.bind(getStorageAPI());
    },
    get clear() {
      return getStorageAPI().clear.bind(getStorageAPI());
    },
    get has() {
      return getStorageAPI().has.bind(getStorageAPI());
    }
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

export type * from "./types.js";
