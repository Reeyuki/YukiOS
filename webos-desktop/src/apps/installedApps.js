import "../styles/installedApps.css";
import { resolveIconUrl } from "../shared/assetResolver.js";
import { getAppRegistry } from "../appRegistry.js";
import { showContextMenu } from "../shared/contextMenu.js";
import { addAppToDesktop, isAppOnDesktop } from "../shared/desktopShortcuts.js";
import { buildWindowHeader } from "../shared/windowHeader.js";

import { BaseApp, os } from "../framework.js";
export class InstalledAppsApp extends BaseApp {
  constructor(services) {
    super(services);
    this.appRegistry = getAppRegistry();
    this.instances = new Map();
  }

  createInstance(winId) {
    const inst = {
      winId,
      currentFilter: "all",
      searchQuery: "",
      apps: [],
      pageSize: 50,
      currentPage: 0,
      selectedApps: new Set()
    };
    this.instances.set(winId, inst);
    return inst;
  }

  getInstance(winId) {
    return this.instances.get(winId);
  }

  removeInstance(winId) {
    this.instances.delete(winId);
  }

  async open(options = {}) {
    const winId = "installed-apps";
    if (await this.isSingletonOpen(winId)) return;

    const inst = this.createInstance(winId);
    const win = os.window.create(winId, "Installed Apps", "900px", "650px", {
      icon: "fas fa-th-list"
    });

    win.innerHTML = this.buildHTML();

    os.window.addToTaskbar(winId, "Installed Apps", "fas fa-th-list");

    this.bindControls(win, inst);
    this.loadApps(inst);

    if (options.searchQuery) {
      inst.searchQuery = String(options.searchQuery).toLowerCase();
      const searchInput = win.querySelector("#ia-search-input");
      if (searchInput) searchInput.value = inst.searchQuery;
      this.renderApps(win, inst);
    }

    const observer = new MutationObserver(() => {
      if (!document.getElementById(winId)) {
        this.removeInstance(winId);
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  buildHTML() {
    return `
      ${buildWindowHeader("Installed Apps", "fas fa-th-list")}
      <div class="window-content" style="padding:0;flex-direction:column;">
        <div class="ia-toolbar">
          <div class="ia-search">
            <i class="fas fa-search ia-search-icon"></i>
            <input type="text" id="ia-search-input" placeholder="Search apps...">
          </div>
          <select class="ia-filter" id="ia-filter">
            <option value="all">All Apps</option>
            <option value="core">Core System</option>
            <option value="bundled">Bundled</option>
            <option value="external">External</option>
            <option value="uninstalled">Uninstalled</option>
          </select>
          <button class="ia-select-all-btn" id="ia-select-all"><i class="fas fa-check-double"></i> Select All</button>
        </div>
        <div class="ia-bulk-bar" id="ia-bulk-bar">
          <span class="ia-bulk-count" id="ia-bulk-count">0 selected</span>
          <button class="ia-bulk-btn" id="ia-bulk-toggle"><i class="fas fa-toggle-on"></i> Toggle Status</button>
          <button class="ia-bulk-btn" id="ia-bulk-restore" style="display:none;"><i class="fas fa-undo"></i> Restore</button>
          <button class="ia-bulk-btn ia-bulk-btn--danger" id="ia-bulk-uninstall"><i class="fas fa-trash-alt"></i> Uninstall</button>
          <button class="ia-bulk-btn" id="ia-bulk-clear"><i class="fas fa-times"></i> Clear</button>
        </div>
        <div class="ia-header">
          <div class="ia-header-check"></div>
          <div></div>
          <div>Name</div>
          <div>Type</div>
          <div>Status</div>
          <div>Actions</div>
        </div>
        <div class="ia-list" id="ia-list"></div>
        <div class="ia-footer">
          <span class="ia-status" id="ia-status"></span>
          <div class="ia-pagination" id="ia-pagination"></div>
        </div>
      </div>
    `;
  }

  bindControls(win, inst) {
    const searchInput = win.querySelector("#ia-search-input");
    const filterSelect = win.querySelector("#ia-filter");
    const selectAllBtn = win.querySelector("#ia-select-all");
    const bulkToggleBtn = win.querySelector("#ia-bulk-toggle");
    const bulkRestoreBtn = win.querySelector("#ia-bulk-restore");
    const bulkUninstallBtn = win.querySelector("#ia-bulk-uninstall");
    const bulkClearBtn = win.querySelector("#ia-bulk-clear");

    searchInput.addEventListener("input", (e) => {
      inst.searchQuery = e.target.value.toLowerCase();
      inst.currentPage = 0;
      this.renderApps(win, inst);
    });

    filterSelect.addEventListener("change", (e) => {
      inst.currentFilter = e.target.value;
      inst.currentPage = 0;
      this.renderApps(win, inst);
    });

    selectAllBtn.addEventListener("click", () => {
      const filtered = this.getFilteredApps(inst);

      if (inst.selectedApps.size === filtered.length) {
        inst.selectedApps.clear();
        selectAllBtn.innerHTML = '<i class="fas fa-check-double"></i> Select All';
      } else {
        filtered.forEach((app) => inst.selectedApps.add(app.id));
        selectAllBtn.innerHTML = '<i class="fas fa-check-double"></i> Deselect All';
      }

      this.updateBulkActions(win, inst);
      this.renderCurrentPage(document.getElementById(inst.winId), inst);
    });

    bulkToggleBtn.addEventListener("click", () => {
      this.handleBulkToggle(inst);
    });

    bulkRestoreBtn.addEventListener("click", () => {
      this.handleBulkRestore(inst);
    });

    bulkUninstallBtn.addEventListener("click", () => {
      this.handleBulkUninstall(inst);
    });

    bulkClearBtn.addEventListener("click", () => {
      inst.selectedApps.clear();
      this.updateBulkActions(win, inst);
      this.renderCurrentPage(document.getElementById(inst.winId), inst);
    });
  }

  getFilteredApps(inst) {
    return inst.apps.filter((app) => {
      const matchesSearch =
        app.displayName.toLowerCase().includes(inst.searchQuery) || app.id.toLowerCase().includes(inst.searchQuery);
      if (!matchesSearch) return false;
      if (inst.currentFilter === "uninstalled") return app.uninstalled;
      if (app.uninstalled) return false;
      return inst.currentFilter === "all" || app.type === inst.currentFilter;
    });
  }

  loadApps(inst) {
    const allApps = this.appRegistry.getAllApps(os.app.getAllApps());
    inst.apps = allApps;
    this.renderApps(document.getElementById(inst.winId), inst);
  }

  renderApps(win, inst) {
    const listEl = win.querySelector("#ia-list");
    const statusEl = win.querySelector("#ia-status");
    const paginationEl = win.querySelector("#ia-pagination");

    if (!listEl) return;

    const filtered = this.getFilteredApps(inst);

    inst.currentPage = 0;
    const totalPages = Math.ceil(filtered.length / inst.pageSize);

    const startIndex = inst.currentPage * inst.pageSize;
    const endIndex = Math.min(startIndex + inst.pageSize, filtered.length);
    const pageApps = filtered.slice(startIndex, endIndex);

    listEl.innerHTML = "";

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="ia-empty">
          <i class="fas fa-box-open ia-empty-icon"></i>
          <span class="ia-empty-text">
            ${inst.searchQuery ? "No apps match your search" : inst.currentFilter === "uninstalled" ? "No uninstalled apps" : "No apps installed"}
          </span>
        </div>
      `;
      statusEl.textContent = `0 apps`;
      if (paginationEl) paginationEl.style.display = "none";
      return;
    }

    pageApps.forEach((app) => {
      const appEl = this.createAppCard(app, inst);
      listEl.appendChild(appEl);
    });

    statusEl.textContent = `${filtered.length} app${filtered.length !== 1 ? "s" : ""} (${startIndex + 1}–${endIndex})`;

    if (paginationEl) {
      this.renderPagination(paginationEl, inst, totalPages, filtered.length);
    }
  }

  renderPagination(paginationEl, inst, totalPages, totalCount) {
    if (totalPages <= 1) {
      paginationEl.style.display = "none";
      return;
    }

    paginationEl.style.display = "flex";
    paginationEl.innerHTML = `
      <button class="ia-page-btn" data-action="prev" ${inst.currentPage === 0 ? "disabled" : ""}>
        <i class="fas fa-chevron-left"></i>
      </button>
      <span class="ia-page-info">${inst.currentPage + 1} / ${totalPages}</span>
      <button class="ia-page-btn" data-action="next" ${inst.currentPage >= totalPages - 1 ? "disabled" : ""}>
        <i class="fas fa-chevron-right"></i>
      </button>
    `;

    paginationEl.querySelectorAll(".ia-page-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        if (action === "prev" && inst.currentPage > 0) {
          inst.currentPage--;
          this.renderCurrentPage(document.getElementById(inst.winId), inst);
        } else if (action === "next" && inst.currentPage < totalPages - 1) {
          inst.currentPage++;
          this.renderCurrentPage(document.getElementById(inst.winId), inst);
        }
      });
    });
  }

  renderCurrentPage(win, inst) {
    const listEl = win.querySelector("#ia-list");
    const statusEl = win.querySelector("#ia-status");
    const paginationEl = win.querySelector("#ia-pagination");

    if (!listEl) return;

    const filtered = this.getFilteredApps(inst);

    const totalPages = Math.ceil(filtered.length / inst.pageSize);
    const startIndex = inst.currentPage * inst.pageSize;
    const endIndex = Math.min(startIndex + inst.pageSize, filtered.length);
    const pageApps = filtered.slice(startIndex, endIndex);

    listEl.innerHTML = "";
    pageApps.forEach((app) => {
      const appEl = this.createAppCard(app, inst);
      listEl.appendChild(appEl);
    });

    statusEl.textContent = `${filtered.length} app${filtered.length !== 1 ? "s" : ""} (${startIndex + 1}–${endIndex})`;
    this.renderPagination(paginationEl, inst, totalPages, filtered.length);
  }

  createAppCard(app, inst) {
    const card = document.createElement("div");
    card.className = "ia-card";
    card.dataset.appId = app.id;

    const iconHtml = this.getAppIcon(app);
    const isSelected = inst.selectedApps.has(app.id);

    if (isSelected) {
      card.classList.add("is-selected");
    }
    if (app.uninstalled) {
      card.classList.add("is-uninstalled");
    }

    const isUninstalled = app.uninstalled;

    card.innerHTML = `
      <div class="ia-card-check">
        <input type="checkbox" class="ia-card-checkbox" data-app="${app.id}" ${isSelected ? "checked" : ""}>
      </div>
      <div class="ia-card-icon">${iconHtml}</div>
      <div class="ia-card-info">
        <div class="ia-card-name">${app.displayName}</div>
        <div class="ia-card-id">${app.id}</div>
      </div>
      <div class="ia-card-type">${this.getTypeLabel(app.type)}</div>
      <div class="ia-card-status">
        ${
          isUninstalled
            ? `<button class="ia-restore-btn" title="Restore this app"><i class="fas fa-undo"></i> Restore</button>`
            : `<label class="ia-toggle" title="${app.disabled ? "Enable" : "Disable"}">
              <input type="checkbox" class="ia-toggle-input" ${app.disabled ? "" : "checked"} ${app.protected ? "disabled" : ""}>
              <span class="ia-toggle-track"><span class="ia-toggle-thumb"></span></span>
            </label>`
        }
      </div>
      <div class="ia-card-actions">
        <button class="ia-overflow-btn" title="More actions">
          <i class="fas fa-ellipsis-v"></i>
        </button>
      </div>
    `;

    card.addEventListener("click", (e) => {
      const target = e.target;
      if (
        target instanceof Element &&
        (target.closest(".ia-card-actions") ||
          target.closest(".ia-card-check") ||
          target.closest(".ia-toggle") ||
          target.closest(".ia-restore-btn"))
      )
        return;
      const checkbox = card.querySelector(".ia-card-checkbox");
      if (checkbox instanceof HTMLInputElement) {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event("change"));
      }
    });

    card.addEventListener("dblclick", (e) => {
      const target = e.target;
      if (
        target instanceof Element &&
        (target.closest(".ia-card-actions") ||
          target.closest(".ia-card-check") ||
          target.closest(".ia-toggle") ||
          target.closest(".ia-restore-btn"))
      )
        return;
      if (!isUninstalled) this.handleLaunch(app);
    });

    const restoreBtn = card.querySelector(".ia-restore-btn");
    if (restoreBtn) {
      restoreBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.handleRestore(app, inst);
      });
    }

    this.bindToggle(card, app, inst);
    this.bindOverflowMenu(card, app, inst);
    this.bindCheckbox(card, app, inst);

    return card;
  }

  getAppIcon(app) {
    if (app.icon) {
      const iconValue = app.icon.trim();
      if (this.isFontAwesomeIconClass(iconValue)) {
        return `<i class="${iconValue}"></i>`;
      }
      const iconUrl = resolveIconUrl(iconValue);
      if (iconUrl && !iconUrl.includes("undefined") && !iconUrl.includes("null")) {
        return `<img src="${iconUrl}">`;
      }
    }
    return `<i class="fas fa-cube"></i>`;
  }

  isFontAwesomeIconClass(iconValue) {
    if (!iconValue || iconValue.includes("/")) return false;
    return iconValue.split(/\s+/).every((part) => part.startsWith("fa"));
  }

  getTypeLabel(type) {
    const labels = {
      core: "Core System",
      bundled: "Bundled",
      external: "External"
    };
    return labels[type] || type;
  }

  bindToggle(card, app, inst) {
    const toggleInput = card.querySelector(".ia-toggle-input");
    if (!toggleInput || app.uninstalled) return;

    toggleInput.addEventListener("change", async (e) => {
      e.stopPropagation();
      if (app.protected) return;
      await this.handleToggle(app, inst);
    });
  }

  bindOverflowMenu(card, app, inst) {
    const overflowBtn = card.querySelector(".ia-overflow-btn");

    overflowBtn.addEventListener("click", (e) => {
      e.stopPropagation();

      const isUninstalled = app.uninstalled;
      let items;

      if (isUninstalled) {
        items = [
          { id: "restore-" + app.id, label: "Restore", action: "restore", icon: "fa-undo" },
          "hr",
          { id: "rename-" + app.id, label: "Edit Name", action: "rename", icon: "fa-edit" }
        ];
      } else {
        items = [
          { id: "launch-" + app.id, label: "Launch", action: "launch", icon: "fa-play" },
          { id: "addDesktop-" + app.id, label: "Add to Desktop", action: "addDesktop", icon: "fa-desktop" },
          "hr",
          { id: "rename-" + app.id, label: "Edit Name", action: "rename", icon: "fa-edit" },
          {
            id: "toggle-" + app.id,
            label: app.disabled ? "Enable" : "Disable",
            action: "toggle",
            icon: "fa-toggle-on",
            condition: () => !app.protected
          },
          "hr",
          {
            id: "uninstall-" + app.id,
            label: "Uninstall",
            action: "uninstall",
            icon: "fa-trash",
            condition: () => !app.protected
          }
        ];
      }

      showContextMenu(e, items, {
        launch: () => this.handleLaunch(app),
        addDesktop: () => this.handleAddDesktop(app),
        rename: () => this.handleRename(app, inst),
        toggle: () => this.handleToggle(app, inst),
        uninstall: () => this.handleUninstall(app, inst),
        restore: () => this.handleRestore(app, inst)
      });
    });
  }

  bindCheckbox(card, app, inst) {
    const checkbox = card.querySelector(".ia-card-checkbox");
    checkbox.addEventListener("change", (e) => {
      if (e.target.checked) {
        inst.selectedApps.add(app.id);
        card.classList.add("is-selected");
      } else {
        inst.selectedApps.delete(app.id);
        card.classList.remove("is-selected");
      }
      this.updateBulkActions(document.getElementById(inst.winId), inst);
    });
  }

  updateBulkActions(win, inst) {
    const bulkBar = win.querySelector("#ia-bulk-bar");
    const bulkCount = win.querySelector("#ia-bulk-count");
    const bulkToggleBtn = win.querySelector("#ia-bulk-toggle");
    const bulkRestoreBtn = win.querySelector("#ia-bulk-restore");
    const bulkUninstallBtn = win.querySelector("#ia-bulk-uninstall");
    const selectAllBtn = win.querySelector("#ia-select-all");

    if (!bulkBar) return;

    const count = inst.selectedApps.size;
    const showingUninstalled = inst.currentFilter === "uninstalled";

    if (count > 0) {
      bulkBar.classList.add("is-visible");
      bulkCount.textContent = `${count} selected`;
    } else {
      bulkBar.classList.remove("is-visible");
    }

    if (bulkToggleBtn) bulkToggleBtn.style.display = showingUninstalled ? "none" : "";
    if (bulkRestoreBtn) bulkRestoreBtn.style.display = showingUninstalled ? "" : "none";
    if (bulkUninstallBtn) bulkUninstallBtn.style.display = showingUninstalled ? "none" : "";

    const filtered = this.getFilteredApps(inst);

    if (selectAllBtn) {
      selectAllBtn.innerHTML =
        count === filtered.length
          ? '<i class="fas fa-check-double"></i> Deselect All'
          : '<i class="fas fa-check-double"></i> Select All';
    }
  }

  async handleRestore(app, inst) {
    this.appRegistry.restoreApp(app.id);
    this.loadApps(inst);
    this.notify("App Restored", `"${app.displayName}" has been restored`, "success", 5000, "fas fa-undo");
  }

  async handleAddDesktop(app) {
    const already = await isAppOnDesktop(app.id);
    if (already) {
      return this.notify("Add to Desktop", `${app.displayName} is already on your desktop.`);
    }
    try {
      await addAppToDesktop(app.id, app);
      this.notify("Added to Desktop", `"${app.displayName}" is now on your desktop.`, "success", 5000, "fa-desktop");
    } catch (err) {
      this.notify("Add to Desktop", "Could not add the app to your desktop.");
    }
  }

  handleLaunch(app) {
    if (!app.disabled) {
      os.app.launch(app.id);
    }
  }

  async handleBulkToggle(inst) {
    const selectedIds = Array.from(inst.selectedApps);
    let toggledCount = 0;

    for (const appId of selectedIds) {
      const app = inst.apps.find((a) => a.id === appId);
      if (app && !app.protected) {
        const success = this.appRegistry.setAppDisabled(appId, !app.disabled);
        if (success) toggledCount++;
      }
    }

    if (toggledCount > 0) {
      this.loadApps(inst);
      this.notify(
        "Apps Toggled",
        `${toggledCount} app${toggledCount !== 1 ? "s" : ""} status updated`,
        "success",
        5000,
        "fas fa-toggle-on"
      );
    }
  }

  async handleBulkRestore(inst) {
    const selectedIds = Array.from(inst.selectedApps);
    for (const appId of selectedIds) {
      this.appRegistry.restoreApp(appId);
    }
    inst.selectedApps.clear();
    this.loadApps(inst);
    this.notify(
      "Apps Restored",
      `${selectedIds.length} app${selectedIds.length !== 1 ? "s" : ""} restored`,
      "success",
      5000,
      "fas fa-undo"
    );
  }

  async handleBulkUninstall(inst) {
    const selectedIds = Array.from(inst.selectedApps);
    const confirmed = await os.dialog.confirm(
      "Bulk Uninstall",
      `Uninstall ${selectedIds.length} selected app${selectedIds.length !== 1 ? "s" : ""}? You can restore them later.`
    );

    if (confirmed) {
      let uninstalledCount = 0;

      for (const appId of selectedIds) {
        const app = inst.apps.find((a) => a.id === appId);
        if (app && !app.protected) {
          const success = this.appRegistry.uninstallApp(appId);
          if (success) uninstalledCount++;
        }
      }

      if (uninstalledCount > 0) {
        inst.selectedApps.clear();
        this.loadApps(inst);
        this.notify(
          "Apps Uninstalled",
          `${uninstalledCount} app${uninstalledCount !== 1 ? "s" : ""} uninstalled`,
          "success",
          5000,
          "fas fa-trash-alt"
        );
      }
    }
  }

  async handleRename(app, inst) {
    const newName = await os.dialog.prompt("Rename App", `Enter a new name for "${app.displayName}":`, app.displayName);

    if (newName !== null && newName.trim() !== "") {
      this.appRegistry.setAppName(app.id, newName.trim());
      this.loadApps(inst);
      this.notify("App Renamed", `"${app.displayName}" is now "${newName.trim()}"`, "success", 5000, "fas fa-edit");
    }
  }

  async handleToggle(app, inst) {
    const action = app.disabled ? "enable" : "disable";
    const success = this.appRegistry.setAppDisabled(app.id, !app.disabled);
    if (success) {
      this.loadApps(inst);
      this.notify(
        `App ${action.charAt(0).toUpperCase() + action.slice(1)}d`,
        `"${app.displayName}" has been ${action}d`,
        "success",
        5000,
        action === "enable" ? "fas fa-unlock" : "fas fa-lock"
      );
    }
  }

  async handleUninstall(app, inst) {
    const confirmed = await os.dialog.confirm(
      "Uninstall App",
      `Uninstall "${app.displayName}"? You can restore it later.`
    );

    if (confirmed) {
      const success = this.appRegistry.uninstallApp(app.id);
      if (success) {
        this.loadApps(inst);
        this.notify("App Uninstalled", `"${app.displayName}" has been uninstalled`, "success", 5000, "fas fa-trash");
      }
    }
  }

  onClose(winId) {
    this.removeInstance(winId);
  }
}
