/**
 * OS Storage API
 * Provides unified storage interface with automatic serialization/deserialization
 * All values are automatically JSON serialized on set and deserialized on get
 */

export class StorageAPI {
  get<T = unknown>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) {
        return null;
      }
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(`[Storage API] Failed to set key "${key}":`, e);
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error(`[Storage API] Failed to remove key "${key}":`, e);
    }
  }

  clear(): void {
    try {
      localStorage.clear();
    } catch (e) {
      console.error("[Storage API] Failed to clear storage:", e);
    }
  }

  has(key: string): boolean {
    return localStorage.getItem(key) !== null;
  }
}
