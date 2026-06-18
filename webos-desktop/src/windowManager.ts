import { audioMixer } from "./audioMixer.js";
import { WorkspaceManager } from "./windowManager/WorkspaceManager.js";
import { makeResizable } from "./windowManager/makeResizable.js";
import { setupWindowControls } from "./windowManager/windowControls.js";
import { notify, sendNotify } from "./windowManager/notificationBridge.js";
import { bus, BusEvents } from "./core/EventBus.js";
import { initClickBubble } from "./windowManager/AnimationSystem.js";
import { InputHandler } from "./windowManager/InputHandler.js";
import { LayoutManager } from "./windowManager/LayoutManager.js";
import { SnapSystem } from "./windowManager/SnapSystem.js";
import { TaskbarSystem } from "./windowManager/TaskbarSystem.js";
import { WindowSessionManager } from "./windowManager/WindowSessionManager.js";
import { AppRestorationService } from "./windowManager/AppRestorationService.js";
import { WindowStateManager } from "./windowManager/WindowStateManager.js";
import { ContextMenuManager } from "./windowManager/ContextMenuManager.js";
import { WindowManagerUtils } from "./windowManager/WindowManagerUtils.js";

import { StorageKeys, os } from "./framework.js";
export class WindowManager {
  openWindows: Map<string, any>;
  zIndexCounter: number;
  gameWindowCount: number;
  isDraggingWindow: boolean;
  notificationCenter: any;
  initialTitle: string;
  initialFavicon: string;
  _snapGhost: any;
  _activeSnapZone: any;
  _snapThreshold: number;
  _taskbarPreview: any;
  _taskbarPreviewWinId: string | null;
  _taskbarPreviewHideTimer: any;
  _taskbarPreviewShowTimer: any;
  _taskbarPreviewHovering: boolean;
  _lastFocusZone: string;
  fs: any;
  appLauncher: any;
  _sessionSaveTimer: any;
  _isRestoring: boolean;
  _lastSpawnedPosition: any;
  _lastSpawnTime: number;
  inputHandler: InputHandler;
  layoutManager: LayoutManager;
  snapSystem: SnapSystem;
  taskbarSystem: TaskbarSystem;
  sessionManager: WindowSessionManager;
  appRestorationService: AppRestorationService;
  windowStateManager: WindowStateManager;
  contextMenuManager: ContextMenuManager;
  utils: WindowManagerUtils;
  workspaceManager: WorkspaceManager;

  constructor(notificationCenter: any = null) {
    this.openWindows = new Map();
    this.zIndexCounter = 1000;
    this.gameWindowCount = 0;
    this.isDraggingWindow = false;
    this.notificationCenter = notificationCenter;
    this.initialTitle = document.title || "YukiOS";
    const faviconLink = document.querySelector("link[rel~='icon']");
    this.initialFavicon = faviconLink ? (faviconLink as HTMLLinkElement).href : "";
    this._snapGhost = null;
    this._activeSnapZone = null;
    this._snapThreshold = 60;
    this._taskbarPreview = null;
    this._taskbarPreviewWinId = null;
    this._taskbarPreviewHideTimer = null;
    this._taskbarPreviewShowTimer = null;
    this._taskbarPreviewHovering = false;
    this._lastFocusZone = "desktop";
    this.fs = null;
    this.appLauncher = null;
    this._sessionSaveTimer = null;
    this._isRestoring = false;
    this._lastSpawnedPosition = null;
    this._lastSpawnTime = 0;

    this.inputHandler = new InputHandler(this);
    this.layoutManager = new LayoutManager(this);
    this.snapSystem = new SnapSystem(this);
    this.taskbarSystem = new TaskbarSystem(this);
    this.sessionManager = new WindowSessionManager(this);
    this.appRestorationService = new AppRestorationService(this);
    this.windowStateManager = new WindowStateManager(this);
    this.contextMenuManager = new ContextMenuManager(this);
    this.utils = new WindowManagerUtils(this);

    this.snapSystem.init();
    this.inputHandler.init();
    this.utils.init();

    this.workspaceManager = new WorkspaceManager(this);

    initClickBubble();

    bus.on(BusEvents.SETTINGS_CHANGED, () => {
      this.updateTransparency();
      this.updateTaskbarAlignment();
    });

    setTimeout(() => {
      audioMixer().init();
    }, 0);
  }

