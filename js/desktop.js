const CONFIG = {
  GRID_SIZE: 80,
  STORAGE_KEY: "desktopOS_fileSystem",
  DEFAULT_WINDOW_SIZE: { width: "80vw", height: "80vh" },
  MUSIC_PLAYLIST: [
    "7pfOV26Wzr1KcV8rtIG2FU",
    "2QGUSa5gqCHjgko63KyQeK",
    "1jDMi92a9zNQuPD3uPMkla",
    "6eTcxkl9G7C2mwejLJ7Amm",
    "1vuSdk2EGjh3eXCXBbT9Qf",
    "3PV4bPPqezu18K45MIOrVY",
    "1K45maA9jDR1kBRpojtPmO",
    "2aEuA8PSqLa17Y4hKPj5rr"
  ]
};

class FileSystemManager {
  constructor() {
    this.loadFromStorage();
  }

  loadFromStorage() {
    const stored = localStorage.getItem(CONFIG.STORAGE_KEY);
    this.fileSystem = stored
      ? JSON.parse(stored)
      : {
          home: {
            reeyuki: {
              Documents: {},
              Pictures: {
                "wallpaper1.webp": { type: "file", content: "/static/wallpapers/wallpaper1.webp", kind: "image" },
                "wallpaper2.webp": { type: "file", content: "/static/wallpapers/wallpaper2.webp", kind: "image" },
                "wallpaper3.webp": { type: "file", content: "/static/wallpapers/wallpaper3.webp", kind: "image" }
              },
              Music: {}
            }
          }
        };
  }

  saveToStorage() {
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(this.fileSystem));
  }

  normalizePath(path) {
    if (typeof path === "string") {
      return path.split("/").filter((p) => p);
    }
    return Array.isArray(path) ? path.filter((p) => p) : [];
  }

  resolvePath(pathStr, currentPath = []) {
    if (typeof pathStr === "string") {
      if (pathStr.startsWith("/")) {
        return this.normalizePath(pathStr);
      }
      const resolved = [...currentPath];
      pathStr
        .split("/")
        .filter((p) => p)
        .forEach((part) => {
          if (part === "..") {
            resolved.pop();
          } else if (part !== ".") {
            resolved.push(part);
          }
        });
      return resolved;
    }
    return this.normalizePath(pathStr);
  }

  getFolder(path) {
    const normalizedPath = this.normalizePath(path);
    return normalizedPath.reduce((acc, folder) => {
      if (!acc || typeof acc !== "object") {
        throw new Error(`Invalid path: cannot access ${folder}`);
      }
      return acc[folder];
    }, this.fileSystem);
  }

  inferKind(fileName) {
    const ext = fileName.split(".").pop().toLowerCase();
    if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return "image";
    if (["txt", "js", "json", "md", "html", "css"].includes(ext)) return "text";
    return "generic";
  }

  createFile(path, fileName, content = "") {
    const folder = this.getFolder(path);
    const kind = this.inferKind(fileName);
    folder[fileName] = { type: "file", content, kind };
    this.saveToStorage();
  }

  createFolder(path, folderName) {
    const folder = this.getFolder(path);
    folder[folderName] = {};
    this.saveToStorage();
  }

  deleteItem(path, itemName) {
    const folder = this.getFolder(path);
    delete folder[itemName];
    this.saveToStorage();
  }

  renameItem(path, oldName, newName) {
    const folder = this.getFolder(path);
    folder[newName] = folder[oldName];
    delete folder[oldName];
    this.saveToStorage();
  }

  updateFile(path, fileName, content) {
    const folder = this.getFolder(path);
    const item = folder[fileName];
    if (item && item.type === "file") {
      item.content = content;
    } else {
      const kind = this.inferKind(fileName);
      folder[fileName] = { type: "file", content, kind };
    }
    this.saveToStorage();
  }

  getFileContent(path, fileName) {
    const folder = this.getFolder(path);
    const item = folder[fileName];
    if (item && item.type === "file") {
      return item.content || "";
    }
    return "";
  }

  getFileKind(path, fileName) {
    const folder = this.getFolder(path);
    const item = folder[fileName];
    if (item && item.type === "file") {
      return item.kind || "generic";
    }
    return null;
  }

  isFile(path, itemName) {
    const folder = this.getFolder(path);
    const item = folder[itemName];
    return item && item.type === "file";
  }
}

class ExplorerApp {
  constructor(fileSystemManager, windowManager) {
    this.fs = fileSystemManager;
    this.wm = windowManager;
    this.currentPath = ["home", "reeyuki"];
    this.fileSelectCallback = null;
  }

  open(callback = null) {
    this.fileSelectCallback = callback;

    if (document.getElementById("explorer-win")) {
      this.wm.bringToFront(document.getElementById("explorer-win"));
      return;
    }

    const win = document.createElement("div");
    win.className = "window";
    win.id = "explorer-win";
    win.dataset.fullscreen = "false";
    Object.assign(win.style, {
      width: "600px",
      left: "100px",
      top: "100px",
      zIndex: "1000"
    });

    win.innerHTML = `
      <div class="window-header">
        <span>File Explorer</span>
        <div class="window-controls">
          <button class="minimize-btn" title="Minimize">−</button>
          <button class="maximize-btn" title="Maximize">□</button>
          <button class="close-btn" title="Close">X</button>
        </div>
      </div>
      <div class="explorer-nav">
        <div class="back-btn" id="exp-back">← Back</div>
        <div id="exp-path" style="color:#555"></div>
      </div>
      <div class="explorer-container">
        <div class="explorer-sidebar">
          <div class="start-item" data-path="home/reeyuki/Documents">Documents</div>
          <div class="start-item" data-path="home/reeyuki/Pictures">Pictures</div>
          <div class="start-item" data-path="home/reeyuki/Music">Music</div>
        </div>
        <div class="explorer-main" id="explorer-view"></div>
      </div>
    `;

    desktop.appendChild(win);
    this.wm.makeDraggable(win);
    this.wm.makeResizable(win);
    this.wm.setupWindowControls(win);
    this.wm.addToTaskbar(win.id, "File Explorer");

    this.setupExplorerControls(win);
    this.render();
  }

