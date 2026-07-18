import { turboManager } from "../shared/turboManager.js";
import { BRIGHTNESS_PRESETS } from "../shared/brightnessPresets.js";
import { Achievements } from "../achievements.js";
import { BusEvents } from "../core/EventBus.js";
import { BaseApp, StorageKeys, os } from "../framework.js";
import { KeybindManager } from "../keybindManager.js";
import { isTaskbarTop } from "../utils/utils.js";

class DisplayPerformanceApp extends BaseApp {
  constructor(services) {
    super(services);
    this.winId = "display-performance-window";
    this.popupId = "display-performance-tray-popup";
    this.popupVisible = false;

    this.powerMode = turboManager.getMode();
    this.batteryInfo = { level: 1, charging: true };

    this.brightness = parseInt(os.storage.get(StorageKeys.brightness), 10) || 100;
    this.contrast = parseFloat(os.storage.get(StorageKeys.contrast)) || 1;
    this.gamma = parseFloat(os.storage.get(StorageKeys.gamma)) || 1;
    this.temperature = parseInt(os.storage.get(StorageKeys.temperature), 10) || 50;
    this.nightModeEnabled = os.storage.get(StorageKeys.nightModeEnabled) === "true";
    this.nightModeStart = os.storage.get(StorageKeys.nightModeStart) || "20:00";
    this.nightModeEnd = os.storage.get(StorageKeys.nightModeEnd) || "07:00";

    this.initBattery();
    this.initTray();
    this.applyDisplaySettings();
    this.setupKeybinds();
    this.setupNightModeSchedule();
  }

  async initBattery() {
    if ("getBattery" in navigator) {
      try {
        const battery = await navigator.getBattery();
        this.batteryInfo = {
          level: battery.level,
          charging: battery.charging
        };
        battery.addEventListener("levelchange", () => {
          this.batteryInfo.level = battery.level;
          this.updateTrayIcon();
          this.updateBatteryDisplay();
        });
        battery.addEventListener("chargingchange", () => {
          this.batteryInfo.charging = battery.charging;
          this.updateTrayIcon();
          this.updateBatteryDisplay();
        });
      } catch (e) {
        console.warn("Battery API error:", e);
      }
    }
  }

  getBatteryIcon() {
    const level = Math.round(this.batteryInfo.level * 100);
    if (level > 90) return "fas fa-battery-full";
    if (level > 65) return "fas fa-battery-three-quarters";
    if (level > 35) return "fas fa-battery-half";
    if (level > 10) return "fas fa-battery-quarter";
    return "fas fa-battery-empty";
  }

  getBatteryFillColor(level) {
    if (this.batteryInfo.charging) return "#4ade80";
    if (level > 60) return "#22c55e";
    if (level > 30) return "#facc15";
    return "#ef4444";
  }

  getBatteryIconHtml() {
    if (this.batteryInfo.charging) {
      return `<i class="fas fa-bolt" style="color:#4ade80"></i>`;
    }
    return `<i class="${this.getBatteryIcon()}"></i>`;
  }

  getBatteryStatusText() {
    const level = Math.round(this.batteryInfo.level * 100);
    const charging = this.batteryInfo.charging;
    if (charging) {
      if (level === 100) return "Fully Charged";
      return "Charging";
    }
    if (level <= 20) return "Low Battery";
    return "On Battery";
  }

  updateTrayIcon() {
    const trayEl = document.querySelector(`[data-tray-id="${this.winId}"]`);
    if (trayEl) {
      const iconContainer = trayEl.querySelector(".tray-icon-btn") || trayEl;
      iconContainer.innerHTML = this.getBatteryIconHtml();
    }
  }

  updateBatteryDisplay() {
    const popup = document.getElementById(this.popupId);
    if (!popup) return;
    const batteryPercent = popup.querySelector(".battery-percent");
    const batteryStatus = popup.querySelector(".battery-status");
    const batteryIconContainer = popup.querySelector(".battery-icon");
    if (batteryPercent) batteryPercent.textContent = `${Math.round(this.batteryInfo.level * 100)}%`;
    if (batteryStatus) batteryStatus.textContent = this.getBatteryStatusText();
    if (batteryIconContainer) batteryIconContainer.innerHTML = this.getBatteryIconHtml();
  }

