import { StorageKeys, os } from "../framework.js";
import { Achievements } from "../achievements.js";
import { modeManager, MODES } from "../modeManager.js";
import { bus, BusEvents } from "../core/EventBus.js";
import { updateGridConfig } from "../desktopui/desktopui.js";
import { audioMixer, SystemAudio } from "../audioMixer.js";
import { applyTrayEnabled } from "./settingsApply.js";
import {
  applyTheme,
  applyWindowTransparency,
  applyTransparentUI,
  applyGuiScale,
  applyFontSize,
  applyCursor,
  applyMikuCursor,
  applyUiDensity,
  applyDesktopIconSize,
  applyTaskbarScale,
  applyVirtualResolution,
  applyDockIconSize,
  applyDockScale,
  applyDockAnimationSpeed
} from "./settingsApply.js";
import { exportData, importData, deleteAllData } from "./settingsData.js";
import { $, $$, bindEvent, toggleClass, setText, createElement, setHTML } from "../shared/domUtils.js";
import { bindSelectMenu, getSelectMenuValue, setSelectMenuValue } from "../shared/selectMenu.js";
import { bindRangeSlider, getRangeSliderValue, setRangeSliderValue } from "../shared/rangeSlider.js";
import { addCustomTheme } from "../shared/themeEngine.js";
import { bindAccountsCategory } from "./accountsPanel.js";
import { bindDisks } from "./pane-disks.js";
import { loadStartupApps, renderStartupAppList } from "../shared/startupApps.js";
import { taskbarPositionManager } from "../desktopui/taskbarPositionManager.js";
import { applyAnimationSettings } from "../windowManager/AnimationSystem.js";
import { getResolutionLabel } from "../resolution/resolutionManager.js";
export function bindNavigation(win) {
  const layout = $(".yuki-settings-layout", win);
  const navItems = $$(".yuki-settings-nav li[data-target]", win);
  const groupHeaders = $$(".yuki-settings-nav-group", win);
  const sublists = $$(".yuki-settings-sublist", win);
  const panes = $$(".settings-category-pane", win);
  const searchInput = $("#settingsSearch", win);
  const compact = os.storage.get(StorageKeys.sidebarCompact) !== "false";

  const setActiveNav = (item) => {
    navItems.forEach((n) => n.classList.remove("active"));
    groupHeaders.forEach((g) => g.classList.remove("active"));
    if (compact) {
      sublists.forEach((s) => s.classList.remove("expanded"));
      groupHeaders.forEach((g) => g.classList.remove("expanded"));
    }
    if (item) {
      item.classList.add("active");
      const gk = item.dataset.group;
      if (gk) {
        const header = win.querySelector(`.yuki-settings-nav-group[data-group="${gk}"]`);
        const sublist = win.querySelector(`.yuki-settings-sublist[data-group="${gk}"]`);
        if (header) {
          header.classList.add("active");
          if (compact) header.classList.add("expanded");
        }
        if (sublist && compact) sublist.classList.add("expanded");
      }
    }
  };

  const activatePane = (item, scrollTarget) => {
    setActiveNav(item);
    panes.forEach((p) => p.classList.remove("active"));
    const paneId = item?.dataset.target;
    const target = paneId ? win.querySelector(`#${paneId}`) : null;
    if (target) {
      target.classList.add("active");
      animateSettingsPane(target, () => {
        if (scrollTarget) scrollToSection(win, scrollTarget);
        else scrollSettingsToTop(win);
      });
    }
  };

  navItems.forEach((item) => {
    bindEvent(item, "click", () => {
      if (searchInput) {
        searchInput.value = "";
        searchInput.dispatchEvent(new Event("input"));
      }
      const launch = item.dataset.launch;
      if (launch) {
        if (launch === "defaultApps") {
          activatePane(item, item.dataset.scroll);
          mountDefaultApps(win, item.dataset.target);
          return;
        }
        os.app.launch(launch).catch(() => {});
        return;
      }
      activatePane(item, item.dataset.scroll);
    });
  });

  groupHeaders.forEach((header) => {
    bindEvent(header, "click", () => {
      const gk = header.dataset.group;
      const sublist = win.querySelector(`.yuki-settings-sublist[data-group="${gk}"]`);
      const firstNav = sublist ? sublist.querySelector(".yuki-settings-nav-item:not([data-launch])") : null;
      if (compact) {
        if (header.classList.contains("expanded")) {
          header.classList.remove("expanded", "active");
          if (sublist) sublist.classList.remove("expanded");
          if (sublist)
            sublist.querySelectorAll(".yuki-settings-nav-item.active").forEach((el) => el.classList.remove("active"));
          return;
        }
        sublists.forEach((s) => s.classList.remove("expanded"));
        groupHeaders.forEach((g) => g.classList.remove("active"));
        header.classList.add("expanded");
        if (sublist) sublist.classList.add("expanded");
      }
      if (firstNav) firstNav.click();
    });
  });

  bindEvent(searchInput, "input", (e) => {
    const query = e.target.value.toLowerCase().trim();

    if (!query) {
      layout.classList.remove("is-searching");
      if (compact) {
        sublists.forEach((s) => s.classList.remove("expanded"));
      } else {
        sublists.forEach((s) => s.classList.add("expanded"));
      }
      $$(".settings-row", win).forEach((row) => row.classList.remove("hidden-by-search"));
      panes.forEach((p) => {
        p.classList.remove("active");
        p.style.display = "";
        $$(".settings-card", p).forEach((card) => {
          card.style.display = "";
        });
      });
      const activeNav = $(".yuki-settings-nav li.active", win);
      if (activeNav) {
        const gk = activeNav.dataset.group;
        if (gk) {
          const header = win.querySelector(`.yuki-settings-nav-group[data-group="${gk}"]`);
          const sublist = win.querySelector(`.yuki-settings-sublist[data-group="${gk}"]`);
          if (header) header.classList.add("expanded");
          if (sublist && compact) sublist.classList.add("expanded");
        }
        $(`#${activeNav.dataset.target}`, win)?.classList.add("active");
      }
    } else {
      layout.classList.add("is-searching");
      sublists.forEach((s) => s.classList.add("expanded"));
      $$(".settings-row", win).forEach((row) => {
        const title = $(".settings-label-title", row)?.textContent.toLowerCase() || "";
        const desc = $(".settings-label-desc", row)?.textContent.toLowerCase() || "";
        row.classList.toggle("hidden-by-search", !(title.includes(query) || desc.includes(query)));
      });

      panes.forEach((pane) => {
        let paneHasVisibleRows = false;
        $$(".settings-card", pane).forEach((card) => {
          const visible = $$(".settings-row:not(.hidden-by-search)", card);
          card.style.display = visible.length > 0 ? "" : "none";
          if (visible.length > 0) paneHasVisibleRows = true;
        });

        const standaloneRows = $$(".settings-category-pane > .settings-row:not(.hidden-by-search)", pane);
        if (standaloneRows.length > 0) paneHasVisibleRows = true;

        if (paneHasVisibleRows) {
          pane.style.display = "block";
          pane.classList.add("active");
        } else {
          pane.style.display = "none";
          pane.classList.remove("active");
        }
      });
    }
    if (query) {
      sublists.forEach((s) => s.classList.add("expanded"));
    }
  });
}

export function animateSettingsPane(paneEl, onDone) {
  if (!paneEl || typeof paneEl.animate !== "function") {
    onDone?.();
    return;
  }
  const animation = paneEl.animate([{ transform: "translateY(12px)" }, { transform: "translateY(0)" }], {
    duration: 200,
    easing: "ease"
  });
  if (onDone) animation.onfinish = () => onDone();
}

