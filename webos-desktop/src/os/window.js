import { windowMakeDraggable } from "../windowManager/makeDraggable.js";
import { animateWindowOpen } from "../windowManager/AnimationSystem.js";
import { sanitizeTitle } from "../utils/utils.js";
import { $ } from "../shared/domUtils.js";

export class WindowAPI {
  constructor(windowManager) {
    this.wm = windowManager;
  }

  waitFor(win, condition, callback, timeoutMs = 100) {
    let handled = false;
    const obs = new MutationObserver(() => {
      if (!handled && condition()) {
        handled = true;
        callback();
        obs.disconnect();
      }
    });
    obs.observe(win, { childList: true, subtree: true });
    setTimeout(() => {
      obs.disconnect();
      if (!handled && condition()) {
        handled = true;
        callback();
      }
    }, timeoutMs);
  }

  create(id, title, width = "80vw", height = "80vh", options = {}) {
    title = sanitizeTitle(title);
    const win = this.wm.createWindow(id, title, width, height, options.isGame || false, options);

    const autoMount = options.autoMount !== false;
    const autoFocus = options.autoFocus !== false;

    if (autoMount && !options.skipHeader && options.icon) {
      const headerHtml = this.wm.utils.generateWindowHeader(
        title,
        options.icon,
        options.iconColor,
        options.externalUrl
      );

      let headerInjected = false;

      this.waitFor(
        win,
        () => !win.querySelector(".window-header") && win.innerHTML.trim() !== "",
        () => {
          win.insertAdjacentHTML("afterbegin", headerHtml);
          headerInjected = true;
          animateWindowOpen(win, false);
        },
        50
      );

      setTimeout(() => {
        if (!headerInjected) animateWindowOpen(win, false);
      }, 70);
    } else if (autoMount) {
      requestAnimationFrame(() => {
        animateWindowOpen(win, false);
      });
    }

    if (autoMount) {
      const desktop = $("#desktop");
      if (desktop) {
        desktop.appendChild(win);
      }
    }

    if (autoMount) {
      if (options.icon) {
        this.wm.addToTaskbar(win.id, title, options.icon, options.iconColor);
      }
      this.wm.onTilingWindowCreated(win.id);
    }

    if (autoMount && autoFocus) {
      this.wm.bringToFront(win);
    }

    if (autoMount && !options.skipAutoSetup) {
      this.waitFor(
        win,
        () => !!(win.querySelector(".window-header") || win.querySelector(".browser-tabbar")),
        () => {
          windowMakeDraggable(win, this.wm);
          this.wm.makeResizable(win);
          this.wm.setupWindowControls(win);
        },
        100
      );
    }

    return win;
  }

  close(win) {
    if (typeof win === "string") {
      const element = $(`#${win}`);
      if (element) {
        this.wm.closeWindow(element);
      }
    } else {
      this.wm.closeWindow(win);
    }
  }

  closeAll() {
    this.wm.closeAll();
  }

  focus(win) {
    if (typeof win === "string") {
      const element = $(`#${win}`);
      if (element) {
        this.wm.bringToFront(element);
      }
    } else {
      this.wm.bringToFront(win);
    }
  }

  minimize(win) {
    if (typeof win === "string") {
      const element = $(`#${win}`);
      if (element) {
        this.wm.minimizeWindow(element);
      }
    } else {
      this.wm.minimizeWindow(win);
    }
  }

  maximize(win) {
    if (typeof win === "string") {
      const element = $(`#${win}`);
      if (element) {
        this.wm.toggleFullscreen(element);
      }
    } else {
      this.wm.toggleFullscreen(win);
    }
  }

  bringToFront(win) {
    this.focus(win);
  }

  addToTaskbar(winId, title, icon, color) {
    this.wm.addToTaskbar(winId, title, icon, color);
  }

  removeFromTaskbar(winId) {
    this.wm.removeFromTaskbar(winId);
  }

  pinAppToTaskbar(appId, title, iconValue, color = null) {
    const taskbar = this.wm?.taskbarSystem;
    if (!taskbar || typeof taskbar.getPinnedItems !== "function") return false;
    const pinnedItems = taskbar.getPinnedItems();
    if (pinnedItems.some((item) => item.appId === appId)) return false;
    pinnedItems.push({ winId: `${appId}-pinned`, appId, title, iconValue, color });
    taskbar.savePinnedItems(pinnedItems);
    taskbar.renderPinnedItems?.();
    return true;
  }

  getWindowControls(externalUrl, showDownload) {
    return this.wm.getWindowControls(externalUrl, showDownload);
  }

  setTitle(winId, title) {
    this.wm.setWindowTitle(winId, title);
  }

  getTitle(winId) {
    return this.wm.getWindowTitle(winId);
  }

  toggleFullscreen(win) {
    if (typeof win === "string") {
      const element = $(`#${win}`);
      if (element) {
        this.wm.toggleFullscreen(element);
      }
    } else {
      this.wm.toggleFullscreen(win);
    }
  }

  setupWindowControls(win) {
    this.wm.setupWindowControls(win);
  }

  makeDraggable(win) {
    windowMakeDraggable(win, this.wm);
  }

  makeResizable(win) {
    this.wm.makeResizable(win);
  }

  applySnap(win, direction) {
    this.wm.applySnap?.(win, direction);
  }

  getOpenWindows() {
    return this.wm.openWindows;
  }

  setFileSystemManager(fs) {
    this.wm.setFileSystemManager?.(fs);
  }

  restoreSession() {
    this.wm.restoreSession?.();
  }

  notify(title, message, type = "info", duration = 5000, icon, appSource) {
    this.wm.notify(title, message, type, duration, icon, appSource);
  }
}
