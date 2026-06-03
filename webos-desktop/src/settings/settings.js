import { BaseApp } from "../core/BaseApp.js";
import { BusEvents } from "../core/EventBus.js";
import { StorageKeys } from "../StorageKeys.js";
import { setCdnMirror, initializeMirrors } from "../shared/assetResolver.js";
import { appMap } from "../games/gamesList.js";
import { turboManager } from "../shared/turboManager.js";
import { os } from "../os/index.js";

import { buildSettingsHTML } from "./settingRenderer.js";
import {
  applyTheme,
  applyWindowTransparency,
  applyTransparentUI,
  applySound,
  applyGuiScale,
  applyFontSize,
  applyCursor,
  applyMikuCursor,
  applyDesktopStretchScrollDisabled,
  applyStartMenuSize,
  applyStartMenuCats,
  applyTrayEnabled,
  applyFontFamily,
  applyUiDensity
} from "./settingsApply.js";
import {
  bindNavigation,
  bindSystemCategory,
  bindDesktopCategory,
  bindAppearanceCategory,
  bindDataCategory,
  bindNetworkCategory,
  bindAudioCategory
} from "./settingsBinders.js";
import { exportData, importData, deleteAllData } from "./settingsData.js";

export { StorageKeys };

export class SettingsApp extends BaseApp {
  constructor(services) {
    super(services);
    this.fs = null;

    setTimeout(() => {
      const cursorOriginalFromStorage = localStorage.getItem(StorageKeys.cursorOriginalKey) ?? "";
      const cursorFromLegacyStorage = localStorage.getItem(StorageKeys.cursorKey) ?? "";
      const cursorOriginalDataUrl = cursorOriginalFromStorage || cursorFromLegacyStorage || "";
      const parsedCursorSize = Number(localStorage.getItem(StorageKeys.cursorSizeKey));
      const cursorSize = Number.isFinite(parsedCursorSize) && parsedCursorSize > 0 ? parsedCursorSize : 32;

      const rawTransparency = parseFloat(localStorage.getItem(StorageKeys.windowTransparency));
      const rawMasterVol = parseFloat(localStorage.getItem(StorageKeys.masterVolume));
      const rawSystemVol = parseFloat(localStorage.getItem(StorageKeys.systemVolume));

      this._settings = {
        weather: localStorage.getItem(StorageKeys.weather) !== "false",
        cycleWallpaper: localStorage.getItem(StorageKeys.cycleWallpaper) !== "false",
        cursorDataUrl: cursorFromLegacyStorage,
        cursorOriginalDataUrl,
        cursorSize,
        macOsControls: localStorage.getItem(StorageKeys.macOsControls) === "true",
        clippy: localStorage.getItem(StorageKeys.clippy) === "true",
        disableDesktopStretchScroll: localStorage.getItem(StorageKeys.disableDesktopStretchScroll) === "true",
        achievementsDisabled: localStorage.getItem(StorageKeys.achievementsDisabled) === "true",
        analyticsDisabled: localStorage.getItem(StorageKeys.analyticsDisabled) === "true",
        adsDisabled: localStorage.getItem(StorageKeys.adsDisabled) === "true",
        taskbarAlignment: localStorage.getItem(StorageKeys.taskbarAlignment) || "center",
        cdnMirror: localStorage.getItem(StorageKeys.cdnMirror) || "jsdelivr",
        theme: localStorage.getItem(StorageKeys.theme) || "dark",
        windowTransparency: Number.isFinite(rawTransparency) ? Math.max(0.2, Math.min(1, rawTransparency)) : 1,
        soundEnabled: localStorage.getItem(StorageKeys.soundEnabled) !== "false",
        masterVolume: Number.isFinite(rawMasterVol) ? Math.max(0, Math.min(1, rawMasterVol)) : 1,
        systemAudioEnabled: localStorage.getItem(StorageKeys.systemAudioEnabled) !== "false",
        systemVolume: Number.isFinite(rawSystemVol) ? Math.max(0, Math.min(1, rawSystemVol)) : 1,
        dnd: localStorage.getItem(StorageKeys.dndKey) === "1",
        taskbarPosition: localStorage.getItem(StorageKeys.taskbarPosition) || "bottom",
        disableBootScreen: localStorage.getItem(StorageKeys.disableBootScreen) === "true",
        windowSessionPersistence: localStorage.getItem(StorageKeys.windowSessionPersistence) !== "false",
        startMenuWidth: Number(localStorage.getItem(StorageKeys.startMenuWidth)) || 650,
        startMenuHeight: Number(localStorage.getItem(StorageKeys.startMenuHeight)) || 500,
        startMenuCats: (() => {
          try {
            return JSON.parse(localStorage.getItem(StorageKeys.startMenuCats)) || {};
          } catch {
            return {};
          }
        })(),
        turboMode: turboManager.getMode(),
        showWorkspace: localStorage.getItem(StorageKeys.showWorkspace) !== "false",
        notificationsEnabled: localStorage.getItem(StorageKeys.notificationsEnabled) !== "false",
        notificationsRemoveTimeout: localStorage.getItem(StorageKeys.notificationsRemoveTimeout) !== "false",
        notificationsPopAnimation: localStorage.getItem(StorageKeys.notificationsPopAnimation) !== "false",
        notificationsOverFullscreen: localStorage.getItem(StorageKeys.notificationsOverFullscreen) === "true",
        notificationsDuration: Number(localStorage.getItem(StorageKeys.notificationsDuration)) || 5,
        notificationsPosition: localStorage.getItem(StorageKeys.notificationsPosition) || "bottom-right",
        transparentUI: localStorage.getItem(StorageKeys.transparentUI) === "true",
        clipboardManagerEnabled: localStorage.getItem(StorageKeys.clipboardManagerEnabled) !== "false",
        guiScale: Number(localStorage.getItem(StorageKeys.guiScale)) || 100,
        fontSize: Number(localStorage.getItem(StorageKeys.fontSize)) || 100,
        trayEnabled: localStorage.getItem(StorageKeys.trayEnabled) !== "false",
        trayAppVisibility: (() => {
          try {
            return JSON.parse(localStorage.getItem(StorageKeys.trayAppVisibility)) || {};
          } catch {
            return {};
          }
        })(),
        windowSwitcherMode: localStorage.getItem(StorageKeys.windowSwitcherMode) || "mru",
        windowSwitcherUI: localStorage.getItem(StorageKeys.windowSwitcherUI) || "overlay",
        windowSwitcherIncludeMinimized: localStorage.getItem(StorageKeys.windowSwitcherIncludeMinimized) !== "false",
        mikuCursor: localStorage.getItem(StorageKeys.mikuCursor) !== "false",
        fontFamily: localStorage.getItem(StorageKeys.fontFamily) || "opensans",
        uiDensity: localStorage.getItem(StorageKeys.uiDensity) || "comfortable"
      };

      applyCursor(this._settings.cursorDataUrl);
      applyMikuCursor(this._settings.mikuCursor);
      applyDesktopStretchScrollDisabled(this._settings.disableDesktopStretchScroll);
      applyTheme(this._settings.theme, () => this._getCustomColors());
      applyWindowTransparency(this._settings.windowTransparency);
      applySound(this._settings.soundEnabled, this._settings.masterVolume);
      applyStartMenuSize(this._settings.startMenuWidth, this._settings.startMenuHeight);
      applyStartMenuCats(this._settings.startMenuCats);
      applyTransparentUI(this._settings.transparentUI);
      applyGuiScale(this._settings.guiScale);
      applyFontSize(this._settings.fontSize);
      applyTrayEnabled(this._settings.trayEnabled);
      applyUiDensity(this._settings.uiDensity);
      window._settings = this._settings;

      if (cursorFromLegacyStorage && !cursorOriginalFromStorage) {
        try {
          localStorage.setItem(StorageKeys.cursorOriginalKey, cursorFromLegacyStorage);
          this._settings.cursorOriginalDataUrl = cursorFromLegacyStorage;
        } catch {}
      }
    }, 0);
  }