function getSettingsScroller(win) {
  return win.querySelector(".yuki-settings-content");
}

function scrollSettingsToTop(win) {
  const scroller = getSettingsScroller(win);
  if (!scroller) return;
  const prev = scroller.style.scrollBehavior;
  scroller.style.scrollBehavior = "auto";
  scroller.scrollTop = 0;
  scroller.style.scrollBehavior = prev;
}

function scrollToSection(win, scrollTarget) {
  const el = win.querySelector(`#${scrollTarget}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "auto", block: "start" });
  el.setAttribute("tabindex", "-1");
}

function mountDefaultApps(win, paneId) {
  const app = os.app.getInstance("defaultApps");
  if (!app) return;
  const pane = win.querySelector(`#${paneId}`);
  if (!pane) return;
  let host = $(".da-pane-host", pane);
  if (!host) {
    pane.innerHTML = `<div class="da-pane-host"></div>`;
    host = $(".da-pane-host", pane);
  }
  app.mountInto(host);
}

function mountWallpaperEngine(win) {
  const host = $("#wallpaper-engine-host", win);
  if (!host || host.dataset.mounted === "1") return;
  const app = os.app.getInstance("wallpaperEngineApp");
  if (!app) return;
  host.dataset.mounted = "1";
  app.mountInto(host);
}

export function bindSystemCategory(win, save, settings, notificationCenter, showSaved) {
  const systemSettings = [
    "#settingsWeather",
    "#settingsClippy",
    "#settingsAchievements",
    "#settingsFriendsActivity",
    "#settingsAnalytics",
    "#settingsAds",
    "#settingsDisableBootScreen",
    "#settingsWindowSessionPersistence",
    "#settingsCursorEffect"
  ];
  systemSettings.forEach((id) => bindEvent($(id, win), "change", save));

  $$(".settings-btn[data-performance-val]", win).forEach((btn) => {
    bindEvent(btn, "click", () => {
      $$(".settings-btn[data-performance-val]", win).forEach((b) => toggleClass(b, "active", b === btn));
      save();
    });
  });

  const dndToggle = $("#settingsDND", win);
  if (dndToggle) {
    bindEvent(dndToggle, "change", () => {
      const enabled = dndToggle.checked;
      settings.dnd = enabled;
      os.storage.set(StorageKeys.dndKey, enabled ? "1" : "0");
      notificationCenter?.setDoNotDisturb(enabled);
    });
  }

  const lockBtn = $("#settingsLockScreen", win);
  if (lockBtn) {
    bindEvent(lockBtn, "click", () => {
      os.app.lockSession?.();
    });
  }

  const notificationSettings = [
    "#settingsNotificationsEnabled",
    "#settingsNotificationsRemoveTimeout",
    "#settingsNotificationsPopAnimation",
    "#settingsNotificationsOverFullscreen",
    "#settingsNotificationsPosition"
  ];
  notificationSettings.forEach((id) => bindEvent($(id, win), "change", save));

  const durationSlider = $("#settingsNotificationsDuration", win);
  const durationVal = $("#settingsNotificationsDurationVal", win);
  if (durationSlider) {
    bindEvent(durationSlider, "input", () => {
      if (durationVal) setText(durationVal, `${getRangeSliderValue("settingsNotificationsDuration", win)}s`);
    });
    bindEvent(durationSlider, "change", save);
  }

  const clipboardManagerToggle = $("#settingsClipboardManager", win);
  if (clipboardManagerToggle) {
    bindEvent(clipboardManagerToggle, "change", () => {
      const enabled = clipboardManagerToggle.checked;
      settings.clipboardManagerEnabled = enabled;
      os.storage.set(StorageKeys.clipboardManagerEnabled, String(enabled));
      showSaved();
    });
  }
}

export function bindDesktopCategory(win, save, settings, showSaved) {
  bindEvent($("#settingsDisableDesktopStretchScroll", win), "change", save);
  bindEvent($("#settingsShowWorkspace", win), "change", save);

  const hideDesktopIconsToggle = $("#settingsHideDesktopIcons", win);
  if (hideDesktopIconsToggle) {
    bindEvent(hideDesktopIconsToggle, "change", () => {
      const hideIcons = hideDesktopIconsToggle.checked;
      settings.hideDesktopIcons = hideIcons;
      os.storage.set(StorageKeys.hideDesktopIcons, String(hideIcons));

      const desktopIcons = $$(".icon.selectable, .folder-icon, .desktop-file-icon");
      if (hideIcons) {
        desktopIcons.forEach((icon) => (icon.style.display = "none"));
      } else {
        desktopIcons.forEach((icon) => (icon.style.display = ""));
      }
      showSaved();
    });
  }

  const handleAlignmentClick = (alignment) => {
    $$(".settings-btn[data-alignment]", win).forEach((btn) => {
      toggleClass(btn, "active", btn.dataset.alignment === alignment);
    });
    save();
  };
  bindEvent($('[data-alignment="left"]', win), "click", () => handleAlignmentClick("left"));
  bindEvent($('[data-alignment="center"]', win), "click", () => handleAlignmentClick("center"));
  bindEvent($('[data-alignment="right"]', win), "click", () => handleAlignmentClick("right"));

  $$(".settings-btn[data-taskbar-pos]", win).forEach((btn) => {
    bindEvent(btn, "click", async () => {
      const pos = btn.dataset.taskbarPos;
      $$(".settings-btn[data-taskbar-pos]", win).forEach((b) => toggleClass(b, "active", b === btn));
      settings.taskbarPosition = pos;
      os.storage.set(StorageKeys.taskbarPosition, pos);
      taskbarPositionManager.setPosition(pos);
    });
  });

  const widthSlider = $("#settingsStartMenuWidth", win);
  const widthValue = $("#settingsStartMenuWidthValue", win);
  if (widthSlider) {
    bindEvent(widthSlider, "input", () => {
      if (widthValue) setText(widthValue, `${getRangeSliderValue("settingsStartMenuWidth", win)}px`);
    });
    bindEvent(widthSlider, "change", save);
  }

  const heightSlider = $("#settingsStartMenuHeight", win);
  const heightValue = $("#settingsStartMenuHeightValue", win);
  if (heightSlider) {
    bindEvent(heightSlider, "input", () => {
      if (heightValue) setText(heightValue, `${getRangeSliderValue("settingsStartMenuHeight", win)}px`);
    });
    bindEvent(heightSlider, "change", save);
  }

  const iconSizeSlider = $("#settingsDesktopIconSize", win);
  const iconSizeValue = $("#settingsDesktopIconSizeValue", win);
  if (iconSizeSlider) {
    bindEvent(iconSizeSlider, "input", () => {
      if (iconSizeValue) setText(iconSizeValue, `${getRangeSliderValue("settingsDesktopIconSize", win)}px`);
    });
    bindEvent(iconSizeSlider, "change", () => {
      const val = parseInt(getRangeSliderValue("settingsDesktopIconSize", win));
      settings.desktopIconSize = val;
      os.storage.set(StorageKeys.desktopIconSize, String(val));
      applyDesktopIconSize(val);
      updateGridConfig(val);
      showSaved();
    });
  }

  const taskbarScaleSlider = $("#settingsTaskbarScale", win);
  const taskbarScaleValue = $("#settingsTaskbarScaleValue", win);
  if (taskbarScaleSlider) {
    bindEvent(taskbarScaleSlider, "input", () => {
      if (taskbarScaleValue) setText(taskbarScaleValue, `${getRangeSliderValue("settingsTaskbarScale", win)}%`);
    });
    bindEvent(taskbarScaleSlider, "change", () => {
      const val = parseInt(getRangeSliderValue("settingsTaskbarScale", win));
      settings.taskbarScale = val;
      os.storage.set(StorageKeys.taskbarScale, String(val));
      applyTaskbarScale(val);
      showSaved();
    });
  }

  const taskbarShowLabelsToggle = $("#settingsTaskbarShowLabels", win);
  if (taskbarShowLabelsToggle) {
    bindEvent(taskbarShowLabelsToggle, "change", () => {
      const enabled = taskbarShowLabelsToggle.checked;
      settings.taskbarShowLabels = enabled;
      os.storage.set(StorageKeys.taskbarShowLabels, String(enabled));
      if (os.window.wm?.taskbarSystem) {
        os.window.wm.taskbarSystem.applyTaskbarLabels();
      }
      showSaved();
    });
  }

  $$(".settings-start-cat-toggle", win).forEach((chk) => {
    bindEvent(chk, "change", save);
  });

  const trayEnabledToggle = $("#settingsTrayEnabled", win);
  if (trayEnabledToggle) {
    bindEvent(trayEnabledToggle, "change", () => {
      const enabled = trayEnabledToggle.checked;
      settings.trayEnabled = enabled;
      os.storage.set(StorageKeys.trayEnabled, String(enabled));
      applyTrayEnabled(enabled);
      showSaved();
    });
  }
  renderTrayAppsList(win, settings);

  const windowSwitcherModeSelect = $("#settingsWindowSwitcherMode", win);
  if (windowSwitcherModeSelect) {
    bindEvent(windowSwitcherModeSelect, "change", () => {
      settings.windowSwitcherMode = getSelectMenuValue("settingsWindowSwitcherMode", win);
      os.storage.set(StorageKeys.windowSwitcherMode, getSelectMenuValue("settingsWindowSwitcherMode", win));
      showSaved();
    });
  }

  const windowSwitcherUISelect = $("#settingsWindowSwitcherUI", win);
  if (windowSwitcherUISelect) {
    bindEvent(windowSwitcherUISelect, "change", () => {
      settings.windowSwitcherUI = getSelectMenuValue("settingsWindowSwitcherUI", win);
      os.storage.set(StorageKeys.windowSwitcherUI, getSelectMenuValue("settingsWindowSwitcherUI", win));
      showSaved();
    });
  }

  const windowSwitcherIncludeMinimizedToggle = $("#settingsWindowSwitcherIncludeMinimized", win);
  if (windowSwitcherIncludeMinimizedToggle) {
    bindEvent(windowSwitcherIncludeMinimizedToggle, "change", () => {
      settings.windowSwitcherIncludeMinimized = windowSwitcherIncludeMinimizedToggle.checked;
      os.storage.set(StorageKeys.windowSwitcherIncludeMinimized, String(windowSwitcherIncludeMinimizedToggle.checked));
      showSaved();
    });
  }

  const dockEnabledToggle = $("#settingsDockEnabled", win);
  if (dockEnabledToggle) {
    bindEvent(dockEnabledToggle, "change", () => {
      const enabled = dockEnabledToggle.checked;
      settings.dockEnabled = enabled;
      os.storage.set(StorageKeys.dockEnabled, String(enabled));
      if (enabled) {
        modeManager.enter(MODES.MAC);
      } else {
        modeManager.exit(MODES.MAC);
      }
      showSaved();
      os.events.emit(BusEvents.SETTINGS_CHANGED, settings);
    });
  }

  $$(".settings-btn[data-dock-pos]", win).forEach((btn) => {
    bindEvent(btn, "click", () => {
      const pos = btn.dataset.dockPos;
      $$(".settings-btn[data-dock-pos]", win).forEach((b) => toggleClass(b, "active", b === btn));
      settings.dockPosition = pos;
      os.storage.set(StorageKeys.dockPosition, pos);
      showSaved();
      os.events.emit(BusEvents.SETTINGS_CHANGED, settings);
    });
  });

  const dockAutoHideToggle = $("#settingsDockAutoHide", win);
  if (dockAutoHideToggle) {
    bindEvent(dockAutoHideToggle, "change", () => {
      settings.dockAutoHide = dockAutoHideToggle.checked;
      os.storage.set(StorageKeys.dockAutoHide, String(dockAutoHideToggle.checked));
      showSaved();
      os.events.emit(BusEvents.SETTINGS_CHANGED, settings);
    });
  }

  const dockMagnificationToggle = $("#settingsDockMagnification", win);
  if (dockMagnificationToggle) {
    bindEvent(dockMagnificationToggle, "change", () => {
      settings.dockMagnification = dockMagnificationToggle.checked;
      os.storage.set(StorageKeys.dockMagnification, String(dockMagnificationToggle.checked));
      showSaved();
      os.events.emit(BusEvents.SETTINGS_CHANGED, settings);
    });
  }

  const magAmountSlider = $("#settingsDockMagnifyAmount", win);
  const magAmountValue = $("#settingsDockMagnifyAmountValue", win);
  if (magAmountSlider) {
    bindEvent(magAmountSlider, "input", () => {
      if (magAmountValue)
        setText(magAmountValue, `${parseFloat(getRangeSliderValue("settingsDockMagnifyAmount", win)).toFixed(1)}x`);
    });
    bindEvent(magAmountSlider, "change", () => {
      const val = parseFloat(getRangeSliderValue("settingsDockMagnifyAmount", win));
      settings.dockMagnifyAmount = val;
      os.storage.set(StorageKeys.dockMagnifyAmount, String(val));
      showSaved();
      os.events.emit(BusEvents.SETTINGS_CHANGED, settings);
    });
  }

  const magRangeSlider = $("#settingsDockMagnifyRange", win);
  const magRangeValue = $("#settingsDockMagnifyRangeValue", win);
  if (magRangeSlider) {
    bindEvent(magRangeSlider, "input", () => {
      if (magRangeValue) setText(magRangeValue, `${parseInt(getRangeSliderValue("settingsDockMagnifyRange", win))}`);
    });
    bindEvent(magRangeSlider, "change", () => {
      const val = parseInt(getRangeSliderValue("settingsDockMagnifyRange", win));
      settings.dockMagnifyRange = val;
      os.storage.set(StorageKeys.dockMagnifyRange, String(val));
      showSaved();
      os.events.emit(BusEvents.SETTINGS_CHANGED, settings);
    });
  }

  const dockIconSizeSlider = $("#settingsDockIconSize", win);
  const dockIconSizeValue = $("#settingsDockIconSizeValue", win);
  if (dockIconSizeSlider) {
    bindEvent(dockIconSizeSlider, "input", () => {
      if (dockIconSizeValue) setText(dockIconSizeValue, `${getRangeSliderValue("settingsDockIconSize", win)}px`);
    });
    bindEvent(dockIconSizeSlider, "change", () => {
      const val = parseInt(getRangeSliderValue("settingsDockIconSize", win));
      settings.dockIconSize = val;
      os.storage.set(StorageKeys.dockIconSize, String(val));
      applyDockIconSize(val);
      showSaved();
      os.events.emit(BusEvents.SETTINGS_CHANGED, settings);
    });
  }

  const dockScaleSlider = $("#settingsDockScale", win);
  const dockScaleValue = $("#settingsDockScaleValue", win);
  if (dockScaleSlider) {
    bindEvent(dockScaleSlider, "input", () => {
      if (dockScaleValue) setText(dockScaleValue, `${getRangeSliderValue("settingsDockScale", win)}%`);
    });
    bindEvent(dockScaleSlider, "change", () => {
      const val = parseInt(getRangeSliderValue("settingsDockScale", win));
      settings.dockScale = val;
      os.storage.set(StorageKeys.dockScale, String(val));
      applyDockScale(val);
      showSaved();
      os.events.emit(BusEvents.SETTINGS_CHANGED, settings);
    });
  }

  const dockAnimSpeedSlider = $("#settingsDockAnimationSpeed", win);
  const dockAnimSpeedValue = $("#settingsDockAnimationSpeedValue", win);
  if (dockAnimSpeedSlider) {
    bindEvent(dockAnimSpeedSlider, "input", () => {
      if (dockAnimSpeedValue)
        setText(
          dockAnimSpeedValue,
          `${parseFloat(getRangeSliderValue("settingsDockAnimationSpeed", win)).toFixed(2)}s`
        );
    });
    bindEvent(dockAnimSpeedSlider, "change", () => {
      const val = parseFloat(getRangeSliderValue("settingsDockAnimationSpeed", win));
      settings.dockAnimationSpeed = val;
      os.storage.set(StorageKeys.dockAnimationSpeed, String(val));
      applyDockAnimationSpeed(val);
      showSaved();
      os.events.emit(BusEvents.SETTINGS_CHANGED, settings);
    });
  }
}

export function bindAppearanceCategory(
  win,
  save,
  settings,
  fs,
  wm,
  showStatus,
  showSaved,
  getCustomColors,
  setCustomColors,
  normalizeCursorDataUrl,
  showCustomColorsDialog
) {
  bindEvent($("#settingsCycleWallpaper", win), "change", save);
  bindEvent($("#settingsSidebarCompact", win), "change", save);

  const resolutionSelect = $("#settingsResolution", win);
  if (resolutionSelect) {
    let previousResolution = settings.virtualResolution || "native";
    bindEvent(resolutionSelect, "change", async () => {
      const newValue = getSelectMenuValue("settingsResolution", win);
      if (newValue === previousResolution) return;

      applyVirtualResolution(newValue, settings.guiScale);
      const label = getResolutionLabel(newValue);

      const confirmed = await showResolutionCountdown(win, label);

      if (confirmed) {
        previousResolution = newValue;
        settings.virtualResolution = newValue;
        os.storage.set(StorageKeys.virtualResolution, newValue);
        showSaved();
      } else {
        setSelectMenuValue("settingsResolution", previousResolution, win);
        applyVirtualResolution(previousResolution, settings.guiScale);
        showStatus(`Reverted to ${getResolutionLabel(previousResolution)}`);
      }
    });
  }

  $$(".settings-btn[data-theme-val]", win).forEach((btn) => {
    bindEvent(btn, "click", () => {
      const theme = btn.dataset.themeVal;
      $$(".settings-btn[data-theme-val]", win).forEach((b) => toggleClass(b, "active", b === btn));
      settings.theme = theme;
      os.storage.set(StorageKeys.theme, theme);
      applyTheme(theme, getCustomColors);
      audioMixer().playSystemSound(SystemAudio.DESKTOP_CHANGE);
      const label = theme.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      showStatus(`Theme: ${label}`);
    });
  });

  const customColorsBtn = $("#settingsCustomColorsBtn", win);
  if (customColorsBtn) {
    bindEvent(customColorsBtn, "click", () => showCustomColorsDialog(win));
  }

  const saveThemeBtn = $("#settingsSaveThemeBtn", win);
  if (saveThemeBtn) {
    bindEvent(saveThemeBtn, "click", async () => {
      const customColors = getCustomColors();
      if (!customColors) {
        os.dialog.alert("Alert", "No custom colors yet. Create one first.");
        return;
      }
      const themeName = await os.dialog.prompt("Prompt", "Name your theme:", "My Theme");
      if (!themeName) return;
      const themeValue = themeName.toLowerCase().replace(/[^a-z0-9-]/g, "-");
      try {
        addCustomTheme({
          value: themeValue,
          label: themeName,
          icon: "fas fa-palette",
          colors: customColors
        });
        os.events.emit(BusEvents.ACHIEVEMENT_TRIGGER, { achievementId: Achievements.ThemeSmith });
        os.dialog.alert("Alert", `Saved "${themeName}"`);
        os.notify.send("Theme Hub", `Saved "${themeName}". Open Theme Hub to remix or publish it.`);
        showSaved();
        const customThemesSection = Array.from($$(".settings-row--stacked", win)).find(
          (row) => row.querySelector(".settings-label-title")?.textContent === "Custom Themes"
        );
        if (customThemesSection) {
          const customThemesGrid = customThemesSection.querySelector("div[style*='grid']");
          if (customThemesGrid) {
            const emptyMessage = customThemesGrid.querySelector("span");
            if (emptyMessage) emptyMessage.remove();
            const newThemeBtn = createElement("button");
            newThemeBtn.className = "settings-btn";
            newThemeBtn.dataset.themeVal = themeValue;
            newThemeBtn.innerHTML = `<i class="fas fa-palette"></i> ${themeName}`;
            bindEvent(newThemeBtn, "click", () => {
              $$(".settings-btn", win).forEach((btn) => btn.classList.remove("active"));
              newThemeBtn.classList.add("active");
              settings.theme = themeValue;
              os.storage.set(StorageKeys.theme, themeValue);
              applyTheme(themeValue, () => getCustomColors());
              showStatus(`Theme: ${themeName}`);
            });
            customThemesGrid.appendChild(newThemeBtn);
          }
        }
      } catch (e) {
        os.dialog.alert("Alert", e.message || "Couldn't save the theme");
      }
    });
  }

  const transparencySlider = $("#settingsWindowTransparency", win);
  const transparencyValue = $("#settingsWindowTransparencyValue", win);
  if (transparencySlider) {
    bindEvent(transparencySlider, "input", () => {
      if (transparencyValue) setText(transparencyValue, `${getRangeSliderValue("settingsWindowTransparency", win)}%`);
    });
    bindEvent(transparencySlider, "change", () => {
      const val = getRangeSliderValue("settingsWindowTransparency", win) / 100;
      settings.windowTransparency = val;
      os.storage.set(StorageKeys.windowTransparency, String(val));
      applyWindowTransparency(val);
      showSaved();
    });
  }

  const transparentUIToggle = $("#settingsTransparentUI", win);
  if (transparentUIToggle) {
    bindEvent(transparentUIToggle, "change", () => {
      const enabled = transparentUIToggle.checked;
      settings.transparentUI = enabled;
      os.storage.set(StorageKeys.transparentUI, String(enabled));
      applyTransparentUI(enabled);
      showSaved();
    });
  }

  $$(".header-style-preview", win).forEach((stylePreview) => {
    bindEvent(stylePreview, "click", () => {
      const headerStyleValue = stylePreview.dataset.headerStyle || "default";
      settings.headerStyle = headerStyleValue;
      os.storage.set(StorageKeys.windowHeaderStyle, headerStyleValue);
      $$(".header-style-preview", win).forEach((preview) =>
        preview.classList.toggle("active", preview === stylePreview)
      );
      bus.emit(BusEvents.SETTINGS_CHANGED, {});
      showSaved();
    });
  });

  const guiScaleSlider = $("#settingsGuiScale", win);
  const guiScaleValue = $("#settingsGuiScaleValue", win);
  if (guiScaleSlider) {
    bindEvent(guiScaleSlider, "input", () => {
      if (guiScaleValue) setText(guiScaleValue, `${getRangeSliderValue("settingsGuiScale", win)}%`);
    });
    bindEvent(guiScaleSlider, "change", () => {
      const val = getRangeSliderValue("settingsGuiScale", win);
      settings.guiScale = val;
      os.storage.set(StorageKeys.guiScale, String(val));
      applyGuiScale(val);
      applyVirtualResolution(settings.virtualResolution || "native", val);
      showSaved();
    });
  }

  const fontSizeSlider = $("#settingsFontSize", win);
  const fontSizeValue = $("#settingsFontSizeValue", win);
  if (fontSizeSlider) {
    bindEvent(fontSizeSlider, "input", () => {
      if (fontSizeValue) setText(fontSizeValue, `${getRangeSliderValue("settingsFontSize", win)}%`);
    });
    bindEvent(fontSizeSlider, "change", () => {
      const val = getRangeSliderValue("settingsFontSize", win);
      settings.fontSize = val;
      os.storage.set(StorageKeys.fontSize, String(val));
      applyFontSize(val);
      showSaved();
    });
  }

  const uiDensityButtons = $$(".settings-btn[data-ui-density]", win);
  uiDensityButtons.forEach((btn) => {
    bindEvent(btn, "click", () => {
      const density = btn.dataset.uiDensity;
      settings.uiDensity = density;
      os.storage.set(StorageKeys.uiDensity, density);
      applyUiDensity(density);
      uiDensityButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      showSaved();
    });
  });

  const openAnimSelect = $("#settingsOpenAnimation", win);
  if (openAnimSelect) {
    bindEvent(openAnimSelect, "change", () => {
      os.storage.set(StorageKeys.windowOpenAnimation, getSelectMenuValue("settingsOpenAnimation", win));
      showSaved();
    });
  }

  const closeAnimSelect = $("#settingsCloseAnimation", win);
  if (closeAnimSelect) {
    bindEvent(closeAnimSelect, "change", () => {
      os.storage.set(StorageKeys.windowCloseAnimation, getSelectMenuValue("settingsCloseAnimation", win));
      showSaved();
    });
  }

  const minimizeAnimSelect = $("#settingsMinimizeAnimation", win);
  if (minimizeAnimSelect) {
    bindEvent(minimizeAnimSelect, "change", () => {
      os.storage.set(StorageKeys.windowMinimizeAnimation, getSelectMenuValue("settingsMinimizeAnimation", win));
      showSaved();
    });
  }

  const restoreAnimSelect = $("#settingsRestoreAnimation", win);
  if (restoreAnimSelect) {
    bindEvent(restoreAnimSelect, "change", () => {
      os.storage.set(StorageKeys.windowRestoreAnimation, getSelectMenuValue("settingsRestoreAnimation", win));
      showSaved();
    });
  }

  const animationSpeedSelect = $("#settingsAnimationSpeed", win);
  if (animationSpeedSelect) {
    bindEvent(animationSpeedSelect, "change", () => {
      os.storage.set(StorageKeys.windowAnimationSpeed, getSelectMenuValue("settingsAnimationSpeed", win));
      showSaved();
    });
  }

  const clickBubbleToggle = $("#settingsClickBubble", win);
  if (clickBubbleToggle) {
    bindEvent(clickBubbleToggle, "change", () => {
      applyAnimationSettings({ clickBubble: clickBubbleToggle.checked });
      showSaved();
    });
  }

  const wobblyWindowsToggle = $("#settingsWobblyWindows", win);
  if (wobblyWindowsToggle) {
    bindEvent(wobblyWindowsToggle, "change", () => {
      os.storage.set(StorageKeys.wobblyWindows, String(wobblyWindowsToggle.checked));
      const subsection = win.querySelector(".settings-wobble-subsection");
      if (subsection) {
        subsection.style.display = wobblyWindowsToggle.checked ? "block" : "none";
      }
      showSaved();
    });
  }

  const wobbleSpringKSlider = $("#settingsWobbleSpringK", win);
  if (wobbleSpringKSlider) {
    bindEvent(wobbleSpringKSlider, "input", () => {
      const value = getRangeSliderValue("settingsWobbleSpringK", win);
      const valueDisplay = $("#settingsWobbleSpringKValue", win);
      if (valueDisplay) valueDisplay.textContent = value;
    });
    bindEvent(wobbleSpringKSlider, "change", () => {
      os.storage.set(StorageKeys.wobbleSpringK, getRangeSliderValue("settingsWobbleSpringK", win));
      showSaved();
    });
  }

  const wobbleDampingSlider = $("#settingsWobbleDamping", win);
  if (wobbleDampingSlider) {
    bindEvent(wobbleDampingSlider, "input", () => {
      const value = getRangeSliderValue("settingsWobbleDamping", win);
      const valueDisplay = $("#settingsWobbleDampingValue", win);
      if (valueDisplay) valueDisplay.textContent = value;
    });
    bindEvent(wobbleDampingSlider, "change", () => {
      os.storage.set(StorageKeys.wobbleDamping, getRangeSliderValue("settingsWobbleDamping", win));
      showSaved();
    });
  }

  const wobbleMassSlider = $("#settingsWobbleMass", win);
  if (wobbleMassSlider) {
    bindEvent(wobbleMassSlider, "input", () => {
      const value = getRangeSliderValue("settingsWobbleMass", win);
      const valueDisplay = $("#settingsWobbleMassValue", win);
      if (valueDisplay) valueDisplay.textContent = value;
    });
    bindEvent(wobbleMassSlider, "change", () => {
      os.storage.set(StorageKeys.wobbleMass, getRangeSliderValue("settingsWobbleMass", win));
      showSaved();
    });
  }

  const wobbleDragLagSlider = $("#settingsWobbleDragLag", win);
  if (wobbleDragLagSlider) {
    bindEvent(wobbleDragLagSlider, "input", () => {
      const value = getRangeSliderValue("settingsWobbleDragLag", win);
      const valueDisplay = $("#settingsWobbleDragLagValue", win);
      if (valueDisplay) valueDisplay.textContent = value;
    });
    bindEvent(wobbleDragLagSlider, "change", () => {
      os.storage.set(StorageKeys.wobbleDragLag, getRangeSliderValue("settingsWobbleDragLag", win));
      showSaved();
    });
  }

  const wobbleCoupleKSlider = $("#settingsWobbleCoupleK", win);
  if (wobbleCoupleKSlider) {
    bindEvent(wobbleCoupleKSlider, "input", () => {
      const value = getRangeSliderValue("settingsWobbleCoupleK", win);
      const valueDisplay = $("#settingsWobbleCoupleKValue", win);
      if (valueDisplay) valueDisplay.textContent = value;
    });
    bindEvent(wobbleCoupleKSlider, "change", () => {
      os.storage.set(StorageKeys.wobbleCoupleK, getRangeSliderValue("settingsWobbleCoupleK", win));
      showSaved();
    });
  }

  const openBtn = $("#settingsOpenWallpaperEngine", win);
  if (openBtn) {
    bindEvent(openBtn, "click", () => {
      os.app.launch("wallpaperEngineApp");
    });
  }

  mountWallpaperEngine(win);

  const themeHubBtn = $("#settingsOpenThemeHub", win);
  if (themeHubBtn) {
    bindEvent(themeHubBtn, "click", () => {
      os.app.launch("themeHubApp");
    });
  }

  const createThemeBtn = $("#settingsOpenThemeHubCreate", win);
  if (createThemeBtn) {
    bindEvent(createThemeBtn, "click", () => {
      os.app.launch("themeHubApp", { intent: "create" });
    });
  }

  bindCursorControls(win, settings, showSaved, normalizeCursorDataUrl);
}

function bindCursorControls(win, settings, showSaved, normalizeCursorDataUrl) {
  const cursorUploadBtn = $("#settingsCursorUploadBtn", win);
  const cursorClearBtn = $("#settingsCursorClearBtn", win);
  const cursorStatus = $("#settingsCursorStatus", win);
  const cursorSizeSlider = $("#settingsCursorSize", win);
  const cursorSizeValue = $("#settingsCursorSizeValue", win);

  const setCursorDisabled = (disabled) => {
    if (cursorSizeSlider) {
      toggleClass(cursorSizeSlider, "range-slider--disabled", disabled);
    }
  };

  const setCursor = (dataUrl, originalDataUrl = null) => {
    const cursorDataUrl = typeof dataUrl === "string" ? dataUrl : "";
    const cursorOriginalDataUrl =
      originalDataUrl === null
        ? settings.cursorOriginalDataUrl
        : typeof originalDataUrl === "string"
          ? originalDataUrl
          : "";

    if (cursorDataUrl) os.storage.set(StorageKeys.cursorKey, cursorDataUrl);
    else os.storage.remove(StorageKeys.cursorKey);

    if (cursorOriginalDataUrl) os.storage.set(StorageKeys.cursorOriginalKey, cursorOriginalDataUrl);
    else os.storage.remove(StorageKeys.cursorOriginalKey);

    settings.cursorDataUrl = cursorDataUrl;
    settings.cursorOriginalDataUrl = cursorOriginalDataUrl;

    applyCursor(cursorDataUrl);

    if (cursorClearBtn) cursorClearBtn.disabled = !cursorDataUrl;
    if (cursorStatus) setText(cursorStatus, cursorDataUrl ? "Custom cursor enabled" : "Default cursor");
    setCursorDisabled(!cursorDataUrl);
    showSaved();
  };

  const setCursorSize = async (size) => {
    const cursorSize = Number(size);
    if (!Number.isFinite(cursorSize) || cursorSize < 16 || cursorSize > 128) return;
    settings.cursorSize = cursorSize;
    try {
      os.storage.set(StorageKeys.cursorSizeKey, String(cursorSize));
    } catch {}
    if (cursorSizeValue) setText(cursorSizeValue, `${cursorSize}px`);

    const original = settings.cursorOriginalDataUrl;
    if (!original) return;
    try {
      const normalized = await normalizeCursorDataUrl(original, { maxSize: cursorSize });
      setCursor(normalized, original);
    } catch (e) {
      console.error("Failed to resize cursor:", e);
    }
  };

  if (cursorUploadBtn) {
    bindEvent(cursorUploadBtn, "click", () => {
      const input = createElement("input", {
        attributes: {
          type: "file",
          accept: "image/png,image/jpeg,image/gif,image/webp,image/svg+xml,.png,.jpg,.jpeg,.gif,.webp,.svg"
        },
        styles: { display: "none" }
      });
      document.body.appendChild(input);

      bindEvent(input, "change", async () => {
        const file = input.files?.[0];
        input.remove();
        if (!file) return;

        try {
          if (file.size > 2 * 1024 * 1024) {
            os.dialog.alert("Alert", "That cursor image is too big. Keep it under 2MB.");
            return;
          }
          const dataUrl = await new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result || ""));
            r.onerror = () => reject(new Error("Failed to read file"));
            r.readAsDataURL(file);
          });

          if (!dataUrl.startsWith("data:")) throw new Error("Invalid cursor file.");
          const normalized = await normalizeCursorDataUrl(dataUrl, { maxSize: settings.cursorSize || 32 });
          setCursor(normalized, dataUrl);
        } catch (e) {
          console.error("Cursor upload failed:", e);
          os.dialog.alert("Alert", "Couldn't set that cursor.");
        }
      });

      input.click();
    });
  }

  if (cursorClearBtn) {
    bindEvent(cursorClearBtn, "click", () => {
      try {
        os.storage.remove(StorageKeys.cursorSizeKey);
      } catch {}
      setRangeSliderValue("settingsCursorSize", 32, win);
      if (cursorSizeValue) setText(cursorSizeValue, "32px");
      settings.cursorSize = 32;
      setCursor("", "");
    });
  }

  if (cursorSizeSlider) {
    bindEvent(cursorSizeSlider, "input", () => {
      if (cursorSizeValue) setText(cursorSizeValue, `${getRangeSliderValue("settingsCursorSize", win)}px`);
    });
    bindEvent(cursorSizeSlider, "change", () => setCursorSize(getRangeSliderValue("settingsCursorSize", win)));
  }

  const mikuCursorToggle = $("#settingsMikuCursor", win);
  if (mikuCursorToggle) {
    bindEvent(mikuCursorToggle, "change", () => {
      const enabled = mikuCursorToggle.checked;
      settings.mikuCursor = enabled;
      os.storage.set(StorageKeys.mikuCursor, String(enabled));
      applyMikuCursor(enabled);
      showSaved();
    });
  }
}

