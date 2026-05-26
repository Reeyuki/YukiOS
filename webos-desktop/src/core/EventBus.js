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

export const BusEvents = Object.freeze({
  WINDOW_CREATED: "window:created",

  WINDOW_FOCUSED: "window:focused",

  WINDOW_MINIMIZED: "window:minimized",

  WINDOW_CLOSED: "window:closed",

  WINDOW_FULLSCREEN: "window:fullscreen",

  WINDOW_SNAPPED: "window:snapped",

  SETTINGS_CHANGED: "settings:changed",

  APP_LAUNCHED: "app:launched",

  NOTIFY: "notify",

  ACHIEVEMENT_TRIGGER: "achievement:trigger",

  TERMINAL_CMD_EXECUTED: "terminal:cmd-executed",

  WALLPAPER_CHANGED: "desktop:wallpaper-changed",
  LOGIN_WALLPAPER_CHANGED: "desktop:login-wallpaper-changed",

  DESKTOP_ICON_ADDED: "desktop:icon-added",

  DESKTOP_ICON_REMOVED: "desktop:icon-removed",

  WORKSPACE_SWITCHED: "workspace:switched",

  WORKSPACE_ADDED: "workspace:added",

  WORKSPACE_REMOVED: "workspace:removed",
  FILE_CHANGED: "file:changed",
  SESSION_INITIALIZED: "session:initialized",
  SYSTEM_LOCKED: "system:locked",
  SYSTEM_UNLOCKED: "system:unlocked",
  CLIPBOARD_UPDATE: "clipboard:update",
  CLIPBOARD_READ: "clipboard:read",
  CLIPBOARD_CLEAR: "clipboard:clear"
});
