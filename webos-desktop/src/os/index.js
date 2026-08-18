import { OSBridge, AppAPI } from "./OSBridge.js";
import { createElement } from "../shared/domUtils.js";

let bridge = null;

export function initializeOSBridge(services) {
  bridge = new OSBridge(services);
  return bridge;
}

export function setDialogExplorerApp(app) {
  if (bridge) bridge.setDialogExplorerApp(app);
}

export function setTorManager(manager) {
  if (bridge) bridge.setTorManager(manager);
}

export function getOS() {
  if (!bridge) throw new Error("[OS Bridge] Not initialized. Call initializeOSBridge() first.");
  return bridge;
}

const NOOP = () => {};

const noopStorage = {
  get: () => null,
  set: NOOP,
  remove: NOOP,
  clear: NOOP,
  has: () => false,
  subscribe: () => NOOP
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
  create: () => createElement("div"),
  close: NOOP,
  closeAll: NOOP,
  getOpenWindows: () => undefined,
  setupWindowControls: NOOP,
  makeDraggable: NOOP,
  makeResizable: NOOP,
  setFileSystemManager: NOOP,
  restoreSession: NOOP,
  focus: NOOP,
  minimize: NOOP,
  maximize: NOOP,
  toggleFullscreen: NOOP,
  applySnap: NOOP,
  unsnap: NOOP,
  bringToFront: NOOP,
  addToTaskbar: NOOP,
  removeFromTaskbar: NOOP,
  pinAppToTaskbar: NOOP,
  getWindowControls: () => "",
  setTitle: NOOP,
  getTitle: () => null
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
  setSession: () => Promise.resolve(),
  getFileContent: () => Promise.resolve(null),
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
  openIframeApp: () => Promise.reject(new Error("[OS Bridge] Not initialized")),
  getRunningApps: () => [],
  getAllApps: () => ({}),
  getAppInfo: () => null,
  hasApp: () => false,
  searchApps: () => [],
  getInstance: () => null,
  register: NOOP,
  close: NOOP
};

const noopModes = {
  isActive: () => false,
  getActiveModes: () => [],
  enter: NOOP,
  exit: NOOP,
  exitAll: NOOP
};

const noopTiling = {
  get enabled() {
    return false;
  },
  setEnabled: NOOP,
  getEffectiveConfig: () => null,
  updateConfig: NOOP,
  applyBarSettings: NOOP,
  focusDirection: NOOP,
  swapDirection: NOOP,
  resizeDirection: NOOP,
  cycleFocus: NOOP,
  toggleFloating: NOOP,
  toggleFullscreenOnTiled: NOOP,
  toggleSplitType: NOOP,
  closeFocusedWindow: NOOP
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

const noopAchievements = {
  trigger: NOOP,
  incrementAppLaunched: NOOP,
  incrementGameLaunched: NOOP,
  incrementScreenshotTaken: NOOP,
  incrementCalculationDone: NOOP,
  incrementPowerProfileChange: NOOP,
  incrementSession: NOOP,
  incrementWallpaper: NOOP,
  incrementTerminalCmd: NOOP,
  incrementFileUploaded: NOOP,
  triggerCommandExecution: NOOP,
  unlock: () => null
};

const noopPorts = {
  register: NOOP,
  unregister: NOOP,
  get: () => null,
  isRegistered: () => false,
  list: () => []
};

const noopAccount = {
  client: { signIn: () => Promise.reject(new Error("[OS Bridge] Not initialized")), signOut: () => Promise.reject() },
  signIn: () => Promise.reject(new Error("[OS Bridge] Not initialized")),
  signUp: () => Promise.reject(new Error("[OS Bridge] Not initialized")),
  signOut: () => Promise.reject(new Error("[OS Bridge] Not initialized")),
  isAccount: () => Promise.resolve(false),
  isSynced: () => Promise.resolve(false),
  getInfo: () => Promise.resolve(null),
  updateInfo: () => Promise.reject(new Error("[OS Bridge] Not initialized")),
  reauth: () => Promise.resolve({ needsSignIn: true }),
  sync: {
    enabled: () => false,
    enable: NOOP,
    components: () => ({}),
    toggleComponent: NOOP,
    getEnabledComponents: () => ({}),
    buildBundle: () => null,
    push: () => Promise.resolve({ error: "Not signed in." }),
    pull: () => Promise.resolve({ error: "Not signed in." })
  },
  onAccountChange: () => NOOP,
  getSession: () => null,
  formatSize: () => ""
};

const noopAPIs = {
  storage: noopStorage,
  events: noopEvents,
  notify: noopNotify,
  window: noopWindow,
  fs: noopFs,
  dialog: noopDialog,
  tray: noopTray,
  ports: noopPorts,
  app: noopApp,
  tor: noopTor,
  tiling: noopTiling,
  modes: noopModes,
  achievements: noopAchievements,
  account: noopAccount,
  clipboardManager: null,
  fileSystemManager: null
};

export const os = new Proxy(
  {},
  {
    get(target, prop) {
      if (!bridge) {
        const fallback = noopAPIs[prop];
        if (fallback !== undefined) return fallback;
        if (prop === "then" || prop === "catch") return undefined;
        return undefined;
      }
      return bridge[prop];
    }
  }
);