export function bindDataCategory(win, save, settings, fs, showStatus, showSaved) {
  bindEvent($("#btnExportData", win), "click", () => exportData(fs, showStatus));
  bindEvent($("#btnImportData", win), "click", () => importData(fs, showStatus));
  bindEvent($("#btnDeleteAllData", win), "click", () => deleteAllData());

  const downloadPageBtn = $("#settingsDownloadPageBtn", win);

  if (downloadPageBtn) {
    bindEvent(downloadPageBtn, "click", async () => {
      const u = "Reeyuki";
      const r = "YukiOsSingleHtml";
      const b = "main";
      const p = "index.html";
      const f = "";

      const gitMirrors = [
        `https://cdn.jsdelivr.net/gh/${u}/${r}@${b}/${p}${f}`,
        `https://quantil.jsdelivr.net/gh/${u}/${r}@${b}/${p}${f}`,
        `https://originfastly.jsdelivr.net/gh/${u}/${r}@${b}/${p}${f}`,
        `https://gcore.jsdelivr.net/gh/${u}/${r}@${b}/${p}${f}`,
        `https://esm.sh/gh/${u}/${r}@${b}/${p}${f}`,
        `https://cdn.statically.io/gh/${u}/${r}@${b}/${p}${f}`,
        `https://cdn.staticdelivr.com/gh/${u}/${r}/${b}/${p}${f}`
      ];

      let htmlContent = null;

      for (const url of gitMirrors) {
        try {
          const res = await fetch(url + "?v=" + Date.now());
          if (res.ok) {
            htmlContent = await res.text();
            break;
          }
        } catch (e) {}
      }

      if (!htmlContent) {
        console.error("All sources failed.");
        showStatus("Download failed");
        return;
      }

      try {
        const blob = new Blob([htmlContent], { type: "text/html" });
        const downloadUrl = URL.createObjectURL(blob);

        const link = createElement("a", {
          attributes: { href: downloadUrl, download: "yukios.html" }
        });

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(downloadUrl);
        showStatus("Download started");
      } catch (error) {
        console.error("Download failed:", error);
        showStatus("Download failed");
      }
    });
  }

  bindEvent($("#btnResetSaved", win), "click", () => {
    $("#settingsWeather", win).checked = settings.weather;
    $("#settingsCycleWallpaper", win).checked = settings.cycleWallpaper;
    $("#settingsSidebarCompact", win).checked = settings.sidebarCompact;
    $("#settingsClippy", win).checked = settings.clippy;
    $("#settingsAchievements", win).checked = !settings.achievementsDisabled;
    $("#settingsAnalytics", win).checked = !settings.analyticsDisabled;
    $("#settingsAds", win).checked = !settings.adsDisabled;
    const stretchToggle = $("#settingsDisableDesktopStretchScroll", win);
    if (stretchToggle) stretchToggle.checked = !!settings.disableDesktopStretchScroll;
    const workspaceToggle = $("#settingsShowWorkspace", win);
    if (workspaceToggle) workspaceToggle.checked = !!settings.showWorkspace;
    const bootToggle = $("#settingsDisableBootScreen", win);
    if (bootToggle) bootToggle.checked = !!settings.disableBootScreen;
    $$(".settings-btn[data-performance-val]", win).forEach((btn) => {
      toggleClass(btn, "active", btn.dataset.perfVal === settings.performanceMode);
    });
    showStatus("Reset to saved values");
  });

  bindEvent($("#btnResetToggles", win), "click", async () => {
    const confirmed = await os.dialog.confirm("Confirm", "Reset all toggles?");
    if (!confirmed) return;

    $("#settingsWeather", win).checked = true;
    $("#settingsCycleWallpaper", win).checked = true;
    $("#settingsSidebarCompact", win).checked = true;
    $("#settingsClippy", win).checked = false;
    $("#settingsAchievements", win).checked = true;
    $("#settingsAnalytics", win).checked = true;
    $("#settingsAds", win).checked = true;
    const stretchToggle = $("#settingsDisableDesktopStretchScroll", win);
    if (stretchToggle) stretchToggle.checked = false;
    const workspaceToggle = $("#settingsShowWorkspace", win);
    if (workspaceToggle) workspaceToggle.checked = true;
    const bootToggle = $("#settingsDisableBootScreen", win);
    if (bootToggle) bootToggle.checked = false;
    $$(".settings-btn[data-performance-val]", win).forEach((btn) => {
      toggleClass(btn, "active", btn.dataset.perfVal === "high");
    });
    save();
    showStatus("Toggles reset");
  });
}

