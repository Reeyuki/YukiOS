import { desktop } from "./desktop.js";
import { toggleHideGames, toggleHideSystemApps } from "./desktopui.js";
import { BaseApp } from "./core/BaseApp.js";
import { bus, BusEvents } from "./core/EventBus.js";
import { customAlert, customConfirm, customPrompt } from "./shared/dialogs.js";
import { WindowHelper } from "./utils/WindowHelper.js";
import { CDN_MIRRORS, setCdnMirror, initializeMirrors, resolveGhUrl } from "./shared/assetResolver.js";
import { appMap } from "./gamesList.js";
import { renderWallpapersPage } from "./wallpapers.js";
import { audioMixer } from "./audioMixer.js";

import { StorageKeys } from "./StorageKeys.js";
import { YUKIOS_VERSION } from "./about.js";
export { StorageKeys };
export class SettingsApp extends BaseApp {
  constructor(services) {
    super(services);
    this.windowHelper = new WindowHelper(this.wm);
    this.fs = null;

    setTimeout(() => {
      const cursorOriginalFromStorage = localStorage.getItem(StorageKeys.cursorOriginalKey) ?? "";
      const cursorFromLegacyStorage = localStorage.getItem(StorageKeys.cursorKey) ?? "";
      const cursorOriginalDataUrl = cursorOriginalFromStorage || cursorFromLegacyStorage || "";
      const parsedCursorSize = Number(localStorage.getItem(StorageKeys.cursorSizeKey));
      const cursorSize = Number.isFinite(parsedCursorSize) && parsedCursorSize > 0 ? parsedCursorSize : 32;

      const rawTransparency = parseFloat(localStorage.getItem(StorageKeys.windowTransparency));
      const rawMasterVol = parseFloat(localStorage.getItem(StorageKeys.masterVolume));

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
        taskbarAlignment: localStorage.getItem(StorageKeys.taskbarAlignment) || "center",
        cdnMirror: localStorage.getItem(StorageKeys.cdnMirror) || "jsdelivr",
        theme: localStorage.getItem(StorageKeys.theme) || "auto",
        windowTransparency: Number.isFinite(rawTransparency) ? Math.max(0.2, Math.min(1, rawTransparency)) : 1,
        soundEnabled: localStorage.getItem(StorageKeys.soundEnabled) !== "false",
        masterVolume: Number.isFinite(rawMasterVol) ? Math.max(0, Math.min(1, rawMasterVol)) : 1,
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
        performanceMode: localStorage.getItem(StorageKeys.performanceMode) || "high",
        showWorkspace: localStorage.getItem(StorageKeys.showWorkspace) !== "false",
        notificationsEnabled: localStorage.getItem(StorageKeys.notificationsEnabled) !== "false",
        notificationsRemoveTimeout: localStorage.getItem(StorageKeys.notificationsRemoveTimeout) !== "false",
        notificationsPopAnimation: localStorage.getItem(StorageKeys.notificationsPopAnimation) !== "false",
        notificationsOverFullscreen: localStorage.getItem(StorageKeys.notificationsOverFullscreen) === "true",
        notificationsDuration: Number(localStorage.getItem(StorageKeys.notificationsDuration)) || 5
      };

      this._applyCursor(this._settings.cursorDataUrl);
      this._applyDesktopStretchScrollDisabled(this._settings.disableDesktopStretchScroll);
      this._applyTheme(this._settings.theme);
      this._applyWindowTransparency(this._settings.windowTransparency);
      this._applySound(this._settings.soundEnabled, this._settings.masterVolume);
      this._applyStartMenuSize(this._settings.startMenuWidth, this._settings.startMenuHeight);
      this._applyStartMenuCats(this._settings.startMenuCats);
      this._applyPerformanceMode(this._settings.performanceMode);
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
      this.wm.bringToFront(existing);
      if (options && typeof options.section === "string") {
        this.navigateToSection(existing, options.section, options.target);
      }
      return;
    }

    const win = this.wm.createWindow(winId, "Settings", "805px", "600px");
    win.innerHTML = this._buildHTML();

    this.windowHelper.mountWindow(win, winId, "Settings", "fas fa-cog");
    if (this.desktopUi !== undefined) this.desktopUI.closeAllMenus();

    this._bindControls(win);

    if (options && typeof options.section === "string") {
      this.navigateToSection(win, options.section, options.target);
    }
  }

