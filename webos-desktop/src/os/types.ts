export interface WindowOptions {
  width?: string | number;
  height?: string | number;
  position?: { x: number; y: number };
  isGame?: boolean;
  appId?: string;
  appType?: string;
  forceId?: string;
  icon?: string;
  iconColor?: string;
  autoMount?: boolean;
  autoFocus?: boolean;
  skipAutoSetup?: boolean;
  externalUrl?: string;
  skipHeader?: boolean;
}

export interface WindowHandle {
  id: string;
  element: HTMLElement;
}

export type FileKind = "text" | "image" | "video" | "audio" | "rom" | "other";

export interface FileMetadata {
  type: "file" | "directory";
  kind?: FileKind;
  icon?: string;
  faIcon?: string;
  size?: number;
  content?: string | Uint8Array;
}

export interface FileSystemEntry {
  [key: string]: FileMetadata | FileSystemEntry;
}

export interface ReadFileOptions {
  encoding?: "utf8" | "binary";
}

export interface WriteFileOptions {
  encoding?: "utf8" | "binary";
  kind?: FileKind;
  icon?: string;
}

export type NotificationType = "info" | "success" | "warning" | "error";

export interface NotificationOptions {
  type?: NotificationType;
  duration?: number;
  icon?: string;
  appSource?: string;
}

export interface TrayOptions {
  resident?: boolean;
  showInTray?: boolean;
  onClick?: () => void;
  onQuit?: () => void;
  contextMenuItems?: Array<{
    label: string;
    action: () => void;
  }>;
  priority?: number;
}

export interface TrayItem {
  winId: string;
  icon: string;
  label: string;
  options: TrayOptions;
}

export type AppType = "system" | "game" | "swf" | "gba" | "nds" | "psp" | "megadrive" | "genesis" | "html" | "remote";

export interface AppInfo {
  type: AppType;
  title: string;
  icon?: string;
  url?: string;
  swf?: string;
  html?: string;
  action?: (extra?: unknown) => void;
}

export interface LaunchOptions {
  forceId?: string;
  width?: string | number;
  height?: string | number;
  steamGameId?: string;
  source?: string;
  originalName?: string;
  analyticsBase?: unknown;
  type?: string;
}

export type EventHandler = (data?: unknown) => void;

export interface EventBusEvents {
  "window:created": { winId: string };
  "window:focused": { winId: string };
  "window:minimized": { winId: string };
  "window:closed": { winId: string };
  "window:fullscreen": { winId: string };
  "window:snapped": { winId: string; zone: string };
  "settings:changed": { key: string; value: unknown };
  "app:launched": { appId: string };
  notify: { title: string; message: string };
  "achievement:trigger": { achievementId: string };
  "terminal:cmd-executed": { command: string };
  "desktop:wallpaper-changed": { wallpaper: string };
  "desktop:login-wallpaper-changed": { wallpaper: string };
  "desktop:icon-added": { icon: string };
  "desktop:icon-removed": { icon: string };
  "workspace:switched": { workspaceId: number };
  "workspace:added": { workspaceId: number };
  "workspace:removed": { workspaceId: number };
  "file:changed": { path: string };
  "session:initialized": { sessionId: string };
  "system:locked": {};
  "system:unlocked": {};
  "clipboard:update": { content: unknown };
  "clipboard:read": {};
  "clipboard:clear": {};
  "profile:updated": unknown;
}

export interface WindowManagerService {
  utils: {
    generateWindowHeader(title: string, icon: string, iconColor?: string, externalUrl?: string): string;
  };
  createWindow(
    id: string,
    title: string,
    width: string | number,
    height: string | number,
    isGame: boolean,
    options: WindowOptions
  ): HTMLElement;
  addToTaskbar(winId: string, title: string, icon: string, color?: string): void;
  bringToFront(win: HTMLElement): void;
  makeResizable(win: HTMLElement): void;
  setupWindowControls(win: HTMLElement): void;
  closeWindow(win: HTMLElement): void;
  closeAll(): void;
  minimizeWindow(win: HTMLElement): void;
  toggleFullscreen(win: HTMLElement): void;
  removeFromTaskbar(winId: string): void;
  getWindowControls(externalUrl?: string, showDownload?: boolean): string;
  notify(title: string, message: string, type: string, duration: number, icon?: string, appSource?: string): void;
}

