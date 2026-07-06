import {
  updateFavoritesUI,
  getToggleHideGames,
  getToggleHideSystemApps,
  setupStartMenu as setupStartMenuFn
} from "./startMenu.js";
import { desktop } from "./desktop.js";
import { makeDraggable } from "../shared/dragUtils.js";
import { StorageKeys, os } from "../framework.js";
import { hideMenu } from "../shared/contextMenu.js";
import { isWindowFocused } from "../utils/utils.js";
import { DesktopContextMenuManager } from "./ContextMenuManager.js";
import { IconManager } from "./iconManager.js";
import { DragDropManager } from "./dragDropManager.js";
import { ClipboardManager } from "./fileClipboardManager.js";
import { showFileProperties } from "../fileDisplay.js";
import { resolveIconUrl } from "../shared/assetResolver.js";
import { KeybindManager } from "../keybindManager.js";
import { WidgetManager } from "./widgetManager.js";
import { ClockWidget } from "./widgets/clockWidget.js";
import { NotesWidget } from "./widgets/notesWidget.js";
import { WeatherWidget } from "./widgets/weatherWidget.js";
import { CalendarWidget } from "./widgets/calendarWidget.js";
import { SystemMonitorWidget } from "./widgets/systemMonitorWidget.js";
import { MusicControlWidget } from "./widgets/musicControlWidget.js";
import { TodoWidget } from "./widgets/todoWidget.js";
import { PowerWidget } from "./widgets/powerWidget.js";
import { ClipboardWidget } from "./widgets/clipboardWidget.js";
import { PhotoFrameWidget } from "./widgets/photoFrameWidget.js";
import { TimerWidget } from "./widgets/timerWidget.js";
import { YouTubeWidget } from "./widgets/youtubeWidget.js";

let sharedAppLauncher;
export let toggleHideGames = getToggleHideGames();
export let toggleHideSystemApps = getToggleHideSystemApps();
let GRID_CONFIG = { width: 76, height: 96, gap: 7 };

export function updateGridConfig(iconSize) {
  const size = Math.max(32, Math.min(128, Number(iconSize) || 48));
  GRID_CONFIG.width = size + 12;
  GRID_CONFIG.height = size + 32;
  GRID_CONFIG.gap = 7;
  relayoutDesktopIcons();
}

function relayoutDesktopIcons() {
  if (!sharedAppLauncher) return;
  const allIcons = Array.from(desktop.querySelectorAll(":scope > .icon")).filter(
    (icon) => icon.style.display !== "none"
  );
  if (!allIcons.length) return;
  const positionHelper = new PositionHelper(desktop, GRID_CONFIG);
  const systemIcons = [];
  const regularIcons = [];
  for (const icon of allIcons) {
    const app = icon.dataset.app;
    if (isRightAlignedSystemApp(sharedAppLauncher.appMap, app)) {
      systemIcons.push(icon);
    } else {
      regularIcons.push(icon);
    }
  }
  allIcons.forEach((i) => {
    i.style.left = "";
    i.style.top = "";
  });
  let occupied = null;
  if (regularIcons.length) occupied = positionHelper.layoutSync(regularIcons, false, occupied);
  if (systemIcons.length) positionHelper.layoutRightSync(systemIcons, occupied);
  PositionStore.save({});
}

