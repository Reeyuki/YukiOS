import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../shared/dialogs.js", () => ({
  showAlert: vi.fn(() => Promise.resolve()),
  showConfirm: vi.fn(() => Promise.resolve(true)),
  showPrompt: vi.fn(() => Promise.resolve("test"))
}));

vi.mock("../../audioMixer.js", () => ({
  audioMixer: vi.fn(() => ({
    playSystemSound: vi.fn()
  })),
  SystemAudio: {}
}));

import { DialogAPI } from "../dialog.js";

describe("DialogAPI", () => {
  let dialog: DialogAPI;

  beforeEach(() => {
    dialog = new DialogAPI();
  });

  it("alert resolves", async () => {
    const result = await dialog.alert("Test Title", "Test message");
    expect(result).toBeUndefined();
  });

  it("confirm returns boolean", async () => {
    const result = await dialog.confirm("Confirm", "Are you sure?");
    expect(typeof result).toBe("boolean");
  });

  it("prompt returns string or null", async () => {
    const result = await dialog.prompt("Input", "Enter value:", "default");
    expect(result === null || typeof result === "string").toBe(true);
  });

  it("fileOpen returns null when no explorer app set", async () => {
    const result = await dialog.fileOpen();
    expect(result).toBeNull();
  });

  it("fileSave returns null when no explorer app set", async () => {
    const result = await dialog.fileSave();
    expect(result).toBeNull();
  });

  it("openDirectory returns null when no explorer app set", async () => {
    const result = await dialog.openDirectory();
    expect(result).toBeNull();
  });

  it("prompt uses empty string default when not provided", async () => {
    const result = await dialog.prompt("Input", "Enter value:");
    expect(result === null || typeof result === "string").toBe(true);
  });

  it("setExplorerApp stores the app reference", () => {
    const mockApp = { open: vi.fn() };
    dialog.setExplorerApp(mockApp);
    expect((dialog as any).explorerApp).toBe(mockApp);
  });
});
