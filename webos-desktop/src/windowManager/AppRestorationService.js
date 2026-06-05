import { StorageKeys } from "../settings/settings.js";
import { os } from "../os/index.js";
import { SYSTEM_APPS } from "../AppRegistryConfig.js";

export class AppRestorationService {
  constructor(windowManager) {
    this.wm = windowManager;
    this.appRegistry = new Map();
    this.isRestoring = false;
    this.restoreLog = [];
    this.launchedApps = new Set();
  }

  registerApp(launcherPropertyName, appMetadata = {}) {
    this.appRegistry.set(launcherPropertyName, {
      name: launcherPropertyName,
      windowIdPatterns: appMetadata.windowIdPatterns || [],
      appTypeHint: appMetadata.appTypeHint,
      isHeavy: appMetadata.isHeavy || false,
      ...appMetadata
    });
  }

  appExists(appId) {
    if (!this.wm.appLauncher) return false;
    const serviceKey = SYSTEM_APPS[appId]?.serviceKey || appId;
    return !!this.wm.appLauncher._services?.[serviceKey];
  }

  buildRegistryFromConfig() {
    for (const [appId, metadata] of Object.entries(SYSTEM_APPS)) {
      if (metadata.windowIdPatterns && metadata.windowIdPatterns.length > 0) {
        this.registerApp(appId, {
          windowIdPatterns: metadata.windowIdPatterns,
          appTypeHint: "system",
          isHeavy: metadata.isHeavy || false
        });
      }
    }
  }

  findWindowForApp(appId, originalWindowId) {
    if (!appId || !this.wm) return null;

    let win = document.getElementById(originalWindowId);
    if (win) return win;

    const allWindows = Array.from(this.wm.openWindows.entries());
    for (const [winId, entry] of allWindows) {
      const win = document.getElementById(winId);
      if (win && !win.dataset.appId) {
        return win;
      }
    }

    return null;
  }

  findAppId(windowState) {
    if (windowState.appId) {
      if (this.appRegistry.has(windowState.appId)) {
        return windowState.appId;
      }
    }

    const winId = (windowState.id || "").toLowerCase();
    for (const [propName, metadata] of this.appRegistry.entries()) {
      for (const pattern of metadata.windowIdPatterns) {
        if (winId.includes(pattern.toLowerCase())) {
          return propName;
        }
      }
    }

    return null;
  }

  getAppInstance(appId) {
    if (!this.wm.appLauncher || !appId) return null;
    const serviceKey = SYSTEM_APPS[appId]?.serviceKey || appId;
    return this.wm.appLauncher._services?.[serviceKey] || null;
  }

