import { sanitizeTitle } from "../utils/utils.js";
import { $ } from "../shared/domUtils.js";

export class WindowAPI {
  constructor(windowManager) {
    this.wm = windowManager;
  }

  resolveWindow(win) {
    if (typeof win === "string") return $(`#${win}`);
    return win || null;
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

    if (autoMount && !options.skipHeader && options.icon) {
      const headerHtml = this.wm.utils.generateWindowHeader(
        title,
        options.icon,
        options.iconColor,
        options.externalUrl
      );
      this.waitFor(
        win,
        () => !win.querySelector(".window-header") && win.innerHTML.trim() !== "",
        () => {
          win.insertAdjacentHTML("afterbegin", headerHtml);
        },
        50
      );
    }

    if (autoMount) {
      const desktop = $("#desktop");
      this.wm.mountWindow(win, win.id, title, options.icon, options.iconColor, {
        mountTarget: desktop || document.body,
        autoFocus: options.autoFocus !== false,
        bindControls: !options.skipAutoSetup
      });
    }

    return win;
  }

  close(win) {
    const target = this.resolveWindow(win);
    if (target) this.wm.closeWindow(target);
  }

  closeAll() {
    this.wm.closeAll();
  }

  focus(win) {
    const target = this.resolveWindow(win);
    if (target) this.wm.bringToFront(target);
  }

  minimize(win) {
    const target = this.resolveWindow(win);
    if (target) this.wm.minimizeWindow(target);
  }

  maximize(win) {
    const target = this.resolveWindow(win);
    if (target) this.wm.toggleFullscreen(target);
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
    const target = this.resolveWindow(win);
    if (target) this.wm.toggleFullscreen(target);
  }

  setupWindowControls(win) {
    this.wm.setupWindowControls(win);
  }

  makeDraggable(win) {
    this.wm.makeDraggable(win);
  }

  makeResizable(win) {
    this.wm.makeResizable(win);
  }

  applySnap(win, direction) {
    this.wm.applySnap?.(win, direction);
  }

  unsnap(win) {
    this.wm.unsnap?.(win);
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
