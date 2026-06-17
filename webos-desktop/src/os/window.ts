/**
 * Window Management API
 * Wraps WindowManager to provide clean OS-level window operations
 */

import type { WindowOptions, WindowHandle } from "./types.js";
import { makeDraggable } from "../windowManager/makeDraggable.js";
import { animateWindowOpen } from "../windowManager/AnimationSystem.js";
import { sanitizeTitle } from "../utils/utils.js";
import { $ } from "../shared/domUtils.js";

export class WindowAPI {
  private wm: any;

  constructor(windowManager: any) {
    this.wm = windowManager;
  }

  /**
   * Create a new window
   * @param id - Unique window identifier
   * @param title - Window title
   * @param width - Width (e.g., "80vw", 800)
   * @param height - Height (e.g., "80vh", 600)
   * @param options - Additional window options
   * @returns Window element
   */
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

      let contentSet = false;
      const observer = new MutationObserver((mutations, obs) => {
        const hasHeader = win.querySelector(".window-header");
        if (!hasHeader && win.innerHTML.trim() !== "") {
          win.insertAdjacentHTML("afterbegin", headerHtml);
          contentSet = true;

          // Trigger animation after content is set
          requestAnimationFrame(() => {
            animateWindowOpen(win, false);
          });

          obs.disconnect();
        }
      });
      observer.observe(win, { childList: true, subtree: true });

      setTimeout(() => {
        const hasHeader = win.querySelector(".window-header");
        if (!hasHeader && win.innerHTML.trim() !== "") {
          win.insertAdjacentHTML("afterbegin", headerHtml);
          contentSet = true;

          // Trigger animation after content is set
          requestAnimationFrame(() => {
            animateWindowOpen(win, false);
          });
        }
        observer.disconnect();

        // If content was never set, trigger animation anyway (but not for skipHeader)
        if (!contentSet && !options.skipHeader) {
          requestAnimationFrame(() => {
            animateWindowOpen(win, false);
          });
        }
      }, 50);
    } else if (autoMount && !options.skipHeader) {
      // Trigger animation for windows without auto-generated headers
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
      const observer = new MutationObserver((mutations, obs) => {
        const hasHeader = win.querySelector(".window-header") || win.querySelector(".browser-tabbar");
        if (hasHeader) {
          makeDraggable(win, this.wm);
          this.wm.makeResizable(win);
          this.wm.setupWindowControls(win);
          obs.disconnect();
        }
      });
      observer.observe(win, { childList: true, subtree: true });

      setTimeout(() => {
        if (observer.disconnect) {
          observer.disconnect();
          const hasHeader = win.querySelector(".window-header") || win.querySelector(".browser-tabbar");
          if (hasHeader) {
            makeDraggable(win, this.wm);
            this.wm.makeResizable(win);
            this.wm.setupWindowControls(win);
          }
        }
      }, 100);
    }

    return win;
  }

  /**
   * Close a window
   * @param win - Window element or window ID
   */
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

  /**
   * Close all open windows
   */
  closeAll(): void {
    this.wm.closeAll();
  }

  /**
   * Focus/bring a window to front
   * @param win - Window element or window ID
   */
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

  /**
   * Minimize a window
   * @param win - Window element or window ID
   */
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

  /**
   * Maximize/restore a window
   * @param win - Window element or window ID
   */
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

  /**
   * Bring window to front (alias for focus)
   * @param win - Window element or window ID
   */
  bringToFront(win: HTMLElement | string): void {
    this.focus(win);
  }

  /**
   * Add window to taskbar
   * @param winId - Window ID
   * @param title - Window title
   * @param icon - Icon URL or FontAwesome class
   * @param color - Optional color
   */
  addToTaskbar(winId: string, title: string, icon: string, color?: string): void {
    this.wm.addToTaskbar(winId, title, icon, color);
  }

  /**
   * Remove window from taskbar
   * @param winId - Window ID
   */
  removeFromTaskbar(winId: string): void {
    this.wm.removeFromTaskbar(winId);
  }

  /**
   * Get window controls HTML
   * @param externalUrl - Optional external URL for controls
   * @returns HTML string for window controls
   */
  getWindowControls(externalUrl?: string): string {
    return this.wm.getWindowControls(externalUrl);
  }

  /**
   * Send notification through window manager
   * @param title - Notification title
   * @param message - Notification message
   * @param type - Notification type
   * @param duration - Duration in ms
   * @param icon - Icon
   * @param appSource - App source identifier
   */
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
