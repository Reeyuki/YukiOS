import { desktop } from "./desktop.js";
import { speak } from "./clippy.js";

export class NotepadApp {
  constructor(fileSystemManager, windowManager) {
    this.fs = fileSystemManager;
    this.wm = windowManager;
    this.idleTimer = null;
    this.idleDelay = 15000;
    this.instances = new Map();
  }

  setExplorer(explorerApp) {
    this.explorerApp = explorerApp;
  }

  open(title = "Untitled", content = "", filePath = null) {
    const winId = `notepad-${Date.now()}`;
    const win = this.wm.createWindow(winId, `${title} - Notepad`, "650px", "450px");
    win.classList.add("notepad-window");

    Object.assign(win.style, { left: "250px", top: "150px" });

    const instance = {
      currentTitle: title,
      currentPath: filePath,
      wordWrap: true,
      zoom: 100,
      baseFontSize: 14,
      statusBarVisible: true,
      modified: false,
      findText: "",
      matchCase: false
    };

    this.instances.set(winId, instance);

    win.innerHTML = `
      <div class="window-header">
        <span class="window-title-text">${title} - Notepad</span>
        ${this.wm.getWindowControls()}
      </div>
      <div class="notepad-menubar">
        <div class="notepad-menu-item" data-menu="file">
          <span>File</span>
          <div class="notepad-dropdown">
            <div class="dropdown-item" data-action="new">New</div>
            <div class="dropdown-item" data-action="open">Open...<span class="shortcut">Ctrl+O</span></div>
            <div class="dropdown-item" data-action="save">Save<span class="shortcut">Ctrl+S</span></div>
            <div class="dropdown-item" data-action="saveAs">Save As...<span class="shortcut">Ctrl+Shift+S</span></div>
            <div class="dropdown-separator"></div>
            <div class="dropdown-item" data-action="exit">Exit</div>
          </div>
        </div>
        <div class="notepad-menu-item" data-menu="edit">
          <span>Edit</span>
          <div class="notepad-dropdown">
            <div class="dropdown-item" data-action="find">Find...<span class="shortcut">Ctrl+F</span></div>
            <div class="dropdown-item" data-action="findNext">Find Next<span class="shortcut">F3</span></div>
            <div class="dropdown-item" data-action="findPrev">Find Previous<span class="shortcut">Shift+F3</span></div>
            <div class="dropdown-item" data-action="replace">Replace...<span class="shortcut">Ctrl+H</span></div>
            <div class="dropdown-item" data-action="goTo">Go To...<span class="shortcut">Ctrl+G</span></div>
          </div>
        </div>
        <div class="notepad-menu-item" data-menu="format">
          <span>Format</span>
          <div class="notepad-dropdown">
            <div class="dropdown-item" data-action="wordWrap"><span class="checkmark" style="visibility:visible">✓</span>Word Wrap</div>
            <div class="dropdown-item" data-action="font">Font...</div>
          </div>
        </div>
        <div class="notepad-menu-item" data-menu="view">
          <span>View</span>
          <div class="notepad-dropdown">
            <div class="dropdown-submenu">
              <div class="dropdown-item submenu-trigger">Zoom<span class="arrow">▶</span></div>
              <div class="submenu">
                <div class="dropdown-item" data-action="zoomIn">Zoom In<span class="shortcut">Ctrl++</span></div>
                <div class="dropdown-item" data-action="zoomOut">Zoom Out<span class="shortcut">Ctrl+-</span></div>
                <div class="dropdown-item" data-action="zoomReset">Restore Default<span class="shortcut">Ctrl+0</span></div>
              </div>
            </div>
            <div class="dropdown-separator"></div>
            <div class="dropdown-item" data-action="statusBar"><span class="checkmark" style="visibility:visible">✓</span>Status Bar</div>
          </div>
        </div>
        <div class="notepad-menu-item" data-menu="help">
          <span>Help</span>
          <div class="notepad-dropdown">
            <div class="dropdown-item" data-action="about">About Notepad</div>
          </div>
        </div>
      </div>
      <div class="window-content notepad-content">
        <textarea class="notepad-textarea">${this.escapeHtml(content)}</textarea>
        <div class="notepad-statusbar">
          <span class="status-position">Ln 1, Col 1</span>
          <span class="status-zoom">100%</span>
        </div>
      </div>
    `;

    desktop.appendChild(win);
    this.wm.makeDraggable(win);
    this.wm.makeResizable(win);
    this.wm.setupWindowControls(win);
    this.wm.addToTaskbar(win.id, `${title} - Notepad`, "/static/icons/notepad.webp");

    this.setupMenus(win, winId);
    this.setupTextarea(win, winId);
    this.setupKeyboardShortcuts(win, winId);
    this.setupIdleDetection(win);
    this.setupCleanup(win, winId);

    const textarea = win.querySelector(".notepad-textarea");
    textarea.style.whiteSpace = "pre-wrap";
    textarea.style.overflowX = "hidden";
    textarea.style.fontSize = instance.baseFontSize + "px";

    this.updateStatusBar(win, winId);
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  setupMenus(win, winId) {
    const menuItems = win.querySelectorAll(".notepad-menu-item");
    let activeMenu = null;

    const closeAllMenus = () => {
      menuItems.forEach((m) => m.classList.remove("active"));
      activeMenu = null;
    };

    menuItems.forEach((menuItem) => {
      menuItem.addEventListener("click", (e) => {
        e.stopPropagation();
        if (menuItem.classList.contains("active")) {
          closeAllMenus();
        } else {
          closeAllMenus();
          menuItem.classList.add("active");
          activeMenu = menuItem;
        }
      });

      menuItem.addEventListener("mouseenter", () => {
        if (activeMenu && activeMenu !== menuItem) {
          closeAllMenus();
          menuItem.classList.add("active");
          activeMenu = menuItem;
        }
      });
    });

    win.querySelectorAll(".dropdown-item[data-action]").forEach((item) => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const action = item.dataset.action;
        this.handleAction(win, winId, action);
        closeAllMenus();
      });
    });

    const closeHandler = (e) => {
      if (!win.contains(e.target)) {
        closeAllMenus();
      }
    };
    document.addEventListener("click", closeHandler);

    win.addEventListener("remove", () => {
      document.removeEventListener("click", closeHandler);
    });
  }

  updateStatusBar(win, winId) {
    const textarea = win.querySelector(".notepad-textarea");
    const statusPosition = win.querySelector(".status-position");
    const statusZoom = win.querySelector(".status-zoom");
    const instance = this.instances.get(winId);

    if (!textarea || !statusPosition || !instance) return;

    const text = textarea.value.substring(0, textarea.selectionStart);
    const lines = text.split("\n");
    const line = lines.length;
    const col = lines[lines.length - 1].length + 1;

    statusPosition.textContent = `Ln ${line}, Col ${col}`;

    if (statusZoom) {
      statusZoom.textContent = `${instance.zoom}%`;
    }
  }

  setupTextarea(win, winId) {
    const textarea = win.querySelector(".notepad-textarea");
    const instance = this.instances.get(winId);

    textarea.addEventListener("input", () => {
      instance.modified = true;
      this.updateTitle(win, winId);
      this.updateStatusBar(win, winId);
    });

    textarea.addEventListener("click", () => this.updateStatusBar(win, winId));
    textarea.addEventListener("keyup", () => this.updateStatusBar(win, winId));
    textarea.addEventListener("keydown", () => {
      setTimeout(() => this.updateStatusBar(win, winId), 0);
    });
    textarea.addEventListener("focus", () => this.updateStatusBar(win, winId));
    textarea.addEventListener("select", () => this.updateStatusBar(win, winId));
    textarea.addEventListener("mouseup", () => this.updateStatusBar(win, winId));
  }

  updateTitle(win, winId) {
    const instance = this.instances.get(winId);
    const headerSpan = win.querySelector(".window-header > span");
    const prefix = instance.modified ? "*" : "";
    const newTitle = `${prefix}${instance.currentTitle} - Notepad`;

    if (!headerSpan) return;

    const iconEl = headerSpan.querySelector("img, i");

    if (iconEl) {
      const childNodes = Array.from(headerSpan.childNodes);
      childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          node.remove();
        }
      });

      const existingTitleSpan = headerSpan.querySelector(".title-text");
      if (existingTitleSpan) {
        existingTitleSpan.remove();
      }

      headerSpan.appendChild(document.createTextNode(newTitle));
    } else {
      headerSpan.textContent = newTitle;
    }
  }

  setupKeyboardShortcuts(win, winId) {
    win.addEventListener("keydown", (e) => {
      if (e.ctrlKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case "o":
            e.preventDefault();
            this.handleAction(win, winId, "open");
            break;
          case "s":
            e.preventDefault();
            if (e.shiftKey) {
              this.handleAction(win, winId, "saveAs");
            } else {
              this.handleAction(win, winId, "save");
            }
            break;
          case "f":
            e.preventDefault();
            this.handleAction(win, winId, "find");
            break;
          case "h":
            e.preventDefault();
            this.handleAction(win, winId, "replace");
            break;
          case "g":
            e.preventDefault();
            this.handleAction(win, winId, "goTo");
            break;
          case "=":
          case "+":
            e.preventDefault();
            this.handleAction(win, winId, "zoomIn");
            break;
          case "-":
            e.preventDefault();
            this.handleAction(win, winId, "zoomOut");
            break;
          case "0":
            e.preventDefault();
            this.handleAction(win, winId, "zoomReset");
            break;
        }
      } else if (e.key === "F3") {
        e.preventDefault();
        if (e.shiftKey) {
          this.handleAction(win, winId, "findPrev");
        } else {
          this.handleAction(win, winId, "findNext");
        }
      } else if (e.key === "Escape") {
        this.closeDialogs(win);
      }
    });
  }

  handleAction(win, winId, action) {
    const actions = {
      new: () => this.newFile(win, winId),
      open: () => this.openFileDialog(win, winId),
      save: () => this.saveFile(win, winId),
      saveAs: () => this.saveAsFile(win, winId),
      exit: () => this.closeWindow(win, winId),
      find: () => this.showFindDialog(win, winId),
      findNext: () => this.findNext(win, winId),
      findPrev: () => this.findPrev(win, winId),
      replace: () => this.showReplaceDialog(win, winId),
      goTo: () => this.showGoToDialog(win, winId),
      wordWrap: () => this.toggleWordWrap(win, winId),
      font: () => this.showFontDialog(win, winId),
      zoomIn: () => this.zoom(win, winId, 10),
      zoomOut: () => this.zoom(win, winId, -10),
      zoomReset: () => this.zoomReset(win, winId),
      statusBar: () => this.toggleStatusBar(win, winId),
      about: () => this.showAboutDialog(win)
    };

    if (actions[action]) {
      actions[action]();
    }
  }

  newFile(win, winId) {
    const instance = this.instances.get(winId);
    const textarea = win.querySelector(".notepad-textarea");

    if (instance.modified) {
      this.showSaveConfirmDialog(win, winId, () => {
        this.resetEditor(win, winId, textarea);
      });
      return;
    }

    this.resetEditor(win, winId, textarea);
  }

  resetEditor(win, winId, textarea) {
    const instance = this.instances.get(winId);
    textarea.value = "";
    instance.currentTitle = "Untitled";
    instance.currentPath = null;
    instance.modified = false;
    this.updateTitle(win, winId);
    this.updateStatusBar(win, winId);
  }

  showSaveConfirmDialog(win, winId, onDiscard) {
    this.closeDialogs(win);
    const instance = this.instances.get(winId);

    const dialog = document.createElement("div");
    dialog.className = "notepad-dialog";
    dialog.innerHTML = `
      <h3>Do you want to save changes to ${instance.currentTitle}?</h3>
      <div class="notepad-dialog-buttons">
        <button class="save-btn primary">Save</button>
        <button class="dont-save-btn">Don't Save</button>
        <button class="cancel-btn">Cancel</button>
      </div>
    `;

    Object.assign(dialog.style, {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)"
    });

    win.querySelector(".notepad-content").appendChild(dialog);

    dialog.querySelector(".save-btn").onclick = () => {
      dialog.remove();
      this.saveFile(win, winId);
    };

    dialog.querySelector(".dont-save-btn").onclick = () => {
      dialog.remove();
      onDiscard();
    };

    dialog.querySelector(".cancel-btn").onclick = () => dialog.remove();
  }

  saveFile(win, winId) {
    const instance = this.instances.get(winId);
    const textarea = win.querySelector(".notepad-textarea");

    if (!instance.currentPath) {
      this.saveAsFile(win, winId);
      return;
    }

    const content = textarea.value;
    this.fs.updateFile(instance.currentPath, instance.currentTitle, content);
    instance.modified = false;
    this.updateTitle(win, winId);
    this.wm.showPopup(`File saved: ${instance.currentTitle}`);
    speak("Great, your file has been saved!", "Save");
  }

  saveAsFile(win, winId) {
    const instance = this.instances.get(winId);
    const textarea = win.querySelector(".notepad-textarea");
    const defaultName = instance.currentTitle.includes(".") ? instance.currentTitle : `${instance.currentTitle}.txt`;

    this.explorerApp.openSaveDialog(defaultName, (path, fileName) => {
      const content = textarea.value;
      this.fs
        .createFile(path, fileName, content)
        .then(() => {
          instance.currentPath = path;
          instance.currentTitle = fileName;
          instance.modified = false;
          this.updateTitle(win, winId);
          const pathStr = path.length ? `/${path.join("/")}/${fileName}` : `/${fileName}`;
          this.wm.showPopup(`File saved: ${pathStr}`);
          speak("Great, your file has been saved!", "Save");
        })
        .catch(() => {
          this.wm.showPopup("Error saving file.");
        });
    });
  }

  openFileDialog(win, winId) {
    speak("Looking for something?", "Searching");
    this.explorerApp.open(async (path, fileName) => {
      const content = await this.fs.getFileContent(path, fileName);
      const instance = this.instances.get(winId);
      const textarea = win.querySelector(".notepad-textarea");

      textarea.value = content;
      instance.currentTitle = fileName;
      instance.currentPath = path;
      instance.modified = false;
      this.updateTitle(win, winId);
      this.updateStatusBar(win, winId);
    }, this);
  }

  closeWindow(win, winId) {
    const instance = this.instances.get(winId);

    if (instance.modified) {
      this.showSaveConfirmDialog(win, winId, () => {
        win.querySelector(".close-btn")?.click();
      });
      return;
    }

    win.querySelector(".close-btn")?.click();
  }

  showFindDialog(win, winId) {
    this.closeDialogs(win);
    const instance = this.instances.get(winId);

    const dialog = document.createElement("div");
    dialog.className = "notepad-dialog";
    dialog.innerHTML = `
      <h3>Find</h3>
      <div class="notepad-dialog-row">
        <label>Find what:</label>
        <input type="text" class="find-input" value="${instance.findText || ""}" />
      </div>
      <div class="notepad-dialog-row">
        <label class="notepad-dialog-checkbox">
          <input type="checkbox" class="match-case" ${instance.matchCase ? "checked" : ""} />
          Match case
        </label>
      </div>
      <div class="notepad-dialog-buttons">
        <button class="find-next-btn primary">Find Next</button>
        <button class="find-prev-btn">Find Previous</button>
        <button class="cancel-btn">Cancel</button>
      </div>
    `;

    Object.assign(dialog.style, { top: "60px", right: "30px" });
    win.querySelector(".notepad-content").appendChild(dialog);

    const input = dialog.querySelector(".find-input");
    const matchCase = dialog.querySelector(".match-case");

    dialog.querySelector(".find-next-btn").onclick = () => {
      instance.findText = input.value;
      instance.matchCase = matchCase.checked;
      this.findNext(win, winId);
    };

    dialog.querySelector(".find-prev-btn").onclick = () => {
      instance.findText = input.value;
      instance.matchCase = matchCase.checked;
      this.findPrev(win, winId);
    };

    dialog.querySelector(".cancel-btn").onclick = () => dialog.remove();

    input.focus();
    input.select();

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        instance.findText = input.value;
        instance.matchCase = matchCase.checked;
        this.findNext(win, winId);
      }
    });
  }

  findNext(win, winId) {
    const instance = this.instances.get(winId);
    if (!instance.findText) {
      this.showFindDialog(win, winId);
      return;
    }

    const textarea = win.querySelector(".notepad-textarea");
    const text = textarea.value;
    const searchText = instance.findText;

    const searchIn = instance.matchCase ? text : text.toLowerCase();
    const searchFor = instance.matchCase ? searchText : searchText.toLowerCase();

    const startPos = textarea.selectionEnd;
    let index = searchIn.indexOf(searchFor, startPos);

    if (index === -1 && startPos > 0) {
      index = searchIn.indexOf(searchFor, 0);
    }

    if (index !== -1) {
      textarea.focus();
      textarea.setSelectionRange(index, index + searchText.length);
      this.updateStatusBar(win, winId);
    } else {
      this.wm.showPopup(`Cannot find "${searchText}"`);
    }
  }

  findPrev(win, winId) {
    const instance = this.instances.get(winId);
    if (!instance.findText) {
      this.showFindDialog(win, winId);
      return;
    }

    const textarea = win.querySelector(".notepad-textarea");
    const text = textarea.value;
    const searchText = instance.findText;

    const searchIn = instance.matchCase ? text : text.toLowerCase();
    const searchFor = instance.matchCase ? searchText : searchText.toLowerCase();

    const startPos = textarea.selectionStart - 1;
    let index = searchIn.lastIndexOf(searchFor, startPos);

    if (index === -1 && startPos < text.length) {
      index = searchIn.lastIndexOf(searchFor);
    }

    if (index !== -1) {
      textarea.focus();
      textarea.setSelectionRange(index, index + searchText.length);
      this.updateStatusBar(win, winId);
    } else {
      this.wm.showPopup(`Cannot find "${searchText}"`);
    }
  }

  showReplaceDialog(win, winId) {
    this.closeDialogs(win);
    const instance = this.instances.get(winId);

    const dialog = document.createElement("div");
    dialog.className = "notepad-dialog";
    dialog.innerHTML = `
      <h3>Replace</h3>
      <div class="notepad-dialog-row">
        <label>Find what:</label>
        <input type="text" class="find-input" value="${instance.findText || ""}" />
      </div>
      <div class="notepad-dialog-row">
        <label>Replace with:</label>
        <input type="text" class="replace-input" />
      </div>
      <div class="notepad-dialog-row">
        <label class="notepad-dialog-checkbox">
          <input type="checkbox" class="match-case" ${instance.matchCase ? "checked" : ""} />
          Match case
        </label>
      </div>
      <div class="notepad-dialog-buttons">
        <button class="find-next-btn">Find Next</button>
        <button class="replace-btn">Replace</button>
        <button class="replace-all-btn primary">Replace All</button>
        <button class="cancel-btn">Cancel</button>
      </div>
    `;

    Object.assign(dialog.style, { top: "60px", right: "30px" });
    win.querySelector(".notepad-content").appendChild(dialog);

    const findInput = dialog.querySelector(".find-input");
    const replaceInput = dialog.querySelector(".replace-input");
    const matchCase = dialog.querySelector(".match-case");
    const textarea = win.querySelector(".notepad-textarea");

    dialog.querySelector(".find-next-btn").onclick = () => {
      instance.findText = findInput.value;
      instance.matchCase = matchCase.checked;
      this.findNext(win, winId);
    };

    dialog.querySelector(".replace-btn").onclick = () => {
      const selected = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
      const findText = findInput.value;
      const replaceText = replaceInput.value;
      const compareSelected = matchCase.checked ? selected : selected.toLowerCase();
      const compareFindText = matchCase.checked ? findText : findText.toLowerCase();

      if (compareSelected === compareFindText) {
        const start = textarea.selectionStart;
        textarea.value =
          textarea.value.substring(0, start) + replaceText + textarea.value.substring(textarea.selectionEnd);
        textarea.selectionStart = textarea.selectionEnd = start + replaceText.length;
        instance.modified = true;
        this.updateTitle(win, winId);
        this.updateStatusBar(win, winId);
      }

      instance.findText = findText;
      instance.matchCase = matchCase.checked;
      this.findNext(win, winId);
    };

    dialog.querySelector(".replace-all-btn").onclick = () => {
      const findText = findInput.value;
      const replaceText = replaceInput.value;

      if (!findText) return;

      let newText;
      if (matchCase.checked) {
        newText = textarea.value.split(findText).join(replaceText);
      } else {
        const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
        newText = textarea.value.replace(regex, replaceText);
      }

      const count = (textarea.value.length - newText.length) / (findText.length - replaceText.length) || 0;
      textarea.value = newText;
      instance.modified = true;
      this.updateTitle(win, winId);
      this.updateStatusBar(win, winId);
      this.wm.showPopup(`Replaced ${Math.abs(Math.round(count))} occurrence(s)`);
    };

    dialog.querySelector(".cancel-btn").onclick = () => dialog.remove();
    findInput.focus();
    findInput.select();
  }

  showGoToDialog(win, winId) {
    this.closeDialogs(win);
    const textarea = win.querySelector(".notepad-textarea");
    const lines = textarea.value.substring(0, textarea.selectionStart).split("\n");
    const currentLine = lines.length;

    const dialog = document.createElement("div");
    dialog.className = "notepad-dialog";
    dialog.innerHTML = `
      <h3>Go To Line</h3>
      <div class="notepad-dialog-row">
        <label>Line number:</label>
        <input type="number" class="line-input" min="1" value="${currentLine}" />
      </div>
      <div class="notepad-dialog-buttons">
        <button class="goto-btn primary">Go To</button>
        <button class="cancel-btn">Cancel</button>
      </div>
    `;

    Object.assign(dialog.style, { top: "60px", right: "30px" });
    win.querySelector(".notepad-content").appendChild(dialog);

    const input = dialog.querySelector(".line-input");

    const goToLine = () => {
      const lineNum = parseInt(input.value);
      const allLines = textarea.value.split("\n");
      const totalLines = allLines.length;

      if (lineNum < 1 || lineNum > totalLines) {
        this.wm.showPopup(`Line number must be between 1 and ${totalLines}`);
        return;
      }

      let pos = 0;
      for (let i = 0; i < lineNum - 1; i++) {
        pos += allLines[i].length + 1;
      }

      textarea.focus();
      textarea.setSelectionRange(pos, pos);
      this.updateStatusBar(win, winId);
      dialog.remove();
    };

    dialog.querySelector(".goto-btn").onclick = goToLine;
    dialog.querySelector(".cancel-btn").onclick = () => dialog.remove();

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") goToLine();
    });

    input.focus();
    input.select();
  }

  toggleWordWrap(win, winId) {
    const instance = this.instances.get(winId);
    const textarea = win.querySelector(".notepad-textarea");
    const checkmark = win.querySelector('[data-action="wordWrap"] .checkmark');

    instance.wordWrap = !instance.wordWrap;
    textarea.style.whiteSpace = instance.wordWrap ? "pre-wrap" : "pre";
    textarea.style.overflowX = instance.wordWrap ? "hidden" : "auto";
    checkmark.style.visibility = instance.wordWrap ? "visible" : "hidden";
  }

  showFontDialog(win, winId) {
    this.closeDialogs(win);
    const textarea = win.querySelector(".notepad-textarea");
    const currentStyle = window.getComputedStyle(textarea);

    const currentFamily = textarea.style.fontFamily || currentStyle.fontFamily;
    const currentWeight = textarea.style.fontWeight || currentStyle.fontWeight;
    const currentFontStyle = textarea.style.fontStyle || currentStyle.fontStyle;
    const currentSize = parseInt(textarea.style.fontSize) || parseInt(currentStyle.fontSize) || 14;

    let currentStyleValue = "normal";
    const isBold = currentWeight === "bold" || parseInt(currentWeight) >= 700;
    const isItalic = currentFontStyle === "italic";
    if (isBold && isItalic) currentStyleValue = "bold italic";
    else if (isBold) currentStyleValue = "bold";
    else if (isItalic) currentStyleValue = "italic";

    const fontFamilies = [
      { label: "Consolas", value: "Consolas, monospace" },
      { label: "Courier New", value: "'Courier New', monospace" },
      { label: "Lucida Console", value: "'Lucida Console', monospace" },
      { label: "Monaco", value: "Monaco, monospace" },
      { label: "Fira Code", value: "'Fira Code', monospace" },
      { label: "JetBrains Mono", value: "'JetBrains Mono', monospace" },
      { label: "Arial", value: "Arial, sans-serif" },
      { label: "Segoe UI", value: "'Segoe UI', sans-serif" },
      { label: "Verdana", value: "Verdana, sans-serif" }
    ];

    const familyOptions = fontFamilies
      .map((f) => {
        const selected = currentFamily.includes(f.label) ? "selected" : "";
        return `<option value="${f.value}" ${selected}>${f.label}</option>`;
      })
      .join("");

    const styleOptions = [
      { label: "Regular", value: "normal" },
      { label: "Italic", value: "italic" },
      { label: "Bold", value: "bold" },
      { label: "Bold Italic", value: "bold italic" }
    ]
      .map((s) => {
        const selected = s.value === currentStyleValue ? "selected" : "";
        return `<option value="${s.value}" ${selected}>${s.label}</option>`;
      })
      .join("");

    const sizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];
    const sizeOptions = sizes
      .map((s) => {
        const selected = s === currentSize ? "selected" : "";
        return `<option value="${s}" ${selected}>${s}</option>`;
      })
      .join("");

    const dialog = document.createElement("div");
    dialog.className = "notepad-dialog";
    dialog.innerHTML = `
      <h3>Font</h3>
      <div class="notepad-dialog-row">
        <label>Font:</label>
        <select class="font-family">${familyOptions}</select>
      </div>
      <div class="notepad-dialog-row">
        <label>Style:</label>
        <select class="font-style">${styleOptions}</select>
      </div>
      <div class="notepad-dialog-row">
        <label>Size:</label>
        <select class="font-size">${sizeOptions}</select>
      </div>
      <div class="notepad-dialog-row">
        <label>Preview:</label>
        <div class="font-preview" style="border:1px solid #ccc;padding:6px 10px;min-height:30px;font-size:${currentSize}px;font-family:${currentFamily}">AaBbCcXxYyZz</div>
      </div>
      <div class="notepad-dialog-buttons">
        <button class="ok-btn primary">OK</button>
        <button class="cancel-btn">Cancel</button>
      </div>
    `;

    Object.assign(dialog.style, { top: "60px", right: "30px" });
    win.querySelector(".notepad-content").appendChild(dialog);

    const fontFamilyEl = dialog.querySelector(".font-family");
    const fontStyleEl = dialog.querySelector(".font-style");
    const fontSizeEl = dialog.querySelector(".font-size");
    const preview = dialog.querySelector(".font-preview");

    const updatePreview = () => {
      const style = fontStyleEl.value;
      preview.style.fontFamily = fontFamilyEl.value;
      preview.style.fontSize = fontSizeEl.value + "px";
      preview.style.fontWeight = style.includes("bold") ? "bold" : "normal";
      preview.style.fontStyle = style.includes("italic") ? "italic" : "normal";
    };

    fontFamilyEl.addEventListener("change", updatePreview);
    fontStyleEl.addEventListener("change", updatePreview);
    fontSizeEl.addEventListener("change", updatePreview);

    dialog.querySelector(".ok-btn").onclick = () => {
      const style = fontStyleEl.value;
      const instance = this.instances.get(winId);
      textarea.style.fontFamily = fontFamilyEl.value;
      textarea.style.fontSize = fontSizeEl.value + "px";
      textarea.style.fontWeight = style.includes("bold") ? "bold" : "normal";
      textarea.style.fontStyle = style.includes("italic") ? "italic" : "normal";
      instance.baseFontSize = parseInt(fontSizeEl.value);
      instance.zoom = 100;
      this.updateStatusBar(win, winId);
      dialog.remove();
    };

    dialog.querySelector(".cancel-btn").onclick = () => dialog.remove();
  }

  zoom(win, winId, delta) {
    const instance = this.instances.get(winId);
    const textarea = win.querySelector(".notepad-textarea");

    instance.zoom = Math.max(10, Math.min(500, instance.zoom + delta));
    textarea.style.fontSize = (instance.baseFontSize * instance.zoom) / 100 + "px";
    this.updateStatusBar(win, winId);
  }

  zoomReset(win, winId) {
    const instance = this.instances.get(winId);
    const textarea = win.querySelector(".notepad-textarea");

    instance.zoom = 100;
    textarea.style.fontSize = instance.baseFontSize + "px";
    this.updateStatusBar(win, winId);
  }

  toggleStatusBar(win, winId) {
    const instance = this.instances.get(winId);
    const statusBar = win.querySelector(".notepad-statusbar");
    const checkmark = win.querySelector('[data-action="statusBar"] .checkmark');

    instance.statusBarVisible = !instance.statusBarVisible;
    statusBar.style.display = instance.statusBarVisible ? "flex" : "none";
    checkmark.style.visibility = instance.statusBarVisible ? "visible" : "hidden";
  }

  showAboutDialog(win) {
    this.closeDialogs(win);

    const dialog = document.createElement("div");
    dialog.className = "notepad-dialog";
    dialog.innerHTML = `
      <div style="text-align:center;padding:20px;">
        <div style="font-size:48px;margin-bottom:10px;"><img style="width:50px" src="/static/icons/notepad.webp"></div>
        <h2 style="margin:0 0 5px 0;font-weight:normal;">Notepad</h2>
        <p style="color:#888;margin:5px 0;">Version 1.0.0</p>
        <p style="font-size:12px;color:#666;margin:15px 0;">A simple text editor for yukios.</p>
        <div class="notepad-dialog-buttons" style="justify-content:center;margin-top:20px;">
          <button class="ok-btn primary">OK</button>
        </div>
      </div>
    `;

    Object.assign(dialog.style, {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      minWidth: "300px"
    });

    win.querySelector(".notepad-content").appendChild(dialog);
    dialog.querySelector(".ok-btn").onclick = () => dialog.remove();
  }

  closeDialogs(win) {
    win.querySelectorAll(".notepad-dialog").forEach((d) => d.remove());
  }

  setupCleanup(win, winId) {
    const observer = new MutationObserver(() => {
      if (!document.contains(win)) {
        this.instances.delete(winId);
        if (this.idleTimer) {
          clearTimeout(this.idleTimer);
        }
        observer.disconnect();
      }
    });
    observer.observe(desktop, { childList: true });
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
  }

  loadContent(fileName, content, filePath) {
    this.open(fileName, content, filePath);
  }
}