function isRightAlignedSystemApp(appMap, app) {
  if (app === "flash" || app === "steamApp") return false;
  if (app === "robloxApp") return false;
  if (app === "paint" || app === "photopea") return true;

  const appMeta = appMap?.[app];
  return !!(appMeta && appMeta.type === "system");
}
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

  _buildOccupancySet(exclude = null) {
    const set = new Set();
    for (const icon of desktop.querySelectorAll(".icon.selectable")) {
      if (icon === exclude || icon.style.display === "none") continue;
      const { col, row } = this.pixelsToCell(parseFloat(icon.style.left) || 0, parseFloat(icon.style.top) || 0);
      set.add(`${col},${row}`);
    }
    return set;
  }

  isCellOccupied(col, row, exclude = null) {
    return this._buildOccupancySet(exclude).has(`${col},${row}`);
  }

  nextFreeCell(col, row, exclude = null) {
    const { width, height, gap } = this.gridSize;
    const maxRows = Math.max(1, Math.floor((this.desktop.clientHeight - gap) / (height + gap)));
    const maxCols = Math.max(1, Math.floor((this.desktop.clientWidth - gap) / (width + gap)));
    const occupied = this._buildOccupancySet(exclude);
    let c = col,
      r = row;
    while (occupied.has(`${c},${r}`)) {
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

  layoutSync(icons, isExplorerIcon = false, occupiedBefore = null) {
    const gap = isExplorerIcon ? this.gridSize.gap * 6 : this.gridSize.gap;
    const { width, height } = this.gridSize;
    const cellW = width + gap,
      cellH = height + gap;
    const maxRows = Math.max(1, Math.floor((this.desktop.clientHeight - gap) / cellH));
    const maxCols = Math.max(1, Math.floor((this.desktop.clientWidth - gap) / cellW));
    const occupied = occupiedBefore || this._buildOccupancySet();
    let col = 0,
      row = 0;
    icons.forEach((icon) => {
      while (occupied.has(`${col},${row}`)) {
        row++;
        if (row >= maxRows) {
          row = 0;
          col++;
        }
        if (col >= maxCols) {
          col = 0;
          row = 0;
          break;
        }
      }
      occupied.add(`${col},${row}`);
      icon.style.left = `${gap + col * cellW}px`;
      icon.style.top = `${gap + row * cellH}px`;
      row++;
      if (row >= maxRows) {
        row = 0;
        col++;
      }
    });
    return occupied;
  }

  layoutRightSync(icons, occupiedBefore = null) {
    const { width, height, gap } = this.gridSize;
    const cellW = width + gap,
      cellH = height + gap;
    const maxRows = Math.max(1, Math.floor((this.desktop.clientHeight - gap) / cellH));
    const maxCols = Math.max(1, Math.floor((this.desktop.clientWidth - gap) / cellW));
    const occupied = occupiedBefore || this._buildOccupancySet();
    let col = maxCols - 1,
      row = 0;
    icons.forEach((icon) => {
      while (occupied.has(`${col},${row}`)) {
        row++;
        if (row >= maxRows) {
          row = 0;
          col--;
        }
        if (col < 0) {
          col = maxCols - 1;
          row = 0;
          break;
        }
      }
      occupied.add(`${col},${row}`);
      icon.style.left = `${gap + col * cellW}px`;
      icon.style.top = `${gap + row * cellH}px`;
      row++;
      if (row >= maxRows) {
        row = 0;
        col--;
      }
    });
  }

  layout(icons, isExplorerIcon = false) {
    const gap = isExplorerIcon ? this.gridSize.gap * 6 : this.gridSize.gap;
    const { width, height } = this.gridSize;
    const cellW = width + gap,
      cellH = height + gap;
    const maxRows = Math.max(1, Math.floor((this.desktop.clientHeight - gap) / cellH));
    const maxCols = Math.max(1, Math.floor((this.desktop.clientWidth - gap) / cellW));
    const occupied = this._buildOccupancySet();
    let col = 0,
      row = 0;
    requestAnimationFrame(() => {
      icons.forEach((icon) => {
        while (occupied.has(`${col},${row}`)) {
          row++;
          if (row >= maxRows) {
            row = 0;
            col++;
          }
          if (col >= maxCols) {
            col = 0;
            row = 0;
            break;
          }
        }
        occupied.add(`${col},${row}`);
        icon.style.left = `${gap + col * cellW}px`;
        icon.style.top = `${gap + row * cellH}px`;
        row++;
        if (row >= maxRows) {
          row = 0;
          col++;
        }
      });
    });
  }

  layoutRight(icons) {
    const { width, height, gap } = this.gridSize;
    const cellW = width + gap,
      cellH = height + gap;
    const maxRows = Math.max(1, Math.floor((this.desktop.clientHeight - gap) / cellH));
    const maxCols = Math.max(1, Math.floor((this.desktop.clientWidth - gap) / cellW));
    const occupied = this._buildOccupancySet();
    let col = maxCols - 1,
      row = 0;
    requestAnimationFrame(() => {
      icons.forEach((icon) => {
        while (occupied.has(`${col},${row}`)) {
          row++;
          if (row >= maxRows) {
            row = 0;
            col--;
          }
          if (col < 0) {
            col = maxCols - 1;
            row = 0;
            break;
          }
        }
        occupied.add(`${col},${row}`);
        icon.style.left = `${gap + col * cellW}px`;
        icon.style.top = `${gap + row * cellH}px`;
        row++;
        if (row >= maxRows) {
          row = 0;
          col--;
        }
      });
    });
  }
}

export class DeletedIconsStore {
  static load() {
    const raw = os.storage.get(StorageKeys.deletedIconsKey);
    try {
      return raw || [];
    } catch {
      return [];
    }
  }
  static save(data) {
    os.storage.set(StorageKeys.deletedIconsKey, data);
  }
  static add(key) {
    const list = this.load();
    if (!list.includes(key)) {
      list.push(key);
      this.save(list);
    }
  }
}

export class PositionStore {
  static load() {
    try {
      return os.storage.get(StorageKeys.positionsKey) || {};
    } catch {
      return {};
    }
  }
  static save(map) {
    os.storage.set(StorageKeys.positionsKey, map);
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
      explorer: resolveIconUrl("static/icons/file.webp"),
      notepad: resolveIconUrl("static/icons/notepad.webp"),
      flash: resolveIconUrl("static/icons/flash.webp"),
      browser: resolveIconUrl("fas fa-snowflake"),
      terminal: resolveIconUrl("static/icons/terminal.webp"),
      music: resolveIconUrl("static/icons/spot.webp"),
      cameraApp: resolveIconUrl("static/icons/obs.webp"),
      paint: resolveIconUrl("static/icons/paint.webp"),
      photopea: resolveIconUrl("static/icons/photopea.webp"),
      vscode: resolveIconUrl("static/icons/vscode.webp"),
      liventcord: resolveIconUrl("static/icons/liventcord.webp"),
      steamApp: resolveIconUrl("static/icons/steam.webp"),
      return: resolveIconUrl("static/icons/file.webp")
    };
  }
  static createDesktopFileData(app, name, path = null) {
    const iconPathMap = this.getIconPathMap();
    const fallback =
      iconPathMap[app] || sharedAppLauncher?.appMap?.[app]?.icon || resolveIconUrl("static/icons/file.webp");
    return JSON.stringify({ app, name, path: path || fallback });
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
    icon.style.zIndex = "";
  }
  toggle(icon) {
    this.selectedIcons.has(icon) ? this.remove(icon) : this.add(icon);
  }
  clear() {
    this.selectedIcons.forEach((i) => {
      i.classList.remove("selected");
      i.style.zIndex = "";
    });
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
  constructor(appLauncher, notepadApp, explorerApp, fileSystemManager) {
    this.appLauncher = appLauncher;
    sharedAppLauncher = appLauncher;
    this.notepadApp = notepadApp;
    this.explorerApp = explorerApp;
    this.fs = fileSystemManager;
    this.desktop = document.getElementById("desktop");
    this.startButton = document.getElementById("start-button");
    this.startMenu = document.getElementById("start-menu");
    this.selectionBox = document.getElementById("selection-box");
    this.lastFocusedContext = "desktop";

    this.positionHelper = new PositionHelper(this.desktop, GRID_CONFIG);
    this.selectionManager = new SelectionManager();

    this.iconManager = new IconManager(
      this.desktop,
      this.fs,
      this.positionHelper,
      PositionStore,
      this.selectionManager,
      this.notepadApp,
      this.explorerApp,
      this.appLauncher,
      this.appLauncher.jsDosApp,
      null
    );

    this.dragDropManager = new DragDropManager(
      this.desktop,
      this.fs,
      this.positionHelper,
      PositionStore,
      this.selectionManager,
      this.iconManager,
      IconDataHelper,
      this.explorerApp
    );

    this.iconManager.dragDropManager = this.dragDropManager;

    this.clipboardManager = new ClipboardManager(
      this.fs,
      PositionStore,
      DeletedIconsStore,
      this.iconManager,
      IconDataHelper,
      this.explorerApp
    );

    this.contextMenuManager = new DesktopContextMenuManager(this, PositionStore, IconDataHelper, this.appLauncher.wm);

    this.widgetManager = new WidgetManager();
    this.widgetManager.registerWidgetType("clock", ClockWidget);
    this.widgetManager.registerWidgetType("notes", NotesWidget);
    this.widgetManager.registerWidgetType("weather", WeatherWidget);
    this.widgetManager.registerWidgetType("calendar", CalendarWidget);
    this.widgetManager.registerWidgetType("systemMonitor", SystemMonitorWidget);
    this.widgetManager.registerWidgetType("musicControl", MusicControlWidget);
    this.widgetManager.registerWidgetType("todo", TodoWidget);
    this.widgetManager.registerWidgetType("power", PowerWidget);
    this.widgetManager.registerWidgetType("clipboard", ClipboardWidget);
    this.widgetManager.registerWidgetType("photoFrame", PhotoFrameWidget);
    this.widgetManager.registerWidgetType("timer", TimerWidget);
    this.widgetManager.registerWidgetType("youtube", YouTubeWidget);
    this.setupEventListeners();
    this.initializeDesktopFiles();
  }

  setClipboard(data) {
    this.clipboardManager.setClipboard(data);
  }

  getClipboard() {
    return this.clipboardManager.getClipboard();
  }

  async dropFromExplorer(name, isFile, sourcePath, clientX, clientY) {
    return this.dragDropManager.dropFromExplorer(name, isFile, sourcePath, clientX, clientY);
  }

  setupEventListeners() {
    this.startButton.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleStartMenu();
      document.querySelector('.start-cat[data-cat="menu"]')?.click();
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
      if (KeybindManager.matches(e, "desktop.paste")) {
        e.preventDefault();
        const clipboard = this.clipboardManager.getClipboard();
        if (!clipboard) return;
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
            const iconsData = clipboard.icons;
            const action = clipboard.action;
            const source = clipboard.source;
            const sourceInst = clipboard.sourceInst;
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
                      await os.fs.delete(srcPath, name);
                    }
                  } catch {}
                }
                if (action === "cut") {
                  this.clipboardManager.setClipboard(null);
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
                  await os.fs.write([...inst.currentPath, fileName], fileContent);
                  if (action === "cut" && iconData.element) iconData.element.remove();
                }
                if (action === "cut") this.clipboardManager.setClipboard(null);
              }
              await this.explorerApp.renderInstance(inst);
              os.notify.send(`${iconsData.length} item${iconsData.length !== 1 ? "s" : ""} pasted`);
            })();
            return;
          }
        }
        if (clipboard.source === "explorer") {
          const iconsData = clipboard.icons;
          const action = clipboard.action;
          const sourceInst = clipboard.sourceInst;
          (async () => {
            for (const iconData of iconsData) {
              await this.dropFromExplorer(iconData.data.name, true, iconData.data.path, lastMousePos.x, lastMousePos.y);
            }
            if (action === "cut") {
              this.clipboardManager.setClipboard(null);
              if (sourceInst) await this.explorerApp.renderInstance(sourceInst);
            }
          })();
          return;
        }
      }

      if (KeybindManager.matches(e, "desktop.rename")) {
        e.preventDefault();
        const explorerWins = document.querySelectorAll("[id^='explorer-']");
        let anyExplorerFocused = false;
        for (const win of explorerWins) {
          if (isWindowFocused(win.id, lastMousePos)) {
            anyExplorerFocused = true;
            break;
          }
        }
        if (anyExplorerFocused) return;
        const selectedArray = this.selectionManager.toArray();
        if (selectedArray.length === 1) {
          const icon = selectedArray[0];
          if (
            icon.classList.contains("desktop-file-icon") ||
            icon.classList.contains("folder-icon") ||
            icon.dataset.app
          ) {
            this.contextMenuManager._startInlineDesktopRename(icon);
          }
        }
      }

      if (KeybindManager.matches(e, "desktop.deleteSelected")) {
        const selectedArray = this.selectionManager.toArray();
        let hasExplorerSelection = false;
        let explorerInst = null;

        if (this.explorerApp) {
          for (const [winId, inst] of this.explorerApp._instances) {
            if (inst.selectedItems.size > 0) {
              hasExplorerSelection = true;
              explorerInst = inst;
              break;
            }
          }
        }

        if (hasExplorerSelection && this.lastFocusedContext === "explorer" && explorerInst) {
          e.preventDefault();
          (async () => {
            const effectiveItems = [...explorerInst.selectedItems];
            for (const name of effectiveItems) {
              await os.fs.trashFile(explorerInst.currentPath, name);
            }
            await this.explorerApp.renderInstance(explorerInst);
            os.notify.send(`${effectiveItems.length} item${effectiveItems.length !== 1 ? "s" : ""} moved to trash`);
          })();
        } else if (selectedArray.length > 0) {
          e.preventDefault();
          this.clipboardManager.moveSelectedIconsToTrash(selectedArray, this.selectionManager);
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
        el.className = "overlay";
        document.body.appendChild(el);
      }
      el.classList.add("overlay--active");
      el.innerHTML = `<span class="overlay__label">${label}</span>`;
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
          const dir = this.fs.resolveUserPath(["Desktop"]);
          const destExists = await os.fs.exists(this.fs.join(dir, file.name));

          let finalName = file.name;
          if (destExists) {
            const { showConflictDialog } = await import("../shared/conflictDialog.js");
            const result = await showConflictDialog(file.name);
            if (result.action === "skip") continue;
            if (result.action === "keep") {
              finalName = await this.fs.getUniqueFileName(["Desktop"], file.name);
            }
          }

          if (destExists) {
            await os.fs.delete(["Desktop"], finalName).catch(() => {});
          }
          await os.fs.createFile(["Desktop"], finalName, content, kind, icon);

          const itemData = { type: "file", kind, icon, content };
          await this.createDesktopFileIcon(finalName, itemData);
          uploadedCount++;
        } catch {
          os.notify.send(`Could not save "${file.name}"`);
        }
      }
      if (uploadedCount > 0) {
        os.notify.send(`${uploadedCount} file${uploadedCount !== 1 ? "s" : ""} saved to Desktop`);
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
    this.contextMenuManager.handleContextMenu(e);
  }

  setupIconHandlers() {
    const deleted = DeletedIconsStore.load();
    document.querySelectorAll(".icon.selectable").forEach((icon) => {
      const key = PositionStore.getKey(icon);
      if (deleted.includes(key)) {
        icon.remove();
        return;
      }
      this.iconManager.makeIconInteractable(icon);
    });
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
    document.querySelectorAll(".icon.selectable").forEach((i) => {
      if (!this.selectionManager.has(i)) {
        i.style.zIndex = "";
        i.style.opacity = "";
        i.style.cursor = "";
      }
    });
  }

  setupInteractDrag(icon) {
    return makeDraggable(icon, {
      start: () => this.dragDropManager.onDragStart(),
      move: (_e, dx, dy, clientX, clientY) => {
        this.dragDropManager.onDragMove({ dx, dy, clientX, clientY });
      },
      end: () => this.dragDropManager.onDragEnd()
    });
  }

  setupInteractableSelection() {
    let selectionState = { startX: 0, startY: 0, isActive: false };

    const onMouseDown = (e) => {
      if (e.target !== this.desktop) return;
      if (e.target?.closest?.(".window")) return;
      document.querySelectorAll(".icon.selectable").forEach((i) => {
        i.style.zIndex = "";
        i.style.opacity = "";
        i.style.cursor = "";
      });
      selectionState = { startX: e.pageX, startY: e.pageY, isActive: true };
      Object.assign(this.selectionBox.style, {
        left: `${e.pageX}px`,
        top: `${e.pageY}px`,
        width: "0px",
        height: "0px",
        display: "block"
      });
      this.selectionManager.clear();
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    };

    const onMouseMove = (e) => {
      if (!selectionState.isActive) return;
      Object.assign(this.selectionBox.style, {
        width: `${Math.abs(e.pageX - selectionState.startX)}px`,
        height: `${Math.abs(e.pageY - selectionState.startY)}px`,
        left: `${Math.min(e.pageX, selectionState.startX)}px`,
        top: `${Math.min(e.pageY, selectionState.startY)}px`
      });
      const boxRect = this.selectionBox.getBoundingClientRect();
      document.querySelectorAll(".icon.selectable").forEach((icon) => {
        if (icon.style.display === "none") return;
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
    };

    const onMouseUp = () => {
      if (!selectionState.isActive) return;
      this.selectionBox.style.display = "none";
      selectionState.isActive = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    this.desktop.addEventListener("mousedown", onMouseDown);
  }

  setupStartMenu() {
    setupStartMenuFn(this.appLauncher, null, this.explorerApp, this.notepadApp, this.selectionManager);
  }

  async initializeDesktopFiles() {
    await this.iconManager.initializeDesktopFiles(sharedAppLauncher, isRightAlignedSystemApp);
    this.widgetManager.init();
  }

  async loadDesktopItems() {
    await this.iconManager.loadDesktopItems();
    const autoSort = os.storage.get(StorageKeys.desktopAutoSort);
    if (autoSort) {
      const mode = os.storage.get(StorageKeys.desktopSortMode) || "name";
      if (mode && mode !== "none") {
        sortDesktopIcons(mode);
      }
    }
  }

  async createFolderIcon(folderName) {
    return this.iconManager.createFolderIcon(folderName);
  }

  async createDesktopFileIcon(fileName, itemData = null) {
    return this.iconManager.createDesktopFileIcon(fileName, itemData);
  }

  async _openDesktopFile(fileName) {
    return this.iconManager._openDesktopFile(fileName);
  }

  _openYouTubeEmbedDesktop(content) {
    this.iconManager._openYouTubeEmbedDesktop(content);
  }

  async _editDesktopFileWithNotepad(fileName) {
    return this.iconManager._editDesktopFileWithNotepad(fileName);
  }

  async saveToWallpapers(name, content, kind, icon) {
    return this.iconManager.saveToWallpapers(name, content, kind, icon);
  }

  addFiles() {
    this.iconManager.addFiles();
  }

  async showPropertiesDialog(icon) {
    if (icon.dataset.fileName) {
      showFileProperties(["Desktop", icon.dataset.fileName], icon.dataset.fileName, false);
    } else if (icon.dataset.folderName) {
      showFileProperties(["Desktop", icon.dataset.folderName], icon.dataset.folderName, true);
    } else if (icon.dataset.app) {
      const name = IconDataHelper.getIconName(icon);
      const fileName = `${name}.desktop`;
      const filePath = ["Desktop", fileName];
      const img = icon.querySelector("img");
      const fa = icon.querySelector("i");
      let iconPath = null;
      if (img) iconPath = img.getAttribute("src");
      else if (fa) iconPath = Array.from(fa.classList).join(" ");
      const content = JSON.stringify({ app: icon.dataset.app, name, path: iconPath });
      await os.fs.write(filePath, content);
      const dir = this.fs.resolveUserPath(["Desktop"]);
      await this.fs.writeMeta(dir, fileName, { size: content.length });
      showFileProperties(filePath, fileName, false);
    }
  }

  deleteSelectedIcons(selectedArray) {
    return this.clipboardManager.deleteSelectedIcons(selectedArray, this.selectionManager);
  }

  moveSelectedIconsToTrash(selectedArray) {
    return this.clipboardManager.moveSelectedIconsToTrash(selectedArray, this.selectionManager);
  }

  cutSelectedIcons(selectedArray) {
    this.clipboardManager.setClipboard(this.clipboardManager._buildDesktopClipboard("cut", selectedArray));
    selectedArray.forEach((icon) => {
      this.selectionManager.remove(icon);
      icon.remove();
    });
  }

  copySelectedIcons(selectedArray) {
    this.clipboardManager.setClipboard(this.clipboardManager._buildDesktopClipboard("copy", selectedArray));
  }

  _buildDesktopClipboard(action, icons) {
    return this.clipboardManager._buildDesktopClipboard(action, icons);
  }

  _pasteToDesktop() {
    return this.clipboardManager._pasteToDesktop();
  }
}

export function layoutIcons(icons, isExplorerIcon) {
  if (!icons) return;
  new PositionHelper(desktop, GRID_CONFIG).layout(icons, isExplorerIcon);
}

function layoutIconsCall() {
  relayoutDesktopIcons();
}

let _resizeTimer;
window.addEventListener("load", () => layoutIconsCall());
window.addEventListener("resize", () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => layoutIconsCall(), 150);
});

