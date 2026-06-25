import "../styles/terminal.css";
import { Achievements } from "../achievements.js";
import { BusEvents } from "../core/EventBus.js";
import { KeybindManager } from "../keybindManager.js";

import { BaseApp, PersistenceTypes, StorageKeys, os } from "../framework.js";
export class TerminalApp extends BaseApp {
  constructor(services) {
    super(services);
    this.sessionKey = services.fileSystemManager?.sessionKey || "guest";
    this.currentPath = ["ys", "users", this.sessionKey];
    this.history = [];
    this.historyIndex = -1;
    this.displayName = os.storage.get(StorageKeys.username) || this.sessionKey;
    this.username = this.displayName;
    this.hostname = "yuki-os";
    this._setupSessionListener();
    this.printQueue = Promise.resolve();
    this.commands = {};
    this.pageLoadTime = Date.now();
    this.isPrinting = false;
    this.inputBuffer = "";
    this.printDepth = 0;
    this.registerDefaultCommands();
    this._declarativeApp = null;
  }

  getDeclarativeSchema(opts) {
    return {
      id: "terminal-win",
      name: "Terminal",
      icon: "static/icons/terminal.webp",
      windows: [
        {
          id: "terminal-win",
          title: "Terminal",
          size: ["700px", "500px"],
          icon: "static/icons/terminal.webp",
          ui: `<div class="window-content terminal-content">
        <div class="terminal-output" id="terminal-output"></div>
        <div class="terminal-input-line" id="terminal-input-line">
          <span id="terminal-prompt"></span>
          <input class="terminal-input" id="terminal-input" spellcheck="false" autocomplete="off">
        </div>
      </div>`,
          events: {
            "#terminal-input": {
              keydown: {
                type: "custom:terminalKeydown",
                stopPropagation: false
              }
            },
            "#terminal-output": {
              contextmenu: {
                type: "custom:terminalContextmenu",
                stopPropagation: true
              }
            }
          }
        }
      ],
      state: {
        initial: {
          currentPath: ["ys", "users", "guest"],
          history: [],
          historyIndex: -1,
          username: "guest",
          hostname: "yuki-os",
          displayName: "guest"
        },
        persistence: PersistenceTypes.NONE
      },
      actions: {
        terminalKeydown: (payload, event, element, state) => {},
        terminalContextmenu: (payload, event, element, state) => {
          event.preventDefault();
        }
      },
      onMount: "initTerminal"
    };
  }

  initTerminal(payload, event, element, state) {
    this.terminalOutput = document.getElementById("terminal-output");
    this.terminalInput = document.getElementById("terminal-input");
    this.terminalPrompt = document.getElementById("terminal-prompt");
    this.terminalInputLine = document.getElementById("terminal-input-line");
    this.updatePrompt();
    this.setupEventHandlers();
  }

  open(extra = null) {
    const initialPath = extra?.initialPath || null;
    if (initialPath) {
      this.currentPath = initialPath;
    }

    const content = `
    <div class="window-content terminal-content">
      <div class="terminal-output" id="terminal-output"></div>
      <div class="terminal-input-line" id="terminal-input-line">
        <span id="terminal-prompt"></span>
        <input class="terminal-input" id="terminal-input" spellcheck="false" autocomplete="off">
      </div>
    </div>
  `;

    const win = os.window.create("terminal-win", "Terminal", "700px", "500px", {
      icon: "static/icons/terminal.webp"
    });

    win.innerHTML = `
      ${content}
    `;

    this.terminalOutput = win.querySelector("#terminal-output");
    this.terminalInput = win.querySelector("#terminal-input");
    this.terminalPrompt = win.querySelector("#terminal-prompt");
    this.terminalInputLine = win.querySelector("#terminal-input-line");

    this.terminalOutput.addEventListener("contextmenu", (e) => {
      e.stopPropagation();
    });

    this.terminalOutput.style.userSelect = "text";
    this.terminalInput.style.userSelect = "text";

    this.updatePrompt();
    this.print(`YukiOS Terminal for ${this.displayName}`, "#00ff00");
    this.print("Type 'help' for available commands\n");
    this.setupEventHandlers();
    this.terminalInput.focus();
  }

