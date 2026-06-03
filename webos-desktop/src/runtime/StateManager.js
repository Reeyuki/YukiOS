import { PersistenceTypes } from "./AppSchema.js";
import { os } from "../os/index.js";

export class StateManager {
  constructor(appId, initialState = {}, persistence = PersistenceTypes.MEMORY) {
    this.appId = appId;
    this.state = { ...initialState };
    this.persistence = persistence;
    this.listeners = new Set();
    this.storageKey = `app_state_${appId}`;

    if (persistence !== PersistenceTypes.NONE) {
      this._loadPersistedState();
    }
  }

  _loadPersistedState() {
    try {
      if (this.persistence === PersistenceTypes.LOCAL_STORAGE) {
        const saved = os.storage.get(this.storageKey);
        if (saved) {
          this.state = { ...this.state, ...saved };
        }
      } else if (this.persistence === PersistenceTypes.SESSION_STORAGE) {
        const saved = sessionStorage.getItem(this.storageKey);
        if (saved) {
          this.state = { ...this.state, ...JSON.parse(saved) };
        }
      }
    } catch (e) {
      console.warn(`Failed to load persisted state for ${this.appId}:`, e);
    }
  }

  _persistState() {
    if (this.persistence === PersistenceTypes.MEMORY) return;

    try {
      const serialized = JSON.stringify(this.state);
      if (this.persistence === PersistenceTypes.LOCAL_STORAGE) {
        os.storage.set(this.storageKey, serialized);
      } else if (this.persistence === PersistenceTypes.SESSION_STORAGE) {
        sessionStorage.setItem(this.storageKey, serialized);
      }
    } catch (e) {
      console.warn(`Failed to persist state for ${this.appId}:`, e);
    }
  }

  get(path) {
    if (!path) return this.state;

    const keys = path.split(".");
    let value = this.state;
    for (const key of keys) {
      if (value == null) return undefined;
      value = value[key];
    }
    return value;
  }

  set(path, value) {
    if (!path) {
      this.state = value;
    } else {
      const keys = path.split(".");
      const lastKey = keys.pop();
      let target = this.state;
      for (const key of keys) {
        if (target[key] == null) {
          target[key] = {};
        }
        target = target[key];
      }
      target[lastKey] = value;
    }

    this._persistState();
    this._notifyListeners();
  }

  update(path, updater) {
    const currentValue = this.get(path);
    const newValue = updater(currentValue);
    this.set(path, newValue);
  }

  merge(partialState) {
    this.state = { ...this.state, ...partialState };
    this._persistState();
    this._notifyListeners();
  }

  reset() {
    this.state = {};
    this._persistState();
    this._notifyListeners();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  _notifyListeners() {
    this.listeners.forEach((listener) => listener(this.state));
  }

  toJSON() {
    return { ...this.state };
  }
}
