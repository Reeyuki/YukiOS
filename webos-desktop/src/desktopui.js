import { updateFavoritesUI } from "./startMenu.js";
import { desktop } from "./desktop.js";
import interact from "interactjs";

class PositionHelper {
  constructor(desktop, gridSize) {
    this.desktop = desktop;
    this.gridSize = gridSize;
  }

  convert(value, dimension, toPercent) {
    const size = dimension === "x" ? this.desktop.clientWidth : this.desktop.clientHeight;
    return toPercent ? (value / size) * 100 : (value / 100) * size;
  }

  setPosition(icon, leftPx, topPx) {
    icon.style.left = `${leftPx}px`;
    icon.style.top = `${topPx}px`;
    icon.dataset.leftPercent = this.convert(leftPx, "x", true);
    icon.dataset.topPercent = this.convert(topPx, "y", true);
  }

  getPosition(icon) {
    const lp = parseFloat(icon.dataset.leftPercent);
    const tp = parseFloat(icon.dataset.topPercent);
    return !isNaN(lp) && !isNaN(tp)
      ? { leftPx: this.convert(lp, "x"), topPx: this.convert(tp, "y"), leftPercent: lp, topPercent: tp }
      : {
          leftPx: parseFloat(icon.style.left) || 0,
          topPx: parseFloat(icon.style.top) || 0,
          leftPercent: this.convert(parseFloat(icon.style.left) || 0, "x", true),
          topPercent: this.convert(parseFloat(icon.style.top) || 0, "y", true)
        };
  }

  snap(icon, exclude = null) {
    const { width, height, gap } = this.gridSize;
    const cellW = width + gap,
      cellH = height + gap;
    let { leftPx: x, topPx: y } = this.getPosition(icon);
    let col = Math.max(0, Math.round((x - gap) / cellW));
    let row = Math.max(0, Math.round((y - gap) / cellH));

    const isOccupied = (l, t) =>
      Array.from(document.querySelectorAll(".icon.selectable")).some(
        (i) =>
          i !== (exclude || icon) &&
          Math.abs((parseFloat(i.style.left) || 0) - l) < width * 0.5 &&
          Math.abs((parseFloat(i.style.top) || 0) - t) < height * 0.5
      );

    let snappedLeft = gap + col * cellW,
      snappedTop = gap + row * cellH;
    const dw = this.desktop.clientWidth,
      dh = this.desktop.clientHeight;

    while (isOccupied(snappedLeft, snappedTop)) {
      row++;
      snappedTop = gap + row * cellH;
      if (snappedTop + height > dh) {
        row = 0;
        col++;
        snappedLeft = gap + col * cellW;
        if (snappedLeft + width > dw) break;
      }
    }

    this.setPosition(icon, snappedLeft, snappedTop);
  }

  layout(icons, isExplorerIcon = false) {
    const baseGap = this.gridSize.gap;
    const gap = isExplorerIcon ? baseGap * 6 : baseGap;
    const { width, height } = this.gridSize;
    const cellW = width + gap,
      cellH = height + gap;
    const maxRows = Math.max(1, Math.floor((this.desktop.clientHeight - gap) / cellH));
    let col = 0,
      row = 0;

    requestAnimationFrame(() =>
      icons.forEach((icon) => {
        this.setPosition(icon, gap + col * cellW, gap + row * cellH);
        row++;
        if (row >= maxRows) {
          row = 0;
          col++;
        }
      })
    );
  }
}

class IconDataHelper {
  static extractData(icon) {
    return {
      app: icon.dataset.app,
      name: icon.dataset.name,
      path: icon.dataset.path,
      className: icon.className,
      innerHTML: icon.innerHTML
    };
  }

  static createClipboardData(icons, action) {
    return {
      action,
      icons: icons.map((icon) => ({
        element: action === "cut" ? icon : undefined,
        data: this.extractData(icon)
      }))
    };
  }

