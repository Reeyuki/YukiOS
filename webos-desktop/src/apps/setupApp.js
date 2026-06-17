import { BaseApp } from "../core/BaseApp.js";
import { StorageKeys } from "../StorageKeys.js";
import { resolveWallpaperUrl } from "../shared/assetResolver.js";
import { SystemUtilities } from "../system.js";
import { Achievements } from "../achievements.js";
import { AppSource } from "../AppSource.js";
import { PREDEFINED_AVATARS } from "./accountManager.js";
import { os } from "../os/index.js";
import { applyFontFamily } from "../settings/settingsApply.js";
import { $, $$, bindEvent, setText, setHTML, toggleClass } from "../shared/domUtils.js";
import { getAllThemes } from "../shared/themeEngine.js";

export const FEATURE_DATA = {
  step2: [
    {
      icon: "fas fa-desktop",
      title: "True Desktop Experience",
      desc: "Full windowed multitasking with drag, resize, snap, minimize, maximize",
      animation: "tilt-card"
    },
    {
      icon: "fas fa-gamepad",
      title: "3700+ Games & Emulators",
      desc: "JS-DOS, V86, Ruffle Flash, Azahar 3DS, and retro console emulation",
      animation: "spin-card"
    },
    {
      icon: "fas fa-folder-tree",
      title: "Persistent Filesystem",
      desc: "BrowserFS + IndexedDB storage that survives browser restarts",
      animation: "bounce-card"
    },
    {
      icon: "fas fa-cloud",
      title: "Works Offline",
      desc: "PWA with service worker - install and use without internet",
      animation: "pulse-card"
    },
    {
      icon: "fas fa-box-archive",
      title: "50+ Built-in Apps",
      desc: "Notepad, Terminal, Browser, Office viewer, Calculator, and more",
      animation: "glow-card"
    },
    {
      icon: "fas fa-keyboard",
      title: "Keyboard Shortcuts",
      desc: "F1 (command palette), Alt+Q (window switch) Ctrl+D (desktop), Ctrl+arrows (snap)",
      animation: "slide-card"
    }
  ],
  step3: [
    {
      icon: "fas fa-keyboard",
      title: "Command Palette",
      desc: "Global launcher and system shell via Ctrl+K / F1"
    },
    {
      icon: "fas fa-save",
      title: "Session Persistence",
      desc: "Restores windows, layout, and app state across reloads"
    },
    {
      icon: "fas fa-paint-brush",
      title: "Full Customization",
      desc: "Themes, wallpapers, UI scaling, and Turbo Mode"
    },
    {
      icon: "fas fa-bell",
      title: "Notifications",
      desc: "Toast notifications with Do Not Disturb mode"
    },
    {
      icon: "fas fa-sliders-h",
      title: "Audio Mixer",
      desc: "Per-app volume control with master volume"
    },
    {
      icon: "fas fa-download",
      title: "Import / Export",
      desc: "Backup and migrate full system configuration"
    }
  ],
  step3b: [
    {
      icon: "fas fa-layer-group",
      title: "Taskbar & Start Menu",
      desc: "Launch apps, manage windows, switch workspaces"
    },
    {
      icon: "fas fa-eye",
      title: "Window Preview",
      desc: "Hover taskbar for live window previews (Tab Peek)"
    },
    {
      icon: "fas fa-window-restore",
      title: "Window Management",
      desc: "Advanced z-ordering, drag system, lifecycle control"
    },
    {
      icon: "fas fa-arrows-alt",
      title: "Window Snapping",
      desc: "Drag to edges/corners, keyboard snap with Ctrl+arrows"
    },
    {
      icon: "fas fa-upload",
      title: "File Drag-and-Drop",
      desc: "Drag files from host OS to desktop"
    },
    {
      icon: "fas fa-network-wired",
      title: "Unified Ecosystem",
      desc: "Core apps interconnected through shared services"
    },
    {
      icon: "fas fa-cloud",
      title: "PWA & Offline",
      desc: "Installable webOS with full offline capability"
    },
    {
      icon: "fas fa-arrows-up-down-left-right",
      title: "Workspace System",
      desc: "Multiple virtual desktops for organizing tasks"
    },
    {
      icon: "fas fa-code-branch",
      title: "App Creator",
      desc: "Add custom apps with proxies and icons"
    },
    {
      icon: "fas fa-gamepad",
      title: "Steam Game Hub",
      desc: "Browse 3700+ games with store pages"
    },
    {
      icon: "fas fa-microchip",
      title: "Multi-Runtime Engine",
      desc: "JS-DOS, V86, Azahar 3DS, Ruffle, WebAssembly"
    },
    {
      icon: "fas fa-trophy",
      title: "Stats & Achievements",
      desc: "Track usage, milestones, playtime"
    },
    {
      icon: "fas fa-calendar-alt",
      title: "Calendar System",
      desc: "Calendar popup with event management"
    },
    {
      icon: "fas fa-robot",
      title: "Clippy Assistant",
      desc: "Animated desktop helper with tips"
    },
    {
      icon: "fas fa-user-lock",
      title: "Session Management",
      desc: "Login screen with 15-minute auto-login"
    },
    {
      icon: "fas fa-adjust",
      title: "Window Transparency",
      desc: "Dynamic transparency, hides when gaming"
    },
    {
      icon: "fas fa-mouse-pointer",
      title: "Context Menus",
      desc: "Right-click menus for desktop, explorer, taskbar, tray, start menu, and Steam library"
    },
    {
      icon: "fas fa-file-export",
      title: "File Actions Menu",
      desc: "Convert/transform files, create archives, download selected items, and quick wallpaper actions"
    },
    {
      icon: "fas fa-window-maximize",
      title: "Window Control Menu",
      desc: "Snap left/right/maximize, move windows between workspaces, pin/unpin taskbar, and open properties"
    },
    {
      icon: "fas fa-gamepad",
      title: "Steam Context Actions",
      desc: "Favorites, hide/unhide, collections, add game shortcuts to desktop, and report broken games"
    },
    {
      icon: "fas fa-arrows-alt",
      title: "Taskbar Positioning",
      desc: "Configurable: bottom, top, left, right"
    }
  ],
  step6: {
    keyboardShortcuts: [
      { keys: "Ctrl+K", desc: "Open Unified Command Palette" },
      { keys: "Ctrl+P", desc: "Open Unified Command Palette" },
      { keys: "F1", desc: "Open Unified Command Palette" },
      { keys: "Ctrl+D", desc: "Show / Hide Desktop (Minimize or restore all windows)" },
      { keys: "Ctrl+←", desc: "Snap active window to the left half of the screen" },
      { keys: "Ctrl+→", desc: "Snap active window to the right half of the screen" },
      { keys: "Ctrl+↑", desc: "Maximize active window" },
      { keys: "Control", desc: "Toggle Start Menu (when desktop is focused)" },
      { keys: "Tab", desc: "Toggle Start Menu (when desktop is focused)" },
      { keys: "Space", desc: "Toggle Start Menu (when desktop is focused)" },
      { keys: "Ctrl+C", desc: "Copy selected files or folders" },
      { keys: "Ctrl+X", desc: "Cut selected files or folders" },
      { keys: "Ctrl+V", desc: "Paste copied or cut files/folders into desktop or explorer" },
      { keys: "Delete", desc: "Delete selected icons/files on the desktop" },
      { keys: "F2", desc: "Start inline renaming of selected file/folder" },
      { keys: "Ctrl+O", desc: "Open file inside Notepad" },
      { keys: "Ctrl+S", desc: "Save active file in Notepad" },
      { keys: "Ctrl+Shift+S", desc: "Save active file as new file in Notepad" },
      { keys: "Ctrl+F", desc: "Open Find Text search dialog in Notepad" },
      { keys: "F3", desc: "Find next occurrence of matched text" },
      { keys: "Shift+F3", desc: "Find previous occurrence of matched text" },
      { keys: "Ctrl+H", desc: "Open Replace dialog in Notepad" },
      { keys: "Ctrl+G", desc: "Go to line dialog in Notepad" },
      { keys: "Ctrl++", desc: "Zoom in text editor" },
      { keys: "Ctrl+-", desc: "Zoom out text editor" },
      { keys: "Ctrl+0", desc: "Reset zoom factor to default in Notepad" },
      { keys: "Escape", desc: "Close active Notepad dialogs / popups" },
      { keys: "Alt+1-9", desc: "Switch directly to browser Tab 1-9" },
      { keys: "Ctrl+L", desc: "Focus browser address/URL bar & select" },
      { keys: "Ctrl+T", desc: "Create new browser tab" },
      { keys: "Ctrl+W", desc: "Close active browser tab" },
      { keys: "Ctrl+Shift+T", desc: "Reopen last closed browser tab" },
      { keys: "Ctrl+V", desc: "Paste & evaluate math expression from clipboard (Calculator)" },
      { keys: "0-9", desc: "Press calculator digit keys" },
      { keys: ".", desc: "Decimal points button" },
      { keys: "+, -, *, /", desc: "Press arithmetic operator buttons (+, −, ×, ÷)" },
      { keys: "%", desc: "Percent calculations button" },
      { keys: "Enter, =", desc: "Equals / Evaluate calculations" },
      { keys: "Backspace", desc: "Backspace / delete last digit in Calculator" },
      { keys: "Escape, Delete", desc: "Clear calculator (AC button)" },
      { keys: "Escape", desc: "Close calendar popup" },
      { keys: "←, →", desc: "Navigate previous or next month in Calendar" },
      { keys: "↑, ↓", desc: "Navigate previous or next year in Calendar" }
    ],
    filesystem: {
      title: "Virtual Filesystem",
      description:
        "Yuki OS uses BrowserFS with IndexedDB for persistent storage. Your files are stored locally in your browser and survive page reloads.",
      structure: [
        { path: "/home/reeyuki/Desktop", desc: "Desktop icons and shortcuts" },
        { path: "/home/reeyuki/Documents", desc: "Your documents and text files" },
        { path: "/home/reeyuki/Pictures", desc: "Images and wallpapers" },
        { path: "/home/reeyuki/Apps", desc: "Custom app shortcuts" }
      ]
    },
    turboModes: [
      { value: "balanced", title: "Balanced", desc: "Recommended for most users" },
      { value: "turbo", title: "Turbo", desc: "Maximize speed, reduce effects" },
      { value: "quality", title: "Quality", desc: "Best visuals, may be slower" }
    ],
    suggestedApps: [
      { id: "notepad", title: "Notepad", icon: "fas fa-file-alt" },
      { id: "terminal", title: "Terminal", icon: "fas fa-terminal" },
      { id: "browser", title: "Browser", icon: "fas fa-globe" },
      { id: "explorer", title: "File Explorer", icon: "fas fa-folder" },
      { id: "settings", title: "Settings", icon: "fas fa-cog" },
      { id: "yukiOsGuide", title: "Yuki OS Guide", icon: "fas fa-book-open" }
    ],
    transparencyLevels: [
      { value: "high", title: "High Transparency", desc: "More glass effect" },
      { value: "medium", title: "Medium Transparency", desc: "Balanced look" },
      { value: "low", title: "Low Transparency", desc: "More solid windows" }
    ]
  }
};

