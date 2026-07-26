import { audioMixer } from "./audioMixer.js";
import { WorkspaceManager } from "./windowManager/WorkspaceManager.js";
import { windowMakeResizable } from "./windowManager/makeResizable.js";
import { setupWindowControls } from "./windowManager/windowControls.js";
import { notify, sendNotify } from "./windowManager/notificationBridge.js";
import { bus, BusEvents } from "./core/EventBus.js";
import { initClickBubble, animateWindowOpen } from "./windowManager/AnimationSystem.js";
import { InputHandler } from "./windowManager/InputHandler.js";
import { LayoutManager } from "./windowManager/LayoutManager.js";
import { SnapSystem } from "./windowManager/SnapSystem.js";
import { TaskbarSystem } from "./windowManager/TaskbarSystem.js";
import { MacDock } from "./windowManager/MacDock.js";
import { WindowSessionManager } from "./windowManager/WindowSessionManager.js";
import { AppRestorationService } from "./windowManager/AppRestorationService.js";
import { WindowStateManager } from "./windowManager/WindowStateManager.js";
import { ContextMenuManager } from "./windowManager/ContextMenuManager.js";
import { WindowManagerUtils } from "./windowManager/WindowManagerUtils.js";
import { TilingManager } from "./windowManager/TilingManager.js";

import { StorageKeys, os } from "./framework.js";
import { $ } from "./shared/domUtils.js";
import { isMobile } from "./shared/platformUtils.js";

export class WindowManager {
  openWindows: Map<string, any>;
  zIndexCounter: number;
  gameWindowCount: number;
  isDraggingWindow: boolean;
  notificationCenter: any;
  initialTitle: string;
  initialFavicon: string;
  snapGhost: any;
  activeSnapZone: any;
  snapThreshold: number;
  taskbarPreview: any;
  taskbarPreviewWinId: string | null;
  taskbarPreviewHideTimer: any;
  taskbarPreviewShowTimer: any;
  taskbarPreviewHovering: boolean;
  lastFocusZone: string;
  fs: any;
  appLauncher: any;
  sessionSaveTimer: any;
  isRestoring: boolean;
  lastSpawnedPosition: any;
  lastSpawnTime: number;
  inputHandler: InputHandler;
  layoutManager: LayoutManager;
  snapSystem: SnapSystem;
  taskbarSystem: TaskbarSystem;
  macDock: MacDock;
  sessionManager: WindowSessionManager;
  appRestorationService: AppRestorationService;
  windowStateManager: WindowStateManager;
  contextMenuManager: ContextMenuManager;
  utils: WindowManagerUtils;
  workspaceManager: WorkspaceManager;
  tilingManager: TilingManager;

