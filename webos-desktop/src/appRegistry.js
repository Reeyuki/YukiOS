import { StorageKeys, os } from "./framework.js";
const APP_REGISTRY_DISABLED_KEY = StorageKeys.appRegistryDisabled;
const APP_REGISTRY_RENAMED_KEY = StorageKeys.appRegistryRenamed;
const APP_REGISTRY_UNINSTALLED_KEY = StorageKeys.appRegistryUninstalled;

const PROTECTED_APPS = new Set([
  "browserApp",
  "explorerApp",
  "terminal",
  "notepadApp",
  "settingsApp",
  "taskManagerApp"
]);

export class AppRegistry {
  constructor() {
    this.disabledApps = this.loadDisabledApps();
    this.renamedApps = this.loadRenamedApps();
    this.uninstalledApps = this.loadUninstalledApps();
  }

  loadDisabledApps() {
    try {
      const saved = os.storage.get(APP_REGISTRY_DISABLED_KEY);
      return saved ? new Set(saved) : new Set();
    } catch (e) {
      return new Set();
    }
  }

  refresh() {
    this.disabledApps = this.loadDisabledApps();
    this.renamedApps = this.loadRenamedApps();
    this.uninstalledApps = this.loadUninstalledApps();
  }

  saveDisabledApps() {
    try {
      os.storage.set(APP_REGISTRY_DISABLED_KEY, [...this.disabledApps]);
    } catch (e) {
      console.error("[AppRegistry]", e);
    }
  }

  loadRenamedApps() {
    try {
      const saved = os.storage.get(APP_REGISTRY_RENAMED_KEY);
      return saved || {};
    } catch (e) {
      return {};
    }
  }

  saveRenamedApps() {
    try {
      os.storage.set(APP_REGISTRY_RENAMED_KEY, this.renamedApps);
    } catch (e) {
      console.error("[AppRegistry]", e);
    }
  }

  loadUninstalledApps() {
    try {
      const saved = os.storage.get(APP_REGISTRY_UNINSTALLED_KEY);
      return saved ? new Set(saved) : new Set();
    } catch (e) {
      return new Set();
    }
  }

  saveUninstalledApps() {
    try {
      os.storage.set(APP_REGISTRY_UNINSTALLED_KEY, [...this.uninstalledApps]);
    } catch (e) {
      console.error("[AppRegistry]", e);
    }
  }

  isAppDisabled(appId) {
    return this.disabledApps.has(appId);
  }

  setAppDisabled(appId, disabled) {
    if (PROTECTED_APPS.has(appId)) {
      console.warn(`Cannot disable protected app: ${appId}`);
      return false;
    }
    if (disabled) {
      this.disabledApps.add(appId);
    } else {
      this.disabledApps.delete(appId);
    }
    this.saveDisabledApps();
    return true;
  }

  getAppDisplayName(appId, originalTitle) {
    return this.renamedApps[appId] || originalTitle;
  }

  setAppName(appId, newName) {
    if (!newName || newName.trim() === "") {
      return false;
    }
    this.renamedApps[appId] = newName.trim();
    this.saveRenamedApps();
    return true;
  }

  resetAppName(appId) {
    delete this.renamedApps[appId];
    this.saveRenamedApps();
  }

  isAppUninstalled(appId) {
    return this.uninstalledApps.has(appId);
  }

  uninstallApp(appId) {
    if (PROTECTED_APPS.has(appId)) {
      console.warn(`Cannot uninstall protected app: ${appId}`);
      return false;
    }
    this.uninstalledApps.add(appId);
    this.disabledApps.delete(appId);
    delete this.renamedApps[appId];
    this.saveUninstalledApps();
    this.saveDisabledApps();
    this.saveRenamedApps();
    return true;
  }

  restoreApp(appId) {
    this.uninstalledApps.delete(appId);
    this.saveUninstalledApps();
  }

  getAppType(appId, appData) {
    if (appData.type === "system") {
      if (PROTECTED_APPS.has(appId)) return "core";
      return "bundled";
    }
    return "external";
  }

  isProtected(appId) {
    return PROTECTED_APPS.has(appId);
  }

  getFilteredApps(appMap) {
    const filtered = {};
    for (const [appId, appData] of Object.entries(appMap)) {
      if (!this.uninstalledApps.has(appId)) {
        filtered[appId] = appData;
      }
    }
    return filtered;
  }

  getAllApps(appMap) {
    const apps = [];
    for (const [appId, appData] of Object.entries(appMap)) {
      if (appData.excludeFromInstalledApps) continue;
      apps.push({
        id: appId,
        originalTitle: appData.title || appId,
        displayName: this.getAppDisplayName(appId, appData.title || appId),
        type: this.getAppType(appId, appData),
        disabled: this.isAppDisabled(appId),
        uninstalled: this.isAppUninstalled(appId),
        protected: this.isProtected(appId),
        icon: appData.icon || null,
        url: appData.url || null,
        swf: appData.swf || null,
        html: appData.html || null,
        action: appData.action || null
      });
    }
    return apps;
  }
}

let registryInstance = null;

export function getAppRegistry() {
  if (!registryInstance) {
    registryInstance = new AppRegistry();
  }
  return registryInstance;
}