export interface FileSystemManagerService {
  fsReady: Promise<void>;
  resolveUserPath(path: string): string;
  pRead(method: string, ...args: unknown[]): Promise<unknown>;
  dirname(path: string): string;
  basename(path: string): string;
  ensureFolder(path: string): Promise<void>;
  safeWriteFile(path: string, content: string | Uint8Array): Promise<void>;
  writeMeta(dir: string, name: string, meta: { kind?: FileKind; icon?: string }): Promise<void>;
  notifyDesktopChange(path: string): Promise<void>;
  getFolder(path: string): Promise<FileSystemEntry>;
  deleteItem(dir: string, name: string): Promise<void>;
  exists(fullPath: string): Promise<boolean>;
  renameItem(dir: string, oldName: string, newName: string): Promise<void>;
  readMeta(dir: string): Promise<Record<string, { kind?: FileKind; icon?: string }>>;
  inferKind(filename: string): FileKind;
  writeBinaryFile(path: string, name: string, blob: Blob, kind?: FileKind, icon?: string): Promise<string>;
  readBinaryFile(path: string, name: string): Promise<Blob | null>;
  deleteBinaryFile(path: string, name: string): Promise<void>;
  renameBinaryFile(path: string, oldName: string, newName: string): Promise<void>;
  createFile(
    path: string,
    name: string,
    content: string,
    kind?: FileKind,
    icon?: string,
    faIcon?: string
  ): Promise<string>;
  createFolder(path: string, name: string): Promise<string>;
  updateFile(path: string, name: string, content: string): Promise<void>;
  trash: {
    moveToTrash(dir: string, name: string): Promise<void>;
    getItems(): Promise<Array<{ id: string }>>;
    restoreItem(id: string): Promise<void>;
    restoreAll(): Promise<Array<unknown>>;
    deletePermanently(id: string): Promise<void>;
    emptyTrash(): Promise<void>;
    getItemCount(): Promise<number>;
  };
}

export interface NotificationCenterService {
  addNotification(
    title: string,
    message: string,
    type: NotificationType,
    duration: number,
    icon?: string,
    appSource?: string
  ): number;
  removeNotification(id: number): void;
  clearAllNotifications(): void;
  getNotifications(): Array<{
    id: number;
    title: string;
    message: string;
    type: NotificationType;
    timestamp: Date;
    icon?: string;
    appSource?: string;
  }>;
  getNotificationCount(): number;
  setDoNotDisturb(enabled: boolean): void;
  doNotDisturb: boolean;
}

export interface AppLauncherService {
  launch(appId: string, isSwf?: boolean, options?: LaunchOptions): Promise<void>;
  wm: WindowManagerService;
  openWindows: Map<string, { title?: string; iconValue?: string }>;
  trayManager: TrayManagerService & { trayItems?: Map<string, { inTray?: boolean; label?: string; icon?: string }> };
  appMap: Record<string, AppInfo>;
}

export interface TrayItemValue {
  icon: string;
  label: string;
  inTray: boolean;
  resident: boolean;
  showInTray: boolean;
  onClick: (() => void) | null;
  onWheel: ((e: WheelEvent) => void) | null;
  onQuit: (() => void) | null;
  contextMenuItems: Array<{ label: string; action: () => void }> | null;
  priority: number;
  visibleInSettings?: boolean;
}

export interface TrayManagerService {
  register(winId: string, icon: string, label: string, options: TrayOptions): void;
  unregister(winId: string): void;
  updateIcon(winId: string, icon: string): void;
  updateLabel(winId: string, label: string): void;
  updateContextMenuItems(winId: string, items: Array<{ label: string; action: () => void }>): void;
  sendToTray(winId: string): void;
  restoreFromTray(winId: string): void;
  isRegistered(winId: string): boolean;
  items: Map<string, TrayItemValue>;
  render(): void;
}

export interface EventBusService {
  on(event: string, handler: EventHandler): () => void;
  once(event: string, handler: EventHandler): () => void;
  off(event: string, handler: EventHandler): void;
  emit(event: string, data?: unknown): void;
  clear(event?: string): void;
  listenerCount(event: string): number;
}

export interface ExplorerAppService {
  open(path: string[], callback: (path: string[], name: string) => void): void;
  openSaveDialog(defaultFileName: string, onSave: (path: string[], filename: string) => void): void;
  openDirectoryDialog(onSelect: (path: string[]) => void): void;
}

export interface TorManagerService {
  fetch(url: string): Promise<Response>;
  post(url: string, body: Uint8Array): Promise<Response>;
  request(
    method: string,
    url: string,
    headers?: Record<string, string>,
    body?: Uint8Array,
    timeout?: number
  ): Promise<Response>;
  createClient(): Promise<{
    fetch: (url: string) => Promise<Response>;
    post: (url: string, body: Uint8Array) => Promise<Response>;
    request: (
      method: string,
      url: string,
      headers?: Record<string, string>,
      body?: Uint8Array,
      timeout?: number
    ) => Promise<Response>;
    getFetchCount: () => number;
    close: () => Promise<void>;
    waitForCircuit: () => Promise<void>;
  }>;
  getStatus(): { running: boolean; phase: string; ready: boolean };
  start(options?: Record<string, unknown>): Promise<void>;
  stop(): Promise<void>;
  getLogs(): string[];
  reconnect(): void;
  getFetchCount(): number;
  snowflakeUrl: string;
  onEvent(callback: (type: string, data: unknown) => void): () => void;
}

export interface OSServices {
  windowManager: WindowManagerService;
  fileSystemManager: FileSystemManagerService;
  notificationCenter: NotificationCenterService;
  appLauncher: AppLauncherService;
  eventBus: EventBusService;
}

export interface StorageAPI {
  get<T = unknown>(key: string): T | null;
  set(key: string, value: unknown): void;
  remove(key: string): void;
  clear(): void;
  has(key: string): boolean;
}
