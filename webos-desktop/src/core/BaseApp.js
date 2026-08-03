import { AppSource } from "../AppSource.js";
import { os as _os } from "../os/index.js";
import { brand } from "../easterYuri.js";

const PROXIED_MARKER = Symbol("proxied");

export const PersistenceTypes = {
  NONE: "none",
  LOCAL_STORAGE: "localStorage",
  SESSION_STORAGE: "sessionStorage",
  MEMORY: "memory"
};

export class BaseApp {
  constructor(param = {}) {
    if (param.kernel) {
      this.os = param;
      this.services = param;
      this.wm = param.kernel?.windowManager;
      this.fs = param.kernel?.fileSystemManager;
      this.bus = param.events;
      this.notifications = param.notify;
    } else {
      this.os = _os;
      this.services = param;
      if (param.windowManager && !param.windowManager[PROXIED_MARKER]) {
        param.windowManager = new Proxy(param.windowManager, {
          get: (target, prop) => {
            if (prop === "sendNotify") {
              return async (text, appSource = null) => {
                const source = appSource || this.getAppSource();
                _os.notify.send("", text, { appSource: source });
              };
            }
            if (prop === PROXIED_MARKER) return true;
            return target[prop];
          }
        });
      }
      this.wm = param.wm || param.windowManager;
      this.fs = param.fs || param.fileSystemManager;
      this.bus = param.bus;
      this.notifications = param.notifications || param.notificationCenter;
    }
  }

  open(opts) {
    throw new Error(`${this.constructor.name}.open() is not implemented.`);
  }

  onClose(winId) {}

  getSnapshot(winId) {
    return null;
  }

  restoreSnapshot(winId, data) {}

  async isSingletonOpen(winId) {
    const existing = document.getElementById(winId);
    if (existing) {
      if (existing.style.display === "none") {
        existing.style.display = "flex";
        const taskbarItem = document.getElementById(`taskbar-${winId}`);
        if (taskbarItem) {
          taskbarItem.style.display = "";
          taskbarItem.classList.remove("minimized");
        }
        try {
          const os = _os;
          os.tray.restoreFromTray(winId);
        } catch (e) {}
      }
      try {
        const os = _os;
        os.window.focus(existing);
      } catch (e) {
        existing.style.zIndex = "10000";
      }
      return true;
    }
    return false;
  }

  async notify(title, message = "", type = "info", duration = 5000, icon = null, appSource = null) {
    const source = appSource || this.getAppSource();
    const os = _os;
    os.notify.send(title, message, { type, duration, icon, appSource: source });
  }

  getAppSource() {
    const className = this.constructor.name;
    switch (className) {
      case "ClipboardManagerApp":
        return AppSource.CLIPBOARD_MANAGER;
      case "ExplorerApp":
        return AppSource.EXPLORER;
      case "YukiConvertApp":
        return brand(AppSource.YUKI_CONVERT);
      case "SetupApp":
        return AppSource.SETUP;
      case "InstalledAppsApp":
        return AppSource.INSTALLED_APPS;
      case "SettingsApp":
        return AppSource.SETTINGS;
      case "NotepadApp":
        return AppSource.NOTEPAD;
      case "TerminalApp":
        return AppSource.TERMINAL;
      case "BrowserApp":
        return AppSource.BROWSER;
      case "CalculatorApp":
        return AppSource.CALCULATOR;
      case "CameraApp":
        return AppSource.CAMERA;
      case "MarkdownApp":
        return AppSource.MARKDOWN;
      case "OfficeAppProxy":
        return AppSource.OFFICE;
      case "DataEditorApp":
        return AppSource.DATA_EDITOR;
      case "Model3DApp":
        return AppSource.MODEL_3D;
      case "TaskManagerApp":
        return AppSource.TASK_MANAGER;
      case "AchievementsApp":
        return AppSource.ACHIEVEMENTS;
      case "AboutApp":
        return AppSource.ABOUT;
      case "NewsApp":
        return AppSource.NEWS;
      case "WeatherApp":
        return AppSource.WEATHER;
      case "ShortcutsApp":
        return AppSource.SHORTCUTS;
      case "AppCreatorApp":
        return AppSource.APP_CREATOR;
      case "YukiOsGuideApp":
        return brand(AppSource.YUKI_OS_GUIDE);
      case "AIAssistantApp":
        return brand(AppSource.AI_ASSISTANT);
      case "ClockApp":
        return AppSource.CLOCK;
      case "WallpaperEngineApp":
        return AppSource.WALLPAPER_ENGINE;
      case "RobloxApp":
        return AppSource.SYSTEM;
      default:
        return AppSource.SYSTEM;
    }
  }

  async registerTray(winId, icon, label, options = {}) {
    const os = _os;
    os.tray.register(winId, icon, label, options);
  }

  async unregisterTray(winId) {
    const os = _os;
    os.tray.unregister(winId);
  }

  async sendToTray(winId) {
    const os = _os;
    os.tray.sendToTray(winId);
  }

  async restoreFromTray(winId) {
    const os = _os;
    os.tray.restoreFromTray(winId);
  }
}
