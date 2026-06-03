import { BaseApp } from "../core/BaseApp.js";
import { getAppRegistry } from "../appRegistry.js";
import { FEATURE_DATA } from "./setupApp.js";
import { YUKIOS_VERSION } from "./about.js";
import { appMap as gamesListAppMap } from "../games/gamesList.js";
import { APP_DESCRIPTIONS, descriptionMap as gameDescriptions } from "../games/gameDescriptions.js";
import { PersistenceTypes } from "../runtime/AppSchema.js";
import "../styles/yukiOsGuide.css";

const SYSTEM_INFO = {
  version: YUKIOS_VERSION,
  architecture: "Browser-based Desktop Environment",
  runtime: "Built with pure javascript",
  persistence: "Your files stay saved even after closing",
  offline: "Works without internet, install to desktop",
  windowManager: "Custom drag/resize/snap/z-order system",
  audio: "Web Audio API with per-app volume control",
  filesystem: "Virtual VFS mounted at /home/reeyuki/",
  workspaces: "Multiple virtual desktops",
  animations: "35-effect window animation system",
  tray: "System tray for background applications",
  session: "Login screen with profile management",
  commandPalette: "Global launcher (Ctrl+K / F1)"
};

const SYSTEM_CAPABILITIES = [
  {
    tag: "WM",
    title: "Windowed Multitasking",
    desc: "Drag, resize, snap, minimize, maximize, and layer apps like a real desktop."
  },
  {
    tag: "VFS",
    title: "Virtual Filesystem",
    desc: "BrowserFS + IndexedDB provides persistent storage that survives browser restarts."
  },
  {
    tag: "PLAY",
    title: "Games Library",
    desc: "3700+ games via Steam integration, Flash (Ruffle), DOS (JS-DOS), and console emulation."
  },
  {
    tag: "APPS",
    title: "40+ Built-in Apps",
    desc: "Terminal, browser, editors, paint, calculator, office viewer, and more."
  },
  {
    tag: "RUN",
    title: "Multi-Runtime Engine",
    desc: "HTML5, WebAssembly, emulation (JS-DOS, V86, Azahar 3DS), Flash (Ruffle) in one place."
  },
  {
    tag: "LOOK",
    title: "Personalization",
    desc: "Themes, wallpapers, custom cursors, window animations, and UI scaling."
  },
  {
    tag: "WORK",
    title: "Virtual Workspaces",
    desc: "Multiple desktops for organizing different tasks and contexts."
  },
  {
    tag: "AUDIO",
    title: "Per-App Audio",
    desc: "Individual volume control for each application with master volume."
  },
  {
    tag: "TRAY",
    title: "System Tray",
    desc: "Background applications can minimize to system tray with resident mode."
  },
  {
    tag: "SESSION",
    title: "Session Management",
    desc: "Login screen with profile customization and 15-minute auto-login."
  },
  {
    tag: "CMD",
    title: "Command Palette",
    desc: "Global launcher for apps, files, and system commands (Ctrl+K / F1)."
  },
  {
    tag: "ANIM",
    title: "Window Animations",
    desc: "35 customizable effects for open, close, and minimize animations."
  },
  {
    tag: "THEME",
    title: "Theming Support",
    desc: "Dark/light themes, window transparency, custom cursors, and performance modes."
  },
  {
    tag: "APP",
    title: "App Management",
    desc: "Rename, disable, uninstall apps with bulk actions and search filters."
  },
  {
    tag: "TIME",
    title: "Playtime Tracking",
    desc: "Automatic tracking of app and game playtime with session history and statistics."
  },
  {
    tag: "PWA",
    title: "PWA Support",
    desc: "Progressive Web App capabilities for offline use and desktop installation."
  },
  {
    tag: "IMPORT",
    title: "Import/Export",
    desc: "Backup and migrate full system configuration with data import/export."
  },
  {
    tag: "CDN",
    title: "CDN Mirror Selection",
    desc: "Configure CDN mirrors for improved asset loading reliability and speed."
  },
  {
    tag: "CURSOR",
    title: "Custom Cursors",
    desc: "Custom cursor support with themed pointers and enhanced visual feedback."
  },
  {
    tag: "ADS",
    title: "Ads Integration",
    desc: "Optional ad display system with analytics buffering and user control."
  },
  {
    tag: "ANALYTICS",
    title: "Analytics Toggle",
    desc: "Enable or disable anonymous usage analytics for system improvement."
  },
  {
    tag: "RESIZE",
    title: "Alt+Right-Click Resize",
    desc: "Hold Alt or Super key and right-click drag anywhere on a window to resize it quickly."
  },
  {
    tag: "BUBBLE",
    title: "Click Bubble Feedback",
    desc: "Visual animation feedback on clicks for improved interaction feel."
  },
  {
    tag: "PREVIEW",
    title: "Taskbar Previews",
    desc: "Hover taskbar for live window previews with Tab Peek functionality."
  },
  {
    tag: "PIN",
    title: "Taskbar Pinning",
    desc: "Pin frequently used apps to taskbar for quick access with improved behavior."
  },
  {
    tag: "START",
    title: "Start Menu Customization",
    desc: "Customize start menu categories, items, and keybinds (Space, Tab, Ctrl)."
  },
  {
    tag: "TRANS",
    title: "Transparency Levels",
    desc: "Configure window transparency levels: High, Medium, or Low for glass effects."
  },
  {
    tag: "PERF",
    title: "Turbo Mode",
    desc: "Choose Balanced, Turbo, or Quality mode to optimize system behavior."
  },
  {
    tag: "STRETCH",
    title: "Desktop Scroll Lock",
    desc: "Prevent desktop page stretch when dragging windows beyond screen bounds."
  },
  {
    tag: "THEME2",
    title: "Theme Presets",
    desc: "Expanded theming system with improved consistency and custom theme support."
  },
  {
    tag: "STEAM",
    title: "Steam Integration",
    desc: "Steam play counts, LuminSDK catalog (1000+ games), and home button support."
  },
  {
    tag: "DESC",
    title: "Game Descriptions",
    desc: "Rich metadata and descriptions for games with genre, year, and developer info."
  },
  {
    tag: "DL",
    title: "File Download",
    desc: "Download files directly from explorer with right-click context menu."
  },
  {
    tag: "FAVICON",
    title: "Dynamic Favicon",
    desc: "Browser tab icon updates dynamically to reflect current activity."
  },
  {
    tag: "WINICON",
    title: "Window Icons",
    desc: "App windows display their respective icons in the title bar for easy identification."
  },
  {
    tag: "WINMENU",
    title: "Window Header Menu",
    desc: "Right-click on window header for quick actions and window controls."
  },
  {
    tag: "F2",
    title: "F2 Rename",
    desc: "Press F2 to rename files quickly in explorer, just like native OS."
  },
  {
    tag: "DRAG",
    title: "Drag to Desktop",
    desc: "Drag files from apps directly to desktop to save them conveniently."
  },
  {
    tag: "REFRESH",
    title: "Desktop Auto-Refresh",
    desc: "Desktop automatically reflects file changes without manual refresh."
  },
  {
    tag: "HTML",
    title: "HTML File Support",
    desc: "Open and render HTML files directly in the browser with full support."
  },
  {
    tag: "ARCHIVE",
    title: "Archive Support",
    desc: "Extract 7z, .tar.xz, zip, and other archive formats via right-click menu."
  },
  {
    tag: "AUDIO",
    title: "Audio Playback",
    desc: "Play audio files directly with built-in audio player and mixer integration."
  },
  {
    tag: "VIDEO",
    title: "Video Turbo",
    desc: "Smoother video playback across the system with optimized rendering."
  },
  {
    tag: "JSDOS",
    title: "JsDos GUI Support",
    desc: "Upload jsdos files directly and play featured DOS games with GUI."
  },
  {
    tag: "PROPS",
    title: "Properties Page",
    desc: "View detailed file and app properties with enhanced information display."
  },
  {
    tag: "CONTEXT",
    title: "Context Menu Polish",
    desc: "Improved context menus with better organization and overflow handling."
  },
  {
    tag: "CTXFILE",
    title: "Explorer File Actions",
    desc: "Right-click supports convert/transform, create archive, bulk download ZIP, extract archives, and wallpaper actions."
  },
  {
    tag: "CTXWIN",
    title: "Window Context Controls",
    desc: "Taskbar and window menus include snap actions, workspace move, properties, and pin/unpin taskbar."
  },
  {
    tag: "CTXTRAY",
    title: "Tray & Start Menu Context",
    desc: "Tray menu supports open/quit and start menu grid menu supports add/edit/remove shortcuts."
  },
  {
    tag: "CTXSTEAM",
    title: "Steam Library Context",
    desc: "Steam game menus support favorites, hide/unhide, collections, add to desktop, and broken game reports."
  },
  {
    tag: "EXPLORER",
    title: "Explorer Styling",
    desc: "Refined explorer appearance with improved visual consistency."
  },
  {
    tag: "PROXY",
    title: "App Proxy Support",
    desc: "Per-app CORS proxy support for created web apps and external URLs."
  },
  {
    tag: "CONVERT",
    title: "File Converter",
    desc: "Convert files to different formats locally without uploading to servers."
  },
  {
    tag: "SHORTCUTS",
    title: "Keyboard Shortcuts App",
    desc: "Central utility to explore all global hotkeys and app-specific shortcuts."
  },
  {
    tag: "SETUP",
    title: "Setup Wizard",
    desc: "First-time setup wizard for system personalization and configuration."
  },
  {
    tag: "NEWS",
    title: "What's New",
    desc: "Changelog app showing latest features, improvements, and fixes."
  },
  {
    tag: "CALENDAR",
    title: "Calendar App",
    desc: "Built-in calendar with event management and date navigation."
  },
  {
    tag: "PIXEL",
    title: "LibreSprite",
    desc: "Pixel art and animation editor for creating sprites and tilesets."
  },
  {
    tag: "SPOTIFY",
    title: "Spotify Utility",
    desc: "Spotify utility app for music streaming integration."
  },
  {
    tag: "YOUTUBE",
    title: "YouTube Utilities",
    desc: "YouTube tools and utilities for video management and playback."
  },
  {
    tag: "STORAGE",
    title: "Storage Editor",
    desc: "View and edit IndexedDB storage data for debugging and advanced users."
  },
  {
    tag: "INSTALLED",
    title: "Installed Apps",
    desc: "Manage installed applications with rename, disable, and uninstall options."
  }
];