  open(options = {}) {
    const winId = "yukiOS-settings";
    const existing = document.getElementById(winId);
    if (existing) {
      os.window.focus(existing);
      if (options && typeof options.section === "string") {
        this.navigateToSection(existing, options.section, options.target);
      }
      return;
    }

    const win = os.window.create(winId, "Settings", "805px", "600px", {
      icon: "fas fa-cog"
    });
    win.innerHTML = buildSettingsHTML(this._settings, this._services.wm);

    if (this.desktopUI !== undefined) this.desktopUI.closeAllMenus();

    this._bindControls(win);

    if (options && typeof options.section === "string") {
      this.navigateToSection(win, options.section, options.target);
    }
  }

  navigateToSection(win, section, target) {
    const navItem = win.querySelector(`.yuki-settings-nav li[data-target="${section}"]`);
    if (navItem) navItem.click();
    if (target) {
      setTimeout(() => {
        const targetEl = win.querySelector(`#${target}`);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
          targetEl.setAttribute("tabindex", "-1");
          targetEl.focus({ preventScroll: true });
        }
      }, 100);
    }
  }

  setDesktopUI(desktopUi) {
    this.desktopUI = desktopUi;
  }
  setAppLauncher(appLauncher) {
    this._appLauncher = appLauncher;
  }
  setFileSystemManager(fs) {
    this.fs = fs;
  }
  setNotificationCenter(nc) {
    this._notificationCenter = nc;
  }

  get(key) {
    return this._settings[key];
  }

  async exportData(showStatus = () => {}) {
    return exportData(this.fs, showStatus);
  }

  async importData(showStatus = () => {}) {
    return importData(this.fs, showStatus);
  }

  deleteAllData = async () => deleteAllData();

  resetModuleData = async () => {
    const confirmed = await (
      await import("../shared/dialogs.js")
    ).customConfirm("This will reset OS settings defined by the module and reload. Continue?");
    if (!confirmed) return;
    Object.values(StorageKeys).forEach((key) => localStorage.removeItem(key));
    location.reload();
  };

  _buildSaveCallback(win) {
    return () => {
      const g = (id) => win.querySelector(id);
      const gc = (id) => g(id)?.checked;

      const weather = !!gc("#settingsWeather");
      const cycleWallpaper = !!gc("#settingsCycleWallpaper");
      const macOsControls = !!gc("#settingsMacControls");
      const clippy = !!gc("#settingsClippy");
      const achievementsDisabled = !gc("#settingsAchievements");
      const analyticsDisabled = !gc("#settingsAnalytics");
      const adsDisabled = !gc("#settingsAds");
      const disableDesktopStretchScroll = !!gc("#settingsDisableDesktopStretchScroll");
      const showWorkspace = gc("#settingsShowWorkspace") ?? true;
      const cdnMirror = g("#settingsCdnMirror")?.value ?? "jsdelivr";
      const selectedAlignment =
        win.querySelector(".settings-btn[data-alignment].active")?.dataset.alignment || "center";
      const notificationsEnabled = !!gc("#settingsNotificationsEnabled");
      const notificationsRemoveTimeout = !!gc("#settingsNotificationsRemoveTimeout");
      const notificationsPopAnimation = !!gc("#settingsNotificationsPopAnimation");
      const notificationsOverFullscreen = !!gc("#settingsNotificationsOverFullscreen");
      const notificationsDuration = Number(g("#settingsNotificationsDuration")?.value) || 5;
      const notificationsPosition = g("#settingsNotificationsPosition")?.value || "bottom-right";
      const transparentUI = !!gc("#settingsTransparentUI");
      const disableBootScreen = !!gc("#settingsDisableBootScreen");
      const windowSessionPersistence = !!gc("#settingsWindowSessionPersistence");
      const selectedTurboMode = win.querySelector(".settings-btn[data-turbo-val].active")?.dataset.turboVal || "high";
      const startMenuWidth = Number(g("#settingsStartMenuWidth")?.value) || 650;
      const startMenuHeight = Number(g("#settingsStartMenuHeight")?.value) || 500;
      const selectedFontFamily =
        win.querySelector(".settings-btn[data-font-family].active")?.dataset.fontFamily || "poppins";

      const startMenuCats = {};
      win.querySelectorAll(".settings-start-cat-toggle").forEach((chk) => {
        startMenuCats[chk.dataset.cat] = chk.checked;
      });

      const ls = localStorage;
      ls.setItem(StorageKeys.weather, String(weather));
      ls.setItem(StorageKeys.cycleWallpaper, String(cycleWallpaper));
      ls.setItem(StorageKeys.macOsControls, String(macOsControls));
      ls.setItem(StorageKeys.clippy, String(clippy));
      ls.setItem(StorageKeys.disableDesktopStretchScroll, String(disableDesktopStretchScroll));
      ls.setItem(StorageKeys.showWorkspace, String(showWorkspace));
      ls.setItem(StorageKeys.achievementsDisabled, String(achievementsDisabled));
      ls.setItem(StorageKeys.analyticsDisabled, String(analyticsDisabled));
      ls.setItem(StorageKeys.adsDisabled, String(adsDisabled));
      ls.setItem(StorageKeys.taskbarAlignment, selectedAlignment);
      ls.setItem(StorageKeys.cdnMirror, cdnMirror);
      ls.setItem(StorageKeys.notificationsEnabled, String(notificationsEnabled));
      ls.setItem(StorageKeys.notificationsRemoveTimeout, String(notificationsRemoveTimeout));
      ls.setItem(StorageKeys.notificationsPopAnimation, String(notificationsPopAnimation));
      ls.setItem(StorageKeys.notificationsOverFullscreen, String(notificationsOverFullscreen));
      ls.setItem(StorageKeys.notificationsDuration, String(notificationsDuration));
      ls.setItem(StorageKeys.notificationsPosition, notificationsPosition);
      ls.setItem(StorageKeys.transparentUI, String(transparentUI));
      ls.setItem(StorageKeys.disableBootScreen, String(disableBootScreen));
      ls.setItem(StorageKeys.windowSessionPersistence, String(windowSessionPersistence));
      ls.setItem(StorageKeys.turboMode, selectedTurboMode);
      ls.setItem(StorageKeys.startMenuWidth, String(startMenuWidth));
      ls.setItem(StorageKeys.startMenuHeight, String(startMenuHeight));
      ls.setItem(StorageKeys.startMenuCats, JSON.stringify(startMenuCats));

      Object.assign(this._settings, {
        weather,
        cycleWallpaper,
        macOsControls,
        clippy,
        disableDesktopStretchScroll,
        showWorkspace,
        achievementsDisabled,
        analyticsDisabled,
        adsDisabled,
        taskbarAlignment: selectedAlignment,
        cdnMirror,
        disableBootScreen,
        windowSessionPersistence,
        startMenuWidth,
        startMenuHeight,
        startMenuCats,
        turboMode: selectedTurboMode,
        notificationsEnabled,
        notificationsRemoveTimeout,
        notificationsPopAnimation,
        notificationsOverFullscreen,
        notificationsDuration,
        notificationsPosition,
        transparentUI
      });

      setCdnMirror(cdnMirror);
      initializeMirrors(appMap);
      applyDesktopStretchScrollDisabled(disableDesktopStretchScroll);
      applyStartMenuSize(startMenuWidth, startMenuHeight);
      applyStartMenuCats(startMenuCats);
      turboManager.setMode(selectedTurboMode);
      applyTransparentUI(transparentUI);
      applyFontFamily(selectedFontFamily);
      os.events.emit(BusEvents.SETTINGS_CHANGED, this._settings);

      this._showSavedMessage(win);
    };
  }

  _bindControls(win) {
    const showStatus = (msg) => os.notify.send("Settings", msg, "info", 3000, "fas fa-check-circle");
    const showSaved = () => this._showSavedMessage(win);
    const save = this._buildSaveCallback(win);

    bindNavigation(win);

    bindSystemCategory(win, save, this._settings, this._notificationCenter, showSaved);

    bindDesktopCategory(win, save, this._settings, showSaved);

    bindAppearanceCategory(
      win,
      save,
      this._settings,
      this.fs,
      this._services.wm,
      showStatus,
      showSaved,
      () => this._getCustomColors(),
      (colors) => this._setCustomColors(colors),
      (dataUrl, opts) => this._normalizeCursorDataUrl(dataUrl, opts),
      (w) => this._showCustomColorsDialog(w)
    );

    bindDataCategory(win, save, this._settings, this.fs, showStatus, showSaved);
    bindNetworkCategory(win, save);
    bindAudioCategory(win, this._settings, showSaved);
  }

  _showSavedMessage(win) {
    let toast = win.querySelector(".settings-saved-toast");
    if (toast) {
      clearTimeout(toast._timeout);
      toast.remove();
    }

    toast = document.createElement("div");
    toast.className = "settings-saved-toast";
    toast.innerHTML = `<i class="fas fa-check-circle"></i> Saved`;
    const content = win.querySelector(".window-content");
    if (content) {
      content.style.position = "relative";
      content.appendChild(toast);
    }

    requestAnimationFrame(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateY(0)";
    });

    toast._timeout = setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-10px)";
      setTimeout(() => toast.remove(), 200);
    }, 2000);
  }

  _getCustomColors() {
    try {
      const stored = localStorage.getItem(StorageKeys.customColors);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  _setCustomColors(colors) {
    try {
      localStorage.setItem(StorageKeys.customColors, JSON.stringify(colors));
      applyTheme(this._settings.theme, () => this._getCustomColors());
    } catch {}
  }

  _showCustomColorsDialog(win) {
    const customColors = this._getCustomColors() || {};
    const overlay = document.createElement("div");
    overlay.className = "explorer-confirmation-overlay";
    overlay.style.zIndex = "999999";

    const dialog = document.createElement("div");
    dialog.className = "overlay-dialog";
    dialog.innerHTML = `
      <div class="conflict-header">
        <i class="fas fa-palette conflict-icon"></i>
        <span class="conflict-title">Custom Colors</span>
      </div>
      <div class="conflict-message">Override theme colors manually. Changes apply on top of the selected theme.</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
        <div>
          <label style="font-size:12px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:6px;">Brand Color</label>
          <input type="color" id="custom-brand" value="${customColors.brand || "#6b5ce7"}" style="width:100%;height:36px;border:1px solid var(--glass-border);border-radius:6px;cursor:pointer;background:var(--glass);">
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:6px;">Background Primary</label>
          <input type="color" id="custom-bg-primary" value="${customColors["bg-primary"] || "#1a1a2e"}" style="width:100%;height:36px;border:1px solid var(--glass-border);border-radius:6px;cursor:pointer;background:var(--glass);">
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:6px;">Background Secondary</label>
          <input type="color" id="custom-bg-secondary" value="${customColors["bg-secondary"] || "#252540"}" style="width:100%;height:36px;border:1px solid var(--glass-border);border-radius:6px;cursor:pointer;background:var(--glass);">
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:6px;">Text Primary</label>
          <input type="color" id="custom-text-primary" value="${customColors["text-primary"] || "#ffffff"}" style="width:100%;height:36px;border:1px solid var(--glass-border);border-radius:6px;cursor:pointer;background:var(--glass);">
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:6px;">Text Secondary</label>
          <input type="color" id="custom-text-secondary" value="${customColors["text-secondary"] || "#a0a0b0"}" style="width:100%;height:36px;border:1px solid var(--glass-border);border-radius:6px;cursor:pointer;background:var(--glass);">
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:6px;">Glass</label>
          <input type="color" id="custom-glass" value="${customColors.glass || "#ffffff"}" style="width:100%;height:36px;border:1px solid var(--glass-border);border-radius:6px;cursor:pointer;background:var(--glass);">
        </div>
      </div>
      <div class="conflict-actions">
        <button class="conflict-btn conflict-btn-skip" id="custom-colors-reset"><i class="fas fa-undo conflict-btn-icon"></i> Reset to Theme</button>
        <button class="conflict-btn conflict-btn-keep" id="custom-colors-apply"><i class="fas fa-check conflict-btn-icon"></i> Apply</button>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    dialog.querySelector("#custom-colors-reset").addEventListener("click", () => {
      localStorage.removeItem("yukios_custom_colors");
      applyTheme(this._settings.theme, () => this._getCustomColors());
      overlay.remove();
    });

    dialog.querySelector("#custom-colors-apply").addEventListener("click", () => {
      this._setCustomColors({
        brand: dialog.querySelector("#custom-brand").value,
        "bg-primary": dialog.querySelector("#custom-bg-primary").value,
        "bg-secondary": dialog.querySelector("#custom-bg-secondary").value,
        "text-primary": dialog.querySelector("#custom-text-primary").value,
        "text-secondary": dialog.querySelector("#custom-text-secondary").value,
        glass: dialog.querySelector("#custom-glass").value
      });
      overlay.remove();
    });

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  async _normalizeCursorDataUrl(dataUrl, { maxSize = 128 } = {}) {
    const MAX = Math.max(16, Math.min(128, Number(maxSize) || 128));
    try {
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error("Failed to decode image"));
        i.src = dataUrl;
      });

      const srcW = img.naturalWidth || img.width || 0;
      const srcH = img.naturalHeight || img.height || 0;
      if (!srcW || !srcH) return dataUrl;

      const scale = Math.min(1, MAX / Math.max(srcW, srcH));
      const w = Math.max(1, Math.round(srcW * scale));
      const h = Math.max(1, Math.round(srcH * scale));

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return dataUrl;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      const png = canvas.toDataURL("image/png");
      return typeof png === "string" && png.startsWith("data:image/png") ? png : dataUrl;
    } catch {
      return dataUrl;
    }
  }
}
