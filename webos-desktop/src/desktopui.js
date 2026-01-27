import { updateFavoritesUI } from "./startMenu.js";
import { desktop } from "./desktop.js";
import interact from "interactjs";

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

    this.state = {
      clipboard: null,
      selectedIcons: new Set(),
      gridSize: { width: 80, height: 100, gap: 5 },
      isSelecting: false,
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

  pxToPercent(px, dimension) {
    const desktopSize = dimension === "x" ? this.desktop.clientWidth : this.desktop.clientHeight;
    return (px / desktopSize) * 100;
  }

  percentToPx(percent, dimension) {
    const desktopSize = dimension === "x" ? this.desktop.clientWidth : this.desktop.clientHeight;
    return (percent / 100) * desktopSize;
  }

  setupEventListeners() {
    this.startButton.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleStartMenu();
    });

    this.startMenu.addEventListener("click", (e) => e.stopPropagation());

    document.addEventListener("click", () => {
      this.closeAllMenus();
    });

    this.desktop.addEventListener("contextmenu", (e) => {
      this.handleContextMenu(e);
    });

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
      resizeTimeout = setTimeout(() => {
        this.repositionAllIcons();
      }, 100);
    });
  }

  repositionAllIcons() {
    const icons = document.querySelectorAll(".icon.selectable");
    icons.forEach((icon) => {
      const leftPercent = parseFloat(icon.dataset.leftPercent);
      const topPercent = parseFloat(icon.dataset.topPercent);

      if (!isNaN(leftPercent) && !isNaN(topPercent)) {
        const leftPx = this.percentToPx(leftPercent, "x");
        const topPx = this.percentToPx(topPercent, "y");

        Object.assign(icon.style, {
          left: `${leftPx}px`,
          top: `${topPx}px`
        });

        this.snapIconToGrid(icon);
      }
    });
  }

  setupKeyboardShortcuts() {
    let lastMousePos = { x: 50, y: 50 };

    document.addEventListener("mousemove", (e) => {
      lastMousePos = { x: e.pageX, y: e.pageY };
    });

    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.code === "KeyC") {
        e.preventDefault();
        const selectedArray = Array.from(this.state.selectedIcons);
        if (selectedArray.length) this.copySelectedIcons(selectedArray);
      }

      if (e.ctrlKey && e.code === "KeyX") {
        e.preventDefault();
        const selectedArray = Array.from(this.state.selectedIcons);
        if (selectedArray.length) this.cutSelectedIcons(selectedArray);
      }

      if (e.ctrlKey && e.code === "KeyV") {
        e.preventDefault();
        if (!this.state.clipboard) return;
        this.pasteIcons(lastMousePos.x, lastMousePos.y);
      }
    });
  }

  toggleStartMenu() {
    this.startMenu.style.display = this.startMenu.style.display === "flex" ? "none" : "flex";
    updateFavoritesUI(this.appLauncher);
  }

  closeAllMenus() {
    this.startMenu.style.display = "none";
    this.contextMenu.style.display = "none";
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

    icon.addEventListener("mousedown", (e) => {
      this.handleIconSelection(icon, e.ctrlKey);
    });
  }

  async openFolder(folderName) {
    this.explorerApp.open();
    await this.explorerApp.navigate(["Desktop", folderName]);
  }

  handleIconSelection(icon, isCtrlKey) {
    if (!isCtrlKey) {
      if (!this.state.selectedIcons.has(icon)) {
        this.clearSelection();
        this.addToSelection(icon);
      }
    } else {
      this.toggleSelection(icon);
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
        start: (event) => this.onDragStart(event),
        move: (event) => this.onDragMove(event),
        end: (event) => this.onDragEnd(event)
      }
    });
  }

  onDragStart() {
    this.state.isUserDragging = true;
    this.state.selectedIcons.forEach((selectedIcon) => {
      Object.assign(selectedIcon.style, {
        opacity: "0.7",
        zIndex: "1000",
        cursor: "move"
      });
    });
  }

  onDragMove(event) {
    const { dx, dy } = event;

    this.state.selectedIcons.forEach((selectedIcon) => {
      const currentX = parseFloat(selectedIcon.style.left) || 0;
      const currentY = parseFloat(selectedIcon.style.top) || 0;

      const newX = Math.max(0, currentX + dx);
      const newY = Math.max(0, currentY + dy);

      Object.assign(selectedIcon.style, {
        left: `${newX}px`,
        top: `${newY}px`
      });

      selectedIcon.dataset.leftPercent = this.pxToPercent(newX, "x");
      selectedIcon.dataset.topPercent = this.pxToPercent(newY, "y");
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

    if (foundTarget && !this.state.selectedIcons.has(foundTarget)) {
      foundTarget.style.outline = "2px solid #0078d7";
      this.state.dragTarget = foundTarget;
    } else {
      this.state.dragTarget = null;
    }
  }

  async moveIconsToFolder(icons, folderName) {
    for (const icon of icons) {
      if (icon.classList.contains("folder-icon")) continue;

      const nameElement = icon.querySelector("div");
      const name = nameElement ? nameElement.textContent.trim() : "Unknown";
      const fileName = `${name}.desktop`;
      const fileContent = await this.fs.getFileContent(["Desktop"], fileName);

      await this.fs.createFile(["Desktop", folderName], fileName, fileContent, "text");
      await this.fs.deleteItem(["Desktop"], fileName);

      icon.remove();
      this.state.selectedIcons.delete(icon);
    }

    this.clearSelection();
  }

  async updateDesktopFilePositions() {
    for (const icon of this.state.selectedIcons) {
      if (icon.classList.contains("folder-icon")) continue;

      const nameElement = icon.querySelector("div");
      const name = nameElement ? nameElement.textContent.trim() : "Unknown";
      const fileName = `${name}.desktop`;
      const app = icon.dataset.app;

      const pathMap = {
        explorer: "/static/icons/pc.webp",
        notepad: "/static/icons/notepad.webp",
        flash: "/static/icons/flash.webp"
      };

      const leftPercent =
        parseFloat(icon.dataset.leftPercent) || this.pxToPercent(parseFloat(icon.style.left) || 0, "x");
      const topPercent = parseFloat(icon.dataset.topPercent) || this.pxToPercent(parseFloat(icon.style.top) || 0, "y");

      const fileContent = JSON.stringify({
        app: app,
        name: name,
        path: pathMap[app] || "/static/icons/file.webp",
        position: {
          leftPercent: leftPercent,
          topPercent: topPercent
        }
      });

      await this.fs.createFile(["Desktop"], fileName, fileContent, "text");
    }
  }

  snapIconToGrid(icon) {
    const { width, height, gap } = this.state.gridSize;

    const cellW = width + gap;
    const cellH = height + gap;

    let x = parseFloat(icon.style.left) || 0;
    let y = parseFloat(icon.style.top) || 0;

    let col = Math.round((x - gap) / cellW);
    let row = Math.round((y - gap) / cellH);

    if (col < 0) col = 0;
    if (row < 0) row = 0;

    let snappedLeft = gap + col * cellW;
    let snappedTop = gap + row * cellH;

    const desktopW = this.desktop.clientWidth;
    const desktopH = this.desktop.clientHeight;

    while (this.isPositionOccupied(snappedLeft, snappedTop, icon)) {
      row++;
      snappedTop = gap + row * cellH;

      if (snappedTop + height > desktopH) {
        row = 0;
        col++;
        snappedLeft = gap + col * cellW;

        if (snappedLeft + width > desktopW) {
          break;
        }
      }
    }

    Object.assign(icon.style, {
      left: `${snappedLeft}px`,
      top: `${snappedTop}px`
    });

    icon.dataset.leftPercent = this.pxToPercent(snappedLeft, "x");
    icon.dataset.topPercent = this.pxToPercent(snappedTop, "y");
  }
  isPositionOccupied(left, top, excludeIcon) {
    const icons = Array.from(document.querySelectorAll(".icon.selectable"));
    const { width, height } = this.state.gridSize;

    return icons.some((icon) => {
      if (icon === excludeIcon) return false;

      const iconLeft = parseFloat(icon.style.left) || 0;
      const iconTop = parseFloat(icon.style.top) || 0;

      return Math.abs(iconLeft - left) < width * 0.5 && Math.abs(iconTop - top) < height * 0.5;
    });
  }

  addToSelection(icon) {
    this.state.selectedIcons.add(icon);
    icon.classList.add("selected");
  }

  removeFromSelection(icon) {
    this.state.selectedIcons.delete(icon);
    icon.classList.remove("selected");
  }

  toggleSelection(icon) {
    if (this.state.selectedIcons.has(icon)) {
      this.removeFromSelection(icon);
    } else {
      this.addToSelection(icon);
    }
  }

  clearSelection() {
    this.state.selectedIcons.forEach((icon) => {
      icon.classList.remove("selected");
    });
    this.state.selectedIcons.clear();
  }

  createContextMenuHTML(items) {
    return items
      .filter((item) => {
        if (typeof item === "string") return true;
        return !item.condition || item.condition();
      })
      .map((item) => {
        if (item === "hr") return "<hr>";
        return `<div id="${item.id}">${item.label}</div>`;
      })
      .join("");
  }

  attachContextMenuHandlers(items, handlers) {
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

  showFolderContextMenu(e, folderIcon) {
    this.clearSelection();
    this.addToSelection(folderIcon);

    this.contextMenu.innerHTML = this.createContextMenuHTML(this.templates.folderContextMenu);

    const handlers = {
      openFolder: () => this.openFolder(folderIcon.dataset.folderName),
      deleteFolder: async () => {
        await this.fs.deleteItem(["Desktop"], folderIcon.dataset.folderName);
        folderIcon.remove();
        this.clearSelection();
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

    this.attachContextMenuHandlers(this.templates.folderContextMenu, handlers);
    this.positionContextMenu(e);
  }

  showIconContextMenu(e, icon) {
    if (!this.state.selectedIcons.has(icon)) {
      this.clearSelection();
      this.addToSelection(icon);
    }

    const selectedArray = Array.from(this.state.selectedIcons);
    const lastSelected = selectedArray[selectedArray.length - 1];

    this.contextMenu.innerHTML = this.createContextMenuHTML(this.templates.iconContextMenu);

    const handlers = {
      open: () => this.appLauncher.launch(lastSelected.dataset.app),
      cut: () => this.cutSelectedIcons(selectedArray),
      copy: () => this.copySelectedIcons(selectedArray),
      delete: () => this.deleteSelectedIcons(selectedArray),
      properties: () => this.showPropertiesDialog(lastSelected)
    };

    this.attachContextMenuHandlers(this.templates.iconContextMenu, handlers);
    this.positionContextMenu(e);
  }
  cutSelectedIcons(selectedArray) {
    this.state.clipboard = {
      action: "cut",
      icons: selectedArray.map((icon) => ({
        element: icon,
        data: {
          app: icon.dataset.app,
          name: icon.dataset.name,
          path: icon.dataset.path,
          className: icon.className,
          innerHTML: icon.innerHTML
        }
      }))
    };
  }

  copySelectedIcons(selectedArray) {
    this.state.clipboard = {
      action: "copy",
      icons: selectedArray.map((icon) => ({
        data: {
          app: icon.dataset.app,
          name: icon.dataset.name,
          path: icon.dataset.path,
          className: icon.className,
          innerHTML: icon.innerHTML
        }
      }))
    };
  }

  deleteSelectedIcons(selectedArray) {
    selectedArray.forEach((icon) => {
      this.state.selectedIcons.delete(icon);
      icon.remove();
    });
  }

  extractIconData(icon) {
    return {
      app: icon.dataset.app,
      name: icon.dataset.name,
      path: icon.dataset.path,
      innerHTML: icon.innerHTML,
      className: icon.className
    };
  }

  createPropertiesContent(icon) {
    const rect = icon.getBoundingClientRect();
    const appId = icon.dataset.app;
    const appInfo = this.appLauncher?.appMap?.[appId] ?? {};
    const nameElement = icon.querySelector("div");
    const name = nameElement ? nameElement.textContent.trim() : "Unknown";

    const pathMap = {
      explorer: "/static/icons/pc.webp",
      notepad: "/static/icons/notepad.webp",
      flash: "/static/icons/flash.webp"
    };

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
    const nameElement = icon.querySelector("div");
    const name = nameElement ? nameElement.textContent.trim() : "Unknown";
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
    this.contextMenu.innerHTML = this.createContextMenuHTML(this.templates.desktopContextMenu);

    const handlers = {
      newNotepad: () => this.notepadApp.open(),
      newFolder: async () => {
        const folderName = prompt("Enter folder name:", "New Folder");
        if (folderName) {
          await this.fs.createFolder(["Desktop"], folderName);
          this.createFolderIcon(folderName);
          await this.saveFolderPosition(folderName);
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

    this.attachContextMenuHandlers(this.templates.desktopContextMenu, handlers);
    this.positionContextMenu(e);
  }

  async initializeDesktopFiles() {
    await this.fs.ensureFolder(["Desktop"]);

    const icons = document.querySelectorAll(".icon.selectable:not(.folder-icon)");
    for (const icon of icons) {
      const nameElement = icon.querySelector("div");
      const name = nameElement ? nameElement.textContent.trim() : "Unknown";
      const app = icon.dataset.app;
      const fileName = `${name}.desktop`;

      const existingFileContent = await this.fs.getFileContent(["Desktop"], fileName);

      if (existingFileContent) {
        const fileData = JSON.parse(existingFileContent);
        if (fileData.position && fileData.position.leftPercent !== undefined) {
          const leftPx = this.percentToPx(fileData.position.leftPercent, "x");
          const topPx = this.percentToPx(fileData.position.topPercent, "y");

          Object.assign(icon.style, {
            left: `${leftPx}px`,
            top: `${topPx}px`
          });

          icon.dataset.leftPercent = fileData.position.leftPercent;
          icon.dataset.topPercent = fileData.position.topPercent;
        }
      } else {
        const pathMap = {
          explorer: "/static/icons/pc.webp",
          notepad: "/static/icons/notepad.webp",
          flash: "/static/icons/flash.webp"
        };

        const desktopFileContent = JSON.stringify({
          app: app,
          name: name,
          path: pathMap[app] || "/static/icons/file.webp"
        });

        await this.fs.createFile(["Desktop"], fileName, desktopFileContent, "text");
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
    const metaContent = await this.fs.getFileContent(["Desktop"], metaFileName);

    if (metaContent) {
      const folderData = JSON.parse(metaContent);
      if (folderData.position && folderData.position.leftPercent !== undefined) {
        const leftPx = this.percentToPx(folderData.position.leftPercent, "x");
        const topPx = this.percentToPx(folderData.position.topPercent, "y");

        Object.assign(folderIcon.style, {
          left: `${leftPx}px`,
          top: `${topPx}px`
        });

        folderIcon.dataset.leftPercent = folderData.position.leftPercent;
        folderIcon.dataset.topPercent = folderData.position.topPercent;
      } else {
        this.snapIconToGrid(folderIcon);
      }
    } else {
      this.snapIconToGrid(folderIcon);
    }

    return folderIcon;
  }

  async saveFolderPosition(folderName) {
    if (!this.state.isUserDragging) return;

    const folderIcon = document.querySelector(`.folder-icon[data-folder-name="${folderName}"]`);
    if (!folderIcon) return;

    const leftPercent =
      parseFloat(folderIcon.dataset.leftPercent) || this.pxToPercent(parseFloat(folderIcon.style.left) || 0, "x");
    const topPercent =
      parseFloat(folderIcon.dataset.topPercent) || this.pxToPercent(parseFloat(folderIcon.style.top) || 0, "y");

    const metaFileName = `.${folderName}.folder`;
    const folderData = JSON.stringify({
      type: "folder",
      name: folderName,
      position: {
        leftPercent: leftPercent,
        topPercent: topPercent
      }
    });

    await this.fs.createFile(["Desktop"], metaFileName, folderData, "text");
  }

  async onDragEnd() {
    if (!this.state.isUserDragging) return;

    this.state.isUserDragging = false;

    if (this.state.dragTarget) {
      const folderName = this.state.dragTarget.dataset.folderName;
      await this.moveIconsToFolder(Array.from(this.state.selectedIcons), folderName);
      this.state.dragTarget.style.outline = "";
      this.state.dragTarget = null;
    } else {
      this.state.selectedIcons.forEach((selectedIcon) => {
        this.snapIconToGrid(selectedIcon);
        Object.assign(selectedIcon.style, {
          opacity: "1",
          zIndex: "1",
          cursor: "default"
        });
      });

      await this.updateDesktopFilePositions();

      for (const icon of this.state.selectedIcons) {
        if (icon.classList.contains("folder-icon")) {
          await this.saveFolderPosition(icon.dataset.folderName);
        }
      }
    }
  }

  positionContextMenu(e) {
    Object.assign(this.contextMenu.style, {
      left: `${e.pageX}px`,
      top: `${e.pageY}px`,
      display: "block"
    });
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
      this.snapIconToGrid(newIcon);

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
      left: `${left}px`,
      top: `${top}px`,
      userSelect: "none",
      webkitUserDrag: "none",
      cursor: "default"
    });

    icon.dataset.leftPercent = this.pxToPercent(left, "x");
    icon.dataset.topPercent = this.pxToPercent(top, "y");

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
          this.clearSelection();
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
        this.addToSelection(icon);
      } else {
        this.removeFromSelection(icon);
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
  const ICON_WIDTH = 80;
  const ICON_HEIGHT = 100;
  const GAP = isExplorerIcon ? 30 : 10;
  const GAPY = isExplorerIcon ? 25 : 5;

  const desktopHeight = desktop.clientHeight;
  const cellWidth = ICON_WIDTH + GAP;
  const cellHeight = ICON_HEIGHT + GAP;

  let col = 0;
  let row = 0;

  requestAnimationFrame(() => {
    for (const icon of icons) {
      const x = GAP + col * cellWidth;
      const y = GAPY + row * cellHeight;

      Object.assign(icon.style, {
        position: "absolute",
        left: `${x}px`,
        top: `${y}px`
      });

      row++;
      if (y + cellHeight + ICON_HEIGHT > desktopHeight) {
        row = 0;
        col++;
      }
    }
  });
}
function layoutIconsCall() {
  const icons = desktop.querySelectorAll(":scope > .icon");
  layoutIcons(icons);
}

window.addEventListener("load", layoutIconsCall);
window.addEventListener("resize", layoutIconsCall);
