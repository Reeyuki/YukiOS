import { desktop } from "./desktop.js";
import { skipBootSequence, SystemUtilities } from "./system.js";
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const shouldDisableClippy = isMobile || isLocalhost;

export const StorageKeys = {
  username: "yukiOS_username",
  bootAnimation: "yukiOS_bootAnimation",
  weather: "yukiOS_weather",
  positionsKey: "yukiOS_desktop:icon-positions",
  favoritesKey: "yukiOS_Favorites",
  wallpaperKey: "yukiOS_selectedWallpaper",
  wallpaperIndexKey: "yukiOS_wallpaperIndex",
  lastBoot: "yukiOS_lastBoot",
  cycleWallpaper: "yukiOS_cycleWallpaper",
  manualWallpaper: "yukiOS_manualWallpaper",
  macOsControls: "yukiOS_macOsControls",
  clippy: "yukiOS_clippy",
  calendarEvents: "yukiOS_calendar_events"
};

export class SettingsApp {
  constructor(windowManager) {
    this.wm = windowManager;

    setTimeout(() => {
      this._settings = {
        username: localStorage.getItem(StorageKeys.username) ?? "",
        bootAnimation: localStorage.getItem(StorageKeys.bootAnimation) !== "false",
        weather: localStorage.getItem(StorageKeys.weather) !== "false",
        cycleWallpaper: localStorage.getItem(StorageKeys.cycleWallpaper) !== "false",
        macOsControls: localStorage.getItem(StorageKeys.macOsControls) === "true",
        // Check if a saved preference exists; if not, apply the "disable" rule
        clippy:
          localStorage.getItem(StorageKeys.clippy) !== null
            ? localStorage.getItem(StorageKeys.clippy) !== "false"
            : !shouldDisableClippy
      };
      this._applyUsername(this._settings.username);
      window._settings = this._settings;

      const lastBoot = parseInt(localStorage.getItem(StorageKeys.lastBoot) ?? "0", 10);

      const recentlyBooted = Date.now() - lastBoot < 30 * 60 * 1000;

      if (!this._settings.bootAnimation || recentlyBooted) {
        if (typeof skipBootSequence === "function") {
          skipBootSequence();
        }
      }

      localStorage.setItem(StorageKeys.lastBoot, String(Date.now()));
    }, 0);
  }

  open() {
    const winId = "yukiOS-settings";
    const existing = document.getElementById(winId);
    if (existing) {
      this.wm.bringToFront(existing);
      return;
    }

    const win = this.wm.createWindow(winId, "Settings", "500px", "460px");
    Object.assign(win.style, { left: "200px", top: "100px" });
    win.innerHTML = this._buildHTML();

    desktop.appendChild(win);
    this.wm.makeDraggable(win);
    this.wm.makeResizable(win);
    this.wm.setupWindowControls(win);
    this.wm.addToTaskbar(win.id, "Settings", "fas fa-cog");
    if (this.desktopUi !== undefined) this.desktopUI.closeAllMenus();

    this._bindControls(win);
  }

  setDesktopUI(desktopUi) {
    this.desktopUI = desktopUi;
  }
  setAppLauncher(appLauncher) {
    this._appLauncher = appLauncher;
  }

  _buildHTML() {
    const { bootAnimation, weather, cycleWallpaper, macOsControls, clippy } = this._settings;

    return `
      <div class="window-header">
        <span>Settings</span>
        ${this.wm.getWindowControls()}

      </div>

      <div class="stt-shell">

        <div class="stt-toolbar">
          <button class="editor-btn" id="settingsResetBtn">
            <i class="fas fa-undo"></i> Reset
          </button>
          <button class="editor-btn stt-danger-btn" id="settingsDataResetBtn">
            <i class="fas fa-trash"></i> Reset OS Settings
          </button>
          <span id="settingsStatus" class="stt-saved-badge">Saved</span>
        </div>

        <div class="stt-body">

          <div class="stt-card">
            <div class="stt-card-header">
              <i class="fas fa-user"></i>
              <span>User</span>
            </div>
            <div class="stt-row stt-row--stacked">
              <div class="stt-label-group">
                <span class="stt-label-title">Username</span>
                <span class="stt-label-desc">Displayed across the OS interface</span>
              </div>
              <input
                id="settingsUsername"
                type="text"
                class="stt-input"
                placeholder="Enter username…"
                spellcheck="false"
              />
            </div>
          </div>

          <div class="stt-card">
            <div class="stt-card-header">
              <i class="fas fa-cog"></i>
              <span>System</span>
            </div>

            <div class="stt-row">
              <div class="stt-label-group">
                <span class="stt-label-title">Boot Animation</span>
                <span class="stt-label-desc">Play animation on startup</span>
              </div>
              <label class="stt-toggle" aria-label="Toggle boot animation">
                <input type="checkbox" id="settingsBootAnimation" ${bootAnimation ? "checked" : ""} />
                <span class="stt-track"><span class="stt-thumb"></span></span>
              </label>
            </div>

            <div class="stt-row">
              <div class="stt-label-group">
                <span class="stt-label-title">Weather</span>
                <span class="stt-label-desc">Show weather in the taskbar</span>
              </div>
              <label class="stt-toggle" aria-label="Toggle taskbar weather">
                <input type="checkbox" id="settingsWeather" ${weather ? "checked" : ""} />
                <span class="stt-track"><span class="stt-thumb"></span></span>
              </label>
            </div>

            <div class="stt-row">
              <div class="stt-label-group">
                <span class="stt-label-title">macOS Window Controls</span>
                <span class="stt-label-desc">Use macOS-style traffic light buttons on window title bars</span>
              </div>
              <label class="stt-toggle" aria-label="Toggle macOS window controls">
                <input type="checkbox" id="settingsMacControls" ${macOsControls ? "checked" : ""} />
                <span class="stt-track"><span class="stt-thumb"></span></span>
              </label>
            </div>

            <div class="stt-row">
              <div class="stt-label-group">
                <span class="stt-label-title">Clippy</span>
                <span class="stt-label-desc">Show the Clippy assistant after boot</span>
              </div>
              <label class="stt-toggle" aria-label="Toggle Clippy">
                <input type="checkbox" id="settingsClippy" ${clippy ? "checked" : ""} />
                <span class="stt-track"><span class="stt-thumb"></span></span>
              </label>
            </div>

          </div>

          <div class="stt-card">
            <div class="stt-card-header">
              <i class="fas fa-image"></i>
              <span>Wallpaper</span>
            </div>

            <div class="stt-row">
              <div class="stt-label-group">
                <span class="stt-label-title">Cycle Wallpapers on Start</span>
                <span class="stt-label-desc">Advance to the next wallpaper each session instead of keeping the current one</span>
              </div>
              <label class="stt-toggle" aria-label="Toggle wallpaper cycling on start">
                <input type="checkbox" id="settingsCycleWallpaper" ${cycleWallpaper ? "checked" : ""} />
                <span class="stt-track"><span class="stt-thumb"></span></span>
              </label>
            </div>

          </div>

        </div>
      </div>
    `;
  }

