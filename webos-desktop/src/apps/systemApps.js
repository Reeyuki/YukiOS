import "../styles/systemApps.css";
import { BaseApp, os, StorageKeys } from "../framework.js";
import { getAppRegistry } from "../appRegistry.js";
import { showContextMenu } from "../shared/contextMenu.js";
import { $, toggleClass } from "../shared/domUtils.js";
import { isFontAwesomeIcon, resolveIconHtml } from "../shared/iconUtils.js";
import {
  isAppPinnedToTaskbar,
  toggleTaskbarPin,
  showAppProperties,
  addAppToDesktop,
  isAppOnDesktop
} from "../shared/appContextActions.js";

export class SystemAppsApp extends BaseApp {
  constructor(services) {
    super(services);
  }

  open() {
    const existingWin = $("#system-apps-win");
    if (existingWin) {
      os.window.focus("system-apps-win");
      return existingWin;
    }
    const win = os.window.create("system-apps-win", "Apps", "800px", "600px", {
      icon: "fas fa-screwdriver-wrench",
      appId: "systemAppsApp"
    });
    win.innerHTML = `
      <div class="window-content system-apps-window">
        <div style="padding:16px;display:flex;flex-direction:column;gap:12px;height:100%;box-sizing:border-box;">
          <input
            type="text"
            class="games-search-input"
            id="system-apps-search"
            placeholder="Search apps..."
            autocomplete="off"
          />
          <div class="system-apps-section" id="system-apps-section-native">
            <div class="system-apps-section-header"><i class="fas fa-chevron-right sa-collapse-icon"></i><span>System</span></div>
            <div class="games-app-grid" id="system-apps-grid-native"></div>
          </div>
          <div class="system-apps-section" id="system-apps-section-web">
            <div class="system-apps-section-header"><i class="fas fa-chevron-right sa-collapse-icon"></i><span>Web Apps</span></div>
            <div class="games-app-grid" id="system-apps-grid-web"></div>
          </div>
          <div class="system-apps-section" id="system-apps-section-uninstalled">
            <div class="system-apps-section-header"><i class="fas fa-chevron-right sa-collapse-icon"></i><span>Uninstalled</span></div>
            <div class="games-app-grid" id="system-apps-grid-uninstalled"></div>
          </div>
          <div class="games-no-results" id="system-apps-empty" style="display:none;">No apps found</div>
        </div>
      </div>
    `;
    this.collapsedSections = os.storage.get(StorageKeys.systemAppsCollapsed) || {};
    this.bindSectionToggles(win);
    this.renderApps(win);
    return win;
  }

  bindSectionToggles(win) {
    const keys = ["native", "web", "uninstalled"];
    keys.forEach((key) => {
      const header = $(".system-apps-section-header", $(`#system-apps-section-${key}`, win));
      if (header) header.addEventListener("click", () => this.toggleSection(key));
      this.applySectionState(key);
    });
  }

  toggleSection(sectionKey) {
    const collapsed = this.collapsedSections[sectionKey];
    this.collapsedSections[sectionKey] = !collapsed;
    os.storage.set(StorageKeys.systemAppsCollapsed, this.collapsedSections);
    this.applySectionState(sectionKey);
  }

  applySectionState(sectionKey) {
    const section = $(`#system-apps-section-${sectionKey}`);
    const grid = $(`#system-apps-grid-${sectionKey}`, section);
    if (!section || !grid) return;
    const collapsed = this.collapsedSections[sectionKey];
    toggleClass(section, "is-collapsed", !!collapsed);
    grid.style.display = collapsed ? "none" : "";
  }

  renderApps(win) {
    const appMap = this.os.app.getAllApps();
    if (!appMap || Object.keys(appMap).length === 0) return;

    const appRegistry = getAppRegistry();
    appRegistry.refresh();

    const allApps = Object.entries(appMap)
      .filter(([id, data]) => data.type === "system" && data.icon && data.title)
      .map(([id, data]) => ({
        id,
        ...data,
        disabled: appRegistry.isAppDisabled(id),
        uninstalled: appRegistry.isAppUninstalled(id)
      }));

    const sortByIcon = (arr) => {
      return [...arr.filter((a) => !isFontAwesomeIcon(a.icon)), ...arr.filter((a) => isFontAwesomeIcon(a.icon))];
    };

    const installed = sortByIcon(allApps.filter((a) => !a.uninstalled));
    const uninstalled = sortByIcon(allApps.filter((a) => a.uninstalled));

    this.nativeApps = installed.filter((a) => !a.targetUrl || a.id === "discordApp");
    this.webApps = installed.filter((a) => a.targetUrl && a.id !== "discordApp");
    this.uninstalledApps = uninstalled;
    this.query = "";
    this.renderGrid(this.query);

    const searchInput = win.querySelector("#system-apps-search");
    if (searchInput && !searchInput.saBound) {
      searchInput.saBound = true;
      searchInput.addEventListener("input", (e) => {
        this.query = e.target.value;
        this.renderGrid(this.query);
      });
    }
  }

