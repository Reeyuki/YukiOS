import { AppSource } from "../AppSource.js";

let _osPromise = null;
let _os = null;

async function getOs() {
  if (_os) return _os;
  if (!_osPromise) {
    _osPromise = import("../os/index.js").then((m) => {
      _os = m.os;
      return _os;
    });
  }
  return _osPromise;
}

export class BaseApp {
  constructor(services = {}) {
    this._services = services;
    if (services.windowManager && !services.windowManager.__isProxied) {
      services.windowManager = new Proxy(services.windowManager, {
        get: (target, prop) => {
          if (prop === "sendNotify") {
            return async (text, appSource = null) => {
              const source = appSource || this._getAppSource();
              const os = await getOs();
              os.notify.send("", text, { appSource: source });
            };
          }
          if (prop === "__isProxied") return true;
          return target[prop];
        }
      });
    }
    this.wm = services.wm || services.windowManager;
    this.fs = services.fs || services.fileSystemManager;
    this.bus = services.bus;
    this.notifications = services.notifications || services.notificationCenter;
    this._isDeclarative = false;
  }

  open(opts) {
    throw new Error(`${this.constructor.name}.open() is not implemented.`);
  }

  getDeclarativeSchema(opts) {
    return null;
  }

  onClose(winId) {}

  getSnapshot(winId) {
    return null;
  }

  restoreSnapshot(winId, data) {}

  async _isSingletonOpen(winId) {
    const existing = document.getElementById(winId);
    if (existing) {
      try {
        const os = await getOs();
        os.window.focus(existing);
      } catch (e) {
        // OS bridge not initialized yet, just focus the window directly
        existing.style.zIndex = "10000";
      }
      return true;
    }
    return false;
  }

  async notify(title, message = "", type = "info", duration = 5000, icon = null, appSource = null) {
    const source = appSource || this._getAppSource();
    const os = await getOs();
    os.notify.send(title, message, { type, duration, icon, appSource: source });
  }

  _getAppSource() {
    const className = this.constructor.name;
    switch (className) {
      case "ClipboardManagerApp":
        return AppSource.CLIPBOARD_MANAGER;
      case "ExplorerApp":
        return AppSource.EXPLORER;
      case "YukiConvertApp":
        return AppSource.YUKI_CONVERT;
      case "YouTubeApp":
        return AppSource.YOUTUBE;
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
      case "CalendarApp":
        return AppSource.CALENDAR;
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
      case "ProfileCustomizerApp":
        return AppSource.PROFILE_CUSTOMIZER;
      case "ShortcutsApp":
        return AppSource.SHORTCUTS;
      case "AppCreatorApp":
        return AppSource.APP_CREATOR;
      case "YukiOsGuideApp":
        return AppSource.YUKI_OS_GUIDE;
      case "AIAssistantApp":
        return AppSource.AI_ASSISTANT;
      case "BrightnessApp":
        return AppSource.BRIGHTNESS;
      default:
        return AppSource.SYSTEM;
    }
  }

  async registerTray(winId, icon, label, options = {}) {
    const os = await getOs();
    os.tray.register(winId, icon, label, options);
  }

  async unregisterTray(winId) {
    const os = await getOs();
    os.tray.unregister(winId);
  }

  async sendToTray(winId) {
    const os = await getOs();
    os.tray.sendToTray(winId);
  }

  async restoreFromTray(winId) {
    const os = await getOs();
    os.tray.restoreFromTray(winId);
  }
}
