import { BaseApp } from "./core/BaseApp.js";
import { StorageKeys } from "./StorageKeys.js";
import { resolveIconUrl, resolveWallpaperUrl } from "./shared/assetResolver.js";
import { SystemUtilities } from "./system.js";
import { Achievements } from "./achievements.js";

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
      analytics: true
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

    await this._loadWallpapers();

    const win = this.wm.createWindow(winId, "Welcome to Yuki OS", "900px", "650px", false, { position: "center" });
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
          ${[1, 2, 3, 4, 5, 6]
            .map(
              (i) => `
            <div class="progress-step ${i === 1 ? "active" : ""}" data-step="${i}">
              <div class="progress-circle">
                <span class="progress-number">${i}</span>
                <i class="fas fa-check progress-check"></i>
              </div>
              ${i < 6 ? '<div class="progress-line"></div>' : ""}
            </div>
          `
            )
            .join("")}
        </div>

        <div class="setup-content">
          ${this._buildStep1()}
          ${this._buildStep2()}
          ${this._buildStep3()}
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
    return `
    <div class="setup-step" data-step="2">
      <h2 class="step-title feature-title">
        <i class="fas fa-star"></i>
        Core Features
      </h2>

      <div class="feature-grid">

        <div class="feature-card tilt-card">
          <div class="feature-icon tilt-icon">
            <i class="fas fa-desktop"></i>
          </div>

          <h3>Windowed Desktop Environment</h3>

          <p>
            Drag, resize, snap, and manage apps in a true multi-window OS shell
          </p>
        </div>

        <div class="feature-card spin-card">
          <div class="feature-icon spin-icon">
            <i class="fas fa-layer-group"></i>
          </div>

          <h3>Taskbar & Start Menu System</h3>

          <p>
            Launch apps, manage running windows, and switch workspaces instantly
          </p>
        </div>

        <div class="feature-card bounce-card">
          <div class="feature-icon bounce-icon">
            <i class="fas fa-folder-tree"></i>
          </div>

          <h3>Virtual Filesystem</h3>

          <p>
            BrowserFS + IndexedDB persistent storage with full directory structure
          </p>
        </div>

        <div class="feature-card glow-card">
          <div class="feature-icon glow-icon">
            <i class="fas fa-window-restore"></i>
          </div>

          <h3>Window Management Engine</h3>

          <p>
            Advanced z-ordering, drag system, snapping, and lifecycle control
          </p>
        </div>

        <div class="feature-card slide-card">
          <div class="feature-icon slide-icon">
            <i class="fas fa-network-wired"></i>
          </div>

          <h3>Unified System Ecosystem</h3>

          <p>
            Core system apps interconnected through shared services for consistency
          </p>
        </div>

        <div class="feature-card pulse-card">
          <div class="feature-icon pulse-icon">
            <i class="fas fa-cloud"></i>
          </div>

          <h3>PWA & Offline Support</h3>

          <p>
            Installable webOS with full offline capability via service worker
          </p>
        </div>

        <div class="feature-card skew-card">
          <div class="feature-icon skew-icon">
            <i class="fas fa-arrows-up-down-left-right"></i>
          </div>

          <h3>Workspace System</h3>

          <p>
            Multiple virtual desktops for organizing tasks and workflows
          </p>
        </div>

        <div class="feature-card wiggle-card">
          <div class="feature-icon wiggle-icon">
            <i class="fas fa-code-branch"></i>
          </div>

          <h3>App Creator System</h3>

          <p>
            Add new applications with support for proxies, custom icons,
            and direct desktop integration
          </p>
        </div>

        <div class="feature-card orbit-card">
          <div class="feature-icon orbit-icon">
            <i class="fas fa-gamepad"></i>
          </div>

          <h3>Steam Game Hub</h3>

          <p>
            Browse a massive game library with store pages and track playtime
          </p>
        </div>

      </div>
    </div>
  `;
  }

  _buildStep3() {
    return `
      <div class="setup-step" data-step="3">
        <h2 class="step-title" style="justify-content: center; margin-bottom: 20px;">
          <i class="fas fa-puzzle-piece"></i> Built-in Features
        </h2>
        <div class="feature-grid">
          <div class="feature-card">
            <div class="feature-icon"><i class="fas fa-microchip"></i></div>
            <h3>Multi-Runtime Engine</h3>
            <p>JS-DOS, V86, Azahar 3DS, Ruffle Flash, and WebAssembly support</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon"><i class="fas fa-box-archive"></i></div>
            <h3>30+ Applications</h3>
            <p>Productivity tools, utilities, media apps, and system-level utilities</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon"><i class="fas fa-keyboard"></i></div>
            <h3>Command Palette</h3>
            <p>Global launcher and system shell via Ctrl+K / F1</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon"><i class="fas fa-sliders-h"></i></div>
            <h3>Audio & System Control</h3>
            <p>Per-app volume mixer, system settings, and runtime controls</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon"><i class="fas fa-bell"></i></div>
            <h3>Notification System</h3>
            <p>Centralized toast notifications with Do Not Disturb support</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon"><i class="fas fa-save"></i></div>
            <h3>Session Persistence</h3>
            <p>Restores windows, layout, and app state across reloads</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon"><i class="fas fa-paint-brush"></i></div>
            <h3>Full Customization</h3>
            <p>Themes, wallpapers, UI scaling, and performance modes including Turbo Mode</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon"><i class="fas fa-trophy"></i></div>
            <h3>Stats & Achievements</h3>
            <p>Track usage, milestones, playtime, and system engagement</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon"><i class="fas fa-download"></i></div>
            <h3>Import / Export System</h3>
            <p>Backup and migrate full system state and user configuration</p>
          </div>
        </div>
      </div>
    `;
  }

  _buildStep4() {
    return `
      <div class="setup-step" data-step="4">
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
    return `
      <div class="setup-step" data-step="5">
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
      </div>
    `;
  }

  _buildStep6() {
    return `
      <div class="setup-step" data-step="6">
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
- Weather: ${this.userChoices.weather ? "Enabled" : "Disabled"}
- Notifications: ${this.userChoices.notifications ? "Enabled" : "Disabled"}

Quick Tips:
• Click the Start Menu to explore 30+ apps and 2700+ games
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
