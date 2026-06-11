import { SystemUtilities } from "./system.js";
import { StorageKeys } from "./StorageKeys.js";
import { BusEvents } from "./core/EventBus.js";
import { openFileWith } from "./fileDisplay.js";
import { resolveIconUrl } from "./shared/assetResolver.js";
import { AppSource } from "./AppSource.js";
import { os } from "./os/index.js";
import { WALLPAPER_NAME_URL_PAIRS } from "./wallpaperConfig.js";

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
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        this.toggle();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        this.toggle();
      } else if (e.key === "F1") {
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
      if (e.key === "Escape") {
        e.preventDefault();
        this.close();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        this.activeIndex = (this.activeIndex + 1) % this.results.length;
        this._updateActiveSelection();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        this.activeIndex = (this.activeIndex - 1 + this.results.length) % this.results.length;
        this._updateActiveSelection();
      } else if (e.key === "Enter") {
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
        const list = await new Promise((res, rej) => {
          fs.fs.readdir(dirPath, (e, list) => (e ? rej(e) : res(list)));
        });
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

    let items = [];

    const actions = [
      {
        title: "Lock Session",
        subtitle: "Suspends the session and prompts unlock",
        tag: "action",
        icon: "fas fa-lock",
        execute: () => {
          if (this.services.sessionManager) {
            this.services.sessionManager.lockSession();
          }
        }
      },
      {
        title: "Shutdown Session",
        subtitle: "Closes the current session and goes to login screen",
        tag: "action",
        icon: "fas fa-power-off",
        execute: () => {
          if (this.services.sessionManager) {
            this.services.sessionManager.lockToLoginScreen();
          }
        }
      },
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
      }
    ];

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

    for (const action of actions) {
      if (!search || action.title.toLowerCase().includes(search) || action.subtitle.toLowerCase().includes(search)) {
        items.push(action);
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
      if (activeItem.tag !== "nav" && this.currentSubpalette !== "wallpaper") {
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
