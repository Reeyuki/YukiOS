import { StorageKeys } from "../StorageKeys.js";
import { trayManager } from "../tray.js";
import { toggleHideGames, toggleHideSystemApps } from "../desktopui.js";
import { audioMixer, SystemAudio } from "../audioMixer.js";
import { customAlert, customConfirm } from "../shared/dialogs.js";
import { renderWallpapersPage } from "../wallpapers.js";
import { applyTrayEnabled } from "./settingsApply.js";
import {
  applyTheme,
  applyWindowTransparency,
  applyTransparentUI,
  applyGuiScale,
  applyFontSize,
  applyCursor,
  applyMikuCursor
} from "./settingsApply.js";
import { exportData, importData, deleteAllData } from "./settingsData.js";

export function bindNavigation(win) {
  const layout = win.querySelector(".yuki-settings-layout");
  const navItems = win.querySelectorAll(".yuki-settings-nav li");
  const panes = win.querySelectorAll(".settings-category-pane");
  const searchInput = win.querySelector("#settingsSearch");

  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      searchInput.value = "";
      searchInput.dispatchEvent(new Event("input"));

      navItems.forEach((n) => n.classList.remove("active"));
      panes.forEach((p) => p.classList.remove("active"));
      item.classList.add("active");
      win.querySelector("#" + item.dataset.target).classList.add("active");
    });
  });

  searchInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();

    if (!query) {
      layout.classList.remove("is-searching");
      win.querySelectorAll(".settings-row").forEach((row) => row.classList.remove("hidden-by-search"));
      panes.forEach((p) => {
        p.classList.remove("active");
        p.style.display = "";
        p.querySelectorAll(".settings-card").forEach((card) => {
          card.style.display = "";
        });
      });
      const activeNav = win.querySelector(".yuki-settings-nav li.active");
      if (activeNav) win.querySelector("#" + activeNav.dataset.target).classList.add("active");
    } else {
      layout.classList.add("is-searching");
      win.querySelectorAll(".settings-row").forEach((row) => {
        const title = row.querySelector(".settings-label-title")?.textContent.toLowerCase() || "";
        const desc = row.querySelector(".settings-label-desc")?.textContent.toLowerCase() || "";
        row.classList.toggle("hidden-by-search", !(title.includes(query) || desc.includes(query)));
      });

      panes.forEach((pane) => {
        let paneHasVisibleRows = false;
        pane.querySelectorAll(".settings-card").forEach((card) => {
          const visible = card.querySelectorAll(".settings-row:not(.hidden-by-search)");
          card.style.display = visible.length > 0 ? "" : "none";
          if (visible.length > 0) paneHasVisibleRows = true;
        });

        const standaloneRows = pane.querySelectorAll(".settings-category-pane > .settings-row:not(.hidden-by-search)");
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
  });
}

