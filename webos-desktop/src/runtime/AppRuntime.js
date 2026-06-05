import { AppRegistry } from "./AppRegistry.js";
import { DeclarativeApp } from "./DeclarativeApp.js";

export class AppRuntime {
  constructor(services) {
    this.services = services;
    this.registry = new AppRegistry();
    this.wm = services.wm || services.windowManager;
  }

  register(appId, app) {
    this.registry.register(appId, app);
  }

  launch(appId, opts = {}) {
    const app = this.registry.get(appId);
    if (!app) {
      throw new Error(`App not found: ${appId}`);
    }

    if (typeof app.getDeclarativeSchema === "function") {
      const schema = app.getDeclarativeSchema(opts);
      if (schema && schema.id) {
        if (!schema.actions) {
          schema.actions = {};
        }
        if (schema.onMount) {
          if (typeof schema.onMount === "string" && typeof app[schema.onMount] === "function") {
            if (!schema.actions[schema.onMount]) {
              schema.actions[schema.onMount] = (payload, event, element, state) => {
                return app[schema.onMount](payload, event, element, state);
              };
            }
          } else if (typeof schema.onMount === "function") {
            schema.actions._onMount = schema.onMount;
            schema.onMount = "_onMount";
          }
        }
        if (!schema.onClose && typeof app.onClose === "function") {
          schema.onClose = (winId, state) => {
            return app.onClose(winId, state);
          };
        }
        schema.actions._appInstance = app;
        this.register(schema.id, schema);
        const declarativeApp = new DeclarativeApp(schema, this.services);
        return declarativeApp.open(opts);
      }
    }

    if (app.id && typeof app.id === "string") {
      const declarativeApp = new DeclarativeApp(app, this.services);
      return declarativeApp.open(opts);
    }

    return app.open(opts);
  }

  has(appId) {
    return this.registry.has(appId);
  }

  get(appId) {
    return this.registry.get(appId);
  }

  getAll() {
    return this.registry.getAll();
  }
}
