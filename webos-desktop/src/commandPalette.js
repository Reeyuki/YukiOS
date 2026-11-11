import "./styles/commandPalette.css";
import { SystemUtilities } from "./system.js";
import { BusEvents, $, $$, createElement } from "./framework.js";
import { openFileWith } from "./fileDisplay.js";
import { resolveIconUrl } from "./shared/assetResolver.js";
import { getEffectiveIcon } from "./shared/iconPack.js";
import { AppSource } from "./AppSource.js";
import { WALLPAPER_NAME_URL_PAIRS } from "./wallpaperConfig.js";
import { KeybindManager } from "./keybindManager.js";

import { StorageKeys, os, ServiceKeys } from "./framework.js";
import {
  PARTICLE_EFFECTS,
  getParticleEffect,
  setParticleEffect,
} from "./desktopEffects/particleEffects.js";
import {
  SETTINGS_CATEGORIES,
  launchSettingsPane,
} from "./settings/settingsNav.js";
import { animateThemeChange } from "./settings/themeTransition.js";
import { escapeHtml } from "./utils/utils.js";
import { playSfx, SystemSfx } from "./sfx/systemSfx.js";
export class CommandPalette {
  constructor(os) {
    this.os = os;
    this.isOpen = false;
    this.cachedFiles = [];
    this.results = [];
    this.activeIndex = 0;
    this.currentSubpalette = null;
    this.inputElement = null;
    this.resultsContainer = null;
    this.setupListeners();
  }

  setupListeners() {
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
  }

  toggle() {
    const existing = $("#command-palette-overlay");
    if (existing) {
      this.close();
    } else {
      this.open();
    }
  }

