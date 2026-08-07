import { createElement, os, StorageKeys } from "../framework.js";
import { $ } from "../shared/domUtils.js";
import { subscribeTimeTick } from "../services/timeWorker.js";
import { createCalendarPopup, closeCalendarPopup } from "../apps/calendar.js";
import { getTrayPosition } from "../tray/tray.js";
import { audioMixer } from "../audioMixer.js";
import { performanceManager } from "../shared/performanceManager.js";
import { launchSettingsPane } from "../settings/settingsNav.js";
import { renderRangeSlider, bindRangeSlider, getRangeSliderValue } from "../shared/rangeSlider.js";
import { BusEvents } from "../core/EventBus.js";
import { trayManager } from "../tray/tray.js";
import { resolveAvatarUrl } from "../social/avatarResolver.js";
import { callIfFunction } from "../shared/functionUtils.js";
import { PREDEFINED_AVATARS } from "../utils/avatarData.js";

const HIDDEN_TRAY_IDS = ["audio-mixer", "network-tray-window", "display-performance-window"];

export class ChromeOsQuickSettings {
  constructor(shelf) {
    this.shelf = shelf;
    this.el = null;
    this.clockEl = null;
    this.iconsEl = null;
    this.panelVisible = false;
    this.clock24h = false;
    this.batteryHandle = null;
    this.batteryInfo = { level: 1, charging: true };
    this.unsubscribeClock = null;

    this.boundBatteryLevel = this.onBatteryLevel.bind(this);
    this.boundBatteryCharge = this.onBatteryCharge.bind(this);
    this.boundOutside = this.onOutsideClick.bind(this);
    this.boundCalendarClose = this.onCalendarClose.bind(this);
    this.boundSettings = this.onSettingsChanged.bind(this);
  }

  init() {
    if (this.el) return;
    this.loadPrefs();
    this.buildPill();
    this.startClock();
    this.initBattery();
    os.events.on(BusEvents.SETTINGS_CHANGED, this.boundSettings);
  }

  destroy() {
    if (!this.el) return;
    this.closePanel();
    this.stopClock();
    this.disposeBattery();
    os.events.off(BusEvents.SETTINGS_CHANGED, this.boundSettings);
    document.removeEventListener("click", this.boundCalendarClose);
    document.removeEventListener("click", this.boundOutside);
    this.el.remove();
    this.el = null;
  }

  loadPrefs() {
    this.clock24h = os.storage.get(StorageKeys.chromeOsClock24h) === "true";
  }

