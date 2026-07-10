import "../styles/terminal.css";
import { Achievements } from "../achievements.js";
import { BusEvents } from "../core/EventBus.js";
import { KeybindManager } from "../keybindManager.js";
import { showContextMenu } from "../shared/contextMenu.js";
import { BaseApp, StorageKeys, os } from "../framework.js";
import { GitManager } from "../services/GitManager.js";
import { getAppRegistry } from "../appRegistry.js";
import { formatSize } from "../utils/utils.js";

export class TerminalApp extends BaseApp {
  constructor(services) {
    super(services);
    this.sessionKey = services.fileSystemManager?.sessionKey || "guest";
    this.currentPath = ["ys", "users", this.sessionKey];
    this.history = os.storage.get(StorageKeys.historyStorageKey) || [];
    this.historyIndex = this.history.length;
    this.displayName = os.storage.get(StorageKeys.username) || this.sessionKey;
    this.username = this.displayName;
    this.hostname = "yuki-os";
    this.setupSessionListener();
    this.printQueue = Promise.resolve();
    this.commands = {};
    this.pageLoadTime = Date.now();
    this.isPrinting = false;
    this.inputBuffer = "";
    this.printDepth = 0;
    this.env = {
      PATH: "/usr/bin:/bin",
      HOME: `/home/${this.displayName}`,
      USER: this.displayName,
      SHELL: "/bin/yush",
      TERM: "xterm-256color"
    };
    this.aliases = os.storage.get(StorageKeys.terminalAliases) || {};
    this.gitManager = new GitManager(services.fileSystemManager);
    this.lastExitCode = 0;
    this.reverseSearchActive = false;
    this.reverseSearchQuery = "";
    this.reverseSearchIndex = -1;
    this.pagerActive = false;
    this.commandRunning = false;
    this.tabs = [{ id: 1, currentPath: [...this.currentPath], outputHTML: "" }];
    this.activeTabId = 1;
    this.tabCounter = 1;
    this.registerDefaultCommands();
  }

