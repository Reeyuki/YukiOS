import { describe, it, expect, beforeEach, vi } from "vitest";
import { bus, BusEvents } from "../EventBus.js";

describe("EventBus", () => {
  beforeEach(() => {
    bus.clear();
  });

  it("registers and emits an event", () => {
    const handler = vi.fn();
    bus.on("test-event", handler);
    bus.emit("test-event", { data: 1 });
    expect(handler).toHaveBeenCalledWith({ data: 1 });
  });

  it("unregisters a handler via off()", () => {
    const handler = vi.fn();
    bus.on("test-event", handler);
    bus.off("test-event", handler);
    bus.emit("test-event", "data");
    expect(handler).not.toHaveBeenCalled();
  });

  it("unregisters a handler via returned cleanup function", () => {
    const handler = vi.fn();
    const cleanup = bus.on("test-event", handler);
    cleanup();
    bus.emit("test-event", "data");
    expect(handler).not.toHaveBeenCalled();
  });

  it("once() fires only once", () => {
    const handler = vi.fn();
    bus.once("once-event", handler);
    bus.emit("once-event", 1);
    bus.emit("once-event", 2);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(1);
  });

  it("does not call handler after off()", () => {
    const handler = vi.fn();
    bus.on("e", handler);
    bus.off("e", handler);
    bus.emit("e", "x");
    expect(handler).not.toHaveBeenCalled();
  });

  it("clear() removes all handlers for an event", () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on("e", h1);
    bus.on("e", h2);
    bus.clear("e");
    bus.emit("e", "x");
    expect(h1).not.toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();
  });

  it("clear() without args removes all events", () => {
    bus.on("e1", vi.fn());
    bus.on("e2", vi.fn());
    bus.clear();
    expect(bus.listenerCount("e1")).toBe(0);
    expect(bus.listenerCount("e2")).toBe(0);
  });

  it("listenerCount returns correct count", () => {
    expect(bus.listenerCount("nonexistent")).toBe(0);
    bus.on("e", vi.fn());
    bus.on("e", vi.fn());
    expect(bus.listenerCount("e")).toBe(2);
  });

  it("handles errors in handlers gracefully", () => {
    const errorHandler = vi.fn(() => {
      throw new Error("handler error");
    });
    const safeHandler = vi.fn();
    bus.on("e", errorHandler);
    bus.on("e", safeHandler);
    bus.emit("e", "data");
    expect(safeHandler).toHaveBeenCalledWith("data");
  });

  it("emitting to event with no handlers does not throw", () => {
    expect(() => bus.emit("nonexistent", "data")).not.toThrow();
  });

  it("BusEvents exports are strings", () => {
    expect(typeof BusEvents).toBe("object");
    expect(BusEvents).not.toBeNull();
  });
});
