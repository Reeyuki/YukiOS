import { updateFavoritesUI } from "./startMenu.js";
import { desktop } from "./desktop.js";
import interact from "interactjs";
import { isImageFile, buildFileIconHTML, openFileWith } from "./fileDisplay.js";
import { StorageKeys } from "./settings.js";
import { showConflictDialog } from "./shared/conflictDialog.js";
import { showContextMenu, hideMenu } from "./shared/contextMenu.js";

const systemApps = new Set([
  "explorer",
  "terminal",
  "notepad",
  "browser",
  "cameraApp",
  "pythonApp",
  "nodeApp",
  "settings",
  "calculatorApp",
  "aboutApp",
  "music",
  "taskManagerApp",
  "paint",
  "photopea",
  "vscode",
  "liventcord",
  "emulatorApp"
]);

class PositionHelper {
  constructor(desktop, gridSize) {
    this.desktop = desktop;
    this.gridSize = gridSize;
  }

  cellToPixels(col, row) {
    const { width, height, gap } = this.gridSize;
    return { left: gap + col * (width + gap), top: gap + row * (height + gap) };
  }

  pixelsToCell(leftPx, topPx) {
    const { width, height, gap } = this.gridSize;
    return {
      col: Math.max(0, Math.round((leftPx - gap) / (width + gap))),
      row: Math.max(0, Math.round((topPx - gap) / (height + gap)))
    };
  }

  isCellOccupied(col, row, exclude = null) {
    const { left, top } = this.cellToPixels(col, row);
    const { width, height } = this.gridSize;
    return Array.from(document.querySelectorAll(".icon.selectable")).some(
      (i) =>
        i !== exclude &&
        Math.abs((parseFloat(i.style.left) || 0) - left) < width * 0.5 &&
        Math.abs((parseFloat(i.style.top) || 0) - top) < height * 0.5
    );
  }

  nextFreeCell(col, row, exclude = null) {
    const { width, height, gap } = this.gridSize;
    const maxRows = Math.max(1, Math.floor((this.desktop.clientHeight - gap) / (height + gap)));
    const maxCols = Math.max(1, Math.floor((this.desktop.clientWidth - gap) / (width + gap)));
    let c = col,
      r = row;
    while (this.isCellOccupied(c, r, exclude)) {
      r++;
      if (r >= maxRows) {
        r = 0;
        c++;
      }
      if (c >= maxCols) {
        c = 0;
        r = 0;
        break;
      }
    }
    return { col: c, row: r };
  }

  setPosition(icon, leftPx, topPx) {
    icon.style.left = `${leftPx}px`;
    icon.style.top = `${topPx}px`;
  }

  snap(icon, exclude = null) {
    const x = parseFloat(icon.style.left) || 0;
    const y = parseFloat(icon.style.top) || 0;
    const { col, row } = this.pixelsToCell(x, y);
    const free = this.nextFreeCell(col, row, exclude || icon);
    const { left, top } = this.cellToPixels(free.col, free.row);
    this.setPosition(icon, left, top);
  }

  placeAtCell(icon, col, row, exclude = null) {
    const free = this.nextFreeCell(col, row, exclude || icon);
    const { left, top } = this.cellToPixels(free.col, free.row);
    this.setPosition(icon, left, top);
  }

  layout(icons, isExplorerIcon = false) {
    const gap = isExplorerIcon ? this.gridSize.gap * 6 : this.gridSize.gap;
    const { width, height } = this.gridSize;
    const cellW = width + gap,
      cellH = height + gap;
    const maxRows = Math.max(1, Math.floor((this.desktop.clientHeight - gap) / cellH));
    let col = 0,
      row = 0;
    requestAnimationFrame(() =>
      icons.forEach((icon) => {
        icon.style.left = `${gap + col * cellW}px`;
        icon.style.top = `${gap + row * cellH}px`;
        row++;
        if (row >= maxRows) {
          row = 0;
          col++;
        }
      })
    );
  }

  layoutRight(icons) {
    const { width, height, gap } = this.gridSize;
    const cellW = width + gap,
      cellH = height + gap;
    const maxRows = Math.max(1, Math.floor((this.desktop.clientHeight - gap) / cellH));
    const maxCols = Math.max(1, Math.floor((this.desktop.clientWidth - gap) / cellW));
    let col = maxCols - 1,
      row = 0;
    requestAnimationFrame(() =>
      icons.forEach((icon) => {
        icon.style.left = `${gap + col * cellW}px`;
        icon.style.top = `${gap + row * cellH}px`;
        row++;
        if (row >= maxRows) {
          row = 0;
          col--;
        }
      })
    );
  }
}

export class PositionStore {
  static load() {
    try {
      return JSON.parse(localStorage.getItem(StorageKeys.positionsKey)) || {};
    } catch {
      return {};
    }
  }
  static save(map) {
    localStorage.setItem(StorageKeys.positionsKey, JSON.stringify(map));
  }
  static getKey(icon) {
    return icon.dataset.folderName
      ? `folder:${icon.dataset.folderName}`
      : icon.dataset.fileName
        ? `file:${icon.dataset.fileName}`
        : `app:${icon.dataset.app}:${IconDataHelper.getIconName(icon)}`;
  }
}

class IconDataHelper {
  static getIconName(icon) {
    const el = icon.querySelector("div, span");
    return el ? el.textContent.trim() : "Unknown";
  }
  static getIconPathMap() {
    return {
      explorer: "/static/icons/files.webp",
      notepad: "/static/icons/notepad.webp",
      flash: "/static/icons/flash.webp",
      browser: "/static/icons/firefox.webp",
      terminal: "/static/icons/terminal.webp",
      music: "/static/icons/music.webp",
      cameraApp: "/static/icons/obs.webp",
      paint: "/static/icons/paint.webp",
      photopea: "/static/icons/photopea.webp",
      vscode: "/static/icons/vscode.webp",
      liventcord: "/static/icons/liventcord.webp",
      gamesApp: "/static/icons/files.webp",
      return: "/static/icons/files.webp"
    };
  }
  static createDesktopFileData(app, name) {
    return JSON.stringify({ app, name, path: this.getIconPathMap()[app] || "/static/icons/file.webp" });
  }
}

class SelectionManager {
  constructor() {
    this.selectedIcons = new Set();
  }
  add(icon) {
    this.selectedIcons.add(icon);
    icon.classList.add("selected");
  }
  remove(icon) {
    this.selectedIcons.delete(icon);
    icon.classList.remove("selected");
  }
  toggle(icon) {
    this.selectedIcons.has(icon) ? this.remove(icon) : this.add(icon);
  }
  clear() {
    this.selectedIcons.forEach((i) => i.classList.remove("selected"));
    this.selectedIcons.clear();
  }
  has(icon) {
    return this.selectedIcons.has(icon);
  }
  toArray() {
    return Array.from(this.selectedIcons);
  }
  forEach(cb) {
    this.selectedIcons.forEach(cb);
  }
}