  constructor(notificationCenter: any = null) {
    this.openWindows = new Map();
    this.zIndexCounter = 1000;
    this.gameWindowCount = 0;
    this.isDraggingWindow = false;
    this.notificationCenter = notificationCenter;
    this.initialTitle = document.title || "YukiOS";
    const faviconLink = $("link[rel~='icon']");
    this.initialFavicon = faviconLink ? (faviconLink as HTMLLinkElement).href : "";
    this.snapGhost = null;
    this.activeSnapZone = null;
    this.snapThreshold = 60;
    this.taskbarPreview = null;
    this.taskbarPreviewWinId = null;
    this.taskbarPreviewHideTimer = null;
    this.taskbarPreviewShowTimer = null;
    this.taskbarPreviewHovering = false;
    this.lastFocusZone = "desktop";
    this.fs = null;
    this.appLauncher = null;
    this.sessionSaveTimer = null;
    this.isRestoring = false;
    this.lastSpawnedPosition = null;
    this.lastSpawnTime = 0;

    this.inputHandler = new InputHandler(this);
    this.layoutManager = new LayoutManager(this);
    this.snapSystem = new SnapSystem(this);
    this.taskbarSystem = new TaskbarSystem(this);
    this.macDock = new MacDock(this);
    this.sessionManager = new WindowSessionManager(this);
    this.appRestorationService = new AppRestorationService(this);
    this.windowStateManager = new WindowStateManager(this);
    this.contextMenuManager = new ContextMenuManager(this);
    this.utils = new WindowManagerUtils(this);

    this.tilingManager = new TilingManager(this);

    this.snapSystem.init();
    this.inputHandler.init();
    this.utils.init();

    this.workspaceManager = new WorkspaceManager(this);

    setTimeout(() => {
      this.tilingManager.init();
    }, 0);

    initClickBubble();

    bus.on(BusEvents.SETTINGS_CHANGED, () => {
      this.updateTransparency();
      this.updateTaskbarAlignment();
      const wasActive = !!document.getElementById("mac-dock");
      const nowActive = this.macDock.isActive();
      if (nowActive && !wasActive) {
        this.macDock.init();
      } else if (!nowActive && wasActive) {
        this.macDock.destroy();
      } else if (nowActive && wasActive) {
        this.macDock.onSettingsChanged();
      }
    });

    setTimeout(() => {
      const dockActive = this.macDock.isActive();
      const macControls = os.storage.get(StorageKeys.macOsControls) === "true";
      if (dockActive !== macControls) {
        os.storage.set(StorageKeys.macOsControls, String(dockActive));
      }
    }, 0);

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
    if (this.sessionSaveTimer) clearTimeout(this.sessionSaveTimer);
    this.sessionSaveTimer = setTimeout(() => this.appRestorationService!.saveSession(), 500);
  }

  guessAppIdFromWinId(winId: string): any {
    return this.sessionManager.guessAppIdFromWinId(winId);
  }

  saveSession(): any {
    return this.appRestorationService!.saveSession();
  }

  restoreSession(): any {
    return this.appRestorationService!.restoreSession();
  }

  isHeavyApp(appId: string, appType: string): any {
    return this.sessionManager.isHeavyApp(appId, appType);
  }

  processRestorationQueue(queue: any): any {
    return this.sessionManager.processRestorationQueue(queue);
  }

