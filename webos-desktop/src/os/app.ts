/**
 * App Launcher API
 * Wraps AppLauncher to provide clean OS-level app operations
 */

import type { AppInfo, LaunchOptions } from "./types.js";
import { $ } from "../shared/domUtils.js";

export class AppAPI {
  private appLauncher: any;

  constructor(appLauncher: any) {
    this.appLauncher = appLauncher;
  }

  /**
   * Launch an application
   * @param appId - Application ID
   * @param options - Launch options
   */
  async launch(appId: string, options: LaunchOptions = {}): Promise<void> {
    if (!this.appLauncher) {
      return;
    }
    await this.appLauncher.launch(appId, false, options);
  }

  /**
   * Launch a game with SWF support
   * @param appId - Application ID
   * @param isSwf - Whether it's a SWF game
   * @param options - Launch options
   */
  async launchGame(appId: string, isSwf: boolean = false, options: LaunchOptions = {}): Promise<void> {
    if (!this.appLauncher) {
      return;
    }
    await this.appLauncher.launch(appId, isSwf, options);
  }

  /**
   * Close an application
   * @param winId - Window ID to close
   */
  close(winId: string): void {
    if (!this.appLauncher) {
      return;
    }
    const win = $(`#${winId}`);
    if (win) {
      this.appLauncher.wm.closeWindow(win);
    }
  }

  /**
   * Get all running applications
   * @returns Array of running app info
   */
  getRunningApps(): Array<{
    winId: string;
    appId?: string;
    title: string;
    icon?: string | null;
    status?: string;
    isTray?: boolean;
  }> {
    if (!this.appLauncher) {
      return [];
    }
    const windows = this.appLauncher.wm.openWindows;
    const result: Array<{
      winId: string;
      appId?: string;
      title: string;
      icon?: string | null;
      status?: string;
      isTray?: boolean;
    }> = [];

    windows.forEach((entry: any, winId: string) => {
      const win = $(`#${winId}`);
      if (!win) return;
      const appId = win.dataset.appId;
      const title = entry.title || winId;
      const icon = entry.iconValue || null;
      const visible = win.style.display !== "none";
      const status = visible ? "Running" : "Suspended";

      result.push({
        winId,
        appId,
        title,
        icon,
        status,
        isTray: false
      });
    });

    if (this.appLauncher.trayManager) {
      const trayItems = this.appLauncher.trayManager.trayItems;
      if (trayItems instanceof Map) {
        trayItems.forEach((item: any, winId: string) => {
          if (item.inTray && !result.find((r) => r.winId === winId)) {
            result.push({
              winId,
              title: item.label || winId,
              icon: item.icon || null,
              status: "Tray",
              isTray: true
            });
          }
        });
      }
    }

    return result;
  }

  /**
   * Get app information
   * @param appId - Application ID
   * @returns App info or null if not found
   */
  getAppInfo(appId: string): AppInfo | null {
    if (!this.appLauncher) {
      return null;
    }
    return this.appLauncher.appMap[appId] || null;
  }

  /**
   * Get all registered applications
   * @returns Object mapping app IDs to app info
   */
  getAllApps(): Record<string, AppInfo> {
    if (!this.appLauncher) {
      return {};
    }
    return this.appLauncher.appMap;
  }

  /**
   * Check if an app is installed/registered
   * @param appId - Application ID
   * @returns True if app exists
   */
  hasApp(appId: string): boolean {
    if (!this.appLauncher) {
      return false;
    }
    return appId in this.appLauncher.appMap;
  }

  /**
   * Search for apps by title
   * @param query - Search query
   * @returns Array of matching app IDs
   */
  searchApps(query: string): string[] {
    if (!this.appLauncher) {
      return [];
    }
    const results: string[] = [];
    const lowerQuery = query.toLowerCase();

    for (const [appId, app] of Object.entries(this.appLauncher.appMap)) {
      const appInfo = app as AppInfo;
      if (appInfo.title && appInfo.title.toLowerCase().includes(lowerQuery)) {
        results.push(appId);
      }
    }

    return results;
  }
}
