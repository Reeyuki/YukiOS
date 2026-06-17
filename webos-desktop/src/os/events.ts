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
    return this.bus.on(event, handler);
  }

  /**
   * Subscribe to an event once (auto-unsubscribe after first call)
   * @param event - Event name
   * @param handler - Event handler function
   * @returns Unsubscribe function
   */
  once<K extends keyof EventBusEvents>(event: K, handler: (data: EventBusEvents[K]) => void): () => void {
    return this.bus.once(event, handler);
  }

  /**
   * Unsubscribe from an event
   * @param event - Event name
   * @param handler - Event handler function
   */
  off<K extends keyof EventBusEvents>(event: K, handler: (data: EventBusEvents[K]) => void): void {
    this.bus.off(event, handler);
  }

  /**
   * Emit an event
   * @param event - Event name
   * @param data - Event data
   */
  emit<K extends keyof EventBusEvents>(event: K, data: EventBusEvents[K]): void {
    this.bus.emit(event, data);
  }

  /**
   * Clear all listeners for an event or all events
   * @param event - Optional event name (if not provided, clears all)
   */
  clear(event?: string): void {
    this.bus.clear(event);
  }

  /**
   * Get listener count for an event
   * @param event - Event name
   * @returns Number of listeners
   */
  listenerCount(event: string): number {
    return this.bus.listenerCount(event);
  }
}
