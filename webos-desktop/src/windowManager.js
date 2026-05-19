import { StorageKeys } from "./settings.js";
import { showStartStyleMenu } from "./shared/contextMenu.js";
import { isImageFile } from "./utils.js";
import { audioMixer } from "./audioMixer.js";
import { resolveIconUrl } from "./assetUrl.js";
import { toggleStartMenu } from "./startMenu.js";
import { WorkspaceManager } from "./windowManager/WorkspaceManager.js";
import {
  makeDraggable,
  _getSnapZone,
  _showSnapGhost,
  _hideSnapGhost,
  _applySnap,
  _unsnap
} from "./windowManager/makeDraggable.js";
import { makeResizable } from "./windowManager/makeResizable.js";
import { setupWindowControls } from "./windowManager/windowControls.js";
import { notify, sendNotify } from "./windowManager/notificationBridge.js";
import { updateTransparency } from "./windowManager/transparencyManager.js";
import { bus, BusEvents } from "./core/EventBus.js";
import { WindowRecord } from "./core/WindowRecord.js";

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
    this._initSnapGhost();
    this._initVisibilityTracking();
    this.workspaceManager = new WorkspaceManager(this);
    this._lastFocusZone = "desktop";
    this._initStartMenuKeybinds();
    this.fs = null;
    this.appLauncher = null;
    this._sessionSaveTimer = null;
    this._isRestoring = false;

    bus.on(BusEvents.SETTINGS_CHANGED, () => {
      this.updateTransparency();
      this.updateTaskbarAlignment();
    });

    setTimeout(() => {
      audioMixer.init();
    }, 0);
    document.addEventListener("keydown", (e) => {
      if (
        e.key.toLowerCase() === "d" &&
        e.metaKey === false &&
        e.ctrlKey === false &&
        e.altKey === false &&
        e.shiftKey === false &&
        e.getModifierState("Meta") === false &&
        e.getModifierState("Control") === false &&
        e.getModifierState("Alt") === false &&
        e.getModifierState("Shift") === false &&
        e.getModifierState("OS")
      )
        return;
      if (e.key.toLowerCase() === "d" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();

        const allWindows = Array.from(this.openWindows.keys())
          .map((id) => document.getElementById(id))
          .filter(Boolean);

        const anyVisible = allWindows.some((w) => w.style.display !== "none");

        if (anyVisible) {
          allWindows.forEach((win) => this.minimizeWindow(win));
        } else {
          allWindows.forEach((win) => {
            win.style.display = "block";
            const taskbarItem = document.getElementById(`taskbar-${win.id}`);
            if (taskbarItem) taskbarItem.classList.remove("minimized");
          });
        }
      }
    });
    document.addEventListener("keydown", (e) => {
      if (!e.metaKey && !e.ctrlKey) return;
      const focused = Array.from(this.openWindows.keys())
        .map((id) => document.getElementById(id))
        .filter(Boolean)
        .sort((a, b) => parseInt(b.style.zIndex) - parseInt(a.style.zIndex))[0];
      if (!focused) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        this._applySnap(focused, "left");
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        this._applySnap(focused, "right");
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        this._applySnap(focused, "maximize");
      }
    });

    this._lastSpawnedPosition = null;
    this._lastSpawnTime = 0;
  }

  _initStartMenuKeybinds() {
    document.addEventListener(
      "pointerdown",
      (e) => {
        const target = e.target;
        if (target?.closest?.(".window")) this._lastFocusZone = "window";
        else if (target?.closest?.("#start-menu")) this._lastFocusZone = "start-menu";
        else this._lastFocusZone = "desktop";

        if (this._lastFocusZone === "desktop") {
          this.openWindows.forEach(({ taskbarItem }) => taskbarItem?.classList?.remove("active"));
        }
      },
      { capture: true }
    );

    document.addEventListener("keydown", (e) => {
      if (!this._shouldOpenStartMenuFromKeyEvent(e)) return;
      e.preventDefault();
      toggleStartMenu({ focusSearch: true, openDefaultPage: true });
    });
  }

  _shouldOpenStartMenuFromKeyEvent(e) {
    const key = e.key;
    const isTrigger = key === "Control" || key === "Tab" || key === " " || key === "Spacebar";
    if (!isTrigger) return false;

    const otherMods = e.altKey || e.metaKey || e.shiftKey;
    if (otherMods) return false;

    if (key !== "Control" && e.ctrlKey) return false;

    const active = document.activeElement;
    if (active) {
      const tag = active.tagName;
      const isEditable = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || active.isContentEditable === true;
      if (isEditable) return false;
      if (tag === "IFRAME") return false;
      if (active.closest?.(".window")) return false;
      if (active.closest?.("#start-menu")) return false;
    }

    if (this._lastFocusZone !== "desktop") return false;

    const anyWindowActive = Array.from(this.openWindows.values()).some((v) =>
      v.taskbarItem?.classList?.contains("active")
    );
    if (anyWindowActive) return false;

    return true;
  }

  applyWindowLayout(win) {
    const root = win.querySelector(".browser-root");
    if (!root) return;

    const header = win.querySelector(".window-header");
    const tabbar = root.querySelector(".browser-tabbar");

    if (!header || !tabbar) return;

    const controls = header.querySelector(".window-controls");
    if (!controls) return;

    tabbar.appendChild(controls);

    header.style.display = "none";

    controls.style.marginLeft = "auto";
    controls.style.display = "flex";
    controls.style.alignItems = "center";
    controls.style.height = "100%";
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
    if (this._isRestoring) return;
    if (this._sessionSaveTimer) clearTimeout(this._sessionSaveTimer);
    this._sessionSaveTimer = setTimeout(() => this.saveSession(), 500);
  }

  _guessAppIdFromWinId(winId) {
    if (!winId) return null;
    const mappings = {
      taskmanager: "taskManagerApp",
      "profile-customizer": "profileCustomizer",
      office: "officeApp",
      emulator: "emulatorApp",
      calculator: "calculatorApp",
      ruffle: "ruffleApp",
      markdown: "markdown",
      youtube: "youtube",
      news: "newsApp",
      weather: "weatherApp",
      notepad: "notepad",
      model3d: "model3dApp",
      settings: "settingsApp",
      "system-apps": "systemApps",
      about: "aboutApp",
      achievements: "achievementsApp",
      explorer: "explorer",
      monaco: "monaco",
      "app-creator": "appCreatorApp",
      jsdos: "jsDosApp",
      v86: "v86app",
      browser: "browserApp",
      terminal: "terminal",
      camera: "cameraApp"
    };
    const lowerId = winId.toLowerCase();
    for (const [key, appId] of Object.entries(mappings)) {
      if (lowerId.includes(key)) return appId;
    }
    return null;
  }

  async saveSession() {
    if (!this.fs || !this.fs.sessionKey) return;
    const sessionKey = this.fs.sessionKey;
    const sessionPath = `/ys/users/${sessionKey}/system/windowSession.json`;

    const persistenceEnabled = localStorage.getItem(StorageKeys.windowSessionPersistence) !== "false";
    if (!persistenceEnabled) {
      try {
        const exists = await this.fs.exists(sessionPath);
        if (exists) {
          await this.fs.unlink(sessionPath);
        }
      } catch (e) {}
      return;
    }

    const windowStates = [];
    const sortedWindows = Array.from(this.openWindows.keys())
      .map((id) => document.getElementById(id))
      .filter(Boolean)
      .sort((a, b) => (parseInt(a.style.zIndex) || 0) - (parseInt(b.style.zIndex) || 0));

    for (const win of sortedWindows) {
      const entry = this.openWindows.get(win.id);
      if (!entry || !entry.record) continue;

      const record = entry.record;
      const rect = win.getBoundingClientRect();
      record.x = parseInt(win.style.left) || rect.left;
      record.y = parseInt(win.style.top) || rect.top;
      record.width = parseInt(win.style.width) || rect.width;
      record.height = parseInt(win.style.height) || rect.height;
      record.zIndex = parseInt(win.style.zIndex) || 1000;
      record.minimized = win.style.display === "none";
      record.fullscreen = win.dataset.fullscreen === "true";
      record.focused = win.classList.contains("active");

      const content = win.querySelector(".window-content");
      if (content) {
        record.scrollPosition = { x: content.scrollLeft, y: content.scrollTop };
      }

      const appId = win.dataset.appId || this._guessAppIdFromWinId(win.id);
      if (appId && !win.dataset.appId) win.dataset.appId = appId;
      if (appId && this.appLauncher) {
        try {
          localStorage.setItem(
            `${StorageKeys.geometryPrefix}${appId}`,
            JSON.stringify({
              x: record.x,
              y: record.y,
              width: record.width,
              height: record.height
            })
          );
        } catch (e) {}

        const appInstance = this.appLauncher[appId] || this.appLauncher[`${appId}App`];
        if (appInstance && typeof appInstance.getSnapshot === "function") {
          try {
            record.appStateSnapshot = await appInstance.getSnapshot(win.id);
          } catch (e) {
            console.warn(`Failed to get snapshot for app ${appId}:`, e);
          }
        }
      }

      if (this.workspaceManager) {
        let wsId = 0;
        for (const ws of this.workspaceManager.workspaces) {
          if (ws.windows.has(win.id)) {
            wsId = ws.id;
            break;
          }
        }
        record.workspaceId = wsId;
      }

      windowStates.push(record.toJSON());
    }

    try {
      await this.fs.ensureFolder(["system"]);
      let sessionData = windowStates;
      if (this.workspaceManager) {
        sessionData = {
          windows: windowStates,
          workspaces: this.workspaceManager.workspaces.map((w) => ({ id: w.id, name: w.name })),
          activeWorkspaceId: this.workspaceManager.activeId
        };
      }
      await this.fs.safeWriteFile(sessionPath, JSON.stringify(sessionData));
    } catch (e) {
      console.error("Failed to save window session:", e);
    }
  }

  async restoreSession() {
    if (!this.fs || !this.fs.sessionKey || !this.appLauncher) return;
    const persistenceEnabled = localStorage.getItem(StorageKeys.windowSessionPersistence) !== "false";
    if (!persistenceEnabled) return;
    this._isRestoring = true;
    const sessionKey = this.fs.sessionKey;
    const sessionPath = `/ys/users/${sessionKey}/system/windowSession.json`;

    try {
      const exists = await this.fs.exists(sessionPath);
      if (!exists) {
        this._isRestoring = false;
        return;
      }

      const data = await this.fs.pRead("readFile", sessionPath, "utf8");
      const parsedData = JSON.parse(data);

      let windowStates = [];
      if (Array.isArray(parsedData)) {
        windowStates = parsedData;
      } else {
        windowStates = parsedData.windows || [];
        if (this.workspaceManager && parsedData.workspaces) {
          this.workspaceManager.workspaces = parsedData.workspaces.map((w) => ({ ...w, windows: new Set() }));
          this.workspaceManager.activeId = parsedData.activeWorkspaceId || 0;
          this.workspaceManager._render();
        }
      }

      if (!Array.isArray(windowStates)) {
        this._isRestoring = false;
        return;
      }

      let heavyAppCount = 0;
      const queue = [];

      for (const state of windowStates) {
        const appId = state.appId || this._guessAppIdFromWinId(state.id);
        if (!appId) continue;

        if (this._isHeavyApp(appId, state.appType)) {
          heavyAppCount++;
          if (heavyAppCount > 4) {
            queue.push({ state, appId });
            continue;
          }
        }
        await this._restoreSingleWindowState(state, appId);
      }

      if (queue.length > 0) {
        this._processRestorationQueue(queue);
      }

      const lastFocused = windowStates.find((s) => s.focused);
      if (lastFocused) {
        const win = document.getElementById(lastFocused.id);
        if (win) this.bringToFront(win);
      }
    } catch (e) {
      console.error("Failed to restore window session:", e);
    } finally {
      this._isRestoring = false;
    }
  }

  _isHeavyApp(appId, appType) {
    const heavyTypes = ["game", "swf", "gba", "psp", "nds", "megadrive", "genesis", "segaMD"];
    const heavySystemApps = [
      "v86",
      "v86app",
      "jsdos",
      "jsDosApp",
      "emulator",
      "emulatorApp",
      "ruffle",
      "ruffleApp",
      "youtube",
      "browser",
      "browserApp",
      "model3d",
      "model3dApp"
    ];
    if (heavyTypes.includes(appType)) return true;
    if (heavySystemApps.includes(appId)) return true;
    return false;
  }

  async _processRestorationQueue(queue) {
    for (const item of queue) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await this._restoreSingleWindowState(item.state, item.appId);
    }
  }

  async _restoreSingleWindowState(state, appId) {
    try {
      const launchOptions = {
        forceId: state.id,
        position: { x: state.x, y: state.y },
        width: state.width,
        height: state.height,
        allowManualPosition: true
      };

      await this.appLauncher.launch(appId, state.appType === "swf", launchOptions);

      const win = document.getElementById(state.id);
      if (win) {
        if (state.minimized) this.minimizeWindow(win);
        if (state.fullscreen) this.toggleFullscreen(win);
        win.style.zIndex = state.zIndex;
        this.zIndexCounter = Math.max(this.zIndexCounter, state.zIndex + 1);

        if (this.workspaceManager && state.workspaceId !== undefined) {
          this.workspaceManager.moveWindowTo(state.id, state.workspaceId);
        }

        if (state.appStateSnapshot) {
          const appInstance = this.appLauncher[state.appId] || this.appLauncher[`${state.appId}App`];
          if (appInstance && typeof appInstance.restoreSnapshot === "function") {
            await appInstance.restoreSnapshot(win.id, state.appStateSnapshot);
          }
        }

        if (state.scrollPosition) {
          const content = win.querySelector(".window-content");
          if (content) {
            content.scrollLeft = state.scrollPosition.x;
            content.scrollTop = state.scrollPosition.y;
          }
        }
      }
    } catch (e) {
      console.error(`Failed to restore window ${state.id}:`, e);
    }
  }

  notify(title, message, type = "info", duration = 5000, icon = null) {
    notify(this, title, message, type, duration, icon);
  }

  updateTransparency() {
    updateTransparency(this);
  }

  updateTaskbarAlignment() {
    const taskbarWindows = document.getElementById("taskbar-windows");
    if (taskbarWindows) {
      const taskbarAlignment = localStorage.getItem(StorageKeys.taskbarAlignment) || "center";
      const taskbar = document.getElementById("taskbar");

      if (taskbar) {
        const isHorizontal =
          taskbar.classList.contains("position-bottom") || taskbar.classList.contains("position-top");

        if (isHorizontal) {
          if (taskbarAlignment === "left") {
            taskbarWindows.style.justifyContent = "flex-start";
          } else if (taskbarAlignment === "center") {
            taskbarWindows.style.justifyContent = "center";
          } else if (taskbarAlignment === "right") {
            taskbarWindows.style.justifyContent = "flex-end";
          }
        } else {
          if (taskbarAlignment === "left") {
            taskbarWindows.style.alignItems = "flex-start";
          } else if (taskbarAlignment === "center") {
            taskbarWindows.style.alignItems = "center";
          } else if (taskbarAlignment === "right") {
            taskbarWindows.style.alignItems = "flex-end";
          }
        }
      }
    }
  }

  _resolveIconType(iconValue) {
    const isDataUrl = typeof iconValue === "string" && iconValue.startsWith("data:");
    const isHttpUrl = typeof iconValue === "string" && /^https?:\/\//.test(iconValue);
    return {
      isImage: isImageFile(iconValue) || isHttpUrl,
      isDataUrl
    };
  }

  _getFaviconLink() {
    let link = document.querySelector("link[rel~='icon']");
    return link;
  }

  _animateAndRemove(win) {
    const performanceMode = localStorage.getItem(StorageKeys.performanceMode) || "high";
    if (performanceMode === "performance") {
      win.remove();
    } else if (performanceMode === "balanced") {
      win.style.animation = "popUp 0.15s ease forwards";
      setTimeout(() => win.remove(), 150);
    } else {
      win.style.animation = "popUp 0.5s ease forwards";
      setTimeout(() => win.remove(), 500);
    }
  }
  _buildPropertiesWindow(winId) {
    const win = document.getElementById(winId);
    if (!win) return;

    const appInfo = this.openWindows.get(winId);
    if (!appInfo) return;

    const content = win.querySelector(".window-content");
    if (!content) return;

    const existingOverlay = win.querySelector(":scope > .window-props-overlay");
    if (existingOverlay) {
      try {
        existingOverlay.remove();
      } finally {
        content.style.display = content.dataset.prevDisplay || "";
        delete content.dataset.prevDisplay;
      }
    }

    const dataset = win.dataset;
    const rect = win.getBoundingClientRect();

    const info = {
      identity: [
        ["Window ID", winId],
        ["Title", appInfo.title],
        ["Type", dataset.appType || "—"],
        ["App ID", dataset.appId || "—"],
        ["URL", dataset.externalUrl || "—"]
      ],
      geometry: [
        ["Width", `${Math.round(rect.width)}px`],
        ["Height", `${Math.round(rect.height)}px`],
        ["Left", `${Math.round(rect.left)}px`],
        ["Top", `${Math.round(rect.top)}px`]
      ],
      system: [
        ["Z-Index", win.style.zIndex || "—"],
        ["Fullscreen", dataset.fullscreen === "true" ? "Yes" : "No"],
        ["SWF", dataset.swf || "—"],
        ["ROM", dataset.rom || "—"],
        ["Core", dataset.core || "—"]
      ]
    };

    const buildSection = (title, rows) => `
    <div class="props-section">
      <div class="props-section-title">${title}</div>
      ${rows
        .map(
          ([k, v]) => `
        <div class="props-row">
          <div class="props-key">${k}</div>
          <div class="props-val">${v}</div>
        </div>
      `
        )
        .join("")}
    </div>
  `;

    const overlayHtml = `
    <style>
      .window-props-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        background: rgba(12, 12, 16, 0.96);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        z-index: 9999;
      }

      .window-props-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 12px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        user-select: none;
      }

      .window-props-title {
        font-size: 13px;
        color: rgba(255,255,255,0.9);
        font-weight: 600;
      }

      .window-props-close {
        border: 1px solid rgba(255,255,255,0.15);
        background: rgba(255,255,255,0.06);
        color: rgba(255,255,255,0.9);
        padding: 6px 10px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 12px;
      }

      .window-props-close:hover {
        background: rgba(255,255,255,0.1);
      }

      .props-content {
        padding: 12px;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        color: #e6e6e6;
        display: flex;
        flex-direction: column;
        gap: 12px;
        overflow: auto;
      }

      .props-section {
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 10px;
        padding: 10px;
      }

      .props-section-title {
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(255,255,255,0.6);
        margin-bottom: 8px;
      }

      .props-row {
        display: flex;
        justify-content: space-between;
        font-size: 13px;
        padding: 4px 0;
        border-bottom: 1px solid rgba(255,255,255,0.04);
      }

      .props-row:last-child {
        border-bottom: none;
      }

      .props-key {
        color: rgba(255,255,255,0.6);
      }

      .props-val {
        color: #fff;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        text-align: right;
        max-width: 60%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    </style>

    <div class="window-props-header">
      <div class="window-props-title">Properties</div>
      <button type="button" class="window-props-close">Close</button>
    </div>
    <div class="props-content">
      ${buildSection("Identity", info.identity)}
      ${buildSection("Geometry", info.geometry)}
      ${buildSection("System", info.system)}
    </div>
  `;

    const overlay = document.createElement("div");
    overlay.className = "window-props-overlay";
    overlay.innerHTML = overlayHtml;

    if (!content.dataset.prevDisplay) content.dataset.prevDisplay = content.style.display || "";
    content.style.display = "none";

    win.appendChild(overlay);
    overlay.querySelector(".window-props-close")?.addEventListener("click", () => {
      try {
        overlay.remove();
      } finally {
        content.style.display = content.dataset.prevDisplay || "";
        delete content.dataset.prevDisplay;
      }
    });
  }
  _buildContextMenuItems(addMenuItem, addSeparator, win) {
    const winId = win.id;
    const isMinimized = win.style.display === "none";
    const isFullscreen = win.dataset.fullscreen === "true";

    addMenuItem(
      isMinimized ? "Restore" : "Minimize",
      () => {
        if (isMinimized) win.style.display = "block";
        else this.minimizeWindow(win);
        this.bringToFront(win);
      },
      isMinimized ? "fa-window-restore" : "fa-window-minimize"
    );

    addMenuItem(
      isFullscreen ? "Restore Size" : "Maximize",
      () => {
        this.toggleFullscreen(win);
        this.bringToFront(win);
      },
      isFullscreen ? "fa-compress" : "fa-window-maximize"
    );

    addMenuItem("Bring to Front", () => this.bringToFront(win), "fa-layer-group");

    addSeparator();

    addMenuItem("Snap Left", () => this._applySnap(win, "left"), "fa-columns");
    addMenuItem("Snap Right", () => this._applySnap(win, "right"), "fa-columns");
    addMenuItem("Snap Maximize", () => this._applySnap(win, "maximize"), "fa-expand-arrows-alt");

    addSeparator();

    if (this.workspaceManager && this.workspaceManager.workspaces.length > 1) {
      this.workspaceManager.workspaces.forEach((ws) => {
        if (ws.id !== this.workspaceManager.activeId) {
          addMenuItem(
            `Move to ${ws.name}`,
            () => {
              this.workspaceManager.moveWindowTo(winId, ws.id);
            },
            "fa-exchange-alt"
          );
        }
      });
      addSeparator();
    }

    addMenuItem("Properties", () => this._buildPropertiesWindow(winId), "fa-info-circle");

    addSeparator();

    const isPinned = this._isWindowPinned(winId);
    addMenuItem(
      isPinned ? "Unpin from Taskbar" : "Pin to Taskbar",
      () => {
        if (isPinned) this._unpinFromTaskbar(winId);
        else this._pinToTaskbar(winId);
      },
      isPinned ? "fa-thumbtack" : "fa-thumbtack"
    );

    addSeparator();

    addMenuItem(
      "Close Window",
      () => {
        const winToClose = document.getElementById(winId);
        if (winToClose) {
          this._silenceWindow(winToClose);
          this.removeFromTaskbar(winId);
          this._animateAndRemove(winToClose);
        }
      },
      "fa-times-circle"
    );
  }

  getOpenWindowCount() {
    return this.openWindows.size;
  }

  createWindow(id, title, width = "80vw", height = "80vh", isGame = false, initialOptions = {}) {
    const pendingOpts = this._pendingLaunchOptions || {};
    const options = { ...pendingOpts, ...initialOptions };
    this._pendingLaunchOptions = null;

    const win = document.createElement("div");
    win.className = "window";
    win.id = id;
    win.dataset.fullscreen = "false";
    if (options.appId) win.dataset.appId = options.appId;
    if (options.appType) win.dataset.appType = options.appType;

    const widthStr = width != null ? String(width) : "80vw";
    const heightStr = height != null ? String(height) : "80vh";

    const vw = widthStr.includes("vw") ? (window.innerWidth * parseFloat(widthStr)) / 100 : parseInt(widthStr);
    const vh = heightStr.includes("vh") ? (window.innerHeight * parseFloat(heightStr)) / 100 : parseInt(heightStr);

    let disableDesktopStretchScroll = false;
    try {
      disableDesktopStretchScroll = localStorage.getItem(StorageKeys.disableDesktopStretchScroll) === "true";
    } catch {}

    let finalW = vw;
    let finalH = vh;
    let position = this.calculateWindowPosition(vw, vh, options);

    if (options.forceId) {
      if (options.width != null) finalW = options.width;
      if (options.height != null) finalH = options.height;
      if (options.position) position = { left: options.position.x, top: options.position.y };
    } else if (options.appId) {
      try {
        const saved = localStorage.getItem(`${StorageKeys.geometryPrefix}${options.appId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed.x === "number" && typeof parsed.y === "number") {
            position = { left: parsed.x, top: parsed.y };
            if (parsed.width) finalW = parsed.width;
            if (parsed.height) finalH = parsed.height;
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
    const {
      position = "auto",
      workspace = this.workspaceManager?.activeId || "default",
      allowManualPosition = false
    } = options;

    if (allowManualPosition && position.x !== undefined && position.y !== undefined) {
      const bounds = this._getScreenBounds();
      return {
        left: Math.max(bounds.minX, Math.min(bounds.maxX - windowWidth, position.x)),
        top: Math.max(bounds.minY, Math.min(bounds.maxY - windowHeight, position.y))
      };
    }

    if (position === "center") {
      return this._getCenteredPosition(windowWidth, windowHeight);
    }

    if (typeof position === "object" && position.x !== undefined && position.y !== undefined) {
      const bounds = this._getScreenBounds();
      return {
        left: Math.max(bounds.minX, Math.min(bounds.maxX - windowWidth, position.x)),
        top: Math.max(bounds.minY, Math.min(bounds.maxY - windowHeight, position.y))
      };
    }

    return this._getCascadePosition(windowWidth, windowHeight, workspace);
  }

  _getScreenBounds() {
    const taskbarHeight = this._getTaskbarHeight();
    const padding = 20;

    return {
      minX: padding,
      minY: padding,
      maxX: window.innerWidth - padding,
      maxY: window.innerHeight - taskbarHeight - padding
    };
  }

  _getTaskbarHeight() {
    const taskbar = document.getElementById("taskbar");
    if (!taskbar) return 0;

    const rect = taskbar.getBoundingClientRect();
    const taskbarPosition = localStorage.getItem(StorageKeys.taskbarPosition) || "bottom";

    return taskbarPosition === "bottom" ? rect.height : 0;
  }

  _getCenteredPosition(windowWidth, windowHeight) {
    const bounds = this._getScreenBounds();

    return {
      left: bounds.minX + (bounds.maxX - bounds.minX - windowWidth) / 2,
      top: bounds.minY + (bounds.maxY - bounds.minY - windowHeight) / 2
    };
  }

  _getCascadePosition(windowWidth, windowHeight, workspace) {
    const bounds = this._getScreenBounds();
    const baseOffset = 30;
    const now = Date.now();

    this._lastSpawnTime = now;

    const windows = Array.from(document.querySelectorAll(".window")).filter(
      (win) => win.style.display !== "none" && win.style.visibility !== "hidden" && win.id !== "desktop"
    );

    if (windows.length === 0) {
      this._lastSpawnedPosition = null;
    }

    let referenceLeft = null;
    let referenceTop = null;

    if (this._lastSpawnedPosition) {
      referenceLeft = this._lastSpawnedPosition.left;
      referenceTop = this._lastSpawnedPosition.top;
    } else if (windows.length > 0) {
      const topWin = windows.reduce((prev, curr) => {
        const zPrev = parseInt(prev.style.zIndex) || 0;
        const zCurr = parseInt(curr.style.zIndex) || 0;
        return zCurr > zPrev ? curr : prev;
      });
      referenceLeft = parseFloat(topWin.style.left);
      referenceTop = parseFloat(topWin.style.top);
    }

    let targetLeft, targetTop;

    if (referenceLeft !== null && !isNaN(referenceLeft)) {
      targetLeft = referenceLeft + baseOffset;
      targetTop = referenceTop + baseOffset;
    } else {
      const screenCenterX = (bounds.minX + bounds.maxX) / 2;
      const screenCenterY = (bounds.minY + bounds.maxY) / 2;
      targetLeft = screenCenterX - windowWidth / 2;
      targetTop = screenCenterY - windowHeight / 2;
    }

    if (targetLeft + 150 > bounds.maxX || targetTop + 100 > bounds.maxY) {
      targetLeft = bounds.minX + 60;
      targetTop = bounds.minY + 60;
    }

    const finalPos = {
      left: Math.max(bounds.minX, Math.min(bounds.maxX - windowWidth, targetLeft)),
      top: Math.max(bounds.minY, Math.min(bounds.maxY - windowHeight, targetTop))
    };

    this._lastSpawnedPosition = finalPos;
    return finalPos;
  }

  mountWindow(win, winId, title, iconValue, color = null) {
    this.makeDraggable(win);
    this.makeResizable(win);
    this.setupWindowControls(win);
    this.addToTaskbar(winId, title, iconValue, color);
    this.bringToFront(win);
  }

  getWindowIconHtml(iconValue, color = null) {
    if (!iconValue) return "";
    iconValue = resolveIconUrl(iconValue);
    const size = 25;
    const { isImage, isDataUrl } = this._resolveIconType(iconValue);

    if (isImage || isDataUrl) {
      return `<img src="${iconValue}" style="width:${size}px;height:${size}px;margin-right:6px;vertical-align:middle;object-fit:contain;" />`;
    } else if (typeof iconValue === "string" && iconValue.length > 0) {
      const cls = iconValue.startsWith("fa") ? iconValue : `fa ${iconValue}`;
      const clr = color ?? "white";
      return `<i class="${cls}" style="color:${clr};margin-right:6px;font-size:${size}px;vertical-align:middle;"></i>`;
    }
    return "";
  }

  _buildTaskbarIcon(iconValue, title, color) {
    iconValue = resolveIconUrl(iconValue);
    const { isImage, isDataUrl } = this._resolveIconType(iconValue);

    if (isImage || isDataUrl) {
      const icon = document.createElement("img");
      icon.src = iconValue;
      icon.onerror = () => {
        const fallback = document.createElement("i");
        fallback.className = "fas fa-window-maximize";
        fallback.style.color = color ?? "#6677dd";
        icon.replaceWith(fallback);
      };
      return icon;
    }

    const icon = document.createElement("i");
    icon.alt = title;

    if (typeof iconValue === "string" && iconValue.length > 0) {
      icon.className = iconValue.startsWith("fa") ? iconValue : `fa ${iconValue}`;
      icon.style.color = color ?? "white";
    } else {
      icon.className = "fas fa-window-maximize";
      icon.style.color = "#6677dd";
    }

    return icon;
  }

  addToTaskbar(winId, title, iconValue, color = null) {
    this.triggerSessionSave();
    if (document.getElementById(`taskbar-${winId}`)) return;
    if (iconValue === "fas fa-video") color = "6677dd";

    iconValue = resolveIconUrl(iconValue);

    const taskbarItem = document.createElement("div");
    taskbarItem.id = `taskbar-${winId}`;
    taskbarItem.className = "taskbar-item";
    taskbarItem.appendChild(this._buildTaskbarIcon(iconValue, title, color));
    bus.emit(BusEvents.WINDOW_CREATED, { winId, title });

    taskbarItem.onclick = () => {
      const winTask = document.getElementById(winId);
      if (!winTask) return;
      const entry = this.openWindows.get(winId);
      if (winTask.style.display === "none") {
        winTask.style.display = "block";
        taskbarItem.classList.remove("minimized");
        if (entry?.record) entry.record.minimized = false;
      }
      this.bringToFront(winTask);
    };

    taskbarItem.oncontextmenu = (e) => {
      e.preventDefault();
      const win = document.getElementById(winId);
      showStartStyleMenu(e, (addMenuItem, addSeparator) => this._buildContextMenuItems(addMenuItem, addSeparator, win));
    };

    const win = document.getElementById(winId);
    let geometry = {};
    if (win) {
      const rect = win.getBoundingClientRect();
      geometry = {
        x: parseInt(win.style.left) || rect.left,
        y: parseInt(win.style.top) || rect.top,
        width: parseInt(win.style.width) || rect.width,
        height: parseInt(win.style.height) || rect.height,
        zIndex: parseInt(win.style.zIndex) || 1000
      };
    }

    const record = new WindowRecord(winId, title, { ...geometry, iconValue, color });
    this.openWindows.set(winId, { taskbarItem, title, iconValue, color, record });
    this.workspaceManager?.registerWindow(winId);

    audioMixer.registerWindow(winId, title, audioMixer.getIconHtmlForTaskbar(null, iconValue));

    if (win) {
      const headerSpan = win.querySelector(".window-header > span");
      if (headerSpan) {
        const iconHtml = this.getWindowIconHtml(iconValue, color);
        if (iconHtml) {
          const temp = document.createElement("div");
          temp.innerHTML = iconHtml;
          const iconEl = temp.firstElementChild;
          if (iconEl) headerSpan.insertBefore(iconEl, headerSpan.firstChild);
        }
      }
    }

    taskbarItem.addEventListener("mouseenter", () => {
      if (this._taskbarPreviewShowTimer) clearTimeout(this._taskbarPreviewShowTimer);
      this._taskbarPreviewShowTimer = setTimeout(() => {
        this._showTaskbarPreview(winId, taskbarItem);
      }, 220);
    });

    taskbarItem.addEventListener("mouseleave", () => {
      if (this._taskbarPreviewShowTimer) clearTimeout(this._taskbarPreviewShowTimer);
      this._scheduleHideTaskbarPreview();
    });

    document.getElementById("taskbar-windows").appendChild(taskbarItem);

    const taskbarWindows = document.getElementById("taskbar-windows");
    if (taskbarWindows) {
      const taskbarAlignment = localStorage.getItem(StorageKeys.taskbarAlignment) || "center";
      const taskbar = document.getElementById("taskbar");

      if (taskbar) {
        const isHorizontal =
          taskbar.classList.contains("position-bottom") || taskbar.classList.contains("position-top");

        if (isHorizontal) {
          if (taskbarAlignment === "left") {
            taskbarWindows.style.justifyContent = "flex-start";
          } else if (taskbarAlignment === "center") {
            taskbarWindows.style.justifyContent = "center";
          } else if (taskbarAlignment === "right") {
            taskbarWindows.style.justifyContent = "flex-end";
          }
        } else {
          if (taskbarAlignment === "left") {
            taskbarWindows.style.alignItems = "flex-start";
          } else if (taskbarAlignment === "center") {
            taskbarWindows.style.alignItems = "center";
          } else if (taskbarAlignment === "right") {
            taskbarWindows.style.alignItems = "flex-end";
          }
        }
      }
    }
  }

  _scheduleHideTaskbarPreview() {
    if (this._taskbarPreviewHideTimer) clearTimeout(this._taskbarPreviewHideTimer);
    this._taskbarPreviewHideTimer = setTimeout(() => {
      if (!this._taskbarPreviewHovering) this._hideTaskbarPreview();
    }, 160);
  }

  _hideTaskbarPreview() {
    if (!this._taskbarPreview) return;
    this._taskbarPreview.remove();
    this._taskbarPreview = null;
    this._taskbarPreviewWinId = null;
    this._taskbarPreviewHovering = false;
  }

  _showTaskbarPreview(winId, anchorEl) {
    const win = document.getElementById(winId);
    if (!win || !anchorEl) return;

    if (this._taskbarPreviewWinId !== winId) this._hideTaskbarPreview();

    const meta = this.openWindows.get(winId);
    const title = meta?.title || winId;

    const preview = document.createElement("div");
    preview.className = "taskbar-preview";
    preview.dataset.winId = winId;
    preview.innerHTML = `
      <div class="taskbar-preview__title"></div>
      <div class="taskbar-preview__thumb"></div>
    `;
    preview.querySelector(".taskbar-preview__title").textContent = title;

    const thumb = preview.querySelector(".taskbar-preview__thumb");
    const clone = win.cloneNode(true);
    clone.removeAttribute("id");
    clone.classList.add("taskbar-preview__winclone");
    clone.style.position = "relative";
    clone.style.left = "0";
    clone.style.top = "0";
    clone.style.right = "auto";
    clone.style.bottom = "auto";
    clone.style.margin = "0";
    clone.style.maxWidth = "none";
    clone.style.maxHeight = "none";
    clone.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
    clone.querySelectorAll(".window-controls").forEach((n) => n.remove());
    clone.querySelectorAll("input,textarea,button,select").forEach((n) => n.setAttribute("disabled", "disabled"));
    thumb.appendChild(clone);

    document.body.appendChild(preview);
    this._taskbarPreview = preview;
    this._taskbarPreviewWinId = winId;

    const rect = anchorEl.getBoundingClientRect();
    const pRect = preview.getBoundingClientRect();

    const left = Math.max(
      8,
      Math.min(rect.left + rect.width / 2 - pRect.width / 2, window.innerWidth - pRect.width - 8)
    );
    const top = Math.max(8, rect.top - pRect.height - 10);

    preview.style.left = `${left}px`;
    preview.style.top = `${top}px`;

    const winRect = win.getBoundingClientRect();
    const innerW = 360 - 20;
    const innerH = 210 - 20;
    const scaleX = innerW / Math.max(1, winRect.width);
    const scaleY = innerH / Math.max(1, winRect.height);
    const scale = Math.min(scaleX, scaleY, 0.32);
    clone.style.transformOrigin = "top left";
    clone.style.transform = `scale(${scale})`;

    preview.addEventListener("mouseenter", () => {
      this._taskbarPreviewHovering = true;
      if (this._taskbarPreviewHideTimer) clearTimeout(this._taskbarPreviewHideTimer);
    });
    preview.addEventListener("mouseleave", () => {
      this._taskbarPreviewHovering = false;
      this._scheduleHideTaskbarPreview();
    });

    preview.addEventListener("mousedown", (e) => e.preventDefault());
    preview.addEventListener("click", () => {
      const w = document.getElementById(winId);
      if (!w) return;
      if (w.style.display === "none") {
        w.style.display = "block";
        const taskbarItem = document.getElementById(`taskbar-${winId}`);
        if (taskbarItem) taskbarItem.classList.remove("minimized");
      }
      this.bringToFront(w);
      this._hideTaskbarPreview();
    });
  }

  registerCloseWindow(closeButton, winId) {
    closeButton.addEventListener("click", () => {
      const win = document.getElementById(winId);
      if (!win) return;
      this._animateAndRemove(win);
      this.removeFromTaskbar(winId);
    });
  }

  updatePageFavicon(iconValue, title) {
    document.title = title || this.initialTitle;
    const link = this._getFaviconLink();
    iconValue = resolveIconUrl(iconValue);
    const { isImage, isDataUrl } = this._resolveIconType(iconValue);
    if (isImage || isDataUrl) {
      link.href = iconValue;
    } else {
      link.href = this.initialFavicon || "";
    }
  }

  resetToDefaultState() {
    document.title = this.initialTitle;
    const link = this._getFaviconLink();
    link.href = this.initialFavicon || "";
  }

  _initVisibilityTracking() {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        document.title = this.initialTitle;
        this._getFaviconLink().href = this.initialFavicon || "";
      } else {
        if (this.openWindows.size === 0) {
          this.resetToDefaultState();
        } else {
          const activeEntry =
            Array.from(this.openWindows.values()).findLast((entry) =>
              entry.taskbarItem?.classList.contains("active")
            ) ?? Array.from(this.openWindows.values()).pop();
          if (activeEntry) this.updatePageFavicon(activeEntry.iconValue, activeEntry.title);
        }
      }
    });
  }

  bringToFront(win) {
    if (!win) return;

    this.openWindows.forEach(({ taskbarItem }) => taskbarItem.classList.remove("active"));

    const entry = this.openWindows.get(win.id);
    if (entry?.taskbarItem) {
      entry.taskbarItem.classList.add("active");
      entry.taskbarItem.classList.remove("minimized");
      this.updatePageFavicon(entry.iconValue, entry.title);
      document.title = entry.title || "YukiOS";
      if (entry.record) entry.record.zIndex = this.zIndexCounter;
      bus.emit(BusEvents.WINDOW_FOCUSED, { winId: win.id, title: entry.title, iconValue: entry.iconValue });
    }

    win.style.zIndex = this.zIndexCounter++;
    this.triggerSessionSave();
  }

  removeFromTaskbar(winId) {
    const taskbarItem = document.getElementById(`taskbar-${winId}`);
    if (taskbarItem) taskbarItem.remove();
    const entry = this.openWindows.get(winId);
    if (entry && entry.record) {
      const win = document.getElementById(winId);
      const appId = (win && win.dataset.appId) || this._guessAppIdFromWinId(winId);
      if (appId) {
        try {
          const rect = win ? win.getBoundingClientRect() : null;
          localStorage.setItem(
            `${StorageKeys.geometryPrefix}${appId}`,
            JSON.stringify({
              x: rect ? parseInt(win.style.left) || rect.left : entry.record.x,
              y: rect ? parseInt(win.style.top) || rect.top : entry.record.y,
              width: rect ? parseInt(win.style.width) || rect.width : entry.record.width,
              height: rect ? parseInt(win.style.height) || rect.height : entry.record.height
            })
          );
        } catch (e) {}
      }
    }
    this.openWindows.delete(winId);
    this.workspaceManager?.unregisterWindow(winId);
    audioMixer.unregisterWindow(winId);
    bus.emit(BusEvents.WINDOW_CLOSED, { winId });

    if (this.openWindows.size === 0) {
      this.resetToDefaultState();
    } else {
      const lastWin = Array.from(this.openWindows.values()).pop();
      if (lastWin) this.updatePageFavicon(lastWin.iconValue, lastWin.title);
    }
    this.triggerSessionSave();
  }

  minimizeWindow(win) {
    win.style.display = "none";
    const taskbarItem = document.getElementById(`taskbar-${win.id}`);
    if (taskbarItem) {
      taskbarItem.classList.remove("active");
      taskbarItem.classList.add("minimized");
    }
    const entry = this.openWindows.get(win.id);
    if (entry?.record) entry.record.minimized = true;
    this.triggerSessionSave();
  }

  toggleFullscreen(win) {
    const wasFullscreen = win.dataset.fullscreen === "true";
    const header = win.querySelector(".window-header");

    if (wasFullscreen) {
      if (document.fullscreenElement === win) document.exitFullscreen();

      Object.assign(win.style, {
        width: win.dataset.prevWidth,
        height: win.dataset.prevHeight,
        left: win.dataset.prevLeft,
        top: win.dataset.prevTop
      });

      if (header) header.style.display = "";
      win.dataset.fullscreen = "false";
      const entry = this.openWindows.get(win.id);
      if (entry?.record) entry.record.fullscreen = false;
    } else {
      Object.assign(win.dataset, {
        prevWidth: win.style.width,
        prevHeight: win.style.height,
        prevLeft: win.style.left,
        prevTop: win.style.top
      });

      const makeFullscreen = () => {
        Object.assign(win.style, { width: "100vw", height: "100vh", left: "0", top: "0" });
        if (header) header.style.display = "none";
      };

      if (win.requestFullscreen) {
        win.requestFullscreen().then(makeFullscreen).catch(makeFullscreen);
      } else {
        makeFullscreen();
      }

      win.dataset.fullscreen = "true";
      const entry = this.openWindows.get(win.id);
      if (entry?.record) entry.record.fullscreen = true;

      const onFullscreenChange = () => {
        if (!document.fullscreenElement) {
          if (header) header.style.display = "";
          win.dataset.fullscreen = "false";
          const entry = this.openWindows.get(win.id);
          if (entry?.record) entry.record.fullscreen = false;
          document.removeEventListener("fullscreenchange", onFullscreenChange);
        }
      };

      document.addEventListener("fullscreenchange", onFullscreenChange);
    }
    this.triggerSessionSave();
  }

  setupWindowControls(win) {
    setupWindowControls(win, this);
  }

  _silenceWindow(win) {
    const iframes = win.querySelectorAll("iframe");
    iframes.forEach((iframe) => {
      try {
        iframe.src = "about:blank";
        iframe.remove();
      } catch (e) {
        iframe.src = "about:blank";
      }
    });

    const media = win.querySelectorAll("video, audio");
    media.forEach((m) => {
      m.pause();
      m.src = "";
      m.load();
      m.remove();
    });
  }

  _showWindowContextMenu(e, win) {
    showStartStyleMenu(e, (addMenuItem, addSeparator) => this._buildContextMenuItems(addMenuItem, addSeparator, win));
  }

  _initSnapGhost() {
    const ghost = document.createElement("div");
    ghost.id = "snap-ghost";
    document.getElementById("desktop").appendChild(ghost);
    this._snapGhost = ghost;
  }

  makeDraggable(win) {
    makeDraggable(win, this);
  }

  _getSnapZone(x, y) {
    return _getSnapZone(this, x, y);
  }

  _showSnapGhost(zone) {
    _showSnapGhost(this, zone);
  }

  _hideSnapGhost() {
    _hideSnapGhost(this);
  }

  _applySnap(win, zone) {
    _applySnap(this, win, zone);
  }

  _unsnap(win) {
    _unsnap(this, win);
  }

  makeResizable(win, setHeightUnsetElement = null) {
    makeResizable(win, this, setHeightUnsetElement);
  }

  _downloadWindowContent(win) {
    const filename =
      (win.querySelector(".window-header span")?.textContent?.trim() || win.id).replace(/[^\w\s-]/g, "").trim() ||
      "window";

    const iframe = win.querySelector("iframe");
    if (iframe) {
      const src = iframe.src || "";

      if (!src || src === "about:blank" || src === "") {
        return;
      }

      if (src.startsWith("blob:")) {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (iframeDoc) {
            const html = iframeDoc.documentElement?.outerHTML ?? "";
            const blob = new Blob([html], { type: "text/html" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename + ".html";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }
        } catch (e) {}
        return;
      }

      if (src.startsWith("data:")) {
        const a = document.createElement("a");
        a.href = src;
        a.download = filename + ".html";
        a.click();
        return;
      }

      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          const html = iframeDoc.documentElement?.outerHTML ?? "";
          const blob = new Blob([html], { type: "text/html" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename + ".html";
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          return;
        }
      } catch (e) {}

      const a = document.createElement("a");
      a.href = src;
      a.download = filename + ".html";
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.click();
      return;
    }

    const content = win.querySelector(".window-content");
    const html = content ? content.innerHTML : win.outerHTML;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename + ".html";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  getWindowControls(externalUrl) {
    const externalBtn = externalUrl ? `<button class="external-btn" title="Open in External">↗</button>` : "";

    const downloadBtn = `<button class="download-btn" title="Download">
      <svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 7L1.5 3.5h2V0h3v3.5h2L5 7zM0 9h10v1H0z"/>
      </svg>
    </button>`;

    if (window._settings?.macOsControls) {
      return `<div class="window-controls mac-controls">
        <button class="close-btn mac-btn mac-close" title="Close"></button>
        ${externalBtn}
        <button class="minimize-btn mac-btn mac-minimize" title="Minimize"></button>
        ${downloadBtn}
        <button class="maximize-btn mac-btn mac-maximize" title="Maximize"></button>
      </div>`;
    }

    return `<div class="window-controls">
      <button class="minimize-btn" title="Minimize"><svg viewBox="0 0 10 1" xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10v1H0z"></path></svg></button>
      ${externalBtn}
      ${downloadBtn}
      <button class="maximize-btn" title="Maximize"><svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><path d="M0 0v10h10V0H0zm1 1h8v8H1V1z"></path></svg></button>
      <button class="close-btn" title="Close"><svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><path d="M10.2.7L9.5 0 5.1 4.4.7 0 0 .7l4.4 4.4L0 9.5l.7.7 4.4-4.4 4.4 4.4.7-.7-4.4-4.4z"></path></svg></button>
    </div>`;
  }

  sendNotify(text) {
    sendNotify(this, text);
  }

  _isWindowPinned(winId) {
    const pinnedItems = this._getPinnedItems();
    return pinnedItems.some((item) => item.winId === winId);
  }

  _getPinnedItems() {
    try {
      const pinnedData = localStorage.getItem(StorageKeys.pinnedTaskbarItems);
      return pinnedData ? JSON.parse(pinnedData) : [];
    } catch {
      return [];
    }
  }

  _savePinnedItems(pinnedItems) {
    try {
      localStorage.setItem(StorageKeys.pinnedTaskbarItems, JSON.stringify(pinnedItems));
    } catch {}
  }

  _pinToTaskbar(winId) {
    const entry = this.openWindows.get(winId);
    if (!entry) return;

    const pinnedItems = this._getPinnedItems();
    if (pinnedItems.some((item) => item.winId === winId)) return;

    pinnedItems.push({
      winId,
      title: entry.title,
      iconValue: entry.iconValue,
      color: entry.color
    });

    this._savePinnedItems(pinnedItems);
    this._renderPinnedItems();
  }

  _unpinFromTaskbar(winId) {
    const pinnedItems = this._getPinnedItems();
    const filtered = pinnedItems.filter((item) => item.winId !== winId);
    this._savePinnedItems(filtered);
    this._renderPinnedItems();
  }

  _renderPinnedItems() {
    const taskbarWindows = document.getElementById("taskbar-windows");
    if (!taskbarWindows) return;

    const existingPinnedContainer = document.getElementById("taskbar-pinned-container");
    if (existingPinnedContainer) existingPinnedContainer.remove();

    const pinnedItems = this._getPinnedItems();
    if (pinnedItems.length === 0) return;

    const pinnedContainer = document.createElement("div");
    pinnedContainer.id = "taskbar-pinned-container";
    pinnedContainer.className = "taskbar-pinned-container";

    pinnedItems.forEach((item) => {
      const isOpen = this.openWindows.has(item.winId);
      if (isOpen) return;

      const pinnedItem = document.createElement("div");
      pinnedItem.className = "taskbar-item pinned";
      pinnedItem.appendChild(this._buildTaskbarIcon(item.iconValue, item.title, item.color));

      pinnedItem.onclick = () => {
        if (window.appLauncher) {
          const appId = this._findAppIdByWinId(item.winId);
          if (appId) {
            window.appLauncher.launch(appId);
          }
        }
      };

      pinnedItem.oncontextmenu = (e) => {
        e.preventDefault();
        showStartStyleMenu(e, (addMenuItem, addSeparator) => {
          addMenuItem("Unpin from Taskbar", () => this._unpinFromTaskbar(item.winId), "fa-thumbtack");
          addSeparator();
          addMenuItem(
            "Launch App",
            () => {
              if (window.appLauncher) {
                const appId = this._findAppIdByWinId(item.winId);
                if (appId) {
                  window.appLauncher.launch(appId);
                }
              }
            },
            "fa-play"
          );
        });
      };

      pinnedContainer.appendChild(pinnedItem);
    });

    if (pinnedContainer.children.length > 0) {
      taskbarWindows.insertBefore(pinnedContainer, taskbarWindows.firstChild);
    }
  }

  _findAppIdByWinId(winId) {
    const gamesList = window.gamesList;
    if (!gamesList || !gamesList.appMap) return null;

    for (const [appId, appData] of Object.entries(gamesList.appMap)) {
      if (appData.id === winId) return appId;
    }
    return null;
  }

  closeAll() {
    const winIds = Array.from(this.openWindows.keys());
    for (const winId of winIds) {
      const win = document.getElementById(winId);
      if (win) {
        this._silenceWindow(win);
        win.remove();
      }
      this.removeFromTaskbar(winId);
    }
  }

  restorePinnedItems() {
    this._renderPinnedItems();
  }
}
