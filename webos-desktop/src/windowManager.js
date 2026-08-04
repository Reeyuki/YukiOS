import { audioMixer } from "./audioMixer.js";
import { WorkspaceManager } from "./windowManager/WorkspaceManager.js";
import { windowMakeResizable } from "./windowManager/makeResizable.js";
import { setupWindowControls } from "./windowManager/windowControls.js";

import { bus, BusEvents } from "./core/EventBus.js";
import { initClickBubble, animateWindowOpen } from "./windowManager/AnimationSystem.js";
import { InputHandler } from "./windowManager/InputHandler.js";
import { LayoutManager } from "./windowManager/LayoutManager.js";
import { SnapSystem } from "./windowManager/SnapSystem.js";
import { TaskbarSystem } from "./windowManager/TaskbarSystem.js";
import { MacDock } from "./modes/macos/MacDock.js";
import { Shelf } from "./chromeos/Shelf.js";
import { WindowSessionManager } from "./windowManager/WindowSessionManager.js";
import { AppRestorationService } from "./windowManager/AppRestorationService.js";
import { WindowStateManager } from "./windowManager/WindowStateManager.js";
import { ContextMenuManager } from "./windowManager/ContextMenuManager.js";
import { WindowManagerUtils } from "./windowManager/WindowManagerUtils.js";
import { TilingManager } from "./modes/tiling/TilingManager.js";

import { StorageKeys, os, MODES, brand, yuriPageTitle } from "./framework.js";
import { $ } from "./shared/domUtils.js";
import { isMobile } from "./shared/platformUtils.js";

