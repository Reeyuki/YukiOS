import { os, StorageKeys } from "../framework.js";
import { SteamSettings, openSteamSettingsWindow } from "../games/steamSettings.js";
import { KeybindManager } from "../keybindManager.js";

function loadOverlayEnabled() {
  try {
    const raw = os.storage.get(StorageKeys.overlaySettings);
    if (!raw) return true;
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (typeof parsed.enabled === "boolean") return parsed.enabled;
    return true;
  } catch {
    return true;
  }
}

function saveOverlayEnabled(value) {
  try {
    const raw = os.storage.get(StorageKeys.overlaySettings);
    let current = {};
    if (raw) {
      try {
        current = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch {}
      if (typeof current !== "object" || current === null) current = {};
    }
    current.enabled = !!value;
    if (current.restoreTabs === undefined) current.restoreTabs = true;
    if (current.perfMonitor === undefined) current.perfMonitor = false;
    os.storage.set(StorageKeys.overlaySettings, current);
    const ctrl = os.app?.launcher?.overlayController;
    if (ctrl && ctrl.settings) {
      ctrl.settings.enabled = !!value;
      try {
        ctrl.saveSettings();
      } catch {}
    }
  } catch {}
}

export function renderGamingSettings() {
  const steam = SteamSettings.load();
  const overlayEnabled = loadOverlayEnabled() && steam.overlayEnabled !== false;
  const keys = KeybindManager.getCurrentKeys("steam.overlay");
  const hotkeyLabel = keys ? keys.join(" + ") : "Shift + Tab";
  return `
    <div id="pane-gaming" class="settings-category-pane">
      <div class="settings-category-header">Gaming</div>

      <div class="settings-card" id="sc-gaming-overlay">
        <div class="settings-card-header"><i class="fas fa-layer-group"></i> In-Game Overlay</div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Shift+Tab Overlay in Games</span>
            <span class="settings-label-desc">Show draggable Yuki overlay while a game is focused</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsGamingOverlay" ${overlayEnabled ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Overlay Shortcut</span>
            <span class="settings-label-desc">Hotkey to toggle the in-game overlay</span>
          </div>
          <button class="settings-btn" id="settingsGamingOverlayHotkey"><i class="fas fa-keyboard"></i> ${hotkeyLabel}</button>
        </div>
      </div>

      <div class="settings-card" id="sc-gaming-steam" style="margin-top:16px;">
        <div class="settings-card-header"><i class="fab fa-steam"></i> Yuki Steam</div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Open Steam Settings</span>
            <span class="settings-label-desc">Open the Steam settings panel</span>
          </div>
          <button class="settings-btn" id="settingsGamingOpenSteam"><i class="fas fa-external-link-alt"></i> Open</button>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Screenshots</span>
            <span class="settings-label-desc">Enable screenshot capture from the overlay</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsGamingScreenshots" ${steam.screenshotsEnabled !== false ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
      </div>
    </div>
  `;
}

export function bindGamingCategory(win, wm) {
  if (!win) return;
  const overlayToggle = win.querySelector("#settingsGamingOverlay");
  overlayToggle?.addEventListener("change", () => {
    const on = !!overlayToggle.checked;
    SteamSettings.set("overlayEnabled", on);
    saveOverlayEnabled(on);
    window.dispatchEvent(new CustomEvent("steam-settings-changed", { detail: { setting: "overlayEnabled", value: on } }));
  });

  const hotkeyBtn = win.querySelector("#settingsGamingOverlayHotkey");
  hotkeyBtn?.addEventListener("click", () => {
    os.app.launch("shortcutsApp");
  });

  const openSteamBtn = win.querySelector("#settingsGamingOpenSteam");
  openSteamBtn?.addEventListener("click", () => {
    try {
      const manager = wm || os.windowManager;
      openSteamSettingsWindow(manager);
    } catch {
      os.app.launch("steamApp", { steamPage: "settings" });
    }
  });

  const shotsToggle = win.querySelector("#settingsGamingScreenshots");
  shotsToggle?.addEventListener("change", () => {
    const on = !!shotsToggle.checked;
    SteamSettings.set("screenshotsEnabled", on);
    window.dispatchEvent(new CustomEvent("steam-settings-changed", { detail: { setting: "screenshotsEnabled", value: on } }));
  });
}
