import "../styles/explorer.css";
import { BaseApp, os } from "../framework.js";
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
  readFileAsDataURL,
  buildFileIconHTML,
  openMediaViewer,
  openFileWith,
  generateThumbnail
} from "../fileDisplay.js";
import { scheduleFileTooltip, hideFileTooltip } from "../shared/fileTooltip.js";
import { ClippyAnimation, speak } from "../ai/clippy.js";
import { ArchiveExtractor } from "../archiveExtractor.js";
import { formatSize, pluralize, isWindowFocused } from "../utils/utils.js";
import { resolveDesktopIcon } from "../shared/iconUtils.js";
import { resolveIconUrl } from "../shared/assetResolver.js";
import { AppSource } from "../AppSource.js";

import { showConfirmDialog, showInputDialog, showArchiveDialog } from "./explorer/dialogs.js";
import { showFileContextMenu, showBackgroundContextMenu } from "./explorer/contextMenus.js";
import { handleFileUpload, uploadSingleFile, saveToWallpapers, triggerFileUpload } from "./explorer/upload.js";
import { showTrashView, renderTrashView } from "./explorer/trash.js";
import { startInlineRename, spawnInlineItem } from "./explorer/inlineRename.js";
import { pasteToPath, downloadItems, createArchiveFromItems } from "./explorer/transfer.js";

export class ExplorerApp extends BaseApp {
  constructor(services) {
    super(services);
    this.fs = services.fileSystemManager;
    this.wm = services.windowManager;
    this.notepadApp = services.notepadApp;
    this.markdownApp = null;
    this.officeApp = null;
    this.browserApp = null;
    this.desktopUI = null;
    this.open = this.open.bind(this);
    this._instances = new Map();
    this._thumbnailCache = new Map();
    this._archiveExtractor = new ArchiveExtractor(this.fs, (msg) => os.notify.send(msg), AppSource.EXPLORER);
  }
  setBrowser(browserApp) {
    this.browserApp = browserApp;
  }
  setMarkdownApp(markdownApp) {
    this.markdownApp = markdownApp;
  }

  setDesktopUI(desktopUI) {
    this.desktopUI = desktopUI;
  }
  setOfficeApp(officeApp) {
    this.officeApp = officeApp;
  }
  setAppLauncher(appLauncher) {
    this.appLauncher = appLauncher;
  }
  setJsDos(jsDosApp) {
    this.jsDosApp = jsDosApp;
  }
  setv86App(v86app) {
    this.v86app = v86app;
  }

