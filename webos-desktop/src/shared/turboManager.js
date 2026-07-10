import { StorageKeys, os } from "../framework.js";
class TurboManager {
  constructor() {
    let mode = null;
    try {
      mode = os.storage.get(StorageKeys.turboMode);
    } catch {
      mode = null;
    }
    this.currentMode = mode || "balanced";
    this.styleEl = null;
    this.init();
  }

  init() {
    document.documentElement.setAttribute("data-turbo", this.currentMode);
    this.applyTurboMode(this.currentMode);
  }

  getMode() {
    return this.currentMode;
  }

  setMode(mode) {
    this.currentMode = mode;
    try {
      os.storage.set(StorageKeys.turboMode, mode);
    } catch {
      // fallback silently
    }
    document.documentElement.setAttribute("data-turbo", mode);
    this.applyTurboMode(mode);
  }

  applyTurboMode(mode) {
    const effective = mode || "high";

    if (!this.styleEl) {
      this.styleEl = document.createElement("style");
      this.styleEl.id = "yukios-turbo-override";
      document.head.appendChild(this.styleEl);
    }

    if (effective === "turbo") {
      this.styleEl.textContent = `
        html[data-turbo="turbo"] .window,
        html[data-turbo="turbo"] .window-header,
        html[data-turbo="turbo"] .taskbar-preview,
        html[data-turbo="turbo"] .context-menu {
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }
        html[data-turbo="turbo"] .window,
        html[data-turbo="turbo"] .taskbar-preview,
        html[data-turbo="turbo"] .context-menu {
          box-shadow: var(--shadow-sm) !important;
        }
        html[data-turbo="turbo"] *:not(.start-menu):not(.start-menu *) {
          text-shadow: none !important;
        }
        html[data-turbo="turbo"] .window:hover {
          transform: none !important;
        }
        html[data-turbo="turbo"] .icon:hover img {
          transform: none !important;
        }
        html[data-turbo="turbo"] #snap-ghost {
          transition: none !important;
          transform: none !important;
        }
        html[data-turbo="turbo"] #snap-ghost:not(.snap-ghost-active) {
          display: none !important;
        }
        html[data-turbo="turbo"] #tray-overflow-popup,
        html[data-turbo="turbo"] #display-performance-tray-popup,
        html[data-turbo="turbo"] #clipboard-tray-popup,
        html[data-turbo="turbo"] #audio-mixer-panel {
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
          box-shadow: var(--shadow-sm) !important;
        }
      `;
    } else if (effective === "balanced") {
      this.styleEl.textContent = `
        html[data-turbo="balanced"] .window,
        html[data-turbo="balanced"] .taskbar-item,
        html[data-turbo="balanced"] .icon,
        html[data-turbo="balanced"] .context-menu,
        html[data-turbo="balanced"] .dropdown-item,
        html[data-turbo="balanced"] .settings-btn,
        html[data-turbo="balanced"] button,
        html[data-turbo="balanced"] input,
        html[data-turbo="balanced"] select {
          transition-duration: 0.15s !important;
        }
        html[data-turbo="balanced"] .window {
          backdrop-filter: blur(12px) !important;
          -webkit-backdrop-filter: blur(12px) !important;
        }
        html[data-turbo="balanced"] .window-header {
          backdrop-filter: blur(8px) saturate(1.1) !important;
          -webkit-backdrop-filter: blur(8px) saturate(1.1) !important;
        }
        html[data-turbo="balanced"] .window,
        html[data-turbo="balanced"] .taskbar-preview,
        html[data-turbo="balanced"] .context-menu {
          box-shadow: var(--shadow-md) !important;
        }
        html[data-turbo="balanced"] .wa-z-lift {
          box-shadow: var(--shadow-md) !important;
        }
        html[data-turbo="balanced"] .window:hover {
          transform: none !important;
        }
        html[data-turbo="balanced"] .icon:hover img {
          transform: scale(1.02) !important;
        }
        html[data-turbo="balanced"] #snap-ghost {
          transition-duration: 0.1s !important;
        }
      `;
    } else {
      this.styleEl.textContent = "";
    }
  }
}

const turboManager = new TurboManager();
export { turboManager };
