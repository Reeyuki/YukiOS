import { TerminalApp } from "./terminal.js";
import { ExplorerApp, FileKind } from "./explorer.js";
import { WindowManager } from "./windowManager.js";
import { BrowserApp } from "./browser.js";
import { AppLauncher } from "./appLauncher.js";
import { NotepadApp } from "./notepad.js";
import { CameraApp } from "./camera.js";

const defaultStorage = {
  home: {
    reeyuki: {
      Documents: {
        "INFO.txt": {
          type: "file",
          content: "Files you saved in notepad gets saved in your browser session.",
          kind: FileKind.TEXT
        }
      },
      Pictures: {
        "wallpaper1.webp": { type: "file", content: "/static/wallpapers/wallpaper1.webp", kind: FileKind.IMAGE },
        "wallpaper2.webp": { type: "file", content: "/static/wallpapers/wallpaper2.webp", kind: FileKind.IMAGE },
        "wallpaper3.webp": { type: "file", content: "/static/wallpapers/wallpaper3.webp", kind: FileKind.IMAGE },
        "wallpaper4.webp": { type: "file", content: "/static/wallpapers/wallpaper4.webp", kind: FileKind.IMAGE },
        "wallpaper5.webp": { type: "file", content: "/static/wallpapers/wallpaper5.webp", kind: FileKind.IMAGE },
        "wallpaper6.webp": { type: "file", content: "/static/wallpapers/wallpaper6.webp", kind: FileKind.IMAGE }
      },
      Music: {}
    }
  }
};

const CONFIG = {
  GRID_SIZE: 80,
  STORAGE_KEY: "desktopOS_fileSystem",
  DEFAULT_WINDOW_SIZE: { width: "80vw", height: "80vh" },
  MUSIC_PLAYLIST: [
    "7pfOV26Wzr1KcV8rtIG2FU",
    "2QGUSa5gqCHjgko63KyQeK",
    "1jDMi92a9zNQuPD3uPMkla",
    "6eTcxkl9G7C2mwejLJ7Amm",
    "1vuSdk2EGjh3eXCXBbT9Qf",
    "3PV4bPPqezu18K45MIOrVY",
    "1K45maA9jDR1kBRpojtPmO",
    "2aEuA8PSqLa17Y4hKPj5rr"
  ]
};

class FileSystemManager {
  constructor() {
    this.loadFromStorage();
  }

  loadFromStorage() {
    const stored = localStorage.getItem(CONFIG.STORAGE_KEY);
    this.fileSystem = stored ? JSON.parse(stored) : defaultStorage;
  }