  static getIconName(icon) {
    const nameElement = icon.querySelector("div");
    return nameElement ? nameElement.textContent.trim() : "Unknown";
  }

  static getIconPathMap() {
    return {
      explorer: "/static/icons/pc.webp",
      notepad: "/static/icons/notepad.webp",
      flash: "/static/icons/flash.webp"
    };
  }

  static createDesktopFileData(app, name, position = null) {
    const pathMap = this.getIconPathMap();
    const data = {
      app,
      name,
      path: pathMap[app] || "/static/icons/file.webp"
    };

    if (position) {
      data.position = position;
    }

    return JSON.stringify(data);
  }

  static createFolderMetaData(folderName, position) {
    return JSON.stringify({
      type: "folder",
      name: folderName,
      position
    });
  }
}

class ContextMenuHelper {
  constructor(contextMenu) {
    this.contextMenu = contextMenu;
  }

  createHTML(items) {
    return items
      .filter((item) => typeof item === "string" || !item.condition || item.condition())
      .map((item) => {
        if (item === "hr") return "<hr>";
        return `<div id="${item.id}">${item.label}</div>`;
      })
      .join("");
  }

  attachHandlers(items, handlers) {
    items.forEach((item) => {
      if (typeof item === "string") return;
      if (item.condition && !item.condition()) return;

      const element = document.getElementById(item.id);
      if (element && handlers[item.action]) {
        element.onclick = () => {
          this.contextMenu.style.display = "none";
          handlers[item.action]();
        };
      }
    });
  }

  show(e, items, handlers) {
    this.contextMenu.innerHTML = this.createHTML(items);
    this.attachHandlers(items, handlers);
    Object.assign(this.contextMenu.style, {
      left: `${e.pageX}px`,
      top: `${e.pageY}px`,
      display: "block"
    });
  }

  hide() {
    this.contextMenu.style.display = "none";
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
    if (this.selectedIcons.has(icon)) {
      this.remove(icon);
    } else {
      this.add(icon);
    }
  }

  clear() {
    this.selectedIcons.forEach((icon) => icon.classList.remove("selected"));
    this.selectedIcons.clear();
  }

  has(icon) {
    return this.selectedIcons.has(icon);
  }

  toArray() {
    return Array.from(this.selectedIcons);
  }

  forEach(callback) {
    this.selectedIcons.forEach(callback);
  }
}

class FileSystemHelper {
  constructor(positionHelper) {
    this.positionHelper = positionHelper;
  }

  _getStorageKey(pathArray, fileName) {
    return [...pathArray, fileName].join("/");
  }

  async loadPositionFromFile(path, fileName) {
    const key = this._getStorageKey(path, fileName);
    const content = localStorage.getItem(key);
    if (!content) return null;

    try {
      const data = JSON.parse(content);
      if (data.position && data.position.leftPercent !== undefined) {
        return {
          leftPx: this.positionHelper.convert(data.position.leftPercent, "x"),
          topPx: this.positionHelper.convert(data.position.topPercent, "y"),
          leftPercent: data.position.leftPercent,
          topPercent: data.position.topPercent
        };
      }
    } catch (e) {
      console.error("Error parsing position data:", e);
    }

    return null;
  }

  async saveIconPosition(path, fileName, icon) {
    const position = this.positionHelper.getPosition(icon);
    const app = icon.dataset.app;
    const name = IconDataHelper.getIconName(icon);

    const content = IconDataHelper.createDesktopFileData(app, name, {
      leftPercent: position.leftPercent,
      topPercent: position.topPercent
    });

    const key = this._getStorageKey(path, fileName);
    localStorage.setItem(key, content);
  }

  async saveFolderPosition(path, folderName, folderIcon) {
    const position = this.positionHelper.getPosition(folderIcon);
    const metaFileName = `.${folderName}.folder`;
    const content = IconDataHelper.createFolderMetaData(folderName, {
      leftPercent: position.leftPercent,
      topPercent: position.topPercent
    });

    const key = this._getStorageKey(path, metaFileName);
    localStorage.setItem(key, content);
  }
}

