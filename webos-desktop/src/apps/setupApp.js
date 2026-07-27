import "../styles/setup.css";
import { resolveWallpaperUrl } from "../shared/assetResolver.js";
import { SystemUtilities } from "../system.js";
import { Achievements } from "../achievements.js";
import { AppSource } from "../AppSource.js";
import { PREDEFINED_AVATARS } from "../utils/avatarData.js";
import { applyFontFamily } from "../settings/settingsApply.js";
import { $, $$, bindEvent, setText, setHTML, toggleClass } from "../shared/domUtils.js";
import { getAllThemes } from "../shared/themeEngine.js";
import { KeybindManager, KEYBIND_DEFINITIONS } from "../keybindManager.js";
import { animateThemeChange } from "../settings/themeTransition.js";

import { BaseApp, StorageKeys, os } from "../framework.js";
import { isTaskbarTop } from "../utils/utils.js";
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
      desc: "IndexedDB storage that survives browser restarts",
      animation: "bounce-card"
    },
    {
      icon: "fas fa-box-archive",
      title: "80 Built-in Apps",
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
      icon: "fas fa-camera",
      title: "Screen Capture",
      desc: "Full page and area screenshots with auto-save to Pictures, plus screen recording"
    },
    {
      icon: "fas fa-eye-dropper",
      title: "Color Picker",
      desc: "Pick colors from anywhere on screen with Alt+H and a magnified preview"
    },
    {
      icon: "fas fa-mouse-pointer",
      title: "Context Menus",
      desc: "Right-click menus for desktop, explorer, taskbar, tray, start menu, and Steam library"
    },
    {
      icon: "fas fa-file-export",
      title: "File Actions Menu",
      desc: "Convert files, zip them up, download in bulk, or set as wallpaper from right-click"
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
    keyboardShortcuts: KEYBIND_DEFINITIONS.map((s) => ({ keys: s.defaultKeys.join("+"), desc: s.desc, cat: s.cat })),
    turboModes: [
      { value: "balanced", title: "Balanced", desc: "Recommended for most users" },
      { value: "turbo", title: "Turbo", desc: "Maximize speed, reduce effects" },
      { value: "quality", title: "Quality", desc: "Best visuals, may be slower" }
    ],
    suggestedApps: [
      { id: "notepad", title: "Notepad", icon: "fas fa-file-alt" },
      { id: "terminal", title: "Terminal", icon: "fas fa-terminal" },
      { id: "browser", title: "Browser", icon: "static/icons/firefox.webp" },
      { id: "explorer", title: "File Explorer", icon: "fas fa-folder" },
      { id: "settings", title: "Settings", icon: "fas fa-cog" },
      { id: "yukiOsGuide", title: "YukiOS Guide", icon: "fas fa-book-open" }
    ],
    transparencyLevels: [
      { value: "high", title: "High Transparency", desc: "More glass effect" },
      { value: "medium", title: "Medium Transparency", desc: "Balanced look" },
      { value: "low", title: "Low Transparency", desc: "More solid windows" }
    ]
  }
};

const FONT_LABELS = {
  opensans: "Open Sans",
  inter: "Inter",
  rubik: "Rubik",
  sora: "Sora",
  jetbrainsmono: "JetBrains Mono",
  monocraft: "Monocraft"
};

