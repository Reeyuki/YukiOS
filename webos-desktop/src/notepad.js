import { desktop } from "./desktop.js";
import { speak } from "./clippy.js";

export class NotepadApp {
  constructor(fileSystemManager, windowManager) {
    this.fs = fileSystemManager;
    this.wm = windowManager;
    this.idleTimer = null;
    this.idleDelay = 15000;
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
        ${this.wm.getWindowControls()}

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
    this.setupIdleDetection(win);
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
          this.saveAsFile(textarea, currentTitle);
        } else if (action === "open") {
          this.openFileDialog();
        }
      };
    });
  }

  setupIdleDetection(win) {
    const textarea = win.querySelector(".notepad-textarea");

    const resetIdleTimer = () => {
      if (this.idleTimer) {
        clearTimeout(this.idleTimer);
      }

      if (textarea.value.trim().length > 0) {
        this.idleTimer = setTimeout(() => {
          speak("Still there? I can check your spelling.", "Thinking");
        }, this.idleDelay);
      }
    };

    textarea.addEventListener("input", resetIdleTimer);
    textarea.addEventListener("keydown", resetIdleTimer);

    const observer = new MutationObserver(() => {
      if (!document.contains(win)) {
        if (this.idleTimer) {
          clearTimeout(this.idleTimer);
        }
        observer.disconnect();
      }
    });
    observer.observe(desktop, { childList: true });
  }

  saveFile(win, textarea, title, path) {
    if (!path) {
      this.saveAsFile(textarea, title);
      return;
    }
    const content = textarea.value;
    this.fs.updateFile(path, title, content);
    this.wm.showPopup(`File saved: ${title}`);
    speak("Great, your file has been saved!", "Save");
  }

  saveAsFile(textarea, currentTitle = "Untitled.txt") {
    const defaultName = currentTitle.includes(".") ? currentTitle : `${currentTitle}.txt`;
    this.explorerApp.openSaveDialog(defaultName, (path, fileName) => {
      const content = textarea.value;
      this.fs
        .createFile(path, fileName, content)
        .then(() => {
          const pathStr = path.length ? `/${path.join("/")}/${fileName}` : `/${fileName}`;
          this.wm.showPopup(`File saved: ${pathStr}`);
          speak("Great, your file has been saved!", "Save");
        })
        .catch((e) => {
          console.error(e);
          this.wm.showPopup("Error saving file.");
        });
    });
  }

  openFileDialog() {
    speak("Looking for something?", "Searching");
    this.explorerApp.open(async (path, fileName) => {
      const content = await this.fs.getFileContent(path, fileName);
      this.open(fileName, content, path);
    }, this);
  }

  loadContent(fileName, content, filePath) {
    const winId = `notepad-${fileName.replace(/\s/g, "")}`;
    const win = document.getElementById(winId);
    if (win) {
      const textarea = win.querySelector(".notepad-textarea");
      if (textarea) textarea.value = content;
      this.wm.bringToFront(win);
    } else {
      this.open(fileName, content, filePath);
    }
  }
}
