import { DeclarativeApp } from "./DeclarativeApp.js";
import { PersistenceTypes } from "./AppSchema.js";

export class HybridAdapter {
  static convertToDeclarative(baseAppInstance) {
    const appDefinition = {
      id: baseAppInstance.constructor.name.toLowerCase().replace("app", ""),
      name: baseAppInstance.constructor.name.replace("App", ""),
      windows: [],
      state: {
        initial: {},
        persistence: PersistenceTypes.MEMORY
      }
    };

    return appDefinition;
  }

  static supportsDeclarativeOpen(baseAppInstance) {
    return typeof baseAppInstance.getDeclarativeSchema === "function";
  }

  static async openWithSchema(baseAppInstance, opts = {}) {
    if (this.supportsDeclarativeOpen(baseAppInstance)) {
      try {
        const services = baseAppInstance._services;

        if (!services || !services.wm) {
          return null;
        }

        if (services.fs && services.fs.fsReady) {
          await services.fs.fsReady;
        }

        const schema = baseAppInstance.getDeclarativeSchema(opts);
        if (schema && typeof schema === "object") {
          if (
            schema.onMount &&
            typeof schema.onMount === "string" &&
            typeof baseAppInstance[schema.onMount] === "function"
          ) {
            if (!schema.actions) {
              schema.actions = {};
            }
            if (!schema.actions[schema.onMount]) {
              schema.actions[schema.onMount] = (payload, event, element, state) => {
                return baseAppInstance[schema.onMount](payload, event, element, state);
              };
            }
          }
          if (!schema.onClose && typeof baseAppInstance.onClose === "function") {
            schema.onClose = (winId, state) => {
              return baseAppInstance.onClose(winId, state);
            };
          }
          const declarativeApp = new DeclarativeApp(schema, baseAppInstance._services);
          const win = declarativeApp.open(opts);

          baseAppInstance._isDeclarative = true;
          baseAppInstance._declarativeApp = declarativeApp;

          return win;
        }
      } catch (e) {
        console.warn(
          `Failed to use declarative schema for ${baseAppInstance.constructor.name}, falling back to imperative`,
          e
        );
      }
    }

    return null;
  }

  static wrapLegacyOpen(baseAppInstance, originalOpen) {
    return async function (opts = {}) {
      const declarativeWin = await HybridAdapter.openWithSchema(baseAppInstance, opts);

      if (declarativeWin) {
        return declarativeWin;
      }

      return originalOpen.call(baseAppInstance, opts);
    };
  }

  static enhanceBaseApp(BaseAppClass) {
    const originalPrototype = BaseAppClass.prototype;
    const originalOpen = originalPrototype.open;

    originalPrototype.open = async function (opts = {}, ...args) {
      let resolvedOpts = opts;
      if (typeof opts === "string") {
        resolvedOpts = { title: opts, content: args[0], filePath: args[1] };
      }

      const declarativeWin = await HybridAdapter.openWithSchema(this, resolvedOpts);

      if (declarativeWin) {
        return declarativeWin;
      }

      return originalOpen.call(this, opts, ...args);
    };

    if (!originalPrototype.getDeclarativeSchema) {
      originalPrototype.getDeclarativeSchema = function (opts = {}) {
        return null;
      };
    }

    return BaseAppClass;
  }
}
