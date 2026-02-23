import { desktop } from "./desktop.js";

export class NotepadApp {
  constructor(fileSystemManager, windowManager) {
    this.fs = fileSystemManager;
    this.wm = windowManager;
  }
  setExplorer(explorerApp) {
    this.explorerApp = explorerApp;
  }

  open(title = "Untitled", content = "", filePath = null) {
    const winId = `notepad-${title.replace(/\s/g, "")}`;
    if (document.getElementById(winId)) {
      this.wm.bringToFront(document.getElementById(winId));
      return;
    }

    const win = this.wm.createWindow(winId, `${title} - Notepad`, "600px", "400px");
    Object.assign(win.style, { left: "250px", top: "150px" });

    win.innerHTML = `
      <div class="window-header">
        <span>${title} - Notepad</span>
        <div class="window-controls">
          <button class="minimize-btn" title="Minimize">−</button>
          <button class="maximize-btn" title="Maximize">□</button>
          <button class="close-btn" title="Close">X</button>
        </div>
      </div>
      <div class="notepad-menu">
        <button class="notepad-btn" data-action="save">Save</button>
        <button class="notepad-btn" data-action="saveAs">Save As</button>
        <button class="notepad-btn" data-action="open">Open</button>
      </div>
      <div class="window-content">
        <textarea class="notepad-textarea" style="width:100%; height:calc(100% - 40px); border:none; padding:10px; font-family:monospace;">${content}</textarea>
      </div>
    `;

    desktop.appendChild(win);
    this.wm.makeDraggable(win);
    this.wm.makeResizable(win);
    this.wm.setupWindowControls(win);
    this.wm.addToTaskbar(win.id, `${title} - Notepad`, "/static/icons/notepad.webp");

    this.setupNotepadControls(win, title, filePath);
  }

  setupNotepadControls(win, currentTitle, currentPath) {
    const textarea = win.querySelector(".notepad-textarea");
    const buttons = win.querySelectorAll(".notepad-btn");

    buttons.forEach((btn) => {
      btn.onclick = () => {
        const action = btn.dataset.action;

        if (action === "save") {
          this.saveFile(win, textarea, currentTitle, currentPath);
        } else if (action === "saveAs") {
          this.saveAsFile(textarea);
        } else if (action === "open") {
          this.openFileDialog();
        }
      };
    });
  }

  saveFile(win, textarea, title, path) {
    if (!path) {
      this.saveAsFile(textarea);
      return;
    }

    const content = textarea.value;
    this.fs.updateFile(path, title, content);
    this.wm.showPopup(`File saved: ${title}`);
  }

  saveAsFile(textarea) {
    const fileName = prompt("Enter file name:", "NewFile.txt");
    if (!fileName) return;

    const pathString = prompt("Enter path (e.g., home/reeyuki/Documents):", "home/reeyuki/Documents");
    if (!pathString) return;

    const path = pathString.split("/").filter((p) => p);
    const content = textarea.value;

    try {
      this.fs.createFile(path, fileName, content);
      this.wm.showPopup(`File saved: ${fileName} at /${pathString}`);
    } catch (e) {
      console.error(e);
      this.wm.showPopup("Error saving file. Please check the path.");
    }
  }

  openFileDialog() {
    this.explorerApp.open(async (path, fileName) => {
      const content = await this.fs.getFileContent(path, fileName);
      this.open(fileName, content, path);
    });
  }
}
