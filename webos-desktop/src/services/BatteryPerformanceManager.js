import { $ } from "../shared/domUtils.js";
import { turboManager } from "../shared/turboManager.js";
import { parseBool } from "../utils/utils.js";
import { StorageKeys, os } from "../framework.js";
import { SystemUtilities } from "../system.js";

class BatteryPerformanceManager {
  constructor() {
    this.saverActive = false;
    this.previousMode = null;
    this.battery = null;
    this.enabled = false;
    this.threshold = 20;
    this.isMobile = false;
  }

  async init() {
    this.isMobile = document.documentElement.classList.contains("is-mobile");

    try {
      this.enabled = os.storage.get(StorageKeys.batterySaverEnabled);
      if (this.enabled === null) this.enabled = true;
    } catch {
      this.enabled = true;
    }
    if (!this.enabled) return;

    try {
      this.threshold = os.storage.get(StorageKeys.batterySaverThreshold) || 20;
    } catch {
      this.threshold = 20;
    }

    if ("getBattery" in navigator) {
      try {
        this.battery = await navigator.getBattery();
        this.checkBattery();
        this.battery.addEventListener("levelchange", () => this.checkBattery());
        this.battery.addEventListener("chargingchange", () => this.checkBattery());
      } catch (e) {
        console.warn("[BatteryPerformanceManager] Battery API error:", e);
      }
    }
  }

  applyMobileDefaults() {
    this.previousMode = turboManager.getMode();
    document.documentElement.classList.add("battery-saver");

    if (turboManager.getMode() === "high") {
      turboManager.setMode("balanced");
    }
  }

  checkBattery() {
    if (!this.battery) return;
    const level = Math.round(this.battery.level * 100);
    const charging = this.battery.charging;

    if (this.isMobile) {
      if (!charging && level <= this.threshold && !this.saverActive) {
        this.mobileLowBattery(level);
      } else if ((charging || level > this.threshold) && this.saverActive) {
        this.mobileBatteryRecovered();
      }
    } else {
      if (charging && this.saverActive) {
        this.desktopRestore("Charging");
      } else if (!charging && level <= this.threshold && !this.saverActive) {
        this.desktopLowBattery(level);
      } else if (!charging && level > this.threshold && this.saverActive) {
        this.desktopRestore("Recovered");
      }
    }
  }

  mobileLowBattery(level) {
    this.saverActive = true;
    document.documentElement.classList.add("battery-saver");
    turboManager.setMode("turbo");

    const vc = $("#vanta-container");
    if (vc) SystemUtilities.disableVantaWallpaper();

    os.notify.send("Battery Saver", `Battery critically low (${level}%) - switched to maximum power saving.`, {
      type: "warning",
      duration: 5000,
      icon: "fa-battery-quarter"
    });
  }

  mobileBatteryRecovered() {
    this.saverActive = false;
    document.documentElement.classList.remove("battery-saver");
    turboManager.setMode("balanced");

    SystemUtilities.loadWallpaper();

    os.notify.send("Battery Saver", "Battery recovered - back to reduced effects mode.", {
      type: "info",
      duration: 3000,
      icon: "fa-battery-half"
    });
  }

  desktopLowBattery(level) {
    this.saverActive = true;
    this.previousMode = turboManager.getMode();

    turboManager.setMode("turbo");
    document.documentElement.classList.add("battery-saver");

    const vc = $("#vanta-container");
    if (vc) SystemUtilities.disableVantaWallpaper();

    const vid = $("#wallpaper-video");
    if (vid && !vid.paused) {
      vid.pause();
      vid.dataset.batterySaverPaused = "true";
    }

    os.notify.send(
      "Battery Saver",
      `Battery at ${level}% - reduced animations and background activity to save power.`,
      {
        type: "warning",
        duration: 5000,
        icon: "fa-battery-quarter"
      }
    );
  }

  desktopRestore(reason) {
    if (!this.saverActive) return;

    document.documentElement.classList.remove("battery-saver");

    SystemUtilities.loadWallpaper();

    const vid = $("#wallpaper-video");
    if (vid && parseBool(vid.dataset.batterySaverPaused)) {
      vid.play();
      delete vid.dataset.batterySaverPaused;
    }

    if (this.previousMode) {
      turboManager.setMode(this.previousMode);
    }

    this.saverActive = false;

    const msg =
      reason === "Charging"
        ? "Device is charging - full performance restored."
        : "Battery level recovered - full performance restored.";

    os.notify.send("Battery Saver Off", msg, {
      type: "success",
      duration: 3000,
      icon: "fa-bolt"
    });
  }
}

export const batteryPerformanceManager = new BatteryPerformanceManager();