export class DesktopUI {
  constructor(appLauncher, notepadApp, explorerApp, fileSystemManager, emulatorApp = null) {
    this.appLauncher = appLauncher;
    this.notepadApp = notepadApp;
    this.explorerApp = explorerApp;
    this.emulatorApp = emulatorApp;
    this.fs = fileSystemManager;
    this.desktop = document.getElementById("desktop");
    this.startButton = document.getElementById("start-button");
    this.startMenu = document.getElementById("start-menu");
    this.selectionBox = document.getElementById("selection-box");

    this.positionHelper = new PositionHelper(this.desktop, { width: 80, height: 100, gap: 5 });
    this.selectionManager = new SelectionManager();

    this.state = { clipboard: null, dragTarget: null, explorerDragTarget: null, isUserDragging: false };

    this.templates = {
      iconContextMenu: [
        { id: "ctx-open", label: "Open", action: "open" },
        "hr",
        { id: "ctx-copy", label: "Copy", action: "copy" },
        { id: "ctx-cut", label: "Cut", action: "cut" },
        "hr",
        { id: "ctx-delete", label: "Delete", action: "delete" },
        { id: "ctx-properties", label: "Properties", action: "properties" }
      ],
      folderContextMenu: [
        { id: "ctx-open-folder", label: "Open", action: "openFolder" },
        "hr",
        { id: "ctx-copy-folder", label: "Copy", action: "copyFolder" },
        { id: "ctx-cut-folder", label: "Cut", action: "cutFolder" },
        "hr",
        { id: "ctx-delete-folder", label: "Delete", action: "deleteFolder" },
        { id: "ctx-rename-folder", label: "Rename", action: "renameFolder" }
      ],
      fileIconContextMenu: [
        { id: "ctx-open-file", label: "Open", action: "openFile" },
        "hr",
        { id: "ctx-copy-file", label: "Copy", action: "copyFile" },
        { id: "ctx-cut-file", label: "Cut", action: "cutFile" },
        "hr",
        { id: "ctx-delete-file", label: "Delete", action: "deleteFile" },
        { id: "ctx-rename-file", label: "Rename", action: "renameFile" }
      ],
      desktopContextMenu: [
        { id: "ctx-new-notepad", label: "New Notepad", action: "newNotepad" },
        { id: "ctx-new-folder", label: "New Folder", action: "newFolder" },
        { id: "ctx-open-explorer", label: "Open File Explorer", action: "openExplorer" },
        { id: "ctx-set-wallpaper", label: "Set Wallpaper", action: "setWallpaper" },
        "hr",
        { id: "ctx-paste", label: "Paste", action: "paste", condition: () => !!this.state.clipboard },
        "hr",
        { id: "ctx-refresh", label: "Refresh", action: "refresh" }
      ]
    };

    this.setupEventListeners();
    this.initializeDesktopFiles();
  }

  setEmulator(emulatorApp) {
    this.emulatorApp = emulatorApp;
  }

  setClipboard(data) {
    this.state.clipboard = data;
  }

  getClipboard() {
    return this.state.clipboard;
  }

  async dropFromExplorer(name, isFile, sourcePath, clientX, clientY) {
    const rect = this.desktop.getBoundingClientRect();
    const leftPx = clientX - rect.left;
    const topPx = clientY - rect.top;

    if (isFile) {
      const existingIcon = document.querySelector(`.desktop-file-icon[data-file-name="${CSS.escape(name)}"]`);
      if (existingIcon) {
        this.positionHelper.setPosition(existingIcon, leftPx - 40, topPx - 40);
        this.positionHelper.snap(existingIcon);
        return;
      }

      try {
        const content = await this.fs.getFileContent(sourcePath, name);
        const kind = await this.fs.getFileKind(sourcePath, name);
        const fileIcon = await this.fs.getFileIcon(sourcePath, name);

        const destDir = this.fs.resolveDir(["Desktop"]);
        const destPath = this.fs.join(destDir, name);
        const destExists = await this.fs.exists(destPath);

        let action = "replace";
        if (destExists) {
          const result = await showConflictDialog(name);
          action = result.action;
        }

        if (action === "skip") return;

        let finalName = name;
        if (action === "keep") {
          finalName = await this.fs.getUniqueFileName(["Desktop"], name);
        }

        if (action === "replace") {
          await this.fs.updateFile(["Desktop"], name, content);
          await this.fs.writeMeta(destDir, name, { kind, icon: fileIcon });
        } else {
          await this.fs.createFile(["Desktop"], finalName, content, kind, fileIcon);
        }

        await this.fs.deleteItem(sourcePath, name);

        const icon = await this.createDesktopFileIcon(finalName, { content, kind, icon: fileIcon });
        if (icon) {
          this.positionHelper.setPosition(icon, leftPx - 40, topPx - 40);
          this.positionHelper.snap(icon);
          const { col, row } = this.positionHelper.pixelsToCell(
            parseFloat(icon.style.left) || 0,
            parseFloat(icon.style.top) || 0
          );
          const saved = PositionStore.load();
          saved[PositionStore.getKey(icon)] = { col, row };
          PositionStore.save(saved);
        }
        this.appLauncher.wm.showPopup(`"${finalName}" moved to Desktop`);
      } catch {
        this.appLauncher.wm.showPopup(`Could not move "${name}" to Desktop`);
      }
    } else {
      const existingIcon = document.querySelector(`.folder-icon[data-folder-name="${CSS.escape(name)}"]`);
      if (existingIcon) {
        this.positionHelper.setPosition(existingIcon, leftPx - 40, topPx - 40);
        this.positionHelper.snap(existingIcon);
        return;
      }

      try {
        await this.fs.ensureFolder(["Desktop", name]);
        const srcEntries = await this.fs.getFolder([...sourcePath, name]).catch(() => ({}));

        let applyToAllAction = null;

        for (const [childName, childData] of Object.entries(srcEntries)) {
          if (childData?.type !== "file") continue;

          const childContent = await this.fs.getFileContent([...sourcePath, name], childName);
          const childKind = await this.fs.getFileKind([...sourcePath, name], childName);
          const childIcon = await this.fs.getFileIcon([...sourcePath, name], childName);

          const destDir = this.fs.resolveDir(["Desktop", name]);
          const destFilePath = this.fs.join(destDir, childName);
          const childExists = await this.fs.exists(destFilePath);

          let action = "replace";
          if (childExists) {
            if (applyToAllAction) {
              action = applyToAllAction;
            } else {
              const result = await showConflictDialog(childName);
              if (result.applyToAll) applyToAllAction = result.action;
              action = result.action;
            }
          }

          if (action === "skip") continue;

          if (action === "replace") {
            await this.fs.updateFile(["Desktop", name], childName, childContent);
            await this.fs.writeMeta(destDir, childName, { kind: childKind, icon: childIcon });
          } else {
            await this.fs.createFile(["Desktop", name], childName, childContent, childKind, childIcon);
          }
        }

        await this.fs.deleteItem(sourcePath, name);
        const icon = await this.createFolderIcon(name);
        if (icon) {
          this.positionHelper.setPosition(icon, leftPx - 40, topPx - 40);
          this.positionHelper.snap(icon);
          const { col, row } = this.positionHelper.pixelsToCell(
            parseFloat(icon.style.left) || 0,
            parseFloat(icon.style.top) || 0
          );
          const saved = PositionStore.load();
          saved[PositionStore.getKey(icon)] = { col, row };
          PositionStore.save(saved);
        }
        this.appLauncher.wm.showPopup(`"${name}" folder moved to Desktop`);
      } catch {
        this.appLauncher.wm.showPopup(`Could not move "${name}" to Desktop`);
      }
    }
  }

