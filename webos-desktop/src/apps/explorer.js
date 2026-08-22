import "../styles/explorer.css";
import { BaseApp, StorageKeys, os, ServiceKeys } from "../framework.js";
import { KeybindManager } from "../keybindManager.js";
import {
  $,
  $$,
  bindEvent,
  bindEvents,
  setText,
  setHTML,
  addClass,
  removeClass,
  setStyle,
  createElement
} from "../shared/domUtils.js";
import {
  isImageFile,
  isISOFile,
  readFileAsDataURL,
  buildFileIconHTML,
  openMediaViewer,
  openFileWith,
  generateThumbnail
} from "../fileDisplay.js";
import { scheduleFileTooltip, hideFileTooltip } from "../shared/fileTooltip.js";
import { ClippyAnimation, speak } from "../ai/clippy.js";
import { ArchiveExtractor } from "../archiveExtractor.js";
import {
  formatSize,
  pluralize,
  isWindowFocused,
  buildClipboardIcons,
  isTextFile,
  rectsIntersect
} from "../utils/utils.js";
import { resolveDesktopIcon } from "../shared/iconUtils.js";
import { resolveIconUrl } from "../shared/assetResolver.js";
import { trigger as triggerCursorEffect } from "../cursorEffect.js";
import { AppSource } from "../AppSource.js";
import { showDynamicContextMenu } from "../shared/contextMenu.js";

import { showConfirmDialog, showInputDialog, showArchiveDialog } from "./explorer/dialogs.js";
import {
  showFileContextMenu,
  showBackgroundContextMenu,
  showSidebarItemContextMenu,
  showTrashContextMenu
} from "./explorer/contextMenus.js";
import { handleFileUpload, uploadSingleFile, saveToWallpapers } from "./explorer/upload.js";
import { showTrashView, renderTrashView } from "./explorer/trash.js";
import { startInlineRename, spawnInlineItem } from "./explorer/inlineRename.js";
import { pasteToPath, copyItem, downloadItems, createArchiveFromItems } from "./explorer/transfer.js";

const sharedDragState = {
  active: false,
  items: [],
  fileTypes: {},
  sourcePath: null,
  sourceWinId: null
};

export class ExplorerApp extends BaseApp {
  get viewMode() {
    return os.storage.get(StorageKeys.explorerViewMode) || "grid";
  }

  set viewMode(mode) {
    os.storage.set(StorageKeys.explorerViewMode, mode);
  }

  get notepadApp() {
    return os.app.getInstance(ServiceKeys.NOTEPAD);
  }

  get markdownApp() {
    return os.app.getInstance(ServiceKeys.MARKDOWN);
  }

