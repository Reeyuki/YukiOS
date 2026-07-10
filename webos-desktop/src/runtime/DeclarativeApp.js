import { AppRenderer } from "./AppRenderer.js";
import { EventBinder } from "./EventBinder.js";
import { ActionExecutor } from "./ActionExecutor.js";
import { StateManager } from "./StateManager.js";
import { PersistenceTypes } from "./AppSchema.js";
import { os } from "../framework.js";

export class DeclarativeApp {
  constructor(appDefinition, services, appInstance = null) {
    this.definition = appDefinition;
    this.services = services;
    this.wm = services.wm || services.windowManager;
    this.fs = services.fs || services.fileSystemManager;
    this.bus = services.bus;
    this.notifications = services.notifications || services.notificationCenter;

    this.stateManager = new StateManager(
      appDefinition.id,
      appDefinition.state?.initial || {},
      appDefinition.state?.persistence || PersistenceTypes.MEMORY
    );

    this.actionExecutor = new ActionExecutor(services, this.stateManager, appInstance);

    this.appRenderer = new AppRenderer(this.wm, this.stateManager, this.actionExecutor);
    this.eventBinder = new EventBinder(this.stateManager, this.actionExecutor);

    this.openWindows = new Set();

    this.registerCustomActions();
  }

  registerCustomActions() {
    if (this.definition.actions) {
      Object.entries(this.definition.actions).forEach(([name, handler]) => {
        if (typeof handler === "function") {
          this.actionExecutor.registerCustomAction(name, handler);
        }
      });
    }
  }

  open(opts = {}) {
    const windowConfig = this.resolveWindowConfig(opts);

    const existing = document.getElementById(windowConfig.id);
    if (existing) {
      if (existing.style.display === "none") {
        existing.style.display = "flex";
        existing.style.zIndex = "10000";
        const taskbarItem = document.getElementById(`taskbar-${windowConfig.id}`);
        if (taskbarItem) {
          taskbarItem.style.display = "";
          taskbarItem.classList.remove("minimized");
        }
        try {
          os.tray.restoreFromTray(windowConfig.id);
        } catch (e) {}
        return existing;
      }
      if (this.definition.singleton) {
        existing.style.zIndex = "10000";
        return existing;
      }
    }

    const win = this.appRenderer.renderWindow(windowConfig, this.services, this.eventBinder);

    if (!win) {
      console.error("Failed to create window for", windowConfig.id);
      return null;
    }

    this.openWindows.add(windowConfig.id);

    if (windowConfig.events) {
      Object.entries(windowConfig.events).forEach(([selector, eventConfig]) => {
        const element = selector === "window" ? win : win.querySelector(selector);
        if (element) {
          this.eventBinder.bind(element, eventConfig);
        }
      });
    }

    if (this.definition.onMount) {
      if (typeof this.definition.onMount === "string") {
        const action = this.actionExecutor.customActions.get(this.definition.onMount);
        if (action) {
          const result = action(null, null, win, this.stateManager.state, this.actionExecutor);
          if (result instanceof Promise) {
            result.catch((err) => {
              console.error(`onMount action '${this.definition.onMount}' failed`, err);
            });
          }
        }
      } else if (typeof this.definition.onMount === "function") {
        try {
          const result = this.definition.onMount(win, this.stateManager.state, this.actionExecutor);
          if (result instanceof Promise) {
            result.catch((err) => {
              console.error(`onMount function failed`, err);
            });
          }
        } catch (err) {
          console.error(`onMount function failed`, err);
        }
      }
    }

    return win;
  }

  resolveWindowConfig(opts) {
    const defaultWindow = this.definition.windows?.[0];

    if (!defaultWindow) {
      throw new Error(`No window configuration found for app ${this.definition.id}`);
    }

    return {
      ...defaultWindow,
      ...(opts.windowId && { id: opts.windowId }),
      ...(opts.title && { title: opts.title })
    };
  }

  onClose(winId) {
    this.openWindows.delete(winId);

    const win = document.getElementById(winId);
    this.eventBinder.clear(win);

    if (this.definition.onClose) {
      this.definition.onClose(winId, this.stateManager.state);
    }
  }

  getSnapshot(winId) {
    return this.stateManager.toJSON();
  }

  restoreSnapshot(winId, data) {
    if (data) {
      this.stateManager.merge(data);
    }
  }

  getState() {
    return this.stateManager.toJSON();
  }

  setState(partialState) {
    this.stateManager.merge(partialState);
  }
}