  setupExplorerControls(win) {
    win.querySelector("#exp-back").onclick = () => {
      if (this.currentPath.length > 1) {
        this.currentPath.pop();
        this.render();
      }
    };

    win.querySelectorAll(".explorer-sidebar .start-item").forEach((item) => {
      item.onclick = () => {
        const path = item.dataset.path.split("/").filter((p) => p);
        this.navigate(path);
      };
    });

    const explorerView = win.querySelector("#explorer-view");
    explorerView.addEventListener("contextmenu", (e) => {
      if (e.target === explorerView) {
        this.showBackgroundContextMenu(e);
      }
    });
  }

  navigate(newPath) {
    this.currentPath = [...newPath];
    this.render();
  }

  render() {
    const view = document.getElementById("explorer-view");
    const pathDisplay = document.getElementById("exp-path");
    if (!view) return;

    view.innerHTML = "";
    pathDisplay.textContent = "/" + this.currentPath.join("/");

    const folder = this.fs.getFolder(this.currentPath);

    Object.keys(folder).forEach((name) => {
      const isFile = this.fs.isFile(this.currentPath, name);
      const item = document.createElement("div");
      item.className = "file-item";

      let iconImg;

      if (isFile) {
        const kind = this.fs.getFileKind(this.currentPath, name);
        if (kind === "image") {
          iconImg = this.fs.getFileContent(this.currentPath, name) || "/icons/file.png";
        } else {
          iconImg = "/icons/file.png";
        }
      } else {
        iconImg = "/icons/notepad.png";
      }

      item.innerHTML = `
        <img src="${iconImg}" style="width:64px;height:64px;object-fit:cover">
        <span>${name}</span>
      `;

      item.ondblclick = () => {
        if (isFile) {
          if (this.fileSelectCallback) {
            this.fileSelectCallback(this.currentPath, name);
            this.fileSelectCallback = null;
          } else {
            const content = this.fs.getFileContent(this.currentPath, name);
            const kind = this.fs.getFileKind(this.currentPath, name);
            if (kind === "image") {
              this.openImageViewer(name, content);
            } else {
              notepadApp.open(name, content, this.currentPath);
            }
          }
        } else {
          this.currentPath.push(name);
          this.render();
        }
      };

      item.oncontextmenu = (e) => this.showFileContextMenu(e, name, isFile);
      view.appendChild(item);
    });
  }

  openImageViewer(name, src) {
    const win = document.createElement("div");
    win.className = "window";
    Object.assign(win.style, { width: "500px", height: "400px", left: "150px", top: "150px", zIndex: 2000 });
    win.innerHTML = `
      <div class="window-header">
        <span>${name}</span>
        <div class="window-controls">
          <button class="close-btn">X</button>
        </div>
      </div>
      <div style="display:flex;justify-content:center;align-items:center;height:calc(100% - 30px);background:#222">
        <img src="${src}" style="max-width:100%; max-height:100%">
      </div>
    `;
    desktop.appendChild(win);
    this.wm.makeDraggable(win);
    win.querySelector(".close-btn").onclick = () => win.remove();
  }