export function bindNetworkCategory(win, save, settings, showSaved) {
  bindEvent($("#settingsCdnMirror", win), "change", save);

  const wispServerSelect = $("#settingsWispServer", win);
  const customWispRow = $("#settingsCustomWispRow", win);
  const customWispUrl = $("#settingsCustomWispUrl", win);

  if (wispServerSelect && customWispRow && customWispUrl) {
    bindEvent(wispServerSelect, "change", () => {
      const value = getSelectMenuValue("settingsWispServer", win);
      if (value === "custom") {
        customWispRow.classList.remove("hidden");
        customWispUrl.focus();
      } else {
        customWispRow.classList.add("hidden");
        settings.wispServer = value;
        os.storage.set(StorageKeys.wispServer, value);
        showSaved();
      }
    });

    bindEvent(customWispUrl, "change", () => {
      const url = customWispUrl.value.trim();
      if (url) {
        settings.wispServer = url;
        os.storage.set(StorageKeys.wispServer, url);
        showSaved();
      }
    });
  }

  const transportContainer = $("#settingsBrowserTransport", win);
  if (transportContainer) {
    transportContainer.querySelectorAll("[data-transport]").forEach(function (el) {
      bindEvent(el, "click", function () {
        const key = el.dataset.transport;
        transportContainer.querySelectorAll("[data-transport]").forEach(function (p) {
          p.classList.remove("active");
        });
        el.classList.add("active");
        settings.browserTransport = key;
        os.storage.set(StorageKeys.browserTransport, key);
        showSaved();
      });
    });
  }
}

