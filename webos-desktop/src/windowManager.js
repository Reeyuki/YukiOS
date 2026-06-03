import { StorageKeys } from "./settings/settings.js";
import { audioMixer } from "./audioMixer.js";
import { os } from "./os/index.js";
import { WorkspaceManager } from "./windowManager/WorkspaceManager.js";
import { makeResizable } from "./windowManager/makeResizable.js";
import { setupWindowControls } from "./windowManager/windowControls.js";
import { notify, sendNotify } from "./windowManager/notificationBridge.js";
import { bus, BusEvents } from "./core/EventBus.js";
import { animateWindowOpen, initClickBubble } from "./windowManager/AnimationSystem.js";

import { InputHandler } from "./windowManager/InputHandler.js";
import { LayoutManager } from "./windowManager/LayoutManager.js";
import { SnapSystem } from "./windowManager/SnapSystem.js";
import { TaskbarSystem } from "./windowManager/TaskbarSystem.js";
import { SessionManager } from "./windowManager/SessionManager.js";
import { WindowStateManager } from "./windowManager/WindowStateManager.js";
import { ContextMenuManager } from "./windowManager/ContextMenuManager.js";
import { WindowManagerUtils } from "./windowManager/WindowManagerUtils.js";

/**
 * @deprecated Use os.window API instead. Direct access to WindowManager is deprecated.
 */
