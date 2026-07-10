import { SYSTEM_APPS } from "../AppRegistryConfig.js";

import { StorageKeys, os } from "../framework.js";
export class WindowSessionManager {
  constructor(manager) {
    this.manager = manager;
  }

  triggerSessionSave() {
    if (this.manager.isRestoring) return;
    if (this.manager.sessionSaveTimer) clearTimeout(this.manager.sessionSaveTimer);
    this.manager.sessionSaveTimer = setTimeout(() => this.saveSession(), 500);
  }

  guessAppIdFromWinId(winId) {
    if (!winId) return null;
    const launcher = this.manager.appLauncher;
    if (!launcher) return null;
    const needle = winId.toLowerCase().replace(/[-_\s]/g, "");
    for (const key of Object.keys(launcher)) {
      if (needle.includes(key.toLowerCase())) return key;
    }
    return null;
  }

  async saveSession() {
    if (!this.manager.fs || !this.manager.fs.sessionKey) return;
    const sessionKey = this.manager.fs.sessionKey;
    const sessionPath = `/ys/users/${sessionKey}/system/windowSession.json`;

    const persistenceEnabled = os.storage.get(StorageKeys.windowSessionPersistence) !== "false";
    if (!persistenceEnabled) {
      try {
        const exists = await this.manager.fs.exists(sessionPath);
        if (exists) {
          await this.manager.fs.unlink(sessionPath);
        }
      } catch (e) {}
      return;
    }

    const windowStates = [];
    const sortedWindows = Array.from(this.manager.openWindows.keys())
      .map((id) => document.getElementById(id))
      .filter(Boolean)
      .sort((a, b) => (parseInt(a.style.zIndex) || 0) - (parseInt(b.style.zIndex) || 0));

    for (const win of sortedWindows) {
      const entry = this.manager.openWindows.get(win.id);
      if (!entry || !entry.record) continue;

      const record = entry.record;
      const geom = this.manager.getWindowNormalGeometry(win);
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

      const appId = win.dataset.appId || this.guessAppIdFromWinId(win.id);
      if (appId && !win.dataset.appId) win.dataset.appId = appId;
      if (appId) record.appId = appId;
      if (appId && this.manager.appLauncher) {
        try {
          os.storage.set(`${StorageKeys.geometryPrefix}${appId}`, {
            x: record.x,
            y: record.y,
            width: record.width,
            height: record.height
          });
        } catch (e) {}

        const metadata = SYSTEM_APPS[appId];
        if (!metadata || metadata.persistContentState !== false) {
          const appInstance = this.manager.appLauncher[appId] || this.manager.appLauncher[`${appId}App`];
          if (appInstance && typeof appInstance.getSnapshot === "function") {
            try {
              record.appStateSnapshot = await appInstance.getSnapshot(win.id);
            } catch (e) {
              console.warn(`Failed to get snapshot for app ${appId}:`, e);
            }
          }
        }
      }

      if (this.manager.workspaceManager) {
        let wsId = 0;
        for (const ws of this.manager.workspaceManager.workspaces) {
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
      await this.manager.fs.ensureFolder(["system"]);
      let sessionData = windowStates;
      if (this.manager.workspaceManager) {
        sessionData = {
          windows: windowStates,
          workspaces: this.manager.workspaceManager.workspaces.map((w) => ({ id: w.id, name: w.name })),
          activeWorkspaceId: this.manager.workspaceManager.activeId
        };
      }
      await this.manager.fs.safeWriteFile(sessionPath, JSON.stringify(sessionData));
    } catch (e) {
      console.error("Failed to save window session:", e);
    }
  }

  async restoreSession() {
    if (!this.manager.fs || !this.manager.fs.sessionKey || !this.manager.appLauncher) return;
    const persistenceEnabled = os.storage.get(StorageKeys.windowSessionPersistence) !== "false";
    if (!persistenceEnabled) return;
    this.manager.isRestoring = true;
    const sessionKey = this.manager.fs.sessionKey;
    const sessionPath = `/ys/users/${sessionKey}/system/windowSession.json`;

    try {
      const exists = await this.manager.fs.exists(sessionPath);
      if (!exists) {
        this.manager.isRestoring = false;
        return;
      }

      const data = await this.manager.fs.pRead("readFile", sessionPath, "utf8");
      const parsedData = JSON.parse(data);

      let windowStates = [];
      if (Array.isArray(parsedData)) {
        windowStates = parsedData;
      } else {
        windowStates = parsedData.windows || [];
        if (this.manager.workspaceManager && parsedData.workspaces) {
          this.manager.workspaceManager.workspaces = parsedData.workspaces.map((w) => ({ ...w, windows: new Set() }));
          this.manager.workspaceManager.activeId = parsedData.activeWorkspaceId || 0;
          this.manager.workspaceManager.render();
        }
      }

      if (!Array.isArray(windowStates)) {
        this.manager.isRestoring = false;
        return;
      }

      let heavyAppCount = 0;
      const queue = [];

      for (const state of windowStates) {
        const appId = state.appId || this.guessAppIdFromWinId(state.id);
        if (!appId) continue;

        if (this.isHeavyApp(appId, state.appType)) {
          heavyAppCount++;
          if (heavyAppCount > 4) {
            queue.push({ state, appId });
            continue;
          }
        }
        await this.restoreSingleWindowState(state, appId);
      }

      if (queue.length > 0) {
        this.processRestorationQueue(queue);
      }

      const lastFocused = windowStates.find((s) => s.focused);
      if (lastFocused) {
        const win = document.getElementById(lastFocused.id);
        if (win) this.manager.bringToFront(win);
      }
    } catch (e) {
      console.error("Failed to restore window session:", e);
    } finally {
      this.manager.isRestoring = false;
    }
  }

  isHeavyApp(appId, appType) {
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

  async processRestorationQueue(queue) {
    for (const item of queue) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await this.restoreSingleWindowState(item.state, item.appId);
    }
  }

  async restoreSingleWindowState(state, appId) {
    try {
      const launchOptions = {
        forceId: state.id,
        position: state.snapZone ? undefined : { x: state.x, y: state.y },
        width: state.snapZone ? undefined : state.width,
        height: state.snapZone ? undefined : state.height,
        allowManualPosition: true
      };

      await this.manager.appLauncher.launch(appId, state.appType === "swf", launchOptions);

      const win = document.getElementById(state.id);
      if (win) {
        const entry = this.manager.openWindows.get(state.id);
        if (entry?.record) {
          if (state.preSnapGeometry) {
            entry.record.preSnapGeometry = state.preSnapGeometry;
          }
        }

        if (state.minimized) this.manager.minimizeWindow(win);
        if (state.fullscreen) this.manager.toggleFullscreen(win);
        if (state.snapZone) this.manager.applySnap(win, state.snapZone, true);
        win.style.zIndex = state.zIndex;
        this.manager.zIndexCounter = Math.max(this.manager.zIndexCounter, state.zIndex + 1);

        if (this.manager.workspaceManager && state.workspaceId !== undefined) {
          this.manager.workspaceManager.moveWindowTo(state.id, state.workspaceId);
        }

        const metadata = SYSTEM_APPS[appId];
        const shouldPersistContent = !metadata || metadata.persistContentState !== false;

        if (shouldPersistContent && state.appStateSnapshot) {
          const appInstance = this.manager.appLauncher[state.appId] || this.manager.appLauncher[`${state.appId}App`];
          if (appInstance && typeof appInstance.restoreSnapshot === "function") {
            await appInstance.restoreSnapshot(win.id, state.appStateSnapshot);
          }
        }

        if (shouldPersistContent && state.scrollPosition) {
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
}
