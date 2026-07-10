import "../styles/monaco.css";
import { AppSource } from "../AppSource.js";
import { resolveIconUrl } from "../shared/assetResolver.js";
import { getLibraryUrl } from "../shared/cdnConfig.js";
import { ClippyAnimation, speak } from "../ai/clippy.js";
import { decodeDataURLContent } from "../fileDisplay.js";
import { showConflictDialog } from "../shared/conflictDialog.js";
import { showAboutDialog } from "../shared/aboutDialog.js";
import { Shell } from "../shared/shell.js";
import { FileKind } from "../shared/fileKindDetector.js";
import { BaseApp, os } from "../framework.js";
import { KeybindManager } from "../keybindManager.js";
export class MonacoApp extends BaseApp {
  constructor(services) {
    super(services);
    this.explorerApp = services.explorerApp;
    this.idleTimer = null;
    this.idleDelay = 15000;
    this.monacoLoaded = false;
    this.editors = new Map();
    this.tabs = new Map();
    this.activeTabId = null;
    this.currentWindow = null;
    this.tabCounter = 0;
    this.findWidgetVisible = false;
    this.icon = "fas fa-code";
    this.declarativeApp = null;
    this.sessionKey = services.fileSystemManager?.sessionKey || "guest";
    this.setupTerminalCore();
  }

  async open(title = "Untitled", content = "", filePath = null) {
    if (typeof title === "object" && title !== null) {
      const opts = title;
      title = opts.title || "Untitled";
      content = opts.content || "";
      filePath = opts.filePath || null;
    }

    if (!this.monacoLoaded) {
      try {
        await this.loadMonaco();
      } catch (e) {
        os.notify.send("Couldn't load Yuki Code", AppSource.MONACO);
        return;
      }
    }

    if (!this.currentWindow || !document.body.contains(this.currentWindow)) {
      this.createNewWindow();
    }

    this.createNewTab(title, content, filePath);
  }

  async loadMonaco() {
    if (this.monacoLoaded) return;

    return new Promise((resolve, reject) => {
      const loaderScript = document.createElement("script");
      loaderScript.src = getLibraryUrl("monaco", "loader");

      loaderScript.onload = () => {
        require.config({
          paths: { vs: getLibraryUrl("monaco", "vs") }
        });

        require(["vs/editor/editor.main"], () => {
          this.monacoLoaded = true;
          resolve();
        });
      };

      loaderScript.onerror = reject;
      document.head.appendChild(loaderScript);
    });
  }