  applyWindowLayout(win: HTMLElement): void {
    this.utils.applyWindowLayout(win);
  }

  setNotificationCenter(notificationCenter: any): void {
    this.notificationCenter = notificationCenter;
  }

  setFileSystemManager(fs: any): void {
    this.fs = fs;
  }

  setAppLauncher(appLauncher: any): void {
    this.appLauncher = appLauncher;
    if (this.appRestorationService) {
      this.appRestorationService.buildRegistryFromConfig();
    }
  }

  triggerSessionSave(): void {
    if (this.appRestorationService && this.appRestorationService.isRestoring) return;
    if (this._sessionSaveTimer) clearTimeout(this._sessionSaveTimer);
    this._sessionSaveTimer = setTimeout(() => this.appRestorationService!.saveSession(), 500);
  }

  _guessAppIdFromWinId(winId: string): any {
    return this.sessionManager._guessAppIdFromWinId(winId);
  }

  saveSession(): any {
    return this.appRestorationService!.saveSession();
  }

  restoreSession(): any {
    return this.appRestorationService!.restoreSession();
  }

  _isHeavyApp(appId: string, appType: string): any {
    return this.sessionManager._isHeavyApp(appId, appType);
  }

  _processRestorationQueue(queue: any): any {
    return this.sessionManager._processRestorationQueue(queue);
  }

  _restoreSingleWindowState(state: any, appId: string): any {
    return this.sessionManager._restoreSingleWindowState(state, appId);
  }

  notify(
    title: string,
    message: string,
    type: string = "info",
    duration: number = 5000,
    icon: string | null = null,
    appSource: string | null = null
  ): void {
    notify(this, title, message, type, duration, icon, appSource);
  }

  updateTransparency(): void {
    this.utils.updateTransparency();
  }

  updateTaskbarAlignment(): void {
    this.taskbarSystem.updateTaskbarAlignment();
  }

  _resolveIconType(iconValue: string): any {
    return this.utils._resolveIconType(iconValue);
  }

  _getFaviconLink(): any {
    return this.utils._getFaviconLink();
  }

  _animateAndRemove(win: HTMLElement): void {
    this.windowStateManager._animateAndRemove(win);
  }

  _buildPropertiesWindow(winId: string): void {
    this.contextMenuManager._buildPropertiesWindow(winId);
  }

  _buildContextMenuItems(addMenuItem: Function, addSeparator: Function, win: HTMLElement): void {
    this.contextMenuManager._buildContextMenuItems(addMenuItem, addSeparator, win);
  }

  getOpenWindowCount(): number {
    return this.utils.getOpenWindowCount();
  }

  _getWindowNormalGeometry(win: HTMLElement): any {
    return this.utils._getWindowNormalGeometry(win);
  }