  showFileContextMenu(e, itemName, isFile) {
    e.preventDefault();
    e.stopPropagation();
    contextMenu.innerHTML = "";

    const createMenuItem = (text, onclick) => {
      const item = document.createElement("div");
      item.textContent = text;
      item.onclick = onclick;
      return item;
    };

    const openText = isFile ? "Open" : "Open Folder";
    const openAction = () => {
      contextMenu.style.display = "none";
      if (isFile) {
        const content = this.fs.getFileContent(this.currentPath, itemName);
        notepadApp.open(itemName, content, this.currentPath);
      } else {
        this.currentPath.push(itemName);
        this.render();
      }
    };
    contextMenu.appendChild(createMenuItem(openText, openAction));

    if (isFile) {
      contextMenu.appendChild(document.createElement("hr"));

      const deleteAction = () => {
        contextMenu.style.display = "none";
        this.fs.deleteItem(this.currentPath, itemName);
        this.render();
      };
      contextMenu.appendChild(createMenuItem("Delete", deleteAction));

      const renameAction = () => {
        contextMenu.style.display = "none";
        const newName = prompt("Enter new name:", itemName);
        if (newName && newName !== itemName) {
          this.fs.renameItem(this.currentPath, itemName, newName);
          this.render();
        }
      };
      contextMenu.appendChild(createMenuItem("Rename", renameAction));
    }

    contextMenu.appendChild(document.createElement("hr"));

    const propertiesAction = () => {
      contextMenu.style.display = "none";
      alert(`Name: ${itemName}\nType: ${isFile ? "File" : "Folder"}`);
    };
    contextMenu.appendChild(createMenuItem("Properties", propertiesAction));

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

    document.getElementById("ctx-new-file").onclick = () => {
      contextMenu.style.display = "none";
      const fileName = prompt("Enter file name:", "NewFile.txt");
      if (fileName) {
        this.fs.createFile(this.currentPath, fileName);
        this.render();
      }
    };

    document.getElementById("ctx-new-folder").onclick = () => {
      contextMenu.style.display = "none";
      const folderName = prompt("Enter folder name:", "NewFolder");
      if (folderName) {
        this.fs.createFolder(this.currentPath, folderName);
        this.render();
      }
    };

    document.getElementById("ctx-refresh").onclick = () => {
      contextMenu.style.display = "none";
      this.render();
    };

    Object.assign(contextMenu.style, {
      left: `${e.pageX}px`,
      top: `${e.pageY}px`,
      display: "block"
    });
  }
}
class TerminalApp {
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
    this.registerDefaultCommands();
  }
  async print(text, color = null, isCommand = false, promptText = null, delay = 30) {
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
      await new Promise((resolve) => setTimeout(resolve, delay));
      this.terminalOutput.parentElement.scrollTop = this.terminalOutput.parentElement.scrollHeight;
    }
  }

  enqueuePrint(...args) {
    this.printQueue = this.printQueue.then(() => this.print(...args));
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
      } else if (e.ctrlKey) {
        if (e.key === "l") {
          e.preventDefault();
          this.cmdClear();
        } else if (e.key === "d") {
          e.preventDefault();
          const win = document.getElementById("terminal-win");
          if (win) {
            this.wm.removeFromTaskbar(win.id);
            win.remove();
          }
        } else if (e.key === "c") {
          e.preventDefault();
          this.enqueuePrint("^C", "white", true, this.terminalPrompt.textContent);
          this.terminalInput.value = "";
        }
      }
    });

    document.getElementById("terminal-win").addEventListener("click", () => {
      this.terminalInput.focus();
    });
  }

  executeCommand(commandStr) {
    this.enqueuePrint(commandStr, null, true, this.terminalPrompt.textContent);

    const [command, ...args] = commandStr.trim().split(/\s+/);

    const commands = {
      help: () => this.cmdHelp(),
      clear: () => this.cmdClear(),
      ls: () => this.cmdLs(args),
      pwd: () => this.enqueuePrint(this.currentPath.length > 0 ? "/" + this.currentPath.join("/") : "/"),
      cd: () => this.cmdCd(args),
      mkdir: () =>
        this.cmdFileOp(
          args,
          "mkdir",
          "missing operand",
          () => this.fs.createFolder(this.currentPath, args[0]),
          "Created directory"
        ),
      touch: () =>
        this.cmdFileOp(
          args,
          "touch",
          "missing file operand",
          () => this.fs.createFile(this.currentPath, args[0], ""),
          "Created file"
        ),
      rm: () =>
        this.cmdFileOp(args, "rm", "missing operand", () => this.fs.deleteItem(this.currentPath, args[0]), "Removed"),
      cat: () => this.cmdCat(args),
      echo: () => this.enqueuePrint(args.join(" ")),
      whoami: () => this.enqueuePrint(this.username),
      hostname: () => this.enqueuePrint(this.hostname),
      date: () => this.enqueuePrint(new Date().toString()),
      history: () => this.history.forEach((cmd, i) => this.enqueuePrint(`  ${i + 1}  ${cmd}`)),
      tree: () => this.cmdTree(),
      uname: () => this.enqueuePrint("Linux reeyuki-desktop 6.1.23-arch1-1 #1 SMP PREEMPT x86_64 GNU/Linux"),
      neofetch: () => this.cmdNeofetch(),
      ping: () => this.cmdPing(args),
      curl: () => this.cmdCurl(args),
      ps: () => this.cmdPs()
    };

    if (commands[command]) commands[command]();
    else if (command) this.enqueuePrint(`bash: ${command}: command not found`);

    this.updatePrompt();
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
          <button class="minimize-btn" title="Minimize">−</button>
          <button class="maximize-btn" title="Maximize">□</button>
          <button class="close-btn" title="Close">X</button>
        </div>
      </div>
      <div class="window-content" style="background:#000; color:white; font-family:monospace; padding:10px; overflow-y:auto; height:calc(100% - 40px);">
        <div id="terminal-output" style="white-space: pre;"></div>
        <div id="terminal-input-line" style="display:flex;">
          <span id="terminal-prompt"></span>
          <input type="text" id="terminal-input" style="flex:1; background:transparent; border:none; color:white; font-family:monospace; outline:none; margin-left:5px;" autocomplete="off">
        </div>
      </div>
    `;

    desktop.appendChild(win);
    this.wm.makeDraggable(win);
    this.wm.makeResizable(win);
    this.wm.setupWindowControls(win);
    this.wm.addToTaskbar(win.id, "Terminal");

    this.terminalOutput = win.querySelector("#terminal-output");
    this.terminalInput = win.querySelector("#terminal-input");
    this.terminalPrompt = win.querySelector("#terminal-prompt");

    this.updatePrompt();
    this.terminalInput.focus();
    this.print("Welcome to Reeyuki's silly terminal");
    this.print("Type 'help' for available commands\n");
    this.setupEventHandlers();
  }

  updatePrompt() {
    const path = this.currentPath.length ? "/" + this.currentPath.join("/") : "/";
    this.terminalPrompt.textContent = `${this.username}@${this.hostname}:${path}$ `;
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

  registerCommand(name, handler) {
    this.commands[name] = handler;
  }

  registerFileCommand(name, fsMethod, successMsg, errMsg) {
    this.registerCommand(name, (args) => {
      if (!args.length) return this.print(`${name}: ${errMsg}`);
      try {
        fsMethod(this.currentPath, args[0]);
        this.print(`${successMsg}: ${args[0]}`);
      } catch (e) {
        this.print(`${name}: cannot process '${args[0]}': ${e.message}`);
      }
    });
  }

  registerDefaultCommands() {
    this.registerCommand("help", async () => {
      const cmds = Object.keys(this.commands).sort();
      await this.print("Available commands:");
      for (const c of cmds) await this.print(`  ${c}`);
    });

    this.registerCommand("clear", () => this.cmdClear());
    this.registerCommand("pwd", () => this.print(this.currentPath.length ? "/" + this.currentPath.join("/") : "/"));
    this.registerCommand("ls", (args) => this.cmdLs(args));
    this.registerCommand("cd", (args) => this.cmdCd(args));
    this.registerFileCommand("mkdir", (p, n) => this.fs.createFolder(p, n), "Created directory", "missing operand");
    this.registerFileCommand("touch", (p, n) => this.fs.createFile(p, n, ""), "Created file", "missing file operand");
    this.registerFileCommand("rm", (p, n) => this.fs.deleteItem(p, n), "Removed", "missing operand");

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
  }

  cmdClear() {
    this.terminalOutput.innerHTML = "";
  }

  cmdLs(args) {
    try {
      const path = args.length ? this.fs.resolvePath(args[0], this.currentPath) : this.currentPath;
      Object.keys(this.fs.getFolder(path)).forEach((item) => {
        const isFile = this.fs.isFile(path, item);
        this.print(item + (isFile ? "" : "/"), isFile ? null : "blue");
      });
    } catch {
      this.print(`ls: cannot access '${args[0]}': No such file or directory`);
    }
  }

  cmdCd(args) {
    if (!args.length || args[0] === "~") this.currentPath = ["home", this.username];
    else {
      try {
        const newPath = this.fs.resolvePath(args[0], this.currentPath);
        if (!this.fs.getFolder(newPath)) return this.print(`cd: ${args[0]}: Not a directory`);
        this.currentPath = newPath;
      } catch {
        this.print(`cd: ${args[0]}: No such file or directory`);
      }
    }
  }

  cmdCat(args) {
    if (!args.length) return this.print("cat: missing file operand");
    const file = args[0];
    try {
      if (!this.fs.isFile(this.currentPath, file)) return this.print(`cat: ${file}: Is a directory`);
      this.print(this.fs.getFileContent(this.currentPath, file) || "(empty file)");
    } catch {
      this.print(`cat: ${file}: No such file or directory`);
    }
  }

  async cmdPing(args) {
    if (!args.length) return this.print("Usage: ping <host>");
    const host = args[0].startsWith("http") ? args[0] : "https://" + args[0];
    await this.print(`PING ${args[0]} ...`);
    const start = performance.now();
    try {
      await fetch(host, { method: "HEAD", mode: "no-cors" });
    } catch {}
    await this.print(`Reply from ${args[0]}: time=${(performance.now() - start).toFixed(2)}ms`);
  }

  async cmdCurl(args) {
    if (!args.length) return this.print("Usage: curl <url>");
    try {
      const text = await (await fetch(args[0])).text();
      await this.print(text.slice(0, 1000));
    } catch {
      await this.print(`curl: (6) Could not resolve host: ${args[0]}`);
    }
  }

  async cmdNeofetch() {
    const ua = navigator.userAgent;
    const platform = navigator.platform || "Unknown";
    const browser = /Firefox\/\d+/.test(ua)
      ? "Firefox"
      : /Edg\/\d+/.test(ua)
        ? "Edge"
        : /Chrome\/\d+/.test(ua)
          ? "Chrome"
          : "Unknown";
    const cores = navigator.hardwareConcurrency || "Unknown";
    const memoryGB = navigator.deviceMemory || "Unknown";
    let gpu = "Unknown";
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (gl) {
        const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
        gpu = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      }
    } catch {}
    const lines = [
      `       .--.      ${this.username}@${this.hostname}`,
      `     |o_o |     OS: Arch Linux`,
      `     |:_/ |     Browser: ${browser}`,
      `    //   \\ \\   CPU Cores: ${cores}`,
      `   (|     | )  Architecture: ${platform}`,
      `  /'\\_   _/\\'\\ RAM: ${memoryGB} GB`,
      `  \\___)=(___/   GPU: ${gpu}`,
      `                Resolution: ${window.innerWidth}x${window.innerHeight}`,
      `                DE: KDE Plasma`
    ];
    for (const line of lines) await this.print(line, "cyan");
  }

  cmdPs() {
    const windows = Array.from(document.querySelectorAll(".window"));
    this.print("  PID   TTY          TIME CMD");
    if (!windows.length) this.print("  1     pts/0        0:00 idle");
    else
      windows.forEach((win, i) => {
        const cmd = win.querySelector(".window-header span")?.textContent || "unknown";
        this.print(`  ${1000 + i}  pts/0      0:00 ${cmd}`);
      });
  }

  cmdTree(path = this.currentPath, prefix = "") {
    if (!prefix) this.print(path.length ? "/" + path.join("/") : "/");
    try {
      const items = Object.keys(this.fs.getFolder(path));
      items.forEach((item, idx) => {
        const isFile = this.fs.isFile(path, item);
        const isLast = idx === items.length - 1;
        this.print(prefix + (isLast ? "└── " : "├── ") + item + (isFile ? "" : "/"));
        if (!isFile) this.cmdTree([...path, item], prefix + (isLast ? "    " : "│   "));
      });
    } catch {
      this.print(`tree: error reading directory`);
    }
  }
}