  shouldSuppressNotification() {
    const position = os.storage.get(StorageKeys.notificationsPosition) || "bottom-right";
    return position === "bottom-right";
  }

  initTray() {
    if (os.storage.get(StorageKeys.macOsControls) === "true") return;
    this.registerTray(this.winId, this.getBatteryIcon(), "Display & Performance", {
      resident: true,
      showInTray: true,
      onClick: () => {
        this.togglePopup();
      },
      contextMenuItems: [
        { label: "Turbo", icon: "fa-bolt", action: () => this.setPowerMode("turbo") },
        { label: "Balanced", icon: "fa-balance-scale", action: () => this.setPowerMode("balanced") },
        { label: "Quality", icon: "fa-gem", action: () => this.setPowerMode("high") },
        { type: "divider" },
        { label: "Default Display", icon: "fa-circle", action: () => this.applyPreset("default") },
        { label: "Reading", icon: "fa-book", action: () => this.applyPreset("reading") },
        { label: "Cinema", icon: "fa-film", action: () => this.applyPreset("cinema") },
        { label: "Night Coding", icon: "fa-moon", action: () => this.applyPreset("nightCoding") }
      ]
    });
    setTimeout(() => this.updateTrayIcon(), 0);
  }

  saveSettings() {
    os.storage.set(StorageKeys.brightness, this.brightness.toString());
    os.storage.set(StorageKeys.contrast, this.contrast.toString());
    os.storage.set(StorageKeys.gamma, this.gamma.toString());
    os.storage.set(StorageKeys.temperature, this.temperature.toString());
    os.storage.set(StorageKeys.nightModeEnabled, this.nightModeEnabled.toString());
    os.storage.set(StorageKeys.nightModeStart, this.nightModeStart);
    os.storage.set(StorageKeys.nightModeEnd, this.nightModeEnd);
  }

