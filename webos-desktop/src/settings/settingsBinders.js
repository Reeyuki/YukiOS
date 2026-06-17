import { StorageKeys } from "../StorageKeys.js";
import { os } from "../os/index.js";
import { toggleHideGames, toggleHideSystemApps } from "../desktopui/desktopui.js";
import { audioMixer, SystemAudio } from "../audioMixer.js";
import { renderWallpapersPage } from "../wallpapers.js";
import { applyTrayEnabled } from "./settingsApply.js";
import { FileKind } from "../fs.js";
import {
  applyTheme,
  applyWindowTransparency,
  applyTransparentUI,
  applyGuiScale,
  applyFontSize,
  applyCursor,
  applyMikuCursor,
  applyFontFamily,
  applyUiDensity
} from "./settingsApply.js";
import { exportData, importData, deleteAllData } from "./settingsData.js";
import { $, $$, bindEvent, toggleClass, setText, createElement, setHTML } from "../shared/domUtils.js";
import { addCustomTheme } from "../shared/themeEngine.js";

export function bindNavigation(win) {
  const layout = $(".yuki-settings-layout", win);
  const navItems = $$(".yuki-settings-nav li", win);
  const panes = $$(".settings-category-pane", win);
  const searchInput = $("#settingsSearch", win);

  navItems.forEach((item) => {
    bindEvent(item, "click", () => {
      searchInput.value = "";
      searchInput.dispatchEvent(new Event("input"));

      navItems.forEach((n) => n.classList.remove("active"));
      panes.forEach((p) => p.classList.remove("active"));
      item.classList.add("active");
      $(`#${item.dataset.target}`, win)?.classList.add("active");
    });
  });

  bindEvent(searchInput, "input", (e) => {
    const query = e.target.value.toLowerCase().trim();

    if (!query) {
      layout.classList.remove("is-searching");
      $$(".settings-row", win).forEach((row) => row.classList.remove("hidden-by-search"));
      panes.forEach((p) => {
        p.classList.remove("active");
        p.style.display = "";
        $$(".settings-card", p).forEach((card) => {
          card.style.display = "";
        });
      });
      const activeNav = $(".yuki-settings-nav li.active", win);
      if (activeNav) $(`#${activeNav.dataset.target}`, win)?.classList.add("active");
    } else {
      layout.classList.add("is-searching");
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
  });
}

export function bindSystemCategory(win, save, settings, notificationCenter, showSaved) {
  const systemSettings = [
    "#settingsWeather",
    "#settingsMacControls",
    "#settingsClippy",
    "#settingsAchievements",
    "#settingsAnalytics",
    "#settingsAds",
    "#settingsDisableBootScreen",
    "#settingsWindowSessionPersistence"
  ];
  systemSettings.forEach((id) => bindEvent($(id, win), "change", save));

  $$(".settings-btn[data-turbo-val]", win).forEach((btn) => {
    bindEvent(btn, "click", () => {
      $$(".settings-btn[data-turbo-val]", win).forEach((b) => toggleClass(b, "active", b === btn));
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

  const notificationSettings = [
    "#settingsNotificationsEnabled",
    "#settingsNotificationsRemoveTimeout",
    "#settingsNotificationsPopAnimation",
    "#settingsNotificationsOverFullscreen",
    "#settingsNotificationsPosition"
  ];
  notificationSettings.forEach((id) => bindEvent($(id, win), "change", save));

  const durationInput = $("#settingsNotificationsDuration", win);
  const durationVal = $("#settingsNotificationsDurationVal", win);
  if (durationInput) {
    bindEvent(durationInput, "input", () => {
      if (durationVal) setText(durationVal, `${durationInput.value}s`);
    });
    bindEvent(durationInput, "change", save);
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
      const { taskbarPositionManager: tpm } = await import("../desktopui/taskbarPositionManager.js");
      tpm.setPosition(pos);
    });
  });

  const widthSlider = $("#settingsStartMenuWidth", win);
  const widthValue = $("#settingsStartMenuWidthValue", win);
  if (widthSlider) {
    bindEvent(widthSlider, "input", () => {
      if (widthValue) setText(widthValue, `${widthSlider.value}px`);
    });
    bindEvent(widthSlider, "change", save);
  }

  const heightSlider = $("#settingsStartMenuHeight", win);
  const heightValue = $("#settingsStartMenuHeightValue", win);
  if (heightSlider) {
    bindEvent(heightSlider, "input", () => {
      if (heightValue) setText(heightValue, `${heightSlider.value}px`);
    });
    bindEvent(heightSlider, "change", save);
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
      settings.windowSwitcherMode = windowSwitcherModeSelect.value;
      os.storage.set(StorageKeys.windowSwitcherMode, windowSwitcherModeSelect.value);
      showSaved();
    });
  }

  const windowSwitcherUISelect = $("#settingsWindowSwitcherUI", win);
  if (windowSwitcherUISelect) {
    bindEvent(windowSwitcherUISelect, "change", () => {
      settings.windowSwitcherUI = windowSwitcherUISelect.value;
      os.storage.set(StorageKeys.windowSwitcherUI, windowSwitcherUISelect.value);
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

  const hideGamesBtn = $("#settingsHideGamesBtn", win);
  if (hideGamesBtn) {
    bindEvent(hideGamesBtn, "click", () => {
      toggleHideGames();
      showSaved();
    });
  }
  const hideAppsBtn = $("#settingsHideAppsBtn", win);
  if (hideAppsBtn) {
    bindEvent(hideAppsBtn, "click", () => {
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
  bindEvent($("#settingsMacControls", win), "change", save);
  bindEvent($("#settingsCycleWallpaper", win), "change", save);

  $$(".settings-btn[data-theme-val]", win).forEach((btn) => {
    bindEvent(btn, "click", () => {
      const theme = btn.dataset.themeVal;
      $$(".settings-btn[data-theme-val]", win).forEach((b) => toggleClass(b, "active", b === btn));
      settings.theme = theme;
      os.storage.set(StorageKeys.theme, theme);
      applyTheme(theme, getCustomColors);
      audioMixer().playSystemSound(SystemAudio.DESKTOP_CHANGE);
      showStatus("Theme applied");
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
        os.dialog.alert("Alert", "No custom colors set. Please customize colors first.");
        return;
      }
      const themeName = await os.dialog.prompt("Prompt", "Enter theme name:", "My Theme");
      if (!themeName) return;
      const themeValue = themeName.toLowerCase().replace(/[^a-z0-9-]/g, "-");
      try {
        addCustomTheme({
          value: themeValue,
          label: themeName,
          icon: "fas fa-palette",
          colors: customColors
        });
        os.dialog.alert("Alert", `Theme "${themeName}" saved successfully!`);
        showSaved();
        const customThemesSection = Array.from($$(".settings-row--stacked", win)).find(
          (row) => row.querySelector(".settings-label-title")?.textContent === "Custom Themes"
        );
        if (customThemesSection) {
          const customThemesGrid = customThemesSection.querySelector("div[style*='grid']");
          if (customThemesGrid) {
            const emptyMessage = customThemesGrid.querySelector("span");
            if (emptyMessage) emptyMessage.remove();
            const newThemeBtn = document.createElement("button");
            newThemeBtn.className = "settings-btn";
            newThemeBtn.dataset.themeVal = themeValue;
            newThemeBtn.innerHTML = `<i class="fas fa-palette"></i> ${themeName}`;
            bindEvent(newThemeBtn, "click", () => {
              $$(".settings-btn", win).forEach((btn) => btn.classList.remove("active"));
              newThemeBtn.classList.add("active");
              settings.theme = themeValue;
              os.storage.set(StorageKeys.theme, themeValue);
              applyTheme(themeValue, () => getCustomColors());
              showStatus("Theme applied");
            });
            customThemesGrid.appendChild(newThemeBtn);
          }
        }
      } catch (e) {
        os.dialog.alert("Alert", e.message || "Failed to save theme");
      }
    });
  }

  const transparencySlider = $("#settingsWindowTransparency", win);
  const transparencyValue = $("#settingsWindowTransparencyValue", win);
  if (transparencySlider) {
    bindEvent(transparencySlider, "input", () => {
      if (transparencyValue) setText(transparencyValue, `${transparencySlider.value}%`);
    });
    bindEvent(transparencySlider, "change", () => {
      const val = parseInt(transparencySlider.value) / 100;
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

  const guiScaleSlider = $("#settingsGuiScale", win);
  const guiScaleValue = $("#settingsGuiScaleValue", win);
  if (guiScaleSlider) {
    bindEvent(guiScaleSlider, "input", () => {
      if (guiScaleValue) setText(guiScaleValue, `${guiScaleSlider.value}%`);
    });
    bindEvent(guiScaleSlider, "change", () => {
      const val = parseInt(guiScaleSlider.value);
      settings.guiScale = val;
      os.storage.set(StorageKeys.guiScale, String(val));
      applyGuiScale(val);
      showSaved();
    });
  }

  const fontSizeSlider = $("#settingsFontSize", win);
  const fontSizeValue = $("#settingsFontSizeValue", win);
  if (fontSizeSlider) {
    bindEvent(fontSizeSlider, "input", () => {
      if (fontSizeValue) setText(fontSizeValue, `${fontSizeSlider.value}%`);
    });
    bindEvent(fontSizeSlider, "change", () => {
      const val = parseInt(fontSizeSlider.value);
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
      os.storage.set(StorageKeys.windowOpenAnimation, openAnimSelect.value);
      showSaved();
    });
  }

  const closeAnimSelect = $("#settingsCloseAnimation", win);
  if (closeAnimSelect) {
    bindEvent(closeAnimSelect, "change", () => {
      os.storage.set(StorageKeys.windowCloseAnimation, closeAnimSelect.value);
      showSaved();
    });
  }

  const minimizeAnimSelect = $("#settingsMinimizeAnimation", win);
  if (minimizeAnimSelect) {
    bindEvent(minimizeAnimSelect, "change", () => {
      os.storage.set(StorageKeys.windowMinimizeAnimation, minimizeAnimSelect.value);
      showSaved();
    });
  }

  const animationSpeedSelect = $("#settingsAnimationSpeed", win);
  if (animationSpeedSelect) {
    bindEvent(animationSpeedSelect, "change", () => {
      os.storage.set(StorageKeys.windowAnimationSpeed, animationSpeedSelect.value);
      showSaved();
    });
  }

  const clickBubbleToggle = $("#settingsClickBubble", win);
  if (clickBubbleToggle) {
    bindEvent(clickBubbleToggle, "change", async () => {
      const { applyAnimationSettings } = await import("../windowManager/AnimationSystem.js");
      applyAnimationSettings({ clickBubble: clickBubbleToggle.checked });
      showSaved();
    });
  }

  $$(".settings-btn[data-font-family]", win).forEach((btn) => {
    bindEvent(btn, "click", () => {
      const fontFamily = btn.dataset.fontFamily;
      $$(".settings-btn[data-font-family]", win).forEach((b) => toggleClass(b, "active", b === btn));
      settings.fontFamily = fontFamily;
      os.storage.set(StorageKeys.fontFamily, fontFamily);
      applyFontFamily(fontFamily);
      showSaved();
    });
  });

  const wallpapersContainer = $("#settings-wallpapers-container", win);
  if (wallpapersContainer && fs && wm) {
    renderWallpapersPage(fs, wm, wallpapersContainer);
  }

  const uploadWallpaperBtn = $("#settingsUploadWallpaperBtn", win);
  const wallpaperFileInput = $("#settingsWallpaperFileInput", win);
  if (uploadWallpaperBtn && wallpaperFileInput && fs) {
    bindEvent(uploadWallpaperBtn, "click", () => {
      wallpaperFileInput.click();
    });

    bindEvent(wallpaperFileInput, "change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        await fs.ensureFolder(["Pictures", "Wallpapers"]);

        const fileKind = file.type.startsWith("video") ? FileKind.VIDEO : FileKind.IMAGE;
        const icon = file.type.startsWith("video") ? "static/icons/file.webp" : "@content";

        await fs.createFile(["Pictures", "Wallpapers"], file.name, file, fileKind, icon);

        os.notify.send("Wallpaper Uploaded", `Wallpaper "${file.name}" uploaded successfully`, { type: "info" });

        if (wallpapersContainer) {
          await renderWallpapersPage(fs, wm, wallpapersContainer);
        }
      } catch (err) {
        console.error("Failed to upload wallpaper:", err);
        os.notify.send("Upload Failed", "Failed to upload wallpaper", { type: "error" });
      }

      wallpaperFileInput.value = "";
    });
  }

  bindCursorControls(win, settings, showSaved, normalizeCursorDataUrl);
}

function bindCursorControls(win, settings, showSaved, normalizeCursorDataUrl) {
  const cursorUploadBtn = $("#settingsCursorUploadBtn", win);
  const cursorClearBtn = $("#settingsCursorClearBtn", win);
  const cursorStatus = $("#settingsCursorStatus", win);
  const cursorSizeInput = $("#settingsCursorSize", win);
  const cursorSizeValue = $("#settingsCursorSizeValue", win);

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
    if (cursorSizeInput) cursorSizeInput.disabled = !cursorDataUrl;
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
            os.dialog.alert("Alert", "Cursor image too large. Please use a file under 2MB.");
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
          os.dialog.alert("Alert", "Failed to set cursor. Check console for details.");
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
      if (cursorSizeInput) cursorSizeInput.value = "32";
      if (cursorSizeValue) setText(cursorSizeValue, "32px");
      settings.cursorSize = 32;
      setCursor("", "");
    });
  }

  if (cursorSizeInput) {
    bindEvent(cursorSizeInput, "input", () => {
      if (cursorSizeValue) setText(cursorSizeValue, `${cursorSizeInput.value}px`);
    });
    bindEvent(cursorSizeInput, "change", () => setCursorSize(cursorSizeInput.value));
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

      const siteMirrors = [
        "https://yukios.pages.dev/",
        "https://yukios.neocities.org/",
        "https://yukios.netlify.app/",
        "https://yukios.vercel.app/"
      ];

      const sources = [...siteMirrors, ...gitMirrors];

      let htmlContent = null;

      for (const url of sources) {
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
    $("#settingsMacControls", win).checked = settings.macOsControls;
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
    $$(".settings-btn[data-turbo-val]", win).forEach((btn) => {
      toggleClass(btn, "active", btn.dataset.perfVal === settings.turboMode);
    });
    showStatus("Reset to saved values");
  });

  bindEvent($("#btnResetToggles", win), "click", async () => {
    const confirmed = await os.dialog.confirm("Confirm", "Reset toggles?");
    if (!confirmed) return;

    $("#settingsWeather", win).checked = true;
    $("#settingsCycleWallpaper", win).checked = true;
    $("#settingsMacControls", win).checked = false;
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
    $$(".settings-btn[data-turbo-val]", win).forEach((btn) => {
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
      const value = wispServerSelect.value;
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
      if (volumeSlider) volumeSlider.disabled = !enabled;
      audioMixer().setMaster(enabled ? settings.masterVolume : 0);
      showSaved();
    });
  }

  if (volumeSlider) {
    bindEvent(volumeSlider, "input", () => {
      if (volumeValue) setText(volumeValue, `${volumeSlider.value}%`);
    });
    bindEvent(volumeSlider, "change", () => {
      const val = parseInt(volumeSlider.value) / 100;
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
      if (systemVolumeSlider) systemVolumeSlider.disabled = !enabled;
      showSaved();
    });
  }

  if (systemVolumeSlider) {
    bindEvent(systemVolumeSlider, "input", () => {
      if (systemVolumeValue) setText(systemVolumeValue, `${systemVolumeSlider.value}%`);
    });
    bindEvent(systemVolumeSlider, "change", () => {
      const val = parseInt(systemVolumeSlider.value) / 100;
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
      `<div style="padding: 12px; color: rgba(255,255,255,0.5); font-size: 13px; text-align: center;">No tray apps registered</div>`
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