  constructor(os) {
    super(os);
    this.officeApp = null;
    this.browserApp = null;
    this.desktopUI = null;
    this.open = this.open.bind(this);
    this.instances = new Map();
    this.thumbnailCache = new Map();
    this.archiveExtractor = new ArchiveExtractor(os.fs, (msg) => os.notify.send(msg), AppSource.EXPLORER);
  }
  createInstance(winId, callback, notepadRef, mode) {
    const inst = {
      winId,
      currentPath: [],
      history: [],
      historyIndex: -1,
      fileSelectCallback: callback || null,
      notepadRef: notepadRef || null,
      selectedFile: null,
      selectedItems: new Set(),
      mode: mode || "browse",
      isRendering: false,
      isTrashView: false,
      isDiskView: false,
      sortBy: "name",
      sortDir: "asc",
      lastClickedIndex: -1,
      searchContentCache: new Map(),
      recSearchView: false
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

  getClipboard() {
    return this.desktopUI?.getClipboard() ?? null;
  }
  setClipboard(data) {
    if (this.desktopUI) this.desktopUI.setClipboard(data);
  }

  clipboardAction(action, inst, itemName, isFile) {
    const win = $(`#${inst.winId}`);
    const view = win && $(`#${inst.winId}-view`, win);
    const items = buildClipboardIcons(
      inst.selectedItems,
      itemName || [...inst.selectedItems][0],
      isFile ?? true,
      view,
      inst.currentPath
    );
    this.setClipboard({ source: "explorer", action, icons: items, sourceInst: inst });

    if (action === "cut" && view) {
      items.forEach(({ data: { name: n } }) => {
        const el = $$(".file-item", view).find((el) => el.querySelector("span")?.textContent === n);
        if (el) setStyle(el, { opacity: "0.5" });
      });
    }

    os.notify.send(`${items.length} ${pluralize(items.length, "item")} ${action}`);
  }

  pasteToCurrentPath(inst) {
    return pasteToPath(this, inst.currentPath, inst);
  }

  watchWindowRemoval(winId) {
    const observer = new MutationObserver(() => {
      if (!$(`#${winId}`)) {
        this.removeInstance(winId);
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  closeWindow(winId) {
    const win = $(`#${winId}`);
    if (win) win.remove();
    this.removeInstance(winId);
  }

  sidebarHTML(variant = "browse") {
    const isDialog = variant !== "browse";
    const collapsed = os.storage.get(StorageKeys.explorerSidebarCollapsed) || {};
    const quickCollapsed = collapsed.quick ? "collapsed" : "";
    const pcCollapsed = collapsed.pc ? "collapsed" : "";

    const quickItems = [
      { path: "", icon: '<i class="fas fa-home"></i>', label: "Home" },
      { path: "Desktop", icon: '<i class="fas fa-desktop"></i>', label: "Desktop" },
      { path: "Downloads", icon: '<i class="fas fa-download"></i>', label: "Downloads" },
      { path: "Documents", icon: '<i class="fas fa-file-lines"></i>', label: "Documents" },
      { path: "Pictures", icon: '<i class="fas fa-image"></i>', label: "Pictures" }
    ];
    if (variant !== "directory") {
      quickItems.push(
        { path: "Music", icon: '<i class="fas fa-music"></i>', label: "Music" },
        { path: "Videos", icon: '<i class="fas fa-video"></i>', label: "Videos" }
      );
    }

    let html = '<div class="explorer-sidebar">';

    html += `<div class="sidebar-section ${quickCollapsed}">`;
    html += '<div class="sidebar-section-header" data-section="quick">';
    html += '<i class="fas fa-chevron-down sidebar-chevron"></i>';
    html += "<span>Quick Access</span></div>";
    html += '<div class="sidebar-section-body">';
    const qaHidden = new Set(os.storage.get(StorageKeys.explorerQuickAccessHidden) || []);
    const visibleDefaults = quickItems.filter((q) => !qaHidden.has(q.path));
    for (const { path, icon, label } of visibleDefaults) {
      html += `<div class="nav-item" data-path="${path}">${icon}<span>${label}</span></div>`;
    }
    const pinned = os.storage.get(StorageKeys.explorerQuickAccess) || [];
    for (const p of pinned) {
      if (!quickItems.some((q) => q.path === p.path)) {
        html += `<div class="nav-item nav-item--pinned" data-path="${p.path}"><i class="fas fa-thumbtack"></i><span>${p.label}</span></div>`;
      }
    }
    html += "</div></div>";

    html += `<div class="sidebar-section ${pcCollapsed}">`;
    html += '<div class="sidebar-section-header" data-section="pc">';
    html += '<i class="fas fa-chevron-down sidebar-chevron"></i>';
    html += "<span>This PC</span></div>";
    html += '<div class="sidebar-section-body">';
    html +=
      '<div class="nav-item nav-item--disk" data-path="__disk__"><i class="fas fa-hdd"></i><span>Local Disk (C:)</span></div>';
    html +=
      '<div class="nav-item nav-item--system" data-path="System"><i class="fas fa-folder-tree"></i><span>System</span></div>';
    html += '<div class="explorer-storage-mounts"></div>';
    html += '<div class="explorer-iso-mounts"></div>';
    html += "</div></div>";

    html += '<div class="sidebar-section sidebar-section--trash">';
    html +=
      '<div class="nav-item nav-item--trash" data-path="__trash__"><i class="fas fa-trash"></i><span>Trash</span></div>';
    html += "</div>";

    html += "</div>";
    return html;
  }

  sidebarRebuild(win, inst) {
    const sidebar = win.querySelector(".explorer-sidebar");
    if (!sidebar) return;
    sidebar.innerHTML = this.sidebarHTML(inst.mode);
    this.bindSidebar(win, inst);
    this.renderMountsInSidebar(win, inst);
    this.updateActiveSidebar(inst);
  }

  bindSidebar(win, inst) {
    $$(".explorer-sidebar .nav-item", win).forEach((item) => {
      const rawPath = item.dataset.path;
      const mountPoint = item.dataset.mount;
      if (rawPath === "__trash__") {
        item.onclick = () => showTrashView(this, inst);
        item.oncontextmenu = (e) => showTrashContextMenu(this, e, inst);
      } else if (rawPath === "__disk__") {
        item.onclick = () => this.showDiskView(inst);
      } else if (mountPoint) {
        item.onclick = () => this.navigateInstance(inst, mountPoint.split("/").filter(Boolean));
        const label = item.dataset.label;
        const isISO = mountPoint.startsWith("ISOs/");
        item.oncontextmenu = (e) => {
          e.preventDefault();
          e.stopPropagation();
          showDynamicContextMenu(e, (menu, menuItem, hr) => {
            menu.appendChild(
              menuItem(
                "Open",
                () => this.navigateInstance(inst, mountPoint.split("/").filter(Boolean)),
                "fa-folder-open"
              )
            );
            menu.appendChild(
              menuItem(
                "Open in New Window",
                () => this.open([...mountPoint.split("/").filter(Boolean)]),
                "fa-external-link-alt"
              )
            );
            menu.appendChild(hr());
            menu.appendChild(
              menuItem(
                "Copy Path",
                () => {
                  navigator.clipboard.writeText("/" + mountPoint).catch(() => {});
                  os.notify.send(`Path copied: /${mountPoint}`);
                },
                "fa-copy"
              )
            );
            menu.appendChild(
              menuItem(
                "Unmount",
                () => {
                  os.dialog.confirm("Unmount", `Eject "${label}"?`).then((confirmed) => {
                    if (confirmed) {
                      if (isISO) {
                        os.fs.unmountISO(label);
                      } else {
                        os.fs.unmount(label);
                      }
                      this.renderMountsInSidebar(win, inst);
                      this.renderInstance(inst);
                    }
                  });
                },
                isISO ? "fa-eject" : "fa-eject"
              )
            );
          });
        };
      } else {
        item.onclick = () => this.navigateInstance(inst, rawPath.split("/").filter(Boolean));
        item.oncontextmenu = (e) => {
          const label = item.textContent.trim();
          showSidebarItemContextMenu(this, e, rawPath || "", label, inst);
        };
      }
    });

    $$(".sidebar-section-header", win).forEach((header) => {
      header.onclick = () => {
        const section = header.parentElement;
        if (!section) return;
        section.classList.toggle("collapsed");
        const collapsed = os.storage.get(StorageKeys.explorerSidebarCollapsed) || {};
        const key = header.dataset.section;
        if (key) {
          collapsed[key] = section.classList.contains("collapsed");
          os.storage.set(StorageKeys.explorerSidebarCollapsed, collapsed);
        }
      };
    });
  }

  renderMountsInSidebar(win, inst) {
    const container = win.querySelector(".explorer-storage-mounts");
    if (!container) return;
    const mounts = os.fs.getMounts();
    const storageMounts = mounts.filter((m) => m.type !== "iso");
    if (!storageMounts.length) {
      container.style.display = "none";
    } else {
      container.style.display = "";
      container.innerHTML = storageMounts
        .map(
          (m) =>
            `<div class="nav-item" data-mount="${m.mountPoint}" data-label="${m.label}"><i class="fas fa-hdd" style="width:14px;text-align:center;font-size:11px;color:var(--brand);opacity:0.7;flex-shrink:0;"></i><span>${m.label}</span></div>`
        )
        .join("");
    }
    this.renderISOMountsInSidebar(win, inst);
  }

  renderISOMountsInSidebar(win, inst) {
    const container = win.querySelector(".explorer-iso-mounts");
    if (!container) return;
    const isoMounts = os.fs.getISOMounts();
    if (!isoMounts.length) {
      container.style.display = "none";
      return;
    }
    container.style.display = "";
    container.innerHTML = isoMounts
      .map(
        (m) =>
          `<div class="nav-item" data-mount="${m.mountPoint}" data-label="${m.label}"><i class="fas fa-compact-disc" style="width:14px;text-align:center;font-size:12px;color:var(--brand);opacity:0.7;flex-shrink:0;"></i><span>${m.label}</span></div>`
      )
      .join("");
  }

  bindBackButton(win, inst) {
    $(`#${inst.winId}-back`, win).onclick = async () => {
      if (inst.historyIndex > 0) {
        inst.historyIndex--;
        inst.currentPath = [...inst.history[inst.historyIndex]];
        await this.renderInstance(inst);
      }
    };
  }

  initExplorerView(win, winId) {
    const view = $(`#${winId}-view`, win);
    if (view) view.tabIndex = -1;
    return view;
  }

  async open(pathOrOptions = [], callback = null, notepadRef = null) {
    let path = [];
    let options = {};
    if (pathOrOptions && typeof pathOrOptions === "object" && !Array.isArray(pathOrOptions)) {
      options = pathOrOptions;
      path = options.path || [];
    } else {
      path = pathOrOptions || [];
    }

    if (typeof path === "function") {
      notepadRef = callback;
      callback = path;
      path = [];
    }

    const isSelector = typeof callback === "function";
    const winId = options.forceId || (isSelector ? `explorer-selector-${Date.now()}` : `explorer-${Date.now()}`);

    const inst = this.createInstance(winId, callback, notepadRef, isSelector ? "select" : "browse");
    const title = isSelector ? "Select File" : "Explorer";
    const win = os.window.create(winId, title, options.width || "700px", options.height || "500px", {
      ...options,
      icon: "static/icons/file.webp"
    });
    addClass(win, "explorer-window");

    win.innerHTML = `
      <div class="explorer-nav">
        <div class="back-btn" id="${winId}-back" title="Back"><i class="fas fa-chevron-left"></i></div>
        <div class="back-btn" id="${winId}-next" title="Next"><i class="fas fa-chevron-right"></i></div>
        <div class="back-btn" id="${winId}-up" title="Up"><i class="fas fa-arrow-up"></i></div>
        <div class="explorer-path-wrap">
          <input
            type="text"
            class="explorer-win-path"
            id="${winId}-path"
            spellcheck="false"
          >
          <i class="fas fa-sync-alt explorer-reload-icon" id="${winId}-reload"></i>
        </div>
        <div class="explorer-search-wrap">
          <input
            type="text"
            id="${winId}-search"
            class="explorer-search-input"
            placeholder="Search..."
            spellcheck="false"
          >
          <i class="fas fa-search explorer-search-icon"></i>
        </div>
      </div>
      <div class="explorer-container">
        ${this.sidebarHTML()}
        <div class="explorer-main" id="${winId}-view"></div>
      </div>
      ${
        isSelector
          ? `
      <div id="${winId}-select-bar" class="explorer-select-bar">
        <span id="${winId}-select-label" class="explorer-select-label">No file selected</span>
        <button id="${winId}-select-btn" class="explorer-select-confirm-btn" disabled>Select This File</button>
      </div>`
          : `
      <div class="explorer-status-bar" id="${winId}-status-bar">
        <span id="${winId}-status-items"></span>
        <span class="explorer-status-selected" id="${winId}-status-selected"></span>
        <div class="explorer-view-toggle" id="${winId}-view-toggle">
          <i class="fas fa-th explorer-view-btn" id="${winId}-view-grid" title="Grid view"></i>
          <i class="fas fa-list explorer-view-btn" id="${winId}-view-list" title="List view"></i>
        </div>
      </div>
      <div class="explorer-upload-progress" id="${winId}-upload-progress">
        Uploading...
      </div>`
      }
    `;

    this.initExplorerView(win, winId);

    this.watchWindowRemoval(winId);

    this.setupExplorerControls(win, winId);
    this.navigateInstance(inst, path);
  }

  async openTrash() {
    const winId = `explorer-trash-${Date.now()}`;
    const inst = this.createInstance(winId, null, null, "browse");
    const win = os.window.create(winId, "Trash", "700px", "500px", {
      icon: "fas fa-trash"
    });
    addClass(win, "explorer-window");

    win.innerHTML = `
      <div class="explorer-nav">
        <div class="back-btn" id="${winId}-back" title="Back"><i class="fas fa-chevron-left"></i></div>
        <div class="back-btn" id="${winId}-next" title="Next"><i class="fas fa-chevron-right"></i></div>
        <div class="back-btn" id="${winId}-up" title="Up"><i class="fas fa-arrow-up"></i></div>
        <div class="explorer-path-wrap">
          <input type="text" class="explorer-win-path" id="${winId}-path" spellcheck="false" value="/Trash">
          <i class="fas fa-sync-alt explorer-reload-icon" id="${winId}-reload"></i>
        </div>
        <div class="explorer-search-wrap">
          <input type="text" id="${winId}-search" class="explorer-search-input" placeholder="Search..." spellcheck="false">
          <i class="fas fa-search explorer-search-icon"></i>
        </div>
      </div>
      <div class="explorer-container">
        ${this.sidebarHTML()}
        <div class="explorer-main" id="${winId}-view"></div>
      </div>
      <div class="explorer-status-bar" id="${winId}-status-bar">
        <span id="${winId}-status-items"></span>
        <span class="explorer-status-selected" id="${winId}-status-selected"></span>
        <div class="explorer-view-toggle" id="${winId}-view-toggle">
          <i class="fas fa-th explorer-view-btn" id="${winId}-view-grid" title="Grid view"></i>
          <i class="fas fa-list explorer-view-btn" id="${winId}-view-list" title="List view"></i>
        </div>
      </div>
      <div class="explorer-upload-progress" id="${winId}-upload-progress">Uploading...</div>
    `;

    this.initExplorerView(win, winId);
    this.watchWindowRemoval(winId);
    this.setupExplorerControls(win, winId);
    await showTrashView(this, inst);
  }

  async openSaveDialog(defaultFileName = "Untitled.txt", onSave = null) {
    const winId = `explorer-save-${Date.now()}`;
    const inst = this.createInstance(winId, null, null, "save");
    inst.saveCallback = onSave;

    const win = os.window.create(winId, "Save As", "700px", "540px", {
      icon: "static/icons/file.webp"
    });
    addClass(win, "explorer-window");

    win.innerHTML = `
      <div class="explorer-nav">
        <div class="back-btn" id="${winId}-back" title="Back"><i class="fas fa-chevron-left"></i></div>
        <input
          type="text"
          class="explorer-win-path"
          id="${winId}-path"
          spellcheck="false"
        >
      </div>
      <div class="explorer-container">
        ${this.sidebarHTML("save")}
        <div class="explorer-main" id="${winId}-view"></div>
      </div>
      <div class="explorer-save-bar" id="${winId}-save-bar">
        <label>File name:</label>
        <input
          id="${winId}-filename-input"
          class="explorer-filename-input"
          type="text"
          value="${defaultFileName}"
          spellcheck="false"
        >
        <button id="${winId}-save-btn" class="explorer-save-btn">Save</button>
        <button id="${winId}-cancel-btn" class="explorer-dialog-cancel-btn">Cancel</button>
      </div>
    `;

    this.initExplorerView(win, winId);

    this.watchWindowRemoval(winId);

    const fileNameInput = $(`#${winId}-filename-input`, win);
    const saveBtn = $(`#${winId}-save-btn`, win);
    const cancelBtn = $(`#${winId}-cancel-btn`, win);

    bindEvents(fileNameInput, {
      focus: () => {
        const dot = fileNameInput.value.lastIndexOf(".");
        if (dot > 0) fileNameInput.setSelectionRange(0, dot);
        else fileNameInput.select();
      },
      keydown: (e) => {
        if (e.key === "Enter") saveBtn.click();
        if (e.key === "Escape") cancelBtn.click();
      }
    });

    saveBtn.onclick = () => {
      const fileName = fileNameInput.value.trim();
      if (!fileName) {
        fileNameInput.style.borderColor = "var(--error)";
        fileNameInput.focus();
        return;
      }
      const cb = inst.saveCallback;
      inst.saveCallback = null;
      this.closeWindow(winId);
      if (cb) cb(inst.currentPath, fileName);
    };

    cancelBtn.onclick = () => this.closeWindow(winId);

    this.bindBackButton(win, inst);
    this.bindSidebar(win, inst);
    this.setupPathInput(win, inst);
    this.navigateInstance(inst, []);
  }

  async openDirectoryDialog(onSelect = null) {
    const winId = `explorer-dir-${Date.now()}`;
    const inst = this.createInstance(winId, null, null, "directory");
    inst.directoryCallback = onSelect;

    const win = os.window.create(winId, "Select Directory", "700px", "500px", {
      icon: "static/icons/file.webp"
    });
    addClass(win, "explorer-window");

    win.innerHTML = `
      <div class="explorer-nav">
        <div class="back-btn" id="${winId}-back" title="Back"><i class="fas fa-chevron-left"></i></div>
        <input
          type="text"
          class="explorer-win-path"
          id="${winId}-path"
          spellcheck="false"
        >
      </div>
      <div class="explorer-container">
        ${this.sidebarHTML("directory")}
        <div class="explorer-main" id="${winId}-view"></div>
      </div>
      <div class="explorer-dir-bar" id="${winId}-dir-bar">
        <label class="explorer-dir-label">Selected:</label>
        <span class="explorer-dir-path" id="${winId}-selected-path">/</span>
        <button class="explorer-dir-select-btn" id="${winId}-select-btn">Select</button>
        <button class="explorer-dir-cancel-btn" id="${winId}-cancel-btn">Cancel</button>
      </div>
    `;

    this.initExplorerView(win, winId);

    this.watchWindowRemoval(winId);

    const selectedPathEl = $(`#${winId}-selected-path`, win);
    const selectBtn = $(`#${winId}-select-btn`, win);
    const cancelBtn = $(`#${winId}-cancel-btn`, win);

    const updateSelectedPath = () => {
      selectedPathEl.textContent = "/" + inst.currentPath.join("/");
    };

    selectBtn.onclick = () => {
      const cb = inst.directoryCallback;
      inst.directoryCallback = null;
      this.closeWindow(winId);
      if (cb) cb(inst.currentPath);
    };

    cancelBtn.onclick = () => this.closeWindow(winId);

    this.bindBackButton(win, inst);
    this.bindSidebar(win, inst);
    this.setupPathInput(win, inst);

    const originalNavigate = this.navigateInstance.bind(this);
    this.navigateInstance = (i, path) => {
      const result = originalNavigate(i, path);
      if (i === inst) {
        setTimeout(updateSelectedPath, 0);
      }
      return result;
    };

    this.navigateInstance(inst, []);
    updateSelectedPath();
  }

  setupExplorerControls(win, winId) {
    const inst = this.getInstance(winId);

    this.bindBackButton(win, inst);
    this.setupPathInput(win, inst);

    const nextBtn = $(`#${winId}-next`, win);
    if (nextBtn) {
      nextBtn.onclick = async () => {
        if (inst.historyIndex < inst.history.length - 1) {
          inst.historyIndex++;
          inst.currentPath = [...inst.history[inst.historyIndex]];
          await this.renderInstance(inst);
        }
      };
    }

    const upBtn = $(`#${winId}-up`, win);
    if (upBtn) {
      upBtn.onclick = () => {
        if (inst.currentPath.length > 0) {
          this.navigateInstance(inst, inst.currentPath.slice(0, -1));
        }
      };
    }

    const searchInput = $(`#${winId}-search`, win);
    let searchVersion = 0;

    const searchRecursive = async (dirPath, query, cache, version) => {
      const results = [];
      let entries;
      try {
        entries = await os.fs.readdir(dirPath);
      } catch {
        return results;
      }
      for (const [name, data] of Object.entries(entries)) {
        if (version !== searchVersion) return results;
        const fullPath = [...dirPath, name];
        if (data.type !== "file") {
          const sub = await searchRecursive(fullPath, query, cache, version);
          results.push(...sub);
        } else {
          const nameMatch = name.toLowerCase().includes(query);
          let contentMatch = false;
          if (!nameMatch && isTextFile(name)) {
            const cacheKey = fullPath.join("/");
            let content = cache.get(cacheKey);
            if (content === undefined) {
              try {
                const raw = await os.fs.read(fullPath);
                content = typeof raw === "string" ? raw : raw?.toString?.() || "";
                cache.set(cacheKey, content);
              } catch {
                continue;
              }
            }
            contentMatch = content.toLowerCase().includes(query);
          }
          if (nameMatch || contentMatch) {
            results.push({
              name,
              path: fullPath,
              dirPath,
              contentMatch: contentMatch && !nameMatch,
              isFolder: data.type !== "file"
            });
          }
        }
      }
      return results;
    };

    const renderRecSearchResults = (results, query) => {
      const view = $(`#${winId}-view`, win);
      view.innerHTML = "";
      view.classList.remove("explorer-view-grid", "explorer-view-list");
      addClass(view, "explorer-rec-search");
      const header = createElement("div", { className: "rec-search-header" });
      setHTML(
        header,
        `<span>Results for "<strong>${query}</strong>"</span><span class="rec-search-count">${results.length} ${pluralize(results.length, "match")}</span>`
      );
      view.appendChild(header);
      if (results.length === 0) {
        const empty = createElement("div", { className: "rec-search-empty" });
        empty.textContent = "No results found";
        view.appendChild(empty);
        return;
      }
      for (const r of results) {
        const item = createElement("div", { className: "file-item rec-search-item" });
        const relPath = r.dirPath.length ? r.dirPath.join("/") + "/" : "";
        setHTML(
          item,
          `${buildFileIconHTML(r.name, { isFolder: r.isFolder })}<span class="file-item-name">${r.name}</span><span class="rec-search-path">${relPath}</span>`
        );
        if (r.contentMatch) item.classList.add("cs-match");
        item.addEventListener("click", () => {
          $$(".rec-search-item.selected", view).forEach((el) => el.classList.remove("selected"));
          item.classList.add("selected");
        });
        item.addEventListener("dblclick", async () => {
          await this.navigateInstance(inst, r.dirPath);
          const newView = $(`#${winId}-view`, win);
          if (newView) {
            const target = $$(".file-item", newView).find(
              (el) => el.querySelector(".file-item-name")?.textContent === r.name
            );
            if (target) {
              this.selectExplorerItem(inst, r.name, target, false, false);
              target.scrollIntoView({ block: "nearest" });
            }
          }
        });
        view.appendChild(item);
      }
    };

    if (searchInput) {
      let searchTimeout;
      bindEvents(searchInput, {
        input: () => {
          clearTimeout(searchTimeout);
          const currentVersion = ++searchVersion;
          searchTimeout = setTimeout(async () => {
            const query = searchInput.value.toLowerCase().trim();
            if (currentVersion !== searchVersion) return;
            if (!query) {
              this.renderInstance(inst);
              return;
            }
            const cache = inst.searchContentCache;
            const results = await searchRecursive(inst.currentPath, query, cache, currentVersion);
            if (currentVersion !== searchVersion) return;
            renderRecSearchResults(results, query);
          }, 150);
        },
        keydown: (e) => e.stopPropagation()
      });
    }

    this.setupViewToggle(win, inst);

    this.bindSidebar(win, inst);

    const viewEl = $(`#${winId}-view`, win);
    bindEvent(viewEl, "contextmenu", (e) => {
      if (e.altKey) return;
      if (e.target === viewEl) showBackgroundContextMenu(this, e, inst);
    });

    bindEvent(win, "contextmenu", (e) => e.preventDefault());

    const explorerKeyHandler = (e) => {
      if (!$(`#${winId}`)) {
        document.removeEventListener("keydown", explorerKeyHandler);
        return;
      }
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)) return;
      if (!win.contains(document.activeElement)) return;

      if (KeybindManager.matches(e, "explorer.deleteItem")) {
        e.preventDefault();
        if (!inst.selectedItems.size) return;
        const names = [...inst.selectedItems];
        inst.selectedItems = new Set();
        Promise.all(names.map((n) => os.fs.trashFile(inst.currentPath, n))).then(() => {
          os.notify.send(`${names.length} ${pluralize(names.length, "item")} moved to trash`);
          this.renderInstance(inst);
        });
        return;
      }

      if (KeybindManager.matches(e, "explorer.refresh")) {
        e.preventDefault();
        this.renderInstance(inst);
        return;
      }

      if (KeybindManager.matches(e, "explorer.rename")) {
        e.preventDefault();
        const selectedName = inst.selectedFile || (inst.selectedItems.size === 1 ? [...inst.selectedItems][0] : null);
        if (!selectedName) return;
        const view = $(`#${winId}-view`, win);
        const itemEl =
          view && $$(".file-item", view).find((el) => el.querySelector("span")?.textContent === selectedName);
        if (itemEl) startInlineRename(this, itemEl, selectedName, inst);
        return;
      }

      if (KeybindManager.matches(e, "explorer.enter")) {
        e.preventDefault();
        const view = $(`#${winId}-view`, win);
        if (!view) return;
        const sel = [...inst.selectedItems];
        if (sel.length === 1) {
          this.openItemForInstance(inst, sel[0], null);
        }
        return;
      }

      if (KeybindManager.matches(e, "explorer.navigateUp") || KeybindManager.matches(e, "explorer.navigateDown")) {
        e.preventDefault();
        const view = $(`#${winId}-view`, win);
        if (!view) return;
        const items = $$(".file-item", view);
        if (!items.length) return;
        const selectedIdx = items.findIndex((el) =>
          inst.selectedItems.has(el.querySelector("span")?.textContent || "")
        );
        let nextIdx;
        if (KeybindManager.matches(e, "explorer.navigateDown")) {
          nextIdx = selectedIdx < items.length - 1 ? selectedIdx + 1 : 0;
        } else {
          nextIdx = selectedIdx > 0 ? selectedIdx - 1 : items.length - 1;
        }
        const el = items[nextIdx];
        const name = el.querySelector("span")?.textContent;
        if (name) {
          if (!e.shiftKey) {
            $$(".file-item.explorer-selected", view).forEach((el) => removeClass(el, "explorer-selected"));
            inst.selectedItems = new Set();
          }
          this.selectExplorerItem(inst, name, el, false, false);
          el.scrollIntoView({ block: "nearest" });
        }
        return;
      }

      if (KeybindManager.matches(e, "explorer.search")) {
        e.preventDefault();
        const searchInput = $(`#${winId}-search`, win);
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      if (KeybindManager.matches(e, "explorer.selectAll")) {
        e.preventDefault();
        const view = $(`#${winId}-view`, win);
        if (!view || inst.isDiskView || inst.isTrashView) return;
        $$(".file-item", view).forEach((el) => {
          addClass(el, "explorer-selected");
          const name = el.querySelector("span")?.textContent;
          if (name) inst.selectedItems.add(name);
        });
        this.updateStatusBar(inst, inst.cachedFolder);
        return;
      }

      if (KeybindManager.matches(e, "explorer.copy")) {
        e.preventDefault();
        this.clipboardAction("copy", inst);
        return;
      }
      if (KeybindManager.matches(e, "explorer.cut")) {
        e.preventDefault();
        this.clipboardAction("cut", inst);
        return;
      }
      return;
    };
    document.addEventListener("keydown", explorerKeyHandler);

    this.setupSelectionBox(win, winId);
    this.setupDropZone(win, winId);
  }

  setupPathInput(win, inst) {
    const pathInput = $(`#${inst.winId}-path`, win);
    if (!pathInput || pathInput.tagName !== "INPUT") return;

    bindEvent(pathInput, "contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      showDynamicContextMenu(e, (menu, item, hr) => {
        menu.appendChild(
          item(
            "Copy Path",
            () => {
              const fullPath = "/" + inst.currentPath.join("/");
              navigator.clipboard.writeText(fullPath).catch(() => {});
              os.notify.send(`Path copied: ${fullPath}`);
            },
            "fa-copy"
          )
        );
      });
    });

    bindEvents(pathInput, {
      keydown: async (e) => {
        e.stopPropagation();
        if (KeybindManager.matches(e, "explorer.enter")) {
          const val = pathInput.value.trim();
          if (!val || val === "/") {
            this.navigateInstance(inst, []);
            return;
          }

          const targetParts = val.split("/").filter(Boolean);
          try {
            if (await os.fs.exists(targetParts)) {
              const isDir = await os.fs
                .readdir(targetParts)
                .then(() => true)
                .catch(() => false);
              if (isDir) {
                this.navigateInstance(inst, targetParts);
              } else {
                os.notify.send(`"${val}" is a file, not a directory.`);
                pathInput.value = "/" + inst.currentPath.join("/");
              }
            } else {
              os.notify.send(`Directory not found: ${val}`);
              pathInput.value = "/" + inst.currentPath.join("/");
            }
          } catch (err) {
            os.notify.send(`Failed to open directory: ${val}`);
            pathInput.value = "/" + inst.currentPath.join("/");
          }
          pathInput.blur();
        } else if (KeybindManager.matches(e, "explorer.escape")) {
          pathInput.value = "/" + inst.currentPath.join("/");
          pathInput.blur();
        }
      },
      focus: () => {
        pathInput.select();
      }
    });

    const reloadBtn = $(`#${inst.winId}-reload`, win);
    if (reloadBtn) {
      reloadBtn.onclick = () => {
        this.renderInstance(inst);
      };
    }
  }

  setupViewToggle(win, inst) {
    const apply = (mode) => {
      const g = win.querySelector(`#${inst.winId}-view-grid`);
      const l = win.querySelector(`#${inst.winId}-view-list`);
      if (g) g.classList.toggle("avt", mode === "grid");
      if (l) l.classList.toggle("avt", mode === "list");
    };

    const handler = (e) => {
      const btn = e.target.closest(`#${inst.winId}-view-grid, #${inst.winId}-view-list`);
      if (!btn) return;
      const mode = btn.id && btn.id.endsWith("grid") ? "grid" : "list";
      this.viewMode = mode;
      apply(mode);
      const viewEl = win.querySelector(`#${inst.winId}-view`);
      if (inst.isTrashView) {
        this.renderTrashView(inst, viewEl, win);
      } else if (inst.isDiskView) {
        this.renderDiskView(inst, viewEl, win);
      } else {
        this.renderInstance(inst);
      }
    };

    win.addEventListener("click", handler);

    apply(this.viewMode);
  }

  kindLabel(kind) {
    const LABELS = { text: "Text Document", image: "Image", video: "Video", audio: "Audio", rom: "ROM File" };
    return LABELS[kind] || null;
  }

  formatFriendlyDate(d) {
    if (!d) return "-";
    const date = new Date(d);
    const mo = (date.getMonth() + 1).toString().padStart(2, "0");
    const da = date.getDate().toString().padStart(2, "0");
    const yr = date.getFullYear();
    const hr = date.getHours().toString().padStart(2, "0");
    const mi = date.getMinutes().toString().padStart(2, "0");
    return `${mo}/${da}/${yr} ${hr}:${mi}`;
  }

  sortItems(items, sortBy, sortDir, folder, stats) {
    const dir = sortDir === "asc" ? 1 : -1;
    const KIND_ORDER = { text: 1, image: 2, video: 3, audio: 4, rom: 5 };
    return [...items].sort((a, b) => {
      const aData = folder[a.name] || {};
      const bData = folder[b.name] || {};
      const aStat = stats[a.name] || {};
      const bStat = stats[b.name] || {};
      if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
      let cmp = 0;
      switch (sortBy) {
        case "name":
          cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
          break;
        case "date": {
          const aD = aStat.mtime ? new Date(aStat.mtime).getTime() : 0;
          const bD = bStat.mtime ? new Date(bStat.mtime).getTime() : 0;
          cmp = aD - bD;
          break;
        }
        case "type": {
          const aK = KIND_ORDER[aData.kind] || 99;
          const bK = KIND_ORDER[bData.kind] || 99;
          cmp = aK - bK;
          if (cmp === 0) cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
          break;
        }
        case "size":
          cmp = (aData.size || 0) - (bData.size || 0);
          break;
      }
      return cmp * dir;
    });
  }

  createListHeader(inst) {
    const header = createElement("div");
    header.className = "explorer-list-header";
    const cols = [
      { key: "name", label: "Name", cls: "list-h-name" },
      { key: "date", label: "Date modified", cls: "list-h-date" },
      { key: "type", label: "Type", cls: "list-h-type" },
      { key: "size", label: "Size", cls: "list-h-size" }
    ];
    cols.forEach((col) => {
      const span = createElement("span");
      span.className = col.cls;
      span.textContent = col.label;
      if (inst.sortBy === col.key) {
        span.classList.add("list-h-active");
        const arrow = createElement("i");
        arrow.className = `fas fa-sort-${inst.sortDir === "asc" ? "up" : "down"}`;
        span.appendChild(arrow);
      }
      span.onclick = () => {
        if (inst.sortBy === col.key) {
          inst.sortDir = inst.sortDir === "asc" ? "desc" : "asc";
        } else {
          inst.sortBy = col.key;
          inst.sortDir = "asc";
        }
        this.renderInstance(inst);
      };
      header.appendChild(span);
    });
    return header;
  }

  ensureSelBox(view) {
    if (view.querySelector(".explorer-selbox")) return;
    const selBox = createElement("div", { className: "explorer-selbox" });
    setStyle(view, { position: "relative" });
    view.appendChild(selBox);
  }

  updateActiveSidebar(inst) {
    const win = $(`#${inst.winId}`);
    if (!win) return;
    const items = win.querySelectorAll(".explorer-sidebar .nav-item");
    const currentPath = inst.currentPath.join("/");
    items.forEach((item) => {
      const dataPath = item.dataset.path;
      const mountPoint = item.dataset.mount;
      const mountPath = mountPoint ? mountPoint.split("/").filter(Boolean).join("/") : null;
      let isMatch = false;
      if (mountPoint) {
        isMatch = mountPath === currentPath;
      } else if (dataPath !== undefined) {
        isMatch = dataPath === currentPath;
      }
      if (dataPath === "__trash__" && inst.isTrashView) isMatch = true;
      if (dataPath === "" && inst.isTrashView) isMatch = false;
      if (dataPath === "__disk__" && inst.isDiskView) isMatch = true;
      if (dataPath !== "__disk__" && inst.isDiskView) isMatch = false;
      item.classList.toggle("nav-item--active", isMatch);
    });
  }

  setupSelectionBox(win, winId) {
    const view = $(`#${winId}-view`, win);
    this.ensureSelBox(view);

    const selState = { active: false, startX: 0, startY: 0 };

    view.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      if (e.target.closest(".file-item")) return;
      const rect = view.getBoundingClientRect();
      selState.active = true;
      selState.startX = e.clientX - rect.left + view.scrollLeft;
      selState.startY = e.clientY - rect.top + view.scrollTop;
      const sb = view.querySelector(".explorer-selbox");
      if (sb)
        setStyle(sb, {
          display: "block",
          left: selState.startX + "px",
          top: selState.startY + "px",
          width: "0px",
          height: "0px"
        });
    });

    let selRafId = null;
    let selLastX = 0,
      selLastY = 0;
    view.addEventListener("mousemove", (e) => {
      if (!selState.active) return;
      selLastX = e.clientX;
      selLastY = e.clientY;
      const rect = view.getBoundingClientRect();
      const curX = e.clientX - rect.left + view.scrollLeft;
      const curY = e.clientY - rect.top + view.scrollTop;
      const x = Math.min(curX, selState.startX);
      const y = Math.min(curY, selState.startY);
      const w = Math.abs(curX - selState.startX);
      const h = Math.abs(curY - selState.startY);

      const sb = view.querySelector(".explorer-selbox");
      if (sb) setStyle(sb, { left: x + "px", top: y + "px", width: w + "px", height: h + "px" });

      if (selRafId) return;
      selRafId = requestAnimationFrame(() => {
        selRafId = null;
        const i = this.getInstance(winId);
        if (!i) return;
        const rafRect = view.getBoundingClientRect();
        const boxRect = { left: x, top: y, right: x + w, bottom: y + h };

        if (!e.ctrlKey) {
          $$(".file-item.explorer-selected", view).forEach((el) => removeClass(el, "explorer-selected"));
          i.selectedItems = new Set();
        }

        $$(".file-item", view).forEach((item) => {
          const r = item.getBoundingClientRect();
          const vr = rafRect;
          const ir = {
            left: r.left - vr.left + view.scrollLeft,
            top: r.top - vr.top + view.scrollTop,
            right: r.right - vr.left + view.scrollLeft,
            bottom: r.bottom - vr.top + view.scrollTop
          };
          const overlaps = rectsIntersect(ir, boxRect);
          const name = item.querySelector("span")?.textContent;
          if (!name) return;
          if (overlaps) {
            addClass(item, "explorer-selected");
            i.selectedItems.add(name);
          } else if (!e.ctrlKey) {
            removeClass(item, "explorer-selected");
            i.selectedItems.delete(name);
          }
        });

        this.updateStatusBar(i, i.cachedFolder);
      });
    });

    const endSel = () => {
      selState.active = false;
      const sb = view.querySelector(".explorer-selbox");
      if (sb) setStyle(sb, { display: "none" });
    };
    view.addEventListener("mouseup", endSel);
    document.addEventListener("mouseup", endSel);
  }

