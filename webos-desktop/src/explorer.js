import { desktop } from "./desktop.js";
import { FileKind } from "./fs.js";
import { SystemUtilities } from "./system.js";
import { appMap, GamesAppRenderer, FlashAppRenderer } from "./games.js";
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
import { showDynamicContextMenu, hideMenu } from "./shared/contextMenu.js";
import { speak } from "./clippy.js";

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
        <div id="${winId}-path"></div>
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
        <div class="explorer-sidebar">
          <div class="start-item" data-path=""><img src="/static/icons/files.webp" class="sidebar-icon">Home</div>
          <div class="start-item" data-path="Documents"><img src="/static/icons/notepad.webp" class="sidebar-icon">Documents</div>
          <div class="start-item" data-path="Desktop"><i class="fas fa-desktop sidebar-icon-fa"></i>Desktop</div>
          <div class="start-item" data-path="Pictures"><i class="fas fa-image sidebar-icon-fa"></i>Pictures</div>
          <div class="start-item" data-path="Videos"><i class="fas fa-video sidebar-icon-fa"></i>Videos</div>
          <div class="start-item" data-path="Pictures/Wallpapers"><i class="fas fa-panorama sidebar-icon-fa"></i>Wallpapers</div>
        </div>
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
      <div id="${winId}-upload-progress" style="display:none;position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.7);color:#fff;font-size:12px;padding:6px 10px;z-index:10;border-radius:0 0 6px 6px;">
        Uploading...
      </div>`
      }
    `;

    desktop.appendChild(win);
    const explorerView = win.querySelector(`#${winId}-view`);
    explorerView.style.width = "600px";
    explorerView.style.height = "unset";

    this.wm.makeDraggable(win);
    const self = this;
    const wallpaperViewProxy = {
      get style() {
        const i = self._getInstance(winId);
        if (i && i.currentPath.join("/") === "Pictures/Wallpapers") {
          return win.querySelector(`#${winId}-view`).style;
        }
        return null;
      }
    };
    this.wm.makeResizable(win, wallpaperViewProxy);
    this.wm.setupWindowControls(win);
    this.wm.bringToFront(win);

    const observer = new MutationObserver(() => {
      if (!document.getElementById(winId)) {
        this._removeInstance(winId);
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

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
        <div id="${winId}-path" ></div>
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
            background:#2a2a2a;color:#fff;font-size:13px;
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

    const explorerView = win.querySelector(`#${winId}-view`);
    explorerView.style.width = "600px";
    explorerView.style.height = "unset";

    this.wm.makeDraggable(win);
    this.wm.makeResizable(win);
    this.wm.setupWindowControls(win);
    this.wm.bringToFront(win);

    const observer = new MutationObserver(() => {
      if (!document.getElementById(winId)) {
        this._removeInstance(winId);
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

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
      const win = document.getElementById(winId);
      if (win) win.remove();
      this._removeInstance(winId);
      if (cb) cb(inst.currentPath, fileName);
    };

    cancelBtn.onclick = () => {
      const win = document.getElementById(winId);
      if (win) win.remove();
      this._removeInstance(winId);
    };

    win.querySelector(`#${winId}-back`).onclick = async () => {
      if (inst.historyIndex > 0) {
        inst.historyIndex--;
        inst.currentPath = [...inst.history[inst.historyIndex]];
        await this.renderInstance(inst);
      }
    };

    win.querySelectorAll(".explorer-sidebar .start-item").forEach((item) => {
      item.onclick = async () => {
        this.navigateInstance(
          inst,
          item.dataset.path.split("/").filter((p) => p)
        );
      };
    });

    this.navigateInstance(inst, []);
  }

  openFlash() {
    const winId = "flash-app-win";
    const existing = document.getElementById(winId);
    if (existing) {
      this.wm.bringToFront(existing);
      return;
    }
    const win = this.wm.createWindow(winId, "Flash Games");
    win.classList.add("window-root");
    win.style.width = "860px";
    win.style.height = "560px";
    win.style.left = "100px";
    win.style.top = "60px";
    const flashRenderer = new FlashAppRenderer();
    const flashCount = flashRenderer.getGames().length;
    win.innerHTML = `
      <div class="window-header">
        <span>⚡ Flash Games <span class="games-app-count">${flashCount}</span></span>
        ${this.wm.getWindowControls()}
      </div>
      <div class="window-content flash-app-window" style="width:100%;height:100%;overflow:auto;padding:18px;box-sizing:border-box;">
        <div id="flash-app-container"></div>
      </div>`;
    desktop.appendChild(win);
    this.wm.makeDraggable(win);
    this.wm.makeResizable(win);
    this.wm.setupWindowControls(win);
    this.wm.addToTaskbar(winId, "Flash Games", "/static/icons/flash.webp");
    const container = win.querySelector("#flash-app-container");
    flashRenderer.render(container, (appId) => {
      if (this.appLauncher) this.appLauncher.launch(appId);
    });
  }

  openGamesApp() {
    const winId = "games-app-win";
    const existing = document.getElementById(winId);
    if (existing) {
      this.wm.bringToFront(existing);
      return;
    }
    const win = this.wm.createWindow(winId, "Games");
    win.classList.add("window-root");
    win.style.width = "860px";
    win.style.height = "560px";
    win.style.left = "80px";
    win.style.top = "40px";
    const gamesRenderer = new GamesAppRenderer();
    const gamesCount = gamesRenderer.getGames().length;
    win.innerHTML = `
      <div class="window-header">
        <span>🎮 Games <span class="games-app-count">${gamesCount}</span></span>
        ${this.wm.getWindowControls()}
      </div>
      <div class="window-content games-app-window" style="width:100%;height:100%;overflow:auto;padding:18px;box-sizing:border-box;">
        <div id="games-app-container"></div>
      </div>`;
    desktop.appendChild(win);
    this.wm.makeDraggable(win);
    this.wm.makeResizable(win);
    this.wm.setupWindowControls(win);
    this.wm.addToTaskbar(winId, "Games", "fas fa-gamepad");
    const container = win.querySelector("#games-app-container");
    gamesRenderer.render(container, (appId) => {
      if (this.appLauncher) this.appLauncher.launch(appId);
    });
  }

  setupExplorerControls(win, winId) {
    const inst = this._getInstance(winId);

    win.querySelector(`#${winId}-back`).onclick = async () => {
      if (inst.historyIndex > 0) {
        inst.historyIndex--;
        inst.currentPath = [...inst.history[inst.historyIndex]];
        await this.renderInstance(inst);
      }
    };

    win.querySelectorAll(".explorer-sidebar .start-item").forEach((item) => {
      item.onclick = async () => {
        this.navigateInstance(
          inst,
          item.dataset.path.split("/").filter((p) => p)
        );
      };
    });

    win.querySelector(`#${winId}-view`).addEventListener("contextmenu", (e) => {
      if (e.target === win.querySelector(`#${winId}-view`)) this.showBackgroundContextMenu(e, inst);
    });

    const explorerKeyHandler = (e) => {
      if (!document.getElementById(winId)) {
        document.removeEventListener("keydown", explorerKeyHandler);
        return;
      }
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)) return;
      const winEl = document.getElementById(winId);
      if (!winEl) return;
      const winRect = winEl.getBoundingClientRect();
      const mouseOver =
        lastExplorerMousePos.x >= winRect.left &&
        lastExplorerMousePos.x <= winRect.right &&
        lastExplorerMousePos.y >= winRect.top &&
        lastExplorerMousePos.y <= winRect.bottom;
      if (!mouseOver && !winEl.contains(document.activeElement)) return;
      if (!e.ctrlKey) return;
      if (e.code !== "KeyC" && e.code !== "KeyX") return;
      if (!inst.selectedItems.size) return;
      e.preventDefault();
      const action = e.code === "KeyX" ? "cut" : "copy";
      const winView = winEl.querySelector(`#${winId}-view`);
      const items = [...inst.selectedItems].map((name) => {
        const itemEl = winView
          ? [...winView.querySelectorAll(".file-item")].find((el) => el.querySelector("span")?.textContent === name)
          : null;
        return { name, isFile: itemEl?.dataset.isFile === "true" ?? true };
      });
      if (this.desktopUI?.setClipboard) {
        this.desktopUI.setClipboard({ action, items, sourcePath: inst.currentPath });
      }
    };
    document.addEventListener("keydown", explorerKeyHandler);

    const renameKeyHandler = (e) => {
      if (!document.getElementById(winId)) {
        document.removeEventListener("keydown", renameKeyHandler);
        return;
      }

      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)) return;

      const winEl = document.getElementById(winId);
      if (!winEl) return;

      const winRect = winEl.getBoundingClientRect();
      const mouseOver =
        lastExplorerMousePos.x >= winRect.left &&
        lastExplorerMousePos.x <= winRect.right &&
        lastExplorerMousePos.y >= winRect.top &&
        lastExplorerMousePos.y <= winRect.bottom;

      if (!mouseOver && !winEl.contains(document.activeElement)) return;

      if (e.key !== "F2") return;

      e.preventDefault();

      const selectedName = inst.selectedFile || (inst.selectedItems.size === 1 ? [...inst.selectedItems][0] : null);
      if (!selectedName) return;

      const winView = winEl.querySelector(`#${winId}-view`);
      if (!winView) return;

      const itemEl = [...winView.querySelectorAll(".file-item")].find(
        (el) => el.querySelector("span")?.textContent === selectedName
      );

      if (itemEl) {
        this._startInlineRename(itemEl, selectedName, inst);
      }
    };

    document.addEventListener("keydown", renameKeyHandler);
    const lastExplorerMousePos = { x: 0, y: 0 };
    win.addEventListener("mousemove", (e) => {
      lastExplorerMousePos.x = e.clientX;
      lastExplorerMousePos.y = e.clientY;
    });

    const view = win.querySelector(`#${winId}-view`);
    const selBox = document.createElement("div");
    selBox.style.cssText = `
      position:absolute;border:1px solid rgba(79,158,255,0.7);
      background:rgba(79,158,255,0.12);pointer-events:none;display:none;z-index:10;
    `;
    view.style.position = "relative";
    view.appendChild(selBox);

    const selState = { active: false, startX: 0, startY: 0 };

    view.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      if (e.target !== view && e.target !== selBox) return;
      const rect = view.getBoundingClientRect();
      selState.active = true;
      selState.startX = e.clientX - rect.left + view.scrollLeft;
      selState.startY = e.clientY - rect.top + view.scrollTop;
      selBox.style.display = "block";
      selBox.style.left = selState.startX + "px";
      selBox.style.top = selState.startY + "px";
      selBox.style.width = "0px";
      selBox.style.height = "0px";
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
      selBox.style.left = x + "px";
      selBox.style.top = y + "px";
      selBox.style.width = w + "px";
      selBox.style.height = h + "px";

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
    });

    const endSel = () => {
      selState.active = false;
      selBox.style.display = "none";
    };
    view.addEventListener("mouseup", endSel);
    document.addEventListener("mouseup", endSel);

    view.addEventListener("dragover", (e) => {
      const hasBrowserFiles = [...(e.dataTransfer?.items || [])].some((i) => i.kind === "file");
      if (!hasBrowserFiles) return;
      e.preventDefault();
      e.stopPropagation();
      view.classList.add("explorer-drop-active");
    });

    view.addEventListener("dragleave", (e) => {
      if (!view.contains(e.relatedTarget)) {
        view.classList.remove("explorer-drop-active");
      }
    });

    view.addEventListener("drop", (e) => {
      view.classList.remove("explorer-drop-active");
    });

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

  async _resolveFilePayload(file, name, targetPath) {
    const kind = fileKindFromName(name);
    const icon = resolveFileIcon(name);
    let content;

    if (isOfficeFile(name)) {
      const ext = name.substring(name.lastIndexOf(".")).toLowerCase();

      if ([".pdf", ".docx", ".xlsx", ".xls", ".pptx", ".ppt"].includes(ext)) {
        return {
          kind,
          content: file,
          icon,
          isBinaryOffice: true
        };
      }
    }

    if (kind === FileKind.IMAGE) {
      content = await readFileAsDataURL(file);
    } else if (kind === FileKind.VIDEO) {
      content = file;
    } else if (kind === FileKind.ROM) {
      content = await readFileAsDataURL(file);
    } else {
      try {
        content = await readFileAsText(file);
      } catch {
        content = await readFileAsDataURL(file);
      }
    }

    return { kind, content, icon };
  }
  async _saveFilePayload(targetPath, name, kind, content, icon, isBinaryOffice = false) {
    if (kind === FileKind.VIDEO || isBinaryOffice) {
      await this.fs.writeBinaryFile(targetPath, name, content, kind, icon);
    } else {
      await this.fs.createFile(targetPath, name, content, kind, icon);
    }
  }

  async _replaceFilePayload(targetPath, name, kind, content, icon, isBinaryOffice = false) {
    if (kind === FileKind.VIDEO || isBinaryOffice) {
      await this.fs.deleteBinaryFile(targetPath, name).catch(() => {});
      await this.fs.writeBinaryFile(targetPath, name, content, kind, icon);
    } else {
      const dir = this.fs.resolveDir(targetPath);
      await this.fs.updateFile(targetPath, name, content);
      await this.fs.writeMeta(dir, name, { kind, icon });
    }
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
          const parts = (file.webkitRelativePath || file.name).split("/");
          const fileName = parts.pop();
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
          const { kind, content, icon } = await this._resolveFilePayload(file, name, targetPath);
          await this.saveToWallpapers(name, content, kind, icon);
          uploadedCount++;
          continue;
        }

        const dir = this.fs.resolveDir(targetPath);
        const existingPath = this.fs.join(dir, name);
        const exists = await this.fs.exists(existingPath);

        if (!exists) {
          const { kind, content, icon, isBinaryOffice } = await this._resolveFilePayload(file, name, targetPath);
          await this._saveFilePayload(targetPath, name, kind, content, icon, isBinaryOffice);
          uploadedCount++;
          continue;
        }

        let action;
        if (applyToAllAction) {
          action = applyToAllAction;
        } else {
          const result = await showConflictDialog(name);
          if (result.applyToAll) applyToAllAction = result.action;
          action = result.action;
        }

        if (action === "skip") {
          skippedCount++;
          continue;
        }

        const { kind, content, icon, isBinaryOffice } = await this._resolveFilePayload(file, name, targetPath);

        if (action === "replace") {
          await this._replaceFilePayload(targetPath, name, kind, content, icon, isBinaryOffice);
          uploadedCount++;
        } else {
          await this._saveFilePayload(targetPath, name, kind, content, icon, isBinaryOffice);
          uploadedCount++;
        }
      }

      const parts = [];
      if (uploadedCount > 0) parts.push(`${uploadedCount} file${uploadedCount !== 1 ? "s" : ""} uploaded`);
      if (skippedCount > 0) parts.push(`${skippedCount} skipped`);
      if (parts.length) this.wm.showPopup(parts.join(", "));
    } finally {
      if (progressEl) progressEl.style.display = "none";
    }

    await this.renderInstance(inst);
  }

  async uploadSingleFile(file, targetPath, overrideName = null) {
    const name = overrideName || file.name;
    const { kind, content, icon, isBinaryOffice } = await this._resolveFilePayload(file, name, targetPath);

    if (isWallpaperPath(targetPath)) {
      await this.saveToWallpapers(name, content, kind, icon);
      return;
    }

    await this._saveFilePayload(targetPath, name, kind, content, icon, isBinaryOffice);
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
    } else {
      view.classList.remove("wallpapers-page");
    }

    if (view.style.height === "") {
      view.style.height = "600px";
    }
    const folder = await this.fs.getFolder(inst.currentPath);

    for (const [name, itemData] of Object.entries(folder)) {
      const isFile = itemData?.type === "file";
      let iconEl;

      if (!isFile) {
        iconEl = `<img src="/static/icons/file.webp" style="width:64px;height:64px;object-fit:cover;border-radius:8px">`;
      } else if (name.endsWith(".desktop")) {
        let iconSrc = "/static/icons/file.webp";
        try {
          const raw = await this.fs.getFileContent(inst.currentPath, name);
          const parsed = JSON.parse(raw || "{}");
          iconSrc = appMap[parsed.app]?.icon || parsed.path || "/static/icons/file.webp";
        } catch {}
        const isFaIcon = iconSrc.startsWith("fa");
        iconEl = isFaIcon
          ? `<div style="width:64px;height:64px;display:flex;align-items:center;justify-content:center;background:#1a1a2e;border-radius:8px;font-size:28px;color:#8090ff;"><i class="${iconSrc}"></i></div>`
          : `<img src="${iconSrc}" style="width:64px;height:64px;object-fit:cover;border-radius:8px">`;
      } else {
        const thumbnailSrc = isImageFile(name)
          ? itemData.icon === "@content"
            ? await this.fs.getFileContent(inst.currentPath, name)
            : itemData.icon || itemData.content
          : null;
        iconEl = buildFileIconHTML(name, { thumbnailSrc, storedIcon: itemData.icon });
      }

      const item = document.createElement("div");
      item.className = "file-item";
      item.dataset.isFile = isFile ? "true" : "false";
      item.innerHTML = `${iconEl}<span>${name}</span>`;

      if (inst.mode === "select") {
        if (isFile) {
          item.onclick = () => this._selectFile(inst, name, item);
          item.ondblclick = () => this._confirmSelection(inst);
        } else {
          item.ondblclick = async () => this.openItemForInstance(inst, name, false);
        }
      } else if (inst.mode === "save") {
        if (!isFile) {
          item.ondblclick = async () => this.navigateInstance(inst, [...inst.currentPath, name]);
        } else {
          item.onclick = () => {
            const fileNameInput = win.querySelector(`#${inst.winId}-filename-input`);
            if (fileNameInput) fileNameInput.value = name;
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
        item.ondblclick = async () => this.openItemForInstance(inst, name, isFile);
        item.oncontextmenu = async (e) => this.showFileContextMenu(e, name, isFile, inst);
        this._setupExplorerItemDrag(item, name, isFile, inst);
      }

      view.appendChild(item);
    }

    const folderEntries = Object.keys(folder);
    if (folderEntries.length === 0 && inst.mode === "browse") {
      speak("This folder is empty. Want me to help you organize?", "Searching");
    }

    if (inst.mode === "select") {
      this._bindSelectBarButton(inst);
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
    if (!win) return;
    const btn = win.querySelector(`#${inst.winId}-select-btn`);
    if (!btn) return;
    btn.onclick = () => this._confirmSelection(inst);
  }

  _confirmSelection(inst) {
    if (!inst.selectedFile || !inst.fileSelectCallback) return;
    const cb = inst.fileSelectCallback;
    inst.fileSelectCallback = null;
    const win = document.getElementById(inst.winId);
    if (win) win.remove();
    this._removeInstance(inst.winId);
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

    speak("It looks like you're opening a file. I can read that for you.", "Reading");

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

  _getClipboard() {
    return this.desktopUI?.state?.clipboard ?? null;
  }

  _setClipboard(data) {
    if (this.desktopUI) this.desktopUI.state.clipboard = data;
  }

  async _pasteToPath(destPath, inst) {
    const cb = this._getClipboard();
    if (!cb) return;
    const action = cb.action;
    let pastedCount = 0;
    let applyToAllAction = null;

    const copyFileToPath = async (name, srcPath) => {
      const content = await this.fs.getFileContent(srcPath, name);
      const kind = await this.fs.getFileKind(srcPath, name);
      const fileIcon = await this.fs.getFileIcon(srcPath, name);

      const destDir = this.fs.resolveDir(destPath);
      const destFilePath = this.fs.join(destDir, name);
      const destExists = await this.fs.exists(destFilePath);

      let resolvedAction = "replace";
      if (destExists) {
        if (applyToAllAction) {
          resolvedAction = applyToAllAction;
        } else {
          const result = await showConflictDialog(name);
          if (result.applyToAll) applyToAllAction = result.action;
          resolvedAction = result.action;
        }
      }

      if (resolvedAction === "skip") return null;

      let finalName = name;
      if (resolvedAction === "keep") {
        finalName = await this.fs.getUniqueFileName(destPath, name);
      }

      if (resolvedAction === "replace") {
        await this.fs.updateFile(destPath, name, content);
        await this.fs.writeMeta(destDir, name, { kind, icon: fileIcon });
      } else {
        await this.fs.createFile(destPath, finalName, content, kind, fileIcon);
      }

      return finalName;
    };

    const copyFolderToPath = async (name, srcBasePath) => {
      const uniqueName = action === "copy" ? await this.fs.getUniqueFileName(destPath, name) : name;
      await this.fs.ensureFolder([...destPath, uniqueName]);
      const srcEntries = await this.fs.getFolder([...srcBasePath, name]).catch(() => ({}));

      for (const [childName, childData] of Object.entries(srcEntries)) {
        if (childData?.type !== "file") continue;
        const childContent = await this.fs.getFileContent([...srcBasePath, name], childName);
        const childKind = await this.fs.getFileKind([...srcBasePath, name], childName);
        const childIcon = await this.fs.getFileIcon([...srcBasePath, name], childName);

        const destDir = this.fs.resolveDir([...destPath, uniqueName]);
        const destFilePath = this.fs.join(destDir, childName);
        const childExists = await this.fs.exists(destFilePath);

        let resolvedAction = "replace";
        if (childExists) {
          if (applyToAllAction) {
            resolvedAction = applyToAllAction;
          } else {
            const result = await showConflictDialog(childName);
            if (result.applyToAll) applyToAllAction = result.action;
            resolvedAction = result.action;
          }
        }

        if (resolvedAction === "skip") continue;

        if (resolvedAction === "replace") {
          await this.fs.updateFile([...destPath, uniqueName], childName, childContent);
          await this.fs.writeMeta(destDir, childName, { kind: childKind, icon: childIcon });
        } else {
          await this.fs.createFile([...destPath, uniqueName], childName, childContent, childKind, childIcon);
        }
      }

      return uniqueName;
    };

    if (cb.source === "explorer") {
      for (const iconData of cb.icons) {
        const { name, path: srcPath, isFile } = iconData.data;
        try {
          if (isFile) {
            const result = await copyFileToPath(name, srcPath);
            if (result !== null) {
              if (action === "cut") await this.fs.deleteItem(srcPath, name);
              pastedCount++;
            }
          } else {
            await copyFolderToPath(name, srcPath);
            if (action === "cut") await this.fs.deleteItem(srcPath, name);
            pastedCount++;
          }
        } catch {
          this.wm.showPopup(`Could not paste "${name}"`);
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
            const result = await copyFileToPath(fileName, ["Desktop"]);
            if (result !== null) {
              if (action === "cut") {
                await this.fs.deleteItem(["Desktop"], fileName);
                if (iconData.element) iconData.element.remove();
              }
              pastedCount++;
            }
          } else if (isFolderIcon) {
            await copyFolderToPath(folderName, ["Desktop"]);
            if (action === "cut") {
              await this.fs.deleteItem(["Desktop"], folderName);
              if (iconData.element) iconData.element.remove();
            }
            pastedCount++;
          } else {
            const appIconName = name || app;
            const srcFileName = `${appIconName}.desktop`;
            const result = await copyFileToPath(srcFileName, ["Desktop"]);
            if (result !== null) {
              if (action === "cut" && iconData.element) iconData.element.remove();
              pastedCount++;
            }
          }
        } catch {
          this.wm.showPopup(`Could not paste item`);
        }
      }

      if (action === "cut") this._setClipboard(null);
    }

    if (pastedCount > 0) {
      this.wm.showPopup(`${pastedCount} item${pastedCount !== 1 ? "s" : ""} pasted`);
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

      menu.appendChild(
        item("Copy", () => {
          const allSelected =
            inst.selectedItems.size > 1 && inst.selectedItems.has(itemName) ? [...inst.selectedItems] : [itemName];
          const win = document.getElementById(inst.winId);
          const view = win?.querySelector(`#${inst.winId}-view`);
          const nameToIsFile = {};
          if (view) {
            [...view.querySelectorAll(".file-item")].forEach((el) => {
              const n = el.querySelector("span")?.textContent;
              if (n) nameToIsFile[n] = el.dataset.isFile === "true";
            });
          }
          const icons = allSelected.map((n) => ({
            element: null,
            data: { name: n, path: inst.currentPath, isFile: nameToIsFile[n] ?? isFile }
          }));
          this._setClipboard({ source: "explorer", action: "copy", icons, sourceInst: inst });
          this.wm.showPopup(`${icons.length} item${icons.length !== 1 ? "s" : ""} copied`);
        })
      );

      menu.appendChild(
        item("Cut", () => {
          const allSelected =
            inst.selectedItems.size > 1 && inst.selectedItems.has(itemName) ? [...inst.selectedItems] : [itemName];
          const win = document.getElementById(inst.winId);
          const view = win?.querySelector(`#${inst.winId}-view`);
          const nameToIsFile = {};
          if (view) {
            [...view.querySelectorAll(".file-item")].forEach((el) => {
              const n = el.querySelector("span")?.textContent;
              if (n) nameToIsFile[n] = el.dataset.isFile === "true";
            });
          }
          const icons = allSelected.map((n) => ({
            element: null,
            data: { name: n, path: inst.currentPath, isFile: nameToIsFile[n] ?? isFile }
          }));
          this._setClipboard({ source: "explorer", action: "cut", icons, sourceInst: inst });
          if (view) {
            allSelected.forEach((n) => {
              const el = [...view.querySelectorAll(".file-item")].find(
                (el) => el.querySelector("span")?.textContent === n
              );
              if (el) el.style.opacity = "0.5";
            });
          }
          this.wm.showPopup(`${icons.length} item${icons.length !== 1 ? "s" : ""} cut`);
        })
      );

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
              this.wm.showPopup(`"${itemName}" deleted`);
            }
          });
        })
      );

      menu.appendChild(
        item("Rename", () => {
          const win = document.getElementById(inst.winId);
          if (!win) return;
          const view = win.querySelector(`#${inst.winId}-view`);
          const itemEl = [...view.querySelectorAll(".file-item")].find(
            (el) => el.querySelector("span")?.textContent === itemName
          );
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
              this.wm.showPopup(`Wallpaper set to "${itemName}"`);
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
              this.wm.showPopup(`"${itemName}" added to Pictures/Wallpapers`);
            })
          );
        }
      }

      menu.appendChild(
        item("Properties", () => {
          this.wm.showPopup(`Name: ${itemName}\nType: ${isFile ? "File" : "Folder"}`);
        })
      );
    });
  }
  async _openMarkdownPreview(fileName, inst) {
    try {
      const rawContent = await this.fs.getFileContent(inst.currentPath, fileName);
      const content = this._decodeFileContent(rawContent);
      const path = inst.currentPath.join("/");

      if (this.markdownApp && this.markdownApp.open) {
        this.markdownApp.open(fileName, content, path);
        speak("Opening markdown preview. Looking good!", "Reading");
      } else {
        this.wm.showPopup("Markdown app not available");
      }
    } catch (err) {
      this.wm.showPopup(`Failed to open "${fileName}"`);
      console.error("Error opening markdown preview:", err);
    }
  }

  async _openMarkdownInNotepad(fileName, inst) {
    try {
      const rawContent = await this.fs.getFileContent(inst.currentPath, fileName);
      const content = this._decodeFileContent(rawContent);
      const path = inst.currentPath.join("/");

      if (this.notepadApp && this.notepadApp.open) {
        this.notepadApp.open(fileName, content, path);
        speak("Opening in Notepad. Time to edit!", "Writing");
      } else {
        this.wm.showPopup("Notepad app not available");
      }
    } catch (err) {
      this.wm.showPopup(`Failed to open "${fileName}"`);
      console.error("Error opening markdown in notepad:", err);
    }
  }
  _decodeFileContent(content) {
    if (!content) return "";

    if (content.startsWith("data:")) {
      try {
        const base64Match = content.match(/^data:[^;]+;base64,(.+)$/);
        if (base64Match && base64Match[1]) {
          return atob(base64Match[1]);
        }

        const plainMatch = content.match(/^data:[^,]+,(.+)$/);
        if (plainMatch && plainMatch[1]) {
          return decodeURIComponent(plainMatch[1]);
        }
      } catch (err) {
        console.error("Failed to decode data URL:", err);
        return content;
      }
    }

    return content;
  }
  _showConfirmDialog({ title, message, confirmText = "OK", onConfirm }) {
    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:99999;
      background:rgba(0,0,0,0.45);
      display:flex;align-items:center;justify-content:center;
      animation:fdOverlayIn 0.12s ease;
    `;

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
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:99999;
      background:rgba(0,0,0,0.45);
      display:flex;align-items:center;justify-content:center;
      animation:fdOverlayIn 0.12s ease;
    `;

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
        if (typeof result === "string" && result) {
          showError(result);
        } else {
          close();
        }
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
  }

  _setupExplorerItemDrag(itemEl, name, isFile, inst) {
    let dragState = null;

    itemEl.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      if (e.target.tagName === "INPUT") return;

      const startX = e.clientX;
      const startY = e.clientY;
      let ghost = null;
      let dragging = false;

      const onMouseMove = (ev) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;

        if (!dragging && Math.sqrt(dx * dx + dy * dy) > 6) {
          dragging = true;

          if (!inst.selectedItems.has(name)) {
            this._selectExplorerItem(inst, name, itemEl, false);
          }

          const win = document.getElementById(inst.winId);
          const view = win?.querySelector(`#${inst.winId}-view`);
          const selectedEls = view ? [...view.querySelectorAll(".file-item.explorer-selected")] : [itemEl];
          const count = selectedEls.length || 1;

          ghost = document.createElement("div");
          ghost.style.cssText = `
            position:fixed;pointer-events:none;z-index:99999;
            display:flex;flex-direction:column;align-items:center;justify-content:center;
            background:rgba(20,20,35,0.82);border:1.5px solid rgba(79,158,255,0.55);
            border-radius:10px;padding:8px 12px;gap:4px;backdrop-filter:blur(8px);
            box-shadow:0 8px 32px rgba(0,0,0,0.5);min-width:80px;
          `;
          const iconEl = (selectedEls[0] || itemEl).querySelector("img")?.cloneNode() || document.createElement("div");
          iconEl.style.cssText = "width:40px;height:40px;object-fit:cover;border-radius:6px;opacity:0.9;";
          const label = document.createElement("div");
          label.style.cssText =
            "color:rgba(255,255,255,0.9);font-size:11px;text-align:center;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
          label.textContent = count > 1 ? `${count} items` : name;
          ghost.appendChild(iconEl);
          ghost.appendChild(label);
          ghost.style.left = ev.clientX - 50 + "px";
          ghost.style.top = ev.clientY - 30 + "px";
          document.body.appendChild(ghost);

          dragState = { ghost };
        }

        if (dragging && ghost) {
          ghost.style.left = ev.clientX - 50 + "px";
          ghost.style.top = ev.clientY - 30 + "px";

          const desktopEl = document.getElementById("desktop");
          const explorerWin = document.getElementById(inst.winId);
          const overDesktop = desktopEl && !explorerWin?.contains(document.elementFromPoint(ev.clientX, ev.clientY));
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
        dragState = null;

        if (!dragging) return;

        const explorerWin = document.getElementById(inst.winId);
        const elAtPoint = document.elementFromPoint(ev.clientX, ev.clientY);
        const droppedOnExplorer = explorerWin?.contains(elAtPoint);

        if (droppedOnExplorer) return;
        if (!this.desktopUI?.dropFromExplorer) return;

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

        const win2 = document.getElementById(inst.winId);
        const view2 = win2?.querySelector(`#${inst.winId}-view`);
        if (view2) {
          view2
            .querySelectorAll(".file-item.explorer-selected")
            .forEach((el) => el.classList.remove("explorer-selected"));
        }
        inst.selectedItems = new Set();
        inst.selectedFile = null;
        await this.renderInstance(inst);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
  }

  makeExplorerIconInteractable(icon) {
    this.desktopUI?.makeIconInteractable(icon, true);
  }

  _startInlineRename(itemEl, currentName, inst) {
    if (itemEl.classList.contains("is-renaming")) return;
    itemEl.classList.add("is-renaming");

    const spanEl = itemEl.querySelector("span");
    spanEl.style.display = "none";

    const wrap = document.createElement("div");
    wrap.className = "inline-rename-wrap";

    const input = document.createElement("input");
    input.className = "inline-rename-input";
    input.type = "text";
    input.value = currentName;
    input.spellcheck = false;

    const errorTip = document.createElement("div");
    errorTip.className = "inline-rename-error";
    errorTip.style.display = "none";

    wrap.appendChild(input);
    wrap.appendChild(errorTip);
    itemEl.appendChild(wrap);

    const dotIdx = currentName.lastIndexOf(".");
    input.focus();
    if (dotIdx > 0) {
      input.setSelectionRange(0, dotIdx);
    } else {
      input.select();
    }

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
    input.onblur = () => {
      setTimeout(() => commit(), 120);
    };
    input.onclick = (ev) => ev.stopPropagation();
    input.ondblclick = (ev) => ev.stopPropagation();
  }

  async _spawnInlineItem(inst, isFile) {
    const win = document.getElementById(inst.winId);
    if (!win) return;
    const view = win.querySelector(`#${inst.winId}-view`);
    if (!view) return;

    const defaultName = isFile ? "New File.txt" : "New Folder";
    const iconSrc = isFile ? "/static/icons/notepad.webp" : "/static/icons/file.webp";

    const item = document.createElement("div");
    item.className = "file-item is-renaming";
    item.innerHTML = `<img src="${iconSrc}" style="width:64px;height:64px;object-fit:cover;border-radius:8px">`;

    const wrap = document.createElement("div");
    wrap.className = "inline-rename-wrap";

    const input = document.createElement("input");
    input.className = "inline-rename-input";
    input.type = "text";
    input.value = defaultName;
    input.spellcheck = false;

    const errorTip = document.createElement("div");
    errorTip.className = "inline-rename-error";
    errorTip.style.display = "none";

    wrap.appendChild(input);
    wrap.appendChild(errorTip);
    item.appendChild(wrap);
    view.appendChild(item);
    item.scrollIntoView({ block: "nearest" });

    const dotIdx = defaultName.lastIndexOf(".");
    input.focus();
    if (isFile && dotIdx > 0) {
      input.setSelectionRange(0, dotIdx);
    } else {
      input.select();
    }

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
    input.onblur = () => {
      setTimeout(() => commit(), 120);
    };
    input.onclick = (ev) => ev.stopPropagation();
    input.ondblclick = (ev) => ev.stopPropagation();
  }
}
