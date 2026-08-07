import { audioMixer } from "../../audioMixer.js";
import { performanceManager } from "../../shared/performanceManager.js";
import { isTaskbarTop } from "../../utils/utils.js";
import { getTrayPosition } from "../../tray/tray.js";
import { BusEvents } from "../../framework.js";
import { parseBool } from "../../utils/utils.js";
import { StorageKeys, os, MODES, $, createElement } from "../../framework.js";
import { SystemUtilities } from "../../system.js";
import { MAC_WALLPAPER_NAME_URL_PAIRS } from "../../wallpaperConfig.js";

const ACCENT_COLORS = [
  { label: "Blue", value: "#3b82f6" },
  { label: "Purple", value: "#6b5ce7" },
  { label: "Pink", value: "#ec4899" },
  { label: "Orange", value: "#f97316" },
  { label: "Green", value: "#22c55e" },
  { label: "Red", value: "#ef4444" }
];

class MacControlCenter {
  constructor() {
    this.winId = "mac-control-center";
    this.popupId = "mac-control-center-popup";
    this.popupVisible = false;
    this.registered = false;

    this.brightness = parseInt(os.storage.get(StorageKeys.brightness), 10) || 100;
    this.batteryLevel = 0.85;
    this.batteryCharging = true;

    this.initBattery();
    this.refresh();
    os.events.on(BusEvents.SETTINGS_CHANGED, () => this.refresh());
  }

  isMacMode() {
    return os.modes.isActive(MODES.MAC);
  }

  refresh() {
    if (this.isMacMode() && !this.registered) {
      this.registered = true;
      this.initTray();
      this.setInitialMacWallpaper();
    } else if (!this.isMacMode() && this.registered) {
      this.registered = false;
      this.closePopup();
      os.tray.unregister(this.winId);
    }
  }

  setInitialMacWallpaper() {
    const initialized = os.storage.get(StorageKeys.macWallpaperInitialized);
    if (parseBool(initialized)) return;
    if (!MAC_WALLPAPER_NAME_URL_PAIRS.length) return;
    const pick = MAC_WALLPAPER_NAME_URL_PAIRS[Math.floor(Math.random() * MAC_WALLPAPER_NAME_URL_PAIRS.length)];
    SystemUtilities.setWallpaper(pick.url);
    os.storage.set(StorageKeys.macWallpaperInitialized, "true");
  }

  async initBattery() {
    if ("getBattery" in navigator) {
      try {
        const battery = await navigator.getBattery();
        this.batteryLevel = battery.level;
        this.batteryCharging = battery.charging;
        battery.addEventListener("levelchange", () => {
          this.batteryLevel = battery.level;
        });
        battery.addEventListener("chargingchange", () => {
          this.batteryCharging = battery.charging;
        });
      } catch (e) {
        console.warn("Battery API error:", e);
      }
    }
  }

  initTray() {
    os.tray.register(this.winId, "fas fa-sliders-h", "Control Center", {
      resident: true,
      showInTray: true,
      priority: -1,
      onClick: () => this.togglePopup()
    });
  }

  get batteryPercent() {
    return Math.round(this.batteryLevel * 100);
  }

  getBatteryFillColor(level) {
    if (level > 60) return "var(--charging)";
    if (level > 30) return "var(--brand)";
    return "var(--error)";
  }

  getTemperatureLabel(value) {
    if (value < 33) return "Warm";
    if (value > 66) return "Cool";
    return "Neutral";
  }

  applyDisplaySettings() {
    document.documentElement.style.filter = `brightness(${this.brightness / 100}) contrast(1) saturate(1) sepia(0)`;
  }

  saveDisplaySettings() {
    os.storage.set(StorageKeys.brightness, this.brightness.toString());
  }

  togglePopup() {
    this.popupVisible ? this.closePopup() : this.openPopup();
  }