  setupDropZone(win, winId) {
    const view = $(`#${winId}-view`, win);
    bindEvents(view, {
      dragover: (e) => {
        if (![...(e.dataTransfer?.items || [])].some((i) => i.kind === "file")) return;
        e.preventDefault();
        e.stopPropagation();
        addClass(view, "explorer-drop-active");
      },
      dragleave: (e) => {
        if (!view.contains(e.relatedTarget)) removeClass(view, "explorer-drop-active");
      },
      drop: () => removeClass(view, "explorer-drop-active")
    });
  }

  async handleFileUpload(files, isFolder, win, inst) {
    await handleFileUpload(this, files, isFolder, win, inst);
  }

  async uploadSingleFile(file, targetPath, overrideName = null) {
    await uploadSingleFile(this, file, targetPath, overrideName);
  }

  async saveToWallpapers(name, content, kind, icon) {
    await saveToWallpapers(this, name, content, kind, icon);
  }

  navigate(path) {
    const inst = [...this.instances.values()][0];
    if (inst) return this.navigateInstance(inst, path);
  }

  navigateInstance(inst, path) {
    if (typeof path === "string") {
      path = path.replace(/^\//, "").split("/").filter(Boolean);
    }
    inst.isTrashView = false;
    inst.isDiskView = false;
    inst.searchContentCache = new Map();
    inst.currentPath = Array.isArray(path) ? [...path] : [];
    inst.history = inst.history.slice(0, inst.historyIndex + 1);
    inst.history.push([...inst.currentPath]);
    inst.historyIndex = inst.history.length - 1;
    inst.selectedFile = null;
    inst.selectedItems = new Set();

    if (inst.mode === "select") {
      const win = $(`#${inst.winId}`);
      if (win) {
        const label = $(`#${inst.winId}-select-label`, win);
        const btn = $(`#${inst.winId}-select-btn`, win);
        if (label) setText(label, "No file selected");
        if (btn) btn.disabled = true;
      }
    }
    return this.renderInstance(inst);
  }

  async render() {
    const inst = [...this.instances.values()][0];
    if (inst) await this.renderInstance(inst);
  }

  async renderInstance(inst) {
    if (inst.isRendering) return;
    inst.isRendering = true;

    try {
      const win = $(`#${inst.winId}`);
      if (!win) {
        inst.isRendering = false;
        return;
      }
      const view = $(`#${inst.winId}-view`, win);
      const pathDisplay = $(`#${inst.winId}-path`, win);
      if (!view) {
        inst.isRendering = false;
        return;
      }

      view.innerHTML = "";
      removeClass(view, "games-page");
      removeClass(view, "explorer-trash-view");
      removeClass(view, "explorer-view-grid");
      removeClass(view, "explorer-view-list");
      addClass(view, `explorer-view-${this.viewMode}`);
      this.ensureSelBox(view);
      if (pathDisplay) {
        if (pathDisplay.tagName === "INPUT") {
          pathDisplay.value = "/" + inst.currentPath.join("/");
        } else {
          pathDisplay.textContent = "/" + inst.currentPath.join("/");
        }
      }

      const folder = await os.fs.readdir(inst.currentPath);
      inst.cachedFolder = folder;
      if (inst.mode === "browse") inst.cachedFolderStats = await this.buildFolderStats(inst);

      const entries = Object.entries(folder).filter(([name]) => {
        if (name === "system" && inst.currentPath.length === 0) return false;
        if (name === ".trash" && inst.currentPath.length === 0) return false;
        return true;
      });
      const items = await Promise.all(
        entries.map(async ([name, itemData]) => {
          const isFile = itemData?.type === "file";
          const iconEl = await this.buildItemIconHTML(name, isFile, itemData, inst);
          return { name, isFile, iconEl, itemData };
        })
      );

      if (this.viewMode === "list") {
        const stats = inst.cachedFolderStats || {};
        const sorted = this.sortItems(items, inst.sortBy, inst.sortDir, folder, stats);

        const header = this.createListHeader(inst);
        view.appendChild(header);

        for (const { name, isFile, iconEl, itemData } of sorted) {
          const row = createElement("div", { className: "file-item" });
          row.dataset.isFile = isFile ? "true" : "false";
          const stat = stats[name] || {};
          const kind = itemData?.kind || "";
          const size = isFile ? (itemData?.size ?? stat.size ?? 0) : "";
          const mtime = stat.mtime;
          const typeLabel = isFile ? this.kindLabel(kind) || "File" : "File Folder";
          setHTML(
            row,
            `${iconEl}<span class="file-item-name">${name}</span><span class="file-col-date">${mtime ? this.formatFriendlyDate(mtime) : "-"}</span><span class="file-col-type">${typeLabel}</span><span class="file-col-size">${isFile ? formatSize(size) : ""}</span>`
          );
          this.bindItemInteractions(row, name, isFile, inst, win);
          view.appendChild(row);
        }
      } else {
        for (const { name, isFile, iconEl } of items) {
          const item = createElement("div", { className: "file-item" });
          item.dataset.isFile = isFile ? "true" : "false";
          setHTML(item, `${iconEl}<span class="file-item-name">${name}</span>`);
          this.bindItemInteractions(item, name, isFile, inst, win);
          view.appendChild(item);
        }
      }

      if (Object.keys(folder).length === 0 && inst.mode === "browse") {
        speak("This folder is empty. Want me to help you organize?", ClippyAnimation.Searching);
      }

      if (inst.mode === "browse") await this.updateStatusBar(inst, folder);
      if (inst.mode === "select") this.bindSelectBarButton(inst);
      await this.updateStorageIndicator(win, inst);
      this.updateActiveSidebar(inst);

      const cb = this.getClipboard();
      if (cb && cb.action === "cut") {
        const items = cb.items || cb.icons || [];
        const src = cb.sourceInst?.winId;
        const sameInst =
          src === inst.winId || (cb.sourcePath && cb.sourcePath.join("/") === inst.currentPath.join("/"));
        if (sameInst && items.length) {
          const view = $(`#${inst.winId}-view`, win);
          if (view) {
            items.forEach(({ data: { name: n } }) => {
              const el = $$(".file-item", view).find((el) => el.querySelector("span")?.textContent === n);
              if (el) setStyle(el, { opacity: "0.5" });
            });
          }
        }
      }
    } catch (err) {
      console.error("renderInstance error:", err);
    } finally {
      inst.isRendering = false;
    }
  }

  async renderFolderInto(container, folderPath, onNavigate = null) {
    const path = Array.isArray(folderPath)
      ? [...folderPath]
      : String(folderPath || "")
          .replace(/^\//, "")
          .split("/")
          .filter(Boolean);
    if (!container) return;
    setHTML(container, "");
    let folder;
    try {
      folder = await os.fs.readdir(path);
    } catch {
      setHTML(container, `<div class="deck-note">Could not open this folder.</div>`);
      return 0;
    }
    const entries = Object.entries(folder);
    for (const [name, itemData] of entries) {
      const isFile = itemData?.type === "file";
      let iconEl;
      try {
        iconEl = await this.buildItemIconHTML(name, isFile, itemData, {
          currentPath: path,
          thumbnailCache: this.thumbnailCache
        });
      } catch {
        iconEl = buildFileIconHTML(name, { isFolder: itemData?.type !== "file" });
      }
      const item = createElement("div", { className: "file-item" });
      item.dataset.isFile = String(isFile);
      setHTML(item, `${iconEl}<span class="file-item-name">${name}</span>`);
      item.addEventListener("click", () => {
        container.querySelectorAll(".file-item.selected").forEach((el) => el.classList.remove("selected"));
        item.classList.add("selected");
      });
      item.addEventListener("dblclick", async () => {
        if (isFile) {
          triggerCursorEffect();
          await openFileWith({ name, path: [...path] });
        } else if (typeof onNavigate === "function") {
          onNavigate([...path, name]);
        }
      });
      container.appendChild(item);
    }
    if (entries.length === 0) {
      setHTML(container, `<div class="deck-note">This folder is empty.</div>`);
    }
    return entries.length;
  }

  async buildItemIconHTML(name, isFile, itemData, inst) {
    const inSystem = inst?.currentPath?.[0] === "System";

    if (name.endsWith(".desktop") && !inSystem) {
      try {
        const raw = await os.fs.getFileContent(inst.currentPath, name);
        const iconSrc = resolveDesktopIcon(raw, name);
        return buildFileIconHTML(name, { storedIcon: iconSrc });
      } catch (e) {
        console.error("Failed to load .desktop icon:", e);
      }
    }

    let thumbnailSrc = null;
    if (isImageFile(name) && !inSystem) {
      const cacheKey = inst.currentPath.join("/") + "/" + name;
      const cached = this.thumbnailCache.get(cacheKey);
      if (cached) {
        thumbnailSrc = cached;
      } else {
        try {
          const content = await os.fs.getFileContent(inst.currentPath, name);
          const src = content instanceof Blob ? await readFileAsDataURL(content) : content;
          thumbnailSrc = await generateThumbnail(src);
          if (thumbnailSrc) this.thumbnailCache.set(cacheKey, thumbnailSrc);
        } catch (e) {
          console.error("Failed to load image thumbnail:", e);
        }
      }
    }

    return buildFileIconHTML(name, { thumbnailSrc, storedIcon: itemData.faIcon || itemData.icon, isFolder: !isFile });
  }

  bindItemInteractions(item, name, isFile, inst, win) {
    if (inst.mode === "select") {
      if (isFile) {
        item.onclick = () => this.selectFile(inst, name, item);
        item.ondblclick = () => this.confirmSelection(inst);
      } else {
        item.ondblclick = () => this.openItemForInstance(inst, name, false);
      }
    } else if (inst.mode === "save") {
      if (!isFile) {
        item.ondblclick = () => this.navigateInstance(inst, [...inst.currentPath, name]);
      } else {
        item.onclick = () => {
          const input = $(`#${inst.winId}-filename-input`, win);
          if (input) input.value = name;
          $$(".file-item.explorer-selected", win).forEach((el) => removeClass(el, "explorer-selected"));
          addClass(item, "explorer-selected");
        };
      }
    } else {
      item.onclick = (e) => {
        if (e.detail === 1) this.selectExplorerItem(inst, name, item, e.ctrlKey, e.shiftKey);
      };
      item.ondblclick = () => this.openItemForInstance(inst, name, isFile);
      item.oncontextmenu = (e) => showFileContextMenu(this, e, name, isFile, inst);
      this.setupExplorerItemDrag(item, name, isFile, inst);
    }

    item.addEventListener("mouseenter", (e) => {
      scheduleFileTooltip(e, inst.currentPath, name, !isFile);
    });
    item.addEventListener("mouseleave", () => hideFileTooltip());
  }

  selectFile(inst, name, itemEl) {
    const win = $(`#${inst.winId}`);
    if (!win) return;
    $$(".file-item.explorer-selected", win).forEach((el) => removeClass(el, "explorer-selected"));
    addClass(itemEl, "explorer-selected");
    inst.selectedFile = name;
    const label = $(`#${inst.winId}-select-label`, win);
    const btn = $(`#${inst.winId}-select-btn`, win);
    if (label) setText(label, name);
    if (btn) btn.disabled = false;
  }

  bindSelectBarButton(inst) {
    const win = $(`#${inst.winId}`);
    const btn = win && $(`#${inst.winId}-select-btn`, win);
    if (btn) btn.onclick = () => this.confirmSelection(inst);
  }

  confirmSelection(inst) {
    if (!inst.selectedFile || !inst.fileSelectCallback) return;
    const cb = inst.fileSelectCallback;
    inst.fileSelectCallback = null;
    this.closeWindow(inst.winId);
    cb(inst.currentPath, inst.selectedFile);
  }

  async openItem(name, isFile) {
    const inst = [...this.instances.values()][0];
    if (inst) await this.openItemForInstance(inst, name, isFile);
  }

  async openItemForInstance(inst, name, isFile) {
    if (!isFile) {
      this.navigateInstance(inst, [...inst.currentPath, name]);
      return;
    }

    if (name.endsWith(".desktop")) {
      try {
        const raw = await os.fs.read(inst.currentPath.concat(name));
        const content = JSON.parse(raw);
        if (content && content.app) {
          triggerCursorEffect(content.icon || "fa-solid fa-cube");
          os.storage.set(StorageKeys.launchTimePrefix + content.app, Date.now());
          const extra = content.steamGameId ? { steamGameId: content.steamGameId } : null;
          os.app.launch(content.app, false, extra);
          return;
        } else if (content && content.type === "youtube-embed") {
          triggerCursorEffect("fa-brands fa-youtube");
          this.openYouTubeEmbedDesktop(content);
          return;
        }
        console.error("Invalid .desktop file: missing app or type field");
      } catch (e) {
        console.error("Failed to open .desktop file:", e);
      }
      return;
    }

    if (name.toLowerCase().endsWith(".img")) {
      triggerCursorEffect("fa-microchip");
      this.v86app.launchImage(name, [...inst.currentPath]);
      return;
    }

    if (isISOFile(name)) {
      triggerCursorEffect("fa-compact-disc");
      try {
        const mountPoint = await os.fs.mountISO(inst.currentPath, name);
        os.notify.send("Disc Image", `Mounted "${name}"`, { icon: "fa-compact-disc" });
        if (mountPoint) {
          const win = $(`#${inst.winId}`);
          if (win) this.sidebarRebuild(win, inst);
          this.navigateInstance(inst, mountPoint.split("/").filter(Boolean));
        }
      } catch (e) {
        os.notify.send("Disc Image", `Failed to mount "${name}": ${e.message}`, { type: "error" });
      }
      return;
    }

    triggerCursorEffect();
    await openFileWith({
      name,
      path: [...inst.currentPath]
    });
  }

  openMediaViewer(name, src, kind) {
    openMediaViewer(name, src, kind);
  }

  openYouTubeEmbedDesktop(content) {
    const winId = `yt-embed-${Date.now()}`;
    const win = os.window.create(winId, content.name || "YouTube Embed", "800px", "600px", {
      icon: "static/icons/file.webp"
    });

    const base = content.nocookie ? "https://www.youtube-nocookie.com" : "https://www.youtube.com";
    const params = new URLSearchParams();
    if (content.autoplay) params.set("autoplay", "1");
    if (!content.controls) params.set("controls", "0");
    if (content.mute && content.autoplay) params.set("mute", "1");
    if (content.startSeconds > 0) params.set("start", String(content.startSeconds));
    if (content.endSeconds > 0) params.set("end", String(content.endSeconds));
    if (content.loop) params.set("loop", "1");
    params.set("rel", "0");

    let embedUrl;
    if (content.kind === "playlist" && content.playlistId) {
      params.set("list", content.playlistId);
      embedUrl = `${base}/embed/videoseries?${params.toString()}`;
    } else if (content.kind === "video" && content.videoId) {
      if (content.loop) params.set("playlist", content.videoId);
      embedUrl = `${base}/embed/${encodeURIComponent(content.videoId)}?${params.toString()}`;
    } else {
      os.notify.send("Invalid YouTube embed data", "Missing videoId or playlistId");
      return;
    }

    win.innerHTML = `
      <div class="window-content" style="width:100%; height:100%; overflow:hidden; display:flex; align-items:center; justify-content:center; background:#000;">
        <iframe src="${embedUrl}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" style="width:100%; height:100%; border:none;"></iframe>
      </div>
    `;
  }

  pasteToPath(destPath, inst) {
    return pasteToPath(this, destPath, inst);
  }

  async downloadItems(itemName, isFile, inst) {
    await downloadItems(this, itemName, isFile, inst);
  }

  async createArchiveFromItems(itemName, isFile, inst) {
    await createArchiveFromItems(this, itemName, isFile, inst);
  }

  showFileContextMenu(e, itemName, isFile, inst) {
    showFileContextMenu(this, e, itemName, isFile, inst);
  }

  showBackgroundContextMenu(e, inst) {
    showBackgroundContextMenu(this, e, inst);
  }

  selectExplorerItem(inst, name, itemEl, isCtrl, isShift) {
    const win = $(`#${inst.winId}`);
    if (!win) return;
    const view = $(`#${inst.winId}-view`, win);
    if (!view) return;
    if (document.activeElement !== view && document.activeElement !== win) view.focus({ preventScroll: true });

    if (isShift && inst.lastClickedIndex >= 0) {
      const items = $$(".file-item", view);
      const currentIdx = items.indexOf(itemEl);
      if (currentIdx >= 0) {
        const start = Math.min(inst.lastClickedIndex, currentIdx);
        const end = Math.max(inst.lastClickedIndex, currentIdx);
        if (!isCtrl) {
          $$(".file-item.explorer-selected", view).forEach((el) => removeClass(el, "explorer-selected"));
          inst.selectedItems = new Set();
        }
        for (let i = start; i <= end; i++) {
          const el = items[i];
          const n = el.querySelector("span")?.textContent;
          if (n) {
            inst.selectedItems.add(n);
            addClass(el, "explorer-selected");
          }
        }
        inst.lastClickedIndex = currentIdx;
        inst.selectedFile = name;
        if (this.desktopUI) this.desktopUI.lastFocusedContext = "explorer";
        if (inst.mode === "browse") this.updateStatusBar(inst, inst.cachedFolder);
        return;
      }
    }

    if (!isCtrl) {
      win.querySelectorAll(".file-item.explorer-selected").forEach((el) => el.classList.remove("explorer-selected"));
      inst.selectedItems = new Set();
    }

    if (inst.selectedItems.has(name) && isCtrl) {
      inst.selectedItems.delete(name);
      itemEl.classList.remove("explorer-selected");
    } else {
      inst.selectedItems.add(name);
      itemEl.classList.add("explorer-selected");
    }

    const viewItems = $$(".file-item", view);
    inst.lastClickedIndex = viewItems.indexOf(itemEl);
    inst.selectedFile = name;
    if (this.desktopUI) this.desktopUI.lastFocusedContext = "explorer";
    if (inst.mode === "browse") this.updateStatusBar(inst, inst.cachedFolder);
  }

  setupExplorerItemDrag(itemEl, name, isFile, inst) {
    itemEl.addEventListener("mousedown", (e) => {
      if (e.button !== 0 || e.target.tagName === "INPUT") return;

      const startX = e.clientX;
      const startY = e.clientY;
      let ghost = null;
      let dragging = false;
      let dragRafId = null;
      let activeDropTarget = null;

      const onMouseMove = (ev) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;

        if (!dragging && Math.sqrt(dx * dx + dy * dy) > 6) {
          dragging = true;
          if (!inst.selectedItems.has(name)) this.selectExplorerItem(inst, name, itemEl, false);

          const win = $(`#${inst.winId}`);
          const view = win?.querySelector(`#${inst.winId}-view`);
          const selectedEls = view ? [...view.querySelectorAll(".file-item.explorer-selected")] : [itemEl];

          ghost = createElement("div");
          ghost.className = "explorer-drag-ghost";
          const iconEl = (selectedEls[0] || itemEl).querySelector("img")?.cloneNode() || createElement("div");
          iconEl.className = "explorer-ghost-icon";
          const label = createElement("div");
          label.className = "explorer-file-label";
          label.textContent = selectedEls.length > 1 ? `${selectedEls.length} items` : name;
          ghost.appendChild(iconEl);
          ghost.appendChild(label);
          setStyle(ghost, { left: ev.clientX - 50 + "px", top: ev.clientY - 30 + "px" });
          document.body.appendChild(ghost);

          const selectedNames = inst.selectedItems.size > 0 ? [...inst.selectedItems] : [name];
          sharedDragState.active = true;
          sharedDragState.items = selectedNames;
          sharedDragState.sourcePath = inst.currentPath;
          sharedDragState.sourceWinId = inst.winId;
          sharedDragState.fileTypes = {};
          if (view) {
            view.querySelectorAll(".file-item").forEach((el) => {
              const n = el.querySelector("span")?.textContent;
              if (n) sharedDragState.fileTypes[n] = el.dataset.isFile === "true";
            });
          }
        }

        if (dragging && ghost) {
          setStyle(ghost, { left: ev.clientX - 50 + "px", top: ev.clientY - 30 + "px" });

          if (dragRafId) return;
          dragRafId = requestAnimationFrame(() => {
            dragRafId = null;
            const explorerWin = $(`#${inst.winId}`);
            const overDesktop = !explorerWin?.contains(document.elementFromPoint(ev.clientX, ev.clientY));

            const el = document.elementFromPoint(ev.clientX, ev.clientY);
            const targetView = el?.closest(".explorer-main");
            const overOtherExplorer = targetView && targetView.id !== `${inst.winId}-view`;

            if (activeDropTarget && activeDropTarget !== targetView) {
              removeClass(activeDropTarget, "explorer-drop-active");
            }
            if (overOtherExplorer) {
              addClass(targetView, "explorer-drop-active");
              activeDropTarget = targetView;
            } else {
              activeDropTarget = null;
            }

            setStyle(ghost, {
              borderColor: overOtherExplorer
                ? "rgba(255,200,79,0.7)"
                : overDesktop
                  ? "rgba(79,255,120,0.7)"
                  : "rgba(79,158,255,0.55)",
              boxShadow:
                overDesktop || overOtherExplorer
                  ? "0 8px 32px rgba(0,0,0,0.5),0 0 0 1px rgba(79,255,120,0.3)"
                  : "0 8px 32px rgba(0,0,0,0.5)"
            });
          });
        }
      };

      const onMouseUp = async (ev) => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        if (ghost) ghost.remove();

        if (activeDropTarget) {
          removeClass(activeDropTarget, "explorer-drop-active");
          activeDropTarget = null;
        }
        document
          .querySelectorAll(".explorer-main.explorer-drop-active")
          .forEach((el) => removeClass(el, "explorer-drop-active"));
        sharedDragState.active = false;

        if (!dragging) return;

        const explorerWin = $(`#${inst.winId}`);
        const droppedOnExplorer = explorerWin?.contains(document.elementFromPoint(ev.clientX, ev.clientY));
        if (droppedOnExplorer) return;

        const dropTargets = document.elementsFromPoint(ev.clientX, ev.clientY);
        const targetView = dropTargets.find(
          (el) => el.classList.contains("explorer-main") && el.id !== `${inst.winId}-view`
        );
        if (targetView) {
          const targetWinId = targetView.id.replace("-view", "");
          const targetInst = this.instances.get(targetWinId);
          if (targetInst) {
            const isMove = ev.ctrlKey;
            const itemsToMove = inst.selectedItems.size > 0 ? [...inst.selectedItems] : [name];

            const win = $(`#${inst.winId}`);
            const view = win?.querySelector(`#${inst.winId}-view`);

            const nameToIsFile = {};
            if (view) {
              view.querySelectorAll(".file-item").forEach((el) => {
                const n = el.querySelector("span")?.textContent;
                if (n) nameToIsFile[n] = el.dataset.isFile === "true";
              });
            }

            let count = 0;
            for (const itemName of itemsToMove) {
              const iF = nameToIsFile[itemName] ?? isFile;
              try {
                await copyItem(this, itemName, iF, inst.currentPath, targetInst.currentPath);
                if (isMove) await os.fs.delete(inst.currentPath, itemName);
                count++;
              } catch {
                os.notify.send(`Could not move/copy "${itemName}"`);
              }
            }

            if (count > 0) {
              os.notify.send(`${count} ${pluralize(count, "item")} ${isMove ? "moved" : "copied"}`);
            }

            view
              ?.querySelectorAll(".file-item.explorer-selected")
              .forEach((el) => el.classList.remove("explorer-selected"));
            inst.selectedItems = new Set();
            inst.selectedFile = null;
            await this.renderInstance(inst);
            if (targetInst !== inst) await this.renderInstance(targetInst);
            return;
          }
        }

        if (!this.desktopUI?.dropFromExplorer) return;

        const desktopEl = $("#desktop");
        if (!desktopEl) return;
        const dRect = desktopEl.getBoundingClientRect();
        const overDesktop =
          ev.clientX >= dRect.left &&
          ev.clientX <= dRect.right &&
          ev.clientY >= dRect.top &&
          ev.clientY <= dRect.bottom;
        if (!overDesktop) return;

        const win = $(`#${inst.winId}`);
        const view = win?.querySelector(`#${inst.winId}-view`);
        const nameToIsFile = {};
        if (view) {
          [...view.querySelectorAll(".file-item")].forEach((el) => {
            const n = el.querySelector("span")?.textContent;
            if (n) nameToIsFile[n] = el.dataset.isFile === "true";
          });
        }

        const itemsToMove = inst.selectedItems.size > 0 ? [...inst.selectedItems] : [name];
        for (const itemName of itemsToMove) {
          const iF = itemName === name ? isFile : (nameToIsFile[itemName] ?? isFile);
          await this.desktopUI.dropFromExplorer(itemName, iF, inst.currentPath, ev.clientX, ev.clientY);
        }

        view
          ?.querySelectorAll(".file-item.explorer-selected")
          .forEach((el) => el.classList.remove("explorer-selected"));
        inst.selectedItems = new Set();
        inst.selectedFile = null;
        await this.renderInstance(inst);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
  }

  async buildFolderStats(inst) {
    const stats = {};
    try {
      const entries = await os.fs.readdir(inst.currentPath);
      for (const [name, entry] of Object.entries(entries)) {
        if (name === "system" && inst.currentPath.length === 0) continue;
        const mtime = inst.cachedFolder?.[name]?.mtime ?? entry.mtime;
        if (entry.type === "file") {
          stats[name] = { isFile: true, size: entry.size ?? 0, mtime };
        } else {
          stats[name] = { isFile: false, size: 0, mtime };
        }
      }
    } catch {}
    return stats;
  }

  async calcDirSize(dirPath) {
    const { size } = await os.fs.calcDirSize(dirPath);
    return size;
  }

  async calcTotalStorage() {
    return this.calcDirSize([]);
  }

  async updateStorageIndicator(win, inst) {
    this.renderMountsInSidebar(win, inst);
  }

  showTrashView(inst) {
    return showTrashView(this, inst);
  }

  renderTrashView(inst, view, win) {
    return renderTrashView(this, inst, view, win);
  }

  async showDiskView(inst) {
    inst.isDiskView = true;
    inst.isTrashView = false;
    const win = $(`#${inst.winId}`);
    if (!win) return;
    const view = $(`#${inst.winId}-view`, win);
    const pathDisplay = $(`#${inst.winId}-path`, win);
    if (!view) return;
    if (pathDisplay) pathDisplay.value = "/";
    await this.renderDiskView(inst, view, win);
  }

  async renderDiskView(inst, view, win) {
    view.innerHTML = "";
    removeClass(view, "games-page");
    removeClass(view, "explorer-trash-view");
    removeClass(view, "explorer-view-grid");
    removeClass(view, "explorer-view-list");
    addClass(view, "explorer-disk-view");

    const used = await this.calcTotalStorage();
    let quota = 0;
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        quota = est.quota || 0;
      }
    } catch {}
    const pct = quota > 0 ? Math.min((used / quota) * 100, 100) : 0;

    const iconUrl = resolveIconUrl("static/icons/file.webp");
    const folderItems = [
      { path: "Desktop", label: "Desktop" },
      { path: "Documents", label: "Documents" },
      { path: "Downloads", label: "Downloads" },
      { path: "Music", label: "Music" },
      { path: "Pictures", label: "Pictures" },
      { path: "Videos", label: "Videos" }
    ];

    const mounts = os.fs.getMounts();
    const driveCount = 1 + mounts.length;

    const collapsed = os.storage.get(StorageKeys.explorerSidebarCollapsed) || {};

    let html = "";

    const hiddenFolders = new Set(os.storage.get(StorageKeys.explorerDiskViewHidden) || []);
    const visibleFolders = folderItems.filter((f) => !hiddenFolders.has(f.path));
    html += `<div class="disk-section ${collapsed.diskFolders ? "collapsed" : ""}">`;
    html += '<div class="disk-section-header" data-section="diskFolders">';
    html +=
      '<svg class="disk-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
    html += `<span>Folders (${visibleFolders.length})</span></div>`;
    html += '<div class="disk-section-body"><div class="disk-folder-grid">';
    for (const f of visibleFolders) {
      html += `<div class="disk-folder-item" data-path="${f.path}"><img src="${iconUrl}"><span>${f.label}</span></div>`;
    }
    html += "</div></div></div>";

    html += `<div class="disk-section ${collapsed.diskDrives ? "collapsed" : ""}">`;
    html += '<div class="disk-section-header" data-section="diskDrives">';
    html +=
      '<svg class="disk-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
    html += `<span>Devices and drives (${driveCount})</span></div>`;
    html += '<div class="disk-section-body"><div class="disk-drive-list">';

    html += `
      <div class="explorer-disk-card" data-path="">
        <div class="explorer-disk-card-icon"><svg viewBox="0 0 36 36" fill="none" style="width:42px;height:42px;"><rect x="3" y="9" width="30" height="20" rx="3" stroke="var(--brand)" stroke-width="1.8" fill="rgba(255,255,255,0.04)"/><rect x="7" y="13" width="22" height="6" rx="1.5" fill="var(--brand)" opacity="0.25"/><circle cx="9" cy="22" r="1.5" fill="var(--brand)" opacity="0.5"/></svg></div>
        <div class="explorer-disk-card-body">
          <div class="explorer-disk-card-name">Local Disk (C:)</div>
          <div class="explorer-disk-card-info">${formatSize(used)} used${quota > 0 ? ` of ${formatSize(quota)}` : ""}</div>
          <div class="explorer-disk-progress">
            <div class="explorer-disk-progress-fill" style="width:${pct}%"></div>
          </div>
        </div>
      </div>`;

    for (const m of mounts) {
      const mountPath = m.mountPoint;
      html += `
        <div class="explorer-disk-card" data-path="${mountPath}" data-mount-calc="${mountPath}">
          <div class="explorer-disk-card-icon"><svg viewBox="0 0 36 36" fill="none" style="width:42px;height:42px;"><rect x="3" y="9" width="30" height="20" rx="3" stroke="var(--brand)" stroke-width="1.8" fill="rgba(255,255,255,0.04)"/><rect x="7" y="13" width="22" height="6" rx="1.5" fill="var(--brand)" opacity="0.25"/><circle cx="9" cy="22" r="1.5" fill="var(--brand)" opacity="0.5"/></svg></div>
          <div class="explorer-disk-card-body">
            <div class="explorer-disk-card-name">${m.label}</div>
            <div class="explorer-disk-card-info">...</div>
            <div class="explorer-disk-progress">
              <div class="explorer-disk-progress-fill" style="width:0%"></div>
            </div>
          </div>
        </div>`;
    }

    html += "</div></div></div>";
    view.innerHTML = html;

    view.querySelectorAll(".explorer-disk-card").forEach((card) => {
      const path = card.dataset.path;
      card.onclick = () => {
        if (path === "") {
          inst.currentPath = [];
          this.renderInstance(inst);
        } else {
          this.navigateInstance(inst, path.split("/").filter(Boolean));
        }
      };
    });

    for (const card of view.querySelectorAll(".explorer-disk-card[data-mount-calc]")) {
      const mountPath = card.dataset.mountCalc;
      let mountUsed = 0;
      try {
        mountUsed = await this.calcDirSize(mountPath.split("/").filter(Boolean));
      } catch {}
      const infoEl = card.querySelector(".explorer-disk-card-info");
      const fillEl = card.querySelector(".explorer-disk-progress-fill");
      if (infoEl) infoEl.textContent = formatSize(mountUsed);
      const mPct = quota > 0 ? Math.min((mountUsed / quota) * 100, 100) : 0;
      if (fillEl) fillEl.style.width = mPct + "%";
    }

    view.querySelectorAll(".disk-folder-item").forEach((item) => {
      const path = item.dataset.path;
      const label = item.querySelector("span")?.textContent || path;
      item.onclick = () => this.navigateInstance(inst, path.split("/").filter(Boolean));
      item.oncontextmenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        showDynamicContextMenu(e, (menu, menuItem, hr) => {
          menu.appendChild(
            menuItem("Open", () => this.navigateInstance(inst, path.split("/").filter(Boolean)), "fa-folder-open")
          );
          menu.appendChild(menuItem("Open in New Window", () => this.open([path]), "fa-external-link-alt"));
          menu.appendChild(hr());
          menu.appendChild(
            menuItem(
              "Remove from Folders",
              () => {
                const hidden = os.storage.get(StorageKeys.explorerDiskViewHidden) || [];
                if (!hidden.includes(path)) hidden.push(path);
                os.storage.set(StorageKeys.explorerDiskViewHidden, hidden);
                this.renderDiskView(inst, view, win);
              },
              "fa-times"
            )
          );
        });
      };
    });

    view.querySelectorAll(".disk-section-header").forEach((header) => {
      header.onclick = () => {
        const section = header.parentElement;
        if (!section) return;
        section.classList.toggle("collapsed");
        const st = os.storage.get(StorageKeys.explorerSidebarCollapsed) || {};
        const key = header.dataset.section;
        if (key) {
          st[key] = section.classList.contains("collapsed");
          os.storage.set(StorageKeys.explorerSidebarCollapsed, st);
        }
      };
    });

    inst.isDiskView = true;
    await this.updateStorageIndicator(win, inst);
    this.updateActiveSidebar(inst);
  }

