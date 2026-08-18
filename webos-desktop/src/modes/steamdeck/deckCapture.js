import { os, $ } from "../../framework.js";
import { BusEvents } from "../../core/EventBus.js";
import { KeybindManager } from "../../keybindManager.js";

const SCREENSHOT_DIR = ["Pictures", "Screenshots"];

function getActiveModeName() {
  return os.modes.getActiveModeName();
}

function getActiveSourceName() {
  const winId = deckCapture.lastFocusedWinId;
  const win = winId ? $("#" + winId) : null;
  const appId = win?.dataset?.appId;
  const info = appId ? os.app.getAppInfo(appId) : null;
  if (info && info.type !== "system") return info.title || info.name || appId;
  return getActiveModeName();
}

export const deckCapture = {
  lastFocusedWinId: null,
  unsubFocus: null,
  keyHandler: null,

  install() {
    if (this.keyHandler) return;
    this.unsubFocus = os.events.on(BusEvents.WINDOW_FOCUSED, ({ winId }) => {
      this.lastFocusedWinId = winId;
    });
    this.keyHandler = (e) => {
      if (!KeybindManager.matches(e, "global.screenshot.deck")) return;
      if (e.target instanceof Element && e.target.closest("input, textarea, [contenteditable]")) return;
      e.preventDefault();
      e.stopPropagation();
      this.capture();
    };
    document.addEventListener("keydown", this.keyHandler);
  },

  uninstall() {
    if (this.unsubFocus) {
      this.unsubFocus();
      this.unsubFocus = null;
    }
    if (this.keyHandler) {
      document.removeEventListener("keydown", this.keyHandler);
      this.keyHandler = null;
    }
    this.lastFocusedWinId = null;
  },

  async capture() {
    if (import.meta.env.VITE_DEV_BUILD === "true") return;
    const shotApp = os.app.getInstance("screenshotApp");
    if (!shotApp || typeof shotApp.pageCapture !== "function") return;
    try {
      const blob = await shotApp.pageCapture();
      const name = `Screenshot-${Date.now()}.png`;
      const source = getActiveSourceName();
      await os.fs.writeBinaryFile(SCREENSHOT_DIR, name, blob, "image", "@content");
      await os.fs.writeMeta(SCREENSHOT_DIR, name, { source, capturedAt: Date.now() });
      os.app.incrementScreenshotTaken();
      os.notify.send("Screenshot", `Captured ${name} from ${source}`);
      os.events.emit(BusEvents.SCREENSHOT_CAPTURED, {});
    } catch {
      os.notify.send("Screenshot", "Capture failed", { type: "error" });
    }
  }
};
