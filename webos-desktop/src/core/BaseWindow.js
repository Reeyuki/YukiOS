import { os } from "../framework.js";

export class BaseWindow {
  constructor(windowManager, options = {}) {
    this.wm = windowManager;
    this.options = options;
    this.openWindows = new Set();
  }

  createWindow(winId, title, content, width = "800px", height = "600px", windowOptions = {}) {
    const mergedOptions = { ...this.options, ...windowOptions };
    const win = os.window.create(winId, title, width, height, mergedOptions.isGame, mergedOptions);

    const contentDiv = document.createElement("div");
    contentDiv.className = "window-content";
    contentDiv.style.cssText = "width:100%; height:100%; overflow:hidden;";
    if (typeof content === "string") {
      contentDiv.innerHTML = content;
    } else if (content instanceof DocumentFragment) {
      contentDiv.appendChild(content);
    } else if (content instanceof Element) {
      if (content.classList && content.classList.contains("window-content")) {
        win.appendChild(content);
      } else {
        contentDiv.appendChild(content);
        win.appendChild(contentDiv);
      }
    } else {
      contentDiv.innerHTML = content;
      win.appendChild(contentDiv);
    }

    this.wm.mountWindow(win, winId, title, mergedOptions.icon, mergedOptions.iconColor);
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