export function bindSystemCategory(win, save, settings, notificationCenter, showSaved) {
  win.querySelector("#settingsWeather")?.addEventListener("change", save);
  win.querySelector("#settingsMacControls")?.addEventListener("change", save);
  win.querySelector("#settingsClippy")?.addEventListener("change", save);
  win.querySelector("#settingsAchievements")?.addEventListener("change", save);
  win.querySelector("#settingsAnalytics")?.addEventListener("change", save);
  win.querySelector("#settingsAds")?.addEventListener("change", save);
  win.querySelector("#settingsDisableBootScreen")?.addEventListener("change", save);
  win.querySelector("#settingsWindowSessionPersistence")?.addEventListener("change", save);

  win.querySelectorAll(".settings-btn[data-turbo-val]").forEach((btn) => {
    btn.addEventListener("click", () => {
      win.querySelectorAll(".settings-btn[data-turbo-val]").forEach((b) => b.classList.toggle("active", b === btn));
      save();
    });
  });

  const dndToggle = win.querySelector("#settingsDND");
  if (dndToggle) {
    dndToggle.addEventListener("change", () => {
      const enabled = dndToggle.checked;
      settings.dnd = enabled;
      localStorage.setItem(StorageKeys.dndKey, enabled ? "1" : "0");
      notificationCenter?.setDoNotDisturb(enabled);
    });
  }

  win.querySelector("#settingsNotificationsEnabled")?.addEventListener("change", save);
  win.querySelector("#settingsNotificationsRemoveTimeout")?.addEventListener("change", save);
  win.querySelector("#settingsNotificationsPopAnimation")?.addEventListener("change", save);
  win.querySelector("#settingsNotificationsOverFullscreen")?.addEventListener("change", save);
  win.querySelector("#settingsNotificationsPosition")?.addEventListener("change", save);

  const durationInput = win.querySelector("#settingsNotificationsDuration");
  const durationVal = win.querySelector("#settingsNotificationsDurationVal");
  if (durationInput) {
    durationInput.addEventListener("input", () => {
      if (durationVal) durationVal.textContent = `${durationInput.value}s`;
    });
    durationInput.addEventListener("change", save);
  }

  const clipboardManagerToggle = win.querySelector("#settingsClipboardManager");
  if (clipboardManagerToggle) {
    clipboardManagerToggle.addEventListener("change", () => {
      const enabled = clipboardManagerToggle.checked;
      settings.clipboardManagerEnabled = enabled;
      localStorage.setItem(StorageKeys.clipboardManagerEnabled, String(enabled));
      showSaved();
    });
  }
}

