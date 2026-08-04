import { BaseApp, StorageKeys, os } from "../framework.js";
import { getWispUrl } from "../shared/wispConfig.js";
import { BusEvents } from "../core/EventBus.js";
import { setCdnMirror, initializeMirrors } from "../shared/assetResolver.js";
import { appMap } from "../games/gamesList.js";
import { turboManager } from "../shared/turboManager.js";
import { parseBool } from "../utils/utils.js";

import { buildSettingsHTML } from "./settingRenderer.js";
import { modeManager, MODES } from "../modeManager.js";
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
  applyTaskbarScale,
  applyVirtualResolution,
  applyDockIconSize,
  applyDockScale,
  applyDockAnimationSpeed
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
import { bindAccountsCategory } from "./accountsPanel.js";
import { bindTilingCategory } from "./pane-tiling.js";
import { bindChromeOsCategory } from "../modes/chromeos/settings.js";
import { exportData, importData, deleteAllData } from "./settingsData.js";
import { bindSelectMenu, getSelectMenuValue } from "../shared/selectMenu.js";
import { bindRangeSlider, getRangeSliderValue } from "../shared/rangeSlider.js";
import { getStoredCustomColors, applyCustomColors, openCustomColorsDialog } from "../shared/customColorsDialog.js";

export { StorageKeys };