  _bindControls(win) {
    const usernameInput = win.querySelector("#settingsUsername");
    const bootAnimToggle = win.querySelector("#settingsBootAnimation");
    const weatherToggle = win.querySelector("#settingsWeather");
    const cycleWallpaperToggle = win.querySelector("#settingsCycleWallpaper");
    const macControlsToggle = win.querySelector("#settingsMacControls");
    const clippyToggle = win.querySelector("#settingsClippy");
    const resetBtn = win.querySelector("#settingsResetBtn");
    const dataResetBtn = win.querySelector("#settingsDataResetBtn");
    const status = win.querySelector("#settingsStatus");

    usernameInput.value = this._settings.username;

    const showStatus = (msg = "Saved") => {
      status.textContent = msg;
      status.style.opacity = "1";
      clearTimeout(this._statusTimer);
      this._statusTimer = setTimeout(() => {
        status.style.opacity = "0";
      }, 2200);
    };

    const save = () => {
      const username = usernameInput.value.trim();
      const bootAnimation = bootAnimToggle.checked;
      const weather = weatherToggle.checked;
      const cycleWallpaper = cycleWallpaperToggle.checked;
      const macOsControls = macControlsToggle.checked;
      const clippy = clippyToggle.checked;

      localStorage.setItem(StorageKeys.username, username);
      localStorage.setItem(StorageKeys.bootAnimation, String(bootAnimation));
      localStorage.setItem(StorageKeys.weather, String(weather));
      localStorage.setItem(StorageKeys.cycleWallpaper, String(cycleWallpaper));
      localStorage.setItem(StorageKeys.macOsControls, String(macOsControls));
      localStorage.setItem(StorageKeys.clippy, String(clippy));

      const weatherChanged = weather !== this._settings.weather;

      Object.assign(this._settings, { username, bootAnimation, weather, cycleWallpaper, macOsControls, clippy });
      Object.assign(window._settings, this._settings);

      this._applyUsername(username);

      if (weatherChanged) {
        if (weather) {
          SystemUtilities.startTaskbarWeather(this._appLauncher);
        } else {
          SystemUtilities.stopTaskbarWeather();
        }
      }

      showStatus("Saved");
    };

    const reset = () => {
      usernameInput.value = "";
      bootAnimToggle.checked = true;
      weatherToggle.checked = true;
      cycleWallpaperToggle.checked = true;
      macControlsToggle.checked = false;
      clippyToggle.checked = !(isMobile || isLocalhost);
      save();
      showStatus("Settings reset.");
    };

    resetBtn.addEventListener("click", reset);
    dataResetBtn.addEventListener("click", this.resetAllData);

    usernameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") save();
    });
    usernameInput.addEventListener("blur", save);
    bootAnimToggle.addEventListener("change", save);
    weatherToggle.addEventListener("change", save);
    cycleWallpaperToggle.addEventListener("change", save);
    macControlsToggle.addEventListener("change", save);
    clippyToggle.addEventListener("change", save);
  }

  resetAllData = () => {
    const confirmed = confirm("This will erase all OS settings and reload. Continue?");
    if (!confirmed) return;

    Object.values(StorageKeys).forEach((key) => localStorage.removeItem(key));
    location.reload();
  };

  _applyUsername(username) {
    const start = document.querySelector(".start-user");
    const startSpan = start?.querySelector("span");
    if (startSpan) startSpan.textContent = username;
  }

  updateUsername() {
    const username = document.querySelector(".login-input").value;
    this._applyUsername(username);
  }

  get(key) {
    return this._settings[key];
  }
}
