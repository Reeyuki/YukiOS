import { BaseApp } from "../core/BaseApp.js";
import { customPrompt, customConfirm } from "../shared/dialogs.js";
import { os } from "../os/index.js";
import { resolveIconUrl } from "../shared/assetResolver.js";
import { getAppRegistry } from "../appRegistry.js";

export class InstalledAppsApp extends BaseApp {
  constructor(services) {
    super(services);
    this.appRegistry = getAppRegistry();
    this.appLauncher = null;
    this._instances = new Map();
  }

  setAppLauncher(appLauncher) {
    this.appLauncher = appLauncher;
  }

  _createInstance(winId) {
    const inst = {
      winId,
      currentFilter: "all",
      searchQuery: "",
      apps: [],
      pageSize: 50,
      currentPage: 0,
      selectedApps: new Set()
    };
    this._instances.set(winId, inst);
    return inst;
  }

  _getInstance(winId) {
    return this._instances.get(winId);
  }

  _removeInstance(winId) {
    this._instances.delete(winId);
  }

  async open(options = {}) {
    const winId = "installed-apps";
    if (await this._isSingletonOpen(winId)) return;

    const inst = this._createInstance(winId);
    const win = os.window.create(winId, "Installed Apps", "900px", "650px", {
      icon: "fas fa-th-list"
    });

    win.innerHTML = this._buildHTML();

    os.window.addToTaskbar(winId, "Installed Apps", "fas fa-th-list");

    this._bindControls(win, inst);
    this._loadApps(inst);

    const observer = new MutationObserver(() => {
      if (!document.getElementById(winId)) {
        this._removeInstance(winId);
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  _buildHTML() {
    return `
      <div class="window-header">
        <span><i class="fas fa-th-list" style="color: white;margin-right: 6px;font-size: 25px;vertical-align: middle;"></i>Installed Apps</span>
        ${os.window.getWindowControls()}
      </div>
      <div class="window-content" style="padding: 16px; gap: 16px;">
        <div class="installed-apps-toolbar">
          <input 
            type="text" 
            id="installed-apps-search" 
            placeholder="Search apps..." 
            style="flex: 1;"
          >
          <select id="installed-apps-filter">
            <option value="all">All Apps</option>
            <option value="core">Core System</option>
            <option value="bundled">Bundled</option>
            <option value="external">External</option>
          </select>
          <button class="select-all-btn" id="select-all-btn">Select All</button>
        </div>
        <div id="installed-apps-bulk-actions" class="installed-apps-bulk-actions" style="display: none;">
          <span id="selected-count">0 selected</span>
          <button class="bulk-toggle-btn" id="bulk-toggle-btn">Toggle Status</button>
          <button class="bulk-uninstall-btn" id="bulk-uninstall-btn">Uninstall Selected</button>
          <button class="bulk-clear-btn" id="bulk-clear-btn">Clear Selection</button>
        </div>
        <div id="installed-apps-list" class="installed-apps-list"></div>
        <div id="installed-apps-pagination"></div>
        <div id="installed-apps-status"></div>
      </div>
    `;
  }

  _bindControls(win, inst) {
    const searchInput = win.querySelector("#installed-apps-search");
    const filterSelect = win.querySelector("#installed-apps-filter");
    const selectAllBtn = win.querySelector("#select-all-btn");
    const bulkToggleBtn = win.querySelector("#bulk-toggle-btn");
    const bulkUninstallBtn = win.querySelector("#bulk-uninstall-btn");
    const bulkClearBtn = win.querySelector("#bulk-clear-btn");

    searchInput.addEventListener("input", (e) => {
      inst.searchQuery = e.target.value.toLowerCase();
      inst.currentPage = 0;
      this._renderApps(win, inst);
    });

    filterSelect.addEventListener("change", (e) => {
      inst.currentFilter = e.target.value;
      inst.currentPage = 0;
      this._renderApps(win, inst);
    });

    selectAllBtn.addEventListener("click", () => {
      const filtered = inst.apps.filter((app) => {
        const matchesSearch =
          app.displayName.toLowerCase().includes(inst.searchQuery) || app.id.toLowerCase().includes(inst.searchQuery);
        const matchesFilter = inst.currentFilter === "all" || app.type === inst.currentFilter;
        return matchesSearch && matchesFilter;
      });

      if (inst.selectedApps.size === filtered.length) {
        inst.selectedApps.clear();
        selectAllBtn.textContent = "Select All";
      } else {
        filtered.forEach((app) => inst.selectedApps.add(app.id));
        selectAllBtn.textContent = "Deselect All";
      }

      this._updateBulkActions(win, inst);
      this._renderCurrentPage(document.getElementById(inst.winId), inst);
    });

    bulkToggleBtn.addEventListener("click", () => {
      this._handleBulkToggle(inst);
    });

    bulkUninstallBtn.addEventListener("click", () => {
      this._handleBulkUninstall(inst);
    });

    bulkClearBtn.addEventListener("click", () => {
      inst.selectedApps.clear();
      this._updateBulkActions(win, inst);
      this._renderCurrentPage(document.getElementById(inst.winId), inst);
    });
  }

  _loadApps(inst) {
    if (!this.appLauncher) {
      console.error("AppLauncher not set");
      return;
    }

    const allApps = this.appRegistry.getAllApps(this.appLauncher.appMap);
    inst.apps = allApps.filter((app) => !app.uninstalled);
    this._renderApps(document.getElementById(inst.winId), inst);
  }

  _renderApps(win, inst) {
    const listEl = win.querySelector("#installed-apps-list");
    const statusEl = win.querySelector("#installed-apps-status");
    const paginationEl = win.querySelector("#installed-apps-pagination");

    if (!listEl) return;

    const filtered = inst.apps.filter((app) => {
      const matchesSearch =
        app.displayName.toLowerCase().includes(inst.searchQuery) || app.id.toLowerCase().includes(inst.searchQuery);
      const matchesFilter = inst.currentFilter === "all" || app.type === inst.currentFilter;
      return matchesSearch && matchesFilter;
    });

    inst.currentPage = 0;
    const totalPages = Math.ceil(filtered.length / inst.pageSize);

    const startIndex = inst.currentPage * inst.pageSize;
    const endIndex = Math.min(startIndex + inst.pageSize, filtered.length);
    const pageApps = filtered.slice(startIndex, endIndex);

    listEl.innerHTML = "";

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="installed-apps-empty">
          No apps found
        </div>
      `;
      statusEl.textContent = `0 apps`;
      if (paginationEl) paginationEl.style.display = "none";
      return;
    }

    pageApps.forEach((app) => {
      const appEl = this._createAppCard(app, inst);
      listEl.appendChild(appEl);
    });

    statusEl.textContent = `${filtered.length} app${filtered.length !== 1 ? "s" : ""} (showing ${startIndex + 1}-${endIndex})`;

    if (paginationEl) {
      this._renderPagination(paginationEl, inst, totalPages, filtered.length);
    }
  }

  _renderPagination(paginationEl, inst, totalPages, totalCount) {
    if (totalPages <= 1) {
      paginationEl.style.display = "none";
      return;
    }

    paginationEl.style.display = "flex";
    paginationEl.innerHTML = `
      <button class="pagination-btn" data-action="prev" ${inst.currentPage === 0 ? "disabled" : ""}>Previous</button>
      <span>Page ${inst.currentPage + 1} of ${totalPages}</span>
      <button class="pagination-btn" data-action="next" ${inst.currentPage >= totalPages - 1 ? "disabled" : ""}>Next</button>
    `;

    paginationEl.querySelectorAll(".pagination-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        if (action === "prev" && inst.currentPage > 0) {
          inst.currentPage--;
          this._renderCurrentPage(document.getElementById(inst.winId), inst);
        } else if (action === "next" && inst.currentPage < totalPages - 1) {
          inst.currentPage++;
          this._renderCurrentPage(document.getElementById(inst.winId), inst);
        }
      });
    });
  }

  _renderCurrentPage(win, inst) {
    const listEl = win.querySelector("#installed-apps-list");
    const statusEl = win.querySelector("#installed-apps-status");
    const paginationEl = win.querySelector("#installed-apps-pagination");

    if (!listEl) return;

    const filtered = inst.apps.filter((app) => {
      const matchesSearch =
        app.displayName.toLowerCase().includes(inst.searchQuery) || app.id.toLowerCase().includes(inst.searchQuery);
      const matchesFilter = inst.currentFilter === "all" || app.type === inst.currentFilter;
      return matchesSearch && matchesFilter;
    });

    const totalPages = Math.ceil(filtered.length / inst.pageSize);
    const startIndex = inst.currentPage * inst.pageSize;
    const endIndex = Math.min(startIndex + inst.pageSize, filtered.length);
    const pageApps = filtered.slice(startIndex, endIndex);

    listEl.innerHTML = "";
    pageApps.forEach((app) => {
      const appEl = this._createAppCard(app, inst);
      listEl.appendChild(appEl);
    });

    statusEl.textContent = `${filtered.length} app${filtered.length !== 1 ? "s" : ""} (showing ${startIndex + 1}-${endIndex})`;
    this._renderPagination(paginationEl, inst, totalPages, filtered.length);
  }

  _createAppCard(app, inst) {
    const card = document.createElement("div");
    card.className = "installed-app-card";
    card.dataset.appId = app.id;

    const iconHtml = this._getAppIcon(app);
    const isSelected = inst.selectedApps.has(app.id);

    if (isSelected) {
      card.classList.add("selected");
    }

    card.innerHTML = `
      <div class="app-checkbox">
        <input type="checkbox" class="app-select-checkbox" data-app="${app.id}" ${isSelected ? "checked" : ""}>
      </div>
      <div class="app-icon">
        ${iconHtml}
      </div>
      <div class="app-info">
        <div class="app-name">${app.displayName}</div>
        <div class="app-meta">
          <span class="app-id">${app.id}</span>
          <span>•</span>
          <span class="app-type">${this._getTypeLabel(app.type)}</span>
          ${app.protected ? '<span>•</span><span style="color: var(--brand);">Protected</span>' : ""}
        </div>
      </div>
      <div class="app-status ${app.disabled ? "disabled" : "enabled"}">
        ${app.disabled ? "Disabled" : "Enabled"}
      </div>
      <div class="app-actions">
        <button class="app-action-btn rename-btn" data-app="${app.id}" title="Rename">
          <i class="fas fa-edit"></i>
        </button>
        <button class="app-action-btn toggle-btn" data-app="${app.id}" data-disabled="${app.disabled}" title="${app.disabled ? "Enable" : "Disable"}" ${app.protected ? "disabled" : ""}>
          <i class="fas ${app.disabled ? "fa-toggle-off" : "fa-toggle-on"}"></i>
        </button>
        <button class="app-action-btn uninstall-btn" data-app="${app.id}" title="Uninstall" ${app.protected ? "disabled" : ""}>
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;

    card.addEventListener("click", (e) => {
      const target = e.target;
      if (target instanceof Element && (target.closest(".app-actions") || target.closest(".app-checkbox"))) return;
      const checkbox = card.querySelector(".app-select-checkbox");
      if (checkbox instanceof HTMLInputElement) {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event("change"));
      }
    });

    this._bindAppActions(card, app, inst);
    this._bindCheckbox(card, app, inst);

    return card;
  }

  _getAppIcon(app) {
    if (app.icon) {
      const iconValue = app.icon.trim();
      if (this._isFontAwesomeIconClass(iconValue)) {
        return `<i class="${iconValue}"></i>`;
      }
      const iconUrl = resolveIconUrl(iconValue);
      if (iconUrl && !iconUrl.includes("undefined") && !iconUrl.includes("null")) {
        return `<img src="${iconUrl}">`;
      }
    }
    return `<i class="fas fa-cube"></i>`;
  }

  _isFontAwesomeIconClass(iconValue) {
    if (!iconValue || iconValue.includes("/")) return false;
    return iconValue.split(/\s+/).every((part) => part.startsWith("fa"));
  }

  _getTypeLabel(type) {
    const labels = {
      core: "Core System",
      bundled: "Bundled",
      external: "External"
    };
    return labels[type] || type;
  }

  _bindAppActions(card, app, inst) {
    const renameBtn = card.querySelector(".rename-btn");
    const toggleBtn = card.querySelector(".toggle-btn");
    const uninstallBtn = card.querySelector(".uninstall-btn");

    renameBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await this._handleRename(app, inst);
    });

    toggleBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (app.protected) return;
      await this._handleToggle(app, inst);
    });

    uninstallBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (app.protected) return;
      await this._handleUninstall(app, inst);
    });
  }

  _bindCheckbox(card, app, inst) {
    const checkbox = card.querySelector(".app-select-checkbox");
    checkbox.addEventListener("change", (e) => {
      if (e.target.checked) {
        inst.selectedApps.add(app.id);
        card.classList.add("selected");
      } else {
        inst.selectedApps.delete(app.id);
        card.classList.remove("selected");
      }
      this._updateBulkActions(document.getElementById(inst.winId), inst);
    });
  }

  _updateBulkActions(win, inst) {
    const bulkActions = win.querySelector("#installed-apps-bulk-actions");
    const selectedCount = win.querySelector("#selected-count");
    const selectAllBtn = win.querySelector("#select-all-btn");

    if (!bulkActions) return;

    const count = inst.selectedApps.size;
    selectedCount.textContent = `${count} selected`;

    if (count > 0) {
      bulkActions.style.display = "flex";
    } else {
      bulkActions.style.display = "none";
    }

    const filtered = inst.apps.filter((app) => {
      const matchesSearch =
        app.displayName.toLowerCase().includes(inst.searchQuery) || app.id.toLowerCase().includes(inst.searchQuery);
      const matchesFilter = inst.currentFilter === "all" || app.type === inst.currentFilter;
      return matchesSearch && matchesFilter;
    });

    if (selectAllBtn) {
      selectAllBtn.textContent = count === filtered.length ? "Deselect All" : "Select All";
    }
  }

  async _handleBulkToggle(inst) {
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
      this._loadApps(inst);
      this.notify(
        "Apps Toggled",
        `${toggledCount} app${toggledCount !== 1 ? "s" : ""} status updated`,
        "success",
        5000,
        "fas fa-toggle-on"
      );
    }
  }

  async _handleBulkUninstall(inst) {
    const selectedIds = Array.from(inst.selectedApps);
    const confirmed = await customConfirm(
      `Are you sure you want to uninstall ${selectedIds.length} selected app${selectedIds.length !== 1 ? "s" : ""}? This will remove them from the app registry.`,
      "Bulk Uninstall"
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
        this._loadApps(inst);
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

  async _handleRename(app, inst) {
    const newName = await customPrompt(`Enter a new name for "${app.displayName}":`, app.displayName, "Rename App");

    if (newName !== null && newName.trim() !== "") {
      this.appRegistry.setAppName(app.id, newName.trim());
      this._loadApps(inst);
      this.notify("App Renamed", `"${app.displayName}" is now "${newName.trim()}"`, "success", 5000, "fas fa-edit");
    }
  }

  async _handleToggle(app, inst) {
    const action = app.disabled ? "enable" : "disable";
    const success = this.appRegistry.setAppDisabled(app.id, !app.disabled);
    if (success) {
      this._loadApps(inst);
      this.notify(
        `App ${action.charAt(0).toUpperCase() + action.slice(1)}d`,
        `"${app.displayName}" has been ${action}d`,
        "success",
        5000,
        action === "enable" ? "fas fa-unlock" : "fas fa-lock"
      );
    }
  }

  async _handleUninstall(app, inst) {
    const confirmed = await customConfirm(
      `Are you sure you want to uninstall "${app.displayName}"? This will remove it from the app registry. You can restore it later.`,
      "Uninstall App"
    );

    if (confirmed) {
      const success = this.appRegistry.uninstallApp(app.id);
      if (success) {
        this._loadApps(inst);
        this.notify("App Uninstalled", `"${app.displayName}" has been uninstalled`, "success", 5000, "fas fa-trash");
      }
    }
  }

  onClose(winId) {
    this._removeInstance(winId);
  }
}
