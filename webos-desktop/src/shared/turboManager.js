import { StorageKeys } from "../StorageKeys.js";

class TurboManager {
  constructor() {
    this._currentMode = localStorage.getItem(StorageKeys.turboMode) || "high";
    this._styleEl = null;
    this._init();
  }

  _init() {
    this._applyTurboMode(this._currentMode);
  }

  getMode() {
    return this._currentMode;
  }

  setMode(mode) {
    this._currentMode = mode;
    localStorage.setItem(StorageKeys.turboMode, mode);
    document.documentElement.setAttribute("data-turbo", mode);
    this._applyTurboMode(mode);
  }

  _applyTurboMode(mode) {
    const effective = mode || "high";

    if (!this._styleEl) {
      this._styleEl = document.createElement("style");
      this._styleEl.id = "yukios-turbo-override";
      document.head.appendChild(this._styleEl);
    }

    if (effective === "turbo") {
      this._styleEl.textContent = `
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
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4) !important;
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
        html[data-turbo="turbo"] #power-tray-popup,
        html[data-turbo="turbo"] #brightness-tray-popup,
        html[data-turbo="turbo"] #clipboard-tray-popup,
        html[data-turbo="turbo"] #audio-mixer-panel {
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4) !important;
        }
      `;
    } else if (effective === "balanced") {
      this._styleEl.textContent = `
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
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5) !important;
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
      this._styleEl.textContent = "";
    }
  }
}

const turboManager = new TurboManager();
export { turboManager };