const CORE_SERVICES = [
  {
    name: "WindowManager",
    desc: "Manages window lifecycle, drag/resize, snapping, z-ordering, and workspace management.",
    features: [
      "Window snapping",
      "Alt+Right-Click resize",
      "Workspace system",
      "Transparency",
      "Animations",
      "Taskbar previews"
    ]
  },
  {
    name: "FileSystemManager",
    desc: "Virtual filesystem using BrowserFS with IndexedDB persistence.",
    features: ["Virtual VFS", "IndexedDB storage", "File operations", "Archive support"]
  },
  {
    name: "NotificationCenter",
    desc: "Toast notification system with Do Not Disturb mode.",
    features: ["Toast notifications", "DND mode", "Notification history"]
  },
  {
    name: "EventBus",
    desc: "Pub-sub event system for inter-app communication.",
    features: ["Event pub-sub", "Settings changes", "Window events"]
  },
  {
    name: "AudioMixer",
    desc: "Per-app volume control using Web Audio API.",
    features: ["Per-app volume", "Master volume", "Mute toggle"]
  },
  {
    name: "SessionManager",
    desc: "User session management with login/lock screens.",
    features: ["Login screen", "Lock screen", "Profile management", "Auto-login"]
  },
  {
    name: "CommandPalette",
    desc: "Global launcher for apps, files, and commands.",
    features: ["App search", "File search", "Command execution", "Keyboard navigation"]
  },
  {
    name: "TrayManager",
    desc: "System tray for background applications.",
    features: ["Tray icons", "Resident apps", "Overflow menu"]
  },
  {
    name: "WorkspaceManager",
    desc: "Virtual desktop management.",
    features: ["Multiple workspaces", "Window assignment", "Workspace switching"]
  },
  {
    name: "AppRegistry",
    desc: "App metadata management with rename/disable/uninstall.",
    features: ["App metadata", "Rename apps", "Disable apps", "Uninstall apps"]
  },
  {
    name: "TaskbarPositionManager",
    desc: "Manages taskbar positioning and alignment.",
    features: ["Bottom position", "Top position", "Left position", "Right position"]
  },
  {
    name: "AdsManager",
    desc: "Manages ad display and analytics buffering.",
    features: ["Ad display", "Analytics buffering", "User control"]
  }
];

