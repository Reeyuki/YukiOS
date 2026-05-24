import { ActionTypes } from "./AppSchema.js";
import { ServiceActions } from "./ServiceActions.js";

export class ActionExecutor {
  constructor(services, stateManager) {
    this.services = services;
    this.stateManager = stateManager;
    this.customActions = new Map();
    this.serviceActionMappings = ServiceActions;
  }

  execute(type, payload, event, element) {
    if (type.startsWith("custom:")) {
      const actionName = type.replace("custom:", "");
      this._executeCustomAction(actionName, payload, event, element);
    } else if (type === ActionTypes.SERVICE) {
      this._executeServiceAction(payload, event, element);
    } else if (type === ActionTypes.STATE) {
      this._executeStateAction(payload, event, element);
    } else if (type === ActionTypes.NAVIGATE) {
      this._executeNavigateAction(payload, event, element);
    } else {
      console.warn(`Unknown action type: ${type}`);
    }
  }

  _executeServiceAction(payload, event, element) {
    const { service, method, args = [] } = payload;
    const serviceInstance = this.services[service];

    if (!serviceInstance) {
      console.error(`Service not found: ${service}`);
      return;
    }

    if (typeof serviceInstance[method] !== "function") {
      console.error(`Method not found on service ${service}: ${method}`);
      return;
    }

    try {
      const resolvedArgs = this._resolveArgs(args, event, element);
      const result = serviceInstance[method](...resolvedArgs);

      if (result instanceof Promise) {
        result.catch((err) => {
          console.error(`Service action failed: ${service}.${method}`, err);
        });
      }
    } catch (err) {
      console.error(`Service action failed: ${service}.${method}`, err);
    }
  }

  _executeStateAction(payload, event, element) {
    const { path, value, updater, merge } = payload;

    if (merge) {
      this.stateManager.merge(value);
    } else if (updater) {
      this.stateManager.update(path, updater);
    } else {
      this.stateManager.set(path, value);
    }
  }

  _executeNavigateAction(payload, event, element) {
    const { url, target = "_self" } = payload;

    if (target === "_self") {
      window.location.href = url;
    } else if (target === "_blank") {
      window.open(url, "_blank");
    } else if (target === "parent") {
      window.parent.postMessage({ type: "navigate", url }, "*");
    }
  }

  _executeCustomAction(actionName, payload, event, element) {
    const handler = this.customActions.get(actionName);

    if (!handler) {
      console.error(`Custom action not found: ${actionName}`);
      return;
    }

    try {
      handler(payload, event, element, this.stateManager.state, this);
    } catch (err) {
      console.error(`Custom action failed: ${actionName}`, err);
    }
  }

  _resolveArgs(args, event, element) {
    if (!Array.isArray(args)) {
      return [];
    }

    return args.map((arg) => {
      if (arg === "$event") return event;
      if (arg === "$element") return element;
      if (arg === "$state") return this.stateManager.state;
      if (typeof arg === "string" && arg.startsWith("$state.")) {
        const path = arg.replace("$state.", "");
        return this.stateManager.get(path);
      }
      return arg;
    });
  }

  registerCustomAction(name, handler) {
    this.customActions.set(name, handler);
  }

  unregisterCustomAction(name) {
    this.customActions.delete(name);
  }
}