class WindowManager {
  constructor() {
    this.openWindows = new Map();
    this.zIndexCounter = 1000;
  }

  createWindow(id, title, width = "80vw", height = "80vh") {
    const win = document.createElement("div");
    win.className = "window";
    win.id = id;
    win.dataset.fullscreen = "false";

    const vw = width.includes("vw") ? (window.innerWidth * parseFloat(width)) / 100 : parseInt(width);
    const vh = height.includes("vh") ? (window.innerHeight * parseFloat(height)) / 100 : parseInt(height);

    Object.assign(win.style, {
      width: `${vw}px`,
      height: `${vh}px`,
      left: `${(window.innerWidth - vw) / 2}px`,
      top: `${(window.innerHeight - vh) / 2}px`,
      position: "absolute",
      zIndex: this.zIndexCounter++
    });

    return win;
  }

  addToTaskbar(winId, title) {
    if (document.getElementById(`taskbar-${winId}`)) return;

    const taskbarItem = document.createElement("div");
    taskbarItem.id = `taskbar-${winId}`;
    taskbarItem.className = "taskbar-item";
    taskbarItem.textContent = title;

    Object.assign(taskbarItem.style, {
      padding: "8px 15px",
      background: "#2a2a2a",
      color: "white",
      cursor: "pointer",
      borderRadius: "4px",
      marginRight: "5px",
      fontSize: "13px",
      maxWidth: "150px",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    });

    taskbarItem.onclick = () => {
      const win = document.getElementById(winId);
      if (win) {
        if (win.style.display === "none") {
          win.style.display = "block";
          taskbarItem.style.background = "#2a2a2a";
        } else {
          this.bringToFront(win);
        }
      }
    };

    taskbarWindows.appendChild(taskbarItem);
    this.openWindows.set(winId, { taskbarItem, title });
  }