  saveToStorage() {
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(this.fileSystem));
  }

  normalizePath(path) {
    if (typeof path === "string") {
      return path.split("/").filter((p) => p);
    }
    return Array.isArray(path) ? path.filter((p) => p) : [];
  }

  resolvePath(pathStr, currentPath = []) {
    if (typeof pathStr === "string") {
      if (pathStr.startsWith("/")) {
        return this.normalizePath(pathStr);
      }
      const resolved = [...currentPath];
      pathStr
        .split("/")
        .filter((p) => p)
        .forEach((part) => {
          if (part === "..") {
            resolved.pop();
          } else if (part !== ".") {
            resolved.push(part);
          }
        });
      return resolved;
    }
    return this.normalizePath(pathStr);
  }

  getFolder(path) {
    const normalizedPath = this.normalizePath(path);
    return normalizedPath.reduce((acc, folder) => {
      if (!acc || typeof acc !== "object") {
        throw new Error(`Invalid path: cannot access ${folder}`);
      }
      return acc[folder];
    }, this.fileSystem);
  }

  inferKind(fileName) {
    const ext = fileName.split(".").pop().toLowerCase();
    if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return FileKind.IMAGE;
    if (["txt", "js", "json", "md", "html", "css"].includes(ext)) return FileKind.TEXT;
    return "generic";
  }

  createFile(path, fileName, content = "") {
    const folder = this.getFolder(path);
    const kind = this.inferKind(fileName);
    folder[fileName] = { type: "file", content, kind };
    this.saveToStorage();
  }

  createFolder(path, folderName) {
    const folder = this.getFolder(path);
    folder[folderName] = {};
    this.saveToStorage();
  }

  deleteItem(path, itemName) {
    const folder = this.getFolder(path);
    delete folder[itemName];
    this.saveToStorage();
  }

  renameItem(path, oldName, newName) {
    const folder = this.getFolder(path);
    folder[newName] = folder[oldName];
    delete folder[oldName];
    this.saveToStorage();
  }

  updateFile(path, fileName, content) {
    const folder = this.getFolder(path);
    const item = folder[fileName];
    if (item && item.type === "file") {
      item.content = content;
    } else {
      const kind = this.inferKind(fileName);
      folder[fileName] = { type: "file", content, kind };
    }
    this.saveToStorage();
  }

  getFileContent(path, fileName) {
    const folder = this.getFolder(path);
    const item = folder[fileName];
    if (item && item.type === "file") {
      return item.content || "";
    }
    return "";
  }

  getFileKind(path, fileName) {
    const folder = this.getFolder(path);
    const item = folder[fileName];
    console.log(item);
    if (item && item.type === "file") {
      return item.kind || "generic";
    }
    return null;
  }

  isFile(path, itemName) {
    const folder = this.getFolder(path);
    const item = folder[itemName];
    return item && item.type === "file";
  }
}

class MusicPlayer {
  constructor() {}
  open(windowManager) {
    if (document.getElementById("music-win")) {
      console.log("bringing window to front");
      windowManager.bringToFront(document.getElementById("music-win"));
      return;
    }
    console.log("Creating window");
    const win = windowManager.createWindow("music-win", "MUSIC");

    win.innerHTML = `
  <div class="window-header">
    <span>MUSIC</span>
    <div class="window-controls">
      <button class="minimize-btn" title="Minimize">−</button>
      <button class="maximize-btn" title="Maximize">□</button>
      <button class="close-btn" title="Close">X</button>
    </div>
  </div>
  <div class="window-content" style="width:100%; height:100%;">
    <div id="player-container" style="display:flex; flex-direction:column; align-items:center; gap:10px; padding:10px;"></div>
    </div>
  </div>`;

    desktop.appendChild(win);
    explorerApp.renderMusicPage(document.getElementById("player-container"));
    windowManager.makeDraggable(win);
    windowManager.makeResizable(win);
    windowManager.setupWindowControls(win);
    windowManager.addToTaskbar(win.id, "MUSIC", "/static/icons/music.png");
  }
}

class DesktopUI {
  constructor(appLauncher) {
    this.appLauncher = appLauncher;
    this.desktop = document.getElementById("desktop");
    this.startButton = document.getElementById("start-button");
    this.startMenu = document.getElementById("start-menu");
    this.contextMenu = document.getElementById("context-menu");
    this.selectionBox = document.getElementById("selection-box");
    this.clipboardCurrentCopied = null;
    this.isDragging = false;
    this.draggedIcons = [];
    this.dragOffsets = [];
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.startButton.addEventListener("click", (e) => {
      e.stopPropagation();
      this.startMenu.style.display = this.startMenu.style.display === "flex" ? "none" : "flex";
    });
    this.startMenu.addEventListener("click", (e) => e.stopPropagation());

    document.addEventListener("click", () => {
      this.startMenu.style.display = "none";
      this.contextMenu.style.display = "none";
    });

    this.desktop.addEventListener("contextmenu", (e) => {
      if (e.target.classList.contains("selectable")) {
        e.preventDefault();
        this.showIconContextMenu(e, e.target);
      } else if (e.target === this.desktop) {
        e.preventDefault();
        this.showDesktopContextMenu(e);
      }
    });

    this.setupIconHandlers();
    this.setupSelectionBox();
    this.setupStartMenu();
  }