export class SetupApp extends BaseApp {
  constructor(services) {
    super(services);
    this.totalSetupSteps = 9;
    this.currentStep = 0;
    this.userChoices = {
      theme: "dark",
      wallpaper: null,
      taskbarPosition: "bottom",
      weather: true,
      notifications: true,
      sound: true,
      achievements: true,
      analytics: true,
      turboMode: "balanced",
      transparency: "medium",
      username: os.storage.get(StorageKeys.username) || "Guest",
      profilePicture: os.storage.get(StorageKeys.profilePicture) || PREDEFINED_AVATARS[0],
      fontFamily: "opensans",
      macOsControls: false,
      mikuCursor: false,
      clippy: true,
      clipboardManager: true
    };
    this.openWindows = new Set();
    this.wallpapers = [];
    this.customWallpapers = [];
    this.isTransitioning = false;
    this.stepTransitionTimer = null;
  }

  async open(options = {}) {
    const winId = "setup-wizard";
    if (await this._isSingletonOpen(winId)) return;

    this.currentStep = 0;
    this.isTransitioning = false;
    if (this.stepTransitionTimer) {
      clearTimeout(this.stepTransitionTimer);
      this.stepTransitionTimer = null;
    }

    await this._loadWallpapers();

    const win = os.window.create(winId, "Welcome to Yuki OS", "900px", "600px", {
      icon: "fas fa-rocket",
      position: "center"
    });
    win.innerHTML = this._buildUI();
    this.openWindows.add(winId);
    this._bindEvents(win);
    this._animateStepIn();
  }

