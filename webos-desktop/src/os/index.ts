import { OSBridge, AppAPI } from "./OSBridge.js";

export type { WindowAPI } from "./window.js";
export type { FileSystemAPI } from "./fs.js";
export type { StorageAPI } from "./storage.js";
export type { DialogAPI } from "./dialog.js";
export type { AppAPI };
export type * from "./types.js";

let bridge: OSBridge | null = null;

export function initializeOSBridge(services: any): OSBridge {
  bridge = new OSBridge(services);
  return bridge;
}

export function setDialogExplorerApp(app: any): void {
  if (bridge) bridge.setDialogExplorerApp(app);
}

export function setTorManager(manager: any): void {
  if (bridge) bridge.setTorManager(manager);
}

export function getOS(): OSBridge {
  if (!bridge) throw new Error("[OS Bridge] Not initialized. Call initializeOSBridge() first.");
  return bridge;
}

const NOOP = () => {};

const noopStorage = {
  get: () => null,
  set: NOOP,
  remove: NOOP,
  clear: NOOP,
  has: () => false
};

const noopEvents = {
  on: () => NOOP,
  off: NOOP,
  emit: NOOP,
  once: NOOP,
  clear: NOOP,
  listenerCount: () => 0
};

const noopNotify = {
  send: () => 0,
  clear: NOOP,
  clearAll: NOOP,
  getAll: () => [],
  getCount: () => 0,
  setDoNotDisturb: NOOP,
  getDoNotDisturb: () => false
};

const noopWindow = {
  create: () => document.createElement("div"),
  close: NOOP,
  focus: NOOP,
  minimize: NOOP,
  maximize: NOOP,
  bringToFront: NOOP,
  addToTaskbar: NOOP,
  removeFromTaskbar: NOOP,
  getWindowControls: () => ""
};

const noopFs = {
  read: () => Promise.resolve(null),
  write: () => Promise.resolve(),
  readdir: () => Promise.resolve([]),
  mkdir: () => Promise.resolve(),
  delete: () => Promise.resolve(),
  exists: () => Promise.resolve(false),
  copy: () => Promise.resolve(),
  rename: () => Promise.resolve(),
  isFile: () => Promise.resolve(false),
  getFileKind: () => Promise.resolve("other"),
  getFileIcon: () => Promise.resolve(""),
  writeBinaryFile: () => Promise.resolve(""),
  readBinaryFile: () => Promise.resolve(null),
  deleteBinaryFile: () => Promise.resolve(),
  renameBinaryFile: () => Promise.resolve(),
  createFile: () => Promise.resolve(""),
  createFolder: () => Promise.resolve(""),
  deleteItem: () => Promise.resolve(),
  renameItem: () => Promise.resolve(),
  updateFile: () => Promise.resolve(),
  trashFile: () => Promise.resolve(),
  trash: {
    moveToTrash: () => Promise.resolve(),
    getItems: () => Promise.resolve([]),
    restoreItem: () => Promise.resolve(),
    restoreAll: () => Promise.resolve([]),
    deletePermanently: () => Promise.resolve(),
    emptyTrash: () => Promise.resolve(),
    getItemCount: () => Promise.resolve(0)
  },
  registerMount: () => Promise.resolve(),
  unmount: () => Promise.resolve()
};

const noopDialog = {
  alert: () => Promise.resolve(),
  confirm: () => Promise.resolve(false),
  prompt: () => Promise.resolve(null),
  fileOpen: () => Promise.resolve(null),
  fileSave: () => Promise.resolve(null),
  openDirectory: () => Promise.resolve(null)
};

const noopTray = {
  register: NOOP,
  unregister: NOOP,
  updateIcon: NOOP,
  updateLabel: NOOP,
  updateContextMenuItems: NOOP,
  sendToTray: NOOP,
  restoreFromTray: NOOP,
  getTrayItems: () => new Map(),
  getAllItems: () => [],
  isRegistered: () => false,
  updateItemVisibility: NOOP
};

const noopApp = {
  launch: () => Promise.reject(new Error("[OS Bridge] Not initialized")),
  launchGame: () => Promise.reject(new Error("[OS Bridge] Not initialized")),
  getRunningApps: () => [],
  getAllApps: () => ({}),
  getAppInfo: () => null,
  hasApp: () => false,
  searchApps: () => [],
  getInstance: () => null,
  register: NOOP,
  close: NOOP,
  apps: {}
};

const noopTor = {
  isReady: false,
  running: false,
  fetch: () => Promise.reject(new Error("[OS Bridge] Not initialized")),
  post: () => Promise.reject(new Error("[OS Bridge] Not initialized")),
  request: () => Promise.reject(new Error("[OS Bridge] Not initialized")),
  createClient: () => Promise.reject(new Error("[OS Bridge] Not initialized")),
  getStatus: () => ({ running: false, phase: "stopped", ready: false }),
  start: () => Promise.reject(new Error("[OS Bridge] Not initialized")),
  stop: () => Promise.reject(new Error("[OS Bridge] Not initialized")),
  getLogs: () => [],
  getSnowflakeUrl: () => "",
  setSnowflakeUrl: NOOP,
  getFetchCount: () => 0,
  reconnect: NOOP
};

const noopAPIs: Record<string, any> = {
  storage: noopStorage,
  events: noopEvents,
  notify: noopNotify,
  window: noopWindow,
  fs: noopFs,
  dialog: noopDialog,
  tray: noopTray,
  app: noopApp,
  tor: noopTor,
  kernel: {}
};

export const os = new Proxy({} as OSBridge, {
  get(_target, prop: string) {
    if (!bridge) {
      const fallback = noopAPIs[prop];
      if (fallback !== undefined) return fallback;
      if (prop === "then" || prop === "catch") return undefined;
      return undefined;
    }
    return (bridge as any)[prop];
  }
});