export function bindAudioCategory(win, settings, showSaved) {
  const soundToggle = $("#settingsSoundEnabled", win);
  const volumeSlider = $("#settingsMasterVolume", win);
  const volumeValue = $("#settingsMasterVolumeValue", win);
  const systemAudioToggle = $("#settingsSystemAudioEnabled", win);
  const systemVolumeSlider = $("#settingsSystemVolume", win);
  const systemVolumeValue = $("#settingsSystemVolumeValue", win);

  if (soundToggle) {
    bindEvent(soundToggle, "change", () => {
      const enabled = soundToggle.checked;
      settings.soundEnabled = enabled;
      os.storage.set(StorageKeys.soundEnabled, String(enabled));
      if (volumeSlider) toggleClass(volumeSlider, "range-slider--disabled", !enabled);
      audioMixer().setMaster(enabled ? settings.masterVolume : 0);
      showSaved();
    });
  }

  if (volumeSlider) {
    bindEvent(volumeSlider, "input", () => {
      if (volumeValue) setText(volumeValue, `${getRangeSliderValue("settingsMasterVolume", win)}%`);
    });
    bindEvent(volumeSlider, "change", () => {
      const val = getRangeSliderValue("settingsMasterVolume", win) / 100;
      settings.masterVolume = val;
      os.storage.set(StorageKeys.masterVolume, String(val));
      if (settings.soundEnabled) audioMixer().setMaster(val);
      showSaved();
    });
  }

  if (systemAudioToggle) {
    bindEvent(systemAudioToggle, "change", () => {
      const enabled = systemAudioToggle.checked;
      settings.systemAudioEnabled = enabled;
      audioMixer().systemAudioEnabled = enabled;
      os.storage.set(StorageKeys.systemAudioEnabled, String(enabled));
      if (systemVolumeSlider) toggleClass(systemVolumeSlider, "range-slider--disabled", !enabled);
      showSaved();
    });
  }

  if (systemVolumeSlider) {
    bindEvent(systemVolumeSlider, "input", () => {
      if (systemVolumeValue) setText(systemVolumeValue, `${getRangeSliderValue("settingsSystemVolume", win)}%`);
    });
    bindEvent(systemVolumeSlider, "change", () => {
      const val = getRangeSliderValue("settingsSystemVolume", win) / 100;
      settings.systemVolume = val;
      audioMixer().systemVolume = val;
      os.storage.set(StorageKeys.systemVolume, String(val));
      showSaved();
    });
  }
}