  setupIconHandlers() {
    document.querySelectorAll(".icon.selectable").forEach((icon) => {
      this.makeIconDraggable(icon);
    });
  }

  makeIconDraggable(icon) {
    icon.draggable = false;
    Object.assign(icon.style, { userSelect: "none", webkitUserDrag: "none" });

    icon.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      this.appLauncher.launch(icon.dataset.app, icon);
    });

    let mouseDownTime = 0;
    let mouseDownPos = { x: 0, y: 0 };

    icon.addEventListener("mousedown", (e) => {
      mouseDownTime = Date.now();
      mouseDownPos = { x: e.clientX, y: e.clientY };

      if (!e.ctrlKey) {
        if (!icon.classList.contains("selected")) {
          document.querySelectorAll(".icon.selectable").forEach((i) => i.classList.remove("selected"));
          icon.classList.add("selected");
        }
      } else {
        icon.classList.toggle("selected");
      }

      const selectedIcons = Array.from(document.querySelectorAll(".icon.selectable.selected"));
      this.draggedIcons = selectedIcons;
      this.dragOffsets = selectedIcons.map((i) => ({
        x: e.clientX - i.offsetLeft,
        y: e.clientY - i.offsetTop
      }));

      const onMouseMove = (e) => {
        const distance = Math.sqrt(Math.pow(e.clientX - mouseDownPos.x, 2) + Math.pow(e.clientY - mouseDownPos.y, 2));

        if (distance > 5 && !this.isDragging) {
          this.isDragging = true;
          this.draggedIcons.forEach((i) => {
            i.style.opacity = "0.7";
            i.style.zIndex = "1000";
          });
        }

        if (this.isDragging) {
          this.draggedIcons.forEach((draggedIcon, index) => {
            const newLeft = e.clientX - this.dragOffsets[index].x;
            const newTop = e.clientY - this.dragOffsets[index].y;

            draggedIcon.style.left = `${Math.max(0, newLeft)}px`;
            draggedIcon.style.top = `${Math.max(0, newTop)}px`;
          });
        }
      };

      const onMouseUp = (e) => {
        if (this.isDragging) {
          const ICON_WIDTH = 80;
          const ICON_HEIGHT = 100;
          const GAP = 5;

          this.draggedIcons.forEach((draggedIcon) => {
            const currentLeft = parseInt(draggedIcon.style.left);
            const currentTop = parseInt(draggedIcon.style.top);

            const columnWidth = ICON_WIDTH + GAP;
            const rowHeight = ICON_HEIGHT + GAP;

            let snappedLeft = Math.round(currentLeft / columnWidth) * columnWidth + GAP;
            let snappedTop = Math.round(currentTop / rowHeight) * rowHeight + GAP;

            while (this.isPositionOccupied(snappedLeft, snappedTop, draggedIcon)) {
              const desktopHeight = this.desktop.clientHeight;
              snappedTop += rowHeight;

              if (snappedTop + ICON_HEIGHT > desktopHeight) {
                snappedTop = GAP;
                snappedLeft += columnWidth;
              }
            }

            draggedIcon.style.left = `${snappedLeft}px`;
            draggedIcon.style.top = `${snappedTop}px`;
            draggedIcon.style.opacity = "1";
            draggedIcon.style.zIndex = "1";
          });
          this.isDragging = false;
        }

        this.draggedIcons = [];
        this.dragOffsets = [];

        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
  }
  isPositionOccupied(left, top, excludeIcon) {
    const icons = Array.from(document.querySelectorAll(".icon.selectable"));
    const tolerance = 10;

    return icons.some((icon) => {
      if (icon === excludeIcon) return false;

      const iconLeft = parseInt(icon.style.left) || 0;
      const iconTop = parseInt(icon.style.top) || 0;

      return Math.abs(iconLeft - left) < tolerance && Math.abs(iconTop - top) < tolerance;
    });
  }
  showIconContextMenu(e, icon) {
    const selectedIcons = Array.from(document.querySelectorAll(".icon.selectable.selected"));
    if (!selectedIcons.includes(icon)) {
      document.querySelectorAll(".icon.selectable").forEach((i) => i.classList.remove("selected"));
      icon.classList.add("selected");
    }

    const lastSelected = Array.from(document.querySelectorAll(".icon.selectable.selected")).pop();

    this.contextMenu.innerHTML = `
      <div id="ctx-open">Open</div>
      <div id="ctx-cut">Cut</div>
      <div id="ctx-copy">Copy</div>
      <div id="ctx-delete">Delete</div>
      <div id="ctx-properties">Properties</div>
    `;

    document.getElementById("ctx-open").onclick = () => {
      this.contextMenu.style.display = "none";
      this.appLauncher.launch(lastSelected.dataset.app, lastSelected);
    };

    document.getElementById("ctx-cut").onclick = () => {
      this.clipboardCurrentCopied = {
        action: "cut",
        icons: selectedIcons.map((i) => ({
          element: i,
          data: {
            app: i.dataset.app,
            name: i.dataset.name,
            path: i.dataset.path,
            innerHTML: i.innerHTML,
            className: i.className
          }
        }))
      };
      this.contextMenu.style.display = "none";
    };

    document.getElementById("ctx-copy").onclick = () => {
      this.clipboardCurrentCopied = {
        action: "copy",
        icons: selectedIcons.map((i) => ({
          data: {
            app: i.dataset.app,
            name: i.dataset.name,
            path: i.dataset.path,
            innerHTML: i.innerHTML,
            className: i.className
          }
        }))
      };
      this.contextMenu.style.display = "none";
    };

    document.getElementById("ctx-delete").onclick = () => {
      selectedIcons.forEach((i) => {
        i.remove();
      });
      this.contextMenu.style.display = "none";
    };

    document.getElementById("ctx-properties").onclick = () => {
      this.showPropertiesDialog(lastSelected);
      this.contextMenu.style.display = "none";
    };

    Object.assign(this.contextMenu.style, {
      left: `${e.pageX}px`,
      top: `${e.pageY}px`,
      display: "block"
    });
  }

  showPropertiesDialog(icon) {
    const winId = icon.id || `icon-${Date.now()}`;
    const dataset = icon.dataset;
    const rect = icon.getBoundingClientRect();
    const appId = dataset.app;

    const appInfo = this.appLauncher?.appMap?.[appId] || {};

    const infoLines = [
      `Name: ${dataset.name || "Unknown"}`,
      `Type: ${dataset.app || "Application"}`,
      dataset.path ? `Path: ${dataset.path}` : "",
      appInfo.type ? `App Type: ${appInfo.type}` : "",
      appInfo.swf ? `SWF Path: ${appInfo.swf}` : "",
      appInfo.url ? `URL: ${appInfo.url}` : "",
      dataset.core ? `Core: ${dataset.core}` : "",
      `Width: ${Math.round(rect.width)}px`,
      `Height: ${Math.round(rect.height)}px`,
      `Left: ${Math.round(rect.left)}px`,
      `Top: ${Math.round(rect.top)}px`,
      `Z-Index: ${icon.style.zIndex || "0"}`
    ].filter(Boolean);

    const contentHtml = infoLines.map((line) => `<div style="margin:2px 0;">${line}</div>`).join("");

    const propsWin = this.appLauncher.wm.createWindow(
      `${winId}-props`,
      `Properties: ${dataset.name || "Unknown"}`,
      "300px",
      "auto"
    );

    propsWin.innerHTML = `
        <div class="window-header">
            <span>Properties: ${dataset.name || "Unknown"}</span>
            <div class="window-controls">
                <button class="minimize-btn" title="Minimize">−</button>
                <button class="maximize-btn" title="Maximize">□</button>
                <button class="close-btn" title="Close">X</button>
            </div>
        </div>
        <div class="window-content" style="width:100%; height:100%; overflow:auto; user-select:text; padding:10px;">
            ${contentHtml}
        </div>
    `;

    desktop.appendChild(propsWin);
    this.appLauncher.wm.makeDraggable(propsWin);
    this.appLauncher.wm.makeResizable(propsWin);
    this.appLauncher.wm.setupWindowControls(propsWin);
  }

  showDesktopContextMenu(e) {
    const menuItems = [
      `<div id="ctx-new-notepad">New Notepad</div>`,
      `<div id="ctx-open-explorer">Open File Explorer</div>`
    ];

    if (this.clipboardCurrentCopied) {
      menuItems.push(`<div id="ctx-paste">Paste</div>`);
    }

    menuItems.push(`<hr>`, `<div id="ctx-refresh">Refresh</div>`);

    this.contextMenu.innerHTML = menuItems.join("");

    document.getElementById("ctx-new-notepad").onclick = () => {
      this.contextMenu.style.display = "none";
      notepadApp.open();
    };

    document.getElementById("ctx-open-explorer").onclick = () => {
      this.contextMenu.style.display = "none";
      explorerApp.open();
    };

    if (this.clipboardCurrentCopied) {
      document.getElementById("ctx-paste").onclick = () => {
        this.pasteIcons(e.pageX, e.pageY);
        this.contextMenu.style.display = "none";
      };
    }

    document.getElementById("ctx-refresh").onclick = () => {
      this.contextMenu.style.display = "none";
      location.reload();
    };

    Object.assign(this.contextMenu.style, {
      left: `${e.pageX}px`,
      top: `${e.pageY}px`,
      display: "block"
    });
  }

  pasteIcons(x, y) {
    if (!this.clipboardCurrentCopied) return;

    const { action, icons } = this.clipboardCurrentCopied;

    icons.forEach((iconData, index) => {
      const newIcon = document.createElement("div");
      newIcon.className = iconData.data.className;
      newIcon.innerHTML = iconData.data.innerHTML;
      newIcon.dataset.app = iconData.data.app;
      newIcon.dataset.name = iconData.data.name;
      newIcon.dataset.path = iconData.data.path;

      Object.assign(newIcon.style, {
        position: "absolute",
        left: `${x + index * 10}px`,
        top: `${y + index * 10}px`,
        userSelect: "none",
        webkitUserDrag: "none"
      });

      this.makeIconDraggable(newIcon);

      this.desktop.appendChild(newIcon);

      if (action === "cut" && iconData.element) {
        iconData.element.remove();
      }
    });

    if (action === "cut") {
      this.clipboardCurrentCopied = null;
    }
  }

  setupSelectionBox() {
    let startX, startY;
    this.desktop.addEventListener("mousedown", (e) => {
      if (e.target !== this.desktop) return;

      startX = e.pageX;
      startY = e.pageY;

      Object.assign(this.selectionBox.style, {
        left: `${startX}px`,
        top: `${startY}px`,
        width: "0px",
        height: "0px",
        display: "block"
      });

      const selectableIcons = document.querySelectorAll(".icon.selectable");
      selectableIcons.forEach((icon) => icon.classList.remove("selected"));

      const onMouseMove = (e) => {
        const width = Math.abs(e.pageX - startX);
        const height = Math.abs(e.pageY - startY);
        const left = Math.min(e.pageX, startX);
        const top = Math.min(e.pageY, startY);

        Object.assign(this.selectionBox.style, {
          width: `${width}px`,
          height: `${height}px`,
          left: `${left}px`,
          top: `${top}px`
        });

        const boxRect = this.selectionBox.getBoundingClientRect();
        selectableIcons.forEach((icon) => {
          const iconRect = icon.getBoundingClientRect();
          const isOverlapping = !(
            iconRect.right < boxRect.left ||
            iconRect.left > boxRect.right ||
            iconRect.bottom < boxRect.top ||
            iconRect.top > boxRect.bottom
          );

          if (isOverlapping) {
            icon.classList.add("selected");
          } else {
            icon.classList.remove("selected");
          }
        });
      };

      const onMouseUp = () => {
        this.selectionBox.style.display = "none";
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
  }

  setupStartMenu() {
    this.startMenu.querySelectorAll(".start-item").forEach((item) => {
      item.onclick = (e) => {
        e.stopPropagation();
        const app = item.dataset.app;
        if (app === "documents") {
          explorerApp.open();
          explorerApp.navigate(["home", "reeyuki", "Documents"]);
        } else if (app === "pictures") {
          explorerApp.open();
          explorerApp.navigate(["home", "reeyuki", "Pictures"]);
        } else if (app === "notes") {
          notepadApp.open();
        }

        this.startMenu.style.display = "none";
      };
    });
  }
}

class SystemUtilities {
  static startClock() {
    const updateClock = () => {
      const now = new Date();
      document.getElementById("clock").textContent = now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });
      document.getElementById("date").textContent = now.toLocaleDateString();
    };
    setInterval(updateClock, 1000);
    updateClock();
  }

  static setRandomWallpaper() {
    const pictures = defaultStorage.home.reeyuki.Pictures;

    const wallpapers = Object.values(pictures)
      .filter((item) => item.kind === "image")
      .map((item) => item.content);

    if (!wallpapers.length) return;

    const randomWallpaper = wallpapers[Math.floor(Math.random() * wallpapers.length)];

    let wallpaperDiv = document.getElementById("wallpaper");

    if (!wallpaperDiv) {
      wallpaperDiv = document.createElement("div");
      wallpaperDiv.id = "wallpaper";
      Object.assign(wallpaperDiv.style, {
        position: "fixed",
        top: "0",
        left: "0",
        width: "100vw",
        height: "100vh",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        zIndex: "-1",
        userSelect: "none",
        pointerEvents: "none"
      });
      document.body.appendChild(wallpaperDiv);
    }

    wallpaperDiv.style.backgroundImage = `url('${randomWallpaper}')`;

    wallpaperDiv.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    });
  }
}

