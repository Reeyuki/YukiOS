import { appMap } from "../games/gamesList.js";
import { APP_DESCRIPTIONS, descriptionMap } from "../games/gameDescriptions.js";
import { resolveIconUrl } from "../shared/assetResolver.js";
import { getAppRegistry } from "../appRegistry.js";
import { SETTINGS_CATEGORIES, launchSettingsPane } from "../settings/settingsNav.js";
import { StorageKeys, os } from "../framework.js";
import { KeybindManager } from "../keybindManager.js";
import { $, createElement, setStyle, setText, addClass, removeClass } from "../shared/domUtils.js";
import { modeManager, MODES } from "../modeManager.js";
import { showContextMenu } from "../shared/contextMenu.js";

const SEARCH_DEBOUNCE = 150;

export class Launcher {
  constructor() {
    this.el = null;
    this.searchInput = null;
    this.gridContainer = null;
    this.isOpen = false;
    this.searchDebounceTimer = null;
    this.keyboardHandler = null;
    this.boundClickOutside = this.handleClickOutside.bind(this);
    this.boundModeChanged = this.onModeChanged.bind(this);
    this.domCreated = false;
    this.shelf = null;
  }

  setShelf(shelf) {
    this.shelf = shelf;
  }

  init() {
    this.bindGlobalEvents();
    os.events.on("MODE_ENTERED", this.boundModeChanged);
    os.events.on("MODE_EXITED", this.boundModeChanged);
  }

  destroy() {
    this.close();
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
    document.removeEventListener("click", this.boundClickOutside);
    if (this.keyboardHandler) {
      document.removeEventListener("keydown", this.keyboardHandler);
      this.keyboardHandler = null;
    }
    os.events.off("MODE_ENTERED", this.boundModeChanged);
    os.events.off("MODE_EXITED", this.boundModeChanged);
  }

  onModeChanged({ id }) {
    if (id === MODES.CHROME_OS && !modeManager.isActive(MODES.CHROME_OS)) {
      this.close();
    }
  }

  createDOM() {
    this.el = createElement("div", { id: "chromeos-launcher" });
    const logoUrl = resolveIconUrl("/static/icons/logo.png");
    this.el.innerHTML = `
      <div class="launcher-overlay">
        <div class="launcher-container">
          <div class="launcher-search-wrapper">
            <img src="${logoUrl}" class="launcher-search-icon" alt="Logo" />
            <input type="text" class="launcher-search-input" placeholder="Search apps..." />
          </div>
          <div class="launcher-grid"></div>
        </div>
      </div>
    `;
    document.body.appendChild(this.el);
    this.searchInput = this.el.querySelector(".launcher-search-input");
    this.gridContainer = this.el.querySelector(".launcher-grid");
    this.bindDOMEvents();
  }

  bindGlobalEvents() {
    this.keyboardHandler = (e) => {
      if (KeybindManager.matches(e, "chromeos.launcher")) {
        e.preventDefault();
        if (modeManager.isActive(MODES.CHROME_OS)) {
          this.toggle();
        }
        return;
      }
      if (!this.isOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        this.close();
      }
    };
    document.addEventListener("keydown", this.keyboardHandler);
  }

  bindDOMEvents() {
    this.searchInput.addEventListener("input", (e) => this.handleSearch(e));
    this.searchInput.addEventListener("keydown", (e) => this.handleSearchKeybind(e));
    document.addEventListener("click", this.boundClickOutside);
  }

  handleClickOutside(e) {
    if (!this.isOpen) return;
    if (!this.el.contains(e.target)) {
      this.close();
    }
  }

  handleSearchKeybind(e) {
    if (e.key === "Enter") {
      const firstItem = this.gridContainer.querySelector(".launcher-app-item");
      if (firstItem) {
        firstItem.click();
      }
    }
  }

