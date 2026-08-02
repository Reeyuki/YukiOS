import { getAppRegistry } from "../appRegistry.js";
import { YUKIOS_VERSION } from "./about.js";
import { appMap } from "../games/gamesList.js";
const gamesListAppMap = appMap;
import { APP_DESCRIPTIONS, descriptionMap } from "../games/gameDescriptions.js";
const gameDescriptions = descriptionMap;
import "../styles/yukiOsGuide.css";
import { $, $$ } from "../shared/domUtils.js";
import { BaseApp, os } from "../framework.js";
import { buildTilingKeybindHTML } from "../tiling/TilingKeybindOverlay.js";
import { startIntroTour } from "./introTour.js";

const SHOWCASE = [
  {
    group: "Get productive",
    icon: "fas fa-folder-open",
    title: "File Explorer",
    desc: "A real filesystem lives in this tab. Drag, drop, edit, organize.",
    action: "explorerApp"
  },
  {
    group: "Get productive",
    icon: "fas fa-file-alt",
    title: "Notepad",
    desc: "A clean text editor that saves straight to your virtual disk.",
    action: "notepadApp"
  },
  {
    group: "Get productive",
    icon: "fas fa-calculator",
    title: "Calculator",
    desc: "A full scientific calculator with memory and history.",
    action: "calculatorApp"
  },
  {
    group: "Get productive",
    icon: "fas fa-cog",
    title: "Settings",
    desc: "Themes, wallpapers, audio, and every system knob in one place.",
    action: "settingsApp"
  },
  {
    group: "Make something",
    icon: "fas fa-code",
    title: "Code Editor",
    desc: "A full VS Code-powered editor running right inside the tab.",
    action: "monacoApp"
  },
  {
    group: "Make something",
    icon: "fas fa-terminal",
    title: "Terminal",
    desc: "Real commands, git, Python, and WASM tools like btop and cmatrix.",
    action: "terminalApp"
  },
  {
    group: "Make something",
    icon: "fas fa-wand-magic-sparkles",
    title: "App Creator",
    desc: "Turn any URL into a desktop app in under a minute.",
    action: "appCreatorApp"
  },
  {
    group: "Make something",
    icon: "fas fa-camera",
    title: "Camera",
    desc: "Snap a photo and save it straight to your files.",
    action: "cameraApp"
  },
  {
    group: "Make something",
    icon: "fas fa-cube",
    title: "3D Models",
    desc: "Open and orbit OBJ, GLTF, and GLB models in 3D.",
    action: "model3dApp"
  },
  {
    group: "Play something",
    icon: "fab fa-steam",
    title: "Steam",
    desc: "Browse and launch 2900+ games from a full library.",
    action: "steamApp"
  },
  {
    group: "Play something",
    icon: "fas fa-gamepad",
    title: "Emulators",
    desc: "Boot DOS, Flash, console, and x86 systems in the browser.",
    action: "emulatorApp"
  },
  {
    group: "Play something",
    icon: "fas fa-floppy-disk",
    title: "DOS Games",
    desc: "Play classic DOS titles through the JsDos runtime.",
    action: "jsDosApp"
  }
];

export class YukiOsGuideApp extends BaseApp {
  constructor(services) {
    super(services);
    this.currentTab = "overview";
    this.searchQuery = "";
    this.appRegistry = getAppRegistry();
  }

  open(opts = {}) {
    const win = os.window.create("yuki-os-guide", "YukiOS Guide", "980px", "720px", {
      icon: "fas fa-book-open",
      appId: "yuki-os-guide"
    });

    win.innerHTML = this.buildUI();
    this.bindEvents(win);
  }

  onClose(winId) {}