export class YukiOsGuideApp extends BaseApp {
  constructor(services) {
    super(services);
    this.currentTab = "overview";
    this.searchQuery = "";
    this.appRegistry = getAppRegistry();
  }

  getDeclarativeSchema(opts) {
    return {
      id: "yuki-os-guide",
      name: "Yuki OS Guide",
      icon: "fas fa-book-open",
      windows: [
        {
          id: "yuki-os-guide",
          title: "Yuki OS Guide",
          size: ["900px", "650px"],
          icon: "fas fa-book-open",
          style: { left: "350px", top: "200px" },
          ui: this._buildUI()
        }
      ],
      state: {
        initial: {
          currentTab: "overview",
          searchQuery: ""
        },
        persistence: PersistenceTypes.MEMORY
      },
      onMount: "initYukiOsGuide"
    };
  }

  initYukiOsGuide(payload, event, element, state) {
    this._bindEvents(element);
  }

  onClose(winId) {
    // Cleanup if needed
  }

  _buildUI() {
    const appMap = this._services.appLauncher?.appMap || gamesListAppMap || {};
    const allApps = this.appRegistry.getAllApps(appMap);
    const filteredApps = this._filterApps(allApps);

    return `
      <div class="window-content" style="height: calc(100% - 40px); overflow: hidden;">
        <div class="yuki-guide-container">
          <div class="yuki-guide-sidebar">
            <div class="yuki-guide-search">
              <input type="text" id="guide-search" placeholder="Search apps & features..." value="${this.searchQuery}">
              <i class="fas fa-search"></i>
            </div>
            <nav class="guide-nav">
              <button class="guide-nav-item ${this.currentTab === "overview" ? "active" : ""}" data-tab="overview">
                <i class="fas fa-home"></i>
                <span>Overview</span>
              </button>
              <button class="guide-nav-item ${this.currentTab === "apps" ? "active" : ""}" data-tab="apps">
                <i class="fas fa-th"></i>
                <span>Apps</span>
                <span class="guide-nav-badge">${filteredApps.length}</span>
              </button>
              <button class="guide-nav-item ${this.currentTab === "features" ? "active" : ""}" data-tab="features">
                <i class="fas fa-star"></i>
                <span>Features</span>
              </button>
              <button class="guide-nav-item ${this.currentTab === "system" ? "active" : ""}" data-tab="system">
                <i class="fas fa-project-diagram"></i>
                <span>System Map</span>
              </button>
            </nav>
          </div>
          <div class="yuki-guide-main">
            ${this._buildContent(filteredApps)}
          </div>
        </div>
      </div>
    `;
  }

