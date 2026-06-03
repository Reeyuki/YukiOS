/**
 * Notification API
 * Wraps NotificationCenter to provide clean OS-level notification operations
 */

import type { NotificationType, NotificationOptions } from "./types.js";

export class NotificationAPI {
  private nc: any;

  constructor(notificationCenter: any) {
    this.nc = notificationCenter;
  }

  /**
   * Send a notification
   * @param title - Notification title
   * @param message - Notification message
   * @param options - Notification options
   * @returns Notification ID
   */
  send(title: string, message: string, options: NotificationOptions = {}): number {
    this._logLegacyWarning("send");
    return this.nc.addNotification(
      title,
      message,
      options.type || "info",
      options.duration || 5000,
      options.icon,
      options.appSource
    );
  }

  /**
   * Clear a specific notification
   * @param id - Notification ID
   */
  clear(id: number): void {
    this._logLegacyWarning("clear");
    this.nc.removeNotification(id);
  }

  /**
   * Clear all notifications
   */
  clearAll(): void {
    this._logLegacyWarning("clearAll");
    this.nc.clearAllNotifications();
  }

  /**
   * Get all notifications
   * @returns Array of notification objects
   */
  getAll(): Array<{
    id: number;
    title: string;
    message: string;
    type: NotificationType;
    timestamp: Date;
    icon?: string;
    appSource?: string;
  }> {
    this._logLegacyWarning("getAll");
    return this.nc.getNotifications();
  }

  /**
   * Get notification count
   * @returns Number of notifications
   */
  getCount(): number {
    this._logLegacyWarning("getCount");
    return this.nc.getNotificationCount();
  }

  /**
   * Set do-not-disturb mode
   * @param enabled - Whether DND is enabled
   */
  setDoNotDisturb(enabled: boolean): void {
    this._logLegacyWarning("setDoNotDisturb");
    this.nc.setDoNotDisturb(enabled);
  }

  /**
   * Get do-not-disturb status
   * @returns Whether DND is enabled
   */
  getDoNotDisturb(): boolean {
    this._logLegacyWarning("getDoNotDisturb");
    return this.nc.doNotDisturb;
  }

  /**
   * Log legacy API usage for migration tracking
   */
  private _logLegacyWarning(method: string): void {
    if (typeof window !== "undefined" && (window as any).__osBridgeLegacyWarnings !== false) {
      console.warn(`[OS Bridge] Legacy notification API call: os.notify.${method}()`);

      const stack = new Error().stack;
      let source = "unknown";
      if (stack) {
        const lines = stack.split("\n");
        for (const line of lines) {
          if (line.includes(".js") && !line.includes("os/notify.ts")) {
            const match = line.match(/\/([^\/]+\.js)/);
            if (match) {
              source = match[1];
              break;
            }
          }
        }
      }

      if (typeof (window as any).trackLegacyCall === "function") {
        (window as any).trackLegacyCall("notify", method, source);
      }
    }
  }
}
