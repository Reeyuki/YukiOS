import "../styles/terminal.css";
import { Achievements } from "../achievements.js";
import { KeybindManager } from "../keybindManager.js";
import { showContextMenu, hideMenu } from "../shared/contextMenu.js";
import { GitManager } from "../services/GitManager.js";
import { BusEvents, $, $$, BaseApp, StorageKeys, os, MODES, createElement, ServiceKeys } from "../framework.js";
import { formatSize } from "../utils/utils.js";
import { getExt } from "../shared/fileKindDetector.js";
import { getPyodide, runPython } from "../services/PyodideManager.js";
import { runNode } from "../services/WebContainerManager.js";
import { cmdYuki } from "./yukiCommand.js";
import { cmdHyprctl } from "./hyprctlCommand.js";
import { processManager } from "../services/ProcessManager.js";
import { audioMixer } from "../audioMixer.js";
import { YUKIOS_VERSION } from "./about.js";
import { CDN_BASES } from "../shared/assetResolver.js";
import { ShellEnvironment } from "../terminal/shellEnvironment.js";
import { ShellParser } from "../terminal/shellParser.js";
import { ShellInterpreter } from "../terminal/shellInterpreter.js";
import { CommandRegistry } from "../terminal/commands.js";
import { AnsiRenderer } from "../terminal/ansiRenderer.js";
import { TerminalRawMode, AltScreenManager, TerminalUIApp } from "../terminal/terminalUI.js";
import { renderPrompt } from "../terminal/prompt.js";
import { Stream, collectStream } from "../terminal/stream.js";
import { startVirtualHttpServer } from "../terminal/httpServer.js";

const termStateMap = new WeakMap();

export class TerminalApp extends BaseApp {
  windowsMap = new Map();
  activeState = null;

  constructor(os) {
    super(os);
    this.history = os.storage.get(StorageKeys.historyStorageKey) || [];
    this.historyIndex = this.history.length;
    this.displayName = os.storage.get(StorageKeys.username) || "guest";
    this.username = this.displayName;
    this.hostname = "yuki-os";
    this.setupSessionListener();
    this.commands = {};
    this.pageLoadTime = Date.now();
    this.env = {
      PATH: "/usr/bin:/bin",
      HOME: `/home/${this.displayName}`,
      USER: this.displayName,
      SHELL: "/bin/yush",
      TERM: "xterm-256color"
    };
    this.aliases = os.storage.get(StorageKeys.terminalAliases) || {};
    this.fs = os.fileSystemManager;
    this.gitManager = new GitManager(this.fs);

    this.shellEnv = new ShellEnvironment({
      ...this.env,
      PWD: `/home/${this.displayName}`,
      HOSTNAME: this.hostname
    });
    this.shellParser = new ShellParser();
    this.commandRegistry = new CommandRegistry();
    this.ansiRenderer = null;
    this.shellInterpreter = null;
    this.rawModeInstance = null;
    this.altScreenInstance = null;
    this.stopRequested = false;

    this.registerDefaultCommands();
    this.initPerWindowGetters();
    this.perWindowDefaults = this.createState({}, null);
  }

  createState(win, opts) {
    const initialPath = opts?.initialPath || ["home", this.displayName];
    return {
      win,
      terminalOutput: null,
      terminalInput: null,
      terminalPrompt: null,
      terminalInputLine: null,
      terminalContent: null,
      terminalTabsEl: null,
      tabs: [{ id: 1, currentPath: [...initialPath], outputHTML: "", commands: [] }],
      activeTabId: 1,
      tabCounter: 1,
      currentPath: [...initialPath],
      commandRunning: false,
      isPrinting: false,
      inputBuffer: "",
      printDepth: 0,
      printQueue: Promise.resolve(),
      pagerActive: false,
      reverseSearchActive: false,
      reverseSearchQuery: "",
      reverseSearchIndex: -1,
      reverseSearchOriginalPrompt: null,
      pyReplActive: false,
      pyReplBuffer: "",
      pyReplContinuation: false,
      nodeReplActive: false,
      nodeReplBuffer: "",
      nodeReplContinuation: false,
      nodeFallbackWarned: false,
      lastExitCode: 0,
      lavatActive: false,
      lavatIframeCleanup: null,
      lavatWinHandler: null,
      btopActive: false,
      btopInterval: null,
      btopIframeCleanup: null,
      btopWinHandler: null,
      cmatrixActive: false,
      cmatrixIframeCleanup: null,
      cmatrixWinHandler: null
    };
  }

  buildCommandContext() {
    const self = this;
    return {
      print: (text, color) => {
        if (color) self.enqueuePrint(text, color);
        else self.enqueuePrint(text);
      },
      printError: (text) => self.enqueuePrint(text, "var(--error)"),
      get stopRequested() {
        return self.stopRequested;
      },
      getPath: () => {
        const p = self.currentPath;
        return p.length ? "/" + p.join("/") : "/";
      },
      setPath: (path) => {
        if (typeof path === "string") {
          self.currentPath = self.splitPath(path);
        } else {
          self.currentPath = [...path];
        }
        self.shellEnv.set("PWD", self.getPath());
      },
      getHistory: () => self.history,
      setExitCode: (code) => {
        if (self.activeState) self.activeState.lastExitCode = code;
      },
      env: self.shellEnv,
      fs: self.fs,
      signal: (sig) => {
        if (sig === "EXIT") self.cmdExit();
        else if (sig === "CLEAR") self.cmdClear();
        else if (sig === "SHUTDOWN") self.cmdShutdown();
        else if (sig === "REBOOT") self.cmdReboot();
        else if (sig === "LOCK") self.cmdLock();
        else if (sig === "LOGOUT") self.cmdLogout();
        else if (sig === "INTERRUPT") {
          self.stopRequested = true;
        }
      },
      resolvePath: (target) => self.resolvePath(target),
      pathToAbs: (p) => {
        const resolved = Array.isArray(p) ? p : self.fs.resolvePath(p, self.currentPath);
        return self.pathToString(resolved);
      },
      formatSize: (bytes) => formatSize(bytes),
      rawMode: self.rawModeInstance,
      altScreen: self.altScreenInstance,
      hasCommand: (name) => self.commandRegistry.has(name) || !!self.commands[name],
      executeCommand: async (name, args, io) => {
        if (self.commandRegistry.has(name)) {
          return self.commandRegistry.execute(name, args, self.buildCommandContext());
        }
        const handler = self.commands[name];
        if (handler) {
          await handler(args, []);
          return { exitCode: self.activeState?.lastExitCode ?? 0 };
        }
        return { exitCode: 127 };
      },
      expandString: (str) => self.expandWithEnv(str),
      printInline: (text, colors) => {
        const state = self.activeState;
        if (!state) return;
        const line = createElement("div");
        for (let i = 0; i < text.length; i++) {
          const span = createElement("span");
          const [r, g, b] = colors[i % colors.length];
          span.style.color = `rgb(${r},${g},${b})`;
          span.textContent = text[i];
          line.appendChild(span);
        }
        state.terminalOutput.appendChild(line);
        requestAnimationFrame(() => {
          if (self.isNearBottom(state)) {
            line.scrollIntoView({ block: "end", behavior: "instant" });
          }
        });
      }
    };
  }

  expandWithEnv(str) {
    return this.shellEnv.expandWord(str, (cmdStr) => {
      this.executeInlineSubstitution(cmdStr);
      return "";
    });
  }

  executeInlineSubstitution(cmdStr) {
    const ast = this.shellParser.parse(cmdStr);
    if (!this.shellInterpreter) {
      this.shellInterpreter = new ShellInterpreter({});
    }
  }

  resolvePath(target) {
    const resolved = this.fs.resolvePath(target, this.currentPath);
    return resolved;
  }

  splitPath(pathStr) {
    if (pathStr === "/") return [];
    return pathStr.split("/").filter(Boolean);
  }

  async executeShellScript(script) {
    const ctx = this.buildCommandContext();
    if (!this.shellInterpreter) {
      this.shellInterpreter = new ShellInterpreter(ctx);
    }
    const ast = this.shellParser.parse(script);
    const result = await this.shellInterpreter.execute(ast);
    return result.exitCode;
  }

  ensureAnsiRenderer() {
    if (!this.ansiRenderer && this.terminalOutput) {
      this.ansiRenderer = new AnsiRenderer(this.terminalOutput);
    }
    return this.ansiRenderer;
  }

  setupStopButton() {
    const container = this.terminalInputLine?.parentElement;
    if (!container) return;
    let btn = container.querySelector(".terminal-stop-btn");
    if (btn) return;
    btn = createElement("button");
    btn.className = "terminal-stop-btn";
    btn.textContent = "Stop";
    btn.title = "Interrupt running command (SIGINT)";
    btn.style.cssText = `
      display: none;
      position: absolute;
      bottom: 40px;
      right: 8px;
      padding: 4px 12px;
      background: var(--error, #cc0000);
      color: #fff;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      z-index: 10;
      opacity: 0.9;
    `;
    btn.addEventListener("click", () => {
      this.stopRequested = true;
      if (this.rawModeInstance && this.rawModeInstance.active) {
        this.rawModeInstance.disable();
      }
      if (this.altScreenInstance && this.altScreenInstance.active) {
        this.altScreenInstance.exit();
      }
      this.terminalInputLine.style.display = "flex";
      this.terminalInput.disabled = false;
      this.terminalInput.focus();
    });
    container.style.position = "relative";
    container.appendChild(btn);
    this.stopBtn = btn;
  }

  showStopButton(show) {
    if (this.stopBtn) {
      this.stopBtn.style.display = show ? "block" : "none";
    }
  }

  enterRawMode(onKey, onResize) {
    const outputEl = this.terminalOutput;
    const inputEl = this.terminalInput;
    if (!outputEl || !inputEl) return null;
    this.rawModeInstance = new TerminalRawMode(outputEl, inputEl);
    this.rawModeInstance.enable(onKey, onResize);
    this.altScreenInstance = new AltScreenManager(this.terminalContent);
    this.altScreenInstance.enter();
    return this.rawModeInstance;
  }

  exitRawMode() {
    if (this.altScreenInstance && this.altScreenInstance.active) {
      this.altScreenInstance.exit();
    }
    if (this.rawModeInstance && this.rawModeInstance.active) {
      this.rawModeInstance.disable();
    }
    this.rawModeInstance = null;
    this.altScreenInstance = null;
    this.terminalInputLine.style.display = "flex";
    this.terminalInput.disabled = false;
    this.terminalInput.focus();
  }

  renderAnsiOutput(text) {
    const renderer = this.ensureAnsiRenderer();
    if (renderer && text.includes("\x1b[")) {
      return renderer.renderLine(text);
    }
    const line = createElement("div");
    line.appendChild(document.createTextNode(text));
    this.terminalOutput.appendChild(line);
    return line;
  }

  initPerWindowGetters() {
    const perWindowProps = [
      "win",
      "terminalOutput",
      "terminalInput",
      "terminalPrompt",
      "terminalInputLine",
      "terminalContent",
      "terminalTabsEl",
      "tabs",
      "activeTabId",
      "tabCounter",
      "currentPath",
      "commandRunning",
      "isPrinting",
      "inputBuffer",
      "printDepth",
      "printQueue",
      "pagerActive",
      "reverseSearchActive",
      "reverseSearchQuery",
      "reverseSearchIndex",
      "reverseSearchOriginalPrompt",
      "pyReplActive",
      "pyReplBuffer",
      "pyReplContinuation",
      "nodeReplActive",
      "nodeReplBuffer",
      "nodeReplContinuation",
      "nodeFallbackWarned",
      "lastExitCode",
      "lavatActive",
      "lavatIframeCleanup",
      "lavatWinHandler",
      "btopActive",
      "btopInterval",
      "btopIframeCleanup",
      "btopWinHandler",
      "cmatrixActive",
      "cmatrixIframeCleanup",
      "cmatrixWinHandler"
    ];
    for (const prop of perWindowProps) {
      Object.defineProperty(this, prop, {
        get() {
          return this.activeState && prop in this.activeState ? this.activeState[prop] : this.perWindowDefaults?.[prop];
        },
        set(val) {
          if (this.activeState) {
            this.activeState[prop] = val;
          } else if (this.perWindowDefaults) {
            this.perWindowDefaults[prop] = val;
          }
        }
      });
    }
  }

