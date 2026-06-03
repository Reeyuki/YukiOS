/**
 * Event Bus API
 * Wraps EventBus to provide clean OS-level event operations
 */

import type { EventBusEvents, EventHandler } from "./types.js";

export class EventAPI {
  private bus: any;

  constructor(eventBus: any) {
    this.bus = eventBus;
  }

  /**
   * Subscribe to an event
   * @param event - Event name
   * @param handler - Event handler function
   * @returns Unsubscribe function
   */
  on<K extends keyof EventBusEvents>(event: K, handler: (data: EventBusEvents[K]) => void): () => void {
    this._logLegacyWarning("on");
    return this.bus.on(event, handler);
  }

  /**
   * Subscribe to an event once (auto-unsubscribe after first call)
   * @param event - Event name
   * @param handler - Event handler function
   * @returns Unsubscribe function
   */
  once<K extends keyof EventBusEvents>(event: K, handler: (data: EventBusEvents[K]) => void): () => void {
    this._logLegacyWarning("once");
    return this.bus.once(event, handler);
  }

  /**
   * Unsubscribe from an event
   * @param event - Event name
   * @param handler - Event handler function
   */
  off<K extends keyof EventBusEvents>(event: K, handler: (data: EventBusEvents[K]) => void): void {
    this._logLegacyWarning("off");
    this.bus.off(event, handler);
  }

  /**
   * Emit an event
   * @param event - Event name
   * @param data - Event data
   */
  emit<K extends keyof EventBusEvents>(event: K, data: EventBusEvents[K]): void {
    this._logLegacyWarning("emit");
    this.bus.emit(event, data);
  }

  /**
   * Clear all listeners for an event or all events
   * @param event - Optional event name (if not provided, clears all)
   */
  clear(event?: string): void {
    this._logLegacyWarning("clear");
    this.bus.clear(event);
  }

  /**
   * Get listener count for an event
   * @param event - Event name
   * @returns Number of listeners
   */
  listenerCount(event: string): number {
    this._logLegacyWarning("listenerCount");
    return this.bus.listenerCount(event);
  }

  /**
   * Log legacy API usage for migration tracking
   */
  private _logLegacyWarning(method: string): void {
    if (typeof window !== "undefined" && (window as any).__osBridgeLegacyWarnings !== false) {
      console.warn(`[OS Bridge] Legacy event API call: os.events.${method}()`);

      const stack = new Error().stack;
      let source = "unknown";
      if (stack) {
        const lines = stack.split("\n");
        for (const line of lines) {
          if (line.includes(".js") && !line.includes("os/events.ts")) {
            const match = line.match(/\/([^\/]+\.js)/);
            if (match) {
              source = match[1];
              break;
            }
          }
        }
      }

      if (typeof (window as any).trackLegacyCall === "function") {
        (window as any).trackLegacyCall("events", method, source);
      }
    }
  }
}
