import { SystemUtilities } from "./system.js";
import { BusEvents } from "./core/EventBus.js";
import { openFileWith } from "./fileDisplay.js";
import { resolveIconUrl } from "./shared/assetResolver.js";
import { AppSource } from "./AppSource.js";
import { WALLPAPER_NAME_URL_PAIRS } from "./wallpaperConfig.js";
import { KeybindManager } from "./keybindManager.js";

import { StorageKeys, os } from "./framework.js";
export class CommandPalette {
  constructor(services) {
    this.services = services;
    this.isOpen = false;
    this.cachedFiles = [];
    this.results = [];
    this.activeIndex = 0;
    this.currentSubpalette = null;
    this.inputElement = null;
    this.overlayElement = null;
    this.resultsContainer = null;
    this._setupUI();
    this._setupListeners();
  }

  _setupUI() {
    this.overlayElement = document.createElement("div");
    this.overlayElement.id = "command-palette";
    this.overlayElement.className = "cmd-palette-overlay";
    this.overlayElement.style.display = "none";

    this.overlayElement.innerHTML = `
      <div class="cmd-palette-modal">
        <div class="cmd-palette-header">
          <i class="fas fa-search cmd-palette-search-icon"></i>
          <input type="text" id="cmd-palette-input" placeholder="Type a command, app, or file name..." autocomplete="off">
          <div class="cmd-palette-kbd">ESC</div>
        </div>
        <div class="cmd-palette-body">
          <div id="cmd-palette-results" class="cmd-palette-results"></div>
        </div>
        <div class="cmd-palette-footer">
          <span>Use <kbd>↑</kbd> <kbd>↓</kbd> to navigate, <kbd>Enter</kbd> to select, <kbd>Esc</kbd> to close</span>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlayElement);

    const style = document.createElement("style");
    style.id = "command-palette-styles";
    style.textContent = `
      .cmd-palette-overlay {
        position: fixed;
        inset: 0;
        z-index: 99999999;
        background: rgba(10, 10, 14, 0.4);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding-top: 100px;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        color: #fff;
        animation: cmdFadeIn 0.2s ease-out;
      }

      @keyframes cmdFadeIn {
        from { opacity: 0; transform: scale(1.02); }
        to { opacity: 1; transform: scale(1); }
      }

      .cmd-palette-modal {
        width: 100%;
        max-width: 600px;
        max-height: 480px;
        border-radius: 16px;
        background: rgba(20, 20, 28, 0.85);
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.5);
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .cmd-palette-header {
        padding: 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      }

      .cmd-palette-search-icon {
        color: rgba(255, 255, 255, 0.4);
        font-size: 16px;
      }

      #cmd-palette-input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        color: #fff;
        font-size: 16px;
        font-family: inherit;
      }

      .cmd-palette-kbd {
        font-size: 10px;
        font-weight: 600;
        padding: 3px 6px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 6px;
        color: rgba(255, 255, 255, 0.5);
        letter-spacing: 0.5px;
      }

      .cmd-palette-body {
        flex: 1;
        overflow-y: auto;
        max-height: 340px;
        padding: 8px 0;
      }

      .cmd-palette-body::-webkit-scrollbar {
        width: 6px;
      }

