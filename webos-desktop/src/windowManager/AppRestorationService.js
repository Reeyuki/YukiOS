import { SYSTEM_APPS } from "../AppRegistryConfig.js";
import { parseBool } from "../utils/utils.js";
import { StorageKeys, os, $ } from "../framework.js";

export class AppRestorationService {
  constructor(windowManager) {
    this.wm = windowManager;
    this.appRegistry = new Map();
    this.isRestoring = false;
    this.restoreLog = [];
    this.launchedApps = new Set();

    const flush = () => this.flushSession();
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.flushSession();
    });
  }

  registerApp(launcherPropertyName, appMetadata = {}) {
    this.appRegistry.set(launcherPropertyName, {
      name: launcherPropertyName,
      windowIdPatterns: appMetadata.windowIdPatterns || [],
      appTypeHint: appMetadata.appTypeHint,
      ...appMetadata
    });
  }

  buildRegistryFromConfig() {
    for (const [appId, metadata] of Object.entries(SYSTEM_APPS)) {
      if (metadata.windowIdPatterns && metadata.windowIdPatterns.length > 0) {
        this.registerApp(appId, {
          windowIdPatterns: metadata.windowIdPatterns,
          appTypeHint: "system",
          persistContentState: metadata.persistContentState !== false
        });
      }
    }
  }

  appExists(appId) {
    if (!this.wm.appLauncher) return false;
    const serviceKey = SYSTEM_APPS[appId]?.serviceKey || appId;
    return !!(this.wm.appLauncher.services?.[serviceKey] || this.wm.appLauncher.appMap?.[appId]);
  }

  guessAppIdFromWinId(winId) {
    if (!winId) return null;
    const launcher = this.wm.appLauncher;
    if (!launcher) return null;
    const needle = winId.toLowerCase().replace(/[-_\s]/g, "");
    for (const key of Object.keys(launcher)) {
      if (needle.includes(key.toLowerCase())) return key;
    }
    return null;
  }

  findAppId(windowState) {
    if (windowState.appId) {
      if (this.appRegistry.has(windowState.appId)) return windowState.appId;
      if (this.wm.appLauncher?.appMap?.[windowState.appId]) return windowState.appId;
    }
    const winId = (windowState.id || "").toLowerCase();
    for (const [propName, metadata] of this.appRegistry.entries()) {
      for (const pattern of metadata.windowIdPatterns) {
        if (winId.includes(pattern.toLowerCase())) return propName;
      }
    }
    return null;
  }

  getAppInstance(appId) {
    if (!this.wm.appLauncher || !appId) return null;
    const serviceKey = SYSTEM_APPS[appId]?.serviceKey || appId;
    return this.wm.appLauncher.services?.[serviceKey] || null;
  }

  captureWindowState(win, entry) {
    const record = entry.record;
    const geom = this.wm.getWindowNormalGeometry(win);
    record.x = geom.x;
    record.y = geom.y;
    record.width = geom.width;
    record.height = geom.height;
    record.zIndex = parseInt(win.style.zIndex) || 1000;
    record.snapZone = win.dataset.snapZone || null;
    record.fullscreen = win.dataset.fullscreen === "true" && win.dataset.appId !== "browserApp";
    record.focused = win.classList.contains("active");

    const content = win.querySelector(".window-content");
    if (content) {
      record.scrollPosition = { x: content.scrollLeft, y: content.scrollTop };
    }

    const appId = win.dataset.appId || this.findAppId({ id: win.id });
    if (appId) {
      record.appId = appId;
      win.dataset.appId = appId;

      const appMetadata = this.appRegistry.get(appId);
      if (this.wm.appLauncher && (!appMetadata || appMetadata.persistContentState !== false)) {
        const appInstance = this.getAppInstance(appId);
        if (appInstance) {
          try {
            const snapshot = appInstance.getSnapshot(win.id);
            if (snapshot && typeof snapshot.then !== "function") {
              record.appStateSnapshot = snapshot;
            }
          } catch (e) {
            console.warn(`Failed to get snapshot for ${appId}:`, e);
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

    return record.toJSON();
  }

  collectSession() {
    const windowStates = [];
    const sortedWindows = Array.from(this.wm.openWindows.keys())
      .map((id) => $("#" + id))
      .filter(Boolean)
      .sort((a, b) => (parseInt(a.style.zIndex) || 0) - (parseInt(b.style.zIndex) || 0));

    for (const win of sortedWindows) {
      const entry = this.wm.openWindows.get(win.id);
      if (!entry || !entry.record) continue;
      windowStates.push(this.captureWindowState(win, entry));
    }

    if (this.wm.workspaceManager) {
      return {
        windows: windowStates,
        workspaces: this.wm.workspaceManager.workspaces.map((w) => ({ id: w.id, name: w.name })),
        activeWorkspaceId: this.wm.workspaceManager.activeId
      };
    }
    return windowStates;
  }

  saveSession() {
    const persistenceEnabled = parseBool(os.storage.get(StorageKeys.windowSessionPersistence), true);
    if (!persistenceEnabled) {
      try {
        os.storage.remove(StorageKeys.windowSession);
        if (this.wm.fs) this.clearLegacySessionFile();
      } catch (e) {
        console.warn("Failed to clear session:", e);
      }
      return;
    }
    try {
      os.storage.set(StorageKeys.windowSession, this.collectSession());
    } catch (e) {
      console.error("Failed to save window session:", e);
    }
  }

  flushSession() {
    if (this.isRestoring) return;
    this.saveSession();
  }

  async clearLegacySessionFile() {
    try {
      const sessionKey = this.wm.fs.sessionKey;
      const sessionPath = `/home/${sessionKey}/system/windowSession.json`;
      const exists = await this.wm.fs.exists(sessionPath);
      if (exists) await this.wm.fs.unlink(sessionPath);
    } catch (e) {}
  }

  async readPersistedSession() {
    const stored = os.storage.get(StorageKeys.windowSession);
    if (stored) return stored;

    if (!this.wm.fs) return null;
    const sessionKey = this.wm.fs.sessionKey;
    const sessionPath = `/home/${sessionKey}/system/windowSession.json`;
    const exists = await this.wm.fs.exists(sessionPath);
    if (!exists) return null;
    try {
      const data = await this.wm.fs.pRead("readFile", sessionPath, "utf8");
      const parsed = JSON.parse(data);
      os.storage.set(StorageKeys.windowSession, parsed);
      await this.wm.fs.unlink(sessionPath);
      return parsed;
    } catch (e) {
      console.warn("Failed to migrate legacy session file:", e);
      return null;
    }
  }

  async restoreSession() {
    if (this.isRestoring) return;
    if (!this.wm.fs || !this.wm.fs.sessionKey || !this.wm.appLauncher) return;

    const persistenceEnabled = parseBool(os.storage.get(StorageKeys.windowSessionPersistence), true);
    if (!persistenceEnabled) return;

    this.isRestoring = true;
    this.restoreLog = [];
    this.launchedApps.clear();

    try {
      const parsedData = await this.readPersistedSession();
      if (!parsedData) return;

      const windowStates = Array.isArray(parsedData) ? parsedData : parsedData.windows || [];

      if (parsedData.windows && this.wm.workspaceManager && parsedData.workspaces) {
        try {
          this.wm.workspaceManager.workspaces = parsedData.workspaces.map((w) => ({ ...w, windows: new Set() }));
          this.wm.workspaceManager.activeId = parsedData.activeWorkspaceId || 0;
          this.wm.workspaceManager.render();
        } catch (e) {
          console.warn("Failed to restore workspaces:", e);
        }
      }

      if (windowStates.length === 0) return;

      for (const state of windowStates) {
        const appId = this.findAppId(state);
        if (!appId) {
          this.logRestore(`Skipped: Unknown app for window ${state.id}`);
          continue;
        }
        if (!this.appExists(appId)) {
          this.logRestore(`Skipped: App '${appId}' not available for window ${state.id}`);
          continue;
        }
        await this.restoreWindow(state, appId);
      }

      const lastFocused = windowStates.find((s) => s.focused);
      if (lastFocused) {
        const win = $("#" + lastFocused.id);
        if (win) {
          try {
            this.wm.bringToFront(win);
          } catch (e) {
            console.warn("Failed to focus window:", e);
          }
        }
      }

      if (this.wm.tilingManager && this.wm.tilingManager.enabled) {
        const seen = new Set();
        for (const state of windowStates) {
          const wsId = state.workspaceId;
          if (wsId == null || seen.has(wsId)) continue;
          seen.add(wsId);
          this.wm.tilingManager.rebuildTreeForWorkspace(wsId);
        }
        this.wm.tilingManager.applyLayoutToAllWindows();
      }
    } catch (e) {
      console.error("Failed to restore window session:", e);
      this.logRestore(`Error: ${e.message}`);
    } finally {
      this.isRestoring = false;
    }
  }

  async restoreWindow(state, appId) {
    try {
      if (this.launchedApps.has(appId)) {
        this.logRestore(`Skipped: App already launched (${appId})`);
        return;
      }

      const serviceKey = SYSTEM_APPS[appId]?.serviceKey || appId;
      const appInstance = this.wm.appLauncher.services?.[serviceKey];
      if (!appInstance) {
        this.logRestore(`Skipped: App instance '${appId}' not available`);
        return;
      }

      const existingWin = $("#" + state.id);
      if (existingWin) {
        this.wm.closeWindow(existingWin);
      }

      const launchOptions = {
        forceId: state.id,
        position: state.snapZone ? undefined : { x: state.x, y: state.y },
        width: state.snapZone ? undefined : state.width,
        height: state.snapZone ? undefined : state.height,
        allowManualPosition: true
      };

      try {
        await this.wm.appLauncher.launch(appId, false, launchOptions);
        this.launchedApps.add(appId);
      } catch (e) {
        this.logRestore(`Failed to open app '${appId}': ${e.message}`);
        return;
      }

      const win = $("#" + state.id);
      if (!win) {
        this.logRestore(`Failed: Window ${state.id} not created by ${appId}`);
        return;
      }

      win.dataset.appId = appId;

      try {
        if (state.minimized) {
          this.wm.minimizeWindow(win);
        }
        if (state.fullscreen && win.dataset.appId !== "browserApp") {
          this.wm.toggleFullscreen(win);
        }
        if (state.snapZone) {
          this.wm.applySnap(win, state.snapZone, true);
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

      const appMetadata = this.appRegistry.get(appId);
      const shouldPersistContent = !appMetadata || appMetadata.persistContentState !== false;

      if (shouldPersistContent && state.appStateSnapshot) {
        try {
          const appInstance = this.getAppInstance(appId);
          if (appInstance) {
            await appInstance.restoreSnapshot(win.id, state.appStateSnapshot);
          }
        } catch (e) {}
      }

      if (shouldPersistContent && state.scrollPosition) {
        const content = win.querySelector(".window-content");
        if (content) {
          content.scrollLeft = state.scrollPosition.x;
          content.scrollTop = state.scrollPosition.y;
        }
      }

      this.logRestore(`Restored: ${appId} (${state.id})`);
    } catch (e) {
      this.logRestore(`Error: Failed to restore ${state.id}: ${e.message}`);
      console.error(`Failed to restore window ${state.id}:`, e);
    }
  }

  logRestore(message) {
    this.restoreLog.push(message);
  }

  getRestoreLog() {
    return this.restoreLog;
  }
}