  buildUI() {
    const appMap = this.os.app.getAllApps();
    const allApps =
      Object.keys(appMap).length > 0
        ? this.appRegistry.getAllApps(appMap)
        : this.appRegistry.getAllApps(gamesListAppMap);
    const filteredApps = this.filterApps(allApps);

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
              <button class="guide-nav-item ${this.currentTab === "developers" ? "active" : ""}" data-tab="developers">
                <i class="fas fa-code"></i>
                <span>For Developers</span>
              </button>
              <button class="guide-nav-item ${this.currentTab === "tiling" ? "active" : ""}" data-tab="tiling">
                <i class="fas fa-th-large"></i>
                <span>Tiling</span>
              </button>
            </nav>
          </div>
          <div class="yuki-guide-main">
            ${this.buildContent(filteredApps)}
          </div>
        </div>
      </div>
    `;
  }

  buildContent(apps) {
    switch (this.currentTab) {
      case "overview":
        return this.buildOverview(apps);
      case "apps":
        return this.buildApps(apps);
      case "developers":
        return this.buildDevelopers();
      case "tiling":
        return this.buildTiling();
      default:
        return this.buildOverview(apps);
    }
  }

  buildOverview(apps) {
    const showcaseItems = SHOWCASE.filter((item) => this.os.app.hasApp(item.action));
    const groups = ["Get productive", "Make something", "Play something"].map((label) => ({
      label,
      items: showcaseItems.filter((item) => item.group === label)
    }));

    return `
      <div class="guide-section guide-overview">
        <div class="guide-hero">
          <div class="guide-hero-icon">
            <i class="fas fa-rocket"></i>
          </div>
          <div class="guide-hero-content">
            <h1>Welcome to YukiOS</h1>
            <p class="guide-tagline">A full desktop inside one browser tab. No installs, nothing to block, everything saved.</p>
            <p class="guide-blurb">Everything on this page is real and running right now. Drag windows, browse the web, open a terminal, or boot a retro game, then close the tab and come back later. It all remembers.</p>
            <button class="guide-tour-btn" type="button"><i class="fas fa-play"></i> Take the 60-second tour</button>
            <p class="guide-tech-note"><i class="fas fa-code"></i> Built with pure JavaScript, no React and no framework, all in one HTML file. Running v${YUKIOS_VERSION}.</p>
          </div>
        </div>

        <div class="guide-facts">
          <div class="fact-chip"><i class="fas fa-code"></i> 140k lines of vanilla JS</div>
          <div class="fact-chip"><i class="fas fa-globe"></i> Runs on any browser</div>
          <div class="fact-chip"><i class="fas fa-database"></i> Everything persists in this tab</div>
          <div class="fact-chip"><i class="fas fa-gamepad"></i> Emulates DOS, Flash, 3DS, and x86</div>
        </div>

        <div class="guide-subsection">
          <h2><i class="fas fa-th"></i> Try it live</h2>
          <p class="guide-subsection-note">Click anything below and it opens the real app.</p>
          ${groups
            .map(
              (group) => `
            <div class="showcase-group">
              <h3 class="showcase-group-title">${group.label}</h3>
              <div class="showcase-grid">
                ${group.items
                  .map(
                    (item) => `
                  <div class="showcase-card" data-search="${item.title.toLowerCase()} ${item.desc.toLowerCase()}" data-action="${item.action}">
                    <div class="showcase-icon"><i class="${item.icon}"></i></div>
                    <div class="showcase-info">
                      <h4>${item.title}</h4>
                      <p>${item.desc}</p>
                    </div>
                    <span class="showcase-open"><i class="fas fa-external-link-alt"></i> Open</span>
                  </div>
                `
                  )
                  .join("")}
              </div>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  buildApps(apps) {
    const categories = this.categorizeApps(apps);
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
              <h2>${this.formatCategory(category)}</h2>
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
                            : `<img src="${app.icon}" alt="${app.displayName}"><i class="fas fa-cube" style="display:none;"></i>`
                          : `<i class="fas fa-cube"></i>`
                      }
                    </div>
                    <div class="app-info">
                      <h3>${app.displayName}</h3>
                      <p>${this.inferAppDescription(app)}</p>
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
            ? `<div class="guide-empty"><i class="fas fa-search"></i><p>No apps match that</p></div>`
            : ""
        }
      </div>
    `;
  }

  buildDevelopers() {
    return `
      <div class="guide-section">
        <div class="guide-header">
          <h1><i class="fas fa-code"></i> For Developers</h1>
          <p>The engineering behind a full desktop in one tab.</p>
        </div>

        <div class="guide-subsection">
          <h2><i class="fas fa-layer-group"></i> The Stack</h2>
          <div class="dev-grid">
            <div class="dev-card">
              <div class="dev-card-icon"><i class="fab fa-js"></i></div>
              <h3>Vanilla JavaScript</h3>
              <p>No framework, no virtual DOM. Just modern web platform code.</p>
            </div>
            <div class="dev-card">
              <div class="dev-card-icon"><i class="fas fa-bolt"></i></div>
              <h3>Vite build</h3>
              <p>Fast bundler with a tree-shaken output and a single entry point.</p>
            </div>
            <div class="dev-card">
              <div class="dev-card-icon"><i class="fas fa-file-code"></i></div>
              <h3>One HTML file output</h3>
              <p>Deploy to any static host. No server, no database, no setup.</p>
            </div>
          </div>
        </div>

        <div class="guide-subsection">
          <h2><i class="fas fa-microchip"></i> Runtimes running in your browser</h2>
          <div class="runtime-list">
            <div class="runtime-item"><i class="fas fa-terminal"></i><div><strong>WebAssembly ports</strong><p>btop, lavat, and cmatrix are real C/C++ recompiled to WASM.</p></div></div>
            <div class="runtime-item"><i class="fab fa-python"></i><div><strong>Pyodide Python</strong><p>A full CPython interpreter compiled to WebAssembly.</p></div></div>
            <div class="runtime-item"><i class="fab fa-node-js"></i><div><strong>WebContainers Node.js</strong><p>A Node.js runtime running entirely inside the tab.</p></div></div>
            <div class="runtime-item"><i class="fas fa-film"></i><div><strong>Ruffle Flash</strong><p>Runs .swf files without any plugin.</p></div></div>
            <div class="runtime-item"><i class="fas fa-floppy-disk"></i><div><strong>JsDos</strong><p>The DOSBox port that boots classic DOS software.</p></div></div>
            <div class="runtime-item"><i class="fas fa-gamepad"></i><div><strong>EmulatorJS</strong><p>Retro console emulation right in the browser.</p></div></div>
            <div class="runtime-item"><i class="fas fa-microchip"></i><div><strong>V86 x86</strong><p>Boots full x86 OS images like FreeDOS at near-native speed.</p></div></div>
            <div class="runtime-item"><i class="fas fa-mobile-alt"></i><div><strong>Azahar 3DS</strong><p>Nintendo 3DS emulation with a modern renderer.</p></div></div>
          </div>
        </div>

        <div class="guide-subsection">
          <h2><i class="fas fa-sitemap"></i> Architecture</h2>
          <div class="architecture-list">
            <div class="arch-item"><i class="fas fa-window-maximize"></i><div><strong>Custom window manager</strong><p>Drag, resize, snap, and z-order, all hand-rolled.</p></div></div>
            <div class="arch-item"><i class="fas fa-database"></i><div><strong>IndexedDB virtual filesystem</strong><p>Real persistent storage mounted at /home/reeyuki/.</p></div></div>
            <div class="arch-item"><i class="fas fa-history"></i><div><strong>Session persistence</strong><p>Windows, layout, and app state restore on reload.</p></div></div>
            <div class="arch-item"><i class="fas fa-search"></i><div><strong>Command palette</strong><p>Launch anything with Ctrl+K or F1.</p></div></div>
            <div class="arch-item"><i class="fas fa-th-large"></i><div><strong>Tiling WM</strong><p>Hyprland-inspired, with a live-editable config file.</p></div></div>
            <div class="arch-item"><i class="fas fa-puzzle-piece"></i><div><strong>Extensible apps</strong><p>Every app is a class; add new ones without touching core.</p></div></div>
            <div class="arch-item"><i class="fas fa-mobile-alt"></i><div><strong>PWA</strong><p>Installable, offline-capable, and addable to your home screen.</p></div></div>
          </div>
        </div>

        <div class="guide-subsection">
          <h2><i class="fas fa-plus-circle"></i> Extend it yourself</h2>
          <div class="extend-note">
            <p>Open the <strong>App Creator</strong> to turn any URL into a desktop app with a custom icon, per-app CORS proxy, and window options.</p>
          </div>
        </div>
      </div>
    `;
  }

  buildTiling() {
    const searchLower = this.searchQuery.toLowerCase();

    return `
      <div class="guide-section">
        <div class="guide-header">
          <h1><i class="fas fa-th-large"></i> Tiling Mode</h1>
          <p>Hyprland-inspired automatic window tiling for YukiOS</p>
        </div>

        <div class="guide-subsection">
          <div class="feature-card" style="margin-bottom:12px">
            <div class="feature-icon"><i class="fas fa-th-large"></i></div>
            <h3>Automatic Window Tiling</h3>
            <p>Select "Yuki Tiling WM" from the login session picker to enable a Hyprland-inspired tiling window manager. Windows are automatically arranged in a non-overlapping layout with a waybar-style status bar at the top.</p>
          </div>
          <div class="guide-tiling-section">
            ${buildTilingKeybindHTML(searchLower)}
          </div>
          <div class="feature-card" style="margin-bottom:12px;margin-top:16px">
            <div class="feature-icon"><i class="fas fa-gear"></i></div>
            <h3>Configuration File</h3>
            <p>All tiling settings are stored in <code>Config/yukiOs/tiling.conf</code>, a JSON file in your virtual filesystem. Edit it with the Explorer or any text editor; changes are auto-detected and applied within seconds.</p>
          </div>
          <div class="config-doc">
            <table class="config-table">
              <tr><th>Setting</th><th>Default</th><th>Description</th></tr>
              <tr><td><code>gaps.inner</code></td><td><code>6</code></td><td>Gap (px) between adjacent tiled windows</td></tr>
              <tr><td><code>gaps.outer</code></td><td><code>12</code></td><td>Gap (px) between windows and screen edges</td></tr>
              <tr><td><code>split_ratio</code></td><td><code>0.5</code></td><td>Default split ratio (0.1-0.9) for master/stack areas</td></tr>
              <tr><td><code>border_width</code></td><td><code>3</code></td><td>Thickness (px) of the focused window border glow</td></tr>
              <tr><td><code>border_radius</code></td><td><code>8</code></td><td>Corner radius (px) for tiled windows</td></tr>
              <tr><td><code>resize_delta</code></td><td><code>0.05</code></td><td>Step size when resizing splits via keyboard</td></tr>
              <tr><td><code>animation_duration</code></td><td><code>250</code></td><td>Animation length (ms) for window placement transitions</td></tr>
              <tr><td><code>animation_easing</code></td><td><code>"cubic-bezier(…)"</code></td><td>CSS easing function for window animations</td></tr>
              <tr><td><code>mouse_resize</code></td><td><code>true</code></td><td>Allow dragging the split border with the mouse</td></tr>
              <tr><td><code>workspace_switch_delay</code></td><td><code>320</code></td><td>Debounce delay (ms) when switching workspaces</td></tr>
              <tr><td><code>resize_debounce</code></td><td><code>150</code></td><td>Debounce delay (ms) for resize operations</td></tr>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  filterApps(apps) {
    const searchLower = this.searchQuery.toLowerCase();
    return apps.filter(
      (a) => a.displayName.toLowerCase().includes(searchLower) || a.id.toLowerCase().includes(searchLower)
    );
  }

  filterOverview(win) {
    const searchLower = this.searchQuery.toLowerCase();
    const overview = $(".guide-overview", win);
    if (!overview) return;

    $$(".showcase-group", overview).forEach((group) => {
      const cards = $$(".showcase-card", group);
      let anyVisible = false;
      cards.forEach((card) => {
        const searchData = card.dataset.search || "";
        const visible = searchLower === "" || searchData.includes(searchLower);
        card.style.display = visible ? "" : "none";
        if (visible) anyVisible = true;
      });
      group.style.display = anyVisible ? "" : "none";
    });
  }

  categorizeApps(apps) {
    const categories = {
      productivity: [],
      system: [],
      media: [],
      games: [],
      tools: [],
      other: []
    };

    apps.forEach((app) => {
      const category = this.getAppCategory(app.id);
      if (categories[category]) {
        categories[category].push(app);
      } else {
        categories.other.push(app);
      }
    });

    return categories;
  }

  getAppCategory(appId) {
    const categoryMap = {
      notepadApp: "productivity",
      markdownApp: "productivity",
      monacoApp: "productivity",
      vscode: "productivity",
      officeApp: "productivity",
      yukiConvertApp: "productivity",
      calculatorApp: "productivity",
      dataEditorApp: "productivity",

      terminal: "system",
      terminalApp: "system",
      explorerApp: "system",
      settingsApp: "system",
      taskManagerApp: "system",
      shortcutsApp: "system",
      archiveExtractorApp: "system",
      categoriesApp: "system",
      clipboardManagerApp: "system",

      cameraApp: "media",
      model3dApp: "media",
      paint: "media",
      photopea: "media",
      youtube: "media",
      youtubeApp: "media",
      shittifyApp: "media",
      weatherApp: "media",
      libreSpriteApp: "media",
      browserApp: "media",
      kiwiIRC: "media",
      newsApp: "media",

      emulatorApp: "games",
      ruffleApp: "games",
      jsDosApp: "games",
      v86app: "games",
      steamApp: "games",
      steam: "games",
      azahar: "games",
      flash: "games",

      aboutApp: "system",
      achievementsApp: "system",

      installedAppsApp: "system",
      yukiOsGuideApp: "system"
    };

    return categoryMap[appId] || "other";
  }

  formatCategory(category) {
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

  inferAppDescription(app) {
    return gameDescriptions[app.id] || APP_DESCRIPTIONS[app.id] || APP_DESCRIPTIONS.game;
  }

  bindEvents(win) {
    const searchInput = $("#guide-search", win);
    const navBtns = $$(".guide-nav-item", win);

    searchInput.addEventListener("input", (e) => {
      this.searchQuery = e.target.value;
      this.refreshContent(win);
      this.filterOverview(win);
    });

    navBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;
        this.currentTab = tab;

        navBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        this.refreshContent(win);
        this.filterOverview(win);
      });
    });

    this.appCardBinder = () => {
      const mainContent = $(".yuki-guide-main", win);
      if (!mainContent) return;

      $$(".showcase-card", mainContent).forEach((card) => {
        card.addEventListener("click", () => {
          const appId = card.dataset.action;
          if (appId && os.app.hasApp(appId)) {
            os.app.launch(appId);
          }
        });
      });

      $$(".app-card", mainContent).forEach((card) => {
        const appId = card.dataset.appId;
        if (!appId) return;
        if (!os.app.hasApp(appId)) {
          card.classList.add("app-card-disabled");
          return;
        }
        card.addEventListener("click", () => {
          os.app.launch(appId);
        });
      });

      const tourBtn = $(".guide-tour-btn", mainContent);
      if (tourBtn) {
        tourBtn.addEventListener("click", () => {
          startIntroTour();
        });
      }
    };

    this.appCardBinder();
  }

  refreshContent(win) {
    const appMap = this.os.app.getAllApps();
    const allApps =
      Object.keys(appMap).length > 0
        ? this.appRegistry.getAllApps(appMap)
        : this.appRegistry.getAllApps(gamesListAppMap);
    const filteredApps = this.filterApps(allApps);
    const mainContent = $(".yuki-guide-main", win);

    if (mainContent) {
      mainContent.innerHTML = this.buildContent(filteredApps);

      $$(".app-icon img", mainContent).forEach((img) => {
        img.addEventListener("error", () => {
          img.style.display = "none";
          const fallback = img.nextElementSibling;
          if (fallback) fallback.style.display = "flex";
        });
      });

      const navCount = $(".guide-nav-item[data-tab='apps'] .guide-nav-badge", win);
      if (navCount) {
        navCount.textContent = filteredApps.length;
      }

      if (this.appCardBinder) {
        this.appCardBinder();
      }

      this.filterOverview(win);
    }
  }
}
