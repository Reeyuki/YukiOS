import { trayManager } from "../tray.js";
import { AppSource } from "../AppSource.js";

export class BaseApp {
  constructor(services = {}) {
    this._services = services;
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

  _isSingletonOpen(winId) {
    const existing = document.getElementById(winId);
    if (existing) {
      this.wm?.bringToFront(existing);
      return true;
    }
    return false;
  }

  notify(title, message = "", type = "info", duration = 5000, icon = null, appSource = null) {
    if (this.wm?.notify) {
      const source = appSource || this._getAppSource();
      this.wm.notify(title, message, type, duration, icon, source);
    }
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
      case "CategoriesApp":
        return AppSource.CATEGORIES;
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

  registerTray(winId, icon, label, options = {}) {
    trayManager.register(winId, icon, label, options);
  }

  unregisterTray(winId) {
    trayManager.unregister(winId);
  }

  sendToTray(winId) {
    trayManager.sendToTray(winId);
  }

  restoreFromTray(winId) {
    trayManager.restoreFromTray(winId);
  }
}
