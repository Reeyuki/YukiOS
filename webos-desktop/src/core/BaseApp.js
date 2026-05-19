import { trayManager } from "../tray.js";

export class BaseApp {
  constructor(services = {}) {
    this._services = services;
    this.wm = services.wm || services.windowManager;
    this.fs = services.fs || services.fileSystemManager;
    this.bus = services.bus;
    this.notifications = services.notifications || services.notificationCenter;
  }

  open(opts) {
    throw new Error(`${this.constructor.name}.open() is not implemented.`);
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

  notify(title, message = "", type = "info", duration = 5000, icon = null) {
    if (this.wm?.notify) {
      this.wm.notify(title, message, type, duration, icon);
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
