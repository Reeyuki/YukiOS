import { animateWindowOpen } from "../windowManager/AnimationSystem.js";

export class WindowHelper {
  constructor(servicesOrWM) {
    this.wm = servicesOrWM.windowManager || servicesOrWM.wm || servicesOrWM;
  }

  createStandardWindow(winId, title, width = "800px", height = "600px", options = {}) {
    const win = this.wm.createWindow(winId, title, width, height, options.isGame, options);

    if (options.className) {
      win.classList.add(options.className);
    }

    if (options.style) {
      Object.assign(win.style, options.style);
    }

    return win;
  }

  createWindowWithContent(winId, title, content, width = "800px", height = "600px", options = {}) {
    const win = this.createStandardWindow(winId, title, width, height, options);

    const headerDiv = document.createElement("div");
    headerDiv.innerHTML = this.createWindowHeader(title, options.externalUrl);
    win.appendChild(headerDiv);

    if (typeof content === "string") {
      const contentDiv = document.createElement("div");
      contentDiv.className = "window-content";
      contentDiv.style.cssText = "width:100%; height:100%; overflow:hidden;";
      contentDiv.innerHTML = content;
      win.appendChild(contentDiv);
    } else if (content instanceof DocumentFragment) {
      const contentDiv = document.createElement("div");
      contentDiv.className = "window-content";
      contentDiv.style.cssText = "width:100%; height:100%; overflow:hidden;";
      contentDiv.appendChild(content);
      win.appendChild(contentDiv);
    } else if (content instanceof Element) {
      if (content.classList && content.classList.contains("window-content")) {
        win.appendChild(content);
      } else {
        const contentDiv = document.createElement("div");
        contentDiv.className = "window-content";
        contentDiv.style.cssText = "width:100%; height:100%; overflow:hidden;";
        contentDiv.appendChild(content);
        win.appendChild(contentDiv);
      }
    } else {
      const contentDiv = document.createElement("div");
      contentDiv.className = "window-content";
      contentDiv.style.cssText = "width:100%; height:100%; overflow:hidden;";
      contentDiv.innerHTML = content;
      win.appendChild(contentDiv);
    }

    return win;
  }

  createWindowHeader(title, externalUrl = null) {
    return `
      <div class="window-header">
        <span>${title}</span>
        ${this.wm.getWindowControls(externalUrl)}
      </div>
    `;
  }

  createWindowContent(content) {
    return `
      <div class="window-content" style="width:100%; height:100%; overflow:hidden;">
        ${content}
      </div>
    `;
  }

  mountWindow(win, winId, title, icon = null, options = {}) {
    const desktop = document.getElementById("desktop") || document.body;
    desktop.appendChild(win);

    this.wm.makeDraggable(win);
    this.wm.makeResizable(win, options.resizeOptions);

    if (options.setupWindowControls !== false) {
      this.wm.setupWindowControls(win);
    }

    if (options.addToTaskbar !== false) {
      this.wm.addToTaskbar(winId, title, icon || "fas fa-window-maximize", options.iconColor);
    }

    if (options.bringToFront !== false) {
      this.wm.bringToFront(win);
    }

    requestAnimationFrame(() => animateWindowOpen(win));

    return win;
  }

  createAndMountWindow(winId, title, content, width = "800px", height = "600px", options = {}) {
    const win = this.createWindowWithContent(winId, title, content, width, height, options);
    return this.mountWindow(win, winId, title, options.icon, options);
  }
}
