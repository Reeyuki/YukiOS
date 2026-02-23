import { desktop } from "./desktop.js";
import { FileKind } from "./fs.js";
import { SystemUtilities } from "./system.js";
import { appMetadata } from "./app.js";
import { camelize } from "./utils.js";
import { layoutIcons } from "./desktopui.js";
import { GamesPageRenderer } from "./games.js";

const contextMenu = document.getElementById("context-menu");

export class ExplorerApp {
  constructor(fileSystemManager, windowManager, notepadApp) {
    this.fs = fileSystemManager;
    this.wm = windowManager;
    this.notepadApp = notepadApp;
    this.currentPath = [];
    this.history = [];
    this.historyIndex = -1;
    this.lastWin = null;
    this.desktopUI = null;
    this.fileSelectCallback = null;
    this.open = this.open.bind(this);
  }

  async open(callback = null) {
    this.fileSelectCallback = callback;

    if (document.getElementById("explorer-win")) {
      this.wm.bringToFront(document.getElementById("explorer-win"));
      return;
    }

    const win = document.createElement("div");
    win.className = "window";
    win.id = "explorer-win";
    win.dataset.fullscreen = "false";
    this.lastWin = win;
    win.innerHTML = `
      <div class="window-header">
        <span>File Explorer</span>
        ${this.wm.getWindowControls()}
      </div>
      <div class="explorer-nav">
        <div class="back-btn" id="exp-back">← Back</div>
        <div id="exp-path" style="color:#555"></div>
      </div>
      <div class="explorer-container">
        <div class="explorer-sidebar">
          <div class="start-item" data-path="">Home</div>
          <div class="start-item" data-path="Games">Games</div>
          <div class="start-item" data-path="Documents">Documents</div>
          <div class="start-item" data-path="Pictures">Pictures</div>
          <div class="start-item" data-path="Music">Music</div>
        </div>
        <div class="explorer-main" id="explorer-view"></div>
      </div>
    `;

    desktop.appendChild(win);
    const explorerView = win.querySelector("#explorer-view");
    explorerView.style.width = "600px";
    explorerView.style.height = "400px";

    this.wm.makeDraggable(win);
    this.wm.makeResizable(win);
    this.wm.setupWindowControls(win);

    setTimeout(() => this.wm.bringToFront(win), 0);
    this.wm.addToTaskbar(win.id, "File Explorer", "/static/icons/files.webp");

    this.setupExplorerControls(win);
    this.navigate([]);
  }

  async openFlash() {
    await this.open();
    setTimeout(() => {
      this.navigate(["Games"]);
      if (this.lastWin) {
        const games = this.lastWin.querySelectorAll(".icon");
        layoutIcons(games, true);
      }
    }, 1);
  }

  setupExplorerControls(win) {
    win.querySelector("#exp-back").onclick = async () => {
      if (this.historyIndex > 0) {
        this.historyIndex--;
        this.currentPath = [...this.history[this.historyIndex]];
        await this.render();
      }
    };

    win.querySelectorAll(".explorer-sidebar .start-item").forEach((item) => {
      item.onclick = async () => {
        const path = item.dataset.path.split("/").filter((p) => p);
        this.navigate(path);
      };
    });

    const explorerView = win.querySelector("#explorer-view");
    explorerView.addEventListener("contextmenu", (e) => {
      if (e.target === explorerView) this.showBackgroundContextMenu(e);
    });
  }

  navigate(path) {
    this.currentPath = [...path];
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push([...this.currentPath]);
    this.historyIndex = this.history.length - 1;
    return this.render();
  }

  async renderMusicPage(element) {
    if (!element) return;
    element.innerHTML = `
      <div style="display: flex; gap: 20px; flex-wrap: wrap;">
        <iframe src="https://open.spotify.com/embed/playlist/6oK6F4LglYBr4mYLSRDJOa" width="300" height="380" frameborder="0" allowtransparency="true" allow="encrypted-media"></iframe>
        <iframe src="https://open.spotify.com/embed/playlist/1q7zv2ScwtR2jIxaIRj9iG" width="300" height="380" frameborder="0" allowtransparency="true" allow="encrypted-media"></iframe>
        <iframe src="https://open.spotify.com/embed/playlist/6q8mgrJZ5L4YxabVQoAZZf" width="300" height="380" frameborder="0" allowtransparency="true" allow="encrypted-media"></iframe>
      </div>
    `;
  }