  open(opts) {
    const win = os.window.create("terminal-win", "Terminal", "700px", "500px", {
      icon: "static/icons/terminal.webp"
    });
    win.innerHTML = `<div class="window-content terminal-content">
      <div class="terminal-tabs" id="terminal-tabs"></div>
      <div class="terminal-output" id="terminal-output"></div>
      <div class="terminal-input-line" id="terminal-input-line">
        <span id="terminal-prompt"></span>
        <textarea class="terminal-input" id="terminal-input" spellcheck="false" autocomplete="off" rows="1"></textarea>
      </div>
    </div>`;

    win.querySelector("#terminal-output")?.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this.showTerminalContextMenu(e);
    });

    this.initTerminal(opts);
  }

  initTerminal(opts) {
    const initialPath = opts?.initialPath || null;
    if (initialPath) this.currentPath = initialPath;
    this.terminalOutput = document.getElementById("terminal-output");
    this.terminalInput = document.getElementById("terminal-input");
    this.terminalPrompt = document.getElementById("terminal-prompt");
    this.terminalInputLine = document.getElementById("terminal-input-line");
    this.terminalTabsEl = document.getElementById("terminal-tabs");
    this.tabs = [{ id: 1, currentPath: [...this.currentPath], outputHTML: "" }];
    this.activeTabId = 1;
    this.tabCounter = 1;
    this.renderTabs();
    this.updatePrompt();
    this.setupEventHandlers();
    this.terminalInput.addEventListener("input", () => {
      this.terminalInput.style.height = "auto";
      this.terminalInput.style.height = this.terminalInput.scrollHeight + "px";
    });
  }

  setupSessionListener() {
    os.events.on("session:initialized", (session) => {
      this.sessionKey = session.key;
      this.displayName = session.name || os.storage.get(StorageKeys.username) || session.key;
      this.username = this.displayName;
      this.currentPath = ["ys", "users", session.key];
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

  async print(text, color = null, isCommand = false, promptText = null, delay = 1) {
    this.printDepth++;
    if (this.printDepth === 1) {
      this.isPrinting = true;
      this.inputBuffer = this.terminalInput.value;
      this.terminalInput.value = "";
      this.terminalInput.disabled = true;
    }

    const line = document.createElement("div");
    const span = document.createElement("span");

    if (isCommand) {
      const prompt = document.createElement("span");
      prompt.innerHTML = promptText || this.promptHtml();
      line.className = "cmd-line";
      line.appendChild(prompt);
      span.className = "cmd-text";
      line.appendChild(span);
    } else {
      if (color) span.style.color = color;
      line.appendChild(span);
    }

    this.terminalOutput.appendChild(line);

    span.textContent = text;
    this.terminalOutput.parentElement.scrollTop = this.terminalOutput.parentElement.scrollHeight;

    this.printDepth--;
    if (this.printDepth === 0) {
      this.isPrinting = false;
      this.terminalInput.disabled = this.pagerActive || this.commandRunning;
      this.terminalInput.value = this.inputBuffer;
      if (!this.pagerActive && !this.commandRunning) this.terminalInput.focus();
    }
  }

  enqueuePrint(text, color = null, isCommand = false, promptText = null, delay = 1) {
    this.printQueue = this.printQueue.then(() => this.print(text, color, isCommand, promptText, delay));
    return this.printQueue;
  }

  async runEnteredCommand() {
    if (this.commandRunning) return;
    const command = this.terminalInput.value.trim();
    if (!command) return;
    this.history.push(command);
    this.historyIndex = this.history.length;
    os.storage.set(StorageKeys.historyStorageKey, this.history.slice(-500));
    this.terminalInput.value = "";
    this.terminalInputLine.style.display = "none";
    this.commandRunning = true;
    try {
      await this.executeCommand(command);
    } finally {
      this.commandRunning = false;
      this.terminalInputLine.style.display = "flex";
      this.terminalInput.disabled = false;
      this.terminalInput.focus();
    }
  }

  setupEventHandlers() {
    this.terminalInput.addEventListener("keydown", (e) => {
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
        this.enqueuePrint("^C", null, true, this.promptHtml());
        this.terminalInput.value = "";
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
        this.newTab();
      } else if (e.altKey && /^[1-9]$/.test(e.key)) {
        e.preventDefault();
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

    const win = document.getElementById("terminal-win");

    win.addEventListener("mousedown", (e) => {
      if (e.target.closest(".terminal-output")) return;
      const selection = window.getSelection();
      if (selection) selection.removeAllRanges();
    });

    win.addEventListener("mouseup", (e) => {
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
    const tab = this.tabs.find((t) => t.id === this.activeTabId);
    if (!tab) return;
    tab.currentPath = [...this.currentPath];
    tab.outputHTML = this.terminalOutput.innerHTML;
  }

  newTab() {
    this.snapshotActiveTab();
    const id = ++this.tabCounter;
    const tab = { id, currentPath: ["ys", "users", this.sessionKey], outputHTML: "" };
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
    if (!this.terminalTabsEl) return;
    this.terminalTabsEl.innerHTML = "";
    this.terminalTabsEl.style.display = "flex";
    this.terminalTabsEl.style.gap = "4px";
    this.terminalTabsEl.style.padding = "4px 6px";

    this.tabs.forEach((tab, i) => {
      const el = document.createElement("div");
      el.className = "terminal-tab" + (tab.id === this.activeTabId ? " active" : "");
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.gap = "6px";
      el.style.padding = "2px 8px";
      el.style.borderRadius = "4px";
      el.style.cursor = "pointer";
      el.style.fontSize = "12px";
      el.style.background = tab.id === this.activeTabId ? "rgba(255,255,255,0.15)" : "transparent";
      el.textContent = `Tab ${i + 1}`;
      el.addEventListener("click", () => this.switchTab(tab.id));

      const closeBtn = document.createElement("span");
      closeBtn.textContent = "\u00d7";
      closeBtn.style.opacity = "0.6";
      closeBtn.style.marginLeft = "4px";
      closeBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        this.closeTab(tab.id);
      });
      el.appendChild(closeBtn);

      this.terminalTabsEl.appendChild(el);
    });

    const newTabBtn = document.createElement("div");
    newTabBtn.textContent = "+";
    newTabBtn.style.padding = "2px 8px";
    newTabBtn.style.cursor = "pointer";
    newTabBtn.style.fontSize = "12px";
    newTabBtn.style.opacity = "0.7";
    newTabBtn.addEventListener("click", () => this.newTab());
    this.terminalTabsEl.appendChild(newTabBtn);
  }

  showTerminalContextMenu(e) {
    const hasSelection = window.getSelection().toString().length > 0;
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
        const text = window.getSelection().toString();
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

  async expandGlob(pattern, path) {
    const items = Object.keys(await os.fs.readdir(this.pathToString(path)));
    const regex = new RegExp("^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
    return items.filter((item) => regex.test(item));
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
    let result = "";
    let inSingle = false;
    let inDouble = false;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === "'" && !inDouble) {
        inSingle = !inSingle;
        result += ch;
        continue;
      }
      if (ch === '"' && !inSingle) {
        inDouble = !inDouble;
        result += ch;
        continue;
      }
      if (ch === "\\" && i + 1 < str.length && !inSingle) {
        result += ch + str[i + 1];
        i++;
        continue;
      }
      if (ch === "$" && !inSingle) {
        const j = i + 1;
        if (str[j] === "{") {
          let k = j + 1;
          while (k < str.length && str[k] !== "}") k++;
          const name = str.slice(j + 1, k);
          result += this.getEnvValue(name);
          i = k;
          continue;
        }
        if (str[j] === "?") {
          result += String(this.lastExitCode);
          i = j;
          continue;
        }
        const match = str.slice(j).match(/^[A-Za-z_][A-Za-z0-9_]*/);
        if (match) {
          result += this.getEnvValue(match[0]);
          i = j + match[0].length - 1;
          continue;
        }
        result += ch;
        continue;
      }
      result += ch;
    }
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
    let output = null;
    this.lastExitCode = 0;

    if (redirIn) {
      try {
        output = await os.fs.read(this.pathToString(this.fs.resolvePath(redirIn, this.currentPath)));
      } catch {
        await this.enqueuePrint(`bash: ${redirIn}: No such file or directory`);
        this.lastExitCode = 1;
        return;
      }
    }

    for (let i = 0; i < pipeline.length; i++) {
      const { command, args, flags } = pipeline[i];
      if (!command) continue;
      const expandedArgs = await this.expandGlobsInArgs(args, this.currentPath);
      const isPiped = output !== null;

      if (isPiped) expandedArgs.unshift(output);

      const handler = this.commands[command];
      if (!handler) {
        await this.enqueuePrint(`bash: ${command}: command not found`);
        this.lastExitCode = 127;
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
        const targetPath = this.pathToString(this.fs.resolvePath(target, this.currentPath));
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
        this.lastExitCode = 1;
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
    os.events.emit(BusEvents.TERMINAL_CMD_EXECUTED, { command: commandStr });
    await this.enqueuePrint(commandStr, null, true, this.promptHtml());

    if (commandStr.trim() === "sudo rm -rf /" || commandStr.trim() === "sudo rm -rf /*") {
      await this.cmdNukeSystem();
      return;
    }

    os.events.emit(BusEvents.ACHIEVEMENT_TRIGGER, { key: Achievements.DeveloperMode });

    const chain = this.parseCommand(commandStr);
    for (const segment of chain) {
      if (segment.operator === "&&" && this.lastExitCode !== 0) continue;
      if (segment.operator === "||" && this.lastExitCode === 0) continue;
      await this.executePipeline(segment.pipeline, segment.redirOut, segment.redirAppend, segment.redirIn);
    }

    this.updatePrompt();
  }

  async cmdNukeSystem() {
    await this.print("rm: descending into '/'...", "#ff3333");
    await this.print("rm: removing all files...", "#ff3333");

    const overlay = document.createElement("div");
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
      localStorage.clear();
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
      folderContents = Object.keys(await os.fs.readdir(this.pathToString(pathParts)));
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
    const raw = this.currentPath.length ? "/" + this.currentPath.join("/") : "/";
    const path = raw.replace(this.sessionKey, this.displayName);
    return `<span class="prompt-user">${this.displayName}</span><span class="prompt-at">@</span><span class="prompt-host">${this.hostname}</span><span class="prompt-sep">:</span><span class="prompt-path">${path}</span><span class="prompt-dollar">$</span>`;
  }

  updatePrompt() {
    if (!this.terminalPrompt) return;
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
    this.registerCommand("ps", () => this.cmdPs());
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
    this.registerCommand("alias", (args) => this.cmdAlias(args));
    this.registerCommand("unalias", (args) => this.cmdUnalias(args));
    this.registerCommand("export", (args) => this.cmdExport(args));
    this.registerCommand("env", () => this.cmdEnv());
    this.registerCommand("man", (args) => this.cmdMan(args));
    this.registerCommand("less", (args, flags, isPiped) => this.cmdLess(args, flags, isPiped));
    this.registerCommand("more", (args, flags, isPiped) => this.cmdLess(args, flags, isPiped));
    this.registerCommand("git", (args, flags) => this.cmdGit(args, flags));
    this.registerCommand("apps", (args, flags) => this.cmdApps(args, flags));
    this.registerCommand("shutdown", () => this.cmdShutdown());
    this.registerCommand("reboot", () => this.cmdReboot());
    this.registerCommand("restart", () => this.cmdReboot());
    this.registerCommand("lock", () => this.cmdLock());
    this.registerCommand("logout", () => this.cmdLogout());
    this.registerCommand("signout", () => this.cmdLogout());
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
        const items = await os.fs.readdir(this.pathToString(path));
        let keys = Object.keys(items);
        if (!showAll) keys = keys.filter((k) => !k.startsWith("."));
        if (reverse) keys = keys.reverse();
        for (const item of keys) {
          const isFile = await this.fs.isFile(path, item);
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
      await os.fs.readdir(this.pathToString(newPath));
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
        await os.fs.mkdir(this.pathToString(targetPath));
        await this.print(`Created directory: ${dir}`);
      } catch (e) {
        await this.print(`mkdir: cannot create directory '${dir}': ${e.message}`);
      }
    }
  }

  async cmdTouch(args) {
    if (!args.length) return this.print("touch: missing file operand");
    for (const file of args) {
      try {
        const parentEntries = await os.fs.readdir(this.pathToString(this.currentPath));
        const existing = parentEntries[file];
        if (existing) {
          if (existing.type === "dir") {
            await this.print(`touch: ${file}: Is a directory`);
            continue;
          }
        }
        await os.fs.write(this.pathToString([...this.currentPath, file]), "");
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

        const isFile = await this.fs.isFile(parentPath, name);
        if (isFile) {
          await os.fs.delete(parentPath, name);
        } else {
          if (!isRecursive) throw new Error("is a directory");
          const folderItems = Object.keys(await os.fs.readdir(this.pathToString(pathArray)));
          for (const sub of folderItems) {
            await removeItem([...pathArray, sub]);
          }
          await os.fs.delete(parentPath, name);
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
            const content = await os.fs.read(this.pathToString(this.currentPath) + "/" + file);
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
        const content = await os.fs.read(this.pathToString(targetPath));
        const text = typeof content === "string" ? content : new TextDecoder().decode(content);
        const lines = text.split("\n").length;
        const words = text.split(/\s+/).filter(Boolean).length;
        const chars = text.length;
        const parts = [];
        if (showLines) parts.push(String(lines).padStart(8));
        if (showWords) parts.push(String(words).padStart(8));
        if (showChars) parts.push(String(chars).padStart(8));
        await this.print(parts.join("") + " " + file);
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
      const parentDir = await os.fs.readdir(this.pathToString(parent));
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
      const content = await os.fs.read(this.pathToString(srcPath));
      await os.fs.write(this.pathToString(destPath), content);
    } else {
      await os.fs.mkdir(this.pathToString(destPath));
      const items = Object.keys(await os.fs.readdir(this.pathToString(srcPath)));
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
      const items = Object.keys(await os.fs.readdir(this.pathToString(pathArray)));
      for (const child of items) {
        await this.deleteRecursive([...pathArray, child]);
      }
    }
    await os.fs.delete(parent, name);
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
          const content = await os.fs.read(this.pathToString(this.currentPath) + "/" + args[0]);
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
        items = Object.keys(await os.fs.readdir(this.pathToString(path)));
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
      await this.print(done ? "(END) press q to continue" : "-- more -- (space: next page, q: quit)", "#888888");
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
        if (await this.fs.isFile(parentPath, name)) {
          const parent = await os.fs.readdir(this.pathToString(parentPath));
          return parent[name]?.size || 0;
        }
      } catch {}
      const { size } = await os.fs.calcDirSize(target);
      return size;
    };

    const targets = args.length ? args.map((a) => this.fs.resolvePath(a, this.currentPath)) : [this.currentPath];

    for (const target of targets) {
      const displayPath = this.pathToString(target).replace(this.sessionKey, this.displayName);
      if (summary) {
        const size = await getFileSize(target);
        await this.print(`${fmt(size)} ${displayPath}`);
      } else {
        try {
          const items = Object.entries(await os.fs.readdir(this.pathToString(target)));
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
      items = Object.keys(await os.fs.readdir(this.pathToString(path)));
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
    os.events.emit(BusEvents.ACHIEVEMENT_TRIGGER, { achievementId: Achievements.DeveloperModeSuper });
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
      const canvas = document.createElement("canvas");
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
    const dnt = navigator.doNotTrack === "1" || window.doNotTrack === "1" ? "Enabled" : "Disabled";

    const elapsed = Date.now() - this.pageLoadTime;
    const uptime = `${Math.floor(elapsed / 3600000)}h, ${Math.floor((elapsed % 3600000) / 60000)}m`;

    const lines = [
      "",
      "",
      "                     " + this.displayName + "@" + this.hostname,
      `        /\\           OS     ${osText}`,
      `       /  \\          KERNEL   ${engine}wu`,
      `      /\\   \\        CPU Cores: ${coresText}`,
      `     / > ω <\\        BROWSER  ${browserText}`,
      `    /   __   \\       GRAPHICS    ${gpu}`,
      `   / __|  |__-\\      MEMOWY    ${ram}`,
      `  /_-''    ''-_\\     DO-NOT-TRACK  ${dnt}`,
      `                      RESOLUTION   ${window.innerWidth}x${window.innerHeight}`,
      `                      UPTIME  ${uptime}`
    ];

    for (const line of lines) {
      await this.enqueuePrint(line);
    }
  }

  async cmdPs() {
    const wins = Array.from(document.querySelectorAll(".window"));
    await this.print("  PID   TTY      TIME CMD");
    for (let i = 0; i < wins.length; i++) {
      const cmd = wins[i].querySelector(".window-header span")?.textContent || "unknown";
      await this.print(`  ${1000 + i}  pts/0  0:00 ${cmd}`);
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
      ["apps", "List and manage installed apps (apps list, uninstall, disable, enable)"],
      ["shutdown", "Shut down YukiOS"],
      ["reboot", "Restart YukiOS"],
      ["lock", "Lock the current session"],
      ["logout", "Sign out and return to login screen"],
      ["signout", "Sign out and return to login screen"],
      ["exit", "Close the terminal"]
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
    const statusEl = document.createElement("div");
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

  async cmdApps(args = [], flags = []) {
    const appRegistry = getAppRegistry();
    const appMap = os.app.getAllApps();

    if (!args.length || args[0] === "list") {
      const query = args.length > 1 ? args.slice(1).join(" ") : null;
      const allApps = appRegistry.getAllApps(appMap);
      const filtered = query
        ? allApps.filter((a) => a.id.toLowerCase().includes(query) || a.displayName.toLowerCase().includes(query))
        : allApps;

      if (!filtered.length) {
        return this.print("No apps found.");
      }

      await this.print(`Found ${filtered.length} app(s):`);
      for (const app of filtered) {
        const status = app.protected
          ? "protected"
          : app.uninstalled
            ? "uninstalled"
            : app.disabled
              ? "disabled"
              : "enabled";
        const line = `  ${app.id.padEnd(24)} ${app.displayName.padEnd(20)} [${app.type.padEnd(8)}] [${status}]`;
        await this.print(line);
      }
      return;
    }

    const sub = args[0];
    const id = args[1];

    if (!id) return this.print(`Usage: apps ${sub} <appId>`);

    switch (sub) {
      case "uninstall": {
        if (appRegistry.isProtected(id)) {
          return this.print(`Cannot uninstall protected app: ${id}`);
        }
        const confirmed = await os.dialog.confirm("Uninstall App", `Uninstall "${id}"?`);
        if (confirmed && appRegistry.uninstallApp(id)) {
          await this.print(`Uninstalled: ${id}`);
        }
        break;
      }
      case "install": {
        appRegistry.restoreApp(id);
        await this.print(`Restored: ${id}`);
        break;
      }
      case "disable": {
        if (appRegistry.isProtected(id)) {
          return this.print(`Cannot disable protected app: ${id}`);
        }
        if (appRegistry.setAppDisabled(id, true)) {
          await this.print(`Disabled: ${id}`);
        }
        break;
      }
      case "enable": {
        appRegistry.restoreApp(id);
        if (appRegistry.setAppDisabled(id, false)) {
          await this.print(`Enabled: ${id}`);
        }
        break;
      }
      default:
        await this.print(`Unknown subcommand: ${sub}. Use: list, uninstall, install, disable, enable`);
    }
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
    if (this.services?.sessionManager) {
      await this.services.sessionManager.lockSession();
    }
  }

  async cmdLogout() {
    await this.print("Signing out...");
    if (this.services?.sessionManager) {
      await this.services.sessionManager.lockToLoginScreen();
    }
  }

  cmdExit() {
    const win = document.getElementById("terminal-win");
    os.window.removeFromTaskbar(win.id);
    if (win) win.remove();
  }
}
