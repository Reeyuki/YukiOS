class EventBus {
  constructor() {
    this._listeners = new Map();
  }

  on(event, fn) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(fn);
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
    this._listeners.get(event)?.delete(fn);
  }

  emit(event, data) {
    const handlers = this._listeners.get(event);
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
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }
  }

  listenerCount(event) {
    return this._listeners.get(event)?.size ?? 0;
  }
}

export const bus = new EventBus();

export { BusEvents } from "./EventBusConstants.js";
