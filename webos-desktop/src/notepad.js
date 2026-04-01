import { desktop } from "./desktop.js";
import { speak } from "./clippy.js";
import { Achievements } from "./achievements.js";

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

    this.instances.set(winId, {
      currentTitle: title,
      currentPath: filePath,
      wordWrap: true,
      zoom: 100,
      baseFontSize: 14,
      statusBarVisible: true,
      modified: false,
      findText: "",
      matchCase: false
    });

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
    textarea.style.fontSize = this.instances.get(winId).baseFontSize + "px";

    this.updateStatusBar(win, winId);
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  markModified(win, winId) {
    this.instances.get(winId).modified = true;
    this.updateTitle(win, winId);
    this.updateStatusBar(win, winId);
  }

  createDialog(win, html, style = {}) {
    this.closeDialogs(win);
    const dialog = document.createElement("div");
    dialog.className = "notepad-dialog";
    dialog.innerHTML = html;
    Object.assign(dialog.style, style);
    win.querySelector(".notepad-content").appendChild(dialog);
    return dialog;
  }

  bindDialogButtons(dialog, bindings) {
    for (const [selector, handler] of Object.entries(bindings)) {
      const el = dialog.querySelector(selector);
      if (el) el.onclick = handler;
    }
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
        this.handleAction(win, winId, item.dataset.action);
        closeAllMenus();
      });
    });

    const closeHandler = (e) => {
      if (!win.contains(e.target)) closeAllMenus();
    };
    document.addEventListener("click", closeHandler);
    win.addEventListener("remove", () => document.removeEventListener("click", closeHandler));
  }

  updateStatusBar(win, winId) {
    const textarea = win.querySelector(".notepad-textarea");
    const statusPosition = win.querySelector(".status-position");
    const statusZoom = win.querySelector(".status-zoom");
    const instance = this.instances.get(winId);

    if (!textarea || !statusPosition || !instance) return;

    const text = textarea.value.substring(0, textarea.selectionStart);
    const lines = text.split("\n");
    statusPosition.textContent = `Ln ${lines.length}, Col ${lines[lines.length - 1].length + 1}`;
    if (statusZoom) statusZoom.textContent = `${instance.zoom}%`;
  }

  setupTextarea(win, winId) {
    const textarea = win.querySelector(".notepad-textarea");
    const refresh = () => this.updateStatusBar(win, winId);

    textarea.addEventListener("input", () => this.markModified(win, winId));
    textarea.addEventListener("keydown", () => setTimeout(refresh, 0));
    ["click", "keyup", "focus", "select", "mouseup"].forEach((ev) => textarea.addEventListener(ev, refresh));
  }

  updateTitle(win, winId) {
    const instance = this.instances.get(winId);
    const headerSpan = win.querySelector(".window-header > span");
    if (!headerSpan) return;

    const newTitle = `${instance.modified ? "*" : ""}${instance.currentTitle} - Notepad`;
    const iconEl = headerSpan.querySelector("img, i");

    if (iconEl) {
      Array.from(headerSpan.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .forEach((n) => n.remove());
      headerSpan.querySelector(".title-text")?.remove();
      headerSpan.appendChild(document.createTextNode(newTitle));
    } else {
      headerSpan.textContent = newTitle;
    }
  }

  setupKeyboardShortcuts(win, winId) {
    win.addEventListener("keydown", (e) => {
      if (e.ctrlKey && !e.altKey) {
        const keyMap = {
          o: "open",
          f: "find",
          h: "replace",
          g: "goTo",
          "=": "zoomIn",
          "+": "zoomIn",
          "-": "zoomOut",
          0: "zoomReset"
        };
        if (e.key.toLowerCase() === "s") {
          e.preventDefault();
          this.handleAction(win, winId, e.shiftKey ? "saveAs" : "save");
          return;
        }
        const action = keyMap[e.key.toLowerCase()];
        if (action) {
          e.preventDefault();
          this.handleAction(win, winId, action);
        }
      } else if (e.key === "F3") {
        e.preventDefault();
        this.handleAction(win, winId, e.shiftKey ? "findPrev" : "findNext");
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
    actions[action]?.();
  }

  newFile(win, winId) {
    const instance = this.instances.get(winId);
    if (instance.modified) {
      this.showSaveConfirmDialog(win, winId, () => this.resetEditor(win, winId));
      return;
    }
    this.resetEditor(win, winId);
  }

  resetEditor(win, winId) {
    const instance = this.instances.get(winId);
    const textarea = win.querySelector(".notepad-textarea");
    textarea.value = "";
    instance.currentTitle = "Untitled";
    instance.currentPath = null;
    instance.modified = false;
    this.updateTitle(win, winId);
    this.updateStatusBar(win, winId);
  }

  showSaveConfirmDialog(win, winId, onDiscard) {
    const instance = this.instances.get(winId);
    const dialog = this.createDialog(
      win,
      `
      <h3>Do you want to save changes to ${instance.currentTitle}?</h3>
      <div class="notepad-dialog-buttons">
        <button class="save-btn primary">Save</button>
        <button class="dont-save-btn">Don't Save</button>
        <button class="cancel-btn">Cancel</button>
      </div>
    `,
      { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }
    );

    this.bindDialogButtons(dialog, {
      ".save-btn": () => {
        dialog.remove();
        this.saveFile(win, winId);
      },
      ".dont-save-btn": () => {
        dialog.remove();
        onDiscard();
      },
      ".cancel-btn": () => dialog.remove()
    });
  }

  onFileSaved(win, winId, title, path) {
    const instance = this.instances.get(winId);
    instance.currentTitle = title;
    instance.currentPath = path;
    instance.modified = false;
    this.updateTitle(win, winId);
    speak("Great, your file has been saved!", "Save");
    window.achievements?.trigger(Achievements.NoteTaker);
  }

  saveFile(win, winId) {
    const instance = this.instances.get(winId);
    if (!instance.currentPath) {
      this.saveAsFile(win, winId);
      return;
    }

    const content = win.querySelector(".notepad-textarea").value;
    this.fs.updateFile(instance.currentPath, instance.currentTitle, content);
    this.onFileSaved(win, winId, instance.currentTitle, instance.currentPath);
    this.wm.sendNotify(`File saved: ${instance.currentTitle}`);
  }

  saveAsFile(win, winId) {
    const instance = this.instances.get(winId);
    const defaultName = instance.currentTitle.includes(".") ? instance.currentTitle : `${instance.currentTitle}.txt`;

    this.explorerApp.openSaveDialog(defaultName, (path, fileName) => {
      const content = win.querySelector(".notepad-textarea").value;
      this.fs
        .createFile(path, fileName, content)
        .then(() => {
          this.onFileSaved(win, winId, fileName, path);
          const pathStr = path.length ? `/${path.join("/")}/${fileName}` : `/${fileName}`;
          this.wm.sendNotify(`File saved: ${pathStr}`);
        })
        .catch((e) => {
          console.error(e);
          this.wm.sendNotify("Error saving file.");
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
      this.showSaveConfirmDialog(win, winId, () => win.querySelector(".close-btn")?.click());
      return;
    }
    win.querySelector(".close-btn")?.click();
  }

  showFindDialog(win, winId) {
    const instance = this.instances.get(winId);
    const dialog = this.createDialog(
      win,
      `
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
    `,
      { top: "60px", right: "30px" }
    );

    const input = dialog.querySelector(".find-input");
    const matchCase = dialog.querySelector(".match-case");

    const syncAndRun = (direction) => {
      instance.findText = input.value;
      instance.matchCase = matchCase.checked;
      direction === "next" ? this.findNext(win, winId) : this.findPrev(win, winId);
    };

    this.bindDialogButtons(dialog, {
      ".find-next-btn": () => syncAndRun("next"),
      ".find-prev-btn": () => syncAndRun("prev"),
      ".cancel-btn": () => dialog.remove()
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") syncAndRun("next");
    });
    input.focus();
    input.select();
  }

  searchText(win, winId, direction) {
    const instance = this.instances.get(winId);
    if (!instance.findText) {
      this.showFindDialog(win, winId);
      return;
    }

    const textarea = win.querySelector(".notepad-textarea");
    const text = textarea.value;
    const searchIn = instance.matchCase ? text : text.toLowerCase();
    const searchFor = instance.matchCase ? instance.findText : instance.findText.toLowerCase();
    const len = instance.findText.length;

    let index;
    if (direction === "next") {
      index = searchIn.indexOf(searchFor, textarea.selectionEnd);
      if (index === -1 && textarea.selectionEnd > 0) index = searchIn.indexOf(searchFor, 0);
    } else {
      index = searchIn.lastIndexOf(searchFor, textarea.selectionStart - 1);
      if (index === -1 && textarea.selectionStart < text.length) index = searchIn.lastIndexOf(searchFor);
    }

    if (index !== -1) {
      textarea.focus();
      textarea.setSelectionRange(index, index + len);
      this.updateStatusBar(win, winId);
    } else {
      this.wm.sendNotify(`Cannot find "${instance.findText}"`);
    }
  }

  findNext(win, winId) {
    this.searchText(win, winId, "next");
  }
  findPrev(win, winId) {
    this.searchText(win, winId, "prev");
  }

  showReplaceDialog(win, winId) {
    const instance = this.instances.get(winId);
    const dialog = this.createDialog(
      win,
      `
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
    `,
      { top: "60px", right: "30px" }
    );

    const findInput = dialog.querySelector(".find-input");
    const replaceInput = dialog.querySelector(".replace-input");
    const matchCase = dialog.querySelector(".match-case");
    const textarea = win.querySelector(".notepad-textarea");

    const syncInstance = () => {
      instance.findText = findInput.value;
      instance.matchCase = matchCase.checked;
    };

    this.bindDialogButtons(dialog, {
      ".find-next-btn": () => {
        syncInstance();
        this.findNext(win, winId);
      },
      ".replace-btn": () => {
        const selected = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
        const findText = findInput.value;
        const replaceText = replaceInput.value;
        const cmp = (s) => (matchCase.checked ? s : s.toLowerCase());

        if (cmp(selected) === cmp(findText)) {
          const start = textarea.selectionStart;
          textarea.value =
            textarea.value.substring(0, start) + replaceText + textarea.value.substring(textarea.selectionEnd);
          textarea.selectionStart = textarea.selectionEnd = start + replaceText.length;
          this.markModified(win, winId);
        }
        syncInstance();
        this.findNext(win, winId);
      },
      ".replace-all-btn": () => {
        const findText = findInput.value;
        if (!findText) return;
        const replaceText = replaceInput.value;
        const newText = matchCase.checked
          ? textarea.value.split(findText).join(replaceText)
          : textarea.value.replace(new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), replaceText);
        const count =
          Math.abs(Math.round((textarea.value.length - newText.length) / (findText.length - replaceText.length))) || 0;
        textarea.value = newText;
        this.markModified(win, winId);
        this.wm.sendNotify(`Replaced ${count} occurrence(s)`);
      },
      ".cancel-btn": () => dialog.remove()
    });

    findInput.focus();
    findInput.select();
  }

  showGoToDialog(win, winId) {
    const textarea = win.querySelector(".notepad-textarea");
    const currentLine = textarea.value.substring(0, textarea.selectionStart).split("\n").length;

    const dialog = this.createDialog(
      win,
      `
      <h3>Go To Line</h3>
      <div class="notepad-dialog-row">
        <label>Line number:</label>
        <input type="number" class="line-input" min="1" value="${currentLine}" />
      </div>
      <div class="notepad-dialog-buttons">
        <button class="goto-btn primary">Go To</button>
        <button class="cancel-btn">Cancel</button>
      </div>
    `,
      { top: "60px", right: "30px" }
    );

    const input = dialog.querySelector(".line-input");

    const goToLine = () => {
      const lineNum = parseInt(input.value);
      const allLines = textarea.value.split("\n");
      if (lineNum < 1 || lineNum > allLines.length) {
        this.wm.sendNotify(`Line number must be between 1 and ${allLines.length}`);
        return;
      }
      let pos = 0;
      for (let i = 0; i < lineNum - 1; i++) pos += allLines[i].length + 1;
      textarea.focus();
      textarea.setSelectionRange(pos, pos);
      this.updateStatusBar(win, winId);
      dialog.remove();
    };

    this.bindDialogButtons(dialog, {
      ".goto-btn": goToLine,
      ".cancel-btn": () => dialog.remove()
    });

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

  parseFontStyle(styleValue) {
    return {
      fontWeight: styleValue.includes("bold") ? "bold" : "normal",
      fontStyle: styleValue.includes("italic") ? "italic" : "normal"
    };
  }

  showFontDialog(win, winId) {
    const textarea = win.querySelector(".notepad-textarea");
    const computed = window.getComputedStyle(textarea);

    const currentFamily = textarea.style.fontFamily || computed.fontFamily;
    const currentSize = parseInt(textarea.style.fontSize) || parseInt(computed.fontSize) || 14;
    const isBold =
      (textarea.style.fontWeight || computed.fontWeight) === "bold" ||
      parseInt(textarea.style.fontWeight || computed.fontWeight) >= 700;
    const isItalic = (textarea.style.fontStyle || computed.fontStyle) === "italic";
    const currentStyleValue = isBold && isItalic ? "bold italic" : isBold ? "bold" : isItalic ? "italic" : "normal";

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

    const toOptions = (arr, selectedFn) =>
      arr
        .map(({ label, value }) => `<option value="${value}" ${selectedFn(value) ? "selected" : ""}>${label}</option>`)
        .join("");

    const fontStyleOptions = [
      { label: "Regular", value: "normal" },
      { label: "Italic", value: "italic" },
      { label: "Bold", value: "bold" },
      { label: "Bold Italic", value: "bold italic" }
    ];

    const sizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];

    const dialog = this.createDialog(
      win,
      `
      <h3>Font</h3>
      <div class="notepad-dialog-row">
        <label>Font:</label>
        <select class="font-family">${toOptions(fontFamilies, (v) => currentFamily.includes(v.split(",")[0].replace(/'/g, "")))}</select>
      </div>
      <div class="notepad-dialog-row">
        <label>Style:</label>
        <select class="font-style">${toOptions(fontStyleOptions, (v) => v === currentStyleValue)}</select>
      </div>
      <div class="notepad-dialog-row">
        <label>Size:</label>
        <select class="font-size">${sizes.map((s) => `<option value="${s}" ${s === currentSize ? "selected" : ""}>${s}</option>`).join("")}</select>
      </div>
      <div class="notepad-dialog-row">
        <label>Preview:</label>
        <div class="font-preview" style="border:1px solid #ccc;padding:6px 10px;min-height:30px;font-size:${currentSize}px;font-family:${currentFamily}">AaBbCcXxYyZz</div>
      </div>
      <div class="notepad-dialog-buttons">
        <button class="ok-btn primary">OK</button>
        <button class="cancel-btn">Cancel</button>
      </div>
    `,
      { top: "60px", right: "30px" }
    );

    const fontFamilyEl = dialog.querySelector(".font-family");
    const fontStyleEl = dialog.querySelector(".font-style");
    const fontSizeEl = dialog.querySelector(".font-size");
    const preview = dialog.querySelector(".font-preview");

    const updatePreview = () => {
      const { fontWeight, fontStyle } = this.parseFontStyle(fontStyleEl.value);
      Object.assign(preview.style, {
        fontFamily: fontFamilyEl.value,
        fontSize: fontSizeEl.value + "px",
        fontWeight,
        fontStyle
      });
    };

    [fontFamilyEl, fontStyleEl, fontSizeEl].forEach((el) => el.addEventListener("change", updatePreview));

    this.bindDialogButtons(dialog, {
      ".ok-btn": () => {
        const { fontWeight, fontStyle } = this.parseFontStyle(fontStyleEl.value);
        const instance = this.instances.get(winId);
        Object.assign(textarea.style, {
          fontFamily: fontFamilyEl.value,
          fontSize: fontSizeEl.value + "px",
          fontWeight,
          fontStyle
        });
        instance.baseFontSize = parseInt(fontSizeEl.value);
        instance.zoom = 100;
        this.updateStatusBar(win, winId);
        dialog.remove();
      },
      ".cancel-btn": () => dialog.remove()
    });
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
    const dialog = this.createDialog(
      win,
      `
      <div style="text-align:center;padding:20px;">
        <div style="font-size:48px;margin-bottom:10px;"><img style="width:50px" src="/static/icons/notepad.webp"></div>
        <h2 style="margin:0 0 5px 0;font-weight:normal;">Notepad</h2>
        <p style="color:#888;margin:5px 0;">Version 1.0.0</p>
        <p style="font-size:12px;color:#666;margin:15px 0;">A simple text editor for yukios.</p>
        <div class="notepad-dialog-buttons" style="justify-content:center;margin-top:20px;">
          <button class="ok-btn primary">OK</button>
        </div>
      </div>
    `,
      { top: "50%", left: "50%", transform: "translate(-50%, -50%)", minWidth: "300px" }
    );

    this.bindDialogButtons(dialog, { ".ok-btn": () => dialog.remove() });
  }

  closeDialogs(win) {
    win.querySelectorAll(".notepad-dialog").forEach((d) => d.remove());
  }

  setupCleanup(win, winId) {
    const observer = new MutationObserver(() => {
      if (!document.contains(win)) {
        this.instances.delete(winId);
        if (this.idleTimer) clearTimeout(this.idleTimer);
        observer.disconnect();
      }
    });
    observer.observe(desktop, { childList: true });
  }

  setupIdleDetection(win) {
    const textarea = win.querySelector(".notepad-textarea");
    const resetIdleTimer = () => {
      if (this.idleTimer) clearTimeout(this.idleTimer);
      if (textarea.value.trim().length > 0) {
        this.idleTimer = setTimeout(() => speak("Still there? I can check your spelling.", "Thinking"), this.idleDelay);
      }
    };
    textarea.addEventListener("input", resetIdleTimer);
    textarea.addEventListener("keydown", resetIdleTimer);
  }

  loadContent(fileName, content, filePath) {
    this.open(fileName, content, filePath);
  }
}