  openPopup() {
    if (this.popupVisible) return;

    const existing = $("#" + this.popupId);
    if (existing) existing.remove();

    const popup = createElement("div");
    popup.id = this.popupId;
    popup.className = "mac-control-center-popup";

    const mixer = audioMixer();
    const volume = Math.round((mixer.masterVolume || 1) * 100);
    const batteryLevel = this.batteryPercent;
    const batteryColor = this.getBatteryFillColor(batteryLevel);
    const powerMode = performanceManager.getMode();
    const isDark = document.documentElement.getAttribute("data-theme") !== "light";
    const dnd = os.notify.getDoNotDisturb();
    const dockEnabled = true;

    popup.innerHTML = `
      <div class="mcc-content">
        <div class="mcc-section mcc-section-battery">
          <div class="mcc-battery-icon">
            <div class="mcc-battery">
              <div class="mcc-battery-fill" style="width:${batteryLevel}%;background:${batteryColor}"></div>
            </div>
          </div>
          <div class="mcc-battery-info">
            <div class="mcc-battery-percent">${batteryLevel}%</div>
            <div class="mcc-battery-label">Battery</div>
          </div>
        </div>

        <div class="mcc-divider"></div>

        <div class="mcc-section">
          <div class="mcc-slider-row">
            <i class="fas fa-sun"></i>
            <input type="range" class="mcc-slider" id="mcc-brightness" min="20" max="150" value="${this.brightness}" />
            <span class="mcc-slider-value">${this.brightness}%</span>
          </div>
          <div class="mcc-slider-row">
            <i class="fas fa-volume-up"></i>
            <input type="range" class="mcc-slider" id="mcc-volume" min="0" max="100" value="${volume}" />
            <span class="mcc-slider-value">${volume}%</span>
          </div>
        </div>

        <div class="mcc-divider"></div>

        <div class="mcc-section">
          <div class="mcc-section-title">Power Mode</div>
          <div class="mcc-power-options">
            <button class="mcc-power-btn ${powerMode === "performance" ? "active" : ""}" data-mode="performance">
              <i class="fas fa-bolt"></i> Performance
            </button>
            <button class="mcc-power-btn ${powerMode === "balanced" ? "active" : ""}" data-mode="balanced">
              <i class="fas fa-balance-scale"></i> Balanced
            </button>
            <button class="mcc-power-btn ${powerMode === "high" ? "active" : ""}" data-mode="high">
              <i class="fas fa-gem"></i> Quality
            </button>
          </div>
        </div>

        <div class="mcc-divider"></div>

        <div class="mcc-section">
          <div class="mcc-section-title">Quick Toggles</div>
          <div class="mcc-toggles">
            <label class="mcc-toggle">
              <span>Dark Mode</span>
              <input type="checkbox" class="mcc-toggle-input" id="mcc-darkmode" ${isDark ? "checked" : ""} />
              <span class="mcc-toggle-track"><span class="mcc-toggle-thumb"></span></span>
            </label>
            <label class="mcc-toggle">
              <span>Do Not Disturb</span>
              <input type="checkbox" class="mcc-toggle-input" id="mcc-dnd" ${dnd ? "checked" : ""} />
              <span class="mcc-toggle-track"><span class="mcc-toggle-thumb"></span></span>
            </label>
            <label class="mcc-toggle">
              <span>Dock</span>
              <input type="checkbox" class="mcc-toggle-input" id="mcc-dock" ${dockEnabled ? "checked" : ""} />
              <span class="mcc-toggle-track"><span class="mcc-toggle-thumb"></span></span>
            </label>
          </div>
        </div>

        <div class="mcc-divider"></div>

        <div class="mcc-section">
          <div class="mcc-section-title">Accent Color</div>
          <div class="mcc-colors">
            ${ACCENT_COLORS.map((c) => `<button class="mcc-color-swatch" data-color="${c.value}" title="${c.label}" style="background:${c.value}"></button>`).join("")}
          </div>
        </div>

        <div class="mcc-divider"></div>

        <div class="mcc-section mcc-shortcuts">
          <button class="mcc-shortcut" id="mcc-lock"><i class="fas fa-lock"></i> Lock Screen</button>
          <button class="mcc-shortcut" id="mcc-settings"><i class="fas fa-cog"></i> System Settings</button>
        </div>
      </div>
    `;

    document.body.appendChild(popup);

    const pos = getTrayPosition();
    popup.style.right = pos.right;
    popup.style.top = pos.top;
    popup.style.bottom = pos.bottom;
    popup.style.display = "block";

    this.popupVisible = true;
    this.bindEvents(popup);
    document.addEventListener("click", this.handleOutsideClick);
  }