  async open() {
    if ($("#session-overlay")) return;
    if ($("#command-palette-overlay")) return;

    this.isOpen = true;
    this.currentSubpalette = null;
    this.activeIndex = 0;

    const overlay = createElement("div", {
      id: "command-palette-overlay",
      className: "command-palette-overlay",
    });
    const parent = $("#session-overlay") || document.body;
    parent.appendChild(overlay);

    const headerEff = getEffectiveIcon("papirus:actions/edit-find");
    const headerHtml = headerEff.startsWith("papirus:")
      ? `<img src="${resolveIconUrl(headerEff)}" class="command-palette-header-icon" style="width:16px;height:16px;" alt="" />`
      : `<i class="${headerEff} command-palette-header-icon" style="width:16px;height:16px;font-size:16px"></i>`;
    overlay.innerHTML = `
      <div class="command-palette-root">
        <div class="command-palette-header">
          ${headerHtml}
          <input type="text" class="command-palette-input" id="command-palette-input" placeholder="Type a command, app, or file name..." autocomplete="off">
          <div class="command-palette-kbd">ESC</div>
        </div>
        <div class="command-palette-body">
          <div class="command-palette-results" id="command-palette-results"></div>
        </div>
        <div class="command-palette-footer">
          <span>Use <kbd>↑</kbd> <kbd>↓</kbd> to navigate, <kbd>Enter</kbd> to select, <kbd>Esc</kbd> to close</span>
        </div>
      </div>
    `;

    overlay.classList.add("command-palette-overlay--show");

    this.inputElement = $("#command-palette-input", overlay);
    this.resultsContainer = $("#command-palette-results", overlay);

    this.inputElement.addEventListener("input", () => {
      this.activeIndex = 0;
      this.renderResults();
    });

    this.inputElement.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        this.close();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        this.activeIndex = (this.activeIndex + 1) % this.results.length;
        this.updateActiveSelection();
        playSfx(SystemSfx.FOCUS_1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        this.activeIndex =
          (this.activeIndex - 1 + this.results.length) % this.results.length;
        this.updateActiveSelection();
        playSfx(SystemSfx.FOCUS_1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        this.executeActive();
      }
    });

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        this.close();
      } else if (
        this.inputElement &&
        document.activeElement !== this.inputElement
      ) {
        this.inputElement.focus();
      }
    });

    overlay.addEventListener("remove", () => {
      this.isOpen = false;
      this.inputElement = null;
      this.resultsContainer = null;
    });

    this.inputElement.value = "";
    if (document.activeElement && document.activeElement !== document.body) {
      document.activeElement.blur?.();
    }
    this.inputElement.focus();
    setTimeout(() => {
      if (this.inputElement && document.activeElement !== this.inputElement) {
        this.inputElement.focus();
      }
    }, 0);
    await this.loadFiles();
    this.renderResults();
    if (this.inputElement && document.activeElement !== this.inputElement) {
      this.inputElement.focus();
    }
  }

  close() {
    const overlay = $("#command-palette-overlay");
    if (overlay) {
      overlay.remove();
    }
    this.isOpen = false;
    this.inputElement = null;
    this.resultsContainer = null;
  }

  async loadFiles() {
    const fsm = os.fs.fs;
    if (!fsm) return;
    this.cachedFiles = [];
    const walk = async (dirPath) => {
      try {
        const list = await fsm.pRead("readdir", dirPath);
        const meta = await fsm.readMeta(dirPath);
        for (const name of list) {
          if (name === fsm.CONFIG.META_FILE) continue;
          if (name === "system" || name.startsWith(".")) continue;
          const fullPath = fsm.join(dirPath, name);
          let stat;
          try {
            stat = await fsm.pStat(fullPath);
          } catch {
            continue;
          }
          if (stat.isDirectory()) {
            await walk(fullPath);
          } else {
            const kind = meta[name]?.kind ?? fsm.inferKind(name);
            this.cachedFiles.push({
              name,
              path: fullPath,
              kind,
            });
          }
        }
      } catch (err) {}
    };
    await walk(fsm.CONFIG.ROOT);
  }

  renderResults() {
    if (!this.resultsContainer) return;
    const search = this.inputElement?.value.trim().toLowerCase() || "";
    this.resultsContainer.innerHTML = "";

    if (this.currentSubpalette === "wallpaper") {
      this.renderWallpaperSubpalette(search);
      return;
    }

    if (this.currentSubpalette === "filesearch") {
      this.renderFileSearchSubpalette(search);
      return;
    }

    const actions = [
      {
        title: "Change Wallpaper",
        subtitle: "Select a custom or default background image",
        tag: "action",
        icon: "papirus:mimetypes/image-x-generic",
        execute: () => {
          this.currentSubpalette = "wallpaper";
          this.inputElement.value = "";
          this.activeIndex = 0;
          this.renderResults();
        },
      },
      ...this.getParticleEffectActions(),
      {
        title: "Theme: Dark Mode",
        subtitle: "Switch to sleek dark UI appearance",
        tag: "theme",
        icon: "papirus:status/weather-clear-night",
        execute: () => this.setSystemTheme("dark"),
      },
      {
        title: "Theme: Light Mode",
        subtitle: "Switch to bright light UI appearance",
        tag: "theme",
        icon: "papirus:status/weather-clear",
        execute: () => this.setSystemTheme("light"),
      },
      {
        title: "Theme: Auto Mode",
        subtitle: "Follow system preference dark/light settings",
        tag: "theme",
        icon: "papirus:actions/contrast",
        execute: () => this.setSystemTheme("auto"),
      },
      {
        title: "Mute Sounds",
        subtitle: "Disable overall system audio notifications",
        tag: "audio",
        icon: "papirus:status/audio-volume-muted",
        execute: () => this.toggleSound(false),
      },
      {
        title: "Unmute Sounds",
        subtitle: "Enable standard system audio notifications",
        tag: "audio",
        icon: "papirus:status/audio-volume-high",
        execute: () => this.toggleSound(true),
      },
      {
        title: "Do Not Disturb: On",
        subtitle: "Silence all toast banner notifications",
        tag: "dnd",
        icon: "papirus:status/audio-volume-muted",
        execute: () => this.toggleDND(true),
      },
      {
        title: "Do Not Disturb: Off",
        subtitle: "Display all standard desktop notifications",
        tag: "dnd",
        icon: "papirus:apps/preferences-desktop-notification-bell",
        execute: () => this.toggleDND(false),
      },
      {
        title: "Close All Windows",
        subtitle: "Close all open application windows",
        tag: "action",
        icon: "papirus:actions/window-close",
        execute: () => this.closeAllWindows(),
      },
      {
        title: "Minimize All Windows",
        subtitle: "Minimize every open window to the taskbar",
        tag: "action",
        icon: "papirus:actions/list-remove",
        execute: () => this.minimizeAllWindows(),
      },
      {
        title: "Toggle Fullscreen",
        subtitle: "Toggle the active window in and out of fullscreen",
        tag: "action",
        icon: "papirus:actions/view-fullscreen",
        execute: () => this.toggleFullscreen(),
      },
      {
        title: "Lock Session",
        subtitle: "Lock the current session and show the lock screen",
        tag: "session",
        icon: "papirus:actions/object-locked",
        execute: () => this.os.app.lockSession(),
      },
      {
        title: "Logout",
        subtitle: "Sign out and return to the login screen",
        tag: "session",
        icon: "papirus:actions/system-log-out",
        execute: async () => {
          if (
            await os.dialog.confirm(
              "Logout",
              "Sign out and return to the login screen?",
            )
          ) {
            await this.os.app.lockToLoginScreen();
          }
        },
      },
      {
        title: "Shutdown",
        subtitle: "Close everything and shut down",
        tag: "session",
        icon: "papirus:actions/system-shutdown",
        execute: async () => {
          if (
            await os.dialog.confirm(
              "Shutdown",
              "Close everything and shut down?",
            )
          ) {
            await this.os.app.lockToLoginScreen();
          }
        },
      },
      {
        title: "Show Workspace Overview",
        subtitle: "Display the workspace overview switcher",
        tag: "workspace",
        icon: "papirus:actions/view-grid",
        execute: () => this.toggleWorkspaceOverview(),
      },
      {
        title: "Switch to Workspace 1",
        subtitle: "Jump to the first workspace",
        tag: "workspace",
        icon: "papirus:actions/go-first",
        execute: () => this.switchWorkspace(0),
      },
      {
        title: "Switch to Workspace 2",
        subtitle: "Jump to the second workspace",
        tag: "workspace",
        icon: "papirus:actions/go-next",
        execute: () => this.switchWorkspace(1),
      },
      {
        title: "Switch to Workspace 3",
        subtitle: "Jump to the third workspace",
        tag: "workspace",
        icon: "papirus:actions/go-last",
        execute: () => this.switchWorkspace(2),
      },
      {
        title: "Switch to Workspace 4",
        subtitle: "Jump to the fourth workspace",
        tag: "workspace",
        icon: "papirus:actions/go-jump",
        execute: () => this.switchWorkspace(3),
      },
      {
        title: "Switch to Workspace 5",
        subtitle: "Jump to the fifth workspace",
        tag: "workspace",
        icon: "papirus:actions/go-jump",
        execute: () => this.switchWorkspace(4),
      },
      {
        title: "Search Files",
        subtitle: "Find files across the entire filesystem",
        tag: "action",
        icon: "papirus:actions/edit-find",
        execute: () => {
          this.currentSubpalette = "filesearch";
          this.inputElement.value = "";
          this.activeIndex = 0;
          this.renderResults();
        },
      },
      {
        title: "Take Screenshot",
        subtitle: "Capture full screen and save to Pictures",
        tag: "screenshot",
        icon: "papirus:apps/accessories-camera",
        execute: () => {
          const app = os.app.getInstance(ServiceKeys.SCREENSHOT);
          if (app) {
            app.open();
            app.captureFull(true);
          }
        },
      },
      {
        title: "Start Screen Recording",
        subtitle: "Begin recording your screen",
        tag: "screenshot",
        icon: "papirus:devices/camera-video",
        execute: () => {
          const app = os.app.getInstance(ServiceKeys.SCREENSHOT);
          if (app && !app.recording) {
            app.open();
            app.toggleRecording();
          }
        },
      },
      {
        title: "Stop Screen Recording",
        subtitle: "Stop the active screen recording",
        tag: "screenshot",
        icon: "papirus:actions/media-playback-stop",
        execute: () => {
          const app = os.app.getInstance(ServiceKeys.SCREENSHOT);
          if (app && app.recording) {
            app.toggleRecording();
          }
        },
      },
      {
        title: "Area Screenshot",
        subtitle: "Capture a selected region of the screen",
        tag: "screenshot",
        icon: "papirus:actions/transform-crop",
        execute: () => {
          const app = os.app.getInstance(ServiceKeys.SCREENSHOT);
          if (app) {
            app.open();
            app.captureArea(true);
          }
        },
      },
      {
        title: "Empty Trash",
        subtitle: "Permanently delete all trashed files",
        tag: "action",
        icon: "papirus:places/user-trash",
        execute: async () => {
          if (
            await os.dialog.confirm(
              "Empty Trash",
              "Are you sure you want to permanently delete all trashed files?",
            )
          ) {
            await os.fs.emptyTrash();
            os.notify.send("Trash emptied", "", {
              type: "success",
              duration: 2500,
              icon: "papirus:places/user-trash",
              appSource: AppSource.COMMAND_PALETTE,
            });
          }
        },
      },
      {
        title: "Toggle Transparent UI",
        subtitle: "Switch between glass and solid window backgrounds",
        tag: "action",
        icon: "papirus:apps/wine",
        execute: () => {
          const next = os.storage.get(StorageKeys.transparentUI) !== "true";
          os.storage.set(StorageKeys.transparentUI, String(next));
          document.documentElement.classList.toggle("transparent-ui", next);
          os.notify.send("Transparent UI", next ? "Enabled" : "Disabled", {
            type: "success",
            duration: 3000,
            icon: "papirus:apps/wine",
            appSource: AppSource.COMMAND_PALETTE,
          });
        },
      },
    ];

    const allActions = [...actions, ...this.getSettingsEntries()];
    let items = !search
      ? [...allActions]
      : allActions.filter((a) => a.title.toLowerCase().includes(search));

    if (search.startsWith(">") || this.isTerminalCommand(search)) {
      const cleanCmd = search.startsWith(">") ? search.slice(1).trim() : search;
      if (cleanCmd) {
        items.push({
          title: `Run command: ${cleanCmd}`,
          subtitle: "Launch Terminal app and run command immediately",
          tag: "terminal",
          icon: "papirus:apps/utilities-terminal",
          execute: () => {
            const termApp = os.app.getInstance(ServiceKeys.TERMINAL);
            if (termApp) {
              termApp.open();
              setTimeout(() => termApp.executeCommand(cleanCmd), 250);
            }
          },
        });
      }
    }

    const calcResult = this.tryCalculate(search);
    if (calcResult) {
      items.push(calcResult);
    }

    const convResult = this.tryConvert(search);
    if (convResult) {
      items.push(convResult);
    }

    const allApps = os.app.getAllApps();
    if (allApps) {
      for (const [key, app] of Object.entries(allApps)) {
        if (!app) continue;
        const appTitle = app.title || key;

        if (
          !search ||
          appTitle.toLowerCase().includes(search) ||
          key.toLowerCase().includes(search)
        ) {
          items.push({
            title: appTitle,
            subtitle:
              app.type === "system"
                ? "Built-in System App"
                : `Game: ${app.type}`,
            tag: app.type === "system" ? "app" : "game",
            icon: app.icon || "papirus:actions/window-maximize",
            execute: () => os.app.launch(key),
          });
        }
      }
    }

    for (const file of this.cachedFiles) {
      if (
        file.name.toLowerCase().endsWith(".desktop") &&
        file.path.toLowerCase().includes("/desktop/")
      )
        continue;
      if (!search || file.name.toLowerCase().includes(search)) {
        items.push({
          title: file.name,
          subtitle: `File: ${file.path}`,
          tag: file.kind,
          icon: os.fs.getFileIcon(file.path),
          isFile: true,
          execute: () => {
            openFileWith({ name: file.name, path: os.fs.dirname(file.path) });
          },
        });
      }
    }

    if (items.length > 50) {
      items = items.slice(0, 50);
    }

    this.renderItems(items);
  }

  renderItems(items) {
    if (!this.resultsContainer) return;
    this.results = items;
    this.activeIndex = Math.min(
      this.activeIndex,
      Math.max(0, this.results.length - 1),
    );

    if (this.results.length === 0) {
      this.resultsContainer.innerHTML = `<div class="command-palette-empty">No matching commands, apps, or files found.</div>`;
      return;
    }

    this.results.forEach((item, index) => {
      const el = createElement("div");
      el.className = `command-palette-item ${index === this.activeIndex ? "active" : ""}`;
      el.dataset.index = index;

      let iconHtml = "";
      if (typeof item.icon === "string") {
        const eff = getEffectiveIcon(item.icon);
        if (typeof eff === "string" && eff.startsWith("papirus:")) {
          iconHtml = `<img src="${resolveIconUrl(eff)}" alt="">`;
        } else if (
          typeof eff === "string" &&
          (eff.startsWith("fa") ||
            eff.startsWith("fas ") ||
            eff.startsWith("fab ") ||
            eff.startsWith("far "))
        ) {
          iconHtml = `<i class="${eff}"></i>`;
        } else if (typeof eff === "string" && eff.startsWith("http")) {
          iconHtml = `<img src="${eff}" alt="">`;
        } else {
          iconHtml = `<img src="${resolveIconUrl(eff)}" alt="">`;
        }
      } else {
        const fallbackEff = getEffectiveIcon(
          "papirus:mimetypes/text-x-generic",
        );
        if (fallbackEff.startsWith("papirus:"))
          iconHtml = `<img src="${resolveIconUrl(fallbackEff)}" alt="">`;
        else iconHtml = `<i class="${fallbackEff}"></i>`;
      }

      el.innerHTML = `
        <div class="command-palette-item-icon">${iconHtml}</div>
        <div class="command-palette-item-meta">
          <div class="command-palette-item-title">${escapeHtml(item.title)}</div>
          <div class="command-palette-item-sub">${escapeHtml(item.subtitle)}</div>
        </div>
        <div class="command-palette-item-tag">${item.tag}</div>
      `;

      el.addEventListener("click", () => {
        this.activeIndex = index;
        this.executeActive();
      });

      this.resultsContainer.appendChild(el);
    });

    requestAnimationFrame(() => this.scrollToActive());
  }

  renderWallpaperSubpalette(search) {
    if (!this.resultsContainer) return;
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
        icon: "papirus:actions/go-previous",
        execute: () => {
          this.currentSubpalette = null;
          this.inputElement.value = "";
          this.activeIndex = 0;
          this.renderResults();
        },
      },
    ];

    for (const w of matches) {
      items.push({
        title: `Set wallpaper: ${w.name}`,
        subtitle: `Apply ${w.name} as the current desktop background`,
        tag: "wallpaper",
        icon: "papirus:mimetypes/image-x-generic",
        execute: () => {
          SystemUtilities.setWallpaper(w.url);
          os.notify.send(
            "Wallpaper Changed",
            `Background updated to ${w.name}`,
            {
              type: "success",
              duration: 5000,
              icon: "papirus:mimetypes/image-x-generic",
              appSource: AppSource.COMMAND_PALETTE,
            },
          );
        },
      });
    }

    this.renderItems(items);
  }

  getParticleEffectActions() {
    const activeEffect = getParticleEffect() || "none";
    return [
      {
        title: "Particles: Off",
        subtitle:
          activeEffect === "none"
            ? "Desktop particles are already disabled"
            : "Disable all falling particle effects",
        tag: "effects",
        icon: "fas fa-ban",
        execute: () => this.applyParticleEffect("none"),
      },
      ...PARTICLE_EFFECTS.map((effect) => ({
        title: `Particles: ${effect.name}`,
        subtitle:
          activeEffect === effect.id
            ? `Active. ${effect.description}`
            : effect.description,
        tag: "effects",
        icon: effect.icon,
        execute: () => this.applyParticleEffect(effect.id),
      })),
      {
        title: "Particles: Customize",
        subtitle: "Tune density, speed, size, and custom particle images",
        tag: "effects",
        icon: "fas fa-sliders-h",
        execute: () => os.app.launch("wallpaperEngineApp"),
      },
    ];
  }

  applyParticleEffect(effectId) {
    setParticleEffect(effectId);
  }

  renderFileSearchSubpalette(search) {
    if (!this.resultsContainer) return;
    const items = [
      {
        title: ".. Back to Main Menu",
        subtitle: "Return to the main command palette search list",
        tag: "nav",
        icon: "papirus:actions/go-previous",
        execute: () => {
          this.currentSubpalette = null;
          this.inputElement.value = "";
          this.activeIndex = 0;
          this.renderResults();
        },
      },
    ];

    if (!search) {
      const count = this.cachedFiles.length;
      items.push({
        title: `${count} file${count !== 1 ? "s" : ""} indexed`,
        subtitle: "Type a filename to search across the filesystem",
        tag: "info",
        icon: "papirus:actions/help-about",
        execute: () => {},
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
              openFileWith({ name: file.name, path: os.fs.dirname(file.path) });
            },
          });
        }
      }
    }

    if (items.length === 1) {
      items.push({
        title: "No matching files found",
        subtitle: "Try a different search term",
        tag: "info",
        icon: "papirus:actions/dialog-warning",
        execute: () => {},
      });
    }

    this.renderItems(items);
  }

  getSettingsEntries() {
    const go = (section, target) => {
      launchSettingsPane(section, target);
    };
    const entries = SETTINGS_CATEGORIES.filter((cat) => cat.id !== "steam").map(
      (cat) => ({
        title: `Settings: ${cat.title}`,
        subtitle: `Open the ${cat.title} settings panel`,
        tag: "settings",
        icon: cat.icon,
        execute: () => launchSettingsPane(cat.pane),
      }),
    );
    entries.push(
      {
        title: "Settings: Performance Mode",
        subtitle: "Switch between Quality, Balanced, and Performance",
        tag: "settings",
        icon: "papirus:apps/utilities-system-monitor",
        execute: () => go("pane-general", "sc-general"),
      },
      {
        title: "Settings: Skip Boot Screen",
        subtitle: "Bypass login screen on startup",
        tag: "settings",
        icon: "papirus:actions/go-next",
        execute: () => go("pane-system", "sc-boot"),
      },
      {
        title: "Settings: Notifications",
        subtitle: "DND, position, duration, animation",
        tag: "settings",
        icon: "papirus:apps/preferences-desktop-notification-bell",
        execute: () => go("pane-notifications", "settingsDND"),
      },
      {
        title: "Settings: Taskbar Position",
        subtitle: "Dock taskbar to bottom, top, left, or right",
        tag: "settings",
        icon: "papirus:actions/transform-move",
        execute: () => go("pane-desktop", "sc-layout"),
      },
      {
        title: "Settings: Desktop Icon Size",
        subtitle: "Adjust desktop icon dimensions",
        tag: "settings",
        icon: "papirus:actions/view-fullscreen",
        execute: () => go("pane-desktop", "settingsDesktopIconSize"),
      },
      {
        title: "Settings: Start Menu Size",
        subtitle: "Adjust start menu width and height",
        tag: "settings",
        icon: "papirus:actions/view-list",
        execute: () => go("pane-desktop", "settingsStartMenuWidth"),
      },
      {
        title: "Settings: Show Workspaces",
        subtitle: "Toggle workspace area in taskbar",
        tag: "settings",
        icon: "papirus:actions/view-grid",
        execute: () => go("pane-desktop", "settingsShowWorkspace"),
      },
      {
        title: "Settings: GUI Scale",
        subtitle: "Scale the entire interface",
        tag: "settings",
        icon: "papirus:actions/view-fullscreen",
        execute: () => go("pane-appearance", "settingsGuiScale"),
      },
      {
        title: "Settings: Font Size",
        subtitle: "Adjust base font size",
        tag: "settings",
        icon: "papirus:mimetypes/application-x-font-ttf",
        execute: () => go("pane-appearance", "settingsFontSize"),
      },
      {
        title: "Settings: Font Family",
        subtitle: "Choose Open Sans, Inter, Rubik, or more",
        tag: "settings",
        icon: "papirus:actions/dialog-xml-editor",
        execute: () => go("pane-appearance", "sc-style"),
      },
      {
        title: "Settings: Window Animations",
        subtitle: "Open, close, minimize effects and speed",
        tag: "settings",
        icon: "papirus:mimetypes/video-x-generic",
        execute: () => go("pane-appearance", "settingsOpenAnimation"),
      },
      {
        title: "Settings: Custom Cursor",
        subtitle: "Upload or clear a custom cursor",
        tag: "settings",
        icon: "papirus:devices/input-mouse",
        execute: () => go("pane-appearance", "settingsCursorUploadBtn"),
      },
      {
        title: "Settings: Wallpaper",
        subtitle: "Cycle on start, upload custom wallpaper",
        tag: "settings",
        icon: "papirus:mimetypes/image-x-generic",
        execute: () => go("pane-appearance", "settings-wallpaper-card"),
      },
      {
        title: "Settings: CDN Mirror",
        subtitle: "Choose a mirror for fetching game assets",
        tag: "settings",
        icon: "papirus:devices/network-server",
        execute: () => go("pane-network", "settingsCdnMirror"),
      },
      {
        title: "Settings: WISP Server",
        subtitle: "Configure Scramjet proxy server",
        tag: "settings",
        icon: "papirus:actions/object-locked",
        execute: () => go("pane-network", "settingsWispServer"),
      },
      {
        title: "Settings: Master Volume",
        subtitle: "Adjust global volume level",
        tag: "settings",
        icon: "papirus:status/audio-volume-high",
        execute: () => go("pane-audio", "settingsMasterVolume"),
      },
      {
        title: "Settings: Export Data",
        subtitle: "Backup system settings and files",
        tag: "settings",
        icon: "papirus:actions/document-export",
        execute: () => go("pane-data", "btnExportData"),
      },
    );
    return entries;
  }

  isTerminalCommand(str) {
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
      "curl",
    ];
    const firstWord = str.split(" ")[0];
    return list.includes(firstWord);
  }

  tryCalculate(search) {
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
      const result = this.safeEval(expr);
      if (result === null || result === undefined || !isFinite(result))
        return null;
      return {
        title: `= ${Number.isInteger(result) ? result : parseFloat(result.toFixed(6))}`,
        subtitle: `Result of ${search}`,
        tag: "calc",
        icon: "papirus:apps/accessories-calculator",
        execute: () => {
          var text = result.toString();
          os.app.setClipboardContent(text);
          navigator.clipboard.writeText(text);
        },
      };
    } catch {
      return null;
    }
  }

  safeEval(expr) {
    const ops = {
      "+": (a, b) => a + b,
      "-": (a, b) => a - b,
      "*": (a, b) => a * b,
      "/": (a, b) => a / b,
      "^": (a, b) => Math.pow(a, b),
      "%": (a, b) => a % b,
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
      ceil: Math.ceil,
    };
    const consts = { pi: Math.PI, e: Math.E };
    let pos = 0;
    const parse = (minPrec = 0) => {
      let left = parsePrimary();
      while (pos < expr.length) {
        const op = expr[pos];
        const prec =
          { "+": 1, "-": 1, "*": 2, "/": 2, "^": 3, "%": 2 }[op] || 0;
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
    if (pos < expr.length)
      throw new Error("unexpected trailing: " + expr.slice(pos));
    return result;
  }

  tryConvert(search) {
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
      "megabytes->gigabytes": (v) => v / 1024,
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
      icon: "papirus:actions/swap-panels",
      execute: () => {
        var text = result.toString();
        os.app.setClipboardContent(text);
        navigator.clipboard.writeText(text);
      },
    };
  }

  setSystemTheme(val) {
    os.storage.set(StorageKeys.theme, val);
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const effective = val === "auto" ? (prefersDark ? "dark" : "light") : val;
    animateThemeChange(() => {
      document.documentElement.setAttribute("data-theme", effective);
    });
    os.events.emit(BusEvents.SETTINGS_CHANGED, { key: "theme", value: val });
    os.notify.send("Theme Changed", `Theme: ${val}`, {
      type: "success",
      duration: 3000,
      icon: "papirus:apps/com.github.cassidyjames.palette",
      appSource: AppSource.COMMAND_PALETTE,
    });
  }

  toggleSound(val) {
    os.storage.set(StorageKeys.soundEnabled, val ? "true" : "false");
    os.events.emit(BusEvents.SETTINGS_CHANGED, {
      key: "soundEnabled",
      value: val ? "true" : "false",
    });
    os.notify.send("Sound", val ? "On" : "Off", {
      type: "info",
      duration: 2500,
      icon: "papirus:status/audio-volume-high",
    });
  }

  toggleDND(val) {
    os.storage.set(StorageKeys.dndKey, val ? "true" : "false");
    os.notify.send("Do Not Disturb", val ? "On" : "Off", {
      type: "info",
      duration: 2500,
      icon: "papirus:status/audio-volume-muted",
      appSource: AppSource.COMMAND_PALETTE,
    });
  }

  closeAllWindows() {
    os.window.closeAll();
    os.notify.send("Close Windows", "All windows closed", {
      type: "success",
      duration: 3000,
      icon: "papirus:actions/window-close",
      appSource: AppSource.COMMAND_PALETTE,
    });
  }

  minimizeAllWindows() {
    const wins = $$(".window");
    wins.forEach((win) => os.window.minimize(win));
  }

  toggleFullscreen() {
    const active = $(".window.active");
    if (active) os.window.maximize(active);
  }

  toggleWorkspaceOverview() {
    const ws = os.window.wm?.workspaceManager;
    if (ws) ws.toggleOverview();
  }

  switchWorkspace(index) {
    const ws = os.window.wm?.workspaceManager;
    if (ws && ws.workspaces[index]) ws.switchTo(ws.workspaces[index].id);
  }

  updateActiveSelection() {
    const container = this.resultsContainer;
    if (!container) return;
    const items = container.querySelectorAll(".command-palette-item");
    items.forEach((item) => {
      const idx = parseInt(item.dataset.index);
      item.classList.toggle("active", idx === this.activeIndex);
    });
    this.scrollToActive();
  }

  scrollToActive() {
    const container = this.resultsContainer;
    if (!container) return;
    const activeEl = container.querySelector(".command-palette-item.active");
    if (!activeEl) return;
    const body = container.parentElement;
    if (!body) return;
    const activeTop = activeEl.offsetTop;
    const activeBottom = activeTop + activeEl.offsetHeight;
    const parentTop = body.scrollTop;
    const parentBottom = parentTop + body.offsetHeight;

    if (activeTop < parentTop) {
      body.scrollTop = activeTop;
    } else if (activeBottom > parentBottom) {
      body.scrollTop = activeBottom - body.offsetHeight;
    }
  }

  executeActive() {
    const activeItem = this.results[this.activeIndex];
    if (activeItem) {
      playSfx(SystemSfx.MENU_COMMAND);
      activeItem.execute();
      if (
        activeItem.tag !== "nav" &&
        this.currentSubpalette !== "wallpaper" &&
        !activeItem.keepOpen
      ) {
        this.close();
      }
    }
  }
}
