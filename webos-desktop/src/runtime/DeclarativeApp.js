import { AppRenderer } from "./AppRenderer.js";
import { EventBinder } from "./EventBinder.js";
import { ActionExecutor } from "./ActionExecutor.js";
import { StateManager } from "./StateManager.js";
import { PersistenceTypes } from "./AppSchema.js";
import { WindowHelper } from "../utils/WindowHelper.js";

export class DeclarativeApp {
  constructor(appDefinition, services) {
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

    this.actionExecutor = new ActionExecutor(services, this.stateManager);

    this.windowHelper = new (services.WindowHelper || this._getWindowHelper())(this.wm);

    this.appRenderer = new AppRenderer(this.windowHelper, this.stateManager);
    this.eventBinder = new EventBinder(this.stateManager, this.actionExecutor);

    this.openWindows = new Set();

    this._registerCustomActions();
  }

  _getWindowHelper() {
    return WindowHelper;
  }

  _registerCustomActions() {
    if (this.definition.actions) {
      Object.entries(this.definition.actions).forEach(([name, handler]) => {
        if (typeof handler === "function" && name !== "_appInstance") {
          this.actionExecutor.registerCustomAction(name, handler);
        }
      });
    }
    if (this.definition.actions._appInstance) {
      this.actionExecutor.appInstance = this.definition.actions._appInstance;
    }
  }

  open(opts = {}) {
    const windowConfig = this._resolveWindowConfig(opts);
    const win = this.appRenderer.renderWindow(windowConfig, this.services);

    if (!win) {
      console.error("Failed to create window for", windowConfig.id);
      return null;
    }

    this._bindEvents(win, windowConfig);
    this.openWindows.add(windowConfig.id);

    if (this.definition.onMount) {
      if (typeof this.definition.onMount === "string") {
        const action = this.actionExecutor.customActions.get(this.definition.onMount);
        if (action) {
          action(null, null, win, this.stateManager.state, this.actionExecutor);
        }
      } else if (typeof this.definition.onMount === "function") {
        this.definition.onMount(win, this.stateManager.state, this.actionExecutor);
      }
    }

    return win;
  }

  _resolveWindowConfig(opts) {
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

  _bindEvents(win, windowConfig) {
    const elementsWithEvents = win.querySelectorAll("[_schemaEvents]");

    elementsWithEvents.forEach((element) => {
      const events = element._schemaEvents;
      if (events) {
        this.eventBinder.bind(element, events);
      }
    });

    if (windowConfig.events) {
      Object.entries(windowConfig.events).forEach(([selector, eventConfig]) => {
        const element = selector === "window" ? win : win.querySelector(selector);
        if (element) {
          this.eventBinder.bind(element, eventConfig);
        }
      });
    }
  }

  onClose(winId) {
    this.openWindows.delete(winId);
    this.eventBinder.unbindAllGlobal();

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