      .cmd-palette-body::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 10px;
      }

      .cmd-palette-results {
        display: flex;
        flex-direction: column;
      }

      .cmd-palette-item {
        padding: 10px 16px;
        display: flex;
        align-items: center;
        gap: 14px;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .cmd-palette-item:hover {
        background: rgba(255, 255, 255, 0.04);
      }

      .cmd-palette-item.active {
        background: rgba(255, 255, 255, 0.08);
        border-left: 3px solid #4f9eff;
        padding-left: 13px;
      }

      .cmd-palette-item-icon {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        object-fit: cover;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.05);
        color: rgba(255, 255, 255, 0.7);
        font-size: 14px;
      }

      .cmd-palette-item-icon img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 8px;
      }

      .cmd-palette-item-meta {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }

      .cmd-palette-item-title {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.95);
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .cmd-palette-item-sub {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.4);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .cmd-palette-item-tag {
        font-size: 10px;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.05);
        color: rgba(255, 255, 255, 0.5);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .cmd-palette-footer {
        padding: 10px 16px;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        font-size: 11px;
        color: rgba(255, 255, 255, 0.4);
        text-align: center;
      }

      .cmd-palette-footer kbd {
        background: rgba(255, 255, 255, 0.08);
        padding: 1px 4px;
        border-radius: 3px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        font-family: inherit;
      }
    `;
    document.head.appendChild(style);

    this.inputElement = this.overlayElement.querySelector("#cmd-palette-input");
    this.resultsContainer = this.overlayElement.querySelector("#cmd-palette-results");
  }

  _setupListeners() {
    document.addEventListener("keydown", (e) => {
      if (
        KeybindManager.matches(e, "global.commandPalette.k") ||
        KeybindManager.matches(e, "global.commandPalette.p") ||
        KeybindManager.matches(e, "global.commandPalette.f1")
      ) {
        e.preventDefault();
        this.toggle();
      }
    });

    this.overlayElement.addEventListener("click", (e) => {
      if (e.target === this.overlayElement) {
        this.close();
      }
    });

    this.inputElement.addEventListener("input", () => {
      this.activeIndex = 0;
      this._renderResults();
    });

    this.inputElement.addEventListener("keydown", (e) => {
      if (KeybindManager.matches(e, "global.closePalette")) {
        e.preventDefault();
        this.close();
      } else if (KeybindManager.matches(e, "global.paletteDown")) {
        e.preventDefault();
        this.activeIndex = (this.activeIndex + 1) % this.results.length;
        this._updateActiveSelection();
      } else if (KeybindManager.matches(e, "global.paletteUp")) {
        e.preventDefault();
        this.activeIndex = (this.activeIndex - 1 + this.results.length) % this.results.length;
        this._updateActiveSelection();
      } else if (KeybindManager.matches(e, "global.paletteEnter")) {
        e.preventDefault();
        this._executeActive();
      }
    });
  }

  async toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      await this.open();
    }
  }

  async open() {
    if (document.getElementById("session-overlay")) {
      return;
    }
    this.isOpen = true;
    this.currentSubpalette = null;
    this.activeIndex = 0;
    this.inputElement.value = "";
    this.overlayElement.style.display = "flex";
    this.inputElement.focus();
    await this._loadFiles();
    this._renderResults();
  }

  close() {
    this.isOpen = false;
    this.overlayElement.style.display = "none";
  }

  async _loadFiles() {
    const fs = this.services.fileSystemManager;
    if (!fs) return;
    this.cachedFiles = [];
    const walk = async (dirPath) => {
      try {
        const list = await fs.pRead("readdir", dirPath);
        const meta = await fs.readMeta(dirPath);
        for (const name of list) {
          if (name === fs.CONFIG.META_FILE) continue;
          if (name === "system" || name.startsWith(".")) continue;
          const fullPath = fs.join(dirPath, name);
          let stat;
          try {
            stat = await fs.pStat(fullPath);
          } catch {
            continue;
          }
          if (stat.isDirectory()) {
            await walk(fullPath);
          } else {
            const kind = meta[name]?.kind ?? fs.inferKind(name);
            this.cachedFiles.push({
              name,
              path: fullPath,
              kind
            });
          }
        }
      } catch (err) {}
    };
    await walk(fs.CONFIG.ROOT);
  }

  _renderResults() {
    const search = this.inputElement.value.trim().toLowerCase();
    this.resultsContainer.innerHTML = "";

    if (this.currentSubpalette === "wallpaper") {
      this._renderWallpaperSubpalette(search);
      return;
    }

    if (this.currentSubpalette === "filesearch") {
      this._renderFileSearchSubpalette(search);
      return;
    }

    const actions = [
      {
        title: "Change Wallpaper",
        subtitle: "Select a custom or default background image",
        tag: "action",
        icon: "fas fa-image",
        execute: () => {
          this.currentSubpalette = "wallpaper";
          this.inputElement.value = "";
          this.activeIndex = 0;
          this._renderResults();
        }
      },
      {
        title: "Theme: Dark Mode",
        subtitle: "Switch to sleek dark UI appearance",
        tag: "theme",
        icon: "fas fa-moon",
        execute: () => this._setSystemTheme("dark")
      },
      {
        title: "Theme: Light Mode",
        subtitle: "Switch to bright light UI appearance",
        tag: "theme",
        icon: "fas fa-sun",
        execute: () => this._setSystemTheme("light")
      },
      {
        title: "Theme: Auto Mode",
        subtitle: "Follow system preference dark/light settings",
        tag: "theme",
        icon: "fas fa-circle-half-stroke",
        execute: () => this._setSystemTheme("auto")
      },
      {
        title: "Mute Sounds",
        subtitle: "Disable overall system audio notifications",
        tag: "audio",
        icon: "fas fa-volume-mute",
        execute: () => this._toggleSound(false)
      },
      {
        title: "Unmute Sounds",
        subtitle: "Enable standard system audio notifications",
        tag: "audio",
        icon: "fas fa-volume-up",
        execute: () => this._toggleSound(true)
      },
      {
        title: "Do Not Disturb: On",
        subtitle: "Silence all toast banner notifications",
        tag: "dnd",
        icon: "fas fa-bell-slash",
        execute: () => this._toggleDND(true)
      },
      {
        title: "Do Not Disturb: Off",
        subtitle: "Display all standard desktop notifications",
        tag: "dnd",
        icon: "fas fa-bell",
        execute: () => this._toggleDND(false)
      },
      {
        title: "Close All Windows",
        subtitle: "Close all open application windows",
        tag: "action",
        icon: "fas fa-window-close",
        execute: () => this._closeAllWindows()
      },
      {
        title: "Minimize All Windows",
        subtitle: "Minimize every open window to the taskbar",
        tag: "action",
        icon: "fas fa-minus",
        execute: () => this._minimizeAllWindows()
      },
      {
        title: "Toggle Fullscreen",
        subtitle: "Toggle the active window in and out of fullscreen",
        tag: "action",
        icon: "fas fa-expand",
        execute: () => this._toggleFullscreen()
      },
      {
        title: "Lock Session",
        subtitle: "Lock the current session and show the lock screen",
        tag: "session",
        icon: "fas fa-lock",
        execute: () => this.services.sessionManager?.lockSession()
      },
      {
        title: "Logout",
        subtitle: "Sign out and return to the login screen",
        tag: "session",
        icon: "fas fa-right-from-bracket",
        execute: async () => {
          if (await os.dialog.confirm("Logout", "Sign out and return to the login screen?")) {
            await this.services.sessionManager?.lockToLoginScreen();
          }
        }
      },
      {
        title: "Shutdown",
        subtitle: "Shut down the system completely",
        tag: "session",
        icon: "fas fa-power-off",
        execute: async () => {
          if (await os.dialog.confirm("Shutdown", "Close everything and shut down?")) {
            await this.services.sessionManager?.lockToLoginScreen();
          }
        }
      },
      {
        title: "Show Workspace Overview",
        subtitle: "Display the workspace overview switcher",
        tag: "workspace",
        icon: "fas fa-th-large",
        execute: () => this._toggleWorkspaceOverview()
      },
      {
        title: "Switch to Workspace 1",
        subtitle: "Jump to the first workspace",
        tag: "workspace",
        icon: "fas fa-1",
        execute: () => this._switchWorkspace(0)
      },
      {
        title: "Switch to Workspace 2",
        subtitle: "Jump to the second workspace",
        tag: "workspace",
        icon: "fas fa-2",
        execute: () => this._switchWorkspace(1)
      },
      {
        title: "Switch to Workspace 3",
        subtitle: "Jump to the third workspace",
        tag: "workspace",
        icon: "fas fa-3",
        execute: () => this._switchWorkspace(2)
      },
      {
        title: "Switch to Workspace 4",
        subtitle: "Jump to the fourth workspace",
        tag: "workspace",
        icon: "fas fa-4",
        execute: () => this._switchWorkspace(3)
      },
      {
        title: "Switch to Workspace 5",
        subtitle: "Jump to the fifth workspace",
        tag: "workspace",
        icon: "fas fa-5",
        execute: () => this._switchWorkspace(4)
      },
      {
        title: "Search Files",
        subtitle: "Find files across the entire filesystem",
        tag: "action",
        icon: "fas fa-magnifying-glass",
        execute: () => {
          this.currentSubpalette = "filesearch";
          this.inputElement.value = "";
          this.activeIndex = 0;
          this._renderResults();
        }
      },
      {
        title: "Take Screenshot",
        subtitle: "Capture full screen and save to Pictures",
        tag: "screenshot",
        icon: "fas fa-camera",
        execute: () => {
          const app = this.services.screenshotApp;
          if (app) {
            app.open();
            app.captureFull(true);
          }
        }
      },
      {
        title: "Start Screen Recording",
        subtitle: "Begin recording your screen",
        tag: "screenshot",
        icon: "fas fa-video",
        execute: () => {
          const app = this.services.screenshotApp;
          if (app && !app._recording) {
            app.open();
            app.toggleRecording();
          }
        }
      },
      {
        title: "Stop Screen Recording",
        subtitle: "Stop the active screen recording",
        tag: "screenshot",
        icon: "fas fa-stop",
        execute: () => {
          const app = this.services.screenshotApp;
          if (app && app._recording) {
            app.toggleRecording();
          }
        }
      },
      {
        title: "Area Screenshot",
        subtitle: "Capture a selected region of the screen",
        tag: "screenshot",
        icon: "fas fa-crop-alt",
        execute: () => {
          const app = this.services.screenshotApp;
          if (app) {
            app.open();
            app.captureArea(true);
          }
        }
      },
      {
        title: "Empty Trash",
        subtitle: "Permanently delete all trashed files",
        tag: "action",
        icon: "fas fa-trash",
        execute: async () => {
          if (
            await os.dialog.confirm("Empty Trash", "Are you sure you want to permanently delete all trashed files?")
          ) {
            await os.fs.emptyTrash();
            os.notify.send("Trash Emptied", "All trashed files have been permanently deleted.", {
              type: "success",
              duration: 4000,
              icon: "fas fa-trash",
              appSource: AppSource.COMMAND_PALETTE
            });
          }
        }
      },
      {
        title: "Toggle Transparent UI",
        subtitle: "Switch between glass and solid window backgrounds",
        tag: "action",
        icon: "fas fa-glass-whiskey",
        execute: () => {
          const next = os.storage.get(StorageKeys.transparentUI) !== "true";
          os.storage.set(StorageKeys.transparentUI, String(next));
          document.documentElement.classList.toggle("transparent-ui", next);
          os.notify.send("Transparent UI", next ? "Enabled" : "Disabled", {
            type: "success",
            duration: 3000,
            icon: "fas fa-glass-whiskey",
            appSource: AppSource.COMMAND_PALETTE
          });
        }
      }
    ];

    const allActions = [...actions, ...this._getSettingsEntries()];
    let items = !search ? [...allActions] : allActions.filter((a) => a.title.toLowerCase().includes(search));

    if (search.startsWith(">") || this._isTerminalCommand(search)) {
      const cleanCmd = search.startsWith(">") ? search.slice(1).trim() : search;
      if (cleanCmd) {
        items.push({
          title: `Run command: ${cleanCmd}`,
          subtitle: "Launch Terminal app and run command immediately",
          tag: "terminal",
          icon: "fas fa-terminal",
          execute: () => {
            if (this.services.terminalApp) {
              this.services.terminalApp.open();
              setTimeout(() => {
                this.services.terminalApp.executeCommand(cleanCmd);
              }, 250);
            }
          }
        });
      }
    }

    const calcResult = this._tryCalculate(search);
    if (calcResult) {
      items.push(calcResult);
    }

    const convResult = this._tryConvert(search);
    if (convResult) {
      items.push(convResult);
    }

    const allApps = os.app.getAllApps();
    if (allApps) {
      for (const [key, app] of Object.entries(allApps)) {
        if (!app) continue;
        const appTitle = app.title || key;

        if (!search || appTitle.toLowerCase().includes(search) || key.toLowerCase().includes(search)) {
          items.push({
            title: appTitle,
            subtitle: app.type === "system" ? "Built-in System App" : `Game Category: ${app.type}`,
            tag: app.type === "system" ? "app" : "game",
            icon: app.icon || "fas fa-window-maximize",
            execute: () => os.app.launch(key)
          });
        }
      }
    }

    for (const file of this.cachedFiles) {
      if (!search || file.name.toLowerCase().includes(search)) {
        items.push({
          title: file.name,
          subtitle: `File Location: ${file.path}`,
          tag: file.kind,
          icon: os.fs.getFileIcon(file.path),
          isFile: true,
          execute: () => {
            const launcher = this.services.windowManager.appLauncher;
            const fsManager = this.services.fileSystemManager;
            openFileWith({
              name: file.name,
              path: fsManager.dirname(file.path),
              fs: fsManager,
              notepadApp: this.services.notepadApp,
              browserApp: this.services.browserApp,
              windowManager: this.services.windowManager,
              officeApp: this.services.officeApp,
              markdownApp: this.services.markdownApp,
              jsDosApp: this.services.jsDosApp,
              appLauncher: launcher
            });
          }
        });
      }
    }

    if (items.length > 50) {
      items = items.slice(0, 50);
    }

    this.results = items;
    this.activeIndex = Math.min(this.activeIndex, Math.max(0, this.results.length - 1));

    if (this.results.length === 0) {
      this.resultsContainer.innerHTML = `
        <div style="padding: 20px; text-align: center; color: rgba(255, 255, 255, 0.4); font-size: 14px;">
          No matching commands, apps, or files found.
        </div>
      `;
      return;
    }

    this.results.forEach((item, index) => {
      const el = document.createElement("div");
      el.className = `cmd-palette-item ${index === this.activeIndex ? "active" : ""}`;
      el.dataset.index = index;

      let iconHtml = "";
      if (typeof item.icon === "string") {
        if (item.icon.startsWith("fa")) {
          iconHtml = `<i class="${item.icon}"></i>`;
        } else {
          iconHtml = `<img src="${resolveIconUrl(item.icon)}" alt="">`;
        }
      } else {
        iconHtml = `<i class="fas fa-file"></i>`;
      }

      el.innerHTML = `
        <div class="cmd-palette-item-icon">${iconHtml}</div>
        <div class="cmd-palette-item-meta">
          <div class="cmd-palette-item-title">${this._escapeHTML(item.title)}</div>
          <div class="cmd-palette-item-sub">${this._escapeHTML(item.subtitle)}</div>
        </div>
        <div class="cmd-palette-item-tag">${item.tag}</div>
      `;

      el.addEventListener("click", () => {
        this.activeIndex = index;
        this._executeActive();
      });

      this.resultsContainer.appendChild(el);
    });

    this._scrollToActive();
  }

  _renderWallpaperSubpalette(search) {
    const wallOpts = WALLPAPER_NAME_URL_PAIRS;

    let matches = wallOpts;
    if (search) {
      matches = wallOpts.filter((w) => w.name.toLowerCase().includes(search));
    }

    const items = [
      {
        title: ".. Back to Main Menu",
        subtitle: "Return to the main command palette search list",
        tag: "nav",
        icon: "fas fa-arrow-left",
        execute: () => {
          this.currentSubpalette = null;
          this.inputElement.value = "";
          this.activeIndex = 0;
          this._renderResults();
        }
      }
    ];

    for (const w of matches) {
      items.push({
        title: `Set wallpaper: ${w.name}`,
        subtitle: `Apply ${w.name} as the current desktop background`,
        tag: "wallpaper",
        icon: "fas fa-image",
        execute: () => {
          SystemUtilities.setWallpaper(w.url);
          os.notify.send("Wallpaper Changed", `Background updated to ${w.name}`, {
            type: "success",
            duration: 5000,
            icon: "fas fa-image",
            appSource: AppSource.COMMAND_PALETTE
          });
        }
      });
    }

    this.results = items;

    this.results.forEach((item, index) => {
      const el = document.createElement("div");
      el.className = `cmd-palette-item ${index === this.activeIndex ? "active" : ""}`;
      el.dataset.index = index;

      el.innerHTML = `
        <div class="cmd-palette-item-icon"><i class="${item.icon}"></i></div>
        <div class="cmd-palette-item-meta">
          <div class="cmd-palette-item-title">${this._escapeHTML(item.title)}</div>
          <div class="cmd-palette-item-sub">${this._escapeHTML(item.subtitle)}</div>
        </div>
        <div class="cmd-palette-item-tag">${item.tag}</div>
      `;

      el.addEventListener("click", () => {
        this.activeIndex = index;
        this._executeActive();
      });

      this.resultsContainer.appendChild(el);
    });

    this._scrollToActive();
  }

  _renderFileSearchSubpalette(search) {
    const items = [
      {
        title: ".. Back to Main Menu",
        subtitle: "Return to the main command palette search list",
        tag: "nav",
        icon: "fas fa-arrow-left",
        execute: () => {
          this.currentSubpalette = null;
          this.inputElement.value = "";
          this.activeIndex = 0;
          this._renderResults();
        }
      }
    ];

    if (!search) {
      const count = this.cachedFiles.length;
      items.push({
        title: `${count} file${count !== 1 ? "s" : ""} indexed`,
        subtitle: "Type a filename to search across the filesystem",
        tag: "info",
        icon: "fas fa-info-circle",
        execute: () => {}
      });
    } else {
      for (const file of this.cachedFiles) {
        if (file.name.toLowerCase().includes(search)) {
          items.push({
            title: file.name,
            subtitle: file.path,
            tag: file.kind,
            icon: os.fs.getFileIcon(file.path),
            execute: () => {
              const launcher = this.services.windowManager.appLauncher;
              const fsManager = this.services.fileSystemManager;
              openFileWith({
                name: file.name,
                path: fsManager.dirname(file.path),
                fs: fsManager,
                notepadApp: this.services.notepadApp,
                browserApp: this.services.browserApp,
                windowManager: this.services.windowManager,
                officeApp: this.services.officeApp,
                markdownApp: this.services.markdownApp,
                jsDosApp: this.services.jsDosApp,
                appLauncher: launcher
              });
            }
          });
        }
      }
    }

    if (items.length === 1) {
      items.push({
        title: "No matching files found",
        subtitle: "Try a different search term",
        tag: "info",
        icon: "fas fa-circle-exclamation",
        execute: () => {}
      });
    }

    this.results = items;
    this.activeIndex = Math.min(this.activeIndex, Math.max(0, this.results.length - 1));

    this.results.forEach((item, index) => {
      const el = document.createElement("div");
      el.className = `cmd-palette-item ${index === this.activeIndex ? "active" : ""}`;
      el.dataset.index = index;

      let iconHtml = "";
      if (typeof item.icon === "string") {
        if (item.icon.startsWith("fa")) {
          iconHtml = `<i class="${item.icon}"></i>`;
        } else {
          iconHtml = `<img src="${resolveIconUrl(item.icon)}" alt="">`;
        }
      } else {
        iconHtml = `<i class="fas fa-file"></i>`;
      }

      el.innerHTML = `
        <div class="cmd-palette-item-icon">${iconHtml}</div>
        <div class="cmd-palette-item-meta">
          <div class="cmd-palette-item-title">${this._escapeHTML(item.title)}</div>
          <div class="cmd-palette-item-sub">${this._escapeHTML(item.subtitle)}</div>
        </div>
        <div class="cmd-palette-item-tag">${item.tag}</div>
      `;

      el.addEventListener("click", () => {
        this.activeIndex = index;
        this._executeActive();
      });

      this.resultsContainer.appendChild(el);
    });

    this._scrollToActive();
  }

  _getSettingsEntries() {
    const go = (section, target) => {
      const app = this.services.settingsApp;
      if (app) app.open({ section, target });
    };
    return [
      {
        title: "Settings: System",
        subtitle: "General behavior, boot, privacy, notifications",
        tag: "settings",
        icon: "fas fa-desktop",
        execute: () => go("pane-system")
      },
      {
        title: "Settings: Desktop",
        subtitle: "Taskbar, start menu, icons, tray, window switcher",
        tag: "settings",
        icon: "fas fa-home",
        execute: () => go("pane-desktop")
      },
      {
        title: "Settings: Appearance",
        subtitle: "Themes, wallpaper, animations, fonts, cursor",
        tag: "settings",
        icon: "fas fa-paint-brush",
        execute: () => go("pane-appearance")
      },
      {
        title: "Settings: Data & Storage",
        subtitle: "Import, export, reset, wipe",
        tag: "settings",
        icon: "fas fa-database",
        execute: () => go("pane-data")
      },
      {
        title: "Settings: Network",
        subtitle: "CDN mirror, WISP server",
        tag: "settings",
        icon: "fas fa-network-wired",
        execute: () => go("pane-network")
      },
      {
        title: "Settings: Audio",
        subtitle: "Master volume, system sounds",
        tag: "settings",
        icon: "fas fa-volume-high",
        execute: () => go("pane-audio")
      },
      {
        title: "Settings: About",
        subtitle: "Version info, build details",
        tag: "settings",
        icon: "fas fa-circle-info",
        execute: () => go("pane-about")
      },
      {
        title: "Settings: Turbo Mode",
        subtitle: "Switch between Quality, Balanced, and Turbo",
        tag: "settings",
        icon: "fas fa-tachometer-alt",
        execute: () => go("pane-system", "sc-general")
      },
      {
        title: "Settings: Skip Boot Screen",
        subtitle: "Bypass login screen on startup",
        tag: "settings",
        icon: "fas fa-forward",
        execute: () => go("pane-system", "settingsDisableBootScreen")
      },
      {
        title: "Settings: Notifications",
        subtitle: "DND, position, duration, animation",
        tag: "settings",
        icon: "fas fa-bell",
        execute: () => go("pane-system", "settingsDND")
      },
      {
        title: "Settings: Taskbar Position",
        subtitle: "Dock taskbar to bottom, top, left, or right",
        tag: "settings",
        icon: "fas fa-arrows-alt",
        execute: () => go("pane-desktop", "sc-layout")
      },
      {
        title: "Settings: Desktop Icon Size",
        subtitle: "Adjust desktop icon dimensions",
        tag: "settings",
        icon: "fas fa-expand",
        execute: () => go("pane-desktop", "settingsDesktopIconSize")
      },
      {
        title: "Settings: Start Menu Size",
        subtitle: "Adjust start menu width and height",
        tag: "settings",
        icon: "fas fa-bars",
        execute: () => go("pane-desktop", "settingsStartMenuWidth")
      },
      {
        title: "Settings: Show Workspaces",
        subtitle: "Toggle workspace area in taskbar",
        tag: "settings",
        icon: "fas fa-th-large",
        execute: () => go("pane-desktop", "settingsShowWorkspace")
      },
      {
        title: "Settings: GUI Scale",
        subtitle: "Scale the entire interface",
        tag: "settings",
        icon: "fas fa-expand-arrows-alt",
        execute: () => go("pane-appearance", "settingsGuiScale")
      },
      {
        title: "Settings: Font Size",
        subtitle: "Adjust base font size",
        tag: "settings",
        icon: "fas fa-font",
        execute: () => go("pane-appearance", "settingsFontSize")
      },
      {
        title: "Settings: Font Family",
        subtitle: "Choose Open Sans, Inter, Rubik, or more",
        tag: "settings",
        icon: "fas fa-text-height",
        execute: () => go("pane-appearance", "sc-style")
      },
      {
        title: "Settings: Window Animations",
        subtitle: "Open, close, minimize effects and speed",
        tag: "settings",
        icon: "fas fa-film",
        execute: () => go("pane-appearance", "settingsOpenAnimation")
      },
      {
        title: "Settings: Custom Cursor",
        subtitle: "Upload or clear a custom cursor",
        tag: "settings",
        icon: "fas fa-mouse-pointer",
        execute: () => go("pane-appearance", "settingsCursorUploadBtn")
      },
      {
        title: "Settings: Wallpaper",
        subtitle: "Cycle on start, upload custom wallpaper",
        tag: "settings",
        icon: "fas fa-image",
        execute: () => go("pane-appearance", "settings-wallpaper-card")
      },
      {
        title: "Settings: CDN Mirror",
        subtitle: "Choose a mirror for fetching game assets",
        tag: "settings",
        icon: "fas fa-server",
        execute: () => go("pane-network", "settingsCdnMirror")
      },
      {
        title: "Settings: WISP Server",
        subtitle: "Configure Scramjet proxy server",
        tag: "settings",
        icon: "fas fa-shield-alt",
        execute: () => go("pane-network", "settingsWispServer")
      },
      {
        title: "Settings: Master Volume",
        subtitle: "Adjust global volume level",
        tag: "settings",
        icon: "fas fa-volume-up",
        execute: () => go("pane-audio", "settingsMasterVolume")
      },
      {
        title: "Settings: Export Data",
        subtitle: "Backup system settings and files",
        tag: "settings",
        icon: "fas fa-file-export",
        execute: () => go("pane-data", "btnExportData")
      }
    ];
  }

  _isTerminalCommand(str) {
    const list = [
      "ls",
      "cd",
      "neofetch",
      "clear",
      "tree",
      "pwd",
      "mkdir",
      "rm",
      "cat",
      "touch",
      "whoami",
      "hostname",
      "uname",
      "history",
      "date",
      "ping",
      "curl"
    ];
    const firstWord = str.split(" ")[0];
    return list.includes(firstWord);
  }

  _tryCalculate(search) {
    if (!search) return null;
    const expr = search.replace(/\s/g, "");
    if (!/^[\d+\-*/.^()%!,a-z]+$/.test(expr)) return null;
    if (!/[\d]/.test(expr)) return null;
    if (
      /[a-z]{2,}/.test(expr) &&
      !/^(sqrt|sin|cos|tan|log|ln|abs|round|floor|ceil)\(/.test(expr) &&
      expr !== "pi" &&
      expr !== "e"
    )
      return null;
    try {
      const result = this._safeEval(expr);
      if (result === null || result === undefined || !isFinite(result)) return null;
      return {
        title: `= ${Number.isInteger(result) ? result : parseFloat(result.toFixed(6))}`,
        subtitle: `Result of ${search}`,
        tag: "calc",
        icon: "fas fa-calculator",
        execute: () => {
          navigator.clipboard.writeText(result.toString());
          os.notify.send("Calculator", "Result copied to clipboard", {
            type: "success",
            duration: 2000,
            icon: "fas fa-calculator",
            appSource: AppSource.COMMAND_PALETTE
          });
        }
      };
    } catch {
      return null;
    }
  }

  _safeEval(expr) {
    const ops = {
      "+": (a, b) => a + b,
      "-": (a, b) => a - b,
      "*": (a, b) => a * b,
      "/": (a, b) => a / b,
      "^": (a, b) => Math.pow(a, b),
      "%": (a, b) => a % b
    };
    const funcs = {
      sqrt: Math.sqrt,
      sin: (x) => Math.sin((x * Math.PI) / 180),
      cos: (x) => Math.cos((x * Math.PI) / 180),
      tan: (x) => Math.tan((x * Math.PI) / 180),
      log: Math.log10,
      ln: Math.log,
      abs: Math.abs,
      round: Math.round,
      floor: Math.floor,
      ceil: Math.ceil
    };
    const consts = { pi: Math.PI, e: Math.E };
    let pos = 0;
    const parse = (minPrec = 0) => {
      let left = parsePrimary();
      while (pos < expr.length) {
        const op = expr[pos];
        const prec = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 3, "%": 2 }[op] || 0;
        if (prec === 0 || prec <= minPrec) break;
        pos++;
        const right = parse(prec);
        if (op === "/" && right === 0) throw new Error("div by zero");
        left = ops[op](left, right);
      }
      return left;
    };
    const parsePrimary = () => {
      if (pos >= expr.length) throw new Error("unexpected end");
      if (expr[pos] === "(") {
        pos++;
        const val = parse(0);
        if (expr[pos] !== ")") throw new Error("missing )");
        pos++;
        return val;
      }
      if (expr[pos] === "-") {
        pos++;
        return -parsePrimary();
      }
      const nameMatch = expr.slice(pos).match(/^[a-z]+/);
      if (nameMatch) {
        const name = nameMatch[0];
        pos += name.length;
        if (consts[name] !== undefined) return consts[name];
        if (funcs[name]) {
          if (expr[pos] === "(") {
            pos++;
            const arg = parse(0);
            if (expr[pos] !== ")") throw new Error("missing )");
            pos++;
            return funcs[name](arg);
          }
          throw new Error("( expected after " + name);
        }
        throw new Error("unknown: " + name);
      }
      const numMatch = expr.slice(pos).match(/^(\d+\.?\d*|\.\d+)/);
      if (numMatch) {
        pos += numMatch[0].length;
        return parseFloat(numMatch[0]);
      }
      if (expr[pos] === ",") {
        pos++;
        return parse(0);
      }
      throw new Error("unexpected: " + expr[pos]);
    };
    const result = parse(0);
    if (pos < expr.length) throw new Error("unexpected trailing: " + expr.slice(pos));
    return result;
  }

  _tryConvert(search) {
    if (!search) return null;
    const convPattern =
      /^(\d+\.?\d*)\s*(celsius|c|fahrenheit|f|cm|inch|inches|m|meter|meters|ft|feet|km|kilometer|kilometers|mile|miles|kg|kilogram|kilograms|lb|lbs|pound|pounds|gb|gigabyte|gigabytes|mb|megabyte|megabytes)\s+(?:to|in|->|→)\s+(celsius|c|fahrenheit|f|cm|inch|inches|m|meter|meters|ft|feet|km|kilometer|kilometers|mile|miles|kg|kilogram|kilograms|lb|lbs|pound|pounds|gb|gigabyte|gigabytes|mb|megabyte|megabytes)$/i;
    const match = search.match(convPattern);
    if (!match) return null;
    const val = parseFloat(match[1]);
    const from = match[2].toLowerCase();
    const to = match[3].toLowerCase();
    const conversions = {
      "c->f": (v) => (v * 9) / 5 + 32,
      "celsius->f": (v) => (v * 9) / 5 + 32,
      "c->fahrenheit": (v) => (v * 9) / 5 + 32,
      "celsius->fahrenheit": (v) => (v * 9) / 5 + 32,
      "f->c": (v) => ((v - 32) * 5) / 9,
      "fahrenheit->c": (v) => ((v - 32) * 5) / 9,
      "f->celsius": (v) => ((v - 32) * 5) / 9,
      "fahrenheit->celsius": (v) => ((v - 32) * 5) / 9,
      "cm->inch": (v) => v / 2.54,
      "cm->inches": (v) => v / 2.54,
      "inch->cm": (v) => v * 2.54,
      "inches->cm": (v) => v * 2.54,
      "m->ft": (v) => v * 3.28084,
      "meter->ft": (v) => v * 3.28084,
      "meters->ft": (v) => v * 3.28084,
      "m->feet": (v) => v * 3.28084,
      "meter->feet": (v) => v * 3.28084,
      "meters->feet": (v) => v * 3.28084,
      "ft->m": (v) => v / 3.28084,
      "feet->m": (v) => v / 3.28084,
      "ft->meter": (v) => v / 3.28084,
      "feet->meter": (v) => v / 3.28084,
      "ft->meters": (v) => v / 3.28084,
      "feet->meters": (v) => v / 3.28084,
      "km->mile": (v) => v / 1.60934,
      "km->miles": (v) => v / 1.60934,
      "kilometer->mile": (v) => v / 1.60934,
      "kilometer->miles": (v) => v / 1.60934,
      "kilometers->mile": (v) => v / 1.60934,
      "kilometers->miles": (v) => v / 1.60934,
      "mile->km": (v) => v * 1.60934,
      "miles->km": (v) => v * 1.60934,
      "mile->kilometer": (v) => v * 1.60934,
      "miles->kilometer": (v) => v * 1.60934,
      "mile->kilometers": (v) => v * 1.60934,
      "miles->kilometers": (v) => v * 1.60934,
      "kg->lb": (v) => v * 2.20462,
      "kg->lbs": (v) => v * 2.20462,
      "kg->pound": (v) => v * 2.20462,
      "kg->pounds": (v) => v * 2.20462,
      "kilogram->lb": (v) => v * 2.20462,
      "kilogram->lbs": (v) => v * 2.20462,
      "kilogram->pound": (v) => v * 2.20462,
      "kilogram->pounds": (v) => v * 2.20462,
      "kilograms->lb": (v) => v * 2.20462,
      "kilograms->lbs": (v) => v * 2.20462,
      "kilograms->pound": (v) => v * 2.20462,
      "kilograms->pounds": (v) => v * 2.20462,
      "lb->kg": (v) => v / 2.20462,
      "lbs->kg": (v) => v / 2.20462,
      "lb->kilogram": (v) => v / 2.20462,
      "lbs->kilogram": (v) => v / 2.20462,
      "lb->kilograms": (v) => v / 2.20462,
      "lbs->kilograms": (v) => v / 2.20462,
      "pound->kg": (v) => v / 2.20462,
      "pound->kilograms": (v) => v / 2.20462,
      "pounds->kg": (v) => v / 2.20462,
      "pounds->kilograms": (v) => v / 2.20462,
      "gb->mb": (v) => v * 1024,
      "gigabyte->mb": (v) => v * 1024,
      "gigabytes->mb": (v) => v * 1024,
      "gb->megabyte": (v) => v * 1024,
      "gigabyte->megabyte": (v) => v * 1024,
      "gigabytes->megabyte": (v) => v * 1024,
      "gb->megabytes": (v) => v * 1024,
      "gigabyte->megabytes": (v) => v * 1024,
      "gigabytes->megabytes": (v) => v * 1024,
      "mb->gb": (v) => v / 1024,
      "megabyte->gb": (v) => v / 1024,
      "megabytes->gb": (v) => v / 1024,
      "mb->gigabyte": (v) => v / 1024,
      "megabyte->gigabyte": (v) => v / 1024,
      "megabytes->gigabyte": (v) => v / 1024,
      "mb->gigabytes": (v) => v / 1024,
      "megabyte->gigabytes": (v) => v / 1024,
      "megabytes->gigabytes": (v) => v / 1024
    };
    const key = `${from}->${to}`;
    const fn = conversions[key];
    if (!fn) return null;
    const result = fn(val);
    const label = `${val} ${match[2]} = ${Number.isInteger(result) ? result : parseFloat(result.toFixed(4))} ${match[3]}`;
    return {
      title: label,
      subtitle: "Unit conversion result. Click to copy",
      tag: "conv",
      icon: "fas fa-arrows-left-right",
      execute: () => {
        navigator.clipboard.writeText(result.toString());
        os.notify.send("Conversion", "Result copied to clipboard", {
          type: "success",
          duration: 2000,
          icon: "fas fa-arrows-left-right",
          appSource: AppSource.COMMAND_PALETTE
        });
      }
    };
  }

  _setSystemTheme(val) {
    os.storage.set(StorageKeys.theme, val);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const effective = val === "auto" ? (prefersDark ? "dark" : "light") : val;
    document.documentElement.setAttribute("data-theme", effective);
    os.events.emit(BusEvents.SETTINGS_CHANGED, { key: "theme", value: val });
    os.notify.send("Theme Changed", `System appearance set to ${val}`, {
      type: "success",
      duration: 5000,
      icon: "fas fa-palette",
      appSource: AppSource.COMMAND_PALETTE
    });
  }

  _toggleSound(val) {
    os.storage.set(StorageKeys.soundEnabled, val ? "true" : "false");
    os.events.emit(BusEvents.SETTINGS_CHANGED, { key: "soundEnabled", value: val ? "true" : "false" });
    os.notify.send("Sound Settings", `System audio feedback is now ${val ? "enabled" : "disabled"}`, {
      type: "info",
      duration: 5000,
      icon: "fas fa-volume-up"
    });
  }

  _toggleDND(val) {
    os.storage.set(StorageKeys.dndKey, val ? "true" : "false");
    os.notify.send("Do Not Disturb", `Silence state is now ${val ? "activated" : "deactivated"}`, {
      type: "info",
      duration: 5000,
      icon: "fas fa-bell-slash",
      appSource: AppSource.COMMAND_PALETTE
    });
  }

  _closeAllWindows() {
    os.window.closeAll();
    os.notify.send("Close Windows", "All windows closed", {
      type: "success",
      duration: 3000,
      icon: "fas fa-window-close",
      appSource: AppSource.COMMAND_PALETTE
    });
  }

  _minimizeAllWindows() {
    if (this.services.windowManager) {
      const wm = this.services.windowManager;
      const winIds = Array.from(wm.openWindows.keys());
      for (const winId of winIds) {
        const win = document.getElementById(winId);
        if (win) wm.minimizeWindow(win);
      }
    }
  }

  _toggleFullscreen() {
    if (this.services.windowManager && this.services.windowManager.activeWindow) {
      this.services.windowManager.toggleFullscreen(this.services.windowManager.activeWindow);
    }
  }

  _toggleWorkspaceOverview() {
    const ws = this.services.windowManager?.workspaceManager;
    if (ws) ws.toggleOverview();
  }

  _switchWorkspace(index) {
    const ws = this.services.windowManager?.workspaceManager;
    if (ws && ws.workspaces[index]) ws.switchTo(ws.workspaces[index].id);
  }

  _updateActiveSelection() {
    const items = this.resultsContainer.querySelectorAll(".cmd-palette-item");
    items.forEach((item) => {
      const idx = parseInt(item.dataset.index);
      item.classList.toggle("active", idx === this.activeIndex);
    });
    this._scrollToActive();
  }

  _scrollToActive() {
    const activeEl = this.resultsContainer.querySelector(".cmd-palette-item.active");
    if (!activeEl) return;
    const parent = this.resultsContainer.parentElement;
    const activeTop = activeEl.offsetTop;
    const activeBottom = activeTop + activeEl.offsetHeight;
    const parentTop = parent.scrollTop;
    const parentBottom = parentTop + parent.offsetHeight;

    if (activeTop < parentTop) {
      parent.scrollTop = activeTop;
    } else if (activeBottom > parentBottom) {
      parent.scrollTop = activeBottom - parent.offsetHeight;
    }
  }

  _executeActive() {
    const activeItem = this.results[this.activeIndex];
    if (activeItem) {
      activeItem.execute();
      if (activeItem.tag !== "nav" && this.currentSubpalette !== "wallpaper" && !activeItem.keepOpen) {
        this.close();
      }
    }
  }

  _escapeHTML(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
