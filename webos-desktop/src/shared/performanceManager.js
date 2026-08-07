import { StorageKeys, os, createElement } from "../framework.js";
class PerformanceManager {
  constructor() {
    let mode = null;
    try {
      mode = os.storage.get(StorageKeys.performanceMode);
    } catch {
      mode = null;
    }
    this.currentMode = mode || "balanced";
    this.styleEl = null;
    this.init();
  }

  init() {
    document.documentElement.setAttribute("data-performance", this.currentMode);
    this.applyPerformanceMode(this.currentMode);
  }

  getMode() {
    return this.currentMode;
  }

  setMode(mode) {
    this.currentMode = mode;
    try {
      os.storage.set(StorageKeys.performanceMode, mode);
    } catch {
      // fallback silently
    }
    document.documentElement.setAttribute("data-performance", mode);
    this.applyPerformanceMode(mode);
  }

  applyPerformanceMode(mode) {
    const effective = mode || "high";

    if (!this.styleEl) {
      this.styleEl = createElement("style");
      this.styleEl.id = "yukios-performance-override";
      document.head.appendChild(this.styleEl);
    }

    if (effective === "performance") {
      this.styleEl.textContent = `
        html[data-performance="performance"] .window,
        html[data-performance="performance"] .window-header,
        html[data-performance="performance"] .taskbar-preview,
        html[data-performance="performance"] .context-menu {
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }
        html[data-performance="performance"] .window,
        html[data-performance="performance"] .taskbar-preview,
        html[data-performance="performance"] .context-menu {
          box-shadow: var(--shadow-sm) !important;
        }
        html[data-performance="performance"] *:not(.start-menu):not(.start-menu *) {
          text-shadow: none !important;
        }
        html[data-performance="performance"] .window:hover {
          transform: none !important;
        }
        html[data-performance="performance"] .icon:hover img {
          transform: none !important;
        }
        html[data-performance="performance"] #snap-ghost {
          transition: none !important;
          transform: none !important;
        }
        html[data-performance="performance"] #snap-ghost:not(.snap-ghost-active) {
          display: none !important;
        }
        html[data-performance="performance"] #tray-overflow-popup,
        html[data-performance="performance"] #display-performance-tray-popup,
        html[data-performance="performance"] #clipboard-tray-popup,
        html[data-performance="performance"] #audio-mixer-panel {
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
          box-shadow: var(--shadow-sm) !important;
        }
      `;
    } else if (effective === "balanced") {
      this.styleEl.textContent = `
        html[data-performance="balanced"] .window,
        html[data-performance="balanced"] .taskbar-item,
        html[data-performance="balanced"] .icon,
        html[data-performance="balanced"] .context-menu,
        html[data-performance="balanced"] .dropdown-item,
        html[data-performance="balanced"] .settings-btn,
        html[data-performance="balanced"] button,
        html[data-performance="balanced"] input,
        html[data-performance="balanced"] select {
          transition-duration: 0.15s !important;
        }
        html[data-performance="balanced"] .window {
          backdrop-filter: blur(12px) !important;
          -webkit-backdrop-filter: blur(12px) !important;
        }
        html[data-performance="balanced"] .window-header {
          backdrop-filter: blur(8px) saturate(1.1) !important;
          -webkit-backdrop-filter: blur(8px) saturate(1.1) !important;
        }
        html[data-performance="balanced"] .window,
        html[data-performance="balanced"] .taskbar-preview,
        html[data-performance="balanced"] .context-menu {
          box-shadow: var(--shadow-md) !important;
        }
        html[data-performance="balanced"] .wa-z-lift {
          box-shadow: var(--shadow-md) !important;
        }
        html[data-performance="balanced"] .window:hover {
          transform: none !important;
        }
        html[data-performance="balanced"] .icon:hover img {
          transform: scale(1.02) !important;
        }
        html[data-performance="balanced"] #snap-ghost {
          transition-duration: 0.1s !important;
        }
      `;
    } else {
      this.styleEl.textContent = "";
    }
  }
}

const performanceManager = new PerformanceManager();
export { performanceManager };