export function bindDesktopCategory(win, save, settings, showSaved) {
  win.querySelector("#settingsDisableDesktopStretchScroll")?.addEventListener("change", save);
  win.querySelector("#settingsShowWorkspace")?.addEventListener("change", save);

  const handleAlignmentClick = (alignment) => {
    win.querySelectorAll(".settings-btn[data-alignment]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.alignment === alignment);
    });
    save();
  };
  win.querySelector('[data-alignment="left"]')?.addEventListener("click", () => handleAlignmentClick("left"));
  win.querySelector('[data-alignment="center"]')?.addEventListener("click", () => handleAlignmentClick("center"));
  win.querySelector('[data-alignment="right"]')?.addEventListener("click", () => handleAlignmentClick("right"));

  win.querySelectorAll(".settings-btn[data-taskbar-pos]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const pos = btn.dataset.taskbarPos;
      win.querySelectorAll(".settings-btn[data-taskbar-pos]").forEach((b) => b.classList.toggle("active", b === btn));
      settings.taskbarPosition = pos;
      localStorage.setItem(StorageKeys.taskbarPosition, pos);
      const { taskbarPositionManager: tpm } = await import("../taskbarPositionManager.js");
      tpm.setPosition(pos);
    });
  });

  const widthSlider = win.querySelector("#settingsStartMenuWidth");
  const widthValue = win.querySelector("#settingsStartMenuWidthValue");
  if (widthSlider) {
    widthSlider.addEventListener("input", () => {
      if (widthValue) widthValue.textContent = `${widthSlider.value}px`;
    });
    widthSlider.addEventListener("change", save);
  }

  const heightSlider = win.querySelector("#settingsStartMenuHeight");
  const heightValue = win.querySelector("#settingsStartMenuHeightValue");
  if (heightSlider) {
    heightSlider.addEventListener("input", () => {
      if (heightValue) heightValue.textContent = `${heightSlider.value}px`;
    });
    heightSlider.addEventListener("change", save);
  }

  win.querySelectorAll(".settings-start-cat-toggle").forEach((chk) => {
    chk.addEventListener("change", save);
  });

  const trayEnabledToggle = win.querySelector("#settingsTrayEnabled");
  if (trayEnabledToggle) {
    trayEnabledToggle.addEventListener("change", () => {
      const enabled = trayEnabledToggle.checked;
      settings.trayEnabled = enabled;
      localStorage.setItem(StorageKeys.trayEnabled, String(enabled));
      applyTrayEnabled(enabled);
      showSaved();
    });
  }
  renderTrayAppsList(win, settings);

  const windowSwitcherModeSelect = win.querySelector("#settingsWindowSwitcherMode");
  if (windowSwitcherModeSelect) {
    windowSwitcherModeSelect.addEventListener("change", () => {
      settings.windowSwitcherMode = windowSwitcherModeSelect.value;
      localStorage.setItem(StorageKeys.windowSwitcherMode, windowSwitcherModeSelect.value);
      showSaved();
    });
  }

  const windowSwitcherUISelect = win.querySelector("#settingsWindowSwitcherUI");
  if (windowSwitcherUISelect) {
    windowSwitcherUISelect.addEventListener("change", () => {
      settings.windowSwitcherUI = windowSwitcherUISelect.value;
      localStorage.setItem(StorageKeys.windowSwitcherUI, windowSwitcherUISelect.value);
      showSaved();
    });
  }

  const windowSwitcherIncludeMinimizedToggle = win.querySelector("#settingsWindowSwitcherIncludeMinimized");
  if (windowSwitcherIncludeMinimizedToggle) {
    windowSwitcherIncludeMinimizedToggle.addEventListener("change", () => {
      settings.windowSwitcherIncludeMinimized = windowSwitcherIncludeMinimizedToggle.checked;
      localStorage.setItem(
        StorageKeys.windowSwitcherIncludeMinimized,
        String(windowSwitcherIncludeMinimizedToggle.checked)
      );
      showSaved();
    });
  }

  const hideGamesBtn = win.querySelector("#settingsHideGamesBtn");
  if (hideGamesBtn) {
    hideGamesBtn.addEventListener("click", () => {
      toggleHideGames();
      showSaved();
    });
  }
  const hideAppsBtn = win.querySelector("#settingsHideAppsBtn");
  if (hideAppsBtn) {
    hideAppsBtn.addEventListener("click", () => {
      toggleHideSystemApps();
      showSaved();
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
  win.querySelector("#settingsMacControls")?.addEventListener("change", save);

  win.querySelector("#settingsCycleWallpaper")?.addEventListener("change", save);

  win.querySelectorAll(".settings-btn[data-theme-val]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const theme = btn.dataset.themeVal;
      win.querySelectorAll(".settings-btn[data-theme-val]").forEach((b) => b.classList.toggle("active", b === btn));
      settings.theme = theme;
      localStorage.setItem(StorageKeys.theme, theme);
      applyTheme(theme, getCustomColors);
      audioMixer.playSystemSound(SystemAudio.DESKTOP_CHANGE);
      showStatus("Theme applied");
    });
  });

  const customColorsBtn = win.querySelector("#settingsCustomColorsBtn");
  if (customColorsBtn) {
    customColorsBtn.addEventListener("click", () => showCustomColorsDialog(win));
  }

  const transparencySlider = win.querySelector("#settingsWindowTransparency");
  const transparencyValue = win.querySelector("#settingsWindowTransparencyValue");
  if (transparencySlider) {
    transparencySlider.addEventListener("input", () => {
      if (transparencyValue) transparencyValue.textContent = `${transparencySlider.value}%`;
    });
    transparencySlider.addEventListener("change", () => {
      const val = parseInt(transparencySlider.value) / 100;
      settings.windowTransparency = val;
      localStorage.setItem(StorageKeys.windowTransparency, String(val));
      applyWindowTransparency(val);
      showSaved();
    });
  }

  const transparentUIToggle = win.querySelector("#settingsTransparentUI");
  if (transparentUIToggle) {
    transparentUIToggle.addEventListener("change", () => {
      const enabled = transparentUIToggle.checked;
      settings.transparentUI = enabled;
      localStorage.setItem(StorageKeys.transparentUI, String(enabled));
      applyTransparentUI(enabled);
      showSaved();
    });
  }

  const guiScaleSlider = win.querySelector("#settingsGuiScale");
  const guiScaleValue = win.querySelector("#settingsGuiScaleValue");
  if (guiScaleSlider) {
    guiScaleSlider.addEventListener("input", () => {
      if (guiScaleValue) guiScaleValue.textContent = `${guiScaleSlider.value}%`;
    });
    guiScaleSlider.addEventListener("change", () => {
      const val = parseInt(guiScaleSlider.value);
      settings.guiScale = val;
      localStorage.setItem(StorageKeys.guiScale, String(val));
      applyGuiScale(val);
      showSaved();
    });
  }

  const fontSizeSlider = win.querySelector("#settingsFontSize");
  const fontSizeValue = win.querySelector("#settingsFontSizeValue");
  if (fontSizeSlider) {
    fontSizeSlider.addEventListener("input", () => {
      if (fontSizeValue) fontSizeValue.textContent = `${fontSizeSlider.value}%`;
    });
    fontSizeSlider.addEventListener("change", () => {
      const val = parseInt(fontSizeSlider.value);
      settings.fontSize = val;
      localStorage.setItem(StorageKeys.fontSize, String(val));
      applyFontSize(val);
      showSaved();
    });
  }

  const openAnimSelect = win.querySelector("#settingsOpenAnimation");
  if (openAnimSelect) {
    openAnimSelect.addEventListener("change", () => {
      localStorage.setItem(StorageKeys.windowOpenAnimation, openAnimSelect.value);
      showSaved();
    });
  }

  const closeAnimSelect = win.querySelector("#settingsCloseAnimation");
  if (closeAnimSelect) {
    closeAnimSelect.addEventListener("change", () => {
      localStorage.setItem(StorageKeys.windowCloseAnimation, closeAnimSelect.value);
      showSaved();
    });
  }

  const minimizeAnimSelect = win.querySelector("#settingsMinimizeAnimation");
  if (minimizeAnimSelect) {
    minimizeAnimSelect.addEventListener("change", () => {
      localStorage.setItem(StorageKeys.windowMinimizeAnimation, minimizeAnimSelect.value);
      showSaved();
    });
  }

  const animationSpeedSelect = win.querySelector("#settingsAnimationSpeed");
  if (animationSpeedSelect) {
    animationSpeedSelect.addEventListener("change", () => {
      localStorage.setItem(StorageKeys.windowAnimationSpeed, animationSpeedSelect.value);
      showSaved();
    });
  }

  const clickBubbleToggle = win.querySelector("#settingsClickBubble");
  if (clickBubbleToggle) {
    clickBubbleToggle.addEventListener("change", async () => {
      const { applyAnimationSettings } = await import("../windowManager/AnimationSystem.js");
      applyAnimationSettings({ clickBubble: clickBubbleToggle.checked });
      showSaved();
    });
  }

  const wallpapersContainer = win.querySelector("#settings-wallpapers-container");
  if (wallpapersContainer && fs && wm) {
    renderWallpapersPage(fs, wm, wallpapersContainer);
  }

  bindCursorControls(win, settings, showSaved, normalizeCursorDataUrl);
}

