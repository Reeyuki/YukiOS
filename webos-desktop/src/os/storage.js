export class StorageAPI {
  constructor() {
    this.changeListeners = new Map();
  }

  subscribe(key, callback) {
    if (!this.changeListeners.has(key)) this.changeListeners.set(key, new Set());
    this.changeListeners.get(key).add(callback);
    return () => {
      this.changeListeners.get(key)?.delete(callback);
    };
  }

  notifyChange(key) {
    this.changeListeners.get(key)?.forEach((callback) => {
      try {
        callback();
      } catch {}
    });
  }

  get(key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) {
        return null;
      }
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      this.notifyChange(key);
    } catch (e) {
      console.error(`[Storage API] Failed to set key "${key}":`, e);
    }
  }

  remove(key) {
    try {
      localStorage.removeItem(key);
      this.notifyChange(key);
    } catch (e) {
      console.error(`[Storage API] Failed to remove key "${key}":`, e);
    }
  }

  clear() {
    try {
      localStorage.clear();
    } catch (e) {
      console.error("[Storage API] Failed to clear storage:", e);
    }
  }

  has(key) {
    return localStorage.getItem(key) !== null;
  }
}