  createWindow(
    id: string,
    title: string,
    width: string | number = "80vw",
    height: string | number = "80vh",
    isGame: boolean | Record<string, any> = false,
    initialOptions: Record<string, any> = {}
  ): HTMLElement {
    if (typeof isGame === "object") {
      initialOptions = isGame;
      isGame = false;
    }
    const pendingOpts: any = this._pendingLaunchOptions || {};
    const options = { ...pendingOpts, ...initialOptions };
    this._pendingLaunchOptions = null;

    const win = document.createElement("div");
    win.className = "window";
    win.id = id;
    win.dataset.fullscreen = "false";
    if (!id.startsWith("browser-app-") && id !== "games-app-win") {
      win.style.opacity = "0";
    }
    if (options.appId) win.dataset.appId = options.appId;
    if (options.appType) win.dataset.appType = options.appType;

    const resolveToPx = (val: any, isHeight: boolean): number => {
      if (val == null) return isHeight ? window.innerHeight * 0.8 : window.innerWidth * 0.8;
      const str = String(val).trim();
      if (str.endsWith("vw")) return (window.innerWidth * parseFloat(str)) / 100;
      if (str.endsWith("vh")) return (window.innerHeight * parseFloat(str)) / 100;
      if (str.endsWith("em") || str.endsWith("rem")) {
        const baseFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        return parseFloat(str) * baseFontSize;
      }
      if (str.endsWith("%")) {
        const base = isHeight ? window.innerHeight : window.innerWidth;
        return (base * parseFloat(str)) / 100;
      }
      return parseInt(str) || (isHeight ? 600 : 800);
    };

    const widthStr = width != null ? String(width) : "80vw";
    const heightStr = height != null ? String(height) : "80vh";

    const vw = resolveToPx(widthStr, false);
    const vh = resolveToPx(heightStr, true);

    let disableDesktopStretchScroll = false;
    try {
      disableDesktopStretchScroll = os.storage.get(StorageKeys.disableDesktopStretchScroll) === "true";
    } catch {}

    let finalW = vw;
    let finalH = vh;
    let position = this.calculateWindowPosition(vw, vh, options);

    if (options.forceId) {
      if (options.width != null) finalW = resolveToPx(options.width, false);
      if (options.height != null) finalH = resolveToPx(options.height, true);
      if (options.position) position = { left: options.position.x, top: options.position.y };
    } else if (options.appId) {
      try {
        const saved: any = os.storage.get(`${StorageKeys.geometryPrefix}${options.appId}`);
        if (saved) {
          if (saved && typeof saved.x === "number" && typeof saved.y === "number") {
            position = { left: saved.x, top: saved.y };
            if (saved.width) finalW = resolveToPx(saved.width, false);
            if (saved.height) finalH = resolveToPx(saved.height, true);
          }
        }
      } catch (e) {}
    }

    Object.assign(win.style, {
      width: `${finalW}px`,
      height: `${finalH}px`,
      left: `${position.left}px`,
      top: `${position.top}px`,
      position: disableDesktopStretchScroll ? "fixed" : "absolute",
      zIndex: this.zIndexCounter++
    });

    if (isGame) this.gameWindowCount++;
    this.updateTransparency();
    if (win.id === "yukiOS-settings") {
      setTimeout(() => {
        win.click();
      }, 0);
    }
    win.addEventListener("mousedown", () => this.bringToFront(win));
    this.triggerSessionSave();

    return win;
  }

  _pendingLaunchOptions: Record<string, any> | null = null;

  calculateWindowPosition(
    windowWidth: number,
    windowHeight: number,
    options: Record<string, any> = {}
  ): { left: number; top: number } {
    return this.layoutManager.calculateWindowPosition(windowWidth, windowHeight, options);
  }

  _getScreenBounds(): any {
    return this.layoutManager._getScreenBounds();
  }

  _getTaskbarHeight(): number {
    return this.layoutManager._getTaskbarHeight();
  }

  _getCenteredPosition(windowWidth: number, windowHeight: number): { left: number; top: number } {
    return this.layoutManager._getCenteredPosition(windowWidth, windowHeight);
  }

  _getCascadePosition(windowWidth: number, windowHeight: number, workspace: any): { left: number; top: number } {
    return this.layoutManager._getCascadePosition(windowWidth, windowHeight, workspace);
  }

  mountWindow(win: HTMLElement, winId: string, title: string, iconValue: string, color: string | null = null): void {
    if (!document.body.contains(win)) {
      document.body.appendChild(win);
    }
    this.makeDraggable(win);
    this.makeResizable(win);
    this.setupWindowControls(win);
    this.addToTaskbar(winId, title, iconValue, color);
    this.bringToFront(win);
  }

  getWindowIconHtml(iconValue: string, color: string | null = null): string {
    return this.utils.getWindowIconHtml(iconValue, color);
  }

  _buildTaskbarIcon(iconValue: string, title: string, color: string | null): string {
    return this.taskbarSystem._buildTaskbarIcon(iconValue, title, color);
  }

  addToTaskbar(winId: string, title: string, iconValue: string, color: string | null = null): void {
    this.taskbarSystem.addToTaskbar(winId, title, iconValue, color);
  }

  _scheduleHideTaskbarPreview(): void {
    this.taskbarSystem._scheduleHideTaskbarPreview();
  }