  appDisplayName(app) {
    return getAppRegistry().getAppDisplayName(app.id, app.title);
  }

  renderGrid(query) {
    const sectionNative = $("#system-apps-section-native");
    const sectionWeb = $("#system-apps-section-web");
    const sectionUninstalled = $("#system-apps-section-uninstalled");
    const containerNative = $("#system-apps-win #system-apps-grid-native");
    const containerWeb = $("#system-apps-win #system-apps-grid-web");
    const containerUninstalled = $("#system-apps-win #system-apps-grid-uninstalled");
    const emptyEl = $("#system-apps-win #system-apps-empty");
    if (!containerNative || !containerWeb || !containerUninstalled) return;

    const q = (query || "").toLowerCase();
    const allApps = [...(this.nativeApps || []), ...(this.webApps || []), ...(this.uninstalledApps || [])];
    const nativeFiltered = q
      ? allApps.filter(
          (a) => !a.uninstalled && a.title.toLowerCase().includes(q) && (!a.targetUrl || a.id === "discordApp")
        )
      : this.nativeApps;
    const webFiltered = q
      ? allApps.filter(
          (a) => !a.uninstalled && a.title.toLowerCase().includes(q) && a.targetUrl && a.id !== "discordApp"
        )
      : this.webApps;
    const uninstalledFiltered = q
      ? allApps.filter((a) => a.uninstalled && a.title.toLowerCase().includes(q))
      : this.uninstalledApps;

    const total = (nativeFiltered || []).length + (webFiltered || []).length + (uninstalledFiltered || []).length;
    if (total === 0) {
      containerNative.innerHTML = "";
      containerWeb.innerHTML = "";
      containerUninstalled.innerHTML = "";
      if (sectionNative) sectionNative.style.display = "none";
      if (sectionWeb) sectionWeb.style.display = "none";
      if (sectionUninstalled) sectionUninstalled.style.display = "none";
      if (emptyEl) emptyEl.style.display = "block";
      return;
    }

    if (emptyEl) emptyEl.style.display = "none";

    this.renderSection(containerNative, nativeFiltered, sectionNative);
    this.renderSection(containerWeb, webFiltered, sectionWeb);
    this.renderSection(containerUninstalled, uninstalledFiltered, sectionUninstalled);
  }