  onClose(winId) {
    this.openWindows.delete(winId);
  }

  _buildUI() {
    return `
      <div class="window-header">
        <span>Welcome to Yuki OS</span>
        ${os.window.getWindowControls()}
      </div>
      <div class="window-content setup-wizard">
        <div class="setup-progress">
          ${Array.from({ length: this.totalSetupSteps - 1 }, (_, idx) => idx + 1)
            .map(
              (i) => `
            <div class="progress-step ${i === 1 ? "active" : ""}" data-step="${i}">
              <div class="progress-circle">
                <span class="progress-number">${i}</span>
                <i class="fas fa-check progress-check"></i>
              </div>
              ${i < this.totalSetupSteps - 1 ? '<div class="progress-line"></div>' : ""}
            </div>
          `
            )
            .join("")}
        </div>

        <div class="setup-content">
          ${this._buildStep1()}
          ${this._buildStep2()}
          ${this._buildStep3()}
          ${this._buildStep3b()}
          ${this._buildStep4()}
          ${this._buildStep5()}
          ${this._buildStep6()}
          ${this._buildStep7()}
          ${this._buildStep8()}
        </div>

        <div class="setup-footer">
          <button class="setup-btn setup-btn-secondary" id="setup-skip">
            Skip Setup
          </button>
          <div class="setup-nav">
            <button class="setup-btn setup-btn-secondary" id="setup-back" style="display: none;">
              <i class="fas fa-arrow-left"></i> Back
            </button>
            <button class="setup-btn setup-btn-primary" id="setup-next">
              Get Started <i class="fas fa-arrow-right"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  _buildStep1() {
    const nickname = os.storage.get(StorageKeys.username) || "Guest";
    return `
      <div class="setup-step active" data-step="1">
        <div class="step-hero" style="margin-top: 50px;">
          <div class="hero-logo">
            <i class="fas fa-snowflake"></i>
          </div>
          <h1 class="hero-title">Welcome to Yuki OS, ${nickname}</h1>
          <p class="hero-subtitle">Your browser-based desktop environment</p>
        </div>
      </div>
    `;
  }

  _buildStep2() {
    const cardsHtml = FEATURE_DATA.step2
      .map(
        (feature) => `
        <div class="feature-card ${feature.animation || ""}">
          <div class="feature-icon ${feature.animation?.replace("-card", "-icon") || ""}">
            <i class="${feature.icon}"></i>
          </div>
          <h3>${feature.title}</h3>
          <p>${feature.desc}</p>
        </div>
      `
      )
      .join("");

    return `
    <div class="setup-step" data-step="2">
      <h2 class="step-title feature-title">
        <i class="fas fa-star"></i>
        What Makes Yuki OS Different
      </h2>
      <div class="feature-grid">${cardsHtml}</div>
    </div>
  `;
  }

  _buildStep3() {
    const cardsHtml = FEATURE_DATA.step3
      .map(
        (feature) => `
        <div class="feature-card">
          <div class="feature-icon"><i class="${feature.icon}"></i></div>
          <h3>${feature.title}</h3>
          <p>${feature.desc}</p>
        </div>
      `
      )
      .join("");

    return `
      <div class="setup-step" data-step="3">
        <h2 class="step-title" style="justify-content: center; margin-bottom: 20px;">
          <i class="fas fa-puzzle-piece"></i> System Features
        </h2>
        <div class="feature-grid">${cardsHtml}</div>
      </div>
    `;
  }

  _buildStep3b() {
    const cardsHtml = FEATURE_DATA.step3b
      .map(
        (feature) => `
        <div class="feature-card">
          <div class="feature-icon"><i class="${feature.icon}"></i></div>
          <h3>${feature.title}</h3>
          <p>${feature.desc}</p>
        </div>
      `
      )
      .join("");

    return `
      <div class="setup-step" data-step="4">
        <h2 class="step-title" style="justify-content: center; margin-bottom: 20px;">
          <i class="fas fa-plus-circle"></i> More Features
        </h2>
        <div class="feature-grid">${cardsHtml}</div>
      </div>
    `;
  }

  _buildStep4() {
    const themes = getAllThemes();

    const themeButtons = themes
      .map(
        (theme) => `
        <button class="theme-btn ${this.userChoices.theme === theme.value ? "active" : ""}" data-theme="${theme.value}">
          <i class="${theme.icon}"></i>
          <span>${theme.label}</span>
        </button>
      `
      )
      .join("");

    return `
      <div class="setup-step" data-step="5">
        <h2 class="step-title">
          <i class="fas fa-paint-brush"></i> Personalize Your Experience
        </h2>

        <div class="personalize-section">
          <label class="section-label">Choose Theme</label>
          <div class="theme-selector theme-selector-scroll">
            ${themeButtons}
          </div>
        </div>

        <div class="personalize-section">
          <label class="section-label">Font Family</label>
          <div class="font-selector font-selector-grid">
            <button class="font-btn ${this.userChoices.fontFamily === "opensans" ? "active" : ""}" data-font="opensans">
              <span>Open Sans</span>
            </button>
            <button class="font-btn ${this.userChoices.fontFamily === "inter" ? "active" : ""}" data-font="inter">
              <span>Inter</span>
            </button>
            <button class="font-btn ${this.userChoices.fontFamily === "rubik" ? "active" : ""}" data-font="rubik">
              <span>Rubik</span>
            </button>
            <button class="font-btn ${this.userChoices.fontFamily === "sora" ? "active" : ""}" data-font="sora">
              <span>Sora</span>
            </button>
            <button class="font-btn ${this.userChoices.fontFamily === "jetbrainsmono" ? "active" : ""}" data-font="jetbrainsmono">
              <span>JetBrains Mono</span>
            </button>
            <button class="font-btn ${this.userChoices.fontFamily === "monocraft" ? "active" : ""}" data-font="monocraft">
              <span>Monocraft</span>
            </button>
          </div>
        </div>

        <div class="personalize-section">
          <label class="section-label">Select Wallpaper</label>
          <div class="wallpaper-grid" id="wallpaper-grid">
            ${this.wallpapers
              .map(
                (wp) => `
              <div class="wallpaper-thumb ${this.userChoices.wallpaper === wp ? "active" : ""}" data-wallpaper="${wp}" data-type="builtin">
                <img src="${resolveWallpaperUrl("static/wallpapers/" + wp)}" alt="${wp}">
                <div class="wallpaper-overlay">
                  <i class="fas fa-check"></i>
                </div>
              </div>
            `
              )
              .join("")}
            ${this.customWallpapers
              .map(
                (wp) => `
              <div class="wallpaper-thumb ${this.userChoices.wallpaper === wp.name ? "active" : ""}" data-wallpaper="${wp.name}" data-type="custom" data-url="${wp.url}">
                <img src="${wp.url}" alt="${wp.name}">
                <div class="wallpaper-overlay">
                  <i class="fas fa-check"></i>
                </div>
              </div>
            `
              )
              .join("")}
          </div>
          <button class="setup-btn setup-btn-secondary setup-upload-button" id="upload-wallpaper-btn">
            <i class="fas fa-upload"></i> Upload Custom Wallpaper
          </button>
        </div>

        <div class="personalize-section">
          <label class="section-label">Taskbar Position</label>
          <div class="taskbar-selector taskbar-selector-grid">
            <button class="taskbar-btn ${this.userChoices.taskbarPosition === "bottom" ? "active" : ""}" data-position="bottom">
              <i class="fas fa-arrow-down"></i>
              <span>Bottom</span>
            </button>
            <button class="taskbar-btn ${this.userChoices.taskbarPosition === "top" ? "active" : ""}" data-position="top">
              <i class="fas fa-arrow-up"></i>
              <span>Top</span>
            </button>
            <button class="taskbar-btn ${this.userChoices.taskbarPosition === "left" ? "active" : ""}" data-position="left">
              <i class="fas fa-arrow-left"></i>
              <span>Left</span>
            </button>
            <button class="taskbar-btn ${this.userChoices.taskbarPosition === "right" ? "active" : ""}" data-position="right">
              <i class="fas fa-arrow-right"></i>
              <span>Right</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  _buildStep5() {
    const turboHtml = FEATURE_DATA.step6.turboModes
      .map(
        (m) => `
        <button class="turbo-btn ${this.userChoices.turboMode === m.value ? "active" : ""}" data-mode="${m.value}">
          <div class="turbo-title">${m.title}</div>
        </button>
      `
      )
      .join("");

    const transparencyHtml = FEATURE_DATA.step6.transparencyLevels
      .map(
        (t) => `
        <button class="transparency-btn ${this.userChoices.transparency === t.value ? "active" : ""}" data-transparency="${t.value}">
          <div class="transparency-title">${t.title}</div>
        </button>
      `
      )
      .join("");

    return `
      <div class="setup-step" data-step="6">
        <h2 class="step-title">
          <i class="fas fa-sliders-h"></i> Quick Settings
        </h2>

        <div class="settings-grid">
          <div class="setting-item">
            <div class="setting-info">
              <i class="fas fa-cloud-sun setting-icon"></i>
              <div>
                <h4>Weather</h4>
              </div>
            </div>
            <label class="setting-toggle">
              <input type="checkbox" ${this.userChoices.weather ? "checked" : ""} data-setting="weather">
              <span class="toggle-track"><span class="toggle-thumb"></span></span>
            </label>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <i class="fas fa-bell setting-icon"></i>
              <div>
                <h4>Notifications</h4>
              </div>
            </div>
            <label class="setting-toggle">
              <input type="checkbox" ${this.userChoices.notifications ? "checked" : ""} data-setting="notifications">
              <span class="toggle-track"><span class="toggle-thumb"></span></span>
            </label>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <i class="fas fa-volume-high setting-icon"></i>
              <div>
                <h4>Sound</h4>
              </div>
            </div>
            <label class="setting-toggle">
              <input type="checkbox" ${this.userChoices.sound ? "checked" : ""} data-setting="sound">
              <span class="toggle-track"><span class="toggle-thumb"></span></span>
            </label>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <i class="fas fa-trophy setting-icon"></i>
              <div>
                <h4>Achievements</h4>
              </div>
            </div>
            <label class="setting-toggle">
              <input type="checkbox" ${this.userChoices.achievements ? "checked" : ""} data-setting="achievements">
              <span class="toggle-track"><span class="toggle-thumb"></span></span>
            </label>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <i class="fas fa-chart-line setting-icon"></i>
              <div>
                <h4>Analytics</h4>
              </div>
            </div>
            <label class="setting-toggle">
              <input type="checkbox" ${this.userChoices.analytics ? "checked" : ""} data-setting="analytics">
              <span class="toggle-track"><span class="toggle-thumb"></span></span>
            </label>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <i class="fab fa-apple setting-icon"></i>
              <div>
                <h4>Mac Window Headers</h4>
              </div>
            </div>
            <label class="setting-toggle">
              <input type="checkbox" ${this.userChoices.macOsControls ? "checked" : ""} data-setting="macOsControls">
              <span class="toggle-track"><span class="toggle-thumb"></span></span>
            </label>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <i class="fas fa-mouse-pointer setting-icon"></i>
              <div>
                <h4>Miku Cursor</h4>
              </div>
            </div>
            <label class="setting-toggle">
              <input type="checkbox" ${this.userChoices.mikuCursor ? "checked" : ""} data-setting="mikuCursor">
              <span class="toggle-track"><span class="toggle-thumb"></span></span>
            </label>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <i class="fas fa-robot setting-icon"></i>
              <div>
                <h4>Clippy</h4>
              </div>
            </div>
            <label class="setting-toggle">
              <input type="checkbox" ${this.userChoices.clippy ? "checked" : ""} data-setting="clippy">
              <span class="toggle-track"><span class="toggle-thumb"></span></span>
            </label>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <i class="fas fa-paste setting-icon"></i>
              <div>
                <h4>Clipboard Manager</h4>
              </div>
            </div>
            <label class="setting-toggle">
              <input type="checkbox" ${this.userChoices.clipboardManager ? "checked" : ""} data-setting="clipboardManager">
              <span class="toggle-track"><span class="toggle-thumb"></span></span>
            </label>
          </div>
        </div>

        <div class="settings-row">
          <div class="settings-half">
            <label class="section-label">Turbo</label>
            <div class="turbo-selector">${turboHtml}</div>
          </div>
          <div class="settings-half">
            <label class="section-label">Transparency</label>
            <div class="transparency-selector">${transparencyHtml}</div>
          </div>
        </div>
      </div>
    `;
  }

  _buildStep6() {
    const shortcutsHtml = FEATURE_DATA.step6.keyboardShortcuts
      .map(
        (s) => `
        <div class="shortcut-item">
          <kbd>${s.keys}</kbd>
          <span>${s.desc}</span>
        </div>
      `
      )
      .join("");

    const filesystemHtml = FEATURE_DATA.step6.filesystem.structure
      .map(
        (f) => `
        <div class="filesystem-item">
          <code>${f.path}</code>
          <span>${f.desc}</span>
        </div>
      `
      )
      .join("");

    return `
      <div class="setup-step" data-step="7">
        <h2 class="step-title">
          <i class="fas fa-info-circle"></i> System Info
        </h2>

        <div class="personalize-section">
          <label class="section-label">Keyboard Shortcuts Reference</label>
          <div class="shortcuts-reference">${shortcutsHtml}</div>
        </div>

        <div class="personalize-section">
          <label class="section-label">${FEATURE_DATA.step6.filesystem.title}</label>
          <p class="system-info-copy">${FEATURE_DATA.step6.filesystem.description}</p>
          <div class="filesystem-structure">${filesystemHtml}</div>
        </div>
      </div>
    `;
  }

  _buildStep7() {
    const username = this.userChoices.username || "Guest";
    const profilePic = this.userChoices.profilePicture || PREDEFINED_AVATARS[0];
    const avatarsHtml = PREDEFINED_AVATARS.map(
      (avatar) => `
        <div class="setup-avatar-option ${avatar === profilePic ? "selected" : ""}" data-src="${avatar}" style="border-radius: 50%; overflow: hidden; cursor: pointer; border: 2px solid var(--glass-border); transition: all 0.15s; width: 56px; height: 56px; position: relative;">
          <img src="${avatar}" style="width: 100%; height: 100%; object-fit: cover;" />
          <div style="position: absolute; inset: 0; display: ${avatar === profilePic ? "flex" : "none"}; align-items: center; justify-content: center; background: color-mix(in srgb, var(--brand) 55%, transparent); color: var(--text-on-brand); font-size: 12px;"><i class="fas fa-check"></i></div>
        </div>
      `
    ).join("");

    return `
      <div class="setup-step" data-step="8">
        <h2 class="step-title">
          <i class="fas fa-user-circle"></i> Profile Setup
        </h2>
        <div class="personalize-section" style="display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 10px; padding: 10px; background: var(--brand-dim); border-radius: 8px; border: 1px solid var(--brand);">
            <div style="width: 46px; height: 46px; border-radius: 50%; overflow: hidden; border: 2px solid var(--brand); flex-shrink: 0;">
              <img id="setup-profile-preview-img" src="${profilePic}" style="width: 100%; height: 100%; object-fit: cover;" />
            </div>
            <div style="min-width: 0;">
              <div id="setup-profile-preview-name" style="font-size: 15px; color: var(--text-primary); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${username}</div>
              <div style="font-size: 12px; color: var(--text-secondary);">Profile Preview</div>
            </div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <label class="section-label">Nickname</label>
            <input id="setup-profile-name" type="text" value="${username}" placeholder="Enter your nickname" style="padding: 8px 10px; border-radius: 6px; border: 1px solid var(--glass-border); background: var(--surface-1); color: var(--text-primary); font-size: 14px; outline: none;" />
          </div>
          <button class="setup-btn setup-btn-secondary setup-upload-button" id="setup-profile-upload">
            <i class="fas fa-upload"></i> Upload Custom Avatar
          </button>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(56px, 1fr)); gap: 8px; max-height: 210px; overflow-y: auto;">
            ${avatarsHtml}
          </div>
        </div>
      </div>
    `;
  }

  _buildStep8() {
    const username = this.userChoices.username || "Guest";
    const profilePic = this.userChoices.profilePicture || PREDEFINED_AVATARS[0];
    return `
      <div class="setup-step" data-step="9">
        <div class="complete-hero">
          <div class="complete-icon">
            <i class="fas fa-rocket"></i>
          </div>
          <h2 class="complete-title">You're All Set!</h2>
          <p class="complete-subtitle">Yuki OS is ready to explore</p>
        </div>

        <div class="summary-grid">
          <div class="summary-item" style="grid-column: 1 / -1; display: flex; align-items: center; gap: 10px;">
            <img id="setup-summary-profile-img" src="${profilePic}" alt="${username}" style="width: 30px; height: 30px; border-radius: 50%; border: 1px solid var(--glass-border); object-fit: cover;">
            <span id="setup-summary-profile-name">Profile: ${username}</span>
          </div>
          <div class="summary-item">
            <i class="fas fa-palette"></i>
            <span>Theme: ${this.userChoices.theme}</span>
          </div>
          <div class="summary-item">
            <i class="fas fa-image"></i>
            <span>Wallpaper: ${this.userChoices.wallpaper || "Default"}</span>
          </div>
          <div class="summary-item">
            <i class="fas fa-arrows-alt"></i>
            <span>Taskbar: ${this.userChoices.taskbarPosition}</span>
          </div>
          <div class="summary-item">
            <i class="fas fa-cloud-sun"></i>
            <span>Weather: ${this.userChoices.weather ? "On" : "Off"}</span>
          </div>
          <div class="summary-item">
            <i class="fas fa-bell"></i>
            <span>Notifications: ${this.userChoices.notifications ? "On" : "Off"}</span>
          </div>
          <div class="summary-item">
            <i class="fas fa-volume-high"></i>
            <span>Sound: ${this.userChoices.sound ? "On" : "Off"}</span>
          </div>
          <div class="summary-item">
            <i class="fas fa-trophy"></i>
            <span>Achievements: ${this.userChoices.achievements ? "On" : "Off"}</span>
          </div>
          <div class="summary-item">
            <i class="fas fa-chart-line"></i>
            <span>Analytics: ${this.userChoices.analytics ? "On" : "Off"}</span>
          </div>
          <div class="summary-item">
            <i class="fas fa-tachometer-alt"></i>
            <span>Turbo: ${this.userChoices.turboMode}</span>
          </div>
          <div class="summary-item">
            <i class="fas fa-adjust"></i>
            <span>Transparency: ${this.userChoices.transparency}</span>
          </div>
          <div class="summary-item">
            <i class="fas fa-font"></i>
            <span>Font: ${this.userChoices.fontFamily === "opensans" ? "Open Sans" : this.userChoices.fontFamily === "inter" ? "Inter" : this.userChoices.fontFamily === "rubik" ? "Rubik" : this.userChoices.fontFamily === "sora" ? "Sora" : this.userChoices.fontFamily === "jetbrainsmono" ? "JetBrains Mono" : this.userChoices.fontFamily === "monocraft" ? "Monocraft" : this.userChoices.fontFamily}</span>
          </div>
          <div class="summary-item">
            <i class="fab fa-apple"></i>
            <span>Mac Headers: ${this.userChoices.macOsControls ? "On" : "Off"}</span>
          </div>
          <div class="summary-item">
            <i class="fas fa-mouse-pointer"></i>
            <span>Miku Cursor: ${this.userChoices.mikuCursor ? "On" : "Off"}</span>
          </div>
          <div class="summary-item">
            <i class="fas fa-robot"></i>
            <span>Clippy: ${this.userChoices.clippy ? "On" : "Off"}</span>
          </div>
          <div class="summary-item">
            <i class="fas fa-paste"></i>
            <span>Clipboard: ${this.userChoices.clipboardManager ? "On" : "Off"}</span>
          </div>
        </div>

        <div class="complete-actions">
          <button id="setup-launch-guide" class="setup-guide-btn">
            <i class="fas fa-book-open"></i>
            <span>Open Yuki OS Guide</span>
          </button>
        </div>
      </div>
    `;
  }

  _bindEvents(win) {
    const nextBtn = $("#setup-next", win);
    const backBtn = $("#setup-back", win);
    const skipBtn = $("#setup-skip", win);

    nextBtn.addEventListener("click", () => {
      if (this.isTransitioning) return;
      this._nextStep(win);
    });

    backBtn.addEventListener("click", () => {
      if (this.isTransitioning) return;
      this._prevStep(win);
    });
    skipBtn.addEventListener("click", () => this._skipSetup(win));

    const themeBtns = $$(".theme-btn", win);
    themeBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const theme = btn.dataset.theme;
        this.userChoices.theme = theme;
        themeBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this._applyTheme(theme);
      });
    });

    const fontBtns = $$(".font-btn", win);
    fontBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const font = btn.dataset.font;
        this.userChoices.fontFamily = font;
        fontBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        applyFontFamily(font);
      });
    });

    const wallpaperThumbs = $$(".wallpaper-thumb", win);
    wallpaperThumbs.forEach((thumb) => {
      thumb.addEventListener("click", () => {
        const wallpaper = thumb.dataset.wallpaper;
        this.userChoices.wallpaper = wallpaper;
        wallpaperThumbs.forEach((t) => t.classList.remove("active"));
        thumb.classList.add("active");
      });
    });

    const taskbarBtns = $$(".taskbar-btn", win);
    taskbarBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const position = btn.dataset.position;
        this.userChoices.taskbarPosition = position;
        taskbarBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });

    const toggles = $$(".setting-toggle input", win);
    toggles.forEach((toggle) => {
      toggle.addEventListener("change", () => {
        const setting = toggle.dataset.setting;
        this.userChoices[setting] = toggle.checked;
      });
    });

    const uploadBtn = $("#upload-wallpaper-btn", win);
    if (uploadBtn) {
      uploadBtn.addEventListener("click", () => this._handleWallpaperUpload(win));
    }

    const perfBtns = $$(".turbo-btn", win);
    perfBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.mode;
        this.userChoices.turboMode = mode;
        perfBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });

    const transparencyBtns = $$(".transparency-btn", win);
    transparencyBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const transparency = btn.dataset.transparency;
        this.userChoices.transparency = transparency;
        transparencyBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });

    const launchGuideBtn = $("#setup-launch-guide", win);
    if (launchGuideBtn) {
      launchGuideBtn.addEventListener("click", () => {
        this._services.yukiOsGuideApp.open();
      });
    }

    this._bindProfileStepEvents(win);
  }

  _nextStep(win) {
    if (this.isTransitioning) return;

    if (this.currentStep < this.totalSetupSteps - 1) {
      this.isTransitioning = true;

      const currentStepEl = $(`.setup-step[data-step="${this.currentStep + 1}"]`, win);
      if (!currentStepEl) {
        this.isTransitioning = false;
        return;
      }

      currentStepEl.classList.add("exit-left");

      this.stepTransitionTimer = setTimeout(() => {
        currentStepEl.classList.remove("active", "exit-left");

        this.currentStep++;

        this._updateStepUI(win);
        this._animateStepIn();

        this.isTransitioning = false;
        this.stepTransitionTimer = null;
      }, 300);
    } else {
      this._completeSetup(win);
    }
  }

  _prevStep(win) {
    if (this.isTransitioning) return;
    if (this.currentStep <= 0) return;

    this.isTransitioning = true;

    const currentStepEl = $(`.setup-step[data-step="${this.currentStep + 1}"]`, win);
    if (currentStepEl) currentStepEl.classList.remove("active");

    this.currentStep--;

    this._updateStepUI(win);

    const prevStepEl = $(`.setup-step[data-step="${this.currentStep + 1}"]`, win);

    if (prevStepEl) {
      prevStepEl.classList.add("active");
      prevStepEl.style.transform = "translateX(-50px)";

      requestAnimationFrame(() => {
        prevStepEl.style.transform = "translateX(0)";
      });
    }

    setTimeout(() => {
      this.isTransitioning = false;
    }, 250);
  }

  _updateStepUI(win) {
    const steps = $$(".progress-step", win);
    steps.forEach((step, index) => {
      step.classList.remove("active", "completed");
      if (index < this.currentStep) {
        step.classList.add("completed");
      } else if (index === this.currentStep) {
        step.classList.add("active");
      }
    });

    const backBtn = $("#setup-back", win);
    const nextBtn = $("#setup-next", win);

    backBtn.style.display = this.currentStep > 0 ? "flex" : "none";

    if (this.currentStep === this.totalSetupSteps - 1) {
      setHTML(nextBtn, 'Start Exploring <i class="fas fa-rocket"></i>');
    } else {
      setHTML(nextBtn, 'Continue <i class="fas fa-arrow-right"></i>');
    }

    this._refreshProfileSummary(win);
  }

  _animateStepIn() {
    const stepEl = document.querySelector(`.setup-step[data-step="${this.currentStep + 1}"]`);
    if (stepEl) {
      stepEl.classList.add("active");
    }
  }

  _applyTheme(theme) {
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
    const effective = theme === "auto" ? (prefersDark ? "dark" : "light") : theme;
    document.documentElement.setAttribute("data-theme", effective);
  }

  async _completeSetup(win) {
    const finalizedName = (this.userChoices.username || "").trim() || "Guest";
    const finalizedAvatar = this.userChoices.profilePicture || PREDEFINED_AVATARS[0];
    this.userChoices.username = finalizedName;
    this.userChoices.profilePicture = finalizedAvatar;
    os.storage.set(StorageKeys.username, finalizedName);
    os.storage.set(StorageKeys.profilePicture, finalizedAvatar);

    if (this._services.sessionManager?.currentSession) {
      this._services.sessionManager.currentSession.name = finalizedName;
      this._services.sessionManager.currentSession.key =
        finalizedName.toLowerCase().replace(/[^a-z0-9]/g, "") || "guest";
      this._services.sessionManager.currentSession.avatar = finalizedAvatar;
    }

    os.storage.set(StorageKeys.theme, this.userChoices.theme);
    os.storage.set(StorageKeys.taskbarPosition, this.userChoices.taskbarPosition);
    os.storage.set(StorageKeys.weather, this.userChoices.weather.toString());
    os.storage.set(StorageKeys.notificationsEnabled, this.userChoices.notifications.toString());
    os.storage.set(StorageKeys.soundEnabled, this.userChoices.sound.toString());
    os.storage.set(StorageKeys.achievementsDisabled, (!this.userChoices.achievements).toString());
    os.storage.set(StorageKeys.analyticsDisabled, (!this.userChoices.analytics).toString());
    os.storage.set(StorageKeys.setupCompleted, "true");

    os.storage.set(StorageKeys.turboMode, this.userChoices.turboMode);
    os.storage.set(StorageKeys.transparency, this.userChoices.transparency);

    os.storage.set(StorageKeys.fontFamily, this.userChoices.fontFamily);
    os.storage.set(StorageKeys.macOsControls, this.userChoices.macOsControls.toString());
    os.storage.set(StorageKeys.mikuCursor, this.userChoices.mikuCursor.toString());
    os.storage.set(StorageKeys.clippy, this.userChoices.clippy.toString());
    os.storage.set(StorageKeys.clipboardManagerEnabled, this.userChoices.clipboardManager.toString());

    this._services.achievementsApp?.trigger(Achievements.SetupComplete);

    if (this.userChoices.wallpaper) {
      try {
        const wallpaperUrl = resolveWallpaperUrl("static/wallpapers/" + this.userChoices.wallpaper);
        await SystemUtilities.setWallpaper(wallpaperUrl);
      } catch (e) {
        console.error("Failed to set wallpaper:", e);
      }
    }

    os.events.emit("SETUP_COMPLETED", this.userChoices);
    os.events.emit("AUDIO_SETTINGS_CHANGED", { soundEnabled: this.userChoices.sound });
    document.dispatchEvent(
      new CustomEvent("AUDIO_SETTINGS_CHANGED", {
        detail: { soundEnabled: this.userChoices.sound }
      })
    );
    const welcomeContent = `Welcome to Yuki OS, ${this._services.sessionManager?.currentSession?.name || "User"}!

Your setup is complete. Here's what you configured:
- Theme: ${this.userChoices.theme}
- Taskbar: ${this.userChoices.taskbarPosition}
- Turbo Mode: ${this.userChoices.turboMode}
- Transparency: ${this.userChoices.transparency}
- Weather: ${this.userChoices.weather ? "Enabled" : "Disabled"}
- Notifications: ${this.userChoices.notifications ? "Enabled" : "Disabled"}

Quick Tips:
• Click the Start Menu to explore 50+ apps and 3700+ games
• Right-click the desktop for context menu options
• Use the Settings app to customize further anytime
• Your files persist in the virtual filesystem

Enjoy exploring Yuki OS!`;

    try {
      await os.fs.mkdir(["Documents"]);
      await os.fs.write(["Documents", "Welcome.txt"], welcomeContent);
    } catch (e) {
      console.error("Failed to create welcome file:", e);
    }

    os.notify.send(
      "Welcome to Yuki OS!",
      "Setup complete. Click Start Menu to begin exploring!",
      "success",
      8000,
      "fas fa-rocket",
      AppSource.SETUP
    );

    win.style.transition = "opacity 0.5s, transform 0.5s";
    win.style.opacity = "0";
    win.style.transform = "scale(0.95)";

    setTimeout(() => {
      os.window.close(win);
      this.openWindows.delete("setup-wizard");
    }, 500);
  }

  _skipSetup(win) {
    os.storage.set(StorageKeys.setupCompleted, "true");

    this._services.achievementsApp?.trigger(Achievements.SetupComplete);
    os.window.close(win);
    this.openWindows.delete("setup-wizard");
  }

  async _loadWallpapers() {
    try {
      const folder = await os.fs.readdir(["Pictures", "Wallpapers"]);
      if (folder) {
        this.wallpapers = Object.keys(folder).filter((name) => {
          const item = folder[name];
          return item && item.type === "file" && name.endsWith(".webp");
        });
      }
    } catch (e) {
      console.error("Failed to load wallpapers:", e);
      this.wallpapers = [
        "wallpaper1.webp",
        "wallpaper2.webp",
        "wallpaper3.webp",
        "wallpaper4.webp",
        "wallpaper5.webp",
        "wallpaper6.webp"
      ];
    }
  }

  async _handleWallpaperUpload(win) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target.result;
        const fileName = "custom_" + Date.now() + "." + file.name.split(".").pop();

        try {
          await os.fs.mkdir(["Pictures", "Wallpapers"]);
          await os.fs.write(["Pictures", "Wallpapers", fileName], dataUrl);

          this.customWallpapers.push({ name: fileName, url: dataUrl });
          this.userChoices.wallpaper = fileName;

          const grid = $("#wallpaper-grid", win);
          if (grid) {
            const newThumb = document.createElement("div");
            newThumb.className = "wallpaper-thumb active";
            newThumb.dataset.wallpaper = fileName;
            newThumb.dataset.type = "custom";
            newThumb.dataset.url = dataUrl;
            newThumb.innerHTML = `
              <img src="${dataUrl}" alt="${fileName}">
              <div class="wallpaper-overlay">
                <i class="fas fa-check"></i>
              </div>
            `;
            grid.querySelectorAll(".wallpaper-thumb").forEach((t) => t.classList.remove("active"));
            grid.appendChild(newThumb);
            newThumb.addEventListener("click", () => {
              this.userChoices.wallpaper = fileName;
              grid.querySelectorAll(".wallpaper-thumb").forEach((t) => t.classList.remove("active"));
              newThumb.classList.add("active");
            });
          }
        } catch (err) {
          console.error("Failed to save wallpaper:", err);
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  _bindProfileStepEvents(win) {
    const nameInput = $("#setup-profile-name", win);
    const uploadBtn = $("#setup-profile-upload", win);
    const previewName = $("#setup-profile-preview-name", win);
    const previewImg = $("#setup-profile-preview-img", win);
    const avatarOptions = $$(".setup-avatar-option", win);

    if (!nameInput || !uploadBtn || !previewName || !previewImg) return;

    nameInput.addEventListener("input", () => {
      const nextName = nameInput.value || "Guest";
      previewName.textContent = nextName;
      this.userChoices.username = nextName;
      this._refreshProfileSummary(win);
    });

    const selectAvatar = (src) => {
      this.userChoices.profilePicture = src;
      previewImg.src = src;
      avatarOptions.forEach((option) => {
        option.classList.toggle("selected", option.dataset.src === src);
        const badge = option.querySelector("div");
        if (badge) {
          badge.style.display = option.dataset.src === src ? "flex" : "none";
        }
      });
      this._refreshProfileSummary(win);
    };

    avatarOptions.forEach((option) => {
      option.addEventListener("click", () => {
        selectAvatar(option.dataset.src);
      });
    });

    uploadBtn.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target.result;
          if (!dataUrl) return;
          this.userChoices.profilePicture = dataUrl;
          previewImg.src = dataUrl;
          this._refreshProfileSummary(win);
        };
        reader.readAsDataURL(file);
      };
      input.click();
    });
  }

  _refreshProfileSummary(win) {
    const summaryImg = $("#setup-summary-profile-img", win);
    const summaryName = $("#setup-summary-profile-name", win);
    if (summaryImg) summaryImg.src = this.userChoices.profilePicture || PREDEFINED_AVATARS[0];
    if (summaryName) setText(summaryName, `Profile: ${this.userChoices.username || "Guest"}`);
  }
}