export function renderTrayAppsList(win, settings) {
  const trayAppsList = $("#trayAppsList", win);
  if (!trayAppsList) return;

  const trayItems = os.tray.getTrayItems();
  if (trayItems.length === 0) {
    setHTML(
      trayAppsList,
      `<div style="padding: 12px; color: rgba(255,255,255,0.5); font-size: 13px; text-align: center;">No tray apps yet</div>`
    );
    return;
  }

  setHTML(trayAppsList, "");
  trayItems.forEach(({ winId, label, icon }) => {
    const row = createElement("div", {
      className: "settings-grid-toggle",
      styles: {
        padding: "8px 12px",
        borderRadius: "6px",
        background: "rgba(255,255,255,0.03)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "6px"
      }
    });

    const isUrl = typeof icon === "string" && /^(https?|data:|\/|.*\.(webp|png|jpg|jpeg|gif|svg))/.test(icon);
    const isFontAwesome = typeof icon === "string" && /^(fa-|fas|fab|far|fa )/.test(icon);

    let iconHtml = "";
    if (isUrl) iconHtml = `<img src="${icon}" alt="${label}" style="width:16px;height:16px;margin-right:8px;"/>`;
    else if (isFontAwesome) iconHtml = `<i class="${icon}" style="margin-right:8px;"></i>`;
    else iconHtml = `<span style="font-size:12px;margin-right:8px;">${icon}</span>`;

    const isVisible = settings.trayAppVisibility[winId] !== false;
    setHTML(
      row,
      `
      <div style="display:flex;align-items:center;">${iconHtml}<span style="font-size:13px;color:rgba(255,255,255,0.9);">${label}</span></div>
      <label class="settings-toggle">
        <input type="checkbox" class="tray-app-toggle" data-win-id="${winId}" ${isVisible ? "checked" : ""}/>
        <span class="settings-track"><span class="settings-thumb"></span></span>
      </label>
    `
    );
    trayAppsList.appendChild(row);
  });

  $$(".tray-app-toggle", trayAppsList).forEach((toggle) => {
    bindEvent(toggle, "change", () => {
      const wId = toggle.dataset.winId;
      const visible = toggle.checked;
      settings.trayAppVisibility[wId] = visible;
      os.storage.set(StorageKeys.trayAppVisibility, settings.trayAppVisibility);
      os.tray.updateItemVisibility(wId, visible);
    });
  });
}