  _createInstance(winId, callback, notepadRef, mode) {
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
      _isRendering: false,
      _isTrashView: false
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

  _getClipboard() {
    return this.desktopUI?.getClipboard() ?? null;
  }
  _setClipboard(data) {
    if (this.desktopUI) this.desktopUI.setClipboard(data);
  }

  _watchWindowRemoval(winId) {
    const observer = new MutationObserver(() => {
      if (!$(`#${winId}`)) {
        this._removeInstance(winId);
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  _closeWindow(winId) {
    const win = $(`#${winId}`);
    if (win) win.remove();
    this._removeInstance(winId);
  }

  _sidebarHTML() {
    return `
      <div class="explorer-sidebar">
        <div class="start-item" data-path=""><i class="fas fa-home sidebar-icon-fa"></i>Home</div>
        <div class="start-item" data-path="Documents"><i class="fas fa-file-alt sidebar-icon-fa"></i>Documents</div>
        <div class="start-item" data-path="Desktop"><i class="fas fa-desktop sidebar-icon-fa"></i>Desktop</div>
        <div class="start-item" data-path="Pictures"><i class="fas fa-image sidebar-icon-fa"></i>Pictures</div>
        <div class="start-item" data-path="Music"><i class="fas fa-music sidebar-icon-fa"></i>Music</div>
        <div class="start-item" data-path="Videos"><i class="fas fa-video sidebar-icon-fa"></i>Videos</div>
        <div class="start-item explorer-trash-item" data-path="__trash__"><i class="fas fa-trash sidebar-icon-fa"></i>Trash</div>
        <div class="explorer-storage">
          <i class="fas fa-database"></i>
          <span class="explorer-storage-size">Calculating...</span>
        </div>
      </div>`;
  }
  _bindSidebar(win, inst) {
    $$(".explorer-sidebar .start-item", win).forEach((item) => {
      const rawPath = item.dataset.path;
      if (rawPath === "__trash__") {
        item.onclick = () => showTrashView(this, inst);
      } else {
        item.onclick = () => this.navigateInstance(inst, rawPath.split("/").filter(Boolean));
      }
    });
  }

  _bindBackButton(win, inst) {
    $(`#${inst.winId}-back`, win).onclick = async () => {
      if (inst.historyIndex > 0) {
        inst.historyIndex--;
        inst.currentPath = [...inst.history[inst.historyIndex]];
        await this.renderInstance(inst);
      }
    };
  }

  _initExplorerView(win, winId) {
    const view = $(`#${winId}-view`, win);
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

    const inst = this._createInstance(winId, callback, notepadRef, isSelector ? "select" : "browse");
    const title = isSelector ? "Select File" : "File Explorer";
    const win = os.window.create(winId, title, options.width || "700px", options.height || "500px", {
      ...options,
      icon: "static/icons/file.webp"
    });
    addClass(win, "explorer-window");

    win.innerHTML = `
      <div class="explorer-nav">
        <div class="back-btn" id="${winId}-back">← Back</div>
        <div class="back-btn" id="${winId}-next" style="margin-left:4px">→ Next</div>
        <input
          type="text"
          class="explorer-win-path"
          id="${winId}-path"
          spellcheck="false"
        >
        <input
          type="text"
          id="${winId}-search"
          placeholder="Search..."
          spellcheck="false"
          style="
            margin-left:auto;padding:4px 10px;border-radius:5px;
            border:1px solid rgba(255,255,255,0.15);
            background:transparent;color:#fff;font-size:12px;
            outline:none;font-family:inherit;width:160px;
          "
        >
        ${
          isSelector
            ? ""
            : `
        <div class="explorer-upload-area" id="${winId}-upload-area">
          <label class="explorer-upload-btn" title="Upload files">
            ⬆ Upload
            <input type="file" id="${winId}-file-input" multiple style="display:none">
          </label>
          <label class="explorer-upload-btn" title="Upload folder" style="margin-left:4px">
            📁 Folder
            <input type="file" id="${winId}-folder-input" multiple webkitdirectory style="display:none">
          </label>
        </div>`
        }
      </div>
      <div class="explorer-container">
        ${this._sidebarHTML()}
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
      <div id="${winId}-status-bar" style="
        display:flex;align-items:center;gap:0;
        padding:4px 12px;
        background:rgba(79, 158, 255, 0.1);
        border-top:1px solid rgba(79, 158, 255, 0.15);
        flex-shrink:0;font-size:11px;color:rgba(255,255,255,0.6);
        min-height:24px;
      ">
        <span id="${winId}-status-items"></span>
        <span id="${winId}-status-selected" style="margin-left:auto"></span>
      </div>
      <div id="${winId}-upload-progress" style="display:none;position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.7);color:#fff;font-size:12px;padding:6px 10px;z-index:10;border-radius:0 0 6px 6px;">
        Uploading...
      </div>`
      }
    `;

    this._initExplorerView(win, winId);

    this._watchWindowRemoval(winId);

    this.setupExplorerControls(win, winId);
    this.navigateInstance(inst, path);
  }

  async openSaveDialog(defaultFileName = "Untitled.txt", onSave = null) {
    const winId = `explorer-save-${Date.now()}`;
    const inst = this._createInstance(winId, null, null, "save");
    inst.saveCallback = onSave;

    const win = os.window.create(winId, "Save As", "700px", "540px", {
      icon: "static/icons/file.webp"
    });
    addClass(win, "explorer-window");

    win.innerHTML = `
      <div class="explorer-nav">
        <div class="back-btn" id="${winId}-back">← Back</div>
        <input
          type="text"
          class="explorer-win-path"
          id="${winId}-path"
          spellcheck="false"
        >
      </div>
      <div class="explorer-container">
        <div class="explorer-sidebar">
          <div class="start-item" data-path=""><img src="${resolveIconUrl("static/icons/file.webp")}" class="sidebar-icon">Home</div>
          <div class="start-item" data-path="Documents"><img src="${resolveIconUrl("static/icons/notepad.webp")}" class="sidebar-icon">Documents</div>
          <div class="start-item" data-path="Desktop"><i class="fas fa-desktop sidebar-icon-fa"></i>Desktop</div>
          <div class="start-item" data-path="Pictures"><i class="fas fa-image sidebar-icon-fa"></i>Pictures</div>
          <div class="explorer-storage">
            <i class="fas fa-database"></i>
            <span class="explorer-storage-size">Calculating...</span>
          </div>
        </div>
        <div class="explorer-main" id="${winId}-view"></div>
      </div>
      <div id="${winId}-save-bar" style="
        display:flex;align-items:center;gap:8px;
        padding:8px 12px;
        background:rgba(79, 158, 255, 0.08);
        border-top:1px solid rgba(79, 158, 255, 0.15);
        flex-shrink:0;
      ">
        <label style="color:#aaa;font-size:12px;white-space:nowrap;">File name:</label>
        <input
          id="${winId}-filename-input"
          type="text"
          value="${defaultFileName}"
          spellcheck="false"
          style="
            flex:1;padding:6px 10px;border-radius:5px;
            border:1px solid rgba(255,255,255,0.15);
            background:transparent;color:#fff;font-size:13px;
            outline:none;font-family:inherit;
          "
        >
        <button id="${winId}-save-btn" style="
          padding:6px 18px;border-radius:5px;border:none;
          background:#2a6db5;color:#fff;font-size:13px;
          cursor:pointer;font-family:inherit;white-space:nowrap;
        ">Save</button>
        <button id="${winId}-cancel-btn" style="
          padding:6px 14px;border-radius:5px;border:none;
          background:rgba(255,255,255,0.08);color:#ccc;font-size:13px;
          cursor:pointer;font-family:inherit;
        ">Cancel</button>
      </div>
    `;

    this._initExplorerView(win, winId);

    this._watchWindowRemoval(winId);

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
        fileNameInput.style.borderColor = "#e06c75";
        fileNameInput.focus();
        return;
      }
      const cb = inst.saveCallback;
      inst.saveCallback = null;
      this._closeWindow(winId);
      if (cb) cb(inst.currentPath, fileName);
    };

    cancelBtn.onclick = () => this._closeWindow(winId);

    this._bindBackButton(win, inst);
    this._bindSidebar(win, inst);
    this._setupPathInput(win, inst);
    this.navigateInstance(inst, []);
  }

  async openDirectoryDialog(onSelect = null) {
    const winId = `explorer-dir-${Date.now()}`;
    const inst = this._createInstance(winId, null, null, "directory");
    inst.directoryCallback = onSelect;

    const win = os.window.create(winId, "Select Directory", "700px", "500px", {
      icon: "static/icons/file.webp"
    });
    addClass(win, "explorer-window");

    win.innerHTML = `
      <div class="explorer-nav">
        <div class="back-btn" id="${winId}-back">← Back</div>
        <input
          type="text"
          class="explorer-win-path"
          id="${winId}-path"
          spellcheck="false"
        >
      </div>
      <div class="explorer-container">
        <div class="explorer-sidebar">
          <div class="start-item" data-path=""><img src="${resolveIconUrl("static/icons/file.webp")}" class="sidebar-icon">Home</div>
          <div class="start-item" data-path="Documents"><img src="${resolveIconUrl("static/icons/notepad.webp")}" class="sidebar-icon">Documents</div>
          <div class="start-item" data-path="Desktop"><i class="fas fa-desktop sidebar-icon-fa"></i>Desktop</div>
          <div class="start-item" data-path="Pictures"><i class="fas fa-image sidebar-icon-fa"></i>Pictures</div>
          <div class="start-item" data-path="Downloads"><i class="fas fa-download sidebar-icon-fa"></i>Downloads</div>
          <div class="explorer-storage">
            <i class="fas fa-database"></i>
            <span class="explorer-storage-size">Calculating...</span>
          </div>
        </div>
        <div class="explorer-main" id="${winId}-view"></div>
      </div>
      <div id="${winId}-dir-bar" style="
        display:flex;align-items:center;gap:8px;
        padding:8px 12px;
        background:rgba(79, 158, 255, 0.08);
        border-top:1px solid rgba(79, 158, 255, 0.15);
        flex-shrink:0;
      ">
        <label style="color:#aaa;font-size:12px;white-space:nowrap;">Selected:</label>
        <span id="${winId}-selected-path" style="
          flex:1;color:#fff;font-size:13px;
          font-family:inherit;overflow:hidden;
          text-overflow:ellipsis;white-space:nowrap;
        ">/</span>
        <button id="${winId}-select-btn" style="
          padding:6px 18px;border-radius:5px;border:none;
          background:#2a6db5;color:#fff;font-size:13px;
          cursor:pointer;font-family:inherit;white-space:nowrap;
        ">Select</button>
        <button id="${winId}-cancel-btn" style="
          padding:6px 14px;border-radius:5px;border:none;
          background:rgba(255,255,255,0.08);color:#ccc;font-size:13px;
          cursor:pointer;font-family:inherit;
        ">Cancel</button>
      </div>
    `;

    this._initExplorerView(win, winId);

    this._watchWindowRemoval(winId);

    const selectedPathEl = $(`#${winId}-selected-path`, win);
    const selectBtn = $(`#${winId}-select-btn`, win);
    const cancelBtn = $(`#${winId}-cancel-btn`, win);

    const updateSelectedPath = () => {
      selectedPathEl.textContent = "/" + inst.currentPath.join("/");
    };

    selectBtn.onclick = () => {
      const cb = inst.directoryCallback;
      inst.directoryCallback = null;
      this._closeWindow(winId);
      if (cb) cb(inst.currentPath);
    };

    cancelBtn.onclick = () => this._closeWindow(winId);

    this._bindBackButton(win, inst);
    this._bindSidebar(win, inst);
    this._setupPathInput(win, inst);

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
    const inst = this._getInstance(winId);

    this._bindBackButton(win, inst);
    this._setupPathInput(win, inst);

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

    const searchInput = $(`#${winId}-search`, win);
    if (searchInput) {
      bindEvents(searchInput, {
        input: () => {
          const query = searchInput.value.toLowerCase();
          $$(".file-item", $(`#${winId}-view`, win)).forEach((item) => {
            const name = item.querySelector("span")?.textContent?.toLowerCase() || "";
            item.style.display = name.includes(query) ? "" : "none";
          });
        },
        keydown: (e) => e.stopPropagation()
      });
    }

    this._bindSidebar(win, inst);

    const viewEl = $(`#${winId}-view`, win);
    bindEvent(viewEl, "contextmenu", (e) => {
      if (e.target === viewEl) showBackgroundContextMenu(this, e, inst);
    });

    const lastMousePos = { x: 0, y: 0 };
    bindEvent(win, "mousemove", (e) => {
      lastMousePos.x = e.clientX;
      lastMousePos.y = e.clientY;
    });

    const explorerKeyHandler = (e) => {
      if (!$(`#${winId}`)) {
        document.removeEventListener("keydown", explorerKeyHandler);
        return;
      }
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)) return;
      if (!isWindowFocused(winId, lastMousePos)) return;

      if (KeybindManager.matches(e, "desktop.paste")) {
        e.preventDefault();
        pasteToPath(this, inst.currentPath, inst);
        return;
      }

      if (!e.ctrlKey) return;

      if (KeybindManager.matches(e, "desktop.copy")) {
        e.preventDefault();
      } else if (KeybindManager.matches(e, "desktop.cut")) {
        e.preventDefault();
      } else {
        return;
      }

      if (!inst.selectedItems.size) return;

      const action = KeybindManager.matches(e, "desktop.cut") ? "cut" : "copy";
      const view = $(`#${winId}-view`, win);
      const icons = [...inst.selectedItems]
        .map((name) => {
          const el = view ? $$(".file-item", view).find((el) => el.querySelector("span")?.textContent === name) : null;
          return { name, isFile: el?.dataset.isFile === "true" ?? true };
        })
        .map(({ name, isFile }) => ({
          element: null,
          data: { name, path: inst.currentPath, isFile }
        }));

      this._setClipboard({ action, items: icons, sourcePath: inst.currentPath });
    };
    document.addEventListener("keydown", explorerKeyHandler);

    const renameKeyHandler = (e) => {
      if (!$(`#${winId}`)) {
        document.removeEventListener("keydown", renameKeyHandler);
        return;
      }
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)) return;
      if (!isWindowFocused(winId, lastMousePos) || !KeybindManager.matches(e, "desktop.rename")) return;
      e.preventDefault();

      const selectedName = inst.selectedFile || (inst.selectedItems.size === 1 ? [...inst.selectedItems][0] : null);
      if (!selectedName) return;

      const view = $(`#${winId}-view`, win);
      const itemEl =
        view && $$(".file-item", view).find((el) => el.querySelector("span")?.textContent === selectedName);
      if (itemEl) startInlineRename(this, itemEl, selectedName, inst);
    };
    document.addEventListener("keydown", renameKeyHandler);

    this._setupSelectionBox(win, winId);
    this._setupDropZone(win, winId);
    this._setupUploadInputs(win, winId, inst);
  }