  async renderGamesPage(view) {
    view.classList.add("games-page");
    const renderer = new GamesPageRenderer();
    await renderer.renderGamesPage(view);
    setTimeout(() => {
      if (this.lastWin) {
        const games = this.lastWin.querySelectorAll(".icon");
        layoutIcons(games, true);
        games.forEach((g) => {
          this.makeExplorerIconInteractable(g);
        });

        this.lastWin.style.width = "100vw";
        this.lastWin.style.height = "90vh";
        this.lastWin.style.left = "0px";
        this.lastWin.style.top = "5vh";
        const explorerView = this.lastWin.querySelector("#explorer-view");
        if (explorerView) {
          explorerView.style.height = "";
        }
      }
    }, 0);
  }

  async render() {
    const view = document.getElementById("explorer-view");
    const pathDisplay = document.getElementById("exp-path");
    if (!view) return;

    view.innerHTML = "";
    view.classList.remove("games-page");
    pathDisplay.textContent = "/" + this.currentPath.join("/");

    if (this.currentPath[this.currentPath.length - 1] === "Music") {
      await this.renderMusicPage(view);
      return;
    }

    if (this.currentPath[this.currentPath.length - 1] === "Games") {
      await this.renderGamesPage(view);
      setTimeout(() => {
        if (this.lastWin) {
          const games = this.lastWin.querySelectorAll(".icon");
          layoutIcons(games, true);
        }
      }, 1);
      return;
    }

    const folder = await this.fs.getFolder(this.currentPath);

    for (const [name, itemData] of Object.entries(folder)) {
      const isFile = itemData?.type === "file";
      let iconImg;

      if (isFile) {
        if (itemData.kind === FileKind.IMAGE) {
          iconImg = itemData.icon || itemData.content;
        } else {
          const baseName = name.split(".")[0];
          const camelName = camelize(baseName);
          iconImg = appMetadata[camelName]?.icon || itemData.icon || "/static/icons/notepad.webp";
        }
      } else {
        iconImg = "/static/icons/files.webp";
      }

      const item = document.createElement("div");
      item.className = "file-item";
      item.innerHTML = `
        <img src="${iconImg}" style="width:64px;height:64px;object-fit:cover;border-radius:8px">
        <span>${name}</span>
      `;

      item.ondblclick = async () => this.openItem(name, isFile);
      item.oncontextmenu = async (e) => this.showFileContextMenu(e, name, isFile);

      view.appendChild(item);
    }
  }

  async openItem(name, isFile) {
    if (!isFile) {
      this.navigate([...this.currentPath, name]);
      return;
    }

    if (this.fileSelectCallback) {
      this.fileSelectCallback(this.currentPath, name);
      this.fileSelectCallback = null;
      return;
    }

    if (name.endsWith(".desktop") && window.appLauncher) {
      const contentStr = await this.fs.getFileContent(this.currentPath, name);
      let content;
      try {
        content = JSON.parse(contentStr);
      } catch (e) {
        console.error("Failed to parse desktop file JSON:", e);
        return;
      }
      if (content.app) {
        window.appLauncher.launch(content.app);
      }
      return;
    }

    const content = await this.fs.getFileContent(this.currentPath, name);
    const kind = await this.fs.getFileKind(this.currentPath, name);

    if (kind === FileKind.IMAGE || kind === FileKind.VIDEO) {
      this.openMediaViewer(name, content, kind);
      return;
    }

    this.notepadApp.open(name, content, this.currentPath);
  }