function showResolutionCountdown(win, resolutionLabel) {
  return new Promise((resolve) => {
    const overlay = createElement("div", {
      className: "explorer-confirmation-overlay",
      styles: {
        zIndex: "999999",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(8px)"
      }
    });

    let seconds = 4;
    let timerId = null;
    let resolved = false;

    function finish(confirmed) {
      if (resolved) return;
      resolved = true;
      clearInterval(timerId);
      overlay.style.opacity = "0";
      overlay.style.transition = "opacity 0.3s";
      setTimeout(() => overlay.remove(), 300);
      resolve(confirmed);
    }

    const dialog = createElement("div", {
      className: "overlay-dialog",
      styles: { textAlign: "center", minWidth: "340px" }
    });

    setHTML(
      dialog,
      `
      <div class="conflict-header" style="justify-content:center;">
        <i class="fas fa-display conflict-icon" style="font-size:28px;"></i>
        <span class="conflict-title">Keep these display settings?</span>
      </div>
      <div class="conflict-message" style="font-size:15px;margin:12px 0;">
        ${resolutionLabel}
      </div>
      <div style="font-size:48px;font-weight:700;color:var(--brand);margin:16px 0;font-variant-numeric:tabular-nums;" id="res-countdown">4</div>
      <div style="font-size:13px;color:var(--text-secondary);margin-bottom:20px;">
        Reverting in <span id="res-countdown-text">4</span> seconds...
      </div>
      <div class="conflict-actions" style="justify-content:center;">
        <button class="conflict-btn conflict-btn-keep" id="res-keep-btn" style="min-width:120px;">
          <i class="fas fa-check conflict-btn-icon"></i> Keep
        </button>
      </div>
    `
    );

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const countdownEl = dialog.querySelector("#res-countdown");
    const countdownText = dialog.querySelector("#res-countdown-text");
    const keepBtn = dialog.querySelector("#res-keep-btn");

    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
    });

    timerId = setInterval(() => {
      seconds -= 1;
      if (countdownEl) countdownEl.textContent = String(seconds);
      if (countdownText) countdownText.textContent = String(seconds);
      if (seconds <= 0) {
        finish(false);
      }
    }, 1000);

    bindEvent(keepBtn, "click", () => finish(true));

    bindEvent(overlay, "click", (e) => {
      if (e.target === overlay) finish(false);
    });
  });
}

