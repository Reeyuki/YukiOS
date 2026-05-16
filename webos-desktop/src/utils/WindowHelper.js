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

    const headerHTML = this.createWindowHeader(title, options.externalUrl);
    const contentHTML = typeof content === "string" ? content : this.createWindowContent(content);

    win.innerHTML = headerHTML + contentHTML;

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

    return win;
  }

  createAndMountWindow(winId, title, content, width = "800px", height = "600px", options = {}) {
    const win = this.createWindowWithContent(winId, title, content, width, height, options);
    return this.mountWindow(win, winId, title, options.icon, options);
  }
}