  restoreSingleWindowState(state: any, appId: string): any {
    return this.sessionManager.restoreSingleWindowState(state, appId);
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

  resolveIconType(iconValue: string): any {
    return this.utils.resolveIconType(iconValue);
  }

  getFaviconLink(): any {
    return this.utils.getFaviconLink();
  }

  animateAndRemove(win: HTMLElement): void {
    this.windowStateManager.animateAndRemove(win);
  }

  buildPropertiesWindow(winId: string): void {
    this.contextMenuManager.buildPropertiesWindow(winId);
  }

  buildContextMenuItems(addMenuItem: Function, addSeparator: Function, win: HTMLElement): void {
    this.contextMenuManager.buildContextMenuItems(addMenuItem, addSeparator, win);
  }

  getOpenWindowCount(): number {
    return this.utils.getOpenWindowCount();
  }

  getWindowNormalGeometry(win: HTMLElement): any {
    return this.utils.getWindowNormalGeometry(win);
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
    const onMobile = isMobile();
    const mobileFullscreen = onMobile && !id.startsWith("yukiOS-settings");
    if (mobileFullscreen) {
      width = "100vw";
      height = "calc(100vh - var(--taskbar-h))";
    }
    const pendingOpts: any = this.pendingLaunchOptions || {};
    const options = { ...pendingOpts, ...initialOptions };
    this.pendingLaunchOptions = null;

    const win = document.createElement("div");
    win.className = "window";
    win.dataset.fullscreen = "false";

    let winId = options.forceId || id;
    if (document.getElementById(winId)) {
      let counter = 1;
      while (document.getElementById(`${winId}-${counter}`)) {
        counter++;
      }
      winId = `${winId}-${counter}`;
      win.dataset.dupId = id;
    }
    win.id = winId;
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
      disableDesktopStretchScroll = os.storage.get(StorageKeys.disableDesktopStretchScroll) !== "false";
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

    if (mobileFullscreen) {
      Object.assign(win.style, {
        width: "100vw",
        height: "calc(100vh - var(--taskbar-h))",
        left: "0",
        top: "0",
        position: "fixed",
        zIndex: this.zIndexCounter++
      });
    } else {
      Object.assign(win.style, {
        width: `${finalW}px`,
        height: `${finalH}px`,
        left: `${position.left}px`,
        top: `${position.top}px`,
        position: disableDesktopStretchScroll ? "fixed" : "absolute",
        zIndex: this.zIndexCounter++
      });
    }

    if (isGame) this.gameWindowCount++;
    this.updateTransparency();
    if (win.id === "yukiOS-settings") {
      setTimeout(() => {
        win.click();
      }, 0);
    }
    win.addEventListener("mousedown", () => this.bringToFront(win));
    win.addEventListener("touchstart", () => this.bringToFront(win), { passive: true });
    win.setAttribute("tabindex", "-1");
    this.triggerSessionSave();

    return win;
  }

  pendingLaunchOptions: Record<string, any> | null = null;

  calculateWindowPosition(
    windowWidth: number,
    windowHeight: number,
    options: Record<string, any> = {}
  ): { left: number; top: number } {
    return this.layoutManager.calculateWindowPosition(windowWidth, windowHeight, options);
  }

  getScreenBounds(): any {
    return this.layoutManager.getScreenBounds();
  }

  getTaskbarHeight(): number {
    return this.layoutManager.getTaskbarHeight();
  }

  getCenteredPosition(windowWidth: number, windowHeight: number): { left: number; top: number } {
    return this.layoutManager.getCenteredPosition(windowWidth, windowHeight);
  }

  getCascadePosition(windowWidth: number, windowHeight: number, workspace: any): { left: number; top: number } {
    return this.layoutManager.getCascadePosition(windowWidth, windowHeight, workspace);
  }

  isTilingEnabled(): boolean {
    return this.tilingManager?.enabled ?? false;
  }

  setTilingEnabled(enabled: boolean): void {
    this.tilingManager?.toggleMode(enabled);
  }

  onTilingWindowCreated(winId: string): void {
    this.tilingManager?.onWindowCreated(winId);
  }

  mountWindow(win: HTMLElement, winId: string, title: string, iconValue: string, color: string | null = null): void {
    if (!document.body.contains(win)) {
      document.body.appendChild(win);
    }
    this.makeDraggable(win);
    this.makeResizable(win);
    this.setupWindowControls(win);
    this.addToTaskbar(winId, title, iconValue, color);
    this.onTilingWindowCreated(winId);
    this.bringToFront(win);
    animateWindowOpen(win);
  }

  getWindowIconHtml(iconValue: string, color: string | null = null): string {
    return this.utils.getWindowIconHtml(iconValue, color);
  }

  buildTaskbarIcon(iconValue: string, title: string, color: string | null): string {
    return this.taskbarSystem.buildTaskbarIcon(iconValue, title, color);
  }

  addToTaskbar(winId: string, title: string, iconValue: string, color: string | null = null): void {
    this.taskbarSystem.addToTaskbar(winId, title, iconValue, color);
    if (this.macDock.isActive()) {
      this.macDock.addItem(winId, iconValue, title, color);
    }
  }

  scheduleHideTaskbarPreview(): void {
    this.taskbarSystem.scheduleHideTaskbarPreview();
  }

  hideTaskbarPreview(): void {
    this.taskbarSystem.hideTaskbarPreview();
  }

  showTaskbarPreview(winId: string, anchorEl: HTMLElement): void {
    this.taskbarSystem.showTaskbarPreview(winId, anchorEl);
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

  initVisibilityTracking(): void {
    this.utils.initVisibilityTracking();
  }

  bringToFront(win: HTMLElement): void {
    this.windowStateManager.bringToFront(win);
  }

  removeFromTaskbar(winId: string): void {
    this.taskbarSystem.removeFromTaskbar(winId);
    this.macDock.removeItem(winId);
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

  silenceWindow(win: HTMLElement): void {
    this.windowStateManager.silenceWindow(win);
  }

  showWindowContextMenu(e: MouseEvent, win: HTMLElement): void {
    this.contextMenuManager.showWindowContextMenu(e, win);
  }

  initSnapGhost(): void {
    this.snapSystem.initSnapGhost();
  }

  makeDraggable(win: HTMLElement): void {
    this.snapSystem.makeDraggable(win);
  }

  getSnapZone(x: number, y: number): any {
    return this.snapSystem.getSnapZone(x, y);
  }

  showSnapGhost(zone: any): void {
    this.snapSystem.showSnapGhost(zone);
  }

  hideSnapGhost(): void {
    this.snapSystem.hideSnapGhost();
  }

  applySnap(win: HTMLElement, zone: any): void {
    this.snapSystem.applySnap(win, zone);
  }

  unsnap(win: HTMLElement): void {
    this.snapSystem.unsnap(win);
  }

  makeResizable(win: HTMLElement, setHeightUnsetElement: HTMLElement | null = null): void {
    windowMakeResizable(win, this, setHeightUnsetElement);
  }

  downloadWindowContent(win: HTMLElement): void {
    this.utils.downloadWindowContent(win);
  }

  getWindowControls(externalUrl?: string, showDownload?: boolean): string {
    return this.utils.getWindowControls(externalUrl, showDownload);
  }

  sendNotify(text: string, appSource: string | null = null): void {
    sendNotify(this, text, appSource);
  }

  isWindowPinned(winId: string): boolean {
    return this.taskbarSystem.isWindowPinned(winId);
  }

  getPinnedItems(): any {
    return this.taskbarSystem.getPinnedItems();
  }

  savePinnedItems(pinnedItems: any): void {
    this.taskbarSystem.savePinnedItems(pinnedItems);
  }

  pinToTaskbar(winId: string): void {
    this.taskbarSystem.pinToTaskbar(winId);
  }

  unpinFromTaskbar(winId: string): void {
    this.taskbarSystem.unpinFromTaskbar(winId);
  }

  renderPinnedItems(): void {
    this.taskbarSystem.renderPinnedItems();
  }

  findAppIdByWinId(winId: string): string | null {
    return this.utils.findAppIdByWinId(winId);
  }

  closeWindow(win: HTMLElement | string): void {
    if (typeof win === "string") {
      win = document.getElementById(win) as HTMLElement;
    }
    if (!win) return;
    this.silenceWindow(win);
    this.removeFromTaskbar(win.id);
    if (win.dataset.isGame === "true") {
      this.gameWindowCount = Math.max(0, this.gameWindowCount - 1);
    }
    this.updateTransparency();
    this.animateAndRemove(win);
  }

  closeAll(): void {
    this.windowStateManager.closeAll();
  }

  restorePinnedItems(): void {
    this.taskbarSystem.restorePinnedItems();
  }

  setWindowTitle(winId: string, title: string): void {
    const win = document.getElementById(winId);
    if (!win) return;

    const headerSpan = win.querySelector(".window-header > span");
    if (headerSpan) {
      const iconEl = headerSpan.querySelector("svg, i, img");
      headerSpan.textContent = "";
      if (iconEl) headerSpan.appendChild(iconEl);
      headerSpan.appendChild(document.createTextNode(title));
    }

    const entry = this.openWindows.get(winId);
    if (entry) {
      entry.title = title;
      if (entry.record) entry.record.title = title;
    }
  }

  getWindowTitle(winId: string): string | null {
    const entry = this.openWindows.get(winId);
    return entry?.title ?? null;
  }
}