  _setupSessionListener() {
    os.events.on("session:initialized", (session) => {
      this.sessionKey = session.key;
      this.displayName = session.name || os.storage.get(StorageKeys.username) || session.key;
      this.username = this.displayName;
      this.currentPath = ["ys", "users", session.key];
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
      this.terminalInputLine.style.display = "none";
    }

    const line = document.createElement("div");
    const span = document.createElement("span");

    if (isCommand) {
      const prompt = document.createElement("span");
      prompt.innerHTML = promptText || this._promptHtml();
      line.className = "cmd-line";
      line.appendChild(prompt);
      span.className = "cmd-text";
      line.appendChild(span);
    } else {
      if (color) span.style.color = color;
      line.appendChild(span);
    }

    this.terminalOutput.appendChild(line);

    for (let i = 0; i < text.length; i++) {
      span.textContent += text[i];
      await new Promise((r) => setTimeout(r, delay));
      this.terminalOutput.parentElement.scrollTop = this.terminalOutput.parentElement.scrollHeight;
    }

    this.printDepth--;
    if (this.printDepth === 0) {
      this.isPrinting = false;
      this.terminalInputLine.style.display = "flex";
      this.terminalInput.value = this.inputBuffer;
      this.terminalInput.focus();
    }
  }

  enqueuePrint(text, color = null, isCommand = false, promptText = null, delay = 1) {
    this.printQueue = this.printQueue.then(() => this.print(text, color, isCommand, promptText, delay));
    return this.printQueue;
  }

  setupEventHandlers() {
    this.terminalInput.addEventListener("keydown", (e) => {
      if (KeybindManager.matches(e, "terminal.execute")) {
        e.preventDefault();
        const command = this.terminalInput.value.trim();
        if (!command) return;
        this.history.push(command);
        this.historyIndex = this.history.length;
        this.terminalInput.value = "";
        this.executeCommand(command);
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
        this.enqueuePrint("^C", null, true, this._promptHtml());
        this.terminalInput.value = "";
      } else if (KeybindManager.matches(e, "terminal.close")) {
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) return;
        if (this.terminalInput.value.length > 0) return;
        e.preventDefault();
        const win = document.getElementById("terminal-win");
        os.window.removeFromTaskbar(win.id);
        if (win) win.remove();
        return;
      }
    });

    const win = document.getElementById("terminal-win");

    win.addEventListener("mousedown", () => {
      const selection = window.getSelection();
      if (selection) selection.removeAllRanges();
    });

    win.addEventListener("mouseup", () => {
      if (window.getSelection().toString().length > 0) return;
      this.terminalInput.focus();
    });
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

  parseCommand(commandStr) {
    const segments = commandStr.split("|").map((s) => s.trim());
    return segments.map((segment) => {
      const parts = segment.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
      const parsed = parts.map((p) => p.replace(/^"(.*)"$/, "$1"));

      const command = parsed[0];
      const args = [];
      const flags = [];

      for (let i = 1; i < parsed.length; i++) {
        if (parsed[i].startsWith("-")) {
          flags.push(parsed[i]);
        } else {
          args.push(parsed[i]);
        }
      }

      return { command, args, flags };
    });
  }

  async executePipeline(pipeline) {
    let output = null;

    for (let i = 0; i < pipeline.length; i++) {
      const { command, args, flags } = pipeline[i];
      const expandedArgs = await this.expandGlobsInArgs(args, this.currentPath);

      if (output !== null) {
        expandedArgs.unshift(output);
      }

      const handler = this.commands[command];
      if (!handler) {
        if (command) await this.enqueuePrint(`bash: ${command}: command not found`);
        return;
      }

      if (i < pipeline.length - 1) {
        output = await this.captureOutput(() => handler(expandedArgs, flags));
      } else {
        await handler(expandedArgs, flags);
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
    await this.enqueuePrint(commandStr, null, true, this._promptHtml());

    if (commandStr.trim() === "sudo rm -rf /") {
      await this.cmdNukeSystem();
      return;
    }

    os.events.emit(BusEvents.ACHIEVEMENT_TRIGGER, { key: Achievements.DeveloperMode });
    const pipeline = this.parseCommand(commandStr);
    await this.executePipeline(pipeline);

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

  _promptHtml() {
    const raw = this.currentPath.length ? "/" + this.currentPath.join("/") : "/";
    const path = raw.replace(this.sessionKey, this.displayName);
    return `<span class="prompt-user">${this.displayName}</span><span class="prompt-at">@</span><span class="prompt-host">${this.hostname}</span><span class="prompt-sep">:</span><span class="prompt-path">${path}</span><span class="prompt-dollar">$</span>`;
  }

  updatePrompt() {
    if (!this.terminalPrompt) return;
    this.terminalPrompt.innerHTML = this._promptHtml();
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
        const exists = await this.fs.exists(this.currentPath, file);
        if (exists) {
          const isFile = await this.fs.isFile(this.currentPath, file);
          if (!isFile) {
            await this.print(`touch: ${file}: Is a directory`);
            continue;
          }
        }
        await os.fs.write(this.pathToString(this.currentPath) + "/" + file, "");
        if (!exists) await this.print(`Created file: ${file}`);
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

  cmdWc(args) {
    const input = args.join(" ");
    const lines = input.split("\n").filter((l) => l.length > 0);
    const words = input.split(/\s+/).filter((w) => w.length > 0);
    const chars = input.length;

    this.print(`  ${lines.length}  ${words.length}  ${chars}`);
  }

  async cmdDu(args = [], flags = []) {
    const summary = flags.some((f) => f.includes("s"));
    const humanReadable = flags.some((f) => f.includes("h"));

    const fmt = (size) => {
      if (!humanReadable) return String(size);
      const units = ["B", "K", "M", "G"];
      let i = 0;
      let s = size;
      while (s >= 1024 && i < units.length - 1) {
        s /= 1024;
        i++;
      }
      return i === 0 ? `${s}B` : s % 1 > 0.1 ? `${s.toFixed(1)}${units[i]}` : `${Math.round(s)}${units[i]}`;
    };

    const calcSize = async (path) => {
      let total = 0;
      try {
        const items = await os.fs.readdir(this.pathToString(path));
        for (const [name, meta] of Object.entries(items)) {
          if (meta.type === "file") {
            total += meta.size || 0;
          } else {
            total += await calcSize([...path, name]);
          }
        }
      } catch {}
      return total;
    };

    const readItems = async (path) => {
      try {
        return Object.entries(await os.fs.readdir(this.pathToString(path)));
      } catch {
        return [];
      }
    };

    const targets = args.length ? args.map((a) => this.fs.resolvePath(a, this.currentPath)) : [this.currentPath];

    for (const target of targets) {
      const displayPath = this.pathToString(target).replace(this.sessionKey, this.displayName);
      if (summary) {
        const size = await calcSize(target);
        await this.print(`${fmt(size).padStart(8)} ${displayPath}`);
      } else {
        const items = await readItems(target);
        for (const [name, meta] of items) {
          const itemPath = [...target, name];
          const itemSize = meta.type === "file" ? meta.size || 0 : await calcSize(itemPath);
          await this.print(`${fmt(itemSize).padStart(8)} ${name}`);
        }
        if (targets.length <= 1) {
          const total = await calcSize(target);
          await this.print(`${fmt(total).padStart(8)} total`);
        }
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
      ["cat", "Display file contents"],
      ["echo", "Display a line of text"],
      ["grep", "Search for pattern in input"],
      ["wc", "Count lines, words, and characters"],
      ["whoami", "Display current user"],
      ["hostname", "Display hostname"],
      ["date", "Display current date and time"],
      ["history", "Show command history"],
      ["tree", "Display directory tree"],
      ["du", "Estimate file/directory sizes"],
      ["exit", "Close the terminal"]
    ];
    await this.print("Available commands:");
    for (const [cmd, desc] of cmds) {
      await this.print(`  ${cmd.padEnd(10)} - ${desc}`);
    }
    await this.print("");
    await this.print("Glob patterns: * (match any), ? (match one)");
    await this.print("Pipes: command1 | command2");
  }

  cmdExit() {
    const win = document.getElementById("terminal-win");
    os.window.removeFromTaskbar(win.id);
    if (win) win.remove();
  }
}
