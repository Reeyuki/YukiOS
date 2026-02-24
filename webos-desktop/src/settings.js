import { desktop } from "./desktop.js";
import { skipBootSequence } from "./system.js";

/**
 * SettingsApp — System settings panel for yukiOS.
 *
 * Persists settings to localStorage using the key prefix "yukiOS_".
 *
 */
export class SettingsApp {
  constructor(windowManager) {
    this.wm = windowManager;

    setTimeout(() => {
      this._settings = {
        username: localStorage.getItem("yukiOS_username") ?? "",
        bootAnimation: localStorage.getItem("yukiOS_bootAnimation") !== "false"
      };

      this._applyUsername(this._settings.username);
      window._settings = this._settings;

      if (!this._settings.bootAnimation) skipBootSequence();
    }, 0);
  }

  open() {
    const winId = "yukiOS-settings";
    const existing = document.getElementById(winId);
    if (existing) {
      this.wm.bringToFront(existing);
      return;
    }

    const win = this.wm.createWindow(winId, "Settings", "480px", "400px");
    Object.assign(win.style, { left: "200px", top: "100px" });
    win.innerHTML = this._buildHTML();

    desktop.appendChild(win);
    this.wm.makeDraggable(win);
    this.wm.makeResizable(win);
    this.wm.setupWindowControls(win);
    this.wm.addToTaskbar(win.id, "Settings", "fas fa-sliders-h");

    this._bindControls(win);
  }

  _buildHTML() {
    // Always read from this._settings so the window reflects current persisted state.
    const { bootAnimation } = this._settings;

    return `
      <div class="window-header">
        <span>Settings</span>
        <div class="window-controls">
          <button class="minimize-btn" title="Minimize">−</button>
          <button class="maximize-btn" title="Maximize">□</button>
          <button class="close-btn" title="Close">×</button>
        </div>
      </div>

      <div class="python-interpreter" style="
        display:flex;
        flex-direction:column;
        height:calc(100% - 36px);
        overflow:hidden;
      ">

        <div class="python-toolbar" style="flex-shrink:0">
          <button class="editor-btn" id="settingsSaveBtn">
            <i class="fas fa-save"></i> Save
          </button>
          <button class="editor-btn" id="settingsResetBtn">
            <i class="fas fa-undo"></i> Reset
          </button>
          <span id="settingsStatus" style="
            margin-left:auto;
            font-size:11px;
            opacity:0;
            transition:opacity 0.4s;
            color:var(--accent, #7dd3fc);
          ">Changes saved!</span>
        </div>

        <div style="flex:1;overflow-y:auto;padding:24px 28px;display:flex;flex-direction:column;gap:28px">

          <div class="settings-section">
            <div class="python-section-header" style="margin-bottom:14px">
              <i class="fas fa-user"></i> User
            </div>

            <div class="settings-row">
              <div class="settings-label">
                <span class="settings-label-title">Username</span>
                <span class="settings-label-desc">Displayed across the OS interface</span>
              </div>
              <input
                id="settingsUsername"
                type="text"
                class="editor-filename"
                placeholder="Enter username…"
                spellcheck="false"
                style="width:180px;padding:6px 10px;font-size:13px"
              />
            </div>
          </div>

          <div class="settings-section">
            <div class="python-section-header" style="margin-bottom:14px">
              <i class="fas fa-cog"></i> System
            </div>

            <div class="settings-row">
              <div class="settings-label">
                <span class="settings-label-title">Boot Animation</span>
                <span class="settings-label-desc">Play animation on startup</span>
              </div>
              <label class="settings-toggle" aria-label="Toggle boot animation">
                <input
                  type="checkbox"
                  id="settingsBootAnimation"
                  ${bootAnimation ? "checked" : ""}
                />
                <span class="settings-toggle-track">
                  <span class="settings-toggle-thumb"></span>
                </span>
              </label>
            </div>
          </div>

        </div>
      </div>

      <style>
        .settings-section {
          display: flex;
          flex-direction: column;
        }

        .settings-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 12px 0;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .settings-row:last-child {
          border-bottom: none;
        }

        .settings-label {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .settings-label-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--text, #e2e8f0);
        }
        .settings-label-desc {
          font-size: 11px;
          opacity: 0.45;
          line-height: 1.4;
        }

        /* Toggle switch */
        .settings-toggle {
          position: relative;
          display: inline-flex;
          align-items: center;
          cursor: pointer;
          flex-shrink: 0;
        }
        .settings-toggle input {
          position: absolute;
          opacity: 0;
          width: 0;
          height: 0;
        }
        .settings-toggle-track {
          width: 42px;
          height: 24px;
          border-radius: 12px;
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.15);
          transition: background 0.2s, border-color 0.2s;
          display: flex;
          align-items: center;
          padding: 0 3px;
          box-sizing: border-box;
        }
        .settings-toggle input:checked + .settings-toggle-track {
          background: var(--accent, #7dd3fc);
          border-color: var(--accent, #7dd3fc);
        }
        .settings-toggle-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #fff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.35);
          transition: transform 0.2s cubic-bezier(.4,0,.2,1);
          flex-shrink: 0;
        }
        .settings-toggle input:checked + .settings-toggle-track .settings-toggle-thumb {
          transform: translateX(18px);
        }
      </style>
    `;
  }

  _bindControls(win) {
    const usernameInput = win.querySelector("#settingsUsername");
    const bootAnimToggle = win.querySelector("#settingsBootAnimation");
    const saveBtn = win.querySelector("#settingsSaveBtn");
    const resetBtn = win.querySelector("#settingsResetBtn");
    const status = win.querySelector("#settingsStatus");

    usernameInput.value = this._settings.username;

    const showStatus = (msg = "Changes saved!") => {
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

      localStorage.setItem("yukiOS_username", username);
      localStorage.setItem("yukiOS_bootAnimation", String(bootAnimation));

      Object.assign(this._settings, { username, bootAnimation });
      Object.assign(window._settings, this._settings);

      this._applyUsername(username);

      showStatus("Changes saved!");
    };

    const reset = () => {
      usernameInput.value = "";
      bootAnimToggle.checked = true;
      save();
      showStatus("Settings reset.");
    };

    saveBtn.addEventListener("click", save);
    resetBtn.addEventListener("click", reset);

    usernameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") save();
    });
  }

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
