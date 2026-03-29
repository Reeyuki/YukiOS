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

      <style>
        #yukiOS-settings {
          display: flex;
          flex-direction: column;
          min-height: 0;
          overflow: hidden;
        }

        .stt-shell {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
          overflow: hidden;
          background: radial-gradient(ellipse at 60% 0%, rgba(79,158,255,0.06) 0%, transparent 60%), var(--s1, #12121c);
          font-family: "Sora", sans-serif;
        }

        .stt-toolbar {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: var(--s2, rgba(26,26,40,0.8));
          border-bottom: 1px solid var(--glass-border, rgba(255,255,255,0.08));
          flex-shrink: 0;
        }

        .stt-danger-btn {
          color: #f87171 !important;
          border-color: rgba(248,113,113,0.3) !important;
          background: rgba(248,113,113,0.08) !important;
        }
        .stt-danger-btn:hover:not(:disabled) {
          background: rgba(248,113,113,0.16) !important;
          border-color: rgba(248,113,113,0.5) !important;
        }

        .stt-saved-badge {
          margin-left: auto;
          font-size: 12px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--accent, #7dd3c0);
          opacity: 0;
          transition: opacity 0.35s;
          background: rgba(125,211,192,0.1);
          border: 1px solid rgba(125,211,192,0.25);
          border-radius: 4px;
          padding: 3px 10px;
        }

        .stt-body {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 20px 22px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.1) transparent;
        }
        .stt-body::-webkit-scrollbar { width: 5px; }
        .stt-body::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 99px;
        }

        .stt-card {
          background: var(--glass, rgba(255,255,255,0.06));
          border: 1px solid var(--glass-border, rgba(255,255,255,0.08));
          border-radius: var(--r, 10px);
          overflow: hidden;
          backdrop-filter: blur(12px);
          flex-shrink: 0;
          transition: border-color 0.2s;
        }
        .stt-card:hover {
          border-color: rgba(255,255,255,0.14);
        }

        .stt-card-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: var(--s2, rgba(26,26,40,0.6));
          border-bottom: 1px solid var(--glass-border, rgba(255,255,255,0.06));
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--tx2, rgba(255,255,255,0.6));
        }
        .stt-card-header i {
          color: var(--accent, #7dd3c0);
          font-size: 13px;
        }

        .stt-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 15px 16px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          transition: background 0.15s;
          min-width: 0;
        }
        .stt-row:last-child { border-bottom: none; }
        .stt-row:hover { background: rgba(255,255,255,0.025); }

        .stt-row--stacked {
          flex-direction: column;
          align-items: stretch;
          gap: 10px;
        }

        .stt-label-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
          flex: 1;
        }
        .stt-label-title {
          font-size: 15px;
          font-weight: 500;
          color: var(--tx1, rgba(255,255,255,0.92));
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .stt-label-desc {
          font-size: 13px;
          color: var(--tx2, rgba(255,255,255,0.55));
          line-height: 1.45;
        }

        .stt-input {
          width: 100%;
          box-sizing: border-box;
          padding: 9px 13px;
          font-size: 15px;
          font-family: inherit;
          background: rgba(255,255,255,0.05);
          color: var(--tx1, rgba(255,255,255,0.92));
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: var(--r-sm, 6px);
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
        }
        .stt-input:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.2);
        }
        .stt-input:focus {
          background: rgba(255,255,255,0.07);
          border-color: var(--accent, #7dd3c0);
          box-shadow: 0 0 0 3px rgba(125,211,192,0.15);
        }
        .stt-input::placeholder { color: rgba(255,255,255,0.28); }

        .stt-toggle {
          position: relative;
          display: inline-flex;
          align-items: center;
          cursor: pointer;
          flex-shrink: 0;
        }
        .stt-toggle input {
          position: absolute;
          opacity: 0;
          width: 0;
          height: 0;
        }
        .stt-track {
          width: 46px;
          height: 26px;
          border-radius: 13px;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.15);
          transition: background 0.22s, border-color 0.22s, box-shadow 0.22s;
          display: flex;
          align-items: center;
          padding: 0 3px;
          box-sizing: border-box;
        }
        .stt-toggle input:checked + .stt-track {
          background: var(--accent, #7dd3c0);
          border-color: var(--accent, #7dd3c0);
          box-shadow: 0 0 10px rgba(125,211,192,0.3);
        }
        .stt-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #fff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.4);
          transition: transform 0.22s cubic-bezier(.4,0,.2,1);
          flex-shrink: 0;
        }
        .stt-toggle input:checked + .stt-track .stt-thumb {
          transform: translateX(20px);
        }
      </style>
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
