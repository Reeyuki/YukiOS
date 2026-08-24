import { audioMixer } from "./audioMixer.js";
import { mediaTray } from "./mediaTray.js";
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

import { AppRestorationService } from "./windowManager/AppRestorationService.js";
import { WindowStateManager } from "./windowManager/WindowStateManager.js";
import { ContextMenuManager } from "./windowManager/ContextMenuManager.js";
import { WindowManagerUtils } from "./windowManager/WindowManagerUtils.js";
import { HEADER_STYLES, resolveHeaderStyleId } from "./windowManager/headerStyles.js";
import { TilingManager } from "./modes/tiling/TilingManager.js";
import { StorageKeys, os, MODES } from "./framework.js";
import { $, createElement } from "./shared/domUtils.js";
import { isMobile } from "./shared/platformUtils.js";

export class WindowManager {
  constructor(notificationCenter = null) {
    this.openWindows = new Map();
    this.zIndexCounter = 1000;
    this.gameWindowCount = 0;
    this.isDraggingWindow = false;
    this.notificationCenter = notificationCenter;
    this.initialTitle = document.title || "YukiOS";
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
    this.appRestorationService = new AppRestorationService(this);
    this.windowStateManager = new WindowStateManager(this);
    this.contextMenuManager = new ContextMenuManager(this);
    this.utils = new WindowManagerUtils(this);
    this.appliedHeaderStyleId = resolveHeaderStyleId();

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
      const wasActive = !!$("#mac-dock");
      const nowActive = this.macDock.isActive();
      if (nowActive && !wasActive) {
        this.macDock.init();
      } else if (!nowActive && wasActive) {
        this.macDock.destroy();
      } else if (nowActive && wasActive) {
        this.macDock.onSettingsChanged();
      }
      const headerStyleChanged = this.appliedHeaderStyleId !== resolveHeaderStyleId();
      if (wasActive !== nowActive || headerStyleChanged) {
        this.updateWindowHeaderStyles();
      }
    });

    bus.on(BusEvents.MODE_ENTERED, ({ id }) => {
      if (id === MODES.CHROME_OS) {
        this.chromeShelf.init();
        $("#taskbar")?.classList.add("chromeos-active");
      }
    });

    bus.on(BusEvents.MODE_EXITED, ({ id }) => {
      if (id === MODES.CHROME_OS) {
        this.chromeShelf.destroy();
        $("#taskbar")?.classList.remove("chromeos-active");
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
      mediaTray().init();
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
    return this.appRestorationService.guessAppIdFromWinId(winId);
  }

  saveSession() {
    return this.appRestorationService.saveSession();
  }

  restoreSession() {
    return this.appRestorationService.restoreSession();
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

    const win = createElement("div");
    win.className = "window";
    win.dataset.fullscreen = "false";

    let winId = options.forceId || id;
    if ($("#" + winId)) {
      let counter = 1;
      while ($(`#${winId}-${counter}`)) {
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
    } else if (options.deckMode) {
      Object.assign(win.dataset, {
        prevWidth: win.style.width,
        prevHeight: win.style.height,
        prevLeft: win.style.left,
        prevTop: win.style.top,
        prevZIndex: win.style.zIndex
      });
      Object.assign(win.style, {
        width: "100vw",
        height: "100vh",
        left: "0",
        top: "0",
        position: "fixed",
        zIndex: this.nextWindowZIndex()
      });
      win.dataset.fullscreen = "true";
      win.classList.add("deck-launched");
      const deckEntry = this.openWindows.get(win.id);
      if (deckEntry?.record) deckEntry.record.fullscreen = true;
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

  mountWindow(win, winId, title, iconValue, color = null, opts = {}) {
    const mountTarget = opts.mountTarget || document.body;
    if (!document.body.contains(win)) {
      mountTarget.appendChild(win);
    }
    this.makeDraggable(win);
    this.makeResizable(win);
    if (iconValue) this.addToTaskbar(winId, title, iconValue, color);
    this.onTilingWindowCreated(winId);
    if (opts.autoFocus !== false) this.bringToFront(win);
    requestAnimationFrame(() => animateWindowOpen(win));
    if (opts.bindControls !== false) this.bindWindowControlsWhenReady(win);
    win.addEventListener("remove", () => this.removeFromTaskbar(win.id));
  }

  bindWindowControlsWhenReady(win) {
    const hasControls = () => win.querySelector(".window-header, .browser-tabbar, .app-menubar");
    if (hasControls()) {
      this.setupWindowControls(win);
      return;
    }
    const observer = new MutationObserver(() => {
      if (hasControls()) {
        observer.disconnect();
        this.setupWindowControls(win);
      }
    });
    observer.observe(win, { childList: true, subtree: true });
    win.addEventListener("remove", () => observer.disconnect());
  }

  nextWindowZIndex() {
    if (this.zIndexCounter > 5000) {
      this.normalizeWindowZIndexes();
    }
    return this.zIndexCounter++;
  }

  normalizeWindowZIndexes() {
    const wins = Array.from(this.openWindows.keys())
      .map((id) => $("#" + id))
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

  registerWindow(winId, entry) {
    this.openWindows.set(winId, entry);
    this.workspaceManager?.registerWindow(winId);
    audioMixer().registerWindow(winId, entry.title, audioMixer().getIconHtmlForTaskbar(null, entry.iconValue));
  }

  unregisterWindow(winId) {
    if (!this.openWindows.has(winId)) return;
    const win = $("#" + winId);
    const entry = this.openWindows.get(winId);

    const taskbarItem = $("#taskbar-" + winId);
    if (taskbarItem) taskbarItem.remove();

    if (entry && entry.record) {
      const appId = (win && win.dataset.appId) || this.guessAppIdFromWinId(winId);
      if (appId) {
        try {
          const geom = win ? this.getWindowNormalGeometry(win) : entry.record;
          os.storage.set(`${StorageKeys.geometryPrefix}${appId}`, {
            x: geom.x,
            y: geom.y,
            width: geom.width,
            height: geom.height
          });
        } catch (e) {}
      }
    }

    this.openWindows.delete(winId);
    this.workspaceManager?.unregisterWindow(winId);
    audioMixer().unregisterWindow(winId);
    os.events.emit(BusEvents.WINDOW_CLOSED, { winId });

    if (this.openWindows.size === 0) {
      this.utils.resetToDefaultState();
    } else {
      const lastWin = Array.from(this.openWindows.values()).pop();
      if (lastWin) this.utils.updatePageFavicon(lastWin.iconValue, lastWin.title);
    }
    this.triggerSessionSave();
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
    this.unregisterWindow(winId);
    this.macDock.removeItem(winId);
  }

  minimizeWindow(win) {
    this.windowStateManager.minimizeWindow(win);
  }

  toggleFullscreen(win) {
    this.windowStateManager.toggleFullscreen(win);
  }

  updateWindowHeaderStyles() {
    const styleId = resolveHeaderStyleId();
    this.appliedHeaderStyleId = styleId;
    const nextHeaderClass = HEADER_STYLES[styleId].headerClass;
    const allHeaderClasses = Object.values(HEADER_STYLES)
      .map((style) => style.headerClass)
      .filter(Boolean);
    this.openWindows.forEach((entry, winId) => {
      const win = $("#" + winId);
      if (!win) return;
      const header = win.querySelector(".window-header");
      if (!header) return;
      const controls = header.querySelector(".window-controls");
      if (!controls) return;
      const hasExternal = !!controls.querySelector(".external-btn");
      const showDownload = !!controls.querySelector(".download-btn");
      allHeaderClasses.forEach((cls) => header.classList.remove(cls));
      if (nextHeaderClass) header.classList.add(nextHeaderClass);
      controls.outerHTML = this.utils.getWindowControls(hasExternal ? "external" : null, showDownload);
    });
    this.openWindows.forEach((entry, winId) => {
      const win = $("#" + winId);
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
      win = $("#" + win);
    }
    if (!win) return;
    if (os.tray.isRegistered(win.id)) {
      os.tray.sendToTray(win.id);
      return;
    }
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
    const win = $("#" + winId);
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
