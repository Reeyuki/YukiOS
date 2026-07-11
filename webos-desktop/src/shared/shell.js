import { $$ } from "./domUtils.js";
import { os } from "../framework.js";

export class Shell {
  constructor(fs, sessionKey) {
    this.fs = fs;
    this.sessionKey = sessionKey;
    this.currentPath = ["home", sessionKey];
    this.commands = {};
    this.history = [];
    this.historyIndex = -1;
    this.registerDefaultCommands();
  }

  pathToString(path) {
    if (!Array.isArray(path) || path.length === 0) return "/";
    return "/" + path.join("/");
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

  async executePipeline(pipeline, outputCallback) {
    let output = null;

    for (let i = 0; i < pipeline.length; i++) {
      const { command, args, flags } = pipeline[i];
      const expandedArgs = await this.expandGlobsInArgs(args, this.currentPath);

      if (output !== null) {
        expandedArgs.unshift(output);
      }

      const handler = this.commands[command];
      if (!handler) {
        if (command) await outputCallback(`${command}: command not found`);
        return;
      }

      if (i < pipeline.length - 1) {
        output = await this.captureOutput(() => handler(expandedArgs, flags), outputCallback);
      } else {
        await handler(expandedArgs, flags, outputCallback);
      }
    }
  }

  async captureOutput(fn, outputCallback) {
    const capturedLines = [];
    const originalCallback = outputCallback;

    const captureCallback = (text) => {
      capturedLines.push(text);
    };

    await fn(captureCallback);

    return capturedLines.join("\n");
  }

  async executeCommand(commandStr, outputCallback) {
    this.history.push(commandStr);
    const pipeline = this.parseCommand(commandStr);
    await this.executePipeline(pipeline, outputCallback);
  }

  registerCommand(name, handler) {
    this.commands[name] = handler;
  }

  registerDefaultCommands() {
    this.registerCommand("help", (args, flags, output) => this.cmdHelp(output));
    this.registerCommand("clear", (args, flags, output) => this.cmdClear(output));
    this.registerCommand("pwd", (args, flags, output) => output(this.pathToString(this.currentPath)));
    this.registerCommand("ls", (args, flags, output) => this.cmdLs(args, flags, output));
    this.registerCommand("cd", (args, flags, output) => this.cmdCd(args, output));
    this.registerCommand("mkdir", (args, flags, output) => this.cmdMkdir(args, output));
    this.registerCommand("touch", (args, flags, output) => this.cmdTouch(args, output));
    this.registerCommand("rm", (args, flags, output) => this.cmdRm(args, flags, output));
    this.registerCommand("cat", (args, flags, output) => this.cmdCat(args, output));
    this.registerCommand("echo", (args, flags, output) => output(args.join(" ")));
    this.registerCommand("whoami", (args, flags, output) => output(this.sessionKey));
    this.registerCommand("hostname", (args, flags, output) => output("yuki-os"));
    this.registerCommand("date", (args, flags, output) => output(new Date().toString()));
    this.registerCommand("history", (args, flags, output) => this.cmdHistory(output));
    this.registerCommand("tree", (args, flags, output) => this.cmdTree(output));
    this.registerCommand("uname", (args, flags, output) =>
      output("Linux reeyuki-desktop 6.1.23-arch1-1 #1 SMP PREEMPT x86_64 GNU/Linux")
    );
    this.registerCommand("ping", (args, flags, output) => this.cmdPing(args, output));
    this.registerCommand("curl", (args, flags, output) => this.cmdCurl(args, output));
    this.registerCommand("neofetch", (args, flags, output) => this.cmdNeofetch(output));
    this.registerCommand("ps", (args, flags, output) => this.cmdPs(output));
    this.registerCommand("grep", (args, flags, output) => this.cmdGrep(args, output));
    this.registerCommand("wc", (args, flags, output) => this.cmdWc(args, output));
  }

  cmdHelp(output) {
    output("Available commands:");
    output("  help     - Show this help message");
    output("  clear    - Clear terminal");
    output("  ls       - List files");
    output("  pwd      - Print working directory");
    output("  cd       - Change directory");
    output("  cat      - Display file contents");
    output("  mkdir    - Create directory");
    output("  touch    - Create file");
    output("  rm       - Remove file or directory");
    output("  echo     - Print text");
    output("  whoami   - Print current user");
    output("  hostname - Print hostname");
    output("  date     - Show current date");
    output("  history  - Show command history");
    output("  tree     - Display directory tree");
    output("  uname    - Print system information");
    output("  ping     - Ping a host");
    output("  curl     - Fetch URL content");
    output("  neofetch - Display system info");
    output("  ps       - List processes");
    output("  grep     - Search for pattern");
    output("  wc       - Count lines, words, characters");
  }

  cmdClear(output) {
    this.clearCallback && this.clearCallback();
  }

  setClearCallback(callback) {
    this.clearCallback = callback;
  }

  async cmdLs(args = [], flags = [], output) {
    const showAll = flags.some((f) => f.includes("a"));
    const longFormat = flags.some((f) => f.includes("l"));
    const humanReadable = flags.some((f) => f.includes("h"));

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

    try {
      const items = await os.fs.readdir(this.pathToString(this.currentPath));
      const filtered = showAll ? items : Object.keys(items).filter((k) => !k.startsWith("."));

      if (longFormat) {
        for (const name of filtered) {
          const fullPath = this.fs.resolvePath(name, this.currentPath);
          const stat = await this.fs.pStat(this.pathToString(fullPath));
          const isDir = stat && stat.mode === 16877;
          const size = stat ? stat.size : 0;
          output(`${isDir ? "d" : "-"}rwxr-xr-x 1 ${this.sessionKey} ${this.sessionKey} ${formatSize(size)} ${name}`);
        }
      } else {
        output(Object.keys(filtered).join("  "));
      }
    } catch (e) {
      output(`ls: ${e.message}`);
    }
  }

  async cmdCd(args, output) {
    if (!args[0]) {
      this.currentPath = ["home", this.sessionKey];
      return;
    }
    const target = args[0];
    if (target === "..") {
      if (this.currentPath.length > 0) {
        this.currentPath.pop();
      }
      return;
    }
    if (target === "/") {
      this.currentPath = [];
      return;
    }
    try {
      const newPath = this.fs.resolvePath(target, this.currentPath);
      const stat = await this.fs.pStat(this.pathToString(newPath));
      if (stat && stat.mode === 16877) {
        this.currentPath = newPath;
      } else {
        output(`cd: ${target}: Not a directory`);
      }
    } catch (e) {
      output(`cd: ${target}: No such directory`);
    }
  }

  async cmdCat(args, output) {
    if (!args[0]) {
      output("cat: missing file operand");
      return;
    }
    try {
      const filePath = this.fs.resolvePath(args[0], this.currentPath);
      const content = await os.fs.read(this.pathToString(filePath));
      output(content);
    } catch (e) {
      output(`cat: ${args[0]}: No such file`);
    }
  }

  async cmdMkdir(args, output) {
    if (!args[0]) {
      output("mkdir: missing operand");
      return;
    }
    try {
      const dirPath = this.fs.resolvePath(args[0], this.currentPath);
      await this.fs.mkdir(this.pathToString(dirPath));
      output(`Directory created: ${args[0]}`);
    } catch (e) {
      output(`mkdir: ${args[0]}: ${e.message}`);
    }
  }

  async cmdTouch(args, output) {
    if (!args[0]) {
      output("touch: missing file operand");
      return;
    }
    try {
      const filePath = this.fs.resolvePath(args[0], this.currentPath);
      await os.fs.write(this.pathToString(filePath), "");
      output(`File created: ${args[0]}`);
    } catch (e) {
      output(`touch: ${args[0]}: ${e.message}`);
    }
  }

  async cmdRm(args, flags, output) {
    if (!args[0]) {
      output("rm: missing operand");
      return;
    }
    const recursive = flags.some((f) => f.includes("r") || f.includes("f"));
    try {
      const targetPath = this.fs.resolvePath(args[0], this.currentPath);
      const stat = await this.fs.pStat(this.pathToString(targetPath));

      if (stat && stat.mode === 16877) {
        if (recursive) {
          await this.fs.deleteDirectoryRecursive(this.pathToString(targetPath));
          output(`Directory removed: ${args[0]}`);
        } else {
          output(`rm: cannot remove '${args[0]}': Is a directory (use -r)`);
        }
      } else {
        await this.fs.unlink(this.pathToString(targetPath));
        output(`File removed: ${args[0]}`);
      }
    } catch (e) {
      output(`rm: ${args[0]}: ${e.message}`);
    }
  }

  cmdHistory(output) {
    this.history.forEach((cmd, i) => output(`  ${i + 1}  ${cmd}`));
  }

  async cmdTree(output) {
    const listTree = async (path, prefix = "") => {
      try {
        const items = Object.keys(await os.fs.readdir(this.pathToString(path)));
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const isFile = await this.fs.isFile(path, item);
          const last = i === items.length - 1;
          output(prefix + (last ? "└── " : "├── ") + item + (isFile ? "" : "/"));
          if (!isFile) {
            await listTree([...path, item], prefix + (last ? "    " : "│   "));
          }
        }
      } catch (e) {
        output(`tree: cannot access '${this.pathToString(path)}': No such file or directory`);
      }
    };
    output(this.pathToString(this.currentPath));
    await listTree(this.currentPath);
  }