  showCardContextMenu(e, app) {
    e.preventDefault();
    e.stopPropagation();
    const registry = getAppRegistry();
    const displayName = registry.getAppDisplayName(app.id, app.title);
    const isRenamed = Boolean(registry.renamedApps[app.id]);
    const pinned = isAppPinnedToTaskbar(app.id);
    const isUninstalled = app.uninstalled;
    const isDisabled = app.disabled;

    if (isUninstalled) {
      showContextMenu(
        e,
        [
          { id: `sa-restore-${app.id}`, label: "Restore", action: "restore", icon: "fa-undo" },
          "hr",
          { id: `sa-rename-${app.id}`, label: "Edit Name", action: "rename", icon: "fas fa-pen-to-square" },
          {
            id: `sa-reset-${app.id}`,
            label: "Reset Name",
            action: "resetName",
            icon: "fas fa-undo",
            condition: () => isRenamed
          }
        ],
        {
          restore: () => this.handleRestore(app),
          rename: async () => {
            const newName = await os.dialog.prompt("Rename App", `Enter a new name for "${displayName}":`, displayName);
            if (newName !== null && newName.trim() !== "" && newName.trim() !== displayName) {
              registry.setAppName(app.id, newName.trim());
              this.renderGrid(this.query);
              this.notify("Apps", `"${displayName}" is now "${newName.trim()}"`, "success");
            }
          },
          resetName: () => {
            registry.resetAppName(app.id);
            this.renderGrid(this.query);
            this.notify("Apps", `"${displayName}" name reset to "${app.title}"`, "success");
          }
        }
      );
      return;
    }

    showContextMenu(
      e,
      [
        { id: `sa-launch-${app.id}`, label: "Launch", action: "launch", icon: "fa-play" },
        "hr",
        {
          id: `sa-pin-${app.id}`,
          label: pinned ? "Unpin from Taskbar" : "Pin to Taskbar",
          action: "pin",
          icon: "fas fa-thumbtack"
        },
        { id: `sa-desktop-${app.id}`, label: "Add to Desktop", action: "addToDesktop", icon: "fas fa-desktop" },
        "hr",
        { id: `sa-properties-${app.id}`, label: "Properties", action: "properties", icon: "fas fa-info-circle" },
        "hr",
        { id: `sa-rename-${app.id}`, label: "Edit Name", action: "rename", icon: "fas fa-pen-to-square" },
        {
          id: `sa-reset-${app.id}`,
          label: "Reset Name",
          action: "resetName",
          icon: "fas fa-undo",
          condition: () => isRenamed
        },
        {
          id: `sa-toggle-${app.id}`,
          label: isDisabled ? "Enable" : "Disable",
          action: "toggle",
          icon: "fas fa-toggle-on",
          condition: () => !registry.isProtected(app.id)
        },
        "hr",
        {
          id: `sa-uninstall-${app.id}`,
          label: "Uninstall",
          action: "uninstall",
          icon: "fas fa-trash-can",
          condition: () => !registry.isProtected(app.id)
        }
      ],
      {
        launch: () => os.app.launch(app.id),
        pin: () => toggleTaskbarPin(app.id, app),
        addToDesktop: async () => {
          if (await isAppOnDesktop(app.id)) {
            os.notify.send("Already on Desktop", `${app.title} is already on your desktop.`);
            return;
          }
          await addAppToDesktop(app.id, app);
          os.notify.send("Added to Desktop", `${app.title} is now on your desktop.`);
        },
        properties: () => showAppProperties(app.id, app),
        rename: async () => {
          const newName = await os.dialog.prompt("Rename App", `Enter a new name for "${displayName}":`, displayName);
          if (newName !== null && newName.trim() !== "" && newName.trim() !== displayName) {
            registry.setAppName(app.id, newName.trim());
            this.renderGrid(this.query);
            this.notify("Apps", `"${displayName}" is now "${newName.trim()}"`, "success");
          }
        },
        resetName: () => {
          registry.resetAppName(app.id);
          this.renderGrid(this.query);
          this.notify("Apps", `"${displayName}" name reset to "${app.title}"`, "success");
        },
        toggle: () => {
          if (registry.setAppDisabled(app.id, !app.disabled)) {
            this.renderGrid(this.query);
            this.notify("Apps", `"${displayName}" ${isDisabled ? "enabled" : "disabled"}.`, "success");
          }
        },
        uninstall: async () => {
          const confirmed = await os.dialog.confirm(
            "Uninstall App",
            `Are you sure you want to uninstall ${app.title}? You can restore it later.`
          );
          if (confirmed) {
            if (registry.uninstallApp(app.id)) {
              this.renderGrid(this.query);
              this.notify("Apps", `${app.title} uninstalled.`, "info");
            }
          }
        }
      }
    );
  }

  renderSection(container, items, sectionEl) {
    if (items.length === 0) {
      container.innerHTML = "";
      if (sectionEl) sectionEl.style.display = "none";
      return;
    }

    if (sectionEl) sectionEl.style.display = "";

    container.innerHTML = items
      .map((app) => {
        const icon = app.icon || "";
        const iconHtml = resolveIconHtml(icon, { faClass: "icon", faStyle: "color:var(--brand);", alt: app.title });
        const dimClass = app.uninstalled ? "is-uninstalled" : app.disabled ? "is-disabled" : "";
        return `
          <div class="games-app-card ${dimClass}" data-app="${app.id}">
            <div class="games-app-card-img-wrap">${iconHtml}</div>
            <div class="games-app-card-title">${this.appDisplayName(app)}</div>
          </div>
        `;
      })
      .join("");

    container.querySelectorAll(".games-app-card").forEach((card) => {
      card.addEventListener("dblclick", () => {
        const appId = card.dataset.app;
        const app = this.findApp(appId);
        if (!app) return;
        if (app.uninstalled) this.handleRestore(app);
        else os.app.launch(appId);
      });
      card.addEventListener("contextmenu", (e) => {
        const appId = card.dataset.app;
        const app = this.findApp(appId);
        if (app) this.showCardContextMenu(e, app);
      });
    });
  }

  findApp(appId) {
    return [...(this.nativeApps || []), ...(this.webApps || []), ...(this.uninstalledApps || [])].find(
      (a) => a.id === appId
    );
  }

  handleRestore(app) {
    getAppRegistry().restoreApp(app.id);
    this.renderGrid(this.query);
    this.notify("Apps", `"${this.appDisplayName(app)}" restored.`, "success");
  }

  onClose(winId) {}
}