export class DesktopUI {
  constructor(appLauncher, notepadApp, explorerApp, fileSystemManager) {
    this.appLauncher = appLauncher;
    this.notepadApp = notepadApp;
    this.explorerApp = explorerApp;
    this.fs = fileSystemManager;
    this.desktop = document.getElementById("desktop");
    this.startButton = document.getElementById("start-button");
    this.startMenu = document.getElementById("start-menu");
    this.contextMenu = document.getElementById("context-menu");
    this.selectionBox = document.getElementById("selection-box");

    this.positionHelper = new PositionHelper(this.desktop, { width: 80, height: 100, gap: 5 });
    this.contextMenuHelper = new ContextMenuHelper(this.contextMenu);
    this.selectionManager = new SelectionManager();
    this.fileSystemHelper = new FileSystemHelper(this.fs, this.positionHelper);

    this.state = {
      clipboard: null,
      dragTarget: null,
      isUserDragging: false
    };

    this.templates = {
      iconContextMenu: [
        { id: "ctx-open", label: "Open", action: "open" },
        { id: "ctx-cut", label: "Cut", action: "cut" },
        { id: "ctx-copy", label: "Copy", action: "copy" },
        { id: "ctx-delete", label: "Delete", action: "delete" },
        { id: "ctx-properties", label: "Properties", action: "properties" }
      ],
      folderContextMenu: [
        { id: "ctx-open-folder", label: "Open", action: "openFolder" },
        { id: "ctx-delete-folder", label: "Delete", action: "deleteFolder" },
        { id: "ctx-rename-folder", label: "Rename", action: "renameFolder" }
      ],
      desktopContextMenu: [
        { id: "ctx-new-notepad", label: "New Notepad", action: "newNotepad" },
        { id: "ctx-new-folder", label: "New Folder", action: "newFolder" },
        { id: "ctx-open-explorer", label: "Open File Explorer", action: "openExplorer" },
        { id: "ctx-paste", label: "Paste", action: "paste", condition: () => this.state.clipboard },
        "hr",
        { id: "ctx-refresh", label: "Refresh", action: "refresh" }
      ]
    };

    this.setupEventListeners();
    this.initializeDesktopFiles();
  }

