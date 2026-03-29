import { desktop } from "./desktop.js";
import { FileKind } from "./fs.js";
import { SystemUtilities } from "./system.js";
import { appMap } from "./games.js";
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
  openFileWith
} from "./fileDisplay.js";
import { renderWallpapersPage } from "./wallpapers.js";
import { showConflictDialog } from "./shared/conflictDialog.js";
import { showDynamicContextMenu } from "./shared/contextMenu.js";
import { speak } from "./clippy.js";
import { ArchiveExtractor } from "./archiveExtractor.js";
import {
  formatSize,
  pluralize,
  isArchiveFile,
  decodeFileContent,
  buildClipboardIcons,
  isWindowFocused,
  splitWebkitPath
} from "./utils.js";

const BINARY_OFFICE_EXTS = [".pdf", ".docx", ".xlsx", ".xls", ".pptx", ".ppt"];
const ARCHIVE_EXTS = [".zip", ".gz", ".tgz", ".tar", ".rar", ".7z", ".bz2", ".xz"];

export class ExplorerApp {
  constructor(fileSystemManager, windowManager, notepadApp, markdownApp) {
    this.fs = fileSystemManager;
    this.wm = windowManager;
    this.notepadApp = notepadApp;
    this.markdownApp = markdownApp;
    this.officeApp = null;
    this.desktopUI = null;
    this.open = this.open.bind(this);
    this._instances = new Map();
    this._archiveExtractor = new ArchiveExtractor(fileSystemManager, (msg) => windowManager.sendNotify(msg));
  }

  setEmulator(emulatorApp) {
    this.emulatorApp = emulatorApp;
  }
  setBrowser(browserApp) {
    this.browserApp = browserApp;
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
      mode: mode || "browse"
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
    return this.desktopUI?.state?.clipboard ?? null;
  }
  _setClipboard(data) {
    if (this.desktopUI) this.desktopUI.state.clipboard = data;
  }

  _watchWindowRemoval(winId) {
    const observer = new MutationObserver(() => {
      if (!document.getElementById(winId)) {
        this._removeInstance(winId);
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  _closeWindow(winId) {
    const win = document.getElementById(winId);
    if (win) win.remove();
    this._removeInstance(winId);
  }

  _sidebarHTML() {
    return `
      <div class="explorer-sidebar">
        <div class="start-item" data-path=""><img src="/static/icons/files.webp" class="sidebar-icon">Home</div>
        <div class="start-item" data-path="Documents"><img src="/static/icons/notepad.webp" class="sidebar-icon">Documents</div>
        <div class="start-item" data-path="Desktop"><i class="fas fa-desktop sidebar-icon-fa"></i>Desktop</div>
        <div class="start-item" data-path="Pictures"><i class="fas fa-image sidebar-icon-fa"></i>Pictures</div>
        <div class="start-item" data-path="Videos"><i class="fas fa-video sidebar-icon-fa"></i>Videos</div>
        <div class="start-item" data-path="Pictures/Wallpapers"><i class="fas fa-panorama sidebar-icon-fa"></i>Wallpapers</div>
      </div>`;
  }

  _bindSidebar(win, inst) {
    win.querySelectorAll(".explorer-sidebar .start-item").forEach((item) => {
      item.onclick = () => this.navigateInstance(inst, item.dataset.path.split("/").filter(Boolean));
    });
  }

  _bindBackButton(win, inst) {
    win.querySelector(`#${inst.winId}-back`).onclick = async () => {
      if (inst.historyIndex > 0) {
        inst.historyIndex--;
        inst.currentPath = [...inst.history[inst.historyIndex]];
        await this.renderInstance(inst);
      }
    };
  }

  _initExplorerView(win, winId) {
    const view = win.querySelector(`#${winId}-view`);
    view.style.width = "600px";
    view.style.height = "unset";
    return view;
  }

  async open(callback = null, notepadRef = null) {
    const isSelector = typeof callback === "function";
    const winId = isSelector ? `explorer-selector-${Date.now()}` : "explorer-win";

    if (!isSelector && document.getElementById(winId)) {
      this.wm.bringToFront(document.getElementById(winId));
      return;
    }

    const inst = this._createInstance(winId, callback, notepadRef, isSelector ? "select" : "browse");
    const title = isSelector ? "Select File" : "File Explorer";
    const win = this.wm.createWindow(winId, title, "700px", "500px");

    win.innerHTML = `
      <div class="window-header">
        <span>${title}</span>
        ${this.wm.getWindowControls()}
      </div>
      <div class="explorer-nav">
        <div class="back-btn" id="${winId}-back">← Back</div>
        <div class="back-btn" id="${winId}-next" style="margin-left:4px">→ Next</div>
        <div style="white-space:pre width:50px" id="${winId}-path"></div>
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
        background:rgba(255,255,255,0.03);
        border-top:1px solid rgba(255,255,255,0.07);
        flex-shrink:0;font-size:11px;color:#888;
        min-height:24px;
      ">
        <span id="${winId}-status-items"></span>
        <span id="${winId}-status-selected" style="margin-left:0"></span>
      </div>
      <div id="${winId}-upload-progress" style="display:none;position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.7);color:#fff;font-size:12px;padding:6px 10px;z-index:10;border-radius:0 0 6px 6px;">
        Uploading...
      </div>`
      }
    `;

    desktop.appendChild(win);
    this._initExplorerView(win, winId);

    this.wm.makeDraggable(win);
    const self = this;
    this.wm.makeResizable(win, {
      get style() {
        const i = self._getInstance(winId);
        if (i && i.currentPath.join("/") === "Pictures/Wallpapers") {
          return win.querySelector(`#${winId}-view`).style;
        }
        return null;
      }
    });
    this.wm.setupWindowControls(win);
    this.wm.bringToFront(win);