  applyDisplaySettings() {
    const t = this.temperature;
    let brightness = this.brightness / 100;
    let contrast = this.contrast;
    let saturate = 1;
    let sepia = 0;

    if (t < 50) {
      const warm = (50 - t) / 50;
      sepia = warm * 0.9;
      saturate = 1 - warm * 0.2;
    } else {
      const cool = (t - 50) / 50;
      saturate = 1 - cool * 0.1;
      sepia = 0;
    }

    const gammaValue = this.gamma;
    const gammaFilter = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeComponentTransfer%3E%3CfeFuncR type='gamma' exponent='${gammaValue}'/%3E%3CfeFuncG type='gamma' exponent='${gammaValue}'/%3E%3CfeFuncB type='gamma' exponent='${gammaValue}'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3C/svg%3E#g")`;

    document.documentElement.style.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturate}) sepia(${sepia})`;
  }

  setupKeybinds() {
    this.keydownHandler = (e) => {
      if (KeybindManager.matches(e, "global.brightness.up")) {
        e.preventDefault();
        this.adjustBrightness(5);
      } else if (KeybindManager.matches(e, "global.brightness.down")) {
        e.preventDefault();
        this.adjustBrightness(-5);
      } else if (KeybindManager.matches(e, "global.temperature.cooler")) {
        e.preventDefault();
        this.adjustTemperature(-5);
      } else if (KeybindManager.matches(e, "global.temperature.warmer")) {
        e.preventDefault();
        this.adjustTemperature(5);
      }
    };
    document.addEventListener("keydown", this.keydownHandler);
  }

  cleanupKeybinds() {
    if (this.keydownHandler) {
      document.removeEventListener("keydown", this.keydownHandler);
      this.keydownHandler = null;
    }
  }

  setupNightModeSchedule() {
    this.checkNightMode();
    this.nightModeInterval = setInterval(() => this.checkNightMode(), 60000);
  }

  checkNightMode() {
    if (!this.nightModeEnabled) return;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const [startH, startM] = this.nightModeStart.split(":").map(Number);
    const [endH, endM] = this.nightModeEnd.split(":").map(Number);
    const startTime = startH * 60 + startM;
    const endTime = endH * 60 + endM;

    let isNight;
    if (startTime < endTime) {
      isNight = currentTime >= startTime && currentTime < endTime;
    } else {
      isNight = currentTime >= startTime || currentTime < endTime;
    }

    if (isNight && this.temperature > 25) {
      this.temperature = 20;
      this.applyDisplaySettings();
      this.saveSettings();
    }
  }

  adjustBrightness(delta) {
    this.brightness = Math.max(20, Math.min(150, this.brightness + delta));
    this.applyDisplaySettings();
    this.saveSettings();
    this.updatePopupSliders();
    if (!this.shouldSuppressNotification()) {
      os.notify.send("Brightness", `${Math.round(this.brightness)}%`, { type: "info", duration: 1000, icon: "fa-sun" });
    }
  }

  adjustTemperature(delta) {
    this.temperature = Math.max(0, Math.min(100, this.temperature + delta));
    this.applyDisplaySettings();
    this.saveSettings();
    this.updatePopupSliders();
    if (!this.shouldSuppressNotification()) {
      os.notify.send("Temperature", this.getTemperatureLabel(this.temperature), {
        type: "info",
        duration: 1000,
        icon: "fa-temperature-half"
      });
    }
  }

  getTemperatureLabel(value) {
    if (value < 33) return "Warm";
    if (value > 66) return "Cool";
    return "Neutral";
  }

  applyPreset(presetName) {
    const preset = BRIGHTNESS_PRESETS[presetName];
    if (!preset) return;

    this.brightness = preset.brightness;
    this.contrast = preset.contrast;
    this.gamma = preset.gamma;
    this.temperature = preset.temperature;

    this.applyDisplaySettings();
    this.saveSettings();
    this.updatePopupSliders();
    if (!this.shouldSuppressNotification()) {
      os.notify.send("Preset Applied", presetName.charAt(0).toUpperCase() + presetName.slice(1), {
        type: "success",
        duration: 1500,
        icon: "fa-check"
      });
    }
  }

  setPowerMode(mode) {
    this.powerMode = mode;
    turboManager.setMode(mode);

    this.os.app.apps.achievementsApp?.incrementPowerProfileChange();

    const modeNames = {
      turbo: "Turbo",
      balanced: "Balanced",
      high: "Quality"
    };

    if (!this.shouldSuppressNotification()) {
      os.notify.send("Power Mode", `Switched to ${modeNames[mode]} mode`, {
        type: "info",
        duration: 2000,
        icon: "fa-bolt"
      });
    }

    this.updatePowerModeButtons();
  }

  updatePowerModeButtons() {
    const popup = document.getElementById(this.popupId);
    if (!popup) return;

    const modeBtns = popup.querySelectorAll(".power-mode-btn");
    modeBtns.forEach((btn) => {
      btn.classList.remove("active");
      if (btn.dataset.mode === this.powerMode) {
        btn.classList.add("active");
      }
    });
  }

  updatePopupSliders() {
    const popup = document.getElementById(this.popupId);
    if (!popup) return;

    const brightnessSlider = popup.querySelector("#brightness-slider");
    const contrastSlider = popup.querySelector("#contrast-slider");
    const gammaSlider = popup.querySelector("#gamma-slider");
    const temperatureSlider = popup.querySelector("#temperature-slider");

    if (brightnessSlider) brightnessSlider.value = this.brightness;
    if (contrastSlider) contrastSlider.value = this.contrast;
    if (gammaSlider) gammaSlider.value = this.gamma;
    if (temperatureSlider) temperatureSlider.value = this.temperature;

    const valueDisplays = popup.querySelectorAll(".brightness-value");
    if (valueDisplays[0]) valueDisplays[0].textContent = `${Math.round(this.brightness)}%`;
    if (valueDisplays[1]) valueDisplays[1].textContent = this.contrast.toFixed(2);
    if (valueDisplays[2]) valueDisplays[2].textContent = this.gamma.toFixed(2);
    if (valueDisplays[3]) valueDisplays[3].textContent = this.getTemperatureLabel(this.temperature);
  }

  togglePopup() {
    if (this.popupVisible) {
      this.closePopup();
    } else {
      this.openPopup();
    }
  }

  openPopup() {
    if (this.popupVisible) return;

    const existingPopup = document.getElementById(this.popupId);
    if (existingPopup) {
      existingPopup.remove();
    }

    const popup = document.createElement("div");
    popup.id = this.popupId;
    popup.className = "display-performance-tray-popup";
    const batteryPercent = Math.round(this.batteryInfo.level * 100);
    const batteryStatus = this.getBatteryStatusText();
    const batteryFillColor = this.getBatteryFillColor(batteryPercent);
    popup.innerHTML = `
      <div class="display-performance-popup-content">
        <div class="display-performance-section battery-section">
          <div class="battery-icon">
            <div class="battery">
              <div class="battery-fill" style="width:${batteryPercent}%;background:${batteryFillColor}"></div>
            </div>
          </div>
          <div class="battery-info">
            <div class="battery-percent">${batteryPercent}%</div>
            <div class="battery-status">${batteryStatus}</div>
          </div>
        </div>
        <div class="display-performance-divider"></div>
        <div class="display-performance-section">
          <div class="display-performance-section-title">
            <i class="fas fa-bolt"></i>
            <span>Power Mode</span>
          </div>
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

        <div class="display-performance-divider"></div>

        <div class="display-performance-section">
          <div class="display-performance-section-title">
            <i class="fas fa-sun"></i>
            <span>Display</span>
          </div>
          <div class="brightness-quick-controls">
            <div class="brightness-quick-item">
              <i class="fas fa-sun"></i>
              <input type="range" id="brightness-slider" class="brightness-quick-slider" min="20" max="150" value="${this.brightness}" />
              <span class="brightness-value">${Math.round(this.brightness)}%</span>
            </div>
            <div class="brightness-quick-item">
              <i class="fas fa-temperature-half"></i>
              <input type="range" id="temperature-slider" class="brightness-quick-slider brightness-temp-slider" min="0" max="100" value="${this.temperature}" />
              <span class="brightness-value">${this.getTemperatureLabel(this.temperature)}</span>
            </div>
          </div>
        </div>

        <div class="display-performance-divider"></div>

        <div class="display-performance-section">
          <div class="display-performance-advanced-toggle display-performance-advanced-toggle--compact" id="display-performance-advanced-toggle">
            <span>Advanced ▾</span>
          </div>
          <div class="display-performance-advanced-section" id="display-performance-advanced-section" style="display: none;">
            <div class="brightness-advanced-row">
              <div class="brightness-advanced-item">
                <span>Contrast</span>
                <input type="range" id="contrast-slider" class="brightness-advanced-slider" min="0.5" max="2" step="0.05" value="${this.contrast}" />
                <span class="brightness-value">${this.contrast.toFixed(2)}</span>
              </div>
              <div class="brightness-advanced-item">
                <span>Gamma</span>
                <input type="range" id="gamma-slider" class="brightness-advanced-slider" min="0.5" max="2" step="0.05" value="${this.gamma}" />
                <span class="brightness-value">${this.gamma.toFixed(2)}</span>
              </div>
            </div>
            <div class="brightness-presets-row">
              <button class="brightness-preset-btn" data-preset="default" title="Default"><i class="fas fa-circle"></i></button>
              <button class="brightness-preset-btn" data-preset="reading" title="Reading"><i class="fas fa-book"></i></button>
              <button class="brightness-preset-btn" data-preset="cinema" title="Cinema"><i class="fas fa-film"></i></button>
              <button class="brightness-preset-btn" data-preset="nightCoding" title="Night Coding"><i class="fas fa-moon"></i></button>
              <button class="brightness-preset-btn" data-preset="softWarm" title="Soft Warm"><i class="fas fa-sun"></i></button>
              <button class="brightness-preset-btn" data-preset="highClarity" title="High Clarity"><i class="fas fa-eye"></i></button>
            </div>
            <div class="brightness-night-mode-row">
              <span>Night Mode</span>
              <label class="brightness-toggle">
                <input type="checkbox" id="night-mode-toggle" ${this.nightModeEnabled ? "checked" : ""}/>
                <span class="brightness-toggle-track"><span class="brightness-toggle-thumb"></span></span>
              </label>
              <input type="time" id="night-mode-start" value="${this.nightModeStart}" class="brightness-time-input-small" />
              <input type="time" id="night-mode-end" value="${this.nightModeEnd}" class="brightness-time-input-small" />
            </div>
            <button id="reset-display-performance" class="brightness-reset-btn-small">
              <i class="fas fa-undo"></i>
              <span>Reset</span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(popup);

    const trayEl = document.getElementById("app-tray");
    const trayRect = trayEl
      ? trayEl.getBoundingClientRect()
      : { right: 16, top: window.innerHeight - 48, bottom: window.innerHeight - 48 };

    popup.style.right = `${window.innerWidth - trayRect.right}px`;
    const isMac = isTaskbarTop();
    if (isMac) {
      popup.style.top = `${trayRect.bottom + 8}px`;
      popup.style.bottom = "auto";
    } else {
      popup.style.bottom = `${window.innerHeight - trayRect.top + 8}px`;
      popup.style.top = "auto";
    }
    popup.style.display = "block";

    this.popupVisible = true;
    this.bindEvents(popup);

    document.addEventListener("click", this.handleOutsideClick);
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
    this.popupVisible = false;
    document.removeEventListener("click", this.handleOutsideClick);
  }

  handleOutsideClick = (e) => {
    const popup = document.getElementById(this.popupId);
    const trayEl = document.getElementById("app-tray");
    if (popup && !e.target.closest("#display-performance-tray-popup") && !e.target.closest("#app-tray")) {
      this.closePopup();
    }
  };

  open(options = {}) {
    this.togglePopup();
  }

  bindEvents(popup) {
    const modeBtns = popup.querySelectorAll(".power-mode-btn");
    modeBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.mode;
        this.setPowerMode(mode);
      });
    });

    const brightnessSlider = popup.querySelector("#brightness-slider");
    const contrastSlider = popup.querySelector("#contrast-slider");
    const gammaSlider = popup.querySelector("#gamma-slider");
    const temperatureSlider = popup.querySelector("#temperature-slider");
    const resetBtn = popup.querySelector("#reset-display-performance");
    const nightModeToggle = popup.querySelector("#night-mode-toggle");
    const nightModeStart = popup.querySelector("#night-mode-start");
    const nightModeEnd = popup.querySelector("#night-mode-end");
    const presetBtns = popup.querySelectorAll(".brightness-preset-btn");
    const advancedToggle = popup.querySelector("#display-performance-advanced-toggle");
    const advancedSection = popup.querySelector("#display-performance-advanced-section");

    if (brightnessSlider) {
      brightnessSlider.addEventListener("input", (e) => {
        this.brightness = parseFloat(e.target.value);
        const valueDisplay = popup.querySelector(".brightness-quick-item:nth-child(1) .brightness-value");
        if (valueDisplay) valueDisplay.textContent = `${Math.round(this.brightness)}%`;
        this.applyDisplaySettings();
        this.saveSettings();
      });
    }

    if (contrastSlider) {
      contrastSlider.addEventListener("input", (e) => {
        this.contrast = parseFloat(e.target.value);
        const valueDisplay = popup.querySelector(".brightness-advanced-item:nth-child(1) .brightness-value");
        if (valueDisplay) valueDisplay.textContent = this.contrast.toFixed(2);
        this.applyDisplaySettings();
        this.saveSettings();
      });
    }

    if (gammaSlider) {
      gammaSlider.addEventListener("input", (e) => {
        this.gamma = parseFloat(e.target.value);
        const valueDisplay = popup.querySelector(".brightness-advanced-item:nth-child(2) .brightness-value");
        if (valueDisplay) valueDisplay.textContent = this.gamma.toFixed(2);
        this.applyDisplaySettings();
        this.saveSettings();
      });
    }

    if (temperatureSlider) {
      temperatureSlider.addEventListener("input", (e) => {
        this.temperature = parseFloat(e.target.value);
        const valueDisplay = popup.querySelector(".brightness-quick-item:nth-child(2) .brightness-value");
        if (valueDisplay) valueDisplay.textContent = this.getTemperatureLabel(this.temperature);
        this.applyDisplaySettings();
        this.saveSettings();
      });
    }

    if (advancedToggle && advancedSection) {
      advancedToggle.addEventListener("click", () => {
        const isHidden = advancedSection.style.display === "none";
        advancedSection.style.display = isHidden ? "flex" : "none";
        advancedToggle.querySelector("span").textContent = isHidden ? "Advanced ▴" : "Advanced ▾";
      });
    }

    presetBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const preset = btn.dataset.preset;
        this.applyPreset(preset);
      });
    });

    if (nightModeToggle) {
      nightModeToggle.addEventListener("change", (e) => {
        this.nightModeEnabled = e.target.checked;
        this.saveSettings();
        if (this.nightModeEnabled) {
          os.events.emit(BusEvents.ACHIEVEMENT_TRIGGER, { achievementId: Achievements.NightPerson });
          this.checkNightMode();
          if (!this.shouldSuppressNotification()) {
            os.notify.send("Night Mode", "Scheduled night mode enabled", {
              type: "info",
              duration: 2000,
              icon: "fa-moon"
            });
          }
        } else {
          if (!this.shouldSuppressNotification()) {
            os.notify.send("Night Mode", "Scheduled night mode disabled", {
              type: "info",
              duration: 2000,
              icon: "fa-sun"
            });
          }
        }
      });
    }

    if (nightModeStart) {
      nightModeStart.addEventListener("change", (e) => {
        this.nightModeStart = e.target.value;
        this.saveSettings();
      });
    }

    if (nightModeEnd) {
      nightModeEnd.addEventListener("change", (e) => {
        this.nightModeEnd = e.target.value;
        this.saveSettings();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        this.brightness = 100;
        this.contrast = 1;
        this.gamma = 1;
        this.temperature = 50;

        if (brightnessSlider) brightnessSlider.value = 100;
        if (contrastSlider) contrastSlider.value = 1;
        if (gammaSlider) gammaSlider.value = 1;
        if (temperatureSlider) temperatureSlider.value = 50;

        const brightnessValue = popup.querySelector(".brightness-quick-item:nth-child(1) .brightness-value");
        if (brightnessValue) brightnessValue.textContent = "100%";
        const tempValue = popup.querySelector(".brightness-quick-item:nth-child(2) .brightness-value");
        if (tempValue) tempValue.textContent = this.getTemperatureLabel(50);
        const contrastValue = popup.querySelector(".brightness-advanced-item:nth-child(1) .brightness-value");
        if (contrastValue) contrastValue.textContent = "1.00";
        const gammaValue = popup.querySelector(".brightness-advanced-item:nth-child(2) .brightness-value");
        if (gammaValue) gammaValue.textContent = "1.00";

        this.applyDisplaySettings();
        this.saveSettings();

        if (!this.shouldSuppressNotification()) {
          os.notify.send("Reset", "Display settings reset to default", {
            type: "info",
            duration: 2000,
            icon: "fa-undo"
          });
        }
      });
    }
  }

  onClose(winId) {
    this.closePopup();
    this.cleanupKeybinds();
    if (this.nightModeInterval) {
      clearInterval(this.nightModeInterval);
      this.nightModeInterval = null;
    }
  }
}

export { DisplayPerformanceApp };
