import { describe, it, expect, beforeEach, vi } from "vitest";
import { StorageAPI } from "../storage.js";

describe("StorageAPI", () => {
  let storage;

  beforeEach(() => {
    localStorage.clear();
    storage = new StorageAPI();
  });

  it("sets and gets a string value", () => {
    storage.set("test-key", "hello");
    expect(storage.get("test-key")).toBe("hello");
  });

  it("sets and gets a number", () => {
    storage.set("count", 42);
    expect(storage.get("count")).toBe(42);
  });

  it("sets and gets an object", () => {
    const obj = { a: 1, b: [2, 3] };
    storage.set("obj", obj);
    expect(storage.get("obj")).toEqual(obj);
  });

  it("sets and gets null", () => {
    storage.set("null-key", null);
    expect(storage.get("null-key")).toBeNull();
  });

  it("sets and gets an array", () => {
    const arr = [1, "two", true];
    storage.set("arr", arr);
    expect(storage.get("arr")).toEqual(arr);
  });

  it("returns null for missing keys", () => {
    expect(storage.get("nonexistent")).toBeNull();
  });

  it("removes a key", () => {
    storage.set("temp", "value");
    storage.remove("temp");
    expect(storage.get("temp")).toBeNull();
  });

  it("checks key existence with has()", () => {
    storage.set("exists", "yes");
    expect(storage.has("exists")).toBe(true);
    expect(storage.has("nothere")).toBe(false);
  });

  it("clears all keys", () => {
    storage.set("a", 1);
    storage.set("b", 2);
    storage.clear();
    expect(storage.get("a")).toBeNull();
    expect(storage.get("b")).toBeNull();
  });

  it("handles malformed JSON gracefully", () => {
    localStorage.setItem("bad-json", "{invalid");
    expect(storage.get("bad-json")).toBeNull();
  });

  it("returns null when localStorage.setItem throws", () => {
    const orig = localStorage.setItem;
    localStorage.setItem = vi.fn(() => {
      throw new Error("full");
    });
    storage.set("fail", "val");
    localStorage.setItem = orig;
  });
});