  _hideTaskbarPreview(): void {
    this.taskbarSystem._hideTaskbarPreview();
  }

  _showTaskbarPreview(winId: string, anchorEl: HTMLElement): void {
    this.taskbarSystem._showTaskbarPreview(winId, anchorEl);
  }

  registerCloseWindow(closeButton: HTMLElement, winId: string): void {
    this.windowStateManager.registerCloseWindow(closeButton, winId);
  }

  updatePageFavicon(iconValue: string, title: string): void {
    this.utils.updatePageFavicon(iconValue, title);
  }

  resetToDefaultState(): void {
    this.utils.resetToDefaultState();
  }

  _initVisibilityTracking(): void {
    this.utils._initVisibilityTracking();
  }

  bringToFront(win: HTMLElement): void {
    this.windowStateManager.bringToFront(win);
  }

  removeFromTaskbar(winId: string): void {
    this.taskbarSystem.removeFromTaskbar(winId);
  }

  minimizeWindow(win: HTMLElement): void {
    this.windowStateManager.minimizeWindow(win);
  }

  toggleFullscreen(win: HTMLElement): void {
    this.windowStateManager.toggleFullscreen(win);
  }

  setupWindowControls(win: HTMLElement): void {
    setupWindowControls(win, this);
  }

  _silenceWindow(win: HTMLElement): void {
    this.windowStateManager._silenceWindow(win);
  }

  _showWindowContextMenu(e: MouseEvent, win: HTMLElement): void {
    this.contextMenuManager._showWindowContextMenu(e, win);
  }

  _initSnapGhost(): void {
    this.snapSystem._initSnapGhost();
  }

  makeDraggable(win: HTMLElement): void {
    this.snapSystem.makeDraggable(win);
  }

  _getSnapZone(x: number, y: number): any {
    return this.snapSystem._getSnapZone(x, y);
  }

  _showSnapGhost(zone: any): void {
    this.snapSystem._showSnapGhost(zone);
  }

  _hideSnapGhost(): void {
    this.snapSystem._hideSnapGhost();
  }

  _applySnap(win: HTMLElement, zone: any): void {
    this.snapSystem._applySnap(win, zone);
  }

  _unsnap(win: HTMLElement): void {
    this.snapSystem._unsnap(win);
  }

  makeResizable(win: HTMLElement, setHeightUnsetElement: HTMLElement | null = null): void {
    makeResizable(win, this, setHeightUnsetElement);
  }

  _downloadWindowContent(win: HTMLElement): void {
    this.utils._downloadWindowContent(win);
  }

  getWindowControls(externalUrl?: string): string {
    return this.utils.getWindowControls(externalUrl);
  }

  sendNotify(text: string, appSource: string | null = null): void {
    sendNotify(this, text, appSource);
  }

  _isWindowPinned(winId: string): boolean {
    return this.taskbarSystem._isWindowPinned(winId);
  }

  _getPinnedItems(): any {
    return this.taskbarSystem._getPinnedItems();
  }

  _savePinnedItems(pinnedItems: any): void {
    this.taskbarSystem._savePinnedItems(pinnedItems);
  }

  _pinToTaskbar(winId: string): void {
    this.taskbarSystem._pinToTaskbar(winId);
  }

  _unpinFromTaskbar(winId: string): void {
    this.taskbarSystem._unpinFromTaskbar(winId);
  }

  _renderPinnedItems(): void {
    this.taskbarSystem._renderPinnedItems();
  }

  _findAppIdByWinId(winId: string): string | null {
    return this.utils._findAppIdByWinId(winId);
  }

  closeWindow(win: HTMLElement | string): void {
    if (typeof win === "string") {
      win = document.getElementById(win) as HTMLElement;
    }
    if (!win) return;
    this._silenceWindow(win);
    this.removeFromTaskbar(win.id);
    if (win.dataset.isGame === "true") {
      this.gameWindowCount = Math.max(0, this.gameWindowCount - 1);
    }
    this.updateTransparency();
    this._animateAndRemove(win);
  }

  closeAll(): void {
    this.windowStateManager.closeAll();
  }

  restorePinnedItems(): void {
    this.taskbarSystem.restorePinnedItems();
  }
}