  getMenuBarHTML() {
    return `
      <div class="monaco-menubar">
        <div class="monaco-menu-item" data-menu="file">
          <span>File</span>
          <div class="monaco-dropdown">
            <div class="monaco-dropdown-item" data-action="newFile">
              <i class="fas fa-file"></i><span>New File</span><span class="shortcut">Ctrl+N</span>
            </div>
            <div class="monaco-dropdown-item" data-action="newWindow">
              <i class="fas fa-code"></i><span>New Window</span><span class="shortcut">Ctrl+Shift+N</span>
            </div>
            <div class="monaco-dropdown-divider"></div>
            <div class="monaco-dropdown-item" data-action="open">
              <i class="fas fa-folder-open"></i><span>Open File...</span><span class="shortcut">Ctrl+O</span>
            </div>
            <div class="monaco-dropdown-divider"></div>
            <div class="monaco-dropdown-item" data-action="save">
              <i class="fas fa-save"></i><span>Save</span><span class="shortcut">Ctrl+S</span>
            </div>
            <div class="monaco-dropdown-item" data-action="saveAs">
              <i class="fas fa-file-export"></i><span>Save As...</span><span class="shortcut">Ctrl+Shift+S</span>
            </div>
            <div class="monaco-dropdown-divider"></div>
            <div class="monaco-dropdown-item" data-action="closeTab">
              <i class="fas fa-times"></i><span>Close Tab</span><span class="shortcut">Ctrl+W</span>
            </div>
            <div class="monaco-dropdown-item" data-action="closeWindow">
              <i class="fas fa-times-circle"></i><span>Close Window</span><span class="shortcut">Ctrl+Shift+W</span>
            </div>
          </div>
        </div>
        
        <div class="monaco-menu-item" data-menu="edit">
          <span>Edit</span>
          <div class="monaco-dropdown">
            <div class="monaco-dropdown-item" data-action="undo">
              <i class="fas fa-undo"></i><span>Undo</span><span class="shortcut">Ctrl+Z</span>
            </div>
            <div class="monaco-dropdown-item" data-action="redo">
              <i class="fas fa-redo"></i><span>Redo</span><span class="shortcut">Ctrl+Y</span>
            </div>
            <div class="monaco-dropdown-divider"></div>
            <div class="monaco-dropdown-item" data-action="cut">
              <i class="fas fa-cut"></i><span>Cut</span><span class="shortcut">Ctrl+X</span>
            </div>
            <div class="monaco-dropdown-item" data-action="copy">
              <i class="fas fa-copy"></i><span>Copy</span><span class="shortcut">Ctrl+C</span>
            </div>
            <div class="monaco-dropdown-item" data-action="paste">
              <i class="fas fa-paste"></i><span>Paste</span><span class="shortcut">Ctrl+V</span>
            </div>
            <div class="monaco-dropdown-divider"></div>
            <div class="monaco-dropdown-item" data-action="find">
              <i class="fas fa-search"></i><span>Find</span><span class="shortcut">Ctrl+F</span>
            </div>
            <div class="monaco-dropdown-item" data-action="replace">
              <i class="fas fa-exchange-alt"></i><span>Replace</span><span class="shortcut">Ctrl+H</span>
            </div>
            <div class="monaco-dropdown-item" data-action="findInSelection">
              <i class="fas fa-search-plus"></i><span>Find in Selection</span><span class="shortcut">Ctrl+Shift+F</span>
            </div>
            <div class="monaco-dropdown-divider"></div>
            <div class="monaco-dropdown-item" data-action="selectAll">
              <i class="fas fa-object-group"></i><span>Select All</span><span class="shortcut">Ctrl+A</span>
            </div>
          </div>
        </div>
        
        <div class="monaco-menu-item" data-menu="selection">
          <span>Selection</span>
          <div class="monaco-dropdown">
            <div class="monaco-dropdown-item" data-action="selectAll">
              <i class="fas fa-object-group"></i><span>Select All</span><span class="shortcut">Ctrl+A</span>
            </div>
            <div class="monaco-dropdown-item" data-action="expandSelection">
              <i class="fas fa-expand-arrows-alt"></i><span>Expand Selection</span><span class="shortcut">Shift+Alt+Right</span>
            </div>
            <div class="monaco-dropdown-item" data-action="shrinkSelection">
              <i class="fas fa-compress-arrows-alt"></i><span>Shrink Selection</span><span class="shortcut">Shift+Alt+Left</span>
            </div>
            <div class="monaco-dropdown-divider"></div>
            <div class="monaco-dropdown-item" data-action="copyLineUp">
              <i class="fas fa-angle-double-up"></i><span>Copy Line Up</span><span class="shortcut">Shift+Alt+Up</span>
            </div>
            <div class="monaco-dropdown-item" data-action="copyLineDown">
              <i class="fas fa-angle-double-down"></i><span>Copy Line Down</span><span class="shortcut">Shift+Alt+Down</span>
            </div>
            <div class="monaco-dropdown-item" data-action="moveLineUp">
              <i class="fas fa-arrow-up"></i><span>Move Line Up</span><span class="shortcut">Alt+Up</span>
            </div>
            <div class="monaco-dropdown-item" data-action="moveLineDown">
              <i class="fas fa-arrow-down"></i><span>Move Line Down</span><span class="shortcut">Alt+Down</span>
            </div>
            <div class="monaco-dropdown-divider"></div>
            <div class="monaco-dropdown-item" data-action="duplicateSelection">
              <i class="fas fa-clone"></i><span>Duplicate Selection</span><span class="shortcut">Ctrl+Shift+D</span>
            </div>
            <div class="monaco-dropdown-item" data-action="addCursorAbove">
              <i class="fas fa-level-up-alt"></i><span>Add Cursor Above</span><span class="shortcut">Ctrl+Alt+Up</span>
            </div>
            <div class="monaco-dropdown-item" data-action="addCursorBelow">
              <i class="fas fa-level-down-alt"></i><span>Add Cursor Below</span><span class="shortcut">Ctrl+Alt+Down</span>
            </div>
          </div>
        </div>

        <div class="monaco-menu-item" data-menu="terminal">
          <span>Terminal</span>
          <div class="monaco-dropdown">
            <div class="monaco-dropdown-item" data-action="toggleTerminal">
              <i class="fas fa-terminal"></i><span>Toggle Terminal</span><span class="shortcut">Ctrl+\`</span>
            </div>
            <div class="monaco-dropdown-item" data-action="spawnTerminalWindow">
              <i class="fas fa-window-restore"></i><span>New Terminal Window</span><span class="shortcut"></span>
            </div>
            <div class="monaco-dropdown-divider"></div>
            <div class="monaco-dropdown-item" data-action="terminalClear">
              <i class="fas fa-eraser"></i><span>Clear Terminal</span><span class="shortcut"></span>
            </div>
          </div>
        </div>

        <div class="monaco-menu-item" data-menu="view">
          <span>View</span>
          <div class="monaco-dropdown">
            <div class="monaco-dropdown-item" data-action="commandPalette">
              <i class="fas fa-terminal"></i><span>Command Palette</span><span class="shortcut">F1</span>
            </div>
            <div class="monaco-dropdown-divider"></div>
            <div class="monaco-dropdown-item" data-action="toggleTerminal">
              <i class="fas fa-terminal"></i><span>Toggle Terminal</span><span class="shortcut">Ctrl+\`</span>
            </div>
            <div class="monaco-dropdown-divider"></div>
            <div class="monaco-dropdown-item" data-action="zoomIn">
              <i class="fas fa-search-plus"></i><span>Zoom In</span><span class="shortcut">Ctrl++</span>
            </div>
            <div class="monaco-dropdown-item" data-action="zoomOut">
              <i class="fas fa-search-minus"></i><span>Zoom Out</span><span class="shortcut">Ctrl+-</span>
            </div>
            <div class="monaco-dropdown-item" data-action="resetZoom">
              <i class="fas fa-compress"></i><span>Reset Zoom</span><span class="shortcut">Ctrl+0</span>
            </div>
            <div class="monaco-dropdown-divider"></div>
            <div class="monaco-dropdown-item" data-action="toggleMinimap">
              <i class="fas fa-map"></i><span>Toggle Minimap</span><span class="shortcut"></span>
            </div>
            <div class="monaco-dropdown-item" data-action="toggleWordWrap">
              <i class="fas fa-text-width"></i><span>Toggle Word Wrap</span><span class="shortcut">Alt+Z</span>
            </div>
            <div class="monaco-dropdown-item" data-action="toggleLineNumbers">
              <i class="fas fa-list-ol"></i><span>Toggle Line Numbers</span><span class="shortcut"></span>
            </div>
            <div class="monaco-dropdown-item" data-action="toggleWhitespace">
              <i class="fas fa-space-shuttle"></i><span>Toggle Whitespace</span><span class="shortcut"></span>
            </div>
            <div class="monaco-dropdown-divider"></div>
            <div class="monaco-dropdown-item" data-action="changeLanguage">
              <i class="fas fa-code"></i><span>Change Language Mode</span><span class="shortcut"></span>
            </div>
            <div class="monaco-dropdown-item" data-action="changeTheme">
              <i class="fas fa-palette"></i><span>Change Theme</span><span class="shortcut"></span>
            </div>
            <div class="monaco-dropdown-divider"></div>
            <div class="monaco-dropdown-item" data-action="toggleFullscreen">
              <i class="fas fa-expand"></i><span>Toggle Fullscreen</span><span class="shortcut">F11</span>
            </div>
          </div>
        </div>
        
        <div class="monaco-menu-item" data-menu="go">
          <span>Go</span>
          <div class="monaco-dropdown">
            <div class="monaco-dropdown-item" data-action="goToLine">
              <i class="fas fa-hashtag"></i><span>Go to Line...</span><span class="shortcut">Ctrl+G</span>
            </div>
            <div class="monaco-dropdown-item" data-action="goToSymbol">
              <i class="fas fa-at"></i><span>Go to Symbol...</span><span class="shortcut">Ctrl+Shift+O</span>
            </div>
            <div class="monaco-dropdown-divider"></div>
            <div class="monaco-dropdown-item" data-action="goToDefinition">
              <i class="fas fa-bullseye"></i><span>Go to Definition</span><span class="shortcut">F12</span>
            </div>
            <div class="monaco-dropdown-item" data-action="peekDefinition">
              <i class="fas fa-eye"></i><span>Peek Definition</span><span class="shortcut">Alt+F12</span>
            </div>
            <div class="monaco-dropdown-divider"></div>
            <div class="monaco-dropdown-item" data-action="goToStart">
              <i class="fas fa-angle-double-up"></i><span>Go to Start</span><span class="shortcut">Ctrl+Home</span>
            </div>
            <div class="monaco-dropdown-item" data-action="goToEnd">
              <i class="fas fa-angle-double-down"></i><span>Go to End</span><span class="shortcut">Ctrl+End</span>
            </div>
            <div class="monaco-dropdown-divider"></div>
            <div class="monaco-dropdown-item" data-action="goBack">
              <i class="fas fa-arrow-left"></i><span>Go Back</span><span class="shortcut">Alt+Left</span>
            </div>
            <div class="monaco-dropdown-item" data-action="goForward">
              <i class="fas fa-arrow-right"></i><span>Go Forward</span><span class="shortcut">Alt+Right</span>
            </div>
          </div>
        </div>
        
        <div class="monaco-menu-item" data-menu="format">
          <span>Format</span>
          <div class="monaco-dropdown">
            <div class="monaco-dropdown-item" data-action="formatDocument">
              <i class="fas fa-align-left"></i><span>Format Document</span><span class="shortcut">Shift+Alt+F</span>
            </div>
            <div class="monaco-dropdown-item" data-action="formatSelection">
              <i class="fas fa-align-center"></i><span>Format Selection</span><span class="shortcut">Ctrl+K Ctrl+F</span>
            </div>
            <div class="monaco-dropdown-divider"></div>
            <div class="monaco-dropdown-item" data-action="toggleComment">
              <i class="fas fa-comment"></i><span>Toggle Line Comment</span><span class="shortcut">Ctrl+/</span>
            </div>
            <div class="monaco-dropdown-item" data-action="toggleBlockComment">
              <i class="fas fa-comment-dots"></i><span>Toggle Block Comment</span><span class="shortcut">Shift+Alt+A</span>
            </div>
            <div class="monaco-dropdown-divider"></div>
            <div class="monaco-dropdown-item" data-action="indentLine">
              <i class="fas fa-indent"></i><span>Indent Line</span><span class="shortcut">Ctrl+]</span>
            </div>
            <div class="monaco-dropdown-item" data-action="outdentLine">
              <i class="fas fa-outdent"></i><span>Outdent Line</span><span class="shortcut">Ctrl+[</span>
            </div>
            <div class="monaco-dropdown-divider"></div>
            <div class="monaco-dropdown-item" data-action="trimWhitespace">
              <i class="fas fa-broom"></i><span>Trim Trailing Whitespace</span><span class="shortcut"></span>
            </div>
            <div class="monaco-dropdown-item" data-action="transformUppercase">
              <i class="fas fa-font"></i><span>Transform to Uppercase</span><span class="shortcut"></span>
            </div>
            <div class="monaco-dropdown-item" data-action="transformLowercase">
              <i class="fas fa-font"></i><span>Transform to Lowercase</span><span class="shortcut"></span>
            </div>
            <div class="monaco-dropdown-item" data-action="transformTitleCase">
              <i class="fas fa-heading"></i><span>Transform to Title Case</span><span class="shortcut"></span>
            </div>
          </div>
        </div>
        
        <div class="monaco-menu-item" data-menu="tools">
          <span>Tools</span>
          <div class="monaco-dropdown">
            <div class="monaco-dropdown-item" data-action="sortLinesAsc">
              <i class="fas fa-sort-alpha-down"></i><span>Sort Lines Ascending</span><span class="shortcut"></span>
            </div>
            <div class="monaco-dropdown-item" data-action="sortLinesDesc">
              <i class="fas fa-sort-alpha-up"></i><span>Sort Lines Descending</span><span class="shortcut"></span>
            </div>
            <div class="monaco-dropdown-item" data-action="removeDuplicates">
              <i class="fas fa-minus-circle"></i><span>Remove Duplicate Lines</span><span class="shortcut"></span>
            </div>
            <div class="monaco-dropdown-divider"></div>
            <div class="monaco-dropdown-item" data-action="joinLines">
              <i class="fas fa-link"></i><span>Join Lines</span><span class="shortcut">Ctrl+J</span>
            </div>
            <div class="monaco-dropdown-item" data-action="splitLines">
              <i class="fas fa-unlink"></i><span>Split Into Lines</span><span class="shortcut"></span>
            </div>
            <div class="monaco-dropdown-item" data-action="reverseLines">
              <i class="fas fa-random"></i><span>Reverse Lines</span><span class="shortcut"></span>
            </div>
            <div class="monaco-dropdown-item" data-action="shuffleLines">
              <i class="fas fa-random"></i><span>Shuffle Lines</span><span class="shortcut"></span>
            </div>
            <div class="monaco-dropdown-divider"></div>
            <div class="monaco-dropdown-item" data-action="countWords">
              <i class="fas fa-calculator"></i><span>Word Count</span><span class="shortcut"></span>
            </div>
            <div class="monaco-dropdown-item" data-action="base64Encode">
              <i class="fas fa-lock"></i><span>Base64 Encode</span><span class="shortcut"></span>
            </div>
            <div class="monaco-dropdown-item" data-action="base64Decode">
              <i class="fas fa-unlock"></i><span>Base64 Decode</span><span class="shortcut"></span>
            </div>
            <div class="monaco-dropdown-divider"></div>
            <div class="monaco-dropdown-item" data-action="validateJSON">
              <i class="fas fa-check-circle"></i><span>Validate JSON</span><span class="shortcut"></span>
            </div>
            <div class="monaco-dropdown-item" data-action="minifyJSON">
              <i class="fas fa-compress-alt"></i><span>Minify JSON</span><span class="shortcut"></span>
            </div>
            <div class="monaco-dropdown-item" data-action="beautifyJSON">
              <i class="fas fa-expand-alt"></i><span>Beautify JSON</span><span class="shortcut"></span>
            </div>
          </div>
        </div>
        
        <div class="monaco-menu-item" data-menu="help">
          <span>Help</span>
          <div class="monaco-dropdown">
            <div class="monaco-dropdown-item" data-action="showShortcuts">
              <i class="fas fa-keyboard"></i><span>Keyboard Shortcuts</span><span class="shortcut">Ctrl+K Ctrl+S</span>
            </div>
            <div class="monaco-dropdown-item" data-action="showDocs">
              <i class="fas fa-book"></i><span>Documentation</span><span class="shortcut"></span>
            </div>
            <div class="monaco-dropdown-divider"></div>
            <div class="monaco-dropdown-item" data-action="about">
              <i class="fas fa-info-circle"></i><span>About</span><span class="shortcut"></span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  getHeaderHTML(title) {
    return `
      <div class="window-header">
        <span>Yuki Code</span>
        ${os.window.getWindowControls()}
      </div>
    `;
  }

  createTab(tabId, title, isDirty = false) {
    const tab = document.createElement("div");
    tab.className = "monaco-tab";
    tab.dataset.tabId = tabId;

    const dirtyIndicator = isDirty ? '<span class="monaco-tab-dirty">●</span>' : "";

    tab.innerHTML = `
      <span class="monaco-tab-label">${dirtyIndicator}${title}</span>
      <button class="monaco-tab-close" title="Close (Ctrl+W)">
        <i class="fas fa-times"></i>
      </button>
    `;

    tab.addEventListener("click", (e) => {
      if (!e.target.closest(".monaco-tab-close")) {
        this.switchTab(tabId);
      }
    });

    tab.querySelector(".monaco-tab-close").addEventListener("click", (e) => {
      e.stopPropagation();
      this.closeTab(tabId);
    });

    return tab;
  }

  createNewWindow() {
    const winId = `monaco-window-${Date.now()}`;
    const win = os.window.create(winId, "Yuki Code", "900px", "650px", {
      icon: "fas fa-code"
    });

    win.innerHTML = `
      ${this.getMenuBarHTML()}
      <div class="monaco-tabs-container">
        <div class="monaco-tabs"></div>
        <button class="monaco-new-tab-btn" title="New File (Ctrl+N)">
          <i class="fas fa-plus"></i>
        </button>
      </div>
      <div class="window-content monaco-window-content">
        <div class="monaco-editors-wrapper"></div>
        <div class="monaco-terminal-panel" style="display:none;flex:0 0 200px;border-top:1px solid var(--glass-border);background:var(--bg-primary);color:var(--text-primary);font-family:monospace;overflow:hidden;flex-direction:column;min-height:100px;">
          <div class="monaco-terminal-header" style="display:flex;align-items:center;padding:4px 8px;background:var(--glass);border-bottom:1px solid var(--glass-border);cursor:ns-resize;">
            <span style="font-size:11px;color:var(--text-secondary);margin-right:auto;">TERMINAL</span>
            <button class="monaco-terminal-close" style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:2px 6px;font-size:12px;">✕</button>
          </div>
          <div id="monaco-terminal-output" style="flex:1;overflow-y:auto;padding:8px;font-size:12px;white-space:pre;user-select:text;-webkit-user-select:text;"></div>
          <div id="monaco-terminal-input-line" style="display:flex;padding:4px 8px;background:var(--surface-1);">
            <span id="monaco-terminal-prompt" style="color:var(--brand);"></span>
            <input id="monaco-terminal-input" style="flex:1;background:transparent;border:none;color:var(--text-primary);font-family:monospace;outline:none;margin-left:5px;font-size:12px;">
          </div>
          <div class="monaco-terminal-resize-handle" style="height:4px;background:var(--glass-border);cursor:ns-resize;"></div>
        </div>
      </div>
      <div class="monaco-statusbar">
        <span class="monaco-status-position">Ln 1, Col 1</span>
        <span class="monaco-status-selection"></span>
        <span class="monaco-status-encoding">UTF-8</span>
        <span class="monaco-status-eol">LF</span>
        <span class="monaco-status-language">JavaScript</span>
        <span class="monaco-status-indent">Spaces: 2</span>
      </div>
    `;

    this.currentWindow = win;
    this.setupMenuActions(win);
    this.setupWindowCleanup(win);

    win.querySelector(".monaco-new-tab-btn").addEventListener("click", () => {
      this.createNewTab();
    });

    win.querySelector(".monaco-terminal-close").addEventListener("click", () => {
      this.toggleTerminalPanel();
    });

    document.addEventListener("click", () => this.closeAllMenus(win));

    this.setupTerminalPanel(win);

    win.addEventListener("keydown", (e) => {
      if (KeybindManager.matches(e, "monaco.toggleTerminal")) {
        e.preventDefault();
        this.toggleTerminalPanel();
      }
    });
  }

  toggleTerminalPanel() {
    const terminalPanel = this.currentWindow.querySelector(".monaco-terminal-panel");
    if (!terminalPanel) return;

    const isHidden = terminalPanel.style.display === "none";
    terminalPanel.style.display = isHidden ? "flex" : "none";

    if (isHidden) {
      this.initTerminal();
    }
  }

  setupTerminalPanel(win) {
    const terminalInput = win.querySelector("#monaco-terminal-input");
    const terminalOutput = win.querySelector("#monaco-terminal-output");
    const terminalPrompt = win.querySelector("#monaco-terminal-prompt");
    const terminalPanel = win.querySelector(".monaco-terminal-panel");

    if (terminalInput) {
      terminalInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const command = terminalInput.value.trim();
          if (!command) return;
          this.executeTerminalCommand(command);
          terminalInput.value = "";
        }
      });
    }

    if (terminalPanel) {
      terminalPanel.addEventListener("click", (e) => {
        if (terminalInput && e.target !== terminalInput) {
          terminalInput.focus();
        }
      });

      const terminalHeader = win.querySelector(".monaco-terminal-header");
      if (terminalHeader) {
        let isHeaderResizing = false;
        let headerStartY = 0;
        let headerStartHeight = 0;

        terminalHeader.addEventListener("mousedown", (e) => {
          if (e.target.classList.contains("monaco-terminal-close")) return;
          isHeaderResizing = true;
          headerStartY = e.clientY;
          headerStartHeight = terminalPanel.offsetHeight;
          e.preventDefault();
        });

        document.addEventListener("mousemove", (e) => {
          if (!isHeaderResizing) return;
          const deltaY = (headerStartY - e.clientY) * 2;
          const newHeight = Math.max(100, headerStartHeight + deltaY);
          terminalPanel.style.flex = `0 0 ${newHeight}px`;
        });

        document.addEventListener("mouseup", () => {
          isHeaderResizing = false;
        });
      }

      const resizeHandle = win.querySelector(".monaco-terminal-resize-handle");
      if (resizeHandle) {
        let isHandleResizing = false;
        let handleStartY = 0;
        let handleStartHeight = 0;

        resizeHandle.addEventListener("mousedown", (e) => {
          isHandleResizing = true;
          handleStartY = e.clientY;
          handleStartHeight = terminalPanel.offsetHeight;
          e.preventDefault();
        });

        document.addEventListener("mousemove", (e) => {
          if (!isHandleResizing) return;
          const deltaY = e.clientY - handleStartY;
          const newHeight = Math.max(100, handleStartHeight + deltaY);
          terminalPanel.style.flex = `0 0 ${newHeight}px`;
        });

        document.addEventListener("mouseup", () => {
          isHandleResizing = false;
        });
      }
    }

    this.terminalOutput = terminalOutput;
    this.terminalInput = terminalInput;
    this.terminalPrompt = terminalPrompt;
    this.terminalHistory = [];
    this.terminalHistoryIndex = -1;
    this.updateTerminalPrompt();
  }

  initTerminal() {
    if (!this.terminalOutput) return;
    this.terminalOutput.innerHTML = "";
    this.printToTerminal("YukiOS Terminal");
    this.printToTerminal("Type 'help' for available commands");
    this.updateTerminalPrompt();
  }

  async printToTerminal(text, color = "var(--text-primary)") {
    if (!this.terminalOutput) return;
    const line = document.createElement("div");
    line.style.color = color;
    this.terminalOutput.appendChild(line);

    for (let i = 0; i < text.length; i++) {
      line.textContent += text[i];
      this.terminalOutput.scrollTop = this.terminalOutput.scrollHeight;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }

  printToTerminalSync(text, color = "var(--text-primary)") {
    if (!this.terminalOutput) return;
    const line = document.createElement("div");
    line.style.color = color;
    line.textContent = text;
    this.terminalOutput.appendChild(line);
    this.terminalOutput.scrollTop = this.terminalOutput.scrollHeight;
  }

  updateTerminalPrompt() {
    if (!this.terminalPrompt) return;
    this.terminalPrompt.textContent = `${this.shell.currentPath.join("/")} $ `;
  }

  async executeTerminalCommand(command) {
    if (!this.terminalOutput) return;

    this.printToTerminalSync(`${this.shell.currentPath.join("/")} $ ${command}`, "var(--brand)");

    const outputCallback = (text, color = "var(--text-primary)") => {
      this.printToTerminalSync(text, color);
    };

    await this.shell.executeCommand(command, outputCallback);
    this.updateTerminalPrompt();
  }

  showCommandPalette() {
    const existingPalette = document.querySelector(".monaco-command-palette");
    if (existingPalette) {
      existingPalette.remove();
      return;
    }

    const palette = document.createElement("div");
    palette.className = "monaco-command-palette";
    palette.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 600px;
      max-height: 400px;
      background: var(--bg-elev-3);
      border: 1px solid var(--glass-border);
      border-radius: 8px;
      box-shadow: var(--shadow-depth);
      z-index: 10000;
      display: flex;
      flex-direction: column;
      backdrop-filter: blur(32px);
    `;

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Type '>' for commands, or search actions...";
    input.style.cssText = `
      background: var(--surface-1);
      border: none;
      border-bottom: 1px solid var(--glass-border);
      color: var(--text-primary);
      padding: 12px 16px;
      font-size: 14px;
      font-family: inherit;
      outline: none;
      border-radius: 8px 8px 0 0;
    `;

    const list = document.createElement("div");
    list.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 8px 0;
    `;

    const commands = [
      {
        category: "Terminal",
        items: [
          { label: "Toggle Terminal", action: () => this.toggleTerminalPanel() },
          { label: "New Terminal Window", action: () => this.spawnTerminalWindow() }
        ]
      },
      {
        category: "File",
        items: [
          { label: "New File", action: () => this.createNewTab() },
          { label: "Open File", action: () => this.openFileDialog() },
          { label: "Save", action: () => this.executeAction("save") },
          { label: "Save As", action: () => this.executeAction("saveAs") }
        ]
      },
      {
        category: "Edit",
        items: [
          { label: "Undo", action: () => this.executeAction("undo") },
          { label: "Redo", action: () => this.executeAction("redo") },
          { label: "Cut", action: () => this.executeAction("cut") },
          { label: "Copy", action: () => this.executeAction("copy") },
          { label: "Paste", action: () => this.executeAction("paste") }
        ]
      },
      {
        category: "View",
        items: [
          { label: "Toggle Minimap", action: () => this.executeAction("toggleMinimap") },
          { label: "Toggle Word Wrap", action: () => this.executeAction("toggleWordWrap") },
          { label: "Toggle Line Numbers", action: () => this.executeAction("toggleLineNumbers") },
          { label: "Toggle Whitespace", action: () => this.executeAction("toggleWhitespace") }
        ]
      }
    ];

    let selectedIndex = 0;
    let filteredItems = [];

    const renderList = (filter = "") => {
      list.innerHTML = "";
      filteredItems = [];

      if (filter.startsWith(">")) {
        const searchTerm = filter.slice(1).toLowerCase().trim();
        const terminalCommands = [
          {
            label: "help",
            action: () => {
              if (this.terminalInput) {
                this.terminalInput.value = "help";
                this.executeTerminalCommand("help");
                this.terminalInput.value = "";
              }
            }
          },
          {
            label: "clear",
            action: () => {
              if (this.terminalInput) {
                this.terminalInput.value = "clear";
                this.executeTerminalCommand("clear");
                this.terminalInput.value = "";
              }
            }
          },
          {
            label: "ls",
            action: () => {
              if (this.terminalInput) {
                this.terminalInput.value = "ls";
                this.executeTerminalCommand("ls");
                this.terminalInput.value = "";
              }
            }
          },
          {
            label: "pwd",
            action: () => {
              if (this.terminalInput) {
                this.terminalInput.value = "pwd";
                this.executeTerminalCommand("pwd");
                this.terminalInput.value = "";
              }
            }
          },
          {
            label: "cd",
            action: () => {
              if (this.terminalInput) {
                this.terminalInput.value = "cd";
                this.executeTerminalCommand("cd");
                this.terminalInput.value = "";
              }
            }
          },
          {
            label: "cat",
            action: () => {
              if (this.terminalInput) {
                this.terminalInput.value = "cat";
                this.executeTerminalCommand("cat");
                this.terminalInput.value = "";
              }
            }
          },
          {
            label: "mkdir",
            action: () => {
              if (this.terminalInput) {
                this.terminalInput.value = "mkdir";
                this.executeTerminalCommand("mkdir");
                this.terminalInput.value = "";
              }
            }
          },
          {
            label: "touch",
            action: () => {
              if (this.terminalInput) {
                this.terminalInput.value = "touch";
                this.executeTerminalCommand("touch");
                this.terminalInput.value = "";
              }
            }
          },
          {
            label: "rm",
            action: () => {
              if (this.terminalInput) {
                this.terminalInput.value = "rm";
                this.executeTerminalCommand("rm");
                this.terminalInput.value = "";
              }
            }
          },
          {
            label: "echo",
            action: () => {
              if (this.terminalInput) {
                this.terminalInput.value = "echo";
                this.executeTerminalCommand("echo");
                this.terminalInput.value = "";
              }
            }
          },
          {
            label: "whoami",
            action: () => {
              if (this.terminalInput) {
                this.terminalInput.value = "whoami";
                this.executeTerminalCommand("whoami");
                this.terminalInput.value = "";
              }
            }
          },
          {
            label: "hostname",
            action: () => {
              if (this.terminalInput) {
                this.terminalInput.value = "hostname";
                this.executeTerminalCommand("hostname");
                this.terminalInput.value = "";
              }
            }
          },
          {
            label: "date",
            action: () => {
              if (this.terminalInput) {
                this.terminalInput.value = "date";
                this.executeTerminalCommand("date");
                this.terminalInput.value = "";
              }
            }
          }
        ];

        filteredItems = terminalCommands.filter((cmd) => cmd.label.includes(searchTerm));
      } else {
        commands.forEach((category) => {
          category.items.forEach((item) => {
            if (item.label.toLowerCase().includes(filter.toLowerCase())) {
              filteredItems.push({ ...item, category: category.category });
            }
          });
        });
      }

      filteredItems.forEach((item, index) => {
        const itemEl = document.createElement("div");
        itemEl.style.cssText = `
          padding: 8px 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 12px;
          ${index === selectedIndex ? "background: var(--surface-hover);" : ""}
        `;
        itemEl.innerHTML = `
          <span style="color: var(--text-muted); font-size: 11px; min-width: 60px;">${item.category || "TERMINAL"}</span>
          <span style="color: var(--text-primary);">${item.label}</span>
        `;
        itemEl.addEventListener("click", () => {
          item.action();
          palette.remove();
        });
        itemEl.addEventListener("mouseenter", () => {
          selectedIndex = index;
          renderList(input.value);
        });
        list.appendChild(itemEl);
      });
    };

    input.addEventListener("input", (e) => {
      selectedIndex = 0;
      renderList(e.target.value);
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, filteredItems.length - 1);
        renderList(input.value);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        renderList(input.value);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
          palette.remove();
        }
      } else if (e.key === "Escape") {
        palette.remove();
      }
    });

    palette.appendChild(input);
    palette.appendChild(list);
    document.body.appendChild(palette);
    input.focus();
    renderList();

    document.addEventListener(
      "click",
      (e) => {
        if (!palette.contains(e.target)) {
          palette.remove();
        }
      },
      { once: true }
    );
  }

  spawnTerminalWindow() {
    const terminalApp = this.services?.terminalApp;
    if (terminalApp) {
      terminalApp.open();
    } else {
      os.notify.send("Can't find the Terminal app", AppSource.MONACO);
    }
  }

  setupTerminalCore() {
    this.shell = new Shell(this.fs, this.sessionKey);
    this.shell.setClearCallback(() => {
      if (this.terminalOutput) {
        this.terminalOutput.innerHTML = "";
      }
    });
  }

  createNewTab(title = `Untitled-${++this.tabCounter}`, content = "", filePath = null) {
    const tabId = `tab-${Date.now()}-${Math.random()}`;
    const language = this.detectLanguage(title);

    const editorContainer = document.createElement("div");
    editorContainer.className = "monaco-editor-container";
    editorContainer.dataset.tabId = tabId;
    editorContainer.style.display = "none";

    const editorsWrapper = this.currentWindow.querySelector(".monaco-editors-wrapper");
    editorsWrapper.appendChild(editorContainer);

    const editor = monaco.editor.create(editorContainer, {
      value: decodeDataURLContent(content),
      language: language,
      theme: "vs-dark",
      automaticLayout: true,
      fontSize: 14,
      fontFamily: "'Fira Code', 'Consolas', 'Courier New', monospace",
      fontLigatures: true,
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      wordWrap: "off",
      tabSize: 2,
      insertSpaces: true,
      renderWhitespace: "selection",
      bracketPairColorization: { enabled: true },
      guides: { bracketPairs: true },
      smoothScrolling: true,
      cursorBlinking: "smooth",
      cursorSmoothCaretAnimation: "on",
      lineNumbers: "on",
      folding: true,
      foldingHighlight: true,
      showFoldingControls: "mouseover",
      suggest: { showMethods: true, showFunctions: true, showConstructors: true }
    });

    const editorData = {
      tabId: tabId,
      editor: editor,
      container: editorContainer,
      title: title,
      filePath: filePath,
      isDirty: false,
      settings: {
        minimap: true,
        wordWrap: false,
        lineNumbers: true,
        renderWhitespace: "selection",
        fontSize: 14,
        theme: "vs-dark",
        language: language
      }
    };

    this.tabs.set(tabId, editorData);

    const tab = this.createTab(tabId, title);
    this.currentWindow.querySelector(".monaco-tabs").appendChild(tab);

    this.setupEditorEvents(editorData);
    this.setupKeyboardShortcuts(editorData);

    this.switchTab(tabId);

    if (this.tabs.size === 1) {
      speak("Ready to write some code!", ClippyAnimation.GetWizardy);
    }
  }

  switchTab(tabId) {
    const editorData = this.tabs.get(tabId);
    if (!editorData) return;

    this.tabs.forEach((data) => {
      data.container.style.display = "none";
      const tab = this.currentWindow.querySelector(`[data-tab-id="${data.tabId}"]`);
      if (tab) tab.classList.remove("active");
    });

    editorData.container.style.display = "block";
    const activeTab = this.currentWindow.querySelector(`[data-tab-id="${tabId}"]`);
    if (activeTab) activeTab.classList.add("active");

    this.activeTabId = tabId;
    editorData.editor.layout();
    editorData.editor.focus();
    this.updateStatusBar(editorData);
  }

  async closeTab(tabId) {
    const editorData = this.tabs.get(tabId);
    if (!editorData) return;

    if (editorData.isDirty) {
      if (!(await os.dialog.confirm("Confirm", `"${editorData.title}" has unsaved changes. Close anyway?`))) {
        return;
      }
    }

    editorData.editor.dispose();
    editorData.container.remove();

    const tab = this.currentWindow.querySelector(`[data-tab-id="${tabId}"]`);
    if (tab) tab.remove();

    this.tabs.delete(tabId);

    if (this.tabs.size === 0) {
      this.currentWindow.querySelector('[data-action="close"]').click();
      this.currentWindow = null;
    } else {
      const remainingTabId = Array.from(this.tabs.keys())[0];
      this.switchTab(remainingTabId);
    }
  }

  updateTabTitle(tabId, title, isDirty) {
    const tab = this.currentWindow?.querySelector(`[data-tab-id="${tabId}"]`);
    if (!tab) return;

    const dirtyIndicator = isDirty ? '<span class="monaco-tab-dirty">●</span>' : "";
    tab.querySelector(".monaco-tab-label").innerHTML = `${dirtyIndicator}${title}`;
  }

  detectLanguage(fileName) {
    if (!fileName || typeof fileName !== "string") return "plaintext";
    const ext = fileName.split(".").pop().toLowerCase();
    const langMap = {
      js: "javascript",
      mjs: "javascript",
      jsx: "javascript",
      ts: "typescript",
      tsx: "typescript",
      html: "html",
      htm: "html",
      css: "css",
      scss: "scss",
      sass: "scss",
      less: "less",
      json: "json",
      md: "markdown",
      py: "python",
      java: "java",
      cs: "csharp",
      cpp: "cpp",
      c: "c",
      h: "c",
      hpp: "cpp",
      php: "php",
      rb: "ruby",
      go: "go",
      rs: "rust",
      sql: "sql",
      xml: "xml",
      yaml: "yaml",
      yml: "yaml",
      sh: "shell",
      bash: "shell",
      txt: "plaintext"
    };
    return langMap[ext] || "plaintext";
  }

  setupMenuActions(win) {
    const menuItems = win.querySelectorAll(".monaco-menu-item");

    menuItems.forEach((menuItem) => {
      menuItem.addEventListener("click", (e) => {
        e.stopPropagation();
        const wasOpen = menuItem.classList.contains("active");
        this.closeAllMenus(win);
        if (!wasOpen) {
          menuItem.classList.add("active");
        }
      });
    });

    const dropdownItems = win.querySelectorAll(".monaco-dropdown-item");
    dropdownItems.forEach((item) => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const action = item.dataset.action;
        this.executeAction(action);
        this.closeAllMenus(win);
      });
    });
  }

  closeAllMenus(win) {
    win.querySelectorAll(".monaco-menu-item").forEach((m) => m.classList.remove("active"));
  }

  setupEditorEvents(editorData) {
    const editor = editorData.editor;

    editor.onDidChangeCursorPosition(() => this.updateStatusBar(editorData));
    editor.onDidChangeCursorSelection(() => this.updateStatusBar(editorData));

    editor.onDidChangeModelContent(() => {
      if (!editorData.isDirty) {
        editorData.isDirty = true;
        this.updateTabTitle(editorData.tabId, editorData.title, true);
      }
      this.resetIdleTimer(editorData);
    });
  }

  setupKeyboardShortcuts(editorData) {
    const editor = editorData.editor;

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      this.executeAction("save");
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS, () => {
      this.executeAction("saveAs");
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyO, () => {
      this.executeAction("open");
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyN, () => {
      this.executeAction("newFile");
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyN, () => {
      this.executeAction("newWindow");
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyW, () => {
      this.executeAction("closeTab");
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyG, () => {
      this.executeAction("goToLine");
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyJ, () => {
      this.executeAction("joinLines");
    });
  }

  setupWindowCleanup(win) {
    const closeBtn = win.querySelector('[data-action="close"]');
    if (closeBtn) {
      const originalClick = closeBtn.onclick;
      closeBtn.onclick = async (e) => {
        const dirtyTabs = Array.from(this.tabs.values()).filter((t) => t.isDirty);
        if (dirtyTabs.length > 0) {
          if (
            !(await os.dialog.confirm(
              "Confirm",
              `${dirtyTabs.length} tab(s) have unsaved changes. Close window anyway?`
            ))
          ) {
            return;
          }
        }

        this.tabs.forEach((data) => {
          data.editor.dispose();
        });
        this.tabs.clear();

        if (this.idleTimer) clearTimeout(this.idleTimer);
        this.currentWindow = null;
        this.activeTabId = null;

        if (originalClick) originalClick.call(closeBtn, e);
      };
    }
  }

  updateStatusBar(editorData) {
    if (!this.currentWindow) return;

    const editor = editorData.editor;
    const position = editor.getPosition();
    const selection = editor.getSelection();
    const model = editor.getModel();
    const language = model.getLanguageId();

    this.currentWindow.querySelector(".monaco-status-position").textContent =
      `Ln ${position.lineNumber}, Col ${position.column}`;

    if (!selection.isEmpty()) {
      const selectedText = model.getValueInRange(selection);
      const lines = selectedText.split("\n").length;
      const chars = selectedText.length;
      this.currentWindow.querySelector(".monaco-status-selection").textContent =
        `(${chars} chars, ${lines} lines selected)`;
    } else {
      this.currentWindow.querySelector(".monaco-status-selection").textContent = "";
    }

    this.currentWindow.querySelector(".monaco-status-language").textContent =
      language.charAt(0).toUpperCase() + language.slice(1);

    const options = editor.getOptions();
    const tabSize = options.get(monaco.editor.EditorOption.tabSize);
    const useSpaces = options.get(monaco.editor.EditorOption.insertSpaces);
    this.currentWindow.querySelector(".monaco-status-indent").textContent = useSpaces
      ? `Spaces: ${tabSize}`
      : `Tabs: ${tabSize}`;
  }

  resetIdleTimer(editorData) {
    if (this.idleTimer) clearTimeout(this.idleTimer);

    if (editorData.editor.getValue().trim().length > 0) {
      this.idleTimer = setTimeout(() => {
        speak("Looking good! Remember to save your work.", ClippyAnimation.IdleEyeBrowRaise);
      }, this.idleDelay);
    }
  }

  getActiveEditorData() {
    return this.tabs.get(this.activeTabId);
  }

  executeAction(action) {
    const editorData = this.getActiveEditorData();
    if (!editorData && action !== "newFile" && action !== "newWindow" && action !== "open") {
      return;
    }

    const editor = editorData?.editor;

    const actions = {
      newFile: () => this.createNewTab(),
      newWindow: () => {
        this.currentWindow = null;
        this.open();
      },
      open: () => this.openFileDialog(),
      save: () => this.saveFile(editorData),
      saveAs: () => this.saveAsFile(editorData),
      closeTab: () => this.closeTab(this.activeTabId),
      closeWindow: () => this.currentWindow.querySelector('[data-action="close"]').click(),

      undo: () => editor.trigger("keyboard", "undo"),
      redo: () => editor.trigger("keyboard", "redo"),
      cut: () => {
        editor.focus();
        document.execCommand("cut");
      },
      copy: () => {
        editor.focus();
        document.execCommand("copy");
      },
      paste: () => {
        editor.focus();
        navigator.clipboard.readText().then((text) => {
          editor.trigger("keyboard", "type", { text });
        });
      },
      selectAll: () => editor.setSelection(editor.getModel().getFullModelRange()),

      find: () => editor.trigger("keyboard", "actions.find"),
      replace: () => editor.trigger("keyboard", "editor.action.startFindReplaceAction"),
      findInSelection: () => {
        editor.trigger("keyboard", "actions.find");
        editor.trigger("keyboard", "toggleFindInSelection");
      },

      expandSelection: () => editor.trigger("keyboard", "editor.action.smartSelect.expand"),
      shrinkSelection: () => editor.trigger("keyboard", "editor.action.smartSelect.shrink"),
      copyLineUp: () => editor.trigger("keyboard", "editor.action.copyLinesUpAction"),
      copyLineDown: () => editor.trigger("keyboard", "editor.action.copyLinesDownAction"),
      moveLineUp: () => editor.trigger("keyboard", "editor.action.moveLinesUpAction"),
      moveLineDown: () => editor.trigger("keyboard", "editor.action.moveLinesDownAction"),
      duplicateSelection: () => editor.trigger("keyboard", "editor.action.duplicateSelection"),
      addCursorAbove: () => editor.trigger("keyboard", "editor.action.insertCursorAbove"),
      addCursorBelow: () => editor.trigger("keyboard", "editor.action.insertCursorBelow"),

      commandPalette: () => {
        this.showCommandPalette();
      },
      toggleTerminal: () => {
        this.toggleTerminalPanel();
      },
      spawnTerminalWindow: () => {
        this.spawnTerminalWindow();
      },
      terminalClear: () => {
        if (this.terminalOutput) {
          this.terminalOutput.innerHTML = "";
        }
      },
      zoomIn: () => {
        editorData.settings.fontSize += 2;
        editor.updateOptions({ fontSize: editorData.settings.fontSize });
      },
      zoomOut: () => {
        editorData.settings.fontSize = Math.max(8, editorData.settings.fontSize - 2);
        editor.updateOptions({ fontSize: editorData.settings.fontSize });
      },
      resetZoom: () => {
        editorData.settings.fontSize = 14;
        editor.updateOptions({ fontSize: 14 });
      },
      toggleMinimap: () => {
        editorData.settings.minimap = !editorData.settings.minimap;
        editor.updateOptions({ minimap: { enabled: editorData.settings.minimap } });
      },
      toggleWordWrap: () => {
        editorData.settings.wordWrap = !editorData.settings.wordWrap;
        editor.updateOptions({ wordWrap: editorData.settings.wordWrap ? "on" : "off" });
      },
      toggleLineNumbers: () => {
        editorData.settings.lineNumbers = !editorData.settings.lineNumbers;
        editor.updateOptions({ lineNumbers: editorData.settings.lineNumbers ? "on" : "off" });
      },
      toggleWhitespace: () => {
        const current = editorData.settings.renderWhitespace;
        editorData.settings.renderWhitespace = current === "all" ? "selection" : "all";
        editor.updateOptions({ renderWhitespace: editorData.settings.renderWhitespace });
      },
      changeLanguage: () => {
        const languages = [
          "javascript",
          "typescript",
          "html",
          "css",
          "json",
          "markdown",
          "python",
          "java",
          "csharp",
          "cpp",
          "php",
          "ruby",
          "go",
          "rust",
          "sql",
          "xml",
          "yaml",
          "shell",
          "plaintext"
        ];
        const current = editor.getModel().getLanguageId();
        const currentIndex = languages.indexOf(current);
        const nextIndex = (currentIndex + 1) % languages.length;
        monaco.editor.setModelLanguage(editor.getModel(), languages[nextIndex]);
        editorData.settings.language = languages[nextIndex];
        this.updateStatusBar(editorData);
        os.notify.send(`Switched to ${languages[nextIndex]}`);
      },
      changeTheme: () => {
        const themes = ["vs", "vs-dark", "hc-black"];
        const current = editorData.settings.theme;
        const currentIndex = themes.indexOf(current);
        const nextIndex = (currentIndex + 1) % themes.length;
        editorData.settings.theme = themes[nextIndex];
        monaco.editor.setTheme(themes[nextIndex]);
        os.notify.send(`Theme set to ${themes[nextIndex]}`);
      },
      toggleFullscreen: () => {
        if (!document.fullscreenElement) {
          this.currentWindow.requestFullscreen();
        } else {
          document.exitFullscreen();
        }
      },

      goToLine: () => editor.trigger("keyboard", "editor.action.gotoLine"),
      goToSymbol: () => editor.trigger("keyboard", "editor.action.quickOutline"),
      goToDefinition: () => editor.trigger("keyboard", "editor.action.revealDefinition"),
      peekDefinition: () => editor.trigger("keyboard", "editor.action.peekDefinition"),
      goToStart: () => editor.setPosition({ lineNumber: 1, column: 1 }),
      goToEnd: () => {
        const model = editor.getModel();
        const lastLine = model.getLineCount();
        const lastCol = model.getLineMaxColumn(lastLine);
        editor.setPosition({ lineNumber: lastLine, column: lastCol });
      },
      goBack: () => editor.trigger("keyboard", "workbench.action.navigateBack"),
      goForward: () => editor.trigger("keyboard", "workbench.action.navigateForward"),

      formatDocument: () => editor.trigger("keyboard", "editor.action.formatDocument"),
      formatSelection: () => editor.trigger("keyboard", "editor.action.formatSelection"),
      toggleComment: () => editor.trigger("keyboard", "editor.action.commentLine"),
      toggleBlockComment: () => editor.trigger("keyboard", "editor.action.blockComment"),
      indentLine: () => editor.trigger("keyboard", "editor.action.indentLines"),
      outdentLine: () => editor.trigger("keyboard", "editor.action.outdentLines"),

      trimWhitespace: () => {
        const model = editor.getModel();
        const value = model.getValue();
        const trimmed = value
          .split("\n")
          .map((line) => line.trimEnd())
          .join("\n");
        editor.executeEdits("trimWhitespace", [
          {
            range: model.getFullModelRange(),
            text: trimmed
          }
        ]);
        os.notify.send("Cleaned up trailing whitespace");
      },
      transformUppercase: () => {
        const selection = editor.getSelection();
        if (!selection.isEmpty()) {
          const text = editor.getModel().getValueInRange(selection);
          editor.executeEdits("uppercase", [
            {
              range: selection,
              text: text.toUpperCase()
            }
          ]);
        }
      },
      transformLowercase: () => {
        const selection = editor.getSelection();
        if (!selection.isEmpty()) {
          const text = editor.getModel().getValueInRange(selection);
          editor.executeEdits("lowercase", [
            {
              range: selection,
              text: text.toLowerCase()
            }
          ]);
        }
      },
      transformTitleCase: () => {
        const selection = editor.getSelection();
        if (!selection.isEmpty()) {
          const text = editor.getModel().getValueInRange(selection);
          const titleCase = text.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
          editor.executeEdits("titlecase", [
            {
              range: selection,
              text: titleCase
            }
          ]);
        }
      },

      sortLinesAsc: () => {
        const model = editor.getModel();
        const lines = model.getValue().split("\n");
        lines.sort((a, b) => a.localeCompare(b));
        editor.executeEdits("sortAsc", [
          {
            range: model.getFullModelRange(),
            text: lines.join("\n")
          }
        ]);
        os.notify.send("Sorted A → Z");
      },
      sortLinesDesc: () => {
        const model = editor.getModel();
        const lines = model.getValue().split("\n");
        lines.sort((a, b) => b.localeCompare(a));
        editor.executeEdits("sortDesc", [
          {
            range: model.getFullModelRange(),
            text: lines.join("\n")
          }
        ]);
        os.notify.send("Sorted Z → A");
      },
      removeDuplicates: () => {
        const model = editor.getModel();
        const lines = model.getValue().split("\n");
        const unique = [...new Set(lines)];
        editor.executeEdits("removeDuplicates", [
          {
            range: model.getFullModelRange(),
            text: unique.join("\n")
          }
        ]);
        os.notify.send(`Dropped ${lines.length - unique.length} duplicate lines`);
      },
      reverseLines: () => {
        const model = editor.getModel();
        const lines = model.getValue().split("\n");
        lines.reverse();
        editor.executeEdits("reverseLines", [
          {
            range: model.getFullModelRange(),
            text: lines.join("\n")
          }
        ]);
        os.notify.send("Reversed the order");
      },
      shuffleLines: () => {
        const model = editor.getModel();
        const lines = model.getValue().split("\n");
        for (let i = lines.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [lines[i], lines[j]] = [lines[j], lines[i]];
        }
        editor.executeEdits("shuffleLines", [
          {
            range: model.getFullModelRange(),
            text: lines.join("\n")
          }
        ]);
        os.notify.send("Mixed things up");
      },
      joinLines: () => {
        const selection = editor.getSelection();
        const model = editor.getModel();
        const range = selection.isEmpty() ? model.getFullModelRange() : selection;
        const text = model.getValueInRange(range);
        const joined = text
          .split("\n")
          .map((l) => l.trim())
          .join(" ");
        editor.executeEdits("joinLines", [{ range, text: joined }]);
      },
      splitLines: () => {
        const selection = editor.getSelection();
        if (!selection.isEmpty()) {
          const text = editor.getModel().getValueInRange(selection);
          const split = text.split(/\s+/).join("\n");
          editor.executeEdits("splitLines", [{ range: selection, text: split }]);
        }
      },
      countWords: () => {
        const text = editor.getValue();
        const words = text
          .trim()
          .split(/\s+/)
          .filter((w) => w.length > 0).length;
        const chars = text.length;
        const charsNoSpaces = text.replace(/\s/g, "").length;
        const lines = text.split("\n").length;
        os.notify.send(`Words: ${words} | Characters: ${chars} (${charsNoSpaces} without spaces) | Lines: ${lines}`);
      },
      base64Encode: () => {
        const selection = editor.getSelection();
        if (!selection.isEmpty()) {
          const text = editor.getModel().getValueInRange(selection);
          const encoded = btoa(text);
          editor.executeEdits("base64encode", [
            {
              range: selection,
              text: encoded
            }
          ]);
          os.notify.send("Encoded to Base64");
        }
      },
      base64Decode: () => {
        const selection = editor.getSelection();
        if (!selection.isEmpty()) {
          try {
            const text = editor.getModel().getValueInRange(selection);
            const decoded = atob(text);
            editor.executeEdits("base64decode", [
              {
                range: selection,
                text: decoded
              }
            ]);
            os.notify.send("Decoded from Base64");
          } catch (e) {
            os.notify.send("That's not valid Base64");
          }
        }
      },
      validateJSON: () => {
        try {
          JSON.parse(editor.getValue());
          os.notify.send("Valid JSON");
          speak("JSON looks good!", ClippyAnimation.GetWizardy);
        } catch (e) {
          os.notify.send(`Not valid JSON: ${e.message}`);
          speak("There's an error in your JSON.", ClippyAnimation.CheckingSomething);
        }
      },
      minifyJSON: () => {
        try {
          const obj = JSON.parse(editor.getValue());
          editor.setValue(JSON.stringify(obj));
          os.notify.send("Minified JSON");
        } catch (e) {
          os.notify.send(`Not valid JSON: ${e.message}`);
        }
      },
      beautifyJSON: () => {
        try {
          const obj = JSON.parse(editor.getValue());
          editor.setValue(JSON.stringify(obj, null, 2));
          os.notify.send("Beautified JSON");
        } catch (e) {
          os.notify.send(`Not valid JSON: ${e.message}`);
        }
      },

      showShortcuts: () => {
        const shortcuts = `File:\n  Ctrl+N - New Tab\n  Ctrl+Shift+N - New Window\n  Ctrl+O - Open File\n  Ctrl+S - Save\n  Ctrl+W - Close Tab\n  \nEdit:\n  Ctrl+Z - Undo\n  Ctrl+Y - Redo\n  Ctrl+F - Find\n  Ctrl+H - Replace\n  \nGo:\n  Ctrl+G - Go to Line\n  F12 - Go to Definition`;
        os.notify.send(shortcuts);
      },
      showDocs: () => window.open("https://code.visualstudio.com/docs", "_blank"),
      about: () => {
        showAboutDialog({
          title: "Yuki Code",
          version: "1.0.0",
          description:
            "A powerful code editor built on Monaco, the engine behind VS Code. Write, edit, and manage code with syntax highlighting, multi-tab editing, and an integrated terminal.",
          icon: "fas fa-code",
          iconType: "fontawesome"
        });
      }
    };

    if (actions[action]) {
      actions[action]();
      if (editor) editor.focus();
    }
  }

  async saveFile(editorData) {
    if (!editorData.filePath) {
      this.saveAsFile(editorData);
      return;
    }

    const content = editorData.editor.getValue();
    const filePath = Array.isArray(editorData.filePath)
      ? [...editorData.filePath, editorData.title]
      : [editorData.filePath, editorData.title].filter(Boolean).join("/");
    const exists = await os.fs.exists(filePath);

    if (exists) {
      const result = await showConflictDialog(editorData.title);
      if (result.action === "skip") return;
      if (result.action === "keep") {
        let uniqueName = editorData.title;
        let counter = 1;
        const lastDot = editorData.title.lastIndexOf(".");
        const baseName = lastDot !== -1 ? editorData.title.substring(0, lastDot) : editorData.title;
        const ext = lastDot !== -1 ? editorData.title.substring(lastDot) : "";
        while (
          await os.fs.exists(
            Array.isArray(editorData.filePath)
              ? [...editorData.filePath, uniqueName]
              : [editorData.filePath, uniqueName].filter(Boolean).join("/")
          )
        ) {
          uniqueName = `${baseName}_${counter}${ext}`;
          counter++;
        }
        const uniquePath = Array.isArray(editorData.filePath)
          ? [...editorData.filePath, uniqueName]
          : [editorData.filePath, uniqueName].filter(Boolean).join("/");
        await os.fs.write(uniquePath, content, { kind: "text" });
        editorData.title = uniqueName;
        editorData.isDirty = false;
        this.updateTabTitle(editorData.tabId, uniqueName, false);
        os.notify.send("Saved", `Saved: ${uniqueName}`);
        speak("Code saved successfully!", ClippyAnimation.Greeting);
        return;
      }
      await os.fs.write(filePath, content, { kind: "text" });
    } else {
      await os.fs.write(filePath, content, { kind: "text" });
    }

    editorData.isDirty = false;
    this.updateTabTitle(editorData.tabId, editorData.title, false);
    os.notify.send("Saved", `Saved: ${editorData.title}`);
    speak("Code saved successfully!", ClippyAnimation.Greeting);
  }

  saveAsFile(editorData) {
    const defaultName = editorData.title.includes(".") ? editorData.title : `${editorData.title}`;
    this.explorerApp.openSaveDialog(defaultName, async (path, fileName) => {
      const content = editorData.editor.getValue();
      const filePath = Array.isArray(path) ? [...path, fileName] : [path, fileName].filter(Boolean).join("/");
      const exists = await os.fs.exists(filePath);

      try {
        if (exists) {
          const result = await showConflictDialog(fileName);
          if (result.action === "skip") return;
          if (result.action === "keep") {
            let uniqueName = fileName;
            let counter = 1;
            const lastDot = fileName.lastIndexOf(".");
            const baseName = lastDot !== -1 ? fileName.substring(0, lastDot) : fileName;
            const ext = lastDot !== -1 ? fileName.substring(lastDot) : "";
            while (
              await os.fs.exists(
                Array.isArray(path) ? [...path, uniqueName] : [path, uniqueName].filter(Boolean).join("/")
              )
            ) {
              uniqueName = `${baseName}_${counter}${ext}`;
              counter++;
            }
            const uniquePath = Array.isArray(path)
              ? [...path, uniqueName]
              : [path, uniqueName].filter(Boolean).join("/");
            await os.fs.write(uniquePath, content, { kind: "text" });
            editorData.title = uniqueName;
            editorData.filePath = path;
            editorData.isDirty = false;
            this.updateTabTitle(editorData.tabId, uniqueName, false);
            const pathStr = path.length ? `/${path.join("/")}/${uniqueName}` : `/${uniqueName}`;
            os.notify.send("Saved", `Saved: ${pathStr}`);
            speak("Code saved successfully!", ClippyAnimation.Greeting);
            return;
          }
          await os.fs.write(filePath, content, { kind: "text" });
        } else {
          await os.fs.write(filePath, content, { kind: "text" });
        }

        editorData.title = fileName;
        editorData.filePath = path;
        editorData.isDirty = false;
        this.updateTabTitle(editorData.tabId, fileName, false);
        const pathStr = path.length ? `/${path.join("/")}/${fileName}` : `/${fileName}`;
        os.notify.send("Saved", `Saved: ${pathStr}`);
        speak("Code saved successfully!", ClippyAnimation.Greeting);
      } catch (e) {
        os.notify.send("Save error", "Couldn't save that file");
      }
    });
  }

  openFileDialog() {
    speak("Looking for some code?", ClippyAnimation.Searching);
    this.explorerApp.open(async (path, fileName) => {
      const filePath = Array.isArray(path) ? [...path, fileName] : [path, fileName].filter(Boolean).join("/");
      const content = await os.fs.read(filePath);
      this.open(fileName, content, path);
    }, this);
  }

  loadContent(fileName, content, filePath) {
    this.open(fileName, content, filePath);
  }
}