function bindCursorControls(win, settings, showSaved, normalizeCursorDataUrl) {
  const cursorUploadBtn = win.querySelector("#settingsCursorUploadBtn");
  const cursorClearBtn = win.querySelector("#settingsCursorClearBtn");
  const cursorStatus = win.querySelector("#settingsCursorStatus");
  const cursorSizeInput = win.querySelector("#settingsCursorSize");
  const cursorSizeValue = win.querySelector("#settingsCursorSizeValue");

  const setCursor = (dataUrl, originalDataUrl = null) => {
    const cursorDataUrl = typeof dataUrl === "string" ? dataUrl : "";
    const cursorOriginalDataUrl =
      originalDataUrl === null
        ? settings.cursorOriginalDataUrl
        : typeof originalDataUrl === "string"
          ? originalDataUrl
          : "";

    if (cursorDataUrl) localStorage.setItem(StorageKeys.cursorKey, cursorDataUrl);
    else localStorage.removeItem(StorageKeys.cursorKey);

    if (cursorOriginalDataUrl) localStorage.setItem(StorageKeys.cursorOriginalKey, cursorOriginalDataUrl);
    else localStorage.removeItem(StorageKeys.cursorOriginalKey);

    settings.cursorDataUrl = cursorDataUrl;
    settings.cursorOriginalDataUrl = cursorOriginalDataUrl;
    Object.assign(window._settings, settings);

    applyCursor(cursorDataUrl);

    if (cursorClearBtn) cursorClearBtn.disabled = !cursorDataUrl;
    if (cursorStatus) cursorStatus.textContent = cursorDataUrl ? "Custom cursor enabled" : "Default cursor";
    if (cursorSizeInput) cursorSizeInput.disabled = !cursorDataUrl;
    showSaved();
  };

  const setCursorSize = async (size) => {
    const cursorSize = Number(size);
    if (!Number.isFinite(cursorSize) || cursorSize < 16 || cursorSize > 128) return;
    settings.cursorSize = cursorSize;
    try {
      localStorage.setItem(StorageKeys.cursorSizeKey, String(cursorSize));
    } catch {}
    if (cursorSizeValue) cursorSizeValue.textContent = `${cursorSize}px`;
    Object.assign(window._settings, settings);

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
    cursorUploadBtn.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/png,image/jpeg,image/gif,image/webp,image/svg+xml,.png,.jpg,.jpeg,.gif,.webp,.svg";
      input.style.display = "none";
      document.body.appendChild(input);

      input.addEventListener("change", async () => {
        const file = input.files?.[0];
        input.remove();
        if (!file) return;

        try {
          if (file.size > 2 * 1024 * 1024) {
            customAlert("Cursor image too large. Please use a file under 2MB.");
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
          customAlert("Failed to set cursor. Check console for details.");
        }
      });

      input.click();
    });
  }

  if (cursorClearBtn) {
    cursorClearBtn.addEventListener("click", () => {
      try {
        localStorage.removeItem(StorageKeys.cursorSizeKey);
      } catch {}
      if (cursorSizeInput) cursorSizeInput.value = "32";
      if (cursorSizeValue) cursorSizeValue.textContent = "32px";
      settings.cursorSize = 32;
      setCursor("", "");
    });
  }

  if (cursorSizeInput) {
    cursorSizeInput.addEventListener("input", () => {
      if (cursorSizeValue) cursorSizeValue.textContent = `${cursorSizeInput.value}px`;
    });
    cursorSizeInput.addEventListener("change", () => setCursorSize(cursorSizeInput.value));
  }

  const mikuCursorToggle = win.querySelector("#settingsMikuCursor");
  if (mikuCursorToggle) {
    mikuCursorToggle.addEventListener("change", () => {
      const enabled = mikuCursorToggle.checked;
      settings.mikuCursor = enabled;
      localStorage.setItem(StorageKeys.mikuCursor, String(enabled));
      applyMikuCursor(enabled);
      showSaved();
    });
  }
}

