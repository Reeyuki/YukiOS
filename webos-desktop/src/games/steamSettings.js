import { StorageKeys, os,$ } from "../framework.js";
import { steamAudio } from "./steamAudio.js";
import { steamDeckAudio } from "../modes/steamdeck/SteamDeckAudio.js";
import { resolveIconUrl } from "../shared/assetResolver.js";
import { initSteamPopupWindow } from "./steamPopupWindow.js";
import { windowMakeDraggable } from "../windowManager/makeDraggable.js";
import { windowMakeResizable } from "../windowManager/makeResizable.js";
import { renderSelectMenu, setSelectMenuValue, bindSelectMenu } from "../shared/selectMenu.js";
import { SETTINGS, SETTINGS_SELECT_OPTIONS, SETTINGS_PANELS, SETTINGS_NAV, DEFAULT_SETTINGS } from "./steamSettingsCatalog.js";

export function renderSettingsSelectMenu(id, setting) {
  const html = renderSelectMenu(id, SETTINGS_SELECT_OPTIONS[setting] || [], SteamSettings.get(setting), "steam-settings-select");
  return html.replace('<div class="select-menu steam-settings-select" id="', `<div class="select-menu steam-settings-select" data-setting="${setting}" id="`);
}

export class SteamSettings {
  static DEFAULTS = { ...DEFAULT_SETTINGS };

  static KEY = StorageKeys.steamSettings;