  closePopup() {
    const popup = $("#" + this.popupId);
    if (popup) {
      popup.classList.add("closing");
      popup.addEventListener("animationend", () => popup.remove(), { once: true });
    }
    this.popupVisible = false;
    document.removeEventListener("click", this.handleOutsideClick);
  }

  handleOutsideClick = (e) => {
    const popup = $("#" + this.popupId);
    if (popup && !e.target.closest(`#${this.popupId}`) && !e.target.closest("#app-tray")) {
      this.closePopup();
    }
  };

  bindEvents(popup) {
    const brightnessSlider = popup.querySelector("#mcc-brightness");
    const volumeSlider = popup.querySelector("#mcc-volume");
    const darkModeToggle = popup.querySelector("#mcc-darkmode");
    const dndToggle = popup.querySelector("#mcc-dnd");
    const dockToggle = popup.querySelector("#mcc-dock");
    const lockBtn = popup.querySelector("#mcc-lock");
    const settingsBtn = popup.querySelector("#mcc-settings");
    const colorSwatches = popup.querySelectorAll(".mcc-color-swatch");

    if (brightnessSlider) {
      brightnessSlider.addEventListener("input", (e) => {
        this.brightness = parseFloat(e.target.value);
        const val = popup.querySelector(".mcc-slider-row:nth-child(1) .mcc-slider-value");
        if (val) val.textContent = `${this.brightness}%`;
        this.applyDisplaySettings();
        this.saveDisplaySettings();
      });
    }

    if (volumeSlider) {
      volumeSlider.addEventListener("input", (e) => {
        const vol = parseFloat(e.target.value) / 100;
        audioMixer().setMaster(vol);
        const val = popup.querySelector(".mcc-slider-row:nth-child(3) .mcc-slider-value");
        if (val) val.textContent = `${Math.round(vol * 100)}%`;
      });
    }

    const powerBtns = popup.querySelectorAll(".mcc-power-btn");
    powerBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.mode;
        performanceManager.setMode(mode);
        powerBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });

    if (darkModeToggle) {
      darkModeToggle.addEventListener("change", (e) => {
        const isDark = e.target.checked;
        const theme = isDark ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", theme);
        os.storage.set(StorageKeys.theme, theme);
      });
    }

    if (dndToggle) {
      dndToggle.addEventListener("change", (e) => {
        os.notify.setDoNotDisturb(e.target.checked);
      });
    }

    if (dockToggle) {
      dockToggle.addEventListener("change", (e) => {
        const dock = $(".mac-dock");
        if (dock) dock.style.display = e.target.checked ? "" : "none";
      });
    }

    colorSwatches.forEach((swatch) => {
      swatch.addEventListener("click", () => {
        const color = swatch.dataset.color;
        document.documentElement.style.setProperty("--brand", color);
        document.documentElement.style.setProperty("--brand-hover", color + "dd");
        document.documentElement.style.setProperty("--brand-dim", color + "20");
        document.documentElement.style.setProperty("--brand-glow", color + "40");
        const existing = os.storage.get(StorageKeys.customColors) || {};
        os.storage.set(StorageKeys.customColors, { ...existing, brand: color });
        colorSwatches.forEach((s) => s.classList.remove("active"));
        swatch.classList.add("active");
      });
    });

    if (lockBtn) {
      lockBtn.addEventListener("click", () => {
        this.closePopup();
        import("../../desktopui/startMenu.js").then((m) => m.closeStartMenu());
        os.app.lockSession();
      });
    }

    if (settingsBtn) {
      settingsBtn.addEventListener("click", () => {
        this.closePopup();
        os.app.launch("settingsApp");
      });
    }
  }
}

export { MacControlCenter };
