import { desktop } from "./desktop.js";

export class TerminalApp {
  constructor(fileSystemManager, windowManager) {
    this.fs = fileSystemManager;
    this.wm = windowManager;
    this.currentPath = ["home", "reeyuki"];
    this.history = [];
    this.historyIndex = -1;
    this.username = "reeyuki";
    this.hostname = "desktop-os";
    this.printQueue = Promise.resolve();
    this.commands = {};
    this.pageLoadTime = Date.now();
    this.isPrinting = false;
    this.inputBuffer = "";
    this.printDepth = 0;
    this.registerDefaultCommands();
  }

  async print(text, color = null, isCommand = false, promptText = null, delay = 30) {
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
      prompt.textContent = promptText || this.terminalPrompt.textContent;
      prompt.style.color = "white";
      line.appendChild(prompt);
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

  enqueuePrint(text, color = null, isCommand = false, promptText = null, delay = 6) {
    this.printQueue = this.printQueue.then(() => this.print(text, color, isCommand, promptText, delay));
    return this.printQueue;
  }
  setupEventHandlers() {
    this.terminalInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const command = this.terminalInput.value.trim();
        if (!command) return;
        this.history.push(command);
        this.historyIndex = this.history.length;
        this.terminalInput.value = "";
        this.executeCommand(command);
      } else if (e.key === "ArrowUp" && this.historyIndex > 0) {
        e.preventDefault();
        this.terminalInput.value = this.history[--this.historyIndex];
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        this.historyIndex = Math.min(this.historyIndex + 1, this.history.length);
        this.terminalInput.value = this.historyIndex < this.history.length ? this.history[this.historyIndex] : "";
      } else if (e.key === "Tab") {
        e.preventDefault();
        this.handleTabCompletion();
      } else if (e.ctrlKey && e.key === "l") {
        e.preventDefault();
        this.cmdClear();
      } else if (e.ctrlKey && e.key === "c") {
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) return;
        e.preventDefault();
        this.enqueuePrint("^C", "white", true, this.terminalPrompt.textContent);
        this.terminalInput.value = "";
      } else if (e.ctrlKey && e.key === "d") {
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) return;
        if (this.terminalInput.value.length > 0) return;
        e.preventDefault();
        const win = document.getElementById("terminal-win");
        this.wm.removeFromTaskbar(win.id);
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