  navigateToSection(win, section, target) {
    const navItem = win.querySelector(`.yuki-settings-nav li[data-target="${section}"]`);
    if (navItem) {
      navItem.click();
    }
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

  setFileSystemManager(fileSystemManager) {
    this.fs = fileSystemManager;
  }

  setNotificationCenter(nc) {
    this._notificationCenter = nc;
  }

  _buildHTML() {
    return `
    <div class="window-header">
      <span>Settings</span>
      ${this.wm.getWindowControls()}
    </div>
    <div class="window-content" style="padding: 0; gap: 0;">
      <div class="yuki-settings-layout">
        <div class="yuki-settings-sidebar">
          <div class="yuki-settings-search">
            <input type="text" id="settingsSearch" placeholder="Find a setting...">
          </div>
          <ul class="yuki-settings-nav">
            <li class="active" data-target="pane-system"><i class="fas fa-desktop"></i> System</li>
            <li data-target="pane-desktop"><i class="fas fa-home"></i> Desktop</li>
            <li data-target="pane-appearance"><i class="fas fa-paint-brush"></i> Appearance</li>
            <li data-target="pane-tools"><i class="fas fa-toolbox"></i> Tools</li>
            <li data-target="pane-data"><i class="fas fa-database"></i> Data</li>
            <li data-target="pane-network"><i class="fas fa-network-wired"></i> Network</li>
            <li data-target="pane-audio"><i class="fas fa-volume-high"></i> Audio</li>
            <li data-target="pane-about"><i class="fas fa-circle-info"></i> About</li>
          </ul>
        </div>

        <div class="yuki-settings-content">
          <span id="settingsStatus" class="settings-saved-badge-float">Saved</span>
          
          ${this._renderSystemSettings()}
          ${this._renderDesktopSettings()}
          ${this._renderAppearanceSettings()}
          ${this._renderToolsSettings()}
          ${this._renderDataSettings()}
          ${this._renderNetworkSettings()}
          ${this._renderAudioSettings()}
          ${this._renderAboutSettings()}
        </div>
      </div>
    </div>
    `;
  }

  _renderSystemSettings() {
    return `
      <div id="pane-system" class="settings-category-pane active">
        <div class="settings-category-header">System</div>
        <div class="settings-card">
          <div class="settings-card-header"><i class="fas fa-sliders-h"></i> General Behavior</div>
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">Weather</span>
              <span class="settings-label-desc">Show weather in the taskbar</span>
            </div>
            <label class="settings-toggle">
              <input type="checkbox" id="settingsWeather" ${this._settings.weather ? "checked" : ""}/>
              <span class="settings-track"><span class="settings-thumb"></span></span>
            </label>
          </div>
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">Clippy</span>
              <span class="settings-label-desc">Show Clippy after boot</span>
            </div>
            <label class="settings-toggle">
              <input type="checkbox" id="settingsClippy" ${this._settings.clippy ? "checked" : ""}/>
              <span class="settings-track"><span class="settings-thumb"></span></span>
            </label>
          </div>
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">Skip Boot Screen</span>
              <span class="settings-label-desc">Bypass the login screen on startup</span>
            </div>
            <label class="settings-toggle">
              <input type="checkbox" id="settingsDisableBootScreen" ${this._settings.disableBootScreen ? "checked" : ""}/>
              <span class="settings-track"><span class="settings-thumb"></span></span>
            </label>
          </div>
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">Window Session Persistence</span>
              <span class="settings-label-desc">Remember and restore open windows on startup</span>
            </div>
            <label class="settings-toggle">
              <input type="checkbox" id="settingsWindowSessionPersistence" ${this._settings.windowSessionPersistence ? "checked" : ""}/>
              <span class="settings-track"><span class="settings-thumb"></span></span>
            </label>
          </div>
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">Performance Mode</span>
              <span class="settings-label-desc">Reduce heavy visual effects and animations</span>
            </div>
            <div class="settings-button-group">
              <button class="settings-btn ${this._settings.performanceMode === "high" ? "active" : ""}" data-perf-val="high"><i class="fas fa-tachometer-alt"></i> Quality</button>
              <button class="settings-btn ${this._settings.performanceMode === "balanced" ? "active" : ""}" data-perf-val="balanced"><i class="fas fa-balance-scale"></i> Balanced</button>
              <button class="settings-btn ${this._settings.performanceMode === "performance" ? "active" : ""}" data-perf-val="performance"><i class="fas fa-bolt"></i> Performance</button>
            </div>
          </div>
        </div>

        <div class="settings-card" style="margin-top: 16px;">
          <div class="settings-card-header"><i class="fas fa-shield-alt"></i> Integration & Privacy</div>
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">macOS Window Controls</span>
              <span class="settings-label-desc">Use macOS-style traffic light buttons</span>
            </div>
            <label class="settings-toggle">
              <input type="checkbox" id="settingsMacControls" ${this._settings.macOsControls ? "checked" : ""}/>
              <span class="settings-track"><span class="settings-thumb"></span></span>
            </label>
          </div>
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">Achievements</span>
              <span class="settings-label-desc">Enable or disable achievement system</span>
            </div>
            <label class="settings-toggle">
              <input type="checkbox" id="settingsAchievements" ${!this._settings.achievementsDisabled ? "checked" : ""}/>
              <span class="settings-track"><span class="settings-thumb"></span></span>
            </label>
          </div>
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">Analytics</span>
              <span class="settings-label-desc">Allow usage analytics</span>
            </div>
            <label class="settings-toggle">
              <input type="checkbox" id="settingsAnalytics" ${!this._settings.analyticsDisabled ? "checked" : ""}/>
              <span class="settings-track"><span class="settings-thumb"></span></span>
            </label>
          </div>
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">Do Not Disturb</span>
              <span class="settings-label-desc">Silence all toast notifications</span>
            </div>
            <label class="settings-toggle">
              <input type="checkbox" id="settingsDND" ${this._settings.dnd ? "checked" : ""}/>
              <span class="settings-track"><span class="settings-thumb"></span></span>
            </label>
          </div>
        </div>

        <div class="settings-card" style="margin-top: 16px;">
          <div class="settings-card-header"><i class="fas fa-bell"></i> Notifications</div>
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">Enable Notifications</span>
              <span class="settings-label-desc">Allow applications to show notifications</span>
            </div>
            <label class="settings-toggle">
              <input type="checkbox" id="settingsNotificationsEnabled" ${this._settings.notificationsEnabled ? "checked" : ""}/>
              <span class="settings-track"><span class="settings-thumb"></span></span>
            </label>
          </div>
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">Remove After Timeout</span>
              <span class="settings-label-desc">Automatically dismiss toast notifications after they expire</span>
            </div>
            <label class="settings-toggle">
              <input type="checkbox" id="settingsNotificationsRemoveTimeout" ${this._settings.notificationsRemoveTimeout ? "checked" : ""}/>
              <span class="settings-track"><span class="settings-thumb"></span></span>
            </label>
          </div>
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">Pop Animation</span>
              <span class="settings-label-desc">Show sliding pop animation when notifications appear</span>
            </div>
            <label class="settings-toggle">
              <input type="checkbox" id="settingsNotificationsPopAnimation" ${this._settings.notificationsPopAnimation ? "checked" : ""}/>
              <span class="settings-track"><span class="settings-thumb"></span></span>
            </label>
          </div>
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">Display Over Fullscreen</span>
              <span class="settings-label-desc">Show notifications over active fullscreen windows</span>
            </div>
            <label class="settings-toggle">
              <input type="checkbox" id="settingsNotificationsOverFullscreen" ${this._settings.notificationsOverFullscreen ? "checked" : ""}/>
              <span class="settings-track"><span class="settings-thumb"></span></span>
            </label>
          </div>
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">Notification Duration</span>
              <span class="settings-label-desc">Time in seconds before a notification expires</span>
            </div>
            <div class="settings-range-group" style="display: flex; align-items: center; gap: 12px;">
              <input type="range" id="settingsNotificationsDuration" min="1" max="30" step="1" value="${this._settings.notificationsDuration}" style="width: 120px;"/>
              <span class="settings-range-value" id="settingsNotificationsDurationVal" style="min-width: 24px; text-align: right; font-size: 0.9em; font-weight: 500;">${this._settings.notificationsDuration}s</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _renderDesktopSettings() {
    return `
      <div id="pane-desktop" class="settings-category-pane">
        <div class="settings-category-header">Desktop</div>
        
        <div class="settings-card">
          <div class="settings-card-header"><i class="fas fa-arrows-alt"></i> Layout & Alignment</div>
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">Disable Desktop Stretch Scroll</span>
              <span class="settings-label-desc">Prevent desktop page from expanding when windows are dragged out</span>
            </div>
            <label class="settings-toggle">
              <input type="checkbox" id="settingsDisableDesktopStretchScroll" ${this._settings.disableDesktopStretchScroll ? "checked" : ""}/>
              <span class="settings-track"><span class="settings-thumb"></span></span>
            </label>
          </div>
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">Show Workspaces</span>
              <span class="settings-label-desc">Show the workspaces area in the taskbar</span>
            </div>
            <label class="settings-toggle">
              <input type="checkbox" id="settingsShowWorkspace" ${this._settings.showWorkspace ? "checked" : ""}/>
              <span class="settings-track"><span class="settings-thumb"></span></span>
            </label>
          </div>
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">Taskbar Position</span>
              <span class="settings-label-desc">Dock the taskbar to an edge</span>
            </div>
            <div class="settings-button-group">
              <button class="settings-btn ${this._settings.taskbarPosition === "bottom" ? "active" : ""}" data-taskbar-pos="bottom"><i class="fas fa-arrow-down"></i> Bottom</button>
              <button class="settings-btn ${this._settings.taskbarPosition === "top" ? "active" : ""}" data-taskbar-pos="top"><i class="fas fa-arrow-up"></i> Top</button>
              <button class="settings-btn ${this._settings.taskbarPosition === "left" ? "active" : ""}" data-taskbar-pos="left"><i class="fas fa-arrow-left"></i> Left</button>
              <button class="settings-btn ${this._settings.taskbarPosition === "right" ? "active" : ""}" data-taskbar-pos="right"><i class="fas fa-arrow-right"></i> Right</button>
            </div>
          </div>
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">Taskbar Alignment</span>
              <span class="settings-label-desc">Choose alignment for taskbar icons</span>
            </div>
            <div class="settings-button-group">
              <button class="settings-btn ${this._settings.taskbarAlignment === "left" ? "active" : ""}" data-alignment="left">
                <i class="fas fa-align-left"></i> Left
              </button>
              <button class="settings-btn ${this._settings.taskbarAlignment === "center" ? "active" : ""}" data-alignment="center">
                <i class="fas fa-align-center"></i> Center
              </button>
              <button class="settings-btn ${this._settings.taskbarAlignment === "right" ? "active" : ""}" data-alignment="right">
                <i class="fas fa-align-right"></i> Right
              </button>
            </div>
          </div>
        </div>

        <div class="settings-card" style="margin-top: 16px;">
          <div class="settings-card-header"><i class="fas fa-bars"></i> Start Menu</div>
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">Start Menu Width</span>
              <span class="settings-label-desc">Adjust the width of the start menu</span>
            </div>
            <div class="settings-range-group">
              <input id="settingsStartMenuWidth" type="range" min="400" max="1000" step="10" value="${this._settings.startMenuWidth}"/>
              <span id="settingsStartMenuWidthValue" class="settings-range-value">${this._settings.startMenuWidth}px</span>
            </div>
          </div>
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">Start Menu Height</span>
              <span class="settings-label-desc">Adjust the height of the start menu</span>
            </div>
            <div class="settings-range-group">
              <input id="settingsStartMenuHeight" type="range" min="300" max="900" step="10" value="${this._settings.startMenuHeight}"/>
              <span id="settingsStartMenuHeightValue" class="settings-range-value">${this._settings.startMenuHeight}px</span>
            </div>
          </div>
          <div class="settings-row settings-row--stacked">
            <div class="settings-label-group">
              <span class="settings-label-title">Start Menu Categories</span>
              <span class="settings-label-desc">Toggle visibility of categories in the start menu sidebar</span>
            </div>
            <div style="margin-top: 10px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; width: 100%;">
              <label class="settings-grid-toggle">
                <span>Menu</span>
                <input type="checkbox" class="settings-start-cat-toggle" data-cat="menu" ${this._settings.startMenuCats.menu !== false ? "checked" : ""} style="display:none;"/>
                <span class="settings-track"><span class="settings-thumb"></span></span>
              </label>
              <label class="settings-grid-toggle">
                <span>Games</span>
                <input type="checkbox" class="settings-start-cat-toggle" data-cat="games" ${this._settings.startMenuCats.games !== false ? "checked" : ""} style="display:none;"/>
                <span class="settings-track"><span class="settings-thumb"></span></span>
              </label>
              <label class="settings-grid-toggle">
                <span>System</span>
                <input type="checkbox" class="settings-start-cat-toggle" data-cat="system" ${this._settings.startMenuCats.system !== false ? "checked" : ""} style="display:none;"/>
                <span class="settings-track"><span class="settings-thumb"></span></span>
              </label>
              <label class="settings-grid-toggle">
                <span>Favorites</span>
                <input type="checkbox" class="settings-start-cat-toggle" data-cat="favorites" ${this._settings.startMenuCats.favorites !== false ? "checked" : ""} style="display:none;"/>
                <span class="settings-track"><span class="settings-thumb"></span></span>
              </label>
              <label class="settings-grid-toggle">
                <span>Customize Profile</span>
                <input type="checkbox" class="settings-start-cat-toggle" data-cat="customize" ${this._settings.startMenuCats.customize !== false ? "checked" : ""} style="display:none;"/>
                <span class="settings-track"><span class="settings-thumb"></span></span>
              </label>
              <label class="settings-grid-toggle">
                <span>Settings</span>
                <input type="checkbox" class="settings-start-cat-toggle" data-cat="settingsApp" ${this._settings.startMenuCats.settingsApp !== false ? "checked" : ""} style="display:none;"/>
                <span class="settings-track"><span class="settings-thumb"></span></span>
              </label>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _renderAppearanceSettings() {
    return `
      <div id="pane-appearance" class="settings-category-pane">
        <div class="settings-category-header">Appearance</div>
        
        <div class="settings-card">
          <div class="settings-card-header"><i class="fas fa-palette"></i> Style & Transparency</div>
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">Theme</span>
              <span class="settings-label-desc">Set the OS color scheme</span>
            </div>
            <div class="settings-button-group">
              <button class="settings-btn ${this._settings.theme === "dark" ? "active" : ""}" data-theme-val="dark"><i class="fas fa-moon"></i> Dark</button>
              <button class="settings-btn ${this._settings.theme === "light" ? "active" : ""}" data-theme-val="light"><i class="fas fa-sun"></i> Light</button>
              <button class="settings-btn ${this._settings.theme === "auto" ? "active" : ""}" data-theme-val="auto"><i class="fas fa-circle-half-stroke"></i> Auto</button>
            </div>
          </div>
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">Window Transparency</span>
              <span class="settings-label-desc">Adjust window opacity</span>
            </div>
            <div class="settings-range-group">
              <input id="settingsWindowTransparency" type="range" min="20" max="100" step="1" value="${Math.round(this._settings.windowTransparency * 100)}"/>
              <span id="settingsWindowTransparencyValue" class="settings-range-value">${Math.round(this._settings.windowTransparency * 100)}%</span>
            </div>
          </div>
        </div>

        <div class="settings-card" style="margin-top: 16px;">
          <div class="settings-card-header"><i class="fas fa-mouse-pointer"></i> Custom Cursor</div>
          <div class="settings-row settings-row--stacked">
            <div class="settings-label-group">
              <span class="settings-label-title">Custom Cursor</span>
              <span class="settings-label-desc">Upload a PNG/JPG/GIF/WEBP cursor image for the OS</span>
            </div>
            <div class="settings-button-group" style="margin-top: 10px;">
              <button class="settings-btn" id="settingsCursorUploadBtn">
                <i class="fas fa-upload"></i> Upload
              </button>
              <button class="settings-btn settings-btn-warning" id="settingsCursorClearBtn" ${this._settings.cursorDataUrl ? "" : "disabled"}>
                <i class="fas fa-times"></i> Clear
              </button>
              <span id="settingsCursorStatus" class="settings-status-text">
                ${this._settings.cursorDataUrl ? "Custom cursor enabled" : "Default cursor"}
              </span>
            </div>
          </div>
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">Cursor Size</span>
              <span class="settings-label-desc">Scale the uploaded cursor image</span>
            </div>
            <div class="settings-range-group">
              <input id="settingsCursorSize" type="range" min="16" max="128" step="1" value="${this._settings.cursorSize}" ${this._settings.cursorDataUrl ? "" : "disabled"}/>
              <span id="settingsCursorSizeValue" class="settings-range-value">${this._settings.cursorSize}px</span>
            </div>
          </div>
        </div>

        <div id="settings-wallpaper-card" class="settings-card" style="margin-top: 16px;">
          <div class="settings-card-header"><i class="fas fa-images"></i> Wallpaper</div>
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">Cycle Wallpapers on Start</span>
              <span class="settings-label-desc">Automatically switch wallpapers on boot</span>
            </div>
            <label class="settings-toggle">
              <input type="checkbox" id="settingsCycleWallpaper" ${this._settings.cycleWallpaper ? "checked" : ""}/>
              <span class="settings-track"><span class="settings-thumb"></span></span>
            </label>
          </div>
          <div style="padding: 16px;">
            <div id="settings-wallpapers-container"></div>
          </div>
        </div>
      </div>
    `;
  }

  _renderToolsSettings() {
    return `
      <div id="pane-tools" class="settings-category-pane">
        <div class="settings-category-header">Tools</div>
        
        <div class="settings-card">
          <div class="settings-card-header"><i class="fas fa-eye-slash"></i> Desktop Visibility</div>
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">Hide Games</span>
              <span class="settings-label-desc">Toggle visibility of game icons on desktop</span>
            </div>
            <button class="settings-btn" id="settingsHideGamesBtn">
              <i class="fas fa-eye-slash"></i> Toggle
            </button>
          </div>
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">Hide System Apps</span>
              <span class="settings-label-desc">Toggle visibility of system apps on desktop</span>
            </div>
            <button class="settings-btn" id="settingsHideAppsBtn">
              <i class="fas fa-eye-slash"></i> Toggle
            </button>
          </div>
        </div>

        <div class="settings-card" style="margin-top: 16px;">
          <div class="settings-card-header"><i class="fas fa-download"></i> Save Yuki OS</div>
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">Download Page</span>
              <span class="settings-label-desc">Save a local copy of YukiOS</span>
            </div>
            <button class="settings-btn" id="settingsDownloadPageBtn">
              <i class="fas fa-download"></i> Download
            </button>
          </div>
        </div>
      </div>
    `;
  }

  _renderDataSettings() {
    return `
      <div id="pane-data" class="settings-category-pane">
        <div class="settings-category-header">Data & Storage</div>
        
        <div class="settings-card">
          <div class="settings-card-header"><i class="fas fa-copy"></i> Import / Export</div>
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">Export Data</span>
              <span class="settings-label-desc">Backup your system settings, files, and configuration</span>
            </div>
            <button class="settings-btn" id="btnExportData">
              <i class="fas fa-file-export"></i> Export
            </button>
          </div>
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">Import Data</span>
              <span class="settings-label-desc">Restore a previously saved system backup</span>
            </div>
            <button class="settings-btn" id="btnImportData">
              <i class="fas fa-file-import"></i> Import
            </button>
          </div>
        </div>

        <div class="settings-card" style="margin-top: 16px;">
          <div class="settings-card-header"><i class="fas fa-undo-alt"></i> Revert Options</div>
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">Reset Toggles</span>
              <span class="settings-label-desc">Revert all OS switches back to default</span>
            </div>
            <button class="settings-btn settings-btn-warning" id="btnResetToggles">
              <i class="fas fa-sliders-h"></i> Reset
            </button>
          </div>
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">Reset to Saved</span>
              <span class="settings-label-desc">Revert any unsaved changes to stored configuration</span>
            </div>
            <button class="settings-btn" id="btnResetSaved">
              <i class="fas fa-undo"></i> Revert
            </button>
          </div>
        </div>

        <div class="settings-card" style="margin-top: 16px; border-color: rgba(255, 77, 79, 0.25);">
          <div class="settings-card-header" style="color: #ff4d4f;"><i class="fas fa-exclamation-triangle"></i> Danger Zone</div>
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title" style="color: #ff4d4f;">Delete All Data</span>
              <span class="settings-label-desc">Permanently wipe all games, files, and OS settings</span>
            </div>
            <button class="settings-btn danger" style="background: #ff4d4f; color: white; border: none;" id="btnDeleteAllData">
              <i class="fas fa-trash"></i> Wipe
            </button>
          </div>
        </div>
      </div>
    `;
  }

  _renderNetworkSettings() {
    return `
      <div id="pane-network" class="settings-category-pane">
        <div class="settings-category-header">Network</div>
        
        <div class="settings-card">
          <div class="settings-card-header"><i class="fas fa-server"></i> Content Delivery Network</div>
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">CDN Mirror</span>
              <span class="settings-label-desc">Choose a mirror for fetching game assets</span>
            </div>
            <select id="settingsCdnMirror" class="settings-select">
              ${CDN_MIRRORS.map(
                (m) =>
                  `<option value="${m.id}" ${this._settings.cdnMirror === m.id ? "selected" : ""}>${m.name}</option>`
              ).join("")}
            </select>
          </div>
        </div>
      </div>
    `;
  }

  _renderAudioSettings() {
    const vol = Math.round((this._settings.soundEnabled ? this._settings.masterVolume : audioMixer.masterVolume) * 100);
    return `
      <div id="pane-audio" class="settings-category-pane">
        <div class="settings-category-header">Audio</div>
        
        <div class="settings-card">
          <div class="settings-card-header"><i class="fas fa-volume-up"></i> Volume Control</div>
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">Sound</span>
              <span class="settings-label-desc">Enable or mute all OS audio</span>
            </div>
            <label class="settings-toggle">
              <input type="checkbox" id="settingsSoundEnabled" ${this._settings.soundEnabled ? "checked" : ""}/>
              <span class="settings-track"><span class="settings-thumb"></span></span>
            </label>
          </div>
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">Master Volume</span>
              <span class="settings-label-desc">Global volume level for all apps</span>
            </div>
            <div class="settings-range-group">
              <input id="settingsMasterVolume" type="range" min="0" max="100" step="1" value="${vol}" ${!this._settings.soundEnabled ? "disabled" : ""}/>
              <span id="settingsMasterVolumeValue" class="settings-range-value">${vol}%</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _renderAboutSettings() {
    return `
      <div id="pane-about" class="settings-category-pane">
        <div class="settings-category-header">About</div>
        
        <div class="settings-card">
          <div class="settings-card-header"><i class="fas fa-info-circle"></i> OS Information</div>
          <div class="settings-row" style="flex-direction: column; align-items: flex-start; gap: 12px; padding: 20px;">
            <div style="display: flex; align-items: center; gap: 16px;">
              <img src="${resolveGhUrl("https://cdn.jsdelivr.net/gh/Reeyuki/yukios@main/static/icons/logo.png")}" style="width: 48px; height: 48px; object-fit: contain;" onerror="this.src='favicon.ico'"/>
              <div>
                <h2 style="margin:0;font-size:1.3em;font-weight:600;display:flex;align-items:center;gap:8px;color:#fff;">Yuki OS <span style="font-size:0.65em;background:var(--brand-dim, rgba(0, 120, 215, 0.1));color:var(--brand, #0078d7);padding:2px 8px;border-radius:4px;font-weight:500;">${YUKIOS_VERSION}</span></h2>
                <p style="margin:4px 0 0 0;color:rgba(255,255,255,0.5);font-size:0.8em;">Browser desktop environment</p>
              </div>
            </div>
            <p style="margin:0;color:rgba(255,255,255,0.75);font-size:0.9em;line-height:1.5;">
              A fully featured desktop OS experience running directly in your web browser. Includes emulators, tools, PWA support, virtual filesystem, and 2700+ classic games.
            </p>
          </div>
        </div>

        <div class="settings-card" style="margin-top: 16px;">
          <div class="settings-card-header"><i class="fab fa-discord"></i> Community</div>
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">YukiCord</span>
              <span class="settings-label-desc">Join our Discord server</span>
            </div>
            <a href="https://discord.gg/2Z8Gvtqt7" target="_blank" rel="noopener noreferrer" class="settings-discord-link">
              <button class="settings-btn settings-btn-discord">
                <i class="fab fa-discord"></i> Join
              </button>
            </a>
          </div>
        </div>
      </div>
    `;
  }

  _bindControls(win) {
    const status = win.querySelector("#settingsStatus");
    const showStatus = (msg = "Saved") => {
      status.textContent = msg;
      status.style.opacity = "1";
      clearTimeout(this._statusTimer);
      this._statusTimer = setTimeout(() => {
        status.style.opacity = "0";
      }, 2200);
    };

    const save = () => {
      const weatherToggle = win.querySelector("#settingsWeather");
      const cycleWallpaperToggle = win.querySelector("#settingsCycleWallpaper");
      const macControlsToggle = win.querySelector("#settingsMacControls");
      const clippyToggle = win.querySelector("#settingsClippy");
      const achievementsToggle = win.querySelector("#settingsAchievements");
      const analyticsToggle = win.querySelector("#settingsAnalytics");
      const disableDesktopStretchScrollToggle = win.querySelector("#settingsDisableDesktopStretchScroll");
      const showWorkspaceToggle = win.querySelector("#settingsShowWorkspace");
      const cdnMirrorSelect = win.querySelector("#settingsCdnMirror");

      const notificationsEnabledToggle = win.querySelector("#settingsNotificationsEnabled");
      const notificationsRemoveTimeoutToggle = win.querySelector("#settingsNotificationsRemoveTimeout");
      const notificationsPopAnimationToggle = win.querySelector("#settingsNotificationsPopAnimation");
      const notificationsOverFullscreenToggle = win.querySelector("#settingsNotificationsOverFullscreen");
      const notificationsDurationSlider = win.querySelector("#settingsNotificationsDuration");

      const weather = weatherToggle.checked;
      const cycleWallpaper = cycleWallpaperToggle.checked;
      const macOsControls = macControlsToggle.checked;
      const clippy = clippyToggle.checked;
      const achievementsDisabled = !achievementsToggle.checked;
      const analyticsDisabled = !analyticsToggle.checked;
      const disableDesktopStretchScroll = !!disableDesktopStretchScrollToggle?.checked;
      const showWorkspace = showWorkspaceToggle ? showWorkspaceToggle.checked : true;
      const selectedAlignment =
        win.querySelector(".settings-btn[data-alignment].active")?.dataset.alignment || "center";
      const cdnMirror = cdnMirrorSelect.value;

      const notificationsEnabled = !!notificationsEnabledToggle?.checked;
      const notificationsRemoveTimeout = !!notificationsRemoveTimeoutToggle?.checked;
      const notificationsPopAnimation = !!notificationsPopAnimationToggle?.checked;
      const notificationsOverFullscreen = !!notificationsOverFullscreenToggle?.checked;
      const notificationsDuration = notificationsDurationSlider ? Number(notificationsDurationSlider.value) : 5;

      localStorage.setItem(StorageKeys.weather, String(weather));
      localStorage.setItem(StorageKeys.cycleWallpaper, String(cycleWallpaper));
      localStorage.setItem(StorageKeys.macOsControls, String(macOsControls));
      localStorage.setItem(StorageKeys.clippy, String(clippy));
      localStorage.setItem(StorageKeys.disableDesktopStretchScroll, String(disableDesktopStretchScroll));
      localStorage.setItem("yukiOS_show_workspace", String(showWorkspace));
      localStorage.setItem(StorageKeys.achievementsDisabled, String(achievementsDisabled));
      localStorage.setItem(StorageKeys.analyticsDisabled, String(analyticsDisabled));
      localStorage.setItem(StorageKeys.taskbarAlignment, selectedAlignment);
      localStorage.setItem(StorageKeys.cdnMirror, cdnMirror);
      localStorage.setItem(StorageKeys.notificationsEnabled, String(notificationsEnabled));
      localStorage.setItem(StorageKeys.notificationsRemoveTimeout, String(notificationsRemoveTimeout));
      localStorage.setItem(StorageKeys.notificationsPopAnimation, String(notificationsPopAnimation));
      localStorage.setItem(StorageKeys.notificationsOverFullscreen, String(notificationsOverFullscreen));
      localStorage.setItem(StorageKeys.notificationsDuration, String(notificationsDuration));
      const disableBootScreenToggle = win.querySelector("#settingsDisableBootScreen");
      const disableBootScreen = !!disableBootScreenToggle?.checked;
      localStorage.setItem(StorageKeys.disableBootScreen, String(disableBootScreen));

      const windowSessionPersistenceToggle = win.querySelector("#settingsWindowSessionPersistence");
      const windowSessionPersistence = !!windowSessionPersistenceToggle?.checked;
      localStorage.setItem(StorageKeys.windowSessionPersistence, String(windowSessionPersistence));

      const selectedPerformanceMode =
        win.querySelector(".settings-btn[data-perf-val].active")?.dataset.perfVal || "high";
      localStorage.setItem(StorageKeys.performanceMode, selectedPerformanceMode);

      const startMenuWidthInput = win.querySelector("#settingsStartMenuWidth");
      const startMenuHeightInput = win.querySelector("#settingsStartMenuHeight");
      const startMenuWidth = startMenuWidthInput ? Number(startMenuWidthInput.value) : 650;
      const startMenuHeight = startMenuHeightInput ? Number(startMenuHeightInput.value) : 500;

      const startMenuCats = {};
      win.querySelectorAll(".settings-start-cat-toggle").forEach((chk) => {
        startMenuCats[chk.dataset.cat] = chk.checked;
      });

      localStorage.setItem(StorageKeys.startMenuWidth, String(startMenuWidth));
      localStorage.setItem(StorageKeys.startMenuHeight, String(startMenuHeight));
      localStorage.setItem(StorageKeys.startMenuCats, JSON.stringify(startMenuCats));

      Object.assign(this._settings, {
        weather,
        cycleWallpaper,
        macOsControls,
        clippy,
        disableDesktopStretchScroll,
        showWorkspace,
        achievementsDisabled,
        analyticsDisabled,
        taskbarAlignment: selectedAlignment,
        cdnMirror,
        disableBootScreen,
        windowSessionPersistence,
        startMenuWidth,
        startMenuHeight,
        startMenuCats,
        performanceMode: selectedPerformanceMode,
        notificationsEnabled,
        notificationsRemoveTimeout,
        notificationsPopAnimation,
        notificationsOverFullscreen,
        notificationsDuration
      });

      this.wm.saveSession();

      setCdnMirror(cdnMirror);
      initializeMirrors(appMap);
      this._applyDesktopStretchScrollDisabled(disableDesktopStretchScroll);
      this._applyStartMenuSize(startMenuWidth, startMenuHeight);
      this._applyStartMenuCats(startMenuCats);
      this._applyPerformanceMode(selectedPerformanceMode);
      bus.emit(BusEvents.SETTINGS_CHANGED, this._settings);
      if (this._settings.cdnMirror && this._settings.cdnMirror !== cdnMirror) {
        showStatus("Reloading with new CDN...");
        setTimeout(() => window.location.reload(), 500);
      } else {
        showStatus("Saved");
      }
    };

    this._bindNavigation(win);
    this._bindSystemCategory(win, save);
    this._bindDesktopCategory(win, save);
    this._bindAppearanceCategory(win, save, showStatus);
    this._bindToolsCategory(win, showStatus);
    this._bindDataCategory(win, showStatus, save);
    this._bindNetworkCategory(win, save);
    this._bindAudioCategory(win, showStatus);
  }

  _bindNavigation(win) {
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
          if (title.includes(query) || desc.includes(query)) {
            row.classList.remove("hidden-by-search");
          } else {
            row.classList.add("hidden-by-search");
          }
        });

        panes.forEach((pane) => {
          let paneHasVisibleRows = false;
          pane.querySelectorAll(".settings-card").forEach((card) => {
            const visibleRowsInCard = card.querySelectorAll(".settings-row:not(.hidden-by-search)");
            if (visibleRowsInCard.length > 0) {
              card.style.display = "";
              paneHasVisibleRows = true;
            } else {
              card.style.display = "none";
            }
          });

          const visibleStandaloneRows = pane.querySelectorAll(
            ".settings-category-pane > .settings-row:not(.hidden-by-search)"
          );
          if (visibleStandaloneRows.length > 0) {
            paneHasVisibleRows = true;
          }

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

  _bindSystemCategory(win, save) {
    win.querySelector("#settingsWeather").addEventListener("change", save);
    win.querySelector("#settingsMacControls").addEventListener("change", save);
    win.querySelector("#settingsClippy").addEventListener("change", save);
    win.querySelector("#settingsAchievements").addEventListener("change", save);
    win.querySelector("#settingsAnalytics").addEventListener("change", save);
    win.querySelector("#settingsDisableBootScreen")?.addEventListener("change", save);
    win.querySelector("#settingsWindowSessionPersistence")?.addEventListener("change", save);

    win.querySelectorAll(".settings-btn[data-perf-val]").forEach((btn) => {
      btn.addEventListener("click", () => {
        win.querySelectorAll(".settings-btn[data-perf-val]").forEach((b) => b.classList.toggle("active", b === btn));
        save();
      });
    });

    const dndToggle = win.querySelector("#settingsDND");
    if (dndToggle) {
      dndToggle.addEventListener("change", () => {
        const enabled = dndToggle.checked;
        this._settings.dnd = enabled;
        localStorage.setItem(StorageKeys.dndKey, enabled ? "1" : "0");
        this._notificationCenter?.setDoNotDisturb(enabled);
      });
    }

    win.querySelector("#settingsNotificationsEnabled")?.addEventListener("change", save);
    win.querySelector("#settingsNotificationsRemoveTimeout")?.addEventListener("change", save);
    win.querySelector("#settingsNotificationsPopAnimation")?.addEventListener("change", save);
    win.querySelector("#settingsNotificationsOverFullscreen")?.addEventListener("change", save);

    const durationInput = win.querySelector("#settingsNotificationsDuration");
    const durationVal = win.querySelector("#settingsNotificationsDurationVal");
    if (durationInput) {
      durationInput.addEventListener("input", () => {
        if (durationVal) durationVal.textContent = `${durationInput.value}s`;
      });
      durationInput.addEventListener("change", save);
    }
  }

  _bindDesktopCategory(win, save) {
    const stretchToggle = win.querySelector("#settingsDisableDesktopStretchScroll");
    if (stretchToggle) stretchToggle.addEventListener("change", save);

    const workspaceToggle = win.querySelector("#settingsShowWorkspace");
    if (workspaceToggle) workspaceToggle.addEventListener("change", save);

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
        this._settings.taskbarPosition = pos;
        localStorage.setItem(StorageKeys.taskbarPosition, pos);
        const { taskbarPositionManager: tpm } = await import("./taskbarPositionManager.js");
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
  }

  _bindAppearanceCategory(win, save, showStatus) {
    win.querySelector("#settingsCycleWallpaper").addEventListener("change", save);

    win.querySelectorAll(".settings-btn[data-theme-val]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const theme = btn.dataset.themeVal;
        win.querySelectorAll(".settings-btn[data-theme-val]").forEach((b) => b.classList.toggle("active", b === btn));
        this._settings.theme = theme;
        localStorage.setItem(StorageKeys.theme, theme);
        this._applyTheme(theme);
        showStatus("Theme applied");
      });
    });

    const transparencySlider = win.querySelector("#settingsWindowTransparency");
    const transparencyValue = win.querySelector("#settingsWindowTransparencyValue");
    if (transparencySlider) {
      transparencySlider.addEventListener("input", () => {
        if (transparencyValue) transparencyValue.textContent = `${transparencySlider.value}%`;
      });
      transparencySlider.addEventListener("change", () => {
        const val = parseInt(transparencySlider.value) / 100;
        this._settings.windowTransparency = val;
        localStorage.setItem(StorageKeys.windowTransparency, String(val));
        this._applyWindowTransparency(val);
        showStatus("Saved");
      });
    }

    const wallpapersContainer = win.querySelector("#settings-wallpapers-container");
    if (wallpapersContainer && this.fs && this.wm) {
      renderWallpapersPage(this.fs, this.wm, wallpapersContainer);
    }

    const cursorUploadBtn = win.querySelector("#settingsCursorUploadBtn");
    const cursorClearBtn = win.querySelector("#settingsCursorClearBtn");
    const cursorStatus = win.querySelector("#settingsCursorStatus");
    const cursorSizeInput = win.querySelector("#settingsCursorSize");
    const cursorSizeValue = win.querySelector("#settingsCursorSizeValue");

    const setCursor = (dataUrl, originalDataUrl = null) => {
      const cursorDataUrl = typeof dataUrl === "string" ? dataUrl : "";
      const cursorOriginalDataUrl =
        originalDataUrl === null
          ? this._settings.cursorOriginalDataUrl
          : typeof originalDataUrl === "string"
            ? originalDataUrl
            : "";

      if (cursorDataUrl) localStorage.setItem(StorageKeys.cursorKey, cursorDataUrl);
      else localStorage.removeItem(StorageKeys.cursorKey);

      if (cursorOriginalDataUrl) localStorage.setItem(StorageKeys.cursorOriginalKey, cursorOriginalDataUrl);
      else localStorage.removeItem(StorageKeys.cursorOriginalKey);

      this._settings.cursorDataUrl = cursorDataUrl;
      this._settings.cursorOriginalDataUrl = cursorOriginalDataUrl;
      Object.assign(window._settings, this._settings);

      this._applyCursor(cursorDataUrl);

      if (cursorClearBtn) cursorClearBtn.disabled = !cursorDataUrl;
      if (cursorStatus) cursorStatus.textContent = cursorDataUrl ? "Custom cursor enabled" : "Default cursor";
      if (cursorSizeInput) cursorSizeInput.disabled = !cursorDataUrl;
      showStatus("Saved");
    };

    const setCursorSize = async (size) => {
      const cursorSize = Number(size);
      if (!Number.isFinite(cursorSize) || cursorSize < 16 || cursorSize > 128) return;
      this._settings.cursorSize = cursorSize;

      try {
        localStorage.setItem(StorageKeys.cursorSizeKey, String(cursorSize));
      } catch {}
      if (cursorSizeValue) cursorSizeValue.textContent = `${cursorSize}px`;
      Object.assign(window._settings, this._settings);

      const original = this._settings.cursorOriginalDataUrl;
      if (!original) return;
      try {
        const normalized = await this._normalizeCursorDataUrl(original, { maxSize: cursorSize });
        setCursor(normalized, original);
      } catch (e) {
        console.error("Failed to resize cursor:", e);
      }
    };

    if (cursorUploadBtn)
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
            const normalized = await this._normalizeCursorDataUrl(dataUrl, {
              maxSize: this._settings.cursorSize || 32
            });
            setCursor(normalized, dataUrl);
          } catch (e) {
            console.error("Cursor upload failed:", e);
            customAlert("Failed to set cursor. Check console for details.");
          }
        });

        input.click();
      });

    if (cursorClearBtn)
      cursorClearBtn.addEventListener("click", () => {
        try {
          localStorage.removeItem(StorageKeys.cursorSizeKey);
        } catch {}
        if (cursorSizeInput) cursorSizeInput.value = "32";
        if (cursorSizeValue) cursorSizeValue.textContent = "32px";
        this._settings.cursorSize = 32;
        setCursor("", "");
      });

    if (cursorSizeInput) {
      cursorSizeInput.addEventListener("input", () => {
        if (cursorSizeValue) cursorSizeValue.textContent = `${cursorSizeInput.value}px`;
      });
      cursorSizeInput.addEventListener("change", () => setCursorSize(cursorSizeInput.value));
    }
  }

  _bindToolsCategory(win, showStatus) {
    const hideGamesBtn = win.querySelector("#settingsHideGamesBtn");
    if (hideGamesBtn) {
      hideGamesBtn.addEventListener("click", () => {
        toggleHideGames();
        showStatus("Games visibility toggled");
      });
    }
    const hideAppsBtn = win.querySelector("#settingsHideAppsBtn");
    if (hideAppsBtn) {
      hideAppsBtn.addEventListener("click", () => {
        toggleHideSystemApps();
        showStatus("Apps visibility toggled");
      });
    }

    const downloadPageBtn = win.querySelector("#settingsDownloadPageBtn");
    if (downloadPageBtn) {
      downloadPageBtn.addEventListener("click", async () => {
        try {
          const url = "https://yukios.vercel.app/";
          const filename = "yukios.html";
          const response = await fetch(url);
          if (!response.ok) throw new Error(`Response status: ${response.status}`);
          const htmlContent = await response.text();
          const blob = new Blob([htmlContent], { type: "text/html" });
          const downloadUrl = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = downloadUrl;
          link.download = filename;
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
  }

  _bindDataCategory(win, showStatus, save) {
    win.querySelector("#btnExportData")?.addEventListener("click", () => this.exportData(showStatus));
    win.querySelector("#btnImportData")?.addEventListener("click", () => this.importData(showStatus));
    win.querySelector("#btnDeleteAllData")?.addEventListener("click", () => this.deleteAllData());

    win.querySelector("#btnResetSaved")?.addEventListener("click", () => {
      win.querySelector("#settingsWeather").checked = this._settings.weather;
      win.querySelector("#settingsCycleWallpaper").checked = this._settings.cycleWallpaper;
      win.querySelector("#settingsMacControls").checked = this._settings.macOsControls;
      win.querySelector("#settingsClippy").checked = this._settings.clippy;
      win.querySelector("#settingsAchievements").checked = !this._settings.achievementsDisabled;
      win.querySelector("#settingsAnalytics").checked = !this._settings.analyticsDisabled;
      const stretchToggle = win.querySelector("#settingsDisableDesktopStretchScroll");
      if (stretchToggle) stretchToggle.checked = !!this._settings.disableDesktopStretchScroll;
      const workspaceToggle = win.querySelector("#settingsShowWorkspace");
      if (workspaceToggle) workspaceToggle.checked = !!this._settings.showWorkspace;
      const disableBootScreenToggle = win.querySelector("#settingsDisableBootScreen");
      if (disableBootScreenToggle) disableBootScreenToggle.checked = !!this._settings.disableBootScreen;
      win.querySelectorAll(".settings-btn[data-perf-val]").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.perfVal === this._settings.performanceMode);
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
      const stretchToggle = win.querySelector("#settingsDisableDesktopStretchScroll");
      if (stretchToggle) stretchToggle.checked = false;
      const workspaceToggle2 = win.querySelector("#settingsShowWorkspace");
      if (workspaceToggle2) workspaceToggle2.checked = true;
      const disableBootScreenToggle = win.querySelector("#settingsDisableBootScreen");
      if (disableBootScreenToggle) disableBootScreenToggle.checked = false;
      win.querySelectorAll(".settings-btn[data-perf-val]").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.perfVal === "high");
      });

      save();
      showStatus("Toggles reset");
    });
  }

  _bindNetworkCategory(win, save) {
    const cdnMirrorSelect = win.querySelector("#settingsCdnMirror");
    if (cdnMirrorSelect) cdnMirrorSelect.addEventListener("change", save);
  }

  _bindAudioCategory(win, showStatus) {
    const soundToggle = win.querySelector("#settingsSoundEnabled");
    const volumeSlider = win.querySelector("#settingsMasterVolume");
    const volumeValue = win.querySelector("#settingsMasterVolumeValue");

    if (soundToggle) {
      soundToggle.addEventListener("change", () => {
        const enabled = soundToggle.checked;
        this._settings.soundEnabled = enabled;
        localStorage.setItem(StorageKeys.soundEnabled, String(enabled));
        if (volumeSlider) volumeSlider.disabled = !enabled;
        this._applySound(enabled, this._settings.masterVolume);
        showStatus("Saved");
      });
    }

    if (volumeSlider) {
      volumeSlider.addEventListener("input", () => {
        if (volumeValue) volumeValue.textContent = `${volumeSlider.value}%`;
      });
      volumeSlider.addEventListener("change", () => {
        const val = parseInt(volumeSlider.value) / 100;
        this._settings.masterVolume = val;
        localStorage.setItem(StorageKeys.masterVolume, String(val));
        if (this._settings.soundEnabled) audioMixer.setMaster(val);
        showStatus("Saved");
      });
    }
  }

  _applyTheme(theme) {
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
    const effective = theme === "auto" ? (prefersDark ? "dark" : "light") : theme;
    document.documentElement.setAttribute("data-theme", effective);

    let styleEl = document.getElementById("yukios-theme-override");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "yukios-theme-override";
      document.head.appendChild(styleEl);
    }

    if (effective === "light") {
      styleEl.textContent = `
        :root { --window-bg-color: #f2f2f2; --text-color: #111; }
      `;
    } else {
      styleEl.textContent = "";
    }
  }

  _applyWindowTransparency(value) {
    const opacity = Math.max(0.2, Math.min(1, Number(value)));
    let styleEl = document.getElementById("yukios-transparency-override");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "yukios-transparency-override";
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = opacity < 1 ? `.window { opacity: ${opacity} !important; }` : "";
  }

  _applySound(enabled, volume) {
    const vol = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 1;
    audioMixer.setMaster(enabled ? vol : 0);
  }

  _applyDesktopStretchScrollDisabled(disabled) {
    if (!desktop) return;
    desktop.style.overflow = "auto";

    const desktopRect = desktop.getBoundingClientRect();
    const windows = document.querySelectorAll(".window");
    windows.forEach((win) => {
      if (!(win instanceof HTMLElement)) return;
      const isFullscreen = win.dataset.fullscreen === "true";
      if (isFullscreen) return;

      const rect = win.getBoundingClientRect();
      const currentPos = getComputedStyle(win).position;

      if (disabled) {
        if (currentPos === "fixed") return;
        win.style.left = `${rect.left}px`;
        win.style.top = `${rect.top}px`;
        win.style.position = "fixed";
      } else {
        if (currentPos !== "fixed") return;
        const left = rect.left - desktopRect.left + desktop.scrollLeft;
        const top = rect.top - desktopRect.top + desktop.scrollTop;
        win.style.left = `${left}px`;
        win.style.top = `${top}px`;
        win.style.position = "absolute";
      }
    });
  }

  _applyStartMenuSize(width, height) {
    const el = document.getElementById("start-menu") || document.querySelector(".start-menu");
    if (el) {
      el.style.width = `${width}px`;
      el.style.height = `${height}px`;
    }
  }

  _applyStartMenuCats(cats) {
    const el = document.getElementById("start-menu") || document.querySelector(".start-menu");
    if (el) {
      const catNames = ["menu", "games", "system", "favorites", "customize", "settingsApp"];
      catNames.forEach((catName) => {
        const isEnabled = cats[catName] !== false;
        const catEl = el.querySelector(`.start-cat[data-cat="${catName}"]`);
        if (catEl) {
          catEl.style.display = isEnabled ? "flex" : "none";
        }
      });
    }
  }

  _applyCursor(dataUrl) {
    const styleId = "yukios-custom-cursor";
    const existing = document.getElementById(styleId);
    if (!dataUrl) {
      existing?.remove();
      return;
    }

    const safeUrl = String(dataUrl).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const css = `
      html, body, body * { cursor: url("${safeUrl}") 0 0, auto !important; }
      input, textarea { cursor: text !important; }
    `;

    const el = existing || document.createElement("style");
    el.id = styleId;
    el.textContent = css;
    if (!existing) document.head.appendChild(el);
    else document.head.appendChild(el);
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

  _dumpStorage(storage) {
    const out = {};
    try {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key) continue;
        out[key] = storage.getItem(key);
      }
    } catch {}
    return out;
  }

  _restoreStorage(storage, data) {
    if (!data || typeof data !== "object") return;
    try {
      for (const [k, v] of Object.entries(data)) {
        if (typeof k !== "string") continue;
        storage.setItem(k, v);
      }
    } catch {}
  }

  _downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async exportData(showStatus = () => {}) {
    if (!this.fs) {
      customAlert("Filesystem manager not available; cannot export filesystem data.");
      return;
    }
    try {
      showStatus("Exporting…");
      const fsSnapshot = await this.fs.exportSnapshot();
      const payload = {
        version: 1,
        createdAt: Date.now(),
        localStorage: this._dumpStorage(localStorage),
        sessionStorage: this._dumpStorage(sessionStorage),
        fs: fsSnapshot
      };
      const json = JSON.stringify(payload);
      const blob = new Blob([json], { type: "application/json" });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      this._downloadBlob(blob, `yukiOS-backup-${stamp}.json`);
      showStatus("Exported");
    } catch (e) {
      console.error("Export failed:", e);
      customAlert("Export failed. Check console for details.");
      showStatus("Export failed");
    }
  }

  async importData(showStatus = () => {}) {
    if (!this.fs) {
      customAlert("Filesystem manager not available; cannot import filesystem data.");
      return;
    }
    const confirmed = await customConfirm(
      "This will overwrite your current settings and filesystem contents.\nThis action cannot be undone."
    );
    if (!confirmed) return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.style.display = "none";
    document.body.appendChild(input);

    const cleanup = () => {
      input.remove();
    };

    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      cleanup();
      if (!file) return;

      try {
        showStatus("Importing…");
        const text = await file.text();
        const payload = JSON.parse(text);
        if (!payload || payload.version !== 1 || !payload.fs) throw new Error("Invalid backup file.");

        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch {}
        this._restoreStorage(localStorage, payload.localStorage);
        this._restoreStorage(sessionStorage, payload.sessionStorage);
        await this.fs.importSnapshot(payload.fs, { wipe: true });

        showStatus("Imported (reloading)...");
        setTimeout(() => location.reload(), 400);
      } catch (e) {
        console.error("Import failed:", e);
        customAlert("Import failed. The file may be invalid or corrupted. Check console for details.");
        showStatus("Import failed");
      }
    });

    input.click();
  }

  deleteAllData = async () => {
    const confirmed = await customConfirm(
      "⚠️ WARNING: Delete All Data\n\n" +
        "This will permanently delete:\n" +
        "• All game progresses,saved files, settings, and preferences\n\n" +
        "This action cannot be undone.\n\n" +
        "Are you sure you want to continue?"
    );
    if (!confirmed) return;

    try {
      const localStorageKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) localStorageKeys.push(key);
      }

      localStorageKeys.forEach((key) => {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          console.warn(`Failed to remove localStorage key: ${key}`, e);
        }
      });

      const sessionStorageKeys = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) sessionStorageKeys.push(key);
      }

      sessionStorageKeys.forEach((key) => {
        try {
          sessionStorage.removeItem(key);
        } catch (e) {
          console.warn(`Failed to remove sessionStorage key: ${key}`, e);
        }
      });

      await this._deleteAllIndexedDBDatabases();

      if ("caches" in window) {
        try {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map((name) => caches.delete(name)));
        } catch (e) {
          console.warn("Failed to clear caches:", e);
        }
      }

      location.reload();
    } catch (error) {
      console.error("Error deleting all data:", error);
      customAlert("An error occurred while deleting data. Some data may remain. The page will now reload.");
      location.reload();
    }
  };

  _deleteAllIndexedDBDatabases = async () => {
    if (typeof indexedDB.databases === "function") {
      try {
        const databases = await indexedDB.databases();
        const deletePromises = databases.map((dbInfo) => {
          return new Promise((resolve) => {
            if (!dbInfo.name) {
              resolve();
              return;
            }
            const request = indexedDB.deleteDatabase(dbInfo.name);
            request.onsuccess = () => {
              console.log(`Deleted IndexedDB: ${dbInfo.name}`);
              resolve();
            };
            request.onerror = (e) => {
              console.warn(`Failed to delete IndexedDB: ${dbInfo.name}`, e);
              resolve();
            };
            request.onblocked = () => {
              console.warn(`IndexedDB deletion blocked: ${dbInfo.name}`);
              resolve();
            };
          });
        });
        await Promise.all(deletePromises);
        return;
      } catch (e) {
        console.warn("indexedDB.databases() failed, falling back to known names:", e);
      }
    }

    const knownDatabaseNames = this._generateDatabaseNameVariations();

    const deletePromises = knownDatabaseNames.map((dbName) => {
      return new Promise((resolve) => {
        try {
          const request = indexedDB.deleteDatabase(dbName);
          request.onsuccess = () => {
            console.log(`Deleted IndexedDB: ${dbName}`);
            resolve();
          };
          request.onerror = () => resolve();
          request.onblocked = () => resolve();
        } catch (e) {
          resolve();
        }
      });
    });

    await Promise.all(deletePromises);
  };
  _generateDatabaseNameVariations = () => {
    const prefixes = ["yuki", "yukiOS", "app", "data", "cache", "store"];
    const suffixes = ["db", "DB", "database", "Database", "store", "Store", "cache", "Cache", "data", "Data"];
    const variations = [];

    prefixes.forEach((prefix) => {
      suffixes.forEach((suffix) => {
        variations.push(`${prefix}-${suffix}`);
        variations.push(`${prefix}_${suffix}`);
        variations.push(`${prefix}${suffix}`);
      });
    });

    return variations;
  };

  resetModuleData = async () => {
    const confirmed = await customConfirm("This will reset OS settings defined by the module and reload. Continue?");
    if (!confirmed) return;

    Object.values(StorageKeys).forEach((key) => localStorage.removeItem(key));
    location.reload();
  };

  _applyPerformanceMode(mode) {
    const effective = mode || "high";
    document.documentElement.setAttribute("data-performance", effective);

    let styleEl = document.getElementById("yukios-performance-override");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "yukios-performance-override";
      document.head.appendChild(styleEl);
    }

    if (effective === "performance") {
      styleEl.textContent = `
        html[data-performance="performance"] *:not(.start-menu):not(.start-menu *),
        html[data-performance="performance"] *:not(.start-menu):not(.start-menu *)::before,
        html[data-performance="performance"] *:not(.start-menu):not(.start-menu *)::after {
          animation: none !important;
          transition: none !important;
        }
        html[data-performance="performance"] .window,
        html[data-performance="performance"] .window-header,
        html[data-performance="performance"] .taskbar-preview,
        html[data-performance="performance"] .context-menu {
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }
        html[data-performance="performance"] .window,
        html[data-performance="performance"] .taskbar-preview,
        html[data-performance="performance"] .context-menu {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4) !important;
        }
        html[data-performance="performance"] *:not(.start-menu):not(.start-menu *) {
          text-shadow: none !important;
        }
        html[data-performance="performance"] .window:hover {
          transform: none !important;
        }
        html[data-performance="performance"] .icon:hover img {
          transform: none !important;
        }
        html[data-performance="performance"] #snap-ghost {
          transition: none !important;
          transform: none !important;
        }
        html[data-performance="performance"] #snap-ghost:not(.snap-ghost-active) {
          display: none !important;
        }
      `;
    } else if (effective === "balanced") {
      styleEl.textContent = `
        html[data-performance="balanced"] *:not(.start-menu):not(.start-menu *),
        html[data-performance="balanced"] *:not(.start-menu):not(.start-menu *)::before,
        html[data-performance="balanced"] *:not(.start-menu):not(.start-menu *)::after {
          animation-duration: 0.15s !important;
          transition-duration: 0.15s !important;
        }
        html[data-performance="balanced"] .window {
          backdrop-filter: blur(12px) !important;
          -webkit-backdrop-filter: blur(12px) !important;
        }
        html[data-performance="balanced"] .window-header {
          backdrop-filter: blur(8px) saturate(1.1) !important;
          -webkit-backdrop-filter: blur(8px) saturate(1.1) !important;
        }
        html[data-performance="balanced"] .window,
        html[data-performance="balanced"] .taskbar-preview,
        html[data-performance="balanced"] .context-menu {
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5) !important;
        }
        html[data-performance="balanced"] .window:hover {
          transform: none !important;
        }
        html[data-performance="balanced"] .icon:hover img {
          transform: scale(1.02) !important;
        }
        html[data-performance="balanced"] #snap-ghost {
          transition-duration: 0.1s !important;
        }
      `;
    } else {
      styleEl.textContent = "";
    }
  }

  get(key) {
    return this._settings[key];
  }
}