  async cmdPing(args, output) {
    if (!args[0]) {
      output("Usage: ping <host>");
      return;
    }
    output(`PING ${args[0]} ...`);
    const start = performance.now();
    try {
      await fetch("https://" + args[0], { method: "HEAD", mode: "no-cors" });
    } catch (e) {
      console.error(e);
    }
    output(`Reply from ${args[0]}: time=${(performance.now() - start).toFixed(2)}ms`);
  }

  async cmdCurl(args, output) {
    if (!args[0]) {
      output("Usage: curl <url>");
      return;
    }
    try {
      const text = await (await fetch(args[0])).text();
      output(text.slice(0, 1000));
    } catch {
      output(`curl: (6) Could not resolve host: ${args[0]}`);
    }
  }

  async cmdNeofetch(output) {
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
    const coresText = typeof cores === "number" && cores > 10 ? `${cores} (Wow its op!)` : cores;

    let gpu = "Unknown";
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      if (gl) {
        gpu = gl.getParameter(gl.RENDERER);
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

    const lines = [
      "",
      "",
      "                     " + this.sessionKey + "@yuki-os",
      `        /\\           OS     ${osText}`,
      `       /  \\          KERNEL   ${engine}wu`,
      `      /\\   \\        CPU Cores: ${coresText}`,
      `     / > ω <\\        BROWSER  ${browserText}`,
      `    /   __   \\       GRAPHICS    ${gpu}`,
      `   / __|  |__-\\      MEMOWY    ${ram}`,
      `  /_-''    ''-_\\     DO-NOT-TRACK  ${dnt}`,
      `                      RESOLUTION   ${window.innerWidth}x${window.innerHeight}`
    ];

    for (const line of lines) {
      output(line);
    }
  }

  async cmdPs(output) {
    const wins = $$(".window");
    output("  PID   TTY      TIME CMD");
    for (let i = 0; i < wins.length; i++) {
      const cmd = os.window.getTitle(wins[i].id) || "unknown";
      output(`  ${1000 + i}  pts/0  0:00 ${cmd}`);
    }
  }

  cmdGrep(args, output) {
    if (args.length < 1) {
      output("grep: missing pattern");
      return;
    }
    const pattern = args[0];
    const input = args.slice(1).join(" ");
    const lines = input.split("\n");
    const regex = new RegExp(pattern, "i");
    lines.forEach((line) => {
      if (regex.test(line)) {
        output(line);
      }
    });
  }

  cmdWc(args, output) {
    const input = args.join(" ");
    const lines = input.split("\n").filter((l) => l.length > 0);
    const words = input.split(/\s+/).filter((w) => w.length > 0);
    const chars = input.length;
    output(`  ${lines.length}  ${words.length}  ${chars}`);
  }
}
