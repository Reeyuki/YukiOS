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
    this.nc.removeNotification(id);
  }

  /**
   * Clear all notifications
   */
  clearAll(): void {
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
    return this.nc.getNotifications();
  }

  /**
   * Get notification count
   * @returns Number of notifications
   */
  getCount(): number {
    return this.nc.getNotificationCount();
  }

  /**
   * Set do-not-disturb mode
   * @param enabled - Whether DND is enabled
   */
  setDoNotDisturb(enabled: boolean): void {
    this.nc.setDoNotDisturb(enabled);
  }

  /**
   * Get do-not-disturb status
   * @returns Whether DND is enabled
   */
  getDoNotDisturb(): boolean {
    return this.nc.doNotDisturb;
  }
}