  setupTilingObserver() {
    if (this.tilingObserver) return;
    this.tilingObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName === "class" && m.target === document.body) {
          this.updateTabsVisibility();
        }
      }
    });
    this.tilingObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }

  updateTabsVisibility() {
    const isTiling = os.modes.isActive(MODES.TILING);
    for (const state of this.windowsMap.values()) {
      if (state.terminalTabsEl) {
        state.terminalTabsEl.classList.toggle("hidden", isTiling || state.tabs.length <= 1);
      }
    }
  }

  open(opts) {
    const winId = "terminal-win-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
    const win = os.window.create(winId, "Terminal", "700px", "500px", {
      ...opts,
      icon: "static/icons/terminal.webp"
    });
    const state = this.createState(win, opts);
    this.windowsMap.set(winId, state);
    this.activeState = state;
    state.win = win;
    win.innerHTML = `<div class="window-content terminal-content">
      <div class="terminal-tabs" id="terminal-tabs"></div>
      <div class="terminal-output" id="terminal-output"></div>
      <div class="terminal-input-line" id="terminal-input-line">
        <span id="terminal-prompt"></span>
        <textarea class="terminal-input" id="terminal-input" spellcheck="false" autocomplete="off" rows="1"></textarea>
      </div>
    </div>`;
    state.terminalContent = win.querySelector(".terminal-content");
    termStateMap.set(win, state);
    termStateMap.set(state.terminalContent, state);

    state.terminalContent.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.activeState = state;
      const tabEl = e.target.closest(".terminal-tab");
      if (tabEl) {
        const tabIdx = Array.from(state.terminalTabsEl.children).indexOf(tabEl);
        const tab = state.tabs[tabIdx];
        if (tab) this.showTabContextMenu(e, tab, tabIdx);
      } else {
        this.showTerminalContextMenu(e);
      }
    });

    this.initTerminal(win, opts);
  }

  initTerminal(win, opts) {
    const initialPath = opts?.initialPath || null;
    if (initialPath) this.currentPath = initialPath;
    this.terminalOutput = win.querySelector("#terminal-output");
    this.terminalInput = win.querySelector("#terminal-input");
    this.terminalPrompt = win.querySelector("#terminal-prompt");
    this.terminalInputLine = win.querySelector("#terminal-input-line");
    this.terminalContent = win.querySelector(".terminal-content");
    this.terminalTabsEl = win.querySelector("#terminal-tabs");
    this.tabs = [{ id: 1, currentPath: [...this.currentPath], outputHTML: "", commands: [] }];
    this.activeTabId = 1;
    this.tabCounter = 1;
    this.renderTabs();
    this.setupTilingObserver();
    this.updateTabsVisibility();
    this.updatePrompt();
    this.setupEventHandlers();
    this.setupStopButton();
    this.pyReplActive = false;
    this.pyReplBuffer = "";
    this.pyReplContinuation = false;
    this.nodeReplActive = false;
    this.nodeReplBuffer = "";
    this.nodeReplContinuation = false;
    this.nodeFallbackWarned = false;
    termStateMap.set(this.terminalInput, this.activeState);
    this.terminalInput.addEventListener("input", () => {
      this.terminalInput.style.height = "auto";
      this.terminalInput.style.height = this.terminalInput.scrollHeight + "px";
    });

    if (opts?.autoCommand) {
      this.terminalInput.value = opts.autoCommand;
      requestAnimationFrame(() => this.runEnteredCommand());
    }
  }

  setupSessionListener() {
    os.events.on(BusEvents.SESSION_INITIALIZED, (session) => {
      this.displayName = session.name || os.storage.get(StorageKeys.username) || "guest";
      this.username = this.displayName;
      this.currentPath = ["home", this.displayName];
      this.env.HOME = `/home/${this.displayName}`;
      this.env.USER = this.displayName;
      this.updatePrompt();
    });
  }

  pathToString(path) {
    if (typeof path === "string") return path;
    if (!Array.isArray(path) || path.length === 0) return "/";
    return "/" + path.join("/");
  }

  pathToRelative(path) {
    if (typeof path === "string") {
      if (path.startsWith("/home/")) {
        const parts = path.split("/").slice(3);
        return parts.join("/");
      }
      return path;
    }
    if (!Array.isArray(path) || path.length === 0) return "";
    if (path.length >= 2 && path[0] === "home") {
      return path.slice(2).join("/");
    }
    return path.join("/");
  }

  isNearBottom(state) {
    const el = state.terminalContent;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 50;
  }

  async print(text, color = null, isCommand = false, promptText = null, delay = 1) {
    const state = this.activeState;
    if (!state) return;
    if (this.stopRequested) return;
    state.printDepth++;
    if (state.printDepth === 1) {
      state.isPrinting = true;
      state.inputBuffer = state.terminalInput.value;
      state.terminalInput.value = "";
      state.terminalInput.disabled = true;
    }

    let line;
    if (isCommand) {
      line = createElement("div");
      const prompt = createElement("span");
      prompt.innerHTML = promptText || this.promptHtml();
      line.className = "cmd-line";
      line.appendChild(prompt);
      const span = createElement("span");
      span.className = "cmd-text";
      span.textContent = text;
      line.appendChild(span);
      state.terminalOutput.appendChild(line);
    } else if (text && text.includes("\x1b[")) {
      const renderer = this.ensureAnsiRenderer();
      if (renderer) {
        line = renderer.render(text);
        if (color) line.style.color = color;
        state.terminalOutput.appendChild(line);
      } else {
        line = createElement("div");
        const span = createElement("span");
        if (color) span.style.color = color;
        span.textContent = text;
        line.appendChild(span);
        state.terminalOutput.appendChild(line);
      }
    } else if (color || text?.includes("\x1b")) {
      line = createElement("div");
      const span = createElement("span");
      if (color) span.style.color = color;
      span.textContent = text;
      line.appendChild(span);
      state.terminalOutput.appendChild(line);
    } else if (text !== null && text !== undefined) {
      line = createElement("div");
      const textNode = document.createTextNode(text);
      line.appendChild(textNode);
      state.terminalOutput.appendChild(line);
    }

    if (line) {
      requestAnimationFrame(() => {
        if (this.isNearBottom(state)) {
          line.scrollIntoView({ block: "end", behavior: "instant" });
        }
      });
    }

    state.printDepth--;
    if (state.printDepth === 0) {
      state.isPrinting = false;
      state.terminalInput.disabled = state.pagerActive || state.commandRunning;
      state.terminalInput.value = state.inputBuffer;
      if (!state.pagerActive && !state.commandRunning) state.terminalInput.focus();
    }
  }

  enqueuePrint(text, color = null, isCommand = false, promptText = null, delay = 1) {
    const state = this.activeState;
    if (!state) return;
    state.printQueue = state.printQueue.then(() => this.print(text, color, isCommand, promptText, delay));
    return state.printQueue;
  }

  async runEnteredCommand() {
    const state = this.activeState;
    if (!state || state.commandRunning) return;
    const command = state.terminalInput.value.trim();
    if (state.pyReplActive || state.nodeReplActive) {
      state.terminalInput.value = "";
      state.terminalInputLine.style.display = "none";
      state.commandRunning = true;
      try {
        if (state.pyReplActive) await this.runPythonRepl(command);
        else await this.runNodeRepl(command);
      } finally {
        state.commandRunning = false;
        if (!state.lavatActive && !state.btopActive && !state.cmatrixActive) {
          state.terminalInputLine.style.display = "flex";
        }
        state.terminalInput.disabled = false;
        state.terminalInput.focus();
        requestAnimationFrame(() => state.terminalInputLine.scrollIntoView({ block: "end", behavior: "instant" }));
      }
      return;
    }
    if (!command) return;
    this.history.push(command);
    this.historyIndex = this.history.length;
    os.storage.set(StorageKeys.historyStorageKey, this.history.slice(-500));
    state.terminalInput.value = "";
    state.terminalInputLine.style.display = "none";
    state.commandRunning = true;
    this.stopRequested = false;
    this.showStopButton(true);
    try {
      await this.executeCommand(command);
    } finally {
      state.commandRunning = false;
      this.showStopButton(false);
      if (!state.lavatActive && !state.btopActive && !state.cmatrixActive) {
        state.terminalInputLine.style.display = "flex";
      }
      state.terminalInput.disabled = false;
      state.terminalInput.focus();
      requestAnimationFrame(() => state.terminalInputLine.scrollIntoView({ block: "end", behavior: "instant" }));
    }
  }

  setupEventHandlers() {
    this.terminalInput.addEventListener("keydown", (e) => {
      this.activeState = termStateMap.get(e.currentTarget);
      if (this.commandRunning) return;
      if (this.reverseSearchActive) {
        this.handleReverseSearchKey(e);
        return;
      }

      if (KeybindManager.matches(e, "terminal.execute") && !e.shiftKey) {
        e.preventDefault();
        this.runEnteredCommand();
      } else if (KeybindManager.matches(e, "terminal.historyUp") && this.historyIndex > 0) {
        e.preventDefault();
        this.terminalInput.value = this.history[--this.historyIndex];
      } else if (KeybindManager.matches(e, "terminal.historyDown")) {
        e.preventDefault();
        this.historyIndex = Math.min(this.historyIndex + 1, this.history.length);
        this.terminalInput.value = this.historyIndex < this.history.length ? this.history[this.historyIndex] : "";
      } else if (KeybindManager.matches(e, "terminal.tabComplete")) {
        e.preventDefault();
        this.handleTabCompletion();
      } else if (KeybindManager.matches(e, "terminal.clear")) {
        e.preventDefault();
        this.cmdClear();
      } else if (KeybindManager.matches(e, "terminal.interrupt")) {
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) return;
        e.preventDefault();
        this.stopRequested = true;
        if (this.pyReplActive || this.nodeReplActive) {
          if (this.pyReplActive) {
            this.pyReplBuffer = "";
            this.pyReplContinuation = false;
          }
          if (this.nodeReplActive) {
            this.nodeReplBuffer = "";
            this.nodeReplContinuation = false;
          }
          this.updatePrompt();
          this.enqueuePrint("^C");
          this.terminalInput.value = "";
          return;
        }
        this.enqueuePrint("^C", null, true, this.promptHtml());
        this.terminalInput.value = "";
      } else if (e.ctrlKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        e.stopPropagation();
        if (this.pyReplActive) {
          this.pyReplBuffer = "";
          this.pyReplContinuation = false;
          this.updatePrompt();
          this.enqueuePrint("exit()", null, true, `<span class="prompt-python">>>> </span>`);
          this.exitPythonRepl();
          return;
        }
        if (this.nodeReplActive) {
          this.nodeReplBuffer = "";
          this.nodeReplContinuation = false;
          this.updatePrompt();
          this.enqueuePrint(".exit", null, true, `<span class="prompt-node">> </span>`);
          this.exitNodeRepl();
          return;
        }
        this.closeTabOrWindow();
        return;
      } else if (KeybindManager.matches(e, "terminal.close")) {
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) return;
        if (this.terminalInput.value.length > 0) return;
        e.preventDefault();
        this.closeTabOrWindow();
        return;
      } else if (e.ctrlKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        this.enterReverseSearch();
      } else if (e.altKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        e.stopPropagation();
        this.newTab();
      } else if (e.altKey && /^[1-9]$/.test(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        const idx = parseInt(e.key, 10) - 1;
        const tab = this.tabs[idx];
        if (tab) this.switchTab(tab.id);
      } else if (e.key === "Tab" && e.ctrlKey) {
        e.preventDefault();
        this.cycleTab(e.shiftKey ? -1 : 1);
      } else if (e.key === "Backspace" && (e.altKey || e.ctrlKey)) {
        e.preventDefault();
        this.deleteWordBackward();
      } else if (e.key === "ArrowLeft" && e.ctrlKey) {
        e.preventDefault();
        this.jumpWord(-1);
      } else if (e.key === "ArrowRight" && e.ctrlKey) {
        e.preventDefault();
        this.jumpWord(1);
      }
    });

    const win = this.win;
    if (!win) return;

    win.addEventListener("mousedown", (e) => {
      this.activeState = termStateMap.get(e.currentTarget);
      if (e.target.closest(".terminal-content")) return;
      const selection = window.getSelection();
      if (selection) selection.removeAllRanges();
    });

    win.addEventListener("mouseup", (e) => {
      this.activeState = termStateMap.get(e.currentTarget);
      if (e.button === 2) return;
      if (e.target.closest(".terminal-output")) return;
      if (window.getSelection().toString().length > 0) return;
      this.terminalInput.focus();
    });
  }

  jumpWord(direction) {
    const input = this.terminalInput;
    const value = input.value;
    let pos = input.selectionStart;
    if (direction < 0) {
      while (pos > 0 && /\s/.test(value[pos - 1])) pos--;
      while (pos > 0 && !/\s/.test(value[pos - 1])) pos--;
    } else {
      while (pos < value.length && /\s/.test(value[pos])) pos++;
      while (pos < value.length && !/\s/.test(value[pos])) pos++;
    }
    input.selectionStart = input.selectionEnd = pos;
  }

  deleteWordBackward() {
    const input = this.terminalInput;
    const value = input.value;
    let pos = input.selectionStart;
    const end = pos;
    while (pos > 0 && /\s/.test(value[pos - 1])) pos--;
    while (pos > 0 && !/\s/.test(value[pos - 1])) pos--;
    input.value = value.slice(0, pos) + value.slice(end);
    input.selectionStart = input.selectionEnd = pos;
  }

  enterReverseSearch() {
    this.reverseSearchActive = true;
    this.reverseSearchQuery = "";
    this.reverseSearchIndex = this.history.length;
    this.reverseSearchOriginalPrompt = this.terminalPrompt.innerHTML;
    this.updateReverseSearchDisplay();
  }

  exitReverseSearch(accept) {
    this.reverseSearchActive = false;
    this.terminalPrompt.innerHTML = this.reverseSearchOriginalPrompt || this.promptHtml();
    if (!accept) this.terminalInput.value = "";
  }

  updateReverseSearchDisplay() {
    let match = "";
    if (this.reverseSearchQuery) {
      for (let i = this.reverseSearchIndex; i >= 0; i--) {
        if (this.history[i] && this.history[i].includes(this.reverseSearchQuery)) {
          match = this.history[i];
          this.reverseSearchIndex = i;
          break;
        }
      }
    }
    this.terminalPrompt.innerHTML = `<span class="prompt-reverse">(reverse-i-search)\`${this.reverseSearchQuery}': </span>`;
    this.terminalInput.value = match;
  }

  reverseSearchStep() {
    if (!this.reverseSearchQuery) return;
    for (let i = this.reverseSearchIndex - 1; i >= 0; i--) {
      if (this.history[i] && this.history[i].includes(this.reverseSearchQuery)) {
        this.reverseSearchIndex = i;
        this.terminalInput.value = this.history[i];
        return;
      }
    }
  }

  handleReverseSearchKey(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      this.exitReverseSearch(false);
      return;
    }
    if (KeybindManager.matches(e, "terminal.execute")) {
      e.preventDefault();
      this.exitReverseSearch(true);
      this.runEnteredCommand();
      return;
    }
    if (e.ctrlKey && e.key.toLowerCase() === "r") {
      e.preventDefault();
      this.reverseSearchStep();
      return;
    }
    if (e.key === "Backspace") {
      e.preventDefault();
      this.reverseSearchQuery = this.reverseSearchQuery.slice(0, -1);
      this.reverseSearchIndex = this.history.length;
      this.updateReverseSearchDisplay();
      return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      this.reverseSearchQuery += e.key;
      this.reverseSearchIndex = this.history.length;
      this.updateReverseSearchDisplay();
      return;
    }
    e.preventDefault();
  }

  closeTabOrWindow() {
    if (this.tabs.length > 1) {
      this.closeTab(this.activeTabId);
    } else {
      this.cmdExit();
    }
  }

  snapshotActiveTab() {
    if (this.lavatActive) this.stopLavat();
    if (this.btopActive) this.stopBtop();
    if (this.cmatrixActive) this.stopCmatrix();
    const tab = this.tabs.find((t) => t.id === this.activeTabId);
    if (!tab) return;
    tab.currentPath = [...this.currentPath];
    tab.outputHTML = this.terminalOutput.innerHTML;
  }

  newTab() {
    this.snapshotActiveTab();
    const id = ++this.tabCounter;
    const tab = { id, currentPath: ["home", this.displayName], outputHTML: "", commands: [] };
    this.tabs.push(tab);
    this.activeTabId = id;
    this.currentPath = [...tab.currentPath];
    this.terminalOutput.innerHTML = "";
    this.updatePrompt();
    this.renderTabs();
    this.terminalInput.focus();
  }

  switchTab(id) {
    if (id === this.activeTabId) return;
    this.snapshotActiveTab();
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) return;
    this.activeTabId = id;
    this.currentPath = [...tab.currentPath];
    this.terminalOutput.innerHTML = tab.outputHTML;
    this.terminalOutput.parentElement.scrollTop = this.terminalOutput.parentElement.scrollHeight;
    this.updatePrompt();
    this.renderTabs();
    this.terminalInput.focus();
  }

  closeTab(id) {
    const idx = this.tabs.findIndex((t) => t.id === id);
    if (idx === -1) return;
    if (this.tabs.length === 1) {
      this.cmdExit();
      return;
    }
    this.tabs.splice(idx, 1);
    if (this.activeTabId === id) {
      const next = this.tabs[Math.max(0, idx - 1)];
      this.activeTabId = next.id;
      this.currentPath = [...next.currentPath];
      this.terminalOutput.innerHTML = next.outputHTML;
      this.updatePrompt();
    }
    this.renderTabs();
    this.terminalInput.focus();
  }

  cycleTab(direction) {
    const idx = this.tabs.findIndex((t) => t.id === this.activeTabId);
    const nextIdx = (idx + direction + this.tabs.length) % this.tabs.length;
    this.switchTab(this.tabs[nextIdx].id);
  }

  renderTabs() {
    const state = this.activeState;
    if (!state || !state.terminalTabsEl) return;
    state.terminalTabsEl.innerHTML = "";
    state.terminalTabsEl.classList.toggle("hidden", state.tabs.length <= 1);

    state.tabs.forEach((tab, i) => {
      const el = createElement("div");
      el.className = "terminal-tab" + (tab.id === state.activeTabId ? " active" : "");
      el.style.flex = "1 1 0";
      el.style.minWidth = "0";

      const label = createElement("span");
      label.className = "terminal-tab-label";
      label.textContent = tab.commands.length ? tab.commands.join(" ") : `Tab ${i + 1}`;
      el.appendChild(label);

      const closeBtn = createElement("span");
      closeBtn.className = "terminal-tab-close";
      closeBtn.textContent = "\u00d7";
      closeBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        this.activeState = state;
        this.closeTab(tab.id);
      });
      el.appendChild(closeBtn);

      el.addEventListener("click", () => {
        this.activeState = state;
        this.switchTab(tab.id);
      });

      state.terminalTabsEl.appendChild(el);
    });

    const newTabBtn = createElement("div");
    newTabBtn.className = "terminal-tab-add";
    newTabBtn.textContent = "+";
    newTabBtn.addEventListener("click", () => {
      this.activeState = state;
      this.newTab();
    });
    state.terminalTabsEl.appendChild(newTabBtn);
  }

  showTerminalContextMenu(e) {
    const getSelectionText = () => {
      const docSel = window.getSelection().toString();
      if (docSel) return docSel;
      const input = this.terminalInput;
      if (input && input.selectionStart !== input.selectionEnd) {
        return input.value.substring(input.selectionStart, input.selectionEnd);
      }
      return "";
    };
    const hasSelection = getSelectionText().length > 0;
    hideMenu();
    const items = [
      { id: "term-ctx-copy", label: "Copy", icon: "fa-copy", action: "copy", condition: () => hasSelection },
      { id: "term-ctx-paste", label: "Paste", icon: "fa-paste", action: "paste" },
      { id: "term-ctx-selectall", label: "Select All", icon: "fa-object-group", action: "selectAll" },
      "hr",
      { id: "term-ctx-newtab", label: "New Tab", icon: "fa-plus", action: "newTab" },
      { id: "term-ctx-clear", label: "Clear", icon: "fa-eraser", action: "clear" }
    ];

    const handlers = {
      copy: () => {
        const text = getSelectionText();
        if (text) navigator.clipboard?.writeText(text);
      },
      paste: async () => {
        try {
          const text = await navigator.clipboard.readText();
          if (text) {
            const input = this.terminalInput;
            const pos = input.selectionStart;
            input.value = input.value.slice(0, pos) + text + input.value.slice(pos);
            input.selectionStart = input.selectionEnd = pos + text.length;
            input.focus();
          }
        } catch {}
      },
      selectAll: () => {
        const range = document.createRange();
        range.selectNodeContents(this.terminalOutput);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      },
      newTab: () => this.newTab(),
      clear: () => this.cmdClear()
    };

    showContextMenu(e, items, handlers);
  }

  showTabContextMenu(e, tab, idx) {
    hideMenu();
    const isActive = tab.id === this.activeTabId;
    const items = [
      { id: "tabctx-" + tab.id + "-close", label: "Close Tab", icon: "fa-times", action: "close" },
      {
        id: "tabctx-" + tab.id + "-close-others",
        label: "Close Other Tabs",
        icon: "fa-times-circle",
        action: "closeOthers",
        condition: () => this.tabs.length > 1
      },
      {
        id: "tabctx-" + tab.id + "-close-right",
        label: "Close Tabs to the Right",
        icon: "fa-chevron-right",
        action: "closeRight",
        condition: () => idx < this.tabs.length - 1
      },
      "hr",
      { id: "tabctx-" + tab.id + "-new", label: "New Tab", icon: "fa-plus", action: "newTab" }
    ];

    const handlers = {
      close: () => this.closeTab(tab.id),
      closeOthers: () => this.closeOtherTabs(tab.id),
      closeRight: () => this.closeTabsToTheRight(tab.id, idx),
      newTab: () => this.newTab()
    };

    showContextMenu(e, items, handlers);
  }

  closeOtherTabs(id) {
    const state = this.activeState;
    if (!state || state.tabs.length <= 1) return;
    this.snapshotActiveTab();
    state.tabs = state.tabs.filter((t) => t.id === id);
    if (this.activeTabId !== id) {
      this.activeTabId = id;
      const tab = state.tabs[0];
      this.currentPath = [...tab.currentPath];
      this.terminalOutput.innerHTML = tab.outputHTML;
      this.updatePrompt();
    }
    this.renderTabs();
    this.terminalInput.focus();
  }

  closeTabsToTheRight(id, idx) {
    const state = this.activeState;
    if (!state || idx >= state.tabs.length - 1) return;
    this.snapshotActiveTab();
    state.tabs = state.tabs.slice(0, idx + 1);
    if (this.activeTabId !== id) {
      this.activeTabId = id;
      const tab = state.tabs[idx];
      this.currentPath = [...tab.currentPath];
      this.terminalOutput.innerHTML = tab.outputHTML;
      this.updatePrompt();
    }
    this.renderTabs();
    this.terminalInput.focus();
  }

  async expandGlob(pattern, path) {
    const parts = pattern.split("/");
    const filePattern = parts.pop();
    const dirPath = parts.length > 0 ? this.fs.resolvePath(parts.join("/"), path) : path;

    const items = Object.keys(await this.fs.getFolder(this.pathToString(dirPath)));
    const regex = new RegExp("^" + filePattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
    const matches = items.filter((item) => regex.test(item));

    if (parts.length > 0) {
      return matches.map((item) => [...parts, item].join("/"));
    }
    return matches;
  }

  async expandGlobsInArgs(args, path) {
    const expanded = [];
    for (const arg of args) {
      if (arg.includes("*") || arg.includes("?")) {
        const matches = await this.expandGlob(arg, path);
        if (matches.length > 0) {
          expanded.push(...matches);
        } else {
          expanded.push(arg);
        }
      } else {
        expanded.push(arg);
      }
    }
    return expanded;
  }

  expandTilde(token) {
    const home = `/home/${this.displayName}`;
    if (token === "~") return home;
    if (token.startsWith("~/")) return home + token.slice(1);
    return token;
  }

  getEnvValue(name) {
    return Object.prototype.hasOwnProperty.call(this.env, name) ? this.env[name] : "";
  }

  expandVariables(str) {
    this.shellEnv.set("PWD", this.currentPath.length ? "/" + this.currentPath.join("/") : "/");
    this.shellEnv.set("?", String(this.activeState?.lastExitCode ?? 0));
    const result = this.shellEnv.expandWord(str, (cmdStr) => {
      this.executeInlineSubstitution(cmdStr);
      return "";
    });
    return result;
  }

  tokenize(str) {
    const tokens = [];
    let i = 0;
    let cur = "";
    let curHasContent = false;
    const pushWord = () => {
      if (curHasContent) {
        tokens.push({ type: "WORD", value: cur });
        cur = "";
        curHasContent = false;
      }
    };

    while (i < str.length) {
      const ch = str[i];

      if (ch === "'") {
        curHasContent = true;
        i++;
        while (i < str.length && str[i] !== "'") {
          cur += str[i];
          i++;
        }
        i++;
        continue;
      }

      if (ch === '"') {
        curHasContent = true;
        i++;
        while (i < str.length && str[i] !== '"') {
          if (str[i] === "\\" && i + 1 < str.length && '"\\$'.includes(str[i + 1])) {
            cur += str[i + 1];
            i += 2;
          } else {
            cur += str[i];
            i++;
          }
        }
        i++;
        continue;
      }

      if (ch === "\\" && i + 1 < str.length) {
        curHasContent = true;
        cur += str[i + 1];
        i += 2;
        continue;
      }

      if (/\s/.test(ch)) {
        pushWord();
        i++;
        continue;
      }

      if (ch === "#" && !curHasContent) break;

      if (ch === "&" && str[i + 1] === "&") {
        pushWord();
        tokens.push({ type: "AND" });
        i += 2;
        continue;
      }

      if (ch === "|" && str[i + 1] === "|") {
        pushWord();
        tokens.push({ type: "OR" });
        i += 2;
        continue;
      }

      if (ch === "|") {
        pushWord();
        tokens.push({ type: "PIPE" });
        i++;
        continue;
      }

      if (ch === ";") {
        pushWord();
        tokens.push({ type: "SEMI" });
        i++;
        continue;
      }

      if (ch === ">" && str[i + 1] === ">") {
        pushWord();
        tokens.push({ type: "REDIR_APPEND" });
        i += 2;
        continue;
      }

      if (ch === ">") {
        pushWord();
        tokens.push({ type: "REDIR_OUT" });
        i++;
        continue;
      }

      if (ch === "<") {
        pushWord();
        tokens.push({ type: "REDIR_IN" });
        i++;
        continue;
      }

      curHasContent = true;
      cur += ch;
      i++;
    }

    pushWord();
    return tokens;
  }

  tokensToCommand(tokens) {
    if (!tokens.length) return { command: "", args: [], flags: [] };
    let words = tokens.map((t) => this.expandTilde(t));
    if (this.aliases[words[0]]) {
      const aliasTokens = this.tokenize(this.aliases[words[0]])
        .filter((t) => t.type === "WORD")
        .map((t) => t.value);
      words = [...aliasTokens, ...words.slice(1)];
    }
    const command = words[0];
    const args = [];
    const flags = [];
    for (let i = 1; i < words.length; i++) {
      if (words[i].startsWith("-") && words[i] !== "-") {
        flags.push(words[i]);
      } else {
        args.push(words[i]);
      }
    }
    return { command, args, flags };
  }

  parseChain(tokens) {
    const chain = [];
    let currentPipeline = [];
    let currentCmdTokens = [];
    let operator = null;
    let redirOut = null;
    let redirAppend = null;
    let redirIn = null;
    let pendingRedirType = null;

    const flushCommand = () => {
      currentPipeline.push(this.tokensToCommand(currentCmdTokens));
      currentCmdTokens = [];
    };

    const flushPipeline = () => {
      flushCommand();
      chain.push({ operator, pipeline: currentPipeline, redirOut, redirAppend, redirIn });
      currentPipeline = [];
      redirOut = null;
      redirAppend = null;
      redirIn = null;
    };

    for (const tok of tokens) {
      if (pendingRedirType) {
        if (tok.type === "WORD") {
          const value = this.expandTilde(tok.value);
          if (pendingRedirType === ">") redirOut = value;
          else if (pendingRedirType === ">>") redirAppend = value;
          else if (pendingRedirType === "<") redirIn = value;
        }
        pendingRedirType = null;
        continue;
      }

      switch (tok.type) {
        case "WORD":
          currentCmdTokens.push(tok.value);
          break;
        case "PIPE":
          flushCommand();
          break;
        case "REDIR_OUT":
          pendingRedirType = ">";
          break;
        case "REDIR_APPEND":
          pendingRedirType = ">>";
          break;
        case "REDIR_IN":
          pendingRedirType = "<";
          break;
        case "AND":
          flushPipeline();
          operator = "&&";
          break;
        case "OR":
          flushPipeline();
          operator = "||";
          break;
        case "SEMI":
          flushPipeline();
          operator = ";";
          break;
      }
    }
    flushPipeline();
    return chain;
  }

  parseCommand(commandStr) {
    const expanded = this.expandVariables(commandStr);
    const tokens = this.tokenize(expanded);
    return this.parseChain(tokens);
  }

  async executePipeline(pipeline, redirOut = null, redirAppend = null, redirIn = null) {
    const state = this.activeState;
    if (!state) return;
    let output = null;
    state.lastExitCode = 0;

    if (redirIn) {
      try {
        output = await this.fs.readTextFile(this.pathToRelative(this.fs.resolvePath(redirIn, state.currentPath)), "");
      } catch {
        await this.enqueuePrint(`bash: ${redirIn}: No such file or directory`);
        state.lastExitCode = 1;
        return;
      }
    }

    for (let i = 0; i < pipeline.length; i++) {
      const { command, args, flags } = pipeline[i];
      if (!command) continue;
      const expandedArgs = await this.expandGlobsInArgs(args, state.currentPath);
      const isPiped = output !== null;

      if (isPiped) expandedArgs.unshift(output);

      const ctx = this.buildCommandContext();
      const handler = this.commandRegistry.has(command)
        ? (args, flags, isPiped) => this.commandRegistry.execute(command, args, ctx)
        : this.commands[command];
      if (!handler) {
        await this.enqueuePrint(`bash: ${command}: command not found`);
        state.lastExitCode = 127;
        return;
      }

      const isLast = i === pipeline.length - 1;
      if (!isLast || redirOut || redirAppend) {
        output = await this.captureOutput(() => handler(expandedArgs, flags, isPiped));
      } else {
        await handler(expandedArgs, flags, isPiped);
      }
    }

    if (redirOut || redirAppend) {
      const target = redirOut || redirAppend;
      try {
        const targetPath = this.pathToString(this.fs.resolvePath(target, state.currentPath));
        const fullPath = this.fs.resolveUserPath(targetPath);
        await this.fs.ensureFolder(this.fs.dirname(fullPath)).catch(() => {});
        if (redirAppend) {
          let existing = "";
          try {
            const raw = await this.fs.pRead("readFile", fullPath);
            existing = raw instanceof Uint8Array ? new TextDecoder().decode(raw) : String(raw);
          } catch {}
          await this.fs.safeWriteFile(fullPath, existing ? existing + "\n" + output : output || "");
        } else {
          await this.fs.safeWriteFile(fullPath, output || "");
        }
      } catch (e) {
        await this.enqueuePrint(`bash: ${target}: ${e.message}`);
        state.lastExitCode = 1;
      }
    }
  }

  async captureOutput(fn) {
    const originalPrint = this.print.bind(this);
    const capturedLines = [];

    this.print = async (text) => {
      capturedLines.push(text);
    };

    await fn();
    await this.printQueue;

    this.print = originalPrint;

    return capturedLines.join("\n");
  }

  async executeCommand(commandStr) {
    const state = this.activeState;
    if (!state) return;
    const activeTab = state.tabs.find((t) => t.id === state.activeTabId);
    if (activeTab) {
      const name = commandStr.trim().split(/\s+/)[0];
      if (name && name !== activeTab.commands[activeTab.commands.length - 1]) {
        activeTab.commands.push(name);
        this.renderTabs();
      }
    }
    os.events.emit(BusEvents.TERMINAL_CMD_EXECUTED, { command: commandStr });
    await this.enqueuePrint(commandStr, null, true, this.promptHtml());

    if (commandStr.trim() === "sudo rm -rf /" || commandStr.trim() === "sudo rm -rf /*") {
      await this.cmdNukeSystem();
      return;
    }

    if (
      commandStr.includes("if ") ||
      commandStr.includes("while ") ||
      commandStr.includes("for ") ||
      commandStr.includes("$(") ||
      commandStr.includes("$((") ||
      commandStr.includes("then") ||
      commandStr.includes("fi") ||
      commandStr.includes("done")
    ) {
      this.shellEnv.set("PWD", this.currentPath.length ? "/" + this.currentPath.join("/") : "/");
      this.shellEnv.set("?", String(state.lastExitCode ?? 0));
      this.shellEnv.set("HOSTNAME", this.hostname);
      this.shellEnv.set("USER", this.displayName);
      const ctx = this.buildCommandContext();
      if (!this.shellInterpreter) {
        this.shellInterpreter = new ShellInterpreter(ctx);
      }
      const ast = this.shellParser.parse(commandStr);
      const result = await this.shellInterpreter.execute(ast);
      state.lastExitCode = result.exitCode;
      this.updatePrompt();
      return;
    }

    const chain = this.parseCommand(commandStr);
    for (const segment of chain) {
      if (this.stopRequested) {
        this.stopRequested = false;
        break;
      }
      if (segment.operator === "&&" && state.lastExitCode !== 0) continue;
      if (segment.operator === "||" && state.lastExitCode === 0) continue;
      await this.executePipeline(segment.pipeline, segment.redirOut, segment.redirAppend, segment.redirIn);
    }

    this.updatePrompt();
  }

  async cmdNukeSystem() {
    await this.print("rm: descending into '/'...", "var(--error)");
    await this.print("rm: removing all files...", "var(--error)");

    const overlay = createElement("div");
    overlay.id = "yukios-nuke-overlay";
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100vw";
    overlay.style.height = "100vh";
    overlay.style.background = "#000";
    overlay.style.zIndex = "999999";
    overlay.style.opacity = "0";
    overlay.style.transition = "opacity 0.6s ease-in";
    overlay.style.pointerEvents = "none";
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
    });

    await new Promise((r) => setTimeout(r, 5000));

    try {
      if (os.fs?.reset) {
        await os.fs.reset();
      } else if (os.fs?.format) {
        await os.fs.format();
      }
    } catch (e) {
      console.error("YukiOS nuke: fs reset failed", e);
    }

    try {
      if (os.storage?.clear) {
        os.storage.clear();
      }
    } catch (e) {
      console.error("YukiOS nuke: os.storage clear failed", e);
    }

    try {
      os.storage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.error("YukiOS nuke: local/session storage clear failed", e);
    }

    try {
      if (window.indexedDB?.databases) {
        const dbs = await window.indexedDB.databases();
        await Promise.all(
          dbs
            .filter((db) => db.name)
            .map(
              (db) =>
                new Promise((resolve) => {
                  const req = window.indexedDB.deleteDatabase(db.name);
                  req.onsuccess = () => resolve();
                  req.onerror = () => resolve();
                  req.onblocked = () => resolve();
                })
            )
        );
      }
    } catch (e) {
      console.error("YukiOS nuke: indexedDB clear failed", e);
    }

    location.reload();
  }

  async handleTabCompletion() {
    const input = this.terminalInput.value;
    const cursorPos = this.terminalInput.selectionStart;
    const left = input.slice(0, cursorPos);
    const match = left.match(/(\S+)$/);
    if (!match) return;

    const partial = match[1];
    const leftBeforePartial = left.slice(0, left.length - partial.length);
    const isFirstWord = leftBeforePartial.trim().length === 0;

    if (isFirstWord && !partial.includes("/")) {
      const candidates = [...Object.keys(this.commands), ...Object.keys(this.aliases)];
      const matches = candidates.filter((c) => c.startsWith(partial));
      if (!matches.length) return;

      if (matches.length === 1) {
        const completion = matches[0] + " ";
        this.terminalInput.value = leftBeforePartial + completion + input.slice(cursorPos);
        this.terminalInput.selectionStart = this.terminalInput.selectionEnd =
          leftBeforePartial.length + completion.length;
      } else {
        const commonPrefix = matches.reduce((prefix, item) => {
          let i = 0;
          while (i < prefix.length && i < item.length && prefix[i] === item[i]) i++;
          return prefix.slice(0, i);
        }, matches[0]);
        if (commonPrefix.length > partial.length) {
          this.terminalInput.value = leftBeforePartial + commonPrefix + input.slice(cursorPos);
          this.terminalInput.selectionStart = this.terminalInput.selectionEnd =
            leftBeforePartial.length + commonPrefix.length;
        } else {
          await this.print(matches.join("  "));
        }
      }
      return;
    }

    let pathParts, baseName;
    if (partial.includes("/")) {
      const parts = partial.split("/");
      baseName = parts.pop();
      pathParts = this.fs.resolvePath(parts.join("/"), this.currentPath);
    } else {
      pathParts = [...this.currentPath];
      baseName = partial;
    }

    let folderContents;
    try {
      folderContents = Object.keys(await this.fs.getFolder(this.pathToString(pathParts)));
    } catch {
      return;
    }
    const matches = folderContents.filter((item) => item.startsWith(baseName));
    if (!matches.length) return;

    if (matches.length === 1) {
      const isFile = await this.fs.isFile(pathParts, matches[0]);
      const completion = matches[0] + (isFile ? "" : "/");
      this.terminalInput.value = leftBeforePartial + completion + input.slice(cursorPos);
      this.terminalInput.selectionStart = this.terminalInput.selectionEnd =
        leftBeforePartial.length + completion.length;
    } else {
      const commonPrefix = matches.reduce((prefix, item) => {
        let i = 0;
        while (i < prefix.length && i < item.length && prefix[i] === item[i]) i++;
        return prefix.slice(0, i);
      }, matches[0]);
      if (commonPrefix.length > baseName.length) {
        this.terminalInput.value = leftBeforePartial + commonPrefix + input.slice(cursorPos);
        this.terminalInput.selectionStart = this.terminalInput.selectionEnd =
          leftBeforePartial.length + commonPrefix.length;
      } else {
        await this.print(matches.join("  "));
      }
    }
  }

  promptHtml() {
    const path = this.currentPath.length ? "/" + this.currentPath.join("/") : "/";
    return `<span class="prompt-user">${this.displayName}</span><span class="prompt-at">@</span><span class="prompt-host">${this.hostname}</span><span class="prompt-sep">:</span><span class="prompt-path">${path}</span><span class="prompt-dollar">$</span>`;
  }

  updatePrompt() {
    if (!this.terminalPrompt) return;
    if (this.pyReplActive) {
      this.terminalPrompt.innerHTML = this.pyReplContinuation
        ? '<span class="prompt-pycontinuation">... </span>'
        : '<span class="prompt-python">>>> </span>';
      return;
    }
    if (this.nodeReplActive) {
      this.terminalPrompt.innerHTML = this.nodeReplContinuation
        ? '<span class="prompt-nodecontinuation">... </span>'
        : '<span class="prompt-node">> </span>';
      return;
    }
    this.terminalPrompt.innerHTML = this.promptHtml();
  }

  registerCommand(name, handler) {
    this.commands[name] = handler;
  }

  registerDefaultCommands() {
    this.registerCommand("help", () => this.cmdHelp());
    this.registerCommand("clear", () => this.cmdClear());
    this.registerCommand("pwd", () => this.print(this.currentPath.length ? "/" + this.currentPath.join("/") : "/"));
    this.registerCommand("ls", (args, flags) => this.cmdLs(args, flags));
    this.registerCommand("cd", (args) => this.cmdCd(args));
    this.registerCommand("mkdir", (args) => this.cmdMkdir(args));
    this.registerCommand("touch", (args) => this.cmdTouch(args));
    this.registerCommand("rm", (args, flags) => this.cmdRm(args, flags));
    this.registerCommand("cat", (args) => this.cmdCat(args));
    this.registerCommand("echo", (args) => this.print(args.join(" ")));
    this.registerCommand("whoami", () => this.print(this.displayName));
    this.registerCommand("hostname", () => this.print(this.hostname));
    this.registerCommand("date", () => this.print(new Date().toString()));
    this.registerCommand("history", () => this.history.forEach((cmd, i) => this.print(`  ${i + 1}  ${cmd}`)));
    this.registerCommand("tree", () => this.cmdTree());
    this.registerCommand("uname", () =>
      this.print("Linux reeyuki-desktop 6.1.23-arch1-1 #1 SMP PREEMPT x86_64 GNU/Linux")
    );
    this.registerCommand("ping", (args) => this.cmdPing(args));
    this.registerCommand("curl", (args) => this.cmdCurl(args));
    this.registerCommand("neofetch", () => this.cmdNeofetch());
    this.registerCommand("ps", (args) => this.cmdPs(args));
    this.registerCommand("kill", (args) => this.cmdKill(args));
    this.registerCommand("grep", (args) => this.cmdGrep(args));
    this.registerCommand("wc", (args) => this.cmdWc(args));
    this.registerCommand("du", (args, flags) => this.cmdDu(args, flags));
    this.registerCommand("exit", () => this.cmdExit());
    this.registerCommand("mv", (args) => this.cmdMv(args));
    this.registerCommand("cp", (args, flags) => this.cmdCp(args, flags));
    this.registerCommand("head", (args, flags, isPiped) => this.cmdHead(args, flags, isPiped));
    this.registerCommand("tail", (args, flags, isPiped) => this.cmdTail(args, flags, isPiped));
    this.registerCommand("sort", (args, flags, isPiped) => this.cmdSort(args, flags, isPiped));
    this.registerCommand("uniq", (args, flags, isPiped) => this.cmdUniq(args, flags, isPiped));
    this.registerCommand("cut", (args, flags, isPiped) => this.cmdCut(args, flags, isPiped));
    this.registerCommand("find", (args, flags) => this.cmdFind(args, flags));
    this.registerCommand("which", (args) => this.cmdWhich(args));
    this.registerCommand("type", (args) => this.cmdType(args));
    this.registerCommand("file", (args) => this.cmdFile(args));
    this.registerCommand("alias", (args) => this.cmdAlias(args));
    this.registerCommand("unalias", (args) => this.cmdUnalias(args));
    this.registerCommand("export", (args) => this.cmdExport(args));
    this.registerCommand("env", () => this.cmdEnv());
    this.registerCommand("man", (args) => this.cmdMan(args));
    this.registerCommand("less", (args, flags, isPiped) => this.cmdLess(args, flags, isPiped));
    this.registerCommand("more", (args, flags, isPiped) => this.cmdLess(args, flags, isPiped));
    this.registerCommand("git", (args, flags) => this.cmdGit(args, flags));
    this.registerCommand("shutdown", () => this.cmdShutdown());
    this.registerCommand("reboot", () => this.cmdReboot());
    this.registerCommand("restart", () => this.cmdReboot());
    this.registerCommand("lock", () => this.cmdLock());
    this.registerCommand("logout", () => this.cmdLogout());
    this.registerCommand("signout", () => this.cmdLogout());
    this.registerCommand("python", (args, flags) => this.cmdPython(args, flags));
    this.registerCommand("python3", (args, flags) => this.cmdPython(args, flags));
    this.registerCommand("node", (args, flags) => this.cmdNode(args, flags));
    this.registerCommand("bash", (args) => this.cmdBash(args));
    this.registerCommand("yuki", (args) => cmdYuki(this, args));
    const textEditor = (args) => this.cmdNotepad(args);
    this.registerCommand("notepad", textEditor);
    this.registerCommand("vim", textEditor);
    this.registerCommand("nano", textEditor);
    this.registerCommand("gedit", textEditor);
    this.registerCommand("hyprctl", (args) => cmdHyprctl(this, args));
    this.registerCommand("true", () => {
      this.lastExitCode = 0;
    });
    this.registerCommand("false", () => {
      this.lastExitCode = 1;
    });
    this.registerCommand("sleep", async (args) => {
      const secs = parseFloat(args[0]) || 1;
      await new Promise((r) => setTimeout(r, secs * 1000));
    });
    this.registerCommand("yes", async (args) => {
      const str = args.join(" ") || "y";
      for (let i = 0; i < 100 && !this.stopRequested; i++) {
        await this.print(str);
      }
    });
    this.registerCommand("printenv", () => {
      for (const [k, v] of Object.entries(this.env)) this.print(`${k}=${v}`);
    });
    this.registerCommand("dir", (args, flags) => this.cmdLs(args, flags));
    this.registerCommand("rmdir", async (args) => {
      for (const target of args) {
        const absPath = this.pathToString(this.fs.resolvePath(target, this.currentPath));
        try {
          await this.fs.delete(absPath, target);
        } catch (err) {
          await this.print(`rmdir: ${target}: ${err.message}`, "var(--error)");
        }
      }
    });
    this.registerCommand("rev", async (args, flags, isPiped) => {
      if (isPiped) {
        for (const line of (args[0] || "").split("\n")) {
          await this.print(line.split("").reverse().join(""));
        }
        return;
      }
      for (const target of args) {
        const absPath = this.pathToString(this.fs.resolvePath(target, this.currentPath));
        try {
          const content = await this.fs.readTextFile(absPath, "");
          if (content) {
            const rev = content
              .split("\n")
              .map((l) => l.split("").reverse().join(""))
              .join("\n");
            await this.print(rev);
          }
        } catch {
          await this.print(`rev: ${target}: No such file`, "var(--error)");
        }
      }
    });
    this.registerCommand("banner", (args) => {
      const text = args.join(" ") || "Hello";
      const width = text.length + 4;
      this.print("#".repeat(width));
      for (const ch of text) this.print(`# ${ch} #`);
      this.print("#".repeat(width));
    });
    this.registerCommand("cowsay", (args) => {
      const text = args.join(" ") || "moo";
      const border = "-".repeat(text.length + 2);
      this.print(` ${border} `);
      this.print(`< ${text} >`);
      this.print(` ${border} `);
      this.print("        \\   ^__^");
      this.print("         \\  (oo)\\_______");
      this.print("            (__)\\       )\\/\\");
      this.print("                ||----w |");
      this.print("                ||     ||");
    });
    this.registerCommand("fortune", () => {
      const fortunes = [
        "The best time to plant a tree was 20 years ago. The second best time is now.",
        "A journey of a thousand miles begins with a single step.",
        "In the middle of difficulty lies opportunity.",
        "The only way to do great work is to love what you do.",
        "Simplicity is the ultimate sophistication.",
        "Be yourself; everyone else is already taken.",
        "The unexamined life is not worth living.",
        "Two things are infinite: the universe and human stupidity; and I'm not sure about the universe."
      ];
      this.print(fortunes[Math.floor(Math.random() * fortunes.length)]);
    });

    this.registerCommand("pipes", () => {
      this.print("Starting pipes... (runs for 5s)");
      const pipes = ["╸", "╻", "╺", "╹", "━", "┃", "┓", "┛", "┏", "┗", "┣", "┫", "┳", "┻", "╋"];
      let x = 15,
        y = 5,
        dir = 0;
      const dirs = [
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1]
      ];
      const interval = setInterval(() => {
        if (this.stopRequested) {
          clearInterval(interval);
          return;
        }
        if (Math.random() < 0.3) dir = (dir + (Math.random() < 0.5 ? 1 : -1) + 4) % 4;
        x += dirs[dir][0];
        y += dirs[dir][1];
        if (x < 0 || x > 30 || y < 0 || y > 10) {
          x = 15;
          y = 5;
        }
        this.print(pipes[Math.floor(Math.random() * pipes.length)]);
      }, 100);
      setTimeout(() => clearInterval(interval), 5000);
    });
    this.registerCommand("snow", () => {
      this.print("Starting snowfall... (runs for 5s)");
      const interval = setInterval(() => {
        if (this.stopRequested) {
          clearInterval(interval);
          return;
        }
        const flakes = Math.floor(Math.random() * 5) + 1;
        for (let i = 0; i < flakes; i++) this.print("  *", "#fff");
      }, 200);
      setTimeout(() => clearInterval(interval), 5000);
    });
    this.registerCommand("watch", async (args) => {
      const interval = args.includes("-n") ? parseInt(args[args.indexOf("-n") + 1], 10) || 2 : 2;
      const cmdArgs = args.filter((a) => !a.startsWith("-") && isNaN(parseInt(a, 10)));
      await this.print(`Every ${interval}s: ${cmdArgs.join(" ")}`);
    });
    this.registerCommand("whatis", (args) => {
      const descriptions = {
        ls: "list directory contents",
        cd: "change directory",
        pwd: "print working directory",
        cat: "concatenate files",
        echo: "display a line of text",
        rm: "remove files",
        mv: "move/rename files",
        cp: "copy files",
        mkdir: "create directories",
        touch: "create empty files",
        head: "output first part of files",
        tail: "output last part of files",
        grep: "print lines matching a pattern",
        wc: "count lines, words, characters",
        sort: "sort lines of text files",
        uniq: "remove duplicate lines",
        cut: "remove sections from lines",
        find: "search for files",
        whoami: "print effective user name",
        hostname: "print system hostname",
        date: "print system date and time",
        history: "print command history",
        help: "print help information",
        clear: "clear terminal screen",
        exit: "exit the terminal",
        man: "display manual pages",
        alias: "define or display aliases",
        env: "display environment variables",
        export: "set environment variables",
        ps: "report process status",
        kill: "terminate processes",
        neofetch: "display system information",
        ping: "send ICMP echo requests",
        uname: "print system information",
        tree: "display directory tree",
        du: "estimate file space usage",
        file: "determine file type",
        type: "describe a command",
        which: "locate a command",
        banner: "display large banner text",
        cowsay: "cow saying message",
        fortune: "display random fortune",
        lolcat: "rainbow text output",
        sl: "steam locomotive animation",
        rain: "terminal rain effect",
        cmatrix: "Matrix-style rain effect",
        pipes: "terminal pipes screensaver",
        snow: "falling snow effect",
        watch: "execute command periodically",
        whatis: "display command descriptions",
        true: "return successful exit code",
        false: "return unsuccessful exit code",
        sleep: "delay for specified time",
        yes: "output a string repeatedly",
        printenv: "print environment variables",
        rev: "reverse lines of a file",
        dir: "list directory contents",
        rmdir: "remove empty directories",
        shutdown: "shut down the system",
        reboot: "reboot the system",
        lock: "lock the session",
        logout: "log out"
      };
      if (args[0] && descriptions[args[0]]) this.print(`${args[0]} (1) - ${descriptions[args[0]]}`);
      else if (args[0]) this.print(`${args[0]}: nothing appropriate`);
    });
    this.registerCommand("movefocus", (args) => this.cmdMovefocus(args));
    this.registerCommand("swapwindow", (args) => this.cmdSwapwindow(args));
    this.registerCommand("togglefloating", () => this.cmdTogglefloating());
    this.registerCommand("fullscreen", (args) => this.cmdFullscreen(args));
    this.registerCommand("togglesplit", () => this.cmdTogglesplit());
    this.registerCommand("resizeactive", (args) => this.cmdResizeactive(args));
    this.registerCommand("cyclenext", (args) => this.cmdCyclenext(args));
    this.registerCommand("killactive", () => this.cmdKillactive());
    this.registerCommand("lavat", (args, flags) => this.cmdLavat(args, flags));
    this.registerCommand("btop", (args) => this.cmdBtop(args));
    this.registerCommand("cmatrix", (args, flags) => this.cmdCmatrix(args, flags));
    processManager.init();
  }

  async cmdLavat(args, flags) {
    if (this.lavatActive) {
      await this.print("lavat is already running. Press q or Esc inside the lava lamp to exit.");
      return;
    }

    if (args.includes("--help") || args.includes("-h") || flags.includes("--help") || flags.includes("-h")) {
      await this.print("Usage: lavat [options]");
      await this.print("");
      await this.print("Options:");
      await this.print("  -c <color>   Set color (green, blue, red, purple, pink, cyan, orange, white, yellow)");
      await this.print("  -s <speed>   Animation speed multiplier");
      await this.print("  -r <radius>  Metaball radius");
      await this.print("  -S <size>    Metaball size");
      await this.print("  -G           Enable gravity mode");
      await this.print("  -g           Disable gravity mode");
      await this.print("  -p           Enable party mode (cycling colors)");
      await this.print("  -h, --help   Show this help");
      return;
    }

    this.lavatActive = true;

    const lavatArgs = [...flags, ...args].join(" ").trim() || "-c green -G";

    this.terminalOutput.style.display = "none";
    this.terminalInputLine.style.display = "none";

    const lavatContainer = createElement("div");
    lavatContainer.id = "lavat-container";
    lavatContainer.style.cssText =
      "width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#000;overflow:hidden;";

    const iframe = createElement("iframe");
    iframe.id = "lavat-iframe";
    iframe.style.cssText = "width:100%;height:100%;border:none;background:#000;";
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");

    lavatContainer.appendChild(iframe);
    this.terminalContent.appendChild(lavatContainer);

    const lavatBase = CDN_BASES.MAIN + "/static/apps/lavat";
    try {
      const response = await fetch(lavatBase + "/lavat.html");
      let html = await response.text();
      html = html.replace('src="index.js"', 'src="' + lavatBase + '/index.js"');
      const escapedArgs = lavatArgs.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
      html = html.replace('var argsStr = params.get("args") || "-c green -G";', "var argsStr = '" + escapedArgs + "';");
      iframe.srcdoc = html;
    } catch (e) {
      await this.print("lavat: failed to load: " + e.message);
      this.lavatActive = false;
      this.terminalOutput.style.display = "";
      this.terminalInputLine.style.display = "";
      return;
    }

    this.lavatIframeCleanup = null;

    iframe.addEventListener("load", () => {
      iframe.contentWindow?.focus();
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) return;
      const iframeHandler = (e) => {
        if (e.key === "Escape" || e.key === "q" || e.key === "Q" || (e.ctrlKey && e.key.toLowerCase() === "c")) {
          this.stopLavat();
        }
      };
      iframeDoc.addEventListener("keydown", iframeHandler);
      this.lavatIframeCleanup = () => {
        iframeDoc.removeEventListener("keydown", iframeHandler);
      };
    });

    this.lavatWinHandler = (e) => {
      if (e.key === "Escape" && this.lavatActive) {
        this.stopLavat();
      }
    };
    if (this.win) {
      this.win.addEventListener("keydown", this.lavatWinHandler);
    }
  }

  stopLavat() {
    const state = this.activeState;
    if (!state || !state.lavatActive) return;
    state.lavatActive = false;
    if (state.lavatIframeCleanup) {
      state.lavatIframeCleanup();
      state.lavatIframeCleanup = null;
    }
    if (state.lavatWinHandler && state.win) {
      state.win.removeEventListener("keydown", state.lavatWinHandler);
    }
    const container = $("#lavat-container");
    if (container) container.remove();
    state.terminalOutput.style.display = "";
    state.terminalInputLine.style.display = "";
    state.terminalInput.focus();
  }

  async cmdCmatrix(args, flags) {
    if (this.cmatrixActive) {
      await this.print("cmatrix is already running. Press q or Ctrl+C to exit.");
      return;
    }

    if (args.includes("--help") || args.includes("-h") || flags.includes("--help") || flags.includes("-h")) {
      await this.print("Usage: cmatrix [options]");
      await this.print("");
      await this.print("Options:");
      await this.print("  -a           Asynchronous scroll");
      await this.print("  -b           Bold characters (even positions)");
      await this.print("  -B           All bold characters");
      await this.print("  -c           Classic mode (katakana)");
      await this.print("  -o           Old-style scrolling");
      await this.print("  -r           Rainbow mode");
      await this.print("  -m           Lambda mode (\\u03bb characters)");
      await this.print("  -k           Character changes (flickering)");
      await this.print("  -u <0-10>    Update speed (default: 4)");
      await this.print("  -C <color>   Color: green, red, blue, white, yellow, cyan, magenta, black");
      await this.print("  -s           Screensaver mode (any key to exit)");
      await this.print("  -L           Lock screen with message");
      await this.print("  -M <msg>     Set lock message");
      await this.print("  -h, --help   Show this help");
      return;
    }

    this.cmatrixActive = true;

    const cmatrixArgs = [...flags, ...args].join(" ").trim();

    this.terminalOutput.style.display = "none";
    this.terminalInputLine.style.display = "none";

    const cmatrixContainer = createElement("div");
    cmatrixContainer.id = "cmatrix-container";
    cmatrixContainer.style.cssText =
      "width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#000;overflow:hidden;";

    const iframe = createElement("iframe");
    iframe.id = "cmatrix-iframe";
    iframe.style.cssText = "width:100%;height:100%;border:none;background:#000;";
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");

    cmatrixContainer.appendChild(iframe);
    this.terminalContent.appendChild(cmatrixContainer);

    const cmatrixBase = CDN_BASES.MAIN + "/static/apps/cmatrix";
    try {
      const response = await fetch(cmatrixBase + "/cmatrix.html");
      let html = await response.text();
      const escapedArgs = cmatrixArgs.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
      html = html.replace('var INIT_ARGS = "";', "var INIT_ARGS = '" + escapedArgs + "';");
      iframe.srcdoc = html;
    } catch (e) {
      await this.print("cmatrix: failed to load: " + e.message);
      this.cmatrixActive = false;
      this.terminalOutput.style.display = "";
      this.terminalInputLine.style.display = "";
      return;
    }

    this.cmatrixIframeCleanup = null;

    iframe.addEventListener("load", () => {
      iframe.contentWindow?.focus();
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) return;
      const iframeHandler = (e) => {
        if (e.key === "q" || e.key === "Q" || (e.ctrlKey && e.key.toLowerCase() === "c")) {
          this.stopCmatrix();
        }
      };
      iframeDoc.addEventListener("keydown", iframeHandler);
      this.cmatrixIframeCleanup = () => {
        iframeDoc.removeEventListener("keydown", iframeHandler);
      };
    });

    this.cmatrixWinHandler = (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === "c" && this.cmatrixActive) {
        this.stopCmatrix();
      }
    };
    if (this.win) {
      this.win.addEventListener("keydown", this.cmatrixWinHandler);
    }
  }

  stopCmatrix() {
    const state = this.activeState;
    if (!state || !state.cmatrixActive) return;
    state.cmatrixActive = false;
    if (state.cmatrixIframeCleanup) {
      state.cmatrixIframeCleanup();
      state.cmatrixIframeCleanup = null;
    }
    if (state.cmatrixWinHandler && state.win) {
      state.win.removeEventListener("keydown", state.cmatrixWinHandler);
    }
    const container = $("#cmatrix-container");
    if (container) container.remove();
    state.terminalOutput.style.display = "";
    state.terminalInputLine.style.display = "";
    state.terminalInput.focus();
  }

  async cmdBtop(args) {
    if (this.btopActive) {
      await this.print("btop is already running. Press Ctrl+C to exit.");
      return;
    }

    this.btopActive = true;

    this.terminalOutput.style.display = "none";
    this.terminalInputLine.style.display = "none";

    const btopContainer = createElement("div");
    btopContainer.id = "btop-container";
    btopContainer.style.cssText =
      "width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#1a1a2e;overflow:hidden;";

    const iframe = createElement("iframe");
    iframe.id = "btop-iframe";
    iframe.style.cssText = "width:100%;height:100%;border:none;background:#1a1a2e;";
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");

    btopContainer.appendChild(iframe);
    this.terminalContent.appendChild(btopContainer);

    const btopBase = CDN_BASES.MAIN + "/static/apps/btop";
    try {
      const response = await fetch(btopBase + "/btop.html");
      let html = await response.text();
      html = html.replace('src="btop.js"', 'src="' + btopBase + '/btop.js"');
      html = html.replace(/'__BTOP_BASE__\/' \+ path/g, "'" + btopBase + "/' + path");
      const scrollStyle = `<style>
        ::-webkit-scrollbar{width:8px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:4px}
        ::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.2)}
        *{scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.12) transparent}
      </style>`;
      html = html.replace("</head>", scrollStyle + "</head>");
      iframe.srcdoc = html;
    } catch (e) {
      await this.print("btop: failed to load: " + e.message);
      this.btopActive = false;
      this.terminalOutput.style.display = "";
      this.terminalInputLine.style.display = "";
      return;
    }

    this.btopIframeCleanup = null;

    iframe.addEventListener("load", () => {
      iframe.contentWindow?.focus();

      const sendData = () => {
        if (!this.btopActive || !iframe.contentWindow) return;

        const runningProcs = processManager.getProcesses();
        const totalCpu = Math.min(
          99,
          runningProcs.reduce((s, p) => s + p.cpu, 0)
        );
        const cpuUser = Math.min(totalCpu, totalCpu * 0.7);
        const cpuSys = Math.min(totalCpu, totalCpu * 0.3);
        const cpuIdle = Math.max(0, 100 - totalCpu);

        const coreCount = navigator.hardwareConcurrency || 4;
        const cpuCores = Array.from({ length: coreCount }, () =>
          Math.min(100, Math.max(0, totalCpu * (0.5 + Math.random() * 0.5)))
        );

        let memPercent;
        if (performance.memory) {
          memPercent = Math.min(99, (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100);
        } else {
          memPercent = Math.min(99, 35 + runningProcs.length * 3 + (Math.random() - 0.5) * 2);
        }

        const totalSystemMem = 8 * 1024 * 1024 * 1024;
        const usedSystemMem = Math.round(totalSystemMem * (memPercent / 100));
        const freeSystemMem = totalSystemMem - usedSystemMem;
        const cachedMem = Math.round(freeSystemMem * 0.3);
        const availMem = freeSystemMem + cachedMem;

        const displayName = os.storage.get(StorageKeys.settingsDisplayName) || "user";
        const uptime = Math.floor(performance.now() / 1000);
        const load1 = Math.min(coreCount, +(totalCpu / 25).toFixed(1));
        const load5 = Math.max(0, +(load1 * 0.8).toFixed(1));
        const load15 = Math.max(0, +(load5 * 0.75).toFixed(1));
        const cpuTemp = Math.min(100, Math.round(totalCpu * 1.5));

        const data = {
          type: "btop-data",
          coreCount,
          hostname: "yukios",
          username: displayName,
          uptime,
          cpuName: "YukiOS Virtual CPU",
          cpuHz: coreCount > 4 ? "3.20GHz" : "2.40GHz",
          cpuTotal: +totalCpu.toFixed(1),
          cpuUser: +cpuUser.toFixed(1),
          cpuNice: 0,
          cpuSys: +cpuSys.toFixed(1),
          cpuIdle: +cpuIdle.toFixed(1),
          cpuCores,
          cpuTemp,
          load1,
          load5,
          load15,
          memUsed: usedSystemMem,
          memAvail: availMem,
          memCached: cachedMem,
          memFree: freeSystemMem,
          swapTotal: 0,
          swapUsed: 0,
          swapFree: 0,
          netDown: 0,
          netUp: 0,
          netDownTotal: 0,
          netUpTotal: 0,
          netIpv4: "0.0.0.0",
          netIpv6: "",
          netConnected: 0,
          procs: runningProcs.map((p) => ({
            pid: p.pid,
            name: p.title,
            cmd: p.title,
            user: "user",
            mem: Math.round(p.mem * 1024 * 1024),
            cpuP: +p.cpu.toFixed(1),
            cpuC: +p.cpu.toFixed(1),
            state: p.isTray ? "S" : "R",
            ppid: 1
          }))
        };

        try {
          iframe.contentWindow.postMessage(data, "*");
        } catch (_) {}
      };

      sendData();
      this.btopInterval = setInterval(sendData, 1000);

      const killHandler = (e) => {
        if (e.data?.type === "btop-kill" && e.source === iframe.contentWindow) {
          processManager.killByPid(e.data.pid);
        }
      };
      window.addEventListener("message", killHandler);
      this.btopIframeCleanup = () => {
        window.removeEventListener("message", killHandler);
      };
    });

    this.btopWinHandler = (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === "c" && this.btopActive) {
        this.stopBtop();
      }
    };
    if (this.win) {
      this.win.addEventListener("keydown", this.btopWinHandler);
    }
  }

  stopBtop() {
    const state = this.activeState;
    if (!state || !state.btopActive) return;
    state.btopActive = false;
    if (state.btopInterval) {
      clearInterval(state.btopInterval);
      state.btopInterval = null;
    }
    if (state.btopIframeCleanup) {
      state.btopIframeCleanup();
      state.btopIframeCleanup = null;
    }
    if (state.btopWinHandler && state.win) {
      state.win.removeEventListener("keydown", state.btopWinHandler);
    }
    const container = $("#btop-container");
    if (container) container.remove();
    state.terminalOutput.style.display = "";
    state.terminalInputLine.style.display = "";
    state.terminalInput.focus();
  }

  cmdClear() {
    this.terminalOutput.innerHTML = "";
  }

  async cmdLs(args = [], flags = []) {
    const showAll = flags.some((f) => f.includes("a"));
    const longFormat = flags.some((f) => f.includes("l"));
    const humanReadable = flags.some((f) => f.includes("h"));
    const recursive = flags.some((f) => f.includes("R"));
    const reverse = flags.some((f) => f.includes("r"));

    const formatSize = (size) => {
      if (!humanReadable) return size;
      const units = ["B", "K", "M", "G"];
      let i = 0;
      let s = size;
      while (s >= 1024 && i < units.length - 1) {
        s /= 1024;
        i++;
      }
      return `${Math.round(s)}${units[i]}`;
    };

    const listFolder = async (path, prefix = "") => {
      try {
        const items = await this.fs.getFolder(this.pathToString(path));
        let keys = Object.keys(items);
        if (!showAll) keys = keys.filter((k) => !k.startsWith("."));
        if (reverse) keys = keys.reverse();
        for (const item of keys) {
          const isFile = items[item]?.type === "file";
          const display = longFormat
            ? `${isFile ? "-" : "d"} ${item}${isFile ? "" : "/"}${isFile && items[item].size != null ? ` ${formatSize(items[item].size)}` : ""}`
            : item + (isFile ? "" : "/");
          await this.print(prefix + display, isFile ? null : "blue");
          if (recursive && !isFile) {
            const subPath = Array.isArray(path) ? [...path, item] : this.fs.resolvePath(item, path);
            await listFolder(subPath, prefix + "  ");
          }
        }
      } catch (e) {
        await this.print(`ls: cannot access '${this.pathToString(path)}': No such file or directory`);
        console.error(e);
      }
    };

    const targetPath = args.length ? this.fs.resolvePath(args[0], this.currentPath) : [...this.currentPath];
    await listFolder(targetPath);
  }

  async cmdCd(args) {
    if (!args.length || args[0] === "~") {
      this.currentPath = ["home", this.displayName];
      return;
    }
    try {
      const newPath = this.fs.resolvePath(args[0], this.currentPath);
      const pathStr = this.pathToString(newPath);
      const exists = await this.fs.exists(pathStr);
      if (!exists) {
        throw new Error("No such file or directory");
      }
      const folder = await this.fs.getFolder(pathStr);
      if (folder === null || typeof folder !== "object") {
        throw new Error("Not a directory");
      }
      this.currentPath = newPath;
    } catch {
      await this.print(`cd: ${args[0]}: No such file or directory`);
    }
  }

  async cmdMkdir(args) {
    if (!args.length) return this.print("mkdir: missing operand");
    for (const dir of args) {
      try {
        const targetPath = this.fs.resolvePath(dir, this.currentPath);
        await this.fs.createFolder(this.pathToRelative(targetPath), dir);
        await this.print(`Created directory: ${dir}`);
      } catch (e) {
        await this.print(`mkdir: cannot create directory '${dir}': ${e.message}`);
      }
    }
  }

  async cmdNotepad(args = []) {
    const notepadApp = os.app.getInstance(ServiceKeys.NOTEPAD);
    if (!notepadApp) {
      await this.print("notepad: Notepad app is not available");
      return;
    }

    if (!args.length) {
      notepadApp.open();
      return;
    }

    const filePath = args[0];
    try {
      const resolved = this.fs.resolvePath(filePath, this.currentPath);
      const parentPath = resolved.slice(0, -1);
      const fileName = resolved[resolved.length - 1];

      const exists = await this.fs.exists(this.pathToString(resolved));
      if (!exists) {
        notepadApp.open(fileName, "", resolved);
        return;
      }

      const isFile = await this.fs.isFile(parentPath, fileName);
      if (!isFile) {
        await this.print(`notepad: ${filePath}: Is a directory`);
        return;
      }

      const content = await this.fs.readTextFile(parentPath, fileName);
      notepadApp.open(fileName, content, resolved);
    } catch (e) {
      await this.print(`notepad: ${filePath}: ${e.message}`);
    }
  }

  async cmdTouch(args) {
    if (!args.length) return this.print("touch: missing file operand");
    for (const file of args) {
      try {
        const parentEntries = await this.fs.getFolder(this.pathToString(this.currentPath));
        const existing = parentEntries[file];
        if (existing) {
          if (existing.type === "dir") {
            await this.print(`touch: ${file}: Is a directory`);
            continue;
          }
        }
        await this.fs.createFile(this.pathToRelative(this.currentPath), file, "");
        if (!existing) await this.print(`Created file: ${file}`);
      } catch (e) {
        await this.print(`touch: ${file}: ${e.message}`);
      }
    }
  }

  async cmdRm(args = [], flags = []) {
    if (!args.length) return this.print("rm: missing operand");

    const isRecursive = flags.some((f) => f.includes("r") || f.includes("R"));
    const isForce = flags.some((f) => f.includes("f"));

    const removeItem = async (pathArray) => {
      try {
        const parentPath = pathArray.slice(0, -1);
        const name = pathArray[pathArray.length - 1];

        const isFile = await this.fs.isFile(this.pathToString(parentPath), name);
        if (isFile) {
          await this.fs.deleteItem(this.pathToRelative(parentPath), name);
        } else {
          if (!isRecursive) throw new Error("is a directory");
          const folderItems = Object.keys(await this.fs.getFolder(this.pathToString(pathArray)));
          for (const sub of folderItems) {
            await removeItem([...pathArray, sub]);
          }
          await this.fs.deleteItem(this.pathToRelative(parentPath), name);
        }
      } catch (e) {
        if (!isForce) await this.print(`rm: cannot remove '${pathArray.join("/")}': ${e.message}`);
      }
    };

    for (const arg of args) {
      const fullPath = arg.startsWith("/") ? this.fs.resolvePath(arg, []) : this.fs.resolvePath(arg, this.currentPath);
      await removeItem(fullPath);
    }
  }

  async cmdCat(args) {
    if (!args.length) return this.print("cat: missing file operand");
    for (const file of args) {
      if (file.includes("\n")) {
        await this.print(file);
      } else {
        try {
          const isFile = await this.fs.isFile(this.currentPath, file);
          if (!isFile) {
            await this.print(`cat: ${file}: Is a directory`);
          } else {
            const content = await this.fs.readTextFile(this.pathToRelative(this.currentPath), file);
            await this.print(content || "(empty file)");
          }
        } catch {
          await this.print(`cat: ${file}: No such file or directory`);
        }
      }
    }
  }

  cmdGrep(args) {
    if (args.length < 1) return this.print("grep: missing pattern");

    const pattern = args[0];
    const input = args.slice(1).join(" ");

    const lines = input.split("\n");
    const regex = new RegExp(pattern, "i");

    lines.forEach((line) => {
      if (regex.test(line)) {
        this.print(line);
      }
    });
  }

  async cmdWc(args) {
    const flagArgs = args.filter((a) => a.startsWith("-"));
    const files = args.filter((a) => !a.startsWith("-"));
    if (!files.length || flagArgs.some((f) => f.includes("h") || f.includes("help"))) {
      return this.print("Usage: wc [-l] [-w] [-c] <file>");
    }
    const hasLineFlag = flagArgs.some((f) => f.includes("l"));
    const hasWordFlag = flagArgs.some((f) => f.includes("w"));
    const hasCharFlag = flagArgs.some((f) => f.includes("c") || f.includes("m"));
    const anyFlag = hasLineFlag || hasWordFlag || hasCharFlag;
    const showLines = !anyFlag || hasLineFlag;
    const showWords = !anyFlag || hasWordFlag;
    const showChars = !anyFlag || hasCharFlag;
    for (const file of files) {
      try {
        const targetPath = this.fs.resolvePath(file, this.currentPath);
        const parentPath = targetPath.slice(0, -1);
        const name = targetPath[targetPath.length - 1];

        if (await this.fs.isFile(parentPath, name)) {
          const content = await this.fs.readTextFile(this.pathToRelative(targetPath), "");
          const text = typeof content === "string" ? content : new TextDecoder().decode(content);
          const lines = text.split("\n").length;
          const words = text.split(/\s+/).filter(Boolean).length;
          const chars = text.length;
          const parts = [];
          if (showLines) parts.push(String(lines).padStart(8));
          if (showWords) parts.push(String(words).padStart(8));
          if (showChars) parts.push(String(chars).padStart(8));
          await this.print(parts.join("") + " " + file);
        } else {
          await this.print(`wc: ${file}: Is a directory`);
        }
      } catch {
        await this.print(`wc: ${file}: No such file or directory`);
      }
    }
  }

  async isExistingDir(pathArray) {
    if (!pathArray.length) return true;
    const parent = pathArray.slice(0, -1);
    const name = pathArray[pathArray.length - 1];
    try {
      const parentDir = await this.fs.getFolder(this.pathToString(parent));
      const entry = parentDir[name];
      if (!entry) return false;
      return entry.type === "dir";
    } catch {
      return false;
    }
  }

  async copyItem(srcPath, destPath) {
    const name = srcPath[srcPath.length - 1];
    const parentSrc = srcPath.slice(0, -1);
    const isFile = await this.fs.isFile(parentSrc, name);
    if (isFile) {
      const content = await this.fs.readTextFile(this.pathToRelative(srcPath), "");
      await this.fs.createFile(this.pathToRelative(destPath), name, content);
    } else {
      await this.fs.createFolder(this.pathToRelative(destPath), name);
      const items = Object.keys(await this.fs.getFolder(this.pathToString(srcPath)));
      for (const child of items) {
        await this.copyItem([...srcPath, child], [...destPath, child]);
      }
    }
  }

  async deleteRecursive(pathArray) {
    const parent = pathArray.slice(0, -1);
    const name = pathArray[pathArray.length - 1];
    const isFile = await this.fs.isFile(parent, name);
    if (!isFile) {
      const items = Object.keys(await this.fs.getFolder(this.pathToString(pathArray)));
      for (const child of items) {
        await this.deleteRecursive([...pathArray, child]);
      }
    }
    await this.fs.deleteItem(this.pathToRelative(parent), name);
  }

  async cmdCp(args = [], flags = []) {
    if (args.length < 2) return this.print("cp: missing file operand");
    const recursive = flags.some((f) => f.includes("r") || f.includes("R"));
    const dest = args[args.length - 1];
    const sources = args.slice(0, -1);
    const destPath = this.fs.resolvePath(dest, this.currentPath);
    const destIsDir = await this.isExistingDir(destPath);

    if (sources.length > 1 && !destIsDir) {
      return this.print(`cp: target '${dest}' is not a directory`);
    }

    for (const src of sources) {
      const srcPath = this.fs.resolvePath(src, this.currentPath);
      const srcName = srcPath[srcPath.length - 1];
      const isFile = await this.fs.isFile(srcPath.slice(0, -1), srcName);
      if (!isFile && !recursive) {
        await this.print(`cp: -r not specified; omitting directory '${src}'`);
        continue;
      }
      const finalDest = destIsDir ? [...destPath, srcName] : destPath;
      try {
        await this.copyItem(srcPath, finalDest);
      } catch (e) {
        await this.print(`cp: cannot copy '${src}': ${e.message}`);
      }
    }
  }

  async cmdMv(args = []) {
    if (args.length < 2) return this.print("mv: missing file operand");
    const dest = args[args.length - 1];
    const sources = args.slice(0, -1);
    const destPath = this.fs.resolvePath(dest, this.currentPath);
    const destIsDir = await this.isExistingDir(destPath);

    if (sources.length > 1 && !destIsDir) {
      return this.print(`mv: target '${dest}' is not a directory`);
    }

    for (const src of sources) {
      const srcPath = this.fs.resolvePath(src, this.currentPath);
      const srcName = srcPath[srcPath.length - 1];
      const finalDest = destIsDir ? [...destPath, srcName] : destPath;
      try {
        await this.copyItem(srcPath, finalDest);
        await this.deleteRecursive(srcPath);
      } catch (e) {
        await this.print(`mv: cannot move '${src}': ${e.message}`);
      }
    }
  }

  async linesFromInput(args, isPiped) {
    if (isPiped) {
      return { lines: args[0].split("\n") };
    }
    if (args.length && !args[0].includes("\n")) {
      try {
        const isFile = await this.fs.isFile(this.currentPath, args[0]);
        if (isFile) {
          const content = await this.fs.readTextFile(this.pathToRelative(this.currentPath), args[0]);
          return { lines: content.split("\n") };
        }
      } catch {}
    }
    return { lines: args.join(" ").split("\n") };
  }

  async cmdHead(args = [], flags = [], isPiped = false) {
    let count = 10;
    const numFlag = flags.find((f) => /^-\d+$/.test(f) || /^-n\d*$/.test(f));
    if (numFlag) {
      const digits = numFlag.replace(/^-n?/, "");
      if (digits) count = parseInt(digits, 10);
    }
    if (flags.includes("-n") && args.length) {
      count = parseInt(args[0], 10) || count;
      args = args.slice(1);
    }
    const { lines } = await this.linesFromInput(args, isPiped);
    for (const line of lines.slice(0, count)) {
      await this.print(line);
    }
  }

  async cmdTail(args = [], flags = [], isPiped = false) {
    let count = 10;
    const numFlag = flags.find((f) => /^-\d+$/.test(f) || /^-n\d*$/.test(f));
    if (numFlag) {
      const digits = numFlag.replace(/^-n?/, "");
      if (digits) count = parseInt(digits, 10);
    }
    if (flags.includes("-n") && args.length) {
      count = parseInt(args[0], 10) || count;
      args = args.slice(1);
    }
    const { lines } = await this.linesFromInput(args, isPiped);
    for (const line of lines.slice(-count)) {
      await this.print(line);
    }
  }

  async cmdSort(args = [], flags = [], isPiped = false) {
    const reverse = flags.some((f) => f.includes("r"));
    const numeric = flags.some((f) => f.includes("n"));
    const { lines } = await this.linesFromInput(args, isPiped);
    const sorted = [...lines];
    sorted.sort((a, b) => (numeric ? Number(a) - Number(b) : a.localeCompare(b)));
    if (reverse) sorted.reverse();
    for (const line of sorted) {
      await this.print(line);
    }
  }

  async cmdUniq(args = [], flags = [], isPiped = false) {
    const countFlag = flags.some((f) => f.includes("c"));
    const { lines } = await this.linesFromInput(args, isPiped);
    const result = [];
    for (const line of lines) {
      const last = result[result.length - 1];
      if (last && last.value === line) {
        last.count++;
      } else {
        result.push({ value: line, count: 1 });
      }
    }
    for (const r of result) {
      await this.print(countFlag ? `${String(r.count).padStart(4)} ${r.value}` : r.value);
    }
  }

  async cmdCut(args = [], flags = [], isPiped = false) {
    const delimFlag = flags.find((f) => f.startsWith("-d"));
    const delimiter = delimFlag ? delimFlag.slice(2) || "\t" : "\t";
    const fieldsFlag = flags.find((f) => f.startsWith("-f"));
    if (!fieldsFlag) return this.print("cut: you must specify a list of fields with -f");
    const fields = fieldsFlag
      .slice(2)
      .split(",")
      .map((n) => parseInt(n, 10))
      .filter((n) => !isNaN(n));
    const { lines } = await this.linesFromInput(args, isPiped);
    for (const line of lines) {
      const parts = line.split(delimiter);
      await this.print(fields.map((f) => parts[f - 1] ?? "").join(delimiter));
    }
  }

  async cmdFind(args = [], flags = []) {
    const hasNameFlag = flags.includes("-name");
    let startArg = ".";
    let namePattern = null;
    if (hasNameFlag) {
      if (args.length > 1) {
        startArg = args[0];
        namePattern = args[1];
      } else {
        namePattern = args[0];
      }
    } else if (args.length) {
      startArg = args[0];
    }

    const startPath = this.fs.resolvePath(startArg, this.currentPath);
    const regex = namePattern
      ? new RegExp("^" + namePattern.replace(/\./g, "\\.").replace(/\*/g, ".*").replace(/\?/g, ".") + "$")
      : null;

    const walk = async (path) => {
      let items;
      try {
        items = Object.keys(await this.fs.getFolder(this.pathToString(path)));
      } catch {
        return;
      }
      for (const item of items) {
        const itemPath = [...path, item];
        if (!regex || regex.test(item)) {
          await this.print(this.pathToString(itemPath));
        }
        const isFile = await this.fs.isFile(path, item);
        if (!isFile) await walk(itemPath);
      }
    };

    if (!namePattern) await this.print(this.pathToString(startPath));
    await walk(startPath);
  }

  cmdWhich(args) {
    if (!args.length) return this.print("which: missing argument");
    for (const name of args) {
      if (this.aliases[name]) {
        this.print(`${name}: aliased to ${this.aliases[name]}`);
      } else if (this.commands[name]) {
        this.print(`/usr/bin/${name}`);
      } else {
        this.print(`which: no ${name} in (${this.env.PATH})`);
      }
    }
  }

  cmdType(args) {
    if (!args.length) return this.print("type: missing argument");
    for (const name of args) {
      if (this.aliases[name]) {
        this.print(`${name} is aliased to \`${this.aliases[name]}'`);
      } else if (this.commands[name]) {
        this.print(`${name} is a shell builtin`);
      } else {
        this.print(`bash: type: ${name}: not found`);
      }
    }
  }

  async readFileBytes(parentPath, name, maxBytes = 96) {
    try {
      const fullPath = this.fs.paths.resolveUserPath(parentPath);
      const filePath = this.fs.paths.join(fullPath, name);
      if (this.fs.blobs) {
        const blob = await this.fs.blobs.getBlobByFullPath(filePath).catch(() => null);
        if (blob && blob.size > 0) {
          const slice = blob.size > maxBytes ? blob.slice(0, maxBytes) : blob;
          return new Uint8Array(await slice.arrayBuffer());
        }
      }
      const raw = await this.fs.pRead("readFile", filePath).catch(() => null);
      if (raw instanceof Uint8Array) return raw.slice(0, Math.min(raw.length, maxBytes));
      if (typeof raw === "string") {
        if (raw.startsWith("http") || raw.startsWith("data:") || raw.startsWith("/")) return null;
        const encoded = new TextEncoder().encode(raw);
        return encoded.slice(0, Math.min(encoded.length, maxBytes));
      }
    } catch {}
    return null;
  }

  describePng(bytes) {
    if (bytes.length < 33) return "PNG image data";
    const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
    const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
    const bitDepth = bytes[24];
    const colorType = bytes[25];
    const interlace = bytes[28];
    const colorNames = { 0: "Grayscale", 2: "RGB", 3: "Indexed", 4: "Grayscale+Alpha", 6: "RGBA" };
    const color = colorNames[colorType] || `color-type-${colorType}`;
    const inter = interlace ? "Adam7 interlaced" : "non-interlaced";
    return `PNG image data, ${width} x ${height}, ${bitDepth}-bit/color ${color}, ${inter}`;
  }

  describeGif(bytes) {
    if (bytes.length < 10) return "GIF image data";
    const version = String.fromCharCode(bytes[3], bytes[4], bytes[5]);
    const width = bytes[6] | (bytes[7] << 8);
    const height = bytes[8] | (bytes[9] << 8);
    return `GIF image data, version ${version}, ${width} x ${height}`;
  }

  describeJpeg(bytes) {
    for (let i = 0; i < bytes.length - 4; i++) {
      if (bytes[i] === 0xff && (bytes[i + 1] === 0xc0 || bytes[i + 1] === 0xc1 || bytes[i + 1] === 0xc2)) {
        const precision = bytes[i + 4];
        const height = (bytes[i + 5] << 8) | bytes[i + 6];
        const width = (bytes[i + 7] << 8) | bytes[i + 8];
        return `JPEG image data, ${width}x${height}${precision !== 8 ? `, ${precision}-bit` : ""}`;
      }
    }
    return "JPEG image data";
  }

  describeWebp(bytes) {
    if (bytes.length < 30) return "WebP image data";
    if (bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38 && bytes[15] === 0x4c) {
      if (bytes.length < 24) return "WebP image data (lossless)";
      const packed = bytes[20] | (bytes[21] << 8) | (bytes[22] << 16) | (bytes[23] << 24);
      const w = (packed & 0x3fff) + 1;
      const h = ((packed >> 14) & 0x3fff) + 1;
      return `WebP image data (lossless), ${w} x ${h}`;
    }
    if (bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38 && bytes[15] === 0x20) {
      if (bytes.length < 30) return "WebP image data";
      const w = ((bytes[27] & 0x3f) << 8) | (bytes[26] & 0x3f);
      const h = ((bytes[29] & 0x3f) << 8) | (bytes[28] & 0x3f);
      if (w && h) return `WebP image data, ${w} x ${h}`;
      return "WebP image data";
    }
    return "WebP image data";
  }

  describeGzip(bytes, name) {
    if (bytes.length < 10) return "gzip compressed data";
    const flags = bytes[3];
    const osByte = bytes[9];
    const osNames = { 0: "FAT filesystem", 3: "Unix", 11: "NTFS", 255: "unknown" };
    const os = osNames[osByte] || `OS ${osByte}`;
    let details = `gzip compressed data, from ${os}`;
    let pos = 10;
    if (flags & 0x04) {
      if (pos + 2 > bytes.length) return details;
      const xlen = bytes[pos] | (bytes[pos + 1] << 8);
      pos += 2 + xlen;
    }
    if (flags & 0x08) {
      let fname = "";
      while (pos < bytes.length && bytes[pos] !== 0) {
        fname += String.fromCharCode(bytes[pos]);
        pos++;
      }
      if (fname) details += `, original file name "${fname}"`;
    }
    return details;
  }

  describeElf(bytes) {
    if (bytes.length < 20) return "data";
    const elfClass = bytes[4] === 1 ? "32-bit" : bytes[4] === 2 ? "64-bit" : "unknown";
    const isLE = bytes[5] === 1;
    const endian = isLE ? "LSB" : bytes[5] === 2 ? "MSB" : "";
    const type = isLE ? bytes[16] | (bytes[17] << 8) : (bytes[16] << 8) | bytes[17];
    const typeNames = {
      0: "NONE",
      1: "REL (relocatable)",
      2: "EXEC (executable)",
      3: "DYN (shared object)",
      4: "CORE"
    };
    const machine = isLE ? bytes[18] | (bytes[19] << 8) : (bytes[18] << 8) | bytes[19];
    const machineNames = {
      3: "i386",
      8: "MIPS",
      20: "PowerPC",
      40: "ARM",
      62: "x86-64",
      183: "AArch64",
      243: "RISC-V"
    };
    return `ELF ${elfClass} ${endian} ${typeNames[type] || `type-${type}`}, ${machineNames[machine] || `machine-${machine}`}`;
  }

  describeBmp(bytes) {
    if (bytes.length < 26) return "BMP image data";
    const width = bytes[18] | (bytes[19] << 8) | (bytes[20] << 16) | (bytes[21] << 24);
    const height = bytes[22] | (bytes[23] << 8) | (bytes[24] << 16) | (bytes[25] << 24);
    return `BMP image data, ${width} x ${height}`;
  }

  describeTiff(bytes) {
    const isLE = bytes[0] === 0x49;
    return `TIFF image data (${isLE ? "little-endian" : "big-endian"})`;
  }

  describeFlac() {
    return "FLAC Audio";
  }

  describeOgg() {
    return "OGG data";
  }

  describeMp3Id3(bytes) {
    const major = bytes[3];
    const minor = bytes[4];
    return `ID3v${major}.${minor} Audio`;
  }

  describeWav(bytes) {
    if (bytes.length < 28) return "WAV Audio";
    const fmt = bytes[20] | (bytes[21] << 8);
    const channels = bytes[22] | (bytes[23] << 8);
    const sampleRate = bytes[24] | (bytes[25] << 8) | (bytes[26] << 16) | (bytes[27] << 24);
    const fmtNames = { 1: "PCM", 3: "IEEE float", 6: "ALAW", 7: "\u00b5-law", 0xfffe: "Extensible" };
    const fmtName = fmtNames[fmt] || `format-${fmt}`;
    const chan = channels === 1 ? "mono" : channels === 2 ? "stereo" : `${channels} channels`;
    return `WAV Audio, ${fmtName}, ${sampleRate} Hz, ${chan}`;
  }

  describeWasm(bytes) {
    if (bytes.length < 8) return "WebAssembly binary";
    const ver = (bytes[4] << 24) | (bytes[5] << 16) | (bytes[6] << 8) | bytes[7];
    return `WebAssembly binary, version ${ver}`;
  }

  describeTtf(bytes) {
    const isOtf = bytes[0] === 0x4f && bytes[1] === 0x54 && bytes[2] === 0x54 && bytes[3] === 0x4f;
    return isOtf ? "OpenType font data" : "TrueType font data";
  }

  describeSqlite() {
    return "SQLite database";
  }

  describeZstd() {
    return "Zstandard compressed data";
  }

  describeJavaClass(bytes) {
    if (bytes.length < 8) return "Java class data";
    const major = ((bytes[6] & 0xff) << 8) | (bytes[7] & 0xff);
    const javaVersions = {
      45: "1.1",
      46: "1.2",
      47: "1.3",
      48: "1.4",
      49: "5",
      50: "6",
      51: "7",
      52: "8",
      53: "9",
      54: "10",
      55: "11",
      56: "12",
      57: "13",
      58: "14",
      59: "15",
      60: "16",
      61: "17",
      62: "18",
      63: "19",
      64: "20",
      65: "21",
      66: "22"
    };
    const ver = javaVersions[major] || `${major}`;
    return `Java class data (Java ${ver})`;
  }

  detectAndDescribe(name, kind, bytes) {
    if (!bytes || bytes.length < 4) return this.getFileDescription(name, kind);

    if (bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46) {
      return this.describeElf(bytes);
    }
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
      return this.describeGzip(bytes, name);
    }
    if (bytes[0] === 0xca && bytes[1] === 0xfe && bytes[2] === 0xba && bytes[3] === 0xbe) {
      return this.describeJavaClass(bytes);
    }
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
      return "PDF document";
    }
    if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
      return "Zip archive data";
    }
    if (bytes[0] === 0x28 && bytes[1] === 0xb5 && bytes[2] === 0x2f && bytes[3] === 0xfd) {
      return this.describeZstd();
    }
    if (bytes[0] === 0x42 && bytes[1] === 0x5a && bytes[2] === 0x68) {
      const level = bytes[3] >= 0x31 && bytes[3] <= 0x39 ? `, block size ${bytes[3] - 0x30}00k` : "";
      return `bzip2 compressed data${level}`;
    }
    if (bytes[0] === 0x37 && bytes[1] === 0x7a && bytes[2] === 0xbc && bytes[3] === 0xaf) {
      return "7-zip archive data";
    }
    if (
      bytes.length >= 16 &&
      bytes[0] === 0x53 &&
      bytes[1] === 0x51 &&
      bytes[2] === 0x4c &&
      bytes[3] === 0x69 &&
      bytes[4] === 0x74 &&
      bytes[5] === 0x65 &&
      bytes[6] === 0x20 &&
      bytes[7] === 0x66 &&
      bytes[8] === 0x6f &&
      bytes[9] === 0x72 &&
      bytes[10] === 0x6d &&
      bytes[11] === 0x61 &&
      bytes[12] === 0x74 &&
      bytes[13] === 0x20 &&
      bytes[14] === 0x33 &&
      bytes[15] === 0x00
    ) {
      return this.describeSqlite();
    }
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
      return this.describePng(bytes);
    }
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
      return this.describeGif(bytes);
    }
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return this.describeJpeg(bytes);
    }
    if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
      return this.describeBmp(bytes);
    }
    if (
      (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
      (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a)
    ) {
      return this.describeTiff(bytes);
    }
    if (bytes[0] === 0x00 && bytes[1] === 0x61 && bytes[2] === 0x73 && bytes[3] === 0x6d) {
      return this.describeWasm(bytes);
    }
    if (bytes[0] === 0x00 && bytes[1] === 0x01 && bytes[2] === 0x00 && bytes[3] === 0x00) {
      return this.describeTtf(bytes);
    }
    if (bytes[0] === 0x4f && bytes[1] === 0x54 && bytes[2] === 0x54 && bytes[3] === 0x4f) {
      return this.describeTtf(bytes);
    }
    if (bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43) {
      return this.describeFlac();
    }
    if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
      return this.describeOgg();
    }
    if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
      return this.describeMp3Id3(bytes);
    }
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
      if (bytes.length >= 12) {
        const formType = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
        if (formType === "WAVE") return this.describeWav(bytes);
        if (formType === "WEBP") return this.describeWebp(bytes);
      }
      return "RIFF data";
    }
    if (bytes.length >= 4) {
      const snippet = new TextDecoder().decode(bytes.slice(0, Math.min(bytes.length, 200)));
      if (/^\s*<svg[\s>]/i.test(snippet) || /^\s*<\?xml[\s>][\s\S]*<svg[\s>]/i.test(snippet)) {
        return "SVG image";
      }
    }

    return this.getFileDescription(name, kind);
  }

  getFileDescription(name, kind) {
    const ext = getExt(name);
    const extMap = {
      txt: "ASCII text",
      md: "Markdown text",
      markdown: "Markdown text",
      json: "JSON data",
      html: "HTML document",
      htm: "HTML document",
      css: "CSS source",
      js: "JavaScript source",
      jsx: "JSX source",
      ts: "TypeScript source",
      tsx: "TSX source",
      xml: "XML document",
      csv: "CSV data",
      yml: "YAML data",
      yaml: "YAML data",
      toml: "TOML data",
      ini: "INI config",
      cfg: "config data",
      conf: "config data",
      pdf: "PDF document",
      png: "PNG image data",
      jpg: "JPEG image data",
      jpeg: "JPEG image data",
      gif: "GIF image data",
      webp: "WebP image data",
      svg: "SVG image",
      ico: "MS Windows icon",
      bmp: "BMP image data",
      avif: "AVIF image data",
      heic: "HEIC image data",
      heif: "HEIF image data",
      tiff: "TIFF image data",
      tif: "TIFF image data",
      mp4: "MP4 video data",
      webm: "WebM video data",
      ogv: "OGG video data",
      mov: "QuickTime video data",
      mkv: "Matroska video data",
      avi: "AVI video data",
      m4v: "MPEG-4 video data",
      wmv: "WMV video data",
      flv: "Flash video data",
      mp3: "MP3 Audio",
      flac: "FLAC Audio",
      wav: "WAV Audio",
      ogg: "OGG Audio",
      opus: "Opus Audio",
      m4a: "AAC Audio",
      aac: "AAC Audio",
      wma: "WMA Audio",
      mid: "MIDI Audio",
      midi: "MIDI Audio",
      aiff: "AIFF Audio",
      caf: "Core Audio",
      woff: "font data",
      woff2: "font data",
      ttf: "font data",
      otf: "font data",
      zip: "ZIP archive",
      "7z": "7-Zip archive",
      rar: "RAR archive",
      tar: "TAR archive",
      gz: "gzip compressed data",
      bz2: "bzip2 compressed data",
      xz: "XZ archive",
      iso: "ISO image",
      img: "disk image",
      dmg: "DMG disk image",
      exe: "PE executable",
      dll: "PE DLL",
      so: "shared object",
      apk: "APK package",
      deb: "Debian package",
      rpm: "RPM package",
      py: "Python script",
      rb: "Ruby script",
      sh: "shell script",
      bash: "Bash script",
      fish: "Fish script",
      bat: "Batch script",
      ps1: "PowerShell script",
      c: "C source",
      h: "C header",
      cpp: "C++ source",
      hpp: "C++ header",
      java: "Java source",
      rs: "Rust source",
      go: "Go source",
      swift: "Swift source",
      kt: "Kotlin source",
      dart: "Dart source",
      lua: "Lua script",
      php: "PHP script",
      pl: "Perl script",
      r: "R source",
      sql: "SQL data",
      srt: "SubRip subtitle",
      vtt: "WebVTT subtitle",
      torrent: "BitTorrent file",
      wasm: "WebAssembly binary"
    };

    if (extMap[ext]) return extMap[ext];
    if (kind === "text") return "ASCII text";
    if (kind === "image") return ext ? `${ext.toUpperCase()} image data` : "image data";
    if (kind === "video") return ext ? `${ext.toUpperCase()} video data` : "video data";
    if (kind === "audio") return ext ? `${ext.toUpperCase()} Audio` : "Audio data";
    if (kind === "font") return "font data";
    if (kind === "rom") return "ROM image";
    return ext ? `${ext.toUpperCase()} data` : "data";
  }

  async cmdFile(args) {
    if (!args.length) return this.print("file: missing file operand");
    const longest = args.reduce((max, a) => Math.max(max, a.length), 0);
    for (const arg of args) {
      try {
        const fullPath = this.fs.resolvePath(arg, this.currentPath);
        const parentPath = fullPath.slice(0, -1);
        const name = fullPath[fullPath.length - 1];

        const isFile = await this.fs.isFile(parentPath, name);
        if (!isFile) {
          await this.print(`${arg.padEnd(longest)}: directory`);
          continue;
        }

        const kind = (await this.fs.getFileKind(parentPath, name)) || this.fs.inferKind(name);
        const bytes = await this.readFileBytes(parentPath, name);
        const desc = this.detectAndDescribe(name, kind, bytes);
        await this.print(`${arg.padEnd(longest)}: ${desc}`);
      } catch {
        await this.print(`file: ${arg}: No such file or directory`);
      }
    }
  }

  cmdAlias(args) {
    if (!args.length) {
      const entries = Object.entries(this.aliases);
      entries.forEach(([k, v]) => this.print(`alias ${k}='${v}'`));
      return;
    }
    for (const arg of args) {
      const eq = arg.indexOf("=");
      if (eq === -1) {
        if (this.aliases[arg]) this.print(`alias ${arg}='${this.aliases[arg]}'`);
        else this.print(`bash: alias: ${arg}: not found`);
        continue;
      }
      const name = arg.slice(0, eq);
      const value = arg.slice(eq + 1);
      this.aliases[name] = value;
    }
    os.storage.set(StorageKeys.terminalAliases, this.aliases);
  }

  cmdUnalias(args) {
    if (!args.length) return this.print("unalias: missing argument");
    for (const name of args) {
      delete this.aliases[name];
    }
    os.storage.set(StorageKeys.terminalAliases, this.aliases);
  }

  cmdExport(args) {
    if (!args.length) {
      Object.entries(this.env).forEach(([k, v]) => this.print(`declare -x ${k}="${v}"`));
      return;
    }
    for (const arg of args) {
      const eq = arg.indexOf("=");
      if (eq === -1) continue;
      const name = arg.slice(0, eq);
      const value = arg.slice(eq + 1);
      this.env[name] = value;
    }
  }

  cmdEnv() {
    Object.entries(this.env).forEach(([k, v]) => this.print(`${k}=${v}`));
  }

  async cmdMan(args) {
    if (!args.length) return this.print("What manual page do you want?");
    const name = args[0];
    const descriptions = {
      ls: "list directory contents",
      cd: "change the working directory",
      rm: "remove files or directories",
      cp: "copy files and directories",
      mv: "move or rename files and directories",
      grep: "print lines matching a pattern",
      find: "search for files in a directory hierarchy",
      cat: "concatenate and print files",
      head: "output the first part of files",
      tail: "output the last part of files",
      sort: "sort lines of text",
      uniq: "report or omit repeated lines",
      cut: "remove sections from each line of files",
      alias: "create a word substitution for a command",
      export: "set an exported shell variable"
    };
    if (this.commands[name]) {
      const desc = descriptions[name] || "a builtin shell command";
      await this.print(`${name.toUpperCase()}(1)`);
      await this.print("");
      await this.print(`    ${name} - ${desc}`);
      await this.print("");
      await this.print("SYNOPSIS");
      await this.print(`    ${name} [OPTIONS]... [ARGS]...`);
    } else {
      await this.print(`No manual entry for ${name}`);
    }
  }

  async cmdLess(args = [], flags = [], isPiped = false) {
    const { lines } = await this.linesFromInput(args, isPiped);
    if (!lines.length) return;
    const pageSize = 20;
    let offset = 0;

    this.terminalInputLine.style.display = "none";
    this.pagerActive = true;
    this.terminalInput.blur();

    const renderPage = async () => {
      const page = lines.slice(offset, offset + pageSize);
      for (const line of page) {
        await this.print(line);
      }
      offset += pageSize;
      const done = offset >= lines.length;
      await this.print(
        done ? "(END) press q to continue" : "-- more -- (space: next page, q: quit)",
        "var(--text-muted)"
      );
      return done;
    };

    const finish = () => {
      this.pagerActive = false;
      this.terminalInputLine.style.display = "flex";
      this.terminalInput.focus();
    };

    const done = await renderPage();
    if (done) {
      finish();
      return;
    }

    return new Promise((resolve) => {
      const onKey = (e) => {
        if (e.key === "q" || e.key === "Escape") {
          document.removeEventListener("keydown", onKey);
          finish();
          resolve();
        } else if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          renderPage().then((pageDone) => {
            if (pageDone) {
              document.removeEventListener("keydown", onKey);
              finish();
              resolve();
            }
          });
        }
      };
      document.addEventListener("keydown", onKey);
    });
  }

  async cmdDu(args = [], flags = []) {
    const summary = flags.some((f) => f.includes("s"));
    const humanReadable = flags.some((f) => f.includes("h"));

    const fmt = (size) => {
      const s = humanReadable ? formatSize(size) : String(size);
      return s.padStart(8);
    };

    const getFileSize = async (target) => {
      const parentPath = target.slice(0, -1);
      const name = target[target.length - 1];
      try {
        if (await this.fs.isFile(this.pathToString(parentPath), name)) {
          const parent = await this.fs.getFolder(this.pathToString(parentPath));
          return parent[name]?.size || 0;
        }
      } catch {}

      // Calculate directory size recursively
      const calcDirSize = async (pathArray) => {
        let totalSize = 0;
        try {
          const items = await this.fs.getFolder(this.pathToString(pathArray));
          for (const [itemName, itemMeta] of Object.entries(items)) {
            if (itemMeta.type === "file") {
              totalSize += itemMeta.size || 0;
            } else {
              totalSize += await calcDirSize([...pathArray, itemName]);
            }
          }
        } catch {}
        return totalSize;
      };

      return await calcDirSize(target);
    };

    const targets = args.length ? args.map((a) => this.fs.resolvePath(a, this.currentPath)) : [this.currentPath];

    for (const target of targets) {
      const displayPath = this.pathToString(target);
      if (summary) {
        const size = await getFileSize(target);
        await this.print(`${fmt(size)} ${displayPath}`);
      } else {
        try {
          const items = Object.entries(await this.fs.getFolder(this.pathToString(target)));
          for (const [name, meta] of items) {
            const itemPath = [...target, name];
            const itemSize = meta.type === "file" ? meta.size || 0 : await getFileSize(itemPath);
            await this.print(`${fmt(itemSize)} ${name}`);
          }
          if (targets.length <= 1) {
            const size = await getFileSize(target);
            await this.print(`${fmt(size)} total`);
          }
        } catch {}
      }
    }
  }

  async cmdTree(path = null, prefix = "") {
    if (path === null) path = [...this.currentPath];
    if (!prefix) await this.print(path.length ? "/" + path.join("/") : "/");

    let items;
    try {
      items = Object.keys(await this.fs.getFolder(this.pathToString(path)));
    } catch {
      await this.print(`tree: cannot access '${this.pathToString(path)}': No such file or directory`);
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const isFile = await this.fs.isFile(path, item);
      const last = i === items.length - 1;
      await this.print(prefix + (last ? "└── " : "├── ") + item + (isFile ? "" : "/"));
      if (!isFile) {
        await this.cmdTree([...path, item], prefix + (last ? "    " : "│   "));
      }
    }
  }

  async cmdPing(args) {
    if (!args.length) return this.print("Usage: ping <host>");
    await this.print(`PING ${args[0]} ...`);
    const start = performance.now();
    try {
      await fetch("https://" + args[0], { method: "HEAD", mode: "no-cors" });
    } catch (e) {
      console.error(e);
    }
    await this.print(`Reply from ${args[0]}: time=${(performance.now() - start).toFixed(2)}ms`);
  }

  async cmdCurl(args) {
    if (!args.length) return this.print("Usage: curl <url>");
    try {
      const text = await (await fetch(args[0])).text();
      this.print(text.slice(0, 1000));
    } catch {
      this.print(`curl: (6) Could not resolve host: ${args[0]}`);
    }
  }

  async cmdNeofetch() {
    os.events.emit(BusEvents.ACHIEVEMENT_TRIGGER, { achievementId: Achievements.Skid });
    const ua = navigator.userAgent;
    const platformRaw = navigator.userAgentData?.platform || navigator.platform || ua || "Unknown";

    let detectedOS = "Unknown";
    if (/Windows/i.test(platformRaw)) detectedOS = "Windows";
    else if (/Mac/i.test(platformRaw)) detectedOS = "macOS";
    else if (/Android/i.test(platformRaw)) detectedOS = "Android";
    else if (/iPhone|iPad|iOS/i.test(platformRaw)) detectedOS = "iOS";
    else if (/Linux/i.test(platformRaw)) detectedOS = "Linux";

    const osText = detectedOS === "Windows" ? "Eww a windows!" : detectedOS;

    let browser = "Unknown";
    if (/Firefox\/\d+/i.test(ua)) browser = "Firefox";
    else if (/Edg\/\d+/i.test(ua)) browser = "Edge";
    else if (/Chrome\/\d+/i.test(ua)) browser = "Chrome";
    else if (/Safari\/\d+/i.test(ua)) browser = "Safari";

    const browserText = browser === "Chrome" || browser === "Edge" ? "eww a chromium?!" : browser;

    const cores = navigator.hardwareConcurrency ?? "Unknown";
    const coresText = typeof cores === "number" && cores > 10 ? `${cores} (Wow its op!)` : cores;

    let gpu = "Unknown";
    let renderScore = 0;
    try {
      const canvas = createElement("canvas");
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      if (gl) {
        gpu = gl.getParameter(gl.RENDERER);
        const texSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        const varyings = gl.getParameter(gl.MAX_VARYING_VECTORS);
        const uniforms = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS);
        renderScore = Math.min(8, Math.floor((texSize / 2048 + varyings / 16 + uniforms / 128) * 1.2));
      }
    } catch (e) {
      console.error(e);
    }

    let engine = "Unknown";
    if (typeof InstallTrigger !== "undefined") engine = "SpiderMonkey";
    else if (typeof window.chrome !== "undefined") engine = "V8";
    else if (/Apple/.test(navigator.vendor)) engine = "JavaScriptCore";

    const ram = navigator.deviceMemory ? `${navigator.deviceMemory} GB` : "Unknown";
    const elapsed = Date.now() - this.pageLoadTime;
    const uptime = `${Math.floor(elapsed / 3600000)}h, ${Math.floor((elapsed % 3600000) / 60000)}m`;

    const theme = os.storage.get(StorageKeys.theme) || "dark";
    const power = os.storage.get(StorageKeys.performanceMode) || "balanced";
    const dnd = os.storage.get(StorageKeys.dndKey) === "true" ? "on" : "off";
    const winCount = $$(".window").length;
    const appCount = Object.keys(os.app.getAllApps()).length;
    const mx = audioMixer();
    const masterVol = mx.muted ? 0 : Math.round(mx.masterVolume * 100);

    const lines = [
      "",
      "",
      "                     " + this.displayName + "@" + this.hostname,
      `        /\\           OS          ${osText}`,
      `       /  \\          KERNEL      ${engine}`,
      `      /\\   \\         YukiOS      ${YUKIOS_VERSION}`,
      `     / > ω <\\        CPU Cores   ${coresText}`,
      `    /   __   \\       GPU         ${gpu}`,
      `   / __|  |__-\\      MEMOWY      ${ram}`,
      `  /_-''    ''-_\\     RESOLUTION  ${window.innerWidth}x${window.innerHeight}`,
      `                     THEME       ${theme}`,
      `                     BROWSER     ${browserText}`,
      `                     UPTIME      ${uptime}`,
      `                     APPS        ${appCount} reg  ${winCount} win`,
      `                     POWER       ${power}`,
      `                     DND         ${dnd}`,
      `                     VOLUME      ${masterVol}%`
    ];

    for (const line of lines) {
      await this.enqueuePrint(line);
    }
  }

  async cmdPs(args = []) {
    const isAux =
      args.includes("aux") || args.includes("-aux") || (args.includes("a") && args.includes("u") && args.includes("x"));
    const showAll = isAux || args.includes("-a") || args.includes("x") || args.includes("e");
    const user = this.displayName || "guest";
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const procs = processManager.getProcesses();

    if (isAux) {
      await this.print(`USER       PID  %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND`);
      for (const p of procs) {
        const vsz = p.isTray ? "0" : `${Math.floor(Math.random() * 200000) + 200000}`;
        const rss = p.isTray ? "0" : `${Math.floor(p.mem * 256)}`;
        const stat = p.status === "Tray" ? "T" : p.status === "Suspended" ? "S" : "R";
        await this.print(
          `${user.padEnd(10)}${String(p.pid).padStart(5)} ${p.cpu.toFixed(1).padStart(5)} ${p.mem.toFixed(1).padStart(5)} ${vsz.padStart(7)} ${rss.padStart(5)} pts/0    ${stat}    ${timeStr} 0:00 ${p.title}`
        );
      }
    } else if (showAll) {
      await this.print(`  PID TTY      TIME CMD`);
      for (const p of procs) {
        await this.print(`  ${String(p.pid).padStart(5)} pts/0  0:00 ${p.title}`);
      }
    } else {
      await this.print(`  PID STATUS   CMD`);
      for (const p of procs) {
        const status = p.status === "Tray" ? "Tray" : p.status === "Suspended" ? "Susp" : "Run ";
        await this.print(`  ${String(p.pid).padStart(5)} ${status}    ${p.title}`);
      }
    }
  }

  async cmdKill(args = []) {
    if (args.length === 0) {
      await this.print("kill: usage: kill [-s sigspec | -n signum | -sigspec] pid [pid...]");
      return;
    }

    let pidArg = args[args.length - 1];
    if (pidArg.startsWith("-")) {
      await this.print(`kill: unknown signal: ${pidArg}; using SIGTERM`);
      pidArg = args.length > 1 ? args[args.length - 1] : null;
      if (!pidArg) {
        await this.print("kill: usage: kill [-s sigspec | -n signum | -sigspec] pid [pid...]");
        return;
      }
    }

    const pid = parseInt(pidArg, 10);
    if (isNaN(pid)) {
      await this.print(`kill: ${pidArg}: arguments must be process or job IDs`);
      return;
    }

    const killed = processManager.killByPid(pid);
    if (killed) {
      await this.print(`[${pid}] terminated`);
    } else {
      await this.print(`kill: (${pid}) - No such process`);
    }
  }

  get tiling() {
    return os.tiling || null;
  }

  async cmdMovefocus(args = []) {
    const dir = args[0];
    if (!dir || !["l", "r", "u", "d", "left", "right", "up", "down"].includes(dir)) {
      await this.print("usage: movefocus <l|r|u|d>");
      return;
    }
    const dirmap = { l: "left", r: "right", u: "up", d: "down" };
    const direction = dirmap[dir] || dir;
    if (!this.tiling) {
      await this.print("Tiling mode is not active");
      return;
    }
    this.tiling.focusDirection(direction);
  }

  async cmdSwapwindow(args = []) {
    const dir = args[0];
    if (!dir || !["l", "r", "u", "d", "left", "right", "up", "down"].includes(dir)) {
      await this.print("usage: swapwindow <l|r|u|d>");
      return;
    }
    const dirmap = { l: "left", r: "right", u: "up", d: "down" };
    const direction = dirmap[dir] || dir;
    if (!this.tiling) {
      await this.print("Tiling mode is not active");
      return;
    }
    this.tiling.swapDirection(direction);
  }

  async cmdTogglefloating() {
    if (!this.tiling) {
      await this.print("Tiling mode is not active");
      return;
    }
    this.tiling.toggleFloating();
  }

  async cmdFullscreen(args = []) {
    if (!this.tiling) {
      await this.print("Tiling mode is not active");
      return;
    }
    this.tiling.toggleFullscreenOnTiled();
  }

  async cmdTogglesplit() {
    if (!this.tiling) {
      await this.print("Tiling mode is not active");
      return;
    }
    this.tiling.toggleSplitType();
  }

  async cmdResizeactive(args = []) {
    const dir = args[0];
    if (!dir || !["l", "r", "u", "d", "left", "right", "up", "down"].includes(dir)) {
      await this.print("usage: resizeactive <l|r|u|d>");
      return;
    }
    const dirmap = { l: "left", r: "right", u: "up", d: "down" };
    const direction = dirmap[dir] || dir;
    if (!this.tiling) {
      await this.print("Tiling mode is not active");
      return;
    }
    this.tiling.resizeDirection(direction);
  }

  async cmdCyclenext(args = []) {
    if (!this.tiling) {
      await this.print("Tiling mode is not active");
      return;
    }
    const forward = args[0] !== "prev";
    this.tiling.cycleFocus(forward);
  }

  async cmdKillactive() {
    if (this.tiling) {
      this.tiling.closeFocusedWindow();
    } else {
      const openWindows = os.window.getOpenWindows();
      const wins = Array.from(openWindows ? openWindows.keys() : [])
        .map((id) => $(`#${id}`))
        .filter(Boolean)
        .sort((a, b) => parseInt(b.style.zIndex) - parseInt(a.style.zIndex));
      const focused = wins[0];
      if (focused) os.window.close(focused);
    }
  }

  async cmdHelp() {
    const cmds = [
      ["help", "Show this help message"],
      ["neofetch", "Display system/browser summary"],
      ["clear", "Clear the terminal screen"],
      ["ls", "List directory contents"],
      ["pwd", "Print working directory"],
      ["cd [dir]", "Change directory"],
      ["mkdir", "Create a new directory"],
      ["touch", "Create a new file"],
      ["rm", "Remove file or directory"],
      ["cp", "Copy files or directories"],
      ["mv", "Move or rename files or directories"],
      ["cat", "Display file contents"],
      ["echo", "Display a line of text"],
      ["grep", "Search for pattern in input"],
      ["wc", "Count lines, words, and characters"],
      ["head", "Output the first lines of input"],
      ["tail", "Output the last lines of input"],
      ["sort", "Sort lines of input"],
      ["uniq", "Collapse adjacent duplicate lines"],
      ["cut", "Extract fields from each line"],
      ["find", "Search a directory tree"],
      ["which", "Show the resolved location of a command"],
      ["type", "Describe how a command name would be interpreted"],
      ["alias", "Create or list command aliases"],
      ["unalias", "Remove a command alias"],
      ["export", "Set or list exported variables"],
      ["env", "List environment variables"],
      ["man", "Show a manual page for a command"],
      ["less", "Page through long output"],
      ["whoami", "Display current user"],
      ["hostname", "Display hostname"],
      ["date", "Display current date and time"],
      ["history", "Show command history"],
      ["tree", "Display directory tree"],
      ["du", "Estimate file/directory sizes"],
      ["git", "Git version control (clone, init, add, commit, status, log, ...)"],
      ["shutdown", "Shut down YukiOS"],
      ["reboot", "Restart YukiOS"],
      ["lock", "Lock the current session"],
      ["logout", "Sign out and return to login screen"],
      ["signout", "Sign out and return to login screen"],
      ["exit", "Close the terminal"],
      ["yuki", "OS control command - see 'yuki help'"],
      ["notepad", "Edit a file in Notepad"],
      ["vim/nano/gedit", "Aliases for notepad"],
      ["hyprctl", "Hyprland-style window manager control - see 'hyprctl help'"],
      ["movefocus", "Move focus to neighbor window (<l|r|u|d>)"],
      ["swapwindow", "Swap focused window with neighbor (<l|r|u|d>)"],
      ["togglefloating", "Toggle floating mode for focused window"],
      ["fullscreen", "Toggle fullscreen for focused tiled window"],
      ["togglesplit", "Toggle split orientation (h/v)"],
      ["resizeactive", "Resize the active split boundary (<l|r|u|d>)"],
      ["cyclenext", "Cycle focus to next/prev tiled window"],
      ["killactive", "Close the active window"],
      ["python", "Run Python code or enter interactive REPL"],
      ["python3", "Alias for python"],
      ["python -m http.server", "Serve the current directory over localhost"],
      ["node", "Run JS code or enter Node.js REPL"]
    ];
    await this.print("Available commands:");
    for (const [cmd, desc] of cmds) {
      await this.print(`  ${cmd.padEnd(10)} - ${desc}`);
    }
    await this.print("");
    await this.print("Glob patterns: * (match any), ? (match one)");
    await this.print("Pipes: command1 | command2   Chaining: cmd1 && cmd2, cmd1 || cmd2, cmd1 ; cmd2");
    await this.print("Redirection: cmd > file, cmd >> file, cmd < file");
    await this.print("Variables: $VAR, ${VAR}, $?   Set with: export VAR=value");
    await this.print("Shortcuts: Alt+T new tab, Alt+W close tab, Ctrl+R reverse search");
  }

  async cmdGit(args = [], flags = []) {
    if (!args.length) {
      await this.print("usage: git <command> [<args>]");
      return this.gitHelp();
    }

    const sub = args[0];
    const subArgs = args.slice(1);
    try {
      switch (sub) {
        case "clone":
          await this.gitClone(subArgs, flags);
          break;
        case "init":
          await this.gitInit(subArgs);
          break;
        case "add":
          await this.gitAdd(subArgs, flags);
          break;
        case "commit":
          await this.gitCommit(subArgs, flags);
          break;
        case "status":
          await this.gitStatus();
          break;
        case "log":
          await this.gitLog(subArgs, flags);
          break;
        case "branch":
          await this.gitBranch(subArgs, flags);
          break;
        case "checkout":
          await this.gitCheckout(subArgs);
          break;
        case "pull":
          await this.gitPull();
          break;
        case "push":
          await this.gitPush();
          break;
        case "remote":
          await this.gitRemote(subArgs);
          break;
        case "rm":
          await this.gitRm(subArgs);
          break;
        case "diff":
          await this.gitDiff();
          break;
        case "stash":
          await this.gitStash(subArgs);
          break;
        case "fetch":
          await this.gitFetch();
          break;
        case "help":
          await this.gitHelp();
          break;
        default:
          await this.print(`git: '${sub}' is not a git command. See 'git help'.`);
      }
    } catch (e) {
      await this.print(`git: error: ${e.message}`);
      if (e.code) await this.print(`  code: ${e.code}`);
      if (e.data) await this.print(`  data: ${e.data}`);
      console.error("git error:", e);
    }
  }

  async gitRequireRepo(dir) {
    const headPath = `${dir}/.git`;
    const exists = await this.gitManager.storage.exists(headPath);
    if (!exists) throw new Error("not a git repository");
  }

  async gitClone(args, extraFlags = []) {
    if (args.length < 1) return this.print("usage: git clone <url> [<dir>]");
    let depth;
    if (extraFlags.includes("--depth") && args.length > 1) {
      const last = args[args.length - 1];
      const n = parseInt(last, 10);
      if (!isNaN(n)) {
        depth = n;
        args = args.slice(0, -1);
      }
    }
    const posArgs = args.filter((a) => !a.startsWith("-"));
    let url = posArgs[0];
    if (!url) return this.print("usage: git clone <url> [<dir>]");
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    let dir;
    if (posArgs.length > 1) {
      dir = this.pathToString(this.fs.resolvePath(posArgs[1], this.currentPath));
    } else {
      const name =
        url
          .split("/")
          .pop()
          .replace(/\.git$/, "") || "repo";
      dir = this.pathToString(this.fs.resolvePath(name, this.currentPath));
    }

    await this.print(`Cloning into '${dir}' ...`);
    const statusEl = createElement("div");
    statusEl.style.color = "var(--text-secondary)";
    statusEl.style.fontSize = "12px";
    this.terminalOutput.appendChild(statusEl);

    let lastPhase = "";
    const onProgress = (ev) => {
      if (ev.phase !== lastPhase) {
        lastPhase = ev.phase;
        const pct = ev.total ? ` ${Math.round((ev.loaded / ev.total) * 100)}%` : "";
        statusEl.textContent = `  ${ev.phase}${pct}`;
      }
    };

    await this.gitManager.clone(url, dir, onProgress, depth);
    statusEl.textContent = "";
    await this.fs.updateMetadataFromStats(dir);
    await this.print("done.");
  }

  async gitInit(args) {
    let dir;
    if (args.length) {
      dir = this.pathToString(this.fs.resolvePath(args[0], this.currentPath));
    } else {
      dir = this.pathToString(this.currentPath);
    }
    await this.gitManager.init(dir);
    await this.print(`Initialized empty Git repository in ${dir}/.git/`);
  }

  async gitAdd(args, flags) {
    const dir = this.pathToString(this.currentPath);
    try {
      await this.gitRequireRepo(dir);
    } catch (e) {
      return this.print(`fatal: ${e.message}`);
    }

    if (!args.length && flags.indexOf("-A") === -1 && flags.indexOf("--all") === -1) {
      return this.print("Nothing specified, nothing added.\nMaybe you wanted to say 'git add .'?");
    }

    if (flags.indexOf("-A") !== -1 || flags.indexOf("--all") !== -1 || args.indexOf(".") !== -1) {
      const matrix = await this.gitManager.statusMatrix(dir);
      let count = 0;
      for (const [filepath] of matrix) {
        await this.gitManager.add(dir, filepath);
        count++;
      }
      await this.print(`added ${count} file(s)`);
      return;
    }

    for (const file of args) {
      await this.gitManager.add(dir, file);
      await this.print(`add '${file}'`);
    }
  }

  async gitCommit(args, flags) {
    const dir = this.pathToString(this.currentPath);
    try {
      await this.gitRequireRepo(dir);
    } catch (e) {
      return this.print(`fatal: ${e.message}`);
    }

    let message = null;
    for (const f of flags) {
      if (f === "-m") {
        message = args.length ? args[0] : "";
      } else if (f.startsWith("-m")) {
        message = f.slice(2);
      }
    }

    if (!message) {
      message = await os.dialog.prompt("Commit", "Enter commit message:");
      if (!message) return this.print("commit aborted");
    }

    const author = {
      name: this.displayName,
      email: `${this.displayName}@${this.hostname}`
    };

    const oid = await this.gitManager.commit(dir, message, author);
    await this.print(`[${await this.gitManager.currentBranch(dir)} ${oid.slice(0, 7)}] ${message}`);
  }

  async gitStatus() {
    const dir = this.pathToString(this.currentPath);
    try {
      await this.gitRequireRepo(dir);
    } catch (e) {
      return this.print(`fatal: ${e.message}`);
    }

    const branch = (await this.gitManager.currentBranch(dir)) || "HEAD";
    await this.print(`On branch ${branch}`);

    const matrix = await this.gitManager.statusMatrix(dir);
    const staged = [];
    const notStaged = [];
    const untracked = [];

    for (const [filepath, head, workdir, stage] of matrix) {
      if (stage !== head) {
        const status = head === 0 ? "new file" : stage === 0 ? "deleted" : "modified";
        staged.push(`  ${status}: ${filepath}`);
      }
      if (workdir !== stage) {
        const status = stage === 0 ? "new file" : workdir === 0 ? "deleted" : "modified";
        notStaged.push(`  ${status}: ${filepath}`);
      }
    }

    if (staged.length) {
      await this.print("Changes to be committed:");
      for (const s of staged) await this.print(s);
    }
    if (notStaged.length) {
      await this.print("Changes not staged for commit:");
      for (const s of notStaged) await this.print(s);
    }
    if (!staged.length && !notStaged.length) {
      await this.print("nothing to commit, working tree clean");
    }
  }

  async gitLog(args, flags) {
    const dir = this.pathToString(this.currentPath);
    try {
      await this.gitRequireRepo(dir);
    } catch (e) {
      return this.print(`fatal: ${e.message}`);
    }

    const oneline = flags.indexOf("--oneline") !== -1;
    let depth = 30;

    for (const f of flags) {
      const m = f.match(/^-(\d+)$/);
      if (m) depth = parseInt(m[1], 10);
    }

    try {
      const commits = await this.gitManager.log(dir, { depth });
      if (!commits || commits.length === 0) {
        return this.print("fatal: your current branch has no commits yet");
      }

      for (const commit of commits) {
        const oid = (commit.oid || "").slice(0, 7);
        const msg = (commit.commit?.message || "").split("\n")[0];
        if (oneline) {
          await this.print(`${oid} ${msg}`);
        } else {
          const author = commit.commit?.author || {};
          const date = author.timestamp ? new Date(author.timestamp * 1000).toLocaleString() : "unknown";
          await this.print("");
          await this.print(`commit ${commit.oid}`);
          await this.print(`Author: ${author.name} <${author.email}>`);
          await this.print(`Date:   ${date}`);
          await this.print("");
          await this.print(`    ${msg}`);
        }
      }
    } catch (e) {
      await this.print(`fatal: ${e.message}`);
    }
  }

  async gitBranch(args, flags) {
    const dir = this.pathToString(this.currentPath);
    try {
      await this.gitRequireRepo(dir);
    } catch (e) {
      return this.print(`fatal: ${e.message}`);
    }

    const showRemote = flags.indexOf("-a") !== -1 || flags.indexOf("--all") !== -1;

    if (!args.length) {
      const branches = await this.gitManager.listBranches(dir);
      const current = await this.gitManager.currentBranch(dir);
      for (const b of branches) {
        const marker = b === current ? "* " : "  ";
        await this.print(`${marker}${b}`);
      }
      if (showRemote) {
        const remotes = await this.gitManager.listRemotes(dir);
        for (const { remote } of remotes) {
          try {
            const refs = await this.gitManager.listBranches(dir);
            for (const b of refs) {
              if (b !== current) await this.print(`  remotes/${remote}/${b}`);
            }
          } catch {}
        }
      }
      return;
    }

    await this.gitManager.branch(dir, args[0]);
    await this.print(`Created branch '${args[0]}'`);
  }

  async gitCheckout(args) {
    if (!args.length) return this.print("usage: git checkout <branch>");
    const dir = this.pathToString(this.currentPath);
    try {
      await this.gitRequireRepo(dir);
    } catch (e) {
      return this.print(`fatal: ${e.message}`);
    }

    await this.gitManager.checkout(dir, args[0]);
    await this.print(`Switched to branch '${args[0]}'`);
  }

  async gitPull() {
    const dir = this.pathToString(this.currentPath);
    try {
      await this.gitRequireRepo(dir);
    } catch (e) {
      return this.print(`fatal: ${e.message}`);
    }

    await this.print("Fetching remote changes...");
    const author = {
      name: this.displayName,
      email: `${this.displayName}@${this.hostname}`
    };

    await this.gitManager.pull(dir, author);
    await this.print("Pull completed.");
  }

  async gitPush() {
    const dir = this.pathToString(this.currentPath);
    try {
      await this.gitRequireRepo(dir);
    } catch (e) {
      return this.print(`fatal: ${e.message}`);
    }

    const remotes = await this.gitManager.listRemotes(dir);
    if (!remotes.length) return this.print("fatal: No configured remote. Use 'git remote add'.");

    await this.print("Pushing to remote...");
    const onAuth = () => os.dialog.prompt("Git Auth", "Enter your GitHub token (or user:token):");
    const onProgress = (ev) => {
      if (ev.total && ev.loaded) {
        const pct = Math.round((ev.loaded / ev.total) * 100);
        this.print(`  push: ${pct}%`);
      }
    };

    await this.gitManager.push(dir, onAuth, onProgress);
    await this.print("Push completed.");
  }

  async gitRemote(args) {
    const dir = this.pathToString(this.currentPath);
    try {
      await this.gitRequireRepo(dir);
    } catch (e) {
      return this.print(`fatal: ${e.message}`);
    }

    if (!args.length || args[0] === "-v") {
      const remotes = await this.gitManager.listRemotes(dir);
      if (!remotes.length) return this.print("No remotes configured.");
      for (const { remote, url } of remotes) {
        await this.print(`${remote}\t${url}`);
      }
      return;
    }

    if (args[0] === "add" && args.length >= 3) {
      const [, name, url] = args;
      await this.gitManager.addRemote(dir, name, url);
      await this.print(`Added remote '${name}' -> ${url}`);
      return;
    }

    if (args[0] === "remove" && args.length >= 2) {
      await this.gitManager.deleteRemote(dir, args[1]);
      await this.print(`Removed remote '${args[1]}'`);
      return;
    }

    await this.print("usage: git remote [-v] | add <name> <url> | remove <name>");
  }

  async gitRm(args) {
    if (!args.length) return this.print("usage: git rm <file>...");
    const dir = this.pathToString(this.currentPath);
    try {
      await this.gitRequireRepo(dir);
    } catch (e) {
      return this.print(`fatal: ${e.message}`);
    }

    for (const file of args) {
      await this.gitManager.remove(dir, file);
      const full = dir + "/" + file;
      try {
        await this.gitManager.storage.p("unlink", full);
      } catch {}
      await this.print(`rm '${file}'`);
    }
  }

  async gitDiff() {
    const dir = this.pathToString(this.currentPath);
    try {
      await this.gitRequireRepo(dir);
    } catch (e) {
      return this.print(`fatal: ${e.message}`);
    }

    const changed = await this.gitManager.diff(dir);
    if (!changed.length) {
      await this.print("no changes");
      return;
    }
    for (const file of changed) {
      await this.print(`modified:   ${file}`);
    }
  }

  async gitStash(args) {
    const dir = this.pathToString(this.currentPath);
    try {
      await this.gitRequireRepo(dir);
    } catch (e) {
      return this.print(`fatal: ${e.message}`);
    }

    if (args[0] === "pop") {
      await this.gitManager.stashPop(dir);
      await this.print("stash pop done");
      return;
    }

    await this.gitManager.stash(dir);
    await this.print("Saved working directory to stash");
  }

  async gitFetch() {
    const dir = this.pathToString(this.currentPath);
    try {
      await this.gitRequireRepo(dir);
    } catch (e) {
      return this.print(`fatal: ${e.message}`);
    }

    await this.print("Fetching...");
    await this.gitManager.fetch(dir);
    await this.print("Fetch completed.");
  }

  gitHelp() {
    const cmds = [
      ["clone", "Clone a repository into a new directory"],
      ["init", "Create an empty Git repository"],
      ["add", "Add file contents to the index"],
      ["commit", "Record changes to the repository"],
      ["status", "Show the working tree status"],
      ["log", "Show commit logs"],
      ["branch", "List, create branches"],
      ["checkout", "Switch branches"],
      ["pull", "Fetch from and integrate with another repository"],
      ["push", "Update remote refs along with associated objects"],
      ["remote", "Manage set of tracked repositories"],
      ["rm", "Remove files from working tree and index"],
      ["diff", "Show changes between commits, commit and working tree"],
      ["stash", "Stash away changes in a dirty working directory"],
      ["fetch", "Download objects and refs from another repository"]
    ];
    for (const [cmd, desc] of cmds) {
      this.print(`  ${cmd.padEnd(10)} ${desc}`);
    }
  }

  async cmdPython(args = [], flags = []) {
    if (flags.includes("-m")) {
      if (args[0] === "http.server") {
        return this.cmdHttpServer(args.slice(1), flags);
      }
      return this.print(`python: no module named ${args[0] || ""}`, "var(--error)");
    }
    if (flags.includes("-c") || flags.includes("--command")) {
      const code = args.join(" ");
      if (!code) return this.print("python: -c option requires an argument");
      await this.execPythonCode(code);
      return;
    }
    if (args.length && !args[0].startsWith("-")) {
      const filePath = args[0];
      try {
        const resolved = this.fs.resolvePath(filePath, this.currentPath);
        const content = await this.fs.readTextFile(this.pathToRelative(resolved), "");
        if (content == null) {
          throw new Error("missing");
        }
        await this.execPythonCode(content);
      } catch {
        await this.print(`python: can't open file '${filePath}': No such file or directory`);
      }
      return;
    }
    await this.enterPythonRepl();
  }

  async cmdHttpServer(args, flags) {
    let port = 8000;
    for (const arg of args) {
      if (/^\d{1,5}$/.test(arg)) port = parseInt(arg, 10);
    }
    if (port < 1 || port > 65535) {
      return this.print(`python: http.server: invalid port number: '${port}'`, "var(--error)");
    }
    let rootSegments = [...this.currentPath];
    for (const flag of flags) {
      if (flag.startsWith("--directory=")) {
        rootSegments = this.fs.resolvePath(flag.slice("--directory=".length), this.currentPath);
      } else if (flag === "--directory" || flag === "-d") {
        const dirArg = args.find((arg) => !/^\d{1,5}$/.test(arg));
        if (dirArg) rootSegments = this.fs.resolvePath(dirArg, this.currentPath);
      }
    }
    if (os.ports.isRegistered(port)) {
      return this.print(`python: http.server: address already in use: port ${port}`, "var(--error)");
    }
    await startVirtualHttpServer(
      {
        fs: os.fs,
        print: (text) => this.print(text),
        printError: (text) => this.print(text, "var(--error)"),
        getStopRequested: () => this.stopRequested || !this.activeState?.win?.isConnected
      },
      { port, rootSegments }
    );
  }

  async execPythonCode(code) {
    try {
      await this.print("Loading Python...");
      const { result, stdout, stderr, error } = await runPython(code);
      if (error) {
        await this.print("Traceback (most recent call last):", "var(--error)");
        await this.print(error, "var(--error)");
        return;
      }
      if (stdout) await this.print(stdout.trimEnd());
      if (stderr) await this.print(stderr.trimEnd(), "var(--error)");
      if (result !== undefined) await this.print(String(result));
    } catch (e) {
      await this.print(String(e.message || e), "var(--error)");
    }
  }

  async enterPythonRepl() {
    this.pyReplActive = true;
    this.pyReplBuffer = "";
    this.pyReplContinuation = false;
    this.updatePrompt();
    this.terminalInput.focus();
  }

  async exitPythonRepl() {
    this.pyReplActive = false;
    this.pyReplBuffer = "";
    this.pyReplContinuation = false;
    this.updatePrompt();
  }

  async runPythonRepl(line) {
    if (line === "exit()" || line === "quit()" || line === "exit" || line === "quit") {
      await this.exitPythonRepl();
      return;
    }
    const promptStr = this.pyReplContinuation ? "..." : ">>>";
    await this.print(line, null, true, `<span class="prompt-python">${promptStr} </span>`);
    this.pyReplBuffer += line + "\n";
    try {
      const { result, stdout, stderr, error } = await runPython(this.pyReplBuffer);
      if (stdout) await this.print(stdout.trimEnd());
      if (stderr) await this.print(stderr.trimEnd(), "var(--error)");
      if (error) {
        const isIncomplete =
          error.includes("unexpected EOF while parsing") ||
          error.includes("expected an indented block") ||
          error.includes("Unmatched") ||
          (error.includes("invalid syntax") && line.endsWith(":"));
        if (isIncomplete && line.trim()) {
          this.pyReplContinuation = true;
          this.updatePrompt();
          return;
        }
        await this.print("Traceback (most recent call last):", "var(--error)");
        await this.print(error, "var(--error)");
        this.pyReplBuffer = "";
      } else {
        if (result !== undefined) await this.print(String(result));
        this.pyReplBuffer = "";
      }
    } catch (e) {
      await this.print(String(e.message || e), "var(--error)");
      this.pyReplBuffer = "";
    }
    this.pyReplContinuation = false;
    this.updatePrompt();
  }

  async cmdNode(args = [], flags = []) {
    if (flags.includes("-e") || flags.includes("--eval")) {
      const code = args.join(" ");
      if (!code) return this.print("node: -e option requires an argument");
      await this.execNodeCode(code);
      return;
    }
    if (args.length && !args[0].startsWith("-")) {
      const filePath = args[0];
      try {
        const resolved = this.fs.resolvePath(filePath, this.currentPath);
        const content = await this.fs.readTextFile(this.pathToRelative(resolved), "");
        await this.execNodeCode(content, filePath);
      } catch {
        await this.print(`node: can't open file '${filePath}': No such file or directory`);
      }
      return;
    }
    await this.enterNodeRepl();
  }

  async execNodeCode(code, filename) {
    try {
      if (!self.crossOriginIsolated) {
        if (!this.nodeFallbackWarned) {
          this.nodeFallbackWarned = true;
          await this.enqueuePrint(
            "Current webserver lacks cross-origin isolation, falling back to basic JavaScript eval."
          );
        }
        await this.print("Falling back to basic JavaScript eval...");
      } else {
        await this.print("Loading Node.js runtime...");
      }
      const { stdout, stderr, error } = await runNode(code, filename || "/eval.js");
      if (error) {
        await this.print(error, "var(--error)");
        return;
      }
      if (stdout) await this.print(stdout.trimEnd());
      if (stderr) await this.print(stderr.trimEnd(), "var(--error)");
    } catch (e) {
      await this.print(String(e.message || e), "var(--error)");
    }
  }

  async enterNodeRepl() {
    this.nodeReplActive = true;
    this.nodeReplBuffer = "";
    this.nodeReplContinuation = false;
    this.updatePrompt();
    this.terminalInput.focus();
  }

  async cmdBash(args = []) {
    if (!args.length) {
      await this.print("Usage: bash <script-file>");
      await this.print("  Execute a shell script from the filesystem");
      return;
    }

    const scriptPath = args[0];
    try {
      const resolved = this.fs.resolvePath(scriptPath, this.currentPath);
      const content = await this.fs.readTextFile(this.pathToRelative(resolved), "");

      if (!content || content.trim() === "") {
        await this.print(`bash: ${scriptPath}: empty script`);
        return;
      }

      const shebang = content.startsWith("#!") ? content.split("\n")[0] : null;
      let scriptContent = content;
      if (shebang) {
        scriptContent = content.split("\n").slice(1).join("\n");
      }

      this.shellEnv.set("PWD", this.currentPath.length ? "/" + this.currentPath.join("/") : "/");
      this.shellEnv.set("HOSTNAME", this.hostname);
      this.shellEnv.set("USER", this.displayName);

      const ctx = this.buildCommandContext();
      if (!this.shellInterpreter) {
        this.shellInterpreter = new ShellInterpreter(ctx);
      }
      const ast = this.shellParser.parse(scriptContent);
      const result = await this.shellInterpreter.execute(ast);

      if (this.activeState) {
        this.activeState.lastExitCode = result.exitCode;
      }
    } catch (e) {
      await this.print(`bash: ${scriptPath}: ${e.message || "No such file or directory"}`);
      if (this.activeState) this.activeState.lastExitCode = 127;
    }
  }

  async exitNodeRepl() {
    this.nodeReplActive = false;
    this.nodeReplBuffer = "";
    this.nodeReplContinuation = false;
    this.updatePrompt();
  }

  async runNodeRepl(line) {
    if (line === ".exit" || line === "exit" || line === "exit()") {
      await this.exitNodeRepl();
      return;
    }
    const promptStr = this.nodeReplContinuation ? "..." : ">";
    await this.print(line, null, true, `<span class="prompt-node">${promptStr} </span>`);
    this.nodeReplBuffer += line + "\n";
    try {
      const { stdout, stderr, error } = await runNode(line, "/repl.js");
      if (stdout) await this.print(stdout.trimEnd());
      if (stderr) await this.print(stderr.trimEnd(), "var(--error)");
      if (error) {
        await this.print(error, "var(--error)");
        this.nodeReplBuffer = "";
      }
    } catch (e) {
      await this.print(String(e.message || e), "var(--error)");
      this.nodeReplBuffer = "";
    }
    this.nodeReplContinuation = false;
    this.updatePrompt();
  }

  cmdShutdown() {
    os.dialog.confirm("Shutdown", "Shut down YukiOS?").then((ok) => {
      if (ok) window.close();
    });
  }

  cmdReboot() {
    os.dialog.confirm("Restart", "Restart YukiOS?").then((ok) => {
      if (ok) location.reload();
    });
  }

  async cmdLock() {
    await this.print("Locking session...");
    this.os.app.lockSession();
  }

  async cmdLogout() {
    await this.print("Signing out...");
    this.os.app.lockToLoginScreen();
  }

  cmdExit() {
    const state = this.activeState;
    if (state) {
      if (state.lavatActive) this.stopLavat();
      if (state.btopActive) this.stopBtop();
      if (state.cmatrixActive) this.stopCmatrix();
    }
    const win = state?.win || this.win || state?.terminalOutput?.closest(".window");
    if (!win) return;
    if (state) this.windowsMap.delete(win.id);
    os.window.removeFromTaskbar(win.id);
    win.remove();
  }

  onClose(winId) {
    const state = this.windowsMap.get(winId);
    if (!state) {
      if (this.lavatActive) this.stopLavat();
      if (this.btopActive) this.stopBtop();
      if (this.cmatrixActive) this.stopCmatrix();
      return;
    }
    if (state.lavatActive) this.stopLavat();
    if (state.btopActive) this.stopBtop();
    if (state.cmatrixActive) this.stopCmatrix();
    this.windowsMap.delete(winId);
  }
}