  removeFromTaskbar(winId) {
    const taskbarItem = document.getElementById(`taskbar-${winId}`);
    if (taskbarItem) taskbarItem.remove();
    this.openWindows.delete(winId);
  }

  bringToFront(win) {
    win.style.zIndex = this.zIndexCounter++;
  }

  minimizeWindow(win) {
    win.style.display = "none";
    const taskbarItem = document.getElementById(`taskbar-${win.id}`);
    if (taskbarItem) taskbarItem.style.background = "#1a1a1a";
  }

  toggleFullscreen(win) {
    const wasFullscreen = win.dataset.fullscreen === "true";

    if (wasFullscreen) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
      win.style.width = win.dataset.prevWidth;
      win.style.height = win.dataset.prevHeight;
      win.style.left = win.dataset.prevLeft;
      win.style.top = win.dataset.prevTop;
      win.dataset.fullscreen = "false";
    } else {
      Object.assign(win.dataset, {
        prevWidth: win.style.width,
        prevHeight: win.style.height,
        prevLeft: win.style.left,
        prevTop: win.style.top
      });

      const makeFullscreen = () => {
        Object.assign(win.style, {
          width: "100vw",
          height: "calc(100vh - 40px)",
          left: "0",
          top: "0"
        });
      };

      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().then(makeFullscreen).catch(makeFullscreen);
      } else {
        makeFullscreen();
      }

      win.dataset.fullscreen = "true";
    }
  }

  setupWindowControls(win) {
    win.querySelector(".close-btn").onclick = () => {
      this.removeFromTaskbar(win.id);
      win.remove();
    };
    win.querySelector(".minimize-btn").onclick = () => this.minimizeWindow(win);
    win.querySelector(".maximize-btn").onclick = () => this.toggleFullscreen(win);
    win.addEventListener("mousedown", () => this.bringToFront(win));
  }

  makeDraggable(win) {
    const header = win.querySelector(".window-header");
    header.onmousedown = (e) => {
      if (e.target.tagName === "BUTTON") return;
      const ox = e.clientX - win.offsetLeft;
      const oy = e.clientY - win.offsetTop;
      document.onmousemove = (e) => {
        win.style.left = `${e.clientX - ox}px`;
        win.style.top = `${e.clientY - oy}px`;
      };
      document.onmouseup = () => (document.onmousemove = null);
    };
  }

  makeResizable(win) {
    const resizer = document.createElement("div");
    Object.assign(resizer.style, {
      width: "10px",
      height: "10px",
      background: "transparent",
      position: "absolute",
      right: "0",
      bottom: "0",
      cursor: "se-resize"
    });
    win.appendChild(resizer);

    resizer.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = parseInt(document.defaultView.getComputedStyle(win).width, 10);
      const startHeight = parseInt(document.defaultView.getComputedStyle(win).height, 10);

      const doDrag = (e) => {
        win.style.width = `${startWidth + e.clientX - startX}px`;
        win.style.height = `${startHeight + e.clientY - startY}px`;
      };

      const stopDrag = () => {
        document.documentElement.removeEventListener("mousemove", doDrag);
        document.documentElement.removeEventListener("mouseup", stopDrag);
      };

      document.documentElement.addEventListener("mousemove", doDrag);
      document.documentElement.addEventListener("mouseup", stopDrag);
    });
  }
}

