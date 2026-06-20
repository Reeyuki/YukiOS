import { animateWindowOpen } from "../windowManager/AnimationSystem.js";
import { os } from "../os/index.js";
import { resolveIconUrl } from "../shared/assetResolver.js";
import { isImageFile } from "../fileDisplay.js";

export class WindowHelper {
  constructor(servicesOrWM) {
    this.wm = servicesOrWM.windowManager || servicesOrWM.wm || servicesOrWM;
  }

  createStandardWindow(winId, title, width = "800px", height = "600px", options = {}) {
    const win = os.window.create(winId, title, width, height, options.isGame, options);

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

    if (options.externalUrl) {
      win.dataset.externalUrl = options.externalUrl;
    }
    const headerDiv = document.createElement("div");
    headerDiv.innerHTML = this.createWindowHeader(title, options.icon, options.externalUrl);
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

  getWindowIconHtml(iconValue) {
    if (!iconValue) return "";
    iconValue = resolveIconUrl(iconValue);
    const size = 25;
    const isDataUrl = typeof iconValue === "string" && iconValue.startsWith("data:");
    const isHttpUrl = typeof iconValue === "string" && /^https?:\/\//.test(iconValue);
    const isImage = isImageFile(iconValue) || isHttpUrl;

    if (isImage || isDataUrl) {
      return `<img src="${iconValue}" style="width:${size}px;height:${size}px;margin-right:6px;vertical-align:middle;object-fit:contain;" />`;
    } else if (typeof iconValue === "string" && iconValue.length > 0) {
      const cls = iconValue.startsWith("fa") ? iconValue : `fa ${iconValue}`;
      return `<i class="${cls}" style="color:white;margin-right:6px;font-size:${size}px;vertical-align:middle;"></i>`;
    }
    return "";
  }

  createWindowHeader(title, icon = null, externalUrl = null) {
    const iconHtml = this.getWindowIconHtml(icon);
    return `
      <div class="window-header">
        <span>${iconHtml}${title}</span>
        ${os.window.getWindowControls(externalUrl)}
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

    // If window with this ID already exists in DOM, remove it and its taskbar entry to prevent duplicates
    const existing = document.getElementById(winId);
    if (existing && existing !== win) {
      const taskbarItem = document.getElementById(`taskbar-${winId}`);
      if (taskbarItem) taskbarItem.remove();
      existing.remove();
    }

    desktop.appendChild(win);

    if (options.addToTaskbar !== false) {
      os.window.addToTaskbar(winId, title, icon || "fas fa-window-maximize", options.iconColor);
    }

    if (options.bringToFront !== false) {
      os.window.focus(win);
    }

    // Exclude browser app from animations
    if (!win.id || !win.id.startsWith("browser-app-")) {
      requestAnimationFrame(() => animateWindowOpen(win, false));
    }

    return win;
  }

  createAndMountWindow(winId, title, content, width = "800px", height = "600px", options = {}) {
    const win = this.createWindowWithContent(winId, title, content, width, height, options);
    return this.mountWindow(win, winId, title, options.icon, options);
  }
}