  _buildContent(apps) {
    switch (this.currentTab) {
      case "overview":
        return this._buildOverview(apps);
      case "apps":
        return this._buildApps(apps);
      case "features":
        return this._buildFeatures();
      case "system":
        return this._buildSystemMap(apps);
      default:
        return this._buildOverview(apps);
    }
  }

  _buildOverview(apps) {
    const systemApps = apps.filter((a) => a.type === "core" || a.type === "bundled");
    const gameApps = apps.filter((a) => a.type === "external");
    const totalFeatures = FEATURE_DATA.step2.length + FEATURE_DATA.step3.length + FEATURE_DATA.step3b.length;

    return `
      <div class="guide-section">
        <div class="guide-hero">
          <div class="guide-hero-icon">
            <i class="fas fa-book-open"></i>
          </div>
          <div class="guide-hero-content">
            <h1>Welcome to Yuki OS ${SYSTEM_INFO.version}</h1>
            <p>Your browser-based desktop environment with ${apps.length}+ apps and 3700+ games</p>
            <div class="guide-hero-meta">
              <span class="hero-tag"><i class="fas fa-code"></i> ${SYSTEM_INFO.runtime}</span>
              <span class="hero-tag"><i class="fas fa-database"></i> ${SYSTEM_INFO.persistence}</span>
              <span class="hero-tag"><i class="fas fa-wifi"></i> ${SYSTEM_INFO.offline}</span>
            </div>
          </div>
        </div>

        <div class="guide-stats">
          <div class="stat-card">
            <i class="fas fa-th"></i>
            <div class="stat-value">${systemApps.length}</div>
            <div class="stat-label">Apps</div>
          </div>
          <div class="stat-card">
            <i class="fas fa-gamepad"></i>
            <div class="stat-value">3700+</div>
            <div class="stat-label">Games</div>
          </div>
          <div class="stat-card">
            <i class="fas fa-star"></i>
            <div class="stat-value">${totalFeatures}</div>
            <div class="stat-label">Features</div>
          </div>
          <div class="stat-card">
            <i class="fas fa-layer-group"></i>
            <div class="stat-value">${CORE_SERVICES.length}</div>
            <div class="stat-label">Services</div>
          </div>
          <div class="stat-card">
            <i class="fas fa-magic"></i>
            <div class="stat-value">35</div>
            <div class="stat-label">Animations</div>
          </div>
        </div>

        <div class="guide-subsection">
          <h2><i class="fas fa-microchip"></i> System Architecture</h2>
          <div class="architecture-grid">
            <div class="arch-item">
              <i class="fas fa-window-maximize"></i>
              <strong>${SYSTEM_INFO.windowManager}</strong>
            </div>
            <div class="arch-item">
              <i class="fas fa-volume-high"></i>
              <strong>${SYSTEM_INFO.audio}</strong>
            </div>
            <div class="arch-item">
              <i class="fas fa-folder-tree"></i>
              <strong>${SYSTEM_INFO.filesystem}</strong>
            </div>
            <div class="arch-item">
              <i class="fas fa-desktop"></i>
              <strong>${SYSTEM_INFO.workspaces}</strong>
            </div>
            <div class="arch-item">
              <i class="fas fa-film"></i>
              <strong>${SYSTEM_INFO.animations}</strong>
            </div>
            <div class="arch-item">
              <i class="fas fa-bars"></i>
              <strong>${SYSTEM_INFO.tray}</strong>
            </div>
            <div class="arch-item">
              <i class="fas fa-user-lock"></i>
              <strong>${SYSTEM_INFO.session}</strong>
            </div>
            <div class="arch-item">
              <i class="fas fa-terminal"></i>
              <strong>${SYSTEM_INFO.commandPalette}</strong>
            </div>
          </div>
        </div>

        <div class="guide-subsection">
          <h2><i class="fas fa-rocket"></i> System Capabilities</h2>
          <div class="capabilities-grid" id="capabilities-grid">
            ${SYSTEM_CAPABILITIES.map(
              (cap) => `
              <div class="capability-card" data-search="${cap.title.toLowerCase()} ${cap.desc.toLowerCase()} ${cap.tag.toLowerCase()}">
                <div class="capability-tag">${cap.tag}</div>
                <h3>${cap.title}</h3>
                <p>${cap.desc}</p>
              </div>
            `
            ).join("")}
          </div>
        </div>

        <div class="guide-subsection">
          <h2><i class="fas fa-cogs"></i> Core Services</h2>
          <div class="services-grid">
            ${CORE_SERVICES.map(
              (service) => `
              <div class="service-card">
                <h3>${service.name}</h3>
                <p>${service.desc}</p>
                <div class="service-features">
                  ${service.features.map((f) => `<span class="service-feature">${f}</span>`).join("")}
                </div>
              </div>
            `
            ).join("")}
          </div>
        </div>

        <div class="guide-subsection">
          <h2><i class="fas fa-info-circle"></i> Quick Start</h2>
          <div class="quick-start-list">
            <div class="quick-start-item">
              <i class="fas fa-keyboard"></i>
              <div>
                <strong>Command Palette</strong>
                <p>Press Ctrl+K or F1 to launch apps, search files, or run commands</p>
              </div>
            </div>
            <div class="quick-start-item">
              <i class="fas fa-folder"></i>
              <div>
                <strong>File Explorer</strong>
                <p>Access your virtual filesystem with persistent storage at /home/reeyuki/</p>
              </div>
            </div>
            <div class="quick-start-item">
              <i class="fas fa-gamepad"></i>
              <div>
                <strong>Games Hub</strong>
                <p>Browse 3700+ games via Steam integration or direct launch</p>
              </div>
            </div>
            <div class="quick-start-item">
              <i class="fas fa-layer-group"></i>
              <div>
                <strong>Workspaces</strong>
                <p>Use multiple virtual desktops to organize your tasks</p>
              </div>
            </div>
            <div class="quick-start-item">
              <i class="fas fa-volume-high"></i>
              <div>
                <strong>Audio Mixer</strong>
                <p>Control volume per-app from the system tray</p>
              </div>
            </div>
            <div class="quick-start-item">
              <i class="fas fa-sliders-h"></i>
              <div>
                <strong>Settings</strong>
                <p>Customize themes, wallpapers, animations, and more</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _buildApps(apps) {
    const categories = this._categorizeApps(apps);
    const searchLower = this.searchQuery.toLowerCase();

    return `
      <div class="guide-section">
        <div class="guide-header">
          <h1>Apps Catalog</h1>
          <p>Browse all ${apps.length} installed applications</p>
        </div>

        ${Object.entries(categories)
          .map(([category, categoryApps]) => {
            const filtered = categoryApps.filter(
              (a) => a.displayName.toLowerCase().includes(searchLower) || a.id.toLowerCase().includes(searchLower)
            );
            if (filtered.length === 0) return "";
            return `
            <div class="guide-subsection">
              <h2>${this._formatCategory(category)}</h2>
              <div class="apps-grid">
                ${filtered
                  .map(
                    (app) => `
                  <div class="app-card" data-app-id="${app.id}">
                    <div class="app-icon">
                      ${
                        app.icon
                          ? app.icon.startsWith("fa") || app.icon.startsWith("fas") || app.icon.startsWith("fab")
                            ? `<i class="${app.icon}"></i>`
                            : `<img src="${app.icon}" alt="${app.displayName}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"><i class="fas fa-cube" style="display:none;"></i>`
                          : `<i class="fas fa-cube"></i>`
                      }
                    </div>
                    <div class="app-info">
                      <h3>${app.displayName}</h3>
                      <p>${this._inferAppDescription(app)}</p>
                      <div class="app-meta">
                        <span class="app-type ${app.type}">${app.type}</span>
                        ${app.protected ? '<span class="app-protected"><i class="fas fa-shield-alt"></i></span>' : ""}
                      </div>
                    </div>
                  </div>
                `
                  )
                  .join("")}
              </div>
            </div>
          `;
          })
          .join("")}

        ${
          apps.filter(
            (a) => a.displayName.toLowerCase().includes(searchLower) || a.id.toLowerCase().includes(searchLower)
          ).length === 0
            ? `<div class="guide-empty"><i class="fas fa-search"></i><p>No apps match your search</p></div>`
            : ""
        }
      </div>
    `;
  }

  _buildFeatures() {
    const searchLower = this.searchQuery.toLowerCase();

    const filterFeatures = (features) => {
      return features.filter(
        (f) => f.title.toLowerCase().includes(searchLower) || f.desc.toLowerCase().includes(searchLower)
      );
    };

    const step2Filtered = filterFeatures(FEATURE_DATA.step2);
    const step3Filtered = filterFeatures(FEATURE_DATA.step3);
    const step3bFiltered = filterFeatures(FEATURE_DATA.step3b);

    return `
      <div class="guide-section">
        <div class="guide-header">
          <h1>Feature Explorer</h1>
          <p>Discover what Yuki OS can do</p>
        </div>

        <div class="guide-subsection">
          <h2><i class="fas fa-star"></i> Core Highlights</h2>
          <div class="feature-grid">
            ${step2Filtered
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
          ${step2Filtered.length === 0 ? `<p class="no-results">No matching features</p>` : ""}
        </div>

        <div class="guide-subsection">
          <h2><i class="fas fa-puzzle-piece"></i> System Features</h2>
          <div class="feature-grid">
            ${step3Filtered
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
          ${step3Filtered.length === 0 ? `<p class="no-results">No matching features</p>` : ""}
        </div>

        <div class="guide-subsection">
          <h2><i class="fas fa-plus-circle"></i> Advanced Features</h2>
          <div class="feature-grid">
            ${step3bFiltered
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
          ${step3bFiltered.length === 0 ? `<p class="no-results">No matching features</p>` : ""}
        </div>

        <div class="guide-subsection">
          <h2><i class="fas fa-keyboard"></i> Keyboard Shortcuts</h2>
          <div class="shortcuts-grid">
            ${FEATURE_DATA.step6.keyboardShortcuts
              .filter((s) => s.keys.toLowerCase().includes(searchLower) || s.desc.toLowerCase().includes(searchLower))
              .map(
                (s) => `
              <div class="shortcut-item">
                <kbd>${s.keys}</kbd>
                <span>${s.desc}</span>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      </div>
    `;
  }

  _buildSystemMap(apps) {
    const searchLower = this.searchQuery.toLowerCase();

    return `
      <div class="guide-section">
        <div class="guide-header">
          <h1>System Map</h1>
          <p>Where features meet apps</p>
        </div>

        <div class="guide-subsection">
          <h2><i class="fas fa-sitemap"></i> Architecture Overview</h2>
          <div class="system-overview">
            <div class="system-layer">
              <h3>Desktop Environment</h3>
              <p>Window management, taskbar, start menu, desktop icons</p>
              <div class="layer-features">
                <span class="feature-tag">Window Snapping</span>
                <span class="feature-tag">Workspaces</span>
                <span class="feature-tag">Transparency</span>
              </div>
            </div>
            <div class="system-layer">
              <h3>Filesystem</h3>
              <p>BrowserFS + IndexedDB for persistent storage</p>
              <div class="layer-features">
                <span class="feature-tag">Virtual Files</span>
                <span class="feature-tag">Drag & Drop</span>
                <span class="feature-tag">Archive Support</span>
              </div>
            </div>
            <div class="system-layer">
              <h3>App Runtime</h3>
              <p>Multi-runtime engine for games and applications</p>
              <div class="layer-features">
                <span class="feature-tag">JS-DOS</span>
                <span class="feature-tag">V86</span>
                <span class="feature-tag">Ruffle</span>
                <span class="feature-tag">Azahar 3DS</span>
              </div>
            </div>
            <div class="system-layer">
              <h3>Services</h3>
              <p>Notification center, event bus, audio mixer</p>
              <div class="layer-features">
                <span class="feature-tag">Notifications</span>
                <span class="feature-tag">Per-App Audio</span>
                <span class="feature-tag">Event System</span>
              </div>
            </div>
          </div>
        </div>

        <div class="guide-subsection">
          <h2><i class="fas fa-link"></i> Feature-App Connections</h2>
          <div class="connection-grid">
            ${this._buildConnectionCards(apps, searchLower)}
          </div>
        </div>

        <div class="guide-subsection">
          <h2><i class="fas fa-folder-tree"></i> Filesystem Structure</h2>
          <div class="filesystem-structure">
            ${FEATURE_DATA.step6.filesystem.structure
              .filter((f) => f.path.toLowerCase().includes(searchLower) || f.desc.toLowerCase().includes(searchLower))
              .map(
                (f) => `
              <div class="filesystem-item">
                <code>${f.path}</code>
                <span>${f.desc}</span>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      </div>
    `;
  }

  _buildConnectionCards(apps, searchLower) {
    const connections = [
      {
        feature: "Productivity Tools",
        apps: ["notepad", "markdown", "monaco", "office", "yukiConvert", "calculator", "dataEditor", "vscode"],
        icon: "fas fa-pen-fancy"
      },
      {
        feature: "System Utilities",
        apps: ["terminal", "explorer", "settings", "taskManagerApp", "shortcuts", "archiveExtractor", "categories"],
        icon: "fas fa-tools"
      },
      {
        feature: "Media & Creative",
        apps: ["cameraApp", "model3dApp", "paint", "photopea", "youtube", "shittify", "weather", "libreSprite"],
        icon: "fas fa-palette"
      },
      {
        feature: "Gaming Runtime",
        apps: ["emulatorApp", "ruffleApp", "jsDosApp", "v86app", "steam", "azahar", "flash"],
        icon: "fas fa-gamepad"
      },
      {
        feature: "Communication",
        apps: ["browserApp", "kiwiIRC", "news"],
        icon: "fas fa-comments"
      },
      {
        feature: "System Management",
        apps: ["aboutApp", "achievementsApp", "profileCustomizer", "installedApps", "yukiOsGuide"],
        icon: "fas fa-cog"
      }
    ];

    return connections
      .map((conn) => {
        const matchingApps = apps.filter((a) => conn.apps.includes(a.id));
        if (matchingApps.length === 0) return "";

        return `
        <div class="connection-card">
          <div class="connection-header">
            <i class="${conn.icon}"></i>
            <h3>${conn.feature}</h3>
          </div>
          <div class="connection-apps">
            ${matchingApps
              .map(
                (app) => `
              <div class="mini-app-tag">
                ${
                  app.icon && (app.icon.startsWith("fa") || app.icon.startsWith("fas") || app.icon.startsWith("fab"))
                    ? `<i class="${app.icon}"></i>`
                    : `<i class="fas fa-cube"></i>`
                }
                <span>${app.displayName}</span>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `;
      })
      .join("");
  }

  _filterApps(apps) {
    const searchLower = this.searchQuery.toLowerCase();
    return apps.filter(
      (a) => a.displayName.toLowerCase().includes(searchLower) || a.id.toLowerCase().includes(searchLower)
    );
  }

  _filterCapabilities(win) {
    const searchLower = this.searchQuery.toLowerCase();
    const capabilitiesGrid = win.querySelector("#capabilities-grid");
    if (!capabilitiesGrid) return;

    const cards = capabilitiesGrid.querySelectorAll(".capability-card");
    cards.forEach((card) => {
      const searchData = card.dataset.search || "";
      if (searchData.includes(searchLower) || searchLower === "") {
        card.style.display = "";
      } else {
        card.style.display = "none";
      }
    });
  }

  _categorizeApps(apps) {
    const categories = {
      productivity: [],
      system: [],
      media: [],
      games: [],
      tools: [],
      other: []
    };

    apps.forEach((app) => {
      const category = this._getAppCategory(app.id);
      if (categories[category]) {
        categories[category].push(app);
      } else {
        categories.other.push(app);
      }
    });

    return categories;
  }

  _getAppCategory(appId) {
    const categoryMap = {
      notepad: "productivity",
      markdown: "productivity",
      monaco: "productivity",
      vscode: "productivity",
      office: "productivity",
      yukiConvert: "productivity",
      calculator: "productivity",
      dataEditor: "productivity",

      terminal: "system",
      explorer: "system",
      settings: "system",
      taskManagerApp: "system",
      shortcuts: "system",
      archiveExtractor: "system",
      categories: "system",
      clipboardManager: "system",

      cameraApp: "media",
      model3dApp: "media",
      paint: "media",
      photopea: "media",
      youtube: "media",
      shittify: "media",
      weather: "media",
      libreSprite: "media",
      browserApp: "media",
      kiwiIRC: "media",
      news: "media",

      emulatorApp: "games",
      ruffleApp: "games",
      jsDosApp: "games",
      v86app: "games",
      steam: "games",
      azahar: "games",
      flash: "games",

      aboutApp: "system",
      achievementsApp: "system",
      profileCustomizer: "system",
      installedApps: "system",
      yukiOsGuide: "system"
    };

    return categoryMap[appId] || "other";
  }

  _formatCategory(category) {
    const names = {
      productivity: "Productivity",
      system: "System Utilities",
      media: "Media & Creative",
      games: "Games & Emulation",
      tools: "Tools",
      other: "Other"
    };
    return names[category] || category;
  }

  _inferAppDescription(app) {
    return gameDescriptions[app.id] || APP_DESCRIPTIONS[app.id] || APP_DESCRIPTIONS.game;
  }

  _bindEvents(win) {
    const searchInput = win.querySelector("#guide-search");
    const navBtns = win.querySelectorAll(".guide-nav-item");

    searchInput.addEventListener("input", (e) => {
      this.searchQuery = e.target.value;
      this._refreshContent(win);
      this._filterCapabilities(win);
    });

    navBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;
        this.currentTab = tab;

        navBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        this._refreshContent(win);
        this._filterCapabilities(win);
      });
    });

    const bindAppCards = () => {
      const appCards = win.querySelectorAll(".app-card");
      appCards.forEach((card) => {
        card.addEventListener("click", () => {
          card.classList.toggle("expanded");
          if (card.classList.contains("expanded")) {
            setTimeout(() => {
              card.classList.remove("expanded");
            }, 3000);
          }
        });
      });
    };

    bindAppCards();
    this._appCardBinder = bindAppCards;
  }

  _refreshContent(win) {
    const appMap = this._services.appLauncher?.appMap || gamesListAppMap || {};
    const allApps = this.appRegistry.getAllApps(appMap);
    const filteredApps = this._filterApps(allApps);
    const mainContent = win.querySelector(".yuki-guide-main");

    if (mainContent) {
      mainContent.innerHTML = this._buildContent(filteredApps);

      const navCount = win.querySelector(".guide-nav-item[data-tab='apps'] .guide-nav-badge");
      if (navCount) {
        navCount.textContent = filteredApps.length;
      }

      if (this._appCardBinder) {
        this._appCardBinder();
      }

      this._filterCapabilities(win);
    }
  }
}
