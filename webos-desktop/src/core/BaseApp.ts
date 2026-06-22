import { AppSource } from "../AppSource.js";

let _osPromise: Promise<any> | null = null;
let _os: any = null;

async function getOs(): Promise<any> {
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
  protected _services: Record<string, any>;
  protected wm: any;
  protected fs: any;
  protected bus: any;
  protected notifications: any;
  protected _isDeclarative: boolean;

  constructor(services: Record<string, any> = {}) {
    this._services = services;
    if (services.windowManager && !services.windowManager.__isProxied) {
      services.windowManager = new Proxy(services.windowManager, {
        get: (target: any, prop: string) => {
          if (prop === "sendNotify") {
            return async (text: string, appSource: string | null = null) => {
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

  open(opts?: any): any {
    throw new Error(`${this.constructor.name}.open() is not implemented.`);
  }

  getDeclarativeSchema(opts?: any): any {
    return null;
  }

  onClose(winId: string): void {}

  getSnapshot(winId: string): any {
    return null;
  }

  restoreSnapshot(winId: string, data: any): void {}

  async _isSingletonOpen(winId: string): Promise<boolean> {
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
          const os = await getOs();
          os.tray.restoreFromTray(winId);
        } catch (e) {}
      }
      try {
        const os = await getOs();
        os.window.focus(existing);
      } catch (e) {
        existing.style.zIndex = "10000";
      }
      return true;
    }
    return false;
  }

  async notify(
    title: string,
    message: string = "",
    type: string = "info",
    duration: number = 5000,
    icon: string | null = null,
    appSource: string | null = null
  ): Promise<void> {
    const source = appSource || this._getAppSource();
    const os = await getOs();
    os.notify.send(title, message, { type, duration, icon, appSource: source });
  }

  _getAppSource(): string {
    const className = this.constructor.name;
    switch (className) {
      case "ClipboardManagerApp":
        return AppSource.CLIPBOARD_MANAGER;
      case "ExplorerApp":
        return AppSource.EXPLORER;
      case "YukiConvertApp":
        return AppSource.YUKI_CONVERT;
      case "youtubeUtilsApp":
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
      case "AccountManagerApp":
        return AppSource.ACCOUNT_MANAGER;
      case "ShortcutsApp":
        return AppSource.SHORTCUTS;
      case "AppCreatorApp":
        return AppSource.APP_CREATOR;
      case "YukiOsGuideApp":
        return AppSource.YUKI_OS_GUIDE;
      case "AIAssistantApp":
        return AppSource.AI_ASSISTANT;
      case "ClockApp":
        return AppSource.CLOCK;
      case "BrightnessApp":
        return AppSource.BRIGHTNESS;
      default:
        return AppSource.SYSTEM;
    }
  }

  async registerTray(winId: string, icon: string, label: string, options: Record<string, any> = {}): Promise<void> {
    const os = await getOs();
    os.tray.register(winId, icon, label, options);
  }

  async unregisterTray(winId: string): Promise<void> {
    const os = await getOs();
    os.tray.unregister(winId);
  }

  async sendToTray(winId: string): Promise<void> {
    const os = await getOs();
    os.tray.sendToTray(winId);
  }

  async restoreFromTray(winId: string): Promise<void> {
    const os = await getOs();
    os.tray.restoreFromTray(winId);
  }
}