  _setupPathInput(win, inst) {
    const pathInput = $(`#${inst.winId}-path`, win);
    if (!pathInput || pathInput.tagName !== "INPUT") return;

    bindEvents(pathInput, {
      keydown: async (e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          const val = pathInput.value.trim();
          if (!val || val === "/") {
            this.navigateInstance(inst, []);
            return;
          }

          const targetParts = val.split("/").filter(Boolean);
          const userDir = this.fs.resolveUserPath(targetParts);
          try {
            const exists = await os.fs.exists(userDir);
            if (exists) {
              const stat = await this.fs.pStat(userDir);
              if (stat.isDirectory()) {
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
        } else if (e.key === "Escape") {
          pathInput.value = "/" + inst.currentPath.join("/");
          pathInput.blur();
        }
      },
      focus: () => {
        pathInput.select();
      }
    });
  }

  _ensureSelBox(view) {
    if (view.querySelector(".explorer-selbox")) return;
    const selBox = createElement("div", { className: "explorer-selbox" });
    setStyle(view, { position: "relative" });
    view.appendChild(selBox);
  }

  _setupSelectionBox(win, winId) {
    const view = $(`#${winId}-view`, win);
    this._ensureSelBox(view);

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

    view.addEventListener("mousemove", (e) => {
      if (!selState.active) return;
      const i = this._getInstance(winId);
      if (!i) return;
      const rect = view.getBoundingClientRect();
      const curX = e.clientX - rect.left + view.scrollLeft;
      const curY = e.clientY - rect.top + view.scrollTop;
      const x = Math.min(curX, selState.startX);
      const y = Math.min(curY, selState.startY);
      const w = Math.abs(curX - selState.startX);
      const h = Math.abs(curY - selState.startY);

      const sb = view.querySelector(".explorer-selbox");
      if (sb) setStyle(sb, { left: x + "px", top: y + "px", width: w + "px", height: h + "px" });

      const boxRect = { left: x, top: y, right: x + w, bottom: y + h };

      if (!e.ctrlKey) {
        $$(".file-item.explorer-selected", view).forEach((el) => removeClass(el, "explorer-selected"));
        i.selectedItems = new Set();
      }

      $$(".file-item", view).forEach((item) => {
        const r = item.getBoundingClientRect();
        const vr = view.getBoundingClientRect();
        const ir = {
          left: r.left - vr.left + view.scrollLeft,
          top: r.top - vr.top + view.scrollTop,
          right: r.right - vr.left + view.scrollLeft,
          bottom: r.bottom - vr.top + view.scrollTop
        };
        const overlaps = !(
          ir.right < boxRect.left ||
          ir.left > boxRect.right ||
          ir.bottom < boxRect.top ||
          ir.top > boxRect.bottom
        );
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

      this._updateStatusBar(i, i._cachedFolder);
    });

    const endSel = () => {
      selState.active = false;
      const sb = view.querySelector(".explorer-selbox");
      if (sb) setStyle(sb, { display: "none" });
    };
    view.addEventListener("mouseup", endSel);
    document.addEventListener("mouseup", endSel);
  }

  _setupDropZone(win, winId) {
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

  _setupUploadInputs(win, winId, inst) {
    const fileInput = $(`#${winId}-file-input`, win);
    const folderInput = $(`#${winId}-folder-input`, win);
    if (fileInput) {
      fileInput.addEventListener("change", async (e) => {
        await handleFileUpload(this, Array.from(e.target.files), false, win, inst);
        e.target.value = "";
      });
    }
    if (folderInput) {
      folderInput.addEventListener("change", async (e) => {
        await handleFileUpload(this, Array.from(e.target.files), true, win, inst);
        e.target.value = "";
      });
    }
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
    const inst = [...this._instances.values()][0];
    if (inst) return this.navigateInstance(inst, path);
  }

  navigateInstance(inst, path) {
    if (typeof path === "string") {
      const root = this.fs.CONFIG.ROOT;
      if (path.startsWith(root)) {
        path = path.slice(root.length).split("/").filter(Boolean);
      } else {
        path = path.split("/").filter(Boolean);
      }
    }
    inst._isTrashView = false;
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
    const inst = [...this._instances.values()][0];
    if (inst) await this.renderInstance(inst);
  }

  async renderInstance(inst) {
    if (inst._isRendering) return;
    inst._isRendering = true;

    const win = $(`#${inst.winId}`);
    if (!win) {
      inst._isRendering = false;
      return;
    }
    const view = $(`#${inst.winId}-view`, win);
    const pathDisplay = $(`#${inst.winId}-path`, win);
    if (!view) {
      inst._isRendering = false;
      return;
    }

    view.innerHTML = "";
    removeClass(view, "games-page");
    removeClass(view, "explorer-trash-view");
    this._ensureSelBox(view);
    if (pathDisplay) {
      if (pathDisplay.tagName === "INPUT") {
        pathDisplay.value = "/" + inst.currentPath.join("/");
      } else {
        pathDisplay.textContent = "/" + inst.currentPath.join("/");
      }
    }

    const folder = await os.fs.readdir(inst.currentPath);
    inst._cachedFolder = folder;
    if (inst.mode === "browse") inst._cachedFolderStats = await this._buildFolderStats(inst);

    const entries = Object.entries(folder).filter(([name]) => {
      if (name === "system" && inst.currentPath.length === 0) return false;
      if (name === ".trash" && inst.currentPath.length === 0) return false;
      return true;
    });
    const items = await Promise.all(
      entries.map(async ([name, itemData]) => {
        const isFile = itemData?.type === "file";
        const iconEl = await this._buildItemIconHTML(name, isFile, itemData, inst);
        return { name, isFile, iconEl };
      })
    );

    for (const { name, isFile, iconEl } of items) {
      const item = createElement("div", { className: "file-item" });
      item.dataset.isFile = isFile ? "true" : "false";
      setHTML(item, `${iconEl}<span>${name}</span>`);
      this._bindItemInteractions(item, name, isFile, inst, win);
      view.appendChild(item);
    }

    if (Object.keys(folder).length === 0 && inst.mode === "browse") {
      speak("This folder is empty. Want me to help you organize?", ClippyAnimation.Searching);
    }

    if (inst.mode === "browse") await this._updateStatusBar(inst, folder);
    if (inst.mode === "select") this._bindSelectBarButton(inst);
    await this._updateStorageIndicator(win);

    inst._isRendering = false;
  }

  async _buildItemIconHTML(name, isFile, itemData, inst) {
    if (!isFile) {
      return `<img src="${resolveIconUrl("static/icons/file.webp")}" style="width:64px;height:64px;object-fit:cover;border-radius:8px">`;
    }

    if (name.endsWith(".desktop")) {
      const raw = await this.fs.getFileContent(inst.currentPath, name);
      const iconSrc = resolveDesktopIcon(raw, name);
      return buildFileIconHTML(name, { storedIcon: iconSrc });
    }

    let thumbnailSrc = null;
    if (isImageFile(name)) {
      const cacheKey = inst.currentPath.join("/") + "/" + name;
      const cached = this._thumbnailCache.get(cacheKey);
      if (cached) {
        thumbnailSrc = cached;
      } else {
        try {
          const content = await this.fs.getFileContent(inst.currentPath, name);
          const src = content instanceof Blob ? await readFileAsDataURL(content) : content;
          thumbnailSrc = await generateThumbnail(src);
          if (thumbnailSrc) this._thumbnailCache.set(cacheKey, thumbnailSrc);
        } catch (e) {
          console.error("Failed to load image thumbnail:", e);
        }
      }
    }

    return buildFileIconHTML(name, { thumbnailSrc, storedIcon: itemData.faIcon || itemData.icon });
  }

  _bindItemInteractions(item, name, isFile, inst, win) {
    if (inst.mode === "select") {
      if (isFile) {
        item.onclick = () => this._selectFile(inst, name, item);
        item.ondblclick = () => this._confirmSelection(inst);
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
        if (e.detail === 1) this._selectExplorerItem(inst, name, item, e.ctrlKey);
      };
      item.ondblclick = () => this.openItemForInstance(inst, name, isFile);
      item.oncontextmenu = (e) => showFileContextMenu(this, e, name, isFile, inst);
      this._setupExplorerItemDrag(item, name, isFile, inst);
    }

    item.addEventListener("mouseenter", (e) => {
      scheduleFileTooltip(e, inst.currentPath, name, !isFile);
    });
    item.addEventListener("mouseleave", () => hideFileTooltip());
  }

  _selectFile(inst, name, itemEl) {
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

  _bindSelectBarButton(inst) {
    const win = $(`#${inst.winId}`);
    const btn = win && $(`#${inst.winId}-select-btn`, win);
    if (btn) btn.onclick = () => this._confirmSelection(inst);
  }

  _confirmSelection(inst) {
    if (!inst.selectedFile || !inst.fileSelectCallback) return;
    const cb = inst.fileSelectCallback;
    inst.fileSelectCallback = null;
    this._closeWindow(inst.winId);
    cb(inst.currentPath, inst.selectedFile);
  }

  async openItem(name, isFile) {
    const inst = [...this._instances.values()][0];
    if (inst) await this.openItemForInstance(inst, name, isFile);
  }

  async openItemForInstance(inst, name, isFile) {
    if (!isFile) {
      this.navigateInstance(inst, [...inst.currentPath, name]);
      return;
    }

    if (name.endsWith(".desktop") && this.appLauncher) {
      try {
        const raw = await this.fs.getFileContent(inst.currentPath, name);
        const content = JSON.parse(raw);
        if (content && content.app) {
          const { trigger: triggerCursorEffect } = await import("../cursorEffect.js");
          triggerCursorEffect(content.icon || "fa-solid fa-cube");
          os.app.launch(content.app);
        } else if (content && content.type === "youtube-embed") {
          const { trigger: triggerCursorEffect } = await import("../cursorEffect.js");
          triggerCursorEffect("fa-brands fa-youtube");
          this._openYouTubeEmbedDesktop(content);
        }
      } catch (e) {
        console.error("Failed to parse desktop file JSON:", e);
      }
      return;
    }

    const { trigger: triggerCursorEffect } = await import("../cursorEffect.js");
    triggerCursorEffect();
    await openFileWith({
      name,
      path: [...inst.currentPath],
      fs: this.fs,
      notepadApp: this.notepadApp,
      browserApp: this.browserApp,
      windowManager: this.wm,
      officeApp: this.officeApp,
      markdownApp: this.markdownApp,
      jsDosApp: this.jsDosApp,
      appLauncher: this.appLauncher
    });
  }

  openMediaViewer(name, src, kind) {
    openMediaViewer(name, src, kind, this.wm);
  }

  _openYouTubeEmbedDesktop(content) {
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

  _pasteToPath(destPath, inst) {
    return pasteToPath(this, destPath, inst);
  }

  async _downloadItems(itemName, isFile, inst) {
    await downloadItems(this, itemName, isFile, inst);
  }

  async _createArchiveFromItems(itemName, isFile, inst) {
    await createArchiveFromItems(this, itemName, isFile, inst);
  }

  showFileContextMenu(e, itemName, isFile, inst) {
    showFileContextMenu(this, e, itemName, isFile, inst);
  }

  showBackgroundContextMenu(e, inst) {
    showBackgroundContextMenu(this, e, inst);
  }

  _triggerFileUpload(inst) {
    triggerFileUpload(this, inst);
  }

  _selectExplorerItem(inst, name, itemEl, isCtrl) {
    const win = document.getElementById(inst.winId);
    if (!win) return;

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

    inst.selectedFile = name;
    if (this.desktopUI) this.desktopUI.lastFocusedContext = "explorer";
    if (inst.mode === "browse") this._updateStatusBar(inst, inst._cachedFolder);
  }

  _setupExplorerItemDrag(itemEl, name, isFile, inst) {
    itemEl.addEventListener("mousedown", (e) => {
      if (e.button !== 0 || e.target.tagName === "INPUT") return;

      const startX = e.clientX;
      const startY = e.clientY;
      let ghost = null;
      let dragging = false;

      const onMouseMove = (ev) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;

        if (!dragging && Math.sqrt(dx * dx + dy * dy) > 6) {
          dragging = true;
          if (!inst.selectedItems.has(name)) this._selectExplorerItem(inst, name, itemEl, false);

          const win = document.getElementById(inst.winId);
          const view = win?.querySelector(`#${inst.winId}-view`);
          const selectedEls = view ? [...view.querySelectorAll(".file-item.explorer-selected")] : [itemEl];

          ghost = document.createElement("div");
          ghost.className = "explorer-drag-ghost";
          const iconEl = (selectedEls[0] || itemEl).querySelector("img")?.cloneNode() || document.createElement("div");
          iconEl.className = "explorer-ghost-icon";
          const label = document.createElement("div");
          label.className = "explorer-file-label";
          label.textContent = selectedEls.length > 1 ? `${selectedEls.length} items` : name;
          ghost.appendChild(iconEl);
          ghost.appendChild(label);
          ghost.style.left = ev.clientX - 50 + "px";
          ghost.style.top = ev.clientY - 30 + "px";
          document.body.appendChild(ghost);
        }

        if (dragging && ghost) {
          ghost.style.left = ev.clientX - 50 + "px";
          ghost.style.top = ev.clientY - 30 + "px";

          const explorerWin = document.getElementById(inst.winId);
          const overDesktop = !explorerWin?.contains(document.elementFromPoint(ev.clientX, ev.clientY));
          ghost.style.borderColor = overDesktop ? "rgba(79,255,120,0.7)" : "rgba(79,158,255,0.55)";
          ghost.style.boxShadow = overDesktop
            ? "0 8px 32px rgba(0,0,0,0.5),0 0 0 1px rgba(79,255,120,0.3)"
            : "0 8px 32px rgba(0,0,0,0.5)";
        }
      };

      const onMouseUp = async (ev) => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        if (ghost) ghost.remove();
        if (!dragging) return;

        const explorerWin = document.getElementById(inst.winId);
        const droppedOnExplorer = explorerWin?.contains(document.elementFromPoint(ev.clientX, ev.clientY));
        if (droppedOnExplorer || !this.desktopUI?.dropFromExplorer) return;

        const desktopEl = document.getElementById("desktop");
        if (!desktopEl) return;
        const dRect = desktopEl.getBoundingClientRect();
        const overDesktop =
          ev.clientX >= dRect.left &&
          ev.clientX <= dRect.right &&
          ev.clientY >= dRect.top &&
          ev.clientY <= dRect.bottom;
        if (!overDesktop) return;

        const win = document.getElementById(inst.winId);
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

  async _buildFolderStats(inst) {
    const dir = this.fs.resolveUserPath(inst.currentPath);
    const stats = {};
    try {
      const meta = await this.fs.readMeta(dir);
      const entries = await this.fs.pRead("readdir", dir);
      for (const name of entries) {
        if (name === this.fs.CONFIG.META_FILE) continue;
        if (name === "system" && inst.currentPath.length === 0) continue;
        try {
          const full = this.fs.join(dir, name);
          const s = await this.fs.pStat(full);
          if (s.isFile()) {
            stats[name] = { isFile: true, size: meta[name]?.size ?? s.size ?? 0 };
          } else {
            stats[name] = { isFile: false, size: await this._calcDirSize(full) };
          }
        } catch {}
      }
    } catch {}
    return stats;
  }

  async _calcDirSize(dirPath) {
    let total = 0;
    try {
      const entries = await this.fs.pRead("readdir", dirPath);
      const meta = await this.fs.readMeta(dirPath);
      for (const name of entries) {
        if (name === this.fs.CONFIG.META_FILE) continue;
        try {
          const full = this.fs.join(dirPath, name);
          const s = await this.fs.pStat(full);
          total += s.isFile() ? (meta[name]?.size ?? s.size ?? 0) : await this._calcDirSize(full);
        } catch {}
      }
    } catch {}
    return total;
  }

  async _calcTotalStorage() {
    return this._calcDirSize(this.fs.resolveUserPath([]));
  }

  async _updateStorageIndicator(win) {
    const el = win?.querySelector(".explorer-storage-size");
    if (!el) return;
    try {
      const total = await this._calcTotalStorage();
      el.textContent = formatSize(total);
    } catch {
      el.textContent = "—";
    }
  }

  _showTrashView(inst) {
    return showTrashView(this, inst);
  }

  _renderTrashView(inst, view, win) {
    return renderTrashView(this, inst, view, win);
  }

  _showConfirmDialog({ title, message, confirmText = "OK", onConfirm }) {
    showConfirmDialog({ title, message, confirmText, onConfirm });
  }

  _showInputDialog({ title, label, defaultValue, confirmText = "Create", onConfirm }) {
    showInputDialog({ title, label, defaultValue, confirmText, onConfirm });
  }

  _showArchiveDialog({ title, defaultValue, onConfirm }) {
    showArchiveDialog({ title, defaultValue, onConfirm });
  }

  _startInlineRename(itemEl, currentName, inst) {
    startInlineRename(this, itemEl, currentName, inst);
  }

  _spawnInlineItem(inst, isFile) {
    spawnInlineItem(this, inst, isFile);
  }

  async _updateStatusBar(inst, folder) {
    const win = document.getElementById(inst.winId);
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

    const stats = inst._cachedFolderStats || {};
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