    this._watchWindowRemoval(winId);

    if (!isSelector) {
      this.wm.addToTaskbar(win.id, "File Explorer", "/static/icons/files.webp");
    }

    this.setupExplorerControls(win, winId);
    this.navigateInstance(inst, []);
  }

  async openSaveDialog(defaultFileName = "Untitled.txt", onSave = null) {
    const winId = `explorer-save-${Date.now()}`;
    const inst = this._createInstance(winId, null, null, "save");
    inst.saveCallback = onSave;

    const win = this.wm.createWindow(winId, "Save As", "700px", "540px");

    win.innerHTML = `
      <div class="window-header">
        <span>Save As</span>
        ${this.wm.getWindowControls()}
      </div>
      <div class="explorer-nav">
        <div class="back-btn" id="${winId}-back">← Back</div>
        <div id="${winId}-path"></div>
      </div>
      <div class="explorer-container">
        <div class="explorer-sidebar">
          <div class="start-item" data-path=""><img src="/static/icons/files.webp" class="sidebar-icon">Home</div>
          <div class="start-item" data-path="Documents"><img src="/static/icons/notepad.webp" class="sidebar-icon">Documents</div>
          <div class="start-item" data-path="Desktop"><i class="fas fa-desktop sidebar-icon-fa"></i>Desktop</div>
          <div class="start-item" data-path="Pictures"><i class="fas fa-image sidebar-icon-fa"></i>Pictures</div>
        </div>
        <div class="explorer-main" id="${winId}-view"></div>
      </div>
      <div id="${winId}-save-bar" style="
        display:flex;align-items:center;gap:8px;
        padding:8px 12px;
        background:rgba(255,255,255,0.04);
        border-top:1px solid rgba(255,255,255,0.08);
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

    desktop.appendChild(win);
    this._initExplorerView(win, winId);

    this.wm.makeDraggable(win);
    this.wm.makeResizable(win);
    this.wm.setupWindowControls(win);
    this.wm.bringToFront(win);
    this._watchWindowRemoval(winId);

    const fileNameInput = win.querySelector(`#${winId}-filename-input`);
    const saveBtn = win.querySelector(`#${winId}-save-btn`);
    const cancelBtn = win.querySelector(`#${winId}-cancel-btn`);

    fileNameInput.addEventListener("focus", () => {
      const dot = fileNameInput.value.lastIndexOf(".");
      if (dot > 0) fileNameInput.setSelectionRange(0, dot);
      else fileNameInput.select();
    });

    fileNameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") saveBtn.click();
      if (e.key === "Escape") cancelBtn.click();
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
    this.navigateInstance(inst, []);
  }

  setupExplorerControls(win, winId) {
    const inst = this._getInstance(winId);

    this._bindBackButton(win, inst);

    const nextBtn = win.querySelector(`#${winId}-next`);
    if (nextBtn) {
      nextBtn.onclick = async () => {
        if (inst.historyIndex < inst.history.length - 1) {
          inst.historyIndex++;
          inst.currentPath = [...inst.history[inst.historyIndex]];
          await this.renderInstance(inst);
        }
      };
    }

    const searchInput = win.querySelector(`#${winId}-search`);
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        const query = searchInput.value.toLowerCase();
        win
          .querySelector(`#${winId}-view`)
          ?.querySelectorAll(".file-item")
          .forEach((item) => {
            const name = item.querySelector("span")?.textContent?.toLowerCase() || "";
            item.style.display = name.includes(query) ? "" : "none";
          });
      });
      searchInput.addEventListener("keydown", (e) => e.stopPropagation());
    }

    this._bindSidebar(win, inst);

    win.querySelector(`#${winId}-view`).addEventListener("contextmenu", (e) => {
      if (e.target === win.querySelector(`#${winId}-view`)) this.showBackgroundContextMenu(e, inst);
    });

    const lastMousePos = { x: 0, y: 0 };
    win.addEventListener("mousemove", (e) => {
      lastMousePos.x = e.clientX;
      lastMousePos.y = e.clientY;
    });

    const explorerKeyHandler = (e) => {
      if (!document.getElementById(winId)) {
        document.removeEventListener("keydown", explorerKeyHandler);
        return;
      }
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)) return;
      if (!isWindowFocused(winId, lastMousePos)) return;
      if (!e.ctrlKey || (e.code !== "KeyC" && e.code !== "KeyX")) return;
      if (!inst.selectedItems.size) return;
      e.preventDefault();

      const action = e.code === "KeyX" ? "cut" : "copy";
      const view = win.querySelector(`#${winId}-view`);
      const icons = [...inst.selectedItems]
        .map((name) => {
          const el = view
            ? [...view.querySelectorAll(".file-item")].find((el) => el.querySelector("span")?.textContent === name)
            : null;
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
      if (!document.getElementById(winId)) {
        document.removeEventListener("keydown", renameKeyHandler);
        return;
      }
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)) return;
      if (!isWindowFocused(winId, lastMousePos) || e.key !== "F2") return;
      e.preventDefault();

      const selectedName = inst.selectedFile || (inst.selectedItems.size === 1 ? [...inst.selectedItems][0] : null);
      if (!selectedName) return;

      const view = win.querySelector(`#${winId}-view`);
      const itemEl =
        view &&
        [...view.querySelectorAll(".file-item")].find((el) => el.querySelector("span")?.textContent === selectedName);
      if (itemEl) this._startInlineRename(itemEl, selectedName, inst);
    };
    document.addEventListener("keydown", renameKeyHandler);

    this._setupSelectionBox(win, winId);
    this._setupDropZone(win, winId);
    this._setupUploadInputs(win, winId, inst);
  }

  _setupSelectionBox(win, winId) {
    const view = win.querySelector(`#${winId}-view`);
    const selBox = document.createElement("div");
    selBox.className = "explorer-selbox";
    view.style.position = "relative";
    view.appendChild(selBox);

    const selState = { active: false, startX: 0, startY: 0 };

    view.addEventListener("mousedown", (e) => {
      if (e.button !== 0 || (e.target !== view && e.target !== selBox)) return;
      const rect = view.getBoundingClientRect();
      selState.active = true;
      selState.startX = e.clientX - rect.left + view.scrollLeft;
      selState.startY = e.clientY - rect.top + view.scrollTop;
      Object.assign(selBox.style, {
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

      Object.assign(selBox.style, { left: x + "px", top: y + "px", width: w + "px", height: h + "px" });

      const boxRect = { left: x, top: y, right: x + w, bottom: y + h };

      if (!e.ctrlKey) {
        view.querySelectorAll(".file-item.explorer-selected").forEach((el) => el.classList.remove("explorer-selected"));
        i.selectedItems = new Set();
      }

      view.querySelectorAll(".file-item").forEach((item) => {
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
          item.classList.add("explorer-selected");
          i.selectedItems.add(name);
        } else if (!e.ctrlKey) {
          item.classList.remove("explorer-selected");
          i.selectedItems.delete(name);
        }
      });

      this._updateStatusBar(i, i._cachedFolder);
    });

    const endSel = () => {
      selState.active = false;
      selBox.style.display = "none";
    };
    view.addEventListener("mouseup", endSel);
    document.addEventListener("mouseup", endSel);
  }

  _setupDropZone(win, winId) {
    const view = win.querySelector(`#${winId}-view`);
    view.addEventListener("dragover", (e) => {
      if (![...(e.dataTransfer?.items || [])].some((i) => i.kind === "file")) return;
      e.preventDefault();
      e.stopPropagation();
      view.classList.add("explorer-drop-active");
    });
    view.addEventListener("dragleave", (e) => {
      if (!view.contains(e.relatedTarget)) view.classList.remove("explorer-drop-active");
    });
    view.addEventListener("drop", () => view.classList.remove("explorer-drop-active"));
  }

  _setupUploadInputs(win, winId, inst) {
    const fileInput = win.querySelector(`#${winId}-file-input`);
    const folderInput = win.querySelector(`#${winId}-folder-input`);
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

  async _resolveFilePayload(file, name) {
    const kind = fileKindFromName(name);
    const icon = resolveFileIcon(name);

    if (isOfficeFile(name)) {
      const ext = name.substring(name.lastIndexOf(".")).toLowerCase();
      if (BINARY_OFFICE_EXTS.includes(ext)) {
        return { kind, content: file, icon, isBinaryOffice: true };
      }
    }

    const isArchive = ARCHIVE_EXTS.some((ext) => name.toLowerCase().endsWith(ext));
    const isBinary = isArchive || kind === FileKind.IMAGE || kind === FileKind.AUDIO || kind === FileKind.ROM;

    let content;
    if (kind === FileKind.VIDEO || isBinary) {
      content = file;
    } else {
      try {
        content = await readFileAsText(file);
      } catch {
        content = await readFileAsDataURL(file);
      }
    }

    return { kind, content, icon, isBinaryOffice: false, isBinary };
  }

  async _saveFilePayload(targetPath, name, kind, content, icon, isBinaryOffice = false, isBinary = false) {
    if (kind === FileKind.VIDEO || isBinaryOffice || isBinary) {
      await this.fs.writeBinaryFile(targetPath, name, content, kind, icon);
    } else {
      await this.fs.createFile(targetPath, name, content, kind, icon);
    }
  }

  async _replaceFilePayload(targetPath, name, kind, content, icon, isBinaryOffice = false, isBinary = false) {
    if (kind === FileKind.VIDEO || isBinaryOffice || isBinary) {
      await this.fs.deleteBinaryFile(targetPath, name).catch(() => {});
      await this.fs.writeBinaryFile(targetPath, name, content, kind, icon);
    } else {
      const dir = this.fs.resolveDir(targetPath);
      await this.fs.updateFile(targetPath, name, content);
      await this.fs.writeMeta(dir, name, { kind, icon });
    }
  }

  async _resolveConflictAction(name, applyToAllAction) {
    if (applyToAllAction) return { action: applyToAllAction, applyToAll: false };
    return showConflictDialog(name);
  }

  async handleFileUpload(files, isFolder, win, inst) {
    if (!files.length) return;
    const progressEl = win?.querySelector(`#${inst.winId}-upload-progress`);
    if (progressEl) progressEl.style.display = "block";

    let applyToAllAction = null;
    let uploadedCount = 0;
    let skippedCount = 0;

    try {
      let flatFiles;

      if (isFolder) {
        const pathMap = new Map();
        for (const file of files) {
          const { parts, fileName } = splitWebkitPath(file);
          const subPath = [...inst.currentPath, ...parts];
          const key = subPath.join("/");
          if (!pathMap.has(key)) pathMap.set(key, { path: subPath, files: [] });
          pathMap.get(key).files.push({ file, fileName });
        }
        flatFiles = [];
        for (const { path, files: grouped } of pathMap.values()) {
          await this.fs.ensureFolder(path);
          for (const { file, fileName } of grouped) {
            flatFiles.push({ file, targetPath: path, name: fileName });
          }
        }
      } else {
        flatFiles = files.map((file) => ({ file, targetPath: inst.currentPath, name: file.name }));
      }

      for (const { file, targetPath, name } of flatFiles) {
        if (isWallpaperPath(targetPath)) {
          const { kind, content, icon } = await this._resolveFilePayload(file, name);
          await this.saveToWallpapers(name, content, kind, icon);
          uploadedCount++;
          continue;
        }

        const existingPath = this.fs.join(this.fs.resolveDir(targetPath), name);
        const exists = await this.fs.exists(existingPath);
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
      if (parts.length) this.wm.sendNotify(parts.join(", "));
    } finally {
      if (progressEl) progressEl.style.display = "none";
    }

    await this.renderInstance(inst);
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
    const wallpapersPath = ["Pictures", "Wallpapers"];
    await this.fs.ensureFolder(wallpapersPath);
    const safeIcon = kind === FileKind.IMAGE ? "@content" : icon || "/static/icons/file.webp";
    await this.fs.createFile(wallpapersPath, name, content, kind, safeIcon);
  }

  navigate(path) {
    const inst = [...this._instances.values()][0];
    if (inst) return this.navigateInstance(inst, path);
  }

  navigateInstance(inst, path) {
    inst.currentPath = [...path];
    inst.history = inst.history.slice(0, inst.historyIndex + 1);
    inst.history.push([...inst.currentPath]);
    inst.historyIndex = inst.history.length - 1;
    inst.selectedFile = null;
    inst.selectedItems = new Set();

    if (inst.mode === "select") {
      const win = document.getElementById(inst.winId);
      if (win) {
        const label = win.querySelector(`#${inst.winId}-select-label`);
        const btn = win.querySelector(`#${inst.winId}-select-btn`);
        if (label) label.textContent = "No file selected";
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
    const win = document.getElementById(inst.winId);
    if (!win) return;
    const view = win.querySelector(`#${inst.winId}-view`);
    const pathDisplay = win.querySelector(`#${inst.winId}-path`);
    if (!view) return;

    view.innerHTML = "";
    view.classList.remove("games-page");
    pathDisplay.textContent = "/" + inst.currentPath.join("/");

    if (inst.currentPath.join("/") === "Pictures/Wallpapers" && inst.mode === "browse") {
      await renderWallpapersPage(this, view);
      return;
    }

    view.classList.remove("wallpapers-page");
    if (view.style.height === "") view.style.height = "600px";

    const folder = await this.fs.getFolder(inst.currentPath);
    inst._cachedFolder = folder;
    if (inst.mode === "browse") inst._cachedFolderStats = await this._buildFolderStats(inst);

    for (const [name, itemData] of Object.entries(folder)) {
      const isFile = itemData?.type === "file";
      const iconEl = await this._buildItemIconHTML(name, isFile, itemData, inst);

      const item = document.createElement("div");
      item.className = "file-item";
      item.dataset.isFile = isFile ? "true" : "false";
      item.innerHTML = `${iconEl}<span>${name}</span>`;

      this._bindItemInteractions(item, name, isFile, inst, win);
      view.appendChild(item);
    }

    if (Object.keys(folder).length === 0 && inst.mode === "browse") {
      speak("This folder is empty. Want me to help you organize?", "Searching");
    }

    if (inst.mode === "browse") await this._updateStatusBar(inst, folder);
    if (inst.mode === "select") this._bindSelectBarButton(inst);
  }

  async _buildItemIconHTML(name, isFile, itemData, inst) {
    if (!isFile) {
      return `<img src="/static/icons/file.webp" style="width:64px;height:64px;object-fit:cover;border-radius:8px">`;
    }

    if (name.endsWith(".desktop")) {
      let iconSrc = "/static/icons/file.webp";
      try {
        const raw = await this.fs.getFileContent(inst.currentPath, name);
        const parsed = JSON.parse(raw || "{}");
        iconSrc = appMap[parsed.app]?.icon || parsed.path || "/static/icons/file.webp";
      } catch {}
      const isFaIcon = iconSrc.startsWith("fa");
      return isFaIcon
        ? `<div style="width:64px;height:64px;display:flex;align-items:center;justify-content:center;background:#1a1a2e;border-radius:8px;font-size:28px;color:#8090ff;"><i class="${iconSrc}"></i></div>`
        : `<img src="${iconSrc}" style="width:64px;height:64px;object-fit:cover;border-radius:8px">`;
    }

    let thumbnailSrc = null;
    if (isImageFile(name)) {
      if (itemData.icon === "@content") {
        const content = await this.fs.getFileContent(inst.currentPath, name);
        thumbnailSrc = content instanceof Blob ? URL.createObjectURL(content) : content;
      } else {
        thumbnailSrc = itemData.icon || itemData.content;
      }
    }

    return buildFileIconHTML(name, { thumbnailSrc, storedIcon: itemData.icon });
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
          const input = win.querySelector(`#${inst.winId}-filename-input`);
          if (input) input.value = name;
          win
            .querySelectorAll(".file-item.explorer-selected")
            .forEach((el) => el.classList.remove("explorer-selected"));
          item.classList.add("explorer-selected");
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
  }

  _selectFile(inst, name, itemEl) {
    const win = document.getElementById(inst.winId);
    if (!win) return;
    win.querySelectorAll(".file-item.explorer-selected").forEach((el) => el.classList.remove("explorer-selected"));
    itemEl.classList.add("explorer-selected");
    inst.selectedFile = name;
    const label = win.querySelector(`#${inst.winId}-select-label`);
    const btn = win.querySelector(`#${inst.winId}-select-btn`);
    if (label) label.textContent = name;
    if (btn) btn.disabled = false;
  }

  _bindSelectBarButton(inst) {
    const win = document.getElementById(inst.winId);
    const btn = win?.querySelector(`#${inst.winId}-select-btn`);
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
        const content = JSON.parse(await this.fs.getFileContent(inst.currentPath, name));
        if (content.app) this.appLauncher.launch(content.app);
      } catch (e) {
        console.error("Failed to parse desktop file JSON:", e);
      }
      return;
    }

    await openFileWith({
      name,
      path: inst.currentPath,
      fs: this.fs,
      notepadApp: this.notepadApp,
      emulatorApp: this.emulatorApp,
      browserApp: this.browserApp,
      windowManager: this.wm,
      officeApp: this.officeApp,
      markdownApp: this.markdownApp
    });
  }

  openMediaViewer(name, src, kind) {
    openMediaViewer(name, src, kind, this.wm);
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

      const destDir = this.fs.resolveDir(destPath);
      const destFilePath = this.fs.join(destDir, name);
      const destExists = await this.fs.exists(destFilePath);

      let resolvedAction = "replace";
      if (destExists) {
        const result = await this._resolveConflictAction(name, applyToAllAction);
        if (result.applyToAll) applyToAllAction = result.action;
        resolvedAction = result.action;
      }

      if (resolvedAction === "skip") return null;

      let finalName = resolvedAction === "keep" ? await this.fs.getUniqueFileName(destPath, name) : name;

      if (isBinary) {
        const blob = await this.fs.readBinaryFile(srcPath, name);
        if (resolvedAction === "replace") await this.fs.deleteBinaryFile(destPath, name).catch(() => {});
        await this.fs.writeBinaryFile(destPath, finalName, blob, kind, fileIcon);
      } else {
        const content = await this.fs.getFileContent(srcPath, name);
        if (resolvedAction === "replace") {
          await this.fs.updateFile(destPath, name, content);
          await this.fs.writeMeta(this.fs.resolveDir(destPath), name, { kind, icon: fileIcon });
        } else {
          await this.fs.createFile(destPath, finalName, content, kind, fileIcon);
        }
      }

      return finalName;
    };

    const copyFolder = async (name, srcBasePath) => {
      const uniqueName = action === "copy" ? await this.fs.getUniqueFileName(destPath, name) : name;
      await this.fs.ensureFolder([...destPath, uniqueName]);
      const srcEntries = await this.fs.getFolder([...srcBasePath, name]).catch(() => ({}));

      for (const [childName, childData] of Object.entries(srcEntries)) {
        if (childData?.type !== "file") continue;

        const childPath = [...srcBasePath, name];
        const childContent = await this.fs.getFileContent(childPath, childName);
        const childKind = await this.fs.getFileKind(childPath, childName);
        const childIcon = await this.fs.getFileIcon(childPath, childName);
        const destFolderPath = [...destPath, uniqueName];
        const destDir = this.fs.resolveDir(destFolderPath);
        const childExists = await this.fs.exists(this.fs.join(destDir, childName));

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
              if (action === "cut") await this.fs.deleteItem(srcPath, name);
              pastedCount++;
            }
          } else {
            await copyFolder(name, srcPath);
            if (action === "cut") await this.fs.deleteItem(srcPath, name);
            pastedCount++;
          }
        } catch {
          this.wm.sendNotify(`Could not paste "${name}"`);
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
                await this.fs.deleteItem(["Desktop"], fileName);
                iconData.element?.remove();
              }
              pastedCount++;
            }
          } else if (isFolderIcon) {
            await copyFolder(folderName, ["Desktop"]);
            if (action === "cut") {
              await this.fs.deleteItem(["Desktop"], folderName);
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
          this.wm.sendNotify("Could not paste item");
        }
      }

      if (action === "cut") this._setClipboard(null);
    }

    if (pastedCount > 0) {
      this.wm.sendNotify(`${pastedCount} ${pluralize(pastedCount, "item")} pasted`);
      await this.renderInstance(inst);
    }
  }

  async showFileContextMenu(e, itemName, isFile, inst) {
    e.preventDefault();
    e.stopPropagation();

    showDynamicContextMenu(e, async (menu, item, hr) => {
      if (isFile && itemName.toLowerCase().endsWith(".md")) {
        menu.appendChild(item("👁 Preview", () => this._openMarkdownPreview(itemName, inst)));
        menu.appendChild(item("✏ Edit with Notepad", () => this._openMarkdownInNotepad(itemName, inst)));
        menu.appendChild(hr());
      } else {
        menu.appendChild(item(isFile ? "Open" : "Open Folder", () => this.openItemForInstance(inst, itemName, isFile)));
        menu.appendChild(hr());
      }

      const buildClipItem = (action) => {
        const view = document.getElementById(inst.winId)?.querySelector(`#${inst.winId}-view`);
        const icons = buildClipboardIcons(inst.selectedItems, itemName, isFile, view, inst.currentPath);
        this._setClipboard({ source: "explorer", action, icons, sourceInst: inst });

        if (action === "cut" && view) {
          icons.forEach(({ data: { name: n } }) => {
            const el = [...view.querySelectorAll(".file-item")].find(
              (el) => el.querySelector("span")?.textContent === n
            );
            if (el) el.style.opacity = "0.5";
          });
        }

        this.wm.sendNotify(`${icons.length} ${pluralize(icons.length, "item")} ${action}`);
      };

      menu.appendChild(item("Copy", () => buildClipItem("copy")));
      menu.appendChild(item("Cut", () => buildClipItem("cut")));
      menu.appendChild(hr());

      menu.appendChild(
        item("Delete", () => {
          const msg = isFile ? `Delete "${itemName}"?` : `Delete folder "${itemName}" and all its contents?`;
          this._showConfirmDialog({
            title: "Confirm Delete",
            message: msg,
            confirmText: "Delete",
            onConfirm: async () => {
              await this.fs.deleteItem(inst.currentPath, itemName);
              await this.renderInstance(inst);
              this.wm.sendNotify(`"${itemName}" deleted`);
            }
          });
        })
      );

      menu.appendChild(
        item("Rename", () => {
          const win = document.getElementById(inst.winId);
          const view = win?.querySelector(`#${inst.winId}-view`);
          const itemEl =
            view &&
            [...view.querySelectorAll(".file-item")].find((el) => el.querySelector("span")?.textContent === itemName);
          if (itemEl) this._startInlineRename(itemEl, itemName, inst);
        })
      );

      if (isFile) {
        const kind = await this.fs.getFileKind(inst.currentPath, itemName);
        if (kind === FileKind.IMAGE || kind === FileKind.VIDEO) {
          const content = await this.fs.getFileContent(inst.currentPath, itemName);
          menu.appendChild(
            item("Set Wallpaper", () => {
              SystemUtilities.setWallpaper(content);
              this.wm.sendNotify(`Wallpaper set to "${itemName}"`);
            })
          );
          menu.appendChild(
            item("Save as Wallpaper", async () => {
              await this.saveToWallpapers(
                itemName,
                content,
                kind,
                kind === FileKind.IMAGE ? "@content" : "/static/icons/file.webp"
              );
              this.wm.sendNotify(`"${itemName}" added to Pictures/Wallpapers`);
            })
          );
        }
      }

      if (isFile && isArchiveFile(itemName)) {
        menu.appendChild(hr());
        menu.appendChild(
          item("📦 Extract Here", () =>
            this._archiveExtractor.extract(itemName, inst.currentPath, () => this.renderInstance(inst))
          )
        );
      }

      menu.appendChild(
        item("Properties", () => {
          this.wm.sendNotify(`Name: ${itemName}\nType: ${isFile ? "File" : "Folder"}`);
        })
      );
    });
  }

  async _openMarkdownPreview(fileName, inst) {
    try {
      const content = decodeFileContent(await this.fs.getFileContent(inst.currentPath, fileName));
      if (this.markdownApp?.open) {
        this.markdownApp.open(fileName, content, inst.currentPath.join("/"));
        speak("Opening markdown preview. Looking good!", "Reading");
      } else {
        this.wm.sendNotify("Markdown app not available");
      }
    } catch (err) {
      this.wm.sendNotify(`Failed to open "${fileName}"`);
      console.error("Error opening markdown preview:", err);
    }
  }

  async _openMarkdownInNotepad(fileName, inst) {
    try {
      const content = decodeFileContent(await this.fs.getFileContent(inst.currentPath, fileName));
      if (this.notepadApp?.open) {
        this.notepadApp.open(fileName, content, inst.currentPath.join("/"));
        speak("Opening in Notepad. Time to edit!", "Writing");
      } else {
        this.wm.sendNotify("Notepad app not available");
      }
    } catch (err) {
      this.wm.sendNotify(`Failed to open "${fileName}"`);
      console.error("Error opening markdown in notepad:", err);
    }
  }

  _showConfirmDialog({ title, message, confirmText = "OK", onConfirm }) {
    const overlay = document.createElement("div");
    overlay.className = "explorer-confirmation-overlay";
    overlay.innerHTML = `
      <div class="_fd-dialog">
        <div class="_fd-dialog-title">${title}</div>
        <div class="_fd-dialog-label" style="font-size:13px;color:#ccc;line-height:1.5;">${message}</div>
        <div class="_fd-dialog-actions">
          <button class="_fd-btn _fd-btn-cancel">Cancel</button>
          <button class="_fd-btn _fd-btn-confirm" style="background:#b52a2a;">${confirmText}</button>
        </div>
      </div>
    `;
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
    const overlay = document.createElement("div");
    overlay.className = "explorer-confirmation-overlay";
    overlay.innerHTML = `
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
    `;
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

    showDynamicContextMenu(e, (menu, item, hr) => {
      menu.appendChild(item("New File", () => this._spawnInlineItem(inst, true)));
      menu.appendChild(item("New Folder", () => this._spawnInlineItem(inst, false)));
      if (hasClipboard) {
        menu.appendChild(hr());
        menu.appendChild(item("Paste", () => this._pasteToPath(inst.currentPath, inst)));
      }
      menu.appendChild(hr());
      menu.appendChild(item("Refresh", () => this.renderInstance(inst)));
    });
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
    const dir = this.fs.resolveDir(inst.currentPath);
    const stats = {};
    try {
      const meta = await this.fs.readMeta(dir);
      const entries = await new Promise((res, rej) => {
        this.fs.fs.readdir(dir, (e, list) => (e ? rej(e) : res(list)));
      });
      for (const name of entries) {
        if (name === this.fs.CONFIG.META_FILE) continue;
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
      const entries = await new Promise((res, rej) => {
        this.fs.fs.readdir(dirPath, (e, list) => (e ? rej(e) : res(list)));
      });
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
    const iconSrc = isFile ? "/static/icons/notepad.webp" : "/static/icons/file.webp";

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
          speak("New file created! Don't forget to name it something memorable.", "Pleased");
        } else {
          await this.fs.createFolder(inst.currentPath, name);
          speak("New folder created! Don't forget to name it something memorable.", "Pleased");
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
}