  expandGlob(pattern, path) {
    const items = Object.keys(this.fs.getFolder(path));
    const regex = new RegExp("^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
    return items.filter((item) => regex.test(item));
  }

  expandGlobsInArgs(args, path) {
    const expanded = [];
    for (const arg of args) {
      if (arg.includes("*") || arg.includes("?")) {
        const matches = this.expandGlob(arg, path);
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
      const expandedArgs = this.expandGlobsInArgs(args, this.currentPath);

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
    await this.enqueuePrint(commandStr, null, true, this.terminalPrompt.textContent);

    const pipeline = this.parseCommand(commandStr);
    await this.executePipeline(pipeline);

    this.updatePrompt();
  }
  handleTabCompletion() {
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
      folderContents = Object.keys(this.fs.getFolder(pathParts));
    } catch {
      return;
    }
    const matches = folderContents.filter((item) => item.startsWith(baseName));
    if (!matches.length) return;

    if (matches.length === 1) {
      const completion = matches[0] + (this.fs.isFile(pathParts, matches[0]) ? "" : "/");
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
        this.print(matches.join("  "));
      }
    }
  }

  open() {
    const existingWin = document.getElementById("terminal-win");
    if (existingWin) return this.wm.bringToFront(existingWin);

    const win = this.wm.createWindow("terminal-win", "Terminal", "700px", "500px");
    Object.assign(win.style, { left: "200px", top: "100px" });

    win.innerHTML = `
    <div class="window-header">
      <span>Terminal</span>
      <div class="window-controls">
        <button class="minimize-btn">−</button>
        <button class="maximize-btn">□</button>
        <button class="close-btn">X</button>
      </div>
    </div>
    <div class="window-content" style="background:#000;color:white;font-family:monospace;padding:10px;overflow-y:auto;height:calc(100% - 40px);">
      <div id="terminal-output" style="white-space:pre;"></div>
      <div id="terminal-input-line" style="display:flex;">
        <span id="terminal-prompt"></span>
        <input id="terminal-input" style="flex:1;background:transparent;border:none;color:white;font-family:monospace;outline:none;margin-left:5px;">
      </div>
    </div>
  `;

    desktop.appendChild(win);
    this.wm.makeDraggable(win);
    this.wm.makeResizable(win);
    this.wm.setupWindowControls(win);
    this.wm.addToTaskbar(win.id, "Terminal", "/static/icons/terminal.png");

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
    this.print("Welcome to Reeyuki's terminal");
    this.print("Type 'help' for available commands\n");
    this.setupEventHandlers();
    this.terminalInput.focus();
  }

  updatePrompt() {
    const path = this.currentPath.length ? "/" + this.currentPath.join("/") : "/";
    this.terminalPrompt.textContent = `${this.username}@${this.hostname}:${path}$ `;
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
    this.registerCommand("whoami", () => this.print(this.username));
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
  }

  cmdClear() {
    this.terminalOutput.innerHTML = "";
  }

  cmdLs(args = [], flags = []) {
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

    const listFolder = (path, prefix = "") => {
      try {
        const items = this.fs.getFolder(path);
        let keys = Object.keys(items);
        if (!showAll) keys = keys.filter((k) => !k.startsWith("."));
        if (reverse) keys = keys.reverse();
        keys.forEach((item) => {
          const isFile = this.fs.isFile(path, item);
          const display = longFormat
            ? `${isFile ? "-" : "d"} ${item}${isFile ? "" : "/"}${isFile && items[item].size != null ? ` ${formatSize(items[item].size)}` : ""}`
            : item + (isFile ? "" : "/");
          this.print(prefix + display, isFile ? null : "blue");
          if (recursive && !isFile) listFolder(this.fs.resolvePath(item, path), prefix + "  ");
        });
      } catch {
        this.print(`ls: cannot access '${path}': No such file or directory`);
      }
    };

    const path = args.length ? this.fs.resolvePath(args[0], this.currentPath) : this.currentPath;
    listFolder(path);
  }

  cmdCd(args) {
    if (!args.length || args[0] === "~") {
      this.currentPath = ["home", this.username];
      return;
    }
    try {
      const newPath = this.fs.resolvePath(args[0], this.currentPath);
      this.fs.getFolder(newPath);
      this.currentPath = newPath;
    } catch {
      this.print(`cd: ${args[0]}: No such file or directory`);
    }
  }

  cmdMkdir(args) {
    if (!args.length) return this.print("mkdir: missing operand");
    args.forEach((dir) => {
      this.fs.createFolder(this.currentPath, dir);
      this.print(`Created directory: ${dir}`);
    });
  }

  cmdTouch(args) {
    if (!args.length) return this.print("touch: missing file operand");
    args.forEach((file) => {
      this.fs.createFile(this.currentPath, file, "");
      this.print(`Created file: ${file}`);
    });
  }

  cmdRm(args = [], flags = []) {
    if (!args.length) return this.print("rm: missing operand");

    const isRecursive = flags.some((f) => f.includes("r"));
    const isForce = flags.some((f) => f.includes("f"));

    const removeItem = (pathArray) => {
      try {
        const parentPath = pathArray.slice(0, -1);
        const name = pathArray[pathArray.length - 1];

        if (this.fs.isFile(parentPath, name)) {
          this.fs.deleteItem(parentPath, name);
        } else {
          if (!isRecursive) throw new Error("is a directory");
          const folderItems = Object.keys(this.fs.getFolder(pathArray));
          folderItems.forEach((sub) => removeItem([...pathArray, sub]));
          this.fs.deleteItem(parentPath, name);
        }
      } catch (e) {
        if (!isForce) this.print(`rm: cannot remove '${pathArray.join("/")}': ${e.message}`);
      }
    };

    args.forEach((arg) => {
      let fullPath = arg.startsWith("/") ? this.fs.resolvePath(arg, []) : this.fs.resolvePath(arg, this.currentPath);
      removeItem(fullPath);
    });
  }

  cmdCat(args) {
    if (!args.length) return this.print("cat: missing file operand");
    args.forEach((file) => {
      if (file.includes("\n")) {
        this.print(file);
      } else if (!this.fs.isFile(this.currentPath, file)) {
        this.print(`cat: ${file}: Is a directory`);
      } else {
        this.print(this.fs.getFileContent(this.currentPath, file) || "(empty file)");
      }
    });
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

  cmdTree(path = this.currentPath, prefix = "") {
    if (!prefix) this.print(path.length ? "/" + path.join("/") : "/");
    const items = Object.keys(this.fs.getFolder(path));
    items.forEach((item, i) => {
      const isFile = this.fs.isFile(path, item);
      const last = i === items.length - 1;
      this.print(prefix + (last ? "└── " : "├── ") + item + (isFile ? "" : "/"));
      if (!isFile) this.cmdTree([...path, item], prefix + (last ? "    " : "│   "));
    });
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
    const ua = navigator.userAgent;
    const platformRaw = navigator.userAgentData?.platform || navigator.platform || ua || "Unknown";

    let os = "Unknown";
    if (/Windows/i.test(platformRaw)) os = "Windows";
    else if (/Mac/i.test(platformRaw)) os = "macOS";
    else if (/Android/i.test(platformRaw)) os = "Android";
    else if (/iPhone|iPad|iOS/i.test(platformRaw)) os = "iOS";
    else if (/Linux/i.test(platformRaw)) os = "Linux";

    const osText = os === "Windows" ? "Eww a windows!" : os;

    let browser = "Unknown";
    if (/Firefox\/\d+/i.test(ua)) browser = "Firefox";
    else if (/Edg\/\d+/i.test(ua)) browser = "Edge";
    else if (/Chrome\/\d+/i.test(ua)) browser = "Chrome";
    else if (/Safari\/\d+/i.test(ua)) browser = "Safari";

    const browserText = browser === "Chrome" || browser === "Edge" ? "eww a chromium?!" : browser;

    const cores = navigator.hardwareConcurrency ?? "Unknown";
    const coresText = typeof cores === "number" && cores > 10 ? `${cores} (WOW ITS SO BIG!)` : cores;

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
      "                     " + this.username + "@" + this.hostname,
      `        /\\           OWOS     ${osText}`,
      `       /  \\          KEWNEL   ${engine}wu`,
      `      /\\   \\         CPUWU    Cwpu Cowes: ${coresText}`,
      `     / > ω <\\        BROWSEWU  ${browserText}`,
      `    /   __   \\       GWAPHU    ${gpu}`,
      `   / __|  |__-\\      WENDAWU   ${renderScore}`,
      `  /_-''    ''-_\\     MEMOWY    ${ram}`,
      `                     DoNawtTWACKWU  ${dnt}`,
      `                     RESOWUW   ${window.innerWidth}x${window.innerHeight}`,
      `                     UWUPTIME  ${uptime}`
    ];

    for (const line of lines) {
      await this.enqueuePrint(line);
    }
  }

  cmdPs() {
    const wins = Array.from(document.querySelectorAll(".window"));
    this.print("  PID   TTY      TIME CMD");
    wins.forEach((w, i) => {
      const cmd = w.querySelector(".window-header span")?.textContent || "unknown";
      this.print(`  ${1000 + i}  pts/0  0:00 ${cmd}`);
    });
  }

  cmdHelp() {
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
      ["tree", "Display directory tree"]
    ];
    this.print("Available commands:");
    cmds.forEach(([cmd, desc]) => this.print(`  ${cmd.padEnd(10)} - ${desc}`));
    this.print("");
    this.print("Glob patterns: * (match any), ? (match one)");
    this.print("Pipes: command1 | command2");
  }
}