class NotepadApp {
  constructor(fileSystemManager, windowManager) {
    this.fs = fileSystemManager;
    this.wm = windowManager;
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
    this.wm.addToTaskbar(win.id, `${title} - Notepad`);

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
    alert(`File saved: ${title}`);
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
      alert(`File saved: ${fileName} at /${pathString}`);
    } catch (error) {
      alert("Error saving file. Please check the path.");
    }
  }

  openFileDialog() {
    explorerApp.open((path, fileName) => {
      const content = this.fs.getFileContent(path, fileName);
      this.open(fileName, content, path);
    });
  }
}

class MusicPlayer {
  constructor() {
    this.currentTrackIndex = 0;
  }
  open(windowManager) {
    if (document.getElementById("music-win")) {
      windowManager.bringToFront(document.getElementById("music-win"));
      return;
    }
    const win = windowManager.createWindow("music-win", "MUSIC");
    const initialTrackId = CONFIG.MUSIC_PLAYLIST[this.currentTrackIndex];

    win.innerHTML = `
  <div class="window-header">
    <span>MUSIC</span>
    <div class="window-controls">
      <button class="minimize-btn" title="Minimize">−</button>
      <button class="maximize-btn" title="Maximize">□</button>
      <button class="close-btn" title="Close">X</button>
    </div>
  </div>
  <div class="window-content" style="width:100%; height:100%;">
    <div class="player-container" style="display:flex; flex-direction:column; align-items:center; gap:10px; padding:10px;">
      <iframe id="player-frame" 
              src="https://open.spotify.com/embed/track/${initialTrackId}?utm_source=generator" 
              style="width:100%; height:100%; border:none;" 
              allow="autoplay; encrypted-media"></iframe>
      <div class="player-controls" style="display:flex; align-items:center; gap:15px; background:#282828; padding:8px 15px; border-radius:20px; color:white;">
        <button id="music-prev" style="background:none; border:none; color:white; cursor:pointer; font-size:18px;">⏮</button>
        <span id="music-status" style="font-family:monospace; font-size:12px; min-width:80px; text-align:center;">Track ${
          this.currentTrackIndex + 1
        } / ${CONFIG.MUSIC_PLAYLIST.length}</span>
        <button id="music-next" style="background:none; border:none; color:white; cursor:pointer; font-size:18px;">⏭</button>
      </div>
    </div>
  </div>`;

    desktop.appendChild(win);
    windowManager.makeDraggable(win);
    windowManager.makeResizable(win);
    windowManager.setupWindowControls(win);
    windowManager.addToTaskbar(win.id, "MUSIC");

    this.setupControls(win);
  }
  setupControls(win) {
    const frame = win.querySelector("#player-frame");
    const status = win.querySelector("#music-status");

    win.querySelector("#music-next").onclick = () => {
      this.currentTrackIndex = (this.currentTrackIndex + 1) % CONFIG.MUSIC_PLAYLIST.length;
      this.updateUI(frame, status);
    };

    win.querySelector("#music-prev").onclick = () => {
      this.currentTrackIndex =
        (this.currentTrackIndex - 1 + CONFIG.MUSIC_PLAYLIST.length) % CONFIG.MUSIC_PLAYLIST.length;
      this.updateUI(frame, status);
    };
  }
  updateUI(frame, status) {
    const trackId = CONFIG.MUSIC_PLAYLIST[this.currentTrackIndex];
    frame.src = "";
    frame.src = `https://open.spotify.com/embed/track/${trackId}`;
    status.innerText = `Track ${this.currentTrackIndex + 1} / ${CONFIG.MUSIC_PLAYLIST.length}`;
  }
}

class AppLauncher {
  constructor(windowManager, fileSystemManager, musicPlayer) {
    this.wm = windowManager;
    this.fs = fileSystemManager;
    this.musicPlayer = musicPlayer;
  }