document.addEventListener("mouseup", () => {
  document.querySelectorAll(".icon.selectable").forEach((icon) => {
    const zIndex = parseInt(icon.style.zIndex);
    if (zIndex > 10 || icon.style.opacity === "0.7" || icon.style.cursor === "move") {
      icon.style.zIndex = "";
      icon.style.opacity = "";
      icon.style.cursor = "";
    }
  });
});

document.addEventListener("click", (e) => {
  if (e.target.closest(".icon")) return;
  document.querySelectorAll(".icon.selectable").forEach((icon) => {
    const zIndex = parseInt(icon.style.zIndex);
    if (zIndex > 10 || icon.style.opacity === "0.7" || icon.style.cursor === "move") {
      icon.style.zIndex = "";
      icon.style.opacity = "";
      icon.style.cursor = "";
    }
  });
});

window.addEventListener("focus", () => {
  document.querySelectorAll(".icon.selectable").forEach((icon) => {
    const zIndex = parseInt(icon.style.zIndex);
    if (zIndex > 10 || icon.style.opacity === "0.7" || icon.style.cursor === "move") {
      icon.style.zIndex = "";
      icon.style.opacity = "";
      icon.style.cursor = "";
    }
  });
});

setInterval(() => {
  document.querySelectorAll(".icon.selectable").forEach((icon) => {
    const zIndex = parseInt(icon.style.zIndex);
    if (zIndex > 10 || icon.style.opacity === "0.7" || icon.style.cursor === "move") {
      icon.style.zIndex = "";
      icon.style.opacity = "";
      icon.style.cursor = "";
    }
  });
}, 5000);

