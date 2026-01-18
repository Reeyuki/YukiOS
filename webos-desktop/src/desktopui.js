import { updateFavoritesUI } from "./startMenu.js";
import { desktop } from "./desktop.js";
import interact from "interactjs";
import _ from "lodash";

export class DesktopUI {
  constructor(appLauncher, notepadApp, explorerApp) {
    this.appLauncher = appLauncher;
    this.notepadApp = notepadApp;
    this.explorerApp = explorerApp;
    this.desktop = document.getElementById("desktop");
    this.startButton = document.getElementById("start-button");
    this.startMenu = document.getElementById("start-menu");
    this.contextMenu = document.getElementById("context-menu");
    this.selectionBox = document.getElementById("selection-box");

    this.state = {
      clipboard: null,
      selectedIcons: new Set(),
      gridSize: { width: 80, height: 100, gap: 5 },
      isSelecting: false
    };

    this.templates = {
      iconContextMenu: [
        { id: "ctx-open", label: "Open", action: "open" },
        { id: "ctx-cut", label: "Cut", action: "cut" },
        { id: "ctx-copy", label: "Copy", action: "copy" },
        { id: "ctx-delete", label: "Delete", action: "delete" },
        { id: "ctx-properties", label: "Properties", action: "properties" }
      ],
      desktopContextMenu: [
        { id: "ctx-new-notepad", label: "New Notepad", action: "newNotepad" },
        { id: "ctx-open-explorer", label: "Open File Explorer", action: "openExplorer" },
        { id: "ctx-paste", label: "Paste", action: "paste", condition: () => this.state.clipboard },
        "hr",
        { id: "ctx-refresh", label: "Refresh", action: "refresh" }
      ]
    };

    this.setupEventListeners();
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
    if (e.target.classList.contains("selectable")) {
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

  makeIconInteractable(icon) {
    this.setIconNonDraggable(icon);
    this.attachIconEvents(icon);
    this.setupInteractDrag(icon);
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
      this.appLauncher.launch(icon.dataset.app, icon);
    });

    icon.addEventListener("mousedown", (e) => {
      this.handleIconSelection(icon, e.ctrlKey);
    });
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
    });
  }

  onDragEnd() {
    this.state.selectedIcons.forEach((selectedIcon) => {
      this.snapIconToGrid(selectedIcon);
      Object.assign(selectedIcon.style, {
        opacity: "1",
        zIndex: "1",
        cursor: "default"
      });
    });
  }

  snapIconToGrid(icon) {
    const { width, height, gap } = this.state.gridSize;
    const columnWidth = width + gap;
    const rowHeight = height + gap;

    let currentLeft = parseFloat(icon.style.left) || 0;
    let currentTop = parseFloat(icon.style.top) || 0;

    let snappedLeft = Math.round(currentLeft / columnWidth) * columnWidth + gap;
    let snappedTop = Math.round(currentTop / rowHeight) * rowHeight + gap;

    while (this.isPositionOccupied(snappedLeft, snappedTop, icon)) {
      const desktopHeight = this.desktop.clientHeight;
      snappedTop += rowHeight;

      if (snappedTop + height > desktopHeight) {
        snappedTop = gap;
        snappedLeft += columnWidth;
      }
    }

    Object.assign(icon.style, {
      left: `${snappedLeft}px`,
      top: `${snappedTop}px`
    });
  }

  isPositionOccupied(left, top, excludeIcon) {
    const icons = Array.from(document.querySelectorAll(".icon.selectable"));
    const tolerance = 10;

    return icons.some((icon) => {
      if (icon === excludeIcon) return false;

      const iconLeft = parseFloat(icon.style.left) || 0;
      const iconTop = parseFloat(icon.style.top) || 0;

      return Math.abs(iconLeft - left) < tolerance && Math.abs(iconTop - top) < tolerance;
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

  showIconContextMenu(e, icon) {
    if (!this.state.selectedIcons.has(icon)) {
      this.clearSelection();
      this.addToSelection(icon);
    }

    const selectedArray = Array.from(this.state.selectedIcons);
    const lastSelected = _.last(selectedArray);

    this.contextMenu.innerHTML = this.createContextMenuHTML(this.templates.iconContextMenu);

    const handlers = {
      open: () => this.appLauncher.launch(lastSelected.dataset.app, lastSelected),
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
        data: this.extractIconData(icon)
      }))
    };
  }

  copySelectedIcons(selectedArray) {
    this.state.clipboard = {
      action: "copy",
      icons: selectedArray.map((icon) => ({
        data: this.extractIconData(icon)
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
    const data = _.pick(icon.dataset, ["app", "name", "path"]);
    return {
      ...data,
      innerHTML: icon.innerHTML,
      className: icon.className
    };
  }

  createPropertiesContent(icon) {
    const dataset = icon.dataset;
    const rect = icon.getBoundingClientRect();
    const appId = dataset.app;
    const appInfo = _.get(this.appLauncher, `appMap.${appId}`, {});

    const properties = {
      Name: dataset.name || "Unknown",
      Type: dataset.app || "Application",
      Path: dataset.path,
      "App Type": appInfo.type,
      "SWF Path": appInfo.swf,
      URL: appInfo.url,
      Core: dataset.core,
      Width: `${Math.round(rect.width)}px`,
      Height: `${Math.round(rect.height)}px`,
      Left: `${Math.round(rect.left)}px`,
      Top: `${Math.round(rect.top)}px`,
      "Z-Index": icon.style.zIndex || "0"
    };

    return _.chain(properties)
      .pickBy((value) => !_.isEmpty(value) && value !== undefined)
      .map((value, key) => `<div style="margin:2px 0;">${key}: ${value}</div>`)
      .join("")
      .value();
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
    const title = `Properties: ${icon.dataset.name || "Unknown"}`;
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
      openExplorer: () => this.explorerApp.open(),
      paste: () => this.pasteIcons(e.pageX, e.pageY),
      refresh: () => location.reload()
    };

    this.attachContextMenuHandlers(this.templates.desktopContextMenu, handlers);
    this.positionContextMenu(e);
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
      const newIcon = this.createIconElement(iconData.data, x + index * 10, y + index * 10);
      this.makeIconInteractable(newIcon);
      this.desktop.appendChild(newIcon);

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

    Object.assign(icon.dataset, _.pick(data, ["app", "name", "path"]));

    Object.assign(icon.style, {
      position: "absolute",
      left: `${left}px`,
      top: `${top}px`,
      userSelect: "none",
      webkitUserDrag: "none",
      cursor: "default"
    });

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
          if (!selectionState.isActive || event.target !== this.desktop) return;

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
      documents: () => {
        this.explorerApp.open();
        this.explorerApp.navigate(["home", "reeyuki", "Documents"]);
      },
      pictures: () => {
        this.explorerApp.open();
        this.explorerApp.navigate(["home", "reeyuki", "Pictures"]);
      },
      notes: () => this.notepadApp.open()
    };

    this.startMenu.querySelectorAll(".start-item").forEach((item) => {
      item.onclick = (e) => {
        e.stopPropagation();
        const app = item.dataset.app;

        if (menuActions[app]) {
          menuActions[app]();
        }

        this.startMenu.style.display = "none";
      };
    });
  }
}