export function bindDataCategory(win, save, settings, fs, showStatus, showSaved) {
  win.querySelector("#btnExportData")?.addEventListener("click", () => exportData(fs, showStatus));
  win.querySelector("#btnImportData")?.addEventListener("click", () => importData(fs, showStatus));
  win.querySelector("#btnDeleteAllData")?.addEventListener("click", () => deleteAllData());

  const downloadPageBtn = win.querySelector("#settingsDownloadPageBtn");
  if (downloadPageBtn) {
    downloadPageBtn.addEventListener("click", async () => {
      const mirrors = [
        "https://yukios.pages.dev/",
        "https://yukios.neocities.org/",
        "https://yukios.netlify.app/",
        "https://yukios.vercel.app/"
      ];
      let htmlContent = null;
      for (const mirrorUrl of mirrors) {
        try {
          const response = await fetch(mirrorUrl);
          if (response.ok) {
            htmlContent = await response.text();
            break;
          }
        } catch (e) {
          console.warn(`Mirror failed: ${mirrorUrl}`, e);
        }
      }
      if (!htmlContent) {
        console.error("All mirrors failed.");
        showStatus("Download failed");
        return;
      }
      try {
        const blob = new Blob([htmlContent], { type: "text/html" });
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = "yukios.html";
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

  win.querySelector("#btnResetSaved")?.addEventListener("click", () => {
    win.querySelector("#settingsWeather").checked = settings.weather;
    win.querySelector("#settingsCycleWallpaper").checked = settings.cycleWallpaper;
    win.querySelector("#settingsMacControls").checked = settings.macOsControls;
    win.querySelector("#settingsClippy").checked = settings.clippy;
    win.querySelector("#settingsAchievements").checked = !settings.achievementsDisabled;
    win.querySelector("#settingsAnalytics").checked = !settings.analyticsDisabled;
    win.querySelector("#settingsAds").checked = !settings.adsDisabled;
    const stretchToggle = win.querySelector("#settingsDisableDesktopStretchScroll");
    if (stretchToggle) stretchToggle.checked = !!settings.disableDesktopStretchScroll;
    const workspaceToggle = win.querySelector("#settingsShowWorkspace");
    if (workspaceToggle) workspaceToggle.checked = !!settings.showWorkspace;
    const bootToggle = win.querySelector("#settingsDisableBootScreen");
    if (bootToggle) bootToggle.checked = !!settings.disableBootScreen;
    win.querySelectorAll(".settings-btn[data-turbo-val]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.perfVal === settings.turboMode);
    });
    showStatus("Reset to saved values");
  });

  win.querySelector("#btnResetToggles")?.addEventListener("click", async () => {
    const confirmed = await customConfirm("Reset toggles?");
    if (!confirmed) return;

    win.querySelector("#settingsWeather").checked = true;
    win.querySelector("#settingsCycleWallpaper").checked = true;
    win.querySelector("#settingsMacControls").checked = false;
    win.querySelector("#settingsClippy").checked = false;
    win.querySelector("#settingsAchievements").checked = true;
    win.querySelector("#settingsAnalytics").checked = true;
    win.querySelector("#settingsAds").checked = true;
    const stretchToggle = win.querySelector("#settingsDisableDesktopStretchScroll");
    if (stretchToggle) stretchToggle.checked = false;
    const workspaceToggle = win.querySelector("#settingsShowWorkspace");
    if (workspaceToggle) workspaceToggle.checked = true;
    const bootToggle = win.querySelector("#settingsDisableBootScreen");
    if (bootToggle) bootToggle.checked = false;
    win.querySelectorAll(".settings-btn[data-turbo-val]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.perfVal === "high");
    });
    save();
    showStatus("Toggles reset");
  });
}

export function bindNetworkCategory(win, save) {
  win.querySelector("#settingsCdnMirror")?.addEventListener("change", save);
}

export function bindAudioCategory(win, settings, showSaved) {
  const soundToggle = win.querySelector("#settingsSoundEnabled");
  const volumeSlider = win.querySelector("#settingsMasterVolume");
  const volumeValue = win.querySelector("#settingsMasterVolumeValue");
  const systemAudioToggle = win.querySelector("#settingsSystemAudioEnabled");
  const systemVolumeSlider = win.querySelector("#settingsSystemVolume");
  const systemVolumeValue = win.querySelector("#settingsSystemVolumeValue");

  if (soundToggle) {
    soundToggle.addEventListener("change", () => {
      const enabled = soundToggle.checked;
      settings.soundEnabled = enabled;
      localStorage.setItem(StorageKeys.soundEnabled, String(enabled));
      if (volumeSlider) volumeSlider.disabled = !enabled;
      audioMixer.setMaster(enabled ? settings.masterVolume : 0);
      showSaved();
    });
  }

  if (volumeSlider) {
    volumeSlider.addEventListener("input", () => {
      if (volumeValue) volumeValue.textContent = `${volumeSlider.value}%`;
    });
    volumeSlider.addEventListener("change", () => {
      const val = parseInt(volumeSlider.value) / 100;
      settings.masterVolume = val;
      localStorage.setItem(StorageKeys.masterVolume, String(val));
      if (settings.soundEnabled) audioMixer.setMaster(val);
      showSaved();
    });
  }

  if (systemAudioToggle) {
    systemAudioToggle.addEventListener("change", () => {
      const enabled = systemAudioToggle.checked;
      settings.systemAudioEnabled = enabled;
      audioMixer.systemAudioEnabled = enabled;
      localStorage.setItem(StorageKeys.systemAudioEnabled, String(enabled));
      if (systemVolumeSlider) systemVolumeSlider.disabled = !enabled;
      showSaved();
    });
  }

  if (systemVolumeSlider) {
    systemVolumeSlider.addEventListener("input", () => {
      if (systemVolumeValue) systemVolumeValue.textContent = `${systemVolumeSlider.value}%`;
    });
    systemVolumeSlider.addEventListener("change", () => {
      const val = parseInt(systemVolumeSlider.value) / 100;
      settings.systemVolume = val;
      audioMixer.systemVolume = val;
      localStorage.setItem(StorageKeys.systemVolume, String(val));
      showSaved();
    });
  }
}

export function renderTrayAppsList(win, settings) {
  const trayAppsList = win.querySelector("#trayAppsList");
  if (!trayAppsList) return;

  const trayItems = trayManager.getTrayItems();
  if (trayItems.length === 0) {
    trayAppsList.innerHTML = `<div style="padding: 12px; color: rgba(255,255,255,0.5); font-size: 13px; text-align: center;">No tray apps registered</div>`;
    return;
  }

  trayAppsList.innerHTML = "";
  trayItems.forEach(({ winId, label, icon }) => {
    const row = document.createElement("div");
    row.className = "settings-grid-toggle";
    row.style.cssText =
      "padding:8px 12px;border-radius:6px;background:rgba(255,255,255,0.03);display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;";

    const isUrl = typeof icon === "string" && /^(https?|data:|\/|.*\.(webp|png|jpg|jpeg|gif|svg))/.test(icon);
    const isFontAwesome = typeof icon === "string" && /^(fa-|fas|fab|far|fa )/.test(icon);

    let iconHtml = "";
    if (isUrl) iconHtml = `<img src="${icon}" alt="${label}" style="width:16px;height:16px;margin-right:8px;"/>`;
    else if (isFontAwesome) iconHtml = `<i class="${icon}" style="margin-right:8px;"></i>`;
    else iconHtml = `<span style="font-size:12px;margin-right:8px;">${icon}</span>`;

    const isVisible = settings.trayAppVisibility[winId] !== false;
    row.innerHTML = `
      <div style="display:flex;align-items:center;">${iconHtml}<span style="font-size:13px;color:rgba(255,255,255,0.9);">${label}</span></div>
      <label class="settings-toggle">
        <input type="checkbox" class="tray-app-toggle" data-win-id="${winId}" ${isVisible ? "checked" : ""}/>
        <span class="settings-track"><span class="settings-thumb"></span></span>
      </label>
    `;
    trayAppsList.appendChild(row);
  });

  trayAppsList.querySelectorAll(".tray-app-toggle").forEach((toggle) => {
    toggle.addEventListener("change", () => {
      const wId = toggle.dataset.winId;
      const visible = toggle.checked;
      settings.trayAppVisibility[wId] = visible;
      localStorage.setItem(StorageKeys.trayAppVisibility, JSON.stringify(settings.trayAppVisibility));
      const item = trayManager._items.get(wId);
      if (item) {
        item.visibleInSettings = visible;
        trayManager._render();
      }
    });
  });
}
