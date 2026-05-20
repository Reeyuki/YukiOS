export class AppRegistry {
  constructor() {
    this.apps = new Map();
    this.legacyApps = new Map();
  }

  register(appDefinition) {
    const { id } = appDefinition;
    if (!id) {
      throw new Error("App definition must have an id");
    }
    this.apps.set(id, appDefinition);
  }

  registerLegacy(appId, appInstance) {
    this.legacyApps.set(appId, appInstance);
  }

  get(appId) {
    return this.apps.get(appId);
  }

  getLegacy(appId) {
    return this.legacyApps.get(appId);
  }

  has(appId) {
    return this.apps.has(appId) || this.legacyApps.has(appId);
  }

  isDeclarative(appId) {
    return this.apps.has(appId);
  }

  isLegacy(appId) {
    return this.legacyApps.has(appId);
  }

  getAllDeclarative() {
    return Array.from(this.apps.values());
  }

  getAllLegacy() {
    return Array.from(this.legacyApps.values());
  }

  unregister(appId) {
    this.apps.delete(appId);
    this.legacyApps.delete(appId);
  }

  clear() {
    this.apps.clear();
    this.legacyApps.clear();
  }
}