  setupEventListeners() {
    this.startButton.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleStartMenu();
    });

    this.startMenu.addEventListener("click", (e) => e.stopPropagation());

    document.addEventListener("click", () => this.closeAllMenus());

    this.desktop.addEventListener("contextmenu", (e) => this.handleContextMenu(e));

    this.setupIconHandlers();
    this.setupInteractableSelection();
    this.setupStartMenu();
    this.setupKeyboardShortcuts();
    this.setupResizeHandler();
  }

  setupResizeHandler() {
    let resizeTimeout;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => this.repositionAllIcons(), 100);
    });
  }

  repositionAllIcons() {
    const icons = document.querySelectorAll("#desktop > .icon.selectable");
    icons.forEach((icon) => {
      const position = this.positionHelper.getPosition(icon);
      this.positionHelper.setPosition(icon, position.leftPx, position.topPx);
      this.positionHelper.snap(icon);
    });
  }

  setupKeyboardShortcuts() {
    let lastMousePos = { x: 50, y: 50 };

    document.addEventListener("mousemove", (e) => {
      lastMousePos = { x: e.pageX, y: e.pageY };
    });

    document.addEventListener("keydown", (e) => {
      const selectedArray = this.selectionManager.toArray();

      if (e.ctrlKey && e.code === "KeyC") {
        e.preventDefault();
        if (selectedArray.length) this.copySelectedIcons(selectedArray);
      }

      if (e.ctrlKey && e.code === "KeyX") {
        e.preventDefault();
        if (selectedArray.length) this.cutSelectedIcons(selectedArray);
      }

      if (e.ctrlKey && e.code === "KeyV") {
        e.preventDefault();
        if (this.state.clipboard) this.pasteIcons(lastMousePos.x, lastMousePos.y);
      }
    });
  }

  toggleStartMenu() {
    this.startMenu.style.display = this.startMenu.style.display === "flex" ? "none" : "flex";
    updateFavoritesUI(this.appLauncher);
  }

  closeAllMenus() {
    this.startMenu.style.display = "none";
    this.contextMenuHelper.hide();
  }

  handleContextMenu(e) {
    if (e.target.classList.contains("folder-icon")) {
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
    document.querySelectorAll(".icon.selectable").forEach((icon) => {
      this.makeIconInteractable(icon);
    });
  }

  makeIconInteractable(icon, ignoreDrag = false) {
    this.setIconNonDraggable(icon);
    if (!ignoreDrag) {
      this.setupInteractDrag(icon);
    }
    this.attachIconEvents(icon);
  }

  setIconNonDraggable(icon) {
    icon.draggable = false;
    Object.assign(icon.style, {
      userSelect: "none",
      webkitUserDrag: "none",
      cursor: "default"
    });
  }

  attachIconEvents(icon) {
    icon.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      if (icon.classList.contains("folder-icon")) {
        this.openFolder(icon.dataset.folderName);
      } else {
        this.appLauncher.launch(icon.dataset.app);
      }
    });

    icon.addEventListener("mousedown", () => {
      this.handleIconSelection(icon, event.ctrlKey);
    });
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
    const interactable = interact(icon);
    interactable.resizable(false);

    interactable.draggable({
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
    this.selectionManager.forEach((selectedIcon) => {
      Object.assign(selectedIcon.style, {
        opacity: "0.7",
        zIndex: "1000",
        cursor: "move"
      });
    });
  }

  onDragMove(event) {
    const { dx, dy } = event;

    this.selectionManager.forEach((selectedIcon) => {
      const currentX = parseFloat(selectedIcon.style.left) || 0;
      const currentY = parseFloat(selectedIcon.style.top) || 0;
      const newX = Math.max(0, currentX + dx);
      const newY = Math.max(0, currentY + dy);

      this.positionHelper.setPosition(selectedIcon, newX, newY);
    });

    this.updateDragTarget(event);
  }

  updateDragTarget(event) {
    const folderIcons = document.querySelectorAll(".folder-icon");
    let foundTarget = null;

    folderIcons.forEach((folder) => {
      const rect = folder.getBoundingClientRect();
      if (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      ) {
        foundTarget = folder;
      }
    });

    if (this.state.dragTarget) {
      this.state.dragTarget.style.outline = "";
    }

    if (foundTarget && !this.selectionManager.has(foundTarget)) {
      foundTarget.style.outline = "2px solid #0078d7";
      this.state.dragTarget = foundTarget;
    } else {
      this.state.dragTarget = null;
    }
  }

  async moveIconsToFolder(icons, folderName) {
    for (const icon of icons) {
      if (icon.classList.contains("folder-icon")) continue;

      const name = IconDataHelper.getIconName(icon);
      const fileName = `${name}.desktop`;
      const fileContent = await this.fs.getFileContent(["Desktop"], fileName);

      await this.fs.createFile(["Desktop", folderName], fileName, fileContent, "text");
      await this.fs.deleteItem(["Desktop"], fileName);

      icon.remove();
      this.selectionManager.remove(icon);
    }

    this.selectionManager.clear();
  }

  async updateDesktopFilePositions() {
    for (const icon of this.selectionManager.toArray()) {
      if (icon.classList.contains("folder-icon")) continue;

      const name = IconDataHelper.getIconName(icon);
      const fileName = `${name}.desktop`;
      await this.fileSystemHelper.saveIconPosition(["Desktop"], fileName, icon);
    }
  }

  async onDragEnd() {
    if (!this.state.isUserDragging) return;

    this.state.isUserDragging = false;

    if (this.state.dragTarget) {
      const folderName = this.state.dragTarget.dataset.folderName;
      await this.moveIconsToFolder(this.selectionManager.toArray(), folderName);
      this.state.dragTarget.style.outline = "";
      this.state.dragTarget = null;
    } else {
      this.selectionManager.forEach((selectedIcon) => {
        this.positionHelper.snap(selectedIcon);
        Object.assign(selectedIcon.style, {
          opacity: "1",
          zIndex: "1",
          cursor: "default"
        });
      });

      await this.updateDesktopFilePositions();

      for (const icon of this.selectionManager.toArray()) {
        if (icon.classList.contains("folder-icon")) {
          await this.fileSystemHelper.saveFolderPosition(["Desktop"], icon.dataset.folderName, icon);
        }
      }
    }
  }

  showFolderContextMenu(e, folderIcon) {
    this.selectionManager.clear();
    this.selectionManager.add(folderIcon);

    const handlers = {
      openFolder: () => this.openFolder(folderIcon.dataset.folderName),
      deleteFolder: async () => {
        await this.fs.deleteItem(["Desktop"], folderIcon.dataset.folderName);
        folderIcon.remove();
        this.selectionManager.clear();
      },
      renameFolder: async () => {
        const newName = prompt("Enter new folder name:", folderIcon.dataset.folderName);
        if (newName && newName !== folderIcon.dataset.folderName) {
          await this.fs.renameItem(["Desktop"], folderIcon.dataset.folderName, newName);
          folderIcon.dataset.folderName = newName;
          folderIcon.querySelector("span").textContent = newName;
        }
      }
    };

    this.contextMenuHelper.show(e, this.templates.folderContextMenu, handlers);
  }

  showIconContextMenu(e, icon) {
    if (!this.selectionManager.has(icon)) {
      this.selectionManager.clear();
      this.selectionManager.add(icon);
    }

    const selectedArray = this.selectionManager.toArray();
    const lastSelected = selectedArray[selectedArray.length - 1];

    const handlers = {
      open: () => this.appLauncher.launch(lastSelected.dataset.app),
      cut: () => this.cutSelectedIcons(selectedArray),
      copy: () => this.copySelectedIcons(selectedArray),
      delete: () => this.deleteSelectedIcons(selectedArray),
      properties: () => this.showPropertiesDialog(lastSelected)
    };

    this.contextMenuHelper.show(e, this.templates.iconContextMenu, handlers);
  }

  cutSelectedIcons(selectedArray) {
    this.state.clipboard = IconDataHelper.createClipboardData(selectedArray, "cut");
  }

  copySelectedIcons(selectedArray) {
    this.state.clipboard = IconDataHelper.createClipboardData(selectedArray, "copy");
  }

  deleteSelectedIcons(selectedArray) {
    selectedArray.forEach((icon) => {
      this.selectionManager.remove(icon);
      icon.remove();
    });
  }

  createPropertiesContent(icon) {
    const rect = icon.getBoundingClientRect();
    const appId = icon.dataset.app;
    const appInfo = this.appLauncher?.appMap?.[appId] ?? {};
    const name = IconDataHelper.getIconName(icon);
    const pathMap = IconDataHelper.getIconPathMap();

    const properties = {
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

    return Object.entries(properties)
      .filter(([, value]) => value !== undefined && value !== "")
      .map(([key, value]) => `<div style="margin:2px 0;">${key}: ${value}</div>`)
      .join("");
  }

  createWindowHTML(title, content) {
    return `
      <div class="window-header">
        <span>${title}</span>
        <div class="window-controls">
          <button class="minimize-btn" title="Minimize">−</button>
          <button class="maximize-btn" title="Maximize">□</button>
          <button class="close-btn" title="Close">X</button>
        </div>
      </div>
      <div class="window-content" style="width:100%; height:100%; overflow:auto; user-select:text; padding:10px;">
        ${content}
      </div>
    `;
  }

  showPropertiesDialog(icon) {
    const winId = icon.id || `icon-${Date.now()}`;
    const name = IconDataHelper.getIconName(icon);
    const title = `Properties: ${name}`;
    const contentHtml = this.createPropertiesContent(icon);

    const propsWin = this.appLauncher.wm.createWindow(`${winId}-props`, title, "300px", "auto");
    propsWin.innerHTML = this.createWindowHTML(title, contentHtml);

    desktop.appendChild(propsWin);
    this.appLauncher.wm.makeDraggable(propsWin);
    this.appLauncher.wm.makeResizable(propsWin);
    this.appLauncher.wm.setupWindowControls(propsWin);
  }

  showDesktopContextMenu(e) {
    const handlers = {
      newNotepad: () => this.notepadApp.open(),
      newFolder: async () => {
        const folderName = prompt("Enter folder name:", "New Folder");
        if (folderName) {
          await this.fs.createFolder(["Desktop"], folderName);
          await this.createFolderIcon(folderName);
        }
      },
      openExplorer: () => this.explorerApp.open(),
      paste: () => this.pasteIcons(e.pageX, e.pageY),
      refresh: async () => {
        const folderIcons = document.querySelectorAll(".folder-icon");
        folderIcons.forEach((icon) => icon.remove());
        await this.loadDesktopItems();
        location.reload();
      }
    };

    this.contextMenuHelper.show(e, this.templates.desktopContextMenu, handlers);
  }

  async initializeDesktopFiles() {
    await this.fs.ensureFolder(["Desktop"]);

    const icons = document.querySelectorAll(".icon.selectable:not(.folder-icon)");
    for (const icon of icons) {
      const name = IconDataHelper.getIconName(icon);
      const app = icon.dataset.app;
      const fileName = `${name}.desktop`;

      const position = await this.fileSystemHelper.loadPositionFromFile(["Desktop"], fileName);

      if (position) {
        this.positionHelper.setPosition(icon, position.leftPx, position.topPx);
      } else {
        const content = IconDataHelper.createDesktopFileData(app, name);
        await this.fs.createFile(["Desktop"], fileName, content, "text");
      }
    }

    await this.loadDesktopItems();
  }

  async loadDesktopItems() {
    const desktopFolder = await this.fs.getFolder(["Desktop"]);

    for (const [name, itemData] of Object.entries(desktopFolder)) {
      if (!itemData.type) {
        await this.createFolderIcon(name);
      }
    }
  }

  async createFolderIcon(folderName) {
    const existingFolder = document.querySelector(`.folder-icon[data-folder-name="${folderName}"]`);
    if (existingFolder) return existingFolder;

    const folderIcon = document.createElement("div");
    folderIcon.className = "icon selectable folder-icon";
    folderIcon.dataset.folderName = folderName;
    folderIcon.innerHTML = `
      <img src="/static/icons/file.webp" style="width:64px;height:64px">
      <div>${folderName}</div>
    `;

    this.desktop.appendChild(folderIcon);
    this.makeIconInteractable(folderIcon);

    const metaFileName = `.${folderName}.folder`;
    const position = await this.fileSystemHelper.loadPositionFromFile(["Desktop"], metaFileName);

    if (position) {
      this.positionHelper.setPosition(folderIcon, position.leftPx, position.topPx);
    } else {
      this.positionHelper.snap(folderIcon);
    }

    return folderIcon;
  }

  pasteIcons(x, y) {
    if (!this.state.clipboard) return;

    const { action, icons } = this.state.clipboard;

    icons.forEach((iconData, index) => {
      let newLeft = x + index * 10;
      let newTop = y + index * 10;

      const newIcon = this.createIconElement(iconData.data, newLeft, newTop);
      this.makeIconInteractable(newIcon);
      this.desktop.appendChild(newIcon);
      this.positionHelper.snap(newIcon);

      if (action === "cut" && iconData.element) {
        iconData.element.remove();
      }
    });

    if (action === "cut") {
      this.state.clipboard = null;
    }
  }

  createIconElement(data, left, top) {
    const icon = document.createElement("div");
    icon.className = data.className;
    icon.innerHTML = data.innerHTML;

    icon.dataset.app = data.app;
    icon.dataset.name = data.name;
    icon.dataset.path = data.path;

    Object.assign(icon.style, {
      position: "absolute",
      userSelect: "none",
      webkitUserDrag: "none",
      cursor: "default"
    });

    this.positionHelper.setPosition(icon, left, top);

    return icon;
  }

  setupInteractableSelection() {
    let selectionState = {
      startX: 0,
      startY: 0,
      isActive: false
    };

    const desktopInteractable = interact(this.desktop);
    desktopInteractable.resizable(false);

    desktopInteractable.draggable({
      cursorChecker: () => null,
      listeners: {
        start: (event) => {
          if (this.appLauncher.wm.isDraggingWindow) return;
          if (event.target !== this.desktop) return;

          selectionState = {
            startX: event.pageX,
            startY: event.pageY,
            isActive: true
          };

          this.initializeSelectionBox(selectionState.startX, selectionState.startY);
          this.selectionManager.clear();
        },
        move: (event) => {
          if (!selectionState.isActive) return;
          if (event.target !== this.desktop) return;

          this.updateSelectionBox(event, selectionState);
          this.updateIconSelection();
        },
        end: () => {
          if (!selectionState.isActive) return;
          this.hideSelectionBox();
          selectionState.isActive = false;
        }
      }
    });
  }

  initializeSelectionBox(x, y) {
    Object.assign(this.selectionBox.style, {
      left: `${x}px`,
      top: `${y}px`,
      width: "0px",
      height: "0px",
      display: "block"
    });
  }

  updateSelectionBox(event, selectionState) {
    const width = Math.abs(event.pageX - selectionState.startX);
    const height = Math.abs(event.pageY - selectionState.startY);
    const left = Math.min(event.pageX, selectionState.startX);
    const top = Math.min(event.pageY, selectionState.startY);

    Object.assign(this.selectionBox.style, {
      width: `${width}px`,
      height: `${height}px`,
      left: `${left}px`,
      top: `${top}px`
    });
  }

  updateIconSelection() {
    const boxRect = this.selectionBox.getBoundingClientRect();
    const selectableIcons = document.querySelectorAll(".icon.selectable");

    selectableIcons.forEach((icon) => {
      const iconRect = icon.getBoundingClientRect();
      const isOverlapping = this.checkOverlap(boxRect, iconRect);

      if (isOverlapping) {
        this.selectionManager.add(icon);
      } else {
        this.selectionManager.remove(icon);
      }
    });
  }

  checkOverlap(rect1, rect2) {
    return !(
      rect2.right < rect1.left ||
      rect2.left > rect1.right ||
      rect2.bottom < rect1.top ||
      rect2.top > rect1.bottom
    );
  }

  hideSelectionBox() {
    this.selectionBox.style.display = "none";
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

        if (menuActions[app]) {
          menuActions[app]();
        }

        this.startMenu.style.display = "none";
      };
    });
  }
}

export function layoutIcons(icons, isExplorerIcon) {
  if (!icons) return;
  const positionHelper = new PositionHelper(desktop, { width: 80, height: 100, gap: 5 });
  positionHelper.layout(icons, isExplorerIcon);
}

function layoutIconsCall() {
  const icons = desktop.querySelectorAll(":scope > .icon");
  layoutIcons(icons);
}

window.addEventListener("load", layoutIconsCall);
window.addEventListener("resize", layoutIconsCall);
