import { BaseApp } from "./core/BaseApp.js";
import { StorageKeys } from "./StorageKeys.js";

class PowerApp extends BaseApp {
  constructor(services) {
    super(services);
    this.winId = "power-window";
    this.popupId = "power-tray-popup";
    this._popupVisible = false;
    this.powerMode = localStorage.getItem(StorageKeys.turboMode) || "high";
    this._initTray();
  }

  _shouldSuppressNotification() {
    const position = localStorage.getItem(StorageKeys.notificationsPosition) || "bottom-right";
    return position === "bottom-right";
  }

  _initTray() {
    this.registerTray(this.winId, "fas fa-battery-full", "Power", {
      resident: true,
      showInTray: true,
      onClick: () => {
        this.togglePopup();
      },
      contextMenuItems: [
        { label: "Turbo", icon: "fa-bolt", action: () => this._setPowerMode("turbo") },
        { label: "Balanced", icon: "fa-balance-scale", action: () => this._setPowerMode("balanced") },
        { label: "Quality", icon: "fa-gem", action: () => this._setPowerMode("high") },
        { type: "divider" }
      ]
    });
  }

  togglePopup() {
    if (this._popupVisible) {
      this.closePopup();
    } else {
      this.openPopup();
    }
  }

  openPopup() {
    if (this._popupVisible) return;

    const existingPopup = document.getElementById(this.popupId);
    if (existingPopup) {
      existingPopup.remove();
    }

    const popup = document.createElement("div");
    popup.id = this.popupId;
    popup.className = "power-tray-popup";
    popup.innerHTML = `
      <div class="power-popup-content">
        <div class="power-battery-section">
          <div class="power-battery-icon">
            <i class="fas fa-battery-full"></i>
          </div>
          <div class="power-battery-info">
            <div class="power-battery-percent">100%</div>
            <div class="power-battery-status">Fully Charged</div>
          </div>
        </div>
        <div class="power-mode-section">
          <div class="power-mode-title">Power Mode</div>
          <div class="power-mode-options">
            <button class="power-mode-btn ${this.powerMode === "turbo" ? "active" : ""}" data-mode="turbo">
              <i class="fas fa-bolt"></i>
              <span>Turbo</span>
            </button>
            <button class="power-mode-btn ${this.powerMode === "balanced" ? "active" : ""}" data-mode="balanced">
              <i class="fas fa-balance-scale"></i>
              <span>Balanced</span>
            </button>
            <button class="power-mode-btn ${this.powerMode === "high" ? "active" : ""}" data-mode="high">
              <i class="fas fa-gem"></i>
              <span>Quality</span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(popup);

    const trayEl = document.getElementById("app-tray");
    const trayRect = trayEl ? trayEl.getBoundingClientRect() : { right: 16, top: window.innerHeight - 48 };

    popup.style.right = `${window.innerWidth - trayRect.right}px`;
    popup.style.bottom = `${window.innerHeight - trayRect.top + 8}px`;
    popup.style.display = "block";

    this._popupVisible = true;
    this._bindEvents(popup);

    document.addEventListener("click", this._handleOutsideClick);
  }

  closePopup() {
    const popup = document.getElementById(this.popupId);
    if (popup) {
      popup.classList.add("closing");
      popup.addEventListener(
        "animationend",
        () => {
          popup.remove();
        },
        { once: true }
      );
    }
    this._popupVisible = false;
    document.removeEventListener("click", this._handleOutsideClick);
  }

  _handleOutsideClick = (e) => {
    const popup = document.getElementById(this.popupId);
    const trayEl = document.getElementById("app-tray");
    if (popup && !e.target.closest("#power-tray-popup") && !e.target.closest("#app-tray")) {
      this.closePopup();
    }
  };

  open(options = {}) {
    this.togglePopup();
  }

  _bindEvents(popup) {
    const modeBtns = popup.querySelectorAll(".power-mode-btn");

    modeBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.mode;
        this._setPowerMode(mode);
        modeBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });
  }

  _setPowerMode(mode) {
    this.powerMode = mode;
    localStorage.setItem(StorageKeys.turboMode, mode);
    document.documentElement.setAttribute("data-turbo", mode);
    this._applyTurboMode(mode);

    const modeNames = {
      turbo: "Turbo",
      balanced: "Balanced",
      high: "Quality"
    };

    if (!this._shouldSuppressNotification()) {
      this.notify("Power Mode", `Switched to ${modeNames[mode]} mode`, "info", 2000, "fa-bolt");
    }
  }

  _applyTurboMode(mode) {
    const effective = mode || "high";

    let styleEl = document.getElementById("yukios-turbo-override");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "yukios-turbo-override";
      document.head.appendChild(styleEl);
    }

    if (effective === "turbo") {
      styleEl.textContent = `
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
      styleEl.textContent = `
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
      styleEl.textContent = "";
    }
  }

  onClose(winId) {
    this.closePopup();
  }
}

export { PowerApp };
