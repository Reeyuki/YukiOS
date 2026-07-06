import { turboManager } from "../shared/turboManager.js";

import { BaseApp, StorageKeys, os } from "../framework.js";
class PowerApp extends BaseApp {
  constructor(services) {
    super(services);
    this.winId = "power-window";
    this.popupId = "power-tray-popup";
    this._popupVisible = false;
    this.powerMode = turboManager.getMode();
    this.batteryInfo = { level: 1, charging: true };
    this._initBattery();
    this._initTray();
  }

  async _initBattery() {
    if ("getBattery" in navigator) {
      try {
        const battery = await navigator.getBattery();
        this.batteryInfo = {
          level: battery.level,
          charging: battery.charging
        };
        battery.addEventListener("levelchange", () => {
          this.batteryInfo.level = battery.level;
          this._updateTrayIcon();
        });
        battery.addEventListener("chargingchange", () => {
          this.batteryInfo.charging = battery.charging;
          this._updateTrayIcon();
        });
      } catch (e) {
        console.warn("Battery API error:", e);
      }
    }
  }

  _getBatteryIcon() {
    const level = Math.round(this.batteryInfo.level * 100);
    if (level > 90) return "fas fa-battery-full";
    if (level > 65) return "fas fa-battery-three-quarters";
    if (level > 35) return "fas fa-battery-half";
    if (level > 10) return "fas fa-battery-quarter";
    return "fas fa-battery-empty";
  }

  _getBatteryFillColor(level) {
    if (this.batteryInfo.charging) return "#4ade80";
    if (level > 60) return "#22c55e";
    if (level > 30) return "#facc15";
    return "#ef4444";
  }

  _getBatteryStatusText() {
    const level = Math.round(this.batteryInfo.level * 100);
    const charging = this.batteryInfo.charging;
    if (charging) {
      if (level === 100) return "Fully Charged";
      return "Charging";
    }
    if (level <= 20) return "Low Battery";
    return "On Battery";
  }

  _updateTrayIcon() {
    const trayEl = document.querySelector(`[data-tray-id="${this.winId}"]`);
    if (trayEl) {
      const iconEl = trayEl.querySelector("i");
      if (iconEl) {
        if (this.batteryInfo.charging) {
          iconEl.className = "fas fa-bolt";
          iconEl.style.color = "#4ade80";
        } else {
          iconEl.className = this._getBatteryIcon();
          iconEl.style.color = "";
        }
      }
    }
  }

  _shouldSuppressNotification() {
    const position = os.storage.get(StorageKeys.notificationsPosition) || "bottom-right";
    return position === "bottom-right";
  }

  _initTray() {
    this.registerTray(this.winId, this._getBatteryIcon(), "Power", {
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
    const batteryPercent = Math.round(this.batteryInfo.level * 100);
    const batteryStatus = this._getBatteryStatusText();
    const batteryFillColor = this._getBatteryFillColor(batteryPercent);
    popup.innerHTML = `
      <div class="power-popup-content">
        <div class="power-battery-section">
          <div class="power-battery-icon">
            <div class="battery">
              <div class="battery-fill" style="width:${batteryPercent}%;background:${batteryFillColor}"></div>
            </div>
          </div>
          <div class="power-battery-info">
            <div class="power-battery-percent">${batteryPercent}%</div>
            <div class="power-battery-status">${batteryStatus}</div>
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
    turboManager.setMode(mode);

    const modeNames = {
      turbo: "Turbo",
      balanced: "Balanced",
      high: "Quality"
    };

    if (!this._shouldSuppressNotification()) {
      os.notify.send("Power Mode", `Switched to ${modeNames[mode]} mode`, {
        type: "info",
        duration: 2000,
        icon: "fa-bolt"
      });
    }
  }

  onClose(winId) {
    this.closePopup();
  }
}

export { PowerApp };