export class SetupApp extends BaseApp {
  constructor(services) {
    super(services);
    this.totalSetupSteps = 9;
    this.currentStep = 0;
    this.userChoices = {
      theme: "dark",
      wallpaper: null,
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
      dockEnabled: false,
      mikuCursor: true,
      clippy: false,
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
    if (await this.isSingletonOpen(winId)) return;

    this.currentStep = 0;
    this.isTransitioning = false;
    if (this.stepTransitionTimer) {
      clearTimeout(this.stepTransitionTimer);
      this.stepTransitionTimer = null;
    }

    await this.loadWallpapers();

    const win = os.window.create(winId, "Set Up YukiOS", "85vw", "75vh", {
      icon: "fas fa-rocket",
      position: "center"
    });
    win.innerHTML = this.buildUI();
    this.openWindows.add(winId);
    this.bindEvents(win);
    this.animateStepIn();
  }

  onClose(winId) {
    this.openWindows.delete(winId);
  }

  buildUI() {
    const headerClass = isTaskbarTop() ? "window-header mac-header" : "window-header";
    return `
      <div class="${headerClass}">
        <span>Set Up YukiOS</span>
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
          ${this.buildStep1()}
          ${this.buildStep2()}
          ${this.buildStep3()}
          ${this.buildStep3b()}
          ${this.buildStep4()}
          ${this.buildStep5()}
          ${this.buildStep6()}
          ${this.buildStep7()}
          ${this.buildStep8()}
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

  buildStep1() {
    const nickname = os.storage.get(StorageKeys.username) || "Guest";
    return `
      <div class="setup-step active" data-step="1">
        <div class="step-hero" style="margin-top: 50px;">
          <div class="hero-logo">
            <i class="fas fa-snowflake"></i>
          </div>
          <h1 class="hero-title">Hey there, ${nickname}</h1>
          <p class="hero-subtitle">Your desktop, right in the browser</p>
          <button class="setup-info-btn" id="setup-info-btn">
            <i class="fas fa-circle-info"></i>
          </button>
        </div>
      </div>
    `;
  }

  buildFeatureGrid(data, title, icon, extraClass) {
    return `
      <div class="step-content">
        <div class="step-title"><i class="${icon}"></i> ${title}</div>
        <div class="feature-grid${extraClass ? ` ${extraClass}` : ""}">
          ${data
            .map(
              (f) => `
            <div class="feature-card">
              <div class="feature-icon"><i class="${f.icon}"></i></div>
              <h3>${f.title}</h3>
              <p>${f.desc}</p>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  buildStep2() {
    return `<div class="setup-step" data-step="2">${this.buildFeatureGrid(FEATURE_DATA.step2, "Here's What You Get", "fas fa-star")}</div>`;
  }

  buildStep3() {
    return `<div class="setup-step" data-step="3">${this.buildFeatureGrid(FEATURE_DATA.step3, "System Features", "fas fa-puzzle-piece")}</div>`;
  }

  buildStep3b() {
    return `<div class="setup-step" data-step="4">${this.buildFeatureGrid(FEATURE_DATA.step3b, "More Features", "fas fa-plus-circle")}</div>`;
  }

  buildStep4() {
    const themes = getAllThemes();

    const themeButtons = themes
      .map(
        (theme) => `
        <button class="theme-btn ${this.userChoices.theme === theme.value ? "active" : ""}" data-theme="${theme.value}" style="height: 56px; background: ${theme.preview || "#8b5cf6"}; color: ${theme.textColor || "#fff"};">
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
                <img data-src="${resolveWallpaperUrl("static/wallpapers/" + wp)}" alt="${wp}" loading="lazy">
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
                <img data-src="${wp.url}" alt="${wp.name}" loading="lazy">
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
      </div>
    `;
  }

  buildToggle(setting, icon, label, checked) {
    return `
      <div class="setting-item">
        <div class="setting-info">
          <i class="${icon} setting-icon"></i>
          <div>
            <h4>${label}</h4>
          </div>
        </div>
        <label class="setting-toggle">
          <input type="checkbox" ${checked ? "checked" : ""} data-setting="${setting}">
          <span class="toggle-track"><span class="toggle-thumb"></span></span>
        </label>
      </div>
    `;
  }

  buildTurboSelector() {
    return `
      <div class="settings-half">
        <label class="section-label">Turbo</label>
        <div class="turbo-selector">
          ${FEATURE_DATA.step6.turboModes
            .map(
              (m) => `
            <button class="turbo-btn ${this.userChoices.turboMode === m.value ? "active" : ""}" data-mode="${m.value}">
              <div class="turbo-title">${m.title}</div>
            </button>
          `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  buildTransparencySelector() {
    return `
      <div class="settings-half">
        <label class="section-label">Transparency</label>
        <div class="transparency-selector">
          ${FEATURE_DATA.step6.transparencyLevels
            .map(
              (t) => `
            <button class="transparency-btn ${this.userChoices.transparency === t.value ? "active" : ""}" data-transparency="${t.value}">
              <div class="transparency-title">${t.title}</div>
            </button>
          `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  buildStep5() {
    return `
      <div class="setup-step" data-step="6">
        <h2 class="step-title">
          <i class="fas fa-sliders-h"></i> Quick Settings
        </h2>

        <div class="settings-grid">
          ${this.buildToggle("weather", "fas fa-cloud-sun", "Weather", this.userChoices.weather)}
          ${this.buildToggle("notifications", "fas fa-bell", "Notifications", this.userChoices.notifications)}
          ${this.buildToggle("sound", "fas fa-volume-high", "Sound", this.userChoices.sound)}
          ${this.buildToggle("achievements", "fas fa-trophy", "Achievements", this.userChoices.achievements)}
          ${this.buildToggle("analytics", "fas fa-chart-line", "Analytics", this.userChoices.analytics)}
          ${this.buildToggle("macOsControls", "fab fa-apple", "Mac Window Headers", this.userChoices.macOsControls)}
          ${this.buildToggle("mikuCursor", "fas fa-mouse-pointer", "Miku Cursor", this.userChoices.mikuCursor)}
          ${this.buildToggle("clippy", "fas fa-robot", "Clippy", this.userChoices.clippy)}
          ${this.buildToggle("clipboardManager", "fas fa-paste", "Clipboard Manager", this.userChoices.clipboardManager)}
        </div>

        <div class="settings-row">
          ${this.buildTurboSelector()}
          ${this.buildTransparencySelector()}
        </div>
      </div>
    `;
  }

  buildStep6() {
    return `
      <div class="setup-step" data-step="7">
        <h2 class="step-title">
          <i class="fas fa-info-circle"></i> System Info
        </h2>

        <div class="personalize-section">
          <label class="section-label">Keyboard Shortcuts</label>
          <p class="system-info-copy">Browse all keyboard shortcuts and hotkeys in the Shortcuts app.</p>
          <button class="setup-btn setup-btn-primary" id="setup-launch-shortcuts">
            <i class="fas fa-keyboard"></i> Open Keyboard Shortcuts
          </button>
        </div>
      </div>
    `;
  }

  buildStep7() {
    const username = this.userChoices.username || "Guest";
    const profilePic = this.userChoices.profilePicture || PREDEFINED_AVATARS[0];
    const avatarsHtml = PREDEFINED_AVATARS.map(
      (avatar) => `
        <div class="setup-avatar-option ${avatar === profilePic ? "selected" : ""}" data-src="${avatar}" style="border-radius: 50%; overflow: hidden; cursor: pointer; border: 2px solid var(--glass-border); transition: all 0.15s; width: 56px; height: 56px; position: relative;">
          <img data-src="${avatar}" style="width: 100%; height: 100%; object-fit: cover;" />
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
              <img id="setup-profile-preview-img" data-src="${profilePic}" style="width: 100%; height: 100%; object-fit: cover;" />
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

  buildStep8() {
    const username = this.userChoices.username || "Guest";
    const profilePic = this.userChoices.profilePicture || PREDEFINED_AVATARS[0];
    return `
      <div class="setup-step" data-step="9">
        <div class="complete-hero">
          <div class="complete-icon">
            <i class="fas fa-rocket"></i>
          </div>
          <h2 class="complete-title">You're All Set!</h2>
          <p class="complete-subtitle">Jump in and make it yours</p>
        </div>

        <div class="summary-grid">
          <div class="summary-item" style="grid-column: 1 / -1; display: flex; align-items: center; gap: 10px;">
            <img id="setup-summary-profile-img" data-src="${profilePic}" alt="${username}" style="width: 30px; height: 30px; border-radius: 50%; border: 1px solid var(--glass-border); object-fit: cover;">
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
            <span>Font: ${FONT_LABELS[this.userChoices.fontFamily] || this.userChoices.fontFamily}</span>
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
            <span>Open YukiOS Guide</span>
          </button>
        </div>
      </div>
    `;
  }

  bindEvents(win) {
    const nextBtn = $("#setup-next", win);
    const backBtn = $("#setup-back", win);
    const skipBtn = $("#setup-skip", win);
    const infoBtn = $("#setup-info-btn", win);

    nextBtn.addEventListener("click", () => {
      if (this.isTransitioning) return;
      this.nextStep(win);
    });

    backBtn.addEventListener("click", () => {
      if (this.isTransitioning) return;
      this.prevStep(win);
    });
    skipBtn.addEventListener("click", () => this.skipSetup(win));

    if (infoBtn) {
      infoBtn.addEventListener("click", () => {
        os.app.launch("aboutApp");
      });
    }

    const themeBtns = $$(".theme-btn", win);
    themeBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const theme = btn.dataset.theme;
        this.userChoices.theme = theme;
        themeBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.applyTheme(theme);
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

    const toggles = $$(".setting-toggle input", win);
    toggles.forEach((toggle) => {
      toggle.addEventListener("change", () => {
        const setting = toggle.dataset.setting;
        this.userChoices[setting] = toggle.checked;
      });
    });

    const uploadBtn = $("#upload-wallpaper-btn", win);
    if (uploadBtn) {
      uploadBtn.addEventListener("click", () => this.handleWallpaperUpload(win));
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
        os.app.launch("yukiOsGuideApp");
      });
    }

    const launchShortcutsBtn = $("#setup-launch-shortcuts", win);
    if (launchShortcutsBtn) {
      launchShortcutsBtn.addEventListener("click", () => {
        os.app.launch("shortcutsApp");
      });
    }

    this.bindProfileStepEvents(win);
  }

  nextStep(win) {
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

        this.updateStepUI(win);
        this.animateStepIn();

        this.isTransitioning = false;
        this.stepTransitionTimer = null;
      }, 300);
    } else {
      this.completeSetup(win);
    }
  }

  prevStep(win) {
    if (this.isTransitioning) return;
    if (this.currentStep <= 0) return;

    this.isTransitioning = true;

    const currentStepEl = $(`.setup-step[data-step="${this.currentStep + 1}"]`, win);
    if (currentStepEl) currentStepEl.classList.remove("active");

    this.currentStep--;

    this.updateStepUI(win);

    const prevStepEl = $(`.setup-step[data-step="${this.currentStep + 1}"]`, win);

    if (prevStepEl) {
      prevStepEl.classList.add("active");
      prevStepEl.style.transform = "translateX(-50px)";
      this.lazyLoadActiveStepImages(prevStepEl);

      requestAnimationFrame(() => {
        prevStepEl.style.transform = "translateX(0)";
      });
    }

    setTimeout(() => {
      this.isTransitioning = false;
    }, 250);
  }

  updateStepUI(win) {
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

    this.refreshProfileSummary(win);
  }

  animateStepIn() {
    const stepEl = document.querySelector(`.setup-step[data-step="${this.currentStep + 1}"]`);
    if (stepEl) {
      stepEl.classList.add("active");
      this.lazyLoadActiveStepImages(stepEl);
    }
  }

  lazyLoadActiveStepImages(stepEl) {
    stepEl.querySelectorAll("img[data-src]").forEach((img) => {
      if (!img.src && img.dataset.src) {
        img.src = img.dataset.src;
      }
    });
    stepEl.querySelectorAll(".feature-card").forEach((card, i) => card.style.setProperty("--i", i));
    stepEl.querySelectorAll(".summary-item").forEach((item, i) => item.style.setProperty("--i", i));
  }

  applyTheme(theme) {
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
    const effective = theme === "auto" ? (prefersDark ? "dark" : "light") : theme;
    animateThemeChange(() => {
      document.documentElement.setAttribute("data-theme", effective);
    });
  }

  async completeSetup(win) {
    const finalizedName = (this.userChoices.username || "").trim() || "Guest";
    const finalizedAvatar = this.userChoices.profilePicture || PREDEFINED_AVATARS[0];
    this.userChoices.username = finalizedName;
    this.userChoices.profilePicture = finalizedAvatar;
    os.storage.set(StorageKeys.username, finalizedName);
    os.storage.set(StorageKeys.profilePicture, finalizedAvatar);

    const sm = this.os.app.getInstance("sessionManager");
    if (sm?.currentSession) {
      sm.currentSession.name = finalizedName;
      sm.currentSession.key = finalizedName.toLowerCase().replace(/[^a-z0-9]/g, "") || "guest";
      sm.currentSession.avatar = finalizedAvatar;
    }

    os.storage.set(StorageKeys.theme, this.userChoices.theme);
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
    os.storage.set(StorageKeys.dockEnabled, this.userChoices.macOsControls.toString());
    os.storage.set(StorageKeys.mikuCursor, this.userChoices.mikuCursor.toString());
    os.storage.set(StorageKeys.clippy, this.userChoices.clippy.toString());
    os.storage.set(StorageKeys.clipboardManagerEnabled, this.userChoices.clipboardManager.toString());

    this.os.app.triggerAchievement(Achievements.SetupComplete);

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
    const welcomeContent = `All set, ${sm?.currentSession?.name || "Guest"}!

Here's what you picked:
- Theme: ${this.userChoices.theme}
- Turbo Mode: ${this.userChoices.turboMode}
- Transparency: ${this.userChoices.transparency}
- Weather: ${this.userChoices.weather ? "On" : "Off"}
- Notifications: ${this.userChoices.notifications ? "On" : "Off"}

Quick tips to get going:
• Click the Start Menu to find 80 apps and 3700+ games
• Right-click the desktop when you need quick options
• Tweak anything later in the Settings app

Have fun!`;

    try {
      await os.fs.mkdir(["Documents"]);
      await os.fs.write(["Documents", "Welcome.txt"], welcomeContent);
    } catch (e) {
      console.error("Failed to create welcome file:", e);
    }

    os.notify.send(
      "You're all set!",
      "Setup is done. Hit the Start Menu to jump in.",
      "success",
      8000,
      "fas fa-rocket",
      AppSource.SETUP
    );

    win.style.transition = "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)";
    win.style.transform = "scale(0) rotate(-6deg)";

    setTimeout(() => {
      os.window.close(win);
      this.openWindows.delete("setup-wizard");
    }, 500);
  }

  skipSetup(win) {
    os.storage.set(StorageKeys.setupCompleted, "true");

    this.os.app.triggerAchievement(Achievements.SetupComplete);
    os.window.close(win);
    this.openWindows.delete("setup-wizard");
  }

  async loadWallpapers() {
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

  async handleWallpaperUpload(win) {
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

  bindProfileStepEvents(win) {
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
      this.refreshProfileSummary(win);
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
      this.refreshProfileSummary(win);
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

        const maxBytes = 2000 * 1024;
        if (file.size > maxBytes) {
          os.dialog.alert(
            "Image Too Large",
            `The selected image is ${(file.size / 1024).toFixed(1)} KB. Please choose an image under 2 MB.`
          );
          return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target.result;
          if (!dataUrl) return;

          const img = new Image();
          img.onload = () => {
            const maxDim = 200;
            let { width, height } = img;
            if (width > maxDim || height > maxDim) {
              const ratio = Math.min(maxDim / width, maxDim / height);
              width = Math.round(width * ratio);
              height = Math.round(height * ratio);
            }

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL("image/jpeg", 0.7);

            this.userChoices.profilePicture = compressed;
            previewImg.src = compressed;
            this.refreshProfileSummary(win);
          };
          img.src = dataUrl;
        };
        reader.readAsDataURL(file);
      };
      input.click();
    });
  }

  refreshProfileSummary(win) {
    const summaryImg = $("#setup-summary-profile-img", win);
    const summaryName = $("#setup-summary-profile-name", win);
    if (summaryImg) {
      summaryImg.dataset.src = this.userChoices.profilePicture || PREDEFINED_AVATARS[0];
      summaryImg.src = summaryImg.dataset.src;
    }
    if (summaryName) setText(summaryName, `Profile: ${this.userChoices.username || "Guest"}`);
  }
}
