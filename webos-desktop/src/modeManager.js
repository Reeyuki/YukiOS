import { os } from "./os/index.js";
import { StorageKeys } from "./StorageKeys.js";
import { bus } from "./core/EventBus.js";
import { BusEvents } from "./core/EventBusConstants.js";

export const MODES = Object.freeze({
  MAC: "mac",
  TILING: "tiling",
  "3D": "3d",
  CHROME_OS: "chromeos"
});

const MODE_DEFS = {
  [MODES.MAC]: {
    cssClass: "mac-mode",
    cssTarget: "html",
    storageKey: StorageKeys.macOsControls
  },
  [MODES.TILING]: {
    cssClass: "tiling-active",
    cssTarget: "body",
    storageKey: StorageKeys.tilingEnabled
  },
  [MODES["3D"]]: {
    cssClass: "3d-mode",
    cssTarget: "html",
    storageKey: null
  },
  [MODES.CHROME_OS]: {
    cssClass: "chromeos-mode",
    cssTarget: "html",
    storageKey: StorageKeys.chromeOsMode
  }
};

class ModeManager {
  constructor() {
    this.activeModes = new Set();
  }

  isActive(id) {
    return this.activeModes.has(id);
  }

  getActiveModes() {
    return [...this.activeModes];
  }

  enter(id) {
    if (this.activeModes.has(id)) return;
    const def = MODE_DEFS[id];
    if (!def) return;
    this.activeModes.add(id);

    if (def.cssClass) {
      const target = def.cssTarget === "body" ? document.body : document.documentElement;
      target.classList.add(def.cssClass);
    }

    if (def.storageKey) os.storage.set(def.storageKey, "true");

    bus.emit(BusEvents.MODE_ENTERED, { id });
  }

  exit(id) {
    if (!this.activeModes.has(id)) return;
    const def = MODE_DEFS[id];
    if (!def) return;
    this.activeModes.delete(id);

    if (def.cssClass) {
      const target = def.cssTarget === "body" ? document.body : document.documentElement;
      target.classList.remove(def.cssClass);
    }

    if (def.storageKey) os.storage.set(def.storageKey, "false");

    bus.emit(BusEvents.MODE_EXITED, { id });
  }

  exitAll() {
    for (const id of this.getActiveModes()) {
      this.exit(id);
    }
  }
}

export const modeManager = new ModeManager();
