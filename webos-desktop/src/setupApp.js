import { BaseApp } from "./core/BaseApp.js";
import { StorageKeys } from "./StorageKeys.js";
import { resolveIconUrl, resolveWallpaperUrl } from "./shared/assetResolver.js";
import { SystemUtilities } from "./system.js";
import { Achievements } from "./achievements.js";

const FEATURE_DATA = {
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
      desc: "PWA with service worker — install and use without internet",
      animation: "pulse-card"
    },
    {
      icon: "fas fa-box-archive",
      title: "30+ Built-in Apps",
      desc: "Notepad, Terminal, Browser, Office viewer, Calculator, and more",
      animation: "glow-card"
    },
    {
      icon: "fas fa-keyboard",
      title: "Keyboard Shortcuts",
      desc: "Ctrl+K (command palette), Ctrl+D (desktop), Ctrl+arrows (snap)",
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
      desc: "Right-click menus for desktop, files, apps"
    },
    {
      icon: "fas fa-arrows-alt",
      title: "Taskbar Positioning",
      desc: "Configurable: bottom, top, left, right"
    }
  ],
  step6: {
    keyboardShortcuts: [
      { keys: "Ctrl+K", desc: "Open Command Palette" },
      { keys: "Ctrl+P", desc: "Open Command Palette" },
      { keys: "F1", desc: "Open Command Palette" },
      { keys: "Ctrl+D", desc: "Show/Hide Desktop" },
      { keys: "Ctrl+←", desc: "Snap window left" },
      { keys: "Ctrl+→", desc: "Snap window right" },
      { keys: "Ctrl+↑", desc: "Maximize window" },
      { keys: "Ctrl+C", desc: "Copy files" },
      { keys: "Ctrl+X", desc: "Cut files" },
      { keys: "Ctrl+V", desc: "Paste files" },
      { keys: "Delete", desc: "Delete files" },
      { keys: "F2", desc: "Rename file" },
      { keys: "Ctrl+S", desc: "Save file (Notepad)" },
      { keys: "Ctrl+F", desc: "Find text" }
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
    performanceModes: [
      { value: "balanced", title: "Balanced", desc: "Recommended for most users" },
      { value: "performance", title: "Performance", desc: "Maximize speed, reduce effects" },
      { value: "quality", title: "Quality", desc: "Best visuals, may be slower" }
    ],
    suggestedApps: [
      { id: "notepad", title: "Notepad", icon: "fas fa-file-alt" },
      { id: "terminal", title: "Terminal", icon: "fas fa-terminal" },
      { id: "browser", title: "Browser", icon: "fas fa-globe" },
      { id: "explorer", title: "File Explorer", icon: "fas fa-folder" },
      { id: "settings", title: "Settings", icon: "fas fa-cog" }
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
      performanceMode: "balanced",
      transparency: "medium",
      pinnedApps: []
    };
    this.openWindows = new Set();
    this.wallpapers = [];
    this.customWallpapers = [];
    this.isTransitioning = false;
    this.stepTransitionTimer = null;
  }

  async open(options = {}) {
    const winId = "setup-wizard";
    if (this._isSingletonOpen(winId)) return;

    // Reset state to prevent issues when reopening
    this.currentStep = 0;
    this.isTransitioning = false;
    if (this.stepTransitionTimer) {
      clearTimeout(this.stepTransitionTimer);
      this.stepTransitionTimer = null;
    }

    await this._loadWallpapers();

    const win = this.wm.createWindow(winId, "Welcome to Yuki OS", "900px", "600px", false, { position: "center" });
    win.innerHTML = this._buildUI();
    document.body.appendChild(win);
    this.wm.mountWindow(win, winId, "Setup", "fas fa-rocket");
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
        ${this.wm.getWindowControls()}
      </div>
      <div class="window-content setup-wizard">
        <div class="setup-progress">
          ${[1, 2, 3, 4, 5, 6, 7]
            .map(
              (i) => `
            <div class="progress-step ${i === 1 ? "active" : ""}" data-step="${i}">
              <div class="progress-circle">
                <span class="progress-number">${i}</span>
                <i class="fas fa-check progress-check"></i>
              </div>
              ${i < 7 ? '<div class="progress-line"></div>' : ""}
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
    const nickname = localStorage.getItem("yukiOS_username") || "Guest";
    return `
      <div class="setup-step active" data-step="1">
        <div class="step-hero" style="margin-top: 50px;">
          <div class="hero-logo">
            <img src="${resolveIconUrl("static/icons/logo.png")}" alt="Yuki OS">
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
    return `
      <div class="setup-step" data-step="5">
        <h2 class="step-title">
          <i class="fas fa-paint-brush"></i> Personalize Your Experience
        </h2>

        <div class="personalize-section">
          <label class="section-label">Choose Theme</label>
          <div class="theme-selector">
            <button class="theme-btn ${this.userChoices.theme === "dark" ? "active" : ""}" data-theme="dark">
              <i class="fas fa-moon"></i>
              <span>Dark</span>
            </button>
            <button class="theme-btn ${this.userChoices.theme === "light" ? "active" : ""}" data-theme="light">
              <i class="fas fa-sun"></i>
              <span>Light</span>
            </button>
            <button class="theme-btn ${this.userChoices.theme === "auto" ? "active" : ""}" data-theme="auto">
              <i class="fas fa-circle-half-stroke"></i>
              <span>Auto</span>
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
          <button class="setup-btn setup-btn-secondary" id="upload-wallpaper-btn" style="margin-top: 12px; width: 100%;">
            <i class="fas fa-upload"></i> Upload Custom Wallpaper
          </button>
        </div>

        <div class="personalize-section">
          <label class="section-label">Taskbar Position</label>
          <div class="taskbar-selector">
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

    const performanceHtml = FEATURE_DATA.step6.performanceModes
      .map(
        (m) => `
        <button class="perf-btn ${this.userChoices.performanceMode === m.value ? "active" : ""}" data-mode="${m.value}">
          <div class="perf-title">${m.title}</div>
          <div class="perf-desc">${m.desc}</div>
        </button>
      `
      )
      .join("");

    const appsHtml = FEATURE_DATA.step6.suggestedApps
      .map(
        (a) => `
        <div class="app-pin-item ${this.userChoices.pinnedApps.includes(a.id) ? "pinned" : ""}" data-app="${a.id}">
          <i class="${a.icon}"></i>
          <span>${a.title}</span>
          <i class="fas fa-thumbtack pin-icon"></i>
        </div>
      `
      )
      .join("");

    const transparencyHtml = FEATURE_DATA.step6.transparencyLevels
      .map(
        (t) => `
        <button class="transparency-btn ${this.userChoices.transparency === t.value ? "active" : ""}" data-transparency="${t.value}">
          <div class="transparency-title">${t.title}</div>
          <div class="transparency-desc">${t.desc}</div>
        </button>
      `
      )
      .join("");

    return `
      <div class="setup-step" data-step="6">
        <h2 class="step-title">
          <i class="fas fa-sliders-h"></i> Quick Settings
        </h2>

        <div class="settings-list">
          <div class="setting-item">
            <div class="setting-info">
              <i class="fas fa-cloud-sun setting-icon"></i>
              <div>
                <h4>Weather Widget</h4>
                <p>Show weather in taskbar</p>
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
                <p>Enable desktop notifications</p>
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
                <p>Enable system sounds</p>
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
                <p>Track your milestones</p>
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
                <p>Help improve Yuki OS (anonymous)</p>
              </div>
            </div>
            <label class="setting-toggle">
              <input type="checkbox" ${this.userChoices.analytics ? "checked" : ""} data-setting="analytics">
              <span class="toggle-track"><span class="toggle-thumb"></span></span>
            </label>
          </div>
        </div>

        <div class="personalize-section">
          <label class="section-label">Performance Mode</label>
          <div class="perf-selector">${performanceHtml}</div>
        </div>

        <div class="personalize-section">
          <label class="section-label">Window Transparency</label>
          <div class="transparency-selector">${transparencyHtml}</div>
        </div>

        <div class="personalize-section">
          <label class="section-label">Pin Apps to Start Menu</label>
          <div class="apps-pinning">${appsHtml}</div>
          <p style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">Click to pin/unpin apps for quick access</p>
        </div>

        <div class="personalize-section">
          <label class="section-label">Keyboard Shortcuts Reference</label>
          <div class="shortcuts-reference">${shortcutsHtml}</div>
        </div>

        <div class="personalize-section">
          <label class="section-label">${FEATURE_DATA.step6.filesystem.title}</label>
          <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">${FEATURE_DATA.step6.filesystem.description}</p>
          <div class="filesystem-structure">${filesystemHtml}</div>
        </div>
      </div>
    `;
  }

  _buildStep6() {
    return `
      <div class="setup-step" data-step="7">
        <div class="complete-hero">
          <div class="complete-icon">
            <i class="fas fa-rocket"></i>
          </div>
          <h2 class="complete-title">You're All Set!</h2>
          <p class="complete-subtitle">Yuki OS is ready to explore</p>
        </div>

        <div class="summary-list">
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
        </div>

        <div class="complete-tips">
          <h4><i class="fas fa-lightbulb"></i> Quick Tips</h4>

          <div class="tip-category">
            <ul>
              <li>Right-click desktop for extended system actions</li>
              <li>Use Ctrl+K to open the command palette</li>
              <li>Pin frequently used apps to the taskbar for quick access</li>
              <li>Use workspace separation for different tasks or contexts</li>
              <li>Explore Settings for advanced system controls</li>
            </ul>
          </div>

        </div>
      </div>
    `;
  }

  _bindEvents(win) {
    const nextBtn = win.querySelector("#setup-next");
    const backBtn = win.querySelector("#setup-back");
    const skipBtn = win.querySelector("#setup-skip");

    nextBtn.addEventListener("click", () => {
      if (this.isTransitioning) return;
      this._nextStep(win);
    });

    backBtn.addEventListener("click", () => {
      if (this.isTransitioning) return;
      this._prevStep(win);
    });
    skipBtn.addEventListener("click", () => this._skipSetup(win));

    const themeBtns = win.querySelectorAll(".theme-btn");
    themeBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const theme = btn.dataset.theme;
        this.userChoices.theme = theme;
        themeBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this._applyTheme(theme);
      });
    });

    const wallpaperThumbs = win.querySelectorAll(".wallpaper-thumb");
    wallpaperThumbs.forEach((thumb) => {
      thumb.addEventListener("click", () => {
        const wallpaper = thumb.dataset.wallpaper;
        this.userChoices.wallpaper = wallpaper;
        wallpaperThumbs.forEach((t) => t.classList.remove("active"));
        thumb.classList.add("active");
      });
    });

    const taskbarBtns = win.querySelectorAll(".taskbar-btn");
    taskbarBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const position = btn.dataset.position;
        this.userChoices.taskbarPosition = position;
        taskbarBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });

    const toggles = win.querySelectorAll(".setting-toggle input");
    toggles.forEach((toggle) => {
      toggle.addEventListener("change", () => {
        const setting = toggle.dataset.setting;
        this.userChoices[setting] = toggle.checked;
      });
    });

    const uploadBtn = win.querySelector("#upload-wallpaper-btn");
    if (uploadBtn) {
      uploadBtn.addEventListener("click", () => this._handleWallpaperUpload(win));
    }

    // Performance mode selection
    const perfBtns = win.querySelectorAll(".perf-btn");
    perfBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.mode;
        this.userChoices.performanceMode = mode;
        perfBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });

    // Transparency level selection
    const transparencyBtns = win.querySelectorAll(".transparency-btn");
    transparencyBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const transparency = btn.dataset.transparency;
        this.userChoices.transparency = transparency;
        transparencyBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });

    // App pinning
    const appPinItems = win.querySelectorAll(".app-pin-item");
    appPinItems.forEach((item) => {
      item.addEventListener("click", () => {
        const appId = item.dataset.app;
        const index = this.userChoices.pinnedApps.indexOf(appId);
        if (index > -1) {
          this.userChoices.pinnedApps.splice(index, 1);
          item.classList.remove("pinned");
        } else {
          this.userChoices.pinnedApps.push(appId);
          item.classList.add("pinned");
        }
      });
    });
  }

  _nextStep(win) {
    if (this.isTransitioning) return;

    if (this.currentStep < 5) {
      this.isTransitioning = true;

      const currentStepEl = win.querySelector(`.setup-step[data-step="${this.currentStep + 1}"]`);
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

    const currentStepEl = win.querySelector(`.setup-step[data-step="${this.currentStep + 1}"]`);
    if (currentStepEl) currentStepEl.classList.remove("active");

    this.currentStep--;

    this._updateStepUI(win);

    const prevStepEl = win.querySelector(`.setup-step[data-step="${this.currentStep + 1}"]`);

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
    const steps = win.querySelectorAll(".progress-step");
    steps.forEach((step, index) => {
      step.classList.remove("active", "completed");
      if (index < this.currentStep) {
        step.classList.add("completed");
      } else if (index === this.currentStep) {
        step.classList.add("active");
      }
    });

    const backBtn = win.querySelector("#setup-back");
    const nextBtn = win.querySelector("#setup-next");

    backBtn.style.display = this.currentStep > 0 ? "flex" : "none";

    if (this.currentStep === 5) {
      nextBtn.innerHTML = 'Start Exploring <i class="fas fa-rocket"></i>';
    } else {
      nextBtn.innerHTML = 'Continue <i class="fas fa-arrow-right"></i>';
    }
  }

  _animateStepIn() {
    const stepEl = document.querySelector(`.setup-step[data-step="${this.currentStep + 1}"]`);
    if (stepEl) {
      stepEl.classList.add("active");
    }
  }

  _applyTheme(theme) {
    localStorage.setItem(StorageKeys.theme, theme);
    this.bus.emit("SETTINGS_CHANGED", { theme });
  }

  async _completeSetup(win) {
    localStorage.setItem(StorageKeys.theme, this.userChoices.theme);
    localStorage.setItem(StorageKeys.taskbarPosition, this.userChoices.taskbarPosition);
    localStorage.setItem(StorageKeys.weather, this.userChoices.weather.toString());
    localStorage.setItem(StorageKeys.notificationsEnabled, this.userChoices.notifications.toString());
    localStorage.setItem(StorageKeys.soundEnabled, this.userChoices.sound.toString());
    localStorage.setItem(StorageKeys.achievementsDisabled, (!this.userChoices.achievements).toString());
    localStorage.setItem(StorageKeys.analyticsDisabled, (!this.userChoices.analytics).toString());
    localStorage.setItem(StorageKeys.setupCompleted, "true");

    // Save new options
    localStorage.setItem("yukiOS_performanceMode", this.userChoices.performanceMode);
    localStorage.setItem("yukiOS_transparency", this.userChoices.transparency);
    localStorage.setItem("yukiOS_pinnedApps", JSON.stringify(this.userChoices.pinnedApps));

    this._services.achievementsApp?.trigger(Achievements.SetupComplete);

    if (this.userChoices.wallpaper) {
      try {
        const wallpaperUrl = resolveWallpaperUrl("static/wallpapers/" + this.userChoices.wallpaper);
        await SystemUtilities.setWallpaper(wallpaperUrl);
      } catch (e) {
        console.error("Failed to set wallpaper:", e);
      }
    }

    this.bus.emit("SETUP_COMPLETED", this.userChoices);
    this.bus.emit("AUDIO_SETTINGS_CHANGED", { soundEnabled: this.userChoices.sound });
    document.dispatchEvent(
      new CustomEvent("AUDIO_SETTINGS_CHANGED", {
        detail: { soundEnabled: this.userChoices.sound }
      })
    );
    const welcomeContent = `Welcome to Yuki OS, ${this._services.sessionManager?.currentSession?.name || "User"}!

Your setup is complete. Here's what you configured:
- Theme: ${this.userChoices.theme}
- Taskbar: ${this.userChoices.taskbarPosition}
- Performance Mode: ${this.userChoices.performanceMode}
- Transparency: ${this.userChoices.transparency}
- Weather: ${this.userChoices.weather ? "Enabled" : "Disabled"}
- Notifications: ${this.userChoices.notifications ? "Enabled" : "Disabled"}
- Pinned Apps: ${this.userChoices.pinnedApps.length} apps

Quick Tips:
• Click the Start Menu to explore 30+ apps and 3700+ games
• Right-click the desktop for context menu options
• Use the Settings app to customize further anytime
• Your files persist in the virtual filesystem

Enjoy exploring Yuki OS!`;

    try {
      await this.fs.ensureFolder(["Documents"]);
      await this.fs.createFile(["Documents"], "Welcome.txt", welcomeContent, "TEXT", "static/icons/notepad.webp");
    } catch (e) {
      console.error("Failed to create welcome file:", e);
    }

    this.wm.notify(
      "Welcome to Yuki OS!",
      "Setup complete. Click Start Menu to begin exploring!",
      "success",
      8000,
      "fas fa-rocket"
    );

    win.style.transition = "opacity 0.5s, transform 0.5s";
    win.style.opacity = "0";
    win.style.transform = "scale(0.95)";

    setTimeout(() => {
      win.remove();
      if (this.wm.removeFromTaskbar) this.wm.removeFromTaskbar(win.id);
      if (this.wm.openWindows) this.wm.openWindows.delete(win.id);
      this.openWindows.delete("setup-wizard");
    }, 500);
  }

  _skipSetup(win) {
    localStorage.setItem(StorageKeys.setupCompleted, "true");

    this._services.achievementsApp?.trigger(Achievements.SetupComplete);
    win.remove();
    if (this.wm.removeFromTaskbar) this.wm.removeFromTaskbar(win.id);
    if (this.wm.openWindows) this.wm.openWindows.delete(win.id);
    this.openWindows.delete("setup-wizard");
  }

  async _loadWallpapers() {
    try {
      const folder = await this.fs.getFolder(["Pictures", "Wallpapers"]);
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
          await this.fs.ensureFolder(["Pictures", "Wallpapers"]);
          await this.fs.createFile(["Pictures", "Wallpapers"], fileName, dataUrl, "IMAGE", dataUrl);

          this.customWallpapers.push({ name: fileName, url: dataUrl });
          this.userChoices.wallpaper = fileName;

          const grid = win.querySelector("#wallpaper-grid");
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
}
