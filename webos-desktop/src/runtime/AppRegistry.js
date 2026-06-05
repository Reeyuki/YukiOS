export class AppRegistry {
  constructor() {
    this.apps = new Map();
  }

  register(appId, app) {
    this.apps.set(appId, app);
  }

  get(appId) {
    return this.apps.get(appId);
  }

  has(appId) {
    return this.apps.has(appId);
  }

  getAll() {
    return Array.from(this.apps.values());
  }

  unregister(appId) {
    this.apps.delete(appId);
  }

  clear() {
    this.apps.clear();
  }
}
