/**
 * Tray API
 * Wraps TrayManager to provide clean OS-level tray operations
 */

import type { TrayOptions, TrayItem } from "./types.js";
import { trayManager } from "../tray/tray.js";

export class TrayAPI {
  private trayManager: any;

  constructor() {
    this.trayManager = trayManager;
  }

  /**
   * Get the tray manager instance
   */
  private getTrayManager(): any {
    return this.trayManager;
  }

  /**
   * Register a window in the system tray
   * @param winId - Window ID
   * @param icon - Icon URL or FontAwesome class
   * @param label - Tray label
   * @param options - Tray options
   */
  register(winId: string, icon: string, label: string, options: TrayOptions = {}): void {
    this._logLegacyWarning("register");
    this.getTrayManager().register(winId, icon, label, options);
  }

  /**
   * Unregister a window from the system tray
   * @param winId - Window ID
   */
  unregister(winId: string): void {
    this._logLegacyWarning("unregister");
    this.getTrayManager().unregister(winId);
  }

  /**
   * Update tray icon
   * @param winId - Window ID
   * @param newIcon - New icon URL or FontAwesome class
   */
  updateIcon(winId: string, newIcon: string): void {
    this._logLegacyWarning("updateIcon");
    this.getTrayManager().updateIcon(winId, newIcon);
  }

  /**
   * Update tray label
   * @param winId - Window ID
   * @param newLabel - New label
   */
  updateLabel(winId: string, newLabel: string): void {
    this._logLegacyWarning("updateLabel");
    this.getTrayManager().updateLabel(winId, newLabel);
  }

  /**
   * Update tray context menu items
   * @param winId - Window ID
   * @param newContextMenuItems - New context menu items
   */
  updateContextMenuItems(
    winId: string,
    newContextMenuItems: Array<{
      label: string;
      action: () => void;
    }>
  ): void {
    this._logLegacyWarning("updateContextMenuItems");
    this.getTrayManager().updateContextMenuItems(winId, newContextMenuItems);
  }

  /**
   * Send window to tray (minimize to tray)
   * @param winId - Window ID
   */
  sendToTray(winId: string): void {
    this._logLegacyWarning("sendToTray");
    this.getTrayManager().sendToTray(winId);
  }

  /**
   * Restore window from tray
   * @param winId - Window ID
   */
  restoreFromTray(winId: string): void {
    this._logLegacyWarning("restoreFromTray");
    this.getTrayManager().restoreFromTray(winId);
  }

  /**
   * Get all tray items
   * @returns Array of tray items
   */
  getAllItems(): TrayItem[] {
    this._logLegacyWarning("getAllItems");
    const items = this.getTrayManager()._items;
    const result: TrayItem[] = [];
    items.forEach((value: any, key: string) => {
      result.push({
        winId: key,
        icon: value.icon,
        label: value.label,
        options: {
          resident: value.resident,
          showInTray: value.showInTray,
          onClick: value.onClick,
          onQuit: value.onQuit,
          contextMenuItems: value.contextMenuItems,
          priority: value.priority
        }
      });
    });
    return result;
  }

  /**
   * Get raw tray items (internal access for settings)
   * @returns Map of tray items
   */
  getTrayItems(): Map<string, any> {
    return this.getTrayManager()._items;
  }

  /**
   * Update item visibility and re-render tray
   * @param winId - Window ID
   * @param visible - Visibility setting
   */
  updateItemVisibility(winId: string, visible: boolean): void {
    const item = this.getTrayManager()._items.get(winId);
    if (item) {
      item.visibleInSettings = visible;
      this.getTrayManager()._render();
    }
  }

  /**
   * Check if a window is registered in the tray
   * @param winId - Window ID
   * @returns true if registered
   */
  isRegistered(winId: string): boolean {
    return this.getTrayManager().isRegistered(winId);
  }

  /**
   * Log legacy API usage for migration tracking
   */
  private _logLegacyWarning(method: string): void {
    if (typeof window !== "undefined" && (window as any).__osBridgeLegacyWarnings !== false) {
      console.warn(`[OS Bridge] Legacy tray API call: os.tray.${method}()`);

      const stack = new Error().stack;
      let source = "unknown";
      if (stack) {
        const lines = stack.split("\n");
        for (const line of lines) {
          if (line.includes(".js") && !line.includes("os/tray.ts")) {
            const match = line.match(/\/([^\/]+\.js)/);
            if (match) {
              source = match[1];
              break;
            }
          }
        }
      }

      if (typeof (window as any).trackLegacyCall === "function") {
        (window as any).trackLegacyCall("tray", method, source);
      }
    }
  }
}
