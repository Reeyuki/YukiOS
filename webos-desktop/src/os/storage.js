export class StorageAPI {
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
    } catch (e) {
      console.error(`[Storage API] Failed to set key "${key}":`, e);
    }
  }

  remove(key) {
    try {
      localStorage.removeItem(key);
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
