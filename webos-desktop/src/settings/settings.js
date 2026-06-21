import { BaseApp, StorageKeys, os } from "../framework.js";
import { BusEvents } from "../core/EventBus.js";
import { setCdnMirror, initializeMirrors } from "../shared/assetResolver.js";
import { appMap } from "../games/gamesList.js";
import { turboManager } from "../shared/turboManager.js";

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
  applyUiDensity,
  applyDesktopIconSize,
  applyTaskbarScale
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
      const cursorOriginalFromStorage = os.storage.get(StorageKeys.cursorOriginalKey) ?? "";
      const cursorFromLegacyStorage = os.storage.get(StorageKeys.cursorKey) ?? "";
      const cursorOriginalDataUrl = cursorOriginalFromStorage || cursorFromLegacyStorage || "";
      const parsedCursorSize = os.storage.get(StorageKeys.cursorSizeKey);
      const cursorSize = Number.isFinite(parsedCursorSize) && parsedCursorSize > 0 ? parsedCursorSize : 32;

      const rawTransparency = os.storage.get(StorageKeys.windowTransparency);
      const rawMasterVol = os.storage.get(StorageKeys.masterVolume);
      const rawSystemVol = os.storage.get(StorageKeys.systemVolume);

      this._settings = {
        weather: os.storage.get(StorageKeys.weather) !== "false",
        cycleWallpaper: os.storage.get(StorageKeys.cycleWallpaper) !== "false",
        cursorDataUrl: cursorFromLegacyStorage,
        cursorOriginalDataUrl,
        cursorSize,
        macOsControls: os.storage.get(StorageKeys.macOsControls) === "true",
        clippy: os.storage.get(StorageKeys.clippy) === "true",
        disableDesktopStretchScroll: os.storage.get(StorageKeys.disableDesktopStretchScroll) === "true",
        achievementsDisabled: os.storage.get(StorageKeys.achievementsDisabled) === "true",
        analyticsDisabled: os.storage.get(StorageKeys.analyticsDisabled) === "true",
        adsDisabled: os.storage.get(StorageKeys.adsDisabled) === "true",
        taskbarAlignment: os.storage.get(StorageKeys.taskbarAlignment) || "left",
        cdnMirror: os.storage.get(StorageKeys.cdnMirror) || "jsdelivr",
        theme: os.storage.get(StorageKeys.theme) || "dark",
        windowTransparency: Number.isFinite(rawTransparency) ? Math.max(0.2, Math.min(1, rawTransparency)) : 1,
        soundEnabled: os.storage.get(StorageKeys.soundEnabled) !== "false",
        masterVolume: Number.isFinite(rawMasterVol) ? Math.max(0, Math.min(1, rawMasterVol)) : 1,
        systemAudioEnabled: os.storage.get(StorageKeys.systemAudioEnabled) !== "false",
        systemVolume: Number.isFinite(rawSystemVol) ? Math.max(0, Math.min(1, rawSystemVol)) : 1,
        dnd: os.storage.get(StorageKeys.dndKey) === "1",
        taskbarPosition: os.storage.get(StorageKeys.taskbarPosition) || "bottom",
        disableBootScreen: os.storage.get(StorageKeys.disableBootScreen) === "true",
        windowSessionPersistence: os.storage.get(StorageKeys.windowSessionPersistence) !== "false",
        startMenuWidth: Number(os.storage.get(StorageKeys.startMenuWidth)) || 650,
        startMenuHeight: Number(os.storage.get(StorageKeys.startMenuHeight)) || 500,
        startMenuCats: os.storage.get(StorageKeys.startMenuCats) || {},
        turboMode: turboManager.getMode(),
        showWorkspace: os.storage.get(StorageKeys.showWorkspace) !== "false",
        notificationsEnabled: os.storage.get(StorageKeys.notificationsEnabled) !== "false",
        notificationsRemoveTimeout: os.storage.get(StorageKeys.notificationsRemoveTimeout) !== "false",
        notificationsPopAnimation: os.storage.get(StorageKeys.notificationsPopAnimation) !== "false",
        notificationsOverFullscreen: os.storage.get(StorageKeys.notificationsOverFullscreen) === "true",
        notificationsDuration: Number(os.storage.get(StorageKeys.notificationsDuration)) || 5,
        notificationsPosition: os.storage.get(StorageKeys.notificationsPosition) || "bottom-right",
        transparentUI: os.storage.get(StorageKeys.transparentUI) === "true",
        clipboardManagerEnabled: os.storage.get(StorageKeys.clipboardManagerEnabled) !== "false",
        guiScale: Number(os.storage.get(StorageKeys.guiScale)) || 100,
        fontSize: Number(os.storage.get(StorageKeys.fontSize)) || 100,
        trayEnabled: os.storage.get(StorageKeys.trayEnabled) !== "false",
        trayAppVisibility: os.storage.get(StorageKeys.trayAppVisibility) || {},
        windowSwitcherMode: os.storage.get(StorageKeys.windowSwitcherMode) || "mru",
        windowSwitcherUI: os.storage.get(StorageKeys.windowSwitcherUI) || "overlay",
        windowSwitcherIncludeMinimized: os.storage.get(StorageKeys.windowSwitcherIncludeMinimized) !== "false",
        mikuCursor: os.storage.get(StorageKeys.mikuCursor) !== "false",
        fontFamily: os.storage.get(StorageKeys.fontFamily) || "opensans",
        uiDensity: os.storage.get(StorageKeys.uiDensity) || "comfortable",
        wispServer: os.storage.get(StorageKeys.wispServer) || "wss://hurt-agata-liventcord-api-7072e9a6.koyeb.app/",
        cursorEffectEnabled: os.storage.get(StorageKeys.cursorEffectEnabled) !== "false",
        desktopIconSize: Number(os.storage.get(StorageKeys.desktopIconSize)) || 64,
        taskbarScale: Number(os.storage.get(StorageKeys.taskbarScale)) || 100
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
      applyDesktopIconSize(this._settings.desktopIconSize);
      applyTaskbarScale(this._settings.taskbarScale);

      if (cursorFromLegacyStorage && !cursorOriginalFromStorage) {
        try {
          os.storage.set(StorageKeys.cursorOriginalKey, cursorFromLegacyStorage);
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
    const confirmed = await os.dialog.confirm("Confirm", "Reset all settings and reload? You can't undo this.");
    if (!confirmed) return;
    Object.values(StorageKeys).forEach((key) => os.storage.remove(key));
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

      const cursorEffectEnabled = !!gc("#settingsCursorEffect");

      const startMenuCats = {};
      win.querySelectorAll(".settings-start-cat-toggle").forEach((chk) => {
        startMenuCats[chk.dataset.cat] = chk.checked;
      });

      os.storage.set(StorageKeys.weather, String(weather));
      os.storage.set(StorageKeys.cycleWallpaper, String(cycleWallpaper));
      os.storage.set(StorageKeys.macOsControls, String(macOsControls));
      os.storage.set(StorageKeys.clippy, String(clippy));
      os.storage.set(StorageKeys.disableDesktopStretchScroll, String(disableDesktopStretchScroll));
      os.storage.set(StorageKeys.showWorkspace, String(showWorkspace));
      os.storage.set(StorageKeys.achievementsDisabled, String(achievementsDisabled));
      os.storage.set(StorageKeys.analyticsDisabled, String(analyticsDisabled));
      os.storage.set(StorageKeys.adsDisabled, String(adsDisabled));
      os.storage.set(StorageKeys.taskbarAlignment, selectedAlignment);
      os.storage.set(StorageKeys.cdnMirror, cdnMirror);
      os.storage.set(StorageKeys.notificationsEnabled, String(notificationsEnabled));
      os.storage.set(StorageKeys.notificationsRemoveTimeout, String(notificationsRemoveTimeout));
      os.storage.set(StorageKeys.notificationsPopAnimation, String(notificationsPopAnimation));
      os.storage.set(StorageKeys.notificationsOverFullscreen, String(notificationsOverFullscreen));
      os.storage.set(StorageKeys.notificationsDuration, String(notificationsDuration));
      os.storage.set(StorageKeys.notificationsPosition, notificationsPosition);
      os.storage.set(StorageKeys.transparentUI, String(transparentUI));
      os.storage.set(StorageKeys.disableBootScreen, String(disableBootScreen));
      os.storage.set(StorageKeys.windowSessionPersistence, String(windowSessionPersistence));
      os.storage.set(StorageKeys.turboMode, selectedTurboMode);
      os.storage.set(StorageKeys.startMenuWidth, String(startMenuWidth));
      os.storage.set(StorageKeys.startMenuHeight, String(startMenuHeight));
      os.storage.set(StorageKeys.startMenuCats, startMenuCats);
      os.storage.set(StorageKeys.cursorEffectEnabled, String(cursorEffectEnabled));
      os.storage.set(StorageKeys.desktopIconSize, String(settings.desktopIconSize));
      os.storage.set(StorageKeys.taskbarScale, String(settings.taskbarScale));

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
        transparentUI,
        cursorEffectEnabled
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
    const showStatus = (msg) =>
      os.notify.send("Settings", msg, { type: "info", duration: 3000, icon: "fas fa-check-circle" });
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
    bindNetworkCategory(win, save, this._settings, showSaved);
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
    return os.storage.get(StorageKeys.customColors) || null;
  }

  _setCustomColors(colors) {
    try {
      os.storage.set(StorageKeys.customColors, colors);
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
      <div style="margin-bottom: 16px;">
        <label style="font-size:12px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:6px;">Preview</label>
        <div id="color-preview" style="border-radius:8px;overflow:hidden;border:1px solid var(--glass-border);background:var(--bg-primary);padding:16px;">
          <div style="background:var(--bg-secondary);border-radius:6px;padding:12px;margin-bottom:12px;display:flex;align-items:center;gap:8px;">
            <div style="width:12px;height:12px;border-radius:50%;background:#ff5f57;"></div>
            <div style="width:12px;height:12px;border-radius:50%;background:#febc2e;"></div>
            <div style="width:12px;height:12px;border-radius:50%;background:#28c840;"></div>
            <span style="font-size:13px;color:var(--text-primary);font-weight:600;">Preview Window</span>
          </div>
          <div style="background:var(--glass);border-radius:6px;padding:12px;margin-bottom:8px;">
            <h3 style="margin:0 0 8px 0;font-size:14px;color:var(--text-primary);">Sample Heading</h3>
            <p style="margin:0;font-size:12px;color:var(--text-secondary);line-height:1.5;">This is sample text to preview how your custom colors will look in the interface.</p>
          </div>
          <div style="display:flex;gap:8px;">
            <button style="flex:1;padding:8px;border-radius:6px;border:none;background:var(--brand);color:#fff;font-size:12px;cursor:pointer;">Primary Button</button>
            <button style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--glass-border);background:var(--glass);color:var(--text-primary);font-size:12px;cursor:pointer;">Secondary</button>
          </div>
        </div>
      </div>
      <div class="conflict-actions">
        <button class="conflict-btn conflict-btn-skip" id="custom-colors-reset"><i class="fas fa-undo conflict-btn-icon"></i> Reset to Theme</button>
        <button class="conflict-btn conflict-btn-keep" id="custom-colors-apply"><i class="fas fa-check conflict-btn-icon"></i> Apply</button>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const previewEl = dialog.querySelector("#color-preview");
    const updatePreview = () => {
      const brand = dialog.querySelector("#custom-brand").value;
      const bgPrimary = dialog.querySelector("#custom-bg-primary").value;
      const bgSecondary = dialog.querySelector("#custom-bg-secondary").value;
      const textPrimary = dialog.querySelector("#custom-text-primary").value;
      const textSecondary = dialog.querySelector("#custom-text-secondary").value;
      const glass = dialog.querySelector("#custom-glass").value;

      previewEl.style.setProperty("--brand", brand);
      previewEl.style.setProperty("--bg-primary", bgPrimary);
      previewEl.style.setProperty("--bg-secondary", bgSecondary);
      previewEl.style.setProperty("--text-primary", textPrimary);
      previewEl.style.setProperty("--text-secondary", textSecondary);
      previewEl.style.setProperty("--glass", glass);
      previewEl.style.setProperty("--glass-border", glass + "40");
    };

    updatePreview();

    [
      "custom-brand",
      "custom-bg-primary",
      "custom-bg-secondary",
      "custom-text-primary",
      "custom-text-secondary",
      "custom-glass"
    ].forEach((id) => {
      dialog.querySelector(`#${id}`).addEventListener("input", updatePreview);
    });

    dialog.querySelector("#custom-colors-reset").addEventListener("click", () => {
      os.storage.remove(StorageKeys.customColors);
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