const desktop = document.getElementById("desktop");

const fileSystemManager = new FileSystemManager();
const windowManager = new WindowManager();
const notepadApp = new NotepadApp(fileSystemManager, windowManager, null);
const explorerApp = new ExplorerApp(fileSystemManager, windowManager, notepadApp);
const browserApp = new BrowserApp(windowManager);
notepadApp.setExplorer(explorerApp);
const terminalApp = new TerminalApp(fileSystemManager, windowManager);
const musicPlayer = new MusicPlayer();
const cameraApp = new CameraApp(windowManager);
const appLauncher = new AppLauncher(
  windowManager,
  fileSystemManager,
  musicPlayer,
  explorerApp,
  terminalApp,
  notepadApp,
  browserApp,
  cameraApp
);
const desktopUI = new DesktopUI(appLauncher);

SystemUtilities.startClock();
SystemUtilities.setRandomWallpaper();

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);

const game = urlParams.get("game");
if (game) {
  setTimeout(() => {
    appLauncher.launch(game);
  }, 100);
}

const ICON_WIDTH = 80;
const ICON_HEIGHT = 100;
const GAP = 5;

const icons = desktop.querySelectorAll(".icon");

function layoutIcons() {
  const desktopHeight = desktop.clientHeight;
  const ICON_WIDTH = 80;
  const ICON_HEIGHT = 100;
  const GAP = 5;

  let x = GAP;
  let y = GAP;

  icons.forEach((icon) => {
    if (!icon.style.left || !icon.style.top) {
      icon.style.position = "absolute";
      icon.style.left = `${x}px`;
      icon.style.top = `${y}px`;

      y += ICON_HEIGHT + GAP;

      if (y + ICON_HEIGHT > desktopHeight) {
        y = GAP;
        x += ICON_WIDTH + GAP;
      }
    }
  });
}

window.addEventListener("load", layoutIcons);
window.addEventListener("resize", layoutIcons);

console.log(
  "Howdy, devtools user! the source of this site is available at: https://github.com/Reeyuki/reeyuki.github.io"
);
