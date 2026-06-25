import { describe, it, expect } from "vitest";
import { StorageKeys } from "../StorageKeys.js";

describe("StorageKeys", () => {
  it("exports an object", () => {
    expect(typeof StorageKeys).toBe("object");
    expect(StorageKeys).not.toBeNull();
  });

  it("has all keys as non-empty strings", () => {
    for (const [key, value] of Object.entries(StorageKeys)) {
      expect(typeof value, `Key ${key} should be a string`).toBe("string");
      expect(value.length, `Key ${key} should not be empty`).toBeGreaterThan(0);
    }
    
  });

  it("all values start with yukiOS or yukios or browser_ or wm_ or steam_", () => {
    for (const [key, value] of Object.entries(StorageKeys)) {
      const valid =
        value.startsWith("yukiOS_") ||
        value.startsWith("yukios_") ||
        value.startsWith("browser_") ||
        value.startsWith("wm_") ||
        value.startsWith("steam_") ||
        value.startsWith("youtube_");
      expect(valid, `Key "${key}" has unexpected prefix: "${value}"`).toBe(true);
    }
  });

  it("has no duplicate values", () => {
    const values = Object.values(StorageKeys);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it("contains critical keys", () => {
    expect(StorageKeys).toHaveProperty("theme");
    expect(StorageKeys).toHaveProperty("username");
    expect(StorageKeys).toHaveProperty("wallpaperKey");
    expect(StorageKeys).toHaveProperty("setupCompleted");
  });
});