  showConfirmDialog({ title, message, confirmText = "OK", onConfirm }) {
    showConfirmDialog({ title, message, confirmText, onConfirm });
  }

  showInputDialog({ title, label, defaultValue, confirmText = "Create", onConfirm }) {
    showInputDialog({ title, label, defaultValue, confirmText, onConfirm });
  }

  showArchiveDialog({ title, defaultValue, onConfirm }) {
    showArchiveDialog({ title, defaultValue, onConfirm });
  }

  startInlineRename(itemEl, currentName, inst) {
    startInlineRename(this, itemEl, currentName, inst);
  }

  spawnInlineItem(inst, isFile) {
    spawnInlineItem(this, inst, isFile);
  }

  async updateStatusBar(inst, folder) {
    const win = $(`#${inst.winId}`);
    if (!win) return;
    const itemsEl = win.querySelector(`#${inst.winId}-status-items`);
    const selectedEl = win.querySelector(`#${inst.winId}-status-selected`);
    if (!itemsEl || !selectedEl) return;

    const totalCount = Object.keys(folder || {}).length;
    itemsEl.textContent = `${totalCount} ${pluralize(totalCount, "item")}`;

    const selCount = inst.selectedItems.size;
    if (selCount === 0) {
      selectedEl.textContent = "";
      return;
    }

    const stats = inst.cachedFolderStats || {};
    let totalSize = 0;
    for (const name of inst.selectedItems) {
      const s = stats[name];
      if (s) totalSize += s.size;
    }

    const sizeStr = formatSize(totalSize);
    selectedEl.textContent =
      selCount === 1 ? ` | 1 item selected  ${sizeStr}` : ` | ${selCount} items selected  (${sizeStr})`;
  }

  makeExplorerIconInteractable(icon) {
    this.desktopUI?.makeIconInteractable(icon, true);
  }
}
