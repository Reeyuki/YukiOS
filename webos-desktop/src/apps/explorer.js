import "../styles/explorer.css";
import { BaseApp, os } from "../framework.js";
import { FileKind } from "../fs.js";
import { SystemUtilities } from "../system.js";
import { resolveGhUrl } from "../shared/assetResolver.js";
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
  fileKindFromName,
  isImageFile,
  isOfficeFile,
  isWallpaperPath,
  readFileAsDataURL,
  readFileAsText,
  resolveFileIcon,
  buildFileIconHTML,
  openMediaViewer,
  openFileWith,
  isExeFile,
  isSwfFile,
  isZipFile,
  generateThumbnail,
  showFileProperties
} from "../fileDisplay.js";
import { showConflictDialog } from "../shared/conflictDialog.js";
import { showDynamicContextMenu } from "../shared/contextMenu.js";
import { scheduleFileTooltip, hideFileTooltip } from "../shared/fileTooltip.js";
import { ClippyAnimation, speak } from "../ai/clippy.js";
import { ArchiveExtractor } from "../archiveExtractor.js";
import {
  formatSize,
  pluralize,
  isArchiveFile,
  decodeFileContent,
  buildClipboardIcons,
  isWindowFocused,
  splitWebkitPath
} from "../utils/utils.js";
import { Achievements } from "../achievements.js";
import { resolveDesktopIcon } from "../shared/iconUtils.js";
import { resolveIconUrl } from "../shared/assetResolver.js";
import { AppSource } from "../AppSource.js";