export function sortDesktopIcons(mode) {
  if (!sharedAppLauncher) return;
  os.storage.set(StorageKeys.desktopSortMode, mode);
  const allIcons = Array.from(desktop.querySelectorAll(":scope > .icon")).filter(
    (icon) => icon.style.display !== "none"
  );
  if (!allIcons.length) return;

  const withKey = allIcons.map((icon) => {
    const label = icon.querySelector("div")?.textContent?.trim() || "";
    let key;
    switch (mode) {
      case "name":
        key = label.toLowerCase();
        break;
      case "type":
        if (icon.classList.contains("folder-icon")) key = `0:${label}`;
        else if (icon.dataset.app) key = `1:${label}`;
        else key = `2:${label}`;
        break;
      case "recent": {
        const appId = icon.dataset.app;
        key = appId ? -(os.storage.get(`launch_time:${appId}`) || 0) : 0;
        break;
      }
      default:
        key = 0;
    }
    return { icon, key };
  });

  withKey.sort((a, b) => {
    if (typeof a.key === "string" && typeof b.key === "string") return a.key.localeCompare(b.key);
    return (a.key || 0) - (b.key || 0);
  });

  const positionHelper = new PositionHelper(desktop, GRID_CONFIG);
  const systemIcons = [];
  const regularIcons = [];
  withKey.forEach(({ icon }) => {
    if (isRightAlignedSystemApp(sharedAppLauncher.appMap, icon.dataset.app)) {
      systemIcons.push(icon);
    } else {
      regularIcons.push(icon);
    }
  });

  allIcons.forEach((i) => {
    i.style.left = "";
    i.style.top = "";
    i.style.zIndex = "";
  });
  let occupied = null;
  if (regularIcons.length) occupied = positionHelper.layoutSync(regularIcons, false, occupied);
  if (systemIcons.length) positionHelper.layoutRightSync(systemIcons, occupied);

  const saved = {};
  allIcons.forEach((icon) => {
    const left = parseFloat(icon.style.left) || 0;
    const top = parseFloat(icon.style.top) || 0;
    const { col, row } = positionHelper.pixelsToCell(left, top);
    saved[PositionStore.getKey(icon)] = { col, row };
  });
  PositionStore.save(saved);
}
