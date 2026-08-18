import { audioMixer } from "../../audioMixer.js";
import { $$, os, StorageKeys, APP_MANIFESTS } from "../../framework.js";
import { applyTheme } from "../../settings/settingsApply.js";
import { SystemUtilities } from "../../system.js";
import {
  WALLPAPER_NAME_URL_PAIRS,
  MAC_WALLPAPER_NAME_URL_PAIRS,
  CHROME_OS_WALLPAPER_NAME_URL_PAIRS
} from "../../wallpaperConfig.js";
import { videos, videos2 } from "../../wallpaperList.js";
import { getRecentNews } from "../news.js";
import { getAchievementCatalog } from "../../achievements.js";
import { appMap as gamesAppMap } from "../../games/gamesList.js";
import { getAllThemes, getThemeColors, addCustomTheme } from "../../shared/themeEngine.js";

export class OSBridge {
  constructor(os) {
    this.os = os;
    this.fs = os.fs;
    this.bus = os.events;
    this.appLauncher = null;
  }

  async execute(action) {
    const { action: actionType, target, params } = action;
    console.log(`[AI Assistant] Executing action: ${actionType}, target: ${target}`, params);

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
      case "fs_readdir":
        return await this.fsReaddir(target, params);
      case "fs_write":
        return await this.fsWrite(target, params);
      case "emit_event":
        return await this.emitEvent(target, params);
      case "set_theme":
        return await this.setTheme(target, params);
      case "toggle_setting":
        return await this.toggleSetting(target, params);
      case "set_volume":
        return await this.setVolume(target, params);
      case "get_volume":
        return await this.getVolume(target, params);
      case "set_wallpaper":
        return await this.setWallpaper(target, params);
      case "list_wallpapers":
        return await this.listWallpapers(target, params);
      case "send_notification":
        return await this.sendNotification(target, params);
      case "clear_notifications":
        return await this.clearNotifications(target, params);
      case "get_notifications":
        return await this.getNotifications(target, params);
      case "toggle_dnd":
        return await this.toggleDnd(target, params);
      case "take_screenshot":
        return await this.takeScreenshot(target, params);
      case "switch_mode":
        return await this.switchMode(target, params);
      case "get_modes":
        return await this.getModes(target, params);
      case "lock_session":
        return await this.lockSession(target, params);
      case "show_desktop":
        return await this.showDesktop(target, params);
      case "get_tray_items":
        return await this.getTrayItems(target, params);
      case "get_achievements":
        return await this.getAchievements(target, params);
      case "list_themes":
        return await this.listThemes(target, params);
      case "get_theme_details":
        return await this.getThemeDetails(target, params);
      case "create_theme":
        return await this.createTheme(target, params);
      case "list_apps":
        return await this.listApps(target, params);
      case "list_games":
        return await this.listGames(target, params);
      case "get_news":
        return await this.getNews(target, params);
      default:
        throw new Error(`Unknown action type: ${actionType}`);
    }
  }

  async openApp(appId, params) {
    if (!os?.app?.launch) {
      throw new Error("App launcher not available");
    }

    const resolvedAppId = this.resolveAppId(appId);
    console.log(`[AI Assistant] Opening app: ${appId} -> ${resolvedAppId}`);

    try {
      await os.app.launch(resolvedAppId);
      console.log(`[AI Assistant] App launched: ${resolvedAppId}`);
      return { success: true, message: `Opened ${resolvedAppId}` };
    } catch (error) {
      console.error(`[AI Assistant] Failed to open app ${resolvedAppId}:`, error);
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
      terminal: "terminalApp",
      term: "terminalApp",
      explorer: "explorerApp",
      fileexplorer: "explorerApp",
      files: "explorerApp",
      notepad: "notepadApp",
      markdown: "markdownApp",
      code: "monacoApp",
      monaco: "monacoApp",
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
      guide: "yukiOsGuideApp",
      apps: "systemAppsApp",
      clipboard: "clipboardManagerApp",
      achievements: "achievementsApp",
      profile: "settingsApp",
      convert: "yukiConvertApp",
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
      console.log(`[AI Assistant] Read file ${path}, length: ${String(content).length}`);

      return { success: true, content, message: `Read ${path}` };
    } catch (error) {
      console.error(`[AI Assistant] Failed to read ${path}:`, error);
      throw new Error(`Failed to read ${path}: ${error.message}`);
    }
  }

  async fsReaddir(path, params) {
    try {
      if (!os?.fs?.readdir) {
        throw new Error("FS readdir API not available");
      }

      const entries = await os.fs.readdir(path);
      console.log(`[AI Assistant] Listed directory ${path}, entries:`, entries);

      const listing = Array.isArray(entries)
        ? entries.map((e) => (typeof e === "string" ? e : e.name || JSON.stringify(e))).join("\n")
        : String(entries);

      return { success: true, content: listing, message: `Listed ${path}` };
    } catch (error) {
      console.error(`[AI Assistant] Failed to list directory ${path}:`, error);
      throw new Error(`Failed to list ${path}: ${error.message}`);
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
      const themes = getAllThemes();
      const themeExists = themes.some((t) => t.value === themeName);
      if (!themeExists) {
        throw new Error(`Theme "${themeName}" not found. Available themes: ${themes.map((t) => t.value).join(", ")}`);
      }
      os.storage.set(StorageKeys.theme, themeName);
      applyTheme(themeName, () => null);
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

  async setVolume(target, params) {
    try {
      const mixer = audioMixer();
      let value;
      const action = String(target || "up").toLowerCase();
      if (action === "up") {
        value = Math.min(1, mixer.masterVolume + 0.1);
      } else if (action === "down") {
        value = Math.max(0, mixer.masterVolume - 0.1);
      } else if (action === "mute") {
        value = 0;
      } else if (action === "unmute") {
        value = mixer.masterVolume === 0 ? 0.8 : mixer.masterVolume;
      } else {
        value = Math.max(0, Math.min(1, Number(action) / 100));
      }
      if (params?.winId) {
        mixer.setChannel(params.winId, value);
      } else {
        mixer.setMaster(value);
      }
      return { success: true, message: `Volume set to ${Math.round(value * 100)}%` };
    } catch (error) {
      throw new Error(`Failed to set volume: ${error.message}`);
    }
  }

  async getVolume(target, params) {
    try {
      const mixer = audioMixer();
      const percent = Math.round(mixer.masterVolume * 100);
      return { success: true, message: `Volume is ${percent}%, muted: ${mixer.muted}`, content: `${percent}%` };
    } catch (error) {
      throw new Error(`Failed to get volume: ${error.message}`);
    }
  }

  async setWallpaper(target, params) {
    try {
      let name = String(target || "").trim();
      if (!name) {
        throw new Error("Wallpaper name is required");
      }
      name = name
        .replace(/^static:/i, "")
        .replace(/^mac:/i, "")
        .replace(/^chromeos:/i, "")
        .trim();
      let url = null;
      if (/^(https?:\/\/|vanta)/i.test(name)) {
        url = name;
      } else {
        const normalized = name.toLowerCase();
        const allPairs = [
          ...WALLPAPER_NAME_URL_PAIRS,
          ...MAC_WALLPAPER_NAME_URL_PAIRS,
          ...CHROME_OS_WALLPAPER_NAME_URL_PAIRS
        ];
        const match = allPairs.find((pair) => pair.name.toLowerCase().includes(normalized));
        if (match) {
          url = match.url;
        }
      }
      if (!url) {
        const available = [
          ...WALLPAPER_NAME_URL_PAIRS.map((pair) => pair.name),
          ...MAC_WALLPAPER_NAME_URL_PAIRS.map((pair) => `mac: ${pair.name}`),
          ...CHROME_OS_WALLPAPER_NAME_URL_PAIRS.map((pair) => `chromeos: ${pair.name}`)
        ].join(", ");
        throw new Error(`Wallpaper "${name}" not found. Available: ${available}`);
      }
      await SystemUtilities.setWallpaper(url);
      return { success: true, message: `Set wallpaper to ${name}` };
    } catch (error) {
      throw new Error(`Failed to set wallpaper: ${error.message}`);
    }
  }

  async listWallpapers(target, params) {
    const category = String(target || "all").toLowerCase();
    const lines = [];
    const addPairs = (pairs, prefix) => {
      for (const pair of pairs) {
        lines.push(prefix ? `${prefix} ${pair.name}` : pair.name);
      }
    };
    if (category === "all" || category === "static") {
      addPairs(WALLPAPER_NAME_URL_PAIRS, "");
    }
    if (category === "all" || category === "mac") {
      addPairs(MAC_WALLPAPER_NAME_URL_PAIRS, "mac:");
    }
    if (category === "all" || category === "chromeos") {
      addPairs(CHROME_OS_WALLPAPER_NAME_URL_PAIRS, "chromeos:");
    }
    if (category === "all" || category === "video") {
      for (const video of [...videos, ...videos2]) {
        lines.push(video.split("/").pop());
      }
    }
    return { success: true, message: `Listed ${category} wallpapers`, content: lines.join("\n") };
  }

  async sendNotification(title, params) {
    try {
      os.notify.send(title, params?.message || "", {
        type: params?.type || "info",
        duration: params?.duration || 5000,
        icon: params?.icon
      });
      return { success: true, message: `Sent notification: ${title}` };
    } catch (error) {
      throw new Error(`Failed to send notification: ${error.message}`);
    }
  }

  async clearNotifications(target, params) {
    try {
      if (target && target !== "all") {
        os.notify.clear(target);
      } else {
        os.notify.clearAll();
      }
      return { success: true, message: `Cleared notifications` };
    } catch (error) {
      throw new Error(`Failed to clear notifications: ${error.message}`);
    }
  }

  async getNotifications(target, params) {
    try {
      const all = os.notify.getAll() || [];
      const content = all.map((n) => `${n.id}: ${n.title} - ${n.message}`).join("\n");
      return { success: true, message: `Found ${all.length} notifications`, content };
    } catch (error) {
      throw new Error(`Failed to get notifications: ${error.message}`);
    }
  }

  async toggleDnd(target, params) {
    try {
      const current = os.notify.getDoNotDisturb();
      let enabled;
      const action = String(target || "").toLowerCase();
      if (action === "on") {
        enabled = true;
      } else if (action === "off") {
        enabled = false;
      } else {
        enabled = !current;
      }
      os.notify.setDoNotDisturb(enabled);
      return { success: true, message: `Do not disturb ${enabled ? "enabled" : "disabled"}` };
    } catch (error) {
      throw new Error(`Failed to toggle do not disturb: ${error.message}`);
    }
  }

  async takeScreenshot(target, params) {
    try {
      os.app.takeScreenshot(true);
      os.achievements.incrementScreenshotTaken();
      return { success: true, message: "Screenshot captured" };
    } catch (error) {
      throw new Error(`Failed to take screenshot: ${error.message}`);
    }
  }

  async switchMode(target, params) {
    try {
      let mode = String(target || "")
        .toLowerCase()
        .replace(/\s+/g, "")
        .trim();
      mode = mode === "chromeos" || mode === "chromeos" ? mode : mode === "chromeos" ? mode : mode;
      const aliases = {
        chromeos: "chromeos",
        chromeosmode: "chromeos",
        macos: "mac",
        mac: "mac",
        tiling: "tiling",
        "3d": "3d",
        steamdeck: "steamdeck"
      };
      const normalized = aliases[mode] || mode;
      const validModes = ["mac", "tiling", "chromeos", "steamdeck", "3d"];
      if (!validModes.includes(normalized)) {
        throw new Error(`Unknown mode "${target}". Valid modes: ${validModes.join(", ")}`);
      }
      os.modes.enter(normalized);
      return { success: true, message: `Switched to mode ${normalized}` };
    } catch (error) {
      throw new Error(`Failed to switch mode: ${error.message}`);
    }
  }

  async getModes(target, params) {
    try {
      const active = os.modes.getActiveModes() || [];
      return {
        success: true,
        message: `Active modes: ${active.join(", ") || "none"}`,
        content: active.join(", ") || "none"
      };
    } catch (error) {
      throw new Error(`Failed to get modes: ${error.message}`);
    }
  }

  async lockSession(target, params) {
    try {
      os.app.lockSession();
      return { success: true, message: "Session locked" };
    } catch (error) {
      throw new Error(`Failed to lock session: ${error.message}`);
    }
  }

  async showDesktop(target, params) {
    try {
      const windows = $$(".window");
      for (const win of windows) {
        if (win.dataset.fullscreen === "true") continue;
        os.window.minimize(win.id);
      }
      return { success: true, message: `Minimized ${windows.length} windows` };
    } catch (error) {
      throw new Error(`Failed to show desktop: ${error.message}`);
    }
  }

  async getTrayItems(target, params) {
    try {
      const items = os.tray.getTrayItems() || new Map();
      const content = [];
      for (const [winId, item] of items) {
        content.push(`${winId}: ${item?.label || item?.title || winId}`);
      }
      return { success: true, message: `Found ${items.size} tray items`, content: content.join("\n") };
    } catch (error) {
      throw new Error(`Failed to get tray items: ${error.message}`);
    }
  }

  async getAchievements(target, params) {
    try {
      const catalog = getAchievementCatalog() || [];
      return {
        success: true,
        message: `Found ${catalog.length} achievements`,
        content: catalog.map((a) => a.title).join("\n")
      };
    } catch (error) {
      throw new Error(`Failed to get achievements: ${error.message}`);
    }
  }

  async listThemes(target, params) {
    try {
      const themes = getAllThemes();
      return {
        success: true,
        message: `Found ${themes.length} themes`,
        content: themes.map((t) => `${t.value}: ${t.label} (${t.category})`).join("\n")
      };
    } catch (error) {
      throw new Error(`Failed to list themes: ${error.message}`);
    }
  }

  async getThemeDetails(target, params) {
    try {
      const colors = getThemeColors(target);
      if (!colors) {
        throw new Error(`Theme ${target} not found`);
      }
      const content = Object.entries(colors)
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n");
      return { success: true, message: `Theme ${target} colors`, content };
    } catch (error) {
      throw new Error(`Failed to get theme details: ${error.message}`);
    }
  }

  async createTheme(label, params) {
    try {
      const name = String(label || "").trim();
      if (!name) {
        throw new Error("Theme label is required");
      }
      const colors = params?.colors || {};
      const brand = colors.brand || "#7c5cff";
      const bg = colors.bg || colors["bg-primary"] || "#121018";
      const text = colors.text || colors["text-primary"] || "#f0edf8";
      const value = "custom-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const themeColors = {
        brand,
        "bg-primary": bg,
        "bg-secondary": bg,
        "text-primary": text,
        "text-secondary": text
      };
      try {
        addCustomTheme({ value, label: name, colors: themeColors });
      } catch (error) {
        throw new Error(`Theme "${name}" already exists (${value}). Choose a different label.`);
      }
      os.storage.set(StorageKeys.theme, value);
      applyTheme(value, () => null);
      return { success: true, message: `Created and applied theme ${name}` };
    } catch (error) {
      throw new Error(`Failed to create theme: ${error.message}`);
    }
  }

  async listApps(target, params) {
    try {
      const category = String(target || "all").toLowerCase();
      const filtered =
        category === "all"
          ? APP_MANIFESTS
          : APP_MANIFESTS.filter((app) => String(app.category || "").toLowerCase() === category);
      return {
        success: true,
        message: `Found ${filtered.length} apps`,
        content: filtered.map((app) => `${app.serviceKey}: ${app.title} (${app.category})`).join("\n")
      };
    } catch (error) {
      throw new Error(`Failed to list apps: ${error.message}`);
    }
  }

  async listGames(target, params) {
    try {
      const ids = Object.keys(gamesAppMap);
      return {
        success: true,
        message: `Found ${ids.length} games`,
        content: ids.map((id) => `${id}: ${gamesAppMap[id]?.title || id}`).join("\n")
      };
    } catch (error) {
      throw new Error(`Failed to list games: ${error.message}`);
    }
  }

  async getNews(target, params) {
    try {
      const count = Math.max(1, Math.min(10, Number(target) || 3));
      const items = getRecentNews(count);
      return {
        success: true,
        message: `Found ${items.length} news items`,
        content: items.map((item) => `${item.date}: ${item.label}`).join("\n")
      };
    } catch (error) {
      throw new Error(`Failed to get news: ${error.message}`);
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