  launch(app, icon) {
    const appMap = {
      return: { type: "system", action: () => (window.location.href = "/") },
      explorer: { type: "system", action: () => explorerApp.open() },
      computer: { type: "system", action: () => explorerApp.open() },
      terminal: { type: "system", action: () => terminalApp.open() },
      notepad: { type: "system", action: () => notepadApp.open() },
      music: { type: "system", action: () => this.musicPlayer.open(this.wm) },
      sonic: {
        type: "swf",
        swf: "https://raw.githubusercontent.com/Reeyuki/reeyuki.github.io/refs/heads/main/static/sonic.swf"
      },
      swarmQueen: { type: "swf", swf: "https://files.catbox.moe/tczjsf.swf" },
      pacman: { type: "game", url: "https://pacman-e281c.firebaseapp.com" },
      pvz: { type: "game", url: "https://emupedia.net/emupedia-game-pvz" },
      tetris: { type: "game", url: "https://turbowarp.org/embed.html?autoplay#31651654" },
      roads: { type: "game", url: "https://slowroads.io" },
      vscode: { type: "game", url: "https://emupedia.net/emupedia-app-vscode" },
      isaac: { type: "game", url: "https://emupedia.net/emupedia-game-binding-of-isaac" },
      mario: { type: "game", url: "https://emupedia.net/emupedia-game-mario" },
      papaGames: { type: "game", url: "https://papasgamesfree.io" },
      zombotron: { type: "game", url: "https://www.gameflare.com/embed/zombotron" },
      zombotron2: { type: "game", url: "https://www.gameflare.com/embed/zombotron-2" },
      zombieTd: { type: "game", url: "https://www.gamesflow.com/jeux.php?id=2061391" },
      fancyPants: { type: "game", url: "https://www.friv.com/z/games/fancypantsadventure/game.html" },
      fancyPants2: { type: "game", url: "https://www.friv.com/z/games/fancypantsadventure2/game.html" },
      jojo: {
        type: "game",
        url: "https://www.retrogames.cc/embed/8843-jojos-bizarre-adventure%3A-heritage-for-the-future-jojo-no-kimyou-na-bouken%3A-mirai-e-no-isan-japan-990927-no-cd.html"
      },
      pokemonRed: { type: "gba", url: "pokemon-red.gba" },
      pokemonEmerald: { type: "gba", url: "pokemon-emerald.gba" },
      pokemonRuby: { type: "gba", url: "pokemon-ruby.gba" },
      pokemonSapphire: { type: "gba", url: "pokemon-sapphire.gba" },
      pokemonPlatinum: { type: "nds", url: "pokemon-platinum.nds" }
    };

    const info = appMap[app];
    if (!info) return;

    switch (info.type) {
      case "system":
        info.action();
        break;
      case "swf":
        this.openRuffleApp(info.swf);
        break;
      case "gba":
        this.openEmulatorApp(info.url, "gba");
        break;
      case "nds":
        this.openEmulatorApp(info.url, "nds");
        break;
      case "game":
        this.openGameApp(app, info.url);
        break;
    }
  }

  openRuffleApp(swfPath, gameName = "Ruffle Game") {
    const id = swfPath.replace(/[^a-zA-Z0-9]/g, "");
    if (document.getElementById(`${id}-win`)) {
      this.wm.bringToFront(document.getElementById(`${id}-win`));
      return;
    }

    const content = `<embed src="${swfPath}" width="100%" height="100%">`;
    this.createWindow(id, gameName.toUpperCase(), content);
  }

  openEmulatorApp(romName, core) {
    const uniqueId = `${core}-${romName.replace(/\W/g, "")}-${Date.now()}`;

    if (document.getElementById(uniqueId)) {
      this.wm.bringToFront(document.getElementById(uniqueId));
      return;
    }

    const iframeUrl = `/static/emulatorjs.html?rom=${encodeURIComponent(romName)}&core=${encodeURIComponent(core)}&color=%230064ff`;

    const content = `
      <iframe src="${iframeUrl}"
              id="${uniqueId}-iframe"
              style="width:100%; height:100%; border:none;"
              allow="autoplay; fullscreen; clipboard-write; encrypted-media; picture-in-picture"
              sandbox="allow-forms allow-downloads allow-modals allow-pointer-lock allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation allow-autoplay">
      </iframe>
    `;

    const windowTitle = romName.replace(/\..+$/, "");

    this.createWindow(uniqueId, windowTitle, content, iframeUrl);
  }

  openGameApp(type, url) {
    if (document.getElementById(`${type}-win`)) {
      this.wm.bringToFront(document.getElementById(`${type}-win`));
      return;
    }

    const content = `
      <iframe src="${url}" 
              style="width:100%; height:100%; border:none;" 
              allow="autoplay; fullscreen; clipboard-write; encrypted-media; picture-in-picture"
              sandbox="allow-forms allow-downloads allow-modals allow-pointer-lock allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation allow-autoplay"></iframe>
    `;

    const formattedName = type.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase());

    this.createWindow(type, formattedName, content, url);
  }

  createWindow(id, title, contentHtml, externalUrl = null) {
    const win = this.wm.createWindow(`${id}-win`, title);
    win.innerHTML = `
      <div class="window-header">
        <span>${title}</span>
        <div class="window-controls">
          <button class="minimize-btn" title="Minimize">−</button>
          ${externalUrl ? `<button class="external-btn" title="Open in External">↗</button>` : ""}
          <button class="maximize-btn" title="Maximize">□</button>
          <button class="close-btn" title="Close">X</button>
        </div>
      </div>
      <div class="window-content" style="width:100%; height:100%;">
        ${contentHtml}
      </div>
    `;
    desktop.appendChild(win);
    this.wm.makeDraggable(win);
    this.wm.makeResizable(win);
    this.wm.setupWindowControls(win);

    if (externalUrl) {
      win.querySelector(".external-btn").addEventListener("click", () => {
        window.open(externalUrl, "_blank");
      });
    }

    this.wm.addToTaskbar(win.id, title);
  }
}

