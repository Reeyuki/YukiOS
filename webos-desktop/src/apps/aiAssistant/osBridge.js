import { audioMixer } from "../../audioMixer.js";
import { $$, os, StorageKeys } from "../../framework.js";

export class OSBridge {
  constructor(os) {
    this.os = os;
    this.fs = os.fs;
    this.bus = os.events;
    this.appLauncher = null;
    this.permissions = new Map();
  }

  async execute(action) {
    const { action: actionType, target, params } = action;

    if (!this.checkPermission(actionType, target)) {
      audioMixer().playCriticalWarning();
      throw new Error(`Permission denied for ${actionType} on ${target}`);
    }

    switch (actionType) {
      case "open_app":
        return await this.openApp(target, params);
      case "close_app":
        return await this.closeApp(target, params);
      case "focus_window":
        return await this.focusWindow(target, params);
      case "move_window":
        return await this.moveWindow(target, params);
      case "resize_window":
        return await this.resizeWindow(target, params);
      case "switch_workspace":
        return await this.switchWorkspace(target, params);
      case "move_window_to_workspace":
        return await this.moveWindowToWorkspace(target, params);
      case "fs_read":
        return await this.fsRead(target, params);
      case "fs_write":
        return await this.fsWrite(target, params);
      case "emit_event":
        return await this.emitEvent(target, params);
      case "set_theme":
        return await this.setTheme(target, params);
      case "toggle_setting":
        return await this.toggleSetting(target, params);
      default:
        throw new Error(`Unknown action type: ${actionType}`);
    }
  }

  checkPermission(actionType, target) {
    const key = `${actionType}:${target}`;
    if (this.permissions.has(key)) {
      return this.permissions.get(key);
    }

    const dangerousActions = ["fs_write", "close_app"];
    if (dangerousActions.includes(actionType)) {
      return false;
    }

    return true;
  }

  grantPermission(actionType, target) {
    const key = `${actionType}:${target}`;
    this.permissions.set(key, true);
  }

  revokePermission(actionType, target) {
    const key = `${actionType}:${target}`;
    this.permissions.set(key, false);
  }

  async openApp(appId, params) {
    if (!os?.app?.launch) {
      throw new Error("App launcher not available");
    }

    try {
      const resolvedAppId = this.resolveAppId(appId);
      await os.app.launch(resolvedAppId, false, params);
      return { success: true, message: `Opened ${resolvedAppId}` };
    } catch (error) {
      throw new Error(`Failed to open ${appId}: ${error.message}`);
    }
  }

  resolveAppId(appId) {
    const normalized = String(appId || "")
      .trim()
      .toLowerCase();
    const aliases = {
      settings: "settingsApp",
      setting: "settingsApp",
      terminal: "terminal",
      term: "terminal",
      explorer: "explorerApp",
      fileexplorer: "explorerApp",
      files: "explorerApp",
      notepad: "notepad",
      markdown: "markdown",
      code: "monaco",
      monaco: "monaco",
      browser: "browserApp",
      yuki: "browserApp",
      weather: "weatherApp",
      news: "newsApp",
      office: "officeApp",
      camera: "cameraApp",
      calculator: "calculatorApp",
      about: "aboutApp",
      shortcuts: "shortcutsApp",
      setup: "setupApp",
      guide: "yukiOsGuide",
      apps: "installedApps",
      clipboard: "clipboardManager",
      achievements: "achievementsApp",
      profile: "settingsApp",
      convert: "yukiConvert",
      dos: "jsDosApp",
      jsdos: "jsDosApp",
      v86: "v86app",
      emulator: "emulatorApp",
      ruffle: "ruffleApp",
      ai: "aiAssistantApp"
    };
    return aliases[normalized] || appId;
  }

  async closeApp(target, params) {
    const winId = params?.winId || target;

    try {
      if (!os?.window?.close) {
        throw new Error("Window API not available");
      }

      os.window.close(winId);

      return { success: true, message: `Closed ${winId}` };
    } catch (error) {
      throw new Error(`Failed to close ${winId}: ${error.message}`);
    }
  }

  async focusWindow(winId, params) {
    const id = params?.winId || winId;

    try {
      if (!os?.window?.focus) {
        throw new Error("Window API not available");
      }

      os.window.focus(id);

      return { success: true, message: `Focused ${id}` };
    } catch (error) {
      throw new Error(`Failed to focus ${id}: ${error.message}`);
    }
  }

