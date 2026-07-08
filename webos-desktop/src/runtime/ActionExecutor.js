export class ActionExecutor {
  constructor(services, stateManager, appInstance = null) {
    this.services = services;
    this.stateManager = stateManager;
    this.appInstance = appInstance;
    this.customActions = new Map();
  }

  execute(type, payload, event, element) {
    if (type.startsWith("custom:")) {
      const actionName = type.replace("custom:", "");
      this._executeCustomAction(actionName, payload, event, element);
    } else {
      console.warn(`Unknown action type: ${type}`);
    }
  }

  async _executeCustomAction(actionName, payload, event, element) {
    const handler = this.customActions.get(actionName);

    if (!handler) {
      console.error(`Custom action not found: ${actionName}`);
      return;
    }

    try {
      const result = handler(payload, event, element, this.stateManager.state, this);
      if (result instanceof Promise) {
        await result;
      }
    } catch (err) {
      console.error(`Custom action failed: ${actionName}`, err);
    }
  }

  registerCustomAction(name, handler) {
    this.customActions.set(name, handler);
  }

  unregisterCustomAction(name) {
    this.customActions.delete(name);
  }
}
