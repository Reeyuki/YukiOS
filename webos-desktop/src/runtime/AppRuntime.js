import { AppRegistry } from "./AppRegistry.js";
import { DeclarativeApp } from "./DeclarativeApp.js";

export class AppRuntime {
  constructor(services) {
    this.services = services;
    this.registry = new AppRegistry();
    this.wm = services.wm || services.windowManager;
  }

  registerDeclarative(appDefinition) {
    this.registry.register(appDefinition);
  }

  registerLegacy(appId, appInstance) {
    this.registry.registerLegacy(appId, appInstance);
  }

  launch(appId, opts = {}) {
    if (this.registry.isDeclarative(appId)) {
      return this._launchDeclarative(appId, opts);
    } else if (this.registry.isLegacy(appId)) {
      return this._launchLegacy(appId, opts);
    } else {
      throw new Error(`App not found: ${appId}`);
    }
  }

  _launchDeclarative(appId, opts) {
    const appDefinition = this.registry.get(appId);
    const declarativeApp = new DeclarativeApp(appDefinition, this.services);
    return declarativeApp.open(opts);
  }

  _launchLegacy(appId, opts) {
    const appInstance = this.registry.getLegacy(appId);
    return appInstance.open(opts);
  }

  has(appId) {
    return this.registry.has(appId);
  }

  isDeclarative(appId) {
    return this.registry.isDeclarative(appId);
  }

  isLegacy(appId) {
    return this.registry.isLegacy(appId);
  }

  getLegacy(appId) {
    return this.registry.getLegacy(appId);
  }

  getDeclarative(appId) {
    return this.registry.get(appId);
  }
}