  setupEventListeners() {
    this.startButton.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleStartMenu();
      document.querySelector('.start-cat[data-cat="menu"]').click();
    });
    this.startMenu.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("click", () => this.closeAllMenus());
    this.desktop.addEventListener("contextmenu", (e) => this.handleContextMenu(e));
    this.setupIconHandlers();
    this.setupInteractableSelection();
    this.setupStartMenu();
    this.setupKeyboardShortcuts();
    this.setupBrowserDrop();
  }

  setupKeyboardShortcuts() {
    let lastMousePos = { x: 50, y: 50 };
    document.addEventListener("mousemove", (e) => {
      lastMousePos = { x: e.pageX, y: e.pageY };
    });

    document.addEventListener("keydown", (e) => {
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)) return;
      if (e.ctrlKey && e.code === "KeyV") {
        e.preventDefault();
        if (!this.state.clipboard) return;
        const explorerWins = document.querySelectorAll("[id^='explorer-']");
        let targetExplorerWin = null;

        for (const win of explorerWins) {
          const view = win.querySelector("[id$='-view']");
          if (!view) continue;
          const rect = view.getBoundingClientRect();
          if (
            lastMousePos.x >= rect.left &&
            lastMousePos.x <= rect.right &&
            lastMousePos.y >= rect.top &&
            lastMousePos.y <= rect.bottom
          ) {
            targetExplorerWin = win;
            break;
          }
        }
        if (targetExplorerWin) {
          const winId = targetExplorerWin.id;
          const inst = this.explorerApp?._getInstance(winId);
          if (inst) {
            const iconsData = this.state.clipboard.icons;
            const action = this.state.clipboard.action;
            const source = this.state.clipboard.source;
            const sourceInst = this.state.clipboard.sourceInst;
            (async () => {
              if (source === "explorer") {
                for (const iconData of iconsData) {
                  const name = iconData.data.name;
                  const srcPath = iconData.data.path;
                  try {
                    const content = await this.fs.getFileContent(srcPath, name);
                    const kind = await this.fs.getFileKind(srcPath, name);
                    const fileIcon = await this.fs.getFileIcon(srcPath, name);
                    await this.fs.createFile(inst.currentPath, name, content, kind, fileIcon);
                    if (action === "cut") {
                      await this.fs.deleteItem(srcPath, name);
                    }
                  } catch {}
                }
                if (action === "cut") {
                  this.state.clipboard = null;
                  if (sourceInst) await this.explorerApp.renderInstance(sourceInst);
                }
              } else {
                for (const iconData of iconsData) {
                  const appId = iconData.data.app;
                  const tmp = document.createElement("div");
                  tmp.innerHTML = iconData.data.innerHTML;
                  const nameEl = tmp.querySelector("div, span");
                  const iconName = (nameEl ? nameEl.textContent.trim() : "") || iconData.data.name || appId;
                  const fileName = `${iconName}.desktop`;
                  const fileContent = IconDataHelper.createDesktopFileData(appId, iconName);
                  await this.fs.createFile(inst.currentPath, fileName, fileContent, "text");
                  if (action === "cut" && iconData.element) iconData.element.remove();
                }
                if (action === "cut") this.state.clipboard = null;
              }
              await this.explorerApp.renderInstance(inst);
              this.appLauncher.wm.showPopup(`${iconsData.length} item${iconsData.length !== 1 ? "s" : ""} pasted`);
            })();
            return;
          }
        }
        if (this.state.clipboard.source === "explorer") {
          const iconsData = this.state.clipboard.icons;
          const action = this.state.clipboard.action;
          const sourceInst = this.state.clipboard.sourceInst;
          (async () => {
            for (const iconData of iconsData) {
              await this.dropFromExplorer(iconData.data.name, true, iconData.data.path, lastMousePos.x, lastMousePos.y);
            }
            if (action === "cut") {
              this.state.clipboard = null;
              if (sourceInst) await this.explorerApp.renderInstance(sourceInst);
            }
          })();
          return;
        }
      }
    });
  }

  setupBrowserDrop() {
    const OVERLAY_ID = "browser-drop-overlay";

    const getOverlay = () => document.getElementById(OVERLAY_ID);

    const createOverlay = (label) => {
      let el = getOverlay();
      if (!el) {
        el = document.createElement("div");
        el.id = OVERLAY_ID;
        el.style.cssText = `
          position:fixed;inset:0;pointer-events:none;z-index:99999;
          display:flex;align-items:center;justify-content:center;
          transition:background 0.15s;
        `;
        document.body.appendChild(el);
      }
      el.style.background = "rgba(79,158,255,0.13)";
      el.style.border = "2.5px dashed rgba(79,158,255,0.55)";
      el.style.boxSizing = "border-box";
      el.innerHTML = `<span style="
        background:rgba(20,28,48,0.82);color:#7ecfff;
        font-size:15px;padding:10px 22px;border-radius:10px;
        pointer-events:none;font-family:inherit;letter-spacing:0.02em;
      ">${label}</span>`;
      return el;
    };

    const removeOverlay = () => {
      const el = getOverlay();
      if (el) el.remove();
    };

    const getExplorerInstanceAtPoint = (clientX, clientY) => {
      if (!this.explorerApp) return null;
      for (const [winId, inst] of this.explorerApp._instances) {
        if (inst.mode !== "browse") continue;
        const win = document.getElementById(winId);
        if (!win) continue;
        const view = win.querySelector(`#${winId}-view`);
        if (!view) continue;
        const r = view.getBoundingClientRect();
        if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
          return inst;
        }
      }
      return null;
    };

    const hasBrowserFiles = (dt) => {
      if (!dt) return false;
      for (const item of dt.items) {
        if (item.kind === "file") return true;
      }
      return false;
    };

    let dragCounter = 0;

    document.addEventListener("dragenter", (e) => {
      if (!hasBrowserFiles(e.dataTransfer)) return;
      dragCounter++;
      if (dragCounter !== 1) return;
      e.preventDefault();
      const inst = getExplorerInstanceAtPoint(e.clientX, e.clientY);
      const label = inst
        ? `Drop to save here → ${inst.currentPath.length ? inst.currentPath.join("/") : "Home"}`
        : "Drop to save to Desktop";
      createOverlay(label);
    });

    document.addEventListener("dragover", (e) => {
      if (!hasBrowserFiles(e.dataTransfer)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      const overlay = getOverlay();
      if (!overlay) return;
      const inst = getExplorerInstanceAtPoint(e.clientX, e.clientY);
      const label = inst
        ? `Drop to save here → ${inst.currentPath.length ? inst.currentPath.join("/") : "Home"}`
        : "Drop to save to Desktop";
      const span = overlay.querySelector("span");
      if (span) span.textContent = label;
    });

    document.addEventListener("dragleave", (e) => {
      if (!hasBrowserFiles(e.dataTransfer)) return;
      dragCounter = Math.max(0, dragCounter - 1);
      if (dragCounter === 0) removeOverlay();
    });

    document.addEventListener("drop", async (e) => {
      dragCounter = 0;
      removeOverlay();

      if (!hasBrowserFiles(e.dataTransfer)) return;
      e.preventDefault();

      const files = Array.from(e.dataTransfer.files);
      if (!files.length) return;

      const inst = getExplorerInstanceAtPoint(e.clientX, e.clientY);

      if (inst && this.explorerApp) {
        const win = document.getElementById(inst.winId);
        await this.explorerApp.handleFileUpload(files, false, win, inst);
        return;
      }

      let uploadedCount = 0;
      for (const file of files) {
        try {
          const { kind, content, icon } = await this.explorerApp._resolveFilePayload(file, file.name, ["Desktop"]);
          const dir = this.fs.resolveDir(["Desktop"]);
          const destExists = await this.fs.exists(this.fs.join(dir, file.name));

          let finalName = file.name;
          if (destExists) {
            const { showConflictDialog } = await import("./shared/conflictDialog.js");
            const result = await showConflictDialog(file.name);
            if (result.action === "skip") continue;
            if (result.action === "keep") {
              finalName = await this.fs.getUniqueFileName(["Desktop"], file.name);
            }
          }

          if (kind === "video") {
            await this.fs.writeBinaryFile(["Desktop"], finalName, content, kind, icon);
          } else {
            await this.fs.createFile(["Desktop"], finalName, content, kind, icon);
          }

          const itemData = { type: "file", kind, icon, content };
          await this.createDesktopFileIcon(finalName, itemData);
          uploadedCount++;
        } catch {
          this.appLauncher.wm.showPopup(`Could not save "${file.name}"`);
        }
      }
      if (uploadedCount > 0) {
        this.appLauncher.wm.showPopup(`${uploadedCount} file${uploadedCount !== 1 ? "s" : ""} saved to Desktop`);
      }
    });
  }

  closeStartMenu() {
    this.startMenu.classList.add("closing");
    this.startMenu.addEventListener(
      "animationend",
      () => {
        this.startMenu.classList.remove("closing");
        this.startMenu.style.display = "none";
      },
      { once: true }
    );
  }

  toggleStartMenu() {
    if (this.startMenu.style.display === "flex") {
      this.closeStartMenu();
    } else {
      this.startMenu.style.display = "flex";
      updateFavoritesUI(this.appLauncher);
    }
  }

  closeAllMenus() {
    if (this.startMenu.style.display === "flex") this.closeStartMenu();
    hideMenu();
  }

  handleContextMenu(e) {
    if (e.target.closest(".desktop-file-icon")) {
      e.preventDefault();
      this.showFileIconContextMenu(e, e.target.closest(".desktop-file-icon"));
    } else if (e.target.classList.contains("folder-icon")) {
      e.preventDefault();
      this.showFolderContextMenu(e, e.target);
    } else if (e.target.classList.contains("selectable")) {
      e.preventDefault();
      this.showIconContextMenu(e, e.target);
    } else if (e.target === this.desktop) {
      e.preventDefault();
      this.showDesktopContextMenu(e);
    }
  }

  setupIconHandlers() {
    document.querySelectorAll(".icon.selectable").forEach((icon) => this.makeIconInteractable(icon));
  }

  makeIconInteractable(icon, ignoreDrag = false) {
    icon.draggable = false;
    Object.assign(icon.style, { userSelect: "none", webkitUserDrag: "none", cursor: "default" });
    if (!ignoreDrag) this.setupInteractDrag(icon);
    this.attachIconEvents(icon);
  }

  attachIconEvents(icon) {
    icon.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      if (icon.classList.contains("folder-icon")) this.openFolder(icon.dataset.folderName);
      else this.appLauncher.launch(icon.dataset.app);
    });
    icon.addEventListener("mousedown", (e) => this.handleIconSelection(icon, e.ctrlKey));
  }

  async openFolder(folderName) {
    this.explorerApp.open();
    await this.explorerApp.navigate(["Desktop", folderName]);
  }

  handleIconSelection(icon, isCtrlKey) {
    if (!isCtrlKey) {
      if (!this.selectionManager.has(icon)) {
        this.selectionManager.clear();
        this.selectionManager.add(icon);
      }
    } else {
      this.selectionManager.toggle(icon);
    }
  }

  setupInteractDrag(icon) {
    interact(icon)
      .resizable(false)
      .draggable({
        inertia: false,
        modifiers: [
          interact.modifiers.restrict({
            restriction: this.desktop,
            elementRect: { top: 0, left: 0, bottom: 1, right: 1 }
          })
        ],
        autoScroll: false,
        cursorChecker: () => null,
        listeners: {
          start: () => this.onDragStart(),
          move: (event) => this.onDragMove(event),
          end: () => this.onDragEnd()
        }
      });
  }

  onDragStart() {
    this.state.isUserDragging = true;
    this.selectionManager.forEach((icon) =>
      Object.assign(icon.style, { opacity: "0.7", zIndex: "1200", cursor: "move" })
    );
  }

  onDragMove(event) {
    const { dx, dy } = event;
    this.selectionManager.forEach((icon) => {
      this.positionHelper.setPosition(
        icon,
        Math.max(0, (parseFloat(icon.style.left) || 0) + dx),
        Math.max(0, (parseFloat(icon.style.top) || 0) + dy)
      );
    });
    this.updateDragTarget(event);
  }

  updateDragTarget(event) {
    let foundFolder = null;
    document.querySelectorAll(".folder-icon").forEach((folder) => {
      if (this.selectionManager.has(folder)) return;
      const rect = folder.getBoundingClientRect();
      if (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      )
        foundFolder = folder;
    });

    if (this.state.dragTarget) this.state.dragTarget.style.outline = "";
    if (foundFolder && !this.selectionManager.has(foundFolder)) {
      foundFolder.style.outline = "2px solid #0078d7";
      this.state.dragTarget = foundFolder;
    } else {
      this.state.dragTarget = null;
    }

    let foundExplorer = null;
    if (!foundFolder) {
      document.querySelectorAll("[id^='explorer-']").forEach((win) => {
        const view = win.querySelector("[id$='-view']");
        if (!view) return;
        const rect = view.getBoundingClientRect();
        if (
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom
        )
          foundExplorer = win;
      });
    }

    if (this.state.explorerDragTarget && this.state.explorerDragTarget !== foundExplorer) {
      this.state.explorerDragTarget.querySelector("[id$='-view']")?.style.setProperty("outline", "");
    }
    if (foundExplorer) {
      foundExplorer.querySelector("[id$='-view']").style.outline = "2px solid rgba(79,158,255,0.8)";
      this.state.explorerDragTarget = foundExplorer;
    } else {
      this.state.explorerDragTarget = null;
    }
  }

  async moveIconsToFolder(icons, folderName) {
    const saved = PositionStore.load();
    let moved = 0;
    for (const icon of icons) {
      if (icon.classList.contains("folder-icon")) continue;
      const name = IconDataHelper.getIconName(icon);
      const fileName = `${name}.desktop`;
      const fileContent = await this.fs.getFileContent(["Desktop"], fileName);
      await this.fs.createFile(["Desktop", folderName], fileName, fileContent, "text");
      await this.fs.deleteItem(["Desktop"], fileName);
      delete saved[PositionStore.getKey(icon)];
      icon.remove();
      this.selectionManager.remove(icon);
      moved++;
    }
    PositionStore.save(saved);
    this.selectionManager.clear();
    if (moved > 0) this.appLauncher.wm.showPopup(`${moved} item${moved !== 1 ? "s" : ""} moved to "${folderName}"`);
  }

  async onDragEnd() {
    if (!this.state.isUserDragging) return;
    this.state.isUserDragging = false;

    if (this.state.explorerDragTarget) {
      const explorerWin = this.state.explorerDragTarget;
      explorerWin.querySelector("[id$='-view']")?.style.setProperty("outline", "");
      this.state.explorerDragTarget = null;
      this.selectionManager.forEach((icon) =>
        Object.assign(icon.style, { opacity: "1", zIndex: "1", cursor: "default" })
      );
      await this.moveIconsToExplorer(this.selectionManager.toArray(), explorerWin.id);
      return;
    }

    if (this.state.dragTarget) {
      await this.moveIconsToFolder(this.selectionManager.toArray(), this.state.dragTarget.dataset.folderName);
      this.state.dragTarget.style.outline = "";
      this.state.dragTarget = null;
    } else {
      const saved = PositionStore.load();
      this.selectionManager.forEach((icon) => {
        this.positionHelper.snap(icon);
        Object.assign(icon.style, { opacity: "1", zIndex: "1", cursor: "default" });
        const { col, row } = this.positionHelper.pixelsToCell(
          parseFloat(icon.style.left) || 0,
          parseFloat(icon.style.top) || 0
        );
        saved[PositionStore.getKey(icon)] = { col, row };
      });
      PositionStore.save(saved);
    }
  }

  async moveIconsToExplorer(icons, explorerWinId) {
    if (!this.explorerApp) return;
    const inst = this.explorerApp._getInstance(explorerWinId);
    if (!inst) return;

    await this.fs.ensureFolder(["Desktop"]);
    await this.fs.ensureFolder(inst.currentPath.length ? inst.currentPath : []);

    const saved = PositionStore.load();
    let moved = 0;
    let applyToAllAction = null;

    for (const icon of icons) {
      const isDesktopFile = icon.classList.contains("desktop-file-icon");
      const isFolderIcon = icon.classList.contains("folder-icon");

      try {
        if (isDesktopFile) {
          const fileName = icon.dataset.fileName;
          const content = await this.fs.getFileContent(["Desktop"], fileName);
          const kind = await this.fs.getFileKind(["Desktop"], fileName);
          const fileIcon = await this.fs.getFileIcon(["Desktop"], fileName);

          const destDir = this.fs.resolveDir(inst.currentPath);
          const destFilePath = this.fs.join(destDir, fileName);
          const destExists = await this.fs.exists(destFilePath);

          let action = "replace";
          if (destExists) {
            if (applyToAllAction) {
              action = applyToAllAction;
            } else {
              const result = await showConflictDialog(fileName);
              if (result.applyToAll) applyToAllAction = result.action;
              action = result.action;
            }
          }

          if (action === "skip") continue;

          if (action === "replace") {
            await this.fs.updateFile(inst.currentPath, fileName, content);
            await this.fs.writeMeta(destDir, fileName, { kind, icon: fileIcon });
          } else {
            await this.fs.createFile(inst.currentPath, fileName, content, kind, fileIcon);
          }

          await this.fs.deleteItem(["Desktop"], fileName);
          delete saved[PositionStore.getKey(icon)];
          icon.remove();
          this.selectionManager.remove(icon);
          moved++;
        } else if (isFolderIcon) {
          const folderName = icon.dataset.folderName;
          const destPath = inst.currentPath.length ? inst.currentPath : [];
          await this.fs.ensureFolder([...destPath, folderName]);
          const srcEntries = await this.fs.getFolder(["Desktop", folderName]).catch(() => ({}));

          for (const [childName, childData] of Object.entries(srcEntries)) {
            if (childData?.type !== "file") continue;

            const childContent = await this.fs.getFileContent(["Desktop", folderName], childName);
            const childKind = await this.fs.getFileKind(["Desktop", folderName], childName);
            const childIcon = await this.fs.getFileIcon(["Desktop", folderName], childName);

            const destDir = this.fs.resolveDir([...destPath, folderName]);
            const destFilePath = this.fs.join(destDir, childName);
            const childExists = await this.fs.exists(destFilePath);

            let action = "replace";
            if (childExists) {
              if (applyToAllAction) {
                action = applyToAllAction;
              } else {
                const result = await showConflictDialog(childName);
                if (result.applyToAll) applyToAllAction = result.action;
                action = result.action;
              }
            }

            if (action === "skip") continue;

            if (action === "replace") {
              await this.fs.updateFile([...destPath, folderName], childName, childContent);
              await this.fs.writeMeta(destDir, childName, { kind: childKind, icon: childIcon });
            } else {
              await this.fs.createFile([...destPath, folderName], childName, childContent, childKind, childIcon);
            }
          }

          await this.fs.deleteItem(["Desktop"], folderName);
          delete saved[PositionStore.getKey(icon)];
          icon.remove();
          this.selectionManager.remove(icon);
          moved++;
        } else {
          const name = IconDataHelper.getIconName(icon);
          const fileName = `${name}.desktop`;
          const content = await this.fs.getFileContent(["Desktop"], fileName);

          const destDir = this.fs.resolveDir(inst.currentPath);
          const destFilePath = this.fs.join(destDir, fileName);
          const destExists = await this.fs.exists(destFilePath);

          let action = "replace";
          if (destExists) {
            if (applyToAllAction) {
              action = applyToAllAction;
            } else {
              const result = await showConflictDialog(fileName);
              if (result.applyToAll) applyToAllAction = result.action;
              action = result.action;
            }
          }

          if (action === "skip") continue;

          if (action === "replace") {
            await this.fs.updateFile(inst.currentPath, fileName, content);
          } else {
            await this.fs.createFile(inst.currentPath, fileName, content, "text");
          }

          await this.fs.deleteItem(["Desktop"], fileName);
          delete saved[PositionStore.getKey(icon)];
          icon.remove();
          this.selectionManager.remove(icon);
          moved++;
        }
      } catch (err) {
        console.error("moveIconsToExplorer error for icon:", err);
      }
    }

    PositionStore.save(saved);
    this.selectionManager.clear();
    if (moved > 0) {
      const pathLabel = inst.currentPath.length ? inst.currentPath.join("/") : "Home";
      this.appLauncher.wm.showPopup(`${moved} item${moved !== 1 ? "s" : ""} moved to ${pathLabel}`);
      await this.explorerApp.renderInstance(inst);
    }
  }

  _buildDesktopClipboard(action, icons) {
    return {
      source: "desktop",
      action,
      icons: icons.map((icon) => ({
        element: icon,
        data: {
          app: icon.dataset.app,
          name: icon.dataset.fileName || IconDataHelper.getIconName(icon),
          fileName: icon.dataset.fileName || null,
          folderName: icon.dataset.folderName || null,
          isDesktopFile: icon.classList.contains("desktop-file-icon"),
          isFolderIcon: icon.classList.contains("folder-icon"),
          innerHTML: icon.innerHTML
        }
      })),
      sourceInst: null
    };
  }

  async _pasteToDesktop() {
    if (!this.state.clipboard) return;
    const cb = this.state.clipboard;
    const action = cb.action;
    let pastedCount = 0;
    let applyToAllAction = null;

    if (cb.source === "explorer") {
      for (const iconData of cb.icons) {
        const name = iconData.data.name;
        const srcPath = iconData.data.path;
        const isFile = iconData.data.isFile !== false;

        try {
          if (isFile) {
            const content = await this.fs.getFileContent(srcPath, name);
            const kind = await this.fs.getFileKind(srcPath, name);
            const fileIcon = await this.fs.getFileIcon(srcPath, name);

            const destDir = this.fs.resolveDir(["Desktop"]);
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

            if (resolvedAction === "skip") continue;

            let finalName = name;
            if (resolvedAction === "keep") {
              finalName = await this.fs.getUniqueFileName(["Desktop"], name);
            }

            if (resolvedAction === "replace") {
              await this.fs.updateFile(["Desktop"], name, content);
              await this.fs.writeMeta(destDir, name, { kind, icon: fileIcon });
            } else {
              await this.fs.createFile(["Desktop"], finalName, content, kind, fileIcon);
            }

            if (action === "cut") await this.fs.deleteItem(srcPath, name);

            const existingIcon = document.querySelector(
              `.desktop-file-icon[data-file-name="${CSS.escape(finalName)}"]`
            );
            if (!existingIcon) await this.createDesktopFileIcon(finalName, { content, kind, icon: fileIcon });
            pastedCount++;
          } else {
            await this.fs.ensureFolder(["Desktop", name]);
            const srcEntries = await this.fs.getFolder([...srcPath, name]).catch(() => ({}));

            for (const [childName, childData] of Object.entries(srcEntries)) {
              if (childData?.type !== "file") continue;

              const childContent = await this.fs.getFileContent([...srcPath, name], childName);
              const childKind = await this.fs.getFileKind([...srcPath, name], childName);
              const childIcon = await this.fs.getFileIcon([...srcPath, name], childName);

              const destDir = this.fs.resolveDir(["Desktop", name]);
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
                await this.fs.updateFile(["Desktop", name], childName, childContent);
                await this.fs.writeMeta(destDir, childName, { kind: childKind, icon: childIcon });
              } else {
                await this.fs.createFile(["Desktop", name], childName, childContent, childKind, childIcon);
              }
            }

            if (action === "cut") await this.fs.deleteItem(srcPath, name);

            const existingFolder = document.querySelector(`.folder-icon[data-folder-name="${CSS.escape(name)}"]`);
            if (!existingFolder) await this.createFolderIcon(name);
            pastedCount++;
          }
        } catch {
          this.appLauncher.wm.showPopup(`Could not paste "${name}"`);
        }
      }

      if (action === "cut") {
        this.state.clipboard = null;
        if (cb.sourceInst) await this.explorerApp.renderInstance(cb.sourceInst);
      }
    } else if (cb.source === "desktop") {
      for (const iconData of cb.icons) {
        const { isDesktopFile, isFolderIcon, fileName, folderName, app, name, innerHTML } = iconData.data;
        const element = iconData.element;

        try {
          if (isDesktopFile) {
            const srcName = fileName;
            const content = await this.fs.getFileContent(["Desktop"], srcName);
            const kind = await this.fs.getFileKind(["Desktop"], srcName);
            const fileIcon = await this.fs.getFileIcon(["Desktop"], srcName);

            if (action === "copy") {
              const uniqueName = await this.fs.getUniqueFileName(["Desktop"], srcName);
              await this.fs.createFile(["Desktop"], uniqueName, content, kind, fileIcon);
              await this.createDesktopFileIcon(uniqueName, { content, kind, icon: fileIcon });
            }
            pastedCount++;
          } else if (isFolderIcon) {
            const srcName = folderName;

            if (action === "copy") {
              let uniqueName = await this.fs.getUniqueFileName(["Desktop"], srcName);
              await this.fs.ensureFolder(["Desktop", uniqueName]);
              const srcEntries = await this.fs.getFolder(["Desktop", srcName]).catch(() => ({}));

              for (const [childName, childData] of Object.entries(srcEntries)) {
                if (childData?.type !== "file") continue;
                const childContent = await this.fs.getFileContent(["Desktop", srcName], childName);
                const childKind = await this.fs.getFileKind(["Desktop", srcName], childName);
                const childIcon = await this.fs.getFileIcon(["Desktop", srcName], childName);
                await this.fs.createFile(["Desktop", uniqueName], childName, childContent, childKind, childIcon);
              }

              await this.createFolderIcon(uniqueName);
            }
            pastedCount++;
          } else {
            const iconName = name || IconDataHelper.getIconName(element || { querySelector: () => null });
            const srcFileName = `${iconName}.desktop`;
            const content = await this.fs.getFileContent(["Desktop"], srcFileName);

            if (action === "copy") {
              const uniqueName = await this.fs.getUniqueFileName(["Desktop"], srcFileName);
              await this.fs.createFile(["Desktop"], uniqueName, content, "text");
            }
            pastedCount++;
          }
        } catch {
          this.appLauncher.wm.showPopup(`Could not paste item`);
        }
      }

      if (action === "cut") {
        this.state.clipboard = null;
      }
    }

    if (pastedCount > 0) {
      this.appLauncher.wm.showPopup(`${pastedCount} item${pastedCount !== 1 ? "s" : ""} pasted`);
    }
  }

  showFolderContextMenu(e, folderIcon) {
    this.selectionManager.clear();
    this.selectionManager.add(folderIcon);
    showContextMenu(e, this.templates.folderContextMenu, {
      openFolder: () => this.openFolder(folderIcon.dataset.folderName),
      copyFolder: () => {
        this.state.clipboard = this._buildDesktopClipboard("copy", [folderIcon]);
        this.appLauncher.wm.showPopup(`"${folderIcon.dataset.folderName}" copied`);
      },
      cutFolder: () => {
        this.state.clipboard = this._buildDesktopClipboard("cut", [folderIcon]);
        folderIcon.style.opacity = "0.5";
        this.appLauncher.wm.showPopup(`"${folderIcon.dataset.folderName}" cut`);
      },
      deleteFolder: async () => {
        const folderName = folderIcon.dataset.folderName;
        await this.fs.deleteItem(["Desktop"], folderName);
        folderIcon.remove();
        this.selectionManager.clear();
        this.appLauncher.wm.showPopup(`Folder "${folderName}" deleted`);
      },
      renameFolder: async () => {
        const newName = prompt("Enter new folder name:", folderIcon.dataset.folderName);
        if (newName && newName !== folderIcon.dataset.folderName) {
          await this.fs.renameItem(["Desktop"], folderIcon.dataset.folderName, newName);
          const saved = PositionStore.load();
          const oldKey = PositionStore.getKey(folderIcon);
          folderIcon.dataset.folderName = newName;
          folderIcon.querySelector("span, div").textContent = newName;
          const newKey = PositionStore.getKey(folderIcon);
          if (saved[oldKey]) {
            saved[newKey] = saved[oldKey];
            delete saved[oldKey];
            PositionStore.save(saved);
          }
          this.appLauncher.wm.showPopup(`Renamed to "${newName}"`);
        }
      }
    });
  }

  showFileIconContextMenu(e, fileIcon) {
    const fileName = fileIcon.dataset.fileName;
    showContextMenu(e, this.templates.fileIconContextMenu, {
      openFile: () => this._openDesktopFile(fileName),
      copyFile: () => {
        this.state.clipboard = this._buildDesktopClipboard("copy", [fileIcon]);
        this.appLauncher.wm.showPopup(`"${fileName}" copied`);
      },
      cutFile: () => {
        this.state.clipboard = this._buildDesktopClipboard("cut", [fileIcon]);
        fileIcon.style.opacity = "0.5";
        this.appLauncher.wm.showPopup(`"${fileName}" cut`);
      },
      deleteFile: async () => {
        await this.fs.deleteItem(["Desktop"], fileName);
        fileIcon.remove();
        this.appLauncher.wm.showPopup(`"${fileName}" deleted`);
      },
      renameFile: async () => {
        const newName = prompt("Enter new name:", fileName);
        if (newName && newName !== fileName) {
          await this.fs.renameItem(["Desktop"], fileName, newName);
          fileIcon.dataset.fileName = newName;
          fileIcon.querySelector("span").textContent = newName;
          this.appLauncher.wm.showPopup(`Renamed to "${newName}"`);
        }
      }
    });
  }

  showIconContextMenu(e, icon) {
    if (!this.selectionManager.has(icon)) {
      this.selectionManager.clear();
      this.selectionManager.add(icon);
    }
    const selectedArray = this.selectionManager.toArray();
    const last = selectedArray[selectedArray.length - 1];
    showContextMenu(e, this.templates.iconContextMenu, {
      open: () => this.appLauncher.launch(last.dataset.app),
      copy: () => {
        this.state.clipboard = this._buildDesktopClipboard("copy", selectedArray);
        this.appLauncher.wm.showPopup(`${selectedArray.length} item${selectedArray.length !== 1 ? "s" : ""} copied`);
      },
      cut: () => {
        this.state.clipboard = this._buildDesktopClipboard("cut", selectedArray);
        selectedArray.forEach((i) => (i.style.opacity = "0.5"));
        this.appLauncher.wm.showPopup(`${selectedArray.length} item${selectedArray.length !== 1 ? "s" : ""} cut`);
      },
      delete: () => this.deleteSelectedIcons(selectedArray),
      properties: () => this.showPropertiesDialog(last)
    });
  }

  deleteSelectedIcons(selectedArray) {
    const saved = PositionStore.load();
    selectedArray.forEach((icon) => {
      delete saved[PositionStore.getKey(icon)];
      this.selectionManager.remove(icon);
      icon.remove();
    });
    PositionStore.save(saved);
  }

  showPropertiesDialog(icon) {
    const rect = icon.getBoundingClientRect();
    const appId = icon.dataset.app;
    const appInfo = this.appLauncher?.appMap?.[appId] ?? {};
    const name = IconDataHelper.getIconName(icon);
    const pathMap = IconDataHelper.getIconPathMap();
    const props = {
      Name: name,
      Type: appId || "Application",
      Path: pathMap[appId] || "/static/icons/file.webp",
      "App Type": appInfo.type,
      "SWF Path": appInfo.swf,
      URL: appInfo.url,
      Width: `${Math.round(rect.width)}px`,
      Height: `${Math.round(rect.height)}px`,
      Left: `${Math.round(rect.left)}px`,
      Top: `${Math.round(rect.top)}px`,
      "Z-Index": icon.style.zIndex || "0"
    };
    const contentHtml = Object.entries(props)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => `<div style="margin:2px 0;">${k}: ${v}</div>`)
      .join("");
    const title = `Properties: ${name}`;
    const propsWin = this.appLauncher.wm.createWindow(`${icon.id || Date.now()}-props`, title, "300px", "auto");
    propsWin.innerHTML = `
      <div class="window-header"><span>${title}</span>
        ${this.wm.getWindowControls()}

      <div class="window-content" style="width:100%;height:100%;overflow:auto;user-select:text;padding:10px;">${contentHtml}</div>
    `;
    desktop.appendChild(propsWin);
    this.appLauncher.wm.makeDraggable(propsWin);
    this.appLauncher.wm.makeResizable(propsWin);
    this.appLauncher.wm.setupWindowControls(propsWin);
  }

  showDesktopContextMenu(e) {
    showContextMenu(e, this.templates.desktopContextMenu, {
      newNotepad: () => this.notepadApp.open(),
      newFolder: async () => {
        const folderName = prompt("Enter folder name:", "New Folder");
        if (folderName) {
          await this.fs.createFolder(["Desktop"], folderName);
          await this.createFolderIcon(folderName);
          this.appLauncher.wm.showPopup(`Folder "${folderName}" created`);
        }
      },
      openExplorer: () => this.explorerApp.open(),
      setWallpaper: async () => {
        await this.explorerApp.open();
        setTimeout(() => {
          this.explorerApp.navigate(["Pictures", "Wallpapers"]);
        }, 50);
      },
      paste: async () => {
        await this._pasteToDesktop();
      },
      refresh: async () => {
        document.querySelectorAll(".folder-icon, .desktop-file-icon").forEach((i) => i.remove());
        await this.loadDesktopItems();
        location.reload();
      }
    });
  }

  async initializeDesktopFiles() {
    await this.fs.ensureFolder(["Desktop"]);
    const saved = PositionStore.load();
    const icons = Array.from(document.querySelectorAll(".icon.selectable:not(.folder-icon):not(.desktop-file-icon)"));
    const systemIcons = [];
    const regularIcons = [];

    for (const icon of icons) {
      const name = IconDataHelper.getIconName(icon);
      const app = icon.dataset.app;
      const fileName = `${name}.desktop`;
      const dir = this.fs.resolveDir(["Desktop"]);
      const alreadyExists = await this.fs.exists(this.fs.join(dir, fileName));
      if (!alreadyExists) {
        await this.fs.createFile(["Desktop"], fileName, IconDataHelper.createDesktopFileData(app, name), "text");
      }
      const key = PositionStore.getKey(icon);
      if (saved[key]) this.positionHelper.placeAtCell(icon, saved[key].col, saved[key].row, icon);
      else if (systemApps.has(app)) systemIcons.push(icon);
      else regularIcons.push(icon);
    }

    if (regularIcons.length) this.positionHelper.layout(regularIcons);
    if (systemIcons.length) this.positionHelper.layoutRight(systemIcons);
    await this.loadDesktopItems();
  }

  async loadDesktopItems() {
    const desktopFolder = await this.fs.getFolder(["Desktop"]);
    for (const [name, itemData] of Object.entries(desktopFolder)) {
      if (!itemData.type) {
        await this.createFolderIcon(name);
      } else if (itemData.type === "file" && !name.endsWith(".desktop")) {
        await this.createDesktopFileIcon(name, itemData);
      }
    }
  }

  async createDesktopFileIcon(fileName, itemData = null) {
    if (document.querySelector(`.desktop-file-icon[data-file-name="${fileName}"]`)) return;

    let thumbnailSrc = null;
    if (isImageFile(fileName)) {
      thumbnailSrc = itemData?.content || itemData?.icon || (await this.fs.getFileContent(["Desktop"], fileName));
    }

    const iconHTML = buildFileIconHTML(fileName, { thumbnailSrc, size: 64, radius: 12 });
    const icon = document.createElement("div");
    icon.className = "icon selectable desktop-file-icon";
    icon.dataset.fileName = fileName;
    icon.innerHTML = `${iconHTML}<span>${fileName}</span>`;
    Object.assign(icon.style, { position: "absolute", userSelect: "none", cursor: "default" });

    icon.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      this._openDesktopFile(fileName);
    });
    icon.addEventListener("mousedown", (e) => this.handleIconSelection(icon, e.ctrlKey));
    icon.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showFileIconContextMenu(e, icon);
    });

    this.desktop.appendChild(icon);
    this.setupInteractDrag(icon);

    const saved = PositionStore.load();
    const key = PositionStore.getKey(icon);
    if (saved[key]) this.positionHelper.placeAtCell(icon, saved[key].col, saved[key].row, icon);
    else this.positionHelper.snap(icon);

    return icon;
  }

  async _openDesktopFile(fileName) {
    await openFileWith({
      name: fileName,
      path: ["Desktop"],
      fs: this.fs,
      notepadApp: this.notepadApp,
      emulatorApp: this.emulatorApp,
      windowManager: this.appLauncher.wm
    });
  }

  async createFolderIcon(folderName) {
    if (document.querySelector(`.folder-icon[data-folder-name="${folderName}"]`)) return;
    const folderIcon = document.createElement("div");
    folderIcon.className = "icon selectable folder-icon";
    folderIcon.dataset.folderName = folderName;
    folderIcon.innerHTML = `<img src="/static/icons/file.webp" style="width:64px;height:64px"><div>${folderName}</div>`;
    this.desktop.appendChild(folderIcon);
    this.makeIconInteractable(folderIcon);
    const saved = PositionStore.load();
    const key = PositionStore.getKey(folderIcon);
    if (saved[key]) this.positionHelper.placeAtCell(folderIcon, saved[key].col, saved[key].row, folderIcon);
    else this.positionHelper.snap(folderIcon);
    return folderIcon;
  }

  setupInteractableSelection() {
    let selectionState = { startX: 0, startY: 0, isActive: false };
    let mousedownOnDesktop = false;
    this.desktop.addEventListener("mousedown", (e) => {
      mousedownOnDesktop = e.target === this.desktop;
    });
    interact(this.desktop)
      .resizable(false)
      .draggable({
        cursorChecker: () => null,
        listeners: {
          start: (event) => {
            const nativeTarget = event.srcEvent?.target || event.target;
            if (nativeTarget?.closest?.(".window")) return;
            if (this.appLauncher.wm.isDraggingWindow || !mousedownOnDesktop) return;
            selectionState = { startX: event.pageX, startY: event.pageY, isActive: true };
            Object.assign(this.selectionBox.style, {
              left: `${event.pageX}px`,
              top: `${event.pageY}px`,
              width: "0px",
              height: "0px",
              display: "block"
            });
            this.selectionManager.clear();
          },
          move: (event) => {
            if (!selectionState.isActive) return;
            Object.assign(this.selectionBox.style, {
              width: `${Math.abs(event.pageX - selectionState.startX)}px`,
              height: `${Math.abs(event.pageY - selectionState.startY)}px`,
              left: `${Math.min(event.pageX, selectionState.startX)}px`,
              top: `${Math.min(event.pageY, selectionState.startY)}px`
            });
            const boxRect = this.selectionBox.getBoundingClientRect();
            document.querySelectorAll(".icon.selectable").forEach((icon) => {
              const r = icon.getBoundingClientRect();
              const overlaps = !(
                r.right < boxRect.left ||
                r.left > boxRect.right ||
                r.bottom < boxRect.top ||
                r.top > boxRect.bottom
              );
              if (overlaps) this.selectionManager.add(icon);
              else this.selectionManager.remove(icon);
            });
          },
          end: () => {
            if (!selectionState.isActive) return;
            this.selectionBox.style.display = "none";
            selectionState.isActive = false;
            mousedownOnDesktop = false;
          }
        }
      });
  }

  setupStartMenu() {
    const menuActions = {
      home: () => {
        this.explorerApp.open();
        this.explorerApp.navigate("");
      },
      documents: () => {
        this.explorerApp.open();
        this.explorerApp.navigate(this.fs.resolveDir("Documents"));
      },
      pictures: () => {
        this.explorerApp.open();
        this.explorerApp.navigate(this.fs.resolveDir("Pictures"));
      },
      notes: () => this.notepadApp.open()
    };
    this.startMenu.querySelectorAll(".start-item").forEach((item) => {
      item.onclick = (e) => {
        e.stopPropagation();
        const app = item.dataset.path;
        if (menuActions[app]) menuActions[app]();
        this.closeStartMenu();
      };
    });
  }
}

export function layoutIcons(icons, isExplorerIcon) {
  if (!icons) return;
  new PositionHelper(desktop, { width: 80, height: 100, gap: 5 }).layout(icons, isExplorerIcon);
}

function layoutIconsCall() {
  const saved = PositionStore.load();
  const allUnsaved = Array.from(desktop.querySelectorAll(":scope > .icon")).filter(
    (icon) => !saved[PositionStore.getKey(icon)]
  );
  const positionHelper = new PositionHelper(desktop, { width: 80, height: 100, gap: 5 });
  const systemIcons = allUnsaved.filter((i) => systemApps.has(i.dataset.app));
  const regularIcons = allUnsaved.filter((i) => !systemApps.has(i.dataset.app));
  if (regularIcons.length) positionHelper.layout(regularIcons);
  if (systemIcons.length) positionHelper.layoutRight(systemIcons);
}

window.addEventListener("load", layoutIconsCall);
window.addEventListener("resize", layoutIconsCall);