  async moveWindow(winId, params) {
    const id = params?.winId || winId;
    const { x, y } = params || {};

    try {
      if (!os?.window?.move) {
        throw new Error("Window API not available");
      }

      os.window.move(id, x, y);

      return { success: true, message: `Moved ${id} to ${x}, ${y}` };
    } catch (error) {
      throw new Error(`Failed to move ${id}: ${error.message}`);
    }
  }
  async resizeWindow(winId, params) {
    const id = params?.winId || winId;
    const { width, height } = params || {};

    try {
      if (!os?.window?.resize) {
        throw new Error("Window API not available");
      }

      os.window.resize(id, width, height);

      return { success: true, message: `Resized ${id} to ${width}x${height}` };
    } catch (error) {
      throw new Error(`Failed to resize ${id}: ${error.message}`);
    }
  }
  async switchWorkspace(target, params = {}) {
    const workspaceManager = os.tiling?.wm?.workspaceManager;
    if (!workspaceManager) {
      throw new Error("Workspace manager not available");
    }

    const normalizedTarget = String(target || params.direction || "next").toLowerCase();
    const workspaces = workspaceManager.workspaces || [];
    if (workspaces.length === 0) {
      throw new Error("No workspaces available");
    }

    const currentIndex = workspaces.findIndex((ws) => ws.id === workspaceManager.activeId);
    let targetWorkspace = null;

    if (normalizedTarget === "next") {
      targetWorkspace = workspaces[(currentIndex + 1 + workspaces.length) % workspaces.length];
    } else if (normalizedTarget === "prev" || normalizedTarget === "previous") {
      targetWorkspace = workspaces[(currentIndex - 1 + workspaces.length) % workspaces.length];
    } else if (/^\d+$/.test(normalizedTarget)) {
      const numericTarget = Number(normalizedTarget);
      targetWorkspace =
        workspaces.find((ws) => ws.id === numericTarget) ||
        workspaces.find((ws, idx) => idx === Math.max(0, numericTarget - 1));
    } else {
      targetWorkspace = workspaces.find((ws) => ws.name.toLowerCase() === normalizedTarget);
    }

    if (!targetWorkspace) {
      throw new Error(`Workspace "${target}" not found`);
    }

    workspaceManager.switchTo(targetWorkspace.id);
    return {
      success: true,
      message: `Switched to workspace ${targetWorkspace.name}`,
      workspaceId: targetWorkspace.id
    };
  }

  async moveWindowToWorkspace(winId, params = {}) {
    const workspaceManager = os.tiling?.wm?.workspaceManager;
    if (!workspaceManager) {
      throw new Error("Workspace manager not available");
    }

    const windowId = params.winId || winId;
    const workspaceTarget = params.workspaceId ?? params.workspace ?? params.target;
    if (!windowId) {
      throw new Error("Window id is required");
    }
    if (workspaceTarget === undefined || workspaceTarget === null) {
      throw new Error("Target workspace is required");
    }

    const workspaces = workspaceManager.workspaces || [];
    const normalizedTarget = String(workspaceTarget).toLowerCase();
    const targetWorkspace =
      workspaces.find((ws) => ws.id === Number(workspaceTarget)) ||
      workspaces.find((ws) => ws.name.toLowerCase() === normalizedTarget);

    if (!targetWorkspace) {
      throw new Error(`Workspace "${workspaceTarget}" not found`);
    }

    workspaceManager.moveWindowTo(windowId, targetWorkspace.id);
    return {
      success: true,
      message: `Moved ${windowId} to workspace ${targetWorkspace.name}`,
      workspaceId: targetWorkspace.id
    };
  }

  async fsRead(path, params) {
    try {
      if (!os?.fs?.read) {
        throw new Error("FS API not available");
      }

      const content = await os.fs.read(path);

      return { success: true, content, message: `Read ${path}` };
    } catch (error) {
      throw new Error(`Failed to read ${path}: ${error.message}`);
    }
  }

  async fsWrite(path, params) {
    try {
      if (!os?.fs?.write) {
        throw new Error("FS API not available");
      }

      const { content } = params || {};

      await os.fs.write(path, content);

      return { success: true, message: `Wrote to ${path}` };
    } catch (error) {
      throw new Error(`Failed to write to ${path}: ${error.message}`);
    }
  }

  async emitEvent(eventName, params) {
    try {
      if (!os?.events?.emit) {
        throw new Error("Event system not available");
      }

      os.events.emit(eventName, params);

      return { success: true, message: `Emitted event ${eventName}` };
    } catch (error) {
      throw new Error(`Failed to emit event ${eventName}: ${error.message}`);
    }
  }
  async setTheme(themeName, params) {
    try {
      os.storage.set(StorageKeys.theme, themeName);
      os.events.emit("SETTINGS_CHANGED", { theme: themeName });
      return { success: true, message: `Set theme to ${themeName}` };
    } catch (error) {
      throw new Error(`Failed to set theme: ${error.message}`);
    }
  }

  async toggleSetting(settingKey, params) {
    try {
      const currentValue = os.storage.get(settingKey);
      const newValue = currentValue === "true" ? "false" : "true";
      os.storage.set(settingKey, newValue);
      os.events.emit("SETTINGS_CHANGED", { [settingKey]: newValue });
      return { success: true, message: `Toggled ${settingKey} to ${newValue}` };
    } catch (error) {
      throw new Error(`Failed to toggle ${settingKey}: ${error.message}`);
    }
  }

  getSystemState() {
    const windows = $$(".window").map((win) => ({
      id: win.id,
      title: os.window.getTitle(win.id) || "Unknown",
      appId: win.dataset.appId || null,
      visible: win.style.display !== "none",
      minimized: win.style.display === "none"
    }));
    const runningApps = Array.from(new Set(windows.map((win) => win.appId).filter(Boolean)));
    const wsm = os.tiling?.wm?.workspaceManager;
    const workspaceState = wsm
      ? {
          activeId: wsm.activeId,
          items: wsm.workspaces.map((ws) => ({
            id: ws.id,
            name: ws.name,
            windowCount: ws.windows.size
          }))
        }
      : null;

    return {
      windows,
      runningApps,
      workspaces: workspaceState,
      theme: os.storage.get(StorageKeys.theme) || "dark",
      settings: this.getSettings()
    };
  }

  getSettings() {
    const settings = {};
    const knownKeys = Object.values(StorageKeys);
    for (const key of knownKeys) {
      const val = os.storage.get(key);
      if (val !== null && val !== undefined) {
        settings[key] = val;
      }
    }
    return settings;
  }
}
