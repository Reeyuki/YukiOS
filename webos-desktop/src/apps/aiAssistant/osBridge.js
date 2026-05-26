export class OSBridge {
  constructor(services) {
    this.services = services;
    this.wm = services.wm || services.windowManager;
    this.fs = services.fs || services.fileSystemManager;
    this.bus = services.bus;
    this.appLauncher = services.appLauncher;
    this.permissions = new Map();
  }

  async execute(action) {
    const { action: actionType, target, params } = action;

    if (!this._checkPermission(actionType, target)) {
      throw new Error(`Permission denied for ${actionType} on ${target}`);
    }

    switch (actionType) {
      case "open_app":
        return await this._openApp(target, params);
      case "close_app":
        return await this._closeApp(target, params);
      case "focus_window":
        return await this._focusWindow(target, params);
      case "move_window":
        return await this._moveWindow(target, params);
      case "resize_window":
        return await this._resizeWindow(target, params);
      case "switch_workspace":
        return await this._switchWorkspace(target, params);
      case "move_window_to_workspace":
        return await this._moveWindowToWorkspace(target, params);
      case "fs_read":
        return await this._fsRead(target, params);
      case "fs_write":
        return await this._fsWrite(target, params);
      case "emit_event":
        return await this._emitEvent(target, params);
      case "set_theme":
        return await this._setTheme(target, params);
      case "toggle_setting":
        return await this._toggleSetting(target, params);
      default:
        throw new Error(`Unknown action type: ${actionType}`);
    }
  }

  _checkPermission(actionType, target) {
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

  async _openApp(appId, params) {
    if (!this.appLauncher) {
      throw new Error("AppLauncher not available");
    }

    try {
      const resolvedAppId = this._resolveAppId(appId);
      await this.appLauncher.launch(resolvedAppId, false, params);
      return { success: true, message: `Opened ${resolvedAppId}` };
    } catch (error) {
      throw new Error(`Failed to open ${appId}: ${error.message}`);
    }
  }

  _resolveAppId(appId) {
    const normalized = String(appId || "")
      .trim()
      .toLowerCase();
    const aliases = {
      settings: "settingsApp",
      setting: "settingsApp",
      terminal: "terminal",
      term: "terminal",
      explorer: "explorer",
      fileexplorer: "explorer",
      files: "explorer",
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
      profile: "profileCustomizer",
      convert: "yukiConvert",
      dos: "jsDosApp",
      jsdos: "jsDosApp",
      v86: "v86app",
      emulator: "emulatorApp",
      ruffle: "ruffleApp",
      ai: "aiAssistant"
    };
    return aliases[normalized] || appId;
  }

  async _closeApp(target, params) {
    if (!this.wm) {
      throw new Error("WindowManager not available");
    }

    const winId = params.winId || target;
    const win = document.getElementById(winId);

    if (!win) {
      throw new Error(`Window ${winId} not found`);
    }

    try {
      this.wm.closeWindow(win);
      return { success: true, message: `Closed ${winId}` };
    } catch (error) {
      throw new Error(`Failed to close ${winId}: ${error.message}`);
    }
  }

  async _focusWindow(winId, params) {
    if (!this.wm) {
      throw new Error("WindowManager not available");
    }

    const win = document.getElementById(winId);
    if (!win) {
      throw new Error(`Window ${winId} not found`);
    }

    try {
      this.wm.bringToFront(win);
      return { success: true, message: `Focused ${winId}` };
    } catch (error) {
      throw new Error(`Failed to focus ${winId}: ${error.message}`);
    }
  }

  async _moveWindow(winId, params) {
    if (!this.wm) {
      throw new Error("WindowManager not available");
    }

    const win = document.getElementById(winId);
    if (!win) {
      throw new Error(`Window ${winId} not found`);
    }

    try {
      const { x, y } = params;
      win.style.left = x;
      win.style.top = y;
      return { success: true, message: `Moved ${winId} to ${x}, ${y}` };
    } catch (error) {
      throw new Error(`Failed to move ${winId}: ${error.message}`);
    }
  }

  async _resizeWindow(winId, params) {
    if (!this.wm) {
      throw new Error("WindowManager not available");
    }

    const win = document.getElementById(winId);
    if (!win) {
      throw new Error(`Window ${winId} not found`);
    }

    try {
      const { width, height } = params;
      win.style.width = width;
      win.style.height = height;
      return { success: true, message: `Resized ${winId} to ${width}x${height}` };
    } catch (error) {
      throw new Error(`Failed to resize ${winId}: ${error.message}`);
    }
  }

  async _switchWorkspace(target, params = {}) {
    const workspaceManager = this.wm?.workspaceManager;
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

  async _moveWindowToWorkspace(winId, params = {}) {
    const workspaceManager = this.wm?.workspaceManager;
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

  async _fsRead(path, params) {
    if (!this.fs) {
      throw new Error("FileSystemManager not available");
    }

    try {
      if (this.fs.fsReady) {
        await this.fs.fsReady;
      }

      const content = await this.fs.readFile(path);
      return { success: true, content, message: `Read ${path}` };
    } catch (error) {
      throw new Error(`Failed to read ${path}: ${error.message}`);
    }
  }

  async _fsWrite(path, params) {
    if (!this.fs) {
      throw new Error("FileSystemManager not available");
    }

    try {
      if (this.fs.fsReady) {
        await this.fs.fsReady;
      }

      const { content } = params;
      await this.fs.safeWriteFile(path, content);
      return { success: true, message: `Wrote to ${path}` };
    } catch (error) {
      throw new Error(`Failed to write to ${path}: ${error.message}`);
    }
  }

  async _emitEvent(eventName, params) {
    if (!this.bus) {
      throw new Error("EventBus not available");
    }

    try {
      this.bus.emit(eventName, params);
      return { success: true, message: `Emitted event ${eventName}` };
    } catch (error) {
      throw new Error(`Failed to emit event ${eventName}: ${error.message}`);
    }
  }

  async _setTheme(themeName, params) {
    try {
      localStorage.setItem("theme", themeName);
      this.bus.emit("SETTINGS_CHANGED", { theme: themeName });
      return { success: true, message: `Set theme to ${themeName}` };
    } catch (error) {
      throw new Error(`Failed to set theme: ${error.message}`);
    }
  }

  async _toggleSetting(settingKey, params) {
    try {
      const currentValue = localStorage.getItem(settingKey);
      const newValue = currentValue === "true" ? "false" : "true";
      localStorage.setItem(settingKey, newValue);
      this.bus.emit("SETTINGS_CHANGED", { [settingKey]: newValue });
      return { success: true, message: `Toggled ${settingKey} to ${newValue}` };
    } catch (error) {
      throw new Error(`Failed to toggle ${settingKey}: ${error.message}`);
    }
  }

  getSystemState() {
    const windows = Array.from(document.querySelectorAll(".window")).map((win) => ({
      id: win.id,
      title: win.querySelector(".window-header span")?.textContent || "Unknown",
      appId: win.dataset.appId || null,
      visible: win.style.display !== "none",
      minimized: win.style.display === "none"
    }));
    const runningApps = Array.from(new Set(windows.map((win) => win.appId).filter(Boolean)));
    const workspaceState = this.wm?.workspaceManager
      ? {
          activeId: this.wm.workspaceManager.activeId,
          items: this.wm.workspaceManager.workspaces.map((ws) => ({
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
      theme: localStorage.getItem("theme") || "dark",
      settings: this._getSettings()
    };
  }

  _getSettings() {
    const settings = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith("yuki_") || key.startsWith("theme")) {
        settings[key] = localStorage.getItem(key);
      }
    }
    return settings;
  }
}