export function bindQuickSettings(win, settings, notificationCenter, showSaved) {
  const ANIM_STEPS = 11;
  const ANIM_DEFAULT_IDX = 5;
  const ANIM_SLOW = 3.0;
  const ANIM_DEFAULT = 1.0;
  const ANIM_FAST = 0.05;
  const speedFromIdx = (idx) => {
    if (idx <= ANIM_DEFAULT_IDX) return ANIM_SLOW - (idx / ANIM_DEFAULT_IDX) * (ANIM_SLOW - ANIM_DEFAULT);
    return ANIM_DEFAULT - ((idx - ANIM_DEFAULT_IDX) / (ANIM_STEPS - 1 - ANIM_DEFAULT_IDX)) * (ANIM_DEFAULT - ANIM_FAST);
  };
  const animSlider = $("#quickAnimationSpeed", win);
  if (animSlider) {
    bindEvent(animSlider, "change", () => {
      const raw = Number(getRangeSliderValue("quickAnimationSpeed", win));
      const idx = Number.isFinite(raw) ? raw : ANIM_DEFAULT_IDX;
      const val = speedFromIdx(idx);
      os.storage.set(StorageKeys.windowAnimationSpeed, val);
      applyAnimationSettings({ animationSpeed: val });
      showSaved?.();
    });
  }

  const dndToggle = $("#settingsQuickDND", win);
  if (dndToggle) {
    bindEvent(dndToggle, "change", () => {
      const enabled = dndToggle.checked;
      settings.dnd = enabled;
      os.storage.set(StorageKeys.dndKey, enabled ? "1" : "0");
      notificationCenter?.setDoNotDisturb(enabled);
      const other = $("#settingsDND", win);
      if (other) other.checked = enabled;
    });
  }

  const soundToggle = $("#settingsQuickSound", win);
  if (soundToggle) {
    bindEvent(soundToggle, "change", () => {
      const enabled = soundToggle.checked;
      settings.soundEnabled = enabled;
      os.storage.set(StorageKeys.soundEnabled, String(enabled));
      applySound(enabled, settings.masterVolume);
      const other = $("#settingsSoundEnabled", win);
      if (other) other.checked = enabled;
    });
  }

  $$(".quick-link-btn, .quick-more-btn", win).forEach((btn) => {
    bindEvent(btn, "click", () => {
      const launch = btn.dataset.launch;
      if (launch) {
        if (launch === "defaultApps") {
          const navItem = win.querySelector('.yuki-settings-nav li[data-target="default-applications"]');
          if (navItem) {
            navItem.click();
            return;
          }
        }
        os.app.launch(launch).catch(() => {});
        return;
      }
      const navItem = win.querySelector(
        `.yuki-settings-nav li[data-target="${btn.dataset.target}"]${btn.dataset.scroll ? `[data-scroll="${btn.dataset.scroll}"]` : ":not([data-scroll])"}`
      );
      if (navItem) {
        navItem.click();
      } else {
        const target = win.querySelector(`#${btn.dataset.target}`);
        if (target) {
          win.querySelectorAll(".settings-category-pane").forEach((p) => p.classList.remove("active"));
          target.classList.add("active");
        }
      }
    });
  });

  const resetBtn = $("#settingsQuickReset", win);
  if (resetBtn) {
    bindEvent(resetBtn, "click", () => {
      const defaultTheme = "dark";
      const defaultAnim = 1.0;
      os.storage.set(StorageKeys.theme, defaultTheme);
      applyTheme(defaultTheme, () => getStoredCustomColors());
      os.storage.set(StorageKeys.windowAnimationSpeed, defaultAnim);
      applyAnimationSettings({ animationSpeed: defaultAnim });
      os.storage.set(StorageKeys.dndKey, "0");
      notificationCenter?.setDoNotDisturb(false);
      os.storage.set(StorageKeys.soundEnabled, "true");
      applySound(true, settings.masterVolume);

      $$(".settings-btn[data-theme-val]", win).forEach((b) =>
        toggleClass(b, "active", b.dataset.themeVal === defaultTheme)
      );
      if (animSlider) {
        const normalIdx = ANIM_DEFAULT_IDX;
        animSlider.dataset.value = String(normalIdx);
        const fill = $(".range-slider__fill", animSlider);
        if (fill) fill.style.width = `${(normalIdx / (ANIM_STEPS - 1)) * 100}%`;
        const thumb = $(".range-slider__thumb", animSlider);
        if (thumb) thumb.style.left = `${(normalIdx / (ANIM_STEPS - 1)) * 100}%`;
      }
      const dndEl = $("#settingsQuickDND", win);
      if (dndEl) dndEl.checked = false;
      const sndEl = $("#settingsQuickSound", win);
      if (sndEl) sndEl.checked = true;
      const otherDnd = $("#settingsDND", win);
      if (otherDnd) otherDnd.checked = false;
      const otherSnd = $("#settingsSoundEnabled", win);
      if (otherSnd) otherSnd.checked = true;
      showSaved?.();
    });
  }
}

export function bindAutostartCategory(win) {
  const listEl = $("#autostart-list", win);
  const searchEl = $("#autostart-search", win);
  if (!listEl) return;

  const state = { list: loadStartupApps(), filter: "" };
  renderStartupAppList(listEl, state);

  if (searchEl) {
    bindEvent(searchEl, "input", (e) => {
      state.filter = e.target.value.toLowerCase();
      renderStartupAppList(listEl, state);
    });
  }
}