const BINARY_OFFICE_EXTS = [".pdf", ".docx", ".xlsx", ".xls", ".pptx", ".ppt"];
const ARCHIVE_EXTS = [".zip", ".gz", ".tgz", ".tar", ".rar", ".7z", ".bz2", ".xz"];

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
        item.onclick = () => this._showTrashView(inst);
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
      if (e.target === viewEl) this.showBackgroundContextMenu(e, inst);
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
        this._pasteToPath(inst.currentPath, inst);
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
      if (itemEl) this._startInlineRename(itemEl, selectedName, inst);
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
        await this.handleFileUpload(Array.from(e.target.files), false, win, inst);
        e.target.value = "";
      });
    }
    if (folderInput) {
      folderInput.addEventListener("change", async (e) => {
        await this.handleFileUpload(Array.from(e.target.files), true, win, inst);
        e.target.value = "";
      });
    }
  }

  _isBinaryWrite(kind, isBinaryOffice, isBinary) {
    return kind === FileKind.VIDEO || isBinaryOffice || isBinary;
  }

  async _resolveFilePayload(file, name) {
    const kind = fileKindFromName(name);
    const icon = resolveFileIcon(name);
    const isBinaryOffice =
      isOfficeFile(name) && BINARY_OFFICE_EXTS.includes(name.substring(name.lastIndexOf(".")).toLowerCase());
    const isBinary =
      isBinaryOffice ||
      ARCHIVE_EXTS.some((ext) => name.toLowerCase().endsWith(ext)) ||
      kind === FileKind.IMAGE ||
      kind === FileKind.AUDIO ||
      kind === FileKind.VIDEO ||
      kind === FileKind.ROM ||
      isExeFile(name) ||
      isSwfFile(name) ||
      isZipFile(name);
    let content;
    if (this._isBinaryWrite(kind, isBinaryOffice, isBinary)) {
      content = file;
    } else {
      try {
        content = await readFileAsText(file);
      } catch {
        content = await readFileAsDataURL(file);
      }
    }
    return { kind, content, icon, isBinaryOffice, isBinary };
  }

  async _saveFilePayload(targetPath, name, kind, content, icon, isBinaryOffice = false, isBinary = false) {
    os.events.emit("desktop:icon-added", { name, kind });
    if (this._isBinaryWrite(kind, isBinaryOffice, isBinary)) {
      await os.fs.writeBinaryFile(targetPath, name, content, kind, icon);
    } else {
      await os.fs.createFile(targetPath, name, content, kind, icon);
    }
  }

  async _replaceFilePayload(targetPath, name, kind, content, icon, isBinaryOffice = false, isBinary = false) {
    if (this._isBinaryWrite(kind, isBinaryOffice, isBinary)) {
      await os.fs.deleteBinaryFile(targetPath, name).catch(() => {});
      await os.fs.writeBinaryFile(targetPath, name, content, kind, icon);
    } else {
      await os.fs.updateFile(targetPath, name, content, { kind, icon });
    }
  }

  async _resolveConflictAction(name, applyToAllAction) {
    if (applyToAllAction) return { action: applyToAllAction, applyToAll: false };
    return showConflictDialog(name);
  }

  async handleFileUpload(files, isFolder, win, inst) {
    if (!files.length) return;
    const targetPath = inst ? inst.currentPath : ["Desktop"];
    const progressEl = inst ? $(`#${inst.winId}-upload-progress`, win) : null;
    if (progressEl) setStyle(progressEl, { display: "block" });

    let applyToAllAction = null;
    let uploadedCount = 0;
    let skippedCount = 0;

    try {
      let flatFiles;

      if (isFolder) {
        const pathMap = new Map();
        for (const file of files) {
          const { parts, fileName } = splitWebkitPath(file);
          const subPath = [...targetPath, ...parts];
          const key = subPath.join("/");
          if (!pathMap.has(key)) pathMap.set(key, { path: subPath, files: [] });
          pathMap.get(key).files.push({ file, fileName });
        }
        flatFiles = [];
        const sortedEntries = [...pathMap.values()].sort((a, b) => a.path.length - b.path.length);
        for (const { path, files: grouped } of sortedEntries) {
          await os.fs.mkdir(path);
          for (const { file, fileName } of grouped) {
            flatFiles.push({ file, targetPath: path, name: fileName });
          }
        }
      } else {
        flatFiles = files.map((file) => ({ file, targetPath: targetPath, name: file.name }));
      }

      for (const { file, targetPath, name } of flatFiles) {
        if (isWallpaperPath(targetPath)) {
          const { kind, content, icon } = await this._resolveFilePayload(file, name);
          await this.saveToWallpapers(name, content, kind, icon);
          uploadedCount++;
          continue;
        }

        const existingPath = this.fs.join(this.fs.resolveUserPath(targetPath), name);
        const exists = await os.fs.exists(existingPath);
        const payload = await this._resolveFilePayload(file, name);

        if (!exists) {
          await this._saveFilePayload(
            targetPath,
            name,
            payload.kind,
            payload.content,
            payload.icon,
            payload.isBinaryOffice,
            payload.isBinary
          );
          uploadedCount++;
          continue;
        }

        const result = await this._resolveConflictAction(name, applyToAllAction);
        if (result.applyToAll) applyToAllAction = result.action;

        if (result.action === "skip") {
          skippedCount++;
          continue;
        }

        if (result.action === "replace") {
          await this._replaceFilePayload(
            targetPath,
            name,
            payload.kind,
            payload.content,
            payload.icon,
            payload.isBinaryOffice,
            payload.isBinary
          );
        } else {
          await this._saveFilePayload(
            targetPath,
            name,
            payload.kind,
            payload.content,
            payload.icon,
            payload.isBinaryOffice,
            payload.isBinary
          );
        }
        uploadedCount++;
      }

      const parts = [];
      if (uploadedCount > 0) parts.push(`${uploadedCount} ${pluralize(uploadedCount, "file")} uploaded`);
      if (skippedCount > 0) parts.push(`${skippedCount} skipped`);
      if (parts.length) os.notify.send(parts.join(", "));
    } finally {
      if (progressEl) setStyle(progressEl, { display: "none" });
    }

    if (inst) await this.renderInstance(inst);
  }

  async uploadSingleFile(file, targetPath, overrideName = null) {
    const name = overrideName || file.name;
    const { kind, content, icon, isBinaryOffice, isBinary } = await this._resolveFilePayload(file, name);
    if (isWallpaperPath(targetPath)) {
      await this.saveToWallpapers(name, content, kind, icon);
      return;
    }
    await this._saveFilePayload(targetPath, name, kind, content, icon, isBinaryOffice, isBinary);
  }

  async saveToWallpapers(name, content, kind, icon) {
    os.events.emit("achievement:trigger", { achievementId: Achievements.PersonalSpace });

    const wallpapersPath = ["Pictures", "Wallpapers"];
    await os.fs.mkdir(wallpapersPath);
    const safeIcon = kind === FileKind.IMAGE ? "@content" : icon || resolveIconUrl("static/icons/file.webp");
    await this.fs.createFile(wallpapersPath, name, content, kind, safeIcon);
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
      item.oncontextmenu = (e) => this.showFileContextMenu(e, name, isFile, inst);
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

  async _pasteToPath(destPath, inst) {
    const cb = this._getClipboard();
    if (!cb) return;

    const { action } = cb;
    let pastedCount = 0;
    let applyToAllAction = null;

    const copyFile = async (name, srcPath) => {
      const kind = await this.fs.getFileKind(srcPath, name);
      const fileIcon = await this.fs.getFileIcon(srcPath, name);
      const isBinary = kind === FileKind.VIDEO || name.toLowerCase().endsWith(".pdf");

      const destDir = this.fs.resolveUserPath(destPath);
      const destFilePath = this.fs.join(destDir, name);
      const destExists = await os.fs.exists(destFilePath);

      let resolvedAction = "replace";
      if (destExists) {
        const result = await this._resolveConflictAction(name, applyToAllAction);
        if (result.applyToAll) applyToAllAction = result.action;
        resolvedAction = result.action;
      }

      if (resolvedAction === "skip") return null;

      let finalName = resolvedAction === "keep" ? await this.fs.getUniqueFileName(destPath, name) : name;

      const content = await this.fs.getFileContent(srcPath, name);
      if (resolvedAction === "replace") {
        await os.fs.delete(destPath, name).catch(() => {});
        await os.fs.createFile(destPath, name, content, kind, fileIcon);
      } else {
        await os.fs.createFile(destPath, finalName, content, kind, fileIcon);
      }

      return finalName;
    };

    const copyFolder = async (name, srcBasePath) => {
      const uniqueName = action === "copy" ? await this.fs.getUniqueFileName(destPath, name) : name;
      await os.fs.mkdir([...destPath, uniqueName]);
      const srcEntries = await os.fs.readdir([...srcBasePath, name]).catch(() => ({}));

      for (const [childName, childData] of Object.entries(srcEntries)) {
        if (childData?.type !== "file") continue;

        const childPath = [...srcBasePath, name];
        const childContent = await this.fs.getFileContent(childPath, childName);
        const childKind = await this.fs.getFileKind(childPath, childName);
        const childIcon = await this.fs.getFileIcon(childPath, childName);
        const destFolderPath = [...destPath, uniqueName];
        const destDir = this.fs.resolveUserPath(destFolderPath);
        const childExists = await os.fs.exists(this.fs.join(destDir, childName));

        let resolvedAction = "replace";
        if (childExists) {
          const result = await this._resolveConflictAction(childName, applyToAllAction);
          if (result.applyToAll) applyToAllAction = result.action;
          resolvedAction = result.action;
        }

        if (resolvedAction === "skip") continue;

        if (resolvedAction === "replace") {
          await this.fs.updateFile(destFolderPath, childName, childContent);
          await this.fs.writeMeta(destDir, childName, { kind: childKind, icon: childIcon });
        } else {
          await this.fs.createFile(destFolderPath, childName, childContent, childKind, childIcon);
        }
      }

      return uniqueName;
    };

    if (cb.source === "explorer") {
      for (const iconData of cb.icons) {
        const { name, path: srcPath, isFile } = iconData.data;
        try {
          if (isFile) {
            const result = await copyFile(name, srcPath);
            if (result !== null) {
              if (action === "cut") await os.fs.delete(srcPath, name);
              pastedCount++;
            }
          } else {
            await copyFolder(name, srcPath);
            if (action === "cut") await os.fs.delete(srcPath, name);
            pastedCount++;
          }
        } catch {
          os.notify.send(`Could not paste "${name}"`);
        }
      }

      if (action === "cut") {
        this._setClipboard(null);
        if (cb.sourceInst) await this.renderInstance(cb.sourceInst);
      }
    } else if (cb.source === "desktop") {
      for (const iconData of cb.icons) {
        const { isDesktopFile, isFolderIcon, fileName, folderName, app, name } = iconData.data;
        try {
          if (isDesktopFile) {
            const result = await copyFile(fileName, ["Desktop"]);
            if (result !== null) {
              if (action === "cut") {
                await os.fs.delete(["Desktop"], fileName);
                iconData.element?.remove();
              }
              pastedCount++;
            }
          } else if (isFolderIcon) {
            await copyFolder(folderName, ["Desktop"]);
            if (action === "cut") {
              await os.fs.delete(["Desktop"], folderName);
              iconData.element?.remove();
            }
            pastedCount++;
          } else {
            const srcFileName = `${name || app}.desktop`;
            const result = await copyFile(srcFileName, ["Desktop"]);
            if (result !== null) {
              if (action === "cut") iconData.element?.remove();
              pastedCount++;
            }
          }
        } catch {
          os.notify.send("Could not paste item");
        }
      }

      if (action === "cut") this._setClipboard(null);
    }

    if (pastedCount > 0) {
      os.notify.send(`${pastedCount} ${pluralize(pastedCount, "item")} pasted`);
      await this.renderInstance(inst);
    }
  }

  async _downloadItems(itemName, isFile, inst) {
    const effectiveItems =
      inst.selectedItems.size > 1 && inst.selectedItems.has(itemName) ? [...inst.selectedItems] : [itemName];

    if (effectiveItems.length === 1 && isFile) {
      const content = await os.fs.read([...inst.currentPath, itemName]);
      const data = content || (await this.fs.getFileContent(inst.currentPath, itemName)) || "";
      const src = URL.createObjectURL(new Blob([data]));
      const a = document.createElement("a");
      a.href = src;
      a.download = itemName;
      a.click();
      URL.revokeObjectURL(src);
      return;
    }

    const folder = inst._cachedFolder || (await os.fs.readdir(inst.currentPath));
    const zipEntries = {};

    for (const name of effectiveItems) {
      const entry = folder[name];
      if (!entry || entry.type !== "file") continue;
      const blob = await os.fs.read([...inst.currentPath, name]);
      if (blob) {
        zipEntries[name] = new Uint8Array(await blob.arrayBuffer());
      } else {
        const text = await this.fs.getFileContent(inst.currentPath, name);
        zipEntries[name] = new TextEncoder().encode(typeof text === "string" ? text : "");
      }
    }

    const zipped = zipSync(zipEntries);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([zipped], { type: "application/zip" }));
    a.download = "archive.zip";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async showFileContextMenu(e, itemName, isFile, inst) {
    e.preventDefault();
    e.stopPropagation();

    showDynamicContextMenu(e, async (menu, item, hr) => {
      if (isFile && itemName.toLowerCase().endsWith(".md")) {
        menu.appendChild(item("Preview", () => this._openMarkdownPreview(itemName, inst), "fa-eye"));
        menu.appendChild(item("Edit with Notepad", () => this._openMarkdownInNotepad(itemName, inst), "fa-edit"));
        menu.appendChild(hr());
      } else if (isFile && itemName.toLowerCase().endsWith(".desktop")) {
        menu.appendChild(item("Open", () => this.openItemForInstance(inst, itemName, true), "fa-file-alt"));
        menu.appendChild(item("Edit with Notepad", () => this._openTextInNotepad(itemName, inst), "fa-edit"));
        menu.appendChild(hr());
      } else if (isFile && fileKindFromName(itemName) === FileKind.TEXT) {
        menu.appendChild(item("Open", () => this.openItemForInstance(inst, itemName, true), "fa-file-alt"));
        menu.appendChild(item("Edit with Notepad", () => this._openTextInNotepad(itemName, inst), "fa-edit"));
        menu.appendChild(hr());
      } else {
        menu.appendChild(
          item(
            isFile ? "Open" : "Open Folder",
            () => this.openItemForInstance(inst, itemName, isFile),
            isFile ? "fa-file-alt" : "fa-folder-open"
          )
        );
        menu.appendChild(hr());
      }

      const effectiveItems =
        inst.selectedItems.size > 1 && inst.selectedItems.has(itemName) ? [...inst.selectedItems] : [itemName];
      const convertableItems = effectiveItems.filter((item) => {
        const ext = item.split(".").pop().toLowerCase();
        return [
          "png",
          "jpg",
          "jpeg",
          "webp",
          "bmp",
          "svg",
          "gif",
          "txt",
          "md",
          "html",
          "json",
          "log",
          "csv",
          "xml",
          "yaml",
          "yml",
          "tsv"
        ].includes(ext);
      });

      if (isFile && convertableItems.length > 0) {
        menu.appendChild(
          item(
            convertableItems.length > 1 ? `Convert ${convertableItems.length} items...` : "Convert / Transform...",
            async () => {
              const { openFileConverter } = await import("../utils/fileConverter.js");
              const services = {
                windowManager: this.wm,
                fileSystemManager: this.fs,
                notepadApp: this.notepadApp,
                browserApp: this.browserApp,
                officeApp: this.officeApp,
                markdownApp: this.markdownApp,
                jsDosApp: this.jsDosApp,
                appLauncher: this.appLauncher
              };
              convertableItems.forEach((convertItem) => {
                openFileConverter(convertItem, inst.currentPath, services, () => {
                  this.renderInstance(inst);
                });
              });
            },
            "fa-exchange-alt"
          )
        );
        menu.appendChild(hr());
      }

      const buildClipItem = (action) => {
        const view = $(`#${inst.winId}-view`, $(`#${inst.winId}`));
        const icons = buildClipboardIcons(inst.selectedItems, itemName, isFile, view, inst.currentPath);
        this._setClipboard({ source: "explorer", action, icons, sourceInst: inst });

        if (action === "cut" && view) {
          icons.forEach(({ data: { name: n } }) => {
            const el = $$(".file-item", view).find((el) => el.querySelector("span")?.textContent === n);
            if (el) setStyle(el, { opacity: "0.5" });
          });
        }

        os.notify.send(`${icons.length} ${pluralize(icons.length, "item")} ${action}`);
      };

      menu.appendChild(item("Copy", () => buildClipItem("copy"), "fa-copy"));
      menu.appendChild(item("Cut", () => buildClipItem("cut"), "fa-cut"));

      const cb = this._getClipboard();
      if (cb) {
        menu.appendChild(item("Paste", () => this._pasteToPath(inst.currentPath, inst), "fa-paste"));
      }

      menu.appendChild(hr());

      menu.appendChild(item("Download", () => this._downloadItems(itemName, isFile, inst), "fa-download"));
      menu.appendChild(
        item("Create Archive", () => this._createArchiveFromItems(itemName, isFile, inst), "fa-file-archive")
      );
      menu.appendChild(hr());

      menu.appendChild(
        item(
          "Move to Trash",
          () => {
            const effectiveItems =
              inst.selectedItems.size > 1 && inst.selectedItems.has(itemName) ? [...inst.selectedItems] : [itemName];
            for (const name of effectiveItems) {
              os.fs.trashFile(inst.currentPath, name);
            }
            this.renderInstance(inst);
            os.notify.send(`${effectiveItems.length} ${effectiveItems.length > 1 ? "items" : "item"} moved to trash`);
          },
          "fa-trash-alt"
        )
      );

      menu.appendChild(
        item(
          "Delete Permanently",
          () => {
            const effectiveItems =
              inst.selectedItems.size > 1 && inst.selectedItems.has(itemName) ? [...inst.selectedItems] : [itemName];
            const msg =
              effectiveItems.length > 1
                ? `Permanently delete ${effectiveItems.length} items? This cannot be undone.`
                : `Permanently delete "${itemName}"? This cannot be undone.`;
            this._showConfirmDialog({
              title: "Delete Permanently",
              message: msg,
              confirmText: "Delete",
              onConfirm: async () => {
                for (const name of effectiveItems) {
                  await os.fs.delete(inst.currentPath, name);
                }
                await this.renderInstance(inst);
                os.notify.send(
                  `${effectiveItems.length} ${effectiveItems.length > 1 ? "items" : "item"} permanently deleted`
                );
              }
            });
          },
          "fa-times-circle"
        )
      );

      menu.appendChild(
        item(
          "Rename",
          () => {
            const win = $(`#${inst.winId}`);
            const view = win && $(`#${inst.winId}-view`, win);
            const itemEl =
              view && $$(".file-item", view).find((el) => el.querySelector("span")?.textContent === itemName);
            if (itemEl) this._startInlineRename(itemEl, itemName, inst);
          },
          "fa-edit"
        )
      );

      if (isFile) {
        const kind = await this.fs.getFileKind(inst.currentPath, itemName);
        if (kind === FileKind.IMAGE || kind === FileKind.VIDEO) {
          const content = await this.fs.getFileContent(inst.currentPath, itemName);
          menu.appendChild(
            item(
              "Set Wallpaper",
              () => {
                SystemUtilities.setWallpaper(content);
                os.notify.send(`Wallpaper set to "${itemName}"`);
              },
              "fa-image"
            )
          );
          menu.appendChild(
            item(
              "Save as Wallpaper",
              async () => {
                await this.saveToWallpapers(itemName, content, await this.fs.getFileKind(inst.currentPath, itemName));
                os.notify.send(`"${itemName}" saved to Wallpapers`);
              },
              "fa-save"
            )
          );
        }
      }

      if (isFile && isArchiveFile(itemName)) {
        menu.appendChild(hr());
        menu.appendChild(
          item(
            "Extract Here",
            () =>
              this._archiveExtractor.extract(itemName, inst.currentPath, () => {
                window.achievements.trigger(Achievements.ArchiveHandler);
                this.renderInstance(inst);
              }),
            "fa-box-open"
          )
        );
      }

      menu.appendChild(
        item(
          "Properties",
          async () => {
            await showFileProperties([...inst.currentPath, itemName], itemName, !isFile, () =>
              this.renderInstance(inst)
            );
          },
          "fa-info-circle"
        )
      );
    });
  }

  async _openMarkdownPreview(fileName, inst) {
    try {
      const content = decodeFileContent(await this.fs.getFileContent(inst.currentPath, fileName));
      if (this.markdownApp?.open) {
        this.markdownApp.open(fileName, content, inst.currentPath.join("/"));
        speak("Opening markdown preview. Looking good!", ClippyAnimation.Show);
      } else {
        os.notify.send("Markdown app not available");
      }
    } catch (err) {
      os.notify.send(`Failed to open "${fileName}"`);
      console.error("Error opening markdown preview:", err);
    }
  }

  async _openMarkdownInNotepad(fileName, inst) {
    try {
      const content = decodeFileContent(await this.fs.getFileContent(inst.currentPath, fileName));
      if (this.notepadApp?.open) {
        this.notepadApp.open(fileName, content, inst.currentPath.join("/"));
        speak("Opening in Notepad. Time to edit!", ClippyAnimation.Writing);
      } else {
        os.notify.send("Notepad app not available");
      }
    } catch (err) {
      os.notify.send(`Failed to open "${fileName}"`);
      console.error("Error opening markdown in notepad:", err);
    }
  }

  async _openTextInNotepad(fileName, inst) {
    try {
      const content = decodeFileContent(await this.fs.getFileContent(inst.currentPath, fileName));
      if (this.notepadApp?.open) {
        this.notepadApp.open(fileName, content, inst.currentPath.join("/"));
        speak("Opening in Notepad. Time to edit!", ClippyAnimation.Writing);
      } else {
        os.notify.send("Notepad app not available");
      }
    } catch (err) {
      os.notify.send(`Failed to open "${fileName}"`);
      console.error("Error opening file in notepad:", err);
    }
  }

  _showConfirmDialog({ title, message, confirmText = "OK", onConfirm }) {
    const overlay = createElement("div", { className: "explorer-confirmation-overlay" });
    setHTML(
      overlay,
      `
      <div class="_fd-dialog">
        <div class="_fd-dialog-title">${title}</div>
        <div class="_fd-dialog-label" style="font-size:13px;color:#ccc;line-height:1.5;">${message}</div>
        <div class="_fd-dialog-actions">
          <button class="_fd-btn _fd-btn-cancel">Cancel</button>
          <button class="_fd-btn _fd-btn-confirm" style="background:#b52a2a;">${confirmText}</button>
        </div>
      </div>
    `
    );
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector("._fd-btn-cancel").onclick = close;
    overlay.querySelector("._fd-btn-confirm").onclick = () => {
      close();
      onConfirm();
    };
    overlay.onclick = (ev) => {
      if (ev.target === overlay) close();
    };
    overlay.onkeydown = (ev) => {
      if (ev.key === "Escape") close();
    };
  }

  _showInputDialog({ title, label, defaultValue, confirmText = "Create", onConfirm }) {
    const overlay = createElement("div", { className: "explorer-confirmation-overlay" });
    setHTML(
      overlay,
      `
      <div class="_fd-dialog">
        <div class="_fd-dialog-title">${title}</div>
        <div class="_fd-dialog-label">${label}</div>
        <input class="_fd-dialog-input" type="text" value="${defaultValue}" spellcheck="false">
        <div class="_fd-dialog-error" style="display:none;font-size:1.5em;color:#e06c75;margin-top:6px;"></div>
        <div class="_fd-dialog-actions">
          <button class="_fd-btn _fd-btn-cancel">Cancel</button>
          <button class="_fd-btn _fd-btn-confirm">${confirmText}</button>
        </div>
      </div>
    `
    );
    document.body.appendChild(overlay);

    const input = overlay.querySelector("._fd-dialog-input");
    const confirmBtn = overlay.querySelector("._fd-btn-confirm");
    const cancelBtn = overlay.querySelector("._fd-btn-cancel");
    const errorEl = overlay.querySelector("._fd-dialog-error");

    input.select();
    input.focus();

    const close = () => overlay.remove();
    const showError = (msg) => {
      errorEl.textContent = msg;
      errorEl.style.display = "block";
      input.style.borderColor = "#e06c75";
      confirmBtn.disabled = false;
    };
    const clearError = () => {
      errorEl.style.display = "none";
      input.style.borderColor = "";
    };

    const submit = async () => {
      const val = input.value.trim();
      if (!val) return;
      confirmBtn.disabled = true;
      try {
        const result = await onConfirm(val);
        if (typeof result === "string" && result) showError(result);
        else close();
      } catch (err) {
        showError(err.message || "An error occurred.");
      }
    };

    confirmBtn.onclick = submit;
    cancelBtn.onclick = close;
    overlay.onclick = (ev) => {
      if (ev.target === overlay) close();
    };
    input.onkeydown = (ev) => {
      if (ev.key === "Enter") submit();
      if (ev.key === "Escape") close();
    };
    input.oninput = () => {
      clearError();
      confirmBtn.disabled = !input.value.trim();
    };
    confirmBtn.disabled = !input.value.trim();
  }

  showBackgroundContextMenu(e, inst) {
    e.preventDefault();
    e.stopPropagation();
    const hasClipboard = !!this._getClipboard();

    if (inst._isTrashView) {
      showDynamicContextMenu(e, (menu, item, hr) => {
        menu.appendChild(
          item(
            "Restore All",
            () => {
              const view = $(`#${inst.winId}-view`, $(`#${inst.winId}`));
              os.fs.restoreAllTrashItems().then(() => {
                if (view) this._renderTrashView(inst, view, $(`#${inst.winId}`));
                os.notify.send("All items restored from trash");
              });
            },
            "fa-undo"
          )
        );
        menu.appendChild(
          item(
            "Empty Trash",
            () => {
              os.dialog.confirm("Empty Trash", "Empty the trash for good? You can't undo this.").then((confirmed) => {
                if (!confirmed) return;
                const view = $(`#${inst.winId}-view`, $(`#${inst.winId}`));
                os.fs.emptyTrash().then(() => {
                  if (view) this._renderTrashView(inst, view, $(`#${inst.winId}`));
                  os.notify.send("Trash emptied");
                });
              });
            },
            "fa-trash-alt"
          )
        );
        menu.appendChild(hr());
        menu.appendChild(
          item(
            "Refresh",
            () => {
              const view = $(`#${inst.winId}-view`, $(`#${inst.winId}`));
              if (view) this._renderTrashView(inst, view, $(`#${inst.winId}`));
            },
            "fa-sync-alt"
          )
        );
      });
      return;
    }

    showDynamicContextMenu(e, (menu, item, hr) => {
      menu.appendChild(item("Add file(s)", () => this._triggerFileUpload(inst), "fa-file-upload"));
      menu.appendChild(item("New File", () => this._spawnInlineItem(inst, true), "fa-file-medical"));
      menu.appendChild(item("New Folder", () => this._spawnInlineItem(inst, false), "fa-folder-plus"));
      if (hasClipboard) {
        menu.appendChild(hr());
        menu.appendChild(item("Paste", () => this._pasteToPath(inst.currentPath, inst), "fa-paste"));
      }
      menu.appendChild(hr());
      menu.appendChild(item("Refresh", () => this.renderInstance(inst), "fa-sync-alt"));
    });
  }

  _triggerFileUpload(inst) {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.addEventListener("change", async () => {
      const files = Array.from(input.files);
      if (!files.length) return;
      const win = document.getElementById(inst.winId);
      await this.handleFileUpload(files, false, win, inst);
    });
    input.click();
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

  async _showTrashView(inst) {
    inst._isTrashView = true;
    inst.currentPath = [];
    inst.selectedFile = null;
    inst.selectedItems = new Set();
    const win = $(`#${inst.winId}`);
    if (!win) return;
    const view = $(`#${inst.winId}-view`, win);
    const pathDisplay = $(`#${inst.winId}-path`, win);
    if (!view) return;
    if (pathDisplay) pathDisplay.value = "/Trash";
    await this._renderTrashView(inst, view, win);
  }

  async _renderTrashView(inst, view, win) {
    view.innerHTML = "";
    removeClass(view, "games-page");
    addClass(view, "explorer-trash-view");
    this._ensureSelBox(view);

    const items = await os.fs.getTrashItems();
    inst._cachedFolder = {};
    inst._cachedTrashItems = items;

    const banner = createElement("div", { className: "explorer-trash-banner" });
    const count = items.length;
    setHTML(
      banner,
      `
      <div class="explorer-trash-banner-left">
        <i class="fas fa-trash" style="font-size:20px;color:var(--brand);opacity:0.7"></i>
        <span style="font-weight:600">Trash</span>
        <span style="opacity:0.6;font-size:11px">${count} ${count === 1 ? "item" : "items"}</span>
      </div>
      <div class="explorer-trash-banner-actions">
        <button class="explorer-trash-action-btn trash-restore-all" ${count === 0 ? "disabled" : ""}>
          <i class="fas fa-undo"></i> Restore All
        </button>
        <button class="explorer-trash-action-btn trash-empty-all" ${count === 0 ? "disabled" : ""}>
          <i class="fas fa-trash-alt"></i> Empty Trash
        </button>
      </div>
    `
    );
    view.appendChild(banner);

    const restoreAllBtn = banner.querySelector(".trash-restore-all");
    const emptyAllBtn = banner.querySelector(".trash-empty-all");

    if (restoreAllBtn) {
      restoreAllBtn.onclick = async () => {
        const confirmed = await os.dialog.confirm(
          "Restore All",
          "Restore all items in trash to their original locations?"
        );
        if (!confirmed) return;
        restoreAllBtn.disabled = true;
        await os.fs.restoreAllTrashItems();
        await this._renderTrashView(inst, view, win);
        os.notify.send("All items restored from trash");
      };
    }

    if (emptyAllBtn) {
      emptyAllBtn.onclick = async () => {
        const confirmed = await os.dialog.confirm("Empty Trash", "Empty the trash for good? You can't undo this.");
        if (!confirmed) return;
        emptyAllBtn.disabled = true;
        await os.fs.emptyTrash();
        await this._renderTrashView(inst, view, win);
        os.notify.send("Trash emptied");
      };
    }

    if (count === 0) {
      const empty = createElement("div", { className: "explorer-trash-empty" });
      setHTML(
        empty,
        `
        <i class="fas fa-trash" style="font-size:48px;opacity:0.15;margin-bottom:12px"></i>
        <div style="opacity:0.4;font-size:13px">Trash is empty</div>
      `
      );
      view.appendChild(empty);
      return;
    }

    for (const entry of items) {
      const item = createElement("div", { className: "file-item" });
      item.dataset.trashId = entry.id;
      item.dataset.trashType = entry.type;
      item.dataset.isFile = entry.type === "file" ? "true" : "false";

      const iconName = entry.originalName;
      const iconHtml = buildFileIconHTML(iconName, {});
      setHTML(item, `${iconHtml}<span>${entry.originalName}</span>`);
      this._bindTrashItemInteractions(item, entry, inst, win);
      view.appendChild(item);
    }

    inst._isTrashView = true;
    await this._updateStorageIndicator(win);
    const itemsEl = win.querySelector(`#${inst.winId}-status-items`);
    const selectedEl = win.querySelector(`#${inst.winId}-status-selected`);
    if (itemsEl) itemsEl.textContent = `${count} ${count === 1 ? "item" : "items"}`;
    if (selectedEl) selectedEl.textContent = "";
  }

  _bindTrashItemInteractions(item, entry, inst, win) {
    item.oncontextmenu = (e) => this._showTrashContextMenu(e, entry, inst);

    item.onclick = (e) => {
      if (e.detail === 1) {
        const wasSelected = item.classList.contains("explorer-selected");
        if (!e.ctrlKey) {
          $$(".file-item.explorer-selected", win).forEach((el) => removeClass(el, "explorer-selected"));
          inst.selectedItems = new Set();
        }
        if (wasSelected && e.ctrlKey) {
          removeClass(item, "explorer-selected");
          inst.selectedItems.delete(entry.originalName);
        } else {
          addClass(item, "explorer-selected");
          inst.selectedItems.add(entry.originalName);
          inst.selectedFile = entry.originalName;
        }
      }
    };
  }

  _showTrashContextMenu(e, entry, inst) {
    e.preventDefault();
    e.stopPropagation();

    showDynamicContextMenu(e, (menu, item, hr) => {
      menu.appendChild(
        item(
          "Restore",
          async () => {
            await os.fs.restoreTrashItem(entry.id);
            const win = $(`#${inst.winId}`);
            const view = win && $(`#${inst.winId}-view`, win);
            if (view) await this._renderTrashView(inst, view, win);
            os.notify.send(`"${entry.originalName}" restored`);
          },
          "fa-undo"
        )
      );

      menu.appendChild(hr());

      menu.appendChild(
        item(
          "Delete Permanently",
          async () => {
            const confirmed = await os.dialog.confirm(
              "Delete Permanently",
              `Permanently delete "${entry.originalName}"? This cannot be undone.`
            );
            if (!confirmed) return;
            await os.fs.deleteTrashItem(entry.id);
            const win = $(`#${inst.winId}`);
            const view = win && $(`#${inst.winId}-view`, win);
            if (view) await this._renderTrashView(inst, view, win);
            os.notify.send(`"${entry.originalName}" permanently deleted`);
          },
          "fa-trash-alt"
        )
      );

      menu.appendChild(
        item(
          "Properties",
          async () => {
            await this._showTrashItemProperties(entry, inst);
          },
          "fa-info-circle"
        )
      );
    });
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

  _startInlineRename(itemEl, currentName, inst) {
    if (itemEl.classList.contains("is-renaming")) return;
    itemEl.classList.add("is-renaming");

    const spanEl = itemEl.querySelector("span");
    spanEl.style.display = "none";

    const { wrap, input, errorTip } = this._createInlineInput(currentName);
    itemEl.appendChild(wrap);

    const dotIdx = currentName.lastIndexOf(".");
    input.focus();
    if (dotIdx > 0) input.setSelectionRange(0, dotIdx);
    else input.select();

    const showError = (msg) => {
      errorTip.textContent = msg;
      errorTip.style.display = "block";
      input.classList.add("error");
    };
    const clearError = () => {
      errorTip.style.display = "none";
      input.classList.remove("error");
    };

    let committed = false;

    const cancel = () => {
      if (committed) return;
      committed = true;
      itemEl.classList.remove("is-renaming");
      wrap.remove();
      spanEl.style.display = "";
    };

    const commit = async () => {
      if (committed) return;
      const newName = input.value.trim();
      if (!newName || newName === currentName) {
        cancel();
        return;
      }
      committed = true;
      try {
        await this.fs.renameItem(inst.currentPath, currentName, newName);
        await this.renderInstance(inst);
      } catch (err) {
        committed = false;
        showError(err.message || `"${newName}" already exists`);
        input.focus();
      }
    };

    this._bindInlineInputEvents(input, commit, cancel, clearError);
  }

  async _spawnInlineItem(inst, isFile) {
    const win = document.getElementById(inst.winId);
    const view = win?.querySelector(`#${inst.winId}-view`);
    if (!view) return;

    const defaultName = isFile ? "New File.txt" : "New Folder";
    const iconSrc = isFile ? resolveIconUrl("static/icons/notepad.webp") : resolveIconUrl("static/icons/file.webp");

    const item = document.createElement("div");
    item.className = "file-item is-renaming";
    item.innerHTML = `<img src="${iconSrc}" style="width:64px;height:64px;object-fit:cover;border-radius:8px">`;

    const { wrap, input, errorTip } = this._createInlineInput(defaultName);
    item.appendChild(wrap);
    view.appendChild(item);
    item.scrollIntoView({ block: "nearest" });

    const dotIdx = defaultName.lastIndexOf(".");
    input.focus();
    if (isFile && dotIdx > 0) input.setSelectionRange(0, dotIdx);
    else input.select();

    const showError = (msg) => {
      errorTip.textContent = msg;
      errorTip.style.display = "block";
      input.classList.add("error");
    };
    const clearError = () => {
      errorTip.style.display = "none";
      input.classList.remove("error");
    };

    let committed = false;
    const cancel = () => {
      if (committed) return;
      committed = true;
      item.remove();
    };

    const commit = async () => {
      if (committed) return;
      const name = input.value.trim();
      if (!name) {
        cancel();
        return;
      }
      committed = true;
      try {
        if (isFile) {
          await this.fs.createFile(inst.currentPath, name);
          speak("New file created! Don't forget to name it something memorable.", ClippyAnimation.Greeting);
        } else {
          await this.fs.createFolder(inst.currentPath, name);
          speak("New folder created! Don't forget to name it something memorable.", ClippyAnimation.Greeting);
        }
        await this.renderInstance(inst);
      } catch (err) {
        committed = false;
        showError(err.message || "Could not create item.");
        input.focus();
      }
    };

    this._bindInlineInputEvents(input, commit, cancel, clearError);
  }

  _createInlineInput(value) {
    const wrap = document.createElement("div");
    wrap.className = "inline-rename-wrap";

    const input = document.createElement("input");
    input.className = "inline-rename-input";
    input.type = "text";
    input.value = value;
    input.spellcheck = false;

    const errorTip = document.createElement("div");
    errorTip.className = "inline-rename-error";
    errorTip.style.display = "none";

    wrap.appendChild(input);
    wrap.appendChild(errorTip);
    return { wrap, input, errorTip };
  }

  _bindInlineInputEvents(input, commit, cancel, clearError) {
    input.onkeydown = (ev) => {
      ev.stopPropagation();
      if (ev.key === "Enter") {
        ev.preventDefault();
        commit();
      }
      if (ev.key === "Escape") {
        ev.preventDefault();
        cancel();
      }
    };
    input.oninput = () => clearError();
    input.onblur = () => setTimeout(() => commit(), 120);
    input.onclick = (ev) => ev.stopPropagation();
    input.ondblclick = (ev) => ev.stopPropagation();
  }

  async _createArchiveFromItems(itemName, isFile, inst) {
    const effectiveItems =
      inst.selectedItems.size > 1 && inst.selectedItems.has(itemName) ? [...inst.selectedItems] : [itemName];

    let defaultName = "archive";
    if (effectiveItems.length === 1) {
      const singleItem = effectiveItems[0];
      const dotIndex = singleItem.lastIndexOf(".");
      defaultName = dotIndex > 0 ? singleItem.substring(0, dotIndex) : singleItem;
    }

    this._showArchiveDialog({
      title: "Create Archive",
      defaultValue: defaultName,
      onConfirm: async (archiveName, archiveType, compressionLevel) => {
        os.notify.send("Creating archive...");

        const folder = inst._cachedFolder || (await os.fs.readdir(inst.currentPath));
        const items = effectiveItems.map((item) => ({
          path: inst.currentPath,
          name: item,
          isFile: folder[item]?.type === "file"
        }));

        const result = await this._archiveExtractor.createArchive(items, {
          format: archiveType,
          compressionLevel,
          outputPath: inst.currentPath,
          archiveName
        });

        if (result.success) {
          await this.renderInstance(inst);
          os.notify.send(`Archive "${result.name}" created`);
        }
      }
    });
  }

  _showArchiveDialog({ title, defaultValue, onConfirm }) {
    const overlay = document.createElement("div");
    overlay.className = "explorer-confirmation-overlay";
    overlay.innerHTML = `
      <div class="_fd-dialog" style="width: 360px;">
        <div class="_fd-dialog-title">${title}</div>
        <div style="display:flex; flex-direction:column; gap:12px; margin-top:8px;">
          <div>
            <div class="_fd-dialog-label">Archive Name</div>
            <input class="_fd-dialog-input archive-name-input" type="text" value="${defaultValue}" spellcheck="false" style="width:100%;">
          </div>
          <div>
            <div class="_fd-dialog-label">Archive Format</div>
            <select class="archive-type-select" style="
              width: 100%;
              padding: 8px 12px;
              border-radius: 6px;
              border: 1px solid rgba(255, 255, 255, 0.15);
              background: rgba(30, 30, 46, 0.9);
              color: #cdd6f4;
              font-family: inherit;
              font-size: 13px;
              outline: none;
            ">
              <option value="zip">ZIP (.zip)</option>
              <option value="7z">7z (.7z)</option>
              <option value="tar">TAR (.tar)</option>
              <option value="tar.gz">TAR.GZ (.tar.gz)</option>
            </select>
          </div>
          <div class="archive-level-container" style="transition: opacity 0.18s ease;">
            <div style="display:flex; justify-content:space-between;">
              <div class="_fd-dialog-label">Compression Level</div>
              <span class="compression-level-value" style="font-size:12px; color:#a6adc8; font-weight:bold;">Normal (6)</span>
            </div>
            <input class="archive-level-input" type="range" min="0" max="9" value="6" style="
              width: 100%;
              margin-top: 6px;
              background: rgba(255, 255, 255, 0.1);
              height: 4px;
              border-radius: 2px;
              outline: none;
              cursor: pointer;
            ">
          </div>
        </div>
        <div class="_fd-dialog-error" style="display:none;font-size:12px;color:#e06c75;margin-top:6px;"></div>
        <div class="_fd-dialog-actions" style="margin-top:16px;">
          <button class="_fd-btn _fd-btn-cancel">Cancel</button>
          <button class="_fd-btn _fd-btn-confirm">Create</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const nameInput = overlay.querySelector(".archive-name-input");
    const select = overlay.querySelector(".archive-type-select");
    const levelContainer = overlay.querySelector(".archive-level-container");
    const levelInput = overlay.querySelector(".archive-level-input");
    const levelValEl = overlay.querySelector(".compression-level-value");
    const confirmBtn = overlay.querySelector("._fd-btn-confirm");
    const cancelBtn = overlay.querySelector("._fd-btn-cancel");
    const errorEl = overlay.querySelector("._fd-dialog-error");

    nameInput.select();
    nameInput.focus();

    const close = () => overlay.remove();

    const levelTexts = {
      0: "Store (No Compression)",
      1: "Fastest (1)",
      2: "Fastest (2)",
      3: "Fast (3)",
      4: "Fast (4)",
      5: "Normal (5)",
      6: "Normal (6)",
      7: "High (7)",
      8: "High (8)",
      9: "Ultra (Maximum)"
    };

    levelInput.oninput = () => {
      levelValEl.textContent = levelTexts[levelInput.value];
    };

    select.onchange = () => {
      if (select.value === "tar") {
        levelContainer.style.opacity = "0.38";
        levelContainer.style.pointerEvents = "none";
      } else {
        levelContainer.style.opacity = "";
        levelContainer.style.pointerEvents = "";
      }
    };

    cancelBtn.onclick = close;

    const showError = (msg) => {
      errorEl.textContent = msg;
      errorEl.style.display = "block";
      nameInput.style.borderColor = "#e06c75";
      confirmBtn.disabled = false;
    };

    confirmBtn.onclick = async () => {
      const archiveName = nameInput.value.trim();
      if (!archiveName) {
        nameInput.style.borderColor = "#e06c75";
        return;
      }
      confirmBtn.disabled = true;
      const type = select.value;
      const level = parseInt(levelInput.value);

      try {
        await onConfirm(archiveName, type, level);
        close();
      } catch (err) {
        showError(err.message || "Failed to create archive");
      }
    };

    overlay.onclick = (ev) => {
      if (ev.target === overlay) close();
    };

    overlay.onkeydown = (ev) => {
      if (ev.key === "Escape") close();
      if (ev.key === "Enter") confirmBtn.click();
    };
  }

  async _showTrashItemProperties(entry, inst) {
    try {
      const iconSrc = entry.icon || "static/icons/file.webp";
      const size = entry.size ? formatSize(entry.size) : "Unknown";
      const type = entry.type || "Unknown";
      const location = entry.originalPath || "Unknown";
      const date = new Date(entry.deletedAt).toLocaleString();

      const title = `Properties: ${entry.originalName}`;
      const propsWin = os.window.create(`${Date.now()}-props`, title, "400px", "auto");

      propsWin.innerHTML = `
        <div class="window-header"><span>${title}</span>
          ${os.window.getWindowControls()}
        </div>
        <div class="window-content" style="padding:20px;">
          <div style="display:flex;align-items:center;gap:20px;margin-bottom:20px;">
            <img src="${iconSrc}" style="width:64px;height:64px;object-fit:cover;border-radius:8px;">
            <div style="flex:1;">
              <div style="font-size:18px;font-weight:600;margin-bottom:4px;">${entry.originalName}</div>
              <div style="opacity:0.7;font-size:13px;">${type}</div>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:120px 1fr;gap:8px;margin-bottom:20px;font-size:13px;">
            <div style="opacity:0.7;">Type:</div><div>${type}</div>
            <div style="opacity:0.7;">Original Location:</div><div>${location}</div>
            <div style="opacity:0.7;">Size:</div><div>${size}</div>
            <div style="opacity:0.7;">Deleted:</div><div>${date}</div>
          </div>
        </div>
      `;
    } catch (err) {
      console.error("Properties error:", err);
      os.dialog.alert("Error", "Failed to show properties");
    }
  }

  async _getItemSize(path) {
    try {
      const content = await os.fs.read(path, { encoding: "binary" });
      const bytes = content instanceof Uint8Array ? content.length : new Blob([content]).size;
      return formatSize(bytes);
    } catch {
      return "Unknown";
    }
  }

  async _getModifiedDate(path) {
    try {
      return new Date().toLocaleString();
    } catch {
      return "Unknown";
    }
  }
}