  static load() {
    try {
      const saved = os.storage.get(this.KEY);
      if (saved) {
        return { ...this.DEFAULTS, ...saved };
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
    return { ...this.DEFAULTS };
  }

  static save(settings) {
    try {
      os.storage.set(this.KEY, settings);
      return true;
    } catch (e) {
      console.error("Failed to save settings:", e);
      return false;
    }
  }

  static get(key) {
    const settings = this.load();
    return settings[key] ?? this.DEFAULTS[key];
  }

  static set(key, value) {
    const settings = this.load();
    settings[key] = value;
    return this.save(settings);
  }

  static reset() {
    return this.save({ ...this.DEFAULTS });
  }
}

export function initSettingsToggles(root) {
  const settings = SteamSettings.load();

  root.querySelectorAll(".settings-toggle").forEach((toggle) => {
    if (toggle.inited) return;
    toggle.inited = true;
    const setting = toggle.dataset.setting;
    const value = setting === "steamAudioEnabled"
      ? os.storage.get(StorageKeys.steamDeckAudioEnabled) !== "false"
      : settings[setting];

    if (value) {
      toggle.classList.add("active");
    } else {
      toggle.classList.remove("active");
    }

    toggle.addEventListener("mouseenter", () => steamAudio.playHover());

    toggle.addEventListener("click", () => {
      const isActive = toggle.classList.contains("active");
      toggle.classList.toggle("active");
      steamAudio.playSelect();

      if (setting === "steamAudioEnabled") {
        os.storage.set(StorageKeys.steamDeckAudioEnabled, String(!isActive));
      } else {
        SteamSettings.set(setting, !isActive);
      }

      if (
        [
          "hideArchiveGames",
          "hideLuminSDK",
          "recentlyPlayedRow",
          "shareLiveActivity",
          "dnd",
          "socialDisabled"
        ].includes(setting)
      ) {
        window.dispatchEvent(
          new CustomEvent("steam-settings-changed", {
            detail: { setting, value: !isActive }
          })
        );
      }
    });
  });
}

export function initSettingsPage(container) {
  const settingsPage = container.querySelector(".steam-settings-page");
  if (!settingsPage) return;

  initSettingsToggles(settingsPage);

  const settings = SteamSettings.load();
  settingsPage.querySelectorAll(".select-menu[data-setting]").forEach((selectMenu) => {
    if (selectMenu.inited) return;
    selectMenu.inited = true;
    const setting = selectMenu.dataset.setting;
    const value = settings[setting];

    setSelectMenuValue(selectMenu.id, value, settingsPage);

    selectMenu.addEventListener("change", () => {
      steamAudio.playSelect();
      const newValue = selectMenu.dataset.value;
      SteamSettings.set(setting, newValue);

      if (setting === "gridSize") {
        window.dispatchEvent(
          new CustomEvent("steam-settings-changed", {
            detail: { setting, value: newValue }
          })
        );
      }
    });
  });

  if (!settingsPage.selectMenusBound) {
    bindSelectMenu(settingsPage);
    settingsPage.selectMenusBound = true;
  }

  settingsPage.querySelectorAll(".steam-settings-nav-item").forEach((navItem) => {
    if (navItem.inited) return;
    navItem.inited = true;

    navItem.addEventListener("mouseenter", () => steamDeckAudio.playNavigation());

    navItem.addEventListener("click", () => {
      steamDeckAudio.playNavigation();
      const category = navItem.dataset.category;
      const navItems = settingsPage.querySelectorAll(".steam-settings-nav-item");
      const prevIndex = Array.from(navItems).findIndex((item) => item.classList.contains("active"));
      const newIndex = Array.from(navItems).indexOf(navItem);
      if (prevIndex === newIndex) return;

      navItems.forEach((item) => item.classList.remove("active"));
      navItem.classList.add("active");

      animateSettingsPanelChange(settingsPage, category, newIndex > prevIndex ? "down" : "up");
    });
  });

  initAccountSyncPanel(settingsPage);
}

let settingsPanelAnimating = false;

function animateSettingsPanelChange(settingsPage, category, direction) {
  if (settingsPanelAnimating) return;
  const content = settingsPage.querySelector(".steam-settings-content");
  const currentPanel = content.querySelector(".steam-settings-panel:not(.hidden)");
  const targetPanel = content.querySelector(`.steam-settings-panel[data-panel="${category}"]`);
  if (!targetPanel || !currentPanel || currentPanel === targetPanel) return;
  settingsPanelAnimating = true;

  currentPanel.classList.add("steam-settings-panel--out", `steam-settings-panel--${direction}`);

  const startIn = () => {
    currentPanel.classList.remove("steam-settings-panel--out", "steam-settings-panel--up", "steam-settings-panel--down");
    currentPanel.classList.add("hidden");
    targetPanel.classList.remove("hidden");
    targetPanel.classList.add("steam-settings-panel--in", `steam-settings-panel--${direction}`);
    targetPanel.addEventListener("animationend", finishIn, { once: true });
  };

  const finishIn = () => {
    targetPanel.classList.remove("steam-settings-panel--in", "steam-settings-panel--up", "steam-settings-panel--down");
    settingsPanelAnimating = false;
  };

  currentPanel.addEventListener("animationend", startIn, { once: true });
}

function initAccountSyncPanel(settingsPage) {
  const syncNowBtn = settingsPage.querySelector(".steam-sync-now-btn");
  const syncStatus = settingsPage.querySelector(".sync-status");
  const componentsList = settingsPage.querySelector(".sync-components-list");

  if (!syncNowBtn || !syncStatus || !componentsList) return;

  const refreshSyncUI = async () => {
    try {
      const { isSyncEnabledPref, getToggles, SYNC_COMPONENTS, getCloudSummary } =
        await import("../account/syncEngine.js");
      const enabled = isSyncEnabledPref();
      const toggles = getToggles();
      const summary = await getCloudSummary();

      componentsList.innerHTML = "";
      SYNC_COMPONENTS.forEach((comp) => {
        const compItem = document.createElement("div");
        compItem.className = "sync-component-item";
        compItem.innerHTML = `
          <div style="flex:1;">
            <div style="font-size:14px;font-weight:500;">${comp.label}</div>
            <div style="font-size:12px;opacity:0.6;">${comp.description}</div>
          </div>
          <div class="settings-toggle ${toggles[comp.id] ? "active" : ""}" data-sync-component="${comp.id}">
            <div class="settings-toggle-slider"></div>
          </div>
        `;
        componentsList.appendChild(compItem);
      });

      componentsList.querySelectorAll(".settings-toggle").forEach((toggle) => {
        toggle.addEventListener("click", async () => {
          const compId = toggle.dataset.syncComponent;
          const isActive = toggle.classList.contains("active");
          toggle.classList.toggle("active");
          const { setToggle } = await import("../account/syncEngine.js");
          setToggle(compId, !isActive);
          steamAudio.playSelect();
        });
      });

      if (summary && summary.updatedAt) {
        const lastSync = new Date(summary.updatedAt).toLocaleString();
        const quota = summary.quota ? `${(summary.quota / 1024).toFixed(1)} KB` : "Unknown";
        syncStatus.innerHTML = `
          <div style="font-size:12px;opacity:0.7;">Last sync: ${lastSync}</div>
          <div style="font-size:12px;opacity:0.7;">Quota used: ${quota}</div>
        `;
      } else {
        syncStatus.innerHTML = `<div style="font-size:12px;opacity:0.7;">Not synced yet</div>`;
      }
    } catch (e) {
      console.error("Failed to refresh sync UI:", e);
      syncStatus.innerHTML = `<div style="font-size:12px;opacity:0.7;">Sync not available</div>`;
    }
  };

  syncNowBtn.addEventListener("click", async () => {
    steamAudio.playSelect();
    syncStatus.innerHTML = `<div style="font-size:12px;opacity:0.7;">Syncing...</div>`;
    try {
      const { syncPush, syncPull } = await import("../account/syncEngine.js");
      await syncPush();
      await syncPull();
      await refreshSyncUI();
      syncStatus.innerHTML = `<div style="font-size:12px;opacity:0.7;">Sync complete</div>`;
    } catch (e) {
      console.error("Sync failed:", e);
      syncStatus.innerHTML = `<div style="font-size:12px;opacity:0.7;">Sync failed</div>`;
    }
  });

  refreshSyncUI();
}

export function getGridMin(size) {
  const gridMinMap = { small: "100px", large: "180px" };
  return gridMinMap[size] || "140px";
}

function buildSettingsItemHtml(key, prefix) {
  const def = SETTINGS[key];
  if (!def) return "";

  const label = `
        <div class="settings-item-label">
          <div class="settings-item-title">${def.title}</div>
          <div class="settings-item-description">${def.description}</div>
        </div>
      `;

  let control = "";
  if (def.type === "toggle") {
    control = `
        <div class="settings-toggle" data-setting="${key}">
          <div class="settings-toggle-slider"></div>
        </div>
      `;
  } else if (def.type === "select") {
    control = renderSettingsSelectMenu(`${prefix}-${key}`, key);
  }

  return `
      <div class="settings-item">
        ${label}
        ${control}
      </div>
    `;
}

export function buildSettingsItemsHtml(keys, { prefix = "steam-settings" } = {}) {
  return keys.map((key) => buildSettingsItemHtml(key, prefix)).join("\n");
}

function buildSettingsNavHtml() {
  let isFirstItem = true;
  const sections = SETTINGS_NAV.map((sectionIds) => {
    const items = sectionIds.map((id) => {
      const panel = SETTINGS_PANELS.find((entry) => entry.id === id);
      if (!panel) return "";
      const cls = isFirstItem ? "steam-settings-nav-item active" : "steam-settings-nav-item";
      isFirstItem = false;
      return `
          <div class="${cls}" data-category="${panel.id}">
            <i class="${panel.icon}"></i>
            <span>${panel.title}</span>
          </div>
        `;
    });
    return `
        <div class="steam-settings-divider"></div>
        <div class="steam-settings-section">
          ${items.join("\n")}
        </div>
      `;
  });

  return `
      <div class="steam-settings-sidebar">
        <div class="steam-settings-header">YUKI SETTINGS</div>
        <div class="steam-settings-nav">
          ${sections.join("\n")}
        </div>
      </div>
    `;
}

function buildSettingsPanelHtml(panel, prefix) {
  const index = SETTINGS_PANELS.findIndex((entry) => entry.id === panel.id);
  const hiddenCls = index === 0 ? "" : " hidden";
  const items = Object.entries(SETTINGS)
    .filter(([, def]) => def.panel === panel.id)
    .map(([key]) => buildSettingsItemHtml(key, prefix))
    .join("\n");

  return `
      <div class="steam-settings-panel${hiddenCls}" data-panel="${panel.id}">
        <h2 class="steam-settings-panel-title">${panel.title}</h2>
        <div class="settings-container">
          <div class="settings-section">
            ${items}
            ${panel.customHtml || ""}
          </div>
        </div>
      </div>
    `;
}

export function buildSettingsPageHTML({ prefix = "steam-settings", hidden = false } = {}) {
  return `
    <div class="steam-settings-page${hidden ? " hidden" : ""}" style="display:flex;flex-direction:row;height:100%;color:#c6d4df;overflow:hidden;">
      ${buildSettingsNavHtml()}
      <div class="steam-settings-content">
        ${SETTINGS_PANELS.map((panel) => buildSettingsPanelHtml(panel, prefix)).join("\n")}
      </div>
    </div>
  `;
}

export async function openSteamSettingsWindow(wm) {
  const winId = "steam-settings";
  const existingWin = $(winId);
  if (existingWin) {
    os.window.focus(existingWin);
    return;
  }

  const win = os.window.create(winId, "Yuki Steam Settings", 900, 600, {
    skipHeader: true,
    icon: "fas fa-snowflake",
    resizable: true
  });
  win.style.background =
    "linear-gradient(90deg, #2a2d34 0, #2a2d34 260px, #171d25 260px, #171d25 100%)";

  win.classList.add("steam-settings-window");

  const windowControls = os.window.getWindowControls();

  win.innerHTML = `
    <div class="steam-settings-window-header window-header steam-popup-header">
      <div class="steam-settings-window-controls">
        ${windowControls}
      </div>
    </div>
    ${buildSettingsPageHTML()}
  `;

  initSteamPopupWindow(win);

  windowMakeDraggable(win, os.window.wm);
  windowMakeResizable(win, os.window.wm);

  initSettingsPage(win);
}