class DesktopUI {
  constructor(appLauncher) {
    this.appLauncher = appLauncher;
    this.desktop = document.getElementById("desktop");
    this.startButton = document.getElementById("start-button");
    this.startMenu = document.getElementById("start-menu");
    this.contextMenu = document.getElementById("context-menu");
    this.selectionBox = document.getElementById("selection-box");
    this.setupEventListeners();
  }
  setupEventListeners() {
    this.startButton.addEventListener("click", (e) => {
      e.stopPropagation();
      this.startMenu.style.display = this.startMenu.style.display === "flex" ? "none" : "flex";
    });
    this.startMenu.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    document.addEventListener("click", () => {
      this.startMenu.style.display = "none";
      this.contextMenu.style.display = "none";
    });

    this.desktop.addEventListener("contextmenu", (e) => {
      if (e.target === this.desktop) {
        e.preventDefault();
        this.showDesktopContextMenu(e);
      }
    });

    this.setupIconHandlers();
    this.setupSelectionBox();
    this.setupStartMenu();
  }
  setupIconHandlers() {
    document.querySelectorAll(".icon.selectable").forEach((icon) => {
      Object.assign(icon.style, {
        userSelect: "none",
        webkitUserDrag: "none"
      });
      icon.draggable = false;
      icon.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        const app = icon.dataset.app;
        if (app) {
          this.appLauncher.launch(app, icon);
        }
      });

      icon.addEventListener("mousedown", (e) => {
        e.stopPropagation();
      });
    });
  }
  showDesktopContextMenu(e) {
    this.contextMenu.innerHTML = ` <div id="ctx-new-notepad">New Notepad</div>       <div id="ctx-open-explorer">Open File Explorer</div>       <hr>       <div id="ctx-refresh">Refresh</div>       <hr>    ;`;
    document.getElementById("ctx-new-notepad").onclick = () => {
      this.contextMenu.style.display = "none";
      notepadApp.open();
    };

    document.getElementById("ctx-open-explorer").onclick = () => {
      this.contextMenu.style.display = "none";
      explorerApp.open();
    };

    document.getElementById("ctx-refresh").onclick = () => {
      this.contextMenu.style.display = "none";
      location.reload();
    };

    Object.assign(this.contextMenu.style, {
      left: `${e.pageX}px`,
      top: `${e.pageY}px`,
      display: "block"
    });
  }
  setupSelectionBox() {
    const selectableIcons = document.querySelectorAll(".selectable");
    let startX, startY;
    this.desktop.addEventListener("mousedown", (e) => {
      if (e.target !== this.desktop) return;

      startX = e.pageX;
      startY = e.pageY;

      Object.assign(this.selectionBox.style, {
        left: `${startX}px`,
        top: `${startY}px`,
        width: "0px",
        height: "0px",
        display: "block"
      });
      selectableIcons.forEach((icon) => icon.classList.remove("selected"));

      const onMouseMove = (e) => {
        const width = Math.abs(e.pageX - startX);
        const height = Math.abs(e.pageY - startY);
        const left = Math.min(e.pageX, startX);
        const top = Math.min(e.pageY, startY);

        Object.assign(this.selectionBox.style, {
          width: `${width}px`,
          height: `${height}px`,
          left: `${left}px`,
          top: `${top}px`
        });

        const boxRect = this.selectionBox.getBoundingClientRect();
        selectableIcons.forEach((icon) => {
          const iconRect = icon.getBoundingClientRect();
          const isOverlapping = !(
            iconRect.right < boxRect.left ||
            iconRect.left > boxRect.right ||
            iconRect.bottom < boxRect.top ||
            iconRect.top > boxRect.bottom
          );

          if (isOverlapping) {
            icon.classList.add("selected");
          } else {
            icon.classList.remove("selected");
          }
        });
      };

      const onMouseUp = () => {
        this.selectionBox.style.display = "none";
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
  }
  setupStartMenu() {
    this.startMenu.querySelectorAll(".start-item").forEach((item) => {
      item.onclick = (e) => {
        e.stopPropagation();
        const app = item.dataset.app;
        if (app === "documents") {
          explorerApp.open();
          explorerApp.navigate(["home", "reeyuki", "Documents"]);
        } else if (app === "pictures") {
          explorerApp.open();
          explorerApp.navigate(["home", "reeyuki", "Pictures"]);
        } else if (app === "notes") {
          notepadApp.open();
        }

        this.startMenu.style.display = "none";
      };
    });
  }
}
class SystemUtilities {
  static startClock() {
    const updateClock = () => {
      const now = new Date();
      document.getElementById("clock").textContent = now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });
      document.getElementById("date").textContent = now.toLocaleDateString();
    };
    setInterval(updateClock, 1000);
    updateClock();
  }
  static setRandomWallpaper() {
    const wallpapers = [
      "/static/wallpapers/wallpaper1.webp",
      "/static/wallpapers/wallpaper2.webp",
      "/static/wallpapers/wallpaper3.webp"
    ];

    const randomWallpaper = wallpapers[Math.floor(Math.random() * wallpapers.length)];

    document.body.style.background = `url('${randomWallpaper}') no-repeat center center fixed`;
    document.body.style.backgroundSize = "cover";
  }
}
const desktop = document.getElementById("desktop");
const taskbarWindows = document.getElementById("taskbar-windows");
const contextMenu = document.getElementById("context-menu");
const fileSystemManager = new FileSystemManager();
const windowManager = new WindowManager();
const notepadApp = new NotepadApp(fileSystemManager, windowManager);
const explorerApp = new ExplorerApp(fileSystemManager, windowManager);
const terminalApp = new TerminalApp(fileSystemManager, windowManager);
const musicPlayer = new MusicPlayer();
const appLauncher = new AppLauncher(windowManager, fileSystemManager, musicPlayer);
const desktopUI = new DesktopUI(appLauncher);
SystemUtilities.startClock();
SystemUtilities.setRandomWallpaper();
