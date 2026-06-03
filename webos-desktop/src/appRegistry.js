import { StorageKeys } from "./StorageKeys.js";
import { os } from "./os/index.js";

const APP_REGISTRY_DISABLED_KEY = StorageKeys.appRegistryDisabled;
const APP_REGISTRY_RENAMED_KEY = StorageKeys.appRegistryRenamed;
const APP_REGISTRY_UNINSTALLED_KEY = StorageKeys.appRegistryUninstalled;

const PROTECTED_APPS = new Set(["browserApp", "explorer", "terminal", "notepad", "settingsApp", "taskManagerApp"]);

export class AppRegistry {
  constructor() {
    this._disabledApps = this._loadDisabledApps();
    this._renamedApps = this._loadRenamedApps();
    this._uninstalledApps = this._loadUninstalledApps();
  }

  _loadDisabledApps() {
    try {
      const saved = os.storage.get(APP_REGISTRY_DISABLED_KEY);
      return saved ? new Set(saved) : new Set();
    } catch (e) {
      return new Set();
    }
  }

  refresh() {
    this._disabledApps = this._loadDisabledApps();
    this._renamedApps = this._loadRenamedApps();
    this._uninstalledApps = this._loadUninstalledApps();
  }

  _saveDisabledApps() {
    try {
      os.storage.set(APP_REGISTRY_DISABLED_KEY, [...this._disabledApps]);
    } catch (e) {}
  }

  _loadRenamedApps() {
    try {
      const saved = os.storage.get(APP_REGISTRY_RENAMED_KEY);
      return saved || {};
    } catch (e) {
      return {};
    }
  }

  _saveRenamedApps() {
    try {
      os.storage.set(APP_REGISTRY_RENAMED_KEY, this._renamedApps);
    } catch (e) {}
  }

  _loadUninstalledApps() {
    try {
      const saved = os.storage.get(APP_REGISTRY_UNINSTALLED_KEY);
      return saved ? new Set(saved) : new Set();
    } catch (e) {
      return new Set();
    }
  }

  _saveUninstalledApps() {
    try {
      os.storage.set(APP_REGISTRY_UNINSTALLED_KEY, [...this._uninstalledApps]);
    } catch (e) {}
  }

  isAppDisabled(appId) {
    return this._disabledApps.has(appId);
  }

  setAppDisabled(appId, disabled) {
    if (PROTECTED_APPS.has(appId)) {
      console.warn(`Cannot disable protected app: ${appId}`);
      return false;
    }
    if (disabled) {
      this._disabledApps.add(appId);
    } else {
      this._disabledApps.delete(appId);
    }
    this._saveDisabledApps();
    return true;
  }

  getAppDisplayName(appId, originalTitle) {
    return this._renamedApps[appId] || originalTitle;
  }

  setAppName(appId, newName) {
    if (!newName || newName.trim() === "") {
      return false;
    }
    this._renamedApps[appId] = newName.trim();
    this._saveRenamedApps();
    return true;
  }

  resetAppName(appId) {
    delete this._renamedApps[appId];
    this._saveRenamedApps();
  }

  isAppUninstalled(appId) {
    return this._uninstalledApps.has(appId);
  }

  uninstallApp(appId) {
    if (PROTECTED_APPS.has(appId)) {
      console.warn(`Cannot uninstall protected app: ${appId}`);
      return false;
    }
    this._uninstalledApps.add(appId);
    this._disabledApps.delete(appId);
    delete this._renamedApps[appId];
    this._saveUninstalledApps();
    this._saveDisabledApps();
    this._saveRenamedApps();
    return true;
  }

  restoreApp(appId) {
    this._uninstalledApps.delete(appId);
    this._saveUninstalledApps();
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
      if (!this._uninstalledApps.has(appId)) {
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