export class WindowManager {
  constructor(notificationCenter = null) {
    this.openWindows = new Map();
    this.zIndexCounter = 1000;
    this.gameWindowCount = 0;
    this.isDraggingWindow = false;
    this.notificationCenter = notificationCenter;
    this.initialTitle = yuriPageTitle() || document.title || brand("YukiOS");
    const faviconLink = $("link[rel~='icon']");
    this.initialFavicon = faviconLink ? faviconLink.href : "";
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
    this.pendingLaunchOptions = null;

    this.inputHandler = new InputHandler(this);
    this.layoutManager = new LayoutManager(this);
    this.snapSystem = new SnapSystem(this);
    this.taskbarSystem = new TaskbarSystem(this);
    this.macDock = new MacDock(this);
    this.chromeShelf = new Shelf(this);
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
      if (wasActive !== nowActive) {
        this.updateWindowHeaderStyles();
      }
    });

    bus.on(BusEvents.MODE_ENTERED, ({ id }) => {
      if (id === MODES.CHROME_OS) {
        this.chromeShelf.init();
        document.getElementById("taskbar")?.classList.add("chromeos-active");
      }
    });

    bus.on(BusEvents.MODE_EXITED, ({ id }) => {
      if (id === MODES.CHROME_OS) {
        this.chromeShelf.destroy();
        document.getElementById("taskbar")?.classList.remove("chromeos-active");
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
    if (this.appRestorationService) {
      this.appRestorationService.buildRegistryFromConfig();
    }
  }

  triggerSessionSave() {
    if (this.appRestorationService && this.appRestorationService.isRestoring) return;
    if (this.sessionSaveTimer) clearTimeout(this.sessionSaveTimer);
    this.sessionSaveTimer = setTimeout(() => this.appRestorationService.saveSession(), 500);
  }

  guessAppIdFromWinId(winId) {
    return this.sessionManager.guessAppIdFromWinId(winId);
  }

  saveSession() {
    return this.appRestorationService.saveSession();
  }

  restoreSession() {
    return this.appRestorationService.restoreSession();
  }

  isHeavyApp(appId, appType) {
    return this.sessionManager.isHeavyApp(appId, appType);
  }

  processRestorationQueue(queue) {
    return this.sessionManager.processRestorationQueue(queue);
  }

  restoreSingleWindowState(state, appId) {
    return this.sessionManager.restoreSingleWindowState(state, appId);
  }

  notify(title, message, type = "info", duration = 5000, icon = null, appSource = null) {
    os.notify.send(title, message, { type, duration, icon, appSource });
  }

  updateTransparency() {
    this.utils.updateTransparency();
  }

  updateTaskbarAlignment() {
    this.taskbarSystem.updateTaskbarAlignment();
  }

  resolveIconType(iconValue) {
    return this.utils.resolveIconType(iconValue);
  }

  getFaviconLink() {
    return this.utils.getFaviconLink();
  }

  animateAndRemove(win) {
    this.windowStateManager.animateAndRemove(win);
  }

  buildPropertiesWindow(winId) {
    this.contextMenuManager.buildPropertiesWindow(winId);
  }

  buildContextMenuItems(addMenuItem, addSeparator, win) {
    this.contextMenuManager.buildContextMenuItems(addMenuItem, addSeparator, win);
  }

  getOpenWindowCount() {
    return this.utils.getOpenWindowCount();
  }

  getWindowNormalGeometry(win) {
    return this.utils.getWindowNormalGeometry(win);
  }

  createWindow(id, title, width = "80vw", height = "80vh", isGame = false, initialOptions = {}) {
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
    const pendingOpts = this.pendingLaunchOptions || {};
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

    if (mobileFullscreen) {
      Object.assign(win.style, {
        width: "100vw",
        height: "calc(100vh - var(--taskbar-h))",
        left: "0",
        top: "0",
        position: "fixed",
        zIndex: this.nextWindowZIndex()
      });
    } else {
      Object.assign(win.style, {
        width: `${finalW}px`,
        height: `${finalH}px`,
        left: `${position.left}px`,
        top: `${position.top}px`,
        position: disableDesktopStretchScroll ? "fixed" : "absolute",
        zIndex: this.nextWindowZIndex()
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

  calculateWindowPosition(windowWidth, windowHeight, options = {}) {
    return this.layoutManager.calculateWindowPosition(windowWidth, windowHeight, options);
  }

  getScreenBounds() {
    return this.layoutManager.getScreenBounds();
  }

  getTaskbarHeight() {
    return this.layoutManager.getTaskbarHeight();
  }

  getCenteredPosition(windowWidth, windowHeight) {
    return this.layoutManager.getCenteredPosition(windowWidth, windowHeight);
  }

  getCascadePosition(windowWidth, windowHeight, workspace) {
    return this.layoutManager.getCascadePosition(windowWidth, windowHeight, workspace);
  }

  isTilingEnabled() {
    return this.tilingManager?.enabled ?? false;
  }

  setTilingEnabled(enabled) {
    this.tilingManager?.toggleMode(enabled);
  }

  onTilingWindowCreated(winId) {
    this.tilingManager?.onWindowCreated(winId);
  }

  mountWindow(win, winId, title, iconValue, color = null) {
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

  nextWindowZIndex() {
    if (this.zIndexCounter > 5000) {
      this.normalizeWindowZIndexes();
    }
    return this.zIndexCounter++;
  }

  normalizeWindowZIndexes() {
    const wins = Array.from(this.openWindows.keys())
      .map((id) => document.getElementById(id))
      .filter(Boolean)
      .sort((a, b) => (parseInt(a.style.zIndex, 10) || 0) - (parseInt(b.style.zIndex, 10) || 0));
    let z = 1000;
    wins.forEach((w) => {
      w.style.zIndex = String(z++);
    });
    this.zIndexCounter = z;
  }

  getWindowIconHtml(iconValue, color = null) {
    return this.utils.getWindowIconHtml(iconValue, color);
  }

  buildTaskbarIcon(iconValue, title, color) {
    return this.taskbarSystem.buildTaskbarIcon(iconValue, title, color);
  }

  addToTaskbar(winId, title, iconValue, color = null) {
    this.taskbarSystem.addToTaskbar(winId, title, iconValue, color);
    if (this.macDock.isActive()) {
      this.macDock.addItem(winId, iconValue, title, color);
    }
    if (this.chromeShelf && this.chromeShelf.el) {
      this.chromeShelf.addRunningItem(winId, iconValue, title);
    }
  }

  scheduleHideTaskbarPreview() {
    this.taskbarSystem.scheduleHideTaskbarPreview();
  }

  hideTaskbarPreview() {
    this.taskbarSystem.hideTaskbarPreview();
  }

  showTaskbarPreview(winId, anchorEl) {
    this.taskbarSystem.showTaskbarPreview(winId, anchorEl);
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

  initVisibilityTracking() {
    this.utils.initVisibilityTracking();
  }

  bringToFront(win) {
    this.windowStateManager.bringToFront(win);
  }

  removeFromTaskbar(winId) {
    this.taskbarSystem.removeFromTaskbar(winId);
    this.macDock.removeItem(winId);
  }

  minimizeWindow(win) {
    this.windowStateManager.minimizeWindow(win);
  }

  toggleFullscreen(win) {
    this.windowStateManager.toggleFullscreen(win);
  }

  updateWindowHeaderStyles() {
    const isMac = os.storage.get(StorageKeys.macOsControls) === "true";
    this.openWindows.forEach((entry, winId) => {
      const win = document.getElementById(winId);
      if (!win) return;
      const header = win.querySelector(".window-header");
      if (!header) return;
      const controls = header.querySelector(".window-controls");
      if (!controls) return;
      const hasExternal = !!controls.querySelector(".external-btn");
      const showDownload = !!controls.querySelector(".download-btn");
      header.classList.toggle("mac-header", isMac);
      controls.outerHTML = this.utils.getWindowControls(hasExternal ? "external" : null, showDownload);
    });
    this.openWindows.forEach((entry, winId) => {
      const win = document.getElementById(winId);
      if (win) this.setupWindowControls(win);
    });
  }

  setupWindowControls(win) {
    setupWindowControls(win, this);
  }

  silenceWindow(win) {
    this.windowStateManager.silenceWindow(win);
  }

  showWindowContextMenu(e, win) {
    this.contextMenuManager.showWindowContextMenu(e, win);
  }

  initSnapGhost() {
    this.snapSystem.initSnapGhost();
  }

  makeDraggable(win) {
    this.snapSystem.makeDraggable(win);
  }

  getSnapZone(x, y) {
    return this.snapSystem.getSnapZone(x, y);
  }

  showSnapGhost(zone) {
    this.snapSystem.showSnapGhost(zone);
  }

  hideSnapGhost() {
    this.snapSystem.hideSnapGhost();
  }

  applySnap(win, zone) {
    this.snapSystem.applySnap(win, zone);
  }

  unsnap(win) {
    this.snapSystem.unsnap(win);
  }

  makeResizable(win, setHeightUnsetElement = null) {
    windowMakeResizable(win, this, setHeightUnsetElement);
  }

  downloadWindowContent(win) {
    this.utils.downloadWindowContent(win);
  }

  getWindowControls(externalUrl, showDownload) {
    return this.utils.getWindowControls(externalUrl, showDownload);
  }

  sendNotify(text, appSource = null) {
    os.notify.send(text, "", { appSource });
  }

  isWindowPinned(winId) {
    return this.taskbarSystem.isWindowPinned(winId);
  }

  getPinnedItems() {
    return this.taskbarSystem.getPinnedItems();
  }

  savePinnedItems(pinnedItems) {
    this.taskbarSystem.savePinnedItems(pinnedItems);
  }

  pinToTaskbar(winId) {
    this.taskbarSystem.pinToTaskbar(winId);
  }

  unpinFromTaskbar(winId) {
    this.taskbarSystem.unpinFromTaskbar(winId);
  }

  renderPinnedItems() {
    this.taskbarSystem.renderPinnedItems();
  }

  findAppIdByWinId(winId) {
    return this.utils.findAppIdByWinId(winId);
  }

  closeWindow(win) {
    if (typeof win === "string") {
      win = document.getElementById(win);
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

  closeAll() {
    this.windowStateManager.closeAll();
  }

  restorePinnedItems() {
    this.taskbarSystem.restorePinnedItems();
  }

  setWindowTitle(winId, title) {
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

  getWindowTitle(winId) {
    const entry = this.openWindows.get(winId);
    return entry?.title ?? null;
  }
}