export class SettingsApp extends BaseApp {
  constructor(services) {
    super(services);
    this.fs = os.fileSystemManager;

    setTimeout(() => {
      const cursorOriginalFromStorage = os.storage.get(StorageKeys.cursorOriginalKey) ?? "";
      const cursorFromLegacyStorage = os.storage.get(StorageKeys.cursorKey) ?? "";
      const cursorOriginalDataUrl = cursorOriginalFromStorage || cursorFromLegacyStorage || "";
      const parsedCursorSize = os.storage.get(StorageKeys.cursorSizeKey);
      const cursorSize = Number.isFinite(parsedCursorSize) && parsedCursorSize > 0 ? parsedCursorSize : 32;

      const rawTransparency = os.storage.get(StorageKeys.windowTransparency);
      const rawMasterVol = os.storage.get(StorageKeys.masterVolume);
      const rawSystemVol = os.storage.get(StorageKeys.systemVolume);

      this.settings = {
        weather: parseBool(os.storage.get(StorageKeys.weather), true),
        cycleWallpaper: parseBool(os.storage.get(StorageKeys.cycleWallpaper), true),
        cursorDataUrl: cursorFromLegacyStorage,
        cursorOriginalDataUrl,
        cursorSize,
        clippy: parseBool(os.storage.get(StorageKeys.clippy)),
        disableDesktopStretchScroll: parseBool(os.storage.get(StorageKeys.disableDesktopStretchScroll), true),
        achievementsDisabled: parseBool(os.storage.get(StorageKeys.achievementsDisabled)),
        friendsLiveActivity: parseBool(os.storage.get(StorageKeys.friendsLiveActivity), true),
        analyticsDisabled: parseBool(os.storage.get(StorageKeys.analyticsDisabled)),
        adsDisabled: parseBool(os.storage.get(StorageKeys.adsDisabled)),
        taskbarAlignment: os.storage.get(StorageKeys.taskbarAlignment) || "left",
        cdnMirror: os.storage.get(StorageKeys.cdnMirror) || "jsdelivr",
        theme: os.storage.get(StorageKeys.theme) || "dark",
        yuriMode: parseBool(os.storage.get(StorageKeys.yuriMode)),
        windowTransparency: Number.isFinite(rawTransparency) ? Math.max(0.2, Math.min(1, rawTransparency)) : 1,
        soundEnabled: parseBool(os.storage.get(StorageKeys.soundEnabled), true),
        masterVolume: Number.isFinite(rawMasterVol) ? Math.max(0, Math.min(1, rawMasterVol)) : 1,
        systemAudioEnabled: parseBool(os.storage.get(StorageKeys.systemAudioEnabled), true),
        systemVolume: Number.isFinite(rawSystemVol) ? Math.max(0, Math.min(1, rawSystemVol)) : 1,
        dnd: parseBool(os.storage.get(StorageKeys.dndKey)),
        taskbarPosition: os.storage.get(StorageKeys.taskbarPosition) || "bottom",
        disableBootScreen: parseBool(os.storage.get(StorageKeys.disableBootScreen)),
        windowSessionPersistence: parseBool(os.storage.get(StorageKeys.windowSessionPersistence), true),
        startMenuWidth: Number(os.storage.get(StorageKeys.startMenuWidth)) || 650,
        startMenuHeight: Number(os.storage.get(StorageKeys.startMenuHeight)) || 500,
        startMenuCats: os.storage.get(StorageKeys.startMenuCats) || {},
        turboMode: turboManager.getMode(),
        showWorkspace: parseBool(os.storage.get(StorageKeys.showWorkspace), true),
        notificationsEnabled: parseBool(os.storage.get(StorageKeys.notificationsEnabled), true),
        notificationsRemoveTimeout: parseBool(os.storage.get(StorageKeys.notificationsRemoveTimeout), true),
        notificationsPopAnimation: parseBool(os.storage.get(StorageKeys.notificationsPopAnimation), true),
        notificationsOverFullscreen: parseBool(os.storage.get(StorageKeys.notificationsOverFullscreen)),
        notificationsDuration: Number(os.storage.get(StorageKeys.notificationsDuration)) || 5,
        notificationsPosition: os.storage.get(StorageKeys.notificationsPosition) || "bottom-right",
        transparentUI: parseBool(os.storage.get(StorageKeys.transparentUI)),
        clipboardManagerEnabled: parseBool(os.storage.get(StorageKeys.clipboardManagerEnabled), true),
        guiScale: Number(os.storage.get(StorageKeys.guiScale)) || 100,
        fontSize: Number(os.storage.get(StorageKeys.fontSize)) || 100,
        trayEnabled: parseBool(os.storage.get(StorageKeys.trayEnabled), true),
        trayAppVisibility: os.storage.get(StorageKeys.trayAppVisibility) || {},
        windowSwitcherMode: os.storage.get(StorageKeys.windowSwitcherMode) || "mru",
        windowSwitcherUI: os.storage.get(StorageKeys.windowSwitcherUI) || "overlay",
        windowSwitcherIncludeMinimized: parseBool(os.storage.get(StorageKeys.windowSwitcherIncludeMinimized), true),
        mikuCursor: parseBool(os.storage.get(StorageKeys.mikuCursor), true),
        fontFamily: os.storage.get(StorageKeys.fontFamily) || "opensans",
        uiDensity: os.storage.get(StorageKeys.uiDensity) || "comfortable",
        wispServer: getWispUrl(),
        browserTransport: os.storage.get(StorageKeys.browserTransport) || "epoxy",
        virtualResolution: os.storage.get(StorageKeys.virtualResolution) || "native",
        cursorEffectEnabled: parseBool(os.storage.get(StorageKeys.cursorEffectEnabled), true),
        wobblyWindows: parseBool(os.storage.get(StorageKeys.wobblyWindows)),
        wobbleSpringK: Number(os.storage.get(StorageKeys.wobbleSpringK)) || 170,
        wobbleDamping: Number(os.storage.get(StorageKeys.wobbleDamping)) || 15,
        wobbleMass: Number(os.storage.get(StorageKeys.wobbleMass)) || 1.0,
        wobbleDragLag: Number(os.storage.get(StorageKeys.wobbleDragLag)) || 0.55,
        wobbleCoupleK: Number(os.storage.get(StorageKeys.wobbleCoupleK)) || 90,
        desktopIconSize: Number(os.storage.get(StorageKeys.desktopIconSize)) || 48,
        taskbarScale: Number(os.storage.get(StorageKeys.taskbarScale)) || 100,
        hideDesktopIcons: parseBool(os.storage.get(StorageKeys.hideDesktopIcons)),
        taskbarShowLabels: parseBool(os.storage.get(StorageKeys.taskbarShowLabels)),
        dockEnabled: parseBool(os.storage.get(StorageKeys.dockEnabled)),
        dockPosition: os.storage.get(StorageKeys.dockPosition) || "bottom",
        dockAutoHide: parseBool(os.storage.get(StorageKeys.dockAutoHide)),
        dockMagnification: parseBool(os.storage.get(StorageKeys.dockMagnification), true),
        dockMagnifyAmount: Number(os.storage.get(StorageKeys.dockMagnifyAmount)) || 1.2,
        dockMagnifyRange: Number(os.storage.get(StorageKeys.dockMagnifyRange)) || 3,
        dockIconSize: Number(os.storage.get(StorageKeys.dockIconSize)) || 43,
        dockScale: Number(os.storage.get(StorageKeys.dockScale)) || 100,
        dockAnimationSpeed: Number(os.storage.get(StorageKeys.dockAnimationSpeed)) || 0.2
      };

      applyCursor(this.settings.cursorDataUrl);
      applyMikuCursor(this.settings.mikuCursor);
      applyDesktopStretchScrollDisabled(this.settings.disableDesktopStretchScroll);
      applyTheme(this.settings.theme, () => this.getCustomColors());
      applyWindowTransparency(this.settings.windowTransparency);
      applySound(this.settings.soundEnabled, this.settings.masterVolume);
      applyStartMenuSize(this.settings.startMenuWidth, this.settings.startMenuHeight);
      applyStartMenuCats(this.settings.startMenuCats);
      applyTransparentUI(this.settings.transparentUI);
      applyGuiScale(this.settings.guiScale);
      applyVirtualResolution(this.settings.virtualResolution, this.settings.guiScale);
      applyFontSize(this.settings.fontSize);
      applyTrayEnabled(this.settings.trayEnabled);
      applyUiDensity(this.settings.uiDensity);
      applyDesktopIconSize(this.settings.desktopIconSize);
      applyTaskbarScale(this.settings.taskbarScale);
      applyDockIconSize(this.settings.dockIconSize);
      applyDockScale(this.settings.dockScale);
      applyDockAnimationSpeed(this.settings.dockAnimationSpeed);

      let resizeTimer;
      window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          applyVirtualResolution(this.settings.virtualResolution, this.settings.guiScale);
        }, 200);
      });

      if (cursorFromLegacyStorage && !cursorOriginalFromStorage) {
        try {
          os.storage.set(StorageKeys.cursorOriginalKey, cursorFromLegacyStorage);
          this.settings.cursorOriginalDataUrl = cursorFromLegacyStorage;
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
      ...options,
      icon: "fas fa-cog"
    });
    win.innerHTML = buildSettingsHTML(this.settings, this.wm);

    if (this.desktopUI !== undefined) this.desktopUI.closeAllMenus();

    this.bindControls(win);

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

  get desktopUI() {
    return os.desktopUI;
  }

  setNotificationCenter(nc) {
    this.notificationCenter = nc;
  }

  get(key) {
    return this.settings[key];
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

  buildSaveCallback(win) {
    return () => {
      const g = (id) => win.querySelector(id);
      const gc = (id) => g(id)?.checked;

      const weather = !!gc("#settingsWeather");
      const cycleWallpaper = !!gc("#settingsCycleWallpaper");
      const clippy = !!gc("#settingsClippy");
      const achievementsDisabled = !gc("#settingsAchievements");
      const analyticsDisabled = !gc("#settingsAnalytics");
      const adsDisabled = !gc("#settingsAds");
      const friendsLiveActivity = !!gc("#settingsFriendsActivity");
      const disableDesktopStretchScroll = !!gc("#settingsDisableDesktopStretchScroll");
      const hideDesktopIcons = !!gc("#settingsHideDesktopIcons");
      const showWorkspace = gc("#settingsShowWorkspace") ?? true;
      const cdnMirror = getSelectMenuValue("settingsCdnMirror", win) ?? "jsdelivr";
      const selectedAlignment =
        win.querySelector(".settings-btn[data-alignment].active")?.dataset.alignment || "center";
      const notificationsEnabled = !!gc("#settingsNotificationsEnabled");
      const notificationsRemoveTimeout = !!gc("#settingsNotificationsRemoveTimeout");
      const notificationsPopAnimation = !!gc("#settingsNotificationsPopAnimation");
      const notificationsOverFullscreen = !!gc("#settingsNotificationsOverFullscreen");
      const notificationsDuration = Number(getRangeSliderValue("settingsNotificationsDuration", win)) || 5;
      const notificationsPosition = getSelectMenuValue("settingsNotificationsPosition", win) || "bottom-right";
      const transparentUI = !!gc("#settingsTransparentUI");
      const disableBootScreen = !!gc("#settingsDisableBootScreen");
      const windowSessionPersistence = !!gc("#settingsWindowSessionPersistence");
      const selectedTurboMode = win.querySelector(".settings-btn[data-turbo-val].active")?.dataset.turboVal || "high";
      const startMenuWidth = Number(getRangeSliderValue("settingsStartMenuWidth", win)) || 650;
      const startMenuHeight = Number(getRangeSliderValue("settingsStartMenuHeight", win)) || 500;
      const selectedFontFamily = os.storage.get(StorageKeys.customFont) ? "__custom__" : "opensans";

      const cursorEffectEnabled = !!gc("#settingsCursorEffect");
      const wobblyWindows = !!gc("#settingsWobblyWindows");
      const wobbleSpringK = Number(getRangeSliderValue("settingsWobbleSpringK", win)) || 170;
      const wobbleDamping = Number(getRangeSliderValue("settingsWobbleDamping", win)) || 15;
      const wobbleMass = Number(getRangeSliderValue("settingsWobbleMass", win)) || 1.0;
      const wobbleDragLag = Number(getRangeSliderValue("settingsWobbleDragLag", win)) || 0.55;
      const wobbleCoupleK = Number(getRangeSliderValue("settingsWobbleCoupleK", win)) || 90;

      const startMenuCats = {};
      win.querySelectorAll(".settings-start-cat-toggle").forEach((chk) => {
        startMenuCats[chk.dataset.cat] = chk.checked;
      });

      os.storage.set(StorageKeys.weather, String(weather));
      os.storage.set(StorageKeys.cycleWallpaper, String(cycleWallpaper));
      os.storage.set(StorageKeys.clippy, String(clippy));
      os.storage.set(StorageKeys.disableDesktopStretchScroll, String(disableDesktopStretchScroll));
      os.storage.set(StorageKeys.hideDesktopIcons, String(hideDesktopIcons));
      os.storage.set(StorageKeys.showWorkspace, String(showWorkspace));
      os.storage.set(StorageKeys.achievementsDisabled, String(achievementsDisabled));
      os.storage.set(StorageKeys.analyticsDisabled, String(analyticsDisabled));
      os.storage.set(StorageKeys.adsDisabled, String(adsDisabled));
      os.storage.set(StorageKeys.friendsLiveActivity, String(friendsLiveActivity));
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
      os.storage.set(StorageKeys.wobblyWindows, String(wobblyWindows));
      os.storage.set(StorageKeys.wobbleSpringK, String(wobbleSpringK));
      os.storage.set(StorageKeys.wobbleDamping, String(wobbleDamping));
      os.storage.set(StorageKeys.wobbleMass, String(wobbleMass));
      os.storage.set(StorageKeys.wobbleDragLag, String(wobbleDragLag));
      os.storage.set(StorageKeys.wobbleCoupleK, String(wobbleCoupleK));
      os.storage.set(StorageKeys.desktopIconSize, String(this.settings.desktopIconSize));
      os.storage.set(StorageKeys.taskbarScale, String(this.settings.taskbarScale));
      os.storage.set(StorageKeys.dockEnabled, String(this.settings.dockEnabled));
      if (this.settings.dockEnabled) {
        modeManager.enter(MODES.MAC);
      } else {
        modeManager.exit(MODES.MAC);
      }
      os.storage.set(StorageKeys.dockPosition, this.settings.dockPosition);
      os.storage.set(StorageKeys.dockAutoHide, String(this.settings.dockAutoHide));
      os.storage.set(StorageKeys.dockMagnification, String(this.settings.dockMagnification));
      os.storage.set(StorageKeys.dockMagnifyAmount, String(this.settings.dockMagnifyAmount));
      os.storage.set(StorageKeys.dockMagnifyRange, String(this.settings.dockMagnifyRange));
      os.storage.set(StorageKeys.dockIconSize, String(this.settings.dockIconSize));
      os.storage.set(StorageKeys.dockScale, String(this.settings.dockScale));
      os.storage.set(StorageKeys.dockAnimationSpeed, String(this.settings.dockAnimationSpeed));

      Object.assign(this.settings, {
        weather,
        cycleWallpaper,
        clippy,
        disableDesktopStretchScroll,
        hideDesktopIcons,
        showWorkspace,
        achievementsDisabled,
        analyticsDisabled,
        adsDisabled,
        friendsLiveActivity,
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
        cursorEffectEnabled,
        wobblyWindows,
        wobbleSpringK,
        wobbleDamping,
        wobbleMass,
        wobbleDragLag,
        wobbleCoupleK,
        virtualResolution: this.settings.virtualResolution,
        dockEnabled: this.settings.dockEnabled,
        dockPosition: this.settings.dockPosition,
        dockAutoHide: this.settings.dockAutoHide,
        dockMagnification: this.settings.dockMagnification,
        dockMagnifyAmount: this.settings.dockMagnifyAmount,
        dockMagnifyRange: this.settings.dockMagnifyRange,
        dockIconSize: this.settings.dockIconSize,
        dockScale: this.settings.dockScale,
        dockAnimationSpeed: this.settings.dockAnimationSpeed
      });

      setCdnMirror(cdnMirror);
      initializeMirrors(appMap);
      applyDesktopStretchScrollDisabled(disableDesktopStretchScroll);
      applyStartMenuSize(startMenuWidth, startMenuHeight);
      applyStartMenuCats(startMenuCats);
      turboManager.setMode(selectedTurboMode);
      applyTransparentUI(transparentUI);
      applyFontFamily(selectedFontFamily);
      applyDockIconSize(this.settings.dockIconSize);
      applyDockScale(this.settings.dockScale);
      applyDockAnimationSpeed(this.settings.dockAnimationSpeed);
      os.events.emit(BusEvents.SETTINGS_CHANGED, this.settings);

      this.showSavedMessage(win);
    };
  }

  bindControls(win) {
    const showStatus = (msg) =>
      os.notify.send("Settings", msg, { type: "info", duration: 3000, icon: "fas fa-check-circle" });
    const showSaved = () => this.showSavedMessage(win);
    const save = this.buildSaveCallback(win);

    bindNavigation(win);
    bindSelectMenu(win);
    bindRangeSlider(win);

    bindSystemCategory(win, save, this.settings, this.notificationCenter, showSaved);

    bindDesktopCategory(win, save, this.settings, showSaved);

    bindAppearanceCategory(
      win,
      save,
      this.settings,
      this.fs,
      this.wm,
      showStatus,
      showSaved,
      () => this.getCustomColors(),
      (colors) => this.setCustomColors(colors),
      (dataUrl, opts) => this.normalizeCursorDataUrl(dataUrl, opts),
      (w) => this.showCustomColorsDialog(w)
    );

    bindDataCategory(win, save, this.settings, this.fs, showStatus, showSaved);
    bindNetworkCategory(win, save, this.settings, showSaved);
    bindAudioCategory(win, this.settings, showSaved);
    bindAccountsCategory(win);
    bindTilingCategory(win, save, this.settings);
    bindChromeOsCategory(win, showSaved);
  }

  showSavedMessage(win) {
    let toast = win.querySelector(".settings-saved-toast");
    if (toast) {
      clearTimeout(toast.timeout);
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

    toast.timeout = setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-10px)";
      setTimeout(() => toast.remove(), 200);
    }, 2000);
  }

  getCustomColors() {
    return getStoredCustomColors();
  }

  setCustomColors(colors) {
    applyCustomColors(colors);
  }

  showCustomColorsDialog(win) {
    openCustomColorsDialog();
  }

  async normalizeCursorDataUrl(dataUrl, { maxSize = 128 } = {}) {
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
