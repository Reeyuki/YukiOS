/**
 * Window Management API
 * Wraps WindowManager to provide clean OS-level window operations
 */

import type { WindowOptions, WindowHandle, WindowManagerService } from "./types.js";
import { windowMakeDraggable } from "../windowManager/makeDraggable.js";
import { animateWindowOpen } from "../windowManager/AnimationSystem.js";
import { sanitizeTitle } from "../utils/utils.js";
import { $ } from "../shared/domUtils.js";

export class WindowAPI {
  private wm: WindowManagerService;

  constructor(windowManager: WindowManagerService) {
    this.wm = windowManager;
  }

  private waitFor(win: HTMLElement, condition: () => boolean, callback: () => void, timeoutMs: number = 100): void {
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

  create(
    id: string,
    title: string,
    width: string | number = "80vw",
    height: string | number = "80vh",
    options: WindowOptions = {}
  ): HTMLElement {
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

    if (autoMount && options.icon) {
      this.wm.addToTaskbar(id, title, options.icon, options.iconColor);
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

  close(win: HTMLElement | string): void {
    if (typeof win === "string") {
      const element = $(`#${win}`);
      if (element) {
        this.wm.closeWindow(element);
      }
    } else {
      this.wm.closeWindow(win);
    }
  }

  closeAll(): void {
    this.wm.closeAll();
  }

  focus(win: HTMLElement | string): void {
    if (typeof win === "string") {
      const element = $(`#${win}`);
      if (element) {
        this.wm.bringToFront(element);
      }
    } else {
      this.wm.bringToFront(win);
    }
  }

  minimize(win: HTMLElement | string): void {
    if (typeof win === "string") {
      const element = $(`#${win}`);
      if (element) {
        this.wm.minimizeWindow(element);
      }
    } else {
      this.wm.minimizeWindow(win);
    }
  }

  maximize(win: HTMLElement | string): void {
    if (typeof win === "string") {
      const element = $(`#${win}`);
      if (element) {
        this.wm.toggleFullscreen(element);
      }
    } else {
      this.wm.toggleFullscreen(win);
    }
  }

  bringToFront(win: HTMLElement | string): void {
    this.focus(win);
  }

  addToTaskbar(winId: string, title: string, icon: string, color?: string): void {
    this.wm.addToTaskbar(winId, title, icon, color);
  }

  removeFromTaskbar(winId: string): void {
    this.wm.removeFromTaskbar(winId);
  }

  getWindowControls(externalUrl?: string, showDownload?: boolean): string {
    return this.wm.getWindowControls(externalUrl, showDownload);
  }

  setTitle(winId: string, title: string): void {
    this.wm.setWindowTitle(winId, title);
  }

  getTitle(winId: string): string | null {
    return this.wm.getWindowTitle(winId);
  }

  notify(
    title: string,
    message: string,
    type: string = "info",
    duration: number = 5000,
    icon?: string,
    appSource?: string
  ): void {
    this.wm.notify(title, message, type, duration, icon, appSource);
  }
}