export class WindowManager {
  constructor(notificationCenter = null) {
    this.openWindows = new Map();
    this.zIndexCounter = 1000;
    this.gameWindowCount = 0;
    this.isDraggingWindow = false;
    this.notificationCenter = notificationCenter;
    this.initialTitle = document.title || "YukiOS";
    const faviconLink = document.querySelector("link[rel~='icon']");
    this.initialFavicon = faviconLink ? faviconLink.href : "";
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
    this.sessionManager = new SessionManager(this);
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
      audioMixer.init();
    }, 0);
  }

  applyWindowLayout(win) {
    this.utils.applyWindowLayout(win);
  }

  setNotificationCenter(notificationCenter) {
    this.notificationCenter = notificationCenter;
  }

  setFileSystemManager(fs) {
    this.fs = fs;
  }

  setAppLauncher(appLauncher) {
    this.appLauncher = appLauncher;
  }

  triggerSessionSave() {
    this.sessionManager.triggerSessionSave();
  }

  _guessAppIdFromWinId(winId) {
    return this.sessionManager._guessAppIdFromWinId(winId);
  }

  saveSession() {
    return this.sessionManager.saveSession();
  }

  restoreSession() {
    return this.sessionManager.restoreSession();
  }

  _isHeavyApp(appId, appType) {
    return this.sessionManager._isHeavyApp(appId, appType);
  }

  _processRestorationQueue(queue) {
    return this.sessionManager._processRestorationQueue(queue);
  }

  _restoreSingleWindowState(state, appId) {
    return this.sessionManager._restoreSingleWindowState(state, appId);
  }

  notify(title, message, type = "info", duration = 5000, icon = null, appSource = null) {
    notify(this, title, message, type, duration, icon, appSource);
  }

  updateTransparency() {
    this.utils.updateTransparency();
  }

  updateTaskbarAlignment() {
    this.taskbarSystem.updateTaskbarAlignment();
  }

  _resolveIconType(iconValue) {
    return this.utils._resolveIconType(iconValue);
  }

  _getFaviconLink() {
    return this.utils._getFaviconLink();
  }

  _animateAndRemove(win) {
    this.windowStateManager._animateAndRemove(win);
  }

  _buildPropertiesWindow(winId) {
    this.contextMenuManager._buildPropertiesWindow(winId);
  }

  _buildContextMenuItems(addMenuItem, addSeparator, win) {
    this.contextMenuManager._buildContextMenuItems(addMenuItem, addSeparator, win);
  }

  getOpenWindowCount() {
    return this.utils.getOpenWindowCount();
  }

  _getWindowNormalGeometry(win) {
    return this.utils._getWindowNormalGeometry(win);
  }

  createWindow(id, title, width = "80vw", height = "80vh", isGame = false, initialOptions = {}) {
    const pendingOpts = this._pendingLaunchOptions || {};
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

    const resolveToPx = (val, isHeight) => {
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
        const saved = os.storage.get(`${StorageKeys.geometryPrefix}${options.appId}`);
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

  calculateWindowPosition(windowWidth, windowHeight, options = {}) {
    return this.layoutManager.calculateWindowPosition(windowWidth, windowHeight, options);
  }

  _getScreenBounds() {
    return this.layoutManager._getScreenBounds();
  }

  _getTaskbarHeight() {
    return this.layoutManager._getTaskbarHeight();
  }

  _getCenteredPosition(windowWidth, windowHeight) {
    return this.layoutManager._getCenteredPosition(windowWidth, windowHeight);
  }

  _getCascadePosition(windowWidth, windowHeight, workspace) {
    return this.layoutManager._getCascadePosition(windowWidth, windowHeight, workspace);
  }

  mountWindow(win, winId, title, iconValue, color = null) {
    if (!document.body.contains(win)) {
      document.body.appendChild(win);
    }
    this.makeDraggable(win);
    this.makeResizable(win);
    this.setupWindowControls(win);
    this.addToTaskbar(winId, title, iconValue, color);
    this.bringToFront(win);
  }

  getWindowIconHtml(iconValue, color = null) {
    return this.utils.getWindowIconHtml(iconValue, color);
  }

  _buildTaskbarIcon(iconValue, title, color) {
    return this.taskbarSystem._buildTaskbarIcon(iconValue, title, color);
  }

  addToTaskbar(winId, title, iconValue, color = null) {
    this.taskbarSystem.addToTaskbar(winId, title, iconValue, color);
  }

  _scheduleHideTaskbarPreview() {
    this.taskbarSystem._scheduleHideTaskbarPreview();
  }

  _hideTaskbarPreview() {
    this.taskbarSystem._hideTaskbarPreview();
  }

  _showTaskbarPreview(winId, anchorEl) {
    this.taskbarSystem._showTaskbarPreview(winId, anchorEl);
  }

  registerCloseWindow(closeButton, winId) {
    this.windowStateManager.registerCloseWindow(closeButton, winId);
  }

  updatePageFavicon(iconValue, title) {
    this.utils.updatePageFavicon(iconValue, title);
  }

  resetToDefaultState() {
    this.utils.resetToDefaultState();
  }

  _initVisibilityTracking() {
    this.utils._initVisibilityTracking();
  }

  bringToFront(win) {
    this.windowStateManager.bringToFront(win);
  }

  removeFromTaskbar(winId) {
    this.taskbarSystem.removeFromTaskbar(winId);
  }

  minimizeWindow(win) {
    this.windowStateManager.minimizeWindow(win);
  }

  toggleFullscreen(win) {
    this.windowStateManager.toggleFullscreen(win);
  }

  setupWindowControls(win) {
    setupWindowControls(win, this);
  }

  _silenceWindow(win) {
    this.windowStateManager._silenceWindow(win);
  }

  _showWindowContextMenu(e, win) {
    this.contextMenuManager._showWindowContextMenu(e, win);
  }

  _initSnapGhost() {
    this.snapSystem._initSnapGhost();
  }

  makeDraggable(win) {
    this.snapSystem.makeDraggable(win);
  }

  _getSnapZone(x, y) {
    return this.snapSystem._getSnapZone(x, y);
  }

  _showSnapGhost(zone) {
    this.snapSystem._showSnapGhost(zone);
  }

  _hideSnapGhost() {
    this.snapSystem._hideSnapGhost();
  }

  _applySnap(win, zone) {
    this.snapSystem._applySnap(win, zone);
  }

  _unsnap(win) {
    this.snapSystem._unsnap(win);
  }

  makeResizable(win, setHeightUnsetElement = null) {
    makeResizable(win, this, setHeightUnsetElement);
  }

  _downloadWindowContent(win) {
    this.utils._downloadWindowContent(win);
  }

  getWindowControls(externalUrl) {
    return this.utils.getWindowControls(externalUrl);
  }

  sendNotify(text, appSource = null) {
    sendNotify(this, text, appSource);
  }

  _isWindowPinned(winId) {
    return this.taskbarSystem._isWindowPinned(winId);
  }

  _getPinnedItems() {
    return this.taskbarSystem._getPinnedItems();
  }

  _savePinnedItems(pinnedItems) {
    this.taskbarSystem._savePinnedItems(pinnedItems);
  }

  _pinToTaskbar(winId) {
    this.taskbarSystem._pinToTaskbar(winId);
  }

  _unpinFromTaskbar(winId) {
    this.taskbarSystem._unpinFromTaskbar(winId);
  }

  _renderPinnedItems() {
    this.taskbarSystem._renderPinnedItems();
  }

  _findAppIdByWinId(winId) {
    return this.utils._findAppIdByWinId(winId);
  }

  closeWindow(win) {
    if (typeof win === "string") {
      win = document.getElementById(win);
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

  closeAll() {
    this.windowStateManager.closeAll();
  }

  restorePinnedItems() {
    this.taskbarSystem.restorePinnedItems();
  }
}
