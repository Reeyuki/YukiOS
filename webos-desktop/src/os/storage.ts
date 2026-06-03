/**
 * OS Storage API
 * Provides unified storage interface with automatic serialization/deserialization
 * All values are automatically JSON serialized on set and deserialized on get
 */

export class StorageAPI {
  /**
   * Get a value from storage
   * @param key - Storage key
   * @returns Deserialized value or null if key doesn't exist or is malformed
   */
  get(key: string): any {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) {
        return null;
      }
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  /**
   * Set a value in storage
   * @param key - Storage key
   * @param value - Value to store (automatically serialized)
   */
  set(key: string, value: any): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(`[Storage API] Failed to set key "${key}":`, e);
    }
  }

  /**
   * Remove a value from storage
   * @param key - Storage key
   */
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error(`[Storage API] Failed to remove key "${key}":`, e);
    }
  }

  /**
   * Clear all values from storage
   */
  clear(): void {
    try {
      localStorage.clear();
    } catch (e) {
      console.error("[Storage API] Failed to clear storage:", e);
    }
  }

  /**
   * Check if a key exists in storage
   * @param key - Storage key
   * @returns true if key exists
   */
  has(key: string): boolean {
    return localStorage.getItem(key) !== null;
  }
}
