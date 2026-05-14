import { WindowHelper } from "../utils/WindowHelper.js";

export class BaseWindow {
  constructor(windowManager, options = {}) {
    this.wm = windowManager;
    this.windowHelper = new WindowHelper(windowManager);
    this.options = options;
    this.openWindows = new Set();
  }

  createWindow(winId, title, content, width = "800px", height = "600px", windowOptions = {}) {
    const mergedOptions = { ...this.options, ...windowOptions };
    const win = this.windowHelper.createAndMountWindow(winId, title, content, width, height, mergedOptions);

    this.openWindows.add(winId);
    return win;
  }

  createIframeWindow(winId, title, url, width = "900px", height = "600px", windowOptions = {}) {
    const content = `<iframe src="${url}" style="width:100%;height:100%;border:none;" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>`;
    return this.createWindow(winId, title, content, width, height, {
      ...windowOptions,
      externalUrl: url
    });
  }

  onClose(winId) {
    this.openWindows.delete(winId);
  }

  isOpen(winId) {
    return this.openWindows.has(winId);
  }

  getOpenWindows() {
    return Array.from(this.openWindows);
  }

  closeWindow(winId) {
    const win = document.getElementById(winId);
    if (win) {
      win.remove();
      this.onClose(winId);
    }
  }

  closeAllWindows() {
    this.openWindows.forEach((winId) => this.closeWindow(winId));
  }
}