  openMediaViewer(name, src, kind) {
    const win = document.createElement("div");
    win.className = "window";
    Object.assign(win.style, { width: "500px", height: "400px", left: "150px", top: "150px", zIndex: 2000 });

    const media =
      kind === FileKind.VIDEO
        ? `<video src="${src}" controls autoplay loop style="max-width:100%;max-height:100%"></video>`
        : `<img src="${src}" style="max-width:100%;max-height:100%">`;

    win.innerHTML = `
      <div class="window-header">
        <span>${name}</span>
        ${this.wm.getWindowControls()}
      </div>
      <div style="display:flex;justify-content:center;align-items:center;height:calc(100% - 30px);background:#222">
        ${media}
      </div>
    `;

    desktop.appendChild(win);
    this.wm.makeDraggable(win);
    this.wm.makeResizable(win);
    this.wm.setupWindowControls(win);
    this.wm.addToTaskbar(win.id, name, "/static/icons/files.webp");
  }

  async showFileContextMenu(e, itemName, isFile) {
    e.preventDefault();
    e.stopPropagation();
    contextMenu.innerHTML = "";

    const createMenuItem = (text, onclick) => {
      const item = document.createElement("div");
      item.textContent = text;
      item.onclick = () => onclick();
      return item;
    };

    const openText = isFile ? "Open" : "Open Folder";
    const openAction = async () => {
      contextMenu.style.display = "none";
      await this.openItem(itemName, isFile);
    };
    contextMenu.appendChild(createMenuItem(openText, openAction));

    contextMenu.appendChild(document.createElement("hr"));

    contextMenu.appendChild(
      createMenuItem("Delete", async () => {
        contextMenu.style.display = "none";
        const confirmMsg = isFile
          ? `Are you sure you want to delete "${itemName}"?`
          : `Are you sure you want to delete the folder "${itemName}" and all its contents?`;
        if (confirm(confirmMsg)) {
          await this.fs.deleteItem(this.currentPath, itemName);
          await this.render();
        }
      })
    );

    contextMenu.appendChild(
      createMenuItem("Rename", async () => {
        contextMenu.style.display = "none";
        const newName = prompt("Enter new name:", itemName);
        if (newName && newName !== itemName) {
          await this.fs.renameItem(this.currentPath, itemName, newName);
          await this.render();
        }
      })
    );

    if (isFile) {
      const kind = await this.fs.getFileKind(this.currentPath, itemName);
      const content = await this.fs.getFileContent(this.currentPath, itemName);

      if (kind === FileKind.IMAGE || kind === FileKind.VIDEO) {
        contextMenu.appendChild(
          createMenuItem("Set Wallpaper", () => {
            contextMenu.style.display = "none";
            SystemUtilities.setWallpaper(content);
          })
        );
      }
    }

    contextMenu.appendChild(
      createMenuItem("Properties", () => {
        contextMenu.style.display = "none";
        this.wm.showPopup(`Name: ${itemName}\nType: ${isFile ? "File" : "Folder"}`);
      })
    );

    Object.assign(contextMenu.style, {
      left: `${e.pageX}px`,
      top: `${e.pageY}px`,
      display: "block"
    });
  }

  showBackgroundContextMenu(e) {
    e.preventDefault();
    e.stopPropagation();
    contextMenu.innerHTML = `
      <div id="ctx-new-file">New File</div>
      <div id="ctx-new-folder">New Folder</div>
      <hr>
      <div id="ctx-refresh">Refresh</div>
    `;

    const bindAction = (id, action) => {
      document.getElementById(id).onclick = async () => {
        contextMenu.style.display = "none";
        await action();
      };
    };

    bindAction("ctx-new-file", async () => {
      const fileName = prompt("Enter file name:", "NewFile.txt");
      if (fileName) {
        await this.fs.createFile(this.currentPath, fileName);
        await this.render();
      }
    });

    bindAction("ctx-new-folder", async () => {
      const folderName = prompt("Enter folder name:", "NewFolder");
      if (folderName) {
        await this.fs.createFolder(this.currentPath, folderName);
        await this.render();
      }
    });

    bindAction("ctx-refresh", async () => await this.render());

    Object.assign(contextMenu.style, {
      left: `${e.pageX}px`,
      top: `${e.pageY}px`,
      display: "block"
    });
  }

  setDesktopUI(desktopUI) {
    this.desktopUI = desktopUI;
  }

  makeExplorerIconInteractable(icon) {
    this.desktopUI.makeIconInteractable(icon, true);
  }
}