  buildPill() {
    const rightSection = $(".shelf-right", this.shelf.el);
    if (!rightSection) return;

    this.el = createElement("div", { className: "shelf-status" });
    this.clockEl = createElement("div", { className: "shelf-status-clock" });
    this.iconsEl = createElement("div", { className: "shelf-status-icons" });
    this.el.appendChild(this.clockEl);
    this.el.appendChild(this.iconsEl);

    this.clockEl.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleCalendar();
    });
    this.iconsEl.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggle();
    });

    rightSection.appendChild(this.el);
    this.updateClock();
    this.updateStatusIcons();
  }

  startClock() {
    this.stopClock();
    this.updateClock();
    this.unsubscribeClock = subscribeTimeTick(() => this.updateClock());
  }

  stopClock() {
    if (this.unsubscribeClock) {
      this.unsubscribeClock();
      this.unsubscribeClock = null;
    }
  }

  updateClock() {
    if (!this.clockEl) return;
    const now = new Date();
    const opts = this.clock24h
      ? { hour: "2-digit", minute: "2-digit", hour12: false }
      : { hour: "numeric", minute: "2-digit" };
    this.clockEl.innerHTML = `
      <span class="shelf-clock-time">${now.toLocaleTimeString([], opts)}</span>
    `;
    this.clockEl.title = now.toLocaleString([], {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  async initBattery() {
    if (!("getBattery" in navigator)) return;
    try {
      this.batteryHandle = await navigator.getBattery();
      this.batteryInfo = { level: this.batteryHandle.level, charging: this.batteryHandle.charging };
      this.batteryHandle.addEventListener("levelchange", this.boundBatteryLevel);
      this.batteryHandle.addEventListener("chargingchange", this.boundBatteryCharge);
      this.updateStatusIcons();
    } catch (e) {
      console.warn("[ChromeOsQuickSettings] Battery API error:", e);
    }
  }

  disposeBattery() {
    if (this.batteryHandle) {
      this.batteryHandle.removeEventListener("levelchange", this.boundBatteryLevel);
      this.batteryHandle.removeEventListener("chargingchange", this.boundBatteryCharge);
      this.batteryHandle = null;
    }
  }

  onBatteryLevel() {
    if (this.batteryHandle) this.batteryInfo.level = this.batteryHandle.level;
    this.updateStatusIcons();
  }

  onBatteryCharge() {
    if (this.batteryHandle) this.batteryInfo.charging = this.batteryHandle.charging;
    this.updateStatusIcons();
  }

  getBatteryIcon(level) {
    if (level > 90) return "fas fa-battery-full";
    if (level > 65) return "fas fa-battery-three-quarters";
    if (level > 35) return "fas fa-battery-half";
    if (level > 10) return "fas fa-battery-quarter";
    return "fas fa-battery-empty";
  }

  updateStatusIcons() {
    if (!this.iconsEl) return;
    const pct = Math.round(this.batteryInfo.level * 100);
    const batteryIcon = this.getBatteryIcon(pct);
    this.iconsEl.innerHTML = `
      <i class="fas fa-wifi"></i>
      <span class="shelf-status-battery">
        <i class="${batteryIcon}"></i>
      </span>
    `;
  }

  toggleCalendar() {
    createCalendarPopup();
    document.addEventListener("click", this.boundCalendarClose);
  }

  onCalendarClose(e) {
    const popup = $("#calendar-popup");
    if (popup && !popup.contains(e.target) && !e.target.closest(".shelf-status-clock")) {
      closeCalendarPopup();
      document.removeEventListener("click", this.boundCalendarClose);
    }
  }

  toggle() {
    this.panelVisible ? this.closePanel() : this.openPanel();
  }

  async openPanel() {
    if (this.panelVisible) return;
    this.closeCalendarPopup();

    const existing = $("#chromeos-quick-settings");
    if (existing) existing.remove();

    const panel = createElement("div", { id: "chromeos-quick-settings" });
    panel.innerHTML = await this.buildPanelHTML();
    document.body.appendChild(panel);

    const pos = getTrayPosition();
    if (pos) {
      if (pos.right) panel.style.right = pos.right;
      if (pos.top) panel.style.top = pos.top;
      if (pos.bottom) panel.style.bottom = pos.bottom;
    }
    panel.style.display = "block";

    this.panelVisible = true;
    this.bindPanel(panel);
    document.addEventListener("click", this.boundOutside);
  }

  closePanel() {
    const panel = $("#chromeos-quick-settings");
    if (panel) {
      panel.classList.add("closing");
      panel.addEventListener("animationend", () => panel.remove(), { once: true });
    }
    this.panelVisible = false;
    document.removeEventListener("click", this.boundOutside);
  }

  closeCalendarPopup() {
    closeCalendarPopup();
    document.removeEventListener("click", this.boundCalendarClose);
  }

  onOutsideClick(e) {
    const panel = $("#chromeos-quick-settings");
    if (
      panel &&
      !e.target.closest("#chromeos-quick-settings") &&
      !e.target.closest(".shelf-status-icons") &&
      !e.target.closest(".shelf-status-clock")
    ) {
      this.closePanel();
    }
  }

  async buildPanelHTML() {
    const mixer = audioMixer();
    const volume = Math.round((mixer.masterVolume || 1) * 100);
    const brightness = parseInt(os.storage.get(StorageKeys.brightness), 10) || 100;
    const pct = Math.round(this.batteryInfo.level * 100);
    const powerMode = performanceManager.getMode();
    const isDark = document.documentElement.getAttribute("data-theme") !== "light";
    const dnd = os.notify.getDoNotDisturb();

    const username = os.storage.get(StorageKeys.username) || "Guest";
    const avatarRef = os.storage.get(StorageKeys.profilePicture) || PREDEFINED_AVATARS[0];
    const userAvatar = await resolveAvatarUrl(avatarRef, PREDEFINED_AVATARS[0]);

    const bootActions = [
      { id: "lock", icon: "fas fa-lock", label: "Lock" },
      { id: "signout", icon: "fas fa-right-from-bracket", label: "Sign out" },
      { id: "settings", icon: "fas fa-gear", label: "Settings" },
      { id: "shutdown", icon: "fas fa-power-off", label: "Shut down" }
    ];

    const toggles = [
      { id: "wifi", icon: "fas fa-wifi", label: "Wi-Fi", on: true },
      { id: "dark", icon: "fas fa-moon", label: "Dark", on: isDark },
      { id: "dnd", icon: "fas fa-bell-slash", label: "Do Not Disturb", on: dnd },
      { id: "network", icon: "fas fa-network-wired", label: "Network", on: false }
    ];

    const trayItems = this.getTrayItems();
    const performance = powerMode === "performance";
    const dateLabel = new Date().toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric"
    });

    return `
      <div class="chromeos-qs">
        <div class="chromeos-qs-boot">
          <span class="chromeos-qs-user" title="${username}">
            <img class="chromeos-qs-user-avatar" src="${userAvatar}" alt="${username}" />
          </span>
          ${bootActions
            .map(
              (a) => `
          <button class="chromeos-qs-boot-btn" data-power="${a.id}" title="${a.label}">
            <i class="${a.icon}"></i>
          </button>
          `
            )
            .join("")}
        </div>

        <div class="chromeos-qs-grid">
          ${toggles
            .map(
              (t) => `
          <button class="chromeos-qs-tile${t.on ? " on" : ""}" data-tile="${t.id}">
            <span class="chromeos-qs-tile-icon"><i class="${t.icon}"></i></span>
            <span>${t.label}</span>
          </button>
          `
            )
            .join("")}

          <button class="chromeos-qs-tile${performance ? " on" : ""}" data-mode="performance">
            <span class="chromeos-qs-tile-icon"><i class="fas fa-gauge-high"></i></span>
            <span>Performance</span>
          </button>

          ${trayItems
            .map(
              (item) => `
          <button class="chromeos-qs-tile" data-tray="${item.winId}" title="${item.label || item.winId}">
            <span class="chromeos-qs-tile-icon">${this.trayIconHtml(item.icon, item.label)}</span>
            <span>${item.label || item.winId}</span>
          </button>
          `
            )
            .join("")}

          <span class="chromeos-qs-grid-span chromeos-qs-row">
            <span class="chromeos-qs-icon-circle"><i class="fas fa-volume-high"></i></span>
            ${renderRangeSlider("qsVolume", 0, 100, 5, volume)}
          </span>
          <span class="chromeos-qs-grid-span chromeos-qs-row">
            <span class="chromeos-qs-icon-circle"><i class="fas fa-sun"></i></span>
            ${renderRangeSlider("qsBrightness", 0, 100, 5, brightness)}
          </span>

          <span class="chromeos-qs-grid-span chromeos-qs-battery">
            <span class="chromeos-qs-battery-date">${dateLabel}</span>
            <span class="chromeos-qs-battery-text"> | ${pct}% ${this.getBatteryState(pct)}</span>
          </span>
        </div>
      </div>
    `;
  }

  getTrayItems() {
    return trayManager.getAllItems().filter((item) => !HIDDEN_TRAY_IDS.includes(item.winId));
  }

  trayIconHtml(icon, label) {
    if (!icon) return `<span class="chromeos-qs-tray-glyph">${(label || "?").charAt(0)}</span>`;
    const s = String(icon);
    const isUrl =
      s.startsWith("http") ||
      s.startsWith("data:") ||
      s.startsWith("/") ||
      /\.(webp|png|jpg|jpeg|gif|svg)$/.test(s);
    if (isUrl) {
      return `<img src="${s}" alt="${label || ""}" />`;
    }
    return `<i class="${s}"></i>`;
  }

  getBatteryState(pct) {
    if (this.batteryInfo.charging) return "Charging";
    if (pct <= 20) return "Low Battery";
    if (pct >= 100) return "Fully Charged";
    return "On Battery";
  }

  bindPanel(panel) {
    bindRangeSlider(panel);

    const brightnessSlider = $("#qsBrightness", panel);
    const volumeSlider = $("#qsVolume", panel);

    if (brightnessSlider) {
      brightnessSlider.addEventListener("input", () => {
        const value = getRangeSliderValue("qsBrightness", panel);
        this.applyBrightness(value);
      });
      brightnessSlider.addEventListener("change", () => {
        os.storage.set(StorageKeys.brightness, String(getRangeSliderValue("qsBrightness", panel)));
      });
    }

    if (volumeSlider) {
      volumeSlider.addEventListener("input", () => {
        const value = getRangeSliderValue("qsVolume", panel);
        audioMixer().setMaster(value / 100);
      });
    }

    panel.querySelectorAll(".chromeos-qs-tile[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const enabled = performanceManager.getMode() !== "performance";
        panel.querySelectorAll(".chromeos-qs-tile[data-mode]").forEach((b) => b.classList.toggle("on", b === btn));
        btn.classList.toggle("on", enabled);
        performanceManager.setMode(enabled ? "performance" : "balanced");
      });
    });

    panel.querySelectorAll(".chromeos-qs-tile[data-tile]").forEach((btn) => {
      btn.addEventListener("click", () => this.handleTile(btn, panel));
    });

    panel.querySelectorAll(".chromeos-qs-tile[data-tray]").forEach((btn) => {
      btn.addEventListener("click", () => this.handleTrayTile(btn));
    });

    panel.querySelectorAll(".chromeos-qs-boot-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.handlePowerAction(btn.dataset.power);
      });
    });
  }

  handleTile(btn, panel) {
    const id = btn.dataset.tile;
    if (id === "network") {
      this.closePanel();
      launchSettingsPane("pane-network");
      return;
    }
    if (id === "wifi") {
      btn.classList.toggle("on");
      return;
    }
    btn.classList.toggle("on");
    const enabled = btn.classList.contains("on");
    if (id === "dark") {
      const theme = enabled ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", theme);
      os.storage.set(StorageKeys.theme, theme);
      panel.querySelectorAll('.chromeos-qs-tile[data-tile="dark"]').forEach((b) => b.classList.toggle("on", enabled));
    } else if (id === "dnd") {
      os.notify.setDoNotDisturb(enabled);
    }
  }

  handleTrayTile(btn) {
    const winId = btn.dataset.tray;
    const item = trayManager.items.get(winId);
    if (!item) {
      this.closePanel();
      return;
    }
    this.closePanel();
    if (!callIfFunction(item.onClick)) {
      trayManager.restoreFromTray(winId);
    }
  }

  applyBrightness(value) {
    document.documentElement.style.filter = `brightness(${value / 100}) contrast(1) saturate(1) sepia(0)`;
  }

  handlePowerAction(action) {
    this.closePanel();
    const sessionManager = os.app.getInstance("sessionManager");
    switch (action) {
      case "lock":
        sessionManager?.lockSession?.();
        break;
      case "settings":
        os.app.launch("settingsApp");
        break;
      case "signout":
        os.account.signOut?.();
        os.app.lockToLoginScreen();
        break;
      case "restart":
        sessionManager?.restart?.();
        break;
      case "shutdown":
        location.reload();
        break;
    }
  }

  onSettingsChanged() {
    this.loadPrefs();
    this.updateClock();
    this.updateStatusIcons();
  }
}