  async saveSession() {
    if (!this.wm.fs || !this.wm.fs.sessionKey) return;

    const sessionKey = this.wm.fs.sessionKey;
    const sessionPath = `/ys/users/${sessionKey}/system/windowSession.json`;

    const persistenceEnabled = os.storage.get(StorageKeys.windowSessionPersistence) !== "false";
    if (!persistenceEnabled) {
      try {
        const exists = await this.wm.fs.exists(sessionPath);
        if (exists) {
          await this.wm.fs.unlink(sessionPath);
        }
      } catch (e) {
        console.warn("Failed to clear session file:", e);
      }
      return;
    }

    const windowStates = [];
    const sortedWindows = Array.from(this.wm.openWindows.keys())
      .map((id) => document.getElementById(id))
      .filter(Boolean)
      .sort((a, b) => (parseInt(a.style.zIndex) || 0) - (parseInt(b.style.zIndex) || 0));

    for (const win of sortedWindows) {
      const entry = this.wm.openWindows.get(win.id);
      if (!entry || !entry.record) continue;

      const record = entry.record;

      const geom = this.wm._getWindowNormalGeometry(win);
      record.x = geom.x;
      record.y = geom.y;
      record.width = geom.width;
      record.height = geom.height;
      record.zIndex = parseInt(win.style.zIndex) || 1000;
      record.snapZone = win.dataset.snapZone || null;
      record.minimized = win.style.display === "none";
      record.fullscreen = win.dataset.fullscreen === "true";
      record.focused = win.classList.contains("active");

      const content = win.querySelector(".window-content");
      if (content) {
        record.scrollPosition = { x: content.scrollLeft, y: content.scrollTop };
      }

      const appId = win.dataset.appId || this.findAppId({ id: win.id });
      if (appId) {
        record.appId = appId;
        win.dataset.appId = appId;

        try {
          os.storage.set(`${StorageKeys.geometryPrefix}${appId}`, {
            x: record.x,
            y: record.y,
            width: record.width,
            height: record.height
          });
        } catch (e) {
          console.warn(`Failed to save geometry for ${appId}:`, e);
        }

        if (this.wm.appLauncher) {
          const appInstance = this.getAppInstance(appId);
          if (appInstance && typeof appInstance.getSnapshot === "function") {
            try {
              record.appStateSnapshot = await appInstance.getSnapshot(win.id);
            } catch (e) {
              console.warn(`Failed to get snapshot for app ${appId}:`, e);
            }
          }
        }
      }

      if (this.wm.workspaceManager) {
        let wsId = 0;
        for (const ws of this.wm.workspaceManager.workspaces) {
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
      await this.wm.fs.ensureFolder(["system"]);
      let sessionData = windowStates;

      if (this.wm.workspaceManager) {
        sessionData = {
          windows: windowStates,
          workspaces: this.wm.workspaceManager.workspaces.map((w) => ({ id: w.id, name: w.name })),
          activeWorkspaceId: this.wm.workspaceManager.activeId
        };
      }

      await this.wm.fs.safeWriteFile(sessionPath, JSON.stringify(sessionData));
    } catch (e) {
      console.error("Failed to save window session:", e);
    }
  }

  async restoreSession() {
    if (this.isRestoring) return;
    if (!this.wm.fs || !this.wm.fs.sessionKey || !this.wm.appLauncher) return;

    const persistenceEnabled = os.storage.get(StorageKeys.windowSessionPersistence) !== "false";
    if (!persistenceEnabled) return;

    this.isRestoring = true;
    this.restoreLog = [];
    this.launchedApps.clear();

    try {
      const sessionKey = this.wm.fs.sessionKey;
      const sessionPath = `/ys/users/${sessionKey}/system/windowSession.json`;

      const exists = await this.wm.fs.exists(sessionPath);
      if (!exists) {
        return;
      }

      const data = await this.wm.fs.pRead("readFile", sessionPath, "utf8");
      const parsedData = JSON.parse(data);

      let windowStates = [];
      if (Array.isArray(parsedData)) {
        windowStates = parsedData;
      } else if (parsedData && parsedData.windows) {
        windowStates = parsedData.windows;

        if (this.wm.workspaceManager && parsedData.workspaces) {
          try {
            this.wm.workspaceManager.workspaces = parsedData.workspaces.map((w) => ({
              ...w,
              windows: new Set()
            }));
            this.wm.workspaceManager.activeId = parsedData.activeWorkspaceId || 0;
            this.wm.workspaceManager._render();
          } catch (e) {
            console.warn("Failed to restore workspaces:", e);
          }
        }
      }

      if (!Array.isArray(windowStates) || windowStates.length === 0) {
        return;
      }

      const heavyApps = [];
      const lightApps = [];
      const failedApps = [];

      for (const state of windowStates) {
        const appId = this.findAppId(state);

        if (!appId) {
          this._logRestore(`Skipped: Unknown app for window ${state.id}`);
          failedApps.push(state);
          continue;
        }

        if (!this.appExists(appId)) {
          this._logRestore(`Skipped: App '${appId}' not available in launcher for window ${state.id}`);
          failedApps.push(state);
          continue;
        }

        const metadata = this.appRegistry.get(appId);
        if (metadata && metadata.isHeavy) {
          heavyApps.push({ state, appId });
        } else {
          lightApps.push({ state, appId });
        }
      }

      for (const item of lightApps) {
        await this._restoreWindow(item.state, item.appId);
      }

      if (heavyApps.length > 0) {
        await this._restoreHeavyAppsThrottled(heavyApps);
      }

      const lastFocused = windowStates.find((s) => s.focused);
      if (lastFocused) {
        const win = document.getElementById(lastFocused.id);
        if (win) {
          try {
            this.wm.bringToFront(win);
          } catch (e) {
            console.warn("Failed to focus window:", e);
          }
        }
      }

      if (failedApps.length > 0) {
        this._logRestore(`Skipped ${failedApps.length} windows due to unavailable apps`);
      }
    } catch (e) {
      console.error("Failed to restore window session:", e);
      this._logRestore(`Error: ${e.message}`);
    } finally {
      this.isRestoring = false;
    }
  }

  async _restoreWindow(state, appId) {
    try {
      if (this.launchedApps.has(appId)) {
        this._logRestore(`Skipped: App already launched (${appId})`);
        return;
      }

      const serviceKey = SYSTEM_APPS[appId]?.serviceKey || appId;
      const appInstance = this.wm.appLauncher._services?.[serviceKey];
      if (!appInstance) {
        this._logRestore(`Skipped: App instance '${appId}' not available`);
        return;
      }

      const launchOptions = {
        forceId: state.id,
        position: state.snapZone ? undefined : { x: state.x, y: state.y },
        width: state.snapZone ? undefined : state.width,
        height: state.snapZone ? undefined : state.height,
        allowManualPosition: true
      };

      try {
        if (typeof appInstance.getDeclarativeSchema === "function") {
          const schema = appInstance.getDeclarativeSchema(launchOptions);
          if (schema) {
            if (!schema.actions) {
              schema.actions = {};
            }
            schema.actions._appInstance = appInstance;
            this.wm.appLauncher.appRuntime.register(schema.id, schema);
            await this.wm.appLauncher.appRuntime.launch(schema.id, launchOptions);
          } else if (typeof appInstance.open === "function") {
            await appInstance.open(launchOptions);
          } else {
            this._logRestore(`Failed: App '${appId}' has null declarative schema and no open() method`);
            return;
          }
        } else if (typeof appInstance.open === "function") {
          await appInstance.open(launchOptions);
        } else {
          this._logRestore(`Failed: App '${appId}' does not have open() method or declarative schema`);
          return;
        }
        this.launchedApps.add(appId);
      } catch (e) {
        this._logRestore(`Failed to open app '${appId}': ${e.message}`);
        return;
      }

      const win = document.getElementById(state.id);
      if (!win) {
        this._logRestore(`Failed: Window ${state.id} not created by ${appId}`);
        return;
      }

      win.dataset.appId = appId;

      try {
        if (state.minimized) {
          this.wm.minimizeWindow(win);
        }
        if (state.fullscreen) {
          this.wm.toggleFullscreen(win);
        }
        if (state.snapZone) {
          this.wm._applySnap(win, state.snapZone, true);
        }

        win.style.zIndex = state.zIndex;
        this.wm.zIndexCounter = Math.max(this.wm.zIndexCounter, state.zIndex + 1);
      } catch (e) {
        console.warn(`Failed to apply window state for ${appId}:`, e);
      }

      if (this.wm.workspaceManager && state.workspaceId !== undefined) {
        try {
          this.wm.workspaceManager.moveWindowTo(win.id, state.workspaceId);
        } catch (e) {
          console.warn(`Failed to restore workspace for ${win.id}:`, e);
        }
      }

      if (state.appStateSnapshot) {
        try {
          const appInstance = this.getAppInstance(appId);
          if (appInstance && typeof appInstance.restoreSnapshot === "function") {
            await appInstance.restoreSnapshot(win.id, state.appStateSnapshot);
          }
        } catch (e) {}
      }

      if (state.scrollPosition) {
        const content = win.querySelector(".window-content");
        if (content) {
          content.scrollLeft = state.scrollPosition.x;
          content.scrollTop = state.scrollPosition.y;
        }
      }

      this._logRestore(`Restored: ${appId} (${state.id})`);
    } catch (e) {
      this._logRestore(`Error: Failed to restore ${state.id}: ${e.message}`);
      console.error(`Failed to restore window ${state.id}:`, e);
    }
  }

  async _restoreHeavyAppsThrottled(apps) {
    for (const item of apps) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await this._restoreWindow(item.state, item.appId);
    }
  }

  _toCamelCase(str) {
    return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  }

  _logRestore(message) {
    this.restoreLog.push(message);
    console.log(`[AppRestoration] ${message}`);
  }

  getRestoreLog() {
    return this.restoreLog;
  }
}
