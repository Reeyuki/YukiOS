/**
 * App Launcher API
 * Wraps AppLauncher to provide clean OS-level app operations
 */

import type { AppInfo, LaunchOptions } from "./types.js";

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
    this._logLegacyWarning("launch");
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
    this._logLegacyWarning("launchGame");
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
    this._logLegacyWarning("close");
    if (!this.appLauncher) {
      return;
    }
    const win = document.getElementById(winId);
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
  }> {
    this._logLegacyWarning("getRunningApps");
    if (!this.appLauncher) {
      return [];
    }
    const windows = this.appLauncher.wm.openWindows;
    const result: Array<{ winId: string; appId?: string; title: string }> = [];

    windows.forEach((win: HTMLElement, winId: string) => {
      const appId = win.dataset.appId;
      const title = win.querySelector(".window-title-text")?.textContent || winId;
      result.push({ winId, appId, title });
    });

    return result;
  }

  /**
   * Get app information
   * @param appId - Application ID
   * @returns App info or null if not found
   */
  getAppInfo(appId: string): AppInfo | null {
    this._logLegacyWarning("getAppInfo");
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
    this._logLegacyWarning("getAllApps");
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
    this._logLegacyWarning("hasApp");
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
    this._logLegacyWarning("searchApps");
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

  /**
   * Log legacy API usage for migration tracking
   */
  private _logLegacyWarning(method: string): void {
    if (typeof window !== "undefined" && (window as any).__osBridgeLegacyWarnings !== false) {
      console.warn(`[OS Bridge] Legacy app API call: os.app.${method}()`);

      const stack = new Error().stack;
      let source = "unknown";
      if (stack) {
        const lines = stack.split("\n");
        for (const line of lines) {
          if (line.includes(".js") && !line.includes("os/app.ts")) {
            const match = line.match(/\/([^\/]+\.js)/);
            if (match) {
              source = match[1];
              break;
            }
          }
        }
      }

      if (typeof (window as any).trackLegacyCall === "function") {
        (window as any).trackLegacyCall("app", method, source);
      }
    }
  }
}
