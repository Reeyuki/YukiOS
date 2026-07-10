class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(event, fn) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(fn);
    return () => this.off(event, fn);
  }

  once(event, fn) {
    const wrapper = (data) => {
      fn(data);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  off(event, fn) {
    this.listeners.get(event)?.delete(fn);
  }

  emit(event, data) {
    const handlers = this.listeners.get(event);
    if (!handlers || handlers.size === 0) return;
    handlers.forEach((fn) => {
      try {
        fn(data);
      } catch (err) {
        console.error(`[EventBus] Uncaught error in handler for "${event}":`, err);
      }
    });
  }

  clear(event) {
    if (event !== undefined) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  listenerCount(event) {
    return this.listeners.get(event)?.size ?? 0;
  }
}

export const bus = new EventBus();

export { BusEvents } from "./EventBusConstants.js";