  handleSearch(e) {
    clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => {
      const query = e.target.value.toLowerCase().trim();
      const items = this.gridContainer.querySelectorAll(".launcher-app-item");
      items.forEach((item) => {
        const appId = item.dataset.appId;
        const title = item.querySelector(".launcher-app-label")?.textContent?.toLowerCase() || "";
        const match = this.fuzzyMatch(query, title);
        item.style.display = match ? "flex" : "none";
      });
    }, SEARCH_DEBOUNCE);
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    if (!modeManager.isActive(MODES.CHROME_OS)) return;
    if (!this.domCreated) {
      this.createDOM();
      this.domCreated = true;
    }
    this.isOpen = true;
    this.el.style.display = "flex";
    requestAnimationFrame(() => {
      this.el.classList.add("open");
    });
    this.searchInput.value = "";
    this.searchInput.focus();
    if (this.gridContainer.children.length === 0) {
      this.renderApps("");
    }
  }

  close() {
    this.isOpen = false;
    if (this.el) {
      this.el.classList.remove("open");
      setTimeout(() => {
        if (!this.isOpen) this.el.style.display = "none";
      }, 250);
    }
  }

  fuzzyMatch(query, target) {
    const q = query.toLowerCase().trim();
    const t = target.toLowerCase().trim();
    if (!q) return true;
    if (t.includes(q)) return true;
    const qWords = q.split(/\s+/);
    const tWords = t.split(/\s+/);
    for (let i = 0; i < qWords.length; i++) {
      const qw = qWords[i];
      let matched = false;
      for (let j = 0; j < tWords.length; j++) {
        const tw = tWords[j];
        if (tw === qw || tw.startsWith(qw)) {
          matched = true;
          break;
        }
      }
      if (!matched) return false;
    }
    return true;
  }

  renderApps(query) {
    this.gridContainer.innerHTML = "";

    const appRegistry = getAppRegistry();
    const allApps = os.app.getAllApps();
    const results = [];

    const allGameEntries = Object.entries(appMap).filter(([appId, appData]) => appData.type === "game");
    const allGameIds = new Set(allGameEntries.map(([appId]) => appId));
    const gameEntries = allGameEntries.slice(0, 30);

    const addAppResult = (appId, appData) => {
      if (appRegistry.isAppUninstalled(appId) || appRegistry.isAppDisabled(appId)) {
        return;
      }

      const title = (appData.title || appId).toLowerCase();
      const description = (APP_DESCRIPTIONS[appId] || descriptionMap[appId] || "").toLowerCase();

      if (!this.fuzzyMatch(query, title) && !this.fuzzyMatch(query, description)) {
        return;
      }

      results.push({
        appId,
        appData,
        title: appData.title || appId
      });
    };

    gameEntries.forEach(([appId, appData]) => {
      addAppResult(appId, appData);
    });

    Object.entries(allApps).forEach(([appId, appData]) => {
      if (allGameIds.has(appId)) return;
      addAppResult(appId, appData);
    });

    SETTINGS_CATEGORIES.forEach((cat) => {
      const title = `Settings: ${cat.title}`;

      if (this.fuzzyMatch(query, title.toLowerCase())) {
        const appId = `settings-${cat.id}`;

        if (!results.find((r) => r.appId === appId)) {
          results.push({
            appId,
            appData: {
              title,
              icon: cat.icon,
              type: "system",
              category: "system"
            },
            title
          });
        }
      }
    });

    results.sort((a, b) => a.title.localeCompare(b.title));

    const displayResults = results;

    displayResults.forEach(({ appId, appData }) => {
      const item = this.createAppItem(appId, appData);
      this.gridContainer.appendChild(item);
    });

    if (results.length === 0) {
      const empty = createElement("div", {
        className: "launcher-empty"
      });

      empty.textContent = "No apps found";
      this.gridContainer.appendChild(empty);
    }
  }

  createAppItem(appId, appData) {
    const item = createElement("div", { className: "launcher-app-item" });
    item.dataset.appId = appId;

    const iconValue = resolveIconUrl(appData.icon || "fas fa-star");
    const iconEl = createElement("div", { className: "launcher-app-icon" });
    if (iconValue.startsWith("fa")) {
      iconEl.innerHTML = `<i class="${iconValue}"></i>`;
    } else {
      const img = createElement("img", { attributes: { src: iconValue, alt: appData.title } });
      iconEl.appendChild(img);
    }
    item.appendChild(iconEl);

    const label = createElement("div", { className: "launcher-app-label" });
    const appRegistry = getAppRegistry();
    label.textContent = appRegistry.getAppDisplayName(appId, appData.title || appId);
    item.appendChild(label);

    item.addEventListener("click", () => {
      if (appId.startsWith("settings-")) {
        const key = appId.replace("settings-", "");
        const cat = SETTINGS_CATEGORIES.find((c) => c.id === key);
        launchSettingsPane(cat ? cat.pane : key);
      } else {
        os.app.launch(appId).catch(() => {});
      }
      this.close();
    });

    item.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isSettings = appId.startsWith("settings-");
      const isPinned = this.shelf && this.shelf.isPinned(appId);
      const isProtected = appRegistry.isProtected(appId);

      const items = [{ id: "ctx-open", label: "Open", action: "open", icon: "fa-play" }, "hr"];

      if (!isSettings && this.shelf) {
        items.push({
          id: "ctx-pin",
          label: isPinned ? "Unpin from taskbar" : "Pin to taskbar",
          action: "togglePin",
          icon: isPinned ? "fa-thumbtack" : "fa-plus"
        });
        items.push("hr");
      }

      items.push({
        id: "ctx-rename",
        label: "Rename",
        action: "rename",
        icon: "fa-pen"
      });

      if (!isSettings && !isProtected) {
        items.push({
          id: "ctx-delete",
          label: "Delete",
          action: "delete",
          icon: "fa-trash"
        });
      }

      showContextMenu(e, items, {
        open: () => {
          if (isSettings) {
            const key = appId.replace("settings-", "");
            const cat = SETTINGS_CATEGORIES.find((c) => c.id === key);
            launchSettingsPane(cat ? cat.pane : key);
          } else {
            os.app.launch(appId).catch(() => {});
          }
          this.close();
        },
        togglePin: () => {
          if (!this.shelf) return;
          if (isPinned) {
            this.shelf.unpinApp(appId);
          } else {
            this.shelf.pinApp(appId, appData.title || appId, appData.icon || "fas fa-star");
          }
        },
        rename: async () => {
          const current = appRegistry.getAppDisplayName(appId, appData.title || appId);
          const newName = await os.dialog.prompt("Rename", "Enter a new name:", current);
          if (newName && newName.trim()) {
            appRegistry.setAppName(appId, newName.trim());
            label.textContent = newName.trim();
          }
        },
        delete: async () => {
          const confirmed = await os.dialog.confirm("Delete", `Delete "${appData.title || appId}"?`);
          if (confirmed) {
            appRegistry.uninstallApp(appId);
            item.remove();
          }
        }
      });
    });

    return item;
  }
}

let launcherInstance = null;

export function getLauncher() {
  if (!launcherInstance) {
    launcherInstance = new Launcher();
  }
  return launcherInstance;
}

export function initLauncher() {
  getLauncher().init();
}

export function destroyLauncher() {
  if (launcherInstance) {
    launcherInstance.destroy();
    launcherInstance = null;
  }
}
